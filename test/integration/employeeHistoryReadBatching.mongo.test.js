'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const mongoose = require('mongoose');
const { startApprovedProposalMongo } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const References = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService');
const { REFERENCE_DEFINITIONS } = require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService');
const Row = require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService');
const Boundary = require('../../server/services/ergazomenoi/employeeApprovedHistoryImmutableBoundaryService');
const { loadMaintenanceApprovalInput } = require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService');
const Atomic = require('../../server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { rawState } = require('../fixtures/employeeHistoryLegacyStructure');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

// Reuse only the synthetic seeding helper; do not register or run the full-form
// save tests, import app.js/.env, or accept a URI to an existing database.
function seeder() {
    const filename = path.join(__dirname, 'employeeApprovedHistoryFullFormMongo.test.js');
    const source = fs.readFileSync(filename, 'utf8');
    const harness = new Module(filename, module);
    harness.filename = filename; harness.paths = Module._nodeModulePaths(path.dirname(filename));
    harness._compile(source.slice(0, source.indexOf("test('Πλήρης φόρμα")) + '\nmodule.exports = { seed };', filename);
    return harness.exports.seed;
}
const oid = n => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'));
function referenceDocument(definition, value, _id) {
    const document = { _id, performanceFixture: true };
    let cursor = document;
    const parts = definition.split('.');
    for (const part of parts.slice(0, -1)) {
        if (part.endsWith('[]')) { const item = {}; cursor[part.slice(0, -2)] = [item]; cursor = item; }
        else cursor = cursor[part] = {};
    }
    cursor[parts.at(-1)] = value;
    return document;
}
async function legacyBoundaryAudits(input, model, session) {
    return model.find({ 'employeeScope.team': input.scope.team, 'employeeScope.company_kod': input.scope.company_kod,
        'employeeScope.kodikos': input.scope.kodikos, 'employeeScope.employee_id': input.currentEmployee._id,
        mutationSource: Boundary.OPERATION, 'diagnostics.version': Boundary.WRITER_VERSION,
        'diagnostics.operation': 'NEW_CHANGE' }).sort({ repairedAt: -1, _id: -1 }).session(session).lean();
}

// The pre-optimization preparation order, retained as an independent oracle.
// It deliberately repeats the pure inspection and reloads protection, so an
// optimized result cannot certify itself by comparing two optimized paths.
async function legacyPrepare(input, change, session, dependencies) {
    const options = { allowMissing: true };
    const inspected = Atomic.decide(input, change, null, { ...options, inspectOnly: true });
    if (inspected.missingFields.length) return inspected;
    const proposal = require('../../server/services/ergazomenoi/employeeApprovedHistoryAtomicProposalService')
        .prepareApprovedHistoryAtomicProposal(input, change);
    assert.ok(['ATOMIC_NEW_VERSION_PREPARED_READ_ONLY', 'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY'].includes(proposal.status));
    const targetId = change.kind === 'NEW_CHANGE'
        ? require('../../server/services/ergazomenoi/employeeApprovedHistoryChangeIntentService')
            .planApprovedHistoryChangeIntent(input, change).fromHistoryId : proposal.targetHistoryId;
    const original = input.completeHistoryRows.find(row => String(row._id) === targetId);
    const protection = await require('../../server/services/ergazomenoi/employeeHistoryLegacyProtectionService').readLegacyProtection({
        input, session, dependencies, preserveOriginal: true,
        period: { from: change.effectiveFrom, to: change.kind === 'NEW_CHANGE' ? null
            : original.hmeromhnia_isxyos_oron_ergasias_eos?.toISOString().slice(0, 10) || null } });
    const plan = Atomic.decide(input, change, protection, options);
    // Independent copy of the original signed-source formula, not the new
    // fingerprint helper: existing confirmations must bind identical evidence.
    const snapshot = A.hash({ version: Atomic.VERSION, scope: input.scope,
        employee: Object.fromEntries(Object.entries(input.currentEmployee)
            .filter(([field]) => field !== 'employee_profile_mutation_sequence')),
        physical: A.ordered(input.completeHistoryRows), approvals: input.approvedHistoryDecisions,
        references: input.protectedReferenceSummary, atomicBoundaries: input.atomicBoundaryAudits || [] });
    assert.equal(plan.sourceFingerprint, A.hash({ snapshot, protection: protection?.wire,
        employeePatch: undefined, profilePatch: undefined }));
    const document = require('../../server/models/ergazomenoi').ErgazomenoiModel.hydrate(input.currentEmployee);
    document.set(plan.employeePatch); await document.validate();
    plan.employeePatch = Object.fromEntries(Object.keys(plan.employeePatch).map(field => [field, document.get(field)]));
    return plan;
}

test('batched History reads preserve real MongoDB results and every preview protection',
    { skip: !binary, timeout: 120000 }, async t => {
        const db = await startApprovedProposalMongo(binary);
        t.after(db.close);
        assert.equal(mongoose.connection.readyState, 0);
        const transaction = work => W.inProfileTransaction(db.connection, W.transactionCapability, work,
            null, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
        const ids = Array.from({ length: 4 }, (_, n) => String(oid(700 + n)));
        const compareReferences = async (session, sortById = false) => {
            const expected = {};
            for (const id of ids) expected[id] = await References.findHistoryIdReferences({
                connection: db.connection, historyIds: [id], session, sortById });
            const actual = await References.findHistoryIdReferenceSummary({ connection: db.connection,
                historyIds: ids, session, sortById });
            assert.deepEqual(actual, expected);
            return actual;
        };

        await t.test('all five collections are checked; empty batches use five reads instead of twenty', async () => {
            const commands = [], client = db.connection.getClient();
            const capture = event => { if (event.commandName === 'find') commands.push(event); };
            client.on('commandStarted', capture);
            try {
                await transaction(async session => {
                    const before = commands.length;
                    const actual = await References.findHistoryIdReferenceSummary({ connection: db.connection, historyIds: ids, session });
                    assert.deepEqual(actual, Object.fromEntries(ids.map(id => [id, []])));
                    assert.equal(commands.length - before, 5);
                    await compareReferences(session);
                });
            } finally { client.off('commandStarted', capture); }
        });

        await t.test('every current/legacy nested path, BSON/string id, array and unsorted witness is retained', async () => {
            let n = 1000;
            for (const [collection, definitions] of Object.entries(REFERENCE_DEFINITIONS)) {
                const documents = definitions.flatMap(definition => ids.flatMap(id => [false, true].map(asObjectId =>
                    referenceDocument(definition, asObjectId ? new mongoose.Types.ObjectId(id) : id, oid(++n)))));
                // Insert a larger _id first, so sorting and natural order are not interchangeable.
                documents.reverse();
                await db.connection.collection(collection).insertMany(documents);
            }
            await transaction(async session => {
                const actual = await compareReferences(session);
                for (const refs of Object.values(actual)) assert.equal(refs.length, 5);
                await compareReferences(session, true);
            });
        });

        await t.test('a new transaction sees changed reference evidence rather than cached absence', async () => {
            const freshId = String(oid(999));
            const read = () => transaction(session => References.findHistoryIdReferenceSummary({ connection: db.connection,
                historyIds: [freshId, ids[0]], session }));
            assert.deepEqual((await read())[freshId], []);
            await db.connection.collection('Oraria_Apologistika').insertOne({ _id: oid(9999),
                previous_profile_istoriko_id: new mongoose.Types.ObjectId(freshId) });
            assert.deepEqual((await read())[freshId], [{ collection: 'Oraria_Apologistika', documentId: String(oid(9999)) }]);
        });

        const f = await seeder()(db);
        const input = { scope: f.scope, currentEmployee: await db.employeeModel.findById(f.employee._id).lean() };
        await t.test('one ordered audit read equals both old reads including scope, versions and statuses', async () => {
            const original = await Row.loadDecisions(input, db.auditModel);
            assert.ok(original.length);
            const clone = row => mongoose.mongo.BSON.deserialize(mongoose.mongo.BSON.serialize(row));
            const variants = [
                row => { row.employeeScope.team = 'OTHER'; },
                row => { row.employeeScope.employee_id = oid(123456); },
                row => { row.diagnostics.rowApproval.version = 'unrecognized'; },
                row => { row.diagnostics.rowApproval.status = 'COMMITTED_AWAITING_VERIFICATION'; },
                row => { row.diagnostics.rowApproval.verification.persistedRowHash = 'forged'; },
                row => { row.mutationSource = Boundary.OPERATION; row.diagnostics.version = Boundary.WRITER_VERSION;
                    row.diagnostics.operation = 'NEW_CHANGE'; },
                row => { row.mutationSource = Boundary.OPERATION; row.diagnostics.version = 'unrecognized';
                    row.diagnostics.operation = 'NEW_CHANGE'; },
                row => { row.mutationSource = [row.mutationSource, Boundary.OPERATION];
                    row.diagnostics.version = Boundary.WRITER_VERSION; row.diagnostics.operation = 'NEW_CHANGE'; },
                row => { row.diagnostics.rowApproval.status = [Row.STATUS, 'invalid']; },
                row => { row.diagnostics = [row.diagnostics]; }
            ];
            const extra = variants.map((mutate, n) => {
                const row = clone(original[0]); row._id = oid(20000 + n); mutate(row); return row;
            });
            await db.auditModel.collection.insertMany(extra);
            try {
                await transaction(async session => {
                    const approved = await Row.loadDecisions(input, db.auditModel, session);
                    const boundaries = await legacyBoundaryAudits(input, db.auditModel, session);
                    const actual = await loadMaintenanceApprovalInput(input, db.auditModel, session);
                    assert.deepEqual(actual.approvedHistoryDecisions, approved);
                    assert.deepEqual(actual.atomicBoundaryAudits, boundaries);
                    assert.ok(!actual.approvedHistoryDecisions.some(row => String(row._id) === String(extra[0]._id)));
                    assert.ok(actual.approvedHistoryDecisions.some(row => String(row._id) === String(extra[4]._id)));
                    const row = await db.historyModel.findById(extra[4].diagnostics.targetHistoryId).lean();
                    assert.equal(require('../../server/services/ergazomenoi/employeeHistoryOperationalReadService')
                        .boundDecision(extra[4], row, input.currentEmployee), false);
                });
            } finally { await db.auditModel.collection.deleteMany({ _id: { $in: extra.map(row => row._id) } }); }
        });

        const change = { kind: 'NEW_CHANGE', effectiveFrom: '2026-11-29', correctedTerms: {
            hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH', ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 6.67 } };
        const factory = legacy => Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db,
            enabled: () => true, secret: 'synthetic-batching-protection-secret-32', now: () => +new Date('2026-11-24'),
            ...(legacy ? { referenceChecker: options => References.findHistoryIdReferences(options),
                decisionsLoader: (...args) => Row.loadDecisions(...args), atomicAuditsLoader: legacyBoundaryAudits } : {}) });
        const prepare = (legacy, request = f.req, proposed = change) => transaction(session =>
            factory(legacy).prepareEmployeeSave(request, proposed, session));

        await t.test('batched preparation preserves exact proof, fingerprint and physical plan, without writes', async () => {
            const before = await rawState(f);
            const clock = t.mock.method(Date, 'now', () => +new Date('2026-12-01'));
            try {
                const old = await prepare(true), current = await prepare(false);
                assert.ok(A.equal(current.input, old.input));
                assert.ok(A.equal(current.plan, old.plan), JSON.stringify(Object.keys(current.plan)
                    .filter(key => !A.equal(current.plan[key], old.plan[key]))));
                assert.equal(current.plan.sourceFingerprint, old.plan.sourceFingerprint);
                const originalPlan = await transaction(session => legacyPrepare(current.input, change, session, db));
                assert.ok(A.equal(current.plan, originalPlan), JSON.stringify(Object.keys(current.plan)
                    .filter(key => !A.equal(current.plan[key], originalPlan[key]))));
            } finally { clock.mock.restore(); }
            assert.deepEqual(await rawState(f), before);
        });

        await t.test('call-local inspection is rejected if its request or approval evidence changes during protection read', async () => {
            const readProtection = require('../../server/services/ergazomenoi/employeeHistoryLegacyProtectionService').readLegacyProtection;
            const before = await rawState(f);
            for (const mode of ['request', 'approval']) {
                const proposed = { ...change, correctedTerms: { ...change.correctedTerms } };
                const service = Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db,
                    enabled: () => true, secret: 'synthetic-batching-protection-secret-32',
                    periodProtection: async options => {
                        const proof = await readProtection(options);
                        if (mode === 'request') proposed.correctedTerms.hmeres_ergasias_ebdomadas = 7;
                        else options.input.approvedHistoryDecisions = [];
                        return proof;
                    } });
                await assert.rejects(transaction(session => service.prepareEmployeeSave(f.req, proposed, session)),
                    error => error.code === (mode === 'request' ? 'EMPLOYEE_APPROVED_ATOMIC_COMPLETE_COHERENT_WORK_TERMS_REQUIRED'
                        : 'EMPLOYEE_APPROVED_ATOMIC_NO_VERIFIED_PRIOR_APPROVAL'));
            }
            assert.deepEqual(await rawState(f), before);
        });

        await t.test('changed proposed facts rerun missing-fields validation rather than reusing a complete plan', async () => {
            const profilePatch = {}, readProtection = require('../../server/services/ergazomenoi/employeeHistoryLegacyProtectionService').readLegacyProtection;
            const service = Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db,
                enabled: () => true, secret: 'synthetic-batching-protection-secret-32',
                periodProtection: async options => {
                    const proof = await readProtection(options); profilePatch.pragmatikosMisthos = null; return proof;
                } });
            const before = await rawState(f);
            const prepared = await transaction(session => service.prepareEmployeeSave(f.req, change, session, { profilePatch }));
            assert.ok(prepared.plan.missingFields.some(item => item.field === 'pragmatikosMisthos'));
            assert.deepEqual(await rawState(f), before);
        });

        await t.test('unauthorized actor and invalid work terms remain blocked on both paths', async () => {
            for (const legacy of [true, false]) {
                await assert.rejects(prepare(legacy, { ...f.req, session: { ...f.req.session, userId: String(oid(999999)) } }),
                    error => error.code === 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN');
                await assert.rejects(prepare(legacy, f.req, { ...change, correctedTerms: { ...change.correctedTerms,
                    hmeres_ergasias_ebdomadas: 7 } }));
            }
        });

        await t.test('locked/unknown protection is not bypassed by grouped reads', async () => {
            const _id = oid(30000);
            await db.periodControlModel.collection.insertOne({ _id, team: f.scope.team, company_kod: f.scope.company_kod,
                ypokatasthma: '0000', period_start: new Date('2026-11-01'), period_end: new Date('2026-12-31'), status: 'LOCKED' });
            try {
                for (const legacy of [true, false]) await assert.rejects(prepare(legacy),
                    error => error.code === 'EMPLOYEE_APPROVED_ATOMIC_FROZEN_OR_UNKNOWN_PERIOD');
                await db.periodControlModel.collection.updateOne({ _id }, { $set: { period_start: 'invalid' } });
                for (const legacy of [true, false]) await assert.rejects(prepare(legacy),
                    error => error.code === 'EMPLOYEE_APPROVED_ATOMIC_FROZEN_OR_UNKNOWN_PERIOD');
            } finally { await db.periodControlModel.collection.deleteOne({ _id }); }
        });

        await t.test('new reference invalidates a signed preview before any write or fence', async () => {
            const service = factory(false), preview = await service.preview(f.req, change);
            await db.connection.collection('Oraria_Apologistika').insertOne({ _id: oid(31000),
                effective_profile_istoriko_id: String(f.history[0]._id) });
            const before = await rawState(f), mutations = [], client = db.connection.getClient();
            const capture = event => { if (['insert', 'update', 'delete', 'findAndModify'].includes(event.commandName)) mutations.push(event.commandName); };
            client.on('commandStarted', capture);
            try {
                await assert.rejects(service.apply(f.req, change, preview.approval),
                    error => error.code === 'EMPLOYEE_APPROVED_ATOMIC_STALE_CONFIRMATION');
                assert.deepEqual(mutations, []);
                assert.deepEqual(await rawState(f), before);
            } finally { client.off('commandStarted', capture); }
        });
        assert.equal(mongoose.connection.readyState, 0);
    });
