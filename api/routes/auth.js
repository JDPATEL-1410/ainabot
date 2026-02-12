const express = require('express');
const router = express.Router();
const { db, hashPassword, verifyPassword, createToken, getCurrentUser, genId, nowIso } = require('../helpers');

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

router.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await db.users.findOne({ email: email.toLowerCase() });
    if (existing) {
        return res.status(400).json({ detail: "Email already registered" });
    }
    const userId = genId();
    const user = {
        id: userId,
        name: name,
        email: email.toLowerCase(),
        password_hash: hashPassword(password),
        status: "active",
        is_super_admin: false,
        created_at: nowIso()
    };
    await db.users.insert_one(user);
    const token = createToken(userId, email.toLowerCase());
    res.json({ token: token, user: { id: userId, name: name, email: email.toLowerCase() } });
});

router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.users.findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ detail: "Invalid credentials" });
    }

    // Find workspace membership
    const members = await db.workspace_members.find({
        user_id: user.id,
        status: "active"
    }).to_list(1);

    const membership = members.length > 0 ? members[0] : null;
    const workspaceId = membership ? membership.workspace_id : null;
    const role = membership ? membership.role : null;

    const token = createToken(user.id, user.email, workspaceId, role);
    res.json({
        token: token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            is_super_admin: user.is_super_admin || false
        },
        workspace_id: workspaceId
    });
});

router.get('/auth/me', getCurrentUser, async (req, res) => {
    const user = req.user;
    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        workspace_id: user.workspace_id,
        role: user.role,
        is_super_admin: user.is_super_admin || false
    });
});

router.post('/workspace/create', getCurrentUser, async (req, res) => {
    const { name, timezone = "UTC" } = req.body;
    const user = req.user;
    const wsId = genId();

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const workspace = {
        id: wsId,
        name: name,
        timezone: timezone,
        plan: "trial",
        trial_end: trialEnd.toISOString(),
        status: "active",
        whatsapp_connected: false,
        created_at: nowIso()
    };
    await db.workspaces.insert_one(workspace);

    const member = {
        id: genId(),
        workspace_id: wsId,
        user_id: user.id,
        role: "owner",
        status: "active",
        joined_at: nowIso()
    };
    await db.workspace_members.insert_one(member);

    // Seed demo data
    await seedDemoData(wsId, user.id);
    await audit(wsId, user.id, "workspace_created", { name: name });

    const token = createToken(user.id, user.email, wsId, "owner");
    res.json({ token: token, workspace: { id: wsId, name: name, plan: "trial" } });
});

router.get('/workspace/current', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) {
        return res.json({ workspace: null });
    }
    const ws = await db.workspaces.findOne({ id: user.workspace_id });
    if (!ws) {
        return res.json({ workspace: null });
    }
    const memberCount = await db.workspace_members.count_documents({ workspace_id: ws.id, status: "active" });
    ws.member_count = memberCount;
    res.json({ workspace: ws });
});

router.get('/workspace/members', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) {
        return res.status(400).json({ detail: "No workspace selected" });
    }
    const members = await db.workspace_members.find({
        workspace_id: user.workspace_id
    }).to_list(100);

    for (const m of members) {
        const u = await db.users.findOne({ id: m.user_id });
        if (u) {
            m.user_name = u.name || "";
            m.user_email = u.email || "";
        }
    }
    res.json({ members: members });
});

router.post('/workspace/invite', getCurrentUser, async (req, res) => {
    const { email, role = "agent" } = req.body;
    const user = req.user;
    if (!user.workspace_id) {
        return res.status(400).json({ detail: "No workspace" });
    }
    if (!["owner", "admin"].includes(user.role)) {
        return res.status(403).json({ detail: "Insufficient permissions" });
    }

    // Plan enforcement
    try {
        const { checkPlanLimits } = require('./extras');
        if (checkPlanLimits) {
            await checkPlanLimits(user.workspace_id, "add_agent");
        }
    } catch (err) {
        return res.status(400).json({ detail: err.message });
    }

    const existingUser = await db.users.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        // Check if already a member
        const members = await db.workspace_members.find({
            workspace_id: user.workspace_id,
            user_id: existingUser.id
        }).to_list(1);

        if (members.length > 0) {
            return res.status(400).json({ detail: "Already a member" });
        }

        const member = {
            id: genId(),
            workspace_id: user.workspace_id,
            user_id: existingUser.id,
            role: role,
            status: "active",
            joined_at: nowIso()
        };
        await db.workspace_members.insert_one(member);
        return res.json({ message: "Member added", member_id: member.id });
    }

    // Create invite for non-existing user
    const invite = {
        id: genId(),
        workspace_id: user.workspace_id,
        email: email.toLowerCase(),
        role: role,
        status: "pending",
        invited_by: user.id,
        created_at: nowIso(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };
    await db.invites.insert_one(invite);
    res.json({ message: "Invite sent", invite_id: invite.id });
});

router.patch('/workspace/members/:member_id', getCurrentUser, async (req, res) => {
    const { role, status } = req.body;
    const { member_id } = req.params;
    const user = req.user;

    if (!["owner", "admin"].includes(user.role)) {
        return res.status(403).json({ detail: "Insufficient permissions" });
    }

    const updates = {};
    if (role) updates.role = role;
    if (status) updates.status = status;

    if (Object.keys(updates).length > 0) {
        await db.workspace_members.update_one(
            { id: member_id, workspace_id: user.workspace_id },
            { $set: updates }
        );
    }
    res.json({ message: "Updated" });
});

