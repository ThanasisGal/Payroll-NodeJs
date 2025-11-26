// @ts-nocheck
const dotenv = require("dotenv");
dotenv.config();

const node_env = process.env.NODE_ENV || "development";

// Configure static assets
const STATIC_BASE_DEV = process.env.STATIC_BASE_DEV || "/static/js";
const STATIC_BASE_PROD = process.env. STATIC_BASE_PROD || "https://cdn.webpayrollsolutions.com/static/min. js";
const STATIC_BASE = node_env === 'production' ? STATIC_BASE_PROD : STATIC_BASE_DEV;

// AWS S3/CloudFront domains
const S3_BUCKET = process.env.S3_BUCKET || "employee-certificates-webpayrollsolutions-central";
const S3_REGION = process.env.AWS_REGION || "eu-central-1";
const CDN_DOMAIN = process.env.CDN_DOMAIN || "cdn. webpayrollsolutions.com";
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN; // Optional: d1t9waojrhy16d.cloudfront.net

const express = require("express");
const { urlencoded, json } = require("express");
const path = require("path");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { sessionOpts, isProd } = require('./config/sessionOpts');
const flash = require("express-flash-message"). default;
const helmet = require("helmet");
const csurf = require("csurf");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const connectDB = require("./server/config/db");
const geoGuard = require("./server/middlewares/geoGuard");
const usersRoute = require("./server/routes/usersRoute");
const dropdownRoutes = require("./server/routes/dropdownRoutes");
const apiRoutes = require("./server/routes/apiRoutes");
const getSessionVars = require("./server/middlewares/session-variables");
const logger = require("./server/utils/logger");

const app = express();
app.disable("x-powered-by"); // μικρό hardening

const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 5000);
const diarkeia_session = Number(process.env.DIARKEIA_SESSION || 30); // λεπτά
const secret = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;
const EGGRAFES = Number. parseInt(process.env.EGGRAFES ??  '15', 10) || 15;

// ✅ Startup logging
logger.info("========================================");
logger.info("🔧 ENVIRONMENT CONFIG");
logger.info("========================================");
logger.info(`NODE_ENV:     ${node_env}`);
logger.info(`STATIC_BASE:  ${STATIC_BASE}`);
logger.info(`isProd:       ${isProd}`);
logger.info(`CDN_DOMAIN:   ${CDN_DOMAIN}`);
logger.info(`S3_BUCKET:    ${S3_BUCKET}`);
if (CLOUDFRONT_DOMAIN) {
    logger.info(`CloudFront:   ${CLOUDFRONT_DOMAIN}`);
}
logger.info("========================================");

if (isProd) app.set("trust proxy", 1); // απαιτείται πίσω από reverse proxy για secure cookies & σωστό req.ip

/* -------------------------------------------------------------------------- */
/*                            Rate limiters & guards                           */
/* -------------------------------------------------------------------------- */

// Προστασία από brute force σε login (και προαιρετικά reset_password)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15'
    max: 10,                  // έως 10 αιτήσεις / IP / 15'
    standardHeaders: true,
    legacyHeaders: false,
    message: "Πάρα πολλές προσπάθειες.  Δοκιμάστε ξανά αργότερα."
});

/* -------------------------------------------------------------------------- */
/*                                Database init                                */
/* -------------------------------------------------------------------------- */
connectDB();

/* -------------------------------------------------------------------------- */
/*                            Core middlewares order                           */
/* -------------------------------------------------------------------------- */

// Body parsers ΠΡΙΝ από CSRF
app.use(urlencoded({ extended: true, limit: '50mb' }));
app. use(json({ limit: '50mb' }));

// Method override για φόρμες που θέλουν PUT/DELETE
app.use(methodOverride("_method"));

// Cookies ΠΡΙΝ από session/CSRF
app.use(cookieParser());

// Static assets
app.use("/static", express.static(path.join(__dirname, "public")));

// Global locals
// Helper: Get script path
app.locals.script = (path) => {
    // Remove . js if present
    const cleanPath = path.replace(/\.js$/, '');
    
    if (node_env === 'production') {
        return `${STATIC_BASE}/${cleanPath}. min.js`;
    } else {
        return `${STATIC_BASE}/${cleanPath}.js`;
    }
};

// Also expose for direct use
app.locals. STATIC_BASE = STATIC_BASE;
app.locals.NODE_ENV = node_env;

