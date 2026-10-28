'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const client = require('./erganiRestClient');
const { readOfficialWtoDailyPdf } = require('../../services/ergazomenoi/wtoDailyOfficialPdfReadService');
const { createReadOnlyPdfHandler } = require('../../controllers/ergazomenoi/wtoDailyFinalSubmittedDocumentController');
const mongoose = require('mongoose');
mongoose.connect = async () => { throw new Error('Real MongoDB forbidden'); };
mongoose.createConnection = () => { throw new Error('Real MongoDB forbidden'); };
const denyNetwork = async () => { throw new Error('Real network forbidden'); };
global.fetch = denyNetwork;
afterEach(() => { global.fetch = denyNetwork; });
const pdf = Buffer.from('%PDF-1.7\nsynthetic official response\n%%EOF');
const criteria = { submissionCode: 'WTODailyA', protocol: 'SYNTHETIC-Π/123', issuedDate: '27/10/2026 22:35' };
const document = { found: true, status: 'SUCCESS', protocol: criteria.protocol, submitDate: criteria.issuedDate };
const creds = { username: 'synthetic-user', password: 'synthetic-password' };

test('documented GET contract: exact protocol, yyyyMMdd, Bearer, no cookies, no redirect, Base64 and binary PDF', async () => {
    for (const issuedDate of ['27/10/2026 22:35', '2026-10-27', '2026-10-27T22:35:00+02:00', '20261027']) {
        for (const binary of [false, true]) {
            let calls = 0;
            global.fetch = async (url, options) => {
                calls++;
                const parsed = new URL(url);
                assert.equal(parsed.pathname, '/WebServicesAPI/api/Documents/WTODailyA');
                assert.equal(parsed.searchParams.get('protocol'), criteria.protocol);
                assert.equal(parsed.searchParams.get('submittedDate'), '20261027');
                assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
                assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
                assert.equal(options.headers.Cookie, undefined); assert.equal(options.body, undefined);
                return new Response(binary ? pdf : JSON.stringify(pdf.toString('base64')), {
                    headers: { 'Content-Type': binary ? 'application/pdf' : 'application/json' }
                });
            };
            const result = await client.getOfficialSubmissionDocument('synthetic-token', { ...criteria, issuedDate });
            assert.deepEqual(result.buffer, pdf); assert.equal(calls, 1);
        }
    }
});

test('HTTP errors and unexpected HTML/JSON never become official PDFs or trigger guessed endpoints', async () => {
    const cases = [
        [401, '%PDF-forbidden', 'ERGANI_PDF_AUTH_FAILED'], [403, '{}', 'ERGANI_PDF_AUTH_FAILED'],
        [404, '', 'ERGANI_PDF_NOT_FOUND'], [405, '', 'ERGANI_PDF_ENDPOINT_INCOMPATIBLE'],
        [501, '', 'ERGANI_PDF_ENDPOINT_INCOMPATIBLE'], [503, '', 'ERGANI_PDF_UNAVAILABLE'],
        [200, '<html>Login</html>', 'ERGANI_PDF_INVALID_RESPONSE'],
        [200, '{"error":"synthetic"}', 'ERGANI_PDF_INVALID_RESPONSE'],
        [200, '', 'ERGANI_PDF_NOT_FOUND'], [200, '""', 'ERGANI_PDF_NOT_FOUND'],
        [302, '', 'ERGANI_PDF_ENDPOINT_INCOMPATIBLE', 'https://untrusted.invalid/file'],
        [302, '', 'ERGANI_PDF_AUTH_FAILED', '/Login.aspx']
    ];
    for (const [status, body, code, location] of cases) {
        let calls = 0;
        global.fetch = async () => { calls++; return new Response(body, { status,
            headers: { 'Content-Type': 'application/pdf', ...(location ? { Location: location } : {}) } }); };
        await assert.rejects(client.getOfficialSubmissionDocument('synthetic-token', criteria), { code });
        assert.equal(calls, 1);
    }
});

test('invalid dates and identity fail before network access', async () => {
    for (const issuedDate of ['31/02/2026', 'invalid', '2026-13-01']) {
        await assert.rejects(client.getOfficialSubmissionDocument('synthetic-token', { ...criteria, issuedDate }), { code: 'ERGANI_PDF_DATE_INVALID' });
    }
    await assert.rejects(client.getOfficialSubmissionDocument('', criteria), { code: 'ERGANI_PDF_AUTH_FAILED' });
});

