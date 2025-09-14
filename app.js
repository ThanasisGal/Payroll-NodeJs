// @ts-nocheck
/**
 * Express app με Helmet + CSP + Sessions + CSRF (csurf) + EJS + routes.
 * Σχεδιασμένο να δουλεύει καθαρά σε DEV & PROD με μέγιστη δυνατή ασφάλεια.
 */

const dotenv = require("dotenv");
dotenv.config();

const node_env = process.env.NODE_ENV || "development";
// const isProd = node_env === "production"   // Βρίσκεται στο sessionOpts.js;

const express = require("express");
const { urlencoded, json } = require("express");
const path = require("path");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { sessionOpts, isProd } = require('./config/sessionOpts');
const flash = require("express-flash-message").default;
const helmet = require("helmet");
const csurf = require("csurf");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const connectDB = require("./server/config/db");
const geoGuard = require("./server/middlewares/geoGuard");
const usersRoute = require("./server/routes/usersRoute");
const dropdownRoutes = require("./server/routes/dropdownRoutes");
const getSessionVars = require("./server/middlewares/session-variables");
const logger = require("./server/utils/logger");

const app = express();
app.disable("x-powered-by"); // μικρό hardening

const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 5000);
const diarkeia_session = Number(process.env.DIARKEIA_SESSION || 30); // λεπτά
const secret = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;

logger.info(`NODE_ENV at startup = ${node_env}`);
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
    message: "Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά αργότερα."
});

/* -------------------------------------------------------------------------- */
/*                                Database init                                */
/* -------------------------------------------------------------------------- */
connectDB();

/* -------------------------------------------------------------------------- */
/*                            Core middlewares order                           */
/* -------------------------------------------------------------------------- */

// Body parsers ΠΡΙΝ από CSRF
app.use(urlencoded({ extended: true }));
app.use(json());

// Method override για φόρμες που θέλουν PUT/DELETE
app.use(methodOverride("_method"));

// Cookies ΠΡΙΝ από session/CSRF
app.use(cookieParser());

// Static assets
app.use("/static", express.static(path.join(__dirname, "public")));

// Global locals
app.locals.NODE_ENV = node_env;

/* -------------------------------------------------------------------------- */
/*                                Session setup                               */
/* -------------------------------------------------------------------------- */
if (!mongoUrl) {
    logger.error("MONGODB_URL is not set. Using MemoryStore (dev only).");
}

app.use(session(sessionOpts));
logger.info(`Sessions: ${mongoUrl ? "MongoStore" : "MemoryStore"} enabled (ttl=${diarkeia_session}m, secure=${isProd})`
);

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
        const isLogout = req.path.startsWith('/logout');   // ✅ ΠΡΟΣΘΗΚΗ

        if (!isAsset && !isCountdown && !isLogout) {
            if (!req.session.lastActivity) req.session.lastActivity = now;
                const elapsed = now - req.session.lastActivity;
                const remaining = 1000 * 60 * diarkeia_session - elapsed;

            if (remaining <= 0) return res.redirect(303, "/logout/end_Session");
                res.locals.remainingTime = remaining;
                req.session.lastActivity = now; // τροποποίηση => σώζει session
        }
    } else {
        res.locals.remainingTime = 0;
    }
    next();
});

/* -------------------------------------------------------------------------- */
/*                              Security headers                               */
/* -------------------------------------------------------------------------- */

// Helmet “βασικά” headers
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

// Content-Security-Policy
app.use(
    helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: {
            "default-src": ["'self'"],
            // Όλα τα scripts πρέπει να έχουν nonce. Το 'strict-dynamic' επιτρέπει δυναμικά imports όταν υπάρχει nonce.
            "script-src": [
                "'self'",
                (req, res) => `'nonce-${res.locals.nonce}'`,
                "'strict-dynamic'",
                "https://cdn.webpayrollsolutions.com"
            ],
            // Styles: επιτρέπουμε inline ATTRS (class style attrs) και <style> (όσο χρειάζεται για βιβλιοθήκες)
            "style-src-elem": [
                "'self'",
                "https://fonts.googleapis.com",
                "https://cdn.webpayrollsolutions.com",
                "'unsafe-inline'"
            ],
            "style-src-attr": ["'unsafe-inline'"],
            "style-src": [
                "'self'",
                "https://fonts.googleapis.com",
                "https://cdn.webpayrollsolutions.com"
            ],
            "font-src": [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdn.webpayrollsolutions.com",
                "data:"
            ],
            "img-src": ["'self'", "https://cdn.webpayrollsolutions.com", "data:", "blob:"],
            "connect-src": [
                "'self'",
                "https://cdn.webpayrollsolutions.com",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com"
                // πρόσθεσε εδώ άλλα API origins αν χρειαστεί
            ],
            "worker-src": ["'self'", "blob:"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"], // επιτρέπουμε POST μόνο προς τον ίδιο origin
            "frame-src": ["'self'"],
            "frame-ancestors": ["'none'"],
            "upgrade-insecure-requests": []
        }
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

// Ενεργοποίηση CSRF ΠΡΙΝ από τα routes
app.use(csrfProtection);

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
        console.error("CSRF REJECT (csurf)", {
            cookie: req.cookies && req.cookies["_csrf"], // cookie όνομα στο csurf
            bodyToken: req.body && req.body._csrf,
            method: req.method,
            path: req.path,
        });
        if (req.flash) {
            await res.flash("error", "Η συνεδρία έληξε ή η φόρμα δεν είναι έγκυρη. Δοκιμάστε ξανά.");
        }
        return res.redirect("back");
    }
    next(err);
});

/* -------------------------------------------------------------------------- */
/*                             Views / layouts (EJS)                           */
/* -------------------------------------------------------------------------- */
app.set("view engine", "ejs");
app.use(expressLayout);
app.set("layout", "./layouts/main");

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
// Guards στο /login — ενεργά μόνο σε prod (σε dev no-op)
app.use(
    "/login",
    isProd ? loginLimiter : (req, res, next) => next(),
    isProd ? geoGuard : (req, res, next) => next()
);

app.use("/reset_password", isProd ? loginLimiter : (req,res,next)=>next(), isProd ? geoGuard : (req,res,next)=>next());

app.use("/api/dropdown", dropdownRoutes);
app.use("/", usersRoute);

// Countdown endpoint (για client-side εμφανιση)
app.get("/remaining-time", (req, res) => {
    const now = Date.now();
    const last = req.session?.lastActivity ?? now;
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
        bodyClass: "bg-404 custom-background",
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

