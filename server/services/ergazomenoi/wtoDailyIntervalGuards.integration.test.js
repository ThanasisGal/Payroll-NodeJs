'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { resolveZeroLengthCardResolution, persistZeroLengthCardResolutionWrite } = require('./apasxoliseisZeroLengthCardResolutionService');
const { prepareFinalWtoDailyInput } = require('./wtoDailyDeferredBoundaryIntegrationService');
const { buildWTODayilyAPayload } = require('./wtoDailySubmissionProjectionService');

// No live configuration is loaded. Even an accidental request fails locally.
global.fetch = async () => { throw new Error('Network forbidden in synthetic interval tests'); };
const row = (overrides = {}) => ({ _id: 'synthetic-row', kodikos: '001', ypokatasthma: '0000',
    hmeromhnia: '2026-09-27', apologistiko_biblio: true, is_locked: true,
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    apo_ora_01_apologistika: '18:28', eos_ora_01_apologistika: '00:28',
    apo_ora_02_apologistika: '18:28', eos_ora_02_apologistika: '00:30', ...overrides });
const snapshot = dailyRow => ({ snapshot_schema_version: 'employment-period-frozen:v3',
    scope: { ypokatasthma: '0000' }, daily_results: [dailyRow],
    employees: [{ kodikos: '001', afm: '123456789', eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ',
        afora_daneismo_ergazomenoy: false }],
    canonical_decisions: [{ id: 'keep-approval' }], applied_repo_transfers: [] });
const prepare = frozenSnapshot => prepareFinalWtoDailyInput({ frozenSnapshot,
    deferredWeeks: [], decisions: [], branch: '0000', periodStart: '2026-09-01', periodEnd: '2026-09-30' });
const payload = (intervals = [['18:28', '00:28'], ['18:28', '00:30']]) => ({ WTOS: { WTO: [{
    Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: '123456789', f_date: '27/09/2026',
        ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: intervals.map(([from, to]) => ({
            f_type: 'ΕΡΓ', f_from: from, f_to: to })) } }] } }] } });

function isolatedModule(relativePath, mocks = {}) {
    const filename = require.resolve(relativePath); const module = { exports: {} };
    const localRequire = createRequire(filename);
    const context = { module, exports: module.exports,
        require: name => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name),
        process: { env: { ERGANI_ENV: 'production', ALLOW_ERGANI_SUBMIT: 'true', ALLOW_ERGANI_PRODUCTION_SUBMIT: 'true' } },
        console: { log() {}, error() {}, warn() {} }, Buffer, AbortController, setTimeout, clearTimeout,
        fetch: mocks.fetch || global.fetch };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return module.exports;
}

test('zero-length approval validates retained pair 2 before any persistence', () => {
    const original = row({ is_locked: false, apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
        cards_apo_ora_01: '00:30', cards_eos_ora_01: '00:30',
        cards_apo_ora_02: '18:28', cards_eos_ora_02: '00:30' });
    const before = JSON.stringify(original);
    assert.throws(() => resolveZeroLengthCardResolution({ row: original, actor: 'synthetic-HR',
        command: { approve: true, transmission_failure_confirmed: true,
            intervals: [{ pairNumber: 1, start: '18:28', end: '00:28' }] } }),
    { code: 'ACCOUNTING_INTERVALS_OVERLAP' });
    assert.equal(JSON.stringify(original), before);
});

test('explicit approval and transmission confirmation remain mandatory', () => {
    const original = row({ cards_apo_ora_01: '00:30', cards_eos_ora_01: '00:30' });
    assert.throws(() => resolveZeroLengthCardResolution({ row: original, command: {} }),
        { code: 'ZERO_LENGTH_EXPLICIT_APPROVAL_REQUIRED' });
    assert.throws(() => resolveZeroLengthCardResolution({ row: original, command: { approve: true } }),
        { code: 'ZERO_LENGTH_TRANSMISSION_FAILURE_CONFIRMATION_REQUIRED' });
});

