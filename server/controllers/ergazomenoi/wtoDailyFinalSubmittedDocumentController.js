'use strict';

const { UserPrivilegesModel } = require('../../models/privileges');
const { PeriodsModel } = require('../../models/stathera_arxeia');
const { YpokatasthmataModel } = require('../../models/companies');
const {
    resolveFinalWtoDailySubmittedDocument
} = require('../../services/ergazomenoi/wtoDailyFinalSubmittedDocumentService');

const FORM = 'EktyposhOristikouApologistikouPinaka';
const NOT_FOUND_MESSAGE =
    'Δεν βρέθηκε οριστικά υποβλημένος Απολογιστικός Πίνακας για την επιλεγμένη περίοδο και το παράρτημα.';

async function page(req, res, next) {
    try {
        const [userPrivileges, periodRec] = await Promise.all([
            UserPrivilegesModel.findOne({ userId: req.session.userId, form: FORM }).lean(),
            PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean()
        ]);
        return res.render('ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka', {
            locals: {
                title: 'Εκτύπωση Οριστικού Απολογιστικού Πίνακα',
                description: 'Web Payroll Solutions'
            },
            userPrivileges: userPrivileges?.privileges || {},
            periodRec,
            companyId: req.session.companyInUse,
            rec: {}
        });
    } catch (error) {
        return next(error);
    }
}

async function document(req, res) {
    try {
        const accessScope = req.programmataAccessScope || {};
        const scope = {
            team: accessScope.effectiveTeam,
            company_kod: accessScope.companyId,
            ypokatasthma: req.query?.ypokatasthma,
            period_start: req.query?.apo_hmeromhnia,
            period_end: req.query?.eos_hmeromhnia
        };
        const branch = String(scope.ypokatasthma || '').trim().padStart(4, '0');
        const branchRecord = await YpokatasthmataModel.findOne({
            team: scope.team,
            companykod_object: scope.company_kod,
            kodikos: branch
        }).select('_id').lean();
        if (!branchRecord) {
            return res.status(404).json({
                success: false,
                found: false,
                code: 'FINAL_WTODAILY_DOCUMENT_NOT_FOUND',
                message: NOT_FOUND_MESSAGE
            });
        }
        const result = await resolveFinalWtoDailySubmittedDocument({
            scope: { ...scope, ypokatasthma: branch }
        });
        if (!result.found) {
            return res.json({
                success: true,
                found: false,
                code: 'FINAL_WTODAILY_DOCUMENT_NOT_FOUND',
                message: NOT_FOUND_MESSAGE
            });
        }
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            found: false,
            code: error.code || 'FINAL_WTODAILY_DOCUMENT_READ_FAILED',
            message: error.statusCode
                ? error.message
                : 'Δεν ήταν δυνατό να ανοίξει ο οριστικά υποβλημένος Απολογιστικός Πίνακας.'
        });
    }
}

module.exports = { FORM, NOT_FOUND_MESSAGE, page, document };
