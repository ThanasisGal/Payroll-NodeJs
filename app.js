// @ts-nocheck
const dotenv = require("dotenv");
dotenv.config();

const node_env = process.env.NODE_ENV || "development";

// Ρύθμιση static assets
const STATIC_BASE_DEV = process.env.STATIC_BASE_DEV || "/static/js";
const STATIC_BASE_PROD = process.env.STATIC_BASE_PROD || "https://cdn.webpayrollsolutions.com/static/min.js";
const STATIC_BASE = node_env === 'production' ? STATIC_BASE_PROD : STATIC_BASE_DEV;

// AWS S3/CloudFront domains
const S3_BUCKET = process.env.S3_BUCKET || "employee-certificates-webpayrollsolutions-central";
const S3_REGION = process.env.AWS_REGION || "eu-central-1";
const CDN_DOMAIN = process.env.CDN_DOMAIN || "cdn.webpayrollsolutions.com";
const CLOUDFRONT_DOMAIN = process. env.CLOUDFRONT_DOMAIN; // Προαιρετικό: d1t9waojrhy16d.cloudfront.net

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
const grace_period = Number(process.env.GRACE_PERIOD || 2);         // λεπτά

const secret = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;
const EGGRAFES = Number. parseInt(process.env.EGGRAFES ??  '15', 10) || 15;

// Εκκίνηση - καταγραφή ρυθμίσεων
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

// Απαιτείται πίσω από reverse proxy για secure cookies & σωστό req.ip
if (isProd) app.set("trust proxy", 1);

/* -------------------------------------------------------------------------- */
/*                         Rate limiters & guards                             */
/* -------------------------------------------------------------------------- */

// Βελτιωμένος περιορισμός login με φιλικές ρυθμίσεις προς τον χρήστη
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,      // Παράθυρο 15 λεπτών
    max: 5,                         // 5 προσπάθειες
    
    // ΚΡΙΣΙΜΟ: Επαναφορά μετρητή σε επιτυχημένο login
    skipSuccessfulRequests: true,
    
    // Μην περιορίζεις ήδη συνδεδεμένους χρήστες
    skip: (req) => req.session?. userId != null,
    
    standardHeaders: true,
    legacyHeaders: false,
    
    // Προσαρμοσμένο handler με ακριβή χρόνο επανάληψης
    handler: async (req, res) => {
        const retryAfter = req.rateLimit. resetTime 
            ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
            : 15;
            
        logger.warn('⚠️ Επιτεύχθηκε όριο login:', {
            ip: req.ip,
            email: req.body.email || 'άγνωστο',
            προσπάθειες: req.rateLimit. current,
            επανάληψηΣε: `${retryAfter}λεπτά`
        });
        
        // Flash μήνυμα
        if (req.flash) {
            await res.flash('error', `Πάρα πολλές αποτυχημένες προσπάθειες σύνδεσης.  Δοκιμάστε ξανά σε ${retryAfter} λεπτά.`);
        }
        
        // Εμφάνιση σελίδας login με σφάλμα
        res.status(429).render('login/login', {
            bodyClass: 'home-bg-cdn',
            csrfToken: req.csrfToken ?  req.csrfToken() : '',
            title: 'Σύνδεση',
            description: 'Σελίδα σύνδεσης'
        });
    }
});

// Αυστηρότερος περιορισμός για επαναφορά κωδικού (3 προσπάθειες/ώρα)
const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,      // 1 ώρα
    max: 3,                         // 3 αιτήσεις επαναφοράς ανά ώρα
    skipSuccessfulRequests: true,
    
    standardHeaders: true,
    legacyHeaders: false,
    
    handler: async (req, res) => {
        logger.warn('⚠️ Επιτεύχθηκε όριο επαναφοράς κωδικού:', {
            ip: req.ip,
            email: req.body.email || 'άγνωστο'
        });
        
        if (req.flash) {
            await res.flash('error', 'Πάρα πολλές αιτήσεις επαναφοράς κωδικού. Δοκιμάστε ξανά σε 1 ώρα.');
        }
        
        res.status(429).redirect('/login');
    }
});

/* -------------------------------------------------------------------------- */
/*                            Αρχικοποίηση Database                           */
/* -------------------------------------------------------------------------- */
connectDB();

/* -------------------------------------------------------------------------- */
/*                         Σειρά βασικών middlewares                          */
/* -------------------------------------------------------------------------- */

// Body parsers ΠΡΙΝ από CSRF
app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));

// Method override για φόρμες που θέλουν PUT/DELETE
app.use(methodOverride("_method"));

// Cookies ΠΡΙΝ από session/CSRF
app.use(cookieParser());