test('persistence entry independently rejects overlap before row or audit writes', async () => {
    const original = row({ is_locked: false, apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' });
    const before = JSON.stringify(original); let writes = 0;
    await assert.rejects(persistZeroLengthCardResolutionWrite({ oldRecord: original,
        semanticUpdates: { apo_ora_01_apologistika: '18:28', eos_ora_01_apologistika: '00:28' },
        changedBy: 'synthetic-HR', schemaPaths: Object.keys(original), session: {},
        rowModel: { updateOne: async () => { writes += 1; return { matchedCount: 1 }; } },
        auditModel: { create: async () => { writes += 1; } } }), { code: 'ACCOUNTING_INTERVALS_OVERLAP' });
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(original), before);
});

test('frozen final projection rejects overlap without reading current History or mutating snapshot', () => {
    const frozen = snapshot(row()); const before = JSON.stringify(frozen);
    const input = prepare(frozen);
    assert.throws(() => buildWTODayilyAPayload(input.projection), { code: 'ACCOUNTING_INTERVALS_OVERLAP' });
    assert.equal(JSON.stringify(frozen), before);
});

test('touching 25/09 and synthetic corrected draft preserve exact payload facts and baseline', () => {
    const frozen = snapshot(row({ hmeromhnia: '2026-09-25', apo_ora_01_apologistika: '18:00',
        eos_ora_01_apologistika: '18:29', apo_ora_02_apologistika: '18:29', eos_ora_02_apologistika: '22:00' }));
    const before = JSON.stringify(frozen);
    const result = buildWTODayilyAPayload(prepare(frozen).projection);
    assert.deepEqual(result.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].ErgazomenosAnalytics.ErgazomenosWTOAnalytics,
        [{ f_type: 'ΕΡΓ', f_from: '18:00', f_to: '18:29' }, { f_type: 'ΕΡΓ', f_from: '18:29', f_to: '22:00' }]);
    assert.equal(JSON.stringify(frozen), before);
    const invalidBaseline = snapshot(row()); const baselineBefore = JSON.stringify(invalidBaseline);
    const draft = structuredClone(invalidBaseline);
    // Hypothesis for inspection only, never a correction to the original.
    draft.daily_results[0].apo_ora_02_apologistika = '';
    draft.daily_results[0].eos_ora_02_apologistika = '';
    const preview = { submittable: false, payload: buildWTODayilyAPayload(prepare(draft).projection) };
    assert.equal(preview.submittable, false);
    assert.equal(preview.payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].ErgazomenosAnalytics.ErgazomenosWTOAnalytics.length, 1);
    assert.equal(JSON.stringify(invalidBaseline), baselineBefore);
});

test('uploader rejects before authentication, schema resolution, document/PDF calls or logout', async () => {
    let calls = 0;
    const forbidden = async () => { calls += 1; throw new Error('External call forbidden'); };
    const uploader = isolatedModule('../../utils/erganh/jsonDocumentUploader', {
        './erganiRestClient': { authenticateErgani: forbidden, logoutErgani: forbidden,
            getSubmissions: forbidden, submitDocument: forbidden, getSubmissionDocument: forbidden },
        './erganiSubmittedPdfDownloader': { downloadSubmittedErganiPdfWithPlaywright: forbidden, isPdfBuffer: () => false }
    });
    for (const invalidPayload of [payload(), payload([['00:30', '00:30']]), payload([['08:00', '']])]) {
        await assert.rejects(uploader.uploadJsonDocumentToErgani({ submissionCode: 'WTODailyA',
            payload: invalidPayload, creds: { username: 'synthetic', password: 'synthetic' } }));
    }
    assert.equal(calls, 0);
});

test('direct REST document entry also rejects overlapping work with zero fetch calls', async () => {
    let requests = 0;
    const client = isolatedModule('../../utils/erganh/erganiRestClient', {
        fetch: async () => { requests += 1; throw new Error('External call forbidden'); }
    });
    await assert.rejects(client.submitDocument('synthetic-token', 'WTODailyA', payload()),
        { code: 'ACCOUNTING_INTERVALS_OVERLAP' });
    assert.equal(requests, 0);
});

test('valid touching payload passes unchanged through fully mocked uploader', async () => {
    const sent = []; const calls = [];
    const original = payload([['18:00', '18:29'], ['18:29', '22:00']]);
    const before = JSON.stringify(original);
    const uploader = isolatedModule('../../utils/erganh/jsonDocumentUploader', {
        './erganiRestClient': {
            authenticateErgani: async () => { calls.push('authenticate'); return { accessToken: 'synthetic', refreshToken: 'synthetic-refresh' }; },
            getSubmissions: async () => { calls.push('resolve'); return [{ id: 91, code: 'WTODailyA' }]; },
            submitDocument: async (_token, _code, document) => { calls.push('submit-mock'); sent.push(document);
                return { protocol: 'SYNTHETIC-ONLY', id: 'synthetic-document', submitDate: '27/10/2026' }; },
            logoutErgani: async () => { calls.push('logout'); },
            getSubmissionDocument: async () => { throw new Error('Unexpected PDF request'); }
        },
        './erganiSubmittedPdfDownloader': { downloadSubmittedErganiPdfWithPlaywright: async () => {
            throw new Error('Unexpected browser request'); }, isPdfBuffer: () => false }
    });
    const result = await uploader.uploadJsonDocumentToErgani({ submissionCode: 'WTODailyA', payload: original,
        creds: { username: 'synthetic', password: 'synthetic' } });
    assert.equal(result.success, true);
    assert.deepEqual(calls, ['authenticate', 'resolve', 'submit-mock', 'logout']);
    assert.equal(sent[0], original);
    assert.equal(JSON.stringify(original), before);
});

