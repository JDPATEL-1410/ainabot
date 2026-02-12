const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db, getCurrentUser, genId, nowIso } = require('../helpers');

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

// Middleware to audit actions
const audit = async (wsId, userId, action, details = null) => {
    try {
        const { logAudit } = require('./extras');
        if (logAudit) {
            await logAudit(wsId, userId, action, details);
        }
    } catch (err) {
        console.error("Audit logging failed:", err);
    }
};

router.post('/whatsapp/onboard', getCurrentUser, async (req, res) => {
    const { code } = req.body;
    const user = req.user;
    if (!user.workspace_id) {
        return res.status(400).json({ detail: "No workspace" });
    }

    try {
        // 1. Exchange code for access token
        const tokenRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
            params: {
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                code: code
            }
        });

        const access_token = tokenRes.data.access_token;

        // 2. Get WABA ID and Phone Number ID
        const accountsRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/me/accounts`, {
            params: { access_token }
        });
        const accounts_data = accountsRes.data.data;

        if (!accounts_data || accounts_data.length === 0) {
            return res.status(400).json({ detail: "No WhatsApp accounts found for this user" });
        }

        const waba_id = accounts_data[0].id;

        // 3. Fetch Phone Numbers
        const phonesRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/${waba_id}/phone_numbers`, {
            params: { access_token }
        });
        const phones_data = phonesRes.data.data;
        if (!phones_data || phones_data.length === 0) {
            return res.status(400).json({ detail: "No phone numbers found in this WABA" });
        }

        const phone = phones_data[0];

        const connection = {
            id: genId(),
            workspace_id: user.workspace_id,
            waba_id: waba_id,
            phone_number_id: phone.id,
            display_phone: phone.display_phone_number || "Unknown",
            quality_rating: phone.quality_rating || "UNKNOWN",
            access_token: access_token,
            status: "connected",
            connected_at: nowIso()
        };

        await db.waba_connections.update_one(
            { workspace_id: user.workspace_id },
            { $set: connection },
            { upsert: true }
        );

        await db.workspaces.update_one(
            { id: user.workspace_id },
            { $set: { whatsapp_connected: true } }
        );

        res.json({ status: "success", phone: connection.display_phone });
    } catch (err) {
        const msg = err.response?.data?.error?.message || err.message;
        res.status(400).json({ detail: `WhatsApp setup failed: ${msg}` });
    }
});

// --- Templates ---
router.get('/templates', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) {
        return res.status(400).json({ detail: "No workspace" });
    }
    const { status, search } = req.query;
    const query = { workspace_id: user.workspace_id };
    if (status) query.status = status;
    if (search) query.name = { $regex: search };

    const templates = await db.templates.find(query).sort("created_at", -1).to_list(100);
    res.json({ templates });
});

router.post('/templates', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    if (!["owner", "admin"].includes(user.role)) return res.status(403).json({ detail: "Insufficient permissions" });

    const { name, language = "en", category = "MARKETING", components = [] } = req.body;
    const template = {
        id: genId(),
        workspace_id: user.workspace_id,
        name,
        language,
        category,
        components,
        status: "draft",
        created_at: nowIso()
    };
    await db.templates.insert_one(template);
    await audit(user.workspace_id, user.id, "template_created", { name });
    res.json({ template });
});

router.put('/templates/:template_id', getCurrentUser, async (req, res) => {
    const { template_id } = req.params;
    const updates = {};
    for (let key in req.body) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length > 0) {
        await db.templates.update_one(
            { id: template_id, workspace_id: req.user.workspace_id },
            { $set: updates }
        );
    }
    const template = await db.templates.findOne({ id: template_id });
    res.json({ template });
});

