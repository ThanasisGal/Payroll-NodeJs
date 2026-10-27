'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const { getPeriodControl, normalizeScope } =
    require('./apasxoliseisPeriodControlService');
const {
    buildSubmittedErganiPdfDisplayFilename
} = require('./submittedErganiPdfStorageIdentityService');

function submittedDocumentError(code, statusCode, message) {
    return Object.assign(new Error(message), { code, statusCode });
}

function dateKey(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function hasStoredPdf(row = {}) {
    return Boolean(row.pdf_s3_key || row.pdf_relative_path || row.pdf_s3_url);
}

function safePdfRoute(id) {
    return id ? `/ergazomenoi/ergazomenoi/ergani/pdf/${id}` : '';
}

async function queryLean(query) {
    return query && typeof query.lean === 'function' ? query.lean() : query;
}

function assertSubmissionMatchesScope(submission, scope, reference) {
    const matches = Boolean(submission) &&
        String(submission._id || '') === String(reference) &&
        String(submission.team || '').trim() === scope.team &&
        String(submission.companykod_object || '') === scope.company_kod &&
        String(submission.ypokatasthma_kodikos || '').trim().padStart(4, '0') ===
            scope.ypokatasthma &&
        dateKey(submission.employment_period_start) === dateKey(scope.period_start) &&
        dateKey(submission.employment_period_end) === dateKey(scope.period_end) &&
        submission.submission_code === 'WTODailyA' &&
        submission.submission_status === 'SUCCESS' &&
        submission.is_final === true &&
        submission.document_status === 'ACTIVE' &&
        Number.isFinite(Number(submission.submission_id)) &&
        Number(submission.submission_id) > 0 &&
        Boolean(String(submission.protocol || '').trim()) &&
        Boolean(dateKey(submission.submit_date));
    if (!matches) {
        throw submittedDocumentError(
            'FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH',
            409,
            'Δεν είναι δυνατό να ανοίξει το οριστικό PDF, επειδή η συνδεδεμένη υποβολή δεν συμφωνεί με την επιλεγμένη εταιρεία, περίοδο ή παράρτημα.'
        );
    }
}

async function resolveFinalWtoDailySubmittedDocument({
    scope: input,
    periodControlResolver = getPeriodControl,
    submissionModel = ErgazomenoiErganhModel,
    transmissionModel = require('../../models/wtoDailyRevisionTransmission'),
    revisionModel = require('../../models/wtoDailySubmissionRevision')
}) {
    const scope = normalizeScope(input);
    const periodControl = await periodControlResolver({ scope });
    if (!periodControl?.exists || periodControl.stored_status !== 'FINALIZED') {
        return Object.freeze({ found: false, scope });
    }

    let reference = periodControl.submission_reference;
    let transmission = null;
    if (!reference) {
        const attempts = await queryLean(transmissionModel.find({ ...scope, status: 'SUCCESS' }));
        if (!attempts.length) return Object.freeze({ found: false, scope });
        if (attempts.length !== 1) throw submittedDocumentError('FINAL_WTODAILY_DOCUMENT_AMBIGUOUS', 409,
            'Βρέθηκαν περισσότερες από μία επιτυχείς καταχωρίσεις. 1. Ελέγξτε τα πρωτόκολλα. 2. Ζητήστε έλεγχο από τον διαχειριστή. Δεν άλλαξαν δεδομένα. Κωδικός αναφοράς: FINAL_WTODAILY_DOCUMENT_AMBIGUOUS.');
        transmission = attempts[0];
        if (transmission.status !== 'SUCCESS' || transmission.team !== scope.team ||
            String(transmission.company_kod) !== scope.company_kod || transmission.ypokatasthma !== scope.ypokatasthma ||
            dateKey(transmission.period_start) !== dateKey(scope.period_start) ||
            dateKey(transmission.period_end) !== dateKey(scope.period_end)) {
            throw submittedDocumentError('FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH', 409,
                'Η υποβολή δεν αντιστοιχεί στην επιλεγμένη περίοδο. 1. Ελέγξτε τα κριτήρια εκτύπωσης. 2. Ζητήστε έλεγχο από τον διαχειριστή. Δεν άλλαξαν δεδομένα. Κωδικός αναφοράς: FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH.');
        }
        const revision = await queryLean(revisionModel.findOne({ ...scope, _id: transmission.revision_id,
            baseline_snapshot_id: periodControl.frozen_snapshot_id }));
        if (!revision || !transmission.completed_at || transmission.result?.outcome !== 'SUCCESS' ||
            !transmission.result?.protocol || !transmission.result?.id || !transmission.result?.submitDate ||
            !transmission.erganh_log_id) throw submittedDocumentError('FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH', 409,
            'Η επιτυχής καταχώριση δεν συνδέεται με την εγκεκριμένη έκδοση. 1. Ελέγξτε την περίοδο. 2. Ζητήστε έλεγχο από τον διαχειριστή. Δεν άλλαξαν δεδομένα. Κωδικός αναφοράς: FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH.');
        reference = transmission.erganh_log_id;
    }
    reference = String(reference);
    if (!mongoose.isValidObjectId(reference)) {
        throw submittedDocumentError(
            'FINAL_WTODAILY_DOCUMENT_REFERENCE_INVALID',
            409,
            'Δεν είναι δυνατό να ανοίξει το οριστικό PDF, επειδή η συνδεδεμένη υποβολή δεν έχει έγκυρη αναφορά.'
        );
    }
    const submission = await queryLean(submissionModel.findOne({ _id: reference }));
    assertSubmissionMatchesScope(submission, scope, reference);

    if (transmission && (String(transmission.result.protocol) !== String(submission.protocol) ||
        String(transmission.result.id) !== String(submission.erganh_submission_id) ||
        String(transmission.result.submitDate) !== String(submission.submit_date_text))) {
        throw submittedDocumentError('FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH', 409,
            'Τα στοιχεία της επιτυχούς απόπειρας διαφέρουν από το αποδεικτικό υποβολής. 1. Ελέγξτε το πρωτόκολλο. 2. Ζητήστε έλεγχο από τον διαχειριστή. Δεν άλλαξαν δεδομένα. Κωδικός αναφοράς: FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH.');
    }
    const pdfSaved = hasStoredPdf(submission);
    return Object.freeze({
        found: true,
        submissionCode: 'WTODailyA',
        processDescription: 'Οργάνωση Χρόνου Εργασίας - Απολογιστικός Πίνακας Ωραρίων',
        protocol: String(submission.protocol).trim(),
        submitDate: String(submission.submit_date_text || dateKey(submission.submit_date)).trim(),
        status: 'SUCCESS',
        corrective: Boolean(transmission),
        submittedAt: submission.submit_date,
        submissionTimeliness: dateKey(submission.submit_date) <= periodControl.deadline ? 'TIMELY' : 'LATE',
        pdfReadOnly: true,
        erganhSubmissionId: String(submission.erganh_submission_id || submission.submission_id),
        erganhLogId: String(submission._id),
        pdfUrl: pdfSaved ? safePdfRoute(submission._id) : '',
        pdfFilename: buildSubmittedErganiPdfDisplayFilename(submission),
        pdfSaved,
        pdfDeferred: !pdfSaved && submission.pdf_deferred === true
    });
}

module.exports = {
    dateKey,
    hasStoredPdf,
    safePdfRoute,
    assertSubmissionMatchesScope,
    resolveFinalWtoDailySubmittedDocument
};
