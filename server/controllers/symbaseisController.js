// controllers/symbaseisController.js
const mongoose = require("mongoose");
const Models_A = require("../models/stathera_arxeia");
const Models_B = require("../models/privileges");
const Models_C = require("../models/companies");
const Models_D = require("../models/ergazomenoi");
const Models_E = require("../models/symbaseis");

const   { GenikesParametroiModel, 
            KrathseisModel 
        } = Models_A; 

const   { UserPrivilegesModel } = Models_B;

const   { CompaniesModel, 
            AntistoixiseisModel,
        } = Models_C;

const   { ErgazomenoiModel } = Models_D;

const   { SymbaseisModel,
            KathgoriesSymbaseonModel,
            EidikothtesAnaKathgoriaSymbaseonModel,
            StoixeiaSymbaseonModel,
            KlimakiaSymbaseonModel,
        } =Models_E

function formatNumber(number, totalLength) {
    return number.toString().padStart(totalLength, '0');
}

let nextPageSearchTerm = "";

function to4(v) {
	const d = String(v ?? "").replace(/\D/g, "");
	if (!d) return "";
	const n = parseInt(d, 10);
	return Number.isFinite(n) ? String(n).padStart(4, "0") : d.slice(-4).padStart(4, "0");
}

function parseGreekDecimal(input, fallback = 0) {
  if (input == null) return fallback;
  const s = String(input).trim();
  if (s === '') return fallback;
  // αν έχει διαχωριστικό χιλιάδων με . (π.χ. 1.030,00) βγάλ' το
  const noThousands = s.replace(/\./g, '');
  // αντικατέστησε το κόμμα με τελεία
  const normalized = noThousands.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

class symbaseisController {

    static mainSymbaseisForm = async (req, res, next) => {
        const locals = {
            title: "Διαχείριση Συμβάσεων",
            description: "Web Payroll System",
        };

        try {
            const sessionUserId = req.session.userId;

            // 1) Βάση + πολλαπλασιαστής
            const basePer = Number(process.env.EGGRAFES) || 10;
            const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1)); // 1..5
            const perPage = basePer * perx;

            // 2) Σύνολο εγγραφών
            const [{ total = 0 } = {}] = await SymbaseisModel.aggregate([
            { $count: "total" },
            ]).exec();

            // 3) Σελίδα με ασφάλεια (1..totalPages)
            const totalPages = Math.max(1, Math.ceil(total / perPage));
            const page = Math.min(
            totalPages,
            Math.max(1, parseInt(req.query.page, 10) || 1)
            );

            // 4) skip/limit (δεν χρειάζεται να "κόβεις" το limit στην τελευταία σελίδα)
            const skip = (page - 1) * perPage;

            // 5) Δικαιώματα
            const userPrivDoc = await UserPrivilegesModel
            .findOne({ userId: sessionUserId, form: "Symbaseis" })
            .lean();
            const userPrivileges = userPrivDoc?.privileges || {};

            // 6) Δεδομένα σελίδας (σταθερό sort)
            const symbaseis = await SymbaseisModel.aggregate([
            { $sort: { perigrafh: 1, _id: 1 } },
            { $skip: skip },
            { $limit: perPage },
            ]).exec();

            // 7) Render – ΠΕΡΝΑ το perx!
            return res.render("symbaseis/symbaseis/symbaseis", {
                userPrivileges,
                locals,
                current: page,
                pages: totalPages,
                perx,              // <-- για το UI πολλαπλασιαστή
                basePer,           // (προαιρετικό, αν το δείχνεις)
                entries: perPage,  // (προαιρετικό: πόσα/σελίδα)
                totalRecs: total,  // (προαιρετικό: συνολικά)
                symbaseis,
            });
        } catch (error) {
            console.error(error);
            return next(error);
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
                context: "symbash",
                rec: {},
            });
        } catch (error) {
            console.log("Σφάλμα :", error);
        }
    };

    static postSymbaseisForm = async (req, res) => {
        const formData = req.body;

        const newSymbash = SymbaseisModel({
            kodikos: formatNumber(formData.kodikos, 4),
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
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9() ]/g, "");
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
                context: "symbash",
                rec: {},
            });
        } catch (error) {
            console.log(error);
        }
    };

    static addKathgoriesSymbaseonForm = async (req, res) => {
        const locals = {
            title: "Προσθήκη Νέας Κατηγορίας",
            description: "Web Payroll System",
        };

        try {
            const lastRecord = await KathgoriesSymbaseonModel.find()
                .lean()
                .sort({ _id: -1 })
                .limit(1);

                let aa_value = lastRecord?.[0]?.aa ? parseInt(lastRecord[0].aa, 10) + 1 : 1;

            const kodikos_symbashs = req.params.kodikosSymbashs;
            const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs}).lean()

            const lastRecord_kathgorias_symbashs = await KathgoriesSymbaseonModel.find({ afora_thn_symbash: kodikos_symbashs })
                .lean()
                .sort({ _id: -1 })
                .limit(1);

            const aa_kodikos = (lastRecord_kathgorias_symbashs[0]?.kodikos !== undefined && lastRecord_kathgorias_symbashs[0]?.kodikos !== null
                ? parseInt(String(lastRecord_kathgorias_symbashs[0].kodikos), 10)
                : NaN) + 1 || 1;

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
        try {
            const { aa, kodikos, perigrafh, afora_thn_symbash } = req.body;

            await KathgoriesSymbaseonModel.create({
                aa,
                kodikos,
                perigrafh,
                afora_thn_symbash,
            });

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ aa (global)
            const [lastGlobal] = await KathgoriesSymbaseonModel
            .find().sort({ _id: -1 }).limit(1).lean();
            const nextAa = (parseInt(lastGlobal?.aa, 10) || 0) + 1;

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ kodikos ΓΙΑ την τρέχουσα κατηγορία
            const [lastInCat] = await KathgoriesSymbaseonModel
            .find({ afora_thn_symbash })
            .sort({ kodikos: -1, _id: -1 }).limit(1).lean();
            const nextKodikos = String((parseInt(lastInCat?.kodikos, 10) || 0) + 1).padStart(4, "0");

            // ΕΠΙΣΤΡΕΦΟΥΜΕ JSON (χωρίς redirect)
            return res.json({ success: true, nextAa, nextKodikos });
        } catch (error) {
            console.error(error);
            return res.status(400).json({ success: false, message: error.message });
        }
    };

    static searchPostKathgoriesSymbaseon = async (req, res, next) => {
        const locals = {
            title: 'Αναζήτηση Κατηγοριών Συμβάσεων',
            description: 'Web Payroll System',
        };

        try {
            const selectedSymbash = req.params?.symbash_stathera?.trim();
            const searchTermRaw = (req.body?.searchTerm ?? '').trim();

            if (!selectedSymbash) {
                return res.status(400).render('symbaseis/kathgories/index', {
                    ...locals,
                    error: 'Πρέπει να επιλέξετε σύμβαση.',
                });
            }

            const sessionUserId = req.session.userId;
            const userPrivileges = await UserPrivilegesModel
            .findOne({ userId: sessionUserId, form: 'KathgoriesSymbaseon' })
            .lean();

            const perPage = Number(process.env.EGGRAFES) || 10;
            const page = Math.max(1, parseInt(req.query.page ?? '1', 10));

            // Ασφαλές regex από input
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sTerm = searchTermRaw;
            const termRegex = sTerm ? new RegExp(escapeRegex(sTerm), 'i') : null;

            // Βάση φίλτρων
            const baseMatch = {
                afora_thn_symbash: selectedSymbash,
                ...(termRegex && { $or: [{ kodikos: termRegex }, { perigrafh: termRegex }] }),
            };

            // Σύνολο εγγραφών
            const countResults = await KathgoriesSymbaseonModel.aggregate([
                { $match: baseMatch },
                { $count: 'total' },
            ]).exec();

            const totalRecords = countResults[0]?.total ?? 0;
            const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
            const skip = (page - 1) * perPage;

            // Δεδομένα σελίδας (με σταθερό sort)
            const rows = await KathgoriesSymbaseonModel.aggregate([
                { $match: baseMatch },
                { $sort: { kodikos: 1, _id: 1 } },
                { $skip: skip },
                { $limit: perPage },
            ]).exec();

            // Highlight (ασφαλές)
            const highlight = (txt) => {
                const str = String(txt ?? '');
                return !termRegex ? str : str.replace(new RegExp(`(${escapeRegex(sTerm)})`, 'gi'), '<mark>$1</mark>');
            };
            const highlightedRecords = rows.map(r => ({
                ...r,
                kodikos: highlight(r.kodikos),
                perigrafh: highlight(r.perigrafh),
            }));

            // Φέρε τη σύμβαση για να δείξεις κωδ/περιγραφή στην κεφαλίδα
            const symbash = await SymbaseisModel
            .findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
            .lean();

            return res.render('symbaseis/kathgories/search', {
                userPrivileges,
                locals,
                current: page,
                pages: totalPages,
                sTerm,
                entries: perPage,
                totalRecs: totalRecords,
                selectedSymbash,
                symbash_stathera: selectedSymbash, // για να ταιριάζει με το EJS σου
                symbash,
                kathgoriesSymbaseonFilteredRecs: highlightedRecords,
            });
        } catch (error) {
            return next(error);
        }
    };

    static searchGetKathgoriesSymbaseon = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Κατηγοριών Συμβάσεων",
            description: "Web Payroll System",
        };

        try {
            const sessionUserId = req.session.userId;
            const perPage = Number(process.env.EGGRAFES);
            const selectedSymbash = (req.query.symbash_stathera || '').trim();
            const searchTerm = (req.query.sTerm || '').trim();
            const page = Math.max(1, parseInt(req.query.page || '1', 10));

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
    
            // Φέρε τη σύμβαση για να δείξεις κωδ/περιγραφή στην κεφαλίδα
            const symbash = await SymbaseisModel
                .findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
                .lean();

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
                symbash_stathera: selectedSymbash, // για να ταιριάζει με το EJS
                symbash,
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
            const kathgories = await KathgoriesSymbaseonModel.findById(kathgoriesId).lean();

            const symbaseis = await SymbaseisModel.findOne({ kodikos: kathgories.afora_thn_symbash }).lean();
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

    static listKathgoriesSymbaseon = async (req, res) => {
        try {
            const sym = String(req.query.symbash_stathera || "").trim();
            const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

            // Αν δεν έχει σταθερά σύμβασης, γύρνα άδεια λίστα (είναι πιο ασφαλές και «ελαφρύ»)
            if (!sym) {
                return res.json({ items: [], page: 1, pages: 1, total: 0 });
            }

            // Φίλτρο βάσει layout: afora_thn_symbash = "0002" κ.λπ.
            const query = { afora_thn_symbash: sym };

            // Εφόσον το kodikos είναι ήδη zero-padded (π.χ. "0001"), η string ταξινόμηση είναι οκ.
            const sort = { kodikos: 1 };

            const [docs, total] = await Promise.all([
                KathgoriesSymbaseonModel
                .find(query)
                .select({ kodikos: 1, perigrafh: 1 }) // μικρή βελτίωση: μόνο ό,τι χρειάζεται
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
                KathgoriesSymbaseonModel.countDocuments(query),
            ]);

            const items = (docs || []).map(d => ({
                id: String(d._id),
                kodikos: to4(d.kodikos),       // μορφή "0001"
                perigrafh: d.perigrafh || "",
            }));

            const pages = Math.max(1, Math.ceil(total / limit));
            res.json({ items, page, pages, total });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    };

// ================================== Ειδικότητες Συμβάσεων ====================================

    static mainEidikothtesSymbaseonForm = async (req, res) => {
        const locals = {
            title: "Διαχείριση Ειδικοτήτων Συμβάσεων",
            description: "Web Payroll System",
        };
        const sessionUserId = req.session.userId;
        const basePer = Number(process.env.EGGRAFES) || 10;
        const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1)); // 1..5
        const perPage = basePer * perx;

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "EidikothtesSymbaseon",
            }).exec();

            res.render("symbaseis/eidikothtes/eidikothtes", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: 1,
                pages: 1,
                context: "kathgoria_symbashs",
                rec: {},
            });
        } catch (error) {
            console.log(error);
        }
    };

    static searchPostEidikothtesSymbaseon = async (req, res, next) => {
        const locals = {
            title: 'Αναζήτηση Ειδικοτήτων Συμβάσεων',
            description: 'Web Payroll System',
        };

        try {
            const selectedSymbashKathgoria = req.params?.kodikos_symbashs_kathgorias?.trim();
            const selectedSymbash = req.params?.kodikos_symbashs_kathgorias.substring(0, 4)?.trim();
            const selectedKathgoria = req.params?.kodikos_symbashs_kathgorias.substring(4, 8)?.trim();
            const searchTermRaw = (req.body?.searchTerm ?? '').trim();

            if (!selectedSymbash) {
                return res.status(400).render('symbaseis/eidikothtes', {
                    ...locals,
                    error: 'Πρέπει να επιλέξετε σύμβαση.',
                });
            }
            if (!selectedKathgoria) {
                return res.status(400).render('symbaseis/eidikothtes', {
                    ...locals,
                    error: 'Πρέπει να επιλέξετε σύμβαση.',
                });
            }

            const sessionUserId = req.session.userId;
            const userPrivileges = await UserPrivilegesModel
            .findOne({ userId: sessionUserId, form: 'EidikothtesSymbaseon' })
            .lean();

            const perPage = Number(process.env.EGGRAFES) || 10;
            const page = Math.max(1, parseInt(req.query.page ?? '1', 10));

            // Ασφαλές regex από input
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sTerm = searchTermRaw;
            const termRegex = sTerm ? new RegExp(escapeRegex(sTerm), 'i') : null;

            // Βάση φίλτρων
            const baseMatch = {
                afora_thn_symbash_kathgoria: selectedSymbashKathgoria,
                ...(termRegex && { $or: [{ kodikos: termRegex }, { perigrafh: termRegex }] }),
            };

            // Σύνολο εγγραφών
            const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
                { $match: baseMatch },
                { $count: 'total' },
            ]).exec();

            const totalRecords = countResults[0]?.total ?? 0;
            const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
            const skip = (page - 1) * perPage;

            // Δεδομένα σελίδας (με σταθερό sort)
            const rows = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
                { $match: baseMatch },
                { $sort: { kodikos: 1, _id: 1 } },
                { $skip: skip },
                { $limit: perPage },
            ]).exec();

            // Highlight (ασφαλές)
            const highlight = (txt) => {
                const str = String(txt ?? '');
                return !termRegex ? str : str.replace(new RegExp(`(${escapeRegex(sTerm)})`, 'gi'), '<mark>$1</mark>');
            };
            const highlightedRecords = rows.map(r => ({
                ...r,
                kodikos: highlight(r.kodikos),
                perigrafh: highlight(r.perigrafh),
            }));

            // Φέρε τη σύμβαση για να δείξεις κωδ/περιγραφή στην κεφαλίδα
            const symbash = await SymbaseisModel
                .findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
                .lean();

            // Φέρε την κατηγορία για να δείξεις κωδ/περιγραφή στην κεφαλίδα
            const kathgoria = await KathgoriesSymbaseonModel
                .findOne(
                    {
                        kodikos: selectedKathgoria,
                        afora_thn_symbash: selectedSymbash,
                    },
                    { kodikos: 1, perigrafh: 1 }
                )
                .lean();

            return res.render('symbaseis/eidikothtes/search', {
                userPrivileges,
                locals,
                current: page,
                pages: totalPages,
                sTerm,
                entries: perPage,
                totalRecs: totalRecords,
                selectedSymbash,
                selectedKathgoria,
                symbash_stathera: selectedSymbash, // για να ταιριάζει με το EJS
                kathgoria_stathera: selectedKathgoria, // για να ταιριάζει με το EJS
                symbash,
                kathgoria,
                eidikothtesSymbaseonFilteredRecs: highlightedRecords,
            });
        } catch (error) {
            return next(error);
        }
    };

	static searchGetEidikothtesSymbaseon = async (req, res, next) => {
		const locals = {
			title: "Αναζήτηση Ειδικοτήτων Συμβάσεων",
			description: "Web Payroll System",
		};

		try {
			const sessionUserId = req.session.userId;
			const perPage = Number(process.env.EGGRAFES) || 10;

			// --------------------- 1. ΔΙΑΒΑΣΜΑ QUERY ---------------------
			const page = Math.max(1, parseInt(req.query.page || "1", 10));

			// αυτό έρχεται από το EJS: &combo=00010002[?sTerm=...]
			let combo = (req.query.combo || "").trim();

			// και το κανονικό sTerm (αν ήρθε σωστά)
			let sTerm = (req.query.sTerm || "").trim();

			// Αν το EJS κόλλησε το ?sTerm πάνω στο combo, π.χ. "00010002?sTerm=misth"
			if (combo.includes("?")) {
				const [pureCombo, tail] = combo.split("?", 2);
				combo = pureCombo.trim();

				// προσπάθησε να διαβάσεις το sTerm από το tail
				if (!sTerm && tail) {
					const params = new URLSearchParams(tail);
					sTerm = (params.get("sTerm") || "").trim();
				}
			}

			// backup: αν υπάρχει path param (π.χ. /search/00010002)
			const comboFromParams =
			(req.params?.kodikos_symbashs_kathgorias || "").trim();

			// τελικό 8ψήφιο
			const selectedSymbashKathgoria = combo || comboFromParams;

			// σπάσε το σε 4+4
			const selectedSymbash = selectedSymbashKathgoria?.substring(0, 4)?.trim() || "";
			const selectedKathgoria = selectedSymbashKathgoria?.substring(4, 8)?.trim() || "";

			// αν δεν έχουμε και τα δύο → γύρνα στην αρχική
			if (!selectedSymbash || !selectedKathgoria) {
				return res.redirect("/symbaseis/eidikothtes");
			}

			// --------------------- 2. ΔΙΚΑΙΩΜΑΤΑ ---------------------
			const userPrivileges = await UserPrivilegesModel
				.findOne({ userId: sessionUserId, form: "EidikothtesSymbaseon" })
				.lean();

			// --------------------- 3. ΦΙΛΤΡΟ / ΑΝΑΖΗΤΗΣΗ ---------------------
			const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const termRegex = sTerm ? new RegExp(escapeRegex(sTerm), "i") : null;

			// βάση φίλτρων
			const baseMatch = {
				afora_thn_symbash_kathgoria: selectedSymbashKathgoria,
				...(termRegex && {
					$or: [{ kodikos: termRegex }, { perigrafh: termRegex }],
				}),
			};

			// --------------------- 4. COUNT ---------------------
			const countResults = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $count: "total" },
			]).exec();

			const totalRecords = countResults[0]?.total ?? 0;
			const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
			const skip = (page - 1) * perPage;

			// --------------------- 5. DATA ---------------------
			const rows = await EidikothtesAnaKathgoriaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $sort: { kodikos: 1, _id: 1 } },
				{ $skip: skip },
				{ $limit: perPage },
			]).exec();

			// highlight όπως στο POST
			const highlight = (txt) => {
				const str = String(txt ?? "");
				return !termRegex
					? str
					: str.replace(
						new RegExp(`(${escapeRegex(sTerm)})`, "gi"),
						"<mark>$1</mark>"
					);
			};

			const highlightedRecords = rows.map((r) => ({
				...r,
				kodikos: highlight(r.kodikos),
				perigrafh: highlight(r.perigrafh),
			}));

			// --------------------- 6. HEADERS (σύμβαση + κατηγορία) ---------------------
			const symbash = await SymbaseisModel
				.findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
				.lean();

			const kathgoria = await KathgoriesSymbaseonModel
			.findOne(
				{
					kodikos: selectedKathgoria,
					afora_thn_symbash: selectedSymbash,
				},
				{ kodikos: 1, perigrafh: 1 }
			)
			.lean();

			// --------------------- 7. RENDER ---------------------
			return res.render("symbaseis/eidikothtes/search", {
				nonce: res.locals.nonce,
				locals,
				userPrivileges,

				// πίνακας
				eidikothtesSymbaseonFilteredRecs: highlightedRecords,

				// pagination
				current: page,
				pages: totalPages,
				entries: perPage,
				totalRecs: totalRecords,

				// φόρμα
				sTerm,
				selectedSymbash,
				selectedKathgoria,
				selectedSymbashKathgoria,
				symbash_stathera: selectedSymbash,
				kathgoria_stathera: selectedKathgoria,

				// για τις επικεφαλίδες
				symbash,
				kathgoria,
			});
		} catch (error) {
			console.error(error);
			return next(error);
		}
	};

    static addEidikothtesSymbaseonForm = async (req, res) => {
        const locals = {
            title: "Προσθήκη Νέας Ειδικότητας",
            description: "Web Payroll System",
        };

        try {
            const lastRecord = await EidikothtesAnaKathgoriaSymbaseonModel.find()
                .lean()
                .sort({ _id: -1 })
                .limit(1);

            let aa_value = lastRecord?.[0]?.aa ? parseInt(lastRecord[0].aa, 10) + 1 : 1;

            const kodikos_symbashs_kathgorias = req.params.kodikosSymbashs_Kathgorias;

            const kodikos_symbashs = kodikos_symbashs_kathgorias.substring(0, 4);
            const kodikos_kathgorias = kodikos_symbashs_kathgorias.substring(4, 8);

            const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs}).lean()

            const kathgoria = await KathgoriesSymbaseonModel.find({ kodikos: kodikos_kathgorias, afora_thn_symbash: kodikos_symbashs})

            const lastRecord_eidikothtas_symbashs = await EidikothtesAnaKathgoriaSymbaseonModel.find({ afora_thn_symbash_kathgoria: kodikos_symbashs_kathgorias })
                .lean()
                .sort({ _id: -1 })
                .limit(1);

            const aa_kodikos = (lastRecord_eidikothtas_symbashs[0]?.kodikos !== undefined && lastRecord_eidikothtas_symbashs[0]?.kodikos !== null
                ? parseInt(String(lastRecord_eidikothtas_symbashs[0].kodikos), 10)
                : NaN) + 1 || 1;

            res.render("symbaseis/eidikothtes/add", {
                locals,
                aa_value,
                aa_kodikos,
                symbash,
                kathgoria,
            });
        } catch (error) {
            console.log("Σφάλμα :", error);
        }
    };

    static postEidikothtesSymbaseonForm = async (req, res) => {
        try {
            const { aa, kodikos, perigrafh, afora_thn_symbash_kathgoria } = req.body;

            await EidikothtesAnaKathgoriaSymbaseonModel.create({
                aa,
                kodikos,
                perigrafh,
                afora_thn_symbash_kathgoria,
            });

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ aa (global)
            const [lastGlobal] = await EidikothtesAnaKathgoriaSymbaseonModel
            .find().sort({ _id: -1 }).limit(1).lean();
            const nextAa = (parseInt(lastGlobal?.aa, 10) || 0) + 1;

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ kodikos ΓΙΑ την τρέχουσα κατηγορία
            const [lastInCat] = await EidikothtesAnaKathgoriaSymbaseonModel
            .find({ afora_thn_symbash_kathgoria })
            .sort({ kodikos: -1, _id: -1 }).limit(1).lean();
            const nextKodikos = String((parseInt(lastInCat?.kodikos, 10) || 0) + 1).padStart(4, "0");

            // ΕΠΙΣΤΡΕΦΟΥΜΕ JSON (χωρίς redirect)
            return res.json({ success: true, nextAa, nextKodikos });
        } catch (error) {
            console.error(error);
            return res.status(400).json({ success: false, message: error.message });
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
    
        static listEidikothtesSymbaseon = async (req, res) => {
            try {
                // 1) Πάρε έτοιμο composite key αν δίνεται, αλλιώς φτιάξ’ το από τα 2 hidden
                const comboFromQuery = String(req.query.afora_thn_symbash_kathgoria || '').trim();
                const symHidden  = String(req.query.symbash_stathera || '').trim();
                const kathHidden = String(req.query.kathgoria_symbashs_stathera || '').trim();

                const compositeKey = comboFromQuery
                || (symHidden && kathHidden ? `${to4(symHidden)}${to4(kathHidden)}` : '');

                const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
                const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

                // 2) Αν δεν έχουμε κλειδί, γύρνα άδειο αποτέλεσμα
                if (!compositeKey) {
                    return res.json({ items: [], page: 1, pages: 1, total: 0 });
                }

                // 3) Φίλτρο: afora_thn_symbash_kathgoria = "0002xxxx"
                    const query = { afora_thn_symbash_kathgoria: compositeKey };

                // 4) Ταξινόμηση: με kodikos (είναι ήδη zero-padded)
                    const sort = { kodikos: 1 };

                // 5) Ανάκτηση + total
                const [docs, total] = await Promise.all([
                    EidikothtesAnaKathgoriaSymbaseonModel
                        .find(query)
                        .select({ kodikos: 1, perigrafh: 1 })     // μόνο ό,τι χρειάζεται
                        .sort(sort)
                        .skip((page - 1) * limit)
                        .limit(limit)
                        .lean(),
                    EidikothtesAnaKathgoriaSymbaseonModel.countDocuments(query),
                ]);

                // 6) Μορφοποίηση για τον πίνακα
                const items = (docs || []).map(d => ({
                    id: String(d._id),
                    kodikos: to4(d.kodikos),            // "0001"
                    perigrafh: d.perigrafh || '',
                }));

                const pages = Math.max(1, Math.ceil(total / limit));
                res.json({ items, page, pages, total });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Server error' });
            }
        };

        static listEidikothtesSymbaseonMulti = async (req, res) => {
            try {
                // 1) Πάρε έτοιμο composite key αν δίνεται, αλλιώς φτιάξ’ το από τα 2 hidden
                const comboFromQuery = String(req.query.afora_thn_symbash_kathgoria || '').trim();
                const symHidden  = String(req.query.symbash_stathera || '').trim();
                const kathHidden = String(req.query.kathgoria_symbashs_stathera || '').trim();

                const compositeKey = comboFromQuery
                || (symHidden && kathHidden ? `${to4(symHidden)}${to4(kathHidden)}` : '');

                const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
                const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

                // 2) Αν δεν έχουμε κλειδί, γύρνα άδειο αποτέλεσμα
                if (!compositeKey) {
                    return res.json({ items: [], page: 1, pages: 1, total: 0 });
                }

                // 3) Φίλτρο: afora_thn_symbash_kathgoria = "0002xxxx"
                    const query = { afora_thn_symbash_kathgoria: compositeKey };

                // 4) Ταξινόμηση: με kodikos (είναι ήδη zero-padded)
                    const sort = { kodikos: 1 };

                // 5) Ανάκτηση + total
                const [docs, total] = await Promise.all([
                    EidikothtesAnaKathgoriaSymbaseonModel
                        .find(query)
                        .select({ kodikos: 1, perigrafh: 1 })     // μόνο ό,τι χρειάζεται
                        .sort(sort)
                        .skip((page - 1) * limit)
                        .limit(limit)
                        .lean(),
                    EidikothtesAnaKathgoriaSymbaseonModel.countDocuments(query),
                ]);

                // 6) Μορφοποίηση για τον πίνακα
                const items = (docs || []).map(d => ({
                    id: String(d._id),
                    kodikos: to4(d.kodikos),            // "0001"
                    perigrafh: d.perigrafh || '',
                }));

                const pages = Math.max(1, Math.ceil(total / limit));
                res.json({ items, page, pages, total });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Server error' });
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
                context: "eidikothta_symbashs",
                rec: {},
            });
        } catch (error) {
            console.log(error);
        }
    };

	static searchPostStoixeiaSymbaseon = async (req, res, next) => {
		const locals = {
			title: "Αναζήτηση Στοιχείων Συμβάσεων",
			description: "Web Payroll System",
		};

		try {
			// 12ψήφιο από το path: 0001 0002 0003
			const selectedSymKathEid =
			(req.params?.kodikos_symbashs_kathgorias_eidikothtas || "").trim();

			const selectedSymbash =
			selectedSymKathEid.substring(0, 4)?.trim() || "";
			const selectedKathgoria =
			selectedSymKathEid.substring(4, 8)?.trim() || "";
			const selectedEidikothta =
			selectedSymKathEid.substring(8, 12)?.trim() || "";

			const searchTermRaw = (req.body?.searchTerm ?? "").trim();

			// βασικοί έλεγχοι
			if (!selectedSymbash) {
				return res.status(400).render("symbaseis/stoixeiaSymbaseon", {
					...locals,
					error: "Πρέπει να επιλέξετε σύμβαση.",
				});
			}
			if (!selectedKathgoria) {
				return res.status(400).render("symbaseis/stoixeiaSymbaseon", {
					...locals,
					error: "Πρέπει να επιλέξετε κατηγορία.",
				});
			}
			if (!selectedEidikothta) {
				return res.status(400).render("symbaseis/stoixeiaSymbaseon", {
					...locals,
					error: "Πρέπει να επιλέξετε ειδικότητα.",
				});
			}

			// δικαιώματα
			const sessionUserId = req.session.userId;
			const userPrivileges = await UserPrivilegesModel
				.findOne({ userId: sessionUserId, form: "StoixeiaSymbaseon" })
				.lean();

			const perPage = Number(process.env.EGGRAFES) || 10;
			const page = Math.max(1, parseInt(req.query.page ?? "1", 10));

			// ασφαλές regex
			const escapeRegex = (s) =>
				s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const sTerm = searchTermRaw;
				const termRegex = sTerm ? new RegExp(escapeRegex(sTerm), "i") : null;

			// φίλτρο για τα ΣΤΟΙΧΕΙΑ
			const baseMatch = {
				afora_thn_symbash_kathgoria_eidikothta: selectedSymKathEid,
				...(termRegex && {
					$or: [{ kodikos: termRegex }, { perigrafh: termRegex }],
				}),
			};

			// count
			const countResults = await StoixeiaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $count: "total" },
			]).exec();

			const totalRecords = countResults[0]?.total ?? 0;
			const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
			const skip = (page - 1) * perPage;

			// data
			const rows = await StoixeiaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $sort: { kodikos: 1, _id: 1 } },
				{ $skip: skip },
				{ $limit: perPage },
			]).exec();

			// highlight
			const highlight = (txt) => {
			const str = String(txt ?? "");
				return !termRegex
					? str
					: str.replace(
						new RegExp(`(${escapeRegex(sTerm)})`, "gi"),
						"<mark>$1</mark>"
					);
			};

			const highlightedRecords = rows.map((r) => ({
				...r,
				kodikos: highlight(r.kodikos),
				perigrafh: highlight(r.perigrafh),
			}));

			// -------- fetch για header --------
			// σύμβαση
			const symbash = await SymbaseisModel
				.findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
				.lean();

			// κατηγορία (με τη σύμβαση)
			const kathgoria = await KathgoriesSymbaseonModel
				.findOne(
					{
						kodikos: selectedKathgoria,
						afora_thn_symbash: selectedSymbash,
					},
					{ kodikos: 1, perigrafh: 1 }
				)
				.lean();

			// ειδικότητα (με σύμβαση+κατηγορία)
			const eidikothta = await EidikothtesAnaKathgoriaSymbaseonModel
				.findOne(
					{
						kodikos: selectedEidikothta,
						afora_thn_symbash_kathgoria: selectedSymbash + selectedKathgoria,
					},
					{ kodikos: 1, perigrafh: 1 }
				)
				.lean();

			// render
			return res.render("symbaseis/stoixeiaSymbaseon/search", {
				nonce: res.locals.nonce,          // αν έχεις CSP
				userPrivileges,
				locals,

				// pagination
				current: page,
				pages: totalPages,
				entries: perPage,
				totalRecs: totalRecords,

				// αναζήτηση
				sTerm,

				// για το EJS στο πάνω μέρος
				selectedSymbash,
				selectedKathgoria,
				selectedEidikothta,
				symbash_stathera: selectedSymbash,
				kathgoria_stathera: selectedKathgoria,
				eidikothta_stathera: selectedEidikothta,

				symbash,
				kathgoria,
				eidikothta,

				// πίνακας
				stoixeiaSymbaseonFilteredRecs: highlightedRecords,
			});
		} catch (error) {
			return next(error);
		}
	};

	static searchGetStoixeiaSymbaseon = async (req, res, next) => {
		const locals = {
			title: "Αναζήτηση Στοιχείων Συμβάσεων",
			description: "Web Payroll System",
		};

		try {
			const sessionUserId = req.session.userId;
			const perPage = Number(process.env.EGGRAFES) || 10;

			// 1. basic
			const page = Math.max(1, parseInt(req.query.page || "1", 10));

			// combo=000100020003 ή combo=000100020003?sTerm=...
			let combo = (req.query.combo || "").trim();

			// πιθανό καθαρό sTerm
			let sTerm = (req.query.sTerm || "").trim();

			// αν το sTerm κόλλησε πάνω στο combo, χώρισέ το
			if (combo.includes("?")) {
				const [pureCombo, tail] = combo.split("?", 2);
				combo = pureCombo.trim();

				if (!sTerm && tail) {
					const params = new URLSearchParams(tail);
					sTerm = (params.get("sTerm") || "").trim();
				}
			}

			// backup: αν το έχεις και στο path (π.χ. /search/000100020003)
			const comboFromParams =
			(req.params?.kodikos_symbashs_kathgorias_eidikothtas || "").trim();

			const selectedSymKathEid = combo || comboFromParams;

			const selectedSymbash    = selectedSymKathEid.substring(0, 4)?.trim() || "";
			const selectedKathgoria  = selectedSymKathEid.substring(4, 8)?.trim() || "";
			const selectedEidikothta = selectedSymKathEid.substring(8, 12)?.trim() || "";

			// αν λείπει κάτι → γύρνα στην αρχική των στοιχείων
			if (!selectedSymbash || !selectedKathgoria || !selectedEidikothta) {
				return res.redirect("/symbaseis/stoixeia");
			}

			// 2. δικαιώματα
			const userPrivileges = await UserPrivilegesModel
			.findOne({ userId: sessionUserId, form: "StoixeiaSymbaseon" })
			.lean();

			// 3. φίλτρο
			const escapeRegex = (s) =>
			s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const termRegex = sTerm ? new RegExp(escapeRegex(sTerm), "i") : null;

			const baseMatch = {
				afora_thn_symbash_kathgoria_eidikothta: selectedSymKathEid,
				...(termRegex && {
					$or: [{ kodikos: termRegex }, { perigrafh: termRegex }],
				}),
			};

			// 4. count
			const countResults = await StoixeiaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $count: "total" },
			]).exec();

			const totalRecords = countResults[0]?.total ?? 0;
			const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
			const skip = (page - 1) * perPage;

			// 5. data
			const rows = await StoixeiaSymbaseonModel.aggregate([
				{ $match: baseMatch },
				{ $sort: { kodikos: 1, _id: 1 } },
				{ $skip: skip },
				{ $limit: perPage },
			]).exec();

			const highlight = (txt) => {
				const str = String(txt ?? "");
				return !termRegex
					? str
					: str.replace(
						new RegExp(`(${escapeRegex(sTerm)})`, "gi"),
						"<mark>$1</mark>"
					);
			};

			const highlightedRecords = rows.map((r) => ({
				...r,
				kodikos: highlight(r.kodikos),
				perigrafh: highlight(r.perigrafh),
			}));

			// 6. headers
			const symbash = await SymbaseisModel
				.findOne({ kodikos: selectedSymbash }, { kodikos: 1, perigrafh: 1 })
				.lean();

			const kathgoria = await KathgoriesSymbaseonModel
				.findOne(
					{
						kodikos: selectedKathgoria,
						afora_thn_symbash: selectedSymbash,
					},
					{ kodikos: 1, perigrafh: 1 }
				)
				.lean();

			const eidikothta = await EidikothtesAnaKathgoriaSymbaseonModel
				.findOne(
					{
					kodikos: selectedEidikothta,
					afora_thn_symbash_kathgoria: selectedSymbash + selectedKathgoria,
					},
					{ kodikos: 1, perigrafh: 1 }
				)
				.lean();

			// 7. render
			return res.render("symbaseis/stoixeiaSymbaseon/search", {
				nonce: res.locals.nonce,
				locals,
				userPrivileges,

				stoixeiaSymbaseonFilteredRecs: highlightedRecords,

				current: page,
				pages: totalPages,
				entries: perPage,
				totalRecs: totalRecords,

				sTerm,

				selectedSymbash,
				selectedKathgoria,
				selectedEidikothta,
				symbash_stathera: selectedSymbash,
				kathgoria_stathera: selectedKathgoria,
				eidikothta_stathera: selectedEidikothta,

				symbash,
				kathgoria,
				eidikothta,
			});
		} catch (error) {
			console.error(error);
			return next(error);
		}
	};

    static addStoixeiaSymbaseonForm = async (req, res) => {
        const locals = {
        title: "Προσθήκη Νέου Στοιχείου",
        description: "Web Payroll System",
        };  
        
        try {
            const lastRecord = await StoixeiaSymbaseonModel
                .find()
                .lean()
                .sort({ _id: -1 })
                .limit(1);

            let aa_value = lastRecord?.[0]?.aa ? parseInt(lastRecord[0].aa, 10) + 1 : 1;

            const kodikos_symbashs_kathgorias_eidikothtas = req.params.kodikosSymbashs_Kathgorias_Eidikothtas;
        
            const kodikos_symbashs_kathgorias = kodikos_symbashs_kathgorias_eidikothtas.substring(0, 8);
            const kodikos_symbashs = kodikos_symbashs_kathgorias_eidikothtas.substring(0, 4);
            const kodikos_kathgorias = kodikos_symbashs_kathgorias_eidikothtas.substring(4, 8);
            const kodikos_eidikothtas = kodikos_symbashs_kathgorias_eidikothtas.substring(8, 12);

            const symbash = await SymbaseisModel.find({ kodikos: kodikos_symbashs}).lean();

            const kathgoria = await KathgoriesSymbaseonModel.find({ kodikos: kodikos_kathgorias, afora_thn_symbash: kodikos_symbashs});

            const eidikothta = await EidikothtesAnaKathgoriaSymbaseonModel.find({ kodikos: kodikos_eidikothtas, afora_thn_symbash_kathgoria: kodikos_symbashs_kathgorias});

            const lastRecord_stoixeia_symbashs = await StoixeiaSymbaseonModel.find({ afora_thn_symbash_kathgoria_eidikothta: kodikos_symbashs_kathgorias_eidikothtas })
                .lean()
                .sort({ _id: -1 })
                .limit(1);

            const aa_kodikos = (lastRecord_stoixeia_symbashs[0]?.kodikos !== undefined && lastRecord_stoixeia_symbashs[0]?.kodikos !== null
                ? parseInt(String(lastRecord_stoixeia_symbashs[0].kodikos), 10)
                : NaN) + 1 || 1;

            res.render("symbaseis/stoixeiaSymbaseon/add", {
                locals,
                aa_value,
                aa_kodikos,
                symbash,
                kathgoria, 
                eidikothta
            });  
        } catch (error) {
              console.log("Σφάλμα :", error);
        }  
    };  

    static postStoixeiaSymbaseonForm = async (req, res) => {
        try {
            const   { 
                        kodikos, 
                        perigrafh, 
                        afora_thn_symbash_kathgoria_eidikothta, 
                        poso_pososto, 
                        arithmos_klimakion, 
                        ypologismos_apo_klimakio, 
                        bhma_ypologismoy, 
                        poso, 
                        pososto, 
                        typos_ypologismoy 
                    } = req.body;

			const posoNum    = parseGreekDecimal(poso, 0);       // "1.030,00" -> 1030
			const posostoNum = parseGreekDecimal(pososto, 0);    // "0,00"     -> 0

			const klimakiaNum  = Number(arithmos_klimakion ?? 0);
			const apoKlimakio  = Number(ypologismos_apo_klimakio ?? 0);
			const bhmaNum      = Number(bhma_ypologismoy ?? 0);

			// checkbox: αν τσεκαρισμένο στέλνει "on" ή "1"
			const posoPosostoFlag =
			poso_pososto === 'on' || poso_pososto === '1' || poso_pososto === 1;

			await StoixeiaSymbaseonModel.create({
				kodikos: 								String(kodikos ?? '').trim(),
				perigrafh: 								String(perigrafh ?? '').trim(),
				afora_thn_symbash_kathgoria_eidikothta: String(afora_thn_symbash_kathgoria_eidikothta ?? ''
				).trim(),
				poso_pososto: 							posoPosostoFlag,
				arithmos_klimakion: 					klimakiaNum,
				ypologismos_apo_klimakio: 				apoKlimakio,
				bhma_ypologismoy: 						bhmaNum,
				poso: 									posoNum,
				pososto: 								posostoNum,
				typos_ypologismoy: 						String(typos_ypologismoy ?? '').trim(),
			});

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ aa (global)
            const [lastGlobal] = await StoixeiaSymbaseonModel
            .find().sort({ _id: -1 }).limit(1).lean();
            const nextAa = (parseInt(lastGlobal?.aa, 10) || 0) + 1;

            // Υπολόγισε ΤΟ ΕΠΟΜΕΝΟ kodikos ΓΙΑ την τρέχουσα κατηγορία
            const [lastInEid] = await StoixeiaSymbaseonModel
            .find({ afora_thn_symbash_kathgoria_eidikothta })
            .sort({ kodikos: -1, _id: -1 }).limit(1).lean();
            const nextKodikos = String((parseInt(lastInEid?.kodikos, 10) || 0) + 1).padStart(4, "0");

            // ΕΠΙΣΤΡΕΦΟΥΜΕ JSON (χωρίς redirect)
            return res.json({ success: true, nextAa, nextKodikos });
        } catch (error) {
            console.error(error);
            return res.status(400).json({ success: false, message: error.message });
        }
    };

    static editStoixeiaSymbaseonForm = async (req, res) => {
        const locals = {
        title: "Συντήρηση Στοιχείων Συμβάσεων",
        description: "Web Payroll System",
        };

        try {
        const stoixeiaSymbaseonId = req.params.id; 
        const stoixeiaSymbaseon = await StoixeiaSymbaseonModel.findById(stoixeiaSymbaseonId).lean();

        const symbaseis = await SymbaseisModel.findOne({ kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 4) }).lean();
        const kathgories = await KathgoriesSymbaseonModel.findOne({ afora_thn_symbash: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 4), kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(4, 8) }).lean();
        const eidikothtes = await EidikothtesAnaKathgoriaSymbaseonModel.findOne({ afora_thn_symbash_kathgoria: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(0, 8), kodikos: stoixeiaSymbaseon.afora_thn_symbash_kathgoria_eidikothta.toString().substring(8, 12) }).lean();
        
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

	static postStoixeiaSymbaseonUpdate = async (req, res, next) => {
		try {
			const stoixeiaSymbaseonId = req.params.stoixeiaSymbaseonId;
			const formData = req.body;

			if (!stoixeiaSymbaseonId) {
				return res.status(400).json({ success: false, message: "Δεν βρέθηκε id." });
			}

			// --- καθάρισμα τιμών ---
			const posoNum    = parseGreekDecimal(formData.poso, 0);
			const posostoNum = parseGreekDecimal(formData.pososto, 0);

			const klimakiaNum  = Number(formData.arithmos_klimakion ?? 0);
			const apoKlimakio  = Number(formData.ypologismos_apo_klimakio ?? 0);
			const bhmaNum      = Number(formData.bhma_ypologismoy ?? 0);

			// checkbox / radio: έρχεται "on" ή "1"
			const posoPosostoFlag =
			formData.poso_pososto === "on" ||
			formData.poso_pososto === "1" ||
			formData.poso_pososto === 1 ||
			formData.poso_pososto === true;

			const filteredDataStoixeiaSymbaseon = {
				kodikos: String(formData.kodikos ?? "").trim(),
				perigrafh: String(formData.perigrafh ?? "").trim(),
				afora_thn_symbash_kathgoria_eidikothta: String(
					formData.afora_thn_symbash_kathgoria_eidikothta ?? ""
				).trim(),
				poso_pososto: posoPosostoFlag,
				arithmos_klimakion: klimakiaNum,
				ypologismos_apo_klimakio: apoKlimakio,
				bhma_ypologismoy: bhmaNum,
				poso: posoNum,
				pososto: posostoNum,
				typos_ypologismoy: String(formData.typos_ypologismoy ?? "").trim(),
			};

			await StoixeiaSymbaseonModel.findOneAndUpdate(
				{ _id: stoixeiaSymbaseonId },
				{ $set: filteredDataStoixeiaSymbaseon },
				{ new: true }
			);

			return res.json({
				success: true,
				redirectUrl: "/symbaseis/stoixeiaSymbaseon",
			});
		} catch (error) {
			return next(error);
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
    }

    static listStoixeiaSymbaseon = async (req, res) => {
    try {
        // 1) Πάρε έτοιμο 12-ψηφιο κλειδί αν δίνεται, αλλιώς φτιάξ’ το από τα 3 hidden
        const comboFromQuery =
        String(req.query.afora_thn_symbash_kathgoria_eidikothta || req.query.kodikosSymbashs_Kathgorias_Eidikothtas || '')
            .trim();

        const symHidden   = String(req.query.symbash_stathera || '').trim();
        const kathHidden  = String(req.query.kathgoria_symbashs_stathera || '').trim();
        const eidikHidden = String(req.query.eidikothta_symbashs_stathera || '').trim();

        const compositeKey =
        comboFromQuery
        || (symHidden && kathHidden && eidikHidden
            ? `${to4(symHidden)}${to4(kathHidden)}${to4(eidikHidden)}`
            : '');

        const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

        // 2) Αν δεν έχουμε κλειδί, γύρνα άδειο αποτέλεσμα
        if (!compositeKey) {
        return res.json({ items: [], page: 1, pages: 1, total: 0 });
        }

        // 3) Φίλτρο: afora_thn_symbash_kathgoria_eidikothta = "0002xxxx0001"
        const query = { afora_thn_symbash_kathgoria_eidikothta: compositeKey };

        // 4) Ταξινόμηση: με kodikos (zero-padded)
        const sort = { kodikos: 1 };

        // 5) Ανάκτηση + total
        const [docs, total] = await Promise.all([
        StoixeiaSymbaseonModel
            .find(query)
            .select({
            kodikos: 1,
            perigrafh: 1,
            afora_thn_symbash_kathgoria_eidikothta: 1,
            poso_pososto: 1,
            arithmos_klimakion: 1,
            ypologismos_apo_klimakio: 1,
            bhma_ypologismoy: 1,
            poso: 1,
            pososto: 1,
            typos_ypologismoy: 1,
            })
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        StoixeiaSymbaseonModel.countDocuments(query),
        ]);

        // 6) Μορφοποίηση για τον πίνακα
        const items = (docs || []).map(d => ({
        id: String(d._id),
        kodikos: to4(d.kodikos),                       // "0001"
        perigrafh: d.perigrafh || '',
        // Τα παρακάτω είναι διαθέσιμα αν θέλεις να τα εμφανίσεις/χρησιμοποιήσεις σε modal:
        poso_pososto: !!d.poso_pososto,
        arithmos_klimakion: d.arithmos_klimakion ?? null,
        ypologismos_apo_klimakio: d.ypologismos_apo_klimakio ?? null,
        bhma_ypologismoy: d.bhma_ypologismoy ?? null,
        poso: d.poso ?? null,
        pososto: d.pososto ?? null,
        typos_ypologismoy: d.typos_ypologismoy || '',
        }));

        const pages = Math.max(1, Math.ceil(total / limit));
        res.json({ items, page, pages, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
    };

    // ================================== Κλιμάκια Συμβάσεων =======================================

    static mainKlimakiaForm = async (req, res) => {
        const locals = {
        title: "Κλιμάκια Συμβάσεων",
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
            form: "KlimakiaSymbaseon",
        }).exec();

        res.render("symbaseis/klimakia/klimakiaSymbaseon", {
            userPrivileges: userPrivileges ? userPrivileges.privileges : {},
            locals,
            context: "klimakia_symbaseon",
            rec: {},
        });
        } catch (error) {
        console.log(error);
        }
    };

    // ================================== Υπολογισμοί Κλιμακίων ====================================

    static mainYpologismoiForm = async (req, res) => {
        const locals = {
        title: "Υπολογισμοί Κλιμακίων Συμβάσεων",
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
            context: "stoixeia_symbashs",
            rec: {},
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
                praxh_katatheshs: update.praxh_katatheshs,
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
        
        res.json({ success: true, redirectUrl: "/symbaseis/ypologismoiKlimakion/" });
        } catch (error) {
        console.error('Error during bulk update:', error);
        res.status(500).json({ message: 'Σφάλμα κατά την ενημέρωση' });
        }
    };

    static postKlimakiaSymbaseonUpdates = async (req, res) => {
        try {
            const { klimakiaChanges } = req.body;

            if (!klimakiaChanges) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Δεν βρέθηκαν αλλαγές κλιμακίων' 
                });
            }

            const { updated = [], deleted = [] } = klimakiaChanges;

            // // ===== ΣΎΝΔΕΣΗ ΜΕ DATABASE =====
            // const db = mongoose.connection.db;
            // const collection = db.collection('klimakiasymbaseon'); // Το όνομα της collection σας

            const bulkOps = [];

            // ===== 1) ΕΝΗΜΕΡΩΣΗ ΠΟΣΩΝ (Updated) =====
            for (const update of updated) {
                // update = { klimakio: "01", oldPoso: 830, newPoso: 850, ... }
                
                // Φτιάχνουμε το filter με όλες τις πληροφορίες που ήδη έχουμε
                const filter = {
                    // Χρησιμοποιούμε το klimakio και το παλιό ποσό για να βρούμε τη σωστή γραμμή
                    klimakio: update.klimakio,
                    poso: update.oldPoso,
                    // Προσθέτουμε και άλλες πληροφορίες αν χρειάζονται (από τα session data ή globals)
                };

                bulkOps.push({
                    updateOne: {
                        filter: filter,
                        update: { 
                            $set: { 
                                poso: update.newPoso,  // Νέο ποσό
                                // updated_at: new Date(),
                                // updated_by: req.user?.id || 'system' // Ποιος έκανε την αλλαγή
                            } 
                        },
                        upsert: false
                    }
                });
            }

            // ===== 2) ΔΙΑΓΡΑΦΗ (Deleted) =====
            for (const deleteItem of deleted) {
                const filter = {
                    klimakio: deleteItem.klimakio,
                    poso: parseFloat(deleteItem.poso.replace(',', '.')), // Μετατροπή string σε number
                };

                bulkOps.push({
                    deleteOne: {
                        filter: filter
                    }
                });
            }

            // ===== 3) ΕΚΤΕΛΕΣΗ BULK OPERATIONS =====
            if (bulkOps.length > 0) {
                const result = await KlimakiaSymbaseonModel.bulkWrite(bulkOps);

                console.log(`📊 Bulk Write Results:`, {
                    modified: result.modifiedCount,
                    deleted: result.deletedCount,
                    upserted: result.upsertedCount
                });

                return res.json({ 
                    success: true, 
                    message: `✅ Ενημερώθησαν ${result.modifiedCount} γραμμές και διαγράφηκαν ${result.deletedCount}`,
                    redirectUrl: "/symbaseis/klimakia",
                    result: {
                        modifiedCount: result.modifiedCount,
                        deletedCount: result.deletedCount,
                        upsertedCount: result.upsertedCount
                    }
                });
            } else {
                return res.json({ 
                    success: false, 
                    message: 'Δεν υπάρχουν αλλαγές προς αποθήκευση' 
                });
            }

        } catch (error) {
            console.error('❌ Error during klimakia updates:', error);
            res.status(500).json({ 
                success: false,
                message: 'Σφάλμα κατά την ενημέρωση κλιμακίων',
                error: error.message 
            });
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
        // res.json({ success: true, poso: parseFloat(klimakia[0].poso).toFixed(2) });
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
