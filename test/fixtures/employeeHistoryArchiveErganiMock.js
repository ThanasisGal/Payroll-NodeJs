'use strict';
// Execute the production uploader with a closed require whitelist, no fetch,
// no sockets, no real credentials and an isolated process.env object.
const fs = require('node:fs');
const vm = require('node:vm');
function mockArchiveErgani() {
    const calls = [];
    const client = {
        async authenticateErgani() { calls.push('authenticate'); return { accessToken: 'synthetic-token', refreshToken: 'synthetic-refresh' }; },
        async logoutErgani() { calls.push('logout'); },
        async getSubmissions() { calls.push('lookup'); return [{ id: 217, code: 'MA', description: 'Synthetic MA' }]; },
        async submitDocument(token, code, payload) { calls.push({ code, payload }); return { protocol: 'SYNTHETIC-ARCHIVE-1', submitDate: '2026-11-25' }; }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../../server/utils/erganh/jsonDocumentUploader'), 'utf8'), {
        module, process: { env: { ERGANI_ENV: 'trial', ALLOW_ERGANI_SUBMIT: 'true' } }, Date,
        console: { log() {}, warn() {} }, require(name) {
            if (name === './erganiRestClient') return client;
            if (name === './erganiSubmittedPdfDownloader') return {};
            if (name.endsWith('/accountingIntervalValidationService')) return require('../../server/services/ergazomenoi/accountingIntervalValidationService');
            throw Error('Unexpected dependency in isolated ERGANI mock: ' + name);
        }
    });
    return { calls, upload: module.exports.uploadJsonDocumentToErgani };
}
module.exports = { mockArchiveErgani };
