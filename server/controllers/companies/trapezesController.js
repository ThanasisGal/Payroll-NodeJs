const mongoose = require("mongoose");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");

const { UserPrivilegesModel } = Models_B;
const { CompaniesModel, BanksPerCompanyModel } = Models_C;

function formatNumber(number, totalLength) {
    return number.toString().padStart(totalLength, '0');
}

let nextPageSearchTerm = "";

class trapezesController {

    static mainTrapezesForm = async (req, res) => {
        const locals = {
            title: "Τράπεζες Ανά Εταρεία",
            description: "Web Payroll System",
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

            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "Trapezes",
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

            const countResults = await BanksPerCompanyModel.aggregate(
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

            const trapezes = await BanksPerCompanyModel.aggregate(
                queryPipeline
            ).exec();

            res.render("companies/trapezes/trapezes", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: page,
                pages: totalPages,
                company,
                trapezes,
                perx,                       // <-- για το UI πολλαπλασιαστή
                basePer,                    // (προαιρετικό, αν το δείχνεις)
                entries: perPage,           // (προαιρετικό: πόσα/σελίδα)
                totalRecs: totalRecords,    // (προαιρετικό: συνολικά)
            });
        } catch (error) {
            console.log(error);
        }
    };

    static addTrapezesForm = async (req, res) => {
        const sessionCompanyInUse = req.session.companyInUse;
        const locals = {
            title: "Προσθήκη Νέας Τράπεζας",
            description: "Web Payroll System",
        };

        try {
        const company = await CompaniesModel.findOne({
            _id: sessionCompanyInUse,
        });

        res.render("companies/trapezes/add", {
            locals,
            company,
            context: "trapeza",
            rec: {},
        });
        } catch (error) {
            console.log(error);
        }
    };

    static postTrapezesForm = async (req, res) => {
        let aa_kod = null;
        const formData = req.body;
        try {
            const lastRecord = await BanksPerCompanyModel.find({
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
                kodValue = 1;
            }
            aa_kod = kodValue;
        } catch (error) {
            console.log("Σφάλμα :", error);
        }

        const newTrapeza = BanksPerCompanyModel({
            team: formData.companyTeam,
            companykod_object: formData.companyId,
            companykod: formatNumber(formData.companyKodikos, 4),
            kodikos: formatNumber(aa_kod, 4),
            kodikos_dias: formData.kodikos_dias_stathera,
            perigrafh: formData.perigrafh_stathera,
            logariasmos_1: formData.logariasmos_1,
            logariasmos_2: formData.logariasmos_2,
            logariasmos_3: formData.logariasmos_3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        try {
            await BanksPerCompanyModel.create(newTrapeza);
            res.json({ success: true, redirectUrl: "/companies/trapezes" });
        } catch (error) {
            console.log(error);
        }
    };

    static searchGetTrapezes = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Τραπεζών",
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
                form: "Trapezes",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                            { kodikos_dias: { $regex: new RegExp(searchTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_1: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_2: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_3: { $regex: new RegExp(searchTerm, "i") } },
                        ]
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await BanksPerCompanyModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Αναζήτηση και επισήμανση
            const trapezesFilteredRecs = await BanksPerCompanyModel.aggregate([
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, "i") } },
                            { kodikos_dias: { $regex: new RegExp(searchTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_1: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_2: { $regex: new RegExp(searchTerm, "i") } },
                            { logariasmos_3: { $regex: new RegExp(searchTerm, "i") } },
                        ]
                    }
                }
            ]).skip(skipRecords)
            .limit(limitPerPage);
        
