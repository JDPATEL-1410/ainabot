const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { db, getCurrentUser, genId, nowIso } = require('../helpers');

const upload = multer({ dest: 'uploads/' });

// Plan enforcement helper
const checkTrial = async (workspaceId) => {
    try {
        const { checkPlanLimits } = require('./extras');
        if (checkPlanLimits) {
            await checkPlanLimits(workspaceId, "send");
        }
    } catch (err) {
        throw err;
    }
};

// --- Contacts ---
router.get('/contacts', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) {
        return res.status(400).json({ detail: "No workspace" });
    }

    const { search, tag, source, skip = 0, limit = 50 } = req.query;
    const query = { workspace_id: user.workspace_id };

    if (search) {
        query.$or = [
            { name: { $regex: search } },
            { phone: { $regex: search } },
            { email: { $regex: search } }
        ];
    }
    if (tag) {
        query.tags = tag;
    }
    if (source) {
        query.source = source;
    }

    const contacts = await db.contacts.find(query).sort("created_at", -1).skip(parseInt(skip)).limit(parseInt(limit)).to_list(parseInt(limit));
    const total = await db.contacts.count_documents(query);
    res.json({ contacts, total });
});

router.post('/contacts/bulk-delete', getCurrentUser, async (req, res) => {
    const { ids } = req.body;
    await db.contacts.delete_many({
        id: { $in: ids },
        workspace_id: req.user.workspace_id
    });
    res.json({ message: "Deleted" });
});

router.post('/contacts/bulk-tag', getCurrentUser, async (req, res) => {
    const { ids, tags, action = "add" } = req.body;
    if (action === "add") {
        await db.contacts.update_many(
            { id: { $in: ids }, workspace_id: req.user.workspace_id },
            { $addToSet: { tags: { $each: tags } } }
        );
    } else {
        await db.contacts.update_many(
            { id: { $in: ids }, workspace_id: req.user.workspace_id },
            { $pull: { tags: { $in: tags } } }
        );
    }
    res.json({ message: "Updated" });
});

router.post('/contacts', getCurrentUser, async (req, res) => {
    const user = req.user;
    const { name, phone, email = "", tags = [], source = "manual" } = req.body;

    const existing = await db.contacts.findOne({ workspace_id: user.workspace_id, phone });
    if (existing) {
        return res.status(400).json({ detail: "Contact with this phone already exists" });
    }

    const contact = {
        id: genId(),
        workspace_id: user.workspace_id,
        phone,
        name,
        email,
        tags,
        source,
        custom_fields: {},
        last_seen: nowIso(),
        created_at: nowIso()
    };
    await db.contacts.insert_one(contact);
    res.json({ contact });
});

router.patch('/contacts/:contact_id', getCurrentUser, async (req, res) => {
    const { contact_id } = req.params;
    const updates = {};
    for (let key in req.body) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length > 0) {
        await db.contacts.update_one(
            { id: contact_id, workspace_id: req.user.workspace_id },
            { $set: updates }
        );
    }
    const contact = await db.contacts.findOne({ id: contact_id });
    res.json({ contact });
});

router.delete('/contacts/:contact_id', getCurrentUser, async (req, res) => {
    await db.contacts.delete_one({ id: req.params.contact_id, workspace_id: req.user.workspace_id });
    res.json({ message: "Deleted" });
});

router.post('/contacts/import', getCurrentUser, upload.single('file'), async (req, res) => {
    const user = req.user;
    if (!req.file) {
        return res.status(400).json({ detail: "No file uploaded" });
    }

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let imported = 0;
            let skipped = 0;
            for (const row of results) {
                const phone = (row.phone || "").trim();
                if (!phone) {
                    skipped++;
                    continue;
                }
                const existing = await db.contacts.findOne({ workspace_id: user.workspace_id, phone });
                if (existing) {
                    skipped++;
                    continue;
                }
                const contact = {
                    id: genId(),
                    workspace_id: user.workspace_id,
                    phone,
                    name: (row.name || "").trim(),
                    email: (row.email || "").trim(),
                    tags: (row.tags || "").split(",").map(t => t.trim()).filter(t => t),
                    source: "csv_import",
                    custom_fields: {},
                    last_seen: nowIso(),
                    created_at: nowIso()
                };
                await db.contacts.insert_one(contact);
                imported++;
            }
            fs.unlinkSync(req.file.path);
            res.json({ imported, skipped });
        });
});