test('actual final controller rejects frozen overlap before credentials, upload or writes', async () => {
    const filename = require.resolve('../../controllers/ergazomenoi/erganhController');
    const source = fs.readFileSync(filename, 'utf8');
    const start = source.indexOf('static submitFinalWTODayilyA =');
    const method = source.slice(start, source.indexOf('static linkEmploymentReviewPeriodSubmission', start));
    const expression = method.slice(method.indexOf('=') + 1).trim().replace(/;$/, '');
    const frozen = snapshot(row()); const before = JSON.stringify(frozen);
    let forbiddenCalls = 0;
    const forbidden = () => { forbiddenCalls += 1; throw new Error('Unexpected current data, persistence or external access'); };
    const scope = { team: 'synthetic', company_kod: 'synthetic-company', ypokatasthma: '0000',
        period_start: '2026-09-01', period_end: '2026-09-30' };
    let storedStatus = 'FINALIZED';
    const dependencies = {
        resolveFinalWtoDailySubmittedDocument: async () => ({ found: false }),
        WtoDailySubmissionRevisionModel: { exists: async () => null },
        activeEmploymentReviewPeriodScope: async () => scope,
        assertWtoDailySubmissionIndexesReady: async () => {},
        getPeriodControl: async () => ({ stored_status: storedStatus, past_deadline: false,
            frozen_snapshot_id: 'synthetic-snapshot', frozen_snapshot_fingerprint: 'synthetic-fingerprint' }),
        getPeriodLifecycleIndexState: async () => ({ ready: true }),
        ApasxoliseisPeriodFrozenSnapshotModel: { findOne: () => ({ lean: async () => ({ frozen_snapshot: frozen }) }) },
        assertWtoDailyFrozenSnapshotVersion: require('./wtoDailyRestIdentityService').assertWtoDailyFrozenSnapshotVersion,
        loadWtoDailyDeferredBoundaryContext: async () => ({ deferredWeeks: [], decisions: [] }),
        prepareFinalWtoDailyInput, buildWTODayilyAPayload,
        buildWtoDailyPayloadFingerprint: forbidden, uploadJsonDocumentToErgani: forbidden,
        CompaniesModel: { findOne: forbidden }, PasswordsModel: { findOne: forbidden },
        ErgazomenoiErganhModel: { findOne: forbidden, create: forbidden },
        linkEmploymentPeriodSubmission: forbidden, console: { error() {} }
    };
    const handler = Function(...Object.keys(dependencies), `return (${expression});`)(...Object.values(dependencies));
    const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } });
    const req = { body: { reason: 'Συνθετικός έλεγχος', request_id: 'synthetic-request', ypokatasthma: '0000' }, session: {} };
    const res = response(); await handler(req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ACCOUNTING_INTERVALS_OVERLAP');
    assert.equal(forbiddenCalls, 0);
    assert.equal(JSON.stringify(frozen), before);
    storedStatus = 'LOCKED';
    const locked = response(); await handler(req, locked);
    assert.equal(locked.body.code, 'WTODAILY_PERIOD_NOT_FINALIZED');
    const forged = response(); await handler({ ...req, body: { ...req.body, payload: {} } }, forged);
    assert.equal(forged.body.code, 'FORGED_WTODAILY_PAYLOAD');
    const revision = response(); await handler({ ...req, body: { ...req.body, revision_id: 'synthetic-revision' } }, revision);
    assert.equal(revision.body.code, 'WTODAILY_REVISION_SUBMISSION_DISABLED');
    assert.equal(forbiddenCalls, 0);
});

