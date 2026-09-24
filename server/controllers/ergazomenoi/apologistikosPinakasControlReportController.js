'use strict';

const { UserPrivilegesModel } = require('../../models/privileges');
const { PeriodsModel } = require('../../models/stathera_arxeia');
const reportService = require('../../services/ergazomenoi/apologistikosPinakasControlReportService');
const pdfService = require('../../services/ergazomenoi/apologistikosPinakasControlPdfService');

async function page(req, res, next) {
    try {
        const [userPrivileges, periodRec] = await Promise.all([
            UserPrivilegesModel.findOne({ userId: req.session.userId, form: 'KatastashElegxouApologistikouPinaka' }).lean(),
            PeriodsModel.findOne({ xrhsh: req.session.yearInUse, kodikos: req.session.periodInUse }).lean()
        ]);
        return res.render('ergazomenoi/programmata/katastashElegxouApologistikouPinaka', {
            locals: { title: 'Κατάσταση Ελέγχου Απολογιστικού Πίνακα', description: 'Web Payroll Solutions' },
            userPrivileges: userPrivileges?.privileges || {}, periodRec, companyId: req.session.companyInUse, rec: {}
        });
    } catch (error) { return next(error); }
}

async function pdf(req, res, next) {
    try {
        const scope = { team: req.session.userTeam, company_kod: req.session.companyInUse };
        const [report, companyName] = await Promise.all([
            reportService.buildReport({ ...scope,
                input: { ypokatasthma: req.query.ypokatasthma, apo_hmeromhnia: req.query.apo_hmeromhnia,
                    eos_hmeromhnia: req.query.eos_hmeromhnia }
            }),
            reportService.loadCompanyName(scope)
        ]);
        const buffer = await pdfService.generatePdf({ ...report, companyName });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="katastash-elegxou-apologistikou-pinaka.pdf"');
        return res.send(buffer);
    } catch (error) {
        if (error?.status === 400) return res.status(400).send(error.message);
        return next(error);
    }
}

module.exports = { page, pdf };
