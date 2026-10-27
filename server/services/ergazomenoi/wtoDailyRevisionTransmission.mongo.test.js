'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const { buildEmploymentPeriodFrozenSnapshot } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { previewSubmissionRevision, createSubmissionRevision } = require('./wtoDailySubmissionRevisionService');
const { submitApprovedRevision, currentApprovedRevision } = require('./wtoDailyRevisionTransmissionService');
const Period = require('../../models/apasxoliseisPeriodControl');
const Frozen = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const Revision = require('../../models/wtoDailySubmissionRevision');
const Transmission = require('../../models/wtoDailyRevisionTransmission');
const { ErgazomenoiErganhModel: Log } = require('../../models/ergazomenoi');
const binary = process.env.PAYROLL_WTO_TEST_MONGOD;
const configuredUri = process.env.PAYROLL_WTO_TEST_MONGO_URI;
let networkCalls = 0;
global.fetch = async () => { networkCalls += 1; throw new Error('External requests forbidden'); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('isolated MongoDB: real revision/claim/result transactions, rollback, exact JSON, immutable source and no repeated send',
    { timeout: 90000, skip: !binary && !configuredUri ? 'Set PAYROLL_WTO_TEST_MONGOD or an isolated PAYROLL_WTO_TEST_MONGO_URI' : false }, async t => {
    let child; let uri = configuredUri;
    if (uri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/payroll_wto_revision_test_[a-z0-9_]+\?replicaSet=/.test(uri)) throw new Error('Only explicitly isolated synthetic databases are allowed');
    if (!uri) {
        const net = require('node:net'); const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
        const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-wto-revision-test-'));
        child = spawn(binary, ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1',
            '--replSet', 'payrollWtoTest', '--logpath', path.join(directory, 'mongod.log')], { stdio: 'ignore' });
        child.on('error', error => { console.error(error.message); });
        t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } });
        let direct;
        for (let attempt = 0; attempt < 100; attempt++) {
            try { direct = await MongoClient.connect(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 100 }); break; }
            catch { await pause(50); }
        }
        assert.ok(direct, 'synthetic MongoDB started');
        await direct.db('admin').command({ replSetInitiate: { _id: 'payrollWtoTest', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
        await direct.close();
        uri = `mongodb://127.0.0.1:${port}/payroll_wto_revision_test_${Date.now()}?replicaSet=payrollWtoTest`;
    }
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 15000 });
    t.after(async () => { await mongoose.disconnect(); });
    for (const Model of [Period, Frozen, Revision, Transmission, Log]) await Model.createCollection();
    let sequence = 0;
    async function fixture() {
        const scope = { team: 'synthetic', company_kod: String(new mongoose.Types.ObjectId()), ypokatasthma: '0000',
            period_start: new Date('2026-09-01'), period_end: new Date('2026-09-30') };
        const session = { userId: String(new mongoose.Types.ObjectId()), userTeam: scope.team, companyInUse: scope.company_kod,
            userRole: 'HR', userName: 'Συνθετικός έλεγχος' };
        const day = (date, firstEnd, secondStart, secondEnd) => ({ _id: String(new mongoose.Types.ObjectId()),
            kodikos: '001', ypokatasthma: '0000', hmeromhnia: date, is_locked: true, apologistiko_biblio: true,
            kathgoria_ergasias_apologistika: 'ΕΡΓ', apo_ora_01_apologistika: date.endsWith('25') ? '18:00' : '18:28',
            eos_ora_01_apologistika: firstEnd, apo_ora_02_apologistika: secondStart, eos_ora_02_apologistika: secondEnd,
            cards_apo_ora_01: '18:28', cards_eos_ora_01: '00:30', apo_ora_01: '18:30', eos_ora_01: '00:30',
            hr_daily_actual_work_resolution: { original_approval: true }, ores_ergasias_apologistika: 123.45 });
        const rows = [day('2026-09-25', '18:29', '18:29', '22:00'), day('2026-09-27', '00:28', '18:28', '00:30')];
        const built = buildEmploymentPeriodFrozenSnapshot({ scope, dailyResults: rows,
            employees: [{ kodikos: '001', afm: '123456789', eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ', afora_daneismo_ergazomenoy: false }],
            canonicalDecisions: [{ _id: 'original-decision', decision_payload: { preserved: true } }],
            appliedRepoTransfers: [{ _id: 'original-transfer', before_snapshot: { repo: false }, after_snapshot: { repo: true } }] });
        const frozen = await Frozen.create({ ...scope, snapshot_schema_version: built.snapshot.snapshot_schema_version,
            source_calculation_version: built.snapshot.source_calculation_version, frozen_snapshot: built.snapshot,
            frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint, finalized_at: new Date(),
            finalized_by_user_id: session.userId, finalized_by_user_name: session.userName, finalized_by_user_role: 'HR',
            finalize_reason: 'synthetic', request_id: `synthetic-${++sequence}` });
        await Period.create({ ...scope, status: 'FINALIZED', deadline: new Date('2099-01-01'), version: 4,
            frozen_snapshot_id: frozen._id, frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint });
        const command = { reason: 'Συνθετική επιβεβαιωμένη διόρθωση', corrections: [{ row_id: rows[1]._id, date: '2026-09-27',
            keep_pair: 2, confirmed_actual_hours: true, intervals: [{ start: '18:28', end: '00:30' }] }] };
        const options = { scope, session, command };
        const preview = await previewSubmissionRevision(options);
        const result = await createSubmissionRevision({ ...options, command: { ...command, approve: true,
            reviewed_entire_preview: true, expected_preview_fingerprint: preview.preview_fingerprint, request_id: `revision-${sequence}` } });
        assert.equal(result.revision.corrections.length, 2);
        const original = JSON.stringify(await Frozen.findById(frozen._id).lean());
        let sends = 0;
        const transmissionOptions = { scope, session, releaseEnabled: true,
            command: { revision_id: result.revision._id, expected_preview_fingerprint: preview.preview_fingerprint,
                request_id: `send-${sequence}`, approve_submission: true, previous_attempt_not_accepted: true,
                previous_attempt_evidence: 'Συνθετική επιβεβαιωμένη απόρριψη', reviewed_entire_payload: true, boundary_reviewed: true },
            preflight: async () => {},
            send: async payload => { sends++; assert.deepEqual(payload, preview.payload);
                assert.equal(JSON.stringify(payload), JSON.stringify(preview.payload), 'wire preserves approved order and values'); return { success: true,
                protocol: `SYNTHETIC-${sequence}`, id: `synthetic-${sequence}`, submitDate: '27/10/2026' }; },
            recordSuccess: async ({ scope, revision, result, dbSession, requestId }) => {
                const [log] = await Log.create([{ team: scope.team, companykod_object: scope.company_kod,
                    upload_method: 'REST', submission_status: 'SUCCESS', submission_code: 'WTODailyA', request_id: requestId,
                    protocol: result.protocol, erganh_submission_id: result.id, request_payload: revision.payload }], { session: dbSession });
                return log;
            } };
        return { options: transmissionOptions, scope, frozen, original, preview, sends: () => sends };
    }
    const success = await fixture();
    const completed = await submitApprovedRevision(success.options);
    assert.equal(completed.success, true); assert.equal(completed.transmission.status, 'SUCCESS');
    assert.equal((await submitApprovedRevision(success.options)).idempotent, true); assert.equal(success.sends(), 1);
    assert.equal(JSON.stringify(await Frozen.findById(success.frozen._id).lean()), success.original);
    assert.equal((await currentApprovedRevision(success.options)).transmission.result.protocol, completed.transmission.result.protocol);
    assert.deepEqual((await Log.findOne({ _id: completed.transmission.erganh_log_id }).lean()).request_payload, success.preview.payload);
    const race = await fixture();
    const attempts = await Promise.allSettled([submitApprovedRevision(race.options), submitApprovedRevision(race.options)]);
    assert.ok(attempts.some(item => item.status === 'fulfilled')); assert.equal(race.sends(), 1);
    for (const outcome of ['REJECTED', 'UNKNOWN']) {
        const f = await fixture(); let calls = 0;
        f.options.send = async () => { calls++; if (outcome === 'UNKNOWN') throw new Error('synthetic timeout'); return { success: false, outcome }; };
        const response = await submitApprovedRevision(f.options);
        assert.equal(response.transmission.status, outcome);
        await assert.rejects(submitApprovedRevision(f.options), { code: 'WTODAILY_REVISION_ATTEMPT_BLOCKED' });
        assert.equal(calls, 1); assert.equal(await Log.countDocuments({ companykod_object: f.scope.company_kod }), 0);
        assert.equal(JSON.stringify(await Frozen.findById(f.frozen._id).lean()), f.original);
    }
    const rollback = await fixture(); rollback.options.recordSuccess = async () => { throw new Error('synthetic log failure'); };
    const uncertain = await submitApprovedRevision(rollback.options);
    assert.equal(uncertain.reconciliation_required, true);
    assert.equal((await Transmission.findById(rollback.options.command.revision_id).lean()).status, 'SENDING');
    await assert.rejects(submitApprovedRevision(rollback.options), { code: 'WTODAILY_REVISION_ATTEMPT_BLOCKED' });
    assert.equal(rollback.sends(), 1);
    const rejection = { success: false, outcome: 'REJECTED', httpStatus: 400, responseReceived: true,
        failureStage: 'submission', error: 'Συνθετική απόρριψη XSD', raw: { message: 'Συνθετική απόρριψη XSD' } };
    const retry = await fixture();
    retry.options.send = async () => structuredClone(rejection);
    await submitApprovedRevision(retry.options);
    const firstAttempt = await Transmission.findById(retry.options.command.revision_id).lean();
    const firstBytes = JSON.stringify(firstAttempt);
    const approvedBytes = JSON.stringify(await Revision.findById(retry.options.command.revision_id).lean());
    assert.equal((await currentApprovedRevision(retry.options)).retry_allowed, true);
    await assert.rejects(submitApprovedRevision(retry.options), { code: 'WTODAILY_REVISION_ATTEMPT_BLOCKED' });
    retry.options.command = { ...retry.options.command, request_id: 'separately-approved-retry', previous_attempt_id: firstAttempt._id };
    let retrySends = 0;
    retry.options.send = async payload => { retrySends++; assert.equal(JSON.stringify(payload), JSON.stringify(retry.preview.payload));
        return { success: true, protocol: 'RETRY-SUCCESS', id: 'retry-document', submitDate: '27/10/2026' }; };
    const racingRetries = await Promise.allSettled([submitApprovedRevision(retry.options),
        submitApprovedRevision({ ...retry.options, command: { ...retry.options.command, request_id: 'different-concurrent-approval' } })]);
    assert.ok(racingRetries.some(item => item.status === 'fulfilled')); assert.equal(retrySends, 1);
    const history = await Transmission.find({ ...retry.scope, revision_id: firstAttempt.revision_id }).lean();
    assert.equal(history.length, 2); assert.equal(history.find(item => item.previous_attempt_id)?._id === firstAttempt._id, false);
    assert.equal(JSON.stringify(await Transmission.findById(firstAttempt._id).lean()), firstBytes);
    assert.equal(JSON.stringify(await Revision.findById(firstAttempt.revision_id).lean()), approvedBytes);
    assert.equal(JSON.stringify(await Frozen.findById(retry.frozen._id).lean()), retry.original);
    const latest = (await currentApprovedRevision(retry.options)).transmission;
    assert.equal(latest.status, 'SUCCESS'); assert.notEqual(latest._id, firstAttempt._id);
    assert.equal((await submitApprovedRevision(retry.options)).idempotent, true); assert.equal(retrySends, 1);
    const accepted = await fixture(); accepted.options.send = async () => structuredClone(rejection);
    await submitApprovedRevision(accepted.options);
    await Log.create({ team: accepted.scope.team, companykod_object: accepted.scope.company_kod,
        ypokatasthma_kodikos: accepted.scope.ypokatasthma, employment_period_start: accepted.scope.period_start,
        employment_period_end: accepted.scope.period_end, submission_code: 'WTODailyA', submission_status: 'SUCCESS',
        upload_method: 'REST', is_final: true, document_status: 'ACTIVE' });
    accepted.options.command = { ...accepted.options.command, previous_attempt_id: accepted.options.command.revision_id, request_id: 'accepted-blocked' };
    accepted.options.send = async () => { throw new Error('must not send'); };
    await assert.rejects(submitApprovedRevision(accepted.options), { code: 'WTODAILY_REVISION_PREVIOUS_SUCCESS' });
    const uncertainRetry = await fixture(); uncertainRetry.options.send = async () => ({ success: false, outcome: 'UNKNOWN' });
    await submitApprovedRevision(uncertainRetry.options);
    uncertainRetry.options.command = { ...uncertainRetry.options.command, previous_attempt_id: uncertainRetry.options.command.revision_id, request_id: 'unknown-blocked' };
    assert.equal((await currentApprovedRevision(uncertainRetry.options)).retry_allowed, false);
    await assert.rejects(submitApprovedRevision(uncertainRetry.options), { code: 'WTODAILY_REVISION_ATTEMPT_BLOCKED' });
    const legacyRetry = await fixture();
    const legacyError = "Το αρχείο δεν είναι έγκυρο βάσει του σχετικού xsd. The element 'WTO' has invalid child element 'Ergazomenoi'. List of possible elements expected: 'f_aa_pararthmatos'.";
    legacyRetry.options.send = async () => ({ success: false, outcome: 'REJECTED', error: legacyError, raw: { message: legacyError } });
    await submitApprovedRevision(legacyRetry.options);
    const legacyBefore = JSON.stringify(await Transmission.findById(legacyRetry.options.command.revision_id).lean());
    assert.equal((await currentApprovedRevision(legacyRetry.options)).retry_allowed, true);
    legacyRetry.options.command = { ...legacyRetry.options.command, previous_attempt_id: legacyRetry.options.command.revision_id, request_id: 'legacy-separate-approval' };
    legacyRetry.options.send = async () => ({ success: true, protocol: 'LEGACY-RETRY', id: 'legacy-id', submitDate: '27/10/2026' });
    assert.equal((await submitApprovedRevision(legacyRetry.options)).success, true);
    assert.equal(JSON.stringify(await Transmission.findById(legacyRetry.options.command.revision_id).lean()), legacyBefore);
    const disabled = await fixture();
    await assert.rejects(submitApprovedRevision({ ...disabled.options, releaseEnabled: false }), { code: 'WTODAILY_REVISION_SUBMISSION_DISABLED' });
    assert.equal(disabled.sends(), 0);
    assert.equal(networkCalls, 0);
});

