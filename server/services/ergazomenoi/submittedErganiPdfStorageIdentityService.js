'use strict';

function safeFilenamePart(value, fallback = 'UNKNOWN') {
    const cleaned = String(value || fallback)
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 80);

    return cleaned || fallback;
}

function dateKey(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function submittedDatePart(value) {
    if (!value) return '';
    const raw = String(value).trim();
    const greekDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (greekDate) {
        const [, day, month, year, hour = '00', minute = '00'] = greekDate;
        return `${day}-${month}-${year}_${hour}_${minute}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return safeFilenamePart(raw, '');
    const pad = (number) => String(number).padStart(2, '0');
    return `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}_` +
        `${pad(parsed.getUTCHours())}_${pad(parsed.getUTCMinutes())}`;
}

function normalizedBranch(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^\d+$/.test(raw) ? raw.padStart(4, '0') : safeFilenamePart(raw, '');
}

function buildWtoDailySemanticPdfFilename(source = {}, restResult = {}) {
    const branch = normalizedBranch(source.ypokatasthma_kodikos || source.ypokatasthma);
    const periodStart = dateKey(source.employment_period_start || source.period_start);
    const periodEnd = dateKey(source.employment_period_end || source.period_end);
    const protocol = safeFilenamePart(restResult.protocol || source.protocol || 'NO_PROTOCOL', 'NO_PROTOCOL');
    const submitDate = submittedDatePart(
        restResult.submitDate || source.submit_date_text || source.submit_date
    );

    return [
        'WTODailyA',
        branch || 'NO_BRANCH',
        periodStart || 'NO_PERIOD_START',
        periodEnd || 'NO_PERIOD_END',
        protocol,
        submitDate || 'NO_SUBMIT_DATE'
    ].map((part) => safeFilenamePart(part, 'MISSING')).join('_') + '.pdf';
}

function buildSubmittedErganiPdfStorageIdentity({
    submissionCode,
    submission = {},
    ergazomenos = {},
    restResult = {}
} = {}) {
    if (String(submissionCode || submission.submission_code || '').trim() === 'WTODailyA') {
        return Object.freeze({
            filename: buildWtoDailySemanticPdfFilename(submission, restResult),
            team: safeFilenamePart(submission.team || ergazomenos.team || 'NO_TEAM', 'NO_TEAM')
        });
    }

    const employeeId = safeFilenamePart(ergazomenos._id || ergazomenos.kodikos || 'E7N');
    const eponymo = safeFilenamePart(ergazomenos.eponymo || 'UNKNOWN');
    const onoma = safeFilenamePart(ergazomenos.onoma || 'UNKNOWN');
    const protocol = safeFilenamePart(restResult.protocol || 'NO_PROTOCOL');
    const datePart = safeFilenamePart(String(restResult.submitDate || '').replace(/\//g, '-'));

    return Object.freeze({
        filename: `${employeeId}_${eponymo}_${onoma}_${protocol}_${datePart}.pdf`,
        team: safeFilenamePart(ergazomenos.team || 'NO_TEAM')
    });
}

function buildSubmittedErganiPdfDisplayFilename(submission = {}) {
    if (String(submission.submission_code || '').trim() !== 'WTODailyA') {
        return String(submission.pdf_filename || '').trim();
    }

    const hasCompletePeriodIdentity = Boolean(
        normalizedBranch(submission.ypokatasthma_kodikos || submission.ypokatasthma) &&
        dateKey(submission.employment_period_start || submission.period_start) &&
        dateKey(submission.employment_period_end || submission.period_end) &&
        String(submission.protocol || '').trim() &&
        submittedDatePart(submission.submit_date_text || submission.submit_date)
    );
    if (!hasCompletePeriodIdentity) return String(submission.pdf_filename || '').trim();

    return buildWtoDailySemanticPdfFilename(submission, {
        protocol: submission.protocol,
        submitDate: submission.submit_date_text || submission.submit_date
    });
}

module.exports = {
    safeFilenamePart,
    dateKey,
    submittedDatePart,
    buildWtoDailySemanticPdfFilename,
    buildSubmittedErganiPdfStorageIdentity,
    buildSubmittedErganiPdfDisplayFilename
};