test('final controller retains exact attempted JSON before mocked send; rejection, unknown and success never auto-repeat', async () => {
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const start = source.indexOf('static submitFinalWTODayilyA =');
    const method = source.slice(start, source.indexOf('static linkEmploymentReviewPeriodSubmission', start));
    const expression = method.slice(method.indexOf('=') + 1).trim().replace(/;$/, '');
    const frozen = snapshot(row({ apo_ora_02_apologistika: '', eos_ora_02_apologistika: '' }));
    const before = JSON.stringify(frozen);
    const scope = { team: 'synthetic', company_kod: 'synthetic-company', ypokatasthma: '0000',
        period_start: new Date('2026-09-01'), period_end: new Date('2026-09-30') };
    const query = value => ({ lean: async () => value });
    const real = require('./wtoDailyRestIdentityService');
    for (const outcome of ['REJECTED', 'UNKNOWN', 'THROW', 'SUCCESS']) {
        let log = null, calls = 0, creates = 0;
        const model = { findOne: filter => query(log && (filter.request_id === log.request_id ||
                filter.submission_status === 'SUCCESS' && log.submission_status === 'SUCCESS') ? log : null),
            create: async value => { creates++; log = { ...value, _id: '507f1f77bcf86cd799439099' }; return log; },
            updateOne: async (_filter, update) => { Object.assign(log, update.$set); return { matchedCount: 1 }; },
            findOneAndUpdate: (_filter, update) => { Object.assign(log, update.$set); return Promise.resolve(log); } };
        const dependencies = { resolveFinalWtoDailySubmittedDocument: async () => ({ found: false }), activeEmploymentReviewPeriodScope: async () => scope,
            assertWtoDailySubmissionIndexesReady: async () => {}, WtoDailySubmissionRevisionModel: { exists: async () => false },
            getPeriodControl: async () => ({ stored_status: 'FINALIZED', past_deadline: false }),
            getPeriodLifecycleIndexState: async () => ({ ready: true }),
            ApasxoliseisPeriodFrozenSnapshotModel: { findOne: () => query({ frozen_snapshot: frozen }) },
            assertWtoDailyFrozenSnapshotVersion: real.assertWtoDailyFrozenSnapshotVersion,
            loadWtoDailyDeferredBoundaryContext: async () => ({ deferredWeeks: [], decisions: [] }),
            prepareFinalWtoDailyInput, buildWTODayilyAPayload, buildWtoDailyPayloadFingerprint: real.buildWtoDailyPayloadFingerprint,
            CompaniesModel: { findOne: () => query({ kod: '0002' }) }, YpokatasthmataModel: { findOne: () => query({ _id: 'synthetic-branch' }) },
            PasswordsModel: { findOne: () => query({ username: 'SECRET_USERNAME', password: 'SECRET_PASSWORD' }) },
            ErgazomenoiErganhModel: model,
            assertPreviousAttemptResolved: async () => { if (log?.reconciliation_required) throw Object.assign(new Error('unknown'), { code: 'WTODAILY_PREVIOUS_ATTEMPT_UNKNOWN', statusCode: 409 }); },
            uploadJsonDocumentToErgani: async ({ payload }) => { calls++; assert.equal(log.reconciliation_required, true);
                assert.deepEqual(log.request_payload, payload);
                if (outcome === 'THROW') throw new Error('synthetic timeout');
                return outcome === 'SUCCESS' ? { success: true, protocol: 'SYNTHETIC', id: 'synthetic', submitDate: '27/10/2026', submission: { code: 'WTODailyA', id: 91 } }
                    : { success: false, outcome, error: 'Απόρριψη SECRET_USERNAME SECRET_PASSWORD Bearer hidden-token' }; },
            resolveWtoDailyRestIdentity: real.resolveWtoDailyRestIdentity, parseErganiSubmitDate: () => new Date('2026-10-27'),
            linkEmploymentPeriodSubmission: async () => {}, buildSubmittedErganiPdfDisplayFilename: () => 'synthetic.pdf',
            process: { env: { ERGANI_ENV: 'trial' } }, console: { error() {} } };
        const handler = Function(...Object.keys(dependencies), `return (${expression});`)(...Object.values(dependencies));
        const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
        const req = { body: { reason: 'Αρχικό σχόλιο', request_id: 'synthetic-original', ypokatasthma: '0000' }, session: {} };
        const first = response(); await handler(req, first);
        assert.equal(calls, 1); assert.equal(creates, 1); assert.equal(JSON.stringify(frozen), before);
        assert.doesNotMatch(JSON.stringify(first.body), /SECRET_USERNAME|SECRET_PASSWORD|hidden-token/);
        if (outcome === 'SUCCESS') { assert.equal(first.statusCode, 201); assert.equal(log.reconciliation_required, false);
            const retry = response(); await handler(req, retry); assert.equal(retry.body.idempotent, true); assert.equal(calls, 1); }
        else { assert.deepEqual(first.body.rejected_payload, log.request_payload);
            assert.equal(first.body.submission_outcome, outcome === 'REJECTED' ? 'REJECTED' : 'UNKNOWN');
            if (outcome !== 'REJECTED') { const retry = response(); await handler({ ...req, body: { ...req.body, request_id: 'another-id' } }, retry);
                assert.equal(retry.body.code, 'WTODAILY_PREVIOUS_ATTEMPT_UNKNOWN'); assert.equal(calls, 1); } }
    }
});
