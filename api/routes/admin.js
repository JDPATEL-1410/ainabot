const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, getCurrentUser, genId, nowIso, hashPassword } = require('../helpers');

// --- Automations ---
router.get('/automations', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const automations = await db.automations.find({ workspace_id: req.user.workspace_id }).sort("created_at", -1).to_list(100);
    res.json({ automations });
});

router.post('/automations', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const { name, trigger, conditions = {}, actions = [], flow_data = null } = req.body;
    const automation = {
        id: genId(),
        workspace_id: req.user.workspace_id,
        name,
        trigger,
        conditions,
        actions,
        flow_data,
        status: "active",
        executions: 0,
        created_at: nowIso()
    };
    await db.automations.insert_one(automation);
    res.json({ automation });
});

router.put('/automations/:automation_id', getCurrentUser, async (req, res) => {
    const { automation_id } = req.params;
    const updates = {};
    for (let key in req.body) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length > 0) {
        await db.automations.update_one(
            { id: automation_id, workspace_id: req.user.workspace_id },
            { $set: updates }
        );
    }
    const auto = await db.automations.findOne({ id: automation_id });
    res.json({ automation: auto });
});

router.patch('/automations/:automation_id/toggle', getCurrentUser, async (req, res) => {
    const { automation_id } = req.params;
    const auto = await db.automations.findOne({ id: automation_id, workspace_id: req.user.workspace_id });
    if (!auto) return res.status(404).json({ detail: "Automation not found" });
    const new_status = auto.status === "active" ? "inactive" : "active";
    await db.automations.update_one({ id: automation_id }, { $set: { status: new_status } });
    res.json({ status: new_status });
});

// --- Settings ---
router.get('/settings', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const ws = await db.workspaces.findOne({ id: req.user.workspace_id });
    const webhook_configs = await db.webhook_configs.find({ workspace_id: req.user.workspace_id }).to_list(10);
    res.json({ workspace: ws, webhook_configs });
});

router.put('/settings', getCurrentUser, async (req, res) => {
    if (!["owner", "admin"].includes(req.user.role)) return res.status(403).json({ detail: "Insufficient permissions" });
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.timezone) updates.timezone = req.body.timezone;
    if (Object.keys(updates).length > 0) {
        await db.workspaces.update_one({ id: req.user.workspace_id }, { $set: updates });
    }
    res.json({ message: "Updated" });
});

router.get('/settings/api-keys', getCurrentUser, async (req, res) => {
    if (!["owner", "admin"].includes(req.user.role)) return res.status(403).json({ detail: "Insufficient permissions" });
    const keys = await db.api_keys.find({ workspace_id: req.user.workspace_id }).to_list(20);
    res.json({ api_keys: keys });
});

router.post('/settings/api-keys', getCurrentUser, async (req, res) => {
    if (!["owner", "admin"].includes(req.user.role)) return res.status(403).json({ detail: "Insufficient permissions" });
    const keyStr = `ya_${crypto.randomBytes(24).toString('hex')}`;
    const key = {
        id: genId(),
        workspace_id: req.user.workspace_id,
        name: req.body.name,
        key: keyStr,
        created_at: nowIso(),
        last_used: null
    };
    await db.api_keys.insert_one(key);
    res.json({ api_key: key });
});

router.delete('/settings/api-keys/:key_id', getCurrentUser, async (req, res) => {
    if (!["owner", "admin"].includes(req.user.role)) return res.status(403).json({ detail: "Insufficient permissions" });
    await db.api_keys.delete_one({ id: req.params.key_id, workspace_id: req.user.workspace_id });
    res.json({ message: "Deleted" });
});

router.post('/settings/webhooks', getCurrentUser, async (req, res) => {
    const { url, events = ["message.received", "message.status"] } = req.body;
    const webhook = {
        id: genId(),
        workspace_id: req.user.workspace_id,
        url,
        events,
        status: "active",
        created_at: nowIso()
    };
    await db.webhook_configs.insert_one(webhook);
    res.json({ webhook });
});

router.delete('/settings/webhooks/:webhook_id', getCurrentUser, async (req, res) => {
    await db.webhook_configs.delete_one({ id: req.params.webhook_id, workspace_id: req.user.workspace_id });
    res.json({ message: "Deleted" });
});

