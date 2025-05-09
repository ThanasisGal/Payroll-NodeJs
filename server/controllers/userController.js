import UserModel from "../models/userModel.js";
import VerifyModel from "../models/verifications.js";
import Models from "../models/stathera_arxeia.js";
import Models_A from "../models/param.js";
import Models_B from "../models/privileges.js";
import Models_C from "../models/companies.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { jwtDecode } from "jwt-decode";
import transporter from "../../config/emailConfig.js";

const { PeriodsModel } = Models;

const { ParamModel } = Models_A;

const { UserPrivilegesModel, SidebarStatusModel } = Models_B;

const { CompaniesModel } = Models_C;

let sTerm = "";
var types, redir, messages, images, tmpEmail;

class userController {
  static homepage = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Payroll",
      description: "Web Payroll System",
    };
    try {
      res.render("home", { locals, messages });
    } catch (error) {
      res.redirect("/");
    }
  };

  static adminHomepage = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Admin Διαχείριση Χρηστών",
      description: "Web Payroll System by Admin",
    };

    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      const totalRecords = await UserModel.countDocuments({});
      let totalPages =
        perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
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
        messages,
      });
    } catch (error) {
      console.log(error);
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
    let aa_kod = 0;
    try {
      const lastRecord = await UserModel.find().sort({ _id: -1 }).limit(1);

      let x = JSON.stringify(lastRecord).split(",")[1];
      aa_kod = parseInt(x.split(':"')[1]) + 1;
    } catch (error) {
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
      await req.flash("message", "Έχει προστεθεί νέος χρήστης");
      messages = req.flash("message");
      await req.flash("type", process.env._SUCCESS);
      types = req.flash("type");
      await req.flash("img", process.env._IMG_SUCCESS);
      images = req.flash("img");
      redir = "index";

      await res.render(redir, { messages, types, images });
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
      console.log(error);
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
      console.log(error);
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
      await req.flash("info", "Επιτυχής Ενημέρωση");
      await res.redirect(`/admin`);
    } catch (error) {
      console.log(error);
    }
  };

  static deletePostUser = async (req, res) => {
    try {
      await req.flash("info", "Επιτυχής Διαγραφή");
      await UserModel.deleteOne({ _id: req.params.id });
      res.redirect("/admin");
    } catch (error) {
      console.log(error);
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
      console.log(error);
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
      let totalPages =
        perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
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
      console.log(error);
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
      let totalPages =
        perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
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
      console.log(error);
    }
  };

  static verifyEmailForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Verify Email",
      description: "Web Payroll System",
    };

    try {
      res.render("login/verify_email", { locals });
    } catch (error) {
      res.redirect("/login");
    }
  };

  static sendUserVerifyEmail = async (req, res) => {
    const { email } = req.body;
    const secret = process.env.JWT_SECRET_KEY;

    let id, newToken;

    if (email) {
      const verifyEmail = await VerifyModel.findOne({ email: email });
      if (verifyEmail) {
        const token = jwt.sign({ userID: verifyEmail._id }, secret, {
          expiresIn: "10m",
        });
        id = verifyEmail._id;
        newToken = token;
      } else {
        const newEmail = VerifyModel({
          email: email,
          verify: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await VerifyModel.create(newEmail);

        const verifyEmail = await VerifyModel.findOne({ email: email });
        if (verifyEmail) {
          const token = jwt.sign({ userID: verifyEmail._id }, secret, {
            expiresIn: "10m",
          });

          id = verifyEmail._id;
          newToken = token;

          await VerifyModel.findByIdAndUpdate(verifyEmail._id, {
            $set: { token: token },
          });
        }
      }

      const bufferText = Buffer.from(email, "utf8");
      const s3 = bufferText.toString("hex");
      const link =
        process.env.URL +
        process.env.PORT +
        `/verify-Email/?s1=${id}&s2=${newToken}&s3=${s3}`;

      // Send Email
      let info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Web Payroll Solutions => Επαλήθευση email",
        html: `Γεια σας, <br /><br />Επειδή ζητήσατε να εγγραφείτε σαν χρήστης της εφαρμογής <strong>"Web Payroll Solutions"</strong> <br /> θα πρέπει πριν συνεχίσετε να επαληθεύσετε το email σας. <br /><br /><br /> <a href="${link}"><strong>Κάντε κλικ εδώ</strong></a> για να επαληθεύσετε το email σας`,
      });

      await req.flash(
        "message",
        "Αποστολή email επαλήθευσης... Παρακαλώ ελέγξτε το email σας"
      );
      messages = req.flash("message");
      await req.flash("type", process.env._INFO);
      types = req.flash("type");
      await req.flash("img", process.env._IMG_INFO);
      images = req.flash("img");
      redir = "login/login";
    }
    await res.render(redir, { messages, types, images });
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
        await req.flash(
          "message",
          "Έχει λήξει η περίοδος που μπορούσατε να χρησιμοποιήσετε το link επιβεβαίωσης Email. Προσπαθείστε ξανά..."
        );
        messages = req.flash("message");
        await req.flash("type", process.env._ERROR);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_ERROR);
        images = req.flash("img");
        redir = "login/login";
      } else {
        await req.flash("message", "Ανύπαρκτο ή λανθασμένο link");
        messages = req.flash("message");
        await req.flash("type", process.env._ERROR);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_ERROR);
        images = req.flash("img");
        redir = "home";
      }
    } else {
      const checkSendLink = await VerifyModel.findById(req.query.s1);
      if (checkSendLink) {
        if (checkSendLink.verify === true) {
          await req.flash(
            "message",
            "Έχετε ήδη επαληθεύσει το Email σας. Συνδεθείτε..."
          );
          messages = req.flash("message");
          await req.flash("type", process.env._INFO);
          types = req.flash("type");
          await req.flash("img", process.env._IMG_INFO);
          images = req.flash("img");
          redir = "login/login";
        } else {
          await VerifyModel.findByIdAndUpdate(checkSendLink._id, {
            $set: { verify: true },
          });
          tmpEmail = checkSendLink.email;
          await req.flash(
            "message",
            "Επιτυχής επαλήθευση του email σας. Προχωρείστε στην καταχώρηση του χρήστη..."
          );
          messages = req.flash("message");
          await req.flash("type", process.env._SUCCESS);
          types = req.flash("type");
          await req.flash("img", process.env._IMG_SUCCESS);
          images = req.flash("img");
          redir = "/register";
        }
      } else {
        await req.flash("message", "Ανύπαρκτο ή λανθασμένο link");
        messages = req.flash("message");
        await req.flash("type", process.env._ERROR);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_ERROR);
        images = req.flash("img");
        redir = "home";
      }
    }

    if (redir == "/register") {
      await res.redirect("/register/?mail=" + req.query.s3);
    } else {
      await res.render(redir, { messages, types, images });
    }
  };

  static loginForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Login",
      description: "Web Payroll System",
    };

    try {
      res.render("login/login", { locals, messages, types, images });
    } catch (error) {
      res.redirect("/");
    }
  };

  static userLogin = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (email && password) {
        const user = await UserModel.findOne({ email: email });
        if (!user) {
          await req.flash(
            "message",
            "Δεν είστε εγγεγραμμένος χρήστης. Εγγραφείτε για να συνεχίσετε..."
          );
          messages = req.flash("message");
          await req.flash("type", process.env._WARNING);
          types = req.flash("type");
          await req.flash("img", process.env._IMG_WARNING);
          images = req.flash("img");
          redir = "login/login";
        } else {
          if (user) {
            if (!user.isVerified) {
              await req.flash(
                "message",
                "Δεν έχετε κάνει επαλήθευση του Email σας. Επαληθεύστε το email και συνεχίστε..."
              );
              messages = req.flash("message");
              await req.flash("type", process.env._ERROR);
              types = req.flash("type");
              await req.flash("img", process.env._IMG_ERROR);
              images = req.flash("img");
              redir = "login/login";
            } else {
              if (user.situation === "I") {
                await req.flash(
                  "message",
                  "Είστε απενεργοποιημένος χρήστης. Επικοινωνείστε με τον διαχειριστή..."
                );
                messages = req.flash("message");
                await req.flash("type", process.env._WARNING);
                types = req.flash("type");
                await req.flash("img", process.env._IMG_WARNING);
                images = req.flash("img");
                redir = "login/login";
              } else {
                const isMatch = await bcrypt.compare(password, user.password);

                if (user.email === email && isMatch) {
                  const saved_user = await UserModel.find({ email: email });

                  // Generate JWT Token
                  const token = jwt.sign(
                    { userID: saved_user._id },
                    process.env.JWT_SECRET_KEY,
                    {
                      expiresIn: "60m",
                    }
                  );

                  req.session.userId = user._id;
                  req.session.userName = user.firstName;
                  req.session.userTeam = user.team;
                  req.session.userRole = user.privileges;
                  req.session.userStatus = user.situation;
                  req.session.companyInUse = "";
                  req.session.companyDescription = "";
                  req.session.yearInUse = "";
                  req.session.periodInUse = "";
                  req.session.periodInUseDescr = "";
                  req.session.appDate = "";
                  req.session.currentTyposApodoxon = "001";
                  req.session.energoi = true;
                  req.session.ypokatasthma = "";

                  // Διαβάζει από το ParamModel και ενημερώνει το session
                  const parameter = await ParamModel.findOne({
                    usrId: req.session.userId,
                  });

                  if (parameter !== null) {
                    req.session.yearInUse = parameter.usedYear;
                    req.session.periodInUse = parameter.usedPeriod;
                    req.session.periodInUseDescr = parameter.usedPeriodDescr;
                    req.session.appDate = parameter.appDate;

                    if (parameter.companyId.length > 0) {
                      const companies = await CompaniesModel.findById({
                        _id: parameter.companyId,
                      });

                      if(companies) {
                        req.session.companyInUse = parameter.companyId;
                        req.session.companyDescription = companies.eponymia + " " + companies.firstname;
                      }

                      await req.flash(
                        "message",""
                      );
                      // `Καλώς ήρθες πάλι πίσω ${companies.firstname}...`
                      messages = req.flash("message");
                      await req.flash("type", process.env._INFO);
                      types = req.flash("type");
                      await req.flash("img", process.env._IMG_INFO);
                      images = req.flash("img");
                      redir = "mainapp";
                    } else {
                      redir = "/companies/genikastoixeia";
                    }

                    if (parameter.usedYear.length > 0) {
                      req.session.yearInUse = parameter.usedYear;
                    }

                    if (parameter.usedPeriod.length > 0) {
                      req.session.periodInUse = parameter.usedPeriod;
                      const periodoi = await PeriodsModel.findOne({
                        xrhsh: parameter.usedYear,
                        kodikos: parameter.usedPeriod,
                      });

                      req.session.periodInUseDescr = periodoi.perigrafh;
                    }
                  } else {
                    redir = "/companies/genikastoixeia";
                  }
                } else {
                  await req.flash(
                    "message",
                    "Το email ή ο κωδικός πρόσβασης δεν είναι έγκυρα..."
                  );
                  messages = req.flash("message");
                  await req.flash("type", process.env._WARNING);
                  types = req.flash("type");
                  await req.flash("img", process.env._IMG_WARNING);
                  images = req.flash("img");
                  redir = "login/login";
                }
              }
            }
          } else {
            await req.flash(
              "message",
              "Δεν είστε εγγεγραμμένος χρήστης.  Εγγραφείτε για να συνεχίσετε..."
            );
            messages = req.flash("message");
            await req.flash("type", process.env._WARNING);
            types = req.flash("type");
            await req.flash("img", process.env._IMG_WARNING);
            images = req.flash("img");
            redir = "login/login";
          }
        }
      } else {
        await req.flash("message", "Όλα τα πεδία είναι υποχρεωτικά...");
        messages = req.flash("message");
        await req.flash("type", process.env._INFO);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_INFO);
        images = req.flash("img");
        redir = "login/login";
      }
    } catch (error) {
      await req.flash(
        "message",
        "Αδυναμία Σύνδεσης. Επικοινωνείστε με τον Διαχειριστή"
      );
      messages = req.flash("message");
      await req.flash("type", process.env._ERROR);
      types = req.flash("type");
      await req.flash("img", process.env._IMG_ERROR);
      images = req.flash("img");
      redir = "login/login";
    }

    if (redir == "/companies/genikastoixeia") {
      await res.redirect(redir);
    } else {
      await res.render(redir, { messages, types, images });
    }
  };

  static getUserRoles = async (req, res) => {
    const user_Id = req.session.userId;
    const userPermission = req.session.userRole;
    const permissions = await userController.fetchPermissions(user_Id, userPermission);

    res.json({ permissions }); // Επιστροφή δεδομένων στο frontend
  };

  static async fetchPermissions(user_Id, userPermission) {
    try {
      const lis = await SidebarStatusModel.find({userId: user_Id}).sort('li_Id');
      const permissions = lis.reduce((acc, li) => {
        let situationValue = false;
        switch (userPermission) {
          case "A":
            situationValue = li.situation_A;
            break;
          case "C":
            situationValue = li.situation_C;
            break;
          case "V":
            situationValue = li.situation_V;
            break;
        }
        acc[li.li_Id] = situationValue;
        return acc;
      }, {});
      return permissions; // Επιστρέφει το αντικείμενο permissions
    } catch (err) {
      console.error(err);
      // Επιστρέφει κενό αντικείμενο
      return {}; 
    }
  };

  static registerForm = async (req, res) => {
    const locals = {
      title: "Register",
      description: "Web Payroll System",
    };

    try {
      res.render("login/register", { locals, messages });
    } catch (error) {
      res.redirect("/login");
    }
  };

  static userRegistration = async (req, res) => {
    let aa_kod = 0;
    try {
      const lastRecord = await UserModel.find().sort({ _id: -1 }).limit(1);

      let x = JSON.stringify(lastRecord).split(",")[1];
      aa_kod = parseInt(x.split(':"')[1]) + 1;
    } catch (error) {
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
      privileges,
      situation,
      details,
      isVerified,
      isAdmin,
    } = req.body;

    const user = await UserModel.findOne({ email: email });

    if (user) {
      await req.flash("message", "Το Email είναι ήδη καταχωρημένο. ");
      messages = req.flash("message");
      await req.flash("type", process.env._ERROR);
      types = req.flash("type");
      await req.flash("img", process.env._IMG_ERROR);
      images = req.flash("img");
      redir = "login/login";
    } else {
      if (
        firstName &&
        lastName &&
        email &&
        team &&
        password &&
        password_confirmation
      ) {
        if (password === password_confirmation) {
          try {
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(password, salt);
            const newUser = new UserModel({
              kod: aa_kod,
              firstName: firstName,
              lastName: lastName,
              email: email,
              tel: tel,
              team: team,
              password: hashPassword,
              privileges: privileges,
              situation: situation,
              details: details,
              isVerified: true,
              isAdmin: isAdmin,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            await UserModel.create(newUser);
            await req.flash("message", "Επιτυχής καταχώρηση...");
            messages = req.flash("message");
            await req.flash("type", process.env._SUCCESS);
            types = req.flash("type");
            await req.flash("img", process.env._IMG_SUCCESS);
            images = req.flash("img");
            redir = "login/login";

            const saved_user = await UserModel.findOne({ email: email });
            // Generate JWT Token
            const token = jwt.sign(
              { userID: saved_user._id },
              process.env.JWT_SECRET_KEY,
              { expiresIn: "10m" }
            );
          } catch (error) {
            await req.flash(
              "message",
              "Αδυναμία εγγραφής. Επικοινωνείστε με τον Διαχειριστή..."
            );
            messages = req.flash("message");
            await req.flash("type", process.env._ERROR);
            types = req.flash("type");
            await req.flash("img", process.env._IMG_ERROR);
            images = req.flash("img");
            redir = "login/login";
          }
        } else {
          await req.flash(
            "message",
            "Δεν συμφωνεί ο κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης"
          );
          messages = req.flash("message");
          await req.flash("type", process.env._WARNING);
          types = req.flash("type");
          await req.flash("img", process.env._IMG_WARNING);
          images = req.flash("img");
          redir = "login/register";
        }
      } else {
        await req.flash("message", "Δεν συμπληρώσατε όλα τα υποχρεωτικά πεδία");
        messages = req.flash("message");
        await req.flash("type", process.env._WARNING);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_WARNING);
        images = req.flash("img");
        redir = "login/register";
      }
    }
    res.render(redir, { messages, types, images });
  };

  static changePasswordForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Change Password",
      description: "Web Payroll System",
    };

    try {
      res.render("login/change_password", { locals, messages });
    } catch (error) {
      res.redirect("/login");
    }
  };

  static changeUserPassword = async (req, res) => {
    const { email, old_password, password, password_confirmation } = req.body;

    if (email && old_password && password && password_confirmation) {
      const user = await UserModel.findOne({ email: email });
      const isMatchOldPassword = await bcrypt.compare(
        old_password,
        user.password
      );

      if (isMatchOldPassword) {
        if (password === password_confirmation) {
          const salt = await bcrypt.genSalt(10);
          const newHashPassword = await bcrypt.hash(password, salt);

          await UserModel.findByIdAndUpdate(req.user._id, {
            $set: { password: newHashPassword },
          });

          await req.flash("info", "Επιτυχής αλλαγή Password");
        } else {
          await req.flash(
            "info",
            "Δεν συμφωνεί ο Νέος κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης"
          );
        }
      } else {
        await req.flash(
          "info",
          "Δεν συμφωνεί το τρέχον password που πληκτρολογήσατε με το ήδη καταχωρημένο"
        );
      }
    } else {
      await req.flash("info", "Όλα τα πεδία είναι υποχρεωτικά");
    }
    res.redirect("/login");
  };

  static resetPasswordForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Reset Password",
      description: "Web Payroll System",
    };

    try {
      res.render("login/reset_password", { locals, messages });
    } catch (error) {
      res.redirect("/");
    }
  };

  static sendUserResetPasswordEmail = async (req, res) => {
    const { email } = req.body;
    if (email) {
      const user = await UserModel.findOne({ email: email });
      const secret = user._id + process.env.JWT_SECRET_KEY;
      if (user) {
        const token = jwt.sign({ userID: user._id }, secret, {
          expiresIn: "20m",
        });
        const link =
          process.env.URL +
          process.env.PORT +
          `/login/reset/${user._id}/${token}`;

        // Send Email
        let info = await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: "Web Payroll Solutions => Σύνδεσμος επαναφοράς κωδικού πρόσβασης ",
          html: `<a href=${link}>Κάντε κλικ εδώ </a>για να επαναφέρετε τον κωδικό πρόσβασής σας`,
        });
        await req.flash(
          "info",
          "Αποστολή email επαναφοράς κωδικού πρόσβασης... Παρακαλώ ελέγξτε το email σας"
        );
      } else {
        await req.flash("info", "Το email δεν υπάρχει στη βάση");
      }
    } else {
      await req.flash("info", "Το email είναι υποχρεωτικό");
    }
    // res.render("login/reset_password", messages);
    res.redirect("/login");
  };

  static userPasswordReset = async (req, res) => {
    const { password, password_confirmation } = req.body;
    const { id, token } = req.params;
    const user = await UserModel.findById(id);
    const new_secret = user._id + process.env.JWT_SECRET_KEY;

    try {
      jwt.verify(token, new_secret);
      if (password && password_confirmation) {
        if (password !== password_confirmation) {
          await req.flash(
            "info",
            "Δεν συμφωνεί ο κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης"
          );
        } else {
          const salt = await bcrypt.genSalt(10);
          const newHashPassword = await bcrypt.hash(password, salt);

          await UserModel.findByIdAndUpdate(user._id, {
            $set: { password: newHashPassword },
          });

          await req.flash("info", "Επιτυχής αλλαγή Password");
        }
      } else {
        await req.flash("info", "Όλα τα πεδία είναι υποχρεωτικά");
      }
    } catch (error) {
      console.log(error);
      await req.flash("info", "Μη έγκυρο Token");
    }
    res.redirect("/login");
  };

  static logoutForm = async (req, res) => {
    const locals = {
      title: "Αποσύνδεση",
      description: "Web Payroll System",
    };
    try {
      await res.render("login/logout", locals);
    } catch (error) {
      res.redirect("/");
    }
  };

  static logout = async (req, res) => {
    try {
      await req.session.destroy();
      await res.redirect("https://www.google.com");
      // await res.redirect("https://www.google.gr/?gws_rd=ssl");
    } catch (error) {
      res.redirect("/");
    }
  };

}

export default userController;
