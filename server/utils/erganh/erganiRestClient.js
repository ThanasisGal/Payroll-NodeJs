'use strict';

const BASE_URLS = {
    trial: 'https://trialv2eservices.yeka.gr/WebServicesAPI/api',
    production: 'https://eservices.yeka.gr/WebServicesAPI/api'
};

const UI_BASE_URLS = {
    trial: 'https://trialv2eservices.yeka.gr/WebServicesAPIui',
    production: 'https://eservices.yeka.gr/WebServicesAPIui'
};

function getErganiEnv() {
    return String(process.env.ERGANI_ENV || 'trial')
        .trim()
        .toLowerCase();
}

function getBaseUrl() {
    const env = getErganiEnv();
    return BASE_URLS[env] || BASE_URLS.trial;
}

function getUiBaseUrl() {
    const env = getErganiEnv();
    return UI_BASE_URLS[env] || UI_BASE_URLS.trial;
}

function isErganiPdfDebugEnabled() {
    return String(process.env.ERGANI_PDF_DEBUG_LOGS || '').toLowerCase() === 'true';
}

function debugLogDirect(event, payload) {
    if (!isErganiPdfDebugEnabled()) return;
    console.log(`[ERGANI PDF DIRECT] ${event}`, payload);
}

function safeJsonParse(text) {
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

function onlyDate(value) {
    return (
        String(value || '')
            .trim()
            .split(/\s+/)[0] || ''
    );
}

function formatDateDdMmYyyy(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return [
        String(d.getDate()).padStart(2, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        d.getFullYear()
    ].join('/');
}

function formatDateDdMmYyyyHhMm(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return `${formatDateDdMmYyyy(d)} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
    ).padStart(2, '0')}`;
}

function buildSubmittedDateCandidates(submittedDate) {
    const candidates = [];
    const add = (value) => {
        const normalized = String(value || '').trim();
        if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    };

    if (submittedDate instanceof Date) {
        add(formatDateDdMmYyyy(submittedDate));
        add(formatDateDdMmYyyyHhMm(submittedDate));
        return candidates;
    }

    const raw = String(submittedDate || '').trim();
    add(onlyDate(raw));
    add(raw);

    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(raw)) {
        add(`${raw}:00`);
    }

    return candidates;
}

function makeErganiTimeoutError(timeoutMs, method, url) {
    const err = new Error(`ERGANI request timeout after ${timeoutMs}ms: ${method || 'GET'} ${url}`);
    err.code = 'ERGANI_TIMEOUT';
    return err;
}

function getPositiveTimeoutMs(value) {
    const timeoutMs = Number(value);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : null;
}

function getRemainingTimeoutMs(deadlineAt) {
    if (!deadlineAt) return null;
    return Math.max(0, deadlineAt - Date.now());
}

function assertNotTimedOut(deadlineAt, timeoutMs, method, url) {
    if (deadlineAt && getRemainingTimeoutMs(deadlineAt) <= 0) {
        throw makeErganiTimeoutError(timeoutMs, method, url);
    }
}

async function fetchRawWithOptionalTimeout(url, options = {}) {
    const { timeoutMs: rawTimeoutMs, signal: externalSignal, ...fetchOptions } = options;
    const timeoutMs = getPositiveTimeoutMs(rawTimeoutMs);
    const method = fetchOptions.method || 'GET';

    if (!timeoutMs) {
        const res = await fetch(url, {
            ...fetchOptions,
            ...(externalSignal ? { signal: externalSignal } : {})
        });
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || '';
        const text = buffer.toString('utf8');
        const json = safeJsonParse(text);

        return {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            contentType,
            buffer,
            text,
            json,
            url
        };
    }

    const controller = new AbortController();
    let timedOut = false;

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    const onAbort = () => controller.abort();
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    try {
        const res = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || '';
        const text = buffer.toString('utf8');
        const json = safeJsonParse(text);

        return {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            contentType,
            buffer,
            text,
            json,
            url
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw makeErganiTimeoutError(timeoutMs, method, url);
        }

        if (timedOut) {
            throw makeErganiTimeoutError(timeoutMs, method, url);
        }

        throw error;
    } finally {
        clearTimeout(timeout);
        if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
}

async function erganiFetch(path, options = {}) {
    const url = `${getBaseUrl()}${path}`;
    const timeoutMs = Number(process.env.ERGANI_FETCH_TIMEOUT_MS || 60000);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        console.log('[ERGANI-FETCH] →', options.method || 'GET', url);

        const res = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        console.log('[ERGANI-FETCH] ←', res.status, res.statusText, url);

        const text = await res.text();

        const json = safeJsonParse(text);
        const data = json !== null ? json : text;

        if (!res.ok) {
            const message =
                data?.message ||
                data?.Message ||
                data?.error ||
                data?.Error ||
                text ||
                `HTTP ${res.status}`;

            const err = new Error(message);
            err.status = res.status;
            err.rawText = text;
            err.rawJson = json;
            throw err;
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw makeErganiTimeoutError(timeoutMs, options.method || 'GET', url);
        }

        console.error('[ERGANI-FETCH] ❌', error.message || error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function erganiRawFetch(path, options = {}) {
    const url = `${getBaseUrl()}${path}`;
    const raw = await fetchRawWithOptionalTimeout(url, options);

    if (!raw.ok) {
        const message =
            raw.json?.message ||
            raw.json?.Message ||
            raw.json?.error ||
            raw.json?.Error ||
            raw.text ||
            `HTTP ${raw.status}`;
        const err = new Error(message);
        err.status = raw.status;
        err.contentType = raw.contentType;
        err.rawText = raw.text;
        err.rawJson = raw.json;
        throw err;
    }

    return raw;
}

async function erganiUiRawFetch(path, options = {}) {
    const url = `${getUiBaseUrl()}${path}`;
    const raw = await fetchRawWithOptionalTimeout(url, options);

    if (!raw.ok) {
        const message =
            raw.json?.message ||
            raw.json?.Message ||
            raw.json?.error ||
            raw.json?.Error ||
            raw.text ||
            `HTTP ${raw.status}`;
        const err = new Error(message);
        err.status = raw.status;
        err.contentType = raw.contentType;
        err.rawText = raw.text;
        err.rawJson = raw.json;
        throw err;
    }

    return raw;
}

async function authenticateErgani(creds = {}) {
    console.log({
        Username: creds.username ? '********' : '',
        Password: creds.password ? '********' : '',
        Usertype: creds.userType || creds.usertype || '01'
    });

    return erganiFetch('/Authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            Username: creds.username,
            Password: creds.password,
            Usertype: creds.userType || creds.usertype || '01'
        })
    });
}

async function logoutErgani(accessToken, refreshToken) {
    if (!refreshToken) return null;

    return erganiFetch('/Authentication/Logout', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(refreshToken)
    });
}

