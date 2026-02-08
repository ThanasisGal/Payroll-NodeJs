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
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

const express = require("express");
const { urlencoded, json } = require("express");
const fs = require('fs');
const path = require("path");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { sessionOpts, isProd } = require('./config/sessionOpts');
const flash = require("express-flash-message").default;
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const connectDB = require("./server/config/db");
const geoGuard = require("./server/middlewares/geoGuard");
const usersRoute = require("./server/routes/usersRoute");
const dropdownRoutes = require("./server/routes/dropdownRoutes");
const apiRoutes = require("./server/routes/apiRoutes");
const adminRoutes = require('./server/routes/adminRoutes');
const sessionRoutes = require("./server/routes/sessionRoute");
require('./server/config/aws');

const getSessionVars = require("./server/middlewares/session-variables");
const logger = require("./server/utils/logger");

// ============================================================================
// ✅ TEXT CACHE SYSTEM IMPORTS
// ============================================================================
const textLoader = require('./server/utils/textLoader');
const textCacheManager = require('./server/utils/textCacheManager');

const app = express();
app.disable("x-powered-by");

const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 5000);

const diarkeia_session = Number(process.env.DIARKEIA_SESSION || 60);
const grace_period = Number(process.env.GRACE_PERIOD || 5);

const secret = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;
const EGGRAFES = Number.parseInt(process.env.EGGRAFES ?? '15', 10) || 15;

// Εκκίνηση - καταγραφή ρυθμίσεων
logger.info("========================================");
logger.info("🔧 ENVIRONMENT CONFIG");
logger.info("========================================");
logger.info(`NODE_ENV:           ${node_env}`);
logger.info(`STATIC_BASE:       ${STATIC_BASE}`);
logger.info(`isProd:           ${isProd}`);
logger.info(`CDN_DOMAIN:       ${CDN_DOMAIN}`);
logger.info(`S3_BUCKET:        ${S3_BUCKET}`);
if (CLOUDFRONT_DOMAIN) {
    logger.info(`CloudFront:         ${CLOUDFRONT_DOMAIN}`);
}
logger.info("========================================");

if (isProd) app.set("trust proxy", 1);

/* -------------------------------------------------------------------------- */
/*                         Rate limiters & guards                             */
/* -------------------------------------------------------------------------- */

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    skip: (req) => req.session?.userId != null,
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
        const retryAfter = req.rateLimit.resetTime 
            ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
            : 15;
            
        logger.warn('⚠️ Επιτεύχθηκε όριο login:', {
            ip: req.ip,
            email: req.body.email || 'άγνωστο',
            προσπάθειες: req.rateLimit.current,
            επανάληψηΣε: `${retryAfter}λεπτά`
        });
        
        if (req.flash) {
            await res.flash('error', `Πάρα πολλές αποτυχημένες προσπάθειες σύνδεσης. Δοκιμάστε ξανά σε ${retryAfter} λεπτά.`);
        }
        
        res.status(429).render('login/login', {
            bodyClass: 'home-bg-cdn',
            csrfToken: res.locals.csrfToken || '',
            title: 'Σύνδεση',
            description: 'Σελίδα σύνδεσης'
        });
    }
});

const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
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

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));
app.use(methodOverride("_method"));
app.use(cookieParser());

