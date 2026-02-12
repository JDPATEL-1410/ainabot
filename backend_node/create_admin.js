require('dotenv').config();
const { db, genId, nowIso, hashPassword } = require('./helpers');

async function createAdmin(email, password, name = "Administrator") {
    try {
        await db.create_all();

        const existing = await db.users.findOne({ email: email.toLowerCase() });
        if (existing) {
            console.log(`User ${email} already exists. Updating password...`);
            await db.users.update_one(
                { id: existing.id },
                { $set: { password_hash: hashPassword(password) } }
            );
        } else {
            const user_id = genId();
            const user = {
                id: user_id,
                email: email.toLowerCase(),
                name: name,
                password_hash: hashPassword(password),
                is_super_admin: true,
                created_at: nowIso()
            };
            await db.users.insert_one(user);
            console.log(`User ${email} created.`);

            const ws_id = genId();
            const workspace = {
                id: ws_id,
                name: `${name}'s Workspace`,
                timezone: "UTC",
                plan: "pro",
                status: "active",
                created_at: nowIso()
            };
            await db.workspaces.insert_one(workspace);
            console.log(`Workspace created.`);

            await db.users.update_one({ id: user_id }, { $set: { workspace_id: ws_id } });

            const member = {
                id: genId(),
                workspace_id: ws_id,
                user_id: user_id,
                role: "owner",
                status: "active",
                joined_at: nowIso()
            };
            await db.workspace_members.insert_one(member);
            console.log(`User linked to workspace as owner.`);
        }

        await db.close();
        console.log("Done!");
        process.exit(0);
    } catch (err) {
        console.error("Failed to create admin:", err);
        process.exit(1);
    }
}

const email = process.argv[2] || "admin@example.com";
const password = process.argv[3] || "admin123";
createAdmin(email, password);
