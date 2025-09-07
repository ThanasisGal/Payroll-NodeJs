// @ts-nocheck
const dotenv = require("dotenv");
dotenv.config();

const node_env = process.env.NODE_ENV;
const isProd = node_env === "production";

const express = require("express");
const { urlencoded, json } = require("express");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("express-flash-message").default;

const connectDB = require("./server/config/db");
const usersRoute = require("./server/routes/usersRoute");
const dropdownRoutes = require("./server/routes/dropdownRoutes");
const getSessionVars = require("./server/middlewares/session-variables");
const logger = require("./server/utils/logger");

const path = require("path");

const app = express();

const host = process.env.HOST || "localhost";
const port = process.env.PORT || 80;
const diarkeia_session = Number(process.env.DIARKEIA_SESSION || 30); // λεπτά
const secret = process.env.SECRET || "default-secret";
const mongoUrl = process.env.MONGODB_URL;

logger.info(`NODE_ENV at startup = ${node_env}`);

// Αν πίσω από reverse proxy/HTTPS (Nginx/ALB/Cloudflare), χρειάζεται για secure cookies
if (isProd) {
  app.set("trust proxy", 1);
}

// 📦 Σύνδεση DB (app data)
connectDB();

// 📥 Body parsers & helpers
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(methodOverride("_method"));

// 🗂 Static αρχεία
app.use("/static", express.static(path.join(__dirname, "public")));

// Διαθέσιμο στο EJS
app.locals.NODE_ENV = process.env.NODE_ENV;

// 🔐 Sessions με MongoStore (τέλος το MemoryStore warning)
if (!mongoUrl) {
  logger.error("MONGODB_URL is not set. Sessions store cannot initialize.");
}
app.use(
  session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * diarkeia_session, // ms
      httpOnly: true,
      secure: isProd, // σε production μόνο μέσω HTTPS
      sameSite: "lax", // "strict" αν δεν έχεις cross-site ροές
    },
    store: MongoStore.create({
      mongoUrl,
      ttl: 60 * diarkeia_session, // sec στον Mongo
      autoRemove: "native",
      // touchAfter: 24 * 3600, // προαιρετικό: μειώνει writes
    }),
  })
);

logger.info(
  `Sessions: MongoStore enabled (ttl=${diarkeia_session}m, secure=${isProd})`
);

// ✉ Flash Messages (express-flash-message, αντικατάσταση connect-flash)
app.use(
  flash({
    sessionKeyName: "flashMessage", // ίδιο key για συμβατότητα
  })
);

// 🌡 Custom session variables στο res.locals
app.use(getSessionVars);

// ⏳ Session Timeout (activity-based)
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
            logger.error("Error destroying session:", err);
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

// 🧪 API: στοιχεία session προς client
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
    const elapsed = now - (req.session.lastActivity || now);
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
  logger.info(`🚀 App listening at http://${host}:${port}`);
});