/* -------------------------------------------------------------------------- */
/*                                Session setup                               */
/* -------------------------------------------------------------------------- */
if (! mongoUrl) {
    logger.error("MONGODB_URL is not set.  Using MemoryStore (dev only).");
}

app.use(session(sessionOpts));
logger.info(`Sessions: ${mongoUrl ?  "MongoStore" : "MemoryStore"} enabled (ttl=${diarkeia_session}m, secure=${isProd})`);

// Flash messages (βασίζεται στο session)
app.use(flash({ sessionKeyName: "flashMessage" }));

// Custom session vars → res.locals
app.use(getSessionVars);

// Activity-based session timeout (κρατά lastActivity ώστε να ανανεώνεται το cookie)
app.use((req, res, next) => {
    if (req.session) {
        const now = Date.now();
        const isAsset = req.path.startsWith("/static/");
        const isCountdown = req.path === '/remaining-time';
        const isLogout = req.path. startsWith('/logout');

        if (! isAsset && !isCountdown && !isLogout) {
            if (! req.session.lastActivity) req.session.lastActivity = now;
            const elapsed = now - req.session.lastActivity;
            const remaining = 1000 * 60 * diarkeia_session - elapsed;

            if (remaining <= 0) return res.redirect(303, "/logout/end_Session");
            res.locals.remainingTime = remaining;
            req.session.lastActivity = now; // τροποποίηση => σώζει session
        }
    } else {
        res.locals. remainingTime = 0;
    }
    next();
});

/* -------------------------------------------------------------------------- */
/*                              Security headers                               */
/* -------------------------------------------------------------------------- */

// Helmet "βασικά" headers
app.use(helmet());

// Extra policies (safe defaults)
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));
app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: "none" }));
app.use(helmet.crossOriginResourcePolicy({ policy: "same-origin" })); // τα δικά μου assets δεν σερβίρονται σε άλλους origins

// HSTS μόνο σε production
if (isProd) {
    app.use(
        helmet.hsts({
            maxAge: 31536000, // 1 έτος
            includeSubDomains: true,
            preload: false,
        })
    );
}

// CSP nonce ανά request
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(18).toString("base64");
    next();
});

/* -------------------------------------------------------------------------- */
/*          ✅ FIXED CSP SOLUTION - Works in ALL environments                 */
/* -------------------------------------------------------------------------- */

// Build CSP directives dynamically
const buildCSPDirectives = () => {
    const directives = {
        "default-src": ["'self'"],
        "script-src": [
            "'self'",
            (req, res) => `'nonce-${res.locals.nonce}'`
        ],
        "style-src-elem": [
            "'self'",
            "https://fonts.googleapis.com",
            "'unsafe-inline'"
        ],
        "style-src-attr": ["'unsafe-inline'"],
        "style-src": [
            "'self'",
            "https://fonts. googleapis. com"
        ],
        "font-src": [
            "'self'",
            "https://fonts.gstatic.com",
            "data:"
        ],
        "img-src": [
            "'self'",
            "data:",
            "blob:"
        ],
        "connect-src": [
            "'self'",
            "https://fonts. googleapis.com",
            "https://fonts.gstatic.com"
        ],
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-src": ["'self'"],
        "frame-ancestors": ["'none'"]
    };

    // ✅ ALWAYS add CDN/S3 domains (both dev and prod)
    // This allows testing with CDN resources in development
    const cdnDomains = [
        `https://${CDN_DOMAIN}`,
        `https://${S3_BUCKET}.s3.amazonaws. com`,
        `https://${S3_BUCKET}.s3.${S3_REGION}. amazonaws.com`
    ];
    
    if (CLOUDFRONT_DOMAIN) {
        cdnDomains.push(`https://${CLOUDFRONT_DOMAIN}`);
    }

    // Add CDN domains to all relevant directives
    directives["script-src"].push(... cdnDomains);
    directives["style-src-elem"].push(...cdnDomains);
    directives["style-src"].push(`https://${CDN_DOMAIN}`);
    directives["font-src"].push(...cdnDomains);
    directives["img-src"]. push(...cdnDomains);
    directives["connect-src"].push(...cdnDomains);
    
    // Enable HTTPS upgrade ONLY in production
    if (isProd) {
        directives["upgrade-insecure-requests"] = [];
    }

    return directives;
};

const cspDirectives = buildCSPDirectives();

