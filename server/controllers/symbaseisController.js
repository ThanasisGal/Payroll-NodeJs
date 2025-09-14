const mongoose = require("mongoose");
const Models_A = require("../models/stathera_arxeia");
const Models_B = require("../models/privileges");
const Models_C = require("../models/companies");
const Models_D = require("../models/ergazomenoi");
const Models_E = require("../models/symbaseis");

const { GenikesParametroiModel, 
        KrathseisModel 
      } = Models_A;

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel, 
        AntistoixiseisModel,
      } = Models_C;

const { ErgazomenoiModel } = Models_D;

const { SymbaseisModel,
        KathgoriesSymbaseonModel,
        EidikothtesAnaKathgoriaSymbaseonModel,
        StoixeiaSymbaseonModel,
        KlimakiaSymbaseonModel,
      } =Models_E

let nextPageSearchTerm = "";
let nextPageSelectedSymbash = "";
let nextPageSelectedSymbash_Kathgoria = "";
let nextPageSelectedSymbash_Kathgoria_Eidikothta = "";

class symbaseisController {

  // ======================================== Συμβάσεις ==========================================
  
  static mainSymbaseisForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Συμβάσεων",
      description: "Web Payroll System",
    };

    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "Symbaseis",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $count: "total",
        },
      ];

      const countResults = await SymbaseisModel.aggregate(
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

      const symbaseis = await SymbaseisModel.aggregate(
        queryPipeline
      ).exec();

      res.render("symbaseis/symbaseis/symbaseis", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page,
        pages: totalPages,
        symbaseis,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static addSymbaseisForm = async (req, res) => {
    const locals = {
      title: "Προσθήκη Νέας Σύμβασης",
      description: "Web Payroll System",
    };
    
    let aa_kodikos = null;

    try {
      const lastRecord = await SymbaseisModel.find()
        .sort({ _id: -1 })
        .limit(1);
      let kodValue = lastRecord[0] && lastRecord[0].kodikos ? parseInt(lastRecord[0].kodikos, 10) : null;
      if (kodValue !== null) {
        kodValue++;
      } else {
        kodValue = 1;
      }
      aa_kodikos = kodValue;
      res.render("symbaseis/symbaseis/add", {
        locals,
        aa_kodikos,
      });
    } catch (error) {
      console.log("Σφάλμα :", error);
    }
  };

  static postSymbaseisForm = async (req, res) => {
    const formData = req.body;

    const newSymbash = SymbaseisModel({
      kodikos: formData.kodikos,
      perigrafh: formData.perigrafh,
    });

    try {
      await SymbaseisModel.create(newSymbash);
      res.json({ success: true, redirectUrl: "/symbaseis/symbaseis" });
    } catch (error) {
      console.log(error);
    }
  };

  static searchPostSymbaseis = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Συμβάσεων",
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
        form: "Symbaseis",
      }).exec();

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

      const countResults = await SymbaseisModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const symbaseisFilteredRecs = await SymbaseisModel.aggregate([
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
            ]
          }
        }
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = symbaseisFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        perigrafh: this.highlightText(record.perigrafh, sTerm),
      }));

      res.render("symbaseis/symbaseis/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
        symbaseisFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetSymbaseis = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Συμβάσεων",
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
        form: "Symbaseis",
      }).exec();

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

      const countResults = await SymbaseisModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const symbaseisFilteredRecs = await SymbaseisModel.aggregate([
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
            ]
          }
        }
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = symbaseisFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        perigrafh: this.highlightText(record.perigrafh, searchTerm),
      }));
  
      res.render("symbaseis/symbaseis/search", {
        symbaseisFilteredRecs: highlightedRecords,
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

  static editSymbaseisForm = async (req, res) => {
    const locals = {
      title: "Συντήρηση Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      const symbaseisId = req.params.id;
      
      const symbaseis = await SymbaseisModel.findById(symbaseisId);

      res.render("symbaseis/symbaseis/edit", {
        locals,
        symbaseis,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postSymbaseisUpdate = async (req, res) => {
    const symbaseisId = req.params.symbaseisId;
    const formData = req.body;

    const filteredDataSymbaseis = {
      perigrafh: formData.perigrafh,
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataSymbaseis στη $set: για ενημέρωση
    await SymbaseisModel.findOneAndUpdate(
      { _id: symbaseisId },
      { $set: filteredDataSymbaseis },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/symbaseis/symbaseis" });
    } catch (error) {
      throw error;
    }
  };

  static deleteSymbaseis = async (req, res) => {
    try {
      const symbaseisId = req.params.id;
      const symbaseis = await SymbaseisModel.findById(symbaseisId);
      if (!symbaseis) {
        return res.status(404).json({ message: 'Συμβάση δεν βρέθηκε.' });
      }
  
      const kodikos_symbashs = symbaseis.kodikos;
      // Δημιουργία ενός regex pattern που αντιστοιχεί στον κωδικό συμβάσεως στην αρχή του string
      const pattern = new RegExp(`^${kodikos_symbashs}`);
  
      await SymbaseisModel.deleteOne({ _id: symbaseisId });
  
      const deletionResults = [];
  
      // Πίνακας με τα μοντέλα και τα αντίστοιχα πεδία για διαγραφή
      const modelsToDeleteFrom = [
        { model: KathgoriesSymbaseonModel, field: 'afora_thn_symbash', pattern, modelNameInGreek: "Κατηγορίες Συμβάσεων" },
        { model: EidikothtesAnaKathgoriaSymbaseonModel, field: 'afora_thn_symbash_kathgoria', pattern, modelNameInGreek: "Ειδικότητες Κατηγορίας Συμβάσεων" },
        { model: StoixeiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta', pattern, modelNameInGreek: "Στοιχεία Συμβάσεων" },
        { model: KlimakiaSymbaseonModel, field: 'kodikos_symbashs', pattern: new RegExp(`^${kodikos_symbashs}`), modelNameInGreek: "Κλιμάκια Συμβάσεων" },
      ];
  
      for (const { model, field, pattern } of modelsToDeleteFrom) {
        try {
          const result = await model.deleteMany({ [field]: pattern });
          if (result.deletedCount > 0) {
            deletionResults.push(`${model.modelName} Εγγραφές: ${result.deletedCount} <i class="bi bi-check cgreen"></i>`);
          }
        } catch (error) {
          console.error(`Error deleting records in ${model.modelName}: `, error);
        }
      }
  
      res.json({
        success: true,
        message: 'Η συμβάση και όλες οι σχετικές εγγραφές διαγράφηκαν επιτυχώς.',
        redirectUrl: "/symbaseis/symbaseis",
        results: deletionResults, // Επιστρέφουμε τα αποτελέσματα της διαγραφής
      });
    } catch (error) {
      console.error('Σφάλμα κατά την επεξεργασία της αίτησης: ', error);
      res.status(500).json({ message: 'Σφάλμα κατά την επεξεργασία της αίτησης.' });
    }
  };
  
  // ================================== Κατηγορίες Συμβάσεων =====================================

  static mainKathgoriesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Κατηγοριών Συμβάσεων",
      description: "Web Payroll System",
    };
    const sessionUserId = req.session.userId;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "KathgoriesSymbaseon",
      }).exec();

      res.render("symbaseis/kathgories/kathgories", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: 1,
        pages: 1,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static loadKathgoriesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Κατηγοριών Συμβάσεων",
      description: "Web Payroll System",
    };
    const symbash_kodikos = req.params.symbashId;

    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "KathgoriesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash: symbash_kodikos,
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await KathgoriesSymbaseonModel.aggregate(
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
            afora_thn_symbash: symbash_kodikos,
          },
        },
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

      const kathgoriesSymbaseon = await KathgoriesSymbaseonModel.aggregate(
        queryPipeline
      ).exec();

      const responseData = {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page, 
        pages: totalPages,
        kathgoriesSymbaseon 
      };
  
      res.json(responseData);
    } catch (error) {
      console.log(error);
    }
  };

  static addKathgoriesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Προσθήκη Νέας Κατηγορίας",
      description: "Web Payroll System",
    };
    
    let aa_kodikos = null;
    let aa_value = null;

    try {
      const countPipeline = [
        {
          $count: "total",
        },
      ];

      const countResults = await KathgoriesSymbaseonModel.aggregate(
        countPipeline
      ).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      if (totalRecords !== null) {
        totalRecords++;
      } else {
        totalRecords = 1;
      }
      aa_value = totalRecords;

      const kodikos_symbashs = req.params.kodikosSymbashs;
      const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs})

      const lastRecord_kathgorias_symbashs = await KathgoriesSymbaseonModel.find({ afora_thn_symbash: kodikos_symbashs })
        .sort({ _id: -1 })
        .limit(1);

      let kodValue = lastRecord_kathgorias_symbashs[0] && lastRecord_kathgorias_symbashs[0].kodikos ? parseInt(lastRecord_kathgorias_symbashs[0].kodikos, 10) : null;
      if (kodValue !== null) {
        kodValue++;
      } else {
        kodValue = 1;
      }
      aa_kodikos = kodValue;
      res.render("symbaseis/kathgories/add", {
        locals,
        aa_value,
        aa_kodikos,
        symbash,
      });
    } catch (error) {
      console.log("Σφάλμα :", error);
    }
  };

  static postKathgoriesSymbaseonForm = async (req, res) => {
    const formData = req.body;

    const newKathgoria = KathgoriesSymbaseonModel({
      aa: formData.aa,
      kodikos: formData.kodikos,
      perigrafh: formData.perigrafh,
      afora_thn_symbash: formData.afora_thn_symbash,
    });

    try {
      await KathgoriesSymbaseonModel.create(newKathgoria);
      res.json({ success: true, redirectUrl: "/symbaseis/kathgories" });
    } catch (error) {
      console.log(error);
    }
  };

  static searchPostKathgoriesSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κατηγοριών Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = req.body.searchTerm;
      let selectedSymbash = req.body.selected_Symbash;

      const sessionUserId = req.session.userId;
      const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9()]/g, "");
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      let sTerm = searchNoSpecialChar;
      nextPageSearchTerm = searchNoSpecialChar;
      nextPageSelectedSymbash = selectedSymbash;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "KathgoriesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash: selectedSymbash,
          },
        },
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

      const countResults = await KathgoriesSymbaseonModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const kathgoriesSymbaseonFilteredRecs = await KathgoriesSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash: selectedSymbash,
          },
        },
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
            ]
          }
        }
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = kathgoriesSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        perigrafh: this.highlightText(record.perigrafh, sTerm),
      }));

      res.render("symbaseis/Kathgories/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash,
        kathgoriesSymbaseonFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetKathgoriesSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Κατηγοριών Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = nextPageSearchTerm;
      let selectedSymbash = nextPageSelectedSymbash;

      const sessionUserId = req.session.userId;
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "KathgoriesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash: selectedSymbash,
          },
        },
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

      const countResults = await KathgoriesSymbaseonModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const kathgoriesSymbaseonFilteredRecs = await KathgoriesSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash: selectedSymbash,
          },
        },
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
            ]
          }
        }
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = kathgoriesSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        perigrafh: this.highlightText(record.perigrafh, searchTerm),
      }));
  
      res.render("symbaseis/kathgories/search", {
        kathgoriesSymbaseonFilteredRecs: highlightedRecords,
        locals,
        current: page,
        pages: totalPages,
        userPrivileges,
        sTerm: searchTerm,
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static editKathgoriesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Συντήρηση Κατηγοριών Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      const kathgoriesId = req.params.id;
      const kathgories = await KathgoriesSymbaseonModel.findById(kathgoriesId);

      const symbaseis = await SymbaseisModel.findOne({ kodikos: kathgories.afora_thn_symbash })
      res.render("symbaseis/kathgories/edit", {
        locals,
        symbaseis,
        kathgories,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postKathgoriesSymbaseonUpdate = async (req, res) => {
    const kathgoriesId = req.params.kathgoriesId;
    const formData = req.body;

    const filteredDataKathgoriesSymbaseon = {
      perigrafh: formData.perigrafh,
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataKathgoriesSymbaseon στη $set: για ενημέρωση
    await KathgoriesSymbaseonModel.findOneAndUpdate(
      { _id: kathgoriesId },
      { $set: filteredDataKathgoriesSymbaseon },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/symbaseis/kathgories" });
    } catch (error) {
      throw error;
    }
  };

  static deleteKathgoriesSymbaseon = async (req, res) => {
    try {
      const kathgoriesId = req.params.id;
      const kathgories = await KathgoriesSymbaseonModel.findById(kathgoriesId);
      if (!kathgories) {
        return res.status(404).json({ message: 'Συμβάση δεν βρέθηκε.' });
      }
  
      const tmpKodikos = kathgories.afora_thn_symbash.toString() + kathgories.kodikos.toString();
      // Δημιουργία ενός regex pattern που αντιστοιχεί στον κωδικό συμβάσεως στην αρχή του string
      const pattern = new RegExp(`^${tmpKodikos}`);
  
      await KathgoriesSymbaseonModel.deleteOne({ _id: kathgoriesId });
  
      const deletionResults = [];

      // Πίνακας με τα μοντέλα και τα αντίστοιχα πεδία για διαγραφή
      const modelsToDeleteFrom = [
        { model: EidikothtesAnaKathgoriaSymbaseonModel, field: 'afora_thn_symbash_kathgoria', pattern, modelNameInGreek: "Ειδικότητες Κατηγορίας Συμβάσεων" },
        { model: StoixeiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta', pattern, modelNameInGreek: "Στοιχεία Συμβάσεων" },
        { model: KlimakiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta_stoixeio', pattern, modelNameInGreek: "Κλιμάκια Συμβάσεων" },
      ];
  
      for (const { model, field, pattern } of modelsToDeleteFrom) {
        try {
          const result = await model.deleteMany({ [field]: pattern });
          if (result.deletedCount > 0) {
            deletionResults.push(`${model.modelName} Εγγραφές: ${result.deletedCount} <i class="bi bi-check cgreen"></i>`);
          }
        } catch (error) {
          console.error(`Error deleting records in ${model.modelName}: `, error);
        }
      }
  
      res.json({
        success: true,
        message: 'Η κατηγορία συμβάσης και όλες οι σχετικές εγγραφές διαγράφηκαν επιτυχώς.',
        redirectUrl: "/symbaseis/kathgories",
        results: deletionResults, // Επιστρέφουμε τα αποτελέσματα της διαγραφής
      });
    } catch (error) {
      console.error('Σφάλμα κατά την επεξεργασία της αίτησης: ', error);
      res.status(500).json({ message: 'Σφάλμα κατά την επεξεργασία της αίτησης.' });
    }
  };
  
  // ================================== Ειδικότητες Συμβάσεων ====================================

  static mainEidikothtesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Ειδικοτήτων Συμβάσεων",
      description: "Web Payroll System",
    };
    const sessionUserId = req.session.userId;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "KathgoriesSymbaseon",
      }).exec();

      res.render("symbaseis/eidikothtes/eidikothtes", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: 1,
        pages: 1,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static loadEidikothtesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Ειδικοτήτων Συμβάσεων",
      description: "Web Payroll System",
    };
    const symbash_kathgoria = req.params.symbash_kathgoria;

    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "EidikothtesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria: symbash_kathgoria,
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate(
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
            afora_thn_symbash_kathgoria: symbash_kathgoria,
          },
        },
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

      const eidikothtesSymbaseon = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate(
        queryPipeline
      ).exec();

      const responseData = {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page, 
        pages: totalPages,
        eidikothtesSymbaseon 
      };
  
      res.json(responseData);
    } catch (error) {
      console.log(error);
    }
  };

  static searchPostEidikothtesSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Ειδικοτήτων Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = req.body.searchTerm;
      let selectedSymbash = req.body.selected_Symbash;
      let selectedKathgoria = req.body.selected_Kathgoria;
      let selectedSymbash_Kathgoria = selectedSymbash.toString()+selectedKathgoria.toString();
      const sessionUserId = req.session.userId;
      const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9()]/g, "");
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      let sTerm = searchNoSpecialChar;
      nextPageSearchTerm = searchNoSpecialChar;
      nextPageSelectedSymbash_Kathgoria = selectedSymbash_Kathgoria;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "EidikothtesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria: selectedSymbash_Kathgoria,
          },
        },
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

      const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const eidikothtesSymbaseonFilteredRecs = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash_kathgoria: selectedSymbash_Kathgoria,
          },
        },
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { perigrafh: { $regex: new RegExp(sTerm, "i") } },
            ]
          }
        }
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = eidikothtesSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        perigrafh: this.highlightText(record.perigrafh, sTerm),
      }));

      res.render("symbaseis/eidikothtes/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash_Kathgoria,
        eidikothtesSymbaseonFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetEidikothtesSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Ειδικοτήτων Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = nextPageSearchTerm;
      let selectedSymbash_Kathgoria = nextPageSelectedSymbash_Kathgoria;

      const sessionUserId = req.session.userId;
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "EidikothtesSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria: selectedSymbash_Kathgoria,
          },
        },
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

      const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const eidikothtesSymbaseonFilteredRecs = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash_kathgoria: selectedSymbash_Kathgoria,
          },
        },
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
            ]
          }
        }
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = eidikothtesSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        perigrafh: this.highlightText(record.perigrafh, searchTerm),
      }));
  
      res.render("symbaseis/eidikothtes/search", {
        eidikothtesSymbaseonFilteredRecs: highlightedRecords,
        locals,
        current: page,
        pages: totalPages,
        userPrivileges,
        sTerm: searchTerm,
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash_Kathgoria,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static addEidikothtesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Προσθήκη Νέας Ειδικότητας",
      description: "Web Payroll System",
    };
    
    let aa_kodikos = null;
    let aa_value = null;

    try {
      const countPipeline = [
        {
          $count: "total",
        },
      ];

      const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate(
        countPipeline
      ).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      if (totalRecords !== null) {
        totalRecords++;
      } else {
        totalRecords = 1;
      }
      aa_value = totalRecords;

      const kodikos_symbashs_kathgorias = req.params.kodikosSymbashs_Kathgorias;
      const kodikos_symbashs = kodikos_symbashs_kathgorias.substring(0, 4);
      const kodikos_kathgorias = kodikos_symbashs_kathgorias.substring(4, 8);

      const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs})
      const kathgoria = await KathgoriesSymbaseonModel.find({ kodikos: kodikos_kathgorias, afora_thn_symbash: kodikos_symbashs})

      const lastRecord_eidikothtas_symbashs = await EidikothtesAnaKathgoriaSymbaseonModel.find({ afora_thn_symbash_kathgoria: kodikos_symbashs_kathgorias })
        .sort({ _id: -1 })
        .limit(1);

      let kodValue = lastRecord_eidikothtas_symbashs[0] && lastRecord_eidikothtas_symbashs[0].kodikos ? parseInt(lastRecord_eidikothtas_symbashs[0].kodikos, 10) : null;
      if (kodValue !== null) {
        kodValue++;
      } else {
        kodValue = 1;
      }
      aa_kodikos = kodValue;

      res.render("symbaseis/eidikothtes/add", {
        locals,
        aa_value,
        aa_kodikos,
        symbash,
        kathgoria
      });
    } catch (error) {
      console.log("Σφάλμα :", error);
    }
  };

  static postEidikothtesSymbaseonForm = async (req, res) => {
    const formData = req.body;

    const newEidikothta = EidikothtesAnaKathgoriaSymbaseonModel({
      aa: formData.aa,
      kodikos: formData.kodikos,
      perigrafh: formData.perigrafh,
      afora_thn_symbash_kathgoria: formData.afora_thn_symbash_kathgoria,
    });

    try {
      await EidikothtesAnaKathgoriaSymbaseonModel.create(newEidikothta);
      res.json({ success: true, redirectUrl: "/symbaseis/eidikothtes" });
    } catch (error) {
      console.log(error);
    }
  };

  static editEidikothtesSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Συντήρηση Ειδικοτήτων Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      const eidikothtesId = req.params.id;
      const eidikothtes = await EidikothtesAnaKathgoriaSymbaseonModel.findById(eidikothtesId);

      const symbaseis = await SymbaseisModel.findOne({ kodikos: eidikothtes.afora_thn_symbash_kathgoria.toString().substring(0, 4) })
      const kathgories = await KathgoriesSymbaseonModel.findOne({ afora_thn_symbash: eidikothtes.afora_thn_symbash_kathgoria.toString().substring(0, 4), kodikos: eidikothtes.afora_thn_symbash_kathgoria.toString().substring(4, 8) });

      res.render("symbaseis/eidikothtes/edit", {
        locals,
        symbaseis,
        kathgories,
        eidikothtes
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postEidikothtesSymbaseonUpdate = async (req, res) => {
    const eidikothtesId = req.params.eidikothtesId;
    const formData = req.body;

    const filteredDataEidikothtesSymbaseon = {
      perigrafh: formData.perigrafh,
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataEidikothtesSymbaseon στη $set: για ενημέρωση
    await EidikothtesAnaKathgoriaSymbaseonModel.findOneAndUpdate(
      { _id: eidikothtesId },
      { $set: filteredDataEidikothtesSymbaseon },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/symbaseis/eidikothtes" });
    } catch (error) {
      throw error;
    }
  };

  static deleteEidikothtesSymbaseon = async (req, res) => {
    try {
      const eidikothtesId = req.params.id;
      const eidikothtes = await EidikothtesAnaKathgoriaSymbaseonModel.findById(eidikothtesId);
      if (!eidikothtes) {
        return res.status(404).json({ message: 'H Ειδικότητα Σύμβασης δεν βρέθηκε.' });
      }
  
      const tmpKodikos = eidikothtes.afora_thn_symbash_kathgoria.toString().substring(0, 4) + eidikothtes.afora_thn_symbash_kathgoria.toString().substring(4, 8);
      // Δημιουργία ενός regex pattern που αντιστοιχεί στον κωδικό συμβάσεως στην αρχή του string
      const pattern = new RegExp(`^${tmpKodikos}`);
  
      await EidikothtesAnaKathgoriaSymbaseonModel.deleteOne({ _id: eidikothtesId });
  
      const deletionResults = [];

      // Πίνακας με τα μοντέλα και τα αντίστοιχα πεδία για διαγραφή
      const modelsToDeleteFrom = [
        { model: StoixeiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta', pattern, modelNameInGreek: "Στοιχεία Συμβάσεων" },
        { model: KlimakiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta_stoixeio', pattern, modelNameInGreek: "Κλιμάκια Συμβάσεων" },
      ];
  
      for (const { model, field, pattern } of modelsToDeleteFrom) {
        try {
          const result = await model.deleteMany({ [field]: pattern });
          if (result.deletedCount > 0) {
            deletionResults.push(`${model.modelName} Εγγραφές: ${result.deletedCount} <i class="bi bi-check cgreen"></i>`);
          }
        } catch (error) {
          console.error(`Error deleting records in ${model.modelName}: `, error);
        }
      }
  
      res.json({
        success: true,
        message: 'Η ειδικότητα συμβάσης και όλες οι σχετικές εγγραφές διαγράφηκαν επιτυχώς.',
        redirectUrl: "/symbaseis/eidikothtes",
        results: deletionResults, // Επιστρέφουμε τα αποτελέσματα της διαγραφής
      });
    } catch (error) {
      console.error('Σφάλμα κατά την επεξεργασία της αίτησης: ', error);
      res.status(500).json({ message: 'Σφάλμα κατά την επεξεργασία της αίτησης.' });
    }
  };
  
  // ================================== Στοιχεία Συμβάσεων =======================================

  static mainStoixeiaSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Στοιχείων Συμβάσεων",
      description: "Web Payroll System",
    };
    const sessionUserId = req.session.userId;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "StoixeiaSymbaseon",
      }).exec();

      res.render("symbaseis/stoixeiaSymbaseon/stoixeiaSymbaseon", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: 1,
        pages: 1,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static loadStoixeiaSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Διαχείριση Στοιχείων Συμβάσεων",
      description: "Web Payroll System",
    };
    const symbash_kathgoria_eidikothta = req.params.symbash_kathgoria_eidikothta;
    const page = req.query.page || 1;  // Προεπιλογή της σελίδας σε 1 αν δεν έχει δοθεί
    
    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "StoixeiaSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: symbash_kathgoria_eidikothta,
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await StoixeiaSymbaseonModel.aggregate(
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
            afora_thn_symbash_kathgoria_eidikothta: symbash_kathgoria_eidikothta,
          },
        },
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

      const stoixeia = await StoixeiaSymbaseonModel.aggregate(
        queryPipeline
      ).exec();

      const responseData = {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page, 
        pages: totalPages,
        stoixeia 
      };
  
      res.json(responseData);
    } catch (error) {
      console.log(error);
    }
  };

  static searchPostStoixeiaSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Στοιχείων Συμβάσεων",
      description: "Web Payroll System",
    };
  
    try {
      let searchTerm = req.body.searchTerm;
      let selectedSymbash = req.body.selected_Symbash;
      let selectedKathgoria = req.body.selected_Kathgoria;
      let selectedEidikothta = req.body.selected_Eidikothta;
      let selectedSymbash_Kathgoria_Eidikothta = selectedSymbash.toString() + selectedKathgoria.toString() + selectedEidikothta.toString();
      const sessionUserId = req.session.userId;
      const searchTerms = searchTerm.split('|').map(term => term.trim()).filter(term => term !== ''); // Διαχωρισμός του searchTerm σε πολλαπλά κριτήρια
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;
      let sTerm = searchTerms
      nextPageSearchTerm = searchTerms;
      nextPageSelectedSymbash_Kathgoria_Eidikothta = selectedSymbash_Kathgoria_Eidikothta;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "StoixeiaSymbaseon",
      }).exec();
  
      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: selectedSymbash_Kathgoria_Eidikothta,
            $or: searchTerms.map(term => ({ $or: [{ kodikos: { $regex: new RegExp(term, "i") } }, { perigrafh: { $regex: new RegExp(term, "i") } }] })),
          },
        },
        {
          $count: "total",
        },
      ];
  
      const countResults = await StoixeiaSymbaseonModel.aggregate(countPipeline).exec();
  
      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1));
      let skipRecords = Math.max(0, (page - 1) * perPage);
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const stoixeiaSymbaseonFilteredRecs = await StoixeiaSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: selectedSymbash_Kathgoria_Eidikothta,
            $or: searchTerms.map(term => ({ $or: [{ kodikos: { $regex: new RegExp(term, "i") } }, { perigrafh: { $regex: new RegExp(term, "i") } }] })),
          },
        }
      ])
      .sort({"kodikos": 1})
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = stoixeiaSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightTextMutliTerms(record.kodikos, searchTerms),
        perigrafh: this.highlightTextMutliTerms(record.perigrafh, searchTerms),
      }));
    
      res.render("symbaseis/stoixeiaSymbaseon/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: searchTerm,  // Χρήση του αρχικού searchTerm για εμφάνιση
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash_Kathgoria_Eidikothta,
        stoixeiaSymbaseonFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };
    
  static searchGetStoixeiaSymbaseon = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Στοιχείων Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      const searchTerms = nextPageSearchTerm;
      let selectedSymbash_Kathgoria_Eidikothta = nextPageSelectedSymbash_Kathgoria_Eidikothta;

      const sessionUserId = req.session.userId;
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "StoixeiaSymbaseon",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: selectedSymbash_Kathgoria_Eidikothta,
            $or: searchTerms.map(term => ({ $or: [{ kodikos: { $regex: new RegExp(term, "i") } }, { perigrafh: { $regex: new RegExp(term, "i") } }] })),
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await StoixeiaSymbaseonModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const stoixeiaSymbaseonFilteredRecs = await StoixeiaSymbaseonModel.aggregate([
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: selectedSymbash_Kathgoria_Eidikothta,
          },
        },
        {
          $match: {
            afora_thn_symbash_kathgoria_eidikothta: selectedSymbash_Kathgoria_Eidikothta,
            $or: searchTerms.map(term => ({ $or: [{ kodikos: { $regex: new RegExp(term, "i") } }, { perigrafh: { $regex: new RegExp(term, "i") } }] })),
          },
        }
      ])
      .sort({"kodikos": 1})
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = stoixeiaSymbaseonFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightTextMutliTerms(record.kodikos, searchTerms),
        perigrafh: this.highlightTextMutliTerms(record.perigrafh, searchTerms),
      }));
  
      res.render("symbaseis/stoixeiaSymbaseon/search", {
        stoixeiaSymbaseonFilteredRecs: highlightedRecords,
        locals,
        current: page,
        pages: totalPages,
        userPrivileges,
        sTerm: searchTerms,
        entries: perPage,
        totalRecs: totalRecords,
        selectedSymbash_Kathgoria_Eidikothta,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static addStoixeiaSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Προσθήκη Νέου Στοιχείου",
      description: "Web Payroll System",
    };  
    
    const kodikos_symbashs_kathgorias_eidikothtas = req.params.kodikosSymbashs_Kathgorias_Eidikothtas;
    
    let aa_kodikos = null;
    // try {
      const kodikos_symbashs_kathgorias = kodikos_symbashs_kathgorias_eidikothtas.substring(0, 8);
      const kodikos_symbashs = kodikos_symbashs_kathgorias_eidikothtas.substring(0, 4);
      const kodikos_kathgorias = kodikos_symbashs_kathgorias_eidikothtas.substring(4, 8);
      const kodikos_eidikothtas = kodikos_symbashs_kathgorias_eidikothtas.substring(8, 12);

      const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs})
      const kathgoria = await KathgoriesSymbaseonModel.find({ kodikos: kodikos_kathgorias, afora_thn_symbash: kodikos_symbashs})
      const eidikothta = await EidikothtesAnaKathgoriaSymbaseonModel.find({ kodikos: kodikos_eidikothtas, afora_thn_symbash_kathgoria: kodikos_symbashs_kathgorias})

      const lastRecord_stoixeia_symbashs = await StoixeiaSymbaseonModel.find({ afora_thn_symbash_kathgoria_eidikothta: kodikos_symbashs_kathgorias_eidikothtas })
        .sort({ _id: -1 })
        .limit(1);

      let kodValue = lastRecord_stoixeia_symbashs[0] && lastRecord_stoixeia_symbashs[0].kodikos ? parseInt(lastRecord_stoixeia_symbashs[0].kodikos, 10) : null;  
      if (kodValue !== null) {
        kodValue++;
      } else {
        kodValue = 1;
      }  
      aa_kodikos = kodValue;

      res.render("symbaseis/stoixeiaSymbaseon/add", {
        locals,
        // aa_value,
        aa_kodikos,
        symbash,
        kathgoria, 
        eidikothta
      });  
    // } catch (error) {
    //   console.log("Σφάλμα :", error);
    // }  
  };  

  static postStoixeiaSymbaseonForm = async (req, res) => {
    const formData = req.body;

    const newStoixeio = StoixeiaSymbaseonModel({
      kodikos: formData.kodikos,
      perigrafh: formData.perigrafh,
      afora_thn_symbash_kathgoria_eidikothta: formData.afora_thn_symbash_kathgoria_eidikothta,
      poso_pososto: formData.poso_pososto,
      arithmos_klimakion: formData.arithmos_klimakion,
      ypologismos_apo_klimakio: formData.ypologismos_apo_klimakio,
      bhma_ypologismoy: formData.bhma_ypologismoy,
      poso: formData.poso,
      pososto: formData.pososto,
      typos_ypologismoy: formData.typos_ypologismoy,
    });

    try {
      await StoixeiaSymbaseonModel.create(newStoixeio);
      res.json({ success: true, redirectUrl: "/symbaseis/stoixeiaSymbaseon" });
    } catch (error) {
      console.log(error);
    }
  };

  static editStoixeiaSymbaseonForm = async (req, res) => {
    const locals = {
      title: "Συντήρηση Στοιχείων Συμβάσεων",
      description: "Web Payroll System",
    };

    try {
      const stoixeiaSymbaseonId = req.params.id; 
      const stoixeiaSymbaseon = await StoixeiaSymbaseonModel.findById(stoixeiaSymbaseonId);

      const symbaseis = await SymbaseisModel.findOne({ kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 4) })
      const kathgories = await KathgoriesSymbaseonModel.findOne({ afora_thn_symbash: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 4), kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(4, 8) });
      const eidikothtes = await EidikothtesAnaKathgoriaSymbaseonModel.findOne({ afora_thn_symbash_kathgoria: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 8), kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(8, 12) });
      
      res.render("symbaseis/stoixeiaSymbaseon/edit", {
        locals,
        symbaseis,
        kathgories,
        eidikothtes,
        stoixeiaSymbaseon,
        stoixeiaSymbaseonId,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postStoixeiaSymbaseonUpdate = async (req, res) => {
    const stoixeiaSymbaseonId = req.params.stoixeiaSymbaseonId;
    const formData = req.body;

    const filteredDataStoixeiaSymbaseon = {
      kodikos: formData.kodikos,
      perigrafh: formData.perigrafh,
      afora_thn_symbash_kathgoria_eidikothta: formData.afora_thn_symbash_kathgoria_eidikothta,
      poso_pososto: formData.poso_pososto,
      arithmos_klimakion: formData.arithmos_klimakion,
      ypologismos_apo_klimakio: formData.ypologismos_apo_klimakio,
      bhma_ypologismoy: formData.bhma_ypologismoy,
      poso: formData.poso,
      pososto: formData.pososto,
      typos_ypologismoy: formData.typos_ypologismoy,
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataStoixeiaSymbaseon στη $set: για ενημέρωση
    await StoixeiaSymbaseonModel.findOneAndUpdate(
      { _id: stoixeiaSymbaseonId },
      { $set: filteredDataStoixeiaSymbaseon },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/symbaseis/stoixeiaSymbaseon" });
    } catch (error) {
      throw error;
    }
  };

  static deleteStoixeiaSymbaseon = async (req, res) => {
    try {
      const stoixeiaSymbaseonId = req.params.id;
      const stoixeiaSymbaseon = await StoixeiaSymbaseonModel.findById(stoixeiaSymbaseonId);
      if (!stoixeiaSymbaseon) {
        return res.status(404).json({ message: 'Το Στοιχείο Σύμβασης δεν βρέθηκε.' });
      }
  
      const tmpKodikos = stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString();
      // Δημιουργία ενός regex pattern που αντιστοιχεί στον κωδικό συμβάσεως στην αρχή του string
      const pattern = new RegExp(`^${tmpKodikos}`);
  
      await StoixeiaSymbaseonModel.deleteOne({ _id: stoixeiaSymbaseonId });
  
      const deletionResults = [];

      // Πίνακας με τα μοντέλα και τα αντίστοιχα πεδία για διαγραφή
      const modelsToDeleteFrom = [
        { model: KlimakiaSymbaseonModel, field: 'afora_thn_symbash_kathgoria_eidikothta_stoixeio', pattern, modelNameInGreek: "Κλιμάκια Συμβάσεων" },
      ];
  
      for (const { model, field, pattern } of modelsToDeleteFrom) {
        try {
          const result = await model.deleteMany({ [field]: pattern });
          if (result.deletedCount > 0) {
            deletionResults.push(`${model.modelName} Εγγραφές: ${result.deletedCount} <i class="bi bi-check cgreen"></i>`);
          }
        } catch (error) {
          console.error(`Error deleting records in ${model.modelName}: `, error);
        }
      }
  
      res.json({
        success: true,
        message: 'Το Στοιχείο Σύμβασης και όλες οι σχετικές εγγραφές διαγράφηκαν επιτυχώς.',
        redirectUrl: "/symbaseis/stoixeiaSymbaseon",
        results: deletionResults, // Επιστρέφουμε τα αποτελέσματα της διαγραφής
      });
    } catch (error) {
      console.error('Σφάλμα κατά την επεξεργασία της αίτησης: ', error);
      res.status(500).json({ message: 'Σφάλμα κατά την επεξεργασία της αίτησης.' });
    }
  };

  // ================================== Κλιμάκια Συμβάσεων =======================================

  // ================================== Υπολογισμοί Κλιμακίων ====================================

  static mainYpologismoiForm = async (req, res) => {
    const locals = {
      title: "YpologismoiKlimakion",
      description: "Web Payroll System",
    };

    const companyId = req.session.companyInUse;
    const sessionUserId = req.session.userId;
    const perPage = Number(process.env.EGGRAFES);
    let page = req.query.page || 1;

    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "YpologismoiKlimakionSymbaseon",
      }).exec();

      res.render("symbaseis/ypologismoiKlimakion/ypologismoiKlimakion", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postKlimakiaSymbaseon = async (req, res) => {
    // για κάθε αντικείμενο στο req.body, δημιουργούμε μια εργασία updateOne για την bulkWrite() λειτουργία. Κάθε updateOne προσδιορίζει ένα filter για τον εντοπισμό της εγγραφής προς ενημέρωση και ένα update object με την εντολή $set για την ενημέρωση των πεδίων της εγγραφής. Η επιλογή upsert: true υποδηλώνει ότι, αν δεν βρεθεί εγγραφή που να ταιριάζει με το filter, τότε να δημιουργηθεί μια νέα εγγραφή με τα δεδομένα που προσδιορίζονται στο update.
    try {
      const bulkOps = req.body.map((update) => ({
        updateOne: {
          filter: {
            kodikos_symbashs: update.kodikos_symbashs,
            kodikos_kathgorias_symbashs: update.kodikos_kathgorias_symbashs,
            kodikos_eidikothtas_symbashs: update.kodikos_eidikothtas_symbashs,
            kodikos_stoixeioy: update.kodikos_stoixeioy,
            klimakio: update.klimakio,
            isxyei_apo: new Date(update.isxyei_apo),
            isxyei_eos: new Date(update.isxyei_eos),
            afora_thn_symbash: update.afora_thn_symbash,
            afora_thn_symbash_kathgoria: update.afora_thn_symbash_kathgoria,
            afora_thn_symbash_kathgoria_eidikothta: update.afora_thn_symbash_kathgoria_eidikothta,
            afora_thn_symbash_kathgoria_eidikothta_stoixeio: update.afora_thn_symbash_kathgoria_eidikothta_stoixeio,
          },
          update: { $set: update },
          upsert: true
        }
      }));
    
      // Εκτέλεση του bulkWrite με τις προετοιμασμένες λειτουργίες
      const result = await KlimakiaSymbaseonModel.bulkWrite(bulkOps);
    
      res.json({ success: true, redirectUrl: "/symbaseis/ypologismoiKlimakion" });
    } catch (error) {
      console.error('Error during bulk update:', error);
      res.status(500).json({ message: 'Σφάλμα κατά την ενημέρωση' });
    }
  };

  // ================================== Υπολογισμοί Αποδοχών ====================================

  static calcApodoxesErgazomenon = async (req, res) => {
    const { contract, category, specialty, selectedElement, klimakio, date } = req.body;
    const userDate = new Date(date);

    const genikesParametroi = await GenikesParametroiModel.find().sort({ kodikos: 1 }).lean();

    const queryPipeline = [
      {
        $match: {
          afora_thn_symbash_kathgoria_eidikothta_stoixeio: contract + category + specialty + selectedElement,
          klimakio: klimakio,
          isxyei_apo: { $lte: userDate },
          isxyei_eos: { $gte: userDate }
        },
      },
    ];

    try {
      let klimakia = await KlimakiaSymbaseonModel.aggregate(queryPipeline).exec();

      if (klimakia.length === 0) {
        // Εκτέλεση ενός δεύτερου query χωρίς τους περιορισμούς ημερομηνίας
        const fallbackQuery = [
          {
            $match: {
              afora_thn_symbash_kathgoria_eidikothta_stoixeio: contract + category + specialty + selectedElement,
              klimakio: klimakio
            }
          },
          {
            $sort: { isxyei_apo: -1 } // Ταξινόμηση κατά την ημερομηνία έναρξης φθίνουσα
          },
          {
            $limit: 1 // Λήψη μόνο της πιο πρόσφατης εγγραφής
          }
        ];
        klimakia = await KlimakiaSymbaseonModel.aggregate(fallbackQuery).exec();
      }

      if (klimakia.length === 0) {
        res.json({ success: false });
        return;
      }

      res.json({ success: true, poso: parseFloat(klimakia[0].poso).toFixed(2), genikesParametroi });
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).send('Server error');
    }
  }
  
  // ================================== Φόρτωση Κρατήσεων =======================================

  static getKrathseisErgazomenon = async (req, res) => {
    try {
      const krathseis = await KrathseisModel.find()
                                            .select('kodikos perigrafh')
                                            .sort({ kodikos: 1 });
      res.json(krathseis);
    } catch (error) {
      res.status(500).send(error.message);
    }
  };
  

  // ================================== HighLightText for Search =================================
  
  static highlightText(text, term) {
    if (!text) return ""; // Επιστρέφει ένα κενό string αν το text είναι falsy (π.χ., undefined, null, '')
    const highlightStartTag = "<span class='highlight'>";
    const highlightEndTag = "</span>";
    const regex = new RegExp(`(${term})`, "gi");
    return text.replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
  }

  static highlightTextMutliTerms(text, searchTerms) {
    // Εφαρμογή επισήμανσης για όλους τους όρους
    searchTerms.forEach(term => {
      text = text.replace(new RegExp(term, 'gi'), (match) => `<mark>${match}</mark>`);
    });
    return text;
  }
  
}

module.exports = symbaseisController;