test('only the defined minimized empty snapshot default is restored for integrity checking', () => {
    const { baselineFingerprint } = require('./wtoDailySubmissionRevisionService');
    const built = buildEmploymentPeriodFrozenSnapshot({ scope: {}, dailyResults: [] });
    const stored = structuredClone(built.snapshot);
    delete stored.weekly_calculation_context.applied_transfer_protection;
    assert.equal(baselineFingerprint(stored), built.frozen_snapshot_fingerprint);
    stored.weekly_calculation_context.rows.push({ _id: 'tampered' });
    assert.notEqual(baselineFingerprint(stored), built.frozen_snapshot_fingerprint);
});

test('original sender refuses an approved revision; new endpoints preserve authentication and critical-role gates', () => {
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const routes = fs.readFileSync(require.resolve('../../routes/usersRoute'), 'utf8');
    const final = source.slice(source.indexOf('static submitFinalWTODayilyA'), source.indexOf('static linkEmploymentReviewPeriodSubmission'));
    assert.match(final, /WTODAILY_APPROVED_REVISION_REQUIRED/);
    assert.ok(final.indexOf('WtoDailySubmissionRevisionModel.exists') < final.indexOf('uploadJsonDocumentToErgani'));
    for (const action of ['current', 'submit']) assert.match(routes, new RegExp("submission/revision/" + action + "', checkAuth,[\\s\\S]*?requireEmploymentReviewAccess, requireCriticalEmploymentDecisionRole"));
    const sender = source.slice(source.indexOf('static submitWtoDailySubmissionRevision'), source.indexOf('static submitFinalWTODayilyA'));
    assert.doesNotMatch(sender, /getOrarioTermsForDate|calculateHistorical|calcApasxolhseis/);
    assert.match(sender, /ALLOW_WTODAILY_REVISION_SUBMIT === 'true'/);
});