router.post('/templates/:template_id/submit', getCurrentUser, async (req, res) => {
    const user = req.user;
    const { template_id } = req.params;

    const template = await db.templates.findOne({ id: template_id, workspace_id: user.workspace_id });
    if (!template) return res.status(404).json({ detail: "Template not found" });

    const conn = await db.waba_connections.findOne({ workspace_id: user.workspace_id });
    if (!conn || !conn.access_token || !conn.waba_id) {
        return res.status(400).json({ detail: "WhatsApp account not connected. Please connect in settings first." });
    }

    try {
        const payload = {
            name: template.name,
            category: template.category,
            language: template.language,
            components: template.components
        };

        const resMeta = await axios.post(
            `https://graph.facebook.com/${META_API_VERSION}/${conn.waba_id}/message_templates`,
            payload,
            { headers: { Authorization: `Bearer ${conn.access_token}` } }
        );

        const meta_data = resMeta.data;
        const new_status = "pending";

        await db.templates.update_one(
            { id: template_id },
            { $set: { status: new_status, meta_id: meta_data.id } }
        );

        await audit(user.workspace_id, user.id, "template_submitted", { name: template.name });
        res.json({ message: "Template submitted to Meta", status: new_status });
    } catch (err) {
        const msg = err.response?.data?.error?.message || err.message;
        res.status(400).json({ detail: `Meta Sync Failed: ${msg}` });
    }
});

router.delete('/templates/:template_id', getCurrentUser, async (req, res) => {
    await db.templates.delete_one({ id: req.params.template_id, workspace_id: req.user.workspace_id });
    res.json({ message: "Deleted" });
});

// --- Campaigns ---
router.get('/campaigns', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const campaigns = await db.campaigns.find({ workspace_id: req.user.workspace_id }).sort("created_at", -1).to_list(100);
    res.json({ campaigns });
});

router.post('/campaigns', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const { name, template_id, type = "BROADCAST", segment_tags = [], scheduled_at = null } = req.body;

    // Count target contacts
    const query = { workspace_id: user.workspace_id };
    if (segment_tags.length > 0) {
        query.tags = { $in: segment_tags };
    }
    let target_count = await db.contacts.count_documents(query);
    if (type === "CSV") target_count = 0;

    const campaign = {
        id: genId(),
        workspace_id: user.workspace_id,
        name,
        template_id,
        type,
        segment_tags,
        status: "draft",
        scheduled_at,
        stats: {
            total: target_count,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0
        },
        created_by: user.id,
        created_at: nowIso()
    };
    await db.campaigns.insert_one(campaign);
    await audit(user.workspace_id, user.id, "campaign_created", { name, target: target_count });
    res.json({ campaign });
});

router.post('/campaigns/:campaign_id/send', getCurrentUser, async (req, res) => {
    const user = req.user;
    const { campaign_id } = req.params;

    try {
        const { checkPlanLimits } = require('./extras');
        if (checkPlanLimits) await checkPlanLimits(user.workspace_id, "send");
    } catch (err) {
        return res.status(400).json({ detail: err.message });
    }

    const campaign = await db.campaigns.findOne({ id: campaign_id, workspace_id: user.workspace_id });
    if (!campaign) return res.status(404).json({ detail: "Campaign not found" });
    if (campaign.status !== "draft") return res.status(400).json({ detail: "Campaign already sent or in progress" });

    // Mock sending
    const total = campaign.stats?.total || 0;
    const stats = {
        total: total,
        sent: total,
        delivered: 0,
        read: 0,
        failed: 0
    };

    await db.campaigns.update_one(
        { id: campaign_id },
        {
            $set: {
                status: "completed",
                stats: stats,
                sent_at: nowIso()
            }
        }
    );

    await audit(user.workspace_id, user.id, "campaign_sent", { campaign: campaign.name, total: total });
    res.json({ message: "Campaign broadcast completed", stats: stats });
});

router.get('/campaigns/:campaign_id/stats', getCurrentUser, async (req, res) => {
    const campaign = await db.campaigns.findOne({ id: req.params.campaign_id, workspace_id: req.user.workspace_id });
    if (!campaign) return res.status(404).json({ detail: "Campaign not found" });
    res.json({ stats: campaign.stats || {}, status: campaign.status });
});

router.get('/whatsapp/status', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const conn = await db.waba_connections.findOne({ workspace_id: req.user.workspace_id });
    if (!conn) return res.json({ connected: false, connection: null });
    res.json({ connected: true, connection: conn });
});

module.exports = router;
