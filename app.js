// @ts-nocheck
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const { urlencoded, json } = require("express");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const session = require("express-session");
const connectDB = require("./server/config/db");
const usersRoute = require("./server/routes/usersRoute");
const dropdownRoutes = require("./server/routes/dropdownRoutes");
const getSessionVars = require("./server/middlewares/session-variables");

const path = require("path");

const app = express();

const host = process.env.HOST || "localhost";
const port = process.env.PORT || 80;
const diarkeia_session = process.env.DIARKEIA_SESSION || 30;
const secret = process.env.SECRET || "default-secret";

// 📦 Σύνδεση DB
connectDB();

// 📥 Middleware για φόρμες
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(methodOverride("_method"));

// 🗂 Static αρχεία
app.use("/static", express.static(path.join(__dirname, "public")));

app.locals.NODE_ENV = process.env.NODE_ENV;

// 🔐 Express Session
app.use(
    session({
        secret: secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * diarkeia_session,
        },
    })
);

// ✉ Flash Messages & Custom Variables
app.use(flash({ sessionKeyName: "flashMessage" }));
app.use(getSessionVars);

// ⏳ Session Timeout Middleware
app.use((req, res, next) => {
    if (req.session) {
        const now = Date.now();

        if (req.path !== "/remaining-time") {
            if (!req.session.lastActivity) {
                req.session.lastActivity = now;
            }

            const elapsed = now - req.session.lastActivity;
            const remainingTime = 1000 * 60 * diarkeia_session - elapsed;

            if (remainingTime <= 0) {
                req.session.destroy(err => {
                    if (err) {
                        console.error("Error destroying session:", err);
                        return next(err);
                    }
                    return res.redirect("/logout/end_Session");
                });
                return;
            } else {
                res.locals.remainingTime = remainingTime;
                req.session.lastActivity = now;
            }
        }
    } else {
        res.locals.remainingTime = 0;
    }
    next();
});

// 🧪 API για προβολή session από client
app.get("/api/session-data", (req, res) => {
    const sessionData = {
        sessionEtos: req.session.yearInUse || null,
        sessionMhnas: req.session.periodInUse || null,
        sessionTeam: req.session.userTeam || null,
        sessionCompanyInUse: req.session.companyInUse || null,
    };
    res.json(sessionData);
});

// 🧱 Template Engine (EJS)
app.use(expressLayout);
app.set("layout", "./layouts/main");
app.set("view engine", "ejs");

// 🌐 Routes
app.use("/api/dropdown", dropdownRoutes);
app.use("/", usersRoute);

// ⏱ Υπολειπόμενος χρόνος συνεδρίας (AJAX polling)
app.get("/remaining-time", (req, res) => {
    if (req.session) {
        const now = Date.now();
        const elapsed = now - req.session.lastActivity;
        const remainingTime = 1000 * 60 * diarkeia_session - elapsed;
        res.json({ remainingTime: remainingTime > 0 ? remainingTime : 0 });
    } else {
        res.json({ remainingTime: 0 });
    }
});

// ❌ 404 Handler
app.get("*", (req, res) => {
    res.status(404).render("404");
});

// 🚀 Εκκίνηση Server
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 App listening at http://${host}:${port}`);
});
