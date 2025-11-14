const logger = require("../../server/utils/logger");
const { sessionOpts } = require('../../config/sessionOpts');

const UserModel = require("../models/userModel");
const VerifyModel = require("../models/verifications");
const Models = require("../models/stathera_arxeia");
const Models_A = require("../models/param");
const Models_B = require("../models/privileges");
const Models_C = require("../models/companies");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtDecode = require("jwt-decode").jwtDecode;
const transporter = require("../../config/emailConfig");

const { PeriodsModel } = Models;
const { ParamModel } = Models_A;
const { UserPrivilegesModel, SidebarStatusModel } = Models_B;
const { CompaniesModel } = Models_C;

const APP_ORIGIN = process.env.NODE_ENV === "production" ? process.env.APP_ORIGIN_PRODUCTION : process.env.APP_ORIGIN_DEVELOPMENT;

// Defaults για το session
const now = new Date();
const day = String(now.getDate()).padStart(2, "0");
const month = String(now.getMonth() + 1).padStart(2, "0");
const year = now.getFullYear();

const monthNames = [ "ΙΑΝΟΥΑΡΙΟΣ", "ΦΕΒΡΟΥΑΡΙΟΣ", "ΜΑΡΤΙΟΣ", "ΑΠΡΙΛΙΟΣ", "ΜΑΙΟΣ", "ΙΟΥΝΙΟΣ", "ΙΟΥΛΙΟΣ", "ΑΥΓΟΥΣΤΟΣ", "ΣΕΠΤΕΜΒΡΙΟΣ", "ΟΚΤΩΒΡΙΟΣ", "ΝΟΕΜΒΡΙΟΣ", "ΔΕΚΕΜΒΡΙΟΣ", ];

const isProd = process.env.NODE_ENV === 'production';

let sTerm = "";
var redir, tmpEmail;

// Helper: συγχρονίζει συλλογή με βάση πρότυπο
async function syncFromTemplate({
  Model,
  userIdStr,         // π.χ. String(user._id)
  templateId,        // π.χ. process.env.PROTYPO_ID
  uniqueKey,         // π.χ. 'form' για UserPrivileges, 'li_Id' για SidebarStatus
  projection = { _id: 0, userId: 0 }, // να μη φέρνουμε _id/userId από το πρότυπο
}) {
  if (!templateId) return;

  // Φέρε υπάρχουσες του χρήστη & τις πρότυπες σε μία «βολή»
  const [existing, template] = await Promise.all([
    Model.find({ userId: userIdStr }, projection).lean(),
    Model.find({ userId: templateId }, projection).lean(),
  ]);

  if (!template?.length) return; // δεν υπάρχουν καθόλου πρότυπα, άρα skip

  // Αν ο χρήστης δεν έχει τίποτα -> κλωνοποίησε τα πάντα
  if (!existing.length) {
    const clones = template.map(doc => ({ ...doc, userId: userIdStr }));
    if (clones.length) await Model.insertMany(clones, { ordered: false });
    return;
  }

  // Αλλιώς, βρες ποια λείπουν με βάση το μοναδικό κλειδί (uniqueKey)
  const have = new Set(existing.map(d => String(d[uniqueKey])));
  const missing = template
    .filter(t => !have.has(String(t[uniqueKey])))
    .map(doc => ({ ...doc, userId: userIdStr }));

  if (missing.length) {
    await Model.insertMany(missing, { ordered: false });
  }
}

class userController {

    static homepage = async (req, res) => {
        const locals = {
            title: "Payroll",
            description: "Web Payroll System",
        };
        try {
            res.render("home", { locals });
        } catch (error) {
            res.redirect("/");
        }
    };

