'use strict';

// Retrieve an already accepted document. No submission, storage or record update.
async function readOfficialWtoDailyPdf({ document, creds,
    client = require('../../utils/erganh/erganiRestClient') }) {
    let accessToken; let refreshToken;
    try {
        const auth = await client.authenticateErgani(creds);
        accessToken = auth?.accessToken || auth?.AccessToken || auth?.token || auth?.Token;
        refreshToken = auth?.refreshToken || auth?.RefreshToken;
        if (!accessToken) return null;
        const result = await client.getSubmissionDocument(accessToken, {
            submissionCode: 'WTODailyA', protocol: document.protocol,
            issuedDate: document.submitDate, timeoutMs: 15000
        });
        return result?.success && client.isPdfBuffer(result.buffer) ? result.buffer : null;
    } finally {
        if (accessToken && refreshToken) await client.logoutErgani(accessToken, refreshToken).catch(() => {});
    }
}
module.exports = { readOfficialWtoDailyPdf };