app.use("/static", express.static(path.join(__dirname, "public"), {
    maxAge: isProd ? '1d' : '0',
    etag: false,
    setHeaders: (res, filepath) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        
        if (filepath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
            res.set('Cache-Control', 'public, max-age=86400, immutable');
        } else {
            res.set('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// =========================================================================
// LOCAL S3 MOCK - Serve uploaded files in development
// =========================================================================
if (process.env.NODE_ENV === 'development' || process.env.USE_LOCAL_STORAGE === 'true') {
    const uploadsPath = path.join(__dirname, 'uploads/s3-mock');
    app.use('/uploads/s3-mock', express.static(uploadsPath));
    logger.info('📁 DEV MODE: Serving local S3 mock files from: ' + uploadsPath);
}

const checkFileAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        logger.warn(`Unauthorized file access attempt: ${req.path} from IP ${req.ip}`);
        return res.status(401).send('Unauthorized - Please login');
    }
    
    logger.info(`File access: ${req.path} by user ${req.session.userId}`);
    next();
};

// ============================================================================
// Serve Uploads (Protected)
// ============================================================================

app.use('/uploads', checkFileAuth, express.static(path.join(__dirname, 'uploads'), {
    maxAge: 0,
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filepath) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('Referrer-Policy', 'no-referrer');
        
        if (filepath.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
            res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline';");
        }
    }
}));

app.locals.script = (path) => {
    const cleanPath = path.replace(/\.js$/i, '').trim().replace(/\s+/g, '');
    const baseURL = STATIC_BASE.trim().replace(/\s+/g, '');
    return `${baseURL}/${cleanPath}.js`.replace(/\s+/g, '');
};

app.locals.STATIC_BASE = STATIC_BASE;
app.locals.NODE_ENV = node_env;

/* -------------------------------------------------------------------------- */
/*                              Ρύθμιση Session                               */
/* -------------------------------------------------------------------------- */
if (!mongoUrl) {
    logger.error("MONGODB_URL δεν έχει οριστεί. Χρήση MemoryStore (μόνο dev).");
}

app.use(session(sessionOpts));

logger.info(`Sessions: ${mongoUrl ? "MongoStore" : "MemoryStore"} ενεργοποιημένο (ttl=${diarkeia_session}m, secure=${isProd})`);

app.use(flash({ sessionKeyName: "flashMessage" }));
app.use(getSessionVars);

/* -------------------------------------------------------------------------- */
/*                    Session activity & timeout logic                        */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
    const skipPaths = ['/static', '/api', '/login', '/logout', '/remaining-time', '/csrf-token'];
    const shouldSkip = skipPaths.some(path => req.path.startsWith(path));
    
    if (!shouldSkip && req.session && req.session.userId) {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || 0;
        const timeSinceLastActivity = now - lastActivity;
        
        if (timeSinceLastActivity > 5000) {
            req.session.lastActivity = now;
            logger.info(`🔄 Session activity reset for user ${req.session.userId} on ${req.path}`);
        }
    }
    
    next();
});

app.get("/remaining-time", (req, res) => {
    const now = Date.now();
    
    if (req.session && req.session.userId) {
        const last = req.session.lastActivity || now;
        const remaining = Math.max(0, 1000 * 60 * diarkeia_session - (now - last));

        return res.json({ 
            remainingTime: remaining,
            sessionID: req.sessionID,
            userType: 'authenticated'
        });
    }

    if (!req.session) {
        return res.status(500).json({ 
            error: 'Session middleware error',
            remainingTime: 0 
        });
    }

    if (!req.session.anonymousStartTime) {
        req.session.anonymousStartTime = now;
    }

    const anonymousStart = req.session.anonymousStartTime;
    const anonymousElapsed = now - anonymousStart;
    const anonymousRemaining = Math.max(0, 1000 * 60 * grace_period - anonymousElapsed);

    if (anonymousRemaining <= 0) {
        return res.status(401).json({ 
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

function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    
    return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated',
        message: 'Παρακαλώ συνδεθείτε για να συνεχίσετε'
    });
}

app.post('/api/session/refresh', isAuthenticated, async (req, res) => {
    try {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || now;
        const remainingMs = Math.max(0, 1000 * 60 * diarkeia_session - (now - lastActivity));
        const remainingMinutes = Math.floor(remainingMs / 60000);
        
        const GRACE_PERIOD_MINUTES = grace_period;
        
        if (remainingMinutes > GRACE_PERIOD_MINUTES) {
            req.session.lastActivity = now;
            
            req.session.save((err) => {
                if (err) {
                    logger.error('Session save error:', err);
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
                    message: 'Session refreshed to 60:00'
                });
            });
        } else {
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
        logger.error('Session refresh error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/*                           Security headers                                 */
/* -------------------------------------------------------------------------- */

app.use(helmet());
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));
app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: "none" }));
app.use(helmet.crossOriginResourcePolicy({ policy: "same-origin" }));

if (isProd) {
    app.use(
        helmet.hsts({
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false,
        })
    );
}

app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(18).toString("base64");
    next();
});

