'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const signature = require('cookie-signature');
const S = require('../../server/services/ergazomenoi/employeeHistoryIsolatedAdminSecurity');
const { createRecoveryApprovalStore } = require('../../server/services/ergazomenoi/employeeHistoryRecoveryApprovalStore');
const secret = 'isolated-unit-secret-for-session-signatures';
const caseBinding = { actorUserId: 'a'.repeat(24), reservationId: 'b'.repeat(24),
    scope: { team: 'THA', company_kod: 'c'.repeat(24), kodikos: 'test' } };
const csrf = 'd'.repeat(64), origin = 'http://localhost:5039';
const session = () => ({ userId: caseBinding.actorUserId, userTeam: 'THA', companyInUse: caseBinding.scope.company_kod,
    userRole: 'A', userStatus: 'A', lastActivity: Date.now(), cookie: { expires: new Date(Date.now() + 600000).toISOString() } });
function request(patch = {}) {
    return { method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: {
        host: 'localhost:5039', origin, 'x-csrf-token': csrf,
        cookie: 'connect.sid=' + encodeURIComponent('s:' + signature.sign('unit-session', secret)) + '; psifl.x-csrf-token=' + csrf,
        ...patch } };
}
test('isolated preview defaults off; settlement stays closed and completion requires a boolean startup switch', async () => {
    const { startIsolatedAdmin } = require('../../scripts/employeeHistoryIsolatedAdmin');
    await assert.rejects(() => startIsolatedAdmin({}), /ISOLATED_PREVIEW_DISABLED/);
    await assert.rejects(() => startIsolatedAdmin({ previewEnabled: true, settlementEnabled: true }), /RELEASE_GATE_INCOMPLETE/);
    await assert.rejects(() => startIsolatedAdmin({ previewEnabled: true, completionEnabled: 'true' }), /INVALID_COMPLETION_ACTIVATION/);
    assert.equal(Object.keys(require.cache).some(file => file === path.resolve('app.js')), false);
});
for (const value of ['http://localhost:5000', 'http://localhost:5025', 'http://0.0.0.0:5039',
    'http://example.com:5039', 'https://localhost:5039', 'http://localhost:5039/'])