app.use(
    helmet. contentSecurityPolicy({
        useDefaults: false,
        directives: cspDirectives,
    })
);

/* -------------------------------------------------------------------------- */
/*                              CSRF (csurf@1.x)                               */
/* -------------------------------------------------------------------------- */
/**
 * Χρησιμοποιούμε cookie-based CSRF:
 * - cookie: κρατάει το "secret"
 * - στη φόρμα/JSON στέλνουμε το token από req.csrfToken()
 * - σε AJAX στέλνουμε header "CSRF-Token"
 */
const csrfProtection = csurf({
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd, // dev: false, prod: true
        path: "/",
    },
});

// ✅ CSRF με exceptions για S3 uploads & AWS webhooks
app.use((req, res, next) => {
    // Skip CSRF για:
    // 1. S3 pre-signed URL callbacks
    // 2.  Webhooks από AWS
    // 3. Health checks
    const skipPaths = [
        '/health',
        '/api/webhook',
    ];
    
    const skipCSRF = skipPaths.some(path => req.path.startsWith(path)) ||
                     req.headers['x-amz-date'] || // S3 signature
                     req.headers['user-agent']?.includes('Amazon'); // AWS health checks
    
    if (skipCSRF) {
        return next();
    }
    
    csrfProtection(req, res, next);
});

app.use((req, res, next) => {
    try {
        res.locals.csrfToken = req.csrfToken();
    } catch {
        res.locals.csrfToken = "";
    }
    next();
});

// (Προαιρετικό) Endpoint για AJAX clients να παίρνουν token
app.get("/csrf-token", (req, res) => {
    try {
        return res.json({ csrfToken: req.csrfToken() });
    } catch {
        return res.status(500).json({ csrfToken: "" });
    }
});

// CSRF error handler (για ληγμένα/λάθος tokens)
app.use(async (err, req, res, next) => {
    if (err && err.code === "EBADCSRFTOKEN") {
        logger.warn("CSRF token rejected", {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        if (req.flash) {
            await res.flash("error", "Η συνεδρία έληξε ή η φόρμα δεν είναι έγκυρη.  Δοκιμάστε ξανά.");
        }
        
        const referrer = req.get("Referrer") || req.get("Referer") || "/";
        // Validation για να αποφύγουμε open redirects
        const safeRedirect = referrer.startsWith('/') ?  referrer : '/';
        return res.redirect(safeRedirect);
    }
    next(err);
});

/* -------------------------------------------------------------------------- */
/*                             Views / layouts (EJS)                           */
/* -------------------------------------------------------------------------- */
app.set("view engine", "ejs");
app.use(expressLayout);
app.set("layout", "./layouts/main");

app.use((req, res, next) => {
    res.locals.CONFIG = { EGGRAFES };
    next();
});

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */
app.get("/api/session-data", (req, res) => {
    res.json({
        sessionEtos: req.session?. yearInUse || null,
        sessionMhnas: req.session?.periodInUse || null,
        sessionTeam: req.session?.userTeam || null,
        sessionCompanyInUse: req.session?.companyInUse || null,
    });
});

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */
// Guards στο /login — ενεργά μόνο σε prod (σε dev no-op)
app.use(
    "/login",
    isProd ? loginLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

app.use("/reset_password", isProd ? loginLimiter : (req, res, next) => next(), isProd ? geoGuard : (req, res, next) => next());

app.use('/api', apiRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/", usersRoute);

// Countdown endpoint (για client-side εμφάνιση)
app.get("/remaining-time", (req, res) => {
    const now = Date.now();
    const last = req.session?. lastActivity ??  now;
    const remaining = Math.max(0, 1000 * 60 * diarkeia_session - (now - last));
    res.json({ remainingTime: remaining });
});

/* -------------------------------------------------------------------------- */
/*                                 Error paths                                */
/* -------------------------------------------------------------------------- */

// 404 — τελευταίο middleware
app.use((req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(404).render("404", {
        title: "Σελίδα δεν βρέθηκε",
        description: "404 - Page not found",
        bodyClass: "custom-background",
        NODE_ENV: process.env.NODE_ENV,
        nonce: res.locals.nonce,
    });
});

/* -------------------------------------------------------------------------- */
/*                                  Startup                                   */
/* -------------------------------------------------------------------------- */
app.listen(port, "0.0.0.0", () => {
    logger.info(`🚀 App listening at http://${host}:${port}`);
});