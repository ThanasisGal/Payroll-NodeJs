'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { applyEmployeeHistoryAutomaticReconstruction: apply } = require('./employeeHistoryAutomaticReconstructionApplyService');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const W = require('./employeeEmploymentProfileWriter');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { store, FIELD, deferred } = require('../../../test/fixtures/employeeProfileTransactionStore');
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
const admin = { privileges: 'A', team: 'THA', situation: 'A' };
function setup(factory = F.caseA, user = admin, storeOptions = {}) {
    const input = factory();
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], storeOptions);
    db.deps.userModel = { findById: () => query(user) };
    db.deps.auditModel.findOne = filter => ({ session(session) { this.s = session; return this; }, async lean() {
        return this.s.draft.audits.find(audit => audit.mutationSource === filter.mutationSource &&
            String(audit.employeeScope.employee_id) === String(filter['employeeScope.employee_id']) &&
            C.SCOPE_FIELDS.every(field => audit.employeeScope[field] === filter[`employeeScope.${field}`]) &&
            audit.diagnostics.applyTokenHash === filter['diagnostics.applyTokenHash'] &&
            audit.diagnostics.actor.userId === filter['diagnostics.actor.userId']) || null;
    } });
    const token = state => A.buildAutomaticReconstructionPreviewToken({ scope: input.scope,
        currentEmployee: state.employees[0], completeHistoryRows: state.history,
        plan: planner({ scope: input.scope, currentEmployee: state.employees[0], completeHistoryRows: state.history }) });
    const options = { ...db.deps, scope: input.scope, employeeId: input.currentEmployee._id,
        previewToken: token(db.state()), approvalAccepted: true, actorUserId: 'synthetic-actor' };
    return { db, input, options, token, run: overrides => apply({ ...options, ...overrides }) };
}
function noCommittedChanges(db, before) { assert.deepEqual(db.state(), before); }
const rejectsCode = (work, suffix) => assert.rejects(work, { code: A.PREFIX + suffix });

for (const factory of [F.caseA, F.caseB, F.caseBWithProfileEvidence]) test(`${factory.name}: preview equals exact physical mutation; one audit; second planner has zero differences`, async () => {
    const { db, input, run } = setup(factory), before = db.state();
    const plan = planner(input), result = await run();
    assert.equal(result.applied, true);
    assert.equal(result.changedFields, plan.rowDiffs.length);
    const after = db.state();
    const { [FIELD]: sequence, ...current } = after.employees[0];
    assert.equal(sequence, 1);
    assert.deepEqual(current, before.employees[0]);
    assert.equal(after.history.length, before.history.length);
    assert.deepEqual(after.history.map(row => String(row._id)).sort(), before.history.map(row => String(row._id)).sort());
    for (const row of after.history) {
        const original = before.history.find(item => item._id === row._id);
        const diffs = plan.rowDiffs.filter(diff => String(diff.historyId) === row._id);
        const { updatedAt, ...business } = row;
        assert.ok(updatedAt instanceof Date);
        assert.deepEqual(business, { ...original, ...Object.fromEntries(diffs.map(diff => [diff.field, diff.after])) });
        for (const field of ['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos', '_id', 'aa_eggrafhs']) {
            assert.deepEqual(row[field], original[field]);
        }
    }
    const final = planner({ scope: input.scope, currentEmployee: after.employees[0], completeHistoryRows: after.history });
    assert.ok(A.isNoOp(final)); assert.equal(final.rowDiffs.length, 0);
    assert.equal(after.audits.length, 1);
    const audit = after.audits[0];
    assert.deepEqual(audit.historyBefore, before.history);
    assert.deepEqual(A.ordered(audit.historyAfter), A.ordered(after.history));
    assert.deepEqual(audit.deletedLegacyHistoryIds, []);
    assert.deepEqual(audit.currentBefore, { ...before.employees[0], [FIELD]: 1 });
    assert.equal(audit.mutationSource, A.OPERATION);
    assert.equal(audit.diagnostics.approvalAccepted, true);
    assert.equal(audit.diagnostics.plannerStatus, plan.status);
    assert.equal(audit.diagnostics.changedFieldCount, plan.rowDiffs.length);
    assert.doesNotMatch(JSON.stringify(audit.diagnostics), /password|cookie|csrf|sessionId/);
    const events = db.events;
    assert.deepEqual(events.slice(0, 3).map(e => [e.type, e.kind]), [['fence', 'employees'], ['read', 'employees'], ['read', 'history']]);
    assert.ok(events.filter(e => ['read', 'write', 'fence', 'commit'].includes(e.type)).every(e => e.session === 1));
    if (factory !== F.caseA) {
        const initial = after.history.filter(row => ['0001', '0002'].includes(row.aa_eggrafhs));
        assert.ok(C.PROFILE_FIELDS.every(field => A.equal(initial[0][field], initial[1][field])));
    }
});

