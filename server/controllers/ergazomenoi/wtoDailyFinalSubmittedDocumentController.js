'use strict';

const { UserPrivilegesModel } = require('../../models/privileges');
const { PeriodsModel } = require('../../models/stathera_arxeia');
const { readOfficialWtoDailyPdf } = require('../../services/ergazomenoi/wtoDailyOfficialPdfReadService');
const { PasswordsModel } = require('../../models/companies');
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

function createReadOnlyPdfHandler({ resolver = resolveFinalWtoDailySubmittedDocument,
    branchModel = YpokatasthmataModel, passwordModel = PasswordsModel,
    readPdf = readOfficialWtoDailyPdf } = {}) {
    return async (req, res) => {
        let result;
        try {
            const access = req.programmataAccessScope || {};
            if (!req.session?.userId || !access.effectiveTeam || !access.companyId) {
                return res.status(403).json({ success: false, code: 'FINAL_WTODAILY_DOCUMENT_FORBIDDEN',
                    message: 'Δεν επιτρέπεται η πρόσβαση στο επίσημο έγγραφο. 1. Συνδεθείτε στην εφαρμογή. 2. Επιλέξτε εταιρεία με δικαίωμα εκτύπωσης. Δεν άλλαξαν δεδομένα. Κωδικός αναφοράς: FINAL_WTODAILY_DOCUMENT_FORBIDDEN.' });
            }
            const scope = { team: access.effectiveTeam, company_kod: access.companyId,
                ypokatasthma: String(req.query?.ypokatasthma || '').trim().padStart(4, '0'),
                period_start: req.query?.apo_hmeromhnia, period_end: req.query?.eos_hmeromhnia };
            const branch = await branchModel.findOne({ team: scope.team, companykod_object: scope.company_kod,
                kodikos: scope.ypokatasthma }).select('_id').lean();
            if (!branch) throw new Error('Branch unavailable');
            result = await resolver({ scope });
            if (!result.found) throw new Error('No accepted document');
            const creds = await passwordModel.findOne({ team: scope.team, companykod_object: scope.company_kod,
                kodikos: '0002' }).lean();
            if (!creds?.username || !creds?.password) throw new Error('Credentials unavailable');
            const buffer = await readPdf({ document: result, creds: { username: creds.username,
                password: creds.password, userType: process.env.ERGANI_USERTYPE || '01' } });
            if (!buffer) throw new Error('Official PDF unavailable');
            res.set('Cache-Control', 'no-store');
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline; filename="WTODailyA.pdf"');
            return res.send(buffer);
        } catch (_) {
            return res.status(409).json({ success: false, status: result?.status || '',
                protocol: result?.protocol || '', code: 'FINAL_WTODAILY_PDF_UNAVAILABLE',
                message: 'Το επίσημο PDF δεν είναι διαθέσιμο για ανάγνωση αυτή τη στιγμή. ' +
                    (result?.found ? `Η υποβολή παραμένει επιτυχής με πρωτόκολλο ${result.protocol}. ` : '') +
                    '1. Δοκιμάστε ξανά αργότερα την ανάκτηση του εγγράφου. 2. Αν δεν εμφανίζεται, ελέγξτε το αποδεικτικό στο ΕΡΓΑΝΗ με τον υπεύθυνο. Δεν άλλαξαν δεδομένα και δεν έγινε νέα υποβολή. Κωδικός αναφοράς: FINAL_WTODAILY_PDF_UNAVAILABLE.' });
        }
    };
}
module.exports = { FORM, NOT_FOUND_MESSAGE, page, document, createReadOnlyPdfHandler,
    pdf: createReadOnlyPdfHandler() };
