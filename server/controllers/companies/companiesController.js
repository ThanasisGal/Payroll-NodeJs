import mongoose from "mongoose";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import Models_A from "../../models/param.js";
import Models_B from "../../models/privileges.js";
import Models_C from "../../models/companies.js";
import UserModel from "../../models/userModel.js";
import Models from "../../models/stathera_arxeia.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ParamModel } = Models_A;
const { UserPrivilegesModel } = Models_B;
const { CompaniesModel } = Models_C;

const {
    PerifereiesModel,
    NomikesMorfesModel,
    PararthmataEfkaModel,
    DoyModel,
    TameiaModel,
    KadModel,
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    LogisthsModel,
    EmmesosErgodothsModel,
    DiadoxosErgodothsModel,
} = Models;

var types,
    redir,
    messages,
    images,
  sTerm = "";

// Έλεγχος του λειτουργικού συστήματος
const isWindows = process.platform === 'win32';

async function renameAndMoveImage(originalPath, company, formDataValues, teams) {
    // Δημιουργία του νέου ονόματος βάσει των μεταβλητών
    const newName = `${company}_${formDataValues.eponymia.trim()}_${formDataValues.fatherName.substring(0, 3)}_${formDataValues.firstName.trim()}_sfragida.png`;

    // Ορισμός της νέας διαδρομής
    const newPath = path.join('C:/Payroll-NodeJs/public/stamps/teams/', teams, newName);

    try {
        // Μεταφορά του αρχείου με το νέο όνομα
        await fs.rename(originalPath, newPath);
        console.log('Το αρχείο μετονομάστηκε και μεταφέρθηκε επιτυχώς.');
    } catch (error) {
        console.error('Σφάλμα κατά τη μετονομασία ή μεταφορά του αρχείου:', error);
    }
}

class companiesController {
    static mainAppForm = async (req, res) => {
        const locals = {
            title: "Payroll",
            description: "Web Payroll System",
        };
        await req.flash("message", "");
        messages = req.flash("message");
        await req.flash("type", process.env._INFO);
        types = req.flash("type");
        await req.flash("img", process.env._IMG_INFO);
        images = req.flash("img");

        res.render("mainapp", {
            locals,
            messages,
            types,
            images,
        });
    };

