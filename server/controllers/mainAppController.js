const logger = require("../../server/utils/logger");

const Models_A = require("../models/param");
const UserModel = require("../models/userModel");
const Models_C = require("../models/companies");
const Models = require("../models/stathera_arxeia");

const { ParamModel } = Models_A;

const { CompaniesModel } = Models_C;

const { XrhseisModel,
        PeriodsModel
      } = Models;

const threeSpaces = '\u00A0'.repeat(3);

var redir;

class mainAppController {
    static getMainAppForm = async (req, res) => {
        const locals = {
            title: "Payroll",
            description: "Web Payroll Solutions",
        };
        res.render("mainapp", {
            locals,
            bodyClass: 'home-bg-cdn',
        });
    };

    static getCompanyDescription = async (req, res) => {
        try {
            // Έλεγχος authentication
            if (! req.session || !req.session.companyInUse) {
                return res.json({ 
                    success: true,
                    newCompanyDescription: '',
                    message: 'No company selected'
                });
            }

            // ✅ ΔΙΟΡΘΩΣΗ: findById δέχεται μόνο το ID, όχι object
            const company = await CompaniesModel.findById(req. session.companyInUse);

            if (!company) {
                return res.json({ 
                    success: true,
                    newCompanyDescription: '',
                    message: 'Company not found'
                });
            }

            // Δημιουργία της περιγραφής
            // const threeSpaces = "   "; // ή "\u00A0\u00A0\u00A0" για non-breaking spaces
            const description = `${company.kod || ''}${threeSpaces}${company.eponymia || ''} ${company.firstname || ''}`;

            // ✅ ΔΙΟΡΘΩΣΗ: Επιστροφή σωστού JSON object
            return res.json({ 
                success: true,
                newCompanyDescription: description. trim()
            });

        } catch (error) {
            console.error("Error fetching company description:", error);
            
            // ✅ ΔΙΟΡΘΩΣΗ: Επιστροφή σωστού error JSON
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                newCompanyDescription: ''
            });
        }
    };

    static getYearInUse = async (req, res) => {
        try {
            // ✅ Έλεγχος authentication
            if (!req.session || !req.session.userId) {
                return res.json({ 
                    success: true,
                    yearInUse: '',
                    message: 'No year selected'
                });
            }

            const sessionUserId = req.session.userId;

            // ✅ Έλεγχος cache στο session
            if (req.session.yearInUse) {
                return res. json({ 
                    success: true,
                    cached: true,
                    yearInUse: req.session.yearInUse
                });
            }

            // ✅ Fetch από DB
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });

            if (!parameter || !parameter.usedYear) {
                return res.json({ 
                    success: true,
                    yearInUse: '',
                    message: 'No year configured'
                });
            }

            // ✅ Αποθήκευση στο session για caching
            req.session.yearInUse = parameter.usedYear;

            // ✅ Επιστροφή σωστού JSON object
            return res.json({ 
                success: true,
                cached: false,
                yearInUse: parameter.usedYear
            });

        } catch (error) {
            console.error("Error fetching year in use:", error);
            
            // ✅ Επιστροφή error JSON (όχι κενό!)
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                yearInUse: ''
            });
        }
    };    

    static getAllUsers = async (req, res) => {
        try {
            const user = await UserModel.find({}).select('_id lastName firstName team');
            res.json(user);
        } catch (error) {
            res.json();
        }
    };

    static populateUsers = async (req, res) => {
        try {
            const companyUsers = await Company.findById(yourCompanyId).populate('users');
            res.json(user);
        } catch (error) {
            res.json();
        }
    };

    static getUser = async (req, res) => {
        const sessionUserId = req.session.userId;
        logger.debug(`Session = ${JSON.stringify(req.session, null, 2)}`);
        try {
            const user = await UserModel.findOne({ _id: sessionUserId }).select('firstName team');
            res.json(user);
        } catch (error) {
            res.json();
        }
    };

    static getYearsForm = async (req, res) => {
        const locals = {
            title: "Αλλαγή Χρήσης",
            description: "Web Payroll Solutions",
        };
        res.render("dates/yearInUse", {
            locals,
        });
    };

    static getXrhseis = async (req, res) => {
        try {
            // ✅ Έλεγχος authentication
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ 
                    error: 'Not authenticated',
                    xrhseis: []
                });
            }

            // ✅ Fetch user parameters
            const parameter = await ParamModel.findOne({ usrId: req.session.userId });

            if (!parameter) {
                return res.json({ 
                    success: true,
                    xrhseis: [],
                    message: 'No user parameters found'
                });
            }

            if (! parameter.usedYear || parameter. usedYear.length === 0) {
                return res.json({ 
                    success: true,
                    xrhseis: [],
                    message: 'No year selected'
                });
            }

            // ✅ Fetch periods for the selected year
            const xrhseis = await XrhseisModel
                .find()
                .select('etos')
                .sort({etos: -1})
                .lean();  // ✅ Faster query

            // ✅ Return proper JSON response
            return res.json({ 
                success: true,
                xrhseis: xrhseis || [],
                count: xrhseis.length
            });

        } catch (error) {
            console.error("Error fetching xrhseis:", error);
            
            // ✅ Return proper error JSON (not empty!)
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                xrhseis: []
            });
        }
    };    
    
    static changeYear = async (req, res) => {
        try {
            const sessionUserId = req.session.userId;
            const sessionUserTeam = req. session.userTeam;
            const sessionCompanyInUse = req.session.companyInUse;
            const sessionPeriodInUse = req.session.periodInUse;
            const sessionPeriodInUseDescr = req.session.periodInUseDescr;
            const sessionAppDate = req.session.appDate;
            const newYear = req.body.xrhseis;

            // ✅ Validation
            if (!newYear) {
                return res.redirect("/dates/changeYear");
            }

            // ✅ Fetch current parameters
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });

            if (!parameter) {
                // ✅ Create new parameter (with 'new' keyword)
                const newParameters = new ParamModel({
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: sessionCompanyInUse,
                    usedPeriod: sessionPeriodInUse,
                    usedPeriodDescr: sessionPeriodInUseDescr,
                    usedYear: newYear,
                    appDate: sessionAppDate
                });
                await newParameters.save();
            } else {
                // ✅ Update only the year field
                await ParamModel. findByIdAndUpdate(parameter._id, {
                    usedYear: newYear
                });
            }

            // ✅ Update session
            req.session.yearInUse = newYear;

            // ✅ Save session before redirect
            await new Promise((resolve, reject) => {
                req. session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            return res.redirect("/mainapp");

        } catch (error) {
            console.error("Error changing year:", error);
            return res.redirect("/yearInUse");
        }
    };

    static getPeriodsForm = async (req, res) => {
        const locals = {
            title: "Περίοδος Εργασίας",
            description: "Web Payroll Solutions",
        };
        res.render("dates/periods", {
            locals,
        });
    };

    static getPeriods = async (req, res) => {
        try {
            // ✅ Έλεγχος authentication
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ 
                    error: 'Not authenticated',
                    periodoi: []
                });
            }

            // ✅ Fetch user parameters
            const parameter = await ParamModel.findOne({ usrId: req.session.userId });

            if (!parameter) {
                return res.json({ 
                    success: true,
                    periodoi: [],
                    message: 'No user parameters found'
                });
            }

            if (! parameter.usedYear || parameter. usedYear.length === 0) {
                return res.json({ 
                    success: true,
                    periodoi: [],
                    message: 'No year selected'
                });
            }

            // ✅ Fetch periods for the selected year
            const periodoi = await PeriodsModel
                .find({ xrhsh: parameter.usedYear })
                .select('kodikos perigrafh')
                .sort('kodikos')
                .lean();  // ✅ Faster query

            // ✅ Return proper JSON response
            return res.json({ 
                success: true,
                periodoi: periodoi || [],
                year: parameter.usedYear,
                count: periodoi.length
            });

        } catch (error) {
            console.error("Error fetching periods:", error);
            
            // ✅ Return proper error JSON (not empty!)
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                periodoi: []
            });
        }
    };    

    static getPeriodInUse = async (req, res) => {
        try {
            // ✅ Έλεγχος authentication
            if (!req.session || !req.session.userId) {
                return res.json({ 
                    success: true,
                    periodInUse: '',
                    message: 'No period selected'
                });
            }

            const sessionUserId = req.session.userId;

            // ✅ Έλεγχος cache στο session
            if (req.session.periodInUse) {
                return res. json({ 
                    success: true,
                    cached: true,
                    periodInUse: req.session.periodInUse,
                    periodInUseDescr: req.session.periodInUseDescr
                });
            }

            // ✅ Fetch από DB
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            console.log(`Parameter fetched: ${JSON.stringify(parameter)}`);
            
            if (!parameter || !parameter.usedPeriod) {
                return res.json({ 
                    success: true,
                    periodInUse: '',
                    periodInUseDescr: '',
                    message: 'No period configured'
                });
            }

            // ✅ Αποθήκευση στο session για caching
            req.session.periodInUse = parameter.usedPeriod;
            req.session.periodInUseDescr = parameter.usedPeriodDescr;

            // ✅ Επιστροφή σωστού JSON object
            return res.json({ 
                success: true,
                cached: false,
                periodInUse: parameter.usedPeriod,
                periodInUseDescr: parameter.usedPeriodDescr
            });

        } catch (error) {
            console.error("Error fetching period in use:", error);
            
            // ✅ Επιστροφή error JSON (όχι κενό!)
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                periodInUse: '',
                periodInUseDescr: ''
            });
        }
    };    

    static changePeriod = async (req, res) => {
        try {
            const sessionUserId = req.session.userId;
            const sessionUserTeam = req. session.userTeam;
            const sessionCompanyInUse = req.session.companyInUse;
            const sessionYearInUse = req.session. yearInUse;
            const sessionAppDate = req.session. appDate;
            const newPeriod = req.body.periodoi;

            // ✅ Validation
            if (!newPeriod) {
                return res.redirect("/mainapp");
            }

            // ✅ Fetch current parameters
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            
            if (!parameter) {
                return res.redirect("/mainapp");
            }

            // ✅ Fetch period details
            const periodoi = await PeriodsModel.findOne({
                xrhsh: parameter. usedYear, 
                kodikos: newPeriod
            });

            if (!periodoi) {
                return res.redirect("/mainapp");
            }

            const newPeriodDescr = periodoi.perigrafh;

            // ✅ Update parameters
            await ParamModel.findByIdAndUpdate(parameter._id, {
                usedPeriod: newPeriod,
                usedPeriodDescr: newPeriodDescr
            });

            // ✅ Update session
            req.session.periodInUse = newPeriod;
            req.session.periodInUseDescr = newPeriodDescr;

            // ✅ Save session before redirect
            await new Promise((resolve, reject) => {
                req. session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            return res.redirect("/mainapp");

        } catch (error) {
            console.error("Error changing period:", error);
            return res.redirect("/mainapp");
        }
    };

    static getAppDateForm = async (req, res) => {
        const locals = {
            title: "Ημ/νία Εφαρμογής",
            description: "Web Payroll Solutions",
        };
        res.render("dates/appDate", {
            locals,
        });
    };

    static changeAppDate = async (req, res) => {
        try {
            const sessionUserId = req.session.userId;
            const sessionUserTeam = req. session.userTeam;
            const sessionCompanyInUse = req.session.companyInUse;
            const sessionYearInUse = req.session. yearInUse;
            const sessionPeriodInUse = req.session.periodInUse;
            const sessionPeriodInUseDescr = req. session.periodInUseDescr;
            const newAppDate = req. body.appHmeromhnia;

            if (!newAppDate) {
                return res.redirect("/mainapp");
            }

            const parameter = await ParamModel.findOne({ usrId: sessionUserId });

            if (!parameter) {
                const newParameters = new ParamModel({
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: sessionCompanyInUse,
                    usedPeriod: sessionPeriodInUse,
                    usedPeriodDescr: sessionPeriodInUseDescr,
                    usedYear: sessionYearInUse,
                    appDate: newAppDate
                });
                await newParameters.save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    appDate: newAppDate
                });
            }

            req.session.appDate = newAppDate;
            
            // Αποθήκευσε το session
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // await res.flash("success", "Επιτυχής Αλλαγή Ημερομηνίας Εφαρμογής");
            return res.redirect("/mainapp");
            
        } catch (error) {
            console.error("Error changing app date:", error);
            // await res.flash("error", "Αδυναμία Αλλαγής Ημερομηνίας Εφαρμογής");
            return res.redirect("/companies/companies/genikastoixeia");
        }
    };

    // static getAppDateInUse = async (req, res) => {
    //   const sessionUserId = req.session.userId;

    //   try {
    //     const parameter = await ParamModel.findOne({ usrId: sessionUserId });
    //     req.session.appDate = parameter.appDate;

    //     res.json(parameter.appDate);
    //   } catch (error) {
    //     res.json();
    //   }
    // };

    static getAppDateInUse = async (req, res) => {
        try {
            // ✅ Έλεγχος authentication
            if (! req.session || !req.session.userId) {
                return res.json({ 
                    success: true,
                    appDate: ''
                });
            }

            const sessionUserId = req.session.userId;

            // ✅ Έλεγχος cache στο session
            if (req.session.appDate) {
                return res.json({ 
                    success: true,
                    cached: true,
                    appDate: req.session.appDate
                });
            }

            // ✅ Fetch από DB
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });

            if (!parameter || !parameter.appDate) {
                return res.json({ 
                    success: true,
                    appDate: '',
                    message: 'No app date configured'
                });
            }

            // ✅ Αποθήκευση στο session
            req.session.appDate = parameter.appDate;

            // ✅ Επιστροφή σωστού JSON object
            return res.json({ 
                success: true,
                cached: false,
                appDate: parameter.appDate
            });

        } catch (error) {
            console.error("Error fetching app date:", error);
            
            // ✅ Επιστροφή error JSON (όχι κενό!)
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                appDate: ''
            });
        }
    };
};

module.exports = mainAppController;
