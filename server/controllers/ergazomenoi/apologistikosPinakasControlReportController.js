'use strict';

const { UserPrivilegesModel } = require('../../models/privileges');
const { PeriodsModel } = require('../../models/stathera_arxeia');
const ApasxoliseisPeriodFrozenSnapshotModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const reportService = require('../../services/ergazomenoi/apologistikosPinakasControlReportService');
const pdfService = require('../../services/ergazomenoi/apologistikosPinakasControlPdfService');
const { getPeriodControl } = require('../../services/ergazomenoi/apasxoliseisPeriodControlService');
const { loadWtoDailyDeferredBoundaryContext } =
    require('../../services/ergazomenoi/wtoDailyDeferredBoundaryContextService');
const { prepareFinalWtoDailyCanonicalControl } =
    require('../../services/ergazomenoi/wtoDailyDeferredBoundaryIntegrationService');

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
        const input = { ypokatasthma: req.query.ypokatasthma,
            apo_hmeromhnia: req.query.apo_hmeromhnia, eos_hmeromhnia: req.query.eos_hmeromhnia };
        const criteria = reportService.validateRequest(input);
        const periodScope = { ...scope, ypokatasthma: criteria.ypokatasthma,
            period_start: criteria.startDate, period_end: criteria.endDate };
        const [state, companyName] = await Promise.all([
            getPeriodControl({ scope: periodScope }), reportService.loadCompanyName(scope)
        ]);
        let report;
        if (state.stored_status === 'FINALIZED' && state.frozen_snapshot_id) {
            const frozen = await ApasxoliseisPeriodFrozenSnapshotModel.findOne({
                _id: state.frozen_snapshot_id, ...periodScope,
                frozen_snapshot_fingerprint: state.frozen_snapshot_fingerprint
            }).select('frozen_snapshot').lean();
            if (!frozen?.frozen_snapshot) {
                const error = new Error('Δεν βρέθηκε το frozen snapshot της οριστικοποιημένης περιόδου.');
                error.code = 'WTODAILY_FROZEN_SNAPSHOT_REQUIRED'; error.statusCode = 409; throw error;
            }
            const boundaryContext = await loadWtoDailyDeferredBoundaryContext({ scope: periodScope,
                frozenSnapshot: frozen.frozen_snapshot, session: req.session });
            const prepared = prepareFinalWtoDailyCanonicalControl({ frozenSnapshot: frozen.frozen_snapshot,
                ...boundaryContext, periodStart: criteria.startIso, periodEnd: criteria.endIso });
            report = reportService.buildReportFromCanonical({ canonicalRows: prepared.canonicalRows, criteria });
        } else {
            report = await reportService.buildReport({ ...scope, input });
        }
        const buffer = await pdfService.generatePdf({ ...report, companyName });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="katastash-elegxou-apologistikou-pinaka.pdf"');
        return res.send(buffer);
    } catch (error) {
        if (error?.status === 400 || error?.statusCode && error.statusCode < 500) {
            return res.status(error.status || error.statusCode).send(`${error.code || 'CONTROL_REPORT_ERROR'}: ${error.message}`);
        }
        return next(error);
    }
}

module.exports = { page, pdf };
