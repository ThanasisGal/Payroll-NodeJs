'use strict';

const {
    authenticateErgani,
    logoutErgani,
    getSubmissions,
    submitDocument,
    getSubmissionDocument
} = require('./erganiRestClient');

const {
    downloadSubmittedErganiPdfWithPlaywright,
    isPdfBuffer
} = require('./erganiSubmittedPdfDownloader');

function getErganiEnv() {
    return String(process.env.ERGANI_ENV || 'trial')
        .trim()
        .toLowerCase();
}

function assertRestSubmitAllowed() {
    const env = getErganiEnv();
    const allowSubmit = String(process.env.ALLOW_ERGANI_SUBMIT || '').toLowerCase() === 'true';
    const allowProduction =
        String(process.env.ALLOW_ERGANI_PRODUCTION_SUBMIT || '').toLowerCase() === 'true';

    if (!allowSubmit) {
        throw new Error('Blocked: Βάλε ALLOW_ERGANI_SUBMIT=true για να επιτραπεί REST submit.');
    }

    if (env === 'production' && !allowProduction) {
        throw new Error(
            'Blocked: Για production REST submit χρειάζεται και ALLOW_ERGANI_PRODUCTION_SUBMIT=true.'
        );
    }

    // if (env === 'production' && process.env.NODE_ENV !== 'production') {
    //     throw new Error(
    //         'Blocked: Production ERGANI submit επιτρέπεται μόνο όταν NODE_ENV=production.'
    //     );
    // }
}

function normalizeSubmissionList(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.result)) return value.result;
    if (Array.isArray(value?.submissions)) return value.submissions;
    return [];
}

function normalizeSubmissionId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

async function resolveSubmissionByCode(accessToken, submissionCode) {
    const submissionsRaw = await getSubmissions(accessToken);
    const submissions = normalizeSubmissionList(submissionsRaw);

    const found = submissions.find((x) => {
        return (
            String(x?.code || '')
                .trim()
                .toLowerCase() ===
            String(submissionCode || '')
                .trim()
                .toLowerCase()
        );
    });

    if (!found) {
        throw new Error(`Δεν βρέθηκε submission code ${submissionCode} στο Submissions List.`);
    }

    return {
        id: found.id,
        code: found.code,
        description: found.description || ''
    };
}

function normalizeSubmitResponse(raw, submission) {
    const first = Array.isArray(raw) ? raw[0] : raw;

    const protocol =
        first?.protocol ||
        first?.Protocol ||
        first?.protocolNumber ||
        first?.ProtocolNumber ||
        first?.arithmosProtokollou ||
        first?.arithmos_protokollou ||
        null;

    const submitDate =
        first?.submitDate ||
        first?.SubmitDate ||
        first?.issuedDate ||
        first?.IssuedDate ||
        first?.date ||
        first?.Date ||
        null;

    const id =
        first?.id ||
        first?.Id ||
        first?.submissionId ||
        first?.SubmissionId ||
        first?.documentId ||
        first?.DocumentId ||
        null;

    return {
        success: !!protocol || !!id,
        submission,
        protocol,
        submitDate,
        id: normalizeSubmissionId(id) || null,
        error: null,
        raw
    };
}

function normalizeErrorResult(error, submission = null) {
    return {
        success: false,
        submission,
        protocol: null,
        submitDate: null,
        id: null,
        error: error?.message || String(error),
        raw: error?.rawJson || null
    };
}

function getPdfFetchTimeoutMs() {
    const timeoutMs = Number(process.env.ERGANI_REST_PDF_FETCH_TIMEOUT_MS || 8000);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
}

function nowMs() {
    return Date.now();
}

function logTiming(label, startedAt, extra = '') {
    const suffix = extra ? ` ${extra}` : '';
    console.log(`[ERGANI REST TIMING] ${label}: ${Date.now() - startedAt} ms${suffix}`);
}

