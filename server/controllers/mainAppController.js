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
            description: "Web Payroll System",
        };
        res.render("mainapp", {
            locals,
            bodyClass: 'home-bg-cdn',
        });
    };

    static getCompanyDescription = async (req, res) => {
        try {
            const companies = await CompaniesModel.findById({
                _id: req.session.companyInUse,
            });

            res.json(" " + companies.kod + threeSpaces + companies.eponymia + " " + companies.firstname);
        } catch (error) {
            res.json();
        }
    };

    static getYearInUse = async (req, res) => {
        const sessionUserId = req.session.userId;

        try {
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            req.session.yearInUse = parameter.usedYear;

            res.json(parameter.usedYear);
        } catch (error) {
            res.json();
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
            description: "Web Payroll System",
        };
        res.render("dates/yearInUse", {
            locals,
        });
    };

    static getXrhseis = async (req, res) => {
        try {
            const xrhseis = await XrhseisModel.find({}, "etos").sort("etos");
            res.json(xrhseis);
        } catch (error) {
            res.status(500).send(error);
        }
    };
    
    static changeYear = async (req, res) => {
        const sessionUserId = req.session.userId;
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionPeriodInUse = req.session.periodInUse;
        const sessionPeriodInUseDescr = req.session.periodInUseDescr;
        const sessionAppDate = req.session.appDate;

        const newYear = req.body.xrhseis

        try {
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            const newParameters = ParamModel({
                usrId: sessionUserId,
                usrTeam: sessionUserTeam,
                companyId: sessionCompanyInUse,
                usedPeriod: sessionPeriodInUse,
                usedPeriodDescr: sessionPeriodInUseDescr,
                usedYear: newYear,
                appDate: sessionAppDate
            });

            if (!parameter) {
                await newParameters.save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: parameter.companyId,
                    usedPeriod: parameter.usedPeriod,
                    usedPeriodDescr: sessionPeriodInUseDescr,
                    usedYear: newYear,
                    appDate: parameter.appDate
                });
            }

            req.session.yearInUse = newYear;
            redir = "mainapp";
        } catch (error) {
            redir = "companies/genikastoixeia/companies";
        }
        await res.render(redir, {
            bodyClass: "home-bg-cdn"
        });
    };

    static getPeriodsForm = async (req, res) => {
        const locals = {
            title: "Περίοδος Εργασίας",
            description: "Web Payroll System",
        };
        res.render("dates/periods", {
            locals,
        });
    };

    static getPeriods = async (req, res) => {
        try {
            const parameter = await ParamModel.findOne({ usrId: req.session.userId });
            if (parameter) {
                if(parameter.usedYear.length > 0) {
                    const periodoi = await PeriodsModel.find({xrhsh: parameter.usedYear}).select('kodikos perigrafh').sort("kodikos");
                    res.json(periodoi);
                }
            } else {
                res.json();
            }
        } catch (error) {
            res.json();
        }
    };
    
    static getPeriodInUse = async (req, res) => {
        const sessionUserId = req.session.userId;
        try { 
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            req.session.periodInUse = parameter.usedPeriod;
            const periodoi = await PeriodsModel.findOne({xrhsh: parameter.usedYear, kodikos: parameter.usedPeriod});
            req.session.periodInUseDescr = periodoi.perigrafh;

            res.json(periodoi.perigrafh);
        } catch (error) {
            res.json();
        }
    };

    static changePeriod = async (req, res) => {
        const sessionUserId = req.session.userId;
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionYearInUse = req.session.yearInUse;
        const sessionAppDate = req.session.appDate;

        const newPeriod = req.body.periodoi;

        try {
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            const periodoi = await PeriodsModel.findOne({xrhsh: parameter.usedYear, kodikos: newPeriod});
        
            const newPeriodDescr = periodoi.perigrafh;
            const newParameters = ParamModel({
                usrId: sessionUserId,
                usrTeam: sessionUserTeam,
                companyId: sessionCompanyInUse,
                usedPeriod: newPeriod,
                usedPeriodDescr: newPeriodDescr,
                usedYear: sessionYearInUse,
                appDate: sessionAppDate
            });

            if (!parameter) {
                await newParameters.save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: sessionCompanyInUse,
                    usedPeriod: newPeriod,
                    usedPeriodDescr: newPeriodDescr,
                    usedYear: sessionYearInUse,
                    appDate: sessionAppDate
                });
            }

            req.session.periodInUse = newPeriod;
            req.session.periodInUseDescr = newPeriodDescr;
        
            // await res.flash("success", "Επιτυχής Αλλαγή Περιόδου Εργασίας.");
            redir = "mainapp";
        } catch (error) {
            await res.flash("error", "Αδυναμία Αλλαγής Περιόδου Εργασίας. Επικοινωνείστε με τον Διαχειριστή");
            redir = "companies/companies/genikastoixeia";
        }
        await res.render(redir, { bodyClass: "home-bg-cdn" });
    };

    static getAppDateForm = async (req, res) => {
        const locals = {
            title: "Ημ/νία Εφαρμογής",
            description: "Web Payroll System",
        };
        res.render("dates/appDate", {
            locals,
        });
    };

    static changeAppDate = async (req, res) => {
        const sessionUserId = req.session.userId;
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionYearInUse = req.session.yearInUse;
        const sessionPeriodInUse = req.session.periodInUse;
        const sessionPeriodInUseDescr = req.session.periodInUseDescr;

        const newAppDate = req.body.appHmeromhnia
        try {
            const parameter = await ParamModel.findOne({ usrId: sessionUserId });
            const newParameters = ParamModel({
                usrId: sessionUserId,
                usrTeam: sessionUserTeam,
                companyId: sessionCompanyInUse,
                usedPeriod: sessionPeriodInUse,
                usedPeriodDescr: sessionPeriodInUseDescr,
                usedYear: sessionYearInUse,
                appDate: newAppDate
            });

            if (!parameter) {
                await newParameters.save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: parameter.companyId,
                    usedPeriod: parameter.usedPeriod,
                    usedPeriodDescr: parameter.usedPeriodDescr,
                    usedYear: parameter.usedYear,
                    appDate: newAppDate
                });
            }

            req.session.appDate = newAppDate;

            await res.flash("success", "Επιτυχής Αλλαγή Ημερομηνίας Εφαρμογής.");
            redir = "mainapp";
        } catch (error) {
            await res.flash("error", "Αδυναμία Αλλαγής Ημερομηνίας Εφαρμογής. Επικοινωνείστε με τον Διαχειριστή");
            redir = "companies/companies/genikastoixeia";
        }
        await res.render(redir, {
            bodyClass: "custom-background"
        });
    };

    static getAppDateInUse = async (req, res) => {
      const sessionUserId = req.session.userId;

      try {
        const parameter = await ParamModel.findOne({ usrId: sessionUserId });
        req.session.appDate = parameter.appDate;

        res.json(parameter.appDate);
      } catch (error) {
        res.json();
      }
    };
};

module.exports = mainAppController;