const buildCSPDirectives = () => {
    const cdnDomains = [
        `https://${CDN_DOMAIN}`,
        `https://${S3_BUCKET}.s3.amazonaws.com`,
        `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`
    ];
    
    if (CLOUDFRONT_DOMAIN) {
        cdnDomains.push(`https://${CLOUDFRONT_DOMAIN}`);
    }
    
    logger.info(`CSP: Επιτρέπονται scripts από: ${cdnDomains.join(', ')}`);
    
    const directives = {
        "default-src": ["'self'"],
        "script-src": [
            "'self'",
            (req, res) => `'nonce-${res.locals.nonce}'`,
            ...cdnDomains
        ],
        "style-src-elem": [
            "'self'",
            "https://fonts.googleapis.com",
            "'unsafe-inline'",
            ...cdnDomains
        ],
        "style-src-attr": ["'unsafe-inline'"],
        "style-src": [
            "'self'",
            "https://fonts.googleapis.com",
            ...cdnDomains
        ],
        "font-src": [
            "'self'",
            "https://fonts.gstatic.com",
            "data:",
            ...cdnDomains
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
            "https://fonts.gstatic.com",
            ...cdnDomains
        ],
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'self'", "blob:"],
        "frame-src": ["'self'", "blob:"],
        "child-src": ["'self'", "blob:"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"]
    };
    
    if (isProd) {
        directives["upgrade-insecure-requests"] = [];
    }

    return directives;
};

const cspDirectives = buildCSPDirectives();

app.use(
    helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: cspDirectives,
    })
);

/* -------------------------------------------------------------------------- */
/*                    ✅ CSRF Protection (CUSTOM Implementation)              */
/* -------------------------------------------------------------------------- */

function generateSimpleCsrfToken(req, res) {
    const token = crypto.randomBytes(32).toString('hex');
    
    res.cookie('psifl.x-csrf-token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
        maxAge: 1800000,
        ...(isProd ? { domain: process.env.DOMAIN } : {}),
    });
    
    return token;
}

function validateSimpleCsrfToken(req) {
    const cookieToken = req.cookies['psifl.x-csrf-token'];
    
    const headerToken = req.body?._csrf ||
                       req.headers['csrf-token'] ||
                       req.headers['x-csrf-token'] ||
                       req.query?._csrf;
    
    return cookieToken && headerToken && cookieToken === headerToken;
}

app.use((req, res, next) => {
    try {
        const existingToken = req.cookies['psifl.x-csrf-token'];
        
        if (existingToken) {
            res.locals.csrfToken = existingToken;
        } else {
            res.locals.csrfToken = generateSimpleCsrfToken(req, res);
        }
    } catch (err) {
        logger.error('Error generating CSRF token for views:', err);
        res.locals.csrfToken = '';
    }
    next();
});

