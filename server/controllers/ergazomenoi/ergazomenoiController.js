const mongoose = require("mongoose");
const { ObjectId } = require('mongodb');
const fs = require("fs-extra");

const Models_A = require("../../models/stathera_arxeia");
const Models_B = require("../../models/privileges");
const Models_D = require("../../models/ergazomenoi");

const   {   KrathseisModel,
            PerifereiesModel,
            GenikesParametroiModel,
            ForologikesKlimakesModel
        } = Models_A;

const   { UserPrivilegesModel } = Models_B;

const   {   ErgazomenoiModel,
            OrariaModel,
            IstorikoProslhpseonAllagonModel,
        } = Models_D;

let nextPageSearchTerm = "";

const fieldsStoixeionSymbashs = ['stoixeio_symbashs', 'poso_symbashs', 'poso_symbashs_basei_oron_ergasias'];
const fieldsKrathseon = ['krathsh', 'ama_krathshs'];
const fieldsKrathseis = ['krathsh'];
// const checkboxFields = new Set(['repo', 'argia']); // Ορίζουμε ποια fields είναι checkboxes
const numberFields = new Set(['poso_symbashs', 'poso_symbashs_basei_oron_ergasias']); // Ορίζουμε ποια fields είναι numbers

const arithmosStoixeionSymbashs = 15;
const arithmosKrathseon = 7;

class ergazomenoiController {