test('REVIEW_REQUIRED accepts one approval; false/missing/string approval performs no fence or writes', async () => {
    for (const approvalAccepted of [false, undefined, 'true']) {
        const { db, run, input } = setup(F.caseBWithProfileEvidence), before = db.state();
        assert.equal(planner(input).status, 'REVIEW_REQUIRED');
        await rejectsCode(() => run({ approvalAccepted }), 'APPROVAL_REQUIRED');
        noCommittedChanges(db, before); assert.equal(db.events.length, 0);
    }
});
for (const [name, mutate] of [
    ['Employee semantic value', input => { input.currentEmployee.hmeromhnia_lhxhs_symbashs = '2027-01-01'; }],
    ['Employee unrelated value', input => { input.currentEmployee.epitheto = 'Synthetic change'; }],
    ['History value', input => { input.completeHistoryRows[0].pragmatikosMisthos = 2100; }],
    ['History insert', input => { input.completeHistoryRows.push(F.row('0099', { [C.HIRE]: '2026-04-24' })); }],
    ['History delete', input => { input.completeHistoryRows.pop(); }],
    ['History numbering', input => { input.completeHistoryRows[0].aa_eggrafhs = '9999'; }],
    ['redundant referenced artifact change', input => { input.completeHistoryRows.push(F.row('0098', {
        employment_history_canonical_status: 'REDUNDANT_REFERENCED', employment_history_canonical_survivor_id: 'synthetic-0001' })); }]
]) test(`${name} after preview: stale 409, full rollback, no audit, no automatic retry`, async () => {
    const preview = setup(), changed = F.caseA(); mutate(changed);
    const { db, run } = setup(() => changed), before = db.state();
    await assert.rejects(() => run({ previewToken: preview.options.previewToken }), { code: A.PREFIX + 'STALE', statusCode: 409 });
    noCommittedChanges(db, before); assert.equal(db.events.some(e => e.type === 'retry'), false);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 1);
});

test('schedule-only changes do not stale and are never overwritten, including current Employee dates', async () => {
    const first = setup(), input = F.caseA();
    input.completeHistoryRows.forEach(row => Object.assign(row, {
        hmeromhnia_allaghs_orarioy_apo: '2044-12-01', hmeromhnia_allaghs_orarioy_eos: '2044-12-31' }));
    // Current had no schedule values. Add them after preview.
    input.currentEmployee.hmeromhnia_allaghs_orarioy_apo = '2045-01-01';
    const { db, run, options } = setup(() => input);
    assert.equal(options.previewToken, first.options.previewToken);
    await run({ previewToken: first.options.previewToken });
    assert.equal(db.state().employees[0].hmeromhnia_allaghs_orarioy_apo, '2045-01-01');
    for (const row of db.state().history) assert.equal(row.hmeromhnia_allaghs_orarioy_apo, '2044-12-01');
});

