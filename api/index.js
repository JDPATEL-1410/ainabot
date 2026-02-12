const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { db } = require('./helpers');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true
}));
app.use(express.json());
app.use(morgan('combined'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Routes
const authRouter = require('./routes/auth');
const inboxRouter = require('./routes/inbox');
const messagingRouter = require('./routes/messaging');
const adminRouter = require('./routes/admin');
const billingRouter = require('./routes/billing');
const { router: extrasRouter } = require('./routes/extras');
const webhooksRouter = require('./routes/webhooks');

app.use('/api', authRouter);
app.use('/api', inboxRouter);
app.use('/api', messagingRouter);
app.use('/api', adminRouter);
app.use('/api', billingRouter);
app.use('/api', extrasRouter);
app.use('/api/webhooks', webhooksRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: "ok", service: "yourapp-api-node" });
});

// Database connection middleware for Serverless
app.use(async (req, res, next) => {
    try {
        await db.create_all(); // Ensures connection is established
        next();
    } catch (err) {
        console.error("Database connection failed:", err);
        res.status(500).json({ detail: "Database connection failed" });
    }
});

// Serve Frontend (Local/Production non-serverless)
const FRONTEND_BUILD = path.resolve(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(FRONTEND_BUILD)) {
    console.log("Serving frontend from:", FRONTEND_BUILD);
    app.use(express.static(FRONTEND_BUILD));

    app.get('*', (req, res, next) => {
        if (req.url.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
    });
} else {
    // Vercel deployment: Frontend is served separately via rewrites, 
    // but we can leave this log for local debug.
    console.log("Frontend build not found at (likely Vercel environment):", FRONTEND_BUILD);
}

// Start Server (Only if run directly, not imported)
if (require.main === module) {
    const startServer = async () => {
        try {
            await db.create_all();
            console.log("Database initialized");

            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        } catch (err) {
            console.error("Failed to start server:", err);
            process.exit(1);
        }
    };
    startServer();

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM signal received: closing HTTP server');
        await db.close();
        process.exit(0);
    });
}

// Export for Vercel
module.exports = app;
