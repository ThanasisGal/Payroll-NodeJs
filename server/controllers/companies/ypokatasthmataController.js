const mongoose = require("mongoose");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");
const Models = require("../../models/stathera_arxeia");

const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, YpokatasthmataModel } = Models_C;
const { PerifereiesModel } = Models;

function formatNumber(number, totalLength) {
    return number.toString().padStart(totalLength, '0');
}

let nextPageSearchTerm = "";

class ypokatasthmataController {
    static mainYpokatasthmataForm = async (req, res) => {
        const locals = {
            title: "Υποκαταστήματα",
            description: "Web Payroll Solutions",
        };

        const sessionCompanyInUse = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const basePer = Number(process.env.EGGRAFES) || 10;
        const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1)); // 1..5
        const perPage = basePer * perx;
        const page = Math.max(Number(req.query.page) || 1, 1);

        try {
            // Άντληση στοιχείων εταιρείας
            const company = await CompaniesModel.findOne({
                _id: sessionCompanyInUse,
            });

            const companyIdAsString = company._id.toString(); // Μετατρέπω το company.id από object σε string

            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Ypokatasthmata",
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

            const countResults = await YpokatasthmataModel.aggregate( countPipeline ).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(
                perPage,
                totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords
            ); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

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
                        from: "poleis", // Ορίζω το όνομα της συλλογής Poleis στη βάση δεδομένων MongoDB
                        localField: "polh", // Το πεδίο στα ypokatasthmata που αντιστοιχεί στο kodikos του poleis
                        foreignField: "kodikos", // Το πεδίο στην συλλογή Poleis που αντιστοιχεί στο κλειδί polh του ypokatasthmata
                        as: "polhInfo", // Το όνομα του πεδίου στο οποίο θα αποθηκευτούν τα αποτελέσματα της ενώσης
                    },
                },
                {
                    $unwind: "$polhInfo", // Θέλω κάθε υποκατάστημα να έχει άμεσα τα στοιχεία της πόλης του
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

            const ypokatasthmata = await YpokatasthmataModel.aggregate( queryPipeline ).exec();

            res.render("companies/ypokatasthmata/ypokatasthmata", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: page,
                pages: totalPages,
                company,
                ypokatasthmata,
                perx,                       // <-- για το UI πολλαπλασιαστή
                basePer,                    // (προαιρετικό, αν το δείχνεις)
                entries: perPage,           // (προαιρετικό: πόσα/σελίδα)
                totalRecs: totalRecords,    // (προαιρετικό: συνολικά)
            });
        } catch (error) {
            console.log(error);
        }
    };

    static addYpokatasthmataForm = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const locals = {
            title: "Προσθήκη Νέου Υποκαταστήματος",
            description: "Web Payroll Solutions",
        };

        try {
            const company = await CompaniesModel.findOne({
                _id: sessionCompanyInUse,
            });

            const data = await PerifereiesModel.find().sort("kodikos");
            res.render("companies/ypokatasthmata/add", {
                locals,
                company,
                data,
                mode: 'add',
                context: "branch",
                rec: {},
            });
        } catch (error) {
            console.log(error);
        }
    };

    static postYpokatasthmataForm = async (req, res) => {
        let aa_kod = null;
        const formData = req.body;

        try {
            const lastRecord = await YpokatasthmataModel.find({
                team: formData.companyTeam,
                companykod: formData.companyKodikos,
            })
                .sort({ _id: -1 })
                .limit(1);

            let kodValue =
                lastRecord[0] && lastRecord[0].kodikos
                ? parseInt(lastRecord[0].kodikos, 10)
                : null;
            if (kodValue !== null) {
                kodValue++;
            } else {
                kodValue = 0;
            }
            aa_kod = kodValue;
        } catch (error) {
            console.log("Σφάλμα :", error);
        }

        const newYpokatasthma = YpokatasthmataModel({
            team: formData.companyTeam,
            companykod_object: formData.companyId,
            companykod: formData.companyKodikos,
            kodikos: formatNumber(aa_kod, 4),
            perigrafh: formData.perigrafh,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            perifereia: (formData.perifereies =
                formData.perifereies === null || formData.perifereies === ""
                ? "00"
                : formData.perifereies),
            nomos: (formData.nomos =
                formData.nomos === null || formData.nomos === ""
                ? "0000"
                : formData.nomos),
            dhmos: (formData.dhmos =
                formData.dhmos === null || formData.dhmos === ""
                ? "0000"
                : formData.dhmos),
            polh: (formData.polh =
                formData.polh === null || formData.polh === ""
                ? "00000000"
                : formData.polh),
            pararthma_efka: formData.pararthma_efka,
            drasthriothta: formData.drasthriothta,
            thlefono: formData.thlefono,
            fax: formData.fax,
            email: formData.email,
            apasxolhsh5hmeron: formData.apasxolhsh5hmeron,
            epoxikothta: formData.epoxikothta,
            ap_pinaka: formData.ap_pinaka,
            hmnia_katatheshs: formData.hmnia_katatheshs,
            oikodomika_erga: formData.oikodomika_erga,
            amoe: formData.amoe,
            eidos_ergoy: formData.eidos_ergoy,
            username_ergoy: formData.username_ergoy,
            password_ergoy: formData.password_ergoy,
            ypergolabia: formData.ypergolabia,
            afm_ergolaboy: formData.afm_ergolaboy,
            eponymo_ergolaboy: formData.eponymo_ergolaboy,
            onoma_ergolaboy: formData.onoma_ergolaboy,
            patronymo_ergolaboy: formData.patronymo_ergolaboy,
            odos_ergolaboy: formData.odos_ergolaboy,
            arithmos_ergolaboy: formData.arithmos_ergolaboy,
            tk_ergolaboy: formData.tk_ergolaboy,
            polh_ergolaboy: formData.polh_ergolaboy,
            ame_ergolaboy: formData.ame_ergolaboy,
            pararthma_efka_ergolaboy: (formData.pararthma_efka_ergolaboy =
                formData.pararthma_efka_ergolaboy === null || formData.pararthma_efka_ergolaboy === ""
                ? "   "
                : formData.pararthma_efka_ergolaboy),
            sepe_ergoy: formData.sepe,
            dypa_ergoy: formData.dypa,
            username_ypergol_ergoy: formData.username_ypergol_ergoy,
            password_ypergol_ergoy: formData.password_ypergol_ergoy,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        try {
            await YpokatasthmataModel.create(newYpokatasthma);
            res.json({ success: true, redirectUrl: "/companies/ypokatasthmata" });
        } catch (error) {
            console.log(error);
        }
    };

    static searchGetYpokatasthmata = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Υποκαταστημάτων",
            description: "Web Payroll Solutions",
        };

        try {
            let searchTerm = nextPageSearchTerm;

            const sessionUserTeam = req.session.userTeam;
            const sessionUserId = req.session.userId;
            const sessionCompanyInUse = req.session.companyInUse;
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Ypokatasthmata",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $lookup: {
                        from: "poleis",
                        localField: "polh",
                        foreignField: "kodikos",
                        as: "polhInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$polhInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        // team: sessionUserTeam,
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                            { perografh: { $regex: new RegExp(searchTerm, "i") } },
                            { odos: { $regex: new RegExp(searchTerm, "i") } },
                            { arithmos: { $regex: new RegExp(searchTerm, "i") } },
                            { "polhInfo.perigrafh": { $regex: new RegExp(searchTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της πόλης
                        ]
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await YpokatasthmataModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Αναζήτηση και επισήμανση
            const ypokatasthmataFilteredRecs = await YpokatasthmataModel.aggregate([
                {
                    $lookup: {
                        from: "poleis",
                        localField: "polh",
                        foreignField: "kodikos",
                        as: "polhInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$polhInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
                            { odos: { $regex: new RegExp(searchTerm, "i") } },
                            { arithmos: { $regex: new RegExp(searchTerm, "i") } },
                            { "polhInfo.perigrafh": { $regex: new RegExp(searchTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της πόλης
                        ]
                    }
                }
            ]).skip(skipRecords).limit(limitPerPage);
        
            // Εφαρμογή της επισήμανσης
            const highlightedRecords = ypokatasthmataFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, searchTerm),
                perigrafh: this.highlightText(record.perigrafh, searchTerm),
                odos: this.highlightText(record.odos, searchTerm),
                arithmos: this.highlightText(record.arithmos, searchTerm),
                polhPerigrafh: record.polhInfo ? this.highlightText(record.polhInfo.perigrafh, searchTerm) : ""
            }));
        
            res.render("companies/ypokatasthmata/search", {
                ypokatasthmataFilteredRecs: highlightedRecords,
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

    static searchPostYpokatasthmata = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Υποκαταστημάτων",
            description: "Web Payroll Solutions",
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
                form: "Ypokatasthmata",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $lookup: {
                        from: "poleis",
                        localField: "polh",
                        foreignField: "kodikos",
                        as: "polhInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$polhInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(sTerm, "i") } },
                            { odos: { $regex: new RegExp(sTerm, "i") } },
                            { arithmos: { $regex: new RegExp(sTerm, "i") } },
                            { "polhInfo.perigrafh": { $regex: new RegExp(sTerm, "i") } }
                        ]
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await YpokatasthmataModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
            

            // Αναζήτηση και επισήμανση
            const ypokatasthmataFilteredRecs = await YpokatasthmataModel.aggregate([
                {
                    $lookup: {
                        from: "poleis",
                        localField: "polh",
                        foreignField: "kodikos",
                        as: "polhInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$polhInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(sTerm, "i") } },
                            { odos: { $regex: new RegExp(sTerm, "i") } },
                            { arithmos: { $regex: new RegExp(sTerm, "i") } },
                            { "polhInfo.perigrafh": { $regex: new RegExp(sTerm, "i") } } // Συμπερίληψη της αναζήτησης στο perigrafh της ιδιότητας
                        ]
                    }
                }
            ])
            .skip(skipRecords)
            .limit(limitPerPage);
        
            // Εφαρμογή της επισήμανσης
            const highlightedRecords = ypokatasthmataFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, sTerm),
                perigrafh: this.highlightText(record.perigrafh, sTerm),
                odos: this.highlightText(record.odos, sTerm),
                arithmos: this.highlightText(record.arithmos, sTerm),
                polhPerigrafh: record.polhInfo ? this.highlightText(record.polhInfo.perigrafh, sTerm) : ""
            }));

            res.render("companies/ypokatasthmata/search", {
                userPrivileges,
                locals,
                current: page,
                pages: totalPages,
                sTerm: sTerm,
                entries: perPage,
                totalRecs: totalRecords,
                ypokatasthmataFilteredRecs: highlightedRecords,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static editYpokatasthmataForm = async (req, res) => {
        const locals = {
            title: "Συντήρηση Υποκ/των",
            description: "Web Payroll Solutions",
        };

        try {
            const perifereies = await PerifereiesModel.find().sort("perigrafh");

            const ypokatasthmaId = req.params.id;
            const ypokatasthma = await YpokatasthmataModel.findById(ypokatasthmaId).lean();
            const company = await CompaniesModel.findOne({ _id: ypokatasthma.companykod_object }).lean();

            res.render("companies/ypokatasthmata/edit", {
                locals,
                perifereies,
                ypokatasthma,
                company,
                mode   : "edit",
                context: "branch",
                rec    : {}, 
            });
        } catch (error) {
            console.log(error);
        }
    };

    static postYpokatasthmaUpdate = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const ypokatasthmaId = req.params.ypokatasthmaId;
        const formData = req.body;

        const filteredDataYpokatasthma = {
            perigrafh: formData.perigrafh,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            perifereia: (formData.perifereies =
                formData.perifereies === null || formData.perifereies === ""
                ? "00"
                : formData.perifereies),
            nomos: (formData.nomos =
                formData.nomos === null || formData.nomos === ""
                ? "0000"
                : formData.nomos),
            dhmos: (formData.dhmos =
                formData.dhmos === null || formData.dhmos === ""
                ? "0000"
                : formData.dhmos),
            polh: (formData.polh =
                formData.polh === null || formData.polh === ""
                ? "00000000"
                : formData.polh),
            pararthma_efka: formData.pararthma_efka,
            drasthriothta: formData.drasthriothta,
            thlefono: formData.thlefono,
            fax: formData.fax,
            email: formData.email,
            apasxolhsh5hmeron: formData.apasxolhsh5hmeron,
            epoxikothta: formData.epoxikothta,
            ap_pinaka: formData.ap_pinaka,
            hmnia_katatheshs: formData.hmnia_katatheshs,
            oikodomika_erga: formData.oikodomika_erga,
            amoe: formData.amoe,
            eidos_ergoy: formData.eidos_ergoy,
            username_ergoy: formData.username_ergoy,
            password_ergoy: formData.password_ergoy,
            ypergolabia: formData.ypergolabia,
            afm_ergolaboy: formData.afm_ergolaboy,
            eponymo_ergolaboy: formData.eponymo_ergolaboy,
            onoma_ergolaboy: formData.onoma_ergolaboy,
            patronymo_ergolaboy: formData.patronymo_ergolaboy,
            odos_ergolaboy: formData.odos_ergolaboy,
            arithmos_ergolaboy: formData.arithmos_ergolaboy,
            tk_ergolaboy: formData.tk_ergolaboy,
            polh_ergolaboy: formData.polh_ergolaboy,
            ame_ergolaboy: formData.ame_ergolaboy,
            pararthma_efka_ergolaboy: (formData.pararthma_efka_ergolaboy =
                formData.pararthma_efka_ergolaboy === null || formData.pararthma_efka_ergolaboy === ""
                ? "   "
                : formData.pararthma_efka_ergolaboy),
            sepe_ergoy: formData.sepe,
            dypa_ergoy: formData.dypa,
            username_ypergol_ergoy: formData.username_ypergol_ergoy,
            password_ypergol_ergoy: formData.password_ypergol_ergoy,
            updatedAt: Date.now(),
        };

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataCompany στη $set: για ενημέρωση
        await YpokatasthmataModel.findOneAndUpdate(
            { _id: ypokatasthmaId },
            { $set: filteredDataYpokatasthma },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );

        try {
            res.json({ success: true, redirectUrl: "/companies/ypokatasthmata" });
        } catch (error) {
            throw error;
        }
    };

    static deleteYpokatasthmata = async (req, res) => {
        try {
            await YpokatasthmataModel.deleteOne({ _id: req.params.id });
            res.json({ success: true, redirectUrl: "/companies/ypokatasthmata" });
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

    static getYpokatasthmata = async (req, res) => {
        try {
            const ypokatasthma = await YpokatasthmataModel.find({
                team: req.session.userTeam,
                companykod_object: req.session.companyInUse,
            });
            res.json(ypokatasthma);
        } catch (error) {
            res.status(500).send(error);
        }
    };

}

module.exports = ypokatasthmataController;