async function seedDemoData(workspaceId, userId) {
    // Replicating Python _seed_demo_data
    const demoContacts = [
        { name: "Alex Johnson", phone: "+1234567890", email: "alex@demo.com", tags: ["lead", "vip"] },
        { name: "Maria Garcia", phone: "+1987654321", email: "maria@demo.com", tags: ["customer"] },
        { name: "James Wilson", phone: "+1567890123", email: "james@demo.com", tags: ["support"] },
        { name: "Sarah Chen", phone: "+1345678901", email: "sarah@demo.com", tags: ["lead"] },
        { name: "David Brown", phone: "+1678901234", email: "david@demo.com", tags: ["customer", "vip"] },
    ];

    const demoMessagesSets = [
        [
            { direction: "in", body: "Hi! I saw your product on Instagram. Can you tell me more about pricing?", type: "text" },
            { direction: "out", body: "Hello Alex! Thanks for reaching out. Our starter plan begins at $29/month with 5,000 messages included.", type: "text" },
            { direction: "in", body: "That sounds great! Do you offer a free trial?", type: "text" },
        ],
        [
            { direction: "in", body: "I placed an order yesterday but haven't received a confirmation.", type: "text" },
            { direction: "out", body: "Hi Maria! Let me check that for you. Can you share your order number?", type: "text" },
            { direction: "in", body: "Order #WA-2024-1234", type: "text" },
            { direction: "out", body: "Found it! Your order is confirmed and will ship tomorrow. You'll get a tracking link via WhatsApp.", type: "text" },
        ],
        [
            { direction: "in", body: "My account is locked. Can you help?", type: "text" },
            { direction: "out", body: "Hi James, I can help with that. Let me reset your account access now.", type: "text" },
        ],
        [
            { direction: "in", body: "Do you have any enterprise plans for larger teams?", type: "text" },
        ],
        [
            { direction: "in", body: "Thanks for the quick delivery! Really impressed with the service.", type: "text" },
            { direction: "out", body: "Thank you David! We're glad you're happy. Would you like to leave a review?", type: "text" },
            { direction: "in", body: "Sure, send me the link!", type: "text" },
        ],
    ];

    const statuses = ["open", "open", "open", "open", "closed"];

    for (let i = 0; i < demoContacts.length; i++) {
        const c = demoContacts[i];
        const contactId = genId();
        const contact = {
            id: contactId,
            workspace_id: workspaceId,
            phone: c.phone,
            name: c.name,
            email: c.email || "",
            tags: c.tags || [],
            source: "demo",
            custom_fields: {},
            last_seen: nowIso(),
            created_at: nowIso()
        };
        await db.contacts.insert_one(contact);

        const convId = genId();
        const msgs = demoMessagesSets[i];
        const lastMsg = msgs[msgs.length - 1].body.substring(0, 50);

        const conversation = {
            id: convId,
            workspace_id: workspaceId,
            contact_id: contactId,
            contact_name: c.name,
            contact_phone: c.phone,
            assigned_to: i < 3 ? userId : null,
            status: statuses[i],
            last_message: lastMsg,
            last_message_at: nowIso(),
            unread_count: msgs[msgs.length - 1].direction === "in" ? 1 : 0,
            tags: [],
            created_at: nowIso()
        };
        await db.conversations.insert_one(conversation);

        for (const msg of msgs) {
            const message = {
                id: genId(),
                conversation_id: convId,
                workspace_id: workspaceId,
                direction: msg.direction,
                type: msg.type || "text",
                body: msg.body,
                media_url: null,
                template_id: null,
                status: msg.direction === "out" ? "read" : "delivered",
                created_at: nowIso()
            };
            await db.messages.insert_one(message);
        }
    }

    // Seed templates
    const demoTemplates = [
        {
            id: genId(), workspace_id: workspaceId, name: "welcome_message",
            language: "en", category: "MARKETING",
            components: {
                header: { type: "text", text: "Welcome!" },
                body: { text: "Hi {{1}}, welcome to our service! We're excited to have you on board." },
                footer: { text: "Reply STOP to unsubscribe" },
                buttons: [{ type: "QUICK_REPLY", text: "Get Started" }]
            },
            status: "approved", created_at: nowIso()
        },
        {
            id: genId(), workspace_id: workspaceId, name: "order_update",
            language: "en", category: "UTILITY",
            components: {
                body: { text: "Your order {{1}} has been {{2}}. Track it here: {{3}}" },
                buttons: [{ type: "URL", text: "Track Order", url: "https://example.com/track/{{1}}" }]
            },
            status: "approved", created_at: nowIso()
        },
        {
            id: genId(), workspace_id: workspaceId, name: "promotional_offer",
            language: "en", category: "MARKETING",
            components: {
                header: { type: "text", text: "Special Offer!" },
                body: { text: "Hey {{1}}, we have an exclusive {{2}}% discount for you! Use code: {{3}}" },
                footer: { text: "Valid until {{4}}" },
                buttons: [{ type: "URL", text: "Shop Now", url: "https://example.com/shop" }]
            },
            status: "pending", created_at: nowIso()
        },
    ];

    for (const t of demoTemplates) {
        await db.templates.insert_one(t);
    }
}

module.exports = router;
