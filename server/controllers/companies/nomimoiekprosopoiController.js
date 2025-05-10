import mongoose from "mongoose";
import Models_B from "../../models/privileges.js";
import Models_C from "../../models/companies.js";
import Models from "../../models/stathera_arxeia.js";
import formatNumber from "../../../public/js/common/formatNumber.js"

const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, NomimoiEkprosopoiModel } = Models_C;
const { PerifereiesModel } = Models;

let nextPageSearchTerm = "";

class nomimoiekprosopoiController {

  static mainNomimoiEkprosopoiForm = async (req, res) => {
    const locals = {
      title: "Νόμιμοι Εκπρόσωποι",
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
        form: "NomimoiEkprosopoi",
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

      const countResults = await NomimoiEkprosopoiModel.aggregate(
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
          $lookup: {
            //                  INNER JOIN
            from: "idiothtes", // Επεξηγήσεις στο NomimoiEkprosopoiController
            localField: "idiothta",
            foreignField: "kodikos",
            as: "idiothtaInfo",
          },
        },
        {
          $unwind: "$idiothtaInfo",
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

      const nomimoiekprosopoi = await NomimoiEkprosopoiModel.aggregate(
        queryPipeline
      ).exec();

      res.render("companies/nomimoi_ekprosopoi/nomimoi_ekprosopoi", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        current: page,
        pages: totalPages,
        company,
        nomimoiekprosopoi,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static addNomimoiEkprosopoiForm = async (req, res) => {
    const sessionUserTeam = req.session.userTeam;
    const sessionCompanyInUse = req.session.companyInUse;
    const locals = {
      title: "Προσθήκη Νέου Νόμιμου Εκπρόσωπου",
      description: "Web Payroll System",
    };

    try {
      const company = await CompaniesModel.findOne({
        _id: sessionCompanyInUse,
      });

      const data = await PerifereiesModel.find().sort("kodikos");
      res.render("companies/nomimoi_ekprosopoi/add", {
        locals,
        company,
        data,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postNomimoiEkprosopoiForm = async (req, res) => {
    let aa_kod = null;
    const formData = req.body;

    try {
      const lastRecord = await NomimoiEkprosopoiModel.find({
        team: formData.companyTeam,
        companykod: formData.companyKodikos,
      })
        .sort({ _id: -1 })
        .limit(1);

      let kodValue = lastRecord[0] && lastRecord[0].kodikos ? parseInt(lastRecord[0].kodikos, 10) : null;
      if (kodValue !== null) {
        kodValue++;
      } else {
        kodValue = 1;
      }
      aa_kod = kodValue;
    } catch (error) {
      console.log("Σφάλμα :", error);
    }
    const newNomimosEkprosopos = NomimoiEkprosopoiModel({
      team: formData.companyTeam,
      companykod_object: formData.companyId,
      companykod: formData.companyKodikos,
      kodikos: formatNumber(aa_kod, 4),
      nomiko_prosopo: formData.nomiko_prosopo,
      nomikh_morfh: (formData.nomikh_morfh = formData.nomikh_morfh === null || formData.nomikh_morfh === "" ? "" : formData.nomikh_morfh),
      eponymia: formData.eponymia,
      onoma: formData.onoma,
      eponymo_patera: formData.eponymo_patera,
      onoma_patera: formData.onoma_patera,
      onoma_mhteras: formData.onoma_mhteras,
      eponymo_syzygoy: formData.eponymo_syzygoy,
      onoma_syzygoy: formData.onoma_syzygoy,
      hmnia_gennhshs: formData.hmnia_gennhshs,
      topos_gennhshs: formData.topos_gennhshs,
      perifereia: (formData.perifereies = formData.perifereies === null || formData.perifereies === "" ? "00" : formData.perifereies),
      nomos: (formData.nomos = formData.nomos === null || formData.nomos === "" ? "0000" : formData.nomos),
      dhmos: (formData.dhmos = formData.dhmos === null || formData.dhmos === "" ? "0000" : formData.dhmos),
      polh: (formData.polh = formData.polh === null || formData.polh === "" ? "00000000" : formData.polh),
      odos: formData.odos,
      arithmos: formData.arithmos,
      tk: formData.tk,
      thlefono: formData.thlefono,
      email: formData.email,
      typos_taytothtas: formData.typos_taytothtas,
      arithmos_taytothtas: formData.arithmos_taytothtas,
      hmnia_ekdoshs: formData.hmnia_ekdoshs,
      arxh_ekdoshs: formData.arxh_ekdoshs,
      afm: formData.afm,
      doy: formData.doy,
      ame: formData.ame,
      idiothta: formData.idiothta,
      hmnia_enarjhs_idiothtas: formData.hmnia_enarjhs_idiothtas,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      await NomimoiEkprosopoiModel.create(newNomimosEkprosopos);
      res.json({ success: true, redirectUrl: "/companies/nomimoi_ekprosopoi" });
    } catch (error) {
      console.log(error);
    }
  };

  static searchGetNomimoiEkprosopoi = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Νόμιμων Εκπροσώπων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = nextPageSearchTerm      //req.body.searchTerm;

      const sessionUserTeam = req.session.userTeam;
      const sessionUserId = req.session.userId;
      const sessionCompanyInUse = req.session.companyInUse;
      // const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, "");
      const perPage = Number(process.env.EGGRAFES);
      let page = req.query.page || 1;

      // try {
      // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "NomimoiEkprosopoi",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $lookup: {
            from: "idiothtes",
            localField: "idiothta",
            foreignField: "kodikos",
            as: "idiothtaInfo"
          }
        },
        {
          $unwind: {
            path: "$idiothtaInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            // team: sessionUserTeam,
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { eponymia: { $regex: new RegExp(searchTerm, "i") } },
              { onoma: { $regex: new RegExp(searchTerm, "i") } },
              { onoma_patera: { $regex: new RegExp(searchTerm, "i") } },
              { "idiothtaInfo.perigrafh": { $regex: new RegExp(searchTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της πόλης
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await NomimoiEkprosopoiModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

      // Αναζήτηση και επισήμανση
      const nomimoiekprosopoiFilteredRecs = await NomimoiEkprosopoiModel.aggregate([
        {
          $lookup: {
            from: "idiothtes",
            localField: "idiothta",
            foreignField: "kodikos",
            as: "idiothtaInfo"
          }
        },
        {
          $unwind: {
            path: "$idiothtaInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            $or: [
              { kodikos: { $regex: new RegExp(searchTerm, "i") } },
              { eponymia: { $regex: new RegExp(searchTerm, "i") } },
              { onoma: { $regex: new RegExp(searchTerm, "i") } },
              { onoma_patera: { $regex: new RegExp(searchTerm, "i") } },
              { "idiothtaInfo.perigrafh": { $regex: new RegExp(searchTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της πόλης
            ]
          }
        }
      ]).skip(skipRecords).limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = nomimoiekprosopoiFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, searchTerm),
        eponymia: this.highlightText(record.eponymia, searchTerm),
        onoma: this.highlightText(record.onoma, searchTerm),
        onoma_patera: this.highlightText(record.onoma_patera, searchTerm),
        idiothtaPerigrafh: record.idiothtaInfo ? this.highlightText(record.idiothtaInfo.perigrafh, searchTerm) : ""
      }));
  
      res.render("companies/nomimoi_ekprosopoi/search", {
        nomimoiekprosopoiFilteredRecs: highlightedRecords,
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

  static searchPostNomimoiEkprosopoi = async (req, res) => {
    const locals = {
      title: "Αναζήτηση Νομίμων Εκπρόσώπων",
      description: "Web Payroll System",
    };

    try {
      let searchTerm = req.body.searchTerm;

      const sessionUserTeam = req.session.userTeam;
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
        form: "NomimoiEkprosopoi",
      }).exec();

      // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
      const countPipeline = [
        {
          $lookup: {
            from: "idiothtes",
            localField: "idiothta",
            foreignField: "kodikos",
            as: "idiothtaInfo"
          }
        },
        {
          $unwind: {
            path: "$idiothtaInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { eponymia: { $regex: new RegExp(sTerm, "i") } },
              { onoma: { $regex: new RegExp(sTerm, "i") } },
              { onoma_patera: { $regex: new RegExp(sTerm, "i") } },
              { "idiothtaInfo.perigrafh": { $regex: new RegExp(sTerm, "i") } }
            ]
          },
        },
        {
          $count: "total",
        },
      ];

      const countResults = await NomimoiEkprosopoiModel.aggregate(countPipeline).exec();

      let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
      let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
      let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
      let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
      

      // Αναζήτηση και επισήμανση
      const nomimoiekprosopoiFilteredRecs = await NomimoiEkprosopoiModel.aggregate([
        {
          $lookup: {
            from: "idiothtes",
            localField: "idiothta",
            foreignField: "kodikos",
            as: "idiothtaInfo"
          }
        },
        {
          $unwind: {
            path: "$idiothtaInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            companykod_object: sessionCompanyInUse,
            $or: [
              { kodikos: { $regex: new RegExp(sTerm, "i") } },
              { eponymia: { $regex: new RegExp(sTerm, "i") } },
              { onoma: { $regex: new RegExp(sTerm, "i") } },
              { onoma_patera: { $regex: new RegExp(sTerm, "i") } },
              { "idiothtaInfo.perigrafh": { $regex: new RegExp(sTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της ιδιότητας
            ]
          }
        }
      ])
      .skip(skipRecords)
      .limit(limitPerPage);
  
      // Εφαρμογή της επισήμανσης
      const highlightedRecords = nomimoiekprosopoiFilteredRecs.map((record) => ({
        ...record,
        kodikos: this.highlightText(record.kodikos, sTerm),
        eponymia: this.highlightText(record.eponymia, sTerm),
        onoma: this.highlightText(record.onoma, sTerm),
        onoma_patera: this.highlightText(record.onoma_patera, sTerm),
        idiothtaPerigrafh: record.idiothtaInfo ? this.highlightText(record.idiothtaInfo.perigrafh, sTerm) : ""
      }));

      res.render("companies/nomimoi_ekprosopoi/search", {
        userPrivileges,
        locals,
        current: page,
        pages: totalPages,
        sTerm: sTerm,
        entries: perPage,
        totalRecs: totalRecords,
        nomimoiekprosopoiFilteredRecs: highlightedRecords,
      });
    } catch (error) {
      console.log(error);
    }
  };

  //     // Υποθετική υλοποίηση της highlightText. Θα πρέπει να προσαρμόσετε αυτή τη συνάρτηση.
  //     // const highlightText = (text, term) => {
  //     //   return text.replace(new RegExp(term, "gi"), match => `<mark>${match}</mark>`);
  //     // };

  static editNomimoiEkprosopoiForm = async (req, res) => {
    const messages = await req.flash("info");
    const locals = {
      title: "Συντήρηση Νομ.Εκπροσώπων",
      description: "Web Payroll System",
    };

    try {
      const perifereies = await PerifereiesModel.find().sort("perigrafh");
      const nomimoiekprosopoiId = req.params.id;
      
      const nomimosEkprosopos = await NomimoiEkprosopoiModel.findById(nomimoiekprosopoiId);
      
      const company = await CompaniesModel.findOne({ team: nomimosEkprosopos.team, kod: nomimosEkprosopos.companykod });

      res.render("companies/nomimoi_ekprosopoi/edit", {
        locals,
        messages,
        perifereies,
        company, 
        nomimosEkprosopos,
      });
    } catch (error) {
      console.log(error);
    }
  };

  static postNomimoiEkprosopoiUpdate = async (req, res) => {
    const sessionUserTeam = req.session.userTeam;
    const nomimosEkprosoposId = req.params.nomimosEkprosoposId;
    const formData = req.body;

    const filteredDataNomimoiEkprosopoi = {
      nomiko_prosopo: formData.nomiko_prosopo,
      nomikh_morfh: formData.nomikh_morfh,
      eponymia: formData.eponymia,
      onoma: formData.onoma,
      eponymo_patera: formData.eponymo_patera,
      onoma_patera: formData.onoma_patera,
      onoma_mhteras: formData.onoma_mhteras,
      eponymo_syzygoy: formData.eponymo_syzygoy,
      onoma_syzygoy: formData.onoma_syzygoy,
      hmnia_gennhshs: formData.hmnia_gennhshs,
      topos_gennhshs: formData.topos_gennhshs,
      perifereia: (formData.perifereies = formData.perifereies === null || formData.perifereies === "" ? "00" : formData.perifereies),
      nomos: (formData.nomos = formData.nomos === null || formData.nomos === "" ? "0000" : formData.nomos),
      dhmos: (formData.dhmos = formData.dhmos === null || formData.dhmos === "" ? "0000" : formData.dhmos),
      polh: (formData.polh = formData.polh === null || formData.polh === "" ? "00000000" : formData.polh),
      odos: formData.odos,
      arithmos: formData.arithmos,
      tk: formData.tk,
      thlefono: formData.thlefono,
      email: formData.email,
      typos_taytothtas: formData.typos_taytothtas,
      arithmos_taytothtas: formData.arithmos_taytothtas,
      hmnia_ekdoshs: formData.hmnia_ekdoshs,
      arxh_ekdoshs: formData.arxh_ekdoshs,
      afm: formData.afm,
      doy: formData.doy,
      ame: formData.ame,
      idiothta: (formData.idiothta = formData.idiothta === null || formData.idiothta === "" ? "000" : formData.idiothta),
      hmnia_enarjhs_idiothtas: formData.hmnia_enarjhs_idiothtas,
      updatedAt:  Date.now(),
    };

    // Τώρα μπορώ να χρησιμοποιήσω το filteredDataCompany στη $set: για ενημέρωση
    await NomimoiEkprosopoiModel.findOneAndUpdate(
      { _id: nomimosEkprosoposId },
      { $set: filteredDataNomimoiEkprosopoi },
      { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
    );

    try {
      res.json({ success: true, redirectUrl: "/companies/nomimoi_ekprosopoi" });
    } catch (error) {
      throw error;
    }
  };

  static deleteNomimoiEkprosopoi = async (req, res) => {
    try {
      await NomimoiEkprosopoiModel.deleteOne({ _id: req.params.id });
      res.json({ success: true, redirectUrl: "/companies/nomimoi_ekprosopoi" });
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

export default nomimoiekprosopoiController;