function isPlaywrightPdfFallbackEnabled() {
    return String(process.env.ERGANI_REST_PDF_PLAYWRIGHT_FALLBACK || '').toLowerCase() === 'true';
}

function makeDeferredPdfResult(error, source) {
    return {
        buffer: null,
        contentType: null,
        sizeBytes: 0,
        error: error?.message || String(error),
        pdfDeferred: true,
        source
    };
}

function isTimeoutError(err) {
    return err?.code === 'ERGANI_TIMEOUT' || /timeout/i.test(String(err?.message || err));
}

async function fetchSubmittedPdfIfRequested({
    shouldFetch,
    submissionCode,
    restResult,
    creds,
    accessToken
}) {
    if (!shouldFetch || !restResult?.success) return null;

    const timeoutMs = getPdfFetchTimeoutMs();
    const directStartedAt = nowMs();

    try {
        const documentResult = await getSubmissionDocument(accessToken, {
            submissionCode,
            protocol: restResult.protocol,
            issuedDate: restResult.submitDate,
            timeoutMs
        });

        if (documentResult?.success && documentResult?.buffer) {
            if (!isPdfBuffer(documentResult.buffer)) {
                logTiming('fetchSubmittedPdf.direct', directStartedAt, '/ invalid-pdf');
                return makeDeferredPdfResult(
                    new Error('Το Submission Document δεν είναι έγκυρο PDF binary.'),
                    'direct-invalid-pdf'
                );
            }

            logTiming('fetchSubmittedPdf.direct', directStartedAt);

            return {
                buffer: documentResult.buffer,
                contentType: 'application/pdf',
                sizeBytes: documentResult.buffer.length,
                error: null,
                rawContentType: documentResult.rawContentType || null,
                url: documentResult?.source?.url || null,
                source: documentResult?.source?.mode || 'direct-getsubmitteddocument',
                pdfDeferred: false
            };
        }

        logTiming('fetchSubmittedPdf.direct', directStartedAt, '/ failed');

        if (!isPlaywrightPdfFallbackEnabled()) {
            return makeDeferredPdfResult(
                new Error(documentResult?.error || 'Δεν επιστράφηκε PDF από το ΕΡΓΑΝΗ.'),
                'direct-failed'
            );
        }
    } catch (err) {
        const timedOut = isTimeoutError(err);
        logTiming('fetchSubmittedPdf.direct', directStartedAt, timedOut ? '/ timeout' : '/ failed');

        if (!isPlaywrightPdfFallbackEnabled()) {
            return makeDeferredPdfResult(err, timedOut ? 'direct-timeout' : 'direct-failed');
        }
    }

    const playwrightStartedAt = nowMs();

    try {
        console.log('[ERGANI REST] Submitted PDF Playwright fallback enabled by env flag.');
        const documentResult = await downloadSubmittedErganiPdfWithPlaywright({
            creds,
            submissionCode,
            protocol: restResult.protocol,
            submittedDate: restResult.submitDate,
            headless: process.env.ERGANI_PDF_HEADLESS !== 'false',
            timeoutMs
        });

        if (!documentResult?.success || !documentResult?.buffer) {
            return {
                buffer: null,
                contentType: null,
                sizeBytes: 0,
                error: documentResult?.error || 'Δεν επιστράφηκε PDF από το ΕΡΓΑΝΗ.',
                rawContentType: documentResult?.rawContentType || null,
                url: documentResult?.url || null,
                pdfDeferred: true,
                source: 'playwright-failed'
            };
        }

        if (!isPdfBuffer(documentResult.buffer)) {
            return {
                buffer: null,
                contentType: null,
                sizeBytes: 0,
                error: 'Το Submission Document δεν είναι έγκυρο PDF binary.',
                rawContentType: documentResult.rawContentType || null,
                url: documentResult?.url || null,
                pdfDeferred: true,
                source: 'playwright-invalid-pdf'
            };
        }

        logTiming('fetchSubmittedPdf.playwright', playwrightStartedAt);
        console.log('[ERGANI REST] Submitted PDF fetched with Playwright', {
            bytes: documentResult.buffer.length,
            contentType: 'application/pdf',
            rawContentType: documentResult.rawContentType || null,
            url: documentResult.url || null
        });

        return {
            buffer: documentResult.buffer,
            contentType: 'application/pdf',
            sizeBytes: documentResult.buffer.length,
            error: null,
            rawContentType: documentResult.rawContentType || null,
            url: documentResult.url || null,
            source: 'playwright-ui-getsubmitteddocument',
            pdfDeferred: false
        };
    } catch (err) {
        const timedOut = isTimeoutError(err);
        logTiming(
            'fetchSubmittedPdf.playwright',
            playwrightStartedAt,
            timedOut ? '/ timeout' : '/ failed'
        );
        return makeDeferredPdfResult(err, timedOut ? 'playwright-timeout' : 'playwright-failed');
    }
}

