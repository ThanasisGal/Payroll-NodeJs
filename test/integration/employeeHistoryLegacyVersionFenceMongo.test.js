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
        await mongoose.connect(uri, { autoIndex: false, autoCreate: false }); t.after(() => mongoose.disconnect());
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
            const db = await createMongoSettlementStore({ fixture: require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceB() });
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
                assert.ok(A.equal(business, before.employee));
                if (!applied) assert.ok(A.equal(after.history, before.history));
                const fences = after.audits.filter(row => row.mutationSource === SOURCE);
                const finals = after.audits.filter(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT');
                assert.equal(fences.length, fenced ? 1 : 0); assert.equal(finals.length, applied ? 1 : 0);
                assert.equal(sequence || 0, fenced || applied ? 1 : 0);
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

    });