test('normal and corrective reads use only authentication, official GET and logout; no logs or mutations', async () => {
    for (const corrective of [false, true]) {
        const calls = []; const logs = []; const originalLog = console.log; const originalError = console.error;
        console.log = (...args) => logs.push(args); console.error = (...args) => logs.push(args);
        const original = JSON.stringify(document);
        global.fetch = async (url, options) => {
            const path = new URL(url).pathname; calls.push([path, options.method]);
            if (path.endsWith('/Authentication')) return Response.json({ accessToken: 'synthetic-token', refreshToken: 'synthetic-refresh' });
            if (path.endsWith('/Authentication/Logout')) return Response.json({});
            assert.equal(new URL(url).searchParams.get('protocol'), criteria.protocol);
            return Response.json(pdf.toString('base64'));
        };
        try {
            assert.deepEqual(await readOfficialWtoDailyPdf({ document: { ...document, corrective }, creds, client }), pdf);
            assert.deepEqual(calls.map(call => call[1]), ['POST', 'GET', 'POST']);
            assert.deepEqual(calls.map(call => call[0]), ['/WebServicesAPI/api/Authentication', '/WebServicesAPI/api/Documents/WTODailyA', '/WebServicesAPI/api/Authentication/Logout']);
            assert.equal(JSON.stringify(document), original); assert.deepEqual(logs, []);
        } finally { console.log = originalLog; console.error = originalError; }
    }
});

test('authentication failure is distinct and does not log upstream personal content', async () => {
    const logs = []; const original = console.error;
    console.error = (...args) => logs.push(args);
    global.fetch = async () => new Response('synthetic-user synthetic-password', { status: 401 });
    try {
        await assert.rejects(readOfficialWtoDailyPdf({ document, creds, client }), { code: 'ERGANI_PDF_AUTH_FAILED' });
        assert.deepEqual(logs, []);
    } finally { console.error = original; }
});

const query = value => ({ select() { return this; }, lean: async () => value });
const req = { session: { userId: 'synthetic' }, programmataAccessScope: { effectiveTeam: 'synthetic-team', companyId: 'synthetic-company' },
    query: { company: 'foreign-company', team: 'foreign-team', protocol: 'foreign-protocol', ypokatasthma: '0000', apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30' } };
const response = () => ({ headers: {}, statusCode: 200, set(k,v) { this.headers[k] = v; return this; },
    status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } });
test('controller uses authorized company/branch and server protocol, preserves success, streams only validated PDF', async () => {
    for (const failure of [null, 'ERGANI_PDF_AUTH_FAILED', 'ERGANI_PDF_NOT_FOUND', 'ERGANI_PDF_INVALID_RESPONSE', 'ERGANI_PDF_ENDPOINT_INCOMPATIBLE']) {
        const handler = createReadOnlyPdfHandler({
            branchModel: { findOne(filter) { assert.deepEqual(filter, { team: 'synthetic-team', companykod_object: 'synthetic-company', kodikos: '0000' }); return query({}); } },
            passwordModel: { findOne(filter) { assert.equal(filter.companykod_object, 'synthetic-company'); return query(creds); } },
            resolver: async ({scope}) => { assert.equal(scope.company_kod, 'synthetic-company'); return document; },
            readPdf: async ({document: accepted}) => { assert.equal(accepted.protocol, criteria.protocol);
                if (failure) throw Object.assign(new Error('sensitive upstream error'), { code: failure }); return pdf; }
        });
        const res = response(); await handler(req, res);
        assert.equal(res.headers['Cache-Control'], 'no-store'); assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
        if (!failure) { assert.deepEqual(res.body, pdf); assert.equal(res.headers['Content-Disposition'], 'inline; filename="WTODailyA.pdf"'); }
        else { assert.equal(res.body.status, 'SUCCESS'); assert.equal(res.body.protocol, criteria.protocol);
            assert.equal(res.body.code, failure.replace('ERGANI_', 'FINAL_WTODAILY_')); assert.doesNotMatch(res.body.message, /sensitive/); }
    }
});
test('missing session or foreign branch never accesses credentials or reads external PDF', async () => {
    let reads = 0;
    const forbidden = () => { reads++; throw new Error('Forbidden access'); };
    const handler = createReadOnlyPdfHandler({ branchModel: { findOne: () => query(null) },
        passwordModel: { findOne: forbidden }, resolver: forbidden, readPdf: forbidden });
    for (const request of [{}, req]) { const res = response(); await handler(request, res); assert.equal(res.statusCode, 403); }
    assert.equal(reads, 0);
});
