'use strict';

// Retrieve an already accepted document. No submission, storage or record update.
async function readOfficialWtoDailyPdf({ document, creds,
    client = require('../../utils/erganh/erganiRestClient') }) {
    let accessToken; let refreshToken;
    try {
        let auth;
        try { auth = await client.authenticateErgani(creds, { safeErrors: true }); }
        catch (error) {
            if (error.status === 401 || error.status === 403 || (error.status >= 300 && error.status < 400)) {
                throw Object.assign(new Error('ERGANI_PDF_AUTH_FAILED'), { code: 'ERGANI_PDF_AUTH_FAILED' });
            }
            throw error;
        }
        accessToken = auth?.accessToken || auth?.AccessToken || auth?.token || auth?.Token;
        refreshToken = auth?.refreshToken || auth?.RefreshToken;
        if (!accessToken) throw Object.assign(new Error('ERGANI_PDF_AUTH_FAILED'), { code: 'ERGANI_PDF_AUTH_FAILED' });
        const result = await client.getOfficialSubmissionDocument(accessToken, {
            submissionCode: 'WTODailyA', protocol: document.protocol,
            issuedDate: document.submitDate, timeoutMs: 15000
        });
        return result?.success && client.isPdfBuffer(result.buffer) ? result.buffer : null;
    } finally {
        if (accessToken && refreshToken) await client.logoutErgani(accessToken, refreshToken, { safeErrors: true }).catch(() => {});
    }
}
module.exports = { readOfficialWtoDailyPdf };