app.use((req, res, next) => {
    const skipPaths = [
        '/health',
        '/api/webhook',
        '/api/session/refresh',
        '/remaining-time',
        '/csrf-token',
        '/api/session-data',
        '/login/userLogin',
        '/register/userRegistration',
        '/login/send-reset-password-email',
        '/login/verify-email',
        '/login/change_password/changepassword',
        '/logout/userLogout',
        '/public/',
        '/css/',
        '/js/',
        '/images/',
        '/uploads/',
        '/static/',
    ];

    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    if (req.method === 'GET') {
        return next();
    }

    if (!validateSimpleCsrfToken(req)) {
        logger.error('❌ CSRF validation FAILED: ');
        logger.error(`  Path: ${req.path}`);
        logger.error(`  Method: ${req.method}`);
        logger.error(`  Cookie token: ${req.cookies['psifl.x-csrf-token']?.substring(0, 20)}...`);
        logger.error(`  Header token: ${req.headers['csrf-token']?.substring(0, 20)}...`);
        return res.status(403).json({
            error: 'CSRF validation failed',
            message: 'Invalid or missing CSRF token'
        });
    }

    if (req.path.includes('/api/forologikes-klimakes')) {
        logger.info('✅ CSRF validation PASSED');
    }
    
    next();
});

app.get("/csrf-token", (req, res) => {
    try {
        const token = generateSimpleCsrfToken(req, res);
        return res.json({ csrfToken: token });
    } catch (err) {
        logger.error('CSRF token endpoint error:', err.message);
        return res.status(500).json({ csrfToken: '' });
    }
});

app.use(async (err, req, res, next) => {
    if (err && (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf') || err.message?.includes('CSRF') || err.message?.includes('invalid'))) {
        logger.warn("CSRF token απορρίφθηκε", {
            method: req.method,
            path: req.path,
            ip: req.ip,
            body_csrf: req.body._csrf?.substring(0, 20),
            header_csrf: req.headers['csrf-token']?.substring(0, 20),
            error: err.message || 'No error message',
        });
        
        if (req.flash) {
            await res.flash("error", "Η συνεδρία έληξε ή η φόρμα δεν είναι έγκυρη. Δοκιμάστε ξανά.");
        }
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({ 
                success: false, 
                error: 'CSRF token invalid',
                message: 'Η συνεδρία έληξε. Παρακαλώ ανανεώστε τη σελίδα.'
            });
        }
        
        const referrer = req.get("Referrer") || req.get("Referer") || "/login";
        const safeRedirect = referrer.startsWith('/') ? referrer : '/login';
        return res.redirect(safeRedirect);
    }
    next(err);
});

/* -------------------------------------------------------------------------- */
/*                              CSS & Version                                 */
/* -------------------------------------------------------------------------- */

const cssVersion = Date.now();
app.locals.cssVersion = cssVersion;

app.locals.css = (path) => {
    const cleanPath = path.replace(/\.css$/i, '').trim().replace(/\s+/g, '');
    
    if (node_env === 'production') {
        return `https://cdn.webpayrollsolutions.com/assets/own/css/${cleanPath}.min.css?v=${cssVersion}`;
    } else {
        return `/static/css/${cleanPath}.css?v=${cssVersion}`;
    }
};

try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    app.locals.appVersion = packageJson.version;
    logger.info(`✅ App Version: ${packageJson.version}`);
} catch (error) {
    logger.error('⚠️ Failed to read version from package.json:', error.message);
    app.locals.appVersion = '1.0.0';
}

app.locals.nodeEnv = process.env.NODE_ENV || 'development';
app.locals.isProduction = process.env.NODE_ENV === 'production';
app.locals.isDevelopment = process.env.NODE_ENV !== 'production';

