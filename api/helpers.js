const os = require('os');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_ALGORITHM = "HS256";
const JWT_EXPIRY_HOURS = 72;

const { SQLDatabase } = require('./database');
const dbUrl = process.env.DATABASE_URL || 'mysql://user:pass@localhost/db';
const db = new SQLDatabase(dbUrl);

// Proxy to make db.users.find_one work like Python's db.users.find_one
const dbProxy = new Proxy(db, {
    get(target, prop) {
        if (prop in target) return target[prop];
        return target.getCollection(prop);
    }
});

const hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

const verifyPassword = (plain, hashed) => {
    return bcrypt.compareSync(plain, hashed);
};

const createToken = (userId, email, workspaceId = null, role = null) => {
    const payload = {
        user_id: userId,
        email: email,
        workspace_id: workspaceId,
        role: role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXPIRY_HOURS}h` });
};

const decodeToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            const error = new Error("Token expired");
            error.status = 401;
            throw error;
        }
        const error = new Error("Invalid token");
        error.status = 401;
        throw error;
    }
};

const getCurrentUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ detail: "Missing authorization" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = decodeToken(token);
        const user = await dbProxy.users.findOne({ id: payload.user_id });
        if (!user) {
            return res.status(401).json({ detail: "User not found" });
        }
        user.workspace_id = payload.workspace_id;
        user.role = payload.role;
        req.user = user;
        next();
    } catch (err) {
        return res.status(err.status || 401).json({ detail: err.message });
    }
};

const genId = () => uuidv4();

const nowIso = () => new Date().toISOString();

module.exports = {
    db: dbProxy,
    hashPassword,
    verifyPassword,
    createToken,
    decodeToken,
    getCurrentUser,
    genId,
    nowIso
};
