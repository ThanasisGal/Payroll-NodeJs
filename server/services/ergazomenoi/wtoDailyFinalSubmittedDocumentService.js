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
    submissionModel = ErgazomenoiErganhModel
}) {
    const scope = normalizeScope(input);
    const periodControl = await periodControlResolver({ scope });
    if (!periodControl?.exists || periodControl.stored_status !== 'FINALIZED' ||
        !periodControl.submission_reference) {
        return Object.freeze({ found: false, scope });
    }

    const reference = String(periodControl.submission_reference);
    if (!mongoose.isValidObjectId(reference)) {
        throw submittedDocumentError(
            'FINAL_WTODAILY_DOCUMENT_REFERENCE_INVALID',
            409,
            'Δεν είναι δυνατό να ανοίξει το οριστικό PDF, επειδή η συνδεδεμένη υποβολή δεν έχει έγκυρη αναφορά.'
        );
    }
    const submission = await queryLean(submissionModel.findOne({ _id: reference }));
    assertSubmissionMatchesScope(submission, scope, reference);

    const pdfSaved = hasStoredPdf(submission);
    return Object.freeze({
        found: true,
        submissionCode: 'WTODailyA',
        processDescription: 'Οργάνωση Χρόνου Εργασίας - Απολογιστικός Πίνακας Ωραρίων',
        protocol: String(submission.protocol).trim(),
        submitDate: String(submission.submit_date_text || dateKey(submission.submit_date)).trim(),
        status: 'SUCCESS',
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