for (const [name, tamper] of [
    ['unexpected patch field', physical => { physical.rowsToUpdate[0].patch.kodikos = 'forged'; }],
    ['unexpected patch value', physical => { physical.rowsToUpdate[0].patch[C.START] = '2040-01-01'; }],
    ['unexpected update ID', physical => { physical.rowsToUpdate[0].historyId = 'unknown'; }],
    ['duplicate update ID', physical => { physical.rowsToUpdate.push(physical.rowsToUpdate[0]); }],
    ['unexpected insert', physical => { physical.expectedRows.push(F.row('0099')); }],
    ['unexpected delete', physical => { physical.expectedRows.pop(); }],
    ['physical insertion command', physical => { physical.rowsToInsert = [F.row('0099')]; }],
    ['informational date patch', physical => { physical.rowsToUpdate[0].patch.hmeromhnia_allaghs_orarioy_apo = new Date(); }]
]) test(`${name}: strict physical boundary rejects before any History write`, async () => {
    const { input, db } = setup(), plan = planner(input), before = db.state();
    const physicalPlan = A.buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows: input.completeHistoryRows });
    tamper(physicalPlan);
    await rejectsCode(() => W.inProfileTransaction(db.deps.connection, db.deps.capabilityProbe, async session => {
        await W.acquireEmployeeMutationFence({ filter: input.scope, employeeId: input.currentEmployee._id, employeeModel: db.deps.employeeModel, session });
        return W.executeEmployeeHistoryAutomaticReconstructionPlan({ ...db.deps, physicalPlan, currentBefore: input.currentEmployee,
            filter: input.scope, employeeId: input.currentEmployee._id, session,
            automaticReconstructionPlan: plan, automaticHistoryBefore: input.completeHistoryRows });
    }), 'BOUNDARY_FAILED');
    noCommittedChanges(db, before); assert.equal(db.events.some(e => e.type === 'write'), false);
});
for (const field of [...C.FIELD_GROUPS.IDENTITY_PROTECTED, ...C.FIELD_GROUPS.INFORMATIONAL,
    ...C.FIELD_GROUPS.CANONICAL_METADATA, '__v']) test(`planner tampering cannot propose protected field ${field}`, () => {
    const input = F.caseA(), plan = planner(input), row = input.completeHistoryRows[0];
    plan.rowDiffs.push({ historyId: row._id, field, beforeMissing: row[field] === undefined, before: row[field] ?? null, after: 'FORGED' });
    assert.throws(() => A.buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows: input.completeHistoryRows }), { code: A.PREFIX + 'BOUNDARY_FAILED' });
});
for (const [name, corrupt] of [
    ['unexpected stored History field', session => { session.draft.history[0].unexpected = 'corrupt'; }],
    ['unexpected stored insert', session => { session.draft.history.push(F.row('0099')); }],
    ['unexpected stored delete', session => { session.draft.history.pop(); }],
    ['expected field differs', session => { session.draft.history[0].nomimosMisthos = 999; }],
    ['Employee differs', session => { session.draft.employees[0].unexpected = true; }],
    ['schedule changed by writer', session => { session.draft.history[0].hmeromhnia_allaghs_orarioy_eos = '2099-01-01'; }]
]) test(`${name}: final verification rolls back History, Employee fence and audit`, async () => {
    const { db, run } = setup(), before = db.state(), create = db.deps.auditModel.create;
    db.deps.auditModel.create = async (records, options) => { await create(records, options); corrupt(options.session); return records; };
    await rejectsCode(run, 'FINAL_VERIFICATION_FAILED'); noCommittedChanges(db, before);
});

