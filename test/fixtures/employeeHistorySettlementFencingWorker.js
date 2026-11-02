'use strict';

// Experiment only. Never import application configuration, models or writers.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { assertMongoTarget, assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const names = Object.freeze({ history: 'Settlement_Fencing_Experiment_History',
    outcomes: 'Settlement_Fencing_Experiment_Outcomes', audit: 'Settlement_Fencing_Experiment_Audit',
    grants: 'Settlement_Fencing_Experiment_Grants', marker: 'Settlement_Fencing_Experiment_Marker' });
const options = JSON.parse(process.argv[2]);
const executionId = randomUUID();
const queued = new Set(), waiters = new Map();
process.on('message', message => {
    if (waiters.has(message.release)) waiters.get(message.release)();
    else queued.add(message.release);
});
function barrier(key) {
    if (queued.delete(key)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('IPC_BARRIER_TIMEOUT:' + key)), 20000);
        waiters.set(key, () => { clearTimeout(timeout); waiters.delete(key); resolve(); });
    });
}
const send = value => process.send?.({ ...value, pid: process.pid, executionId });
const deny = reason => { throw Object.assign(Error(reason), { code: 'EXPERIMENT_' + reason }); };

(async () => {
    let connection, session, attempts = 0;
    const commands = [], failures = [];
    try {
        assertMongoTarget({ uri: process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI,
            ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE,
            job: process.env.GITHUB_JOB });
        assert.match(options.root, /^fencing-experiment-[a-f0-9-]{36}$/);
        assert.ok(['COMMITTED', 'FENCED', 'RECOVERY'].includes(options.mode));
        assert.ok(Number.isInteger(options.generation) && options.generation >= 0);
        connection = await new mongoose.Mongoose().createConnection(process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI,
            { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000, monitorCommands: true }).asPromise();
        assertMongoConnection(connection);
        const db = connection.db;
        session = await connection.startSession();
        const sessionKey = String(session.id.id);
        connection.getClient().on('commandStarted', event => {
            if (event.command.autocommit !== false) return;
            commands.push({ name: event.commandName, session: String(event.command.lsid?.id),
                txnNumber: String(event.command.txnNumber) });
            if (event.commandName === 'insert' && event.command.insert === names.outcomes)
                send({ event: 'terminal-command', attempt: attempts });
        });
        connection.getClient().on('commandFailed', event => {
            failures.push({ name: event.commandName, code: event.failure.code,
                labels: event.failure.errorLabels || [] });
        });
        const terminalId = options.root + ':generation:' + options.generation;
        await session.withTransaction(async () => {
            attempts++;
            const history = await db.collection(names.history).findOne({ _id: options.root }, { session });
            assert.ok(history);
            const terminal = await db.collection(names.outcomes).findOne({ _id: terminalId }, { session });
            send({ event: 'snapshot', attempt: attempts, sessionKey, terminal: terminal?.outcome || null });
            if (options.pauseSnapshot && attempts === 1) await barrier('snapshot');
            if (options.mode === 'RECOVERY') {
                if (terminal?.outcome !== 'FENCED') deny('PREDECESSOR_NOT_FENCED');
                await db.collection(names.grants).insertOne({ _id: options.root + ':successor:' + options.generation,
                    root: options.root, generation: options.generation + 1, executionId }, { session });
            } else {
                if (terminal) deny(terminal.outcome);
                // Both competitors must acquire the SAME unique key, inside their transaction.
                if (options.retryConflict) await db.collection(names.marker).updateOne({ _id: options.root },
                    { $inc: { revision: 1 } }, { session });
                await db.collection(names.outcomes).insertOne({ _id: terminalId, root: options.root,
                    generation: options.generation, outcome: options.mode, executionId }, { session });
                if (options.mode === 'COMMITTED') {
                    await db.collection(names.history).updateOne({ _id: options.root },
                        { $inc: { applications: 1 }, $set: { lastExecution: executionId } }, { session });
                    // One final audit for the ROOT approval, across every generation.
                    await db.collection(names.audit).insertOne({ _id: options.root + ':final', root: options.root,
                        generation: options.generation, terminalId, executionId }, { session });
                }
            }
            send({ event: 'written', attempt: attempts });
            if (options.pauseWritten && attempts === 1) await barrier('written');
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary',
            maxCommitTimeMS: 10000 });
        send({ event: 'result', ok: true, mode: options.mode, sessionKey, attempts, commands, failures });
    } catch (error) {
        send({ event: 'result', ok: false, mode: options.mode, attempts, commands, failures,
            code: error.code || null, message: error.message, labels: error.errorLabels || [] });
    } finally {
        await session?.endSession();
        await connection?.close();
        process.disconnect?.();
    }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