async function uploadJsonDocumentToErgani({
    submissionCode,
    payload,
    creds,
    fetchSubmittedPdf = false
}) {
    assertRestSubmitAllowed();

    let accessToken = null;
    let refreshToken = null;
    const totalStartedAt = nowMs();

    try {
        if (!submissionCode) throw new Error('Λείπει submissionCode για REST submit.');
        if (!payload || typeof payload !== 'object') {
            throw new Error('Λείπει ή είναι άκυρο το JSON payload για REST submit.');
        }
        if (!creds?.username || !creds?.password) {
            throw new Error('Λείπουν credentials ΕΡΓΑΝΗ για REST submit.');
        }

        const authStartedAt = nowMs();
        const auth = await authenticateErgani(creds);
        logTiming('authenticate', authStartedAt);
        accessToken = auth?.accessToken || auth?.AccessToken || auth?.token || auth?.Token;
        refreshToken = auth?.refreshToken || auth?.RefreshToken || null;

        if (!accessToken) throw new Error('Το ΕΡΓΑΝΗ δεν επέστρεψε accessToken.');

        const resolveStartedAt = nowMs();
        const submission = await resolveSubmissionByCode(accessToken, submissionCode);
        logTiming('resolveSubmission', resolveStartedAt);

        console.log('========================================');
        console.log('READY TO SUBMIT JSON DOCUMENT TO ERGANI');
        console.log('========================================');
        console.log('ERGANI_ENV:', getErganiEnv());
        console.log('Submission ID:', submission.id);
        console.log('Submission Code:', submission.code);
        console.log('Submission Description:', submission.description);
        console.log('Payload root:', Object.keys(payload || {}));

        const submitStartedAt = nowMs();
        const rawSubmitResult = await submitDocument(accessToken, submission.code, payload);
        logTiming('submitDocument', submitStartedAt);
        const restResult = normalizeSubmitResponse(rawSubmitResult, submission);

        restResult.submittedPdf = await fetchSubmittedPdfIfRequested({
            shouldFetch: fetchSubmittedPdf,
            submissionCode: submission.code,
            restResult,
            creds,
            accessToken
        });

        if (restResult.submittedPdf) {
            console.log('[ERGANI REST] Submitted PDF result', {
                fetched: !!restResult.submittedPdf.buffer,
                bytes: restResult.submittedPdf.sizeBytes || 0,
                pdfDeferred: restResult.submittedPdf.pdfDeferred === true,
                source: restResult.submittedPdf.source || null,
                error: restResult.submittedPdf.error || null
            });
        }

        return restResult;
    } catch (err) {
        return normalizeErrorResult(err);
    } finally {
        logTiming('total', totalStartedAt);
        if (accessToken && refreshToken) {
            try {
                await logoutErgani(accessToken, refreshToken);
            } catch (err) {
                console.warn('⚠️ Logout failed:', err.message || String(err));
            }
        }
    }
}

module.exports = {
    uploadJsonDocumentToErgani,
    resolveSubmissionByCode,
    assertRestSubmitAllowed
};
