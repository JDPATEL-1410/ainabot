const express = require('express');
const router = express.Router();
const { db, getCurrentUser, genId, nowIso, hashPassword, verifyPassword } = require('../helpers');

// --- Plan Enforcement ---
const getPlanLimits = async (planName) => {
    const config = await db.settings.findOne({ id: "plan_config" });
    const plans = config ? config.plans || {} : {};

    // Defaults
    const defaults = {
        trial: { agents: 3, numbers: 1, messages: 5000 },
        starter: { agents: 3, numbers: 1, messages: 5000 },
        pro: { agents: 10, numbers: 3, messages: 50000 },
        enterprise: { agents: -1, numbers: -1, messages: -1 },
    };

    const limits = plans[planName] || defaults[planName] || defaults.trial;
    return {
        agents: limits.agents || 3,
        numbers: limits.numbers || 1,
        messages_per_month: limits.messages || limits.messages_per_month || 5000
    };
};

const checkPlanLimits = async (workspaceId, action = "send") => {
    const ws = await db.workspaces.findOne({ id: workspaceId });
    if (!ws) {
        const err = new Error("Workspace not found");
        err.status = 404;
        throw err;
    }

    const plan = ws.plan || "trial";

    // Check trial expiry
    if (plan === "trial" && ws.trial_end) {
        const trialEnd = new Date(ws.trial_end);
        if (new Date() > trialEnd) {
            const err = new Error("Trial expired. Please upgrade your plan to continue.");
            err.status = 403;
            throw err;
        }
    }

    const limits = await getPlanLimits(plan);

    if (action === "send") {
        if (limits.messages_per_month !== -1) {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const msgCount = await db.messages.count_documents({
                workspace_id: workspaceId,
                direction: "out",
                created_at: { $gte: monthStart.toISOString() }
            });
            if (msgCount >= limits.messages_per_month) {
                const err = new Error(`Monthly message limit (${limits.messages_per_month}) reached. Upgrade to send more.`);
                err.status = 403;
                throw err;
            }
        }
    } else if (action === "add_agent") {
        if (limits.agents !== -1) {
            const agentCount = await db.workspace_members.count_documents({
                workspace_id: workspaceId, status: "active"
            });
            if (agentCount >= limits.agents) {
                const err = new Error(`Agent limit (${limits.agents}) reached. Upgrade your plan.`);
                err.status = 403;
                throw err;
            }
        }
    }
    return true;
};

// --- Audit Logging ---
const logAudit = async (workspaceId, userId, action, details = null) => {
    const audit = {
        id: genId(),
        workspace_id: workspaceId,
        user_id: userId,
        action: action,
        details: details || {},
        created_at: nowIso()
    };
    await db.audit_logs.insert_one(audit);
};

router.get('/audit-logs', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    if (!["owner", "admin"].includes(user.role)) return res.status(403).json({ detail: "Insufficient permissions" });

    const { skip = 0, limit = 50 } = req.query;
    const query = { workspace_id: user.workspace_id };

    const logs = await db.audit_logs.find(query).sort("created_at", -1).skip(parseInt(skip)).limit(parseInt(limit)).to_list(parseInt(limit));
    const total = await db.audit_logs.count_documents(query);
    res.json({ logs, total });
});

router.post('/auth/change-password', getCurrentUser, async (req, res) => {
    const { current_password, new_password } = req.body;
    const user = req.user;

    const fullUser = await db.users.findOne({ id: user.id });
    if (!fullUser) return res.status(404).json({ detail: "User not found" });

    if (!verifyPassword(current_password, fullUser.password_hash)) {
        return res.status(400).json({ detail: "Current password is incorrect" });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ detail: "Password must be at least 6 characters" });
    }

    const newHash = hashPassword(new_password);
    await db.users.update_one({ id: user.id }, { $set: { password_hash: newHash } });

    if (user.workspace_id) {
        await logAudit(user.workspace_id, user.id, "password_changed");
    }
    res.json({ message: "Password changed successfully" });
});

router.get('/contacts/export', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });

    const contacts = await db.contacts.find({ workspace_id: user.workspace_id }).to_list(10000);

    let csvContent = "name,phone,email,tags,source,created_at\n";
    for (const c of contacts) {
        const tags = (c.tags || []).join(",");
        csvContent += `"${c.name || ""}","${c.phone || ""}","${c.email || ""}","${tags}","${c.source || ""}","${c.created_at || ""}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts_export.csv');
    res.send(csvContent);
});

router.get('/quick-replies', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const replies = await db.quick_replies.find({ workspace_id: req.user.workspace_id }).to_list(100);
    res.json({ quick_replies: replies });
});

router.post('/quick-replies', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const { title, message } = req.body;
    const reply = {
        id: genId(),
        workspace_id: req.user.workspace_id,
        title,
        message,
        created_at: nowIso()
    };
    await db.quick_replies.insert_one(reply);
    res.json({ quick_reply: reply });
});

router.delete('/quick-replies/:reply_id', getCurrentUser, async (req, res) => {
    await db.quick_replies.delete_one({ id: req.params.reply_id, workspace_id: req.user.workspace_id });
    res.json({ message: "Deleted" });
});

router.get('/dashboard/analytics', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });
    const wid = user.workspace_id;

    // Daily messages
    const daily_data = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const dayStart = day.toISOString();
        const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

        const sent = await db.messages.count_documents({
            workspace_id: wid, direction: "out",
            created_at: { $gte: dayStart, $lte: dayEnd }
        });
        const received = await db.messages.count_documents({
            workspace_id: wid, direction: "in",
            created_at: { $gte: dayStart, $lte: dayEnd }
        });

        daily_data.push({
            date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sent,
            received,
            total: sent + received
        });
    }

    // Campaign summary
    const campaigns = await db.campaigns.find({ workspace_id: wid, status: "completed" }).to_list(100);
    let total_sent = 0, total_delivered = 0, total_read = 0;
    campaigns.forEach(c => {
        total_sent += c.stats?.sent || 0;
        total_delivered += c.stats?.delivered || 0;
        total_read += c.stats?.read || 0;
    });

    // Plan usage
    const ws = await db.workspaces.findOne({ id: wid });
    const plan = ws.plan || "trial";
    const limits = await getPlanLimits(plan);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlySent = await db.messages.count_documents({
        workspace_id: wid, direction: "out",
        created_at: { $gte: monthStart.toISOString() }
    });
    const agentCount = await db.workspace_members.count_documents({ workspace_id: wid, status: "active" });

    res.json({
        daily_messages: daily_data,
        campaign_summary: {
            total_sent,
            total_delivered,
            total_read,
            delivery_rate: total_sent > 0 ? Math.round((total_delivered / total_sent) * 100 * 10) / 10 : 0,
            read_rate: total_delivered > 0 ? Math.round((total_read / total_delivered) * 100 * 10) / 10 : 0
        },
        usage: {
            messages_sent: monthlySent,
            message_limit: limits.messages_per_month,
            agents_used: agentCount,
            agent_limit: limits.agents,
            plan: plan
        }
    });
});

router.get('/inbox/unread-count', getCurrentUser, async (req, res) => {
    if (!req.user.workspace_id) return res.json({ count: 0 });
    const count = await db.conversations.count_documents({
        workspace_id: req.user.workspace_id,
        status: "open",
        unread_count: { $gt: 0 }
    });
    res.json({ count });
});

module.exports = {
    router,
    checkPlanLimits,
    logAudit
};