    static mainCompaniesForm = async (req, res) => {
        const locals = {
            title: "Εταιρείες",
            description: "Web Payroll System",
        };

        const sessionUserTeam = req.session.userTeam;
        const sessionUserId = req.session.userId;
        const perPage = Number(process.env.EGGRAFES);
        let page = req.query.page || 1;

        try {
            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Companies",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        team: sessionUserTeam,
                        users: new mongoose.Types.ObjectId(sessionUserId),
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await CompaniesModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Aggregation query για την ανάκτηση δεδομένων
            const queryPipeline = [
                {
                    $match: {
                        team: sessionUserTeam,
                        users: new mongoose.Types.ObjectId(sessionUserId),
                    },
                },
                {
                    $match: {
                        anenergh: false, // Φιλτράρει τις εγγραφές με το αν είναι ή όχι ανενεργή η εταιρεία
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "users",
                        foreignField: "_id",
                        as: "userData",
                    },
                },
                {
                    $sort: {
                        eponymia: 1,
                        onoma: 1,
                    },
                },
                {
                    $skip: skipRecords,
                },
                {
                    $limit: limitPerPage,
                },
            ];

            const company = await CompaniesModel.aggregate(queryPipeline).exec();

            res.render("companies/genikastoixeia/companies", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                company,
                current: page,
                pages: totalPages,
                messages,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static searchPostCompanies = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Εταιρειών",
            description: "Web Payroll System",
        };

        try {
            let searchTerm = req.body.searchTerm;

            const sessionUserTeam = req.session.userTeam;
            const sessionUserId = req.session.userId;
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, "");
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

            sTerm = searchNoSpecialChar;

            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Companies",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        team: sessionUserTeam,
                        users: new mongoose.Types.ObjectId(sessionUserId),
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await CompaniesModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            const companyFilteredRecs = await CompaniesModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchTerm, "i") } },
                    { eponymia: { $regex: new RegExp(searchTerm, "i") } },
                    { firstname: { $regex: new RegExp(searchTerm, "i") } },
                    { fathername: { $regex: new RegExp(searchTerm, "i") } },
                    { activity: { $regex: new RegExp(searchTerm, "i") } },
                    { afm: { $regex: new RegExp(searchTerm, "i") } },
                ],
            })
            .skip(skipRecords)
            .limit(limitPerPage);

            const highlightedRecords = companyFilteredRecs.map((record) => {
                return {
                    ...record.toObject(),
                    kod: companiesController.highlightText(record.kod, searchTerm),
                    eponymia: companiesController.highlightText(record.eponymia, searchTerm),
                    firstname: companiesController.highlightText(record.firstname, searchTerm),
                    fathername: companiesController.highlightText(record.fathername, searchTerm),
                    activity: companiesController.highlightText(record.activity, searchTerm),
                    afm: companiesController.highlightText(record.afm, searchTerm),
                };
            });

            res.render("companies/genikastoixeia/search", {
                companyFilteredRecs: highlightedRecords,
                locals,
                current: page,
                pages: totalPages,
                sTerm: searchTerm,
                userPrivileges,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static searchGetCompanies = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Εταιρειών",
            description: "Web Payroll System",
        };

        try {
            let searchTerm = req.body.searchTerm;

            const sessionUserTeam = req.session.userTeam;
            const sessionUserId = req.session.userId;
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, "");
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

            sTerm = searchNoSpecialChar;

            // try {
            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Companies",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        team: sessionUserTeam,
                        users: new mongoose.Types.ObjectId(sessionUserId),
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await CompaniesModel.aggregate(countPipeline).exec();
            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            const companyFilteredRecs = await CompaniesModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchTerm, "i") } },
                    { eponymia: { $regex: new RegExp(searchTerm, "i") } },
                    { firstname: { $regex: new RegExp(searchTerm, "i") } },
                    { fathername: { $regex: new RegExp(searchTerm, "i") } },
                    { activity: { $regex: new RegExp(searchTerm, "i") } },
                    { afm: { $regex: new RegExp(searchTerm, "i") } },
                ],
            })
            .skip(skipRecords)
            .limit(limitPerPage);

            const highlightedRecords = companyFilteredRecs.map((record) => {
                return {
                    ...record.toObject(),
                    kod: companiesController.highlightText(record.kod, searchTerm),
                    eponymia: companiesController.highlightText(record.eponymia, searchTerm),
                    firstname: companiesController.highlightText(
                        record.firstname,
                        searchTerm
                    ),
                    fathername: companiesController.highlightText(
                        record.fathername,
                        searchTerm
                    ),
                    activity: companiesController.highlightText(
                        record.activity,
                        searchTerm
                    ),
                    afm: companiesController.highlightText(record.afm, searchTerm),
                };
            });

            res.render("companies/genikastoixeia/search", {
                companyFilteredRecs: highlightedRecords,
                locals,
                current: page,
                pages: totalPages,
                // sTerm: searchTerm,
                userPrivileges,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static addCompanyForm = async (req, res) => {
        const messages = await req.flash("info");
        const locals = {
        title: "Προσθήκη Νέας Εταιρείας",
        description: "Web Payroll System",
        };

        try {
            const data = await PerifereiesModel.find().sort("kodikos");
            res.render("companies/genikastoixeia/add", { locals, messages, data });
        } catch (error) {
            console.log(error);
        }
    };

    static checkAfmEtaireias = async (req, res) => {
        try {
            const { afm } = req.body;
            const doc = await CompaniesModel.findOne({ afm: afm });

            if (doc) {
                res.json(doc);
            }
        } catch (err) {
                res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
        }
    };

    static postCompanyForm = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const sessionUserId = req.session.userId;

        let aa_kod = null;

        const formData = req.body;

        if (!formData.selectedUsers || formData.selectedUsers.length === 0) {
            return res.json({ success: false });
        }

        try {
            const lastRecord = await CompaniesModel.find({ team: sessionUserTeam })
                .sort({ _id: -1 })
                .limit(1);
            let kodValue = lastRecord[0] && lastRecord[0].kod ? parseInt(lastRecord[0].kod, 10) : null;
            if (kodValue !== null) {
                kodValue++;
            } else {
                kodValue = 1;
            }
            aa_kod = kodValue;
        } catch (error) {
            console.log("Σφάλμα :", error);
        }

        const newCompany = CompaniesModel({
            team: sessionUserTeam,
            user_id: sessionUserId,
            kod: aa_kod.toString().padStart(4, "0"),
            eponymia: formData.eponymia,
            firstname: formData.firstName,
            fathername: formData.fatherName,
            activity: formData.activity,
            afm: formData.afm,
            adt: formData.adt,
            titlos: formData.titlos,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            perifereia: formData.perifereies,
            nomos: formData.nomos,
            dhmos: formData.dhmos,
            polh: formData.polh,
            thlefono: formData.thlefono,
            fax: formData.fax,
            email: formData.email,
            anenergh: formData.anenergh,
            nomikh_morfh: formData.nomikhmorfh,
            pararthma_efka: formData.pararthmaefka,
            doy_company: formData.doy,
            tameio1: formData.tameio1,
            ame1: formData.ame1,
            tameio2: formData.tameio2,
            ame2: formData.ame2,
            tameio3: formData.tameio3,
            ame3: formData.ame3,
            tameio4: formData.tameio4,
            ame4: formData.ame4,
            kad1: formData.kad1,
            kad2: formData.kad2,
            kad3: formData.kad3,
            kad4: formData.kad4,
            kad5: formData.kad5,
            kad6: formData.kad6,
            texnikos_asfaleias: formData.kod_ta,
            iatros_ergasias: formData.kod_ia,
            logisths: formData.kod_lo,
            emmesos_ergodoths: formData.kod_em_erg,
            diadoxos_ergodoths: formData.kod_diad_erg,
            oikodomika: formData.oikodomika,
            doropasxa_apd: formData.doropasxa_apd,
            doroxrist_apd: formData.doroxrist_apd,
            ypologismos_epi_pragmatikoy_oromisthioy: formData.ypologismos_epi_pragmatikoy_oromisthioy,
            keimeno_exoflhshs: formData.keimeno_exoflhshs,
            users: formData.selectedUsers,
            sfragida: formData.sfragida,
            imagePath: formData.imagePath,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        if (formData.kod_ta !== null && formData.kod_ta !== "") {
            const newTexnikosAsfaleias = TexnikosAsfaleiasModel({
                team: sessionUserTeam,
                company_kod: aa_kod,
                kodikos: formData.kod_ta,
                eponymo: formData.eponymo_ta,
                onoma: formData.onoma_ta,
                afm: formData.afm_ta,
                dieythynsh: formData.dieythynsh_ta,
                thlefono: formData.thlefono_ta,
                ores: formData.ores_ta,
                ap_katatheshs: formData.ap_katatheshs_ta,
                hmnia_katatheshs: formData.hmnia_katatheshs_ta,
                isxyei_eos: formData.isxyei_eos_ta,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await TexnikosAsfaleiasModel.create(newTexnikosAsfaleias);
        }

        if (formData.kod_ia !== null && formData.kod_ia !== "") {
            const newIatrosErgasias = IatrosErgasiasModel({
                team: sessionUserTeam,
                company_kod: aa_kod,
                kodikos: formData.kod_ia,
                eponymo: formData.eponymo_ia,
                onoma: formData.onoma_ia,
                afm: formData.afm_ia,
                dieythynsh: formData.dieythynsh_ia,
                thlefono: formData.thlefono_ia,
                ores: formData.ores_ia,
                ap_katatheshs: formData.ap_katatheshs_ia,
                hmnia_katatheshs: formData.hmnia_katatheshs_ia,
                isxyei_eos: formData.isxyei_eos_ia,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await IatrosErgasiasModel.create(newIatrosErgasias);
        }

        if (formData.kod_lo !== null && formData.kod_lo !== "") {
            const newLogisths = LogisthsModel({
                team: sessionUserTeam,
                company_kod: aa_kod,
                kodikos: formData.kod_lo,
                eponymo: formData.eponymo_lo,
                onoma: formData.onoma_lo,
                afm: formData.afm_lo,
                dieythynsh: formData.dieythynsh_lo,
                thlefono: formData.thlefono_lo,
                doy: formData.doy_lo,
                arithmos_adeias: formData.arithmos_adeias_lo,
                kathgoria_adeias: formData.kathgoria_adeias_lo,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await LogisthsModel.create(newLogisths);
        }

        if (formData.kod_em_erg !== null && formData.kod_em_erg !== "") {
            const newEmmesosErgodoths = EmmesosErgodothsModel({
                team: sessionUserTeam,
                company_kod: aa_kod,
                kodikos: formData.kod_em_erg,
                eponymo: formData.eponymo_em_erg,
                onoma: formData.onoma_em_erg,
                dieythynsh: formData.dieythynsh_em_erg,
                thlefono: formData.thlefono_em_erg,
                afm: formData.afm_em_erg,
                doy: formData.doy_em_erg,
                titlos: formData.titlos_em_erg,
                nomikhMorfh: formData.nomikh_morfh_em_erg,
                drasthriothta: formData.drasthriothta_em_erg,
                email: formData.email_em_erg,
                daneismosApo: formData.daneismos_epa_apo_em_erg,
                daneismosEos: formData.daneismos_epa_eos_em_erg,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await EmmesosErgodothsModel.create(newEmmesosErgodoths);
        }

        if (formData.kod_diad_erg !== null && formData.kod_diad_erg !== "") {
            const newDiadoxosErgodoths = DiadoxosErgodothsModel({
                team: sessionUserTeam,
                kodikos: formData.kod_diad_erg,
                eponymo: formData.eponymo_diad_erg,
                onoma: formData.onoma_diad_erg,
                dieythynsh: formData.dieythynsh_diad_erg,
                thlefono: formData.thlefono_diad_erg,
                afm: formData.afm_diad_erg,
                doy: formData.doy_diad_erg,
                titlos: formData.titlos_diad_erg,
                nomikhMorfh: formData.nomikh_morfh_diad_erg,
                drasthriothta: formData.drasthriothta_diad_erg,
                email: formData.email_diad_erg,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await DiadoxosErgodothsModel.create(newDiadoxosErgodoths);
        }

        try {
            const savedCompany = await CompaniesModel.create(newCompany);
            const companyId = savedCompany._id;

            const teamsInStampsPath = isWindows
                ? 'C:/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/'
                : '/home/ubuntu/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/';
        
            // Δημιουργία φακέλου stamps/team αν δεν υπάρχει
            try {
                await fs.access(teamsInStampsPath);
            } catch {
                await fs.mkdir(teamsInStampsPath, { recursive: true });
            }
        
            let imagePath = isWindows
                ? 'C:/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/' + companyId.toString() + '_' + formData.eponymia.trim() + '_' + formData.fatherName.substring(0, 3) + '_' + formData.firstName.trim() + '_sfragida.png'
                : '/home/ubuntu/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/' + companyId.toString() + '_' + formData.eponymia.trim() + '_' + formData.fatherName.substring(0, 3) + '_' + formData.firstName.trim() + '_sfragida.png';

            const originalPath = 'C:/stamps/sfragida.png';
            const company = companyId.toString();
            const formDataValues = {
                eponymia: formData.eponymia.trim(),
                fatherName: formData.fatherName.substring(0, 3),
                firstName: formData.firstName.trim()
            };
            const teams = sessionUserTeam;
            
            if (formData.sfragida && formData.sfragida !== "") {
                renameAndMoveImage(originalPath, company, formDataValues, teams);
            } else {
                imagePath = '';
            }
    
            newCompany.imagePath = imagePath; // Αποθηκεύω την τελική διαδρομή της εικόνας στο μοντέλο CompaniesModel
            await newCompany.save(); // Ενημέρωση της εγγραφής με τη νέα διαδρομή εικόνας

            res.json({ success: true, redirectUrl: "/companies/genikastoixeia" });
        } catch (error) {
            console.log(error);
        }
    };

    static choiseCompanies = async (req, res) => {
        const messages = await req.flash("info");
        const locals = {
            title: "Payroll",
            description: "Web Payroll System",
        };

        const sessionUserTeam = req.session.userTeam;
        const sessionUserId = req.session.userId;

        try {
            const companies = await CompaniesModel.findOne({ _id: req.params.id });
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            const newParameters = ParamModel({
                usrId: sessionUserId,
                usrTeam: sessionUserTeam,
                companyId: req.params.id,
                usedPeriod: "",
                usedYear: "",
                appDate: "",
            });

            if (!parameter) {
                await newParameters.save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: req.params.id,
                    usedPeriod: parameter.usedPeriod,
                    usedYear: parameter.usedYear,
                    appDate: parameter.appDate,
                });
            }

            req.session.companyInUse = req.params.id;
            req.session.companyDescription = companies.eponymia + " " + companies.firstname;

            redir = "mainapp";

        } catch (error) {
            await req.flash(
                "message",
                "Αδυναμία Επιλογής Εταιρείας. Επικοινωνείστε με τον Διαχειριστή"
            );
            messages = req.flash("message");
            await req.flash("type", process.env._ERROR);
            types = req.flash("type");
            await req.flash("img", process.env._IMG_ERROR);
            images = req.flash("img");
            redir = "companies/companies/genikastoixeia";
        }
        await res.render(redir, { messages, types, images });
    };

    static editCompanyForm = async (req, res) => {
        const messages = await req.flash("info");
        const locals = {
            title: "Διόρθωση Εταιρείας",
            description: "Web Payroll System",
        };

        try {
            const perifereies = await PerifereiesModel.find().sort("perigrafh");
            const nomikes_morfes = await NomikesMorfesModel.find().sort("perigrafh");
            const pararthmata_efka = await PararthmataEfkaModel.find().sort(
                "perigrafh"
            );
            const doys = await DoyModel.find().sort("perigrafh");
            const tameia = await TameiaModel.find().sort("perigrafh");

            const companyId = req.params.id;
            const companyData = await CompaniesModel.findById(companyId).exec();
            // Εξαγωγή του MIME type από την Base64 encoded εικόνα
            const mimeType = companyData.sfragida
                ? companyData.sfragida.split(";")[0].split(":")[1]
                : "";

            res.render("companies/genikastoixeia/edit", {
                locals,
                messages,
                perifereies,
                nomikes_morfes,
                pararthmata_efka,
                doys,
                tameia,
                company: companyData,
                mimeType,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static getCompanyKads = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyData = await CompaniesModel.findOne(
                { _id: companyId },
                "kad1 kad2 kad3 kad4 kad5 kad6"
            );
            res.json(companyData);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των ΚΑΔ" });
        }
    };

    static getKadForEditForm = async (req, res) => {
        try {
            const prefix = req.query.prefix;
            const results = await KadModel.find({
                kodikos: { $regex: `^${prefix}` },
            });
            res.json(results);
            } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των ΚΑΔ" });
        }
    };

    static getCompanies = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyData = await CompaniesModel.findOne({ _id: companyId });
            res.json(companyData);
        } catch (error) {
            console.error(error);
            res
                .status(500)
                .json({ message: "Σφάλμα κατά την ανάκτηση των λογιστών" });
        }
    };

    static populateCompanyUsers = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyUsers = await CompaniesModel.findOne({
                _id: companyId,
            }).populate("users");
            res.json(companyUsers);
        } catch (error) {
            res.json();
        }
    };

    static getAllUsersByTeam = async (req, res) => {
        const companyTeam = req.params.companyTeam;

        try {
            const user = await UserModel.find({ team: companyTeam });
            res.json(user);
        } catch (error) {
            res.json();
        }
    };

    static postCompanyUpdate = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const companyId = req.params.companyId;

        // Καθορισμός διαδρομής για το αρχείο .png
        const teamsInStampsPath = isWindows
            ? 'C:/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/'
            : '/home/ubuntu/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/';

        // Δημιουργία φακέλου stamps/team αν δεν υπάρχει
        try {
            await fs.access(teamsInStampsPath);
        } catch {
            // Ο κατάλογος δεν υπάρχει, επομένως τον δημιουργούμε
            await fs.mkdir(teamsInStampsPath, { recursive: true });
        }
        
        const formData = req.body;

        let imagePath = isWindows
            ? 'C:/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/' + companyId + '_' + formData.eponymia.trim() + '_' + formData.fatherName.substring(0, 3) + '_' + formData.firstName.trim() + '_sfragida.png'
            : '/home/ubuntu/Payroll-NodeJs/public/stamps/teams/' + sessionUserTeam + '/' + companyId + '_' + formData.eponymia.trim() + '_' + formData.fatherName.substring(0, 3) + '_' + formData.firstName.trim() + '_sfragida.png';

        const originalPath = 'C:/stamps/sfragida.png';
        const company = companyId;
        const formDataValues = {
            eponymia: formData.eponymia.trim(),
            fatherName: formData.fatherName.substring(0, 3),
            firstName: formData.firstName.trim()
        };
        const teams = sessionUserTeam;
        
        if (!formData.sfragida) {
            imagePath = '';
        } else {
            renameAndMoveImage(originalPath, company, formDataValues, teams);
        }

        if (!formData.selectedUsers || formData.selectedUsers.length === 0) {
            return res.json({ success: false, message: `Πρέπει να γίνει ΥΠΟΧΡΕΩΤΙΚΑ Επιλογή Χρηστών (μερικών ή όλων), <strong> στη σελίδα Διάφορα</strong>, στην που θα έχουν πρόσβαση στην εταιρεία` });
        }

        const texnikosAsfaleiasKodikos = formData.kod_ta;
        const iatrosErgasiasKodikos = formData.kod_ia;
        const logisthsKodikos = formData.kod_lo;
        const emmesosErgodothsKodikos = formData.kod_em_erg;
        const diadoxosErgodothsKodikos = formData.kod_diad_erg;

        const filteredDataCompany = {
            eponymia: formData.eponymia,
            firstname: formData.firstName,
            fathername: formData.fatherName,
            activity: formData.activity,
            afm: formData.afm,
            adt: formData.adt,
            titlos: formData.titlos,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            perifereia: formData.perifereies,
            nomos: formData.nomos,
            dhmos: formData.dhmos,
            polh: formData.polh,
            thlefono: formData.thlefono,
            fax: formData.fax,
            email: formData.email,
            anenergh: formData.anenergh,
            nomikh_morfh: formData.nomikhmorfh,
            pararthma_efka: formData.pararthmaefka,
            doy_company: formData.doy,
            tameio1: formData.tameio1,
            ame1: formData.ame1,
            tameio2: formData.tameio2,
            ame2: formData.ame2,
            tameio3: formData.tameio3,
            ame3: formData.ame3,
            tameio4: formData.tameio4,
            ame4: formData.ame4,
            kad1: formData.kad1,
            kad2: formData.kad2,
            kad3: formData.kad3,
            kad4: formData.kad4,
            kad5: formData.kad5,
            kad6: formData.kad6,
            texnikos_asfaleias: formData.kod_ta,
            iatros_ergasias: formData.kod_ia,
            logisths: formData.kod_lo,
            emmesos_ergodoths: formData.kod_em_erg,
            diadoxos_ergodoths: formData.kod_diad_erg,
            oikodomika: formData.oikodomika,
            doropasxa_apd: formData.doropasxa_apd,
            doroxrist_apd: formData.doroxrist_apd,
            ypologismos_epi_pragmatikoy_oromisthioy: formData.ypologismos_epi_pragmatikoy_oromisthioy,
            keimeno_exoflhshs: formData.keimeno_exoflhshs,
            users: formData.selectedUsers,
            sfragida: formData.sfragida,
            imagePath: imagePath,
            updatedAt: Date.now(),
        };

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataCompany στη $set: για ενημέρωση
        await CompaniesModel.findOneAndUpdate(
            { _id: companyId },
            { $set: filteredDataCompany },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );

        if (texnikosAsfaleiasKodikos !== null && texnikosAsfaleiasKodikos !== "") {
            const filteredDataTexnikosAsfaleias = {
                eponymo: formData.eponymo_ta,
                onoma: formData.onoma_ta,
                afm: formData.afm_ta,
                dieythynsh: formData.dieythynsh_ta,
                thlefono: formData.thlefono_ta,
                ores: formData.ores_ta,
                ap_katatheshs: formData.ap_katatheshs_ta,
                hmnia_katatheshs: formData.hmnia_katatheshs_ta,
                isxyei_eos: formData.isxyei_eos_ta,
                updatedAt: Date.now(),
            };
            await TexnikosAsfaleiasModel.findOneAndUpdate(
                { kodikos: texnikosAsfaleiasKodikos },
                {
                    $set: filteredDataTexnikosAsfaleias,
                    $setOnInsert: {
                        // Όταν θέλω να οριστούν μόνο κατά τη δημιουργία εγγραφής
                        team: sessionUserTeam,
                        kodikos: formData.Kod_ta,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

        if (iatrosErgasiasKodikos !== null && iatrosErgasiasKodikos !== "") {
            const filteredDataIatrosErgasias = {
                eponymo: formData.eponymo_ia,
                onoma: formData.onoma_ia,
                afm: formData.afm_ia,
                dieythynsh: formData.dieythynsh_ia,
                thlefono: formData.thlefono_ia,
                ores: formData.ores_ia,
                ap_katatheshs: formData.ap_katatheshs_ia,
                hmnia_katatheshs: formData.hmnia_katatheshs_ia,
                isxyei_eos: formData.isxyei_eos_ia,
                updatedAt: Date.now(),
            };
            await IatrosErgasiasModel.findOneAndUpdate(
                { kodikos: iatrosErgasiasKodikos },
                {
                    $set: filteredDataIatrosErgasias,
                    $setOnInsert: {
                        // Όταν θέλω να οριστούν μόνο κατά τη δημιουργία εγγραφής
                        team: sessionUserTeam,
                        kodikos: formData.Kod_ia,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

        if (logisthsKodikos !== null && logisthsKodikos !== "") {
            const filteredDataLogisths = {
                eponymo: formData.eponymo_lo,
                onoma: formData.onoma_lo,
                afm: formData.afm_lo,
                dieythynsh: formData.dieythynsh_lo,
                thlefono: formData.thlefono_lo,
                doy: formData.doy_lo,
                arithmos_adeias: formData.arithmos_adeias_lo,
                kathgoria_adeias: formData.kathgoria_adeias_lo,
                updatedAt: Date.now(),
            };
            await LogisthsModel.findOneAndUpdate(
                { kodikos: logisthsKodikos },
                {
                    $set: filteredDataLogisths,
                    $setOnInsert: {
                        // Όταν θέλω να οριστούν μόνο κατά τη δημιουργία εγγραφής
                        team: sessionUserTeam,
                        kodikos: formData.Kod_lo,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

        if (emmesosErgodothsKodikos !== null && emmesosErgodothsKodikos !== "") {
            const filteredDataEmmesosErgodoths = {
                eponymo: formData.eponymo_em_erg,
                onoma: formData.onoma_em_erg,
                dieythynsh: formData.dieythynsh_em_erg,
                thlefono: formData.thlefono_em_erg,
                afm: formData.afm_em_erg,
                titlos: formData.titlos_em_erg,
                nomikhMorfh: formData.nomikh_morfh_em_erg,
                drasthriothta: formData.drasthriothta_em_erg,
                email: formData.email_em_erg,
                daneismosApo: formData.daneismos_epa_apo_em_erg,
                daneismosEos: formData.daneismos_epa_eos_em_erg,
                updatedAt: Date.now(),
            };
            await EmmesosErgodothsModel.findOneAndUpdate(
                { kodikos: emmesosErgodothsKodikos },
                {
                    $set: filteredDataEmmesosErgodoths,
                    $setOnInsert: {
                        // Όταν θέλω να οριστούν μόνο κατά τη δημιουργία εγγραφής
                        team: sessionUserTeam,
                        kodikos: formData.Kod_em_erg,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

        if (diadoxosErgodothsKodikos !== null && diadoxosErgodothsKodikos !== "") {
            const filteredDataDiadoxosErgodoths = {
                eponymo: formData.eponymo_diad_erg,
                onoma: formData.onoma_diad_erg,
                dieythynsh: formData.dieythynsh_diad_erg,
                thlefono: formData.thlefono_diad_erg,
                afm: formData.afm_diad_erg,
                titlos: formData.titlos_diad_erg,
                nomikhMorfh: formData.nomikh_morfh_diad_erg,
                drasthriothta: formData.drasthriothta_diad_erg,
                email: formData.email_diad_erg,
                updatedAt: Date.now(),
            };
            await DiadoxosErgodothsModel.findOneAndUpdate(
                { kodikos: diadoxosErgodothsKodikos },
                {
                    $set: filteredDataDiadoxosErgodoths,
                    $setOnInsert: {
                        // Όταν θέλω να οριστούν μόνο κατά τη δημιουργία εγγραφής
                        team: sessionUserTeam,
                        kodikos: formData.Kod_em_erg,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

        try {
            res.json({ success: true, redirectUrl: "/companies/genikastoixeia" });
        } catch (error) {
            throw error;
        }
    };

    static deleteCompany = async (req, res) => {
        try {
            await CompaniesModel.deleteOne({ _id: req.params.id });
            res.json({ success: true, redirectUrl: "/companies/genikastoixeia" });
        } catch (error) {
            throw error;
        }
    };

    static highlightText(text, term) {
        const highlightStartTag = "<span class='highlight'>";
        const highlightEndTag = "</span>";
        const regex = new RegExp(`(${term})`, "gi");
        return text.replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
    }
}

export default companiesController;