logger.info(`✅ Environment: ${app.locals.nodeEnv}`);

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
        sessionEtos: req.session?.yearInUse || null,
        sessionMhnas: req.session?.periodInUse || null,
        sessionTeam: req.session?.userTeam || null,
        sessionCompanyInUse: req.session?.companyInUse || null,
    });
});

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */
app.use(
    "/login",
    isProd ? loginLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

app.use(
    "/reset_password",
    isProd ? resetPasswordLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

app.use('/api', apiRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/", usersRoute);
app.use('/api/admin', adminRoutes);
app.use('/', sessionRoutes);

/* -------------------------------------------------------------------------- */
/*                              Διαχείριση σφαλμάτων                          */
/* -------------------------------------------------------------------------- */

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

// ============================================================================
// ✅ TEXT CACHE SYSTEM INITIALIZATION
// ============================================================================
async function initializeTextCacheSystem() {
    try {
        logger.info('\n' + '='.repeat(70));
        logger.info('🚀 INITIALIZING TEXT CACHE SYSTEM');
        logger.info('='.repeat(70) + '\n');

        // STEP 1: Load Eidikes Kathgories από MongoDB
        logger.info('📚 STEP 1/2: Loading Eidikes Kathgories from MongoDB...\n');
        
        await textLoader.initializeConditionsMap();
        
        const categoryMap = textLoader.getCategoryCodeMap();
        const categoryCount = Object.keys(categoryMap).length;
        
        if (categoryCount === 0) {
            throw new Error('No valid categories loaded from MongoDB!');
        }
        
        logger.info(`\n✅ STEP 1/2 COMPLETE: ${categoryCount} categories loaded\n`);

        // STEP 2: Initialize Text Cache Manager
        logger.info('☁️  STEP 2/2: Syncing templates from S3 and loading to RAM...\n');
        
        await textCacheManager.initialize();
        
        const cacheStats = textCacheManager.getStats();
        
        if (cacheStats.totalFiles === 0) {
            logger.warn('⚠️  WARNING: No template files found in S3 cache!');
            logger.warn('⚠️  Make sure you have uploaded txt files to S3.');
        } else {
            logger.info(`\n✅ STEP 2/2 COMPLETE: ${cacheStats.totalFiles} templates loaded to RAM\n`);
        }

        logger.info('='.repeat(70));
        logger.info('✅ TEXT CACHE SYSTEM INITIALIZED SUCCESSFULLY');
        logger.info('='.repeat(70));
        logger.info(`📊 Categories: ${categoryCount}`);
        logger.info(`📊 Templates:  ${cacheStats.totalFiles}`);
        logger.info(`📊 Memory:     ${cacheStats.memory?.cacheSizeMB || 'N/A'} MB`);
        logger.info(`📊 Teams:      ${Object.keys(cacheStats.teams || {}).join(', ') || 'None'}`);
        logger.info('='.repeat(70) + '\n');

    } catch (error) {
        logger.error('\n' + '='.repeat(70));
        logger.error('❌ FATAL ERROR: Text Cache System initialization failed!');
        logger.error('='.repeat(70));
        logger.error('Error:', error.message);
        logger.error('Stack:', error.stack);
        logger.error('='.repeat(70) + '\n');
        
        logger.error('❌ Application cannot start without text cache system.');
        process.exit(1);
    }
}

/* -------------------------------------------------------------------------- */
/*                                 Εκκίνηση                                   */
/* -------------------------------------------------------------------------- */

async function startServer() {
    try {
        // Wait for MongoDB
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            logger.info('⏳ Waiting for MongoDB connection...');
            await new Promise((resolve) => {
                mongoose.connection.once('open', resolve);
            });
        }

        // ✅ Initialize Text Cache System
        await initializeTextCacheSystem();

        // Start server
        app.listen(port, "0.0.0.0", () => {
            logger.info('\n' + '='.repeat(70));
            logger.info(`🚀 SERVER STARTED SUCCESSFULLY`);
            logger.info('='.repeat(70));
            logger.info(`📍 URL: http://${host}:${port}`);
            logger.info(`🌍 Environment: ${node_env}`);
            logger.info('='.repeat(70) + '\n');
        });

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================
async function gracefulShutdown(signal) {
    logger.info(`\n⚠️  Received ${signal}, starting graceful shutdown...`);

    try {
        textCacheManager.stopAutoRefresh();
        logger.info('✅ Text cache auto-refresh stopped');

        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('✅ MongoDB connection closed');

        logger.info('✅ Graceful shutdown complete');
        process.exit(0);

    } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// Start Application
// ============================================================================
startServer();