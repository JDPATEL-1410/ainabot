require('dotenv').config();
const { db, genId, nowIso } = require('./helpers');

async function seedAdminData() {
    try {
        await db.create_all();

        // 1. Ensure we have some workspaces
        const workspaces = await db.workspaces.find({}).to_list(10);
        if (workspaces.length === 0) {
            console.log("No workspaces found. Create a user and workspace first.");
            process.exit(0);
        }

        // 2. Add sample transactions
        console.log("Seeding transactions...");
        const plans = { "starter": 2499, "pro": 5999, "enterprise": 14999 };

        for (const ws of workspaces) {
            for (let i = 3; i < 8; i++) {
                const daysAgo = i * 25;
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                const date = d.toISOString();

                const plan_id = ws.plan || "pro";
                const amount = plans[plan_id] || 5999;

                const tx = {
                    id: genId(),
                    workspace_id: ws.id,
                    plan_id: plan_id,
                    amount: amount,
                    currency: "inr",
                    payment_status: "paid",
                    session_id: `sess_${genId().substring(0, 10)}`,
                    created_at: date
                };
                await db.payment_transactions.update_one({ session_id: tx.session_id }, { $set: tx }, { upsert: true });
            }
        }

        console.log(`Added transactions for ${workspaces.length} workspaces.`);

        // 3. Add extra users
        const userCount = await db.users.count_documents({});
        if (userCount < 5) {
            console.log("Seeding extra users...");
            for (let i = 0; i < 5; i++) {
                const uid = genId();
                const user = {
                    id: uid,
                    email: `user${i}@demo.com`,
                    name: `Demo User ${i}`,
                    password_hash: "dummy",
                    created_at: nowIso(),
                    workspace_id: workspaces[Math.floor(Math.random() * workspaces.length)].id
                };
                await db.users.insert_one(user);
            }
        }

        console.log("Admin seeding done!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
}

seedAdminData();