// --- Conversations ---
router.get('/conversations', getCurrentUser, async (req, res) => {
    const user = req.user;
    const { status, assigned, search, skip = 0, limit = 50 } = req.query;
    const query = { workspace_id: user.workspace_id };

    if (status) query.status = status;
    if (assigned === "me") {
        query.assigned_to = user.id;
    } else if (assigned === "unassigned") {
        query.assigned_to = null;
    }

    if (search) {
        query.$or = [
            { contact_name: { $regex: search } },
            { contact_phone: { $regex: search } }
        ];
    }

    const conversations = await db.conversations.find(query).sort("last_message_at", -1).skip(parseInt(skip)).limit(parseInt(limit)).to_list(parseInt(limit));
    const total = await db.conversations.count_documents(query);
    res.json({ conversations, total });
});

router.get('/conversations/:conv_id', getCurrentUser, async (req, res) => {
    const conv = await db.conversations.findOne({ id: req.params.conv_id, workspace_id: req.user.workspace_id });
    if (!conv) {
        return res.status(404).json({ detail: "Conversation not found" });
    }
    const contact = await db.contacts.findOne({ id: conv.contact_id });
    res.json({ conversation: conv, contact });
});

router.get('/conversations/:conv_id/messages', getCurrentUser, async (req, res) => {
    const { skip = 0, limit = 100 } = req.query;
    const messages = await db.messages.find({
        conversation_id: req.params.conv_id,
        workspace_id: req.user.workspace_id
    }).sort("created_at", 1).skip(parseInt(skip)).limit(parseInt(limit)).to_list(parseInt(limit));
    res.json({ messages });
});

router.post('/conversations/:conv_id/messages', getCurrentUser, async (req, res) => {
    const user = req.user;
    const { conv_id } = req.params;
    const { body, type = "text", media_url, template_id } = req.body;

    const conv = await db.conversations.findOne({ id: conv_id, workspace_id: user.workspace_id });
    if (!conv) {
        return res.status(404).json({ detail: "Conversation not found" });
    }

    try {
        await checkTrial(user.workspace_id);
    } catch (err) {
        return res.status(400).json({ detail: err.message });
    }

    const msg = {
        id: genId(),
        conversation_id: conv_id,
        workspace_id: user.workspace_id,
        direction: "out",
        type,
        body,
        media_url,
        template_id,
        status: "sent",
        sender_id: user.id,
        created_at: nowIso()
    };
    await db.messages.insert_one(msg);
    await db.conversations.update_one(
        { id: conv_id },
        {
            $set: {
                last_message: body ? body.substring(0, 50) : `[${type}]`,
                last_message_at: nowIso(),
                status: "open"
            }
        }
    );
    res.json({ message: msg });
});

router.post('/conversations/:conv_id/media', getCurrentUser, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ detail: "No file uploaded" });
    }
    const filename = `${genId()}_${req.file.originalname}`;
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const finalPath = path.join(uploadDir, filename);
    fs.renameSync(req.file.path, finalPath);

    const media_url = `/uploads/${filename}`;
    res.json({ url: media_url, type: req.file.mimetype.split("/")[0] });
});

router.get('/conversations/:conv_id/notes', getCurrentUser, async (req, res) => {
    const notes = await db.conversation_notes.find({
        conversation_id: req.params.conv_id,
        workspace_id: req.user.workspace_id
    }).sort("created_at", -1).to_list(50);
    res.json({ notes });
});

router.post('/conversations/:conv_id/notes', getCurrentUser, async (req, res) => {
    const note = {
        id: genId(),
        conversation_id: req.params.conv_id,
        workspace_id: req.user.workspace_id,
        text: req.body.text,
        user_id: req.user.id,
        user_name: req.user.name || "User",
        created_at: nowIso()
    };
    await db.conversation_notes.insert_one(note);
    res.json({ note });
});

router.post('/conversations/:conv_id/assign', getCurrentUser, async (req, res) => {
    await db.conversations.update_one(
        { id: req.params.conv_id, workspace_id: req.user.workspace_id },
        { $set: { assigned_to: req.body.agent_id } }
    );
    res.json({ message: "Assigned" });
});

router.post('/conversations/:conv_id/close', getCurrentUser, async (req, res) => {
    await db.conversations.update_one(
        { id: req.params.conv_id, workspace_id: req.user.workspace_id },
        { $set: { status: "closed" } }
    );
    res.json({ message: "Closed" });
});

router.post('/conversations/:conv_id/open', getCurrentUser, async (req, res) => {
    await db.conversations.update_one(
        { id: req.params.conv_id, workspace_id: req.user.workspace_id },
        { $set: { status: "open" } }
    );
    res.json({ message: "Opened" });
});

module.exports = router;
