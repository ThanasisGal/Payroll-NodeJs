'use strict';

const { randomUUID } = require('node:crypto');

const DOWNLOAD_PATH = '/ergazomenoi/programmata/downloadSchedule';
const STAGES = new Set([
    'request', 'authorization', 'company-authorization', 'date-validation',
    'branch-validation', 'branch-authorization', 'credentials', 'period',
    'file-preparation', 'browser-launch', 'browser-context', 'login-page',
    'login-submit', 'work-time-menu', 'digital-work-time-menu', 'search-navigation',
    'branch-selection', 'branch-selector', 'branch-options', 'search-dates',
    'search-submit', 'excel-export', 'excel-response', 'browser-close',
    'authenticated-search-state', 'branch-selector-ready', 'branch-selector-count',
    'branch-option-check', 'branch-pre-selection-check',
    'local-save', 'processing', 'archive', 'completed', 'unknown'
]);
const CODES = new Set([
    'SCHEDULE_OK', 'SCHEDULE_INVALID_REQUEST', 'SCHEDULE_AUTH_REQUIRED',
    'SCHEDULE_FORBIDDEN', 'SCHEDULE_CSRF_REJECTED', 'SCHEDULE_RESOURCE_UNAVAILABLE',
    'SCHEDULE_CONFLICT', 'SCHEDULE_ACCESS_CHECK_FAILED', 'SCHEDULE_DATES_INVALID',
    'SCHEDULE_BRANCH_INVALID', 'SCHEDULE_CREDENTIALS_MISSING',
    'SCHEDULE_PERIOD_FAILED', 'SCHEDULE_FILE_PREPARATION_FAILED',
    'SCHEDULE_DOWNLOAD_FAILED', 'SCHEDULE_LOCAL_SAVE_FAILED',
    'SCHEDULE_PROCESSING_FAILED', 'SCHEDULE_ARCHIVE_FAILED', 'SCHEDULE_INTERNAL_ERROR',
    'SCHEDULE_BROWSER_FAILED', 'SCHEDULE_SEARCH_FAILED', 'SCHEDULE_EXPORT_FAILED',
    'SCHEDULE_RESPONSE_UNCONFIRMED', 'SCHEDULE_CONNECTION_CLOSED',
    'EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED', 'EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING',
    'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT', 'EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE',
    'ERGANI_LOGIN_OR_NAVIGATION_FAILED', 'ERGANI_BRANCH_SELECTOR_MISSING',
    'ERGANI_BRANCH_OPTION_MISSING', 'ERGANI_BRANCH_SELECTION_FAILED'
]);
const STATUS_CODES = {
    400: 'SCHEDULE_INVALID_REQUEST', 401: 'SCHEDULE_AUTH_REQUIRED',
    403: 'SCHEDULE_FORBIDDEN', 404: 'SCHEDULE_RESOURCE_UNAVAILABLE',
    409: 'SCHEDULE_CONFLICT', 413: 'SCHEDULE_INVALID_REQUEST', 500: 'SCHEDULE_INTERNAL_ERROR'
};
const STAGE_CODES = {
    credentials: 'SCHEDULE_INTERNAL_ERROR', period: 'SCHEDULE_PERIOD_FAILED',
    'file-preparation': 'SCHEDULE_FILE_PREPARATION_FAILED',
    'local-save': 'SCHEDULE_LOCAL_SAVE_FAILED', processing: 'SCHEDULE_PROCESSING_FAILED',
    archive: 'SCHEDULE_ARCHIVE_FAILED',
    'browser-launch': 'SCHEDULE_BROWSER_FAILED', 'browser-context': 'SCHEDULE_BROWSER_FAILED',
    'browser-close': 'SCHEDULE_BROWSER_FAILED', 'search-dates': 'SCHEDULE_SEARCH_FAILED',
    'search-submit': 'SCHEDULE_SEARCH_FAILED', 'excel-export': 'SCHEDULE_EXPORT_FAILED',
    'excel-response': 'SCHEDULE_EXPORT_FAILED'
};

function setScheduleDownloadStage(req, stage) {
    if (req.scheduleDownloadDiagnostics) {
        req.scheduleDownloadDiagnostics.stage = STAGES.has(stage) ? stage : 'unknown';
    }
}

function recordScheduleDownload(req, status, code, level = 'error') {
    const context = req.scheduleDownloadDiagnostics;
    if (!context) return;
    // Never forward Error objects, request/session data, paths, URLs or ERGANI payloads.
    const details = {
        correlationId: context.correlationId,
        stage: STAGES.has(context.stage) ? context.stage : 'unknown',
        httpStatus: status,
        errorCode: CODES.has(code) ? code : 'SCHEDULE_INTERNAL_ERROR',
        storageState: context.storageState
    };
    if (['Error', 'TypeError', 'RangeError', 'TimeoutError'].includes(context.failureName)) {
        details.failureName = context.failureName;
    }
    if (['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EIO', 'ECONNRESET', 'ETIMEDOUT'].includes(context.systemCode)) {
        details.systemCode = context.systemCode;
    }
    try {
        const logger = context.logger || require('../logger');
        logger[level]('[ERGANH-SCHEDULE-DOWNLOAD]', details);
    } catch (_loggingError) {
        // A logging failure must not alter the download or its HTTP response.
    }
}