test('isolated origin rejects ' + value, () => assert.throws(() => S.validateAddress(value)));
test('exact Host/Origin and existing custom CSRF cookie/header are required', () => {
    S.validateRequestBoundary(request(), origin);
    for (const patch of [{ host: '127.0.0.1:5039' }, { origin: 'http://evil.example' }, { origin: undefined },
        { 'x-csrf-token': undefined }, { 'x-csrf-token': 'e'.repeat(64) }, { cookie: '' }])
        assert.throws(() => S.validateRequestBoundary(request(patch), origin));
    const remote = request(); remote.socket.remoteAddress = '192.0.2.1';
    assert.throws(() => S.validateRequestBoundary(remote, origin));
    assert.equal(S.constantEqual('é', 'x'), false);
});
test('existing signed session is read-only and bound to the initial Admin and company', async () => {
    let reads = 0;
    const value = session();
    const db = { collection(name) { assert.equal(name, 'sessions'); return { async findOne(query, options) {
        reads++; assert.equal(query._id, 'unit-session'); assert.equal(options.readConcern.level, 'majority');
        return { session: JSON.stringify(value), expires: new Date(Date.now() + 600000) };
    } }; } };
    const input = { req: request(), db, secret, caseBinding };
    assert.equal((await S.authenticateExistingSession(input)).sid, 'unit-session');
    assert.equal(reads, 1);
    await assert.rejects(() => S.authenticateExistingSession({ ...input, req: request({ cookie: 'connect.sid=unsigned' }) }));
    await assert.rejects(() => S.authenticateExistingSession({ ...input, secret: secret + '-other' }));
    for (const patch of [{ userId: 'f'.repeat(24) }, { companyInUse: 'f'.repeat(24) }, { userRole: 'S' },
        { userStatus: 'X' }, { userTeam: 'OTHER' }, { lastActivity: Date.now() - 3600001 },
        { cookie: { expires: new Date(0).toISOString() } }]) {
        const changed = { ...value, ...patch };
        await assert.rejects(() => S.authenticateExistingSession({ ...input,
            db: { collection() { return { findOne: async () => ({ session: JSON.stringify(changed), expires: new Date(Date.now() + 600000) }) }; } } }));
    }
    await assert.rejects(() => S.authenticateExistingSession({ ...input,
        db: { collection() { return { findOne: async () => null }; } } }));
});
test('private fingerprint survives store reopening and cannot move between sessions, Admins or companies', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-approval-boundary-'));
    fs.chmodSync(directory, 0o700);
    const config = { directory, repositoryRoot: path.resolve(__dirname, '../..'), sessionSecret: secret };
    const store = createRecoveryApprovalStore(config), fingerprint = 'F'.repeat(43);
    const input = { ...caseBinding, sessionId: 'unit-session', fingerprint,
        executionId: 'original-execution', expiresAt: new Date(Date.now() + 600000) };
    const id = store.save(input), file = path.join(directory, id + '.json');
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(createRecoveryApprovalStore(config).read({ id, ...input }).fingerprint, fingerprint);
    for (const patch of [{ sessionId: 'other' }, { actorUserId: 'f'.repeat(24) },
        { reservationId: 'f'.repeat(24) }, { scope: { ...caseBinding.scope, company_kod: 'f'.repeat(24) } }])
        assert.throws(() => store.read({ id, ...input, ...patch }));
    fs.chmodSync(file, 0o644); assert.throws(() => store.read({ id, ...input }));
    fs.chmodSync(file, 0o600); fs.unlinkSync(file); assert.throws(() => store.read({ id, ...input }));
    fs.rmdirSync(directory);
});
test('private approval directory rejects repository storage and permissive permissions', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-approval-mode-'));
    const config = { directory, repositoryRoot: path.resolve(__dirname, '../..'), sessionSecret: secret };
    fs.chmodSync(directory, 0o755); assert.throws(() => createRecoveryApprovalStore(config));
    fs.chmodSync(directory, 0o700);
    assert.throws(() => createRecoveryApprovalStore({ ...config, repositoryRoot: directory }));
    fs.rmdirSync(directory);
});
test('read-only guard rejects writes before transport, without relying on autocommit', async () => {
    const { createRequire } = require('node:module'), mongoose = require('mongoose');
    const { Connection } = createRequire(require.resolve('mongoose'))('mongodb/lib/cmap/connection');
    const original = Connection.prototype.command, sent = [];
    Connection.prototype.command = async (ns, command) => { sent.push(Object.keys(command)[0]); return { ok: 1 }; };
    const restore = require('../../scripts/employeeHistoryIsolatedAdmin').installReadOnlyCommandGuard(mongoose);
    try {
        for (const command of [{ update: 'Ergazomenoi' }, { insert: 'sessions' }, { delete: 'Employee_History_Repair_Audit' },
            { createIndexes: 'sessions' }, { aggregate: 'x', pipeline: [{ $out: 'y' }] }])
            assert.throws(() => Connection.prototype.command({ db: 'unit' }, command, { session: { inTransaction: () => true } }));
        await Connection.prototype.command({ db: 'unit' }, { find: 'sessions' }, {});
        assert.deepEqual(sent, ['find']);
    } finally { restore(); Connection.prototype.command = original; }
});


test('ticket consumption is append-only, survives reopening and excludes another ticket for the same reservation', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-ticket-consume-'));
    fs.chmodSync(directory, 0o700);
    const config = { directory, repositoryRoot: path.resolve(__dirname, '../..'), sessionSecret: secret };
    const store = createRecoveryApprovalStore(config), input = { ...caseBinding, sessionId: 'unit-session',
        fingerprint: 'F'.repeat(43), executionId: 'same-execution', expiresAt: new Date(Date.now() + 600000) };
    const id = store.save(input), other = store.save(input);
    assert.equal(store.consume({ ...input, id }).executionId, 'same-execution');
    assert.throws(() => createRecoveryApprovalStore(config).consume({ ...input, id }), /RECOVERY_ALREADY_REQUESTED/);
    assert.throws(() => store.consume({ ...input, id: other }), /RECOVERY_ALREADY_REQUESTED/);
    assert.equal(fs.statSync(path.join(directory, caseBinding.reservationId + '.completion-requested.json')).mode & 0o777, 0o600);
});

