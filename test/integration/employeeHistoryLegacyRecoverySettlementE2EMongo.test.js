'use strict';
// Real isolated MongoDB/HTTP chain. Fixture construction is synthetic; all
// approvals, authorization, transactions, write fences and audit are real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const mongoose = require('mongoose');
const { URI, assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;
test('Gate 4 complete Legacy Recovery -> independent Fence -> NORMAL v2 Settlement -> independent CLEAN/noOp',
    { skip: !uri, timeout: 180000 }, async t => {
    assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
    t.after(() => mongoose.disconnect());
    const V = require('../../server/services/ergazomenoi/employeeHistoryIndependentFenceVerifier');
    const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const P = require('../../server/services/ergazomenoi/employeeHistorySettlementProtocol');
    const F = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
    const R = require('../../server/services/ergazomenoi/employeeHistorySettlementReferenceEvidence');
    const E = require('../../server/models/ergazomenoi'), audit = require('../../server/models/employeeHistoryRepairAudit');
        async function setup() {
            await mongoose.connect(uri, { autoIndex: false, autoCreate: false }); assertMongoConnection(mongoose.connection);
            for (const model of [E.ErgazomenoiModel, E.IstorikoProslhpseonAllagonModel, audit,
                require('../../server/models/companies').CompaniesModel, require('../../server/models/userModel'),
                require('../../server/models/privileges').UserPrivilegesModel]) await model.createCollection();
            for (const name of require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService').SUPPORTED_COLLECTIONS)
                if (!await mongoose.connection.db.listCollections({ name }).hasNext()) await mongoose.connection.db.createCollection(name);
            const fixture = require('../fixtures/employeeHistoryCoordinatedSettlementFixture').acceptanceBWithInitialGap();
            fixture.scope.team = 'THA'; fixture.currentEmployee.team = 'THA';
            for (const row of fixture.completeHistoryRows) row.team = 'THA';
            const db = await require('../fixtures/employeeHistorySettlementMongoStore').createMongoSettlementStore({ fixture, enriched: false, executionMode: 'NORMAL', settlementReferenceEvidence: true, referenceCopies: 0 });
            await require('../../server/models/companies').CompaniesModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(db.scope.company_kod) }, { $set: { kod: '0004' } });
            await db.changeEmployee({ employee_profile_mutation_sequence: 2 });
            const frozen = mongoose.connection.db.collection('Apasxoliseis_Period_Frozen_Snapshots');
            const initial = await db.state();
            const daily = initial.history.map(row => ({ kodikos: db.scope.kodikos, effective_profile_istoriko_id: row._id }));
            await frozen.insertMany(Array.from({ length: 8 }, (_, index) => ({ ...db.scope, _id: new mongoose.Types.ObjectId(),
                request_id: crypto.randomUUID(), ypokatasthma: '0000', period_start: new Date(Date.UTC(2026, index, 1)), period_end: new Date(Date.UTC(2026, index + 1, 0)),
                historical_reconstruction_version: 0,
                frozen_snapshot: { finalized: true, amount: 123.45, hours: 8, daily_results: daily } })));
            const state = await db.state(); assert.equal(state.history.length, 4); assert.equal(state.references.length, 8);
            await mongoose.connection.db.collection('Prodhlomena_Oraria_Deviations').insertMany(Array.from({ length: 18 }, (_, index) =>
                ({ _id: new mongoose.Types.ObjectId(), ...db.scope, effective_profile_istoriko_id: state.history[index === 0 ? 0 : 1]._id, amount: 42 })));
            const history = A.ordered(state.history), references = await F.legacyFenceReferenceSummary(mongoose.connection, history);
            const input = { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
                currentEmployee: state.employee, completeHistoryRows: history, protectedReferenceSummary: references };
            const proposal = U.buildCoordinatedSettlementProposal(input);
            assert.equal(proposal.status, 'CLEAN'); assert.equal(proposal.noOp, false);
            const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
            const legacyAttemptId = P.rootId({ ...input, fingerprint });
            await audit.create([{ _id: legacyAttemptId, employeeScope: { ...db.scope, employee_id: db.employeeId },
                currentBefore: state.employee, historyBefore: history, historyAfter: history,
                survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [], mutationSource: P.ATTEMPT,
                diagnostics: { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, fingerprint, claimId: 'isolated-verifier-fixture' } }]);
            const legacy = await audit.findById(legacyAttemptId).lean();
            const finalId = crypto.createHash('sha256').update(JSON.stringify([F.SOURCE,
                { ...db.scope, employee_id: db.employeeId }, legacyAttemptId, fingerprint])).digest('hex').slice(0, 24);
            const reservationId = crypto.createHash('sha256').update(F.SOURCE + ':attempt:' + finalId).digest('hex').slice(0, 24);
            const executionId = crypto.randomUUID(), approvalFingerprint = A.hash({ purpose: F.SOURCE,
                actorUserId: db.actorUserId, scope: db.scope, employeeId: db.employeeId, legacyAttemptId, fingerprint,
                current: state.employee, history, references, legacy });
            await audit.create([{ _id: reservationId, employeeScope: { ...db.scope, employee_id: db.employeeId },
                currentBefore: state.employee, historyBefore: history, historyAfter: history,
                survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [], mutationSource: F.SOURCE + '_ATTEMPT',
                diagnostics: { executionId, actorUserId: db.actorUserId, legacyAttemptId, fingerprint, approvalFingerprint } }]);
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-independent-verifier-')); fs.chmodSync(directory, 0o700);
            const secret = 'independent-verifier-isolated-session-secret', environmentFile = path.join(directory, 'environment');
            fs.writeFileSync(environmentFile, 'MONGODB_URL=' + uri + '\nSESSION_SECRET=' + secret + '\n', { mode: 0o600 });
            const sid = crypto.randomUUID(), csrf = 'a'.repeat(64), expires = new Date(Date.now() + 600000);
            await mongoose.connection.db.collection('sessions').insertOne({ _id: sid, expires, session: JSON.stringify({
                userId: db.actorUserId, userRole: 'A', userStatus: 'A', userTeam: 'THA', companyInUse: db.scope.company_kod,
                lastActivity: Date.now(), cookie: { expires: expires.toISOString() } }) });
            const port = await new Promise(resolve => { const probe = require('node:net').createServer();
                probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); }); });
            const origin = 'http://localhost:' + port, approvalDirectory = path.join(directory, 'approvals');
            const runtime = await require('../../scripts/employeeHistoryIsolatedAdmin').startIsolatedAdmin({
                previewEnabled: true, completionEnabled: true, origin, environmentFile, approvalDirectory, reservationId,
                expectedHistoryCount: 4, expectedProtectedCount: 26, expectedPreviousSequence: 2 });
            function post(route, body = {}) { return new Promise((resolve, reject) => {
                const request = require('node:http').request({ hostname: '127.0.0.1', port, path: route, method: 'POST', headers: {
                    Host: 'localhost:' + port, Origin: origin, Cookie: 'connect.sid=' + encodeURIComponent('s:' + require('cookie-signature').sign(sid, secret)) +
                    '; psifl.x-csrf-token=' + csrf, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' } }, response => {
                    let bytes = ''; response.on('data', chunk => { bytes += chunk; });
                    response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(bytes) }); } catch (error) { reject(error); } }); });
                request.on('error', reject); request.end(JSON.stringify(body));
            }); }
            const binding = { reservationId, scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
                legacyAttemptId, fingerprint, executionId };
            const options = { uri, binding, directory: approvalDirectory, secret, repositoryRoot: path.resolve(__dirname, '../..'), expectedPreviousSequence: 2 };
            return { runtime, post, options, finalId, state, binding, db, directory, secret, sid, csrf, port, origin, approvalDirectory };
        }
    async function independent(x) {
        assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
        const client = new mongoose.mongo.MongoClient(URI, { monitorCommands: true, retryWrites: false });
        let writes = 0;
        client.on('commandStarted', event => { if (['insert','update','delete','findAndModify'].includes(event.commandName)) writes++; });
        try {
            await client.connect(); const session = client.startSession(); let result;
            try { await session.withTransaction(async () => {
                const db = client.db(), o = { session }, b = x.binding;
                const employee = await db.collection('Ergazomenoi').findOne({ ...b.scope, _id: new mongoose.Types.ObjectId(b.employeeId) }, o);
                const history = await db.collection('Istoriko_Proslhpseon_Allagon').find(b.scope, o).sort({ _id: 1 }).toArray();
                const audits = await db.collection('Employee_History_Repair_Audit').find({ 'employeeScope.employee_id': new mongoose.Types.ObjectId(b.employeeId) }, o).sort({ _id: 1 }).toArray();
                const references = {};
                for (const name of require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService').SUPPORTED_COLLECTIONS)
                    references[name] = await db.collection(name).find(b.scope, { ...o, raw: true }).sort({ _id: 1 }).toArray();
                const sessions = await db.collection('sessions').findOne({ _id: x.sid }, o);
                const summary = await R.referenceSummary({ collection: name => db.collection(name) }, history, session);
                const input = { scope: b.scope, employeeId: b.employeeId, actorUserId: b.actorUserId,
                    currentEmployee: employee, completeHistoryRows: history, protectedReferenceSummary: summary };
                result = { employee, history, audits, references, sessions, input, proposal: U.buildCoordinatedSettlementProposal(input) };
            }, P.transactionOptions); } finally { await session.endSession(); }
            assert.equal(writes, 0, 'Independent verification never writes'); return result;
        } finally { await client.close(); }
    }
    async function recover(x) {
        const before = await independent(x), preview = await x.post('/recovery-preview');
        assert.equal(preview.body.outcome, 'RECOVERABLE', JSON.stringify(preview));
        assert.equal(preview.body.requiresSeparateApproval, true);
        const ticket = JSON.parse(fs.readFileSync(path.join(x.approvalDirectory, preview.body.approvalTicket + '.json')));
        const reservation = before.audits.find(row => String(row._id) === x.binding.reservationId);
        assert.equal(ticket.reservationId, x.binding.reservationId); assert.equal(ticket.executionId, x.binding.executionId);
        assert.equal(ticket.actorUserId, x.binding.actorUserId); assert.deepEqual(ticket.scope, x.binding.scope);
        assert.equal(reservation.diagnostics.executionId, x.binding.executionId);
        assert.equal(ticket.fingerprint, A.hash({ purpose: F.SOURCE + '_RECOVERY', reservation,
            approvalFingerprint: reservation.diagnostics.approvalFingerprint }));
        assert.deepEqual(await independent(x), before, 'Recovery preview does not change data or sessions');
        return { approvalTicket: preview.body.approvalTicket, reservationId: x.binding.reservationId,
            executionId: x.binding.executionId, approvalConfirmed: true };
    }
    async function complete(x, approval) {
        const before = await independent(x), response = await x.post('/recovery-complete', approval);
        assert.equal(response.body.outcome, 'COMMITTED', JSON.stringify(response));
        assert.equal(response.body.autoSettlement, false);
        const verified = await V.verifyLegacyFenceIndependently(x.options);
        assert.equal(verified.outcome, 'COMMITTED', JSON.stringify(verified)); assert.equal(verified.sequence, 3);
        assert.equal(verified.protectedDocumentCount, 26);
        const after = await independent(x);
        assert.deepEqual(after.history, before.history); assert.deepEqual(after.references, before.references);
        assert.deepEqual(after.sessions, before.sessions);
        assert.equal(after.employee.employee_profile_mutation_sequence, 3);
        assert.equal(after.audits.filter(row => row.mutationSource === F.SOURCE).length, 1);
        assert.equal(after.audits.filter(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT').length, 0);
        for (const old of before.audits) assert.deepEqual(after.audits.find(row => String(row._id) === String(old._id)), old);
        await x.runtime.close(); x.runtime = null;
        assert.equal((await V.verifyLegacyFenceIndependently(x.options)).outcome, 'COMMITTED');
        await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true }); assertMongoConnection(mongoose.connection);
        return after;
    }
    async function settlement(x, adapter = false) {
        const express = require('express'), app = express(), { once } = require('node:events');
        const Security = require('../../server/services/ergazomenoi/employeeHistoryIsolatedAdminSecurity');
        const controller = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
            .createEmployeeHistorySettlementHttpController(adapter ? { contextProvider: () => x.db.handle } : {});
        app.use(express.json()); let origin, loseResponse = false;
        app.use((req, res, next) => {
            const json = res.json.bind(res);
            res.json = value => { if (loseResponse && req.path.endsWith('/history-automatic-settlement-apply')) {
                loseResponse = false; res.socket.destroy(); return res;
            } return json(value); }; next();
        });
        app.use(async (req, res, next) => {
            try {
                Security.validateRequestBoundary(req, origin);
                const identity = await Security.authenticateExistingSession({ req, db: mongoose.connection.db, secret: x.secret, caseBinding: x.binding });
                req.session = identity.session; req.sessionID = identity.sid; next();
            } catch (error) { res.status(403).json({ outcome: 'BLOCKED', reason: error.reason }); }
        });
        app.get('/api/ergazomenoi/:id/history-reconstruction-preview', controller.preview);
        app.post('/api/ergazomenoi/:id/history-automatic-settlement-apply', require('../../server/middlewares/checkValidUser'), controller.apply);
        const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
        origin = 'http://127.0.0.1:' + server.address().port;
        if (!adapter) assert.equal(require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation')
            .initializeEmployeeHistorySettlementNormal({ server }), true, 'NORMAL startup flag is required by this test process');
        const headers = { Origin: origin, Cookie: 'connect.sid=' + encodeURIComponent('s:' + require('cookie-signature').sign(x.sid, x.secret)) + '; psifl.x-csrf-token=' + x.csrf,
            'X-CSRF-Token': x.csrf, 'Content-Type': 'application/json' };
        const prefix = origin + '/api/ergazomenoi/' + x.binding.employeeId;
        const attempts = new WeakMap();
        return { loseNextResponse() { loseResponse = true; },
            async preview() { const r = await fetch(prefix + '/history-reconstruction-preview?presentation=settlement', { headers }); return { status: r.status, body: await r.json() }; },
            async apply(body, context, requestId) {
                if (requestId === undefined) {
                    if (!attempts.has(body)) attempts.set(body, crypto.randomUUID());
                    requestId = attempts.get(body);
                }
                const r = await fetch(prefix + '/history-automatic-settlement-apply', { method: 'POST', headers: {
                    ...headers, 'X-Employee-Settlement-Context': context || '', 'X-Employee-Settlement-Attempt': requestId
                }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() };
            },
            close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
    }
    async function verifyFinal(x, approved, baseline) {
        const final = await independent(x), finals = final.audits.filter(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT');
        assert.equal(finals.length, 1, 'Exactly one successful Settlement audit');
        const record = finals[0], d = record.diagnostics;
        assert.equal(final.audits.length, baseline.audits.length + 3, 'Only the normal attempt, terminal and successful audit may be added');
        assert.equal(d.protocol.version, P.VERSION);
        const receipt = final.audits.find(row => String(row._id) === d.protocol.attemptId);
        assert.equal(receipt.mutationSource, P.ATTEMPT); assert.equal(receipt.diagnostics.fingerprint, d.approvalFingerprint);
        assert.equal(receipt.diagnostics.actorUserId, x.binding.actorUserId);
        assert.equal(d.normalExecution.claimId, receipt.diagnostics.claimId);
        assert.equal(d.approvalFingerprint, approved.body.approvalFingerprint);
        assert.equal(d.protectedReferences.referenceEvidenceContract, R.VERSION);
        const proposal = U.buildCoordinatedSettlementProposal(baseline.input);
        S.assertSettlementPhysicalPlan({ proposal, completeHistoryRows: baseline.input.completeHistoryRows,
            protectedReferenceSummary: baseline.input.protectedReferenceSummary, physicalPlan: d.physicalPlan,
            expectedRows: final.history, now: d.preparedAt, splitOptions: baseline.input });
        assert.equal(A.hash(d.physicalPlan), d.physicalPlanFingerprint);
        assert.deepEqual(A.ordered(final.history), A.ordered(d.physicalPlan.finalRows));
        // Top-level audit rows are the existing canonical projection. The
        // protocol diagnostics retain the complete approved physical documents.
        assert.deepEqual(A.ordered(d.historyBefore), A.ordered(baseline.history));
        assert.deepEqual(A.ordered(d.historyAfter), A.ordered(final.history));
        assert.deepEqual(final.references, baseline.references); assert.deepEqual(final.sessions, baseline.sessions);
        for (const previous of baseline.audits) assert.deepEqual(final.audits.find(row => String(row._id) === String(previous._id)), previous);
        assert.deepEqual(final.employee, { ...baseline.employee, ...proposal.currentPatch, employee_profile_mutation_sequence: 4 });
        assert.equal(final.proposal.status, 'CLEAN'); assert.equal(final.proposal.noOp, true);
        const terminal = final.audits.find(row => String(row._id) === d.protocol.terminalId);
        assert.equal(terminal.diagnostics.outcome, 'COMMITTED');
        assert.equal(final.audits.filter(row => row.mutationSource === F.SOURCE).length, 1);
        return final;
    }
    await t.test('full real HTTP/Mongo chain: private recovery ticket, independent fence, new approval, exact plan and fresh CLEAN/noOp', async () => {
        const x = await setup(); let http;
        try {
            const initial = await independent(x);
            assert.equal(initial.history.length, 4); assert.equal(initial.employee.employee_profile_mutation_sequence, 2);
            assert.equal(initial.audits.length, 2); assert.equal(Object.values(initial.references).flat().length, 26);
            const approval = await recover(x); await complete(x, approval);
            http = await settlement(x);
            const baseline = await independent(x), previewWrites = [];
            const previewListener = event => { if (['insert', 'update', 'delete', 'findAndModify'].includes(event.commandName)) previewWrites.push(event.commandName); };
            mongoose.connection.getClient().on('commandStarted', previewListener);
            const approved = await http.preview(), repeated = await http.preview();
            mongoose.connection.getClient().off('commandStarted', previewListener);
            assert.deepEqual(previewWrites, [], 'New NORMAL previews issue no write commands');
            assert.equal(repeated.body.approvalFingerprint, approved.body.approvalFingerprint);
            assert.equal(baseline.input.protectedReferenceSummary.referenceEvidenceContract, R.VERSION);
            const evidence = Object.values(baseline.input.protectedReferenceSummary).filter(Array.isArray).flat();
            assert.equal(new Set(evidence.map(item => item.collection + ':' + item.documentId)).size, 26);
            assert.ok(evidence.every(item => /^[a-f0-9]{64}$/.test(item.bsonSha256)));
            assert.equal(approved.status, 200, JSON.stringify(approved));
            assert.equal(approved.body.executionMode, 'NORMAL'); assert.equal(approved.body.historyStatus, 'CLEAN'); assert.equal(approved.body.noOp, false);
            assert.notEqual(approved.body.approvalFingerprint, x.binding.fingerprint);
            assert.equal(approved.body.approvalFingerprint, S.buildEmployeeHistorySettlementApprovalFingerprint({ ...baseline.input, proposal: baseline.proposal }));
            assert.deepEqual(await independent(x), baseline, 'New Settlement preview is read only');
            const writes = [];
            const listener = e => { if (['insert','update','delete','commitTransaction'].includes(e.commandName)) writes.push(e); };
            mongoose.connection.getClient().on('commandStarted', listener);
            const applied = await http.apply({ approval: { confirmed: true, fingerprint: approved.body.approvalFingerprint } }, approved.body.browserApprovalContext);
            mongoose.connection.getClient().off('commandStarted', listener);
            assert.equal(applied.status, 200, JSON.stringify(applied)); assert.equal(applied.body.historyStatus, 'CLEAN');
            const final = await verifyFinal(x, approved, baseline);
            const commit = writes.filter(e => e.commandName === 'commitTransaction'); assert.equal(commit.length, 1);
            const key = e => JSON.stringify([e.command.lsid, e.command.txnNumber]);
            const business = writes.filter(e => e.command.update === 'Istoriko_Proslhpseon_Allagon' || e.command.insert === 'Istoriko_Proslhpseon_Allagon');
            const audits = writes.filter(e => e.command.insert === 'Employee_History_Repair_Audit' && e.command.documents.some(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT'));
            assert.ok(business.length > 0); assert.equal(audits.length, 1);
            assert.ok([...business, ...audits].every(e => key(e) === key(commit[0])), 'History changes and final audit commit in one transaction');
            const clean = await http.preview(); assert.equal(clean.body.historyStatus, 'CLEAN'); assert.equal(clean.body.noOp, true);
            assert.deepEqual(await independent(x), final);
        } finally { await http?.close(); if (x.runtime) await x.runtime.close(); await mongoose.disconnect(); }
    });
    for (const mode of ['missing-recovery-approval', 'wrong-recovery-fingerprint', 'expired-ticket', 'consumed-ticket',
        'second-recovery-completion', 'uncertain-recovery-commit']) await t.test(mode, async () => {
        const x = await setup();
        try {
            const approval = await recover(x), before = await independent(x);
            if (mode === 'missing-recovery-approval') approval.approvalConfirmed = false;
            if (mode === 'wrong-recovery-fingerprint' || mode === 'expired-ticket') {
                const file = path.join(x.approvalDirectory, approval.approvalTicket + '.json');
                const ticket = JSON.parse(fs.readFileSync(file));
                if (mode === 'wrong-recovery-fingerprint') ticket.fingerprint = 'x'.repeat(43);
                else ticket.expiresAt = new Date(0).toISOString();
                fs.writeFileSync(file, JSON.stringify(ticket));
            }
            if (mode === 'consumed-ticket') require('../../server/services/ergazomenoi/employeeHistoryRecoveryApprovalStore')
                .createRecoveryApprovalStore({ directory: x.approvalDirectory, repositoryRoot: path.resolve(__dirname, '../..'), sessionSecret: x.secret })
                .consume({ id: approval.approvalTicket, sessionId: x.sid, reservationId: x.binding.reservationId,
                    actorUserId: x.binding.actorUserId, scope: x.binding.scope });
            if (mode === 'second-recovery-completion') {
                assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'COMMITTED');
                const saved = await independent(x);
                assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'BLOCKED');
                assert.deepEqual(await independent(x), saved);
                assert.equal(saved.audits.filter(row => row.mutationSource === F.SOURCE).length, 1);
                assert.equal(saved.employee.employee_profile_mutation_sequence, 3);
            } else if (mode === 'uncertain-recovery-commit') {
                // Lose the handler acknowledgement only AFTER the real guarded
                // completion has committed. No transaction or verifier is mocked.
                const real = F.completeLegacyFenceReservation;
                F.completeLegacyFenceReservation = async (...args) => { await real(...args); throw Error('LOST_ACK_AFTER_REAL_RECOVERY_COMMIT'); };
                try { assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'BLOCKED'); }
                finally { F.completeLegacyFenceReservation = real; }
                assert.equal((await V.verifyLegacyFenceIndependently(x.options)).outcome, 'COMMITTED');
                const saved = await independent(x);
                assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'BLOCKED');
                assert.deepEqual(await independent(x), saved);
                assert.deepEqual(saved.history, before.history); assert.deepEqual(saved.references, before.references);
            } else {
                const response = await x.post('/recovery-complete', approval);
                assert.equal(response.body.outcome, 'BLOCKED', JSON.stringify(response));
                assert.deepEqual(await independent(x), before);
                if (mode !== 'consumed-ticket') assert.equal(fs.existsSync(path.join(x.approvalDirectory, x.binding.reservationId + '.completion-requested.json')), false);
            }
        } finally { if (x.runtime) await x.runtime.close(); await mongoose.disconnect(); }
    });
    for (const mode of ['history-changed-after-fence', 'old-settlement-fingerprint', 'missing-new-settlement-approval',
        'concurrent-settlement', 'uncertain-settlement-commit', 'lost-http-confirmation', 'final-audit-failure',
        'protected-reference-changed', 'final-clean-disagrees-with-data']) await t.test(mode, async () => {
        const x = await setup(); let http;
        try {
            const recovery = await recover(x); await complete(x, recovery);
            const adapter = ['uncertain-settlement-commit', 'final-audit-failure'].includes(mode);
            http = await settlement(x, adapter);
            const baseline = await independent(x), preview = await http.preview();
            assert.equal(preview.status, 200, JSON.stringify(preview)); assert.equal(preview.body.executionMode, 'NORMAL');
            const body = { approval: { confirmed: true, fingerprint: preview.body.approvalFingerprint } };
            const context = preview.body.browserApprovalContext;
            if (mode === 'history-changed-after-fence') await E.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: baseline.history[0]._id }, { $set: { synolo_symbashs: 9876 } });
            if (mode === 'protected-reference-changed') {
                const frozen = mongoose.connection.db.collection('Apasxoliseis_Period_Frozen_Snapshots');
                const row = await frozen.find(x.binding.scope).sort({ _id: -1 }).next();
                await frozen.updateOne({ _id: row._id }, { $set: { 'frozen_snapshot.amount': 9876 } });
            }
            if (mode === 'old-settlement-fingerprint') body.approval.fingerprint = x.binding.fingerprint;
            if (mode === 'missing-new-settlement-approval') body.approval.confirmed = false;
            if (mode === 'concurrent-settlement') {
                const responses = await Promise.all([http.apply(body, context, crypto.randomUUID()),
                    http.apply(body, context, crypto.randomUUID())]);
                assert.ok(responses.some(result => result.status === 200), JSON.stringify(responses));
                assert.ok(responses.every(result => [200,503].includes(result.status)), JSON.stringify(responses));
                await verifyFinal(x, preview, baseline);
            } else if (mode === 'uncertain-settlement-commit') {
                x.db.failAt('COMMIT_ACK_LOST');
                const response = await http.apply(body, context);
                assert.equal(response.body.outcome, 'BLOCKED', JSON.stringify(response));
                const final = await verifyFinal(x, preview, baseline);
                assert.equal((await http.preview()).body.noOp, true);
                assert.deepEqual(await independent(x), final);
            } else if (mode === 'lost-http-confirmation') {
                http.loseNextResponse(); await assert.rejects(() => http.apply(body, context));
                const final = await verifyFinal(x, preview, baseline);
                assert.equal((await http.preview()).body.noOp, true);
                assert.deepEqual(await independent(x), final);
            } else if (mode === 'final-audit-failure') {
                x.db.failAt('AUDIT');
                assert.equal((await http.apply(body, context)).body.outcome, 'BLOCKED');
                const final = await independent(x);
                assert.deepEqual(final.employee, baseline.employee); assert.deepEqual(final.history, baseline.history);
                assert.deepEqual(final.references, baseline.references);
                assert.equal(final.audits.filter(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT').length, 0);
                x.db.failAt(null);
                assert.equal((await http.apply(body, context)).body.outcome, 'BLOCKED');
                assert.deepEqual(await independent(x), final);
            } else if (mode === 'final-clean-disagrees-with-data') {
                assert.equal((await http.apply(body, context)).status, 200);
                const final = await verifyFinal(x, preview, baseline);
                const active = final.history.find(row => row.employment_history_canonical_status !== 'REDUNDANT_REFERENCED');
                await E.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: active._id }, { $set: { hmeromhnia_proslhpshs: new Date('2040-01-01') } });
                await assert.rejects(() => verifyFinal(x, preview, baseline));
                const changed = await independent(x);
                assert.ok(changed.proposal.status !== 'CLEAN' || changed.proposal.noOp !== true, 'Fresh planner cannot report the old CLEAN/noOp for changed data');
            } else {
                const before = await independent(x), response = await http.apply(body, context);
                assert.equal(response.status, 409, JSON.stringify(response));
                assert.deepEqual(await independent(x), before, 'Rejected approval causes zero database writes');
            }
        } finally { await http?.close(); if (x.runtime) await x.runtime.close(); await mongoose.disconnect(); }
    });
});