function createScheduleDownloadDiagnosticsMiddleware({ logger } = {}) {
    return function beginScheduleDownloadDiagnostics(req, res, next) {
        const matchesPath = String(req.path || '').replace(/\/$/, '').toLowerCase() === DOWNLOAD_PATH.toLowerCase();
        if (req.method !== 'POST' || !matchesPath || req.scheduleDownloadDiagnostics) {
            return next();
        }
        const context = { correlationId: randomUUID(), stage: 'request',
            storageState: 'not_started', code: null, logger };
        req.scheduleDownloadDiagnostics = context;
        res.setHeader('X-Correlation-ID', context.correlationId);
        let finished = false;
        res.once('finish', () => {
            finished = true;
            const status = res.statusCode;
            const code = context.code || STATUS_CODES[status] || 'SCHEDULE_RESPONSE_UNCONFIRMED';
            recordScheduleDownload(req, status, code, status >= 400 || code !== 'SCHEDULE_OK' ? 'error' : 'info');
        });
        res.once('close', () => {
            if (!finished) recordScheduleDownload(req, null, 'SCHEDULE_CONNECTION_CLOSED');
        });
        return next();
    };
}

function scheduleDownloadFailureCode(req, error) {
    const context = req.scheduleDownloadDiagnostics;
    if (context) {
        context.failureName = context.failureName || error?.name;
        context.systemCode = error?.code;
    }
    if (CODES.has(error?.code) && /^(ERGANI_|EMPLOYEE_WORK_WRITE_)/.test(error.code)) return error.code;
    return STAGE_CODES[req.scheduleDownloadDiagnostics?.stage] || 'SCHEDULE_DOWNLOAD_FAILED';
}

function sendScheduleDownloadFailure(req, res, status, code) {
    const context = req.scheduleDownloadDiagnostics;
    const safeStatus = Object.hasOwn(STATUS_CODES, status) ? status : 500;
    const safeCode = CODES.has(code) && code !== 'SCHEDULE_OK'
        ? code : STATUS_CODES[safeStatus];
    context.code = safeCode;
    const storageMessage = context.storageState === 'not_started'
        ? 'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την προσπάθεια.'
        : context.storageState === 'completed' ? 'Η αποθήκευση των ωραρίων έχει ολοκληρωθεί.'
        : 'Δεν μπορεί να επιβεβαιωθεί η πλήρης αποθήκευση. Ενδέχεται να έχουν γίνει αλλαγές.';
    const reason = safeStatus === 400 || safeStatus === 413 ? 'Τα στοιχεία της αίτησης δεν έγιναν δεκτά.'
        : safeStatus === 401 ? 'Δεν επιβεβαιώθηκε ενεργή σύνδεση χρήστη.'
        : safeStatus === 403 ? 'Ο έλεγχος ασφάλειας ή δικαιωμάτων δεν επέτρεψε τη λήψη.'
        : safeStatus === 404 ? 'Δεν βρέθηκε διαθέσιμη επιλογή ή απαραίτητη ρύθμιση για τη λήψη.'
        : safeStatus === 409 ? 'Δεν επιβεβαιώθηκαν οι προϋποθέσεις για ασφαλή συνέχιση.'
        : 'Δεν ολοκληρώθηκε ένα στάδιο επεξεργασίας της αίτησης.';
    return res.status(safeStatus).json({
        success: false,
        error: { code: safeCode, correlationId: context.correlationId,
            stage: context.stage, storageState: context.storageState },
        message: `Η λήψη των προδηλωμένων ωραρίων σταμάτησε. ${reason} ` +
            `1. Ελέγξτε τη συνεδρία, τα δικαιώματα και τις επιλογές της φόρμας. ` +
            `2. Ζητήστε από την υποστήριξη έλεγχο με τον κωδικό αναφοράς πριν επαναλάβετε τη λήψη. ` +
            `${storageMessage} Κωδικός αναφοράς: ${safeCode} / ${context.correlationId}`
    });
}

function scheduleDownloadAccessFailure(req, res, status) {
    const stage = req.scheduleDownloadDiagnostics.stage;
    const code = status === 400 && stage === 'date-validation' ? 'SCHEDULE_DATES_INVALID'
        : status === 400 && stage === 'branch-validation' ? 'SCHEDULE_BRANCH_INVALID'
        : status === 500 ? 'SCHEDULE_ACCESS_CHECK_FAILED' : STATUS_CODES[status];
    return sendScheduleDownloadFailure(req, res, status, code);
}

function scheduleDownloadRequestError(error, req, res, next) {
    if (!req.scheduleDownloadDiagnostics) return next(error);
    const status = error?.type === 'entity.parse.failed' ? 400
        : error?.type === 'entity.too.large' ? 413 : 500;
    return sendScheduleDownloadFailure(req, res, status, STATUS_CODES[status]);
}

module.exports = {
    beginScheduleDownloadDiagnostics: createScheduleDownloadDiagnosticsMiddleware(),
    createScheduleDownloadDiagnosticsMiddleware, setScheduleDownloadStage,
    recordScheduleDownload, scheduleDownloadFailureCode, sendScheduleDownloadFailure,
    scheduleDownloadAccessFailure, scheduleDownloadRequestError
};