async function getSubmissions(accessToken) {
    return erganiFetch('/Lookup/Submissions', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
}

async function getDocumentSchema(accessToken, code) {
    return erganiFetch(`/Documents/${code}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
}

async function submitDocument(accessToken, code, payload) {
    // console.log('========================================');
    // console.log('FINAL JSON PAYLOAD TO ERGANI');
    // console.log('========================================');
    // console.log('Submission Code:', code);
    // console.log(JSON.stringify(payload, null, 2));
    // console.log('========================================');

    return erganiFetch(`/Documents/${code}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

function isPdfBuffer(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString() === '%PDF-'
    );
}

function base64ToPdfBuffer(value) {
    if (typeof value !== 'string') return null;
    let s = value.trim();
    if (!s) return null;

    const dataUriPrefix = 'data:application/pdf;base64,';
    if (s.toLowerCase().startsWith(dataUriPrefix)) {
        s = s.slice(dataUriPrefix.length);
    }

    if (!s.startsWith('JVBERi0')) return null;

    try {
        const buffer = Buffer.from(s, 'base64');
        return isPdfBuffer(buffer) ? buffer : null;
    } catch {
        return null;
    }
}

function findPdfBufferInsideJson(value, depth = 0) {
    if (value === null || value === undefined || depth > 10) return null;

    if (typeof value === 'string') return base64ToPdfBuffer(value);
    if (Buffer.isBuffer(value)) return isPdfBuffer(value) ? value : null;

    if (Array.isArray(value)) {
        if (value.length > 5 && value.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) {
            const buffer = Buffer.from(value);
            if (isPdfBuffer(buffer)) return buffer;
        }

        for (const item of value) {
            const found = findPdfBufferInsideJson(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    if (typeof value === 'object') {
        const preferredKeys = [
            'pdf',
            'Pdf',
            'PDF',
            'file',
            'File',
            'document',
            'Document',
            'content',
            'Content',
            'fileContent',
            'FileContent',
            'fileContents',
            'FileContents',
            'base64',
            'Base64',
            'data',
            'Data',
            'result',
            'Result'
        ];

        for (const key of preferredKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findPdfBufferInsideJson(value[key], depth + 1);
                if (found) return found;
            }
        }

        for (const item of Object.values(value)) {
            const found = findPdfBufferInsideJson(item, depth + 1);
            if (found) return found;
        }
    }

    return null;
}

function getJsonKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.keys(value).slice(0, 20);
}

function buildSubmittedDocumentUiPath({ submissionCode, protocol, issuedDate }) {
    const submittedDate = String(issuedDate || '').trim();

    if (!submittedDate) {
        throw new Error('Λείπει submittedDate για λήψη PDF από GetSubmittedDocument.');
    }

    return (
        `/Home/GetSubmittedDocument/${encodeURIComponent(submissionCode)}` +
        `?protocol=${encodeURIComponent(protocol)}` +
        `&submittedDate=${encodeURIComponent(submittedDate)}`
    );
}

function buildSubmissionDocumentBodies({ submissionCode, protocol, issuedDate }) {
    const issuedDateOnly = onlyDate(issuedDate);

    return [
        { SubmissionCode: submissionCode, Protocol: protocol, IssuedDate: issuedDateOnly },
        { submissionCode, protocol, issuedDate: issuedDateOnly },
        { SubmissionCode: submissionCode, Protocol: protocol, IssuedDate: issuedDate },
        { submissionCode, protocol, issuedDate },
        { Code: submissionCode, Protocol: protocol, IssuedDate: issuedDateOnly },
        { code: submissionCode, protocol, issuedDate: issuedDateOnly }
    ];
}

function buildLegacySubmissionDocumentPaths(submissionCode) {
    return [
        '/SubmissionDocument',
        '/SubmissionDocument/Get',
        '/SubmissionDocument/Pdf',
        '/SubmissionDocument/Download',
        '/Documents/SubmissionDocument',
        `/Documents/${submissionCode}/SubmissionDocument`
    ];
}

async function fetchSubmissionDocumentFromUiEndpoint(
    accessToken,
    { submissionCode, protocol, issuedDate, timeoutMs, signal }
) {
    const path = buildSubmittedDocumentUiPath({ submissionCode, protocol, issuedDate });
    const url = `${getUiBaseUrl()}${path}`;

    const raw = await fetchRawWithOptionalTimeout(url, {
        method: 'GET',
        timeoutMs,
        signal,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/pdf'
        }
    });

    if (raw.json || /application\/json/i.test(raw.contentType || '')) {
        const jsonKeys = getJsonKeys(raw.json);
        debugLogDirect('json-response-detected', {
            submittedDateCandidate: issuedDate,
            status: raw.status,
            contentType: raw.contentType || null,
            jsonKeys
        });

        const pdfFromJsonResponse = findPdfBufferInsideJson(raw.json);
        if (pdfFromJsonResponse) {
            debugLogDirect('candidate-json-pdf', {
                submittedDateCandidate: issuedDate,
                status: raw.status,
                contentType: raw.contentType || null,
                jsonKeys,
                bytes: pdfFromJsonResponse.length
            });

            return {
                success: true,
                buffer: pdfFromJsonResponse,
                contentType: 'application/pdf',
                sizeBytes: pdfFromJsonResponse.length,
                rawContentType: raw.contentType,
                source: {
                    path,
                    url: raw.url,
                    mode: 'ui-get-json-fileContents'
                },
                rawJson: raw.json
            };
        }
    }

    if (isPdfBuffer(raw.buffer)) {
        return {
            success: true,
            buffer: raw.buffer,
            contentType: 'application/pdf',
            sizeBytes: raw.buffer.length,
            rawContentType: raw.contentType,
            source: {
                path,
                url: raw.url,
                mode: 'ui-get-binary'
            }
        };
    }

    const err = new Error(`${path}: δεν βρέθηκε PDF. contentType=${raw.contentType || 'unknown'}`);
    err.status = raw.status;
    err.contentType = raw.contentType;
    if (isErganiPdfDebugEnabled()) {
        err.bodySnippet = String(raw.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    }
    throw err;
}

async function fetchSubmissionDocumentFromLegacyEndpoints(
    accessToken,
    { submissionCode, protocol, issuedDate, timeoutMs, deadlineAt, signal }
) {
    const paths = buildLegacySubmissionDocumentPaths(submissionCode);
    const bodies = buildSubmissionDocumentBodies({ submissionCode, protocol, issuedDate });
    const errors = [];

    for (const path of paths) {
        for (const body of bodies) {
            assertNotTimedOut(deadlineAt, timeoutMs, 'POST', `${getBaseUrl()}${path}`);

            try {
                const remainingTimeoutMs = getRemainingTimeoutMs(deadlineAt) || timeoutMs;

                const raw = await erganiRawFetch(path, {
                    method: 'POST',
                    timeoutMs: remainingTimeoutMs,
                    signal,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/pdf, application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (isPdfBuffer(raw.buffer)) {
                    return {
                        success: true,
                        buffer: raw.buffer,
                        contentType: 'application/pdf',
                        sizeBytes: raw.buffer.length,
                        rawContentType: raw.contentType,
                        source: { path, mode: 'legacy-post-binary' }
                    };
                }

                const pdfFromJson = findPdfBufferInsideJson(raw.json);
                if (pdfFromJson) {
                    return {
                        success: true,
                        buffer: pdfFromJson,
                        contentType: 'application/pdf',
                        sizeBytes: pdfFromJson.length,
                        rawContentType: raw.contentType,
                        source: { path, mode: 'legacy-post-json-base64' },
                        rawJson: raw.json
                    };
                }

                errors.push(
                    `${path}: δεν βρέθηκε PDF. contentType=${raw.contentType || 'unknown'}`
                );
            } catch (err) {
                if (err?.code === 'ERGANI_TIMEOUT') throw err;
                errors.push(`${path}: ${err.message}`);
            }
        }
    }

    return {
        success: false,
        buffer: null,
        contentType: null,
        sizeBytes: 0,
        error: errors.slice(0, 8).join(' | ')
    };
}

/**
 * Κατεβάζει το PDF της οριστικής υποβολής.
 *
 * Το πραγματικό endpoint που επιβεβαιώθηκε από το UI/Network είναι:
 * GET /WebServicesAPIui/Home/GetSubmittedDocument/{SubmissionCode}
 *     ?protocol=...
 *     &submittedDate=dd/MM/yyyy
 */
async function getSubmissionDocument(
    accessToken,
    { submissionCode, protocol, issuedDate, timeoutMs }
) {
    if (!accessToken) throw new Error('Λείπει accessToken για λήψη Submission Document.');
    if (!submissionCode) throw new Error('Λείπει submissionCode για λήψη Submission Document.');
    if (!protocol) throw new Error('Λείπει protocol για λήψη Submission Document.');
    if (!issuedDate) throw new Error('Λείπει issuedDate για λήψη Submission Document.');

    const errors = [];
    const totalTimeoutMs = getPositiveTimeoutMs(timeoutMs);
    const deadlineAt = totalTimeoutMs ? Date.now() + totalTimeoutMs : null;
    const controller = totalTimeoutMs ? new AbortController() : null;
    const timeout = totalTimeoutMs
        ? setTimeout(() => {
              controller.abort();
          }, totalTimeoutMs)
        : null;

    try {
        const submittedDateCandidates = buildSubmittedDateCandidates(issuedDate);
        debugLogDirect('submitted-date-candidates', submittedDateCandidates);

        for (const submittedDateCandidate of submittedDateCandidates) {
            assertNotTimedOut(
                deadlineAt,
                totalTimeoutMs,
                'GET',
                `${getUiBaseUrl()}/Home/GetSubmittedDocument`
            );

            try {
                const result = await fetchSubmissionDocumentFromUiEndpoint(accessToken, {
                    submissionCode,
                    protocol,
                    issuedDate: submittedDateCandidate,
                    timeoutMs: getRemainingTimeoutMs(deadlineAt) || totalTimeoutMs,
                    signal: controller?.signal
                });

                debugLogDirect('candidate-result', {
                    submittedDateCandidate,
                    success: true,
                    status: null,
                    contentType: result.rawContentType || result.contentType || null,
                    isPdfBuffer: isPdfBuffer(result.buffer),
                    error: null
                });

                return result;
            } catch (err) {
                if (err?.code === 'ERGANI_TIMEOUT') throw err;

                debugLogDirect('candidate-result', {
                    submittedDateCandidate,
                    success: false,
                    status: err.status || null,
                    contentType: err.contentType || null,
                    isPdfBuffer: false,
                    error: err.message || String(err)
                });

                errors.push(
                    `${submittedDateCandidate}: ${err.message || String(err)}${
                        err.bodySnippet ? ` body=${err.bodySnippet}` : ''
                    }`
                );
            }
        }

        assertNotTimedOut(deadlineAt, totalTimeoutMs, 'GET', `${getUiBaseUrl()}/Home/GetSubmittedDocument`);

        const legacyResult = await fetchSubmissionDocumentFromLegacyEndpoints(accessToken, {
            submissionCode,
            protocol,
            issuedDate,
            timeoutMs: totalTimeoutMs,
            deadlineAt,
            signal: controller?.signal
        });

        if (legacyResult?.success) {
            return legacyResult;
        }

        if (legacyResult?.error) {
            errors.push(legacyResult.error);
        }

        return {
            success: false,
            buffer: null,
            contentType: null,
            sizeBytes: 0,
            error:
                'Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF Submission Document. ' +
                errors.slice(0, 10).join(' | ')
        };
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

async function erganiFetchUi(path, options = {}) {
    const url = `${getUiBaseUrl()}${path}`;
    const res = await fetch(url, options);
    const text = await res.text();
    const json = safeJsonParse(text);
    const data = json !== null ? json : text;

    if (!res.ok) {
        const message =
            data?.message ||
            data?.Message ||
            data?.error ||
            data?.Error ||
            text ||
            `HTTP ${res.status}`;

        const err = new Error(message);
        err.status = res.status;
        err.rawJson = json;
        err.rawText = text;
        throw err;
    }

    return data;
}

async function cancelSubmittedDocument(accessToken, { submissionCode, protocol, submittedDate }) {
    if (!accessToken) throw new Error('Λείπει accessToken για ακύρωση υποβολής.');
    if (!submissionCode) throw new Error('Λείπει submissionCode για ακύρωση υποβολής.');
    if (!protocol) throw new Error('Λείπει protocol για ακύρωση υποβολής.');
    if (!submittedDate) throw new Error('Λείπει submittedDate για ακύρωση υποβολής.');

    const submittedDateOnly = String(submittedDate).trim().split(/\s+/)[0];

    return erganiFetchUi('/Home/CancelSubmittedDocument', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            TypeOfDocument: submissionCode,
            Protocol: protocol,
            SubmittedDate: submittedDateOnly
        })
    });
}

module.exports = {
    authenticateErgani,
    logoutErgani,
    getSubmissions,
    getDocumentSchema,
    submitDocument,
    getSubmissionDocument,
    cancelSubmittedDocument,
    isPdfBuffer
};
