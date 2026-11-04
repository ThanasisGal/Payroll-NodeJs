'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const vm = require('node:vm'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const mongoose = require('mongoose'), { BSON } = mongoose.mongo;
const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'server/services/ergazomenoi/employeeHistoryIndependentFenceVerifier.js');
const localRequire = createRequire(filename);
const A = localRequire('./employeeHistoryAutomaticReconstructionApplyContract');
const D = localRequire('./employeeHistoryReferenceDefinitionsService');
const SOURCE = 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE';
const clone = value => BSON.deserialize(BSON.serialize({ value }), { promoteValues: false, promoteLongs: false }).value;
const plain = value => BSON.deserialize(BSON.serialize({ value })).value;
const id = n => new BSON.ObjectId(n.toString(16).padStart(24, '0'));

function fixture(large = false) {
    const scope = { team: 'SYNTHETIC', company_kod: String(id(1)), kodikos: 'SYNTHETIC' };
    const binding = { scope, reservationId: String(id(2)), employeeId: String(id(3)),
        actorUserId: String(id(4)), legacyAttemptId: String(id(5)),
        executionId: '00000000-0000-4000-8000-000000000001', fingerprint: 'f'.repeat(43) };
    const typed = () => ({ oid: id(6), date: new Date('2026-01-01T12:34:56.789Z'),
        int: new BSON.Int32(7), long: BSON.Long.fromString('9007199254740993'), double: new BSON.Double(7),
        decimal: BSON.Decimal128.fromString('123.4500'), binary: new BSON.Binary(Buffer.from([1, 2, 3]), 128),
        oldBinary: new BSON.Binary(Buffer.from([4, 5]), 2), nil: null,
        nested: [[null, new BSON.Double(-0)], [id(7), new Date('2026-02-02')]] });
    const employee = { _id: id(3), ...scope, employee_profile_mutation_sequence: new BSON.Int32(2) };
    const history = Array.from({ length: 3 }, (_, n) => ({ _id: id(10 + n), ...scope, typed: typed() }));
    const references = Object.fromEntries(D.SUPPORTED_COLLECTIONS.map(name => [name, []]));
    references.Prodhlomena_Oraria_Deviations = Array.from({ length: 18 }, (_, n) =>
        ({ _id: id(100 + n), ...scope, effective_profile_istoriko_id: history[n % 3]._id, typed: typed() }));
    references.Apasxoliseis_Period_Frozen_Snapshots = Array.from({ length: 8 }, (_, n) =>
        ({ _id: id(200 + n), ...scope, frozen_snapshot: { daily_results: history.map(row =>
            ({ effective_profile_istoriko_id: row._id })), typed: typed(),
        syntheticPayload: large ? 'Ω'.repeat(1536 * 1024) : 'SYNTHETIC', tail: n } }));
    const base = { employeeScope: { ...scope, employee_id: employee._id }, currentBefore: employee,
        historyBefore: history, historyAfter: history, survivingHistoryIds: history.map(row => String(row._id)),
        deletedLegacyHistoryIds: [] };
    const legacy = { _id: id(5), ...base, mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT',
        diagnostics: { fingerprint: binding.fingerprint } };
    const reservation = { _id: id(2), ...base, mutationSource: SOURCE + '_ATTEMPT', diagnostics: {
        executionId: binding.executionId, actorUserId: binding.actorUserId, legacyAttemptId: binding.legacyAttemptId,
        fingerprint: binding.fingerprint, approvalFingerprint: 'a'.repeat(43) } };
    return { binding, state: { employee, history, references, audits: [reservation, legacy] } };
}

function harness(t, { large = false, filesystem = fs } = {}) {
    t.mock.method(require('node:net').Socket.prototype, 'connect', () => assert.fail('NETWORK_FORBIDDEN_IN_SYNTHETIC_BSON_TEST'));
    const data = fixture(large), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-bson-synthetic-'));
    fs.chmodSync(directory, 0o700);
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    let state = data.state, connections = 0, closed = 0;
    // Only the transport is synthetic. The actual snapshot/capture/seal/unseal/verifier
    // source executes unchanged, and no MongoDB or application is started.
    class SyntheticMongoClient {
        constructor(uri) { assert.equal(uri, 'synthetic:no-network');
            this.options = { hosts: ['synthetic'], replicaSet: 'synthetic' }; }
        async connect() { connections++; }
        async close() { closed++; }
        startSession() { return { withTransaction: async fn => fn(), endSession: async () => {} }; }
        db() { return { databaseName: 'synthetic', collection(name) {
            const rows = name === 'Employee_History_Repair_Audit' ? state.audits :
                name === 'Istoriko_Proslhpseon_Allagon' ? state.history : state.references[name];
            return { find() { assert.ok(rows); return { sort() { return this; }, limit() { return this; },
                async toArray() { return rows; } }; },
            async findOne(query, options) { return name === 'Ergazomenoi' ? state.employee :
                rows?.length ? options.projection ? { _id: rows[0]._id } : rows[0] : null; } };
        } }; }
    }
    const module = { exports: {} };
    const requireIsolated = name => name === 'mongoose' ? { mongo: { ...mongoose.mongo, MongoClient: SyntheticMongoClient } } :
        name === 'node:fs' ? filesystem : localRequire(name);
    vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })
        (requireIsolated, module, module.exports);
    const options = { uri: 'synthetic:no-network', binding: data.binding, directory,
        repositoryRoot: root, secret: 'SYNTHETIC_SECRET_FOR_OFFLINE_TESTS', expectedHistoryCount: 3,
        expectedProtectedCount: 26, expectedPreviousSequence: 2 };
    const file = path.join(directory, data.binding.reservationId + '.pre-fence-evidence.bson');
    return { ...data, directory, options, file, verifier: module.exports,
        setState(value) { state = value; }, counts() { return { connections, closed }; } };
}

