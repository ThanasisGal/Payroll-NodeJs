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

        console.log('[ERGANI-FETCH] response text first 1000 chars:', text.slice(0, 1000));

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
            throw new Error(
                `ERGANI request timeout after ${timeoutMs}ms: ${options.method || 'GET'} ${url}`
            );
        }

        console.error('[ERGANI-FETCH] ❌', error.message || error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function erganiRawFetch(path, options = {}) {
    const url = `${getBaseUrl()}${path}`;
    const res = await fetch(url, options);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || '';
    const text = buffer.toString('utf8');
    const json = safeJsonParse(text);

    if (!res.ok) {
        const message =
            json?.message ||
            json?.Message ||
            json?.error ||
            json?.Error ||
            text ||
            `HTTP ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.contentType = contentType;
        err.rawText = text;
        err.rawJson = json;
        throw err;
    }

    return { ok: res.ok, status: res.status, contentType, buffer, text, json };
}

async function erganiUiRawFetch(path, options = {}) {
    const url = `${getUiBaseUrl()}${path}`;
    const res = await fetch(url, options);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || '';
    const text = buffer.toString('utf8');
    const json = safeJsonParse(text);

    if (!res.ok) {
        const message =
            json?.message ||
            json?.Message ||
            json?.error ||
            json?.Error ||
            text ||
            `HTTP ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.contentType = contentType;
        err.rawText = text;
        err.rawJson = json;
        throw err;
    }

    return { ok: res.ok, status: res.status, contentType, buffer, text, json, url };
}

async function authenticateErgani(creds = {}) {
    console.log({
        Username: creds.username,
        Password: '********',
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

function buildSubmittedDocumentUiPath({ submissionCode, protocol, issuedDate }) {
    const submittedDate = onlyDate(issuedDate);

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
    { submissionCode, protocol, issuedDate }
) {
    const path = buildSubmittedDocumentUiPath({ submissionCode, protocol, issuedDate });

    const raw = await erganiUiRawFetch(path, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/pdf'
        }
    });

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

    const pdfFromJson = findPdfBufferInsideJson(raw.json);
    if (pdfFromJson) {
        return {
            success: true,
            buffer: pdfFromJson,
            contentType: 'application/pdf',
            sizeBytes: pdfFromJson.length,
            rawContentType: raw.contentType,
            source: {
                path,
                url: raw.url,
                mode: 'ui-get-json-base64'
            },
            rawJson: raw.json
        };
    }

    throw new Error(`${path}: δεν βρέθηκε PDF. contentType=${raw.contentType || 'unknown'}`);
}

async function fetchSubmissionDocumentFromLegacyEndpoints(
    accessToken,
    { submissionCode, protocol, issuedDate }
) {
    const paths = buildLegacySubmissionDocumentPaths(submissionCode);
    const bodies = buildSubmissionDocumentBodies({ submissionCode, protocol, issuedDate });
    const errors = [];

    for (const path of paths) {
        for (const body of bodies) {
            try {
                const raw = await erganiRawFetch(path, {
                    method: 'POST',
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
async function getSubmissionDocument(accessToken, { submissionCode, protocol, issuedDate }) {
    if (!accessToken) throw new Error('Λείπει accessToken για λήψη Submission Document.');
    if (!submissionCode) throw new Error('Λείπει submissionCode για λήψη Submission Document.');
    if (!protocol) throw new Error('Λείπει protocol για λήψη Submission Document.');
    if (!issuedDate) throw new Error('Λείπει issuedDate για λήψη Submission Document.');

    const errors = [];

    try {
        return await fetchSubmissionDocumentFromUiEndpoint(accessToken, {
            submissionCode,
            protocol,
            issuedDate
        });
    } catch (err) {
        errors.push(err.message || String(err));
    }

    const legacyResult = await fetchSubmissionDocumentFromLegacyEndpoints(accessToken, {
        submissionCode,
        protocol,
        issuedDate
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
