'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const { assertMongoTarget, assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const options = JSON.parse(process.argv[2]);
const queued = new Set(), waiting = new Map();
process.on('message', m => { if (waiting.has(m.release)) waiting.get(m.release)(); else queued.add(m.release); });
function barrier(key) { if (queued.delete(key)) return Promise.resolve(); return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('BARRIER_TIMEOUT:' + key)), 20000);
    waiting.set(key, () => { clearTimeout(timer); waiting.delete(key); resolve(); });
}); }
const send = data => process.send({ ...data, pid: process.pid });
(async () => {
    let attempts = 0;
    const commands = [], failures = [];
    try {
        assertMongoTarget({ uri: process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI, ci: process.env.GITHUB_ACTIONS,
            disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
        const root = options.mode === 'OLD' ? options.oldRoot : path.resolve(__dirname, '../..');
        const load = file => require(path.join(root, file));
        const W = load('server/services/ergazomenoi/employeeEmploymentProfileWriter');
        const S = load('server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
        const U = load('server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
        const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = load('server/models/ergazomenoi');
        const audit = load('server/models/employeeHistoryRepairAudit');
        await mongoose.connect(process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI, { autoIndex: false, autoCreate: false, monitorCommands: true });
        assertMongoConnection(mongoose.connection);
        mongoose.connection.getClient().on('commandStarted', event => {
            if (event.command.autocommit === false) commands.push({ name: event.commandName,
                session: String(event.command.lsid.id), txn: String(event.command.txnNumber) });
            if (options.mode === 'FENCE' && event.commandName === 'update' && event.command.update === E.collection.name)
                send({ event: 'fence-command' });
        });
        mongoose.connection.getClient().on('commandFailed', event => failures.push({ name: event.commandName,
            code: event.failure.code, labels: event.failure.errorLabels || [] }));
        const { scope, employeeId, actorUserId } = options;
        const refs = load('server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences;
        const context = { mode: 'NORMAL', deps: { connection: mongoose.connection, capabilityProbe: W.transactionCapability,
            employeeModel: E, historyModel: H, auditModel: audit,
            companyModel: load('server/models/companies').CompaniesModel, userModel: load('server/models/userModel'),
            privilegeModel: load('server/models/privileges').UserPrivilegesModel, referenceChecker: refs,
            auditCollectionChecker: load('server/services/ergazomenoi/employeeHistoryRepairAuditSetupService').employeeHistoryRepairAuditCollectionExists },
            readAudits: session => audit.find({ 'employeeScope.employee_id': employeeId, mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT' }).session(session).lean(),
            async referenceSummary(rows, session) { const result = {}; for (const row of rows)
                result[String(row._id)] = await refs({ connection: mongoose.connection, historyIds: [String(row._id)], session }); return result; }
        };
        if (options.mode === 'OLD') {
            // All business and transaction code comes byte-for-byte from #358.
            // Only dependency registration and scheduling barriers are injected.
            load('server/services/ergazomenoi/employeeHistorySettlementDevActivation').settlementContext = () => context;
            context.claimExecution = args => load('server/services/ergazomenoi/employeeHistorySettlementNormalActivation')
                .claimNormalSettlementAttempt({ ...args, auditModel: audit });
            const current = await E.findOne({ ...scope, _id: employeeId }).select('+employee_profile_mutation_sequence').lean();
            const rows = await H.collection.find(scope).toArray();
            const input = { scope, employeeId, actorUserId, currentEmployee: current,
                completeHistoryRows: rows, protectedReferenceSummary: await context.referenceSummary(rows) };
            const proposal = U.buildCoordinatedSettlementProposal(input);
            assert.equal(proposal.status, 'CLEAN'); assert.equal(proposal.noOp, false);
            const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
            const claimId = 'legacy-' + process.pid;
            await context.claimExecution({ scope, employeeId, actorUserId, fingerprint, claimId,
                currentEmployee: current, completeHistoryRows: rows });
            // Simulate the SAME in-flight invocation's stable claim across driver retries.
            const claim = await audit.findOne({ 'diagnostics.claimId': claimId }).lean();
            context.claimExecution = args => load('server/services/ergazomenoi/employeeHistorySettlementNormalActivation')
                .claimNormalSettlementAttempt({ ...args, claimId, auditModel: audit });
            send({ event: 'ready', fingerprint, legacyAttemptId: String(claim._id) });
            await barrier('start');
            let readPaused = false;
            context.deps.employeeModel = new Proxy(E, { get(target, key) {
                if (key === 'findOne') return (...args) => {
                    const q = E.findOne(...args), lean = q.lean.bind(q);
                    q.lean = async (...a) => { const row = await lean(...a);
                        if (options.pauseRead && !readPaused) { readPaused = true; send({ event: 'read' }); await barrier('read'); }
                        return row; }; return q;
                };
                if (key === 'updateOne') return async (...args) => {
                    const result = await E.updateOne(...args);
                    if (options.pauseWrite && attempts === 1) { send({ event: 'write' }); await barrier('write');
                        if (options.abortOld) throw Object.assign(Error('OLD_ABORT'), { code: 'OLD_ABORT' }); }
                    return result;
                };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            const startSession = mongoose.connection.startSession.bind(mongoose.connection);
            context.deps.connection = new Proxy(mongoose.connection, { get(target, key) {
                if (key === 'startSession') return async (...args) => { const session = await startSession(...args);
                    const tx = session.withTransaction.bind(session);
                    session.withTransaction = (callback, opts) => tx(async (...a) => { attempts++; return callback(...a); }, opts);
                    return session; };
                const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
            } });
            const result = await W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: {}, scope, employeeId, actorUserId,
                approval: { confirmed: true, fingerprint }, coordinated: true, now: new Date('2026-11-02T07:33:00Z') });
            send({ event: 'result', ok: true, result, attempts, commands, failures });
        } else {
            send({ event: 'ready' }); await barrier('start');
            const result = await require('./employeeHistoryLegacyFenceAdmin').fenceLegacyApproval({ connection: mongoose.connection,
                context, ...options, onWritten: options.pauseFence ? async () => { send({ event: 'write' }); await barrier('write'); } : undefined });
            send({ event: 'result', ok: true, result, commands, failures });
        }
    } catch (error) { send({ event: 'result', ok: false, code: error.code, message: error.message, attempts, commands, failures }); }
    finally { await mongoose.disconnect(); process.disconnect(); }
})().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