test('regression: real capture/seal preserves a 3 History / 18 Deviations / 8 Frozen BSON bundle above 17 MiB', async t => {
    const h = harness(t, { large: true });
    try {
        const result = await h.verifier.captureFenceVerificationEvidence(h.options);
        assert.equal(result.outcome, 'BASELINE_PRESERVED');
        assert.ok(fs.statSync(h.file).size > 17 * 1024 * 1024);
        const saved = BSON.deserialize(fs.readFileSync(h.file).subarray(32), { promoteValues: false, promoteLongs: false });
        for (const name of D.SUPPORTED_COLLECTIONS)
            h.state.references[name].forEach((row, n) => assert.ok(BSON.serialize(row).equals(BSON.serialize(saved.state.references[name][n]))));
        t.diagnostic('sealedBytes=' + fs.statSync(h.file).size + '; defaultScratchBytes=' + 17 * 1024 * 1024);
    } catch (error) {
        // Frames only: never inspect application values, signatures or fingerprints.
        t.diagnostic([error.name, error.code || '', ...String(error.stack).split('\n').filter(line => /^\s+at /.test(line))].join('\n'));
        assert.fail('REAL_CAPTURE_SEAL_FAILED: ' + error.name + ' / ' + (error.code || 'NO_CODE'));
    }
});

