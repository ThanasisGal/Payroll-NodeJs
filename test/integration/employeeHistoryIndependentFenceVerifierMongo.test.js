'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const mongoose = require('mongoose');
const { assertMongoTarget, assertMongoConnection } = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;
test('independent fence verifier: fresh connections, signed persisted BSON and all 26 protected documents',
    { skip: !uri, timeout: 180000 }, async t => {
        assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
        mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
        const V = require('../../server/services/ergazomenoi/employeeHistoryIndependentFenceVerifier');
        const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
        const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
        const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
        const P = require('../../server/services/ergazomenoi/employeeHistorySettlementProtocol');
        const F = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
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
            const db = await require('../fixtures/employeeHistorySettlementMongoStore').createMongoSettlementStore({ fixture });
            await db.changeEmployee({ employee_profile_mutation_sequence: 2 });
            const frozen = mongoose.connection.db.collection('Apasxoliseis_Period_Frozen_Snapshots');
            const originals = await frozen.find(db.scope).toArray(), initial = await db.state();
            const daily = initial.history.map(row => ({ kodikos: db.scope.kodikos, effective_profile_istoriko_id: row._id }));
            for (const row of originals) await frozen.updateOne({ _id: row._id }, { $set: { 'frozen_snapshot.daily_results': daily } });
            await frozen.insertMany(Array.from({ length: 5 }, () => ({ ...originals[0], ...db.nextFrozenReferenceIdentity(), _id: new mongoose.Types.ObjectId(),
                frozen_snapshot: { ...originals[0].frozen_snapshot, daily_results: daily } })));
            const state = await db.state(); assert.equal(state.history.length, 3); assert.equal(state.references.length, 8);
            await mongoose.connection.db.collection('Prodhlomena_Oraria_Deviations').insertMany(Array.from({ length: 18 }, (_, index) =>
                ({ _id: new mongoose.Types.ObjectId(), ...db.scope, effective_profile_istoriko_id: state.history[index === 0 ? 0 : 1]._id, amount: 42 })));
            const history = A.ordered(state.history), references = await F.legacyFenceReferenceSummary(mongoose.connection, history);
            const input = { scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId,
                currentEmployee: state.employee, completeHistoryRows: history, protectedReferenceSummary: references };
            const proposal = U.buildCoordinatedSettlementProposal(input);
            assert.equal(proposal.status, 'CLEAN'); assert.equal(proposal.noOp, false);
            const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal });
            await audit.create([{ employeeScope: { ...db.scope, employee_id: db.employeeId },
                currentBefore: state.employee, historyBefore: history, historyAfter: history,
                survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [],
                mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT', repairedAt: new Date('2026-01-01'),
                diagnostics: { approvalFingerprint: 'previous-independent-settlement', actorUserId: db.actorUserId } }]);
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
                expectedHistoryCount: 3, expectedProtectedCount: 26, expectedPreviousSequence: 2 });
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
            return { runtime, post, options, finalId, state, binding, db };
        }
        for (const mode of ['success', 'missing-final', 'duplicate-final', 'mismatched-final', 'counter', 'history', 'history-bson',
            'protected-changed', 'protected-extra', 'reservation', 'execution', 'marker', 'new-settlement', 'baseline-tampered', 'uncertain'])
        await t.test(mode, async () => {
            const x = await setup();
            try {
                const preview = await x.post('/recovery-preview');
                assert.equal(preview.body.outcome, 'RECOVERABLE', JSON.stringify({ reason: preview.body.reason }));
                assert.equal((await x.post('/recovery-verify')).body.outcome, 'BLOCKED');
                const approval = { approvalTicket: preview.body.approvalTicket, reservationId: x.binding.reservationId,
                    executionId: x.binding.executionId, approvalConfirmed: true };
                if (!['missing-final', 'mismatched-final'].includes(mode)) {
                    if (mode === 'uncertain') {
                        const F = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService'), real = F.completeLegacyFenceReservation;
                        F.completeLegacyFenceReservation = async (...args) => { await real(...args); throw Error('ISOLATED_LOST_HTTP_RESULT'); };
                        try { assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'BLOCKED'); }
                        finally { F.completeLegacyFenceReservation = real; }
                    } else {
                        const completed = await x.post('/recovery-complete', approval);
                        assert.equal(completed.body.outcome, 'COMMITTED', JSON.stringify({ reason: completed.body.reason }));
                        assert.equal(completed.body.sequence, 3); assert.equal(completed.body.independentlyVerified, true);
                        assert.equal(completed.body.protectedDocumentCount, 26);
                        assert.equal((await x.post('/recovery-complete', approval)).body.outcome, 'BLOCKED');
                    }
                }
            } finally { await x.runtime.close(); }
            // Writer server and its connection are now gone. Verification must
            // succeed from disk + a completely new MongoClient, including after
            // a lost response; it cannot consult the writer's live objects.
            await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
            const db = mongoose.connection.db, employeeId = new mongoose.Types.ObjectId(x.binding.employeeId);
            if (['missing-final', 'mismatched-final'].includes(mode))
                await E.ErgazomenoiModel.collection.updateOne({ _id: employeeId }, { $set: { employee_profile_mutation_sequence: 3 } });
            if (mode === 'counter') await E.ErgazomenoiModel.collection.updateOne({ _id: employeeId }, { $inc: { employee_profile_mutation_sequence: 1 } });
            if (mode === 'history') await E.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: x.state.history[0]._id }, { $set: { synolo_symbashs: 999 } });
            if (mode === 'history-bson') await E.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: x.state.history[0]._id },
                { $set: { synolo_symbashs: new mongoose.mongo.Double(x.state.history[0].synolo_symbashs) } });
            if (mode === 'protected-changed') await db.collection('Apasxoliseis_Period_Frozen_Snapshots').updateOne({ _id: x.state.references.at(-1)._id }, { $set: { 'frozen_snapshot.amount': 999 } });
            if (mode === 'protected-extra') await db.collection('Oraria_Apologistika').insertOne({ ...x.binding.scope,
                effective_profile_istoriko_id: x.state.history[0]._id, amount: 1 });
            if (mode === 'duplicate-final') {
                const final = await audit.collection.findOne({ _id: new mongoose.Types.ObjectId(x.finalId) });
                await audit.collection.insertOne({ ...final, _id: new mongoose.Types.ObjectId() });
            }
            if (mode === 'mismatched-final') await audit.collection.insertOne({ _id: new mongoose.Types.ObjectId(x.finalId),
                employeeScope: { ...x.binding.scope, employee_id: employeeId }, mutationSource: F.SOURCE,
                diagnostics: { executionId: x.binding.executionId, legacyAttemptId: x.binding.legacyAttemptId, sequence: 999 } });
            if (mode === 'new-settlement') await audit.collection.insertOne({
                employeeScope: { ...x.binding.scope, employee_id: employeeId }, mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT',
                diagnostics: { approvalFingerprint: 'unauthorized-new-settlement' } });
            if (mode === 'baseline-tampered') {
                const file = path.join(x.options.directory, x.binding.reservationId + '.pre-fence-evidence.bson');
                const bytes = fs.readFileSync(file); bytes[bytes.length - 2] ^= 1; fs.writeFileSync(file, bytes);
            }
            if (mode === 'reservation') x.options.binding = { ...x.binding, reservationId: 'f'.repeat(24) };
            if (mode === 'execution') x.options.binding = { ...x.binding, executionId: crypto.randomUUID() };
            if (mode === 'marker') {
                const file = path.join(x.options.directory, x.binding.reservationId + '.completion-requested.json');
                fs.writeFileSync(path.join(x.options.directory, 'duplicate.completion-requested.json'), fs.readFileSync(file), { mode: 0o600 });
            }
            await mongoose.disconnect();
            const { createRequire } = require('node:module');
            const { Connection } = createRequire(require.resolve('mongoose'))('mongodb/lib/cmap/connection');
            const originalCommand = Connection.prototype.command, clients = new Set(); let writeAttempts = 0;
            Connection.prototype.command = function(ns, command, options = {}) {
                if (['insert', 'update', 'delete', 'findAndModify', 'create', 'createIndexes'].includes(Object.keys(command)[0])) {
                    writeAttempts++; throw Error('VERIFIER_MUST_BE_READ_ONLY');
                }
                if (command.find && options.session) clients.add(options.session.client);
                return originalCommand.apply(this, arguments);
            };
            try {
                const result = await V.verifyLegacyFenceIndependently(x.options);
                if (['success', 'uncertain'].includes(mode)) {
                    assert.equal(result.outcome, 'COMMITTED', JSON.stringify(result)); assert.equal(result.sequence, 3);
                    assert.equal(result.historyCount, 3); assert.equal(result.protectedDocumentCount, 26);
                    assert.equal(result.unauthorizedChanges, 0); assert.equal(result.ticketMarkerVerified, true);
                    assert.equal((await V.verifyLegacyFenceIndependently(x.options)).sequence, 3);
                    assert.equal(clients.size, 2, 'Each independent verification creates another MongoClient');
                } else {
                    assert.equal(result.outcome, 'BLOCKED', mode);
                    const reasons = { 'missing-final': 'FINAL_FENCE_AUDIT_MISMATCH', 'duplicate-final': 'FINAL_FENCE_AUDIT_MISMATCH',
                        'mismatched-final': 'FINAL_FENCE_AUDIT_MISMATCH', counter: 'MUTATION_SEQUENCE_MISMATCH',
                        history: 'HISTORY_CHANGED', 'history-bson': 'HISTORY_CHANGED', 'protected-changed': 'PROTECTED_DOCUMENTS_CHANGED',
                        'protected-extra': 'PROTECTED_DOCUMENTS_CHANGED', execution: 'VERIFICATION_EVIDENCE_CHANGED',
                        marker: 'TICKET_MARKER_MISMATCH', 'new-settlement': 'FINAL_FENCE_AUDIT_MISMATCH',
                        'baseline-tampered': 'VERIFICATION_EVIDENCE_CHANGED' };
                    if (reasons[mode]) assert.equal(result.reason, reasons[mode], mode);
                }
                assert.equal(writeAttempts, 0);
            } finally { Connection.prototype.command = originalCommand; }
        });
    });
