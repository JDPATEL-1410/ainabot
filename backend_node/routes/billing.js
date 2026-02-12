const express = require('express');
const router = express.Router();
const stripe_lib = require('stripe');
const { db, getCurrentUser, genId, nowIso } = require('../helpers');

const stripe = process.env.STRIPE_SECRET_KEY ? stripe_lib(process.env.STRIPE_SECRET_KEY) : null;

const DEFAULT_PLANS = {
    "starter": { "name": "Starter", "price": 2499.00, "agents": 3, "numbers": 1, "messages": 5000 },
    "pro": { "name": "Pro", "price": 5999.00, "agents": 10, "numbers": 3, "messages": 50000 },
    "enterprise": { "name": "Enterprise", "price": 14999.00, "agents": -1, "numbers": -1, "messages": -1 },
};

async function getDbPlans() {
    const config = await db.settings.findOne({ id: "plan_config" });
    if (config && config.plans) return config.plans;
    return DEFAULT_PLANS;
}

router.get('/billing/plans', async (req, res) => {
    const plans = await getDbPlans();
    res.json({ plans });
});

router.post('/billing/checkout', getCurrentUser, async (req, res) => {
    const { plan_id, origin_url } = req.body;
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });

    const plans = await getDbPlans();
    if (!plans[plan_id]) return res.status(400).json({ detail: "Invalid plan" });

    if (!stripe) return res.status(500).json({ detail: "Stripe not configured" });

    const plan = plans[plan_id];
    try {
        const successUrl = `${origin_url}/billing?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin_url}/billing`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: { name: plan.name },
                    unit_amount: Math.round(plan.price * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                workspace_id: user.workspace_id,
                plan_id: plan_id,
                user_id: user.id
            }
        });

        const transaction = {
            id: genId(),
            workspace_id: user.workspace_id,
            session_id: session.id,
            amount: plan.price,
            currency: "inr",
            plan_id: plan_id,
            user_id: user.id,
            status: "initiated",
            payment_status: "pending",
            created_at: nowIso()
        };
        await db.payment_transactions.insert_one(transaction);
        res.json({ url: session.url, session_id: session.id });
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

router.get('/billing/status/:session_id', getCurrentUser, async (req, res) => {
    if (!stripe) return res.status(500).json({ detail: "Stripe not configured" });
    const { session_id } = req.params;

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        const tx = await db.payment_transactions.findOne({ session_id });

        if (tx && tx.payment_status !== "paid") {
            const newPaymentStatus = session.payment_status === "paid" ? "paid" : session.payment_status;
            const newStatus = session.payment_status === "paid" ? "completed" : session.status;

            await db.payment_transactions.update_one(
                { session_id },
                { $set: { status: newStatus, payment_status: newPaymentStatus } }
            );

            if (newPaymentStatus === "paid") {
                const plan_id = tx.plan_id || "starter";
                await db.workspaces.update_one(
                    { id: tx.workspace_id },
                    { $set: { plan: plan_id, status: "active" } }
                );
                await db.subscriptions.update_one(
                    { workspace_id: tx.workspace_id },
                    {
                        $set: {
                            plan: plan_id,
                            status: "active",
                            started_at: nowIso(),
                            stripe_session_id: session_id
                        }
                    },
                    { upsert: true }
                );
            }
        }

        res.json({
            status: session.status,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
            currency: session.currency
        });
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

router.get('/billing/subscription', getCurrentUser, async (req, res) => {
    const user = req.user;
    if (!user.workspace_id) return res.status(400).json({ detail: "No workspace" });

    const ws = await db.workspaces.findOne({ id: user.workspace_id });
    const sub = await db.subscriptions.findOne({ workspace_id: user.workspace_id });
    const transactions = await db.payment_transactions.find({
        workspace_id: user.workspace_id
    }).sort("created_at", -1).limit(10).to_list(10);

    const plans = await getDbPlans();
    const plan_info = plans[ws.plan || "trial"] || {};

    res.json({
        plan: ws.plan || "trial",
        plan_info,
        trial_end: ws.trial_end,
        status: ws.status,
        subscription: sub,
        transactions
    });
});

router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        if (endpointSecret && sig) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            event = req.body; // Falback if no secret
        }
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.payment_status === "paid") {
            const tx = await db.payment_transactions.findOne({ session_id: session.id });
            if (tx && tx.payment_status !== "paid") {
                await db.payment_transactions.update_one(
                    { session_id: session.id },
                    { $set: { status: "completed", payment_status: "paid" } }
                );
                const plan_id = session.metadata?.plan_id || "starter";
                const workspace_id = session.metadata?.workspace_id;
                if (workspace_id) {
                    await db.workspaces.update_one(
                        { id: workspace_id },
                        { $set: { plan: plan_id, status: "active" } }
                    );
                }
            }
        }
    }

    res.json({ status: "ok" });
});

module.exports = router;