test('audit creation failure rolls back all fields and fence', async () => {
    const { db, run } = setup(), before = db.state();
    db.deps.auditModel.create = async () => { throw new Error('synthetic audit failure'); };
    await assert.rejects(run, /synthetic audit failure/); noCommittedChanges(db, before);
});
test('missing audit storage fails closed without creating collection or writing History', async () => {
    const { db, run } = setup(), before = db.state();
    await rejectsCode(() => run({ auditCollectionChecker: async () => false }), 'AUDIT_UNAVAILABLE');
    noCommittedChanges(db, before); assert.equal(db.events.some(e => e.type === 'write'), false);
});
for (const [name, user] of [
    ['ordinary actor', { privileges: 'U', team: 'TEST', situation: 'A' }],
    ['inactive Admin', { ...admin, situation: 'I' }],
    ['Admin outside THA', { ...admin, team: 'TEST' }],
    ['Supervisor outside team', { privileges: 'S', team: 'OTHER', situation: 'A' }],
    ['missing actor', null]
]) test(`${name}: authorization denied and complete rollback`, async () => {
    const { db, run } = setup(F.caseA, user), before = db.state();
    await assert.rejects(run, error => error.statusCode === 403); noCommittedChanges(db, before);
    assert.equal(db.events.some(e => e.type === 'write'), false);
});
test('Supervisor uses existing exact problematic-row scope: denied if even one affected row is outside it', async () => {
    const { db, run } = setup(F.caseA, { privileges: 'S', team: 'TEST', situation: 'A' }), before = db.state();
    const { identifyEmployeeHistoryProblemScope } = require('./employeeHistoryProblemScopeService');
    const input = F.caseA(), scope = identifyEmployeeHistoryProblemScope(input);
    const ids = [...new Set(planner(input).rowDiffs.map(d => String(d.historyId)))];
    const permitted = scope.deterministicallyResolved && ids.every(id => scope.problematicHistoryIds.includes(id));
    if (permitted) { await run(); assert.equal(db.state().audits.length, 1); }
    else { await assert.rejects(run, { code: 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN' }); noCommittedChanges(db, before); }
});
test('already clean preview/apply is zero-write and zero-audit, including rolled-back technical fence', async () => {
    const input = F.caseA(); input.completeHistoryRows = planner(input).proposedRows;
    const { db, run } = setup(() => input), before = db.state();
    const result = await run(); assert.equal(result.applied, false);
    assert.equal(result.message, 'Το Ιστορικό είναι ήδη τακτοποιημένο.'); noCommittedChanges(db, before);
});
test('BLOCKED planner cannot apply', async () => {
    const input = F.caseA(); input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id;
    const { db, run } = setup(() => input), before = db.state();
    await rejectsCode(run, 'BLOCKED'); noCommittedChanges(db, before);
});
test('identical completed request is recognized without another History write, audit or committed fence', async () => {
    const { db, run } = setup(); await run(); const before = db.state();
    const result = await run(); assert.equal(result.alreadyApplied, true); assert.equal(result.applied, false);
    noCommittedChanges(db, before); assert.equal(db.state().audits.length, 1);
});
test('a completed token cannot mask a subsequent history change, even if planner still has zero differences', async () => {
    const { db, run } = setup(); await run();
    db.changeCommittedHistory(db.state().history[0]._id, { aa_eggrafhs: '9999' }); const before = db.state();
    await rejectsCode(run, 'STALE'); noCommittedChanges(db, before);
});
test('concurrent identical requests serialize via existing Employee fence and commit exactly one audit', async () => {
    const { db, run } = setup(), entered = deferred(), release = deferred();
    db.hooks.read = async (session, kind) => { if (session.id === 1 && kind === 'history') { entered.resolve(); await release.promise; } };
    db.hooks.retry = async () => { release.resolve(); await first; };
    const first = run(); await entered.promise;
    const second = run(); const results = await Promise.all([first, second]);
    assert.equal(results.filter(result => result.applied).length, 1);
    assert.equal(results.filter(result => result.alreadyApplied).length, 1);
    assert.equal(db.state().audits.length, 1);
    assert.equal(db.state().employees[0][FIELD], 1);
});
test('reference check failure is zero-write; frozen provenance is allowed without touching its artifacts', async () => {
    const { db, run } = setup(), before = db.state();
    await rejectsCode(() => run({ referenceChecker: async () => { throw new Error('unsafe'); } }), 'REFERENCE_CHECK_FAILED');
    noCommittedChanges(db, before);
    await run({ referenceChecker: async () => [{ collection: 'Oraria_Apologistika', documentId: 'synthetic-reference' }] });
    assert.equal(db.state().audits.length, 1);
});
test('BSON identities and redundant survivor references survive token, planner and strict boundary unchanged', () => {
    const input = F.caseA();
    input.currentEmployee._id = new Types.ObjectId();
    input.completeHistoryRows.forEach(row => { row._id = new Types.ObjectId(); });
    const redundant = { ...F.row('0003'), _id: new Types.ObjectId(), employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: input.completeHistoryRows[0]._id, history_reference_fence: 7 };
    input.completeHistoryRows.push(redundant);
    const plan = planner(input), physical = A.buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows: input.completeHistoryRows });
    assert.deepEqual(physical.expectedRows.find(row => String(row._id) === String(redundant._id)), redundant);
    assert.ok(physical.expectedRows.every(row => row._id instanceof Types.ObjectId));
    assert.equal(physical.rowsToUpdate.length, 2);
    const token = A.buildAutomaticReconstructionPreviewToken({ ...input, plan });
    assert.match(token, /^[A-Za-z0-9_-]{43}$/); assert.ok(!token.includes(String(input.currentEmployee._id)));
    input.completeHistoryRows.reverse();
    assert.equal(A.buildAutomaticReconstructionPreviewToken({ ...input, plan: planner(input) }), token);
});

test('Supervisor may apply when every changed row belongs to the existing deterministic problem scope', async () => {
    const { fixture, scope } = require('../../../test/fixtures/employeeProfileTransactionStore');
    const f = fixture();
    f.history[2][C.END] = '2026-12-31';
    const input = { scope, currentEmployee: f.employee, completeHistoryRows: f.history };
    input.completeHistoryRows = planner(input).proposedRows;
    input.completeHistoryRows[0][C.END] = null;
    const plan = planner(input);
    assert.equal(plan.rowDiffs.length, 1);
    const { db, run } = setup(() => input, { privileges: 'S', team: 'TEST', situation: 'A' });
    const result = await run();
    assert.equal(result.changedRows, 1);
    assert.equal(db.state().audits.length, 1);
});

test('native BSON ObjectIds, hidden fences, immutable metadata and audit snapshots survive a full synthetic Apply transaction', async () => {
    function clone(value) {
        if (value instanceof Date) return new Date(value);
        if (value instanceof Types.ObjectId) return new Types.ObjectId(value.toHexString());
        if (Array.isArray(value)) return value.map(clone);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
    }
    const input = F.caseA();
    input.currentEmployee._id = new Types.ObjectId();
    input.currentEmployee[FIELD] = 3;
    input.completeHistoryRows.forEach(row => Object.assign(row, { _id: new Types.ObjectId(), createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'), __v: 9, history_reference_fence: 5 }));
    input.completeHistoryRows.push({ ...F.row('0003'), _id: new Types.ObjectId(),
        employment_history_canonical_status: 'REDUNDANT_REFERENCED', employment_history_canonical_survivor_id: input.completeHistoryRows[0]._id,
        history_reference_fence: 17, createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01'), __v: 8 });
    const { db, run } = setup(() => input, admin, { cloneFn: clone });
    const before = db.state();
    const nativeUpdate = db.deps.historyModel.updateOne;
    db.deps.historyModel.updateOne = async (filter, patch, options) => {
        assert.ok(filter._id instanceof Types.ObjectId);
        assert.equal(options.timestamps, false); assert.equal(options.upsert, false);
        const model = require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel;
        for (const [field, value] of Object.entries(patch.$set)) assert.ok(A.equal(model.schema.path(field).cast(value), value));
        return nativeUpdate(filter, patch, options);
    };
    const result = await run(); assert.equal(result.changedRows, 2);
    const after = db.state();
    assert.ok(after.history.every(row => row._id instanceof Types.ObjectId));
    const redundant = after.history.find(row => row.aa_eggrafhs === '0003');
    assert.deepEqual(redundant, before.history.find(row => row.aa_eggrafhs === '0003'));
    assert.ok(redundant.employment_history_canonical_survivor_id instanceof Types.ObjectId);
    for (const row of after.history) { assert.equal(row.history_reference_fence, row.aa_eggrafhs === '0003' ? 17 : 5); }
    assert.equal(after.employees[0][FIELD], 4);
    const { [FIELD]: technical, ...business } = after.employees[0];
    const { [FIELD]: oldTechnical, ...oldBusiness } = before.employees[0];
    assert.deepEqual(business, oldBusiness);
    assert.ok(after.audits[0].employeeScope.employee_id instanceof Types.ObjectId);
    assert.deepEqual(after.audits[0].historyBefore, before.history);
    assert.deepEqual(A.ordered(after.audits[0].historyAfter), A.ordered(after.history));
    const snapshot = db.state(); assert.equal((await run()).alreadyApplied, true); assert.deepEqual(db.state(), snapshot);
});

test('token binds engine/result identity and employee scope; informational changes and technical fences alone do not affect it', () => {
    const input = F.caseA(), plan = planner(input);
    const token = A.buildAutomaticReconstructionPreviewToken({ ...input, plan });
    assert.notEqual(A.buildAutomaticReconstructionPreviewToken({ ...input, scope: { ...input.scope, kodikos: 'different' }, plan }), token);
    assert.notEqual(A.buildAutomaticReconstructionPreviewToken({ ...input, plan: { ...plan, version: 'different-engine' } }), token);
    assert.notEqual(A.buildAutomaticReconstructionPreviewToken({ ...input, plan: { ...plan, rowDiffs: plan.rowDiffs.slice(1) } }), token);
    assert.notEqual(A.buildAutomaticReconstructionPreviewToken({ ...input, plan: { ...plan, status: 'REVIEW_REQUIRED' } }), token);
    input.currentEmployee[FIELD] = 500;
    input.completeHistoryRows.forEach(row => { row.history_reference_fence = 700; row.updatedAt = new Date(); });
    assert.equal(A.buildAutomaticReconstructionPreviewToken({ ...input, plan: planner(input) }), token);
});
test('completed action cannot be claimed by another actor; no duplicate audit is created', async () => {
    const { db, run } = setup(); await run(); const before = db.state();
    await rejectsCode(() => run({ actorUserId: 'another-authenticated-user' }), 'STALE'); noCommittedChanges(db, before);
});
test('standalone database capability fails closed before acquiring fence or writing anything', async () => {
    const { db, run } = setup(), before = db.state();
    await assert.rejects(() => run({ capabilityProbe: async () => false }), { code: 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE' });
    noCommittedChanges(db, before); assert.equal(db.events.length, 0);
});