test('completion guard permits only the exact transactional sequence and rejects incomplete commits before transport', async () => {
    const { createRequire } = require('node:module'), mongoose = require('mongoose');
    const { Connection } = createRequire(require.resolve('mongoose'))('mongodb/lib/cmap/connection');
    const transport = Connection.prototype.command, sent = [], client = {};
    Connection.prototype.command = async (ns, command) => { sent.push(Object.keys(command)[0]); return { ok: 1 }; };
    const guard = require('../../server/services/ergazomenoi/employeeHistoryRecoveryWriteGuard')
        .installRecoveryWriteGuard({ connection: { getClient: () => client } });
    const id = new mongoose.Types.ObjectId(), historyId = new mongoose.Types.ObjectId();
    const plan = { database: 'unit', scope: { team: 'THA', company_kod: 'c'.repeat(24), kodikos: 'unit' },
        employeeCollection: 'Ergazomenoi', historyCollection: 'Istoriko_Proslhpseon_Allagon', auditCollection: 'Employee_History_Repair_Audit',
        current: { _id: id }, history: [{ _id: historyId }], finalAudit: { _id: new mongoose.Types.ObjectId(), mutationSource: 'EXPECTED_FINAL' } };
    const session = { client, transaction: {}, inTransaction: () => true };
    const send = command => Connection.prototype.command({ db: 'unit' }, command, { session });
    const employee = { update: plan.employeeCollection, updates: [{ q: { ...plan.scope, _id: id }, u: { $inc: { employee_profile_mutation_sequence: 1 } } }] };
    const history = u => ({ update: plan.historyCollection, updates: [{ q: { ...plan.scope, _id: historyId }, u }] });
    try {
        assert.throws(() => send(employee));
        await guard.run(plan, async () => {
            assert.throws(() => send(history({ $inc: { history_reference_fence: 1 } })));
            assert.throws(() => send({ update: plan.employeeCollection, updates: [{ q: { ...plan.scope, _id: id }, u: { $set: { salary: 999 } } }] }));
            assert.equal(sent.length, 0);
            await send(employee);
            assert.throws(() => send({ commitTransaction: 1 }));
            assert.throws(() => send(employee));
            await send(history({ $inc: { history_reference_fence: 1 } }));
            await send(history({ $unset: { history_reference_fence: 1 } }));
            assert.throws(() => send({ insert: plan.auditCollection, documents: [{ ...plan.finalAudit, mutationSource: 'NEW_RESERVATION', repairedAt: new Date() }] }));
            assert.throws(() => send({ insert: plan.auditCollection, documents: [{ ...plan.finalAudit, repairedAt: new Date('invalid') }] }));
            await send({ insert: plan.auditCollection, documents: [{ ...plan.finalAudit, repairedAt: new Date() }] });
            await send({ commitTransaction: 1 });
            assert.throws(() => send(employee));
            session.transaction = {}; // Driver callback retry has an independent ledger.
            await send(employee);
        });
        assert.throws(() => send(employee));
        assert.deepEqual(sent, ['update', 'update', 'update', 'insert', 'commitTransaction', 'update']);
    } finally { guard.restore(); Connection.prototype.command = transport; }
});

test('expired ticket cannot acquire the persistent completion marker', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-ticket-expiry-'));
    fs.chmodSync(directory, 0o700);
    const store = createRecoveryApprovalStore({ directory, repositoryRoot: path.resolve(__dirname, '../..'), sessionSecret: secret });
    const input = { ...caseBinding, sessionId: 'unit-session', fingerprint: 'F'.repeat(43),
        executionId: 'same-execution', expiresAt: new Date(Date.now() + 600000) };
    const id = store.save(input), file = path.join(directory, id + '.json');
    const evidence = JSON.parse(fs.readFileSync(file, 'utf8')); evidence.expiresAt = new Date(0).toISOString();
    fs.writeFileSync(file, JSON.stringify(evidence));
    assert.throws(() => store.consume({ ...input, id }), /APPROVAL_EVIDENCE_CHANGED/);
    assert.equal(fs.existsSync(path.join(directory, caseBinding.reservationId + '.completion-requested.json')), false);
});
