const mongoose = require("mongoose");
const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs-extra");
const { PDFDocument } = require("pdf-lib");

const Models_A = require("../../models/stathera_arxeia");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");
const Models_D = require("../../models/ergazomenoi");
const Models_E = require("../../models/kinhseis");

const { KathestosApasxolhshsModel,
        SxeseisErgasiasModel,
        OikogeneiakhKatastashModel,
        TypoiErgazomenonModel,
        Typoi_ApodoxonModel,
        ArgiesModel,
        GenikesParametroiModel,
        AsfalistikesKlaseisModel,
        KrathseisModel,
        PosostaKrathseonModel,
        KathgoriesAdeiasModel
      } = Models_A; 

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel,
        AntistoixiseisModel,
      } = Models_C;

const { ErgazomenoiModel,
        OrariaModel,
        OrariaFromCardsModel,
      } = Models_D;

const { ApoysiesModel,
        ApasxolhseisModel,
        AstheneiesModel,
        AdeiesModel
      } = Models_E;


// Έλεγχος αν είμαστε σε παραγωγή (production)
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;

// Έλεγχος και δημιουργία του φακέλου downloads αν δεν υπάρχει
const handleProductionDownloadPath = async () => {
  if (isProduction) {
    const downloadPath = '/tmp/downloads';

    const checkIfExists = async (path) => {
      try {
        await fs.access(path);
        console.log("Download path exists");
      } catch {
        console.warn("Download path does not exist. Creating...");
        await fs.mkdir(path, { recursive: true });
        await fs.chmod(path, 0o777);
      }
    };

    await checkIfExists(downloadPath);
  }
};

