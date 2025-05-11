import mongoose from "mongoose";
import Models_B from "../../models/privileges.js";
import Models_C from "../../models/companies.js";
import formatNumber from "../../../public/js/utils/formatNumber.js";

const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, PasswordsModel } = Models_C;

let nextPageSearchTerm = "";

class passwordsController {

  static mainPasswordsForm = async (req, res) => {
    const locals = {
      title: "Κωδικοί Πρόσβασης",
      description: "Web Payroll System",
    };

    const sessionCompanyInUse = req.session.companyInUse;
    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Άντληση στοιχείων εταιρείας
      const company = await CompaniesModel.findOne({
        _id: sessionCompanyInUse,
      });

      const companyIdAsString = company._id.toString(); // Μετατρέπω το company.id από object σε string

      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Passwords",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            companykod_object: companyIdAsString,
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await PasswordsModel.aggregate(
        countPipeline
      ).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Aggregation query για την ανάκτηση δεδομένων
      const queryPipeline = [
        {
          $match: {
            companykod_object: companyIdAsString,
          },
        },
        {
          $sort: {
            perigrafh: 1,
          },
        },
        {
          $skip: skipRecords,
        },
        {
          $limit: limitPerPage,
        },
      ];

      const passwords = await PasswordsModel.aggregate(
        queryPipeline
      ).exec();

      res.render("companies/passwords/passwords", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page,
        pages: totalPages,
        company,
        passwords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static addPasswordsForm = async (req, res) => {
    const sessionCompanyInUse = req.session.companyInUse;
    const locals = {
      title: "Προσθήκη Νέου Κωδικού Πρόσβασης",
      description: "Web Payroll System",
    };

    try {
      const company = await CompaniesModel.findOne({
        _id: sessionCompanyInUse,
      });

      res.render("companies/passwords/add", {
        locals,
        company,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postPasswordsForm = async (req, res) => {
    const formData = req.body;

    const newPassword = PasswordsModel({
      team: formData.companyTeam,
      companykod_object: formData.companyId,
      companykod: formData.companyKodikos,
      kodikos: formatNumber(formData.Kodikos, 4),
      perigrafh: formData.perigrafh,
      username: formData.username,
      password: formData.password,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      await PasswordsModel.create(newPassword);
      res.json({ success: true, redirectUrl: "/companies/passwords" });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetPasswords = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κωδικών Πρόσβασης",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = nextPageSearchTerm;

      const sessionUserId = req.session.userId;
      const sessionCompanyInUse = req.session.companyInUse;
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Passwords",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
              { username: { $regex: new RegExp(searchTerm, "i") } },
              { password: { $regex: new RegExp(searchTerm, "i") } },
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await PasswordsModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const passwordsFilteredRecs = await PasswordsModel.aggregate([
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
              { username: { $regex: new RegExp(searchTerm, "i") } },
              { password: { $regex: new RegExp(searchTerm, "i") } },
            ]
          }
        }
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = passwordsFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        perigrafh: this.highlightText(record.perigrafh, searchTerm),
        username: this.highlightText(record.username, searchTerm),
        password: this.highlightText(record.password, searchTerm),
      }));
  
      res.render("companies/passwords/search", {
        passwordsFilteredRecs: highlightedRecords,
        locals,
        current: page,
        pages: totalPages,
        userPrivileges,
        sTerm: searchTerm,
        entries: perPage,
        totalRecs: totalRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static searchPostPasswords = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κωδικών Πρόσβασης",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = req.body.searchTerm;

      const sessionUserId = req.session.userId;
      const sessionCompanyInUse = req.session.companyInUse;
      const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9()]/g, "");
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      let sTerm = searchNoSpecialChar;
      nextPageSearchTerm = searchNoSpecialChar;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Passwords",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
              { username: { $regex: new RegExp(sTerm, "i") } },
              { password: { $regex: new RegExp(sTerm, "i") } },
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await PasswordsModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const passwordsFilteredRecs = await PasswordsModel.aggregate([
        {
          $match: {
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
              { username: { $regex: new RegExp(sTerm, "i") } },
              { password: { $regex: new RegExp(sTerm, "i") } },
            ]
          }
        }
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = passwordsFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        perigrafh: this.highlightText(record.perigrafh, sTerm),
        username: this.highlightText(record.username, sTerm),
        password: this.highlightText(record.password, sTerm),
      }));

      res.render("companies/passwords/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
        passwordsFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static editPasswordsForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Συντήρηση κωδικών Πρόσβασης",
      description: "Web Payroll System",
    };

    try {
      const passwordsId = req.params.id;
      
      const passwords = await PasswordsModel.findById(passwordsId);
      const company = await CompaniesModel.findOne({ team: passwords.team, kod: passwords.companykod });

      res.render("companies/passwords/edit", {
        locals,
        messages,
        company, 
        passwords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postPasswordsUpdate = async (req, res) => {
    const passwordsId = req.params.passwordsId;
    const formData = req.body;

    const filteredDataPasswords = {
      perigrafh: formData.perigrafh,
      username: formData.username,
      password: formData.password,
      updatedAt:  Date.now(),
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataCompany στη $set: για ενημέρωση
    await PasswordsModel.findOneAndUpdate(
      { _id: passwordsId },
      { $set: filteredDataPasswords },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/companies/passwords" });
    } catch (error) {
      throw error;
    }
  };

  static deletePasswords = async (req, res) => {
    try {
      await PasswordsModel.deleteOne({ _id: req.params.id });
      res.json({ success: true, redirectUrl: "/companies/passwords" });
    } catch (error) {
      throw error;
    }
  };

  static highlightText(text, term) {
    if (!text) return ""; // Επιστρέφει ένα κενό string αν το text είναι falsy (π.χ., undefined, null, '')
    const highlightStartTag = "<span class='highlight'>";
    const highlightEndTag = "</span>";
    const regex = new RegExp(`(${term})`, "gi");
    return text.replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
  }
}

export default passwordsController;
