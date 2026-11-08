'use strict';
// Real loopback HTTP, signed sessions, authorization, recovery engine, BSON
// sealing and verification. Only database repositories/transport are synthetic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const vm = require('node:vm'), crypto = require('node:crypto'), http = require('node:http');
const { once } = require('node:events'), { createRequire } = require('node:module');
const mongoose = require('mongoose'), { BSON, ObjectId } = mongoose.mongo;
const root = path.resolve(__dirname, '../..');
const servicePath = path.join(root, 'server/services/ergazomenoi');
const localRequire = createRequire(path.join(servicePath, 'employeeHistoryIndependentFenceVerifier.js'));
const A = localRequire('./employeeHistoryAutomaticReconstructionApplyContract');
const S = localRequire('./employeeHistoryAutomaticSettlementPreparationContract');
const U = localRequire('./employeeHistoryCoordinatedSettlementContract');
const P = localRequire('./employeeHistorySettlementProtocol');
const F = localRequire('./employeeHistoryLegacyFenceService');
const Security = localRequire('./employeeHistoryIsolatedAdminSecurity');
const SOURCE = F.SOURCE, secret = 'SYNTHETIC_ONLY_SIGNED_SESSION_SECRET';
const plain = value => BSON.deserialize(BSON.serialize({ value })).value;
const typed = value => BSON.deserialize(BSON.serialize({ value }), { promoteValues: false, promoteLongs: false }).value;
function values(row, parts) {
    if (!parts.length) return Array.isArray(row) ? row.flatMap(value => values(value, [])) : [row];
    if (Array.isArray(row)) return row.flatMap(value => values(value, parts));
    return values(row?.[parts[0]], parts.slice(1));
}
function matches(row, filter) {
    return Object.entries(filter).every(([key, wanted]) => key === '$or' ? wanted.some(item => matches(row, item)) :
        values(row, key.split('.')).some(value => wanted?.$in ? wanted.$in.some(item => String(item) === String(value)) :
            wanted?.$gt ? value > wanted.$gt : String(value) === String(wanted)));
}
async function harness(t, { completionEnabled = false, sealFailure = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-preview-without-ticket-'));
    fs.chmodSync(directory, 0o700);
    // Leave this run's private synthetic artifacts available for inspection.
    const fixture = require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceBWithInitialGap();
    fixture.scope.team = 'THA'; fixture.currentEmployee.team = 'THA';
    fixture.completeHistoryRows.forEach(row => { row.team = 'THA'; });
    const scope = fixture.scope, employee = fixture.currentEmployee;
    employee.employee_profile_mutation_sequence = 2;
    const history = A.ordered(fixture.completeHistoryRows), actorUserId = '700000000000000000000001';
    const actor = { _id: new ObjectId(actorUserId), team: 'THA', situation: 'A', privileges: 'A' };
    const references = Object.fromEntries(localRequire('./employeeHistoryReferenceDefinitionsService').SUPPORTED_COLLECTIONS.map(name => [name, []]));
    references.Prodhlomena_Oraria_Deviations = Array.from({ length: 18 }, (_, n) => ({
        _id: new ObjectId((100 + n).toString(16).padStart(24, '0')), ...scope,
        effective_profile_istoriko_id: history[n % history.length]._id, amount: 42 }));
    references.Apasxoliseis_Period_Frozen_Snapshots = Array.from({ length: 8 }, (_, n) => ({
        _id: new ObjectId((200 + n).toString(16).padStart(24, '0')), ...scope,
        frozen_snapshot: { daily_results: history.map(row => ({ effective_profile_istoriko_id: row._id })), amount: 123.45 } }));
    const state = { employee, history, references, audits: [] };
    const counters = { created: 0, consumed: 0, readTickets: 0, completion: 0, preview: 0, captures: 0, snapshots: 0, closedSnapshots: 0, databaseWrites: 0 };
    const sid = 'synthetic-signed-session', csrf = 'a'.repeat(64), expires = new Date(Date.now() + 600000);
    const sessionRow = { _id: sid, expires, session: JSON.stringify({ userId: actorUserId,
        userTeam: 'THA', userRole: 'A', userStatus: 'A', companyInUse: scope.company_kod,
        lastActivity: Date.now(), cookie: { expires: expires.toISOString() } }) };
    function rows(name) {
        if (name === 'Ergazomenoi') return [state.employee];
        if (name === 'Istoriko_Proslhpseon_Allagon') return state.history;
        if (name === 'Employee_History_Repair_Audit') return state.audits;
        if (name === 'sessions') return [sessionRow];
        return state.references[name] || [];
    }
    function collection(name, bson = false) {
        const copy = bson ? typed : plain;
        const forbidden = () => { counters.databaseWrites++; assert.fail('DATABASE_WRITE_FORBIDDEN'); };
        return { find(filter) { return { sort() { return this; }, limit() { return this; },
            async toArray() { return copy(rows(name).filter(row => matches(row, filter))); } }; },
        async findOne(filter, options = {}) { const row = rows(name).find(row => matches(row, filter));
            if (!row) return null;
            return copy(options.projection?._id && Object.keys(options.projection).length === 1 ? { _id: row._id } : row); },
        insertOne: forbidden, updateOne: forbidden, deleteOne: forbidden };
    }
    const connection = { name: 'synthetic', collection: name => collection(name),
        db: { admin: () => ({ command: async command => { assert.deepEqual(command, { hello: 1 });
            return { setName: 'synthetic', logicalSessionTimeoutMinutes: 30 }; } }) },
        async startSession() { return { withTransaction: async work => work(), endSession: async () => {} }; } };
    const query = read => ({ select() { return this; }, session() { return this; }, read() { return this; }, readConcern() { return this; },
        async lean() { return plain(read()); } });
    const deps = {
        employeeModel: { findOne: filter => query(() => matches(state.employee, filter) ? state.employee : null) },
        historyModel: { collection: collection('Istoriko_Proslhpseon_Allagon') },
        auditModel: { findById: id => query(() => state.audits.find(row => String(row._id) === String(id)) || null),
            findOne: filter => query(() => state.audits.find(row => matches(row, filter)) || null) },
        companyModel: { findOne: filter => query(() => filter._id === scope.company_kod && filter.team === scope.team ?
            { _id: new ObjectId(scope.company_kod), team: scope.team } : null) },
        userModel: { findById: id => query(() => id === actorUserId ? actor : null) },
        privilegeModel: { findOne: filter => query(() => filter.userId === actorUserId && filter.form === 'Ergazomenoi' ?
            { privileges: { admin: true } } : null) }
    };
    Object.values(deps).forEach(model => { model.db = connection; });
    const referenceSummary = await F.legacyFenceReferenceSummary(connection, history);
    const input = { scope, employeeId: String(employee._id), actorUserId, currentEmployee: employee,
        completeHistoryRows: history, protectedReferenceSummary: referenceSummary };
    const proposal = U.buildCoordinatedSettlementProposal(input);
    assert.equal(proposal.status, 'CLEAN'); assert.equal(proposal.noOp, false);
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
    const legacyAttemptId = P.rootId({ ...input, fingerprint });
    const base = { employeeScope: { ...scope, employee_id: employee._id }, currentBefore: employee,
        historyBefore: history, historyAfter: history, survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [] };
    const legacy = { _id: new ObjectId(legacyAttemptId), ...base, mutationSource: P.ATTEMPT,
        diagnostics: { scope, employeeId: input.employeeId, actorUserId, fingerprint } };
    const finalId = crypto.createHash('sha256').update(JSON.stringify([SOURCE, { ...scope, employee_id: input.employeeId },
        legacyAttemptId, fingerprint])).digest('hex').slice(0, 24);
    const reservationId = crypto.createHash('sha256').update(SOURCE + ':attempt:' + finalId).digest('hex').slice(0, 24);
    const approvalFingerprint = A.hash({ purpose: SOURCE, actorUserId, scope, employeeId: input.employeeId,
        legacyAttemptId, fingerprint, current: employee, history, references: referenceSummary, legacy });
    const reservation = { _id: new ObjectId(reservationId), ...base, mutationSource: SOURCE + '_ATTEMPT',
        diagnostics: { actorUserId, legacyAttemptId, fingerprint, approvalFingerprint, executionId: 'synthetic-original-execution' } };
    state.audits.push(legacy, reservation);
    const binding = { scope, employeeId: input.employeeId, actorUserId, legacyAttemptId, fingerprint, reservationId,
        executionId: reservation.diagnostics.executionId };
    class SyntheticMongoClient {
        constructor(uri) { assert.equal(uri, 'synthetic:no-network'); this.options = { hosts: ['synthetic'], replicaSet: 'synthetic' }; }
        async connect() { counters.snapshots++; }
        async close() { counters.closedSnapshots++; }
        startSession() { return { withTransaction: async work => work(), endSession: async () => {} }; }
        db() { return { databaseName: 'synthetic', collection: name => collection(name, true) }; }
    }
    const filesystem = sealFailure ? { ...fs, fsyncSync() { throw Error('SYNTHETIC_SEAL_FAILURE'); } } : fs;
    const verifierModule = { exports: {} };
    const verifierFile = path.join(servicePath, 'employeeHistoryIndependentFenceVerifier.js');
    vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(verifierFile, 'utf8') + '\n})', { filename: verifierFile })(
        name => name === 'mongoose' ? { mongo: { ...mongoose.mongo, MongoClient: SyntheticMongoClient } } :
            name === 'node:fs' ? filesystem : localRequire(name), verifierModule, verifierModule.exports);
    const verifier = { ...verifierModule.exports, async captureFenceVerificationEvidence(options) {
        counters.captures++; return verifierModule.exports.captureFenceVerificationEvidence(options); } };
    const verificationOptions = { uri: 'synthetic:no-network', binding, directory, secret, repositoryRoot: root,
        expectedHistoryCount: history.length, expectedProtectedCount: 26, expectedPreviousSequence: 2 };
    const realStore = localRequire('./employeeHistoryRecoveryApprovalStore').createRecoveryApprovalStore({ directory,
        repositoryRoot: root, sessionSecret: secret });
    const store = { ...realStore, save(input) { counters.created++; return realStore.save(input); },
        readUnconsumed(input) { counters.readTickets++; return realStore.readUnconsumed(input); },
        consume() { counters.consumed++; assert.fail('TICKET_CONSUMPTION_FORBIDDEN'); } };
    const express = require('express'), app = express();
    app.use(express.json());
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const port = server.address().port, origin = 'http://127.0.0.1:' + port;
    const originalConnect = require('node:net').Socket.prototype.connect;
    t.mock.method(require('node:net').Socket.prototype, 'connect', function(...args) {
        const options = Array.isArray(args[0]) ? args[0][0] : args[0];
        assert.equal(Number(options.port), port, 'only this synthetic HTTP server may receive a connection');
        assert.equal(options.host || options.hostname, '127.0.0.1');
        return originalConnect.apply(this, args);
    });
    t.mock.method(mongoose, 'connect', () => assert.fail('REAL_DATABASE_CONNECT_FORBIDDEN'));
    let failure;
    app.use((req, res, next) => { try { Security.validateRequestBoundary(req, origin); next(); }
        catch (error) { failure(res, error.reason); } });
    const context = { legacyFenceEnabled: true, legacyRecoveryIsolated: true, legacyFenceCreationDisabled: true,
        legacyRecoveryPreviewOnly: completionEnabled !== true, deps };
    const activation = { contextFor: req => req.socket.server === server ? context : null };
    const source = fs.readFileSync(path.join(root, 'scripts/employeeHistoryIsolatedAdmin.js'), 'utf8');
    const failureSource = source.slice(source.indexOf('function failure('), source.indexOf('function installReadOnlyCommandGuard'));
    const authSource = source.slice(source.indexOf('async function authenticate('), source.indexOf("app.get('/',"));
    const routes = source.slice(source.indexOf("app.post('/recovery-preview',"), source.indexOf("app.use((req, res) => failure(res, 'OPERATION_DISABLED'"));
    const sandbox = { require: createRequire(path.join(root, 'scripts/employeeHistoryIsolatedAdmin.js')),
        app, Security, activation, db: { collection: name => collection(name) }, secret, binding, scope,
        env: {}, mongoose: { connection }, verifier, verificationOptions, store,
        config: completionEnabled === 'omitted' ? {} : { completionEnabled },
        F: { ...F, async previewLegacyFenceRecovery(input) { counters.preview++; return F.previewLegacyFenceRecovery(input); },
            completeLegacyFenceReservation() { counters.completion++; assert.fail('COMPLETION_FORBIDDEN'); } } };
    vm.runInNewContext(failureSource + '\n' + authSource + '\n' + routes + '\nthis.failure = failure;', sandbox);
    failure = sandbox.failure;
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf,
        Cookie: 'connect.sid=' + encodeURIComponent('s:' + require('cookie-signature').sign(sid, secret)) + '; psifl.x-csrf-token=' + csrf };
    function post(route = '/recovery-preview', body = {}, override = {}) {
        return new Promise((resolve, reject) => {
            const request = http.request(origin + route, { method: 'POST', headers: { ...headers, ...override } }, response => {
                let bytes = ''; response.on('data', chunk => { bytes += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(bytes), text: bytes }));
            }); request.on('error', reject); request.end(JSON.stringify(body));
        });
    }
    return { post, state, actor, binding, directory, counters, realStore, verificationOptions, verifier, referenceSummary,
        file: path.join(directory, reservationId + '.pre-fence-evidence.bson'),
        async committed() {
            // Construct an already committed image, never invoke a writer or consume a ticket.
            await verifier.captureFenceVerificationEvidence(verificationOptions);
            state.employee = { ...plain(employee), employee_profile_mutation_sequence: 3 };
            state.audits.push({ _id: new ObjectId(finalId), ...plain(base), mutationSource: SOURCE, repairedAt: new Date(),
                diagnostics: { ...reservation.diagnostics, previousSequence: 2, sequence: 3, requiresNewIndependentApproval: true,
                    historyHash: A.hash(history), referencesHash: A.hash(referenceSummary), legacyHash: A.hash(legacy) } });
            const ticketId = '00000000-0000-4000-8000-000000000001';
            const ticket = { version: 1, purpose: 'LEGACY_FENCE_RECOVERY', reservationId, executionId: binding.executionId,
                actorUserId, scope, fingerprint: A.hash({ purpose: SOURCE + '_RECOVERY', reservation, approvalFingerprint }) };
            fs.writeFileSync(path.join(directory, ticketId + '.json'), JSON.stringify(ticket), { mode: 0o600 });
            fs.writeFileSync(path.join(directory, reservationId + '.completion-requested.json'), JSON.stringify({ version: 1,
                reservationId, executionId: binding.executionId, actorUserId, ticketId, requestedAt: new Date().toISOString() }), { mode: 0o600 });
        } };
}
function noApprovals(h) {
    assert.equal(h.counters.created, 0, 'read-only preview must never call approvalStore.save');
    assert.equal(h.counters.consumed, 0); assert.equal(h.counters.readTickets, 0);
    assert.equal(h.counters.completion, 0); assert.equal(h.counters.databaseWrites, 0);
    assert.deepEqual(fs.readdirSync(h.directory).filter(name => name.endsWith('.json')), []);
}
test('regression: real signed HTTP RECOVERABLE preview must not create or persist an approval without completion capability', async t => {
    const h = await harness(t), before = BSON.serialize(h.state);
    const response = await h.post();
    assert.equal(response.status, 200); assert.equal(response.body.outcome, 'RECOVERABLE');
    t.diagnostic('approvalStore.save calls=' + h.counters.created + '; approval files=' + fs.readdirSync(h.directory).filter(name => name.endsWith('.json')).length);
    noApprovals(h);
    assert.equal(response.body.completionEnabled, false);
    assert.equal(response.body.evidenceIntegrityVerified, true);
    assert.equal(h.counters.preview, 1); assert.equal(h.counters.snapshots, 2);
    assert.equal(h.counters.closedSnapshots, 2);
    assert.ok(BSON.serialize(h.state).equals(before));
    assert.deepEqual(Object.keys(response.body).sort(), ['completionEnabled', 'evidenceIntegrityVerified', 'fingerprintPreserved',
        'outcome', 'requiresSeparateApproval', 'reservationId', 'sequence'].sort());
    for (const privateValue of [secret, h.binding.fingerprint, h.binding.executionId, h.directory, 'currentBefore', 'historyBefore'])
        assert.equal(response.text.includes(privateValue), false);
});
test('omitting the server completion setting defaults to read-only preview with zero approvals', async t => {
    const h = await harness(t, { completionEnabled: 'omitted' });
    const response = await h.post(); assert.equal(response.status, 200);
    assert.equal(response.body.completionEnabled, false); assert.equal(response.body.evidenceIntegrityVerified, true);
    assert.equal((await h.post('/recovery-complete', { approvalConfirmed: true })).status, 423); noApprovals(h);
});
test('sealed BSON integrity is independently checked, repeat preview creates zero approvals, tampering fails closed', async t => {
    const h = await harness(t);
    assert.equal((await h.post()).body.outcome, 'RECOVERABLE');
    const bytes = fs.readFileSync(h.file), payload = bytes.subarray(32);
    assert.ok(crypto.timingSafeEqual(crypto.createHmac('sha256', secret).update(payload).digest(), bytes.subarray(0, 32)));
    const saved = BSON.deserialize(payload);
    assert.ok(A.equal(saved.state.employee, h.state.employee));
    assert.ok(A.equal(saved.state.history, h.state.history), 'the sealed snapshot must retain every physical hire/profile record');
    assert.equal(Object.values(saved.state.references).reduce((n, rows) => n + rows.length, 0), 26);
    assert.equal(fs.statSync(h.file).mode & 0o777, 0o600);
    assert.equal((await h.post()).body.outcome, 'RECOVERABLE'); assert.ok(fs.readFileSync(h.file).equals(bytes));
    bytes[bytes.length - 2] ^= 1; fs.writeFileSync(h.file, bytes);
    assert.equal((await h.post()).body.outcome, 'BLOCKED'); noApprovals(h);
});
test('failed sealing leaves neither a completed bundle nor an approval', async t => {
    const h = await harness(t, { sealFailure: true });
    assert.equal((await h.post()).status, 409); assert.deepEqual(fs.readdirSync(h.directory), []); noApprovals(h);
});
test('BLOCKED real recovery evidence never creates approvals', async t => {
    const h = await harness(t); h.state.employee.employee_profile_mutation_sequence = 99;
    assert.equal((await h.post()).body.outcome, 'BLOCKED'); noApprovals(h);
});
test('COMMITTED real recovery preview independently verifies existing evidence without issuing another approval', async t => {
    const h = await harness(t); await h.committed();
    const before = fs.readdirSync(h.directory).map(name => [name, fs.readFileSync(path.join(h.directory, name))]);
    const response = await h.post();
    assert.equal(response.body.outcome, 'COMMITTED'); assert.equal(response.body.independentlyVerified, true);
    assert.equal(Object.hasOwn(response.body, 'approvalTicket'), false);
    assert.equal(h.counters.created, 0); assert.equal(h.counters.consumed, 0); assert.equal(h.counters.completion, 0);
    for (const [name, bytes] of before) assert.ok(fs.readFileSync(path.join(h.directory, name)).equals(bytes));
});
test('client completion flags, queries and fingerprint cannot enable ticket issuance or completion', async t => {
    const h = await harness(t);
    for (const body of [{ completionEnabled: true }, { approvalConfirmed: true }, { recoveryFingerprint: 'r'.repeat(43) },
        { config: { completionEnabled: true } }]) assert.equal((await h.post('/recovery-preview', body)).status, 409);
    for (const query of ['completionEnabled=true', 'completionEnabled=false', 'approvalConfirmed=true'])
        assert.equal((await h.post('/recovery-preview?' + query)).status, 409);
    assert.equal((await h.post('/recovery-complete?completionEnabled=true', { completionEnabled: true,
        approvalConfirmed: true, recoveryFingerprint: 'r'.repeat(43) })).status, 423);
    assert.equal(h.counters.preview, 0); noApprovals(h);
});
test('unsigned session and non-Admin authorization fail before real preview or evidence capture', async t => {
    const h = await harness(t);
    assert.equal((await h.post('/recovery-preview', {}, { Cookie: 'connect.sid=unsigned; psifl.x-csrf-token=' + 'a'.repeat(64) })).status, 409);
    h.actor.privileges = 'S'; assert.equal((await h.post()).status, 409);
    assert.equal(h.counters.preview, 0); assert.equal(h.counters.captures, 0); noApprovals(h);
});
test('Gate 4 server-enabled preview retains real private ticket/session/reservation/execution/fingerprint contract', async t => {
    const h = await harness(t, { completionEnabled: true });
    const response = await h.post(); assert.equal(response.body.outcome, 'RECOVERABLE');
    assert.equal(response.body.completionEnabled, true); assert.equal(response.body.requiresSeparateApproval, true);
    const ticket = h.realStore.readUnconsumed({ id: response.body.approvalTicket, sessionId: 'synthetic-signed-session',
        reservationId: h.binding.reservationId, actorUserId: h.binding.actorUserId, scope: h.binding.scope });
    const reservation = h.state.audits.find(row => String(row._id) === h.binding.reservationId);
    assert.equal(ticket.executionId, h.binding.executionId);
    assert.equal(ticket.fingerprint, A.hash({ purpose: SOURCE + '_RECOVERY', reservation,
        approvalFingerprint: reservation.diagnostics.approvalFingerprint }));
    assert.equal(h.counters.created, 1); assert.equal(h.counters.captures, 1);
    assert.equal((await h.post('/recovery-complete', { approvalTicket: response.body.approvalTicket,
        reservationId: h.binding.reservationId, executionId: h.binding.executionId, approvalConfirmed: false })).status, 409);
    assert.equal(h.counters.consumed, 0); assert.equal(h.counters.completion, 0);
});