test('exact BSON round-trip, 26 protected documents, private permissions and unchanged read-only preview', async t => {
    const h = harness(t), before = BSON.serialize(h.state);
    await h.verifier.captureFenceVerificationEvidence(h.options);
    const bytes = fs.readFileSync(h.file);
    const signature = crypto.createHmac('sha256', h.options.secret).update(bytes.subarray(32)).digest();
    assert.ok(crypto.timingSafeEqual(signature, bytes.subarray(0, 32)));
    const saved = BSON.deserialize(bytes.subarray(32), { promoteValues: false, promoteLongs: false });
    const restored = Object.fromEntries(Object.keys(h.state).map(key => [key, saved.state[key]]));
    assert.ok(BSON.serialize(restored).equals(before), 'every field and BSON type remains byte-exact');
    assert.ok(A.equal(plain(saved.binding), h.binding));
    for (const name of D.SUPPORTED_COLLECTIONS)
        h.state.references[name].forEach((row, n) => assert.ok(BSON.serialize(row).equals(BSON.serialize(saved.state.references[name][n]))));
    assert.equal(fs.statSync(h.directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(h.file).mode & 0o777, 0o600);
    assert.equal(fs.statSync(h.file).nlink, 1);
    await h.verifier.captureFenceVerificationEvidence(h.options);
    assert.ok(fs.readFileSync(h.file).equals(bytes));
    assert.ok(BSON.serialize(h.state).equals(before));
    const result = await h.verifier.verifyLegacyFenceIndependently(h.options);
    assert.equal(result.reason, 'MUTATION_SEQUENCE_MISMATCH', 'actual verifier unseals baseline; no completion occurred');
    assert.deepEqual(h.counts(), { connections: 3, closed: 3 });
});

for (const mode of ['tampered', 'truncated', 'empty']) test('actual verifier rejects ' + mode + ' evidence', async t => {
    const h = harness(t);
    await h.verifier.captureFenceVerificationEvidence(h.options);
    const bytes = fs.readFileSync(h.file);
    if (mode === 'tampered') bytes[bytes.length - 2] ^= 1;
    fs.writeFileSync(h.file, mode === 'truncated' ? bytes.subarray(0, bytes.length - 7) : mode === 'empty' ? Buffer.alloc(0) : bytes);
    assert.equal((await h.verifier.verifyLegacyFenceIndependently(h.options)).reason, 'VERIFICATION_EVIDENCE_CHANGED');
    await assert.rejects(h.verifier.captureFenceVerificationEvidence(h.options));
});

function previewHandler(h, store) {
    const source = fs.readFileSync(path.join(root, 'scripts/employeeHistoryIsolatedAdmin.js'), 'utf8');
    const start = source.indexOf("app.post('/recovery-preview',");
    const end = source.indexOf("app.post('/recovery-complete',", start);
    assert.ok(start > 0 && end > start);
    let handler;
    vm.runInNewContext(source.slice(start, end), {
        app: { post(route, fn) { assert.equal(route, '/recovery-preview'); handler = fn; } },
        authenticate: async () => ({ identity: { session: { userId: h.binding.actorUserId },
            sid: 'SYNTHETIC_SESSION', expiresAt: new Date(Date.now() + 600000) }, context: {} }),
        F: { previewLegacyFenceRecovery: async () => ({ outcome: 'RECOVERABLE', recoveryFingerprint: 'r'.repeat(43), sequence: 2 }),
            completeLegacyFenceReservation() { assert.fail('completion forbidden'); } },
        mongoose: { connection: {} }, scope: h.binding.scope, binding: h.binding,
        verifier: h.verifier, verificationOptions: h.options, store, config: { completionEnabled: false },
        failure: (res, reason, status) => res.status(status).json({ outcome: 'BLOCKED', reason })
    });
    return async () => { const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
        await handler({ body: {} }, res); return res; };
}

test('real read-only preview handler repeated: no ticket creation/consumption, no new reservation/audit, unchanged sequence', async t => {
    const h = harness(t), before = BSON.serialize(h.state);
    const realStore = localRequire('./employeeHistoryRecoveryApprovalStore').createRecoveryApprovalStore({
        directory: h.directory, repositoryRoot: root, sessionSecret: h.options.secret });
    let created = 0, consumed = 0;
    const post = previewHandler(h, { ...realStore,
        save() { created++; assert.fail('read-only approval creation forbidden'); },
        consume() { consumed++; assert.fail('consumption forbidden'); } });
    const first = await post(), second = await post();
    assert.equal(first.body.outcome, 'RECOVERABLE'); assert.equal(second.body.outcome, 'RECOVERABLE');
    for (const response of [first, second]) {
        assert.equal(Object.hasOwn(response.body, 'approvalTicket'), false);
        assert.equal(response.body.evidenceIntegrityVerified, true);
    }
    assert.equal(created, 0);
    assert.equal(fs.readdirSync(h.directory).filter(name => name.endsWith('.json')).length, 0);
    assert.equal(consumed, 0); assert.ok(BSON.serialize(h.state).equals(before));
    assert.equal(fs.readdirSync(h.directory).filter(name => name.endsWith('.completion-requested.json')).length, 0);
});

for (const mode of ['partial-write', 'zero-write', 'silent-short', 'file-fsync', 'directory-fsync']) test('disk failure ' + mode + ' leaves no completed evidence or ticket', async t => {
    let writes = 0;
    const filesystem = { ...fs,
        writeSync(fd, bytes, offset, length, position) {
            if (mode === 'zero-write') return 0;
            if (mode === 'partial-write' && writes++) throw Object.assign(Error('SYNTHETIC_DISK_FULL'), { code: 'ENOSPC' });
            if (mode === 'silent-short') { fs.writeSync(fd, bytes, offset, Math.min(length, 73), position); return length; }
            return fs.writeSync(fd, bytes, offset, Math.min(length, 73), position);
        },
        fsyncSync(fd) { if ((mode === 'file-fsync' && fs.fstatSync(fd).isFile()) ||
            (mode === 'directory-fsync' && fs.fstatSync(fd).isDirectory())) throw Object.assign(Error('SYNTHETIC_IO'), { code: 'EIO' });
            return fs.fsyncSync(fd); }
    };
    const h = harness(t, { filesystem }), before = BSON.serialize(h.state);
    let tickets = 0;
    const post = previewHandler(h, { save() { tickets++; assert.fail('ticket forbidden after failed evidence'); } });
    const result = await post();
    assert.equal(result.statusCode, 409); assert.equal(result.body.outcome, 'BLOCKED');
    assert.equal(tickets, 0); assert.equal(fs.existsSync(h.file), false);
    assert.equal(fs.readdirSync(h.directory).length, 0);
    assert.ok(BSON.serialize(h.state).equals(before));
});

test('short positive writes are completed before publication', async t => {
    let writes = 0;
    const h = harness(t, { filesystem: { ...fs, writeSync(fd, bytes, offset, length, position) {
        writes++; return fs.writeSync(fd, bytes, offset, Math.min(length, 73), position);
    } } });
    assert.equal((await h.verifier.captureFenceVerificationEvidence(h.options)).outcome, 'BASELINE_PRESERVED');
    assert.ok(writes > 1);
    assert.equal((await h.verifier.verifyLegacyFenceIndependently(h.options)).reason, 'MUTATION_SEQUENCE_MISMATCH');
});

test('failed directory sync plus failed rollback remains unreadable as completed evidence', async t => {
    const filesystem = { ...fs, fsyncSync(fd) {
        if (fs.fstatSync(fd).isDirectory()) throw Object.assign(Error('SYNTHETIC_IO'), { code: 'EIO' });
        return fs.fsyncSync(fd);
    }, unlinkSync(file) {
        if (file.endsWith('.pre-fence-evidence.bson')) throw Object.assign(Error('SYNTHETIC_ACCESS'), { code: 'EACCES' });
        return fs.unlinkSync(file);
    } };
    const h = harness(t, { filesystem });
    let tickets = 0;
    const response = await previewHandler(h, { save() { tickets++; assert.fail('ticket forbidden'); } })();
    assert.equal(response.body.outcome, 'BLOCKED'); assert.equal(tickets, 0);
    assert.equal(fs.statSync(h.file).nlink, 2);
    assert.equal((await h.verifier.verifyLegacyFenceIndependently(h.options)).reason, 'PRIVATE_VERIFICATION_EVIDENCE_REQUIRED');
    await assert.rejects(h.verifier.captureFenceVerificationEvidence(h.options));
});

test('evidence publication never overwrites a concurrently created baseline', async t => {
    const sentinel = Buffer.from('SYNTHETIC_EXISTING_BASELINE');
    const h = harness(t, { filesystem: { ...fs, linkSync(from, to) {
        fs.writeFileSync(to, sentinel, { mode: 0o600, flag: 'wx' });
        return fs.linkSync(from, to);
    } } });
    await assert.rejects(h.verifier.captureFenceVerificationEvidence(h.options), { code: 'EEXIST' });
    assert.ok(fs.readFileSync(h.file).equals(sentinel));
    assert.equal(fs.readdirSync(h.directory).length, 1);
});

test('actual independent verifier accepts sealed evidence for a preconstructed committed synthetic fixture', async t => {
    const h = harness(t, { large: true });
    await h.verifier.captureFenceVerificationEvidence(h.options);
    const before = BSON.deserialize(fs.readFileSync(h.file).subarray(32), { promoteValues: false, promoteLongs: false }).state;
    const reservation = before.audits.find(row => String(row._id) === h.binding.reservationId);
    const legacy = before.audits.find(row => String(row._id) === h.binding.legacyAttemptId);
    const finalId = crypto.createHash('sha256').update(JSON.stringify([SOURCE,
        { ...h.binding.scope, employee_id: h.binding.employeeId }, h.binding.legacyAttemptId, h.binding.fingerprint])).digest('hex').slice(0, 24);
    // This is input to a synthetic read transport, never an audit insert or a completion call.
    const after = clone(h.state);
    after.employee.employee_profile_mutation_sequence = new BSON.Int32(3);
    after.audits.push({ ...clone(reservation), _id: new BSON.ObjectId(finalId), mutationSource: SOURCE,
        repairedAt: new Date(), diagnostics: { ...reservation.diagnostics, previousSequence: 2, sequence: 3,
            requiresNewIndependentApproval: true, referencesHash: A.hash(plain(before.referenceSummary)),
            historyHash: A.hash(plain(before.history)), legacyHash: A.hash(plain(legacy)) } });
    h.setState(after);
    const ticketId = '00000000-0000-4000-8000-000000000002';
    fs.writeFileSync(path.join(h.directory, ticketId + '.json'), JSON.stringify({ version: 1, purpose: 'LEGACY_FENCE_RECOVERY',
        ...h.binding, fingerprint: A.hash({ purpose: SOURCE + '_RECOVERY', reservation: plain(reservation),
            approvalFingerprint: reservation.diagnostics.approvalFingerprint }) }), { mode: 0o600 });
    fs.writeFileSync(path.join(h.directory, h.binding.reservationId + '.completion-requested.json'), JSON.stringify({
        version: 1, ticketId, reservationId: h.binding.reservationId, executionId: h.binding.executionId,
        actorUserId: h.binding.actorUserId, requestedAt: new Date().toISOString() }), { mode: 0o600 });
    const result = await h.verifier.verifyLegacyFenceIndependently(h.options);
    assert.equal(result.outcome, 'COMMITTED', result.reason);
    assert.equal(result.protectedDocumentCount, 26); assert.equal(result.ticketMarkerVerified, true);
});
