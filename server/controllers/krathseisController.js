import mongoose from "mongoose";
import Models_B from "../models/privileges.js";
import Models from "../models/stathera_arxeia.js";

const { UserPrivilegesModel } = Models_B;

const { KrathseisModel,
        PosostaKrathseonModel,
        TameiaModel,
      } = Models;

let nextPageSearchTerm = "";

class krathseisController {

    static mainKrathseisForm = async (req, res) => {
        const locals = {
            title: "Κρατήσεις",
            description: "Web Payroll System",
        };

        const sessionUserId = req.session.userId;
        const perPage = Number(process.env.EGGRAFES);
        let page = req.query.page || 1;

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Krathseis",
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
                    $sort: { kodikos: 1 },
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

            res.render("krathseis/krathseis", {
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

    static getPosostaKrathseon = async (req, res) => {
        try {
            const krathshId = req.params.krathshId;
            const posostaKrathseon = await PosostaKrathseonModel.find({ krathshId: krathshId })
                .sort({ isxyei_apo: -1 })
                .populate('krathshId');
            res.json(posostaKrathseon);
        } catch (error) {
            res.status(500).send(error.message);
        }
    };
  
    static searchPostKrathseis = async (req, res) => {
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
                form: "Krathseis",
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

            res.render("krathseis/search", {
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

    static searchGetKrathseis = async (req, res) => {
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
                form: "Krathseis",
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
        
            res.render("krathseis/search", {
                krathseisFilteredRecs: highlightedRecords,
                userPrivileges,
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

    static addKrathseisForm = async (req, res) => {
        const locals = {
        title: "Προσθήκη Νέας Κράτησης",
        description: "Web Payroll System",
        };

        try {
            res.render("krathseis/genika/add", {
                locals,
                // data,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static checkKrathshIfExists = async (req, res) => {
        const { kodikos } = req.body;
        try {
            const exists = await KrathseisModel.findOne({ kodikos: kodikos });
            if(exists) {
                return res.json({ exists: true });
            } else {
                return res.json({ exists: false });
            }
        } catch(error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    };

    static postKrathseisForm = async (req, res) => {
        const formData = req.body;

        const newKrathsh = KrathseisModel({
            kodikos: formData.kodikos,
            perigrafh: formData.perigrafh,
            kodikos_tameioy: formData.kodikos_tameioy,
            kyrio_epikoyriko: formData.kyrio_epikoyriko,
            apla_barea: formData.apla_barea,
            typos_apodoxon_001: formData.typos_apodoxon_001,
            typos_apodoxon_003: formData.typos_apodoxon_003,
            typos_apodoxon_004: formData.typos_apodoxon_004,
            typos_apodoxon_005: formData.typos_apodoxon_005,
            typos_apodoxon_006: formData.typos_apodoxon_006,
            typos_apodoxon_007: formData.typos_apodoxon_007,
            typos_apodoxon_008: formData.typos_apodoxon_008,
            typos_apodoxon_009: formData.typos_apodoxon_009,
            typos_apodoxon_010: formData.typos_apodoxon_010,
            typos_apodoxon_011: formData.typos_apodoxon_011,
            typos_apodoxon_012: formData.typos_apodoxon_012,
            typos_apodoxon_013: formData.typos_apodoxon_013,
            typos_apodoxon_014: formData.typos_apodoxon_014,
            typos_apodoxon_015: formData.typos_apodoxon_015,
            typos_apodoxon_016: formData.typos_apodoxon_016,
            typos_apodoxon_017: formData.typos_apodoxon_017,
            typos_apodoxon_018: formData.typos_apodoxon_018,
            typos_apodoxon_019: formData.typos_apodoxon_019,
            typos_apodoxon_021: formData.typos_apodoxon_021,
            typos_apodoxon_022: formData.typos_apodoxon_022,
            typos_apodoxon_023: formData.typos_apodoxon_023,
            typos_apodoxon_024: formData.typos_apodoxon_024,
            typos_apodoxon_025: formData.typos_apodoxon_025,
            typos_apodoxon_026: formData.typos_apodoxon_026,
            typos_apodoxon_027: formData.typos_apodoxon_027,
            typos_apodoxon_028: formData.typos_apodoxon_028,
            typos_apodoxon_029: formData.typos_apodoxon_029,
            typos_apodoxon_030: formData.typos_apodoxon_030,
            typos_apodoxon_031: formData.typos_apodoxon_031,
            typos_apodoxon_032: formData.typos_apodoxon_032,
            typos_apodoxon_033: formData.typos_apodoxon_033,
            typos_apodoxon_034: formData.typos_apodoxon_034,
            typos_apodoxon_035: formData.typos_apodoxon_035,
            typos_apodoxon_068: formData.typos_apodoxon_068,
            typos_apodoxon_069: formData.typos_apodoxon_069,
            typos_apodoxon_070: formData.typos_apodoxon_070,
            typos_apodoxon_071: formData.typos_apodoxon_071,
            typos_apodoxon_114: formData.typos_apodoxon_114,
            typos_apodoxon_115: formData.typos_apodoxon_115,
            typos_apodoxon_601: formData.typos_apodoxon_601,
            typos_apodoxon_603: formData.typos_apodoxon_603,
            typos_apodoxon_604: formData.typos_apodoxon_604,
            typos_apodoxon_605: formData.typos_apodoxon_605,
            typos_apodoxon_608: formData.typos_apodoxon_608,
            typos_apodoxon_609: formData.typos_apodoxon_609,
            typos_apodoxon_610: formData.typos_apodoxon_610,
            typos_apodoxon_611: formData.typos_apodoxon_611,
            typos_apodoxon_901: formData.typos_apodoxon_901,
            typos_apodoxon_902: formData.typos_apodoxon_902,
            typos_apodoxon_903: formData.typos_apodoxon_903,
            typos_apodoxon_904: formData.typos_apodoxon_904,
            typos_apodoxon_905: formData.typos_apodoxon_905,
            typos_apodoxon_906: formData.typos_apodoxon_906,
            typos_apodoxon_907: formData.typos_apodoxon_907,
            typos_apodoxon_908: formData.typos_apodoxon_908,
            typos_apodoxon_909: formData.typos_apodoxon_909,
            typos_apodoxon_910: formData.typos_apodoxon_910,
            typos_apodoxon_911: formData.typos_apodoxon_911,
            typos_apodoxon_912: formData.typos_apodoxon_912,
            typos_apodoxon_913: formData.typos_apodoxon_913,
            typos_apodoxon_914: formData.typos_apodoxon_914,
            ypologizetai_sto_foro: formData.ypologizetai_sto_foro,
            apaiteitai_hmnia_apo: formData.apaiteitai_hmnia_apo,
            apaiteitai_panta_proslhpsh: formData.apaiteitai_panta_proslhpsh,
            apaiteitai_hmnia_eos: formData.apaiteitai_hmnia_eos,
            apaiteitai_panta_apoxorhsh: formData.apaiteitai_panta_apoxorhsh,
            apaiteitai_kata_thn_adeia_apo: formData.apaiteitai_kata_thn_adeia_apo,
            apaiteitai_kata_thn_adeia_eos: formData.apaiteitai_kata_thn_adeia_eos,
            apaiteitai_hmeres_asfalishs: formData.apaiteitai_hmeres_asfalishs,
            apaiteitai_apodoxes_asfalishs: formData.apaiteitai_apodoxes_asfalishs,
            ypologismos_epi_plasmatikhs: formData.ypologismos_epi_plasmatikhs,
        });

        try {
            await KrathseisModel.create(newKrathsh);
            res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
        } catch (error) {
            console.log(error);
        }
    };

    static editKrathseisForm = async (req, res) => {
        const locals = {
        title: "Συντήρηση Κρατήσεων",
        description: "Web Payroll System",
        };

        try {
            const tameia = await TameiaModel.find().sort({ kodikos: 1 });
            const krathseisId = req.params.id;
            const krathseis = await KrathseisModel.findById(krathseisId).lean();
            res.render("krathseis/genika/edit", {
                locals,
                tameia,
                krathseis,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static postKrathseisUpdate = async (req, res) => {
        const krathseisId = req.params.krathseisId;
        const formData = req.body;

        const filteredDataKrathseis = {
            perigrafh: formData.perigrafh,
            kodikos_tameioy: formData.kodikos_tameioy,
            kyrio_epikoyriko: formData.kyrio_epikoyriko,
            apla_barea: formData.apla_barea,
            typos_apodoxon_001: formData.typos_apodoxon_001,
            typos_apodoxon_003: formData.typos_apodoxon_003,
            typos_apodoxon_004: formData.typos_apodoxon_004,
            typos_apodoxon_005: formData.typos_apodoxon_005,
            typos_apodoxon_006: formData.typos_apodoxon_006,
            typos_apodoxon_007: formData.typos_apodoxon_007,
            typos_apodoxon_008: formData.typos_apodoxon_008,
            typos_apodoxon_009: formData.typos_apodoxon_009,
            typos_apodoxon_010: formData.typos_apodoxon_010,
            typos_apodoxon_011: formData.typos_apodoxon_011,
            typos_apodoxon_012: formData.typos_apodoxon_012,
            typos_apodoxon_013: formData.typos_apodoxon_013,
            typos_apodoxon_014: formData.typos_apodoxon_014,
            typos_apodoxon_015: formData.typos_apodoxon_015,
            typos_apodoxon_016: formData.typos_apodoxon_016,
            typos_apodoxon_017: formData.typos_apodoxon_017,
            typos_apodoxon_018: formData.typos_apodoxon_018,
            typos_apodoxon_019: formData.typos_apodoxon_019,
            typos_apodoxon_021: formData.typos_apodoxon_021,
            typos_apodoxon_022: formData.typos_apodoxon_022,
            typos_apodoxon_023: formData.typos_apodoxon_023,
            typos_apodoxon_024: formData.typos_apodoxon_024,
            typos_apodoxon_025: formData.typos_apodoxon_025,
            typos_apodoxon_026: formData.typos_apodoxon_026,
            typos_apodoxon_027: formData.typos_apodoxon_027,
            typos_apodoxon_028: formData.typos_apodoxon_028,
            typos_apodoxon_029: formData.typos_apodoxon_029,
            typos_apodoxon_030: formData.typos_apodoxon_030,
            typos_apodoxon_031: formData.typos_apodoxon_031,
            typos_apodoxon_032: formData.typos_apodoxon_032,
            typos_apodoxon_033: formData.typos_apodoxon_033,
            typos_apodoxon_034: formData.typos_apodoxon_034,
            typos_apodoxon_035: formData.typos_apodoxon_035,
            typos_apodoxon_068: formData.typos_apodoxon_068,
            typos_apodoxon_069: formData.typos_apodoxon_069,
            typos_apodoxon_070: formData.typos_apodoxon_070,
            typos_apodoxon_071: formData.typos_apodoxon_071,
            typos_apodoxon_114: formData.typos_apodoxon_114,
            typos_apodoxon_115: formData.typos_apodoxon_115,
            typos_apodoxon_601: formData.typos_apodoxon_601,
            typos_apodoxon_603: formData.typos_apodoxon_603,
            typos_apodoxon_604: formData.typos_apodoxon_604,
            typos_apodoxon_605: formData.typos_apodoxon_605,
            typos_apodoxon_608: formData.typos_apodoxon_608,
            typos_apodoxon_609: formData.typos_apodoxon_609,
            typos_apodoxon_610: formData.typos_apodoxon_610,
            typos_apodoxon_611: formData.typos_apodoxon_611,
            typos_apodoxon_901: formData.typos_apodoxon_901,
            typos_apodoxon_902: formData.typos_apodoxon_902,
            typos_apodoxon_903: formData.typos_apodoxon_903,
            typos_apodoxon_904: formData.typos_apodoxon_904,
            typos_apodoxon_905: formData.typos_apodoxon_905,
            typos_apodoxon_906: formData.typos_apodoxon_906,
            typos_apodoxon_907: formData.typos_apodoxon_907,
            typos_apodoxon_908: formData.typos_apodoxon_908,
            typos_apodoxon_909: formData.typos_apodoxon_909,
            typos_apodoxon_910: formData.typos_apodoxon_910,
            typos_apodoxon_911: formData.typos_apodoxon_911,
            typos_apodoxon_912: formData.typos_apodoxon_912,
            typos_apodoxon_913: formData.typos_apodoxon_913,
            typos_apodoxon_914: formData.typos_apodoxon_914,
            ypologizetai_sto_foro: formData.ypologizetai_sto_foro,
            apaiteitai_hmnia_apo: formData.apaiteitai_hmnia_apo,
            apaiteitai_panta_proslhpsh: formData.apaiteitai_panta_proslhpsh,
            apaiteitai_hmnia_eos: formData.apaiteitai_hmnia_eos,
            apaiteitai_panta_apoxorhsh: formData.apaiteitai_panta_apoxorhsh,
            apaiteitai_kata_thn_adeia_apo: formData.apaiteitai_kata_thn_adeia_apo,
            apaiteitai_kata_thn_adeia_eos: formData.apaiteitai_kata_thn_adeia_eos,
            apaiteitai_hmeres_asfalishs: formData.apaiteitai_hmeres_asfalishs,
            apaiteitai_apodoxes_asfalishs: formData.apaiteitai_apodoxes_asfalishs,
            ypologismos_epi_plasmatikhs: formData.ypologismos_epi_plasmatikhs,
        };

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataKrathseis στη $set: για ενημέρωση
        await KrathseisModel.findOneAndUpdate(
            { _id: krathseisId },
            { $set: filteredDataKrathseis },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );

        try {
            res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
        } catch (error) {
            throw error;
        }
    };

    static editPosostaKrathseonForm = async (req, res) => {
        // Συνάρτηση για μετατροπή ημερομηνίας από DD/MM/YYYY σε YYYY-MM-DD
        function convertDateDDMMYYYYtoYYYYMMDD(dateString) {
            const parts = dateString.split('/'); // Διαχωρίζει την ημερομηνία σε ημέρα, μήνα, έτος
            return `${parts[2]}-${parts[1]}-${parts[0]}`; // Ανασυνθέτει την ημερομηνία σε μορφή YYYY-MM-DD
        }

        const locals = {
            title: "Συντήρηση Ποσοστών Κρατήσεων",
            description: "Web Payroll System",
        };

        try {
            // const krathseis = await KrathseisModel.find({}, "_id kodikos perigrafh ypologismos_epi_plasmatikhs").sort("kodikos");
            const posostaKrathseonId = req.params.id;
            
            const posostaKrathseon = await PosostaKrathseonModel.findById(posostaKrathseonId);
            
            res.render("krathseis/pososta/edit", {
                locals,
                convertDate: convertDateDDMMYYYYtoYYYYMMDD,
                posostaKrathseon,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static postPosostaKrathseonUpdate = async (req, res) => {
        const posostaKrathseonId = req.params.posostaKrathseonId;
        const formData = req.body;

        const filteredDataPosostaKrathseon = {
            krathshId: formData.krathshId,
            kodikos: formData.kodikos,
            aa_eggrafhs: formData.aa_eggrafhs,
            isxyei_apo: formData.isxyei_apo,
            isxyei_eos: formData.isxyei_eos,
            pososto_ergazomenoy: formData.pososto_ergazomenoy,
            pososto_ergodoth: formData.pososto_ergodoth,
            synolo_pososton: formData.synolo_pososton,
            poso_ergazomenoy: formData.poso_ergazomenoy,
            poso_ergodoth: formData.poso_ergodoth,
            synolo_poson: formData.synolo_poson,
            poso_plasmatikhs_axias: formData.poso_plasmatikhs_axias,
            anotato_orio_palion: formData.anotato_orio_palion,
            anotato_orio_neon: formData.anotato_orio_neon,
        };

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataKrathseis στη $set: για ενημέρωση
        await PosostaKrathseonModel.findOneAndUpdate(
            { _id: posostaKrathseonId },
            { $set: filteredDataPosostaKrathseon },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );

        try {
            res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
        } catch (error) {
            throw error;
        }
    };

    static deleteKrathseis = async (req, res) => {
        try {
            await KrathseisModel.deleteOne({ _id: req.params.id });
                res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
        } catch (error) {
            throw error;
        }
    };

    static getKrathseis = async (req, res) => {
        let plasmatikhAxia = 0;
        const locals = {
            title: "Προσθήκη Νέου Ποσοστού Κράτησης",
            description: "Web Payroll System",
        };

        try {
            const doc = await KrathseisModel.find({}, "_id kodikos perigrafh ypologismos_epi_plasmatikhs").sort("kodikos");
            res.json(doc);
        } catch (error) {
            console.log(error);
        }
    };

    static addPosostaKrathseonForm = async (req, res) => {
        const locals = {
            title: "Προσθήκη Νέων Ποσοστών Κρατήσεων",
            description: "Web Payroll System",
        };

        try {
            let totalRecords = 0;
            const countResults = await PosostaKrathseonModel.find({}, "aa_eggrafhs").sort({ aa_eggrafhs: -1 }).limit(1);
            let x = JSON.stringify(countResults).split(",")[1];
            totalRecords = parseInt(x.split(':"')[1]) + 1;

            // Περάστε τα locals στο EJS template ως μέρος του αντικειμένου
            res.render("krathseis/pososta/add", {
                ...locals,
                // convertDate: convertDateDDMMYYYYtoYYYYMMDD,
                totalRecs: totalRecords,
            });
        } catch (error) {
            console.log(error);
        }
    };
    
    static postPosostaKrathseonForm = async (req, res) => {
        const sessionYearInUse = req.session.yearInUse;
        const formData = req.body;
        const aa_eggrafhs_str = (formData.aa_eggrafhs).toString().padStart(4, '0');
        const posoPlasmatikisAxias = !isNaN(parseFloat(formData.poso_plasmatikhs_axias)) ? parseFloat(formData.poso_plasmatikhs_axias).toFixed(2) : '0.00';
    
        const newPosostaKrathseon = PosostaKrathseonModel({
            krathshId: formData.krathshId,
            kodikos: formData.kodikos,
            aa_eggrafhs: aa_eggrafhs_str,
            isxyei_apo: formData.isxyei_apo || `${sessionYearInUse}-01-01`,
            isxyei_eos: formData.isxyei_eos || "2100-12-31",
            pososto_ergazomenoy: parseFloat(formData.pososto_ergazomenoy).toFixed(4),
            pososto_ergodoth: parseFloat(formData.pososto_ergodoth).toFixed(4),
            synolo_pososton: parseFloat(formData.synolo_pososton).toFixed(4),
            poso_ergazomenoy: parseFloat(formData.poso_ergazomenoy).toFixed(2),
            poso_ergodoth: parseFloat(formData.poso_ergodoth).toFixed(2),
            synolo_poson: parseFloat(formData.synolo_poson).toFixed(2),
            poso_plasmatikhs_axias: posoPlasmatikisAxias,
            anotato_orio_palion: parseFloat(formData.anotato_orio_palion).toFixed(2),
            anotato_orio_neon: parseFloat(formData.anotato_orio_neon).toFixed(2),
        });

        try {
            await PosostaKrathseonModel.create(newPosostaKrathseon);
            res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
        } catch (error) {
            console.log(error);
        }
    };

    static deletePosostaKrathseon = async (req, res) => {
        try {
            await PosostaKrathseonModel.deleteOne({ _id: req.params.id });
            res.json({ success: true, redirectUrl: "/krathseis/krathseis" });
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

    static posostaKrathseonKrathshId = async (req, res) => {
        const bulkUpdateOps = [];
        try {
            const krathseis = await KrathseisModel.find();

            krathseis.forEach(krathsh => {
                bulkUpdateOps.push({
                    updateMany: {
                        filter: { kodikos: krathsh.kodikos },   // Φιλτράρει τις εγγραφές που έχουν το ίδιο "kodikos"
                        update: { krathshId: krathsh._id }      // Ενημερώνει το πεδίο "krathshId" με το "_id" της κράτησης
                    }
                })
            });

            if (bulkUpdateOps.length) {
                await PosostaKrathseonModel.bulkWrite(bulkUpdateOps);
                console.log('Bulk update completed.');
                res.redirect("/krathseis/krathseis"); 
            }
        } catch (err) {
            console.error('Error during bulk update:', err);
            res.status(500).send("An error occurred during the bulk update.");
        }
    }
};
 
export default krathseisController;
