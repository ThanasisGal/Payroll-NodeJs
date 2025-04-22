import dotenv from "dotenv";
dotenv.config();

import express, { urlencoded, json } from "express";
import expressLayout from "express-ejs-layouts";
import methodOverride from "method-override";
import flash from "connect-flash";
import session from "express-session";
import connectDB from "./server/config/db.js";
import usersRoute from "./server/routes/usersRoute.js";
import getSessionVars from "./server/middlewares/session-variables.js";

import { createDropdownApi } from './server/utils/dropdownHelper.js';

import models from './server/models/stathera_arxeia.js';
const { TmhmataModel,
        EidikothtesErganhModel 
      } = models;

const app = express();

const host = process.env.HOST || "localhost";
const port = process.env.PORT || 80;
const diarkeia_session = process.env.DIARKEIA_SESSION || 30;

connectDB();

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(methodOverride("_method"));

// Static files
app.use(express.static("public"));

// Express Session
const secret = process.env.SECRET;
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

// Flash Messages
app.use(flash({ sessionKeyName: "flashMessage" }));

app.use(getSessionVars);

// Middleware για διαχείριση συνεδρίας
app.use((req, res, next) => {
  if (req.session) {
    const now = Date.now();

    // Εξαίρεση αιτήσεων στο /remaining-time
    if (req.path !== "/remaining-time") {
      // Αρχικοποίηση lastActivity αν δεν υπάρχει
      if (!req.session.lastActivity) {
        req.session.lastActivity = now;
      }

      // Υπολογισμός χρόνου που απομένει
      const elapsed = now - req.session.lastActivity;
      const remainingTime = 1000 * 60 * diarkeia_session - elapsed;

      // Αν έχει λήξει ο χρόνος συνεδρίας
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
        // Ενημέρωση του χρόνου που απομένει
        res.locals.remainingTime = remainingTime;
        req.session.lastActivity = now;
      }
    }
  } else {
    res.locals.remainingTime = 0;
  }
  next();
});

// Template engine
app.use(expressLayout);
app.set("layout", "./layouts/main");
app.set("view engine", "ejs");

// Routes
app.get('/api/ektyposeis/apasxolhseis/tmhmata', createDropdownApi(EidikothtesErganhModel));
app.use("/", usersRoute);

// Route για υπολειπόμενο χρόνο συνεδρίας (AJAX)
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

// Handle 404 Error
app.get("*", (req, res) => {
  res.status(404).render("404");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`App listening on port: ${port}`);
});