// Static assets
// app.use("/static", express.static(path. join(__dirname, "public")));


// ═══════════════════════════════════════════════════════════════
// Static assets + CORS headers για static files
// ═══════════════════════════════════════════════════════════════

app.use("/static", express.static(path.join(__dirname, "public"), {
    maxAge: isProd ? '1d' : '0',
    etag: false,
    setHeaders: (res, filepath) => {
        // ✅ Πρόσθεσε CORS headers για ΟΛΕΣ τις static files (JS, CSS, κλπ)
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        
        // ✅ Cache control logic
        if (filepath.endsWith('.html')) {
            // HTML files:  NO cache
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
            // JS/CSS:  cache για 1 day
            res. set('Cache-Control', 'public, max-age=86400, immutable');
        } else {
            // Images κλπ: cache για 7 days
            res.set('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// Global locals
// Helper: Λήψη διαδρομής script
app.locals.script = (path) => {
    // ✅ Remove . js, trim, remove ALL spaces
    const cleanPath = path
        .replace(/\. js$/i, '')
        .trim()
        .replace(/\s+/g, '');
    
    // ✅ Clean STATIC_BASE
    const baseURL = STATIC_BASE
        .trim()
        .replace(/\s+/g, '');
    
    return `${baseURL}/${cleanPath}.js`. replace(/\s+/g, '');
};

app.locals. STATIC_BASE = STATIC_BASE;
app.locals.NODE_ENV = node_env;

/* -------------------------------------------------------------------------- */
/*                              Ρύθμιση Session                               */
/* -------------------------------------------------------------------------- */
if (! mongoUrl) {
    logger.error("MONGODB_URL δεν έχει οριστεί.  Χρήση MemoryStore (μόνο dev).");
}

app.use(session(sessionOpts));
logger.info(`Sessions: ${mongoUrl ?  "MongoStore" : "MemoryStore"} ενεργοποιημένο (ttl=${diarkeia_session}m, secure=${isProd})`);

// Flash messages (βασίζεται στο session)
app.use(flash({ sessionKeyName: "flashMessage" }));

// Custom session vars → res.locals
app.use(getSessionVars);

// // Activity-based session timeout (κρατά lastActivity ώστε να ανανεώνεται το cookie)
// app.get("/remaining-time", (req, res) => {
//     const now = Date.now();
    
//     // ═══════════════════════════════════════════════════════════
//     // CASE 1: Authenticated User (έχει userId)
//     // ═══════════════════════════════════════════════════════════
//     if (req.session && req.session.userId) {
//         const last = req.session.lastActivity || now;
//         const remaining = Math.max(0, 1000 * 60 * diarkeia_session - (now - last));

//         return res.json({ 
//             remainingTime: remaining,
//             sessionID: req.sessionID,
//             userType: 'authenticated'
//         });
//     }

//     // ═══════════════════════════════════════════════════════════
//     // CASE 2: Anonymous User (δεν έχει userId)
//     // ═══════════════════════════════════════════════════════════
    
//     // ✅ Αν δεν υπάρχει session καθόλου, δημιούργησε
//     if (!req.session) {
//         return res.status(500).json({ 
//             error: 'Session middleware error',
//             remainingTime: 0 
//         });
//     }

//     // ✅ Αν δεν έχει `anonymousStartTime`, όρισέ το ΤΩΡΑ
//     if (!req.session.anonymousStartTime) {
//         req.session. anonymousStartTime = now;
//     }

//     // ✅ Υπολόγισε το remaining time για anonymous
//     const anonymousStart = req.session.anonymousStartTime;
//     const anonymousElapsed = now - anonymousStart;
//     const anonymousRemaining = Math.max(0, 1000 * 60 * grace_period - anonymousElapsed);

//     // Debug logging

//     // ✅ Αν το grace period έληξε
//     if (anonymousRemaining <= 0) {
//         return res.status(401).json({ 
//             error: 'Grace period expired',
//             remainingTime: 0,
//             userType: 'anonymous',
//             message: 'Παρακαλώ συνδεθείτε για να συνεχίσετε'
//         });
//     }

//     // ✅ Επιστροφή remaining time για anonymous
//     return res.json({ 
//         remainingTime: anonymousRemaining,
//         sessionID: req.sessionID,
//         userType: 'anonymous',
//         gracePeriod: true
//     });
// });

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Reset lastActivity on authenticated page navigation
// ═══════════════════════════════════════════════════════════════════════════
app.use((req, res, next) => {
    // Skip for static files, API calls, login/logout
    const skipPaths = [
        '/static',
        '/api',
        '/login',
        '/logout',
        '/remaining-time',
        '/csrf-token'
    ];
    
    const shouldSkip = skipPaths.some(path => req.path.startsWith(path));
    
    // ✅ Reset lastActivity for authenticated users on page navigation
    if (! shouldSkip && req.session && req.session.userId) {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || 0;
        const timeSinceLastActivity = now - lastActivity;
        
        // Only reset if > 5 seconds since last activity (avoid rapid resets)
        if (timeSinceLastActivity > 5000) {
            req.session. lastActivity = now;
            logger.info(`🔄 Session activity reset for user ${req.session.userId} on ${req.path}`);
        }
    }
    
    next();
});

// ═══════════════════════════════════════════════════════════════════════════
// EXISTING: Activity-based session timeout
// ═══════════════════════════════════════════════════════════════════════════
app.get("/remaining-time", (req, res) => {
    const now = Date.now();
    
    // CASE 1: Authenticated User
    if (req.session && req.session.userId) {
        const last = req.session.lastActivity || now;
        const remaining = Math.max(0, 1000 * 60 * diarkeia_session - (now - last));

        return res.json({ 
            remainingTime: remaining,
            sessionID: req. sessionID,
            userType: 'authenticated'
        });
    }

    // CASE 2: Anonymous User
    if (! req.session) {
        return res.status(500).json({ 
            error: 'Session middleware error',
            remainingTime: 0 
        });
    }

    if (!req. session.anonymousStartTime) {
        req.session.anonymousStartTime = now;
    }

    const anonymousStart = req.session.anonymousStartTime;
    const anonymousElapsed = now - anonymousStart;
    const anonymousRemaining = Math. max(0, 1000 * 60 * grace_period - anonymousElapsed);

    if (anonymousRemaining <= 0) {
        return res. status(401).json({ 
            error: 'Grace period expired',
            remainingTime: 0,
            userType: 'anonymous',
            message: 'Παρακαλώ συνδεθείτε για να συνεχίσετε'
        });
    }

    return res.json({ 
        remainingTime: anonymousRemaining,
        sessionID: req.sessionID,
        userType: 'anonymous',
        gracePeriod: true
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Check if user is authenticated
// ═══════════════════════════════════════════════════════════════════════════
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // ✅ Authenticated → proceed
    }
    
    // ❌ Not authenticated → return 401
    return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated',
        message: 'Παρακαλώ συνδεθείτε για να συνεχίσετε'
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Session refresh on navigation (ONLY for authenticated users)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/session/refresh', isAuthenticated, async (req, res) => {
    try {
        const now = Date.now();
        
        // ✅ Υπολογισμός remaining time
        const lastActivity = req.session.lastActivity || now;
        const remainingMs = Math.max(0, 1000 * 60 * diarkeia_session - (now - lastActivity));
        const remainingMinutes = Math.floor(remainingMs / 60000);
        
        const GRACE_PERIOD_MINUTES = grace_period; // 2 minutes (από το config σου)
        
        // ✅ ΑΝ remaining time > grace period → RESET session
        if (remainingMinutes > GRACE_PERIOD_MINUTES) {
            // Reset lastActivity → effectively resets countdown
            req.session.lastActivity = now;
            
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Session refresh failed' 
                    });
                }
                
                const newRemainingMs = 1000 * 60 * diarkeia_session;
                
                return res.json({
                    success: true,
                    refreshed: true,
                    remainingTime: formatTime(newRemainingMs),
                    remainingMs: newRemainingMs,
                    message: 'Session refreshed to 30:00'
                });
            });
        } else {
            // ✅ ΑΝ remaining time ≤ grace period → ΜΗΝ κάνεις reset
            return res.json({
                success: true,
                refreshed: false,
                remainingTime: formatTime(remainingMs),
                remainingMs: remainingMs,
                gracePeriod: true,
                message: 'Grace period active - session NOT refreshed'
            });
        }
    } catch (error) {
        console.error('Session refresh error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format milliseconds to MM:SS
// ═══════════════════════════════════════════════════════════════════════════
function formatTime(ms) {
    const minutes = Math. floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/*                           Security headers                                 */
/* -------------------------------------------------------------------------- */

// Helmet "βασικά" headers
app.use(helmet());

// Επιπλέον πολιτικές (ασφαλείς προεπιλογές)
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
/*          ✅ ΔΙΟΡΘΩΜΕΝΗ CSP ΛΥΣΗ - CDN domains επιτρέπονται πλήρως          */
/* -------------------------------------------------------------------------- */

// Δημιουργία CSP directives δυναμικά
const buildCSPDirectives = () => {
    // CDN domains που πρέπει να επιτρέπονται
    const cdnDomains = [
        `https://${CDN_DOMAIN}`,
        `https://${S3_BUCKET}.s3. amazonaws.com`,
        `https://${S3_BUCKET}.s3. ${S3_REGION}.amazonaws.com`
    ];
    
    if (CLOUDFRONT_DOMAIN) {
        cdnDomains.push(`https://${CLOUDFRONT_DOMAIN}`);
    }
    
    logger.info(`CSP: Επιτρέπονται scripts από: ${cdnDomains.join(', ')}`);
    
    const directives = {
        "default-src": ["'self'"],
        
        // ✅ Scripts: self + nonce + ΟΛΟΙ οι CDN domains
        "script-src": [
            "'self'",
            (req, res) => `'nonce-${res.locals.nonce}'`,
            ... cdnDomains  // ← Προσθήκη όλων των CDN domains
        ],
        
        "style-src-elem": [
            "'self'",
            "https://fonts.googleapis.com",
            "'unsafe-inline'",
            ... cdnDomains
        ],
        
        "style-src-attr": ["'unsafe-inline'"],
        
        "style-src": [
            "'self'",
            "https://fonts.googleapis. com",
            ... cdnDomains
        ],
        
        "font-src": [
            "'self'",
            "https://fonts.gstatic.com",
            "data:",
            ... cdnDomains
        ],
        
        "img-src": [
            "'self'",
            "data:",
            "blob:",
            ...cdnDomains
        ],
        
        "connect-src": [
            "'self'",
            "https://fonts.googleapis.com",
            "https://fonts.gstatic. com",
            ... cdnDomains
        ],
        
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-src": ["'self'"],
        "frame-ancestors": ["'none'"]
    };
    
    // Ενεργοποίηση HTTPS upgrade ΜΟΝΟ σε production
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
/*                              CSRF (csurf@1.x)                              */
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

// CSRF με εξαιρέσεις για S3 uploads & AWS webhooks
app.use((req, res, next) => {
    // Παράκαμψη CSRF για:
    // 1. S3 pre-signed URL callbacks
    // 2.  Webhooks από AWS
    // 3. Health checks
    // 4. Session refresh API
    const skipPaths = [
        '/health',
        '/api/webhook',
        '/api/session/refresh',
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

// Προαιρετικό endpoint για AJAX clients να παίρνουν token
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
        logger.warn("CSRF token απορρίφθηκε", {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        if (req.flash) {
            await res.flash("error", "Η συνεδρία έληξε ή η φόρμα δεν είναι έγκυρη.  Δοκιμάστε ξανά.");
        }
        
        const referrer = req.get("Referrer") || req.get("Referer") || "/";
        // Επικύρωση για να αποφύγουμε open redirects
        const safeRedirect = referrer.startsWith('/') ? referrer : '/';
        return res.redirect(safeRedirect);
    }
    next(err);
});

// CSS helper (add after app.locals.script)
// app.locals.css = (path) => {
//     const cleanPath = path. replace(/\.css$/i, '').trim(). replace(/\s+/g, '');
    
//     if (node_env === 'production') {
//         return `https://cdn.webpayrollsolutions.com/assets/own/css/${cleanPath}.min.css`;
//     } else {
//         return `/static/css/${cleanPath}.css`;
//     }
// };
// CSS helper με timestamp cache busting
const cssVersion = Date.now(); // Timestamp που δημιουργείται κατά την εκκίνηση της εφαρμογής
    
app.locals.css = (path) => {
    const cleanPath = path.replace(/\.css$/i, '').trim().replace(/\s+/g, '');
    
    if (node_env === 'production') {
        return `https://cdn.webpayrollsolutions.com/assets/own/css/${cleanPath}.min.css?v=${cssVersion}`;
    } else {
        return `/static/css/${cleanPath}.css?v=${cssVersion}`;
    }
};

/* -------------------------------------------------------------------------- */
/*                             Views / layouts (EJS)                          */
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
// Εφαρμογή login limiter στα login routes
app.use(
    "/login",
    isProd ?  loginLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

// Εφαρμογή αυστηρότερου limiter στην επαναφορά κωδικού
app.use(
    "/reset_password",
    isProd ? resetPasswordLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

app.use('/api', apiRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/", usersRoute);

/* -------------------------------------------------------------------------- */
/*                              Διαχείριση σφαλμάτων                          */
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
/*                                 Εκκίνηση                                   */
/* -------------------------------------------------------------------------- */
app.listen(port, "0.0.0.0", () => {
    logger.info(`🚀 App listening at http://${host}:${port}`);
});