    static adminHomepage = async (req, res) => {
        const locals = {
            title: "Admin Διαχείριση Χρηστών",
            description: "Web Payroll System by Admin",
        };

        const perPage = Number(process.env.EGGRAFES);
        let page = req.query.page || 1;

        try {
            const totalRecords = await UserModel.countDocuments({});
            let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
            let limPerPage = perPage > totalRecords ? totalRecords : perPage;

            let limitPerPage = limPerPage <= 0 ? 1 : limPerPage;
            let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

            const users = await UserModel.aggregate([{ $sort: { createdAt: -1 } }])
                .skip(skipRecords)
                .limit(limitPerPage)
                .exec();

            res.render("index", {
                locals,
                users,
                current: page,
                pages: totalPages,
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static addUser = (req, res) => {
        const locals = {
            title: "Προσθήκη Νέου Χρήστη",
            description: "Web Payroll System by Admin",
        };
        res.render("users/add", locals);
    };

    static postUser = async (req, res) => {
        let aa_kod = 1;
        try {
            const lastRecord = await UserModel.findOne({}, { kod: 1 }).sort({ kod: -1 }).lean();
            if (lastRecord && lastRecord.kod) {
                aa_kod = Number(lastRecord.kod) + 1;
            }
        } catch (error) {
            console.error("Error getting last kod:", error);
            aa_kod = 1;
        }

        const isAdmin = req.body.radioRoles === "A" ? true : false;

        const newUser = UserModel({
            kod: aa_kod,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: req.body.password,
            tel: req.body.tel,
            team: req.body.team,
            privileges: req.body.radioRoles,
            situation: req.body.radioStatus,
            details: req.body.details,
            isVerified: false,
            isAdmin: isAdmin,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        try {
            await UserModel.create(newUser);
            await res.flash('success', "Έχει προστεθεί νέος χρήστης");
            redir = "index";

            await res.render(redir);
        } catch (error) {
            throw error;
        }
    };

    static viewUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            const locals = {
                title: "Προβολή Στοιχείων Χρήστη",
                description: "Web Payroll System by Admin",
            };

            res.render("users/view", {
                locals,
                users,
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static editUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            const locals = {
                title: "Διόρθωση Στοιχείων Χρήστη",
                description: "Web Payroll System by Admin",
            };

            res.render("users/edit", {
                locals,
                users,
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static editPostUser = async (req, res) => {
        try {
            await UserModel.findByIdAndUpdate(req.params.id, {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                password: req.body.password,
                tel: req.body.tel,
                team: req.body.team,
                privileges: req.body.radioRoles,
                situation: req.body.radioStatus,
                details: req.body.details,
                updatedAt: Date.now(),
            });
            await res.flash("info", "Επιτυχής Ενημέρωση");
            await res.redirect(`/admin`);
        } catch (error) {
            logger.error(error);
        }
    };

    static deletePostUser = async (req, res) => {
        try {
            await res.flash("info", "Επιτυχής Διαγραφή");
            await UserModel.deleteOne({ _id: req.params.id });
            res.redirect("/admin");
        } catch (error) {
            logger.error(error);
        }
    };

    static checkAndDeletePostUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            const locals = {
                title: "Διαγραφή Χρήστη",
                description: "Web Payroll System by Admin",
            };

            res.render("users/delete", {
                locals,
                users,
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static searchPostUser = async (req, res) => {
        const locals = {
            title: "Αναζήτηση",
            description: "Web Payroll System",
        };

        try {
            let searchTerm = req.body.searchTerm;
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, "");
            sTerm = searchNoSpecialChar;
            const perPage = Number(process.env.EGGRAFES);
            const page = req.query.page || 1;

            const users = await UserModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { firstName: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { lastName: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { email: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { tel: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { team: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                ],
            });

            const totalRecords = users.length;
            let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
            let limitPerPage = perPage > totalRecords ? totalRecords : perPage;
            let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

            const user = await UserModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { firstName: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { lastName: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { email: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { tel: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                    { team: { $regex: new RegExp(searchNoSpecialChar, "i") } },
                ],
            })
                .skip(skipRecords)
                .limit(limitPerPage);

            res.render("search", {
                user,
                locals,
                current: page,
                pages: totalPages,
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static searchGetUser = async (req, res) => {
        const locals = {
            title: "Αναζήτηση",
            description: "Web Payroll System",
        };

        try {
        let searchTerm = sTerm;
        const perPage = Number(process.env.EGGRAFES);
        const page = req.query.page || 1;

        const users = await UserModel.find({
            $or: [
                { firstName: { $regex: new RegExp(searchTerm, "i") } },
                { lastName: { $regex: new RegExp(searchTerm, "i") } },
                { email: { $regex: new RegExp(searchTerm, "i") } },
                { tel: { $regex: new RegExp(searchTerm, "i") } },
                { team: { $regex: new RegExp(searchTerm, "i") } },
            ],
        });

        const totalRecords = users.length;
        let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
        let limitPerPage = perPage > totalRecords ? totalRecords : perPage;
        let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

        const user = await UserModel.find({
            $or: [
                { firstName: { $regex: new RegExp(searchTerm, "i") } },
                { lastName: { $regex: new RegExp(searchTerm, "i") } },
                { email: { $regex: new RegExp(searchTerm, "i") } },
                { tel: { $regex: new RegExp(searchTerm, "i") } },
                { team: { $regex: new RegExp(searchTerm, "i") } },
            ],
        })
            .skip(skipRecords)
            .limit(limitPerPage);

        res.render("search", {
            user,
            locals,
            current: page,
            pages: totalPages,
        });
        } catch (error) {
            logger.error(error);
        }
    };

static verifyEmailForm = async (req, res) => {
  const locals = { title: "Verify Email", description: "Web Payroll System" };
  try {
    res.render("login/verify_email", {
      locals,
      bodyClass: "home-bg-cdn",
    });
  } catch (error) {
    res.redirect("/login");
  }
};

// ΑΠΑΡΑΙΤΗΤΑ imports στην κορυφή του αρχείου controller:
// const jwt = require("jsonwebtoken");
// const VerifyModel = require("../models/VerifyModel");  // προσαρμόσε το path
// const transporter = require("../utils/mailer");         // προσαρμόσε το path
// const APP_ORIGIN = process.env.APP_ORIGIN;

static sendUserVerifyEmail = async (req, res) => {
  // 1) Βασικός καθαρισμός/έλεγχος εισόδου
  const email = String(req.body?.email || "").trim().toLowerCase();
  const secret = process.env.JWT_SECRET_KEY;
  const base = process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;

  if (!email) {
    if (res.flash) await res.flash("error", "Συμπλήρωσε e-mail.");
    return res.redirect("back");
  }
  if (!secret) {
    console.error("JWT_SECRET_KEY is missing");
    if (res.flash) await res.flash("error", "Πρόβλημα ρύθμισης. Επικοινωνήστε με τον διαχειριστή.");
    return res.redirect("back");
  }

  try {
    const now = new Date();

    // 2) ΑΤΟΜΙΚΟ UPSERT για να αποφύγουμε race conditions & E11000
    const doc = await VerifyModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: { email, verify: false, createdAt: now },
        $set: { updatedAt: now },
      },
      { new: true, upsert: true }
    );

    // 3) Δημιουργία token (λήξη 5')
    const token = jwt.sign({ userID: doc._id }, secret, { expiresIn: "5m" });

    // (προαιρετικό) Αποθήκευση token για audit/έλεγχο
    await VerifyModel.updateOne(
      { _id: doc._id },
      { $set: { token, updatedAt: new Date() } }
    );

    // 4) Φτιάχνουμε link επαλήθευσης
    const s3 = Buffer.from(email, "utf8").toString("hex");
    const link = `${base}/verify-Email/?s1=${doc._id}&s2=${token}&s3=${s3}`;

    // 5) Αποστολή email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Επαλήθευση email - Web Payroll Solutions",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
          <h2>Καλώς ήρθατε στο Web Payroll Solutions</h2>
          <p>Γεια σας,</p>
          <p>Ευχαριστούμε που εγγραφήκατε στην εφαρμογή <strong>Web Payroll Solutions</strong>.</p>
          <p>Για να ολοκληρώσετε τη διαδικασία, επαληθεύστε το email σας (διάρκεια 5').</p>
          <p style="margin:20px 0;">
            <a href="${link}" style="background:#28a745; color:#fff; padding:10px 15px; border-radius:5px; text-decoration:none;">
              Επαλήθευση Email
            </a>
          </p>
          <p>Αν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το μήνυμα.</p>
          <hr style="margin:20px 0;">
          <p style="font-size:14px; color:#555;">
            Για υποστήριξη, επικοινωνήστε με την ομάδα μας μέσω email.
          </p>
        </div>
      `,
    });

    if (res.flash) {
      await res.flash(
        "info",
        "Στάλθηκε email επαλήθευσης (ισχύει 5'). Ελέγξτε τα εισερχόμενα/ανεπιθύμητα."
      );
    }
    // 6) PRG: redirect για να εμφανιστεί το flash και να μην ξαναγίνει POST με refresh
    return res.redirect("/login/verify-email");

  } catch (err) {
    // Αν παρ' όλα αυτά προκύψει E11000 (σπάνιο με upsert), χειρίσου το ως "υπάρχον"
    if (err && err.code === 11000) {
      try {
        const existing = await VerifyModel.findOne({ email });
        if (existing) {
          const token = jwt.sign({ userID: existing._id }, secret, { expiresIn: "5m" });
          await VerifyModel.updateOne(
            { _id: existing._id },
            { $set: { token, updatedAt: new Date() } }
          );
          const s3 = Buffer.from(email, "utf8").toString("hex");
          const link = `${base}/verify-Email/?s1=${existing._id}&s2=${token}&s3=${s3}`;

          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: "Επαλήθευση email - Web Payroll Solutions",
            html: `
              <p>Το email υπάρχει ήδη. Σας στείλαμε νέο link επαλήθευσης (ισχύει 5').</p>
              <p><a href="${link}">Επαλήθευση Email</a></p>
            `,
          });

          if (res.flash) await res.flash("info", "Το e-mail υπάρχει ήδη — στείλαμε νέο link επαλήθευσης (5').");
          return res.redirect("/login/verify-email");
        }
      } catch (e2) {
        console.error("dup-recover failed:", e2);
      }
    }

    console.error("sendUserVerifyEmail ERROR:", err);
    if (res.flash) await res.flash("error", "Κάτι πήγε στραβά. Δοκιμάστε ξανά.");
    return res.redirect("back");
  }
};

    static emailVerification = async (req, res, next) => {
        const paramsEmail = req.query.s3.toString("utf8");
        const link = req.query.s2;

        const decoded = jwtDecode(link);
        var dateNow = new Date();
        var isExpiredToken = decoded.exp < dateNow.getTime() / 1000 ? true : false;

        if (isExpiredToken) {
            const checkSendLink = await VerifyModel.findById(req.query.s1);
            if (checkSendLink) {
                await VerifyModel.deleteOne({ _id: req.query.s1 });
                await res.flash("error", "Έχει λήξει η περίοδος που μπορούσατε να χρησιμοποιήσετε το link επιβεβαίωσης Email. Προσπαθείστε ξανά...");
                redir = "login/login";
            } else {
                await res.flash("error", "Ανύπαρκτο ή λανθασμένο link");
                redir = "home";
            }
        } else {
            const checkSendLink = await VerifyModel.findById(req.query.s1);
            if (checkSendLink) {
                if (checkSendLink.verify === true) {
                    await res.flash("info", "Έχετε ήδη επαληθεύσει το Email σας. Συνδεθείτε...");
                    redir = "login/login";
                } else {
                    await VerifyModel.findByIdAndUpdate(checkSendLink._id, {
                        $set: { verify: true },
                    });
                    tmpEmail = checkSendLink.email;
                    await res.flash("success", "Επιτυχής επαλήθευση του email σας. Προχωρείστε στην καταχώρηση του χρήστη...");
                    redir = "login/register";
                }
            } else {
                await res.flash("error", "Ανύπαρκτο ή λανθασμένο link");
                redir = "/home";
            }
        }

        if (redir == "login/register") {
            await res.redirect("/register/?mail=" + req.query.s3);
        } else {
            await res.render(redir);
        }
    };

    static loginForm = async (req, res) => {
        const locals = {
            title: "Login",
            description: "Web Payroll System",
            
        };

        try {
            res.render("login/login", { locals, bodyClass: "home-bg-cdn" });
        } catch (error) {
            res.redirect("/");
        }
    };

    static getUserRoles = async (req, res) => {
        if (!req.session?.userId) {
            return res.status(401).json({ permissions: {} });
        }

        const user_Id = req.session.userId;
        const userPermission = req.session.userRole;
        const permissions = await userController.fetchPermissions(user_Id, userPermission);

        res.json({ permissions }); // Επιστροφή δεδομένων στο frontend
    };

    static async fetchPermissions(user_Id, userPermission) {
        try {
            const lis = await SidebarStatusModel
                .find(
                    { userId: user_Id },
                    { li_Id: 1, situation_A: 1, situation_C: 1, situation_U: 1, situation_V: 1 }
                )
                .sort({ li_Id: 1 })
                .lean();

            const isValidRole = ["A","C","U","V"].includes(userPermission);
            if (!Array.isArray(lis)) lis = [];

            if (!isValidRole) {
                return {}; // ή return null, ανάλογα με το πώς το περιμένει ο caller
            }

            const permissions = Object.fromEntries(
                lis.map(li => [li.li_Id, Boolean(li[`situation_${userPermission}`])])
            );
           
            return permissions;
        } catch (err) {
            logger.error(err);
            return {}; 
        }
    };

    static userLogin = async (req, res) => {
        let redir = "login/login";

        try {
            const { email, password } = req.body || {};
            if (!email || !password) {
                await res.flash("info", "Όλα τα πεδία είναι υποχρεωτικά...");
                return res.render("login/login", { bodyClass: "home-bg-cdn" });
            }

            const user = await UserModel.findOne({ email: String(email).trim().toLowerCase() });
            if (!user) {
                await res.flash("warning", "Δεν είστε εγγεγραμμένος χρήστης. Εγγραφείτε για να συνεχίσετε...");
                return res.render("login/login", { bodyClass: "home-bg-cdn" });
            }

            if (!user.isVerified) {
                await res.flash("error", "Δεν έχετε κάνει επαλήθευση του Email σας. Επαληθεύστε το email και συνεχίστε...");
                return res.render("login/login", { bodyClass: "home-bg-cdn" });
            }

            if (user.situation === "I") {
                await res.flash("error", "Είστε απενεργοποιημένος χρήστης. Επικοινωνήστε με τον διαχειριστή...");
                return res.render("login/login", { bodyClass: "home-bg-cdn" });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!(user.email === String(email).trim().toLowerCase() && isMatch)) {
                await res.flash("error", "Το email ή ο κωδικός πρόσβασης δεν είναι έγκυρα...");
                return res.render("login/login", { bodyClass: "home-bg-cdn" });
            }

            // JWT (αν το χρειάζομαι, να βάλω cookie)
            const token = jwt.sign({ userID: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "10m" });

            req.session.userId = user._id; // ObjectId στον session
            req.session.userName = user.firstName;
            req.session.userTeam = user.team;
            req.session.userRole = user.privileges;
            req.session.userStatus = user.situation;
            req.session.companyInUse = "";
            req.session.companyDescription = "";
            req.session.yearInUse = String(year);
            req.session.periodInUse = month;
            req.session.periodInUseDescr = monthNames[now.getMonth()];
            req.session.appDate = `${day}/${month}/${year}`;
            req.session.currentTyposApodoxon = "001";
            req.session.energoi = true;
            req.session.ypokatasthma = "";

            // Συγχρονισμός από πρότυπο (PROTYPO_ID)
            const templateUserId = process.env.PROTYPO_ID;
            const userIdStr = String(user._id); // ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: τα άλλα models έχουν userId: String

            await syncFromTemplate({
                Model: UserPrivilegesModel,
                userIdStr,
                templateId: templateUserId,
                uniqueKey: "form",
                projection: { _id: 0, userId: 0, createdAt: 0, updatedAt: 0 },
            });

            await syncFromTemplate({
                Model: SidebarStatusModel,
                userIdStr,
                templateId: templateUserId,
                uniqueKey: "li_Id",
                projection: { _id: 0, userId: 0 },
            });

            // Διαβάζει από ParamModel και ενημερώνει το session
            const parameter = await ParamModel.findOne({ usrId: req.session.userId });
            if (parameter) {
                if (parameter.usedYear) req.session.yearInUse = parameter.usedYear;
                if (parameter.usedPeriod) req.session.periodInUse = parameter.usedPeriod;
                if (parameter.usedPeriodDescr) req.session.periodInUseDescr = parameter.usedPeriodDescr;
                if (parameter.appDate) req.session.appDate = parameter.appDate;

                if (parameter.companyId && parameter.companyId.length > 0) {
                    const companies = await CompaniesModel.findById(parameter.companyId);
                    if (companies) {
                    req.session.companyInUse = parameter.companyId;
                    req.session.companyDescription = `${companies.eponymia} ${companies.firstname}`.trim();
                    }
                    redir = "/mainapp";
                } else {
                    redir = "/companies/genikastoixeia";
                }

                if (parameter.usedPeriod && parameter.usedYear) {
                    const periodoi = await PeriodsModel.findOne({
                    xrhsh: parameter.usedYear,
                    kodikos: parameter.usedPeriod,
                    });
                    if (periodoi) req.session.periodInUseDescr = periodoi.perigrafh;
                }
            } else {
                redir = "/companies/genikastoixeia";
            }

        } catch (error) {
            console.error(error);
            await res.flash("error", "Αδυναμία Σύνδεσης. Επικοινωνήστε με τον Διαχειριστή");
            redir = "login/login";
        }

        if (redir === "/mainapp") {
            return res.redirect("/mainapp");
        } else if (redir === "/companies/genikastoixeia") {
            return res.redirect("/companies/genikastoixeia");
        } else {
            return res.render(redir, { bodyClass: "home-bg-cdn" });
        }        
    };

    static registerForm = async (req, res) => {
        const locals = {
            title: "Register",
            description: "Web Payroll System",
        };

        try {
            res.render("login/register", { locals });
        } catch (error) {
            res.redirect("/login");
        }
    };

    static userRegistration = async (req, res) => {
        let aa_kod = 0;
        let redir = "login/login";

        try {
            const lastUser = await UserModel.findOne({}, { kod: 1 }).sort({ kod: -1 }).lean();
            aa_kod = lastUser?.kod ? Number(lastUser.kod) + 1 : 1;
        } catch (err) {
            aa_kod = 1;
        }

        const {
            firstName,
            lastName,
            email,
            tel,
            team,
            password,
            password_confirmation,
            privileges, // αρχικό, θα το προσαρμόσουμε μετά
            situation,
            details,
            isVerified,
            isAdmin,
        } = req.body;

        try {
            const existing = await UserModel.findOne({ email: email });
            if (existing) {
                await res.flash("error", "Το Email είναι ήδη καταχωρημένο.");
                return res.render("login/login");
            }

            // Validations
            if (!(firstName && lastName && email && team && password && password_confirmation)) {
                await res.flash("warning", "Δεν συμπληρώσατε όλα τα υποχρεωτικά πεδία");
                return res.render("login/register");
            }

            if (password !== password_confirmation) {
                await res.flash(
                    "warning",
                    "Δεν συμφωνεί ο κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης"
                );
                return res.render("login/register");
            }

            // Δημιουργία χρήστη
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(password, salt);

            const newUser = new UserModel({
                kod: aa_kod,
                firstName,
                lastName,
                email,
                tel,
                team,
                password: hashPassword,
                privileges: privileges, // θα αλλαχθεί αμέσως μετά
                situation,
                details,
                isVerified: true, 
                isAdmin,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            // Αποθήκευση και λήψη του πραγματικού _id
            const saved = await UserModel.create(newUser);

            // // 1) Count των users με ίδιο team & update privileges
            // const teamCount = await UserModel.countDocuments({ team: saved.team });
            // const newPrivileges = teamCount === 1 ? "C" : "U";
            // await UserModel.updateOne({ _id: saved._id }, { $set: { privileges: newPrivileges } });

            // // 2) Κλωνοποίηση userprivileges από πρότυπο
            // const templateUserId = process.env.PROTYPO_ID; // .env
            // if (templateUserId) {
            //     const templatePrivileges = await UserPrivilegesModel.find({ userId: templateUserId }).lean();

            //     if (templatePrivileges && templatePrivileges.length > 0) {
            //         const clones = templatePrivileges.map(({ _id, createdAt, updatedAt, userId, ...rest }) => ({
            //             ...rest,
            //             userId: saved._id,
            //             createdAt: new Date(),
            //             updatedAt: new Date(),
            //         }));

            //         if (clones.length > 0) {
            //             await UserPrivilegesModel.insertMany(clones);
            //         }
            //     }
            // }

            // 1) Count των users με ίδιο team & update privileges
            const teamCount = await UserModel.countDocuments({ team: saved.team });
            const newPrivileges = teamCount === 1 ? "C" : "U";
            await UserModel.updateOne({ _id: saved._id }, { $set: { privileges: newPrivileges } });

            // 2) Κλωνοποίηση userprivileges από πρότυπο
            const templateUserId = process.env.PROTYPO_ID; // .env
            if (templateUserId) {
                // Έλεγχος: έχει ήδη userprivileges αυτός ο χρήστης;
                const existingPrivileges = await UserPrivilegesModel.countDocuments({ userId: String(saved._id) });
                if (existingPrivileges === 0) {
                    const templatePrivileges = await UserPrivilegesModel.find({ userId: templateUserId }).lean();
                    if (templatePrivileges?.length) {
                        const clones = templatePrivileges.map(({ _id, userId, ...rest }) => ({
                            ...rest,
                            userId: String(saved._id), // ✅ Σαν String
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        }));
                        await UserPrivilegesModel.insertMany(clones);
                    }
                }
            }

            // 3) Κλωνοποίηση sidebarstatuses από πρότυπο
            if (templateUserId) {
                // Έλεγχος: έχει ήδη sidebarstatuses αυτός ο χρήστης;
                const existingSidebar = await SidebarStatusModel.countDocuments({ userId: String(saved._id) });
                if (existingSidebar === 0) {
                    const templateSidebar = await SidebarStatusModel.find(
                        { userId: templateUserId },
                        { _id: 0, userId: 0 } // βγάζουμε _id και userId
                    ).lean();

                    if (templateSidebar?.length) {
                        const sidebarClones = templateSidebar.map(doc => ({
                            ...doc,
                            userId: String(saved._id), // ✅ Σαν String
                        }));
                        await SidebarStatusModel.insertMany(sidebarClones);
                    }
                }
            }

            await res.flash("success", "Επιτυχής καταχώρηση...");
            const token = jwt.sign({ userID: saved._id }, process.env.JWT_SECRET_KEY, { expiresIn: "10m" });

            return res.render("login/login");
        } catch (error) {
            console.error("Registration error:", error);
            await res.flash(
                "error",
                "Αδυναμία εγγραφής. Επικοινωνήστε με τον Διαχειριστή..."
            );
            return res.render("login/login");
        }
    };

    static changePasswordForm = async (req, res) => {
        const locals = {
            title: "Change Password",
            description: "Web Payroll System",
        };

        try {
            if (req.session && (req.session.userRole === "A" || req.session.userRole === "C") && req.session.userStatus === "A" ) {
                // 🔍 Βρες τον χρήστη με βάση το session.userId
                const user = await UserModel.findById(req.session.userId).lean();
                if (!user) {
                    await res.flash("error", "Δεν βρέθηκε ο χρήστης στο σύστημα");
                    return res.redirect("/login");
                }

                const userEmail = user.email;
                const userRole = req.session.userRole;
                const attemptTime = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" });

                // ✉️ Στήσιμο email
                const mailOptions = {
                    from: `"Web Payroll System" <${process.env.MAIL_USER}>`,
                    to: userEmail,
                    subject: "Προσπάθεια αλλαγής κωδικού πρόσβασης",
                    html: `
                    <h3>Αγαπητέ/ή χρήστη,</h3>
                    <p>Στις <b>${attemptTime}</b> καταγράφηκε προσπάθεια 
                    αλλαγής του κωδικού πρόσβασης για τον λογαριασμό σας
                    (<b>${userEmail}</b>) με ρόλο <b>${userRole}</b>.</p>

                    <p>✅ Αν εσείς ξεκινήσατε τη διαδικασία, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>

                    <p style="color:red;">
                        ⚠️ Αν δεν ήσασταν εσείς, παρακαλούμε επικοινωνήστε άμεσα με τον Administrator 
                        ή αλλάξτε τον κωδικό σας το συντομότερο δυνατό.
                    </p>

                    <hr>
                    <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll System.</small>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    // console.log("📧 Email στάλθηκε στον χρήστη:", userEmail);
                } catch (err) {
                    console.error("Σφάλμα αποστολής email:", err);
                }

                // Προχώρα στο render
                return res.render("login/change_password", { locals });
            } else {
                await res.flash(
                    "warning",
                    "Δεν έχετε δικαίωμα αλλαγής του κωδικού πρόσβασης. Απευθυνθείτε στον supervisor σας ή στον Administrator"
                );
                return res.redirect("/login");
            }
        } catch (error) {
            console.error(error);
            return res.redirect("/");
        }
    };

    static changeUserPassword = async (req, res) => {
        const { email, old_password, password, password_confirmation } = req.body;

        const user = await UserModel.findOne({ email: email });

        if (!user || !user._id) {
            await res.flash("error", "Ο χρήστης δεν είναι αυθεντικοποιημένος");
            return res.redirect("/login");
        }

        if (email && old_password && password && password_confirmation) {
            // const user = await UserModel.findOne({ email: email });

            if (!user) {
                await res.flash("warning", "Δεν βρέθηκε χρήστης με αυτό το email");
                return res.redirect("/login");
            }

            const isMatchOldPassword = await bcrypt.compare(old_password, user.password);

            if (isMatchOldPassword) {
                if (password === password_confirmation) {
                    const salt = await bcrypt.genSalt(10);
                    const newHashPassword = await bcrypt.hash(password, salt);

                    await UserModel.findByIdAndUpdate(user._id, {
                        $set: { password: newHashPassword },
                    });

                    await res.flash("info", "Επιτυχής αλλαγή Password");
                } else {
                    await res.flash("warning", "Δεν συμφωνεί ο νέος κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης");
                }
            } else {
                await res.flash("info", "Δεν συμφωνεί το τρέχον password που πληκτρολογήσατε με το ήδη καταχωρημένο");
            }
        } else {
            await res.flash("info", "Όλα τα πεδία είναι υποχρεωτικά");
        }

        res.redirect("/login");
    };

    static resetPasswordForm = async (req, res) => {
        const locals = {
            title: "Reset Password",
            description: "Web Payroll System",
        };

        try {
            if (req.session && (req.session.userRole === "A" || req.session.userRole === "C") && req.session.userStatus === "A" ) {
                // 🔍 Βρες τον χρήστη με βάση το session.userId
                const user = await UserModel.findById(req.session.userId).lean();
                if (!user) {
                    await res.flash("error", "Δεν βρέθηκε ο χρήστης στο σύστημα");
                    return res.redirect("/login");
                }

                const userEmail = user.email;
                const userRole = req.session.userRole;
                const attemptTime = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" });
                const roleLabels = {
                    A: "Administrator",
                    C: "Supervisor",
                    U: "User",
                    V: "Viewer"
                };

                const roleName = roleLabels[userRole] || "Άγνωστος ρόλος";

                // ✉️ Στήσιμο email
                const mailOptions = {
                    from: `"Web Payroll System" <${process.env.EMAIL_USER}>`,
                    to: userEmail,
                    subject: "Προσπάθεια επαναφοράς κωδικού πρόσβασης",
                    html: `
                    <h3>Αγαπητέ/ή χρήστη,</h3>
                    <p>Στις <b>${attemptTime}</b> καταγράφηκε προσπάθεια 
                    επαναφοράς του κωδικού πρόσβασης για τον λογαριασμό σας
                    (<b>${userEmail}</b>) με ρόλο <b>${userRole}: ${roleName}</b>.</p>

                    <p>✅ Αν εσείς ξεκινήσατε τη διαδικασία, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>

                    <p style="color:red;">
                        ⚠️ Αν δεν ήσασταν εσείς, παρακαλούμε επικοινωνήστε άμεσα με τον Administrator 
                        ή αλλάξτε τον κωδικό σας το συντομότερο δυνατό.
                    </p>

                    <hr>
                    <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll System.</small>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    // console.log("📧 Email στάλθηκε στον χρήστη:", userEmail);
                } catch (err) {
                    console.error("Σφάλμα αποστολής email:", err);
                }

                // Προχώρα στο render
                return res.render("login/reset_password", { locals });
            } else {
                await res.flash(
                    "warning",
                    "Δεν έχετε δικαίωμα επαναφοράς του κωδικού πρόσβασης. Απευθυνθείτε στον supervisor σας ή στον Administrator"
                );
                return res.redirect("/login");
            }
        } catch (error) {
            console.error(error);
            return res.redirect("/");
        }
    };

    static sendUserResetPasswordEmail = async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                await res.flash("warning", "Το email είναι υποχρεωτικό");
                return res.redirect("/");
            }

            const user = await UserModel.findOne({ email });
            if (!user) return res.redirect("/");

            await res.flash("info", "Αν το email υπάρχει στη βάση δεδομένων, θα σας σταλεί άμεσα ένα link στο email σας το οποίο θα έχει ισχύ για τα επόμενα 5 λεπτά. Ελέγξτε το email σας.");

            // secret που δένει με το password hash
            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;
            const token = jwt.sign({ userID: user._id }, secret, { expiresIn: "5m" });

            const base = APP_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;
            const link = `${base}/login/reset_old_password/${user._id}/${token}`;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: user.email,
                subject: "Οδηγίες επαναφοράς κωδικού πρόσβασης",
                html: `
                <div style="font-family: Arial, sans-serif; line-height:1.6;">
                    <h2>Επαναφορά κωδικού πρόσβασης</h2>
                    <p>Λάβαμε αίτημα για επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο <strong>Web Payroll Solutions</strong>.</p>
                    
                    <p>Για να ορίσετε νέο κωδικό, κάντε κλικ στον παρακάτω σύνδεσμο:</p>
                    <p style="margin:20px 0;">
                        <a href="${link}" 
                            style="background:#007bff; color:#fff; padding:10px 15px; border-radius:5px; text-decoration:none;">
                            Ορισμός νέου κωδικού
                        </a>
                    </p>
                    
                    <p>Ο σύνδεσμος θα παραμείνει ενεργός για <strong>5 λεπτά</strong>. Μετά τη λήξη, θα χρειαστεί να υποβάλετε νέο αίτημα επαναφοράς.</p>
                    
                    <hr style="margin:20px 0;">
                    
                    <p style="font-size:14px; color:#555;">
                    Αν δεν ζητήσατε εσείς την επαναφορά, μπορείτε να αγνοήσετε αυτό το μήνυμα. 
                    Ο λογαριασμός σας παραμένει ασφαλής και δεν απαιτείται καμία ενέργεια.
                    </p>
                    
                    <p style="font-size:14px; color:#555;">
                    Για οποιαδήποτε απορία ή βοήθεια, επικοινωνήστε μέσω του email με την υποστήριξή μας.
                    </p>
                </div>
                `
            });

            return res.redirect("/");
        } catch (err) {
            console.error(err);
            await res.flash("error", "Σφάλμα κατά την αποστολή email.");
            return res.redirect("/");
        }
    };

    static showResetPasswordForm = async (req, res) => {
        try {
            const { uid, token } = req.params;
            const user = await UserModel.findById(uid);
            if (!user) {
                await res.flash("warning", "Μη έγκυρος σύνδεσμος.");
                return res.redirect("/");
            }

            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;
            try {
                jwt.verify(token, secret);
                // ΣΗΜ.: περνάμε και error: null για ομοιομορφία
                return res.render("login/set_new_password", { uid, token, error: null });
            } catch (err) {
                await res.flash("warning", "Μη έγκυρος ή ληγμένος σύνδεσμος.");
                return res.redirect("/");
            }
        } catch (err) {
            console.error(err);
            await res.flash("error", "Σφάλμα.");
            return res.redirect("/");
        }
    };

    static handleResetPassword = async (req, res) => {
        try {
            const { uid, token } = req.params;
            const { password, password2 } = req.body;

            if (!password || !password2) {
                return res.status(400).render("login/set_new_password", {
                    uid,
                    token,
                    error: "Είναι υποχρεωτικό να συμπληρώσετε και τα δύο πεδία."
                });
            }
            if (password !== password2) {
                return res.status(400).render("login/set_new_password", {
                    uid,
                    token,
                    error: "Οι κωδικοί δεν ταιριάζουν.",
                    values: { password2 }     // Δεν κρατάμε το password για λόγους ασφάλειας· μόνο το password2 αν θέλουμε καλύτερη UX.
                });
            }
            if (password.length < 8) {
                return res.status(400).render("login/set_new_password", {
                    uid,
                    token,
                    error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες."
                });
            }

            const user = await UserModel.findById(uid);
            if (!user) {
                await res.flash("warning", "Μη έγκυρος σύνδεσμος.");
                return res.redirect("/");
            }

            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;
            try {
                jwt.verify(token, secret);
            } catch (err) {
                await res.flash("warning", "Μη έγκυρος ή ληγμένος σύνδεσμος.");
                return res.redirect("/");
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();

            await res.flash("success", "Ο κωδικός άλλαξε με επιτυχία. Συνδεθείτε με τον νέο κωδικό.");
            return res.redirect("/login");
        } catch (err) {
            console.error(err);
            await res.flash("error", "Σφάλμα κατά την αλλαγή κωδικού.");
            return res.redirect("/");
        }
    };

    static logoutForm = async (req, res) => {
        const locals = {
            title: "Αποσύνδεση",
            description: "Web Payroll System",
        };
        try {
            await res.render("login/logout", { locals, bodyClass: "home-bg-cdn" });
        } catch (error) {
            res.redirect("/");
        }
    };

//     static logout = (req, res) => {
//         const sid = req.sessionID;

//         req.session.destroy(err => {
//             if (err) {
//                 console.error('logout destroy error:', err);
//                 return res.redirect('/');
//             }

//             // προαιρετικό – καθαρίζει και από το store
//             try { req.sessionStore?.destroy?.(sid); } catch {}

//             // καθάρισε το session cookie
//             res.clearCookie(sessionOpts.name || 'sid', {
//                 path    : sessionOpts.cookie.path ?? '/',
//                 sameSite: sessionOpts.cookie.sameSite ?? 'lax',
//                 httpOnly: sessionOpts.cookie.httpOnly !== false,
//                 secure  : sessionOpts.cookie.secure ?? false,
//             });
//             // ΣΤΟ ΣΗΜΕΙΟ ΑΥΤΟ στέλνουμε ένα μικρό HTML που καθαρίζει το sessionStorage
//             // και μετά κάνει redirect με status 200 ή 204 που λέει στον server πρώτα να
//             // τρέξει το html στον browser και μετά να κανει redirect αλλιώς αν στείλουμε
//             // status 303 ή 301 ή 300 τότε ο server θα αγνοήσει το html και θα κάνει 
//             // άμεσα redirect με αποτέλεσμα να μην καθαρίζει το sessionStorage.

//             const redirectUrl = 'https://www.google.com';   // ή '/login' ή ό,τι θες

//             return res.status(200).send(`
//                 <!doctype html>
//                 <html lang="el">
//                     <head>
//                         <meta charset="utf-8" />
//                         <title>Αποσύνδεση...</title>
//                     </head>
//                     <body>
//                         <script>
//                             try {
//                                 // σβήσε ΜΟΝΟ όσα αρχίζουν από "wps:"
//                                 for (const k of Object.keys(sessionStorage)) {
//                                     if (k.startsWith('wps:')) {
//                                         sessionStorage.removeItem(k);
//                                     }
//                                 }
//                             } catch (e) {
//                                 // αν ο browser δεν το επιτρέπει, απλώς προχώρα
//                             }
//                             // και μετά redirect
//                             window.location.href = ${JSON.stringify(redirectUrl)};
//                         </script>
//                     </body>
//                 </html>
//             `);
//         });
//     };
// }

    static logout = (req, res) => {
        const sid = req.sessionID;

        req.session.destroy(err => {
            if (err) {
                console.error('logout destroy error:', err);
                return res.redirect('/');
            }

            try { req.sessionStore?.destroy?.(sid); } catch {}

            res.clearCookie(sessionOpts.name || 'sid', {
                path    : sessionOpts.cookie.path ?? '/',
                sameSite: sessionOpts.cookie.sameSite ?? 'lax',
                httpOnly: sessionOpts.cookie.httpOnly !== false,
                secure  : sessionOpts.cookie.secure ?? false,
            });

            const nonce = res.locals.nonce;
            const redirectUrl = 'https://www.google.com'; // ή '/login'

            return res.status(200).send(`
                <!doctype html>
                <html lang="el">
                    <head>
                        <meta charset="utf-8" />
                        <title>Αποσύνδεση...</title>
                    </head>
                    <body>
                        <script nonce="${nonce}">
                            try {
                                // σβήσε ΜΟΝΟ όσα αρχίζουν από "wps:"
                                for (const key of Object.keys(window.sessionStorage)) {
                                    if (key && key.indexOf('wps:') === 0) {
                                        window.sessionStorage.removeItem(key);
                                    }
                                }
                            } catch (e) {
                                // αγνόησέ το
                            }
                            // μετά redirect
                            window.location.href = ${JSON.stringify(redirectUrl)};
                        </script>
                    </body>
                </html>
            `);
        });
    };
}

module.exports = userController;
