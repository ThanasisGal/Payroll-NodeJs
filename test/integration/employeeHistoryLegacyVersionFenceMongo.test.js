'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fork, execFileSync } = require('node:child_process');
const { mkdtempSync, symlinkSync, realpathSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const COMMIT = 'd4483357f91679dabca97996ad7614a143f4d1f1';
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;
const root = path.resolve(__dirname, '../..');
function oldTree() {
    const dir = mkdtempSync(path.join(tmpdir(), 'payroll-358-fence-'));
    execFileSync('tar', ['-x', '-C', dir], { input: execFileSync('git', ['archive', COMMIT, 'server', 'test/fixtures'],
        { cwd: root, maxBuffer: 40 * 1024 * 1024 }) });
    symlinkSync(realpathSync(path.join(root, 'node_modules')), path.join(dir, 'node_modules'), 'dir');
    return dir;
}
function worker(t, options) {
    const child = fork(path.join(__dirname, '../fixtures/employeeHistoryLegacyVersionWorker.js'), [JSON.stringify(options)],
        { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    const messages = [], wakes = new Set(); let exited = false, stderr = '';
    child.stderr.on('data', x => { stderr += x; });
    child.on('message', m => { messages.push(m); for (const wake of wakes) wake(); });
    const exit = new Promise(resolve => child.on('exit', code => { exited = true; for (const wake of wakes) wake(); resolve(code); }));
    t.after(async () => { if (!exited) child.kill(); await exit; });
    function take(event) { return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { wakes.delete(check); reject(Error('IPC_TIMEOUT:' + event + ':' + stderr)); }, 25000);
        function check() { const i = messages.findIndex(x => x.event === event || x.event === 'result');
            if (i >= 0) { const m = messages.splice(i, 1)[0]; clearTimeout(timer); wakes.delete(check);
                if (m.event !== event) reject(Error(JSON.stringify(m))); else resolve(m); }
            else if (exited) { clearTimeout(timer); wakes.delete(check); reject(Error('EXIT:' + stderr)); } }
        wakes.add(check); check();
    }); }
    return { pid: child.pid, take, release: key => child.send({ release: key }), async finish() {
        const result = await take('result'); assert.equal(await exit, 0, stderr); return result;
    } };
}
test('review procedure rejects production before connecting and has no runtime activation', () => {
    const admin = require('../fixtures/employeeHistoryLegacyFenceAdmin');
    assert.equal(admin.executionEnabled, false);
    return assert.rejects(() => admin.fenceLegacyApproval({ connection: { name: 'payrollDB' } }));
});
test('#358 permanent sequence fence: actual old writer in independent processes on CI MongoDB',
    { skip: !uri, timeout: 180000 }, async t => {
        assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
        const oldRoot = oldTree();
        // Assert archive bytes against the pinned Git object, not an edited reimplementation.
        for (const file of ['employeeEmploymentProfileWriter.js', 'employeeHistoryAutomaticSettlementPreparationContract.js', 'employeeHistorySettlementNormalActivation.js']) {
            const relative = 'server/services/ergazomenoi/' + file;
            assert.deepEqual(require('node:fs').readFileSync(path.join(oldRoot, relative)),
                execFileSync('git', ['show', COMMIT + ':' + relative], { cwd: root, maxBuffer: 1024 * 1024 }));
        }
        const mongoose = require('mongoose');
        await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true }); t.after(() => mongoose.disconnect());
        assertMongoConnection(mongoose.connection);
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
        const models = require('../../server/models/ergazomenoi');
        const audit = require('../../server/models/employeeHistoryRepairAudit');
        for (const model of [models.ErgazomenoiModel, models.IstorikoProslhpseonAllagonModel, audit,
            require('../../server/models/companies').CompaniesModel, require('../../server/models/userModel'),
            require('../../server/models/privileges').UserPrivilegesModel]) await model.createCollection();
        for (const name of require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService').SUPPORTED_COLLECTIONS)
            if (!await mongoose.connection.db.listCollections({ name }).hasNext()) await mongoose.connection.db.createCollection(name);
        const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
        const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
        const SOURCE = require('../fixtures/employeeHistoryLegacyFenceAdmin').SOURCE;
        async function setup(st, options = {}) {
            const fixture = require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceB();
            if (options.isolatedAdminRuntime) {
                fixture.scope.team = 'THA'; fixture.currentEmployee.team = 'THA';
                for (const row of fixture.completeHistoryRows) row.team = 'THA';
            }
            const db = await createMongoSettlementStore({ fixture });
            if (options.initialSequence !== undefined)
                await db.changeEmployee({ employee_profile_mutation_sequence: options.initialSequence });
            if (options.multipleFrozenReferences) {
                const frozen = mongoose.connection.db.collection('Apasxoliseis_Period_Frozen_Snapshots');
                const originals = await frozen.find(db.scope).toArray();
                const duplicates = originals.flatMap(row => Array.from({ length: 7 }, () =>
                    ({ ...row, ...db.nextFrozenReferenceIdentity(), _id: new mongoose.Types.ObjectId() })));
                await frozen.insertMany(duplicates.reverse());
            }
            const identity = { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId };
            const old = worker(st, { mode: 'OLD', oldRoot, ...identity, ...options });
            const ready = await old.take('ready');
            const original = await audit.findById(ready.legacyAttemptId).readConcern('majority').lean();
            const before = await db.state();
            async function block(extra = {}) { const fence = worker(st, { mode: 'FENCE', ...identity, ...ready, ...extra });
                assert.notEqual(fence.pid, old.pid); await fence.take('ready'); fence.release('start'); return fence; }
            async function verify({ fenced, applied = false, previous } = {}) {
                const after = await db.state();
                assert.ok(A.equal(await audit.findById(ready.legacyAttemptId).readConcern('majority').lean(), original));
                assert.ok(A.equal(after.references, before.references));
                const { employee_profile_mutation_sequence: sequence, ...business } = after.employee;
                const { employee_profile_mutation_sequence: initialSequence = 0, ...beforeBusiness } = before.employee;
                assert.ok(A.equal(business, beforeBusiness));
                if (!applied) assert.ok(A.equal(after.history, before.history));
                const fences = after.audits.filter(row => row.mutationSource === SOURCE);
                const finals = after.audits.filter(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT');
                assert.equal(fences.length, fenced ? 1 : 0); assert.equal(finals.length, applied ? 1 : 0);
                assert.equal(sequence || 0, initialSequence + (fenced || applied ? 1 : 0));
                if (fenced) {
                    const input = await db.approvalInput();
                    const proposal = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract').buildCoordinatedSettlementProposal(input);
                    const nextFingerprint = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract')
                        .buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
                    assert.notEqual(nextFingerprint, ready.fingerprint);
                    assert.equal(fences[0].diagnostics.fingerprint, ready.fingerprint);
                    assert.equal(fences[0].diagnostics.requiresNewIndependentApproval, true);
                    assert.ok(A.equal(fences[0].historyBefore, fences[0].historyAfter)); }
                if (previous) assert.ok(A.equal(after, previous));
                return after;
            }
            function report(label, ...results) { st.diagnostic(JSON.stringify({ label, commit: COMMIT,
                results: results.map(x => ({ pid: x.pid, ok: x.ok, code: x.code, attempts: x.attempts,
                    failures: x.failures, transactions: [...new Set(x.commands.map(c => c.session + ':' + c.txn))] })) })); }
            return { old, block, verify, before, ready, db, report };
        }
        const stale = result => { assert.equal(result.ok, false, JSON.stringify(result));
            assert.equal(result.code, 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_STALE', JSON.stringify(result)); };
        await t.test('1: durable sequence increment precedes old transaction; fingerprint rejected', async st => {
            const x = await setup(st); const f = await x.block(); const blocked = await f.finish(); assert.equal(blocked.ok, true, JSON.stringify(blocked));
            const saved = await x.verify({ fenced: true }); x.old.release('start'); const old = await x.old.finish(); stale(old);
            await x.verify({ fenced: true, previous: saved }); x.report('before', old, blocked);
        });
        await t.test('2/4: old snapshot before write; real WriteConflict retries old callback and rejects stale fingerprint', async st => {
            const x = await setup(st, { pauseBeforeWrite: true }); x.old.release('start'); await x.old.take('before-write');
            const f = await x.block(); const blocked = await f.finish(); assert.equal(blocked.ok, true, JSON.stringify(blocked));
            const saved = await x.verify({ fenced: true }); x.old.release('before-write'); const old = await x.old.finish(); stale(old);
            assert.ok(old.attempts >= 2, JSON.stringify(old));
            assert.ok(old.failures.some(e => e.code === 112 && e.labels.includes('TransientTransactionError')), JSON.stringify(old));
            assert.ok(new Set(old.commands.map(c => c.txn)).size >= 2);
            await x.verify({ fenced: true, previous: saved }); x.report('driver-retry', old, blocked);
        });
        await t.test('3a: old write holder commits first; blocker must refuse and roll back its own increment', async st => {
            const x = await setup(st, { pauseWrite: true }); x.old.release('start'); await x.old.take('write');
            const f = await x.block(); await f.take('fence-command'); x.old.release('write'); const [old, blocked] = await Promise.all([x.old.finish(), f.finish()]);
            assert.equal(old.result?.applied, true, JSON.stringify(old)); assert.equal(blocked.ok, false);
            assert.equal(blocked.code, 'LEGACY_ALREADY_COMMITTED', JSON.stringify(blocked));
            await x.verify({ fenced: false, applied: true }); x.report('old-write-commits', old, blocked);
        });
        await t.test('3b: old write holder aborts; permanent blocker then commits', async st => {
            const x = await setup(st, { pauseWrite: true, abortOld: true }); x.old.release('start'); await x.old.take('write');
            const f = await x.block(); await f.take('fence-command'); x.old.release('write'); const [old, blocked] = await Promise.all([x.old.finish(), f.finish()]);
            assert.equal(old.code, 'OLD_ABORT', JSON.stringify(old)); assert.equal(blocked.ok, true, JSON.stringify(blocked));
            await x.verify({ fenced: true }); x.report('old-write-aborts', old, blocked);
        });
        await t.test('5: already completed old settlement blocks permanent-fence success', async st => {
            const x = await setup(st); x.old.release('start'); const old = await x.old.finish(); assert.equal(old.result?.applied, true, JSON.stringify(old));
            const saved = await x.verify({ applied: true }); const f = await x.block(); const blocked = await f.finish();
            assert.equal(blocked.code, 'LEGACY_ALREADY_COMMITTED', JSON.stringify(blocked));
            await x.verify({ applied: true, previous: saved }); x.report('completed-first', old, blocked);
        });
        await t.test('6a: audit failure aborts counter and audit; no blocking guarantee is claimed', async st => {
            const x = await setup(st); const f = await x.block({ failAudit: true }); const blocked = await f.finish();
            assert.equal(blocked.code, 'INJECTED_AUDIT_FAILURE', JSON.stringify(blocked)); await x.verify({ fenced: false });
            x.old.release('start'); const old = await x.old.finish(); assert.equal(old.result?.applied, true, JSON.stringify(old));
            await x.verify({ applied: true }); x.report('audit-rollback', old, blocked);
        });
        await t.test('6b: application loses result after real commit; independent majority audit proves block', async st => {
            const x = await setup(st); const f = await x.block({ loseAcknowledgement: true }); const blocked = await f.finish();
            assert.equal(blocked.code, 'COMMIT_RESULT_UNKNOWN', JSON.stringify(blocked));
            const saved = await x.verify({ fenced: true }); x.old.release('start'); const old = await x.old.finish(); stale(old);
            await x.verify({ fenced: true, previous: saved }); x.report('uncertain-result-reconciled', old, blocked);
        });
        await t.test('6c: MongoDB closes commit connection; driver retries commit and majority state remains fenced', async st => {
            const x = await setup(st); const f = await x.block({ pauseFence: true }); await f.take('write');
            await mongoose.connection.db.admin().command({ configureFailPoint: 'failCommand', mode: { times: 1 },
                data: { failCommands: ['commitTransaction'], closeConnection: true } });
            f.release('write'); const blocked = await f.finish(); assert.equal(blocked.ok, true, JSON.stringify(blocked));
            assert.ok(blocked.commands.filter(c => c.name === 'commitTransaction').length >= 2, JSON.stringify(blocked));
            const saved = await x.verify({ fenced: true }); x.old.release('start'); const old = await x.old.finish(); stale(old);
            await x.verify({ fenced: true, previous: saved }); x.report('commit-network-retry', old, blocked);
        });
        // Functional Admin checks share the same old-version fixture and core.
        const F = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
        async function functional(st, options) {
            const x = await setup(st, options);
            const context = require('../fixtures/employeeHistoryLegacyFenceAdmin').testContext(mongoose.connection,
                require('../fixtures/employeeHistorySettlementMongoStore').mongoSettlementContext(x.db.handle));
            const input = { connection: mongoose.connection, context, scope: x.db.scope,
                employeeId: x.db.employeeId, actorUserId: x.db.actorUserId,
                legacyAttemptId: x.ready.legacyAttemptId, fingerprint: x.ready.fingerprint };
            return { ...x, input, async finishOld() { x.old.release('start'); return x.old.finish(); } };
        }
        await t.test('Admin preview is read-only; explicit approval fences once without automatic settlement', async st => {
            const x = await functional(st), before = await x.db.state();
            const preview = await F.previewLegacyApproval(x.input);
            assert.equal(preview.outcome, 'PREVIEW'); assert.ok(A.equal(await x.db.state(), before));
            await assert.rejects(() => F.fenceLegacyApproval(x.input), e => e.reason === 'EXPLICIT_APPROVAL_REQUIRED');
            assert.ok(A.equal(await x.db.state(), before));
            const approval = { confirmed: true, fingerprint: preview.approvalFingerprint };
            const result = await F.fenceLegacyApproval({ ...x.input, approval });
            assert.equal(result.sequence, 1); const saved = await x.verify({ fenced: true });
            await assert.rejects(() => F.fenceLegacyApproval({ ...x.input, approval }), e => e.reason === 'ALREADY_REQUESTED');
            await assert.rejects(() => F.fenceLegacyApproval({ ...x.input, scope: { kodikos: x.input.scope.kodikos,
                company_kod: x.input.scope.company_kod, team: x.input.scope.team }, approval }), e => e.reason === 'ALREADY_REQUESTED');
            assert.ok(A.equal(await x.db.state(), saved)); stale(await x.finishOld());
            await x.verify({ fenced: true, previous: saved });
        });
        await t.test('Admin authorization is revalidated without writing', async st => {
            const x = await functional(st), preview = await F.previewLegacyApproval(x.input);
            await x.db.changeActor({ privileges: 'S' }); const before = await x.db.state();
            await assert.rejects(() => F.previewLegacyApproval(x.input), e => e.outcome === 'BLOCKED');
            await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
                approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.outcome === 'BLOCKED');
            assert.ok(A.equal(await x.db.state(), before));
            await x.db.changeActor({ privileges: 'A' }); assert.equal((await x.finishOld()).result?.applied, true);
        });
        for (const change of ['employee', 'history', 'reference', 'sequence', 'identity'])
        await t.test('Admin refuses changed ' + change + ' after preview', async st => {
            const x = await functional(st), preview = await F.previewLegacyApproval(x.input);
            if (change === 'employee') await x.db.changeEmployee({ parathrhseis: 'CI concurrent change' });
            if (change === 'sequence') await x.db.changeEmployee({ employee_profile_mutation_sequence: 1 });
            if (change === 'history') await models.IstorikoProslhpseonAllagonModel.collection.updateOne(
                { _id: x.before.history[0]._id }, { $set: { synolo_symbashs: 999 } });
            if (change === 'reference') await x.db.addReference(x.before.history[0]._id);
            const input = change === 'identity' ? { ...x.input, scope: { ...x.input.scope, kodikos: 'wrong' } } : x.input;
            const before = await x.db.state();
            await assert.rejects(() => F.fenceLegacyApproval({ ...input, approval: { confirmed: true,
                fingerprint: preview.approvalFingerprint } }), e => e.outcome === 'BLOCKED');
            assert.ok(A.equal(await x.db.state(), before));
            const old = await x.finishOld();
            if (change === 'identity') assert.equal(old.result?.applied, true);
            else assert.ok(A.equal(await x.db.state(), before));
        });
        await t.test('two approved Admin requests have one durable owner and one sequence increment', async st => {
            const x = await functional(st), preview = await F.previewLegacyApproval(x.input);
            const request = { ...x.input, approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
            const results = await Promise.allSettled([F.fenceLegacyApproval(request), F.fenceLegacyApproval(request)]);
            assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
            assert.equal(results.filter(result => result.status === 'rejected' && result.reason.outcome === 'BLOCKED').length, 1);
            const saved = await x.verify({ fenced: true }); stale(await x.finishOld());
            await x.verify({ fenced: true, previous: saved });
        });
        await t.test('uncertain committed result cannot acquire a second reservation or increment', async st => {
            const x = await functional(st), preview = await F.previewLegacyApproval(x.input);
            const real = x.input.context.deps.auditModel;
            const uncertainAudit = new Proxy(real, { get(target, key) {
                if (key === 'findById') return (...args) => {
                    const q = real.findById(...args), readConcern = q.readConcern.bind(q);
                    q.readConcern = value => { readConcern(value); q.lean = async () => { throw Error('CI_CONFIRMATION_LOST'); }; return q; };
                    return q;
                };
                const v = Reflect.get(target, key); return typeof v === 'function' ? v.bind(target) : v;
            } });
            const input = { ...x.input, context: { ...x.input.context, deps: { ...x.input.context.deps, auditModel: uncertainAudit } },
                approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
            await assert.rejects(() => F.fenceLegacyApproval(input), e => e.reason === 'CONFIRMATION_UNCERTAIN');
            const saved = await x.verify({ fenced: true });
            await assert.rejects(() => F.fenceLegacyApproval(input), e => e.reason === 'ALREADY_REQUESTED');
            stale(await x.finishOld()); await x.verify({ fenced: true, previous: saved });
        });

        async function stranded(st, options) {
            const x = await functional(st, options), preview = await F.previewLegacyApproval(x.input);
            const real = x.input.context.deps.employeeModel;
            const deniedEmployee = new Proxy(real, { get(target, key) {
                if (key === 'updateOne') return async () => { throw Error('TEMPORARY_GUARD_DENIED_BEFORE_TRANSMISSION'); };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
                context: { ...x.input.context, deps: { ...x.input.context.deps, employeeModel: deniedEmployee } },
                approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.reason === 'FENCE_RESULT_UNCERTAIN');
            const state = await x.db.state();
            const reservations = state.audits.filter(row => row.mutationSource === F.SOURCE + '_ATTEMPT');
            assert.equal(reservations.length, 1); assert.ok(A.equal(state.employee, x.before.employee));
            assert.ok(A.equal(state.history, x.before.history)); assert.ok(A.equal(state.references, x.before.references));
            const reservation = reservations[0];
            const input = { ...x.input, reservationId: String(reservation._id) };
            await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
                approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.reason === 'ALREADY_REQUESTED');
            return { ...x, recoveryInput: input, reservation, strandedState: state };
        }
        async function recoveryRequest(x) {
            const preview = await F.previewLegacyFenceRecovery(x.recoveryInput);
            assert.equal(preview.outcome, 'RECOVERABLE');
            return { ...x.recoveryInput, recoveryApproval: { confirmed: true, fingerprint: preview.recoveryFingerprint } };
        }
        async function verifyRecovered(x) {
            const saved = await x.verify({ fenced: true });
            assert.ok(A.equal(saved.audits.find(row => String(row._id) === String(x.reservation._id)), x.reservation));
            assert.equal(saved.audits.filter(row => row.mutationSource === F.SOURCE + '_ATTEMPT').length, 1);
            assert.equal(saved.audits.find(row => row.mutationSource === F.SOURCE).diagnostics.executionId,
                x.reservation.diagnostics.executionId);
            return saved;
        }
        await t.test('recovery: incomplete reservation is read-only and needs independent exact approval', async st => {
            const x = await stranded(st);
            await recoveryRequest(x);
            await assert.rejects(() => F.completeLegacyFenceReservation(x.recoveryInput), e => e.reason === 'EXPLICIT_RECOVERY_APPROVAL_REQUIRED');
            await assert.rejects(() => F.completeLegacyFenceReservation({ ...x.recoveryInput,
                recoveryApproval: { confirmed: true, fingerprint: x.reservation.diagnostics.approvalFingerprint } }),
                e => e.reason === 'EXPLICIT_RECOVERY_APPROVAL_REQUIRED');
            await assert.rejects(() => F.previewLegacyFenceRecovery({ ...x.recoveryInput, reservationId: '0'.repeat(24) }),
                e => e.reason === 'RECOVERY_IDENTITY_MISMATCH');
            assert.ok(A.equal(await x.db.state(), x.strandedState));
        });
        await t.test('recovery: completes same reservation once; repeat reconciles without writes', async st => {
            const x = await stranded(st), request = await recoveryRequest(x);
            const result = await F.completeLegacyFenceReservation(request); assert.equal(result.sequence, 1);
            const saved = await verifyRecovered(x);
            assert.equal((await F.previewLegacyFenceRecovery(x.recoveryInput)).outcome, 'COMMITTED');
            assert.equal((await F.completeLegacyFenceReservation(request)).outcome, 'COMMITTED');
            assert.ok(A.equal(await x.db.state(), saved)); stale(await x.finishOld());
        });
        await t.test('recovery: failure after real audit insert rolls back everything except original reservation', async st => {
            const x = await stranded(st, { multipleFrozenReferences: true }), request = await recoveryRequest(x);
            const real = x.input.context.deps.auditModel;
            const failing = new Proxy(real, { get(target, key) {
                if (key === 'create') return async (...args) => { await real.create(...args); throw Error('AFTER_REAL_AUDIT_INSERT'); };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            await assert.rejects(() => F.completeLegacyFenceReservation({ ...request,
                context: { ...request.context, deps: { ...request.context.deps, auditModel: failing } } }),
                e => e.reason === 'FENCE_RESULT_UNCERTAIN');
            assert.ok(A.equal(await x.db.state(), x.strandedState));
            assert.equal((await F.previewLegacyFenceRecovery(x.recoveryInput)).outcome, 'RECOVERABLE');
        });
        await t.test('recovery: lost majority confirmation reconciles committed result without second increment', async st => {
            const x = await stranded(st, { multipleFrozenReferences: true }), request = await recoveryRequest(x);
            const real = x.input.context.deps.auditModel;
            const uncertain = new Proxy(real, { get(target, key) {
                if (key === 'findById') return (...args) => {
                    const q = real.findById(...args), readConcern = q.readConcern.bind(q);
                    q.readConcern = value => { readConcern(value); q.lean = async () => { throw Error('CONFIRMATION_LOST'); }; return q; };
                    return q;
                };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            await assert.rejects(() => F.completeLegacyFenceReservation({ ...request,
                context: { ...request.context, deps: { ...request.context.deps, auditModel: uncertain } } }),
                e => e.reason === 'CONFIRMATION_UNCERTAIN');
            const saved = await verifyRecovered(x);
            assert.equal((await F.previewLegacyFenceRecovery(x.recoveryInput)).outcome, 'COMMITTED');
            assert.equal((await F.completeLegacyFenceReservation(request)).outcome, 'COMMITTED');
            assert.ok(A.equal(await x.db.state(), saved)); stale(await x.finishOld());
        });
        await t.test('recovery: competing completions share one unique final audit and one increment', async st => {
            const x = await stranded(st, { multipleFrozenReferences: true }), request = await recoveryRequest(x);
            let arrivals = 0, release;
            const bothReady = new Promise(resolve => { release = resolve; });
            const real = request.context.deps.employeeModel;
            const competing = new Proxy(real, { get(target, key) {
                if (key === 'updateOne') return async (...args) => {
                    arrivals++; if (arrivals === 2) release();
                    await bothReady; return real.updateOne(...args);
                };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            request.context = { ...request.context, deps: { ...request.context.deps, employeeModel: competing } };
            const results = await Promise.allSettled([F.completeLegacyFenceReservation(request), F.completeLegacyFenceReservation(request)]);
            assert.ok(arrivals >= 2, 'Both transactions must reach the competing employee write');
            assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
            for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.outcome, 'BLOCKED');
            await verifyRecovered(x); stale(await x.finishOld());
        });
        for (const change of ['employee', 'reference', 'permission'])
        await t.test('recovery: revalidates changed ' + change + ' and performs no completion', async st => {
            const x = await stranded(st), request = await recoveryRequest(x);
            if (change === 'employee') await x.db.changeEmployee({ parathrhseis: 'changed after recovery preview' });
            if (change === 'reference') await x.db.addReference(x.before.history[0]._id);
            if (change === 'permission') await x.db.changePermission(false);
            const before = await x.db.state();
            await assert.rejects(() => F.completeLegacyFenceReservation(request));
            assert.ok(A.equal(await x.db.state(), before));
        });

        await t.test('temporary guard cause: autocommit is absent before driver preparation despite active transaction', async st => {
            const x = await functional(st), preview = await F.previewLegacyApproval(x.input);
            const { Connection } = require(require.resolve('mongoose').replace(/index\.js$/, 'node_modules/mongodb/lib/cmap/connection'));
            const original = Connection.prototype.command;
            let seen = 0, transmitted = 0;
            const monitor = event => { if (event.commandName === 'update' && event.command.update === 'Ergazomenoi') transmitted++; };
            mongoose.connection.getClient().on('commandStarted', monitor);
            Connection.prototype.command = function(ns, command, options) {
                if (command.update === 'Ergazomenoi') {
                    seen++; assert.equal(options.session.inTransaction(), true);
                    assert.equal(command.autocommit, undefined);
                    // Exact early condition from the failed temporary handler.
                    if (command.autocommit !== false) throw Error('UNAUTHORIZED_DATABASE_COMMAND_BLOCKED');
                }
                return original.apply(this, arguments);
            };
            try {
                await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
                    approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.reason === 'FENCE_RESULT_UNCERTAIN');
            } finally {
                Connection.prototype.command = original;
                mongoose.connection.getClient().off('commandStarted', monitor);
            }
            assert.equal(seen, 1); assert.equal(transmitted, 0);
            const after = await x.db.state(); assert.ok(A.equal(after.employee, x.before.employee));
            assert.equal(after.audits.filter(row => row.mutationSource === F.SOURCE + '_ATTEMPT').length, 1);
            assert.equal(after.audits.filter(row => row.mutationSource === F.SOURCE).length, 0);
        });
        for (const abortOld of [false, true])
        await t.test('recovery competes with old write holder: ' + (abortOld ? 'old aborts' : 'old commits'), async st => {
            const x = await stranded(st, { pauseWrite: true, abortOld }), request = await recoveryRequest(x);
            x.old.release('start'); await x.old.take('write');
            let sawWrite;
            const command = new Promise(resolve => { sawWrite = resolve; });
            const monitor = event => { if (event.commandName === 'update' && event.command.update === 'Ergazomenoi') sawWrite(); };
            mongoose.connection.getClient().on('commandStarted', monitor);
            try {
                const recovering = F.completeLegacyFenceReservation(request);
                const result = recovering.then(value => ({ value }), error => ({ error }));
                await Promise.race([command, result.then(r => { if (r.error) throw r.error; throw Error('RECOVERY_FINISHED_BEFORE_COMPETING_WRITE'); })]);
                x.old.release('write');
                const [old, recovery] = await Promise.all([x.old.finish(), result]);
                if (abortOld) {
                    assert.equal(old.code, 'OLD_ABORT'); assert.equal(recovery.value.sequence, 1); await verifyRecovered(x);
                } else {
                    assert.equal(old.result?.applied, true); assert.equal(recovery.error.reason, 'LEGACY_ALREADY_COMMITTED');
                    const state = await x.verify({ applied: true });
                    assert.equal(state.audits.filter(row => row.mutationSource === F.SOURCE).length, 0);
                    assert.ok(A.equal(state.audits.find(row => String(row._id) === String(x.reservation._id)), x.reservation));
                }
            } finally { mongoose.connection.getClient().off('commandStarted', monitor); }
        });

        await t.test('recovery: eight frozen documents preserve both approvals, all references and the original reservation', async st => {
            const x = await stranded(st, { multipleFrozenReferences: true });
            const before = await x.db.state(), references = await F.legacyFenceReferenceSummary(mongoose.connection, before.history);
            for (const row of before.history) {
                const matching = before.references.filter(doc => doc.frozen_snapshot.daily_results.some(result =>
                    String(result.effective_profile_istoriko_id) === String(row._id)));
                if (!matching.length) continue;
                assert.equal(matching.length, 8);
                assert.equal(references[String(row._id)].find(ref => ref.collection === 'Apasxoliseis_Period_Frozen_Snapshots').documentId,
                    matching.map(doc => String(doc._id)).sort()[0]);
            }
            const legacy = await audit.findById(x.ready.legacyAttemptId).lean();
            const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
            const original = { scope: x.db.scope, employeeId: x.db.employeeId, actorUserId: legacy.diagnostics.actorUserId,
                currentEmployee: before.employee, completeHistoryRows: before.history, protectedReferenceSummary: references };
            const proposal = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract')
                .buildCoordinatedSettlementProposal(original);
            assert.equal(S.buildEmployeeHistorySettlementApprovalFingerprint({ ...original, proposal }), x.ready.fingerprint);
            assert.equal(A.hash({ purpose: F.SOURCE, actorUserId: x.input.actorUserId, scope: x.input.scope,
                employeeId: x.input.employeeId, legacyAttemptId: x.input.legacyAttemptId, fingerprint: x.input.fingerprint,
                current: before.employee, history: A.ordered(before.history), references, legacy }),
                x.reservation.diagnostics.approvalFingerprint);
            const request = await recoveryRequest(x);
            assert.ok(A.equal(await x.db.state(), before));
            await F.completeLegacyFenceReservation(request);
            const saved = await verifyRecovered(x);
            assert.ok(A.equal(saved.references, before.references));
            assert.equal((await F.completeLegacyFenceReservation(request)).outcome, 'COMMITTED');
            assert.ok(A.equal(await x.db.state(), saved)); stale(await x.finishOld());
        });

        for (const mode of ['preview', 'complete', 'concurrent', 'rollback', 'uncertain', 'unauthorized', 'retry'])
        await t.test('isolated Admin HTTP: ' + mode, async st => {
            if (mongoose.connection.readyState !== 1)
                await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true });
            const x = await stranded(st, { multipleFrozenReferences: true, isolatedAdminRuntime: true, initialSequence: mode === 'complete' ? 2 : 0 });
            const fs = require('node:fs'), os = require('node:os'), net = require('node:net');
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-isolated-admin-http-'));
            fs.chmodSync(directory, 0o700);
            const environmentFile = path.join(directory, 'test-environment'), secret = 'isolated-ci-session-secret-never-application-secret';
            fs.writeFileSync(environmentFile, 'MONGODB_URL=' + uri + '\nSESSION_SECRET=' + secret + '\nDIARKEIA_SESSION=60\n', { mode: 0o600 });
            const reservationId = String(x.reservation._id), sessionId = require('node:crypto').randomUUID(), csrf = 'a'.repeat(64);
            const session = { userId: x.db.actorUserId, userTeam: 'THA', companyInUse: x.db.scope.company_kod,
                userRole: 'A', userStatus: 'A', lastActivity: Date.now(), cookie: { expires: new Date(Date.now() + 600000).toISOString() } };
            const sessions = mongoose.connection.db.collection('sessions');
            if (!await mongoose.connection.db.listCollections({ name: 'sessions' }).hasNext())
                await mongoose.connection.db.createCollection('sessions');
            await sessions.insertOne({ _id: sessionId, expires: new Date(Date.now() + 600000), session: JSON.stringify(session) });
            await sessions.insertOne({ _id: sessionId + '-expired', expires: new Date(0), session: JSON.stringify(session) });
            await sessions.insertOne({ _id: sessionId + '-company', expires: new Date(Date.now() + 600000),
                session: JSON.stringify({ ...session, companyInUse: 'f'.repeat(24) }) });
            const baseline = await x.db.state(), originalSession = await sessions.findOne({ _id: sessionId });
            const port = await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject);
                probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)); }); });
            const origin = 'http://localhost:' + port;
            const { createRequire } = require('node:module');
            const { Connection } = createRequire(require.resolve('mongoose'))('mongodb/lib/cmap/connection');
            const transport = Connection.prototype.command;
            let terminalInserted = false, injected = false;
            Connection.prototype.command = async function(ns, command) {
                const result = await transport.apply(this, arguments);
                if (mode === 'retry' && command.update === 'Ergazomenoi' && !injected) {
                    injected = true;
                    const error = new mongoose.mongo.MongoServerError({ message: 'ISOLATED_WRITE_CONFLICT', code: 112 });
                    error.addErrorLabel('TransientTransactionError'); throw error;
                }
                if (command.insert === 'Employee_History_Repair_Audit' && command.documents?.[0]?.mutationSource === F.SOURCE) {
                    terminalInserted = true;
                    if (mode === 'rollback') throw Error('ISOLATED_AUDIT_ACK_FAILURE');
                }
                if (mode === 'uncertain' && command.commitTransaction && terminalInserted && !injected) {
                    injected = true; throw Error('ISOLATED_LOST_COMMIT_ACK');
                }
                return result;
            };
            const actualUpdate = models.ErgazomenoiModel.updateOne;
            if (mode === 'unauthorized') models.ErgazomenoiModel.updateOne = async function(filter, update, options) {
                await models.ErgazomenoiModel.collection.updateOne(filter, { $set: { synolo_symbashs: 999 } }, { session: options.session });
                return actualUpdate.apply(this, arguments);
            };
            const runtime = await require('../../scripts/employeeHistoryIsolatedAdmin').startIsolatedAdmin({
                previewEnabled: true, completionEnabled: mode !== 'preview', settlementEnabled: false, origin,
                environmentFile, approvalDirectory: path.join(directory, 'approvals'), reservationId });
            let writes = 0;
            const monitor = event => { if (['insert', 'update', 'delete', 'findAndModify'].includes(event.commandName)) writes++; };
            mongoose.connection.getClient().on('commandStarted', monitor);
            const cookieFor = sid => 'connect.sid=' + encodeURIComponent('s:' + require('cookie-signature').sign(sid, secret)) +
                '; psifl.x-csrf-token=' + csrf;
            const headers = { Host: 'localhost:' + port, Origin: origin, Cookie: cookieFor(sessionId),
                'X-CSRF-Token': csrf, 'Content-Type': 'application/json' };
            async function post(route, patch = {}, payload = {}) {
                return new Promise((resolve, reject) => {
                    const request = require('node:http').request({ hostname: '127.0.0.1', port, path: route,
                        method: 'POST', headers: { ...headers, ...patch } }, response => {
                        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
                        response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(body) }); }
                            catch (error) { reject(error); } });
                    });
                    request.on('error', reject); request.end(JSON.stringify(payload));
                });
            }
            try {
                const response = await post('/recovery-preview');
                assert.equal(response.status, 200, JSON.stringify({ reason: response.body.reason })); assert.equal(response.body.outcome, 'RECOVERABLE');
                assert.equal(response.body.completionEnabled, mode !== 'preview'); assert.equal(response.body.recoveryFingerprint, undefined);
                for (const patch of [{ Origin: 'http://evil.invalid' }, { Host: '127.0.0.1:' + port },
                    { 'X-CSRF-Token': 'b'.repeat(64) }, { Cookie: cookieFor(sessionId + '-expired') },
                    { Cookie: cookieFor(sessionId + '-company') }, { Cookie: 'connect.sid=unsigned; psifl.x-csrf-token=' + csrf }])
                    assert.ok((await post('/recovery-preview', patch)).status >= 400);
                assert.ok(A.equal(await x.db.state(), baseline));
                assert.ok(A.equal(await sessions.findOne({ _id: sessionId }), originalSession));
                assert.equal(writes, 0);
                if (mode === 'preview') {
                    assert.equal(Object.hasOwn(response.body, 'approvalTicket'), false);
                    const approvalFiles = () => fs.readdirSync(path.join(directory, 'approvals'))
                        .filter(name => name.endsWith('.json'));
                    assert.deepEqual(approvalFiles(), [], 'preview-only mode must not issue approval files');
                    const blocked = await post('/recovery-complete');
                    assert.equal(blocked.status, 423);
                    assert.equal(blocked.body.reason, 'RECOVERY_COMPLETION_DISABLED');
                    assert.deepEqual(approvalFiles(), []);
                    assert.ok(A.equal(await x.db.state(), baseline));
                    assert.ok(A.equal(await sessions.findOne({ _id: sessionId }), originalSession));
                    assert.equal(writes, 0);
                    return;
                }
                assert.match(response.body.approvalTicket, /^[a-f0-9-]{36}$/);
                const ticketFile = path.join(directory, 'approvals', response.body.approvalTicket + '.json');
                assert.equal(fs.statSync(ticketFile).mode & 0o777, 0o600);
                assert.equal(fs.statSync(path.dirname(ticketFile)).mode & 0o777, 0o700);
                const ticket = JSON.parse(fs.readFileSync(ticketFile, 'utf8'));
                assert.match(ticket.fingerprint, /^[A-Za-z0-9_-]{43}$/);
                assert.notEqual(ticket.fingerprint, x.reservation.diagnostics.fingerprint);
                assert.equal(ticket.executionId, x.reservation.diagnostics.executionId);
                if (process.env.PAYROLL_ISOLATED_ADMIN_BROWSER_CHECK === 'true' && mode === 'complete') {
                    const browser = await require('playwright').chromium.launch({ headless: true });
                    try {
                        const context = await browser.newContext();
                        await context.addCookies([{ name: 'connect.sid', value: 's:' + require('cookie-signature').sign(sessionId, secret), url: origin, httpOnly: true },
                            { name: 'psifl.x-csrf-token', value: csrf, url: origin, httpOnly: true }]);
                        const page = await context.newPage(), errors = [];
                        page.on('pageerror', error => errors.push(error.message));
                        await page.goto(origin);
                        for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 },
                            { width: 640, height: 700 }, { width: 360, height: 640 }]) {
                            await page.setViewportSize(viewport);
                            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                            assert.equal(await page.locator('#complete').isDisabled(), true);
                        }
                        await page.locator('#preview').click();
                        await page.waitForFunction(() => document.getElementById('result').textContent.includes('RECOVERABLE'));
                        assert.equal(await page.locator('#complete').isEnabled(), true);
                        assert.deepEqual(errors, []);
                        assert.equal(writes, 0);
                    } finally { await browser.close(); }
                }
                const approval = { approvalTicket: response.body.approvalTicket, reservationId,
                    executionId: x.reservation.diagnostics.executionId, approvalConfirmed: true };
                {
                    assert.equal((await post('/recovery-complete', {}, { ...approval, approvalConfirmed: false })).status, 409);
                    const results = mode === 'concurrent' ? await Promise.all([
                        post('/recovery-complete', {}, approval), post('/recovery-complete', {}, approval)]) :
                        [await post('/recovery-complete', {}, approval)];
                    if (['complete', 'concurrent', 'retry'].includes(mode)) {
                        assert.equal(results.filter(r => r.status === 200 && r.body.outcome === 'COMMITTED').length, 1,
                            JSON.stringify(results.map(r => ({ status: r.status, reason: r.body.reason }))));
                        if (mode === 'retry') assert.equal(injected, true);
                        await verifyRecovered(x);
                    } else {
                        assert.equal(results[0].body.outcome, 'BLOCKED');
                        if (mode === 'uncertain') { assert.equal(injected, true); await verifyRecovered(x); }
                        else { assert.ok(A.equal(await x.db.state(), baseline));
                            if (mode === 'unauthorized') assert.equal(writes, 0, 'Denied business update never reaches commandStarted'); }
                    }
                    assert.equal((await post('/recovery-complete', {}, approval)).status, 409);
                    const after = await x.db.state();
                    assert.ok(A.equal(after.history, baseline.history)); assert.ok(A.equal(after.references, baseline.references));
                    assert.ok(A.equal(await sessions.findOne({ _id: sessionId }), originalSession));
                    const reconciled = await post('/recovery-preview');
                    assert.equal(reconciled.body.outcome,
                        ['complete', 'concurrent', 'uncertain', 'retry'].includes(mode) ? 'COMMITTED' : 'RECOVERABLE');
                    if (reconciled.body.outcome === 'RECOVERABLE')
                        assert.equal((await post('/recovery-complete', {}, { ...approval, approvalTicket: reconciled.body.approvalTicket })).status, 409);
                }
            } finally {
                mongoose.connection.getClient().off('commandStarted', monitor);
                await runtime.close();
                Connection.prototype.command = transport;
                models.ErgazomenoiModel.updateOne = actualUpdate;
            }
        });

    });
