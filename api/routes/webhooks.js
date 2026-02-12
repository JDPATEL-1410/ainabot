const express = require('express');
const router = express.Router();
const { db, genId, nowIso } = require('../helpers');

// Verify token for Meta webhook setup
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "your_token_here";

router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        console.log("WhatsApp webhook verified");
        return res.send(challenge);
    }

    res.status(403).send("Verification failed");
});

router.post('/whatsapp', async (req, res) => {
    const body = req.body;

    try {
        const entries = body.entry || [];
        for (const entry of entries) {
            for (const change of entry.changes || []) {
                const value = change.value || {};

                // Handle Status Updates
                if (value.statuses) {
                    for (const status of value.statuses) {
                        await db.messages.update_one(
                            { external_id: status.id },
                            { $set: { status: status.status } }
                        );
                    }
                }

                // Handle Incoming Messages
                if (value.messages) {
                    const metadata = value.metadata || {};

                    for (const msg of value.messages) {
                        const from_phone = msg.from;
                        const msg_id = msg.id;
                        const msg_type = msg.type;

                        // Find or create contact
                        let contact = await db.contacts.findOne({ phone: from_phone });
                        let workspace_id;

                        if (!contact) {
                            const display_phone = metadata.display_phone_number || "";
                            const conn = await db.waba_connections.findOne({
                                display_phone: { $regex: `.*${display_phone}` }
                            });

                            if (conn) {
                                workspace_id = conn.workspace_id;
                            } else {
                                const ws = await db.workspaces.find({}).to_list(1);
                                workspace_id = ws.length > 0 ? ws[0].id : "default";
                            }

                            contact = {
                                id: genId(),
                                workspace_id,
                                phone: from_phone,
                                name: (value.contacts && value.contacts[0]?.profile?.name) || from_phone,
                                source: "whatsapp",
                                created_at: nowIso()
                            };
                            await db.contacts.insert_one(contact);
                        } else {
                            workspace_id = contact.workspace_id;
                        }

                        // Find or create conversation
                        let conv = await db.conversations.findOne({
                            workspace_id,
                            contact_id: contact.id
                        });

                        let is_first_message = false;
                        if (!conv) {
                            is_first_message = true;
                            conv = {
                                id: genId(),
                                workspace_id,
                                contact_id: contact.id,
                                contact_name: contact.name,
                                contact_phone: contact.phone,
                                status: "open",
                                last_message_at: nowIso(),
                                created_at: nowIso(),
                                unread_count: 0
                            };
                            await db.conversations.insert_one(conv);
                        }

                        let body_text = "";
                        if (msg_type === "text") {
                            body_text = msg.text?.body || "";
                        } else if (msg_type === "button") {
                            body_text = msg.button?.text || "";
                        } else if (msg_type === "interactive") {
                            // handle list_reply or button_reply
                            if (msg.interactive?.type === "button_reply") {
                                body_text = msg.interactive.button_reply?.title || "";
                            } else if (msg.interactive?.type === "list_reply") {
                                body_text = msg.interactive.list_reply?.title || "";
                            }
                        }

                        const new_message = {
                            id: genId(),
                            external_id: msg_id,
                            conversation_id: conv.id,
                            workspace_id,
                            direction: "in",
                            type: msg_type,
                            body: body_text,
                            created_at: nowIso()
                        };
                        await db.messages.insert_one(new_message);

                        await db.conversations.update_one(
                            { id: conv.id },
                            {
                                $set: {
                                    last_message: body_text.substring(0, 50),
                                    last_message_at: nowIso(),
                                    status: "open"
                                },
                                $inc: { unread_count: 1 }
                            }
                        );

                        // TRIGGER AUTOMATIONS
                        try {
                            const { processAutomations } = require('../services/automation_service');
                            if (processAutomations) {
                                await processAutomations(workspace_id, {
                                    body: body_text,
                                    conversation_id: conv.id,
                                    is_first_message
                                }, contact);
                            }
                        } catch (err) {
                            console.error("Automation error:", err);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error processing WhatsApp webhook:", err);
    }

    res.json({ status: "success" });
});

module.exports = router;
