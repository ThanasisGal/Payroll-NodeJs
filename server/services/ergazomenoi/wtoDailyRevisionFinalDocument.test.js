'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { resolveFinalWtoDailySubmittedDocument: resolve } = require('./wtoDailyFinalSubmittedDocumentService');
const { readOfficialWtoDailyPdf } = require('./wtoDailyOfficialPdfReadService');
const { createReadOnlyPdfHandler } = require('../../controllers/ergazomenoi/wtoDailyFinalSubmittedDocumentController');
global.fetch = async () => { throw new Error('Real external requests forbidden'); };
require('mongoose').connect = async () => { throw new Error('Real database forbidden'); };
const query = data => ({ lean: async () => structuredClone(data), select() { return this; } });
const scope = { team: 'synthetic', company_kod: '507f1f77bcf86cd799439012', ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30' };
const log = { _id: '507f1f77bcf86cd799439011', team: scope.team, companykod_object: scope.company_kod,
    ypokatasthma_kodikos: scope.ypokatasthma, employment_period_start: scope.period_start, employment_period_end: scope.period_end,
    submission_code: 'WTODailyA', submission_status: 'SUCCESS', is_final: true, document_status: 'ACTIVE', submission_id: 207,
    erganh_submission_id: 'synthetic-id', protocol: 'SYNTHETIC-PROTOCOL', submit_date: new Date('2026-10-27'), submit_date_text: '27/10/2026', pdf_deferred: true };
const attempt = { ...scope, _id: 'a'.repeat(64), revision_id: 'b'.repeat(64), status: 'SUCCESS', completed_at: new Date(),
    erganh_log_id: log._id, result: { outcome: 'SUCCESS', protocol: log.protocol, id: log.erganh_submission_id, submitDate: log.submit_date_text } };
const revision = { ...scope, _id: attempt.revision_id, baseline_snapshot_id: '507f1f77bcf86cd799439013', payload: { preserved: true } };
function fixture({ submission = log, transmission = attempt, savedRevision = revision } = {}) {
    const original = JSON.stringify({ submission, transmission, savedRevision });
    const options = { scope, periodControlResolver: async () => ({ exists: true, stored_status: 'FINALIZED', deadline: '2026-10-31',
        frozen_snapshot_id: revision.baseline_snapshot_id }),
        transmissionModel: { find(filter) { assert.equal(filter.status, 'SUCCESS'); assert.equal(filter.team, scope.team);
            assert.equal(filter.company_kod, scope.company_kod); assert.equal(filter.ypokatasthma, scope.ypokatasthma);
            assert.equal(filter.period_start.toISOString().slice(0, 10), scope.period_start); return query(transmission ? [transmission] : []); } },
        revisionModel: { findOne(filter) { assert.equal(filter._id, attempt.revision_id); assert.equal(filter.baseline_snapshot_id, revision.baseline_snapshot_id); return query(savedRevision); } },
        submissionModel: { findOne(filter) { assert.equal(filter._id, log._id); return query(submission); } } };
    return { options, unchanged: () => assert.equal(JSON.stringify({ submission, transmission, savedRevision }), original) };
}
test('successful correction resolves its own official stored PDF, protocol and immutable baseline', async () => {
    const f = fixture({ submission: { ...log, pdf_s3_key: 'synthetic/official.pdf' } }); const result = await resolve(f.options);
    assert.equal(result.found, true); assert.equal(result.corrective, true); assert.equal(result.protocol, log.protocol);
    assert.equal(result.pdfSaved, true); assert.equal(result.pdfUrl, '/ergazomenoi/ergazomenoi/ergani/pdf/' + log._id); f.unchanged();
});
test('successful correction without PDF keeps success and protocol; read-only retrieval is separate', async () => {
    const f = fixture(); const result = await resolve(f.options);
    assert.equal(result.status, 'SUCCESS'); assert.equal(result.pdfSaved, false); assert.equal(result.pdfUrl, '');
    assert.equal(result.pdfReadOnly, true); assert.equal(result.protocol, log.protocol); f.unchanged();
});
test('unsent periods stay unsent; failed/unknown attempts never qualify as success', async () => {
    assert.equal((await resolve(fixture({ transmission: null }).options)).found, false);
    for (const status of ['REJECTED', 'UNKNOWN', 'SENDING']) await assert.rejects(resolve(fixture({ transmission: { ...attempt, status } }).options));
});
test('company, team, branch, period, log identity and exact protocol must all match', async () => {
    for (const patch of [{ companykod_object: 'other' }, { team: 'other' }, { ypokatasthma_kodikos: '0001' },
        { employment_period_end: '2026-10-31' }, { protocol: 'OTHER-PROTOCOL' }, { erganh_submission_id: 'other-id' }, { submission_status: 'FAILED' }]) {
        await assert.rejects(resolve(fixture({ submission: { ...log, ...patch } }).options), { code: 'FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH' });
    }
    await assert.rejects(resolve(fixture({ savedRevision: null }).options), { code: 'FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH' });
});
test('official retrieval calls only authentication, document read and logout; rejects non-PDF bytes', async () => {
    for (const valid of [true, false]) {
        const calls = []; const buffer = Buffer.from(valid ? '%PDF-synthetic-official-bytes' : '<html>Unavailable</html>');
        const client = { authenticateErgani: async () => { calls.push('auth'); return { accessToken: 'synthetic', refreshToken: 'synthetic' }; },
            getSubmissionDocument: async (_token, criteria) => { calls.push('read'); assert.equal(criteria.protocol, log.protocol);
                assert.equal(criteria.submissionCode, 'WTODailyA'); assert.equal(criteria.issuedDate, log.submit_date_text); return { success: true, buffer }; },
            isPdfBuffer: value => value.subarray(0, 5).toString() === '%PDF-', logoutErgani: async () => { calls.push('logout'); } };
        assert.equal(await readOfficialWtoDailyPdf({ document: { protocol: log.protocol, submitDate: log.submit_date_text }, creds: {}, client }), valid ? buffer : null);
        assert.deepEqual(calls, ['auth', 'read', 'logout']);
    }
});
function response() { return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, set(k,v) { this.headers[k] = v; return this; }, send(body) { this.body = body; return this; } }; }
test('read-only PDF handler requires authorization, preserves unavailable success and streams official bytes', async () => {
    let reads = 0; let available = false;
    const handler = createReadOnlyPdfHandler({ resolver: async () => ({ found: true, status: 'SUCCESS', protocol: log.protocol }),
        branchModel: { findOne: () => query({ _id: 'synthetic' }) }, passwordModel: { findOne: () => query({ username: 'synthetic', password: 'synthetic' }) },
        readPdf: async () => { reads++; return available ? Buffer.from('%PDF-official') : null; } });
    const denied = response(); await handler({}, denied); assert.equal(denied.statusCode, 403); assert.equal(reads, 0);
    const req = { session: { userId: 'synthetic' }, programmataAccessScope: { effectiveTeam: scope.team, companyId: scope.company_kod },
        query: { ypokatasthma: '0000', apo_hmeromhnia: scope.period_start, eos_hmeromhnia: scope.period_end } };
    const missing = response(); await handler(req, missing); assert.equal(missing.body.status, 'SUCCESS');
    assert.equal(missing.body.protocol, log.protocol); assert.match(missing.body.message, /Δεν άλλαξαν δεδομένα/);
    available = true; const pdf = response(); await handler(req, pdf); assert.equal(pdf.headers['Content-Type'], 'application/pdf');
    assert.equal(pdf.body.toString(), '%PDF-official');
});
test('actual normal submission handler blocks accepted correction before credentials, snapshot, writes or sender', async () => {
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const start = source.indexOf('    static submitFinalWTODayilyA = '), end = source.indexOf('    static linkEmploymentReviewPeriodSubmission', start);
    const body = source.slice(start, end).trim().replace(/^static submitFinalWTODayilyA = /, '').replace(/;$/, '');
    let sends = 0;
    const handler = vm.runInNewContext('(' + body + ')', { activeEmploymentReviewPeriodScope: async () => scope,
        assertWtoDailySubmissionIndexesReady: async () => {}, getPeriodControl: async () => ({ stored_status: 'FINALIZED' }),
        getPeriodLifecycleIndexState: async () => ({ ready: true }), resolveFinalWtoDailySubmittedDocument: async () => ({ found: true, protocol: log.protocol }),
        uploadJsonDocumentToErgani: async () => { sends++; throw new Error('Forbidden'); }, console: { error() {} } });
    const res = response(); await handler({ body: { reason: 'synthetic', request_id: 'synthetic' } }, res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'WTODAILY_PERIOD_ALREADY_SUBMITTED'); assert.equal(sends, 0);
});
test('actual corrective submit function returns recorded success without preflight, send or writes', async () => {
    const source = fs.readFileSync(require.resolve('./wtoDailyRevisionTransmissionService'), 'utf8');
    const start = source.indexOf('async function submitApprovedRevision(options)'), end = source.indexOf('async function assertPreviousAttemptResolved', start);
    const existing = { _id: 'a'.repeat(64), status: 'SUCCESS', result: { protocol: log.protocol } };
    const saved = { _id: 'b'.repeat(64), preview_fingerprint: 'c'.repeat(64) };
    const original = JSON.stringify(saved); let writes = 0;
    const handler = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', {
        authorize: () => scope, storage: () => ({ transmission: { collection: { indexes: async () => [{ name: '_id_', key: { _id: 1 } }] } } }),
        readApproved: async () => ({ revision: saved }), attemptsFor: async () => [existing], latestAttempt: () => existing
    });
    const forbidden = async () => { writes++; throw new Error('Unexpected write or submission'); };
    const result = await handler({ releaseEnabled: true, command: { revision_id: saved._id,
        expected_preview_fingerprint: saved.preview_fingerprint, request_id: 'another-synthetic-request', approve_submission: true,
        previous_attempt_not_accepted: true, reviewed_entire_payload: true, boundary_reviewed: true, previous_attempt_evidence: 'synthetic' },
        transactionRunner: work => work(null), preflight: forbidden, send: forbidden, recordSuccess: forbidden });
    assert.equal(result.idempotent, true); assert.equal(result.transmission.result.protocol, log.protocol);
    assert.equal(writes, 0); assert.equal(JSON.stringify(saved), original);
});