const fieldsStoixeionKrathseon = ['kodikos', 'krathsh', 'asfalistikesApodoxes', 'pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth', 'ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'plasmatikh_axia', 'apaiteitai_apodoxes_asfalishs', 'anotato_orio_palion', 'anotato_orio_neon', 'kad', 'eidikothta', 'kpk', 'se_typos_apodoxon', 'epa'];
const aa_krathseon = 7;
const numberFieldsKrathseon = new Set(['asfalistikesApodoxes', 'pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth', 'plasmatikh_axia', 'anotato_orio_palion', 'anotato_orio_neon']); // Ορίζουμε ποια fields είναι numbers
const booleanFieldsKrathseon = new Set(['ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'apaiteitai_apodoxes_asfalishs']);

const fieldsStoixeionAstheneion = ['apo_hmeromhnia_astheneias', 'eos_hmeromhnia_astheneias', 'idios_logos', 'days_less_3', 'days_greater_3', 'synolo_astheneias', 'adeia_kyhshs_loxeias', 'epidothsh_efka', 'apodoxes_astheneias', 'eidos_astheneias'];
const aa_astheneion = 5;
const numberFieldsAstheneion = new Set(['days_less_3', 'days_greater_3', 'synolo_astheneias', 'epidothsh_efka', 'apodoxes_astheneias']); // Ορίζουμε ποια fields είναι numbers
const booleanFieldsAstheneion = new Set(['idios_logos', 'adeia_kyhshs_loxeias']);

const fieldsStoixeionAdeion = ['apo_hmeromhnia_adeias', 'eos_hmeromhnia_adeias', 'hmeres_adeias', 'eidos_adeias', 'apo_ora', 'eos_ora', 'ores_adeias', 'apodoxes_epidomatos_adeias', 'apodoxes_adeias'];
const aa_adeion = 5;
const numberFieldsAdeion = new Set(['hmeres_adeias', 'apodoxes_epidomatos_adeias', 'apodoxes_adeias']); // Ορίζουμε ποια fields είναι numbers

function toUTCDate(dateString) {
    const date = new Date(dateString);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

class kinhseisController {

    static mainApasxolhseisForm = async (req, res) => {
        const locals = {
        title: "Απασχολήσεις",
        description: "Web Payroll System",
        };

        await handleProductionDownloadPath();

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;
        const sessionMhnas = req.session.periodInUse;
        const sessionEtos = req.session.yearInUse;
        const sessionTyposApodoxon = req.session.currentTyposApodoxon;
        const sessionEnergoi = req.session.energoi;
        const sessionYpokatasthma = req.session.ypokatasthma;
    
        // console.log(req.session);

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Apasxolhseis",
            }).exec();

            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const genikesParametroi = await GenikesParametroiModel.find().sort({ kodikos: 1 }).lean();

            res.render("kinhseis/apasxolhseis", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                sessionMhnas: sessionMhnas,
                sessionEtos: sessionEtos,
                sessionTyposApodoxon: sessionTyposApodoxon,
                sessionEnergoi: sessionEnergoi,
                sessionYpokatasthma: sessionYpokatasthma,
                companyId: companyId,
                arithmos_grammon_astheneion: genikesParametroi[51].timh,
                arithmos_grammon_adeion: genikesParametroi[52].timh,
            });   
        } catch (error) {
            console.log("Error into kinhseisController -> mainApasxolhseisForm :", error);
        }
    };

    static getErgazomenoi = async (req, res) => {
        const { selectedTeam, selectedCompany } = req.params;
        const { energoi, ypokatasthma, hmeromhnia_arxhs_periodoy } = req.query; // Διαβάζουμε την παράμετρο από το query string

        try {
            // Δημιουργία βασικού φίλτρου με team και company_kod
            const filter = { team: selectedTeam, company_kod: selectedCompany };
        
            // Αν η παράμετρος `energoi` είναι αληθής, προσθέτουμε φίλτρο για ενεργούς
            if (energoi === 'true') {
                filter.energos = true; // Χρήση του πεδίου energos με τιμή true
            }
        
            // Αν η παράμετρος `ypokatasthma` είναι παρούσα και δεν είναι κενή, προσθέτουμε φίλτρο
            if (ypokatasthma && ypokatasthma.trim() !== '') {
                filter.ypokatasthma = ypokatasthma; // Χρήση του πεδίου ypokatasthma
            }

            // Αν η παράμετρος `hmeromhnia_arxhs_periodoy` είναι παρούσα, προσθέτουμε φίλτρο για ημερομηνία
            const startDate = new Date(hmeromhnia_arxhs_periodoy);
            filter.$or = [
                { hmeromhnia_apoxorhshs: null },
                { hmeromhnia_apoxorhshs: { $gt: startDate } }
            ];            

            // Εκτέλεση του ερωτήματος με βάση το φίλτρο
            const ergazomenoi = await ErgazomenoiModel.find(filter).sort("eponymo onoma");

            res.json(ergazomenoi);
        } catch (error) {
            res.status(500).send("Error in kinhseisController -> getErgazomenoi :", error);
        }
    };
  
    static loipaStoixeiaErgazomenoy = async (req, res) => {
        const { selectedTeam, selectedCompany, selectedKodikos } = req.params;
        const sessionEtos = req.session.yearInUse;
        const sessionMhnas = req.session.periodInUse;

        try {
            const ergazomenoi = await ErgazomenoiModel.findOne({ team: selectedTeam, company_kod: selectedCompany, kodikos: selectedKodikos }).lean();
            const sxeshErgasias = await SxeseisErgasiasModel.findOne({ kodikos: ergazomenoi.sxesh_ergasias }).lean();
            const kathestosApasxolhshs = await KathestosApasxolhshsModel.findOne({ kodikos: ergazomenoi.kathestos_apasxolhshs }).lean();
            const oikogeneiakhKatastash = await OikogeneiakhKatastashModel.findOne({ kodikos: ergazomenoi.oikogeneiakh_katastash }).lean();
            const typosErgazomenoy = await TypoiErgazomenonModel.findOne({ kodikos: ergazomenoi.typos_ergazomenon }).lean();
            const genikesParametroi = await GenikesParametroiModel.find().sort({ kodikos: 1 }).lean();
            const asfalistikesKlaseis = await AsfalistikesKlaseisModel.find({ etos: sessionEtos }).lean().sort("kodikos");
            const etaireia = await CompaniesModel.findById(selectedCompany);
            const argies = await ArgiesModel.find({ team: selectedTeam, company_kod: etaireia.kod, etos: sessionEtos }).lean();
            const astheneies = await AstheneiesModel.find({ team: selectedTeam, company_kod: selectedCompany, kodikos: selectedKodikos, xrhsh: sessionEtos, periodos: sessionMhnas }).lean();

            res.json({  ergazomenoi:           ergazomenoi,
                        sxeshErgasias:         sxeshErgasias, 
                        kathestosApasxolhshs:  kathestosApasxolhshs, 
                        oikogeneiakhKatastash: oikogeneiakhKatastash,
                        typosErgazomenoy:      typosErgazomenoy,
                        genikesParametroi:     genikesParametroi,
                        argies:                argies,
                        asfalistikesKlaseis:   asfalistikesKlaseis,
                        etaireia:              etaireia,
                        astheneies:            astheneies,
                    });
        } catch (error) {
            console.error("Error in kinhseisController -> getAlloipaStoixeiaErgazomenoy :", error);
            res.status(500).send({
                message: "Error in kinhseisController -> getAlloipaStoixeiaErgazomenoy",
                error: error.message, // Ή error.stack για περισσότερες πληροφορίες
            });
        }
    };

    static getTypoiApodoxon = async (req, res) => {
        try {
            const typoiApodoxon = await Typoi_ApodoxonModel.find({ epilogh: true }).lean().sort("kodikos");
            res.json(typoiApodoxon);
        } catch (error) {
            res.status(500).send("Error into kinhseisController -> getTypoiApodoxon :", error);
        }
    };

    static async getTotalValues(team, company, employeeKod, startDate, endDate) {
        try {
            // Δημιουργία των ημερομηνιών σε UTC
            const start = new Date(Date.UTC(
                parseInt(startDate.substring(0, 4)),      // Έτος
                parseInt(startDate.substring(5, 7)) - 1,  // Μήνας (0-11)
                parseInt(startDate.substring(8, 10)),     // Ημέρα
                0, 0, 0, 0                                // Ώρα, λεπτά, δευτερόλεπτα, milliseconds
            ));

            const end = new Date(Date.UTC(
                parseInt(endDate.substring(0, 4)),
                parseInt(endDate.substring(5, 7)) - 1,
                parseInt(endDate.substring(8, 10)),
                23, 59, 59, 999
            ));

            // Δημιουργία του aggregation pipeline
            const result = await OrariaFromCardsModel.aggregate([
                {
                    $match: {
                        team: team,
                        company_kod: company,
                        kodikos: employeeKod,
                        hmeromhnia: {
                        $gte: start, // Ημερομηνία από
                        $lte: end,   // Ημερομηνία έως
                        }
                    }
                },
                {
                    $group: {
                        _id: null, // Δεν χρειαζόμαστε ομαδοποίηση με βάση κάποιο πεδίο
                        total_ores_ergasias:                          { $sum: "$ores_ergasias" },
                        total_ores_nyxtas:                            { $sum: "$ores_nyxtas" },
                        total_ores_argion:                            { $sum: "$ores_argion" },
                        total_ores_yperergasias:                      { $sum: "$ores_yperergasias" },
                        total_ores_yperergasias_argion:               { $sum: "$ores_yperergasias_argion" },
                        total_ores_yperergasias_nyxtas:               { $sum: "$ores_yperergasias_nyxtas" },
                        total_ores_yperergasias_argion_nyxtas:        { $sum: "$ores_yperergasias_argion_nyxtas" },
                        total_ores_nomimhs_yperorias:                 { $sum: "$ores_nomimhs_yperorias" },
                        total_ores_nomimhs_yperorias_argion:          { $sum: "$ores_nomimhs_yperorias_argion" },
                        total_ores_nomimhs_yperorias_nyxtas:          { $sum: "$ores_nomimhs_yperorias_nyxtas" },
                        total_ores_nomimhs_yperorias_argion_nyxtas:   { $sum: "$ores_nomimhs_yperorias_argion_nyxtas" },
                        total_ores_paranomhs_yperorias:               { $sum: "$ores_paranomhs_yperorias" },
                        total_ores_paranomhs_yperorias_argion:        { $sum: "$ores_paranomhs_yperorias_argion" },
                        total_ores_paranomhs_yperorias_nyxtas:        { $sum: "$ores_paranomhs_yperorias_nyxtas" },
                        total_ores_paranomhs_yperorias_argion_nyxtas: { $sum: "$ores_paranomhs_yperorias_argion_nyxtas" },
                        countNotAN_ME: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $not: [{ $in: ["$kathgoria_ergasias", ["ΑΝ", "ΜΕ"]] }] },  // Αν η kathgoria_ergasias δεν είναι στα ["ΑΝ", "ΜΕ"]
                                            { $ne: ["$kathgoria_ergasias", null] }                       // ΚΑΙ δεν είναι null
                                        ]
                                    },
                                1,  // Προσθέτουμε 1 στο count
                                0   // Αλλιώς προσθέτουμε 0
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0, // Αφαιρούμε το _id από τα αποτελέσματα
                        total_ores_ergasias: 1,   // Προσθέτουμε το total_ores_.... στα αποτελέσματα
                        total_ores_nyxtas: 1,
                        total_ores_argion: 1,
                        total_ores_yperergasias: 1,
                        total_ores_yperergasias_argion: 1,
                        total_ores_yperergasias_nyxtas: 1,
                        total_ores_yperergasias_argion_nyxtas: 1,
                        total_ores_nomimhs_yperorias: 1,
                        total_ores_nomimhs_yperorias_argion: 1,
                        total_ores_nomimhs_yperorias_nyxtas: 1,
                        total_ores_nomimhs_yperorias_argion_nyxtas: 1,
                        total_ores_paranomhs_yperorias: 1,
                        total_ores_paranomhs_yperorias_argion: 1,
                        total_ores_paranomhs_yperorias_nyxtas: 1,
                        total_ores_paranomhs_yperorias_argion_nyxtas: 1,
                        countNotAN_ME: 1
                    }
                }
            ]);
        
            return result.length > 0 ? result[0] : {}; // Επιστροφή του αποτελέσματος ως αντικείμενο
        } catch (error) {
            console.error("Σφάλμα κατά την ανάκτηση των συνολικών τιμών:", error);
            throw error;
        }
    }
  
    static async getApoysies(team, company, xrhsh, employeeKod, startDate, endDate) {
        try {
            // Δημιουργία των ημερομηνιών σε UTC
            const start = new Date(Date.UTC(
                parseInt(startDate.substring(0, 4)),      // Έτος
                parseInt(startDate.substring(5, 7)) - 1,  // Μήνας (0-11)
                parseInt(startDate.substring(8, 10)),     // Ημέρα
                0, 0, 0, 0                                // Ώρα, λεπτά, δευτερόλεπτα, milliseconds
            ));

            const end = new Date(Date.UTC(
                parseInt(endDate.substring(0, 4)),
                parseInt(endDate.substring(5, 7)) - 1,
                parseInt(endDate.substring(8, 10)),
                23, 59, 59, 999
            ));

            // Δημιουργία του aggregation pipeline
            const result = await ApoysiesModel.aggregate([
                {
                    $match: {
                        team: team,
                        company_kod: company,
                        xrhsh: xrhsh,
                        kodikos: employeeKod,
                        hmeromhnia: {
                            $gte: start, // Ημερομηνία από
                            $lte: end,   // Ημερομηνία έως
                        }
                    }
                },
                {
                    $group: {
                        _id: null, // Δεν χρειαζόμαστε ομαδοποίηση με βάση κάποιο πεδίο
                        total_hmeres_apoysias:  { $sum: "$hmeres_apoysias" },
                        total_ores_apoysias:    { $sum: "$ores_apoysias" },
                    }
                },
                {
                    $project: {
                        _id: 0, // Αφαιρούμε το _id από τα αποτελέσματα
                        total_hmeres_apoysias: 1,
                        total_ores_apoysias: 1,
                    }
                }
            ]);
        
            return result.length > 0 ? result[0] : {}; // Επιστροφή του αποτελέσματος ως αντικείμενο
        } catch (error) {
            console.error("Σφάλμα κατά την ανάκτηση των συνολικών τιμών:", error);
            throw error;
        }
    }
  
    static getTotals_Apasxolhseon = async (req, res) => {
        try {
            const team        = req.query.team;
            const company     = req.query.company;
            const employeeKod = req.query.employeeKod;
            const startDate   = req.query.startDate;
            const endDate     = req.query.endDate;

            // Έλεγχος αν οι παράμετροι υπάρχουν
            if (!employeeKod || !startDate || !endDate) {
                return res.status(400).json({ error: "Επιλέξτε εργαζόμενο και περίοδο" });
            }

            // Κλήση της συνάρτησης για να λάβουμε τα δεδομένα
            const totals = await kinhseisController.getTotalValues(team, company, employeeKod, startDate, endDate);

            // Αποστολή των αποτελεσμάτων στον πελάτη
            res.json(totals);
        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static getTotals_Apoysion = async (req, res) => {
        try {
            const team        = req.query.team;
            const company     = req.query.company;
            const xrhsh       = req.query.xrhsh;
            const employeeKod = req.query.employeeKod;
            const startDate   = req.query.startDate;
            const endDate     = req.query.endDate;

            // Έλεγχος αν οι παράμετροι υπάρχουν
            if (!employeeKod || !startDate || !endDate) {
                return res.status(400).json({ error: "Παρακαλώ παρέχετε τα employeeKod, startDate και endDate" });
            }

            // Κλήση της συνάρτησης για να λάβουμε τα δεδομένα
            const apoysies = await kinhseisController.getApoysies(team, company, xrhsh, employeeKod, startDate, endDate);

            // Αποστολή των αποτελεσμάτων στον πελάτη
            res.json(apoysies);
        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static async getSynoloYperorion(team, company, employeeKod, xrhsh) {
        try {
            // Δημιουργία του aggregation pipeline
            const result = await ApasxolhseisModel.aggregate([
                {
                    $match: {
                        team: team,
                        company_kod: company,
                        kodikos: employeeKod,
                        xrhsh: xrhsh
                    }
                },
                {
                    $group: {
                        _id: null, // Δεν χρειαζόμαστε ομαδοποίηση με βάση κάποιο πεδίο
                        _id: null, // Δεν χρειαζόμαστε ομαδοποίηση με βάση κάποιο πεδίο

                        total_ores_yperorias: { 
                            $sum: {
                                $add: [
                                "$ores_nomimhs_yperorias",
                                "$ores_nomimhs_yperorias_argion",
                                "$ores_nomimhs_yperorias_nyxtas",
                                "$ores_nomimhs_yperorias_argion_nyxtas",
                                "$ores_paranomhs_yperorias",
                                "$ores_paranomhs_yperorias_argion",
                                "$ores_paranomhs_yperorias_nyxtas",
                                "$ores_paranomhs_yperorias_argion_nyxtas"
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0, // Αφαιρούμε το _id από τα αποτελέσματα
                        total_ores_yperorias: 1,   // Προσθέτουμε το total_ores_yperorias στα αποτελέσματα
                    }
                }
            ]);
        
            return result.length > 0 ? result[0] : {}; // Επιστροφή του αποτελέσματος ως αντικείμενο
        } catch (error) {
            console.error("Σφάλμα κατά την ανάκτηση των συνολικών τιμών:", error);
            throw error;
        }
    }

    static getEthsioSynoloYperorion = async (req, res) => {
        const { team, company, employeeKod, xrhsh } = req.query;
        try {
            const synoloYperorion = await kinhseisController.getSynoloYperorion(team, company, employeeKod, xrhsh);

            // Αποστολή των αποτελεσμάτων στον πελάτη
            res.json(synoloYperorion);

        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static getApasxolhseis = async (req, res) => {
        const { team, company, employeeKod, xrhsh, periodos, typos_apodoxon, aa_misthodosias } = req.query; // Διαβάζουμε την παράμετρο από το query string

        try {
            // Δημιουργία βασικού φίλτρου με team και company_kod
            const filter =  { team: team, 
                                company_kod: company, 
                                kodikos: employeeKod, 
                                xrhsh: xrhsh, 
                                periodos: periodos, 
                                typos_apodoxon: typos_apodoxon, 
                                aa_misthodosias: aa_misthodosias
                            };

            const apasxolhseis = await ApasxolhseisModel.findOne(filter).lean();
            res.json(apasxolhseis);

        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static update_session_typosApodoxon = async (req, res) => {
        const { typosApodoxon } = req.body;

        if (!typosApodoxon) {
            return res.json({ success: false, message: 'Λείπει η τιμή typosApodoxon' });
        }
    
        req.session.currentTyposApodoxon = typosApodoxon;
    
        res.json({ success: true });
    }

    static update_session_periodos = async (req, res) => {
        const { periodos } = req.body;

        if (!periodos) {
            return res.json({ success: false, message: 'Λείπει η τιμή periodos' });
        }
    
        req.session.periodInUse = periodos;

        res.json({ success: true });
    }

    static getKrathseisWithPososta = async (req, res) => {
        try {
            // Παράδειγμα λήψης startDate / endDate από query params
            const { startDate, endDate } = req.query;
            
            // Έλεγχος validity
            if (!startDate || isNaN(new Date(startDate).valueOf())) {
              return res.status(400).send("Invalid or missing startDate");
            }
            if (!endDate || isNaN(new Date(endDate).valueOf())) {
              return res.status(400).send("Invalid or missing endDate");
            }
        
            // Μετατροπή σε Date
            const start = new Date(startDate);
            const end   = new Date(endDate);
        
            // Παράδειγμα: ο επιλεγμένος τύπος αποδοχών από session
            // (Αν δεν έχεις session, βάλε π.χ. query param ?typos=001)
            const selectedTyposApodoxon = req.query.typos || "001"; 
            const fieldName = `typos_apodoxon_${selectedTyposApodoxon}`;
        
            // 1) Φτιάχνουμε το aggregation pipeline
            const pipeline = [
              // Φιλτράρουμε με βάση τις ημερομηνίες
              {
                $match: {
                  isxyei_apo: { $lte: end },
                  isxyei_eos: { $gte: start },
                },
              },
              // Ενώνουμε (lookup) με το collection "krathseis"
              {
                $lookup: {
                  from: "krathseis",       // το πραγματικό όνομα collection
                  localField: "krathshId",
                  foreignField: "_id",
                  as: "krathsh",
                },
              },
              // Ξεπακετάρουμε τον πίνακα "krathsh" (θα έχει το πολύ 1 στοιχείο)
              {
                $unwind: "$krathsh",
              },
              // Κάνουμε project μόνο τα απαραίτητα
              {
                $project: {
                  _id: 0,
                  "kodikos": "$krathsh.kodikos",
                  "perigrafh": "$krathsh.perigrafh",
                  "ypologizetaiStoForo": "$krathsh.ypologizetai_sto_foro",
                  "ypologizetaiStisApodoxesAsfalishs": "$krathsh.apaiteitai_apodoxes_asfalishs",
                  "ypologizetaiEpiPlasmatikhs": "$krathsh.ypologismos_epi_plasmatikhs",
        
                  // Φέρνουμε τα ποσοστά
                  "pososta": {
                    "pososto_ergazomenoy": "$pososto_ergazomenoy",
                    "pososto_ergodoth": "$pososto_ergodoth",
                    "synolo_pososton": "$synolo_pososton",
                    "poso_ergazomenoy": "$poso_ergazomenoy",
                    "poso_ergodoth": "$poso_ergodoth",
                    "synolo_poson": "$synolo_poson",
                    "plasmatikh_axia": "$poso_plasmatikhs_axias",
                    "anotato_orio_palion": "$anotato_orio_palion",
                    "anotato_orio_neon": "$anotato_orio_neon",
                  },
        
                  // Φέρνουμε δυναμικά το πεδίο "typos_apodoxon_XXX"
                  "typosApodoxon": {
                    $toBool: `$krathsh.${fieldName}`, 
                    // Εναλλακτικά μπορούσαμε να κάνουμε απλώς `$krathsh.${fieldName}`
                  },
                },
              },
              // Προαιρετικά ταξινομούμε βάσει "kodikos"
              {
                $sort: { kodikos: 1 },
              },
            ];
        
            // 2) Τρέχουμε το aggregate
            const combinedData = await PosostaKrathseonModel.aggregate(pipeline);
        
            // 3) Φιλτράρουμε όσα έχουν το επιλεγμένο typosApodoxon === true
            const finalData = combinedData.filter(item => item.typosApodoxon === true);
        
            // 4) Στέλνουμε το αποτέλεσμα
            res.json(finalData);
          } catch (error) {
            console.error("Error:", error);
            res.status(500).send("Error fetching data");
          }
    }
        
    static getAntistoixiseisByKrathshAndTypoApodoxon = async (req, res) => {
        const { team, etaireia, krathshKod, apo_typos_apodoxon } = req.query;
    
        // Έλεγχος παραμέτρων
        if (!team || !etaireia || !krathshKod || !apo_typos_apodoxon) {
            return res.status(400).json({ error: "Missing required query parameters" });
        }
    
        try {
            const antistoixish = await AntistoixiseisModel.findOne({
                team: team,
                companyKod: etaireia,
                krathshKod: krathshKod,
                apo_typos_apodoxon: apo_typos_apodoxon,
            }).select('kad eidikothta kpk se_typos_apodoxon epa').lean();
        
            res.json(antistoixish);
        
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    };

    static getSynoloArgion = async (req, res) => {
        try {
            const { team, company_kod, etos, startDate, endDate } = req.body; 
    
            // Δημιουργούμε το φίλτρο για το ArgiesModel
            const filter = {
                team: team,
                company_kod: company_kod,
                etos: etos,
                hmeromhnia: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
    
            // Ανακτούμε τις εγγραφές που ταιριάζουν
            const argies = await ArgiesModel.find(filter, 'hmeromhnia'); // Επιλέγουμε μόνο την ημερομηνία
    
            // Εξαγωγή των ημερομηνιών σε έναν πίνακα
            const hmeromhnies = argies.map(argia => argia.hmeromhnia);
    
            // Μετράμε τον αριθμό των αργιών
            const count = hmeromhnies.length;
    
            return res.json({ count, hmeromhnies });
        } catch (error) {
            console.error('Σφάλμα στο argies_astheneion:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    static getSynoloHmeronMhErgasias = async (req, res) => {
        try {
            const { team, company_kod, kodikos, startDate, endDate } = req.body;

            // Δημιουργούμε το φίλτρο για το OrariaFromCardsModel για 'ΜΕ'
            const filter_ergasia = {
                team: team,
                company_kod: company_kod,
                kodikos: kodikos,
                hmeromhnia: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                kathgoria_ergasias: 'ΕΡΓ',
            };
    
            // Δημιουργούμε το φίλτρο για το OrariaFromCardsModel για 'ΜΕ'
            const filter_mh_ergasia = {
                team: team,
                company_kod: company_kod,
                kodikos: kodikos,
                hmeromhnia: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                kathgoria_ergasias: 'ΜΕ',
            };
    
            // Δημιουργούμε το φίλτρο για το OrariaFromCardsModel για οτιδήποτε εκτός 'ΜΕ' και 'ΑΝ'
            const filter_ergasimes = {
                team: team,
                company_kod: company_kod,
                kodikos: kodikos,
                hmeromhnia: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                kathgoria_ergasias: { $nin: ['ΜΕ', 'ΑΝ'] },
            };
    
            // Δημιουργούμε το φίλτρο για το OrariaFromCardsModel για 'ΑΝ'
            const filter_repo = {
                team: team,
                company_kod: company_kod,
                kodikos: kodikos,
                hmeromhnia: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                kathgoria_ergasias: 'ΑΝ',
            };
    
            // Ανακτούμε τις εργάσιμες ημερομηνίες
            const ergasimes = await OrariaFromCardsModel.countDocuments(filter_ergasia);;
            
            // Ανακτούμε τις μη εργάσιμες ημερομηνίες
            const mhErgasimesDocs = await OrariaFromCardsModel.find(filter_mh_ergasia, 'hmeromhnia');
            const mhErgasimesDates = mhErgasimesDocs.map(doc => doc.hmeromhnia);
    
            // Μετράμε τον αριθμό των μη εργασίμων ημερών
            const mhErgasimes = mhErgasimesDates.length;

            // Ανακτούμε τις εργάσιμες ημέρες που δεν ανήκουν στις κατηγορίες 'ΜΕ' και 'ΑΝ'
            const astheneiaDocs = await OrariaFromCardsModel.find(filter_ergasimes, 'hmeromhnia');
            const astheneiaDates = astheneiaDocs.map(doc => doc.hmeromhnia);
    
            // Μετράμε τον αριθμό των ημερών αυτών
            const astheneia = astheneiaDates.length;
    
            // Ανακτούμε τις ημερομηνίες των ρεπό
            const repoDocs = await OrariaFromCardsModel.find(filter_repo, 'hmeromhnia');
            const repoDates = repoDocs.map(doc => doc.hmeromhnia);
    
            // Μετράμε τον αριθμό των ρεπό
            const repo = repoDates.length;
    
            // Συνδυάζουμε τις μη εργάσιμες ημερομηνίες και τα ρεπό
            const mhErgasimesKaiRepoDates = [...mhErgasimesDates, ...repoDates];
    
            return res.json({ ergasimes, mhErgasimes, astheneia, repo, mhErgasimesDates, repoDates, mhErgasimesKaiRepoDates });
        } catch (error) {
            console.error('Σφάλμα στο Hmeres_Mh_Ergasias:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static getSynoloProhgoymenonAstheneion = async (req, res) => {
        try {
            const { team, company_kod, xrhsh, kodikos, startDate, endDate } = req.body; 
    
            // Δημιουργούμε το φίλτρο για το AstheneiesModel
            const filter = {
                team: team,
                company_kod: company_kod,
                xrhsh: xrhsh,
                kodikos: kodikos,
                apo_hmeromhnia_01: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
    
            const prohgoymenesAstheneies = await AstheneiesModel.find(filter);

            // Υπολογισμός συνόλων
            const synola = prohgoymenesAstheneies.reduce(
                (acc, record) => {
                for (let i = 1; i <= 5; i++) {
                    acc.synolo_hmeron_less_3 += record[`days_less_3_0${i}`] || 0;
                    acc.synolo_hmeron_greater_3 += record[`days_greater_3_0${i}`] || 0;
                    acc.synolo_hmeron_astheneias += record[`synolo_astheneias_0${i}`] || 0;
                }
                return acc;
                },
                {
                synolo_hmeron_less_3: 0,
                synolo_hmeron_greater_3: 0,
                synolo_hmeron_astheneias: 0,
                }
            );
        
            return res.json({ synola });
            // return synola;
        } catch (error) {
            console.error('Σφάλμα στο argies_astheneion:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static get_Asfalistikes_Klaseis_Gia_Epidothsh_Efka = async (req, res) => {
        try {
            const { etos, pragmatikoHmeromisthioParsed } = req.body;

            const query = {
                "$or": [
                    { "kodikos": { "$in": ["03", "08"] }, "etos": etos },
                    {
                        "etos": etos,
                        "apo_orio": { "$lte": pragmatikoHmeromisthioParsed },
                        "eos_orio": { "$gte": pragmatikoHmeromisthioParsed }
                    }
                ]
            };
    
            const results = await AsfalistikesKlaseisModel.find(query).limit(3).lean();
            res.json(results);
    
        } catch (error) {
            console.error('Σφάλμα στο Asfalistikes_Klaseis_Gia_Epidothsh_Efka:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static get_Kathgories_Adeion = async (req, res) => {
        try {
            const results = await KathgoriesAdeiasModel.find().sort({ aa: 1 }).lean();
            res.json(results);
        } catch (error) {
            console.error('Σφάλμα στο get_Kathgories_Adeion:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static get_Hmeromhnies_Astheneion = async (req, res) => {
        try {
          const { team, company_kod, kodikos, ...dates } = req.body;
      
          // --- Διαχωρισμός σε ασθένειες & άδειες ---
          const hmeromhniesAstheneion = {};
          const hmeromhniesAdeion = {};
      
          Object.keys(dates).forEach(key => {
            if (key.startsWith("apo_hmeromhnia_adeias_") || key.startsWith("eos_hmeromhnia_adeias_")) {
              hmeromhniesAdeion[key] = dates[key];
            } else {
              hmeromhniesAstheneion[key] = dates[key];
            }
          });
      
          let sicknessDatesGrouped = [];
          let totalSicknessDays = 0;
      
          // --- Χρησιμοποιούμε `for...of` αντί για `forEach` για να λειτουργεί το `await` ---
          for (const key of Object.keys(hmeromhniesAdeion).filter(k => k.startsWith("apo_hmeromhnia_adeias_"))) {
            const eosKey = key.replace("apo_hmeromhnia_adeias_", "eos_hmeromhnia_adeias_");
            const startAdeia = new Date(hmeromhniesAdeion[key]);
            const endAdeia = new Date(hmeromhniesAdeion[eosKey]);
      
            let currentSicknessDates = [];
      
            for (const sicknessKey of Object.keys(hmeromhniesAstheneion).filter(k => k.startsWith("apo_hmeromhnia_"))) {
              const eosSicknessKey = sicknessKey.replace("apo_hmeromhnia_", "eos_hmeromhnia_");
              const apoDate = new Date(hmeromhniesAstheneion[sicknessKey]);
              const eosDate = new Date(hmeromhniesAstheneion[eosSicknessKey]);
      
              // Αν η ασθένεια βρίσκεται εντός της τρέχουσας άδειας
              if (apoDate <= endAdeia && eosDate >= startAdeia) {
                currentSicknessDates.push({ apoDate, eosDate });
              }
            }
      
            let sicknessDatesForCurrentAdeia = [];
      
            for (const { apoDate, eosDate } of currentSicknessDates) {
              const sicknessDocs = await OrariaFromCardsModel.find({
                team,
                company_kod,
                kodikos,
                kathgoria_ergasias: { $nin: ['ΜΕ', 'ΑΝ'] },
                hmeromhnia: { $gte: apoDate, $lte: eosDate }
              }, "hmeromhnia");
      
              let foundDates = sicknessDocs.map(d => new Date(d.hmeromhnia).toISOString().split('T')[0]);
              foundDates = Array.from(new Set(foundDates)).sort();
      
              foundDates = foundDates.map(dateStr => {
                const realDate = new Date(dateStr);
                return realDate.toLocaleDateString('el-GR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
              });
      
              sicknessDatesForCurrentAdeia.push(...foundDates);
            }
      
            // Αφαίρεση διπλότυπων και ταξινόμηση
            sicknessDatesForCurrentAdeia = Array.from(new Set(sicknessDatesForCurrentAdeia)).sort();
      
            // --- Προσθήκη στο grouped array (μία εγγραφή ανά άδεια) ---
            sicknessDatesGrouped.push(sicknessDatesForCurrentAdeia);
            totalSicknessDays += sicknessDatesForCurrentAdeia.length;
          }
      
          // --- Μετατροπή σε ενιαίο string με ", " ---
          const allDatesFlat = sicknessDatesGrouped.flat();
          const sicknessDatesString = allDatesFlat.join(", ");
      
          return res.json({
            sicknessDatesGrouped,
            sicknessDatesString,
            totalSicknessDays
          });
      
        } catch (error) {
          console.error('Σφάλμα στο /get-sickness-dates:', error);
          return res.status(500).json({ error: error.message });
        }
      };
      
      static getSynoloProhgoymenonAdeion = async (req, res) => {
        try {
            const { team, company_kod, xrhsh, kodikos, startDate, endDate } = req.body; 
    
            // Δημιουργούμε το φίλτρο για το AstheneiesModel
            const filter = {
                team: team,
                company_kod: company_kod,
                xrhsh: xrhsh,
                kodikos: kodikos,
                apo_hmeromhnia_01: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
    
            const prohgoymenesAdeies = await AdeiesModel.find(filter);

            // Υπολογισμός συνόλων
            const synola = prohgoymenesAdeies.reduce(
                (acc, record) => {
                for (let i = 1; i <= 5; i++) {
                    acc.synolo_hmeron_adeias += record[`hmeres_adeias_0${i}`] || 0;
                }
                return acc;
                },
                {
                    synolo_hmeron_adeias: 0,
                }
            );
        
            return res.json({ synola });
        } catch (error) {
            console.error('Σφάλμα στο getSynoloProhgoymenonAdeion:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static getSynoloApodoxonProhgoymenonPeriodon = async (req, res) => {
        try {
            const { team, company_kod, xrhsh, kodikos, periodos, typos_apodoxon } = req.body;
    
            // 🔹 Βρίσκουμε όλες τις εγγραφές με periodos < periodos
            const apodoxes = await ApasxolhseisModel.find({
                team: team,
                company_kod: company_kod,
                xrhsh: xrhsh,
                kodikos: kodikos,
                typos_apodoxon: typos_apodoxon,
                periodos: { $lt: periodos }  // ✅ MongoDB τρόπος για periodos < periodos
            });
    
            // ✅ Αν δεν βρεθούν εγγραφές, επιστρέφουμε 0 (για αποφυγή undefined errors)
            if (!apodoxes || apodoxes.length === 0) {
                return res.status(200).json({
                    synolo_apodoxon: 0,
                    synolo_hmeres_asfalishs: 0
                });
            }
    
            // ✅ Χρησιμοποιούμε reduce() αντί για forEach() 🚀
            const { synolo_apodoxon, synolo_hmeres_asfalishs } = apodoxes.reduce(
                (acc, entry) => {
                    acc.synolo_apodoxon += (entry.synolo_mikton_apodoxon || 0) - (entry.paranomes_yperories || 0);
                    acc.synolo_hmeres_asfalishs += (entry.hmeres_asfalishs || 0);
                    return acc;
                },
                { synolo_apodoxon: 0, synolo_hmeres_asfalishs: 0 } // Αρχικές τιμές
            );
    
            // ✅ Επιστροφή αποτελεσμάτων
            return res.status(200).json({
                synolo_apodoxon,
                synolo_hmeres_asfalishs
            });
    
        } catch (error) {
            console.error('Σφάλμα στο getSynoloApodoxonProhgoymenonPeriodon:', error);
            return res.status(500).json({ error: 'Σφάλμα διακομιστή, δοκιμάστε ξανά.' });
        }
    };

    static postApasxolhseisForm = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionEtos = req.session.yearInUse;
    
        const { formData, filesToUpdate } = req.body;
        
        if (filesToUpdate.enhmeroshApasxolhseon) {
            const filter = {
                team: sessionUserTeam,
                company_kod: sessionCompanyInUse,
                kodikos: formData.kodikosHidden,
                xrhsh: sessionEtos,
                periodos: formData.periodos_Hidden,
                typos_apodoxon: formData.typosApodoxon_Hidden,
                aa_misthodosias: formData.aa_misthodosias_Hidden,
            };
              
            let updateData = {
                $set: {
                    exoflhsh: formData.exoflhsh_Hidden,
                    poso_plhromhs: parseFloat(formData.poso_plhromhs_Hidden.replace(',', '.')),
                    synolo_apodoxon: parseFloat(formData.synoloApodoxon.replace(',', '.')),
                    symfonhtheis_misthos: parseFloat(formData.symfonhtheisMisthos.replace(',', '.')),
                    nomimo_hmeromisthio: parseFloat(formData.nomimoHmeromisthio.replace(',', '.')),
                    pragmatiko_hmeromisthio: parseFloat(formData.pragmatikoHmeromisthio.replace(',', '.')),
                    nomimo_oromisthio: parseFloat(formData.nomimoOromisthio.replace(',', '.')),
                    pragmatiko_oromisthio: parseFloat(formData.pragmatikoOromisthio.replace(',', '.')),
                    hmeres_ergasias: parseFloat(formData.hmeresErgasias.replace(',', '.')),
                    ores_ergasias: parseFloat(formData.oresErgasias.replace(',', '.')),
                    hmeres_apoysias: parseFloat(formData.hmeresApoysias.replace(',', '.')),
                    ores_apoysias: parseFloat(formData.oresApoysias.replace(',', '.')),
                    hmeres_ergasias_meion_apoysies: parseFloat(formData.hmeresErgasiasMeionApoysies.replace(',', '.')),
                    ores_ergasias_meion_apoysies: parseFloat(formData.oresErgasiasMeionApoysies.replace(',', '.')),
                    hmeres_asfalishs: parseFloat(formData.hmeresAsfalishs.replace(',', '.')),
                    ores_argion: parseFloat(formData.oresArgion.replace(',', '.')),
                    axia_argion: parseFloat(formData.axiaArgion.replace(',', '.')),
                    asfalistikh_axia_argion: parseFloat(formData.asfalistikhAxiaArgion.replace(',', '.')),
                    ores_nyxtas: parseFloat(formData.oresNyxtas.replace(',', '.')),
                    axia_nyxtas: parseFloat(formData.axiaNyxtas.replace(',', '.')),
                    asfalistikh_axia_nyxtas: parseFloat(formData.asfalistikhAxiaNyxtas.replace(',', '.')),
                    ores_yperergasias: parseFloat(formData.oresYperergasias.replace(',', '.')),
                    axia_yperergasias: parseFloat(formData.axiaYperergasias.replace(',', '.')),
                    asfalistikh_axia_yperergasias: parseFloat(formData.asfalistikhAxiaYperergasias.replace(',', '.')),
                    ores_yperergasias_nyxtas: parseFloat(formData.oresYperergasiasNyxtas.replace(',', '.')),
                    axia_yperergasias_nyxtas: parseFloat(formData.axiaYperergasiasNyxtas.replace(',', '.')),
                    asfalistikh_axia_yperergasias_nyxtas: parseFloat(formData.asfalistikhAxiaYperergasiasNyxtas.replace(',', '.')),
                    ores_yperergasias_argion: parseFloat(formData.oresYperergasiasArgion.replace(',', '.')),
                    axia_yperergasias_argion: parseFloat(formData.axiaYperergasiasArgion.replace(',', '.')),
                    asfalistikh_axia_yperergasias_argion: parseFloat(formData.asfalistikhAxiaYperergasiasArgion.replace(',', '.')),
                    ores_yperergasias_argion_nyxtas: parseFloat(formData.oresYperergasiasArgionNyxtas.replace(',', '.')),
                    axia_yperergasias_argion_nyxtas: parseFloat(formData.axiaYperergasiasArgionNyxtas.replace(',', '.')),
                    asfalistikh_axia_yperergasias_argion_nyxtas: parseFloat(formData.asfalistikhAxiaYperergasiasArgionNyxtas.replace(',', '.')),
                    ores_nomimhs_yperorias: parseFloat(formData.oresNomimhsYperorias.replace(',', '.')),
                    axia_nomimhs_yperorias: parseFloat(formData.axiaNomimhsYperorias.replace(',', '.')),
                    asfalistikh_axia_nomimhs_yperorias: parseFloat(formData.asfalistikhAxiaNomimhsYperorias.replace(',', '.')),
                    ores_nomimhs_yperorias_nyxtas: parseFloat(formData.oresNomimhsYperoriasNyxtas.replace(',', '.')),
                    axia_nomimhs_yperorias_nyxtas: parseFloat(formData.axiaNomimhsYperoriasNyxtas.replace(',', '.')),
                    asfalistikh_axia_nomimhs_yperorias_nyxtas: parseFloat(formData.asfalistikhAxiaNomimhsYperoriasNyxtas.replace(',', '.')),
                    ores_nomimhs_yperorias_argion: parseFloat(formData.oresNomimhsYperoriasArgion.replace(',', '.')),
                    axia_nomimhs_yperorias_argion: parseFloat(formData.axiaNomimhsYperoriasArgion.replace(',', '.')),
                    asfalistikh_axia_nomimhs_yperorias_argion: parseFloat(formData.asfalistikhAxiaNomimhsYperoriasArgion.replace(',', '.')),
                    ores_nomimhs_yperorias_argion_nyxtas: parseFloat(formData.oresNomimhsYperoriasArgionNyxtas.replace(',', '.')),
                    axia_nomimhs_yperorias_argion_nyxtas: parseFloat(formData.axiaNomimhsYperoriasArgionNyxtas.replace(',', '.')),
                    asfalistikh_axia_nomimhs_yperorias_argion_nyxtas: parseFloat(formData.asfalistikhAxiaNomimhsYperoriasArgionNyxtas.replace(',', '.')),
                    ores_paranomhs_yperorias: parseFloat(formData.oresParanomhsYperorias.replace(',', '.')),
                    axia_paranomhs_yperorias: parseFloat(formData.axiaParanomhsYperorias.replace(',', '.')),
                    asfalistikh_axia_paranomhs_yperorias: parseFloat(formData.asfalistikhAxiaParanomhsYperorias.replace(',', '.')),
                    ores_paranomhs_yperorias_nyxtas: parseFloat(formData.oresParanomhsYperoriasNyxtas.replace(',', '.')),
                    axia_paranomhs_yperorias_nyxtas: parseFloat(formData.axiaParanomhsYperoriasNyxtas.replace(',', '.')),
                    asfalistikh_axia_paranomhs_yperorias_nyxtas: parseFloat(formData.asfalistikhAxiaParanomhsYperoriasNyxtas.replace(',', '.')),
                    ores_paranomhs_yperorias_argion: parseFloat(formData.oresParanomhsYperoriasArgion.replace(',', '.')),
                    axia_paranomhs_yperorias_argion: parseFloat(formData.axiaParanomhsYperoriasArgion.replace(',', '.')),
                    asfalistikh_axia_paranomhs_yperorias_argion: parseFloat(formData.axiaParanomhsYperoriasArgion.replace(',', '.')),
                    ores_paranomhs_yperorias_argion_nyxtas: parseFloat(formData.oresParanomhsYperoriasArgionNyxtas.replace(',', '.')),
                    axia_paranomhs_yperorias_argion_nyxtas: parseFloat(formData.axiaParanomhsYperoriasArgionNyxtas.replace(',', '.')),
                    asfalistikh_axia_paranomhs_yperorias_argion_nyxtas: parseFloat(formData.asfalistikhAxiaParanomhsYperoriasArgionNyxtas.replace(',', '.')),
                    ores_ergasias_6_hmeras: parseFloat(formData.oresErgasias6Hmeras.replace(',', '.')),
                    axia_ergasias_6_hmeras: parseFloat(formData.axiaErgasias6Hmeras.replace(',', '.')),
                    ores_prostheths_ergasias: parseFloat(formData.oresProsthethsErgasias.replace(',', '.')),
                    axia_prostheths_ergasias: parseFloat(formData.axiaProsthethsErgasias.replace(',', '.')),
                    synolo_prosayxhseon: parseFloat(formData.synoloProsayxhseon.replace(',', '.')),
                    taktikes_apodoxes_mh_ypologizomenes_se_dora_text: formData.taktikesApodoxesMhYpologizomenesSeDoraText,
                    taktikes_apodoxes_mh_ypologizomenes_se_dora: parseFloat(formData.taktikesApodoxesMhYpologizomenesSeDora.replace(',', '.')),
                    taktikes_apodoxes_ypologizomenes_se_dora_text: formData.taktikesApodoxesYpologizomenesSeDoraText,
                    taktikes_apodoxes_ypologizomenes_se_dora: parseFloat(formData.taktikesApodoxesYpologizomenesSeDora.replace(',', '.')),
                    sympsifistees_apodoxes: parseFloat(formData.sympsifisteesApodoxes.replace(',', '.')),
                    synolo_taktika_kataballomenon_apodoxon: parseFloat(formData.synoloTaktikaKataballomenonApodoxon.replace(',', '.')),
                    epimerizomenes_se_mhnes_ergasias_text: formData.epimerizomenesSeMhnesErgasiasText,
                    epimerizomenes_se_mhnes_ergasias: parseFloat(formData.epimerizomenesSeMhnesErgasias.replace(',', '.')),
                    prim_bonus_text: formData.primBonusText,
                    prim_bonus: parseFloat(formData.primBonus.replace(',', '.')),
                    apallassomenes_foroy_text: formData.apallassomenesForoyText,
                    apallassomenes_foroy: parseFloat(formData.apallassomenesForoy.replace(',', '.')),
                    apallassomenes_krathseon_text: formData.apallassomenesKrathseonText,
                    apallassomenes_krathseon: parseFloat(formData.apallassomenesKrathseon.replace(',', '.')),
                    synolo_ektakta_kataballomenon_apodoxon: parseFloat(formData.synoloEktaktaKataballomenonApodoxon.replace(',', '.')),
                    meiosh_ergatikhs_eisforas: parseFloat(formData.meioshErgatikhsEisforas.replace(',', '.')),
                    meiosh_ergodotikhs_eisforas: parseFloat(formData.epidothshErgodotikhsEisforas.replace(',', '.')),
                    neo_pragmatiko_hmeromisthio: parseFloat(formData.neoPragmatikoHmeromisthio.replace(',', '.')),
                    pragmatiko_hmeromisthio_astheneias: parseFloat(formData.pragmatikoHmeromisthioAstheneias.replace(',', '.')),
                    apo_hmeromhnia: formData.apoHmeromhnia, 
                    eos_hmeromhnia: formData.eosHmeromhnia, 
                    synolo_asfalistikhs_axias_prosayxhseon: parseFloat(formData.synoloAsfalistikhsAxias.replace(',', '.')),
                    synolo_mikton_apodoxon: parseFloat(formData.synoloMiktonApodoxon.replace(',', '.')), 
                    synolo_krathseon_i: parseFloat(formData.synoloKrathseon_I.replace(',', '.')), 
                    synolo_foroy: formData.dotoPlhroteo_Hidden === "true" ? parseFloat(formData.synoloForoy.replace(',', '.')) : parseFloat(formData.synolo_foroy.replace(',', '.')), 
                    prokatabolh: parseFloat(formData.prokatabolh.replace(',', '.')), 
                    plhroteo: parseFloat(formData.plhroteo.replace(',', '.')), 
                    asfalistikes_apodoxes: parseFloat(formData.asfalistikes_apodoxes.replace(',', '.')), 
                    asfalistikes_apodoxes_hidden: parseFloat(formData.asfalistikes_apodoxes_hidden.replace(',', '.')), 
                    synolo_axias_krathshs_ergazomenoy: parseFloat(formData.synolo_axias_krathshs_ergazomenoy.replace(',', '.')),
                    synolo_axias_krathshs_ergodoth: parseFloat(formData.synolo_axias_krathshs_ergodoth.replace(',', '.')),
                    synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro: parseFloat(formData.synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro.replace(',', '.')),
                    synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro: parseFloat(formData.synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro.replace(',', '.')),
                    synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro: parseFloat(formData.synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro.replace(',', '.')),
                    synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro: parseFloat(formData.synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro.replace(',', '.')),
                    ethsio_forologhteo_poso_taktikon_apodoxon: parseFloat(formData.ethsio_forologhteo_poso_taktikon_apodoxon.replace(',', '.')), 
                    forologhteo_poso_taktikon_apodoxon: parseFloat(formData.forologhteo_poso_taktikon_apodoxon.replace(',', '.')), 
                    analogoyn_foros_pro_ekptoshs: parseFloat(formData.analogoyn_foros_pro_ekptoshs.replace(',', '.')), 
                    mhniaios_analogoyn_foros_pro_ekptoshs: parseFloat(formData.mhniaios_analogoyn_foros_pro_ekptoshs.replace(',', '.')), 
                    eisfora_allhleggyhs: parseFloat(formData.eisfora_allhleggyhs.replace(',', '.')), 
                    ekptosh_logo_oikogeneiakhs_katastashs: parseFloat(formData.ekptosh_logo_oikogeneiakhs_katastashs.replace(',', '.')), 
                    mhniaia_ekptosh_logo_oikogeneiakhs_katastashs: parseFloat(formData.mhniaia_ekptosh_logo_oikogeneiakhs_katastashs.replace(',', '.')), 
                    analogoyn_foros_meta_thn_ekptosh: parseFloat(formData.analogoyn_foros_meta_thn_ekptosh.replace(',', '.')), 
                    synolo_ektakton_amoibon: parseFloat(formData.synolo_ektakton_amoibon.replace(',', '.')), 
                    analogoyn_foros_ektakton_amoibon: parseFloat(formData.analogoyn_foros_ektakton_amoibon.replace(',', '.')), 
                    synolo_less_3: formData.synolo_less_3, 
                    synolo_greater_3: formData.synolo_greater_3, 
                    geniko_synolo_hmeron_astheneias: formData.geniko_synolo_hmeron_astheneias, 
                    geniko_synolo_epidothshs_efka: parseFloat(formData.geniko_synolo_epidothshs_efka.replace(',', '.')), 
                    geniko_synolo_astheneias: parseFloat(formData.geniko_synolo_astheneias.replace(',', '.')), 
                    ergasiako_etos: formData.ergasiako_etos, 
                    epomeno_ergasiako_etos: formData.epomeno_ergasiako_etos, 
                    diasthma_apasxolhshs: formData.diasthma_apasxolhshs, 
                    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys: formData.dikaioymenh_astheneia_trexontos_ergasiakoy_etoys,
                    diasthma_hmeron_astheneias: formData.diasthma_hmeron_astheneias, 
                    lhfteisa_adeia_asteneias_prohgoymenon_mhnon: formData.lhfteisa_adeia_asteneias_prohgoymenon_mhnon, 
                    mh_ergasimes_basei_orarioy: formData.mh_ergasimes_basei_orarioy, 
                    mh_ergasimes_hmeromhnies: formData.mh_ergasimes_hmeromhnies, 
                    ypoloipo_adeias_astheneias_trexontos_etoys: formData.ypoloipo_adeias_astheneias_trexontos_etoys, 
                    repo: formData.repo, 
                    repo_hmeromhnies: formData.repo_hmeromhnies, 
                    argies: formData.argies, 
                    argies_hmeromhnies: formData.argies_hmeromhnies, 
                    argies_mh_ergasimon_repo: formData.argies_mh_ergasimon_repo, 
                    argies_mh_ergasimon_repo_hmeromhnies: formData.argies_mh_ergasimon_repo_hmeromhnies, 
                    synolo_hmeron_adeias: formData.synolo_hmeron_adeias,
                    synolo_oron_adeias: formData.synolo_oron_adeias,
                    synolo_apodoxon_epidomatos_adeias: parseFloat(formData.synolo_apodoxon_epidomatos_adeias.replace(',', '.')),
                    synolo_apodoxon_adeias: parseFloat(formData.synolo_apodoxon_adeias.replace(',', '.')),
                    hmerologiako_etos_adeias: formData.hmerologiako_etos_adeias, 
                    epomeno_hmerologiako_etos_adeias: formData.epomeno_hmerologiako_etos_adeias, 
                    ergasiako_etos_adeias: formData.ergasiako_etos_adeias, 
                    etos_adeias: formData.etos_adeias, 
                    dikaioymenh_adeia: formData.dikaioymenh_adeia, 
                    lhfteisa_adeia_prohgoymenon_mhnon: formData.lhfteisa_adeia_prohgoymenon_mhnon, 
                    ypoloipo_adeias_trexontos_etoys: formData.ypoloipo_adeias_trexontos_etoys, 
                    diasthma_hmeron_adeias: formData.diasthma_hmeron_adeias_timh, 
                    repo_adeias: formData.repo_adeias, 
                    repo_adeias_hmeromhnies: formData.repo_adeias_hmeromhnies, 
                    argies_adeias: formData.argies_adeias, 
                    argies_adeias_hmeromhnies: formData.argies_adeias_hmeromhnies, 
                    astheneies_adeias: formData.astheneies_adeias, 
                    astheneies_adeias_hmeromhnies: formData.astheneies_adeias_hmeromhnies, 
                    koines_hmeres_repo_argion_astheneion_adeias: formData.koines_hmeres_repo_argion_astheneion_adeias, 
                    koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies: formData.koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies,
                    ypoloipo_adeias: formData.ypoloipo_adeias, 
                    updatedAt: Date.now(),
                },
                $setOnInsert: {
                    createdAt: Date.now(),  // μόνο στο insert
                }
            };

            fieldsStoixeionKrathseon.forEach(fieldStoixeio => { 
                for (let i = 1; i <= aa_krathseon; i++) {
                    const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                    if (numberFieldsKrathseon.has(fieldStoixeio)) {
                        const rawValue = formData[fieldNameStoixeioy];
                        const parsedValue = parseFloat(rawValue.replace(',', '.')); 
                        updateData[fieldNameStoixeioy] = parsedValue || 0; 
                    } else if (booleanFieldsKrathseon.has(fieldStoixeio)) {
                        updateData[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || false; // Χειρισμός boolean πεδίων
                    } else {
                        updateData[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
                    }
                }
            });
      
            fieldsStoixeionAstheneion.forEach(fieldStoixeio => { 
                for (let i = 1; i <= aa_astheneion; i++) {
                    const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                    if (numberFieldsAstheneion.has(fieldStoixeio)) {
                        const rawValue = formData[fieldNameStoixeioy];
                        const parsedValue = parseFloat(rawValue.replace(',', '.')); 
                        updateData[fieldNameStoixeioy] = parsedValue || 0; 
                    } else if (booleanFieldsAstheneion.has(fieldStoixeio)) {
                        updateData[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || false; // Χειρισμός boolean πεδίων
                    } else {
                        updateData[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
                    }
                }
            });
      
            fieldsStoixeionAdeion.forEach(fieldStoixeio => { 
                for (let i = 1; i <= aa_adeion; i++) {
                    const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                    if (numberFieldsAdeion.has(fieldStoixeio)) {
                        const rawValue = formData[fieldNameStoixeioy];
                        const parsedValue = parseFloat(rawValue.replace(',', '.')); 
                        updateData[fieldNameStoixeioy] = parsedValue || 0; 
                    } else {
                        updateData[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
                    }
                }
            });

            const options = {
                upsert: true, // Δημιούργησε νέα εγγραφή αν δεν υπάρχει
                new: true,    // Επιστρέφει το καινούριο/ενημερωμένο έγγραφο
            };
              
            try {
                await ApasxolhseisModel.findOneAndUpdate(filter, updateData, options);
            } catch (error) {
                console.log(error);
            }
        }

        if (filesToUpdate.enhmeroshAstheneion) {

        }
    

    }

    static deleteApasxolhseis = async (req, res) => {
        try {
          await ApasxolhseisModel.deleteOne({ _id: req.params.id });
          res.json({ success: true, redirectUrl: "/companies/genikastoixeia" });
        } catch (error) {
          throw error;
        }
    };
    
    
    
}

module.exports = kinhseisController;
