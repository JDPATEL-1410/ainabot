const axios = require('axios');
const { db, genId, nowIso } = require('../helpers');

async function processAutomations(workspace_id, message_data, contact_data) {
    try {
        const automations = await db.automations.find({
            workspace_id: workspace_id,
            status: "active"
        }).to_list(100);

        for (const auto of automations) {
            if (auto.trigger === "keyword_match") {
                const keyword = (auto.conditions?.keyword || "").toLowerCase();
                const body = (message_data.body || "").toLowerCase();
                if (keyword && body.includes(keyword)) {
                    await executeAutomation(auto, workspace_id, message_data, contact_data);
                }
            } else if (auto.trigger === "new_contact") {
                if (message_data.is_first_message) {
                    await executeAutomation(auto, workspace_id, message_data, contact_data);
                }
            }
        }
    } catch (err) {
        console.error("Error processing automations:", err);
    }
}

async function executeAutomation(automation, workspace_id, trigger_msg, contact) {
    console.log(`Executing automation: ${automation.name} (${automation.id})`);

    for (const action of automation.actions || []) {
        const action_type = action.type;
        const action_value = action.value || action.message;

        if (action_type === "send_template" || action_type === "send_message") {
            await sendAutoReply(workspace_id, contact, action_value, action.template_id);
        } else if (action_type === "add_tag") {
            await db.contacts.update_one(
                { id: contact.id },
                { $addToSet: { tags: action_value } }
            );
        } else if (action_type === "assign_agent") {
            await db.conversations.update_one(
                { id: trigger_msg.conversation_id },
                { $set: { assigned_to: action_value } }
            );
        } else if (action_type === "webhook") {
            await callExternalWebhook(action_value, {
                workspace_id,
                automation_name: automation.name,
                message: trigger_msg,
                contact: contact
            });
        }
    }

    await db.automations.update_one(
        { id: automation.id },
        { $inc: { executions: 1 } }
    );
}

async function sendAutoReply(workspace_id, contact, body, template_id = null) {
    const conv = await db.conversations.findOne({
        workspace_id,
        contact_id: contact.id
    });

    if (!conv) return;

    const msg = {
        id: genId(),
        conversation_id: conv.id,
        workspace_id: workspace_id,
        direction: "out",
        type: template_id ? "template" : "text",
        body: body,
        template_id: template_id,
        status: "sent",
        sender_id: "system_automation",
        created_at: nowIso()
    };
    await db.messages.insert_one(msg);
    await db.conversations.update_one(
        { id: conv.id },
        { $set: { last_message: body.substring(0, 50), last_message_at: nowIso() } }
    );
}

async function callExternalWebhook(url, payload) {
    try {
        await axios.post(url, payload, { timeout: 5000 });
    } catch (err) {
        console.error("Error calling external automation webhook:", err.message);
    }
}

module.exports = {
    processAutomations
};
