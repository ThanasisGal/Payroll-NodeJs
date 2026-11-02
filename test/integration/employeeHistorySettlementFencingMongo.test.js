'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;
const names = Object.freeze({ history: 'Settlement_Fencing_Experiment_History',
    outcomes: 'Settlement_Fencing_Experiment_Outcomes', audit: 'Settlement_Fencing_Experiment_Audit',
    grants: 'Settlement_Fencing_Experiment_Grants', marker: 'Settlement_Fencing_Experiment_Marker' });

test('experiment worker refuses missing CI authorization before any MongoDB transaction', { timeout: 10000 }, async t => {
    const child = fork(path.join(__dirname, '../fixtures/employeeHistorySettlementFencingWorker.js'),
        [JSON.stringify({ root: 'fencing-experiment-' + randomUUID(), mode: 'COMMITTED', generation: 0 })],
        { env: {}, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    const exit = new Promise(resolve => child.once('exit', resolve));
    t.after(async () => { if (child.exitCode === null) child.kill(); await exit; });
    const result = await new Promise((resolve, reject) => {
        child.once('message', resolve);
        child.once('error', reject);
        child.once('exit', () => reject(Error('Worker exited before reporting target rejection: ' + stderr)));
    });
    assert.equal(await exit, 0, stderr);
    assert.equal(result.event, 'result');
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ERR_ASSERTION');
    assert.equal(result.attempts, 0);
    assert.deepEqual(result.commands, []);
});

// No local database fallback. A skip is explicitly NOT transaction evidence.
test('COMMITTED/FENCED experiment: independent Node processes on the guarded CI replica set',
    { skip: !uri, timeout: 180000 }, async t => {
        assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
            disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
        const mongoose = require('mongoose');
        const connection = await new mongoose.Mongoose().createConnection(uri,
            { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }).asPromise();
        t.after(() => connection.close());
        assertMongoConnection(connection);
        const db = connection.db;
        const hello = await db.admin().command({ hello: 1 });
        assert.equal(hello.setName, 'payrollDraftTest');
        assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
        assert.equal(hello.isWritablePrimary, true);
        assert.equal((await db.admin().command({ buildInfo: 1 })).version, '8.0.16');
        for (const name of Object.values(names)) {
            if (!await db.listCollections({ name }).hasNext()) await db.createCollection(name);
            const indexes = await db.collection(name).indexes();
            assert.ok(indexes.some(index => index.name === '_id_' && index.key._id === 1));
        }
        async function fixture() {
            const root = 'fencing-experiment-' + randomUUID();
            await db.collection(names.history).insertOne({ _id: root, applications: 0 }, { writeConcern: { w: 'majority' } });
            await db.collection(names.marker).insertOne({ _id: root, revision: 0 }, { writeConcern: { w: 'majority' } });
            return root;
        }
        function worker(st, options) {
            const child = fork(path.join(__dirname, '../fixtures/employeeHistorySettlementFencingWorker.js'),
                [JSON.stringify({ generation: 0, ...options })], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
            const messages = [], waiters = new Set();
            let stderr = '', exited = false, exitCode;
            child.stderr.on('data', chunk => { stderr += chunk.toString(); });
            child.stdout.resume();
            child.on('message', message => { messages.push(message); for (const wake of waiters) wake(); });
            const exit = new Promise(resolve => child.once('exit', code => {
                exited = true; exitCode = code; for (const wake of waiters) wake(); resolve(code);
            }));
            st.after(async () => { if (!exited) child.kill(); await exit; });
            function take(event, attempt) {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => { waiters.delete(check); reject(Error('IPC_TIMEOUT:' + event + ':' + stderr)); }, 25000);
                    function check() {
                        const index = messages.findIndex(message => message.event === event &&
                            (attempt === undefined || message.attempt === attempt));
                        if (index >= 0) { clearTimeout(timeout); waiters.delete(check); resolve(messages.splice(index, 1)[0]); }
                        else if (exited) { clearTimeout(timeout); waiters.delete(check); reject(Error('WORKER_EXIT:' + exitCode + ':' + stderr)); }
                    }
                    waiters.add(check); check();
                });
            }
            return { pid: child.pid, take, release: key => child.send({ release: key }), async finish() {
                const result = await take('result');
                assert.equal(await exit, 0, stderr);
                assert.equal(result.pid, child.pid);
                assert.notEqual(result.pid, process.pid);
                assert.ok(result.executionId);
                return result;
            } };
        }
        function independent(a, b, first, second) {
            assert.notEqual(a.pid, b.pid);
            assert.notEqual(first.executionId, second.executionId);
            const sessions = result => new Set(result.commands.map(command => command.session));
            assert.equal(sessions(first).size, 1);
            assert.equal(sessions(second).size, 1);
            assert.notDeepEqual([...sessions(first)], [...sessions(second)]);
        }
        function rejected(result) {
            assert.equal(result.ok, false, JSON.stringify(result));
            assert.ok([11000, 'EXPERIMENT_FENCED', 'EXPERIMENT_COMMITTED'].includes(result.code), JSON.stringify(result));
        }
        async function state(root) {
            const read = name => db.collection(name).find({ root }, { readConcern: { level: 'majority' } }).sort({ _id: 1 }).toArray();
            return { history: await db.collection(names.history).findOne({ _id: root }, { readConcern: { level: 'majority' } }),
                outcomes: await read(names.outcomes), audit: await read(names.audit), grants: await read(names.grants) };
        }
        async function verify(root, expectedOutcomes, applications, grants = 0) {
            const saved = await state(root);
            assert.deepEqual(saved.outcomes.map(row => row.outcome), expectedOutcomes);
            assert.equal(new Set(saved.outcomes.map(row => row._id)).size, saved.outcomes.length);
            assert.equal(saved.history.applications, applications);
            assert.equal(saved.audit.length, applications);
            assert.equal(saved.grants.length, grants);
            assert.ok(applications <= 1);
            if (!applications) assert.deepEqual(saved.history, { _id: root, applications: 0 });
            if (applications) {
                const audit = saved.audit[0];
                const terminal = saved.outcomes.find(row => row._id === audit.terminalId);
                assert.equal(terminal.outcome, 'COMMITTED');
                assert.equal(terminal.executionId, audit.executionId);
                assert.equal(saved.history.lastExecution, audit.executionId);
            }
            return saved;
        }
        function report(st, label, ...results) {
            st.diagnostic(label + ' ' + JSON.stringify(results.map(result => ({ pid: result.pid,
                executionId: result.executionId, mode: result.mode, ok: result.ok, code: result.code,
                attempts: result.attempts, failures: result.failures,
                transactions: [...new Set(result.commands.map(command => command.txnNumber))] }))));
        }

        await t.test('A: committed FENCED rejects the old transaction and rolls back all its writes', async st => {
            const root = await fixture();
            const old = worker(st, { root, mode: 'COMMITTED', pauseSnapshot: true });
            await old.take('snapshot', 1);
            const fence = worker(st, { root, mode: 'FENCED' });
            const fenced = await fence.finish(); assert.equal(fenced.ok, true);
            const before = await verify(root, ['FENCED'], 0);
            old.release('snapshot'); const late = await old.finish(); rejected(late);
            independent(old, fence, late, fenced);
            assert.deepEqual(await verify(root, ['FENCED'], 0), before);
            report(st, 'A', late, fenced);
        });
        await t.test('B: COMMITTED holds its unique key while the other process attempts FENCED', async st => {
            const root = await fixture();
            const old = worker(st, { root, mode: 'COMMITTED', pauseWritten: true });
            await old.take('written', 1);
            const fence = worker(st, { root, mode: 'FENCED' });
            await fence.take('terminal-command', 1);
            old.release('written');
            const [committed, blocked] = await Promise.all([old.finish(), fence.finish()]);
            assert.equal(committed.ok, true); rejected(blocked);
            independent(old, fence, committed, blocked);
            await verify(root, ['COMMITTED'], 1);
            report(st, 'B', committed, blocked);
        });
        await t.test('C: simultaneous terminal contenders leave exactly one complete transaction', async st => {
            const root = await fixture();
            const old = worker(st, { root, mode: 'COMMITTED', pauseSnapshot: true });
            const fence = worker(st, { root, mode: 'FENCED', pauseSnapshot: true });
            await Promise.all([old.take('snapshot', 1), fence.take('snapshot', 1)]);
            old.release('snapshot'); fence.release('snapshot');
            const [a, b] = await Promise.all([old.finish(), fence.finish()]);
            assert.equal([a, b].filter(result => result.ok).length, 1);
            rejected(a.ok ? b : a); independent(old, fence, a, b);
            await verify(root, [a.ok ? 'COMMITTED' : 'FENCED'], a.ok ? 1 : 0);
            report(st, 'C', a, b);
        });
        await t.test('D: old snapshot remains fenced even after a later generation has completed', async st => {
            const root = await fixture();
            const old = worker(st, { root, mode: 'COMMITTED', pauseSnapshot: true });
            await old.take('snapshot', 1);
            const fence = worker(st, { root, mode: 'FENCED' });
            const fenced = await fence.finish(); assert.equal(fenced.ok, true);
            const successor = worker(st, { root, mode: 'COMMITTED', generation: 1 });
            const applied = await successor.finish(); assert.equal(applied.ok, true);
            const before = await verify(root, ['FENCED', 'COMMITTED'], 1);
            old.release('snapshot'); const late = await old.finish(); rejected(late);
            independent(old, fence, late, fenced);
            assert.deepEqual(await verify(root, ['FENCED', 'COMMITTED'], 1), before);
            report(st, 'D', late, fenced, applied);
        });
        await t.test('E: a real write conflict makes the driver retry and re-read FENCED', async st => {
            const root = await fixture();
            const old = worker(st, { root, mode: 'COMMITTED', pauseSnapshot: true, retryConflict: true });
            await old.take('snapshot', 1);
            const fence = worker(st, { root, mode: 'FENCED', retryConflict: true });
            const fenced = await fence.finish(); assert.equal(fenced.ok, true);
            old.release('snapshot'); const retried = await old.finish(); rejected(retried);
            independent(old, fence, retried, fenced);
            assert.ok(retried.attempts >= 2, JSON.stringify(retried));
            assert.equal(retried.code, 'EXPERIMENT_FENCED');
            assert.ok(retried.failures.some(failure => failure.name === 'update' && failure.code === 112),
                JSON.stringify(retried.failures));
            assert.ok(new Set(retried.commands.map(command => command.txnNumber)).size >= 2);
            await verify(root, ['FENCED'], 0);
            assert.equal((await db.collection(names.marker).findOne({ _id: root })).revision, 1);
            report(st, 'E', retried, fenced);
        });
        await t.test('F: two recovery processes cannot create two successor grants', async st => {
            const root = await fixture();
            const fence = worker(st, { root, mode: 'FENCED' });
            assert.equal((await fence.finish()).ok, true);
            const before = await verify(root, ['FENCED'], 0);
            const a = worker(st, { root, mode: 'RECOVERY', pauseSnapshot: true });
            const b = worker(st, { root, mode: 'RECOVERY', pauseSnapshot: true });
            await Promise.all([a.take('snapshot', 1), b.take('snapshot', 1)]);
            a.release('snapshot'); b.release('snapshot');
            const [first, second] = await Promise.all([a.finish(), b.finish()]);
            assert.equal([first, second].filter(result => result.ok).length, 1);
            rejected(first.ok ? second : first); independent(a, b, first, second);
            const after = await verify(root, ['FENCED'], 0, 1);
            assert.deepEqual(after.audit, before.audit); assert.deepEqual(after.outcomes, before.outcomes);
            assert.equal(after.grants.length, 1); assert.equal(after.grants[0].generation, 1);
            assert.equal(after.grants[0].executionId, (first.ok ? first : second).executionId);
            report(st, 'F', first, second);
        });
        await t.test('G: root final-audit identity rolls back a second application in another generation', async st => {
            const root = await fixture();
            const a = worker(st, { root, mode: 'COMMITTED' });
            const first = await a.finish(); assert.equal(first.ok, true);
            const before = await verify(root, ['COMMITTED'], 1);
            const b = worker(st, { root, mode: 'COMMITTED', generation: 1 });
            const second = await b.finish(); rejected(second); assert.equal(second.code, 11000);
            independent(a, b, first, second);
            assert.deepEqual(await verify(root, ['COMMITTED'], 1), before);
            report(st, 'G', first, second);
        });
        await t.test('H: lost MongoDB commit acknowledgement is NOT PROVEN',
            { skip: 'No network-level commit acknowledgement fault injection is implemented' }, () => {});
    });
