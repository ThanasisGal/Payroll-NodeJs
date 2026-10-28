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
        res.set('Cache-Control', 'no-store');
        res.set('X-Content-Type-Options', 'nosniff');
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
            if (!branch) throw Object.assign(new Error('Branch unavailable'), { code: 'FINAL_WTODAILY_DOCUMENT_FORBIDDEN' });
            result = await resolver({ scope });
            if (!result.found) throw new Error('No accepted document');
            const creds = await passwordModel.findOne({ team: scope.team, companykod_object: scope.company_kod,
                kodikos: '0002' }).lean();
            if (!creds?.username || !creds?.password) throw Object.assign(new Error('Credentials unavailable'), { code: 'ERGANI_PDF_AUTH_FAILED' });
            const buffer = await readPdf({ document: result, creds: { username: creds.username,
                password: creds.password, userType: process.env.ERGANI_USERTYPE || '01' } });
            if (!buffer) throw Object.assign(new Error('Official PDF unavailable'), { code: 'ERGANI_PDF_NOT_FOUND' });
            if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString() !== '%PDF-') {
                throw Object.assign(new Error('Invalid official PDF'), { code: 'ERGANI_PDF_INVALID_RESPONSE' });
            }
            res.set('Cache-Control', 'no-store');
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline; filename="WTODailyA.pdf"');
            return res.send(buffer);
        } catch (error) {
            const failures = {
                ERGANI_PDF_AUTH_FAILED: [502, 'FINAL_WTODAILY_PDF_AUTH_FAILED', 'Το ΕΡΓΑΝΗ δεν επέτρεψε τη σύνδεση ή την πρόσβαση στο επίσημο PDF.'],
                ERGANI_PDF_ENDPOINT_INCOMPATIBLE: [502, 'FINAL_WTODAILY_PDF_ENDPOINT_INCOMPATIBLE', 'Η υπηρεσία ανάκτησης του ΕΡΓΑΝΗ δεν δέχθηκε τον επίσημο τρόπο ανάγνωσης του εγγράφου.'],
                ERGANI_PDF_INVALID_RESPONSE: [502, 'FINAL_WTODAILY_PDF_INVALID_RESPONSE', 'Το ΕΡΓΑΝΗ επέστρεψε περιεχόμενο που δεν είναι έγκυρο PDF και η εμφάνιση σταμάτησε.'],
                ERGANI_PDF_NOT_FOUND: [404, 'FINAL_WTODAILY_PDF_NOT_FOUND', 'Η υπηρεσία ανάκτησης του ΕΡΓΑΝΗ δεν επέστρεψε το συγκεκριμένο επίσημο PDF.'],
                FINAL_WTODAILY_DOCUMENT_FORBIDDEN: [403, 'FINAL_WTODAILY_DOCUMENT_FORBIDDEN', 'Δεν επιτρέπεται η πρόσβαση στο έγγραφο του επιλεγμένου παραρτήματος.']
            };
            const [status, code, explanation] = failures[error.code] ||
                [409, 'FINAL_WTODAILY_PDF_UNAVAILABLE', 'Η ανάγνωση του επίσημου PDF δεν ολοκληρώθηκε αυτή τη στιγμή.'];
            return res.status(status).json({ success: false, status: result?.status || '',
                protocol: result?.protocol || '', code,
                message: explanation + ' ' +
                    (result?.found ? `Η υποβολή παραμένει επιτυχής με πρωτόκολλο ${result.protocol}. ` : '') +
                    '1. Ελέγξτε την επιλεγμένη εταιρεία, το παράρτημα και τα δικαιώματα σύνδεσης με τον διαχειριστή. ' +
                    '2. Συνδεθείτε χωριστά στην επίσημη ιστοσελίδα του ΕΡΓΑΝΗ, αναζητήστε την υποβολή με το πρωτόκολλο και την ημερομηνία υποβολής και επιλέξτε «Εκτύπωση». ' +
                    `Δεν αποθηκεύτηκε καμία αλλαγή και δεν έγινε νέα υποβολή. Κωδικός αναφοράς: ${code}.` });
        }
    };
}
module.exports = { FORM, NOT_FOUND_MESSAGE, page, document, createReadOnlyPdfHandler,
    pdf: createReadOnlyPdfHandler() };
