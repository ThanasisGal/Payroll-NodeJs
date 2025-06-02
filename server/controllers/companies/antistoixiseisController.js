const mongoose = require("mongoose");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");
const Models_A = require("../../models/stathera_arxeia");

const { KrathseisModel } = Models_A;
const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, AntistoixiseisModel } = Models_C;

let nextPageSearchTerm = "";

class antistoixiseisController {

  static mainAntistoixiseisForm = async (req, res) => {
    const locals = {
      title: "Αντιστοιχισεις Κ.Π.Κ.",
      description: "Web Payroll System",
    };

    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Antistoixiseis",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $count: "total",
        },
      ];

      const countResults = await KrathseisModel.aggregate(
        countPipeline
      ).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Aggregation query για την ανάκτηση δεδομένων
      const queryPipeline = [
        {
          $sort: {
            kodikos: 1,
          },
        },
        {
          $skip: skipRecords,
        },
        {
          $limit: limitPerPage,
        },
      ];

      const krathseis = await KrathseisModel.aggregate(
        queryPipeline
      ).exec();

      res.render("companies/antistoixiseis/antistoixiseis", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page,
        pages: totalPages,
        krathseis,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static getAntistoixiseis = async (req, res) => {
    try {
      const companyId = req.session.companyInUse;
      const krathshId = req.params.krathshId;
      const antistoixiseis = await AntistoixiseisModel.find({ 
        companyId: companyId, 
        krathshId: krathshId 
      })
      .sort({ apo_typos_apodoxon: 1 })
      .populate('krathshId');
      res.json(antistoixiseis);
    } catch (error) {
      res.status(500).send(error.message);
    }
  };
  
  static searchPostAntistoixiseis = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κρατήσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = req.body.searchTerm;

      const sessionUserId = req.session.userId;
      const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9()]/g, "");
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      let sTerm = searchNoSpecialChar;
      nextPageSearchTerm = searchNoSpecialChar;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Antistoixiseis",
      }).exec();

      console.log("POST", userPrivileges);

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await KrathseisModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const krathseisFilteredRecs = await KrathseisModel.aggregate([
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
            ]
          }
        },
        {
          $sort: {
            kodikos: 1,
          },
        },
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = krathseisFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        perigrafh: this.highlightText(record.perigrafh, sTerm),
      }));

      res.render("companies/antistoixiseis/search", {
        krathseisFilteredRecs: highlightedRecords,
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetAntistoixiseis = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κρατήσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = nextPageSearchTerm      //req.body.searchTerm;

      const sessionUserId = req.session.userId;
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // try {
      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Antistoixiseis",
      }).exec();

      console.log("GET", userPrivileges);

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await KrathseisModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const krathseisFilteredRecs = await KrathseisModel.aggregate([
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
            ]
          }
        },
        {
          $sort: {
            kodikos: 1,
          },
        },
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = krathseisFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        perigrafh: this.highlightText(record.perigrafh, searchTerm),
      }));
  
      res.render("companies/antistoixiseis/search", {
        krathseisFilteredRecs: highlightedRecords,
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

  static addAntistoixiseisForm = async (req, res) => {

    const locals = {
      title: "Προσθήκη Νέας Αντιστοίχισης",
      description: "Web Payroll System",
    };

    try {
      const companyId = req.session.companyInUse;
      const krathshId = req.params.id;

      const company = await CompaniesModel.findOne({ _id: companyId }, "_id team kod eponymia firstname fathername");
      const krathsh = await KrathseisModel.findOne({ _id: krathshId }, "_id kodikos perigrafh");
      console.log(company);
      console.log(krathsh);

      let totalRecords = 0;
      const countResults = await AntistoixiseisModel.find({}, "aa_eggrafhs").sort({ aa_eggrafhs: -1 }).limit(1);
      if (!countResults || countResults.length === 0) {
        totalRecords = 1;
      } else {
        let x = JSON.stringify(countResults).split(",")[1];
        totalRecords = parseInt(x.split(':"')[1]) + 1;
      }

      res.render("companies/antistoixiseis/add", {
        ...locals,
        company,
        krathsh,
        totalRecs: totalRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };
  
  static addAntistoixiseisNestedForm = async (req, res) => {

    const locals = {
      title: "Προσθήκη Νέας Αντιστοίχισης",
      description: "Web Payroll System",
    };

    try {
      const antistoixishId = req.params.id;
      const antistoixish = await AntistoixiseisModel.findOne({ _id: antistoixishId });
      const companyId = antistoixish.companyId;
      const krathshId = antistoixish.krathshId;

      const company = await CompaniesModel.findOne({ _id: companyId }, "_id team kod eponymia firstname fathername");
      const krathsh = await KrathseisModel.findOne({ _id: krathshId }, "_id kodikos perigrafh");

      let totalRecords = 0;
      const countResults = await AntistoixiseisModel.find({}, "aa_eggrafhs").sort({ aa_eggrafhs: -1 }).limit(1);
      if (!countResults || countResults.length === 0) {
        totalRecords = 1;
      } else {
        let x = JSON.stringify(countResults).split(",")[1];
        totalRecords = parseInt(x.split(':"')[1]) + 1;
      }

      res.render("companies/antistoixiseis/add", {
        ...locals,
        company,
        krathsh,
        totalRecs: totalRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };
  
  static postAntistoixiseisForm = async (req, res) => {
    const formData = req.body;

    const newAntistoixish = AntistoixiseisModel({
      team: formData.team,
      companyId: formData.companyId,
      companyKod: formData.companyKod,
      krathshId: formData.krathshId,
      krathshKod: formData.krathshKod,
      aa_eggrafhs: formData.aa_eggrafhs,
      kpk: formData.kpk,
      apo_typos_apodoxon: formData.apo_typos_apodoxon,
      se_typos_apodoxon: formData.se_typos_apodoxon,
      kad: formData.kad,
      eidikothta: formData.eidikothta,
      epa: formData.epa,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      await AntistoixiseisModel.create(newAntistoixish);
      res.json({ success: true, redirectUrl: "/companies/antistoixiseis" });
    } catch (error) {
      console.log(error);
    }
  };

  static editAntistoixiseisForm = async (req, res) => {
    const locals = {
      title: "Συντήρηση Ποσοστών Κρατήσεων",
      description: "Web Payroll System",
    };

    try {
      const antistoixishId = req.params.id;
      const antistoixish = await AntistoixiseisModel.findOne({ _id: antistoixishId });

      const company = await CompaniesModel.findOne({ _id: antistoixish.companyId }, "_id team kod eponymia firstname fathername");
      const krathsh = await KrathseisModel.findOne({ _id: antistoixish.krathshId }, "_id kodikos perigrafh");

      res.render("companies/antistoixiseis/edit", {
        ...locals,
        company,
        krathsh,
        antistoixish,
      });
 } catch (error) {
      console.log(error);
    }
  };

  static postAntistoixiseisUpdate = async (req, res) => {
    const antistoixishId = req.params.antistoixishId;
    const formData = req.body;

    const filteredDataAntistoixiseis = {
      team: formData.team,
      companyId: formData.companyId,
      companyKod: formData.companyKod,
      krathshId: formData.krathshId,
      krathshKod: formData.krathshKod,
      aa_eggrafhs: formData.aa_eggrafhs,
      kpk: formData.kpk,
      apo_typos_apodoxon: formData.apo_typos_apodoxon,
      se_typos_apodoxon: formData.se_typos_apodoxon,
      kad: formData.kad,
      eidikothta: formData.eidikothta,
      epa: formData.epa,
      updatedAt: Date.now(),
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataAntistoixiseis στη $set: για ενημέρωση
    await AntistoixiseisModel.findOneAndUpdate(
      { _id: antistoixishId },
      { $set: filteredDataAntistoixiseis },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/companies/antistoixiseis" });
    } catch (error) {
      throw error;
    }
  };

  static deleteAllAntistoixiseis = async (req, res) => {
    const companyId = req.session.companyInUse;
    const krathshId = req.params.id;

    try {
        await AntistoixiseisModel.deleteMany({
          companyId: companyId,
          krathshId: krathshId,
        });
        res.json({ success: true, redirectUrl: "/companies/antistoixiseis" });
    } catch (error) {
        throw error;
    }
  };

  static deleteAntistoixiseis = async (req, res) => {
    try {
      await AntistoixiseisModel.deleteOne({ _id: req.params.id });
      res.json({ success: true, redirectUrl: "/companies/antistoixiseis" });
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

module.exports = antistoixiseisController;
