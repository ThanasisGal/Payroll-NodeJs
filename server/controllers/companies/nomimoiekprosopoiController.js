const mongoose = require("mongoose");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");
const Models = require("../../models/stathera_arxeia");

const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, NomimoiEkprosopoiModel } = Models_C;
const { PerifereiesModel } = Models;

let nextPageSearchTerm = "";

function formatNumber(number, totalLength) {
    return number.toString().padStart(totalLength, '0');
}

class nomimoiekprosopoiController {

    static mainNomimoiEkprosopoiForm = async (req, res) => {
        const locals = { title: "Νόμιμοι Εκπρόσωποι", description: "Web Payroll System" };

        const sessionCompanyInUse = req.session.companyInUse;
        const sessionUserId       = req.session.userId;
        const perPage             = Number(process.env.EGGRAFES);
        const page                = Math.max(parseInt(req.query.page || '1', 10), 1);

        try {
            const company = await CompaniesModel.findOne({ _id: sessionCompanyInUse }).lean();
            const companyIdAsString = company._id.toString();

            const userPrivilegesDoc = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "NomimoiEkprosopoi",
            }).lean();
            const userPrivileges = userPrivilegesDoc ? userPrivilegesDoc.privileges : {};

            // Count
            const [{ total } = { total: 0 }] = await NomimoiEkprosopoiModel.aggregate([
                { $match: { companykod_object: companyIdAsString } },
                { $count: "total" },
            ]);

            const totalRecords = total;
            const totalPages   = Math.max(1, Math.ceil(totalRecords / Math.max(perPage, 1)));
            const skipRecords  = Math.max(0, (page - 1) * perPage);
            const limitPerPage = Math.max(1, Math.min(perPage, totalRecords - skipRecords || perPage));

