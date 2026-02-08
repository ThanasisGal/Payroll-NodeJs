const MongoStore = require('connect-mongo');

const isProd = process.env.NODE_ENV === 'production';
const diarkeia_session = Number(process.env.DIARKEIA_SESSION || 60);
const secret = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;

const sessionOpts = {
    secret: process.env.SESSION_SECRET || process.env.SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    store: mongoUrl
        ? MongoStore.create({
                mongoUrl,
                ttl: 60 * diarkeia_session,
                autoRemove: 'native',
                touchAfter: 24 * 3600,
            })
        : undefined,
    cookie: {
        maxAge  : 1000 * 60 * diarkeia_session,
        httpOnly: true,
        secure  : isProd,
        sameSite: isProd ? 'lax' : 'lax',
        path    : '/',
        // ✅ NO domain - let browser set it automatically
    },
    rolling: true,
    proxy: isProd,  // ✅ CRITICAL: Trust proxy for HTTPS
    unset: 'destroy',  // ✅ Clear session on logout
};

module.exports = { sessionOpts, isProd };