    static mainErgazomenoiForm = async (req, res) => {
        const locals = { title: "Εργαζόμενοι", description: "Web Payroll System" };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const basePer = Number(process.env.EGGRAFES) || 10;
        const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1)); // 1..5
        const perPage = basePer * perx;
        const page = Math.max(Number(req.query.page) || 1, 1);

        if (!ObjectId.isValid(sessionUserId)) throw new Error('invalid sessionUserId');
        const userId   = ObjectId.createFromHexString(sessionUserId);

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({ userId: sessionUserId, form: "Ergazomenoi" }).lean();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        company_kod: companyId,
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await ErgazomenoiModel.aggregate(
                countPipeline
            ).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Aggregation query για την ανάκτηση δεδομένων
            const queryPipeline = [
                { $match: { company_kod: companyId } },
                { $skip: skipRecords },
                { $limit: limitPerPage },
            ];

            const ergazomenoi = await ErgazomenoiModel.aggregate(
                queryPipeline
            ).exec();

            res.render("ergazomenoi/ergazomenoi/ergazomenoi", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: page,
                pages: totalPages,
                ergazomenoi,
                perx,                       // <-- για το UI πολλαπλασιαστή
                basePer,                    // (προαιρετικό, αν το δείχνεις)
                entries: perPage,           // (προαιρετικό: πόσα/σελίδα)
                totalRecs: totalRecords,    // (προαιρετικό: συνολικά)
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Σφάλμα");
        }
    };

    static editErgazomenoiForm = async (req, res) => {
        const locals = {
        title: "Συντήρηση Στοιχείων Εργαζομένων",
        description: "Web Payroll System",
        };

        try {
        const userTeam = req.session.userTeam;
        const companyId = req.session.companyInUse;

        const ergazomenoiId = req.params.id;
        const ergazomenoiData = await ErgazomenoiModel.findById(ergazomenoiId).exec();
        // const ergazomenoiKod = req.params.kod;
        const ergazomenoiKod = ergazomenoiData.kodikos;
        const istorikoData = await IstorikoProslhpseonAllagonModel.find({ team: userTeam, company_kod: companyId, kodikos: ergazomenoiKod })
        const perifereies = await PerifereiesModel.find().sort("perigrafh");
        const genikesParametroi = await GenikesParametroiModel.find().sort({ kodikos: 1 }).lean();
        const orariaData = await OrariaModel.find({ team: userTeam, company_kod: companyId, kodikos: ergazomenoiKod, hmeromhnia: { $gte: new Date(ergazomenoiData.hmeromhnia_allaghs_orarioy_apo), $lte: new Date(ergazomenoiData.hmeromhnia_allaghs_orarioy_eos) } }).sort({ hmeromhnia: 1 }).exec();

        res.render("ergazomenoi/ergazomenoi/edit", {
            locals,
            perifereies,
            genikesParametroi,
            istorikoData,
            orariaData,
            ergazomenoiData,
            mode: "edit", 
            context: "ergazomenoi", 
            rec: {}
        });
        } catch (error) {
        console.log("Σφάλμα :", error);
        }
    };

    static getIstorikoData = async (req, res) => {
        const locals = {
        title: "Συντήρηση Στοιχείων Εργαζομένων",
        description: "Web Payroll System",
        };

        try {
        const userTeam = req.session.userTeam;
        const companyId = req.session.companyInUse;

        const ergazomenoiKod = req.params.kod;
        const istorikoData = await IstorikoProslhpseonAllagonModel.find({ team: userTeam, company_kod: companyId, kodikos: ergazomenoiKod }).sort({aa_eggrafhs: 1});
        
        if (istorikoData) {
            res.json(istorikoData);
        }
        } catch (err) {
        res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
        }
    };

    static updateIstorikoData = async (req, res) => {
        const userTeam = req.session.userTeam;
        const companyId = req.session.companyInUse;
        const ergazomenoiKod = req.params.kod;

        try {
        const updates = req.body.updates; // Παίρνουμε τις ενημερώσεις από το σώμα του αιτήματος

        // Αποθήκευση και επεξεργασία των ενημερώσεων
        for (const update of updates) {
            const { _id, data } = update;
            if (update.deleted) {
            await IstorikoProslhpseonAllagonModel.findByIdAndDelete(_id);
            } else {
            // Ενημέρωση μόνο των συγκεκριμένων πεδίων
            const updateData = {
                hmeromhnia_proslhpshs: data.hmeromhnia_proslhpshs,
                hmeromhnia_allaghs_symbashs: data.hmeromhnia_allaghs_symbashs,
                hmeromhnia_lhxhs_symbashs: data.hmeromhnia_lhxhs_symbashs,
                hmeromhnia_apoxorhshs: data.hmeromhnia_apoxorhshs
            };
            await IstorikoProslhpseonAllagonModel.findByIdAndUpdate(_id, updateData, {new: true});
            }
        }

        // Επαναρίθμηση του aa_eggrafhs
        const allRecords = await IstorikoProslhpseonAllagonModel.find({ team: userTeam, company_kod: companyId, kodikos: ergazomenoiKod }).sort({_id: 1});
        let counter = 1;
        for (const record of allRecords) {
            const aa_eggrafhs = counter.toString().padStart(4, '0');
            await IstorikoProslhpseonAllagonModel.findByIdAndUpdate(record._id, { aa_eggrafhs: aa_eggrafhs });
            counter++;
        }

        res.status(200).json({ message: "Το Ιστορικό ενημερώθηκε επιτυχώς" });
        } catch (error) {
        res.status(500).json({ message: "Σφάλμα κατά την ενημέρωση του Ιστορικού", error: error });
        }
    };

    static searchPostErgazomenoi = async (req, res) => {
        const locals = {
        title: "Αναζήτηση Εργαζομένων",
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
            form: "Ergazomenoi",
        }).exec();

        // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
        const countPipeline = [
            {
            $match: {
                $or: [
                { kodikos: { $regex: new RegExp(sTerm, "i") } },
                { eponymo: { $regex: new RegExp(sTerm, "i") } },
                { onoma: { $regex: new RegExp(sTerm, "i") } },
                { patronymo: { $regex: new RegExp(sTerm, "i") } },
                { afm: { $regex: new RegExp(sTerm, "i") } },
                { amka: { $regex: new RegExp(sTerm, "i") } },
                { adt: { $regex: new RegExp(sTerm, "i") } },
                ]
            },
            },
            {
            $count: "total",
            },
        ];

        const countResults = await ErgazomenoiModel.aggregate(countPipeline).exec();

        let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
        let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
        let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
        let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
        

        // Αναζήτηση και επισήμανση
        const ergazomenoiFilteredRecs = await ErgazomenoiModel.aggregate([
            {
            $match: {
                $or: [
                { kodikos: { $regex: new RegExp(sTerm, "i") } },
                { eponymo: { $regex: new RegExp(sTerm, "i") } },
                { onoma: { $regex: new RegExp(sTerm, "i") } },
                { patronymo: { $regex: new RegExp(sTerm, "i") } },
                { afm: { $regex: new RegExp(sTerm, "i") } },
                { amka: { $regex: new RegExp(sTerm, "i") } },
                { adt: { $regex: new RegExp(sTerm, "i") } },
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
        const highlightedRecords = ergazomenoiFilteredRecs.map((record) => ({
            ...record,
            kodikos: this.highlightText(record.kodikos, sTerm),
            eponymo: this.highlightText(record.eponymo, sTerm),
            onoma: this.highlightText(record.onoma, sTerm),
            patronymo: this.highlightText(record.patronymo, sTerm),
            afm: this.highlightText(record.afm, sTerm),
            amka: this.highlightText(record.amka, sTerm),
            adt: this.highlightText(record.adt, sTerm),
        }));

        res.render("ergazomenoi/ergazomenoi/search", {
            userPrivileges,
            ergazomenoiFilteredRecs: highlightedRecords,
            locals,
            current: page,
            pages: totalPages,
            sTerm: sTerm,
            entries: perPage,
            totalRecs: totalRecords,
        });
        } catch (error) {
        console.log("Σφάλμα :", error);
        }
    };

    static searchGetErgazomenoi = async (req, res) => {
        const locals = {
        title: "Αναζήτηση Εργαζομένων",
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
            form: "Ergazomenoi",
        }).exec();

        // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
        const countPipeline = [
            {
            $match: {
                $or: [
                { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                { eponymo: { $regex: new RegExp(searchTerm, "i") } },
                { onoma: { $regex: new RegExp(searchTerm, "i") } },
                { patronymo: { $regex: new RegExp(searchTerm, "i") } },
                { afm: { $regex: new RegExp(searchTerm, "i") } },
                { amka: { $regex: new RegExp(searchTerm, "i") } },
                { adt: { $regex: new RegExp(searchTerm, "i") } },
                ]
            },
            },
            {
            $count: "total",
            },
        ];

        const countResults = await ErgazomenoiModel.aggregate(countPipeline).exec();

        let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
        let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
        let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
        let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

        // Αναζήτηση και επισήμανση
        const ergazomenoiFilteredRecs = await ErgazomenoiModel.aggregate([
            {
            $match: {
                $or: [
                { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                { eponymo: { $regex: new RegExp(searchTerm, "i") } },
                { onoma: { $regex: new RegExp(searchTerm, "i") } },
                { patronymo: { $regex: new RegExp(searchTerm, "i") } },
                { afm: { $regex: new RegExp(searchTerm, "i") } },
                { amka: { $regex: new RegExp(searchTerm, "i") } },
                { adt: { $regex: new RegExp(searchTerm, "i") } },
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
        const highlightedRecords = ergazomenoiFilteredRecs.map((record) => ({
            ...record,
            kodikos: this.highlightText(record.kodikos, searchTerm),
            eponymo: this.highlightText(record.eponymo, searchTerm),
            onoma: this.highlightText(record.onoma, searchTerm),
            patronymo: this.highlightText(record.patronymo, searchTerm),
            afm: this.highlightText(record.afm, searchTerm),
            amka: this.highlightText(record.amka, searchTerm),
            adt: this.highlightText(record.adt, searchTerm),
        }));
    
        res.render("ergazomenoi/ergazomenoi/search", {
            userPrivileges,
            ergazomenoiFilteredRecs: highlightedRecords,
            locals,
            current: page,
            pages: totalPages,
            sTerm: searchTerm,
            entries: perPage,
            totalRecs: totalRecords,
        });
        } catch (error) {
        console.log("Σφάλμα :", error);
        }
    };

    static addErgazomenoiForm = async (req, res) => {
        const locals = {
        title: "Προσθήκη Νέου Εργαζόμενου",
        description: "Web Payroll System",
        };

        const sessionYearInUse = req.session.yearInUse;

        try {
            const data = await PerifereiesModel.find().sort("kodikos");
            res.render("ergazomenoi/ergazomenoi/add", { 
                locals,
                data, 
                mode: "add", 
                context: "ergazomenoi", 
                sessionYearInUse,
                rec: {}
            });
        } catch (error) {
            console.log("Σφάλμα :", error);
        }
    };
    
    static checkAfmErgazomenoy = async (req, res) => {
        try {
        const { afm } = req.body;
        const doc = await ErgazomenoiModel.findOne({ afm: afm });

        if (doc) {
            res.json(doc);
        }
        } catch (err) {
        res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
        }
    };

    static postErgazomenoiForm = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionUserId = req.session.userId;

        let aa_kod = null, aa_eggr = null, kodikosValue = 0;

        const { formData, filesToUpdate } = req.body;
        
        try {
        const lastRecord = await ErgazomenoiModel.find({ team: sessionUserTeam, company_kod: sessionCompanyInUse })
            .sort({ _id: -1 })
            .limit(1);
        let kodValue = lastRecord[0] && lastRecord[0].kodikos ? parseInt(lastRecord[0].kodikos, 10) : null;
        if (kodValue !== null) {
            kodValue++;
        } else {
            kodValue = 1;
        }
        aa_kod = kodValue;
        kodikosValue = kodValue;
        } catch (error) {
        console.log("Σφάλμα :", error);
        }

        try {
        const lastRecordIstorikoy = await IstorikoProslhpseonAllagonModel.find({ team: sessionUserTeam, company_kod: sessionCompanyInUse, kodikos: kodikosValue })
            .sort({ _id: -1 })
            .limit(1);
        let aaValue = lastRecordIstorikoy[0] && lastRecordIstorikoy[0].aa_eggrafhs ? parseInt(lastRecordIstorikoy[0].aa_eggrafhs, 10) : null;
        if (aaValue !== null) {
            aaValue++;
        } else {
            aaValue = 1;
        }
        aa_eggr = aaValue;
        } catch (error) {
        console.log("Σφάλμα :", error);
        }

        const days = 7;
        const sessions = 3;

        if (!formData.hmeromhnia_proslhpshs && !formData.hmeromhnia_allaghs_symbashs) {
        res.json({ success: false, errorMessage: "Είναι υποχρεωτική η συμπλήρωση των Ημερομηνιών Πρόσληψης και Αλλαγής Σύμβασης", redirectUrl: "/ergazomenoi/ergazomenoi" });
        } else {
        if (filesToUpdate.employees) {
            const newErgazomenos = ErgazomenoiModel({
            team: sessionUserTeam,
            company_kod: sessionCompanyInUse,
            kodikos: aa_kod.toString().padStart(4, '0'),
            energos: formData.energos,
            fylo: formData.fylo,
            eponymo: formData.eponymoHidden,
            onoma: formData.onomaHidden,
            eponymo_patera: formData.eponymo_patera,
            patronymo: formData.patronymo,
            eponymo_mhteras: formData.eponymo_mhteras,
            mhtronymo: formData.mhtronymo,
            afm: formData.afmHidden,
            doy: formData.doy,
            typos_taytothtas: formData.typos_taytothtas,
            adt: formData.adt,
            hmeromhnia_ekdoshs: formData.hmeromhnia_ekdoshs,
            arxh_ekdoshs: formData.arxh_ekdoshs,
            amka: formData.amkaHidden,
            hmeromhnia_gennhshs: formData.hmeromhnia_gennhshs,
            topos_gennhshs: formData.topos_gennhshs,
            arithmos_bibliarioy_anhlikoy: formData.arithmos_bibliarioy_anhlikoy,
            yphkoothta: formData.yphkoothta,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            thlefono: formData.thlefono,
            perifereia: formData.perifereia,
            nomos: formData.nomos,
            dhmos: formData.dhmos,
            polh: formData.polh,
            email: formData.email,
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
            sxesh_ergasias: formData.sxesh_ergasias,
            apasxolhsh_gia_proth_fora: formData.apasxolhsh_gia_proth_fora,
            ora_enarxhs_proths_foras: formData.ora_enarxhs_proths_foras,
            ora_apoxorhshs_proths_foras: formData.ora_apoxorhshs_proths_foras,
            karta_ergasias: formData.karta_ergasias,
            evelikth_proselefsh: formData.evelikth_proselefsh,
            syggeneia: formData.syggeneia,
            syggenikh_sxesh: formData.syggenikh_sxesh,
            proyphresia_se_eth: formData.proyphresia_se_eth,
            proyphresia_se_mhnes: formData.proyphresia_se_mhnes,
            proyphresia_adeias_se_eth: formData.proyphresia_adeias_se_eth,
            synolo_proyphresias_se_eth: formData.synolo_proyphresias_se_eth,
            synolo_proyphresias_se_mhnes: formData.synolo_proyphresias_se_mhnes,
            misthologiko_klimakio: formData.misthologiko_klimakio,
            plhrhs_apasxolhsh: formData.plhrhs_apasxolhsh,
            dieythethsh_xronoy_ergasias: formData.dieythethsh_xronoy_ergasias,
            hmeres_ergasias_ebdomadas: formData.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas: formData.ores_ergasias_ebdomadas,
            dialleima_se_lepta: formData.dialleima_se_lepta,
            dialleima_entos_ektos_orarioy: formData.dialleima_entos_ektos_orarioy,
            symbatikes_ores_ergasias: formData.symbatikes_ores_ergasias,
            typos_orarioy: formData.typos_orarioy,
            synexes_diakekomeno: formData.synexes_diakekomeno,
            pshfiakh_organosh: formData.pshfiakh_organosh,
            apasxolhsh_basei_symbashs: formData.apasxolhsh_basei_symbashs,
            asfalish_me_tekmarta: formData.asfalish_me_tekmarta,
            asfalistikh_klash: formData.asfalistikh_klash,
            epoxikos: formData.epoxikos,
            tmhma: formData.tmhma,
            eidikh_kathgoria_ergazomenoy: formData.eidikh_kathgoria_ergazomenoy,
            oikogeneiakh_katastash: formData.oikogeneiakh_katastash,
            arithmos_teknon: formData.arithmos_teknon,
            ekpaideytiko_epipedo: formData.ekpaideytiko_epipedo,
            eidikothta: formData.eidikothta,
            antikeimeno_ergasion: formData.antikeimeno_ergasion,
            typos_ergazomenon: formData.typos_ergazomenon,
            ypokatasthma: formData.ypokatasthma,
            xarakthrismos_ergazomenon: formData.xarakthrismos_ergazomenon,
            eidikothta_erganh: formData.eidikothta_erganh,
            kad_efka: formData.kad_efka,
            eidikothta_efka: formData.eidikothta_efka,
            kpk_efka: formData.kpk_efka,
            kpk_efka_basei_symbashs: formData.kpk_efka_basei_symbashs,
            epa_efka: formData.epa_efka,
            meiosh_eisforon_ergazomenon: formData.meiosh_eisforon_ergazomenon,
            epidothsh_eisforon_ergodoth: formData.epidothsh_eisforon_ergodoth,
            diathesimothta: formData.diathesimothta,
            enarxh_diathesimothtas: formData.enarxh_diathesimothtas,
            lhxh_diathesimothtas: formData.lhxh_diathesimothtas,
            palios_neos: formData.palios_neos,
            amoibetai_me_sse: formData.amoibetai_me_sse,
            trapeza: formData.trapeza,
            iban: formData.iban,
            arithmos_deltioy_anergias: formData.arithmos_deltioy_anergias,
            systatiko_shmeioma: formData.systatiko_shmeioma,
            programma_dypa: formData.programma_dypa,
            egkritikh_apofash_dypa: formData.egkritikh_apofash_dypa,
            hmeromhnia_enarxhs_programmatos: formData.hmeromhnia_enarxhs_programmatos,
            hmeromhnia_lhxhs_programmatos: formData.hmeromhnia_lhxhs_programmatos,
            antikatastash_ergazomenoy: formData.antikatastash_ergazomenoy,
            afm_antikatastath: formData.afm_antikatastath,
            amka_antikatastath: formData.amka_antikatastath,
            epidoma_anergias: formData.epidoma_anergias,
            dypa: formData.dypa,
            thesh_eythynhs: formData.thesh_eythynhs,
            eidikh_periptosh: formData.eidikh_periptosh,
            kentro_kostoys_1: formData.kentro_kostoys_1,
            pososto_apasxolhshs_kk1: formData.pososto_apasxolhshs_kk1,
            kentro_kostoys_2: formData.kentro_kostoys_2,
            pososto_apasxolhshs_kk2: formData.pososto_apasxolhshs_kk2,
            kentro_kostoys_3: formData.kentro_kostoys_3,
            pososto_apasxolhshs_kk3: formData.pososto_apasxolhshs_kk3,
            kentro_kostoys_4: formData.kentro_kostoys_4,
            pososto_apasxolhshs_kk4: formData.pososto_apasxolhshs_kk4,
            symbash: formData.symbash,
            kathgoria_symbashs: formData.kathgoria_symbashs,
            eidikothta_symbashs: formData.eidikothta_symbashs,
            synolo_symbashs: formData.synolo_symbashs,
            synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
            nomimosMisthos: formData.nomimosMisthos,
            nomimoHmeromisthio: formData.nomimoHmeromisthio,
            nomimoOromisthio: formData.nomimoOromisthio,
            pragmatikosMisthos: formData.pragmatikosMisthos,
            pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
            pragmatikoOromisthio: formData.pragmatikoOromisthio,
            hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: formData.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy,
            adeia_diamonhs_me_amesh_prosbash_gia_ergasia: formData.adeia_diamonhs_me_amesh_prosbash_gia_ergasia,
            eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            adeia_eisodoy_gia_epoxikh_apasxolhsh: formData.adeia_eisodoy_gia_epoxikh_apasxolhsh,
            arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh: formData.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh,
            apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: formData.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
            eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: formData.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
            epaggelmatikh_katartish: formData.epaggelmatikh_katartish,
            antikeimeno_katartishs: formData.antikeimeno_katartishs,
            thematiko_pedio: formData.thematiko_pedio,
            thematikh_enothta: formData.thematikh_enothta,
            foreas_katartishs: formData.foreas_katartishs,
            katartish_apo: formData.katartish_apo,
            katartish_eos: formData.katartish_eos,
            diarkeia_se_ores: formData.diarkeia_se_ores,
            etos_apokthshs: formData.etos_apokthshs,
            allh_glossa_01: formData.allh_glossa_01,
            allh_glossa_02: formData.allh_glossa_02,
            allh_glossa_03: formData.allh_glossa_03,
            allh_glossa_04: formData.allh_glossa_04,
            gnosh_ypologiston: formData.gnosh_ypologiston,
            allo_proson: formData.allo_proson,
            oros_sth_symbash_n_3986_2011: formData.oros_sth_symbash_n_3986_2011,
            kataggelia_katopin_eggrafhs_proeidopoihshs: formData.kataggelia_katopin_eggrafhs_proeidopoihshs,
            hmeromhnia_eggrafhs_proeidopoihshs: formData.hmeromhnia_eggrafhs_proeidopoihshs,
            omadikh_apolysh: formData.omadikh_apolysh,
            arithmos_apofashs_gia_omadikh_apolysh: formData.arithmos_apofashs_gia_omadikh_apolysh,
            hmeromhnia_apofashs_gia_omadikh_apolysh: formData.hmeromhnia_apofashs_gia_omadikh_apolysh,
            epidosh_me_dikastiko_epimelhth: formData.epidosh_me_dikastiko_epimelhth,
            hmeromhnia_epidoshs: formData.hmeromhnia_epidoshs,
            hmeromhnia_katabolhs_ths_apozhmioshs: formData.hmeromhnia_katabolhs_ths_apozhmioshs,
            shmeioseis_apozhmioshs: formData.shmeioseis_apozhmioshs,
            parathrhseis: formData.parathrhseis,
            symfonhtheis_misthos_genikos: formData.symfonhtheis_misthos_genikos,
            symfonhtheis_misthos_apasxolhseis: formData.symfonhtheis_misthos_apasxolhseis,
            paketo_apodoxon: formData.paketo_apodoxon,
            mhniaia_repo: formData.mhniaia_repo,
            ypologismos_foroy: formData.ypologismos_foroy,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            });
            
            fieldsStoixeionSymbashs.forEach(fieldStoixeio => { 
            for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
                const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                if (numberFields.has(fieldStoixeio)) {
                newErgazomenos[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
                } else {
                newErgazomenos[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
                }
            }
            });
            
            fieldsKrathseon.forEach(fieldKrathsh => {
            for (let i = 1; i <= arithmosKrathseon; i++) {
                const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
                newErgazomenos[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            }
            });
            
            try {
            await ErgazomenoiModel.create(newErgazomenos);
            // res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
            } catch (error) {
            console.log("Σφάλμα :", error);
            }
        }

        if (filesToUpdate.schedules) {
            function createOrarioData(i1) {
            return {
                team: sessionUserTeam,
                company_kod: sessionCompanyInUse,
                kodikos: aa_kod.toString().padStart(4, '0'),
                hmeromhnia: formData[`hmeromhnia_${i1}`],
                kathgoria_ergasias: formData[`kathgoria_ergasias_${i1}`],
                apo_ora_01: formData[`apo_ora_01_${i1}`],
                eos_ora_01: formData[`eos_ora_01_${i1}`],
                dialleima_apo_ora_01: formData[`dialleima_apo_ora_01_${i1}`],
                dialleima_eos_ora_01: formData[`dialleima_eos_ora_01_${i1}`],
                apo_ora_02: formData[`apo_ora_02_${i1}`],
                eos_ora_02: formData[`eos_ora_02_${i1}`],
                dialleima_apo_ora_02: formData[`dialleima_apo_ora_02_${i1}`],
                dialleima_eos_ora_02: formData[`dialleima_eos_ora_02_${i1}`],
                apo_ora_03: formData[`apo_ora_03_${i1}`],
                eos_ora_03: formData[`eos_ora_03_${i1}`],
                dialleima_apo_ora_03: formData[`dialleima_apo_ora_03_${i1}`],
                dialleima_eos_ora_03: formData[`dialleima_eos_ora_03_${i1}`],
                repo: formData[`repo_${i1}`] || false,
                adeia: false,
                astheneia: false,
                argia: formData[`argia_${i1}`] || false,
                perigrafh_argias: formData[`perigrafh_argias_${i1}`] || "",
                kathgoria_adeias: "",
                ores_ergasias: parseFloat(formData[`total_hours_day_${i1}`]).toFixed(4),
                ores_nyxtas: parseFloat(formData[`night_hours_day_${i1}`]).toFixed(4),
                ores_argion: parseFloat(formData[`holiday_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias: parseFloat(formData[`overwork_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias_nyxtas: parseFloat(formData[`night_overwork_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias_argion: parseFloat(formData[`holiday_overwork_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias_argion_nyxtas: parseFloat(formData[`night_holiday_overwork_hours_day_${i1}`]).toFixed(4),
                ores_nominhs_yperorias: parseFloat(formData[`overtimeNomimh_hours_day_${i1}`]).toFixed(4),
                ores_nominhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
                ores_nominhs_yperorias_argion: parseFloat(formData[`holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
                ores_nominhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
                ores_paranomhs_yperorias: parseFloat(formData[`overtimeParanomh_hours_day_${i1}`]).toFixed(4),
                ores_paranomhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
                ores_paranomhs_yperorias_argion: parseFloat(formData[`holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
                ores_paranomhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
            };
            }

            let promises = [];
            const fromDate = new Date(formData.hmeromhnia_allaghs_orarioy_apo);
            const toDate = new Date(formData.hmeromhnia_allaghs_orarioy_eos);

            let currentDate = new Date(fromDate); // Ξεκινάμε από την αρχική ημερομηνία
            let i = 1;
            
            while (currentDate <= toDate) {
            let i1 = i < 10 ? '0' + i : i;
            const newOrario = new OrariaModel(createOrarioData(i1));
            promises.push(OrariaModel.create(newOrario));
            
            currentDate.setDate(currentDate.getDate() + 1); // Προσθέτουμε μία ημέρα
            i++;
            }
            
            try {
            await Promise.all(promises);
            } catch (error) {
            console.error('Σφάλμα κατά τη δημιουργία των οραρίων:', error);
            }
        }

        if (filesToUpdate.history) {
            const newIstoriko = IstorikoProslhpseonAllagonModel({
            team: sessionUserTeam,
            company_kod: sessionCompanyInUse,
            kodikos: aa_kod.toString().padStart(4, '0'),
            aa_eggrafhs: aa_eggr.toString().padStart(4, '0'),
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
            afora_proslhpsh: true,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
            misthologiko_klimakio: formData.misthologiko_klimakio,
            symbash: formData.symbash,
            kathgoria_symbashs: formData.kathgoria_symbashs,
            eidikothta_symbashs: formData.eidikothta_symbashs,
            synolo_symbashs: formData.synolo_symbashs,
            synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
            nomimosMisthos: formData.nomimosMisthos,
            nomimoHmeromisthio: formData.nomimoHmeromisthio,
            nomimoOromisthio: formData.nomimoOromisthio,
            pragmatikosMisthos: formData.pragmatikosMisthos,
            pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
            pragmatikoOromisthio: formData.pragmatikoOromisthio,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            });

            fieldsStoixeionSymbashs.forEach(fieldStoixeio => {
            for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
                const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                if (numberFields.has(fieldStoixeio)) {
                newIstoriko[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
                } else {
                newIstoriko[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
                }
            }
            });
            
            fieldsKrathseon.forEach(fieldKrathsh => {
            for (let i = 1; i <= arithmosKrathseon; i++) {
                const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
                newIstoriko[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            }
            });
            
            try {
            await IstorikoProslhpseonAllagonModel.create(newIstoriko);
            res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
            } catch (error) {
            console.log("Σφάλμα :", error);
            }
        } else {
            res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
        }
        }
    };

    static getOrariaAnaErgazomeno = async (req, res) => {
        try {
        const { team, company_kod, kodikos, hmeromhnia_allaghs_orarioy_apo, hmeromhnia_allaghs_orarioy_eos } = req.body;
    
        // Μετατροπή των ημερομηνιών σε αντικείμενα τύπου Date για MongoDB
        const startDate = new Date(hmeromhnia_allaghs_orarioy_apo);
        const endDate = new Date(hmeromhnia_allaghs_orarioy_eos);
    
        // Χρήση aggregate pipeline για να φιλτράρουμε τα ωράρια και να κάνουμε group ή άλλες λειτουργίες
        const results = await OrariaModel.aggregate([
            {
            $match: {
                team: team,
                company_kod: company_kod,
                kodikos: kodikos,
                hmeromhnia: { $gte: startDate, $lte: endDate }
            }
            },
            {
            $sort: { hmeromhnia: 1 } 
            },
        // {
            //   $group: {
            //     _id: '$kodikos',  // Μπορείς να αλλάξεις το grouping field ανάλογα με την ανάγκη σου
            //     totalHours: { $sum: '$hours' }, // Παράδειγμα ομαδοποίησης: Υπολογισμός συνολικών ωρών
            //     details: { $push: '$$ROOT' }  // Προσθήκη όλων των εγγραφών στο πεδίο "details"
            //   }
            // }
        ]);
    
        // Επιστροφή των αποτελεσμάτων στο frontend
        res.status(200).json(results);
        } catch (error) {
        console.error('Error fetching oraria with aggregation:', error);
        res.status(500).json({ message: 'Σφάλμα κατά την λήψη των ωραρίων με aggregate.' });
        }
    };

    static postErgazomenoiUpdate = async (req, res) => {
        const ergazomenoiId = req.params.ergazomenoiId;
        const formData = req.body;

        const omadaErgasias = formData.team;
        const kodikosEtaireias = formData.company_kod;
        const kodikosErgazomenoy = formData.kodikosHidden;
        let aa_eggr = null, recExist = false;

        try {
        const existRecord = await IstorikoProslhpseonAllagonModel.findOne({
            team: omadaErgasias,
            company_kod: kodikosEtaireias,
            kodikos: kodikosErgazomenoy,
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs ? new Date(formData.hmeromhnia_proslhpshs + 'T00:00:00.000+00:00') : null,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs ? new Date(formData.hmeromhnia_allaghs_symbashs + 'T00:00:00.000+00:00') : null,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs ? new Date(formData.hmeromhnia_lhxhs_symbashs + 'T00:00:00.000+00:00') : null,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs ? new Date(formData.hmeromhnia_apoxorhshs + 'T00:00:00.000+00:00') : null
        });
        
        recExist = existRecord ? true : false;

        const lastRecordIstorikoy = await IstorikoProslhpseonAllagonModel.find({ team: omadaErgasias, company_kod: kodikosEtaireias, kodikos: kodikosErgazomenoy })
            .sort({ _id: -1 })
            .limit(1);
        let aaValue = lastRecordIstorikoy[0] && lastRecordIstorikoy[0].aa_eggrafhs ? parseInt(lastRecordIstorikoy[0].aa_eggrafhs, 10) : null;
        if (aaValue !== null) {
            aaValue++;
        } else {
            aaValue = 1;
        }
        aa_eggr = aaValue;
        } catch (error) {
        console.log("Σφάλμα :", error);
        }

        const filteredDataErgazomenoi = {
        energos: formData.energos,
        fylo: formData.fylo,
        eponymo: formData.eponymoHidden,
        onoma: formData.onomaHidden,
        eponymo_patera: formData.eponymo_patera,
        patronymo: formData.patronymo,
        eponymo_mhteras: formData.eponymo_mhteras,
        mhtronymo: formData.mhtronymo,
        afm: formData.afmHidden,
        doy: formData.doy,
        typos_taytothtas: formData.typos_taytothtas,
        adt: formData.adt,
        hmeromhnia_ekdoshs: formData.hmeromhnia_ekdoshs,
        arxh_ekdoshs: formData.arxh_ekdoshs,
        amka: formData.amkaHidden,
        hmeromhnia_gennhshs: formData.hmeromhnia_gennhshs,
        topos_gennhshs: formData.topos_gennhshs,
        arithmos_bibliarioy_anhlikoy: formData.arithmos_bibliarioy_anhlikoy,
        yphkoothta: formData.yphkoothta,
        odos: formData.odos,
        arithmos: formData.arithmos,
        tk: formData.tk,
        thlefono: formData.thlefono,
        perifereia: formData.perifereia,
        nomos: formData.nomos,
        dhmos: formData.dhmos,
        polh: formData.polh,
        email: formData.email,
        hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
        hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
        hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
        hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
        hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
        hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
        kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
        sxesh_ergasias: formData.sxesh_ergasias,
        apasxolhsh_gia_proth_fora: formData.apasxolhsh_gia_proth_fora,
        ora_enarxhs_proths_foras: formData.ora_enarxhs_proths_foras,
        ora_apoxorhshs_proths_foras: formData.ora_apoxorhshs_proths_foras,
        karta_ergasias: formData.karta_ergasias,
        evelikth_proselefsh: formData.evelikth_proselefsh,
        syggeneia: formData.syggeneia,
        syggenikh_sxesh: formData.syggenikh_sxesh,
        proyphresia_se_eth: formData.proyphresia_se_eth,
        proyphresia_se_mhnes: formData.proyphresia_se_mhnes,
        proyphresia_adeias_se_eth: formData.proyphresia_adeias_se_eth,
        synolo_proyphresias_se_eth: formData.synolo_proyphresias_se_eth,
        synolo_proyphresias_se_mhnes: formData.synolo_proyphresias_se_mhnes,
        misthologiko_klimakio: formData.misthologiko_klimakio,
        plhrhs_apasxolhsh: formData.plhrhs_apasxolhsh,
        dieythethsh_xronoy_ergasias: formData.dieythethsh_xronoy_ergasias,
        hmeres_ergasias_ebdomadas: formData.hmeres_ergasias_ebdomadas,
        ores_ergasias_ebdomadas: formData.ores_ergasias_ebdomadas,
        dialleima_se_lepta: formData.dialleima_se_lepta,
        dialleima_entos_ektos_orarioy: formData.dialleima_entos_ektos_orarioy,
        symbatikes_ores_ergasias: formData.symbatikes_ores_ergasias,
        typos_orarioy: formData.typos_orarioy,
        synexes_diakekomeno: formData.synexes_diakekomeno,
        pshfiakh_organosh: formData.pshfiakh_organosh,
        apasxolhsh_basei_symbashs: formData.apasxolhsh_basei_symbashs,
        asfalish_me_tekmarta: formData.asfalish_me_tekmarta,
        asfalistikh_klash: formData.asfalistikh_klash,
        epoxikos: formData.epoxikos,
        tmhma: formData.tmhma,
        eidikh_kathgoria_ergazomenoy: formData.eidikh_kathgoria_ergazomenoy,
        oikogeneiakh_katastash: formData.oikogeneiakh_katastash,
        arithmos_teknon: formData.arithmos_teknon,
        ekpaideytiko_epipedo: formData.ekpaideytiko_epipedo,
        eidikothta: formData.eidikothta,
        antikeimeno_ergasion: formData.antikeimeno_ergasion,
        typos_ergazomenon: formData.typos_ergazomenon,
        ypokatasthma: formData.ypokatasthma,
        xarakthrismos_ergazomenon: formData.xarakthrismos_ergazomenon,
        eidikothta_erganh: formData.eidikothta_erganh,
        kad_efka: formData.kad_efka,
        eidikothta_efka: formData.eidikothta_efka,
        kpk_efka: formData.kpk_efka,
        kpk_efka_basei_symbashs: formData.kpk_efka_basei_symbashs,
        epa_efka: formData.epa_efka,
        meiosh_eisforon_ergazomenon: formData.meiosh_eisforon_ergazomenon,
        epidothsh_eisforon_ergodoth: formData.epidothsh_eisforon_ergodoth,
        diathesimothta: formData.diathesimothta,
        enarxh_diathesimothtas: formData.enarxh_diathesimothtas,
        lhxh_diathesimothtas: formData.lhxh_diathesimothtas,
        palios_neos: formData.palios_neos,
        amoibetai_me_sse: formData.amoibetai_me_sse,
        trapeza: formData.trapeza,
        iban: formData.iban,
        arithmos_deltioy_anergias: formData.arithmos_deltioy_anergias,
        systatiko_shmeioma: formData.systatiko_shmeioma,
        programma_dypa: formData.programma_dypa,
        egkritikh_apofash_dypa: formData.egkritikh_apofash_dypa,
        hmeromhnia_enarxhs_programmatos: formData.hmeromhnia_enarxhs_programmatos,
        hmeromhnia_lhxhs_programmatos: formData.hmeromhnia_lhxhs_programmatos,
        antikatastash_ergazomenoy: formData.antikatastash_ergazomenoy,
        afm_antikatastath: formData.afm_antikatastath,
        amka_antikatastath: formData.amka_antikatastath,
        epidoma_anergias: formData.epidoma_anergias,
        dypa: formData.dypa,
        thesh_eythynhs: formData.thesh_eythynhs,
        eidikh_periptosh: formData.eidikh_periptosh,
        kentro_kostoys_1: formData.kentro_kostoys_1,
        pososto_apasxolhshs_kk1: formData.pososto_apasxolhshs_kk1,
        kentro_kostoys_2: formData.kentro_kostoys_2,
        pososto_apasxolhshs_kk2: formData.pososto_apasxolhshs_kk2,
        kentro_kostoys_3: formData.kentro_kostoys_3,
        pososto_apasxolhshs_kk3: formData.pososto_apasxolhshs_kk3,
        kentro_kostoys_4: formData.kentro_kostoys_4,
        pososto_apasxolhshs_kk4: formData.pososto_apasxolhshs_kk4,
        symbash: formData.symbash,
        kathgoria_symbashs: formData.kathgoria_symbashs,
        eidikothta_symbashs: formData.eidikothta_symbashs,
        synolo_symbashs: formData.synolo_symbashs,
        synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
        nomimosMisthos: formData.nomimosMisthos,
        nomimoHmeromisthio: formData.nomimoHmeromisthio,
        nomimoOromisthio: formData.nomimoOromisthio,
        pragmatikosMisthos: formData.pragmatikosMisthos,
        pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
        pragmatikoOromisthio: formData.pragmatikoOromisthio,
        krathsh_01: formData.krathsh_01,
        ama_krathshs_01: formData.ama_krathshs_01,
        krathsh_02: formData.krathsh_02,
        ama_krathshs_02: formData.ama_krathshs_02,
        krathsh_03: formData.krathsh_03,
        ama_krathshs_03: formData.ama_krathshs_03,
        krathsh_04: formData.krathsh_04,
        ama_krathshs_04: formData.ama_krathshs_04,
        krathsh_05: formData.krathsh_05,
        ama_krathshs_05: formData.ama_krathshs_05,
        krathsh_06: formData.krathsh_06,
        ama_krathshs_06: formData.ama_krathshs_06,
        krathsh_07: formData.krathsh_07,
        ama_krathshs_07: formData.ama_krathshs_07,
        hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: formData.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy,
        adeia_diamonhs_me_amesh_prosbash_gia_ergasia: formData.adeia_diamonhs_me_amesh_prosbash_gia_ergasia,
        eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
        arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
        hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: formData.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
        adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia,
        eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
        arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
        hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: formData.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
        adeia_eisodoy_gia_epoxikh_apasxolhsh: formData.adeia_eisodoy_gia_epoxikh_apasxolhsh,
        arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh: formData.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh,
        apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: formData.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
        eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: formData.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
        epaggelmatikh_katartish: formData.epaggelmatikh_katartish,
        antikeimeno_katartishs: formData.antikeimeno_katartishs,
        thematiko_pedio: formData.thematiko_pedio,
        thematikh_enothta: formData.thematikh_enothta,
        foreas_katartishs: formData.foreas_katartishs,
        katartish_apo: formData.katartish_apo,
        katartish_eos: formData.katartish_eos,
        diarkeia_se_ores: formData.diarkeia_se_ores,
        etos_apokthshs: formData.etos_apokthshs,
        allh_glossa_01: formData.allh_glossa_01,
        allh_glossa_02: formData.allh_glossa_02,
        allh_glossa_03: formData.allh_glossa_03,
        allh_glossa_04: formData.allh_glossa_04,
        gnosh_ypologiston: formData.gnosh_ypologiston,
        allo_proson: formData.allo_proson,
        oros_sth_symbash_n_3986_2011: formData.oros_sth_symbash_n_3986_2011,
        kataggelia_katopin_eggrafhs_proeidopoihshs: formData.kataggelia_katopin_eggrafhs_proeidopoihshs,
        hmeromhnia_eggrafhs_proeidopoihshs: formData.hmeromhnia_eggrafhs_proeidopoihshs,
        omadikh_apolysh: formData.omadikh_apolysh,
        arithmos_apofashs_gia_omadikh_apolysh: formData.arithmos_apofashs_gia_omadikh_apolysh,
        hmeromhnia_apofashs_gia_omadikh_apolysh: formData.hmeromhnia_apofashs_gia_omadikh_apolysh,
        epidosh_me_dikastiko_epimelhth: formData.epidosh_me_dikastiko_epimelhth,
        hmeromhnia_epidoshs: formData.hmeromhnia_epidoshs,
        hmeromhnia_katabolhs_ths_apozhmioshs: formData.hmeromhnia_katabolhs_ths_apozhmioshs,
        shmeioseis_apozhmioshs: formData.shmeioseis_apozhmioshs,
        parathrhseis: formData.parathrhseis,
        symfonhtheis_misthos_genikos: formData.symfonhtheis_misthos_genikos,
        symfonhtheis_misthos_apasxolhseis: formData.symfonhtheis_misthos_apasxolhseis,
        paketo_apodoxon: formData.paketo_apodoxon,
        mhniaia_repo: formData.mhniaia_repo,
        ypologismos_foroy: formData.ypologismos_foroy,
        updatedAt: Date.now(),
        };

        fieldsStoixeionSymbashs.forEach(fieldStoixeio => {
        for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
            const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
            if (numberFields.has(fieldStoixeio)) {
            filteredDataErgazomenoi[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
            } else {
            filteredDataErgazomenoi[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
            }
        }
        });

        fieldsKrathseon.forEach(fieldKrathsh => {
        for (let i = 1; i <= arithmosKrathseon; i++) {
            const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
            filteredDataErgazomenoi[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
        }
        });

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataErgazomenoi στη $set: για ενημέρωση
        try {
        await ErgazomenoiModel.findOneAndUpdate(
            { _id: ergazomenoiId },
            { $set: filteredDataErgazomenoi },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );
        } catch (error) {
        throw error;
        }

        // ============================ ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ =============================
        function createOrarioData(i1) {
        return {
            team: formData.team,
            company_kod: formData.company_kod,
            kodikos: formData.kodikosHidden,
            hmeromhnia: formData[`hmeromhnia_${i1}`],
            kathgoria_ergasias: formData[`kathgoria_ergasias_${i1}`],
            apo_ora_01: formData[`apo_ora_01_${i1}`],
            eos_ora_01: formData[`eos_ora_01_${i1}`],
            dialleima_apo_ora_01: formData[`dialleima_apo_ora_01_${i1}`],
            dialleima_eos_ora_01: formData[`dialleima_eos_ora_01_${i1}`],
            apo_ora_02: formData[`apo_ora_02_${i1}`],
            eos_ora_02: formData[`eos_ora_02_${i1}`],
            dialleima_apo_ora_02: formData[`dialleima_apo_ora_02_${i1}`],
            dialleima_eos_ora_02: formData[`dialleima_eos_ora_02_${i1}`],
            apo_ora_03: formData[`apo_ora_03_${i1}`],
            eos_ora_03: formData[`eos_ora_03_${i1}`],
            dialleima_apo_ora_03: formData[`dialleima_apo_ora_03_${i1}`],
            dialleima_eos_ora_03: formData[`dialleima_eos_ora_03_${i1}`],
            repo: formData[`repo_${i1}`] || false,
            adeia: false,
            astheneia: false,
            argia: formData[`argia_${i1}`] || false,
            perigrafh_argias: formData[`perigrafh_argias_${i1}`] || "",
            kathgoria_adeias: "",
            ores_ergasias: parseFloat(formData[`total_hours_day_${i1}`]).toFixed(4),
            ores_nyxtas: parseFloat(formData[`night_hours_day_${i1}`]).toFixed(4),
            ores_argion: parseFloat(formData[`holiday_hours_day_${i1}`]).toFixed(4),
            ores_yperergasias: parseFloat(formData[`overwork_hours_day_${i1}`]).toFixed(4),
            ores_yperergasias_nyxtas: parseFloat(formData[`night_overwork_hours_day_${i1}`]).toFixed(4),
            ores_yperergasias_argion: parseFloat(formData[`holiday_overwork_hours_day_${i1}`]).toFixed(4),
            ores_yperergasias_argion_nyxtas: parseFloat(formData[`night_holiday_overwork_hours_day_${i1}`]).toFixed(4),
            ores_nominhs_yperorias: parseFloat(formData[`overtimeNomimh_hours_day_${i1}`]).toFixed(4),
            ores_nominhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
            ores_nominhs_yperorias_argion: parseFloat(formData[`holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
            ores_nominhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
            ores_paranomhs_yperorias: parseFloat(formData[`overtimeParanomh_hours_day_${i1}`]).toFixed(4),
            ores_paranomhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
            ores_paranomhs_yperorias_argion: parseFloat(formData[`holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
            ores_paranomhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
        };
        }
        
        let promises = [];
        const fromDate = new Date(formData.hmeromhnia_allaghs_orarioy_apo);
        const toDate = new Date(formData.hmeromhnia_allaghs_orarioy_eos);
        
        let currentDate = new Date(fromDate); // Ξεκινάμε από την αρχική ημερομηνία
        let i = 1;
        
        while (currentDate <= toDate) {
        let i1 = i < 10 ? '0' + i : i;
        const orarioData = createOrarioData(i1);
        
        // Χρησιμοποιούμε findOneAndUpdate για να ενημερώσουμε ή να δημιουργήσουμε εγγραφή
        const updatePromise = OrariaModel.findOneAndUpdate(
            {
            team: orarioData.team,
            company_kod: orarioData.company_kod,
            kodikos: orarioData.kodikos,
            hmeromhnia: orarioData.hmeromhnia,
            },
            {
            $set: { 
                // Ενημερώνουμε μόνο τα πεδία που πρέπει να αλλάζουν πάντα
                kathgoria_ergasias: orarioData.kathgoria_ergasias,
                apo_ora_01: orarioData.apo_ora_01,
                eos_ora_01: orarioData.eos_ora_01,
                dialleima_apo_ora_01: orarioData.dialleima_apo_ora_01,
                dialleima_eos_ora_01: orarioData.dialleima_eos_ora_01,
                apo_ora_02: orarioData.apo_ora_02,
                eos_ora_02: orarioData.eos_ora_02,
                dialleima_apo_ora_02: orarioData.dialleima_apo_ora_02,
                dialleima_eos_ora_02: orarioData.dialleima_eos_ora_02,
                apo_ora_03: orarioData.apo_ora_03,
                eos_ora_03: orarioData.eos_ora_03,
                dialleima_apo_ora_03: orarioData.dialleima_apo_ora_03,
                dialleima_eos_ora_03: orarioData.dialleima_eos_ora_03,
                repo: orarioData.repo,
                adeia: orarioData.adeia,
                astheneia: orarioData.astheneia,
                argia: orarioData.argia,
                perigrafh_argias: orarioData.perigrafh_argias,
                kathgoria_adeias: orarioData.kathgoria_adeias,
                ores_ergasias: orarioData.ores_ergasias,
                ores_nyxtas: orarioData.ores_nyxtas,
                ores_argion: orarioData.ores_argion,
                ores_yperergasias: orarioData.ores_yperergasias,
                ores_yperergasias_nyxtas: orarioData.ores_yperergasias_nyxtas,
                ores_yperergasias_argion: orarioData.ores_yperergasias_argion,
                ores_yperergasias_argion_nyxtas: orarioData.ores_yperergasias_argion_nyxtas,
                ores_nominhs_yperorias: orarioData.ores_nominhs_yperorias,
                ores_nominhs_yperorias_nyxtas: orarioData.ores_nominhs_yperorias_nyxtas,
                ores_nominhs_yperorias_argion: orarioData.ores_nominhs_yperorias_argion,
                ores_nominhs_yperorias_argion_nyxtas: orarioData.ores_nominhs_yperorias_argion_nyxtas,
                ores_paranomhs_yperorias: orarioData.ores_paranomhs_yperorias,
                ores_paranomhs_yperorias_nyxtas: orarioData.ores_paranomhs_yperorias_nyxtas,
                ores_paranomhs_yperorias_argion: orarioData.ores_paranomhs_yperorias_argion,
                ores_paranomhs_yperorias_argion_nyxtas: orarioData.ores_paranomhs_yperorias_argion_nyxtas,
            },
            $setOnInsert: {
                // Τα πεδία που θα ρυθμιστούν μόνο κατά τη δημιουργία νέας εγγραφής
                team: orarioData.team,
                company_kod: orarioData.company_kod,
                kodikos: orarioData.kodikos,
                hmeromhnia: orarioData.hmeromhnia
            }
            },
            { new: true, upsert: true } // Επιστρέφει το ενημερωμένο έγγραφο, και το δημιουργεί αν δεν υπάρχει
        );
        
        promises.push(updatePromise);
        
        currentDate.setDate(currentDate.getDate() + 1); // Προσθέτουμε μία ημέρα
        i++;
        }
        
        try {
        await Promise.all(promises);
        } catch (error) {
        console.error('Σφάλμα κατά την ενημέρωση των οραρίων:', error);
        }

        // ============================ ΕΝΗΜΕΡΩΣΗ ΙΣΤΟΡΙΚΟΥ =============================
        // 
        // Πεδία που ενημερώνονται μόνο κατά την εισαγωγή νέας εγγραφής του ΙΣΤΟΡΙΚΟΥ ΑΡΧΕΙΟΥ
        if (!recExist) {
        const filteredDataIstoriko = {
            team: formData.team,
            company_kod: formData.company_kod,
            kodikos: formData.kodikosHidden,
            aa_eggrafhs: aa_eggr.toString().padStart(4, '0'),
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
            createdAt: Date.now(),
        };
        
        // Πεδία που ενημερώνονται πάντα (και κατά την εισαγωγή νέας εγγραφής και κατά την διόρθωση)
        const updateFieldsIstoriko = {
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
            afora_proslhpsh: formData.hmeromhnia_proslhpshs === formData.hmeromhnia_allaghs_symbashs ? true : false,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
            misthologiko_klimakio: formData.misthologiko_klimakio,
            symbash: formData.symbash,
            kathgoria_symbashs: formData.kathgoria_symbashs,
            eidikothta_symbashs: formData.eidikothta_symbashs,
            synolo_symbashs: formData.synolo_symbashs,
            synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
            nomimosMisthos: formData.nomimosMisthos,
            nomimoHmeromisthio: formData.nomimoHmeromisthio,
            nomimoOromisthio: formData.nomimoOromisthio,
            pragmatikosMisthos: formData.pragmatikosMisthos,
            pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
            pragmatikoOromisthio: formData.pragmatikoOromisthio,
            updatedAt: Date.now(),
        }
        fieldsStoixeionSymbashs.forEach(fieldStoixeio => {
            for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
            const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
            if (numberFields.has(fieldStoixeio)) {
                updateFieldsIstoriko[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
            } else {
                updateFieldsIstoriko[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || null;  // Χειρισμός άλλων τύπων πεδίων
            }
            }
        });

        fieldsKrathseis.forEach(fieldKrathsh => {
            for (let i = 1; i <= arithmosKrathseon; i++) {
            const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
            updateFieldsIstoriko[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            }
        });

        try { 
            await IstorikoProslhpseonAllagonModel.findOneAndUpdate(
            { 
                team: formData.team,
                company_kod: formData.company_kod,
                kodikos: formData.kodikos
            },
            {
                $set: updateFieldsIstoriko,
                $setOnInsert: filteredDataIstoriko // Μόνο όταν δημιουργείται νέα εγγραφή
            },
            { new: true, upsert: true }
            );
            res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
        } catch (error) {
            throw error;
        }
        } else {
        res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
        }
    };

    static deleteErgazomenoi = async (req, res) => {
        try {
            const ergazomenoiData = await ErgazomenoiModel.findOne({ _id: req.params.id });
            const team = ergazomenoiData.team;
            const company = ergazomenoiData.company_kod;
            const kodikos = ergazomenoiData.kodikos;

            await ErgazomenoiModel.deleteOne({ _id: req.params.id });

            await IstorikoProslhpseonAllagonModel.deleteMany({
                team: team,
                company_kod: company,
                kodikos: kodikos,
            });
            
            await OrariaModel.deleteMany({
                team: team,
                company_kod: company,
                kodikos: kodikos,
            });
            
            res.json({ success: true, redirectUrl: "/ergazomenoi/ergazomenoi" });
        } catch (error) {
            throw error;
        }
    };

    static forologikesKlimakes = async (req, res) => {
        try {
            const { xrhsh, kodikos } = req.body;
            
            if (!xrhsh || !kodikos) {
                return res.status(400).json({ success: false, message: 'Missing data' });
            }
            
            // READ from ForologikesKlimakesModel
            const taxScale = await ForologikesKlimakesModel.findOne({ xrhsh, kodikos });
            
            if (taxScale) {
                return res.json({
                    success: true,
                    taxScale: {
                        perigrafh: taxScale.perigrafh 
                    }
                });
            } else {
                return res.json({ success: false, taxScale: null });
            }
            
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };


    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Διαφυγή όλων των ειδικών χαρακτήρων
    }
    
    static highlightText(text, term) {
        if (!text) return ""; // Επιστρέφει ένα κενό string αν το text είναι falsy (π.χ., undefined, null, '')
        const highlightStartTag = "<span class='highlight'>";
        const highlightEndTag = "</span>";

        const escapedTerm = this.escapeRegExp(term);
    
        const regex = new RegExp(`(${escapedTerm})`, "gi");
        // const regex = new RegExp(`(${term})`, "gi");
        const highlightedText = text.replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
        return highlightedText;
    }


}

module.exports = ergazomenoiController;