            const queryPipeline = [
                { $match: { companykod_object: companyIdAsString } },
                {
                    $lookup: {
                        from: "idiothtes",
                        localField: "idiothta",
                        foreignField: "kodikos",
                        as: "idiothtaInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$idiothtaInfo",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $addFields: {
                        idiothta_label: {
                            $cond: {
                                if: {
                                    $and: [
                                        { $ne: ["$idiothtaInfo", null] },
                                        { $ne: ["$idiothtaInfo.kodikos", null] }
                                    ]
                                },
                                then: {
                                    $concat: [
                                        { $toString: "$idiothtaInfo.kodikos" },
                                        " - ",
                                        { $ifNull: ["$idiothtaInfo.perigrafh", ""] }
                                    ]
                                },
                                else: ""
                            }
                        }
                    }
                },
                { $sort: { "idiothtaInfo.perigrafh": 1, _id: 1 } },
                { $skip: skipRecords },
                { $limit: limitPerPage },
                // Προβολή μόνο των πεδίων που χρειάζεσαι στο template
                {
                    $project: {
                        team: 1,
                        companykod_object: 1,
                        companykod: 1,
                        kodikos: 1,
                        nomiko_prosopo: 1,
                        nomikh_morfh: 1,
                        eponymia: 1,
                        onoma: 1,
                        eponymo_patera: 1,
                        onoma_patera: 1,
                        onoma_mhteras: 1,
                        eponymo_syzygoy: 1,
                        onoma_syzygoy: 1,
                        hmnia_gennhshs: 1,
                        topos_gennhshs: 1,
                        perifereia: 1,
                        nomos: 1,
                        dhmos: 1,
                        polh: 1,
                        odos: 1,
                        arithmos: 1,
                        tk: 1,
                        thlefono: 1,
                        email: 1,
                        typos_taytothtas: 1,
                        arithmos_taytothtas: 1,
                        hmnia_ekdoshs: 1,
                        arxh_ekdoshs: 1,
                        afm: 1,
                        doy: 1,
                        ame: 1,
                        idiothta: 1,                 // ο κωδικός που κρατάς στο hidden
                        idiothtaInfo: {               // πλήρες αντικείμενο για tooltip/προβολή
                            kodikos: 1,
                            perigrafh: 1,
                        },
                        idiothta_label: 1,            // αν το θες έτοιμο
                        createdAt: 1,
                        updatedAt: 1,
                    },
                },
            ];

            const nomimoiekprosopoi = await NomimoiEkprosopoiModel.aggregate(queryPipeline).exec();

            res.render("companies/nomimoi_ekprosopoi/nomimoi_ekprosopoi", {
                userPrivileges,
                locals,
                current: page,
                pages: totalPages,
                company,
                nomimoiekprosopoi,
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Σφάλμα");
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
            const company = await CompaniesModel.findOne({ _id: sessionCompanyInUse }).lean();

            const data = await PerifereiesModel.find().sort("kodikos").lean();
            res.render("companies/nomimoi_ekprosopoi/add", {
                locals,
                company,
                data,
                mode: 'add',
                context: "legal_representative",
                rec: {},
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
            companykod: formatNumber(parseInt(formData.companyKodikos), 4),
            kodikos: formatNumber(aa_kod, 4),
            nomiko_prosopo: formData.nomiko_prosopo,
            nomikh_morfh: (formData.nomikhmorfh_stathera = formData.nomikhmorfh_stathera === null || formData.nomikhmorfh_stathera === "" ? "" : formData.nomikhmorfh_stathera),
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
            typos_taytothtas: (formData.taytothta_stathera = formData.taytothta_stathera === null || formData.taytothta_stathera === "" ? "" : formData.taytothta_stathera),
            arithmos_taytothtas: formData.arithmos_taytothtas,
            hmnia_ekdoshs: formData.hmnia_ekdoshs,
            arxh_ekdoshs: formData.arxh_ekdoshs,
            afm: formData.afm,
            doy: (formData.doy_stathera = formData.doy_stathera === null || formData.doy_stathera === "" ? "" : formData.doy_stathera),
            ame: formData.ame,
            idiothta: (formData.idiothta_stathera = formData.idiothta_stathera === null || formData.idiothta_stathera === "" ? "" : formData.idiothta_stathera),
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
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

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
            ])
            .skip(skipRecords)
            .limit(limitPerPage);
        
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

    static editNomimoiEkprosopoiForm = async (req, res) => {
        const locals = {
            title: "Συντήρηση Νομ.Εκπροσώπων",
            description: "Web Payroll System",
        };

        try {
            const perifereies = await PerifereiesModel.find().sort("perigrafh").lean();
            const nomimoiekprosopoiId = req.params.id;
            
            const nomimosEkprosopos = await NomimoiEkprosopoiModel.findById(nomimoiekprosopoiId).lean();
            
            const company = await CompaniesModel.findOne({ _id: nomimosEkprosopos.companykod_object }).lean();

            res.render("companies/nomimoi_ekprosopoi/edit", {
                locals,
                perifereies,
                company, 
                nomimosEkprosopos,
                mode   : "edit",
                context: "legal_representative",
                rec    : {}, 
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
            companykod: formatNumber(parseInt(formData.companyKodikos), 4),
            nomiko_prosopo: formData.nomiko_prosopo,
            nomikh_morfh: (formData.nomikhmorfh_stathera = formData.nomikhmorfh_stathera === null || formData.nomikhmorfh_stathera === "" ? "" : formData.nomikhmorfh_stathera),
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
            typos_taytothtas: (formData.taytothta_stathera = formData.taytothta_stathera === null || formData.taytothta_stathera === "" ? "" : formData.taytothta_stathera),
            arithmos_taytothtas: formData.arithmos_taytothtas,
            hmnia_ekdoshs: formData.hmnia_ekdoshs,
            arxh_ekdoshs: formData.arxh_ekdoshs,
            afm: formData.afm,
            doy: (formData.doy_stathera = formData.doy_stathera === null || formData.doy_stathera === "" ? "" : formData.doy_stathera),
            ame: formData.ame,
            idiothta: (formData.idiothta_stathera = formData.idiothta_stathera === null || formData.idiothta_stathera === "" ? "" : formData.idiothta_stathera),
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

module.exports = nomimoiekprosopoiController;
