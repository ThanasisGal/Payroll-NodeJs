'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const libxml = require('libxmljs2');
const builder = require('xmlbuilder');
const { buildWtoOvertimeCanonicalDataset, buildWtoOvertimePayload,
    validateWtoOvertimeParity } = require('./wtoOvertimeSubmissionService');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');

// Field order and XSD are from the Ministry's HELP_FILES_SAMPLES_trial2.zip,
// linked by https://trialv2eservices.yeka.gr/Announcements.aspx?id=7.
const schema = libxml.parseXml(fs.readFileSync(path.join(__dirname,
    '../../utils/xmlGenerators/xsd/WTO_v1.xsd'), 'utf8'));
const originalFetch = global.fetch;
const originalEnv = Object.fromEntries(['ERGANI_ENV', 'ALLOW_ERGANI_SUBMIT']
    .map(key => [key, process.env[key]]));
const calls = [];
let mode = 'success';
const response = (status, body) => ({ ok: status >= 200 && status < 300,
    status, statusText: String(status), text: async () => JSON.stringify(body) });

global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/Authentication')) return mode === 'authentication'
        ? response(401, { message: 'Αποτυχία πιστοποίησης.' })
        : response(200, { accessToken: 'synthetic-token', refreshToken: 'synthetic-refresh' });
    if (url.endsWith('/Lookup/Submissions')) return response(200, [{ id: 233, code: 'WTOOvA' }]);
    if (url.endsWith('/Authentication/Logout')) return response(200, {});
    assert.ok(url.endsWith('/Documents/WTOOvA'), 'unexpected external route');
    assert.equal(options.method, 'POST');
    if (mode === 'rejected') return response(400, { code: 'INVALID_DATE', message: 'Μη έγκυρη ημερομηνία.' });
    if (mode === 'unknown') throw new TypeError('synthetic connection lost after sending');
    return response(200, [{ id: 'synthetic-document', protocol: 'SYNTHETIC-PROTOCOL',
        submitDate: '28/10/2026 12:00' }]);
};

(async () => {
    process.env.ERGANI_ENV = 'trial';
    process.env.ALLOW_ERGANI_SUBMIT = 'true';
    const employee = { kodikos: 'SYNTHETIC', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ',
        onoma: 'ΔΟΚΙΜΗ', karta_ergasias: true };
    for (const [from, to] of [['20:47', '20:50'], ['23:59', '00:02']]) {
        const source = { _id: 'synthetic', kodikos: employee.kodikos,
            hmeromhnia: new Date('2026-09-08T00:00:00Z'),
            ores_nominhs_yperorias_apologistika: 3 / 60,
            apo_ora_yperories: from, eos_ora_yperories: to };
        const before = JSON.stringify({ source, employee });
        const canonical = buildWtoOvertimeCanonicalDataset({ sourceRows: [source], employees: [employee] });
        assert.equal(canonical.blockers.length, 0);
        assert.equal(canonical.rows[0].submitted_overtime_minutes, 3);
        const payload = buildWtoOvertimePayload({ canonicalRows: canonical.rows, branch: '0000' });
        assert.equal(validateWtoOvertimeParity(canonical.rows, payload).exact, true);
        const outer = payload.WTOS.WTO[0], person = outer.Ergazomenoi.ErgazomenoiWTO[0];
        const analytic = person.ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0];
        assert.deepEqual(Object.keys(outer), ['f_aa_pararthmatos', 'f_rel_protocol', 'f_rel_date',
            'f_comments', 'f_from_date', 'f_to_date', 'Ergazomenoi']);
        assert.deepEqual(Object.keys(person), ['f_afm', 'f_eponymo', 'f_onoma', 'f_date', 'ErgazomenosAnalytics']);
        assert.deepEqual(analytic, { f_type: 'ΥΠ', f_from: from, f_to: to });
        assert.equal(outer.f_from_date, '08/09/2026');
        assert.equal(outer.f_to_date, '08/09/2026');
        const xml = builder.create('ns1:WTOS').att('xmlns:ns1', 'http://www.yeka.gr/WTO')
            .ele(payload.WTOS).end();
        const document = libxml.parseXml(xml);
        assert.equal(document.validate(schema), true, JSON.stringify(document.validationErrors));
        for (mode of ['success', 'rejected', 'authentication', 'unknown']) {
            calls.length = 0;
            const result = await uploadJsonDocumentToErgani({ submissionCode: 'WTOOvA', payload,
                creds: { username: 'synthetic-user', password: 'synthetic-password' } });
            const sent = calls.filter(call => call.url.endsWith('/Documents/WTOOvA'));
            assert.equal(sent.length, mode === 'authentication' ? 0 : 1, 'no automatic retry');
            if (sent.length) assert.equal(sent[0].options.body, JSON.stringify(payload));
            if (mode === 'success') assert.equal(result.success, true);
            if (mode === 'rejected') {
                assert.equal(result.httpStatus, 400);
                assert.equal(result.raw.code, 'INVALID_DATE');
                assert.equal(result.error, 'Μη έγκυρη ημερομηνία.');
                assert.equal(result.outcome, 'REJECTED');
            }
            if (mode === 'authentication') {
                assert.equal(result.httpStatus, 401);
                assert.equal(result.failureStage, 'authentication');
            }
            if (mode === 'unknown') {
                assert.equal(result.outcome, 'UNKNOWN');
                assert.equal(result.responseReceived, false);
            }
            assert.equal(JSON.stringify({ source, employee }), before);
        }
    }
    console.log('PASS WTOOvA official XSD, three minutes, midnight, exact JSON wire, 400, authentication and no retry');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
});
