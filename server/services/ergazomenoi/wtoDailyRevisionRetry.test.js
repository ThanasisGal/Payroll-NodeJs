'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { explicitRejection } = require('./wtoDailyRevisionTransmissionService');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');
const xsd = "Το αρχείο δεν είναι έγκυρο βάσει του σχετικού xsd. The element 'WTO' has invalid child element 'Ergazomenoi'. List of possible elements expected: 'f_aa_pararthmatos'.";
test('only proved submission HTTP 400 or exact legacy XSD response permits retry', () => {
    const legacy = { status: 'REJECTED', completed_at: new Date(), result: { outcome: 'REJECTED', error: xsd, raw: { message: xsd } } };
    assert.equal(explicitRejection(legacy), true);
    for (const status of ['UNKNOWN', 'PENDING', 'SENDING', 'SUCCESS']) assert.equal(explicitRejection({ ...legacy, status }), false);
    for (const result of [ { ...legacy.result, raw: null }, { ...legacy.result, raw: { message: 'different' } },
        { ...legacy.result, protocol: 'ACCEPTED' }, { ...legacy.result, id: 'accepted' },
        { ...legacy.result, http_status: 500 }, { ...legacy.result, http_status: 400, failure_stage: 'authentication', response_received: true } ]) {
        assert.equal(explicitRejection({ ...legacy, result }), false);
    }
    assert.equal(explicitRejection({ ...legacy, completed_at: null }), false);
    assert.equal(explicitRejection({ ...legacy, result: { ...legacy.result, http_status: 400, failure_stage: 'submission', response_received: true } }), true);
});
test('mock ERGANI: exact external JSON, explicit HTTP 400 metadata and no automatic retry', async () => {
    const savedFetch = global.fetch;
    const keys = ['ERGANI_ENV', 'ALLOW_ERGANI_SUBMIT', 'ALLOW_ERGANI_PRODUCTION_SUBMIT'];
    const savedEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: '0000', f_rel_protocol: '', f_rel_date: '', f_comments: '',
        f_from_date: '01/09/2026', f_to_date: '30/09/2026', Ergazomenoi: { ErgazomenoiWTO: [{
            f_afm: '123456789', f_eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', f_onoma: 'ΕΛΕΓΧΟΣ', f_date: '24/09/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }] }
        }] } }] } };
    const original = JSON.stringify(payload); let submissions = 0; const paths = [];
    try {
        process.env.ERGANI_ENV = 'trial'; process.env.ALLOW_ERGANI_SUBMIT = 'true'; delete process.env.ALLOW_ERGANI_PRODUCTION_SUBMIT;
        global.fetch = async (url, options) => {
            const path = new URL(url).pathname; paths.push(path);
            let status = 200; let body;
            if (path.endsWith('/Authentication/Logout')) body = {};
            else if (path.endsWith('/Authentication')) body = { accessToken: 'synthetic', refreshToken: 'synthetic' };
            else if (path.endsWith('/Lookup/Submissions')) body = [{ id: 207, code: 'WTODailyA', description: 'synthetic' }];
            else if (path.endsWith('/Documents/WTODailyA')) {
                submissions++; assert.equal(options.body, original); status = 400; body = { message: xsd };
            } else throw new Error('Unexpected mock route');
            return { ok: status === 200, status, statusText: status === 200 ? 'OK' : 'Bad Request', text: async () => JSON.stringify(body) };
        };
        const result = await uploadJsonDocumentToErgani({ submissionCode: 'WTODailyA', payload,
            creds: { username: 'synthetic', password: 'synthetic' }, fetchSubmittedPdf: false });
        assert.equal(result.success, false); assert.equal(result.outcome, 'REJECTED'); assert.equal(result.httpStatus, 400);
        assert.equal(result.responseReceived, true); assert.equal(result.failureStage, 'submission');
        assert.equal(result.error, xsd); assert.deepEqual(result.raw, { message: xsd });
        assert.equal(submissions, 1); assert.equal(paths.length, 4); assert.equal(JSON.stringify(payload), original);
    } finally {
        global.fetch = savedFetch;
        for (const key of keys) if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
    }
});
test('actual revision controller exposes recorded rejection instead of uncertainty', async () => {
    const fs = require('node:fs'); const vm = require('node:vm');
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const start = source.indexOf('    static submitWtoDailySubmissionRevision = ');
    const end = source.indexOf('    static submitFinalWTODayilyA', start);
    const body = source.slice(start, end).trim().replace(/^static submitWtoDailySubmissionRevision = /, '').replace(/;$/, '');
    const handler = vm.runInNewContext('(' + body + ')', {
        process: { env: {} }, activeEmploymentReviewPeriodScope: async () => ({}),
        submitApprovedRevision: async () => ({ success: false, reconciliation_required: false,
            transmission: { status: 'REJECTED', result: { error: xsd } } })
    });
    let status; let response;
    await handler({ body: {}, session: {} }, { status(value) { status = value; return this; }, json(value) { response = value; return this; } });
    assert.equal(status, 409); assert.match(response.message, /WTODAILY_REVISION_REJECTED/);
    assert.match(response.message, /f_aa_pararthmatos/); assert.match(response.message, /1\./); assert.match(response.message, /2\./);
    assert.match(response.message, /Η απόρριψη αποθηκεύτηκε/); assert.doesNotMatch(response.message, /RECONCILIATION_REQUIRED/);
});