// --- Dashboard ---
router.get('/dashboard', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const wid = req.user.workspace_id;

    const total_contacts = await db.contacts.count_documents({ workspace_id: wid });
    const total_conversations = await db.conversations.count_documents({ workspace_id: wid });
    const open_conversations = await db.conversations.count_documents({ workspace_id: wid, status: "open" });
    const total_messages = await db.messages.count_documents({ workspace_id: wid });
    const outbound_messages = await db.messages.count_documents({ workspace_id: wid, direction: "out" });
    const inbound_messages = await db.messages.count_documents({ workspace_id: wid, direction: "in" });

    const total_campaigns = await db.campaigns.count_documents({ workspace_id: wid });
    const total_templates = await db.templates.count_documents({ workspace_id: wid });
    const approved_templates = await db.templates.count_documents({ workspace_id: wid, status: "approved" });
    const active_automations = await db.automations.count_documents({ workspace_id: wid, status: "active" });

    const recent_conversations = await db.conversations.find({ workspace_id: wid }).sort("last_message_at", -1).limit(5).to_list(5);

    res.json({
        stats: {
            total_contacts,
            total_conversations,
            open_conversations,
            total_messages,
            outbound_messages,
            inbound_messages,
            total_campaigns,
            total_templates,
            approved_templates,
            active_automations,
            delivery_rate: 0,
            currency: "INR"
        },
        recent_conversations
    });
});

// --- Super Admin ---
router.get('/admin/tenants', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    const workspaces = await db.workspaces.find({}).to_list(100);
    for (const ws of workspaces) {
        ws.member_count = await db.workspace_members.count_documents({ workspace_id: ws.id });
        ws.contact_count = await db.contacts.count_documents({ workspace_id: ws.id });
        ws.message_count = await db.messages.count_documents({ workspace_id: ws.id });
    }
    res.json({ tenants: workspaces });
});

router.patch('/admin/tenants/:tenant_id', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    await db.workspaces.update_one({ id: req.params.tenant_id }, { $set: req.body });
    res.json({ message: "Tenant updated" });
});

router.get('/admin/users', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    const users = await db.users.find({}).sort("created_at", -1).to_list(200);
    res.json({ users });
});

router.post('/admin/users', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    const { name, email, password, is_super_admin = false, workspace_id = null } = req.body;

    const existing = await db.users.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ detail: "Email already registered" });

    const user_id = genId();
    const new_user = {
        id: user_id,
        name,
        email: email.toLowerCase(),
        password_hash: hashPassword(password),
        is_super_admin,
        workspace_id,
        created_at: nowIso()
    };
    await db.users.insert_one(new_user);
    res.json({ message: "User created", user: { id: user_id, name, email } });
});

router.patch('/admin/users/:user_id', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    const safe_updates = {};
    for (let key in req.body) {
        if (!["password_hash", "id"].includes(key)) safe_updates[key] = req.body[key];
    }
    await db.users.update_one({ id: req.params.user_id }, { $set: safe_updates });
    res.json({ message: "User updated" });
});

router.get('/admin/billing', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });
    const transactions = await db.payment_transactions.find({}).sort("created_at", -1).to_list(100);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlyPaid = await db.payment_transactions.find({
        payment_status: "paid",
        created_at: { $gte: monthStart }
    }).to_list(1000);

    const mrr = monthlyPaid.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const total_revenue = transactions.filter(tx => tx.payment_status === "paid").reduce((sum, tx) => sum + (tx.amount || 0), 0);

    res.json({ transactions, mrr, total_revenue });
});

router.get('/admin/stats', getCurrentUser, async (req, res) => {
    if (!req.user.is_super_admin) return res.status(403).json({ detail: "Super admin only" });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlyPaid = await db.payment_transactions.find({
        payment_status: "paid",
        created_at: { $gte: monthStart }
    }).to_list(1000);
    const mrr = monthlyPaid.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    res.json({
        total_users: await db.users.count_documents({}),
        total_workspaces: await db.workspaces.count_documents({}),
        total_messages: await db.messages.count_documents({}),
        total_contacts: await db.contacts.count_documents({}),
        mrr
    });
});

module.exports = router;