            // Εφαρμογή της επισήμανσης
            const highlightedRecords = trapezesFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, searchTerm),
                kodikos_dias: this.highlightText(record.kodikos_dias, searchTerm),
                perigrafh: this.highlightText(record.perigrafh, searchTerm),
                logariasmos_1: this.highlightText(record.logariasmos_1, searchTerm),
                logariasmos_2: this.highlightText(record.logariasmos_2, searchTerm),
                logariasmos_3: this.highlightText(record.logariasmos_3, searchTerm),
            }));
        
            res.render("companies/trapezes/search", {
                trapezesFilteredRecs: highlightedRecords,
                locals,
                current: page,
                pages: totalPages,
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                sTerm: searchTerm,
                entries: perPage,
                totalRecs: totalRecords,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static searchPostTrapezes = async (req, res) => {
        const locals = {
            title: "Αναζήτηση Τραπεζών",
            description: "Web Payroll System",
        };

        try {
            let searchTerm = req.body.searchTerm;

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
                form: "Trapezes",
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, "i") } },
                            { kodikos_dias: { $regex: new RegExp(sTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_1: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_2: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_3: { $regex: new RegExp(sTerm, "i") } },
                        ]
                    },
                },
                {
                    $count: "total",
                },
            ];

            const countResults = await BanksPerCompanyModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(perPage, totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών
            

            // Αναζήτηση και επισήμανση
            const trapezesFilteredRecs = await BanksPerCompanyModel.aggregate([
                {
                    $match: {
                        companykod_object: sessionCompanyInUse,
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, "i") } },
                            { kodikos_dias: { $regex: new RegExp(sTerm, "i") } },
                            { perigrafh: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_1: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_2: { $regex: new RegExp(sTerm, "i") } },
                            { logariasmos_3: { $regex: new RegExp(sTerm, "i") } },
                        ]
                    }
                }
            ])
            .skip(skipRecords)
            .limit(limitPerPage);
        
            // Εφαρμογή της επισήμανσης
            const highlightedRecords = trapezesFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, sTerm),
                kodikos_dias: this.highlightText(record.kodikos_dias, sTerm),
                perigrafh: this.highlightText(record.perigrafh, sTerm),
                logariasmos_1: this.highlightText(record.logariasmos_1, sTerm),
                logariasmos_2: this.highlightText(record.logariasmos_2, sTerm),
                logariasmos_3: this.highlightText(record.logariasmos_3, sTerm),
            }));

            res.render("companies/trapezes/search", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: page,
                pages: totalPages,
                sTerm: sTerm,
                entries: perPage,
                totalRecs: totalRecords,
                trapezesFilteredRecs: highlightedRecords,
            });
        } catch (error) {
            console.log(error);
        }
    };

    static editTrapezesForm = async (req, res) => {
        const locals = {
            title: "Συντήρηση Τραπεζών",
            description: "Web Payroll System",
        };

        try {
            const trapezesId = req.params.id;
            
            const trapezes = await BanksPerCompanyModel.findById(trapezesId).lean();
            const company = await CompaniesModel.findOne({ _id: trapezes.companykod_object }).lean();

            res.render("companies/trapezes/edit", { 
                locals,
                company, 
                trapezes,
                mode   : "edit",
                context: "trapeza",
                rec    : {}, 

            });
        } catch (error) {
            console.log(error);
        }
    };

    static postTrapezesUpdate = async (req, res) => {
        const trapezesId = req.params.trapezesId;
        const formData = req.body;

        const filteredDataTrapezes = {
            kodikos_dias: formData.kodikos_dias_stathera,
            perigrafh: formData.perigrafh_stathera,
            logariasmos_1: formData.logariasmos_1,
            logariasmos_2: formData.logariasmos_2,
            logariasmos_3: formData.logariasmos_3,
            updatedAt:  Date.now(),
        };

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataCompany στη $set: για ενημέρωση
        await BanksPerCompanyModel.findOneAndUpdate(
            { _id: trapezesId },
            { $set: filteredDataTrapezes },
            { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
        );

        try {
            res.json({ success: true, redirectUrl: "/companies/trapezes" });
        } catch (error) {
            throw error;
        }
    };

    static deleteTrapezes = async (req, res) => {
        try {
            await BanksPerCompanyModel.deleteOne({ _id: req.params.id });
            res.json({ success: true, redirectUrl: "/companies/trapezes" });
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

module.exports = trapezesController;
