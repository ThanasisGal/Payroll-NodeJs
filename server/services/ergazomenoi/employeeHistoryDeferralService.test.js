'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./employeeEmploymentProfileWriter');
const D = require('./employeeHistoryDeferralService');
const E = require('./employeeDeferredExternalActionService');
const S = require('../../utils/ergazomenoi/employeeSaveState');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { fixture, store, scope } = require('../../../test/fixtures/employeeProfileTransactionStore');
const actorUserId = '700000000000000000000001';
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
const auth = { actorUserId, userModel: { findById: () => query({ _id: actorUserId, team: scope.team, situation: 'A' }) },
    privilegeModel: { findOne: ({ form }) => query({ privileges: {
        update: ['Ergazomenoi', 'ErgazomenoiApodoxes', 'ErgazomenoiKrathseis'].includes(form)
    } }) } };
const catalogs = { KPK_EFKA: [{ code: '0101' }], CONTRACT_TYPE: [{ code: '01' }],
    CONTRACT_CATEGORY: [{ code: '01', afora_thn_symbash: '01' }],
    CONTRACT_SPECIALTY: [{ code: '01', afora_thn_symbash_kathgoria: '0101' }] };
before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
function setup(fields = ['krathsh_01']) {
    const f = fixture(); f.employee._id = '507f1f77bcf86cd799439199';
    for (const field of fields) { delete f.employee[field]; delete f.history.at(-1)[field]; }
    return store([f], { cloneFn: A.clone });
}
function request(db, values = { pragmatikosMisthos: 1500 }) {
    return { scope, employeeId: String(db.state().employees[0]._id),
        expectedEmployeeStateToken: S.employeeStateToken(db.state().employees[0]),
        confirmationSession: 'synthetic-session-one', externalIntent: { e3_metaboles_ergasiakhs_sxeshs: true,
            isPermanent: true, erganiUploadMethod: 'rest' },
        maintenance: { employeeChanges: values, historyChanges: values, submittedHistoryChanges: values,
            submittedEmployeeFields: Object.keys(values), submittedFormValues: values } };
}
function save(db, input, extra = {}) {
    return W.writeEmployeeMaintenance({ ...db.deps, ...auth, correctionCatalogLoader: async () => catalogs,
        ...input, ...extra });
}
async function defer(db, input = request(db)) {
    const preview = await save(db, input, { historyPreflight: true });
    assert.equal(preview.status, 'MISSING_REQUIRED_HISTORY_FIELDS', preview.message);
    const result = await save(db, input, { historyDecision: 'DEFER_HISTORY', historyConfirmation: preview.historyConfirmation });
    return { input, preview, result };
}
const writes = db => db.events.filter(event => event.type === 'write' && event.kind === 'history');

test('read-only preview lists Greek missing groups before any business write or fence', async () => {
    const db = setup(['krathsh_01', 'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias', 'nomimosMisthos']);
    const initial = db.state(), p = await save(db, request(db), { historyPreflight: true });
    assert.equal(p.status, 'MISSING_REQUIRED_HISTORY_FIELDS', p.message);
    assert.deepEqual(p.missingFields.map(item => item.field).sort(), ['krathsh_01', 'hmeres_ergasias_ebdomadas',
        'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias', 'nomimosMisthos'].sort());
    assert.ok(p.missingFields.every(item => item.label && item.reason && item.group));
    assert.deepEqual(db.state(), initial);
    assert.equal(db.events.some(e => e.type === 'fence' || e.type === 'write'), false);
});
test('Return has zero Employee, History, audit, document and submission writes', async () => {
    const db = setup(), initial = db.state();
    await save(db, request(db), { historyPreflight: true });
    // Returning is the absence of a second request, as exercised by Chromium.
    assert.deepEqual(db.state(), initial); assert.equal(writes(db).length, 0);
});
test('Continue atomically saves all intended Employee values and versioned before/after with physically unchanged History', async () => {
    const db = setup(), initial = db.state();
    const { result } = await defer(db, request(db, { pragmatikosMisthos: 1500, symbash: '01', email: 'synthetic@example.invalid' }));
    const saved = db.state().employees[0], pending = saved[D.FIELD];
    assert.equal(result.historyDeferred, true); assert.equal(result.historyAlreadyClean, false);
    assert.equal(result.employeeUpdated, true); assert.equal(result.historyUpdated, false);
    assert.equal(result.externalActionsAllowed, true); assert.equal(result.historyStatus, 'PENDING_EMPLOYEE_RECONCILIATION');
    assert.equal(saved.pragmatikosMisthos, 1500); assert.equal(saved.email, 'synthetic@example.invalid');
    assert.equal(pending.version, D.VERSION); assert.equal(pending.before.pragmatikosMisthos.value, 1300);
    assert.equal(pending.after.pragmatikosMisthos.value, 1500); assert.equal(pending.before.krathsh_01.recorded, false);
    assert.equal(new Date(pending.effectiveFrom).toISOString().slice(0,10), '2026-03-01');
    assert.equal(pending.originalHistoryFingerprint, D.historyFingerprint(initial.history));
    assert.deepEqual(db.state().history, initial.history); assert.equal(writes(db).length, 0);
    assert.deepEqual(db.state().audits, initial.audits); assert.equal(result.protectedHistoryCount, initial.history.length);
});
for (const kind of ['employee', 'history', 'proposal', 'session', 'actor', 'forged', 'absent']) test(`Continue rejects ${kind} change with zero committed writes`, async () => {
    const db = setup(), input = request(db), p = await save(db, input, { historyPreflight: true });
    if (kind === 'employee') db.changeCommittedEmployee(input.employeeId, { email: 'concurrent@example.invalid' });
    if (kind === 'history') db.changeCommittedHistory(db.state().history[0]._id, { updatedAt: new Date('2026-11-20') });
    if (kind === 'proposal') input.maintenance.employeeChanges.pragmatikosMisthos = 1600;
    if (kind === 'session') input.confirmationSession = 'another-session';
    const initial = db.state();
    await assert.rejects(save(db, input, { historyDecision: 'DEFER_HISTORY',
        historyConfirmation: kind === 'absent' ? undefined : kind === 'forged' ? 'forged' : p.historyConfirmation,
        ...(kind === 'actor' ? { actorUserId: '700000000000000000000002' } : {}) }));
    assert.deepEqual(db.state(), initial); assert.equal(writes(db).length, 0);
});
test('fresh authentication/permissions are re-read on Continue', async () => {
    const db = setup(), input = request(db), p = await save(db, input, { historyPreflight: true }), initial = db.state();
    await assert.rejects(save(db, input, { historyDecision: 'DEFER_HISTORY', historyConfirmation: p.historyConfirmation,
        privilegeModel: { findOne: () => query({ privileges: { update: false } }) } }), { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN' });
    assert.deepEqual(db.state(), initial);
});
test('one confirmation cannot replay a committed save or repeat selected actions', async () => {
    const db = setup(), { input, preview } = await defer(db), initial = db.state();
    await assert.rejects(save(db, input, { historyDecision: 'DEFER_HISTORY', historyConfirmation: preview.historyConfirmation }));
    assert.deepEqual(db.state(), initial);
});
test('explicit later completion replays original facts/date through the normal planner, clears pending with audited History in one commit', async () => {
    const db = setup(); await defer(db);
    const original = db.state().employees[0][D.FIELD];
    const input = request(db, { krathsh_01: '0101' });
    input.externalIntent = {};
    input.pendingResolution = { id: original.id, effectiveFrom: '2026-03-01', confirmed: true };
    const p = await save(db, input, { historyPreflight: true });
    assert.equal(p.status, 'READY_FOR_COMBINED_SAVE', p.message);
    const commits = db.events.filter(e => e.type === 'commit').length;
    const result = await save(db, input, { historyDecision: 'RESOLVE_PENDING', historyConfirmation: p.historyConfirmation });
    assert.equal(result.pendingResolved, true); assert.equal(result.externalActionsAllowed, false);
    assert.equal(db.state().employees[0][D.FIELD], null); assert.equal(db.state().history.at(-1).pragmatikosMisthos, 1500);
    assert.equal(new Date(db.state().history.at(-1).hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10), '2026-03-01');
    assert.equal(db.state().audits.at(-1).diagnostics.pendingResolution.id, original.id);
    assert.equal(db.events.filter(e => e.type === 'commit').length, commits + 1);
    assert.equal(writes(db).length, 1);
});
test('unconfirmed completion, new dated event and changed History retain the first pending unchanged', async () => {
    for (const kind of ['unconfirmed', 'second', 'history', 'still-missing']) {
        const db = setup(); await defer(db); const pending = db.state().employees[0][D.FIELD];
        const values = kind === 'still-missing' ? {} : { krathsh_01: '0101' };
        if (kind === 'second') Object.assign(values, { pragmatikosMisthos: 1600, hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01' });
        if (kind === 'history') db.changeCommittedHistory(db.state().history[0]._id, { pragmatikosMisthos: 1700 });
        const initial = db.state(), input = request(db, values);
        if (kind !== 'unconfirmed') input.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
        const p = await save(db, input, { historyPreflight: true });
        assert.equal(p.status, 'UNSAFE_HISTORY_CHANGE', kind); assert.deepEqual(db.state(), initial);
    }
});
test('late audit failure rolls back History, Employee completion and pending clear together', async () => {
    const db = setup(); await defer(db); const initial = db.state(), pending = initial.employees[0][D.FIELD];
    const input = request(db, { krathsh_01: '0101' }); input.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
    const p = await save(db, input, { historyPreflight: true });
    await assert.rejects(save(db, input, { historyDecision: 'RESOLVE_PENDING', historyConfirmation: p.historyConfirmation,
        auditModel: { create: async () => { throw Error('SYNTHETIC_AUDIT_FAILURE'); } } }), /SYNTHETIC_AUDIT_FAILURE/);
    assert.deepEqual(db.state(), initial);
});
test('complete profile keeps ordinary combined save and exactly one existing physical History update', async () => {
    const db = setup([]), input = request(db), p = await save(db, input, { historyPreflight: true });
    assert.equal(p.status, 'READY_FOR_COMBINED_SAVE', p.message);
    const result = await save(db, input, { historyDecision: 'COMBINED_SAVE', historyConfirmation: p.historyConfirmation });
    assert.equal(result.historyUpdated, true); assert.equal(writes(db).length, 1); assert.equal(db.state().employees[0][D.FIELD], undefined);
});
for (const kind of ['overlap', 'protected', 'catalog', 'invalid-hours']) test(`${kind} cannot obtain a Continue confirmation`, async () => {
    const db = setup(), input = request(db), initial = db.state();
    if (kind === 'overlap') db.changeCommittedHistory(initial.history[1]._id, { hmeromhnia_isxyos_oron_ergasias_eos: '2026-04-30' });
    if (kind === 'catalog') Object.assign(input.maintenance.employeeChanges, { symbash: 'UNKNOWN' });
    if (kind === 'invalid-hours') Object.assign(input.maintenance.employeeChanges, { ores_ergasias_ebdomadas: 100 });
    const state = db.state();
    const p = await save(db, input, { historyPreflight: true, ...(kind === 'protected' ? {
        referenceChecker: async () => [{ collection: 'payrolldocs', documentId: 'protected-id' }] } : {}) });
    assert.equal(p.status, 'UNSAFE_HISTORY_CHANGE', p.message); assert.equal(p.historyConfirmation, undefined);
    assert.deepEqual(db.state(), state); assert.equal(writes(db).length, 0);
});
test('server-owned evidence cannot be forged by a direct service caller', async () => {
    const db = setup(), initial = db.state(), input = request(db);
    input.maintenance.employeeChanges[D.FIELD] = { version: D.VERSION };
    await assert.rejects(save(db, input), { code: 'EMPLOYEE_HISTORY_DEFER_FORGED' }); assert.deepEqual(db.state(), initial);
});
test('external actions start after commit, record failure independently and never repeat unknown/successful submissions', async () => {
    const db = setup(), { result } = await defer(db), initial = db.state();
    assert.ok(db.events.some(e => e.type === 'commit'));
    const options = { ...db.deps, ...auth, scope, employeeId: String(initial.employees[0]._id), key: result.idempotencyKey, type: 'MA' };
    let externalCalls = 0;
    await E.updateAction(options); externalCalls++;
    await E.updateAction({ ...options, outcome: { success: false, httpStatus: 503 } });
    assert.equal(db.state().employees[0][D.ACTIONS][0].actions[0].status, 'UNKNOWN');
    await assert.rejects(E.updateAction(options), { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED' });
    assert.equal(externalCalls, 1); assert.deepEqual(db.state().history, initial.history);
    assert.deepEqual(db.state().employees[0][D.FIELD], initial.employees[0][D.FIELD]);
});
test('proven failure before dispatch permits only the same selected action to retry once', async () => {
    const db = setup(), { result } = await defer(db), options = { ...db.deps, ...auth, scope,
        employeeId: String(db.state().employees[0]._id), key: result.idempotencyKey, type: 'MA' };
    await E.updateAction(options);
    await E.updateAction({ ...options, outcome: { success: false, submissionAttempted: false, httpStatus: 400 } });
    await E.updateAction(options);
    await E.updateAction({ ...options, outcome: { success: true, protocol: 'SYNTHETIC', httpStatus: 200 } });
    await assert.rejects(E.updateAction(options));
    await assert.rejects(E.updateAction({ ...options, type: 'E7N' }));
    assert.equal(db.state().employees[0][D.ACTIONS][0].actions[0].status, 'SUCCEEDED');
});

test('a concurrent History commit causes transactional retry, rejects the old confirmation and rolls back pending/Employee writes', async () => {
    const db = setup(), input = request(db), preview = await save(db, input, { historyPreflight: true });
    let concurrent;
    db.hooks.beforeCommit = session => {
        if (concurrent || !session.touched.size) return;
        db.changeCommittedHistory(db.state().history[0]._id, { updatedAt: new Date('2026-11-20') });
        db.changeCommittedEmployee(input.employeeId, { email: 'concurrent@example.invalid' });
        concurrent = db.state();
    };
    await assert.rejects(save(db, input, { historyDecision: 'DEFER_HISTORY', historyConfirmation: preview.historyConfirmation }));
    assert.deepEqual(db.state(), concurrent); assert.equal(db.state().employees[0][D.FIELD], undefined);
    assert.ok(db.events.some(event => event.type === 'retry'));
});
test('positive daily pay, optional zero/false and recorded empty collections retain their own semantics', async () => {
    const f = fixture(); f.employee._id = '507f1f77bcf86cd799439199';
    for (const record of [f.employee, f.history.at(-1)]) {
        delete record.krathsh_01; record.nomimosMisthos = 0; record.nomimoHmeromisthio = 60;
    }
    const db = store([f], { cloneFn: A.clone }), { preview } = await defer(db);
    assert.deepEqual(preview.missingFields.map(item => item.field), ['krathsh_01']);
    const pending = db.state().employees[0][D.FIELD];
    assert.equal(pending.after.nomimosMisthos.value, 0);
    assert.equal(pending.after.dialleima_entos_ektos_orarioy.value, false);
    assert.deepEqual(pending.after.hmeres_efarmoghs_egkekrimenhs_rythmishs.value, []);
});

for (const [type, flag, processCode] of [['E5N','ma_217','217'], ['E7N','ma_222','222'],
    ['E6N','ma_221','221'], ['MA','e3_metaboles_ergasiakhs_sxeshs','230'], ['WTO','wto_pshfiakh_organosh_xronoy_ergasias',null]]) {
    test(`production middleware dispatches selected ${type} once after Employee commit, then blocks stale browser replay`, async () => {
        const db = setup(), input = request(db); input.externalIntent = { [flag]: true, isPermanent: true, erganiUploadMethod: 'rest' };
        const { result } = await defer(db, input);
        const employeeModel = { ...db.deps.employeeModel, findOne(filter) {
            const query = db.deps.employeeModel.findOne(filter), lean = query.lean;
            query.lean = function() { return this.s ? lean.call(this) : Promise.resolve(db.state().employees[0]); };
            return query;
        } };
        const guard = E.guardDeferredExternalAction(type, { ...db.deps, ...auth, employeeModel });
        const req = { path: `/ergazomenoi/ergazomenoi/submit-${type.toLowerCase()}-to-erganh`,
            headers: { 'x-employee-history-action': result.idempotencyKey },
            session: { userTeam: scope.team, companyInUse: scope.company_kod, userId: actorUserId },
            body: { ergazomenosId: input.employeeId, erganiUploadMethod: 'rest', ...(type === 'E6N' ? { processCode } : {}) } };
        const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
        let dispatches = 0; const first = response();
        await guard(req, first, async () => {
            assert.ok(db.events.some(event => event.type === 'commit')); dispatches++;
            await first.json({ success: true, protocol: `SYNTHETIC-${type}` });
        });
        assert.equal(first.body.success, true); assert.equal(first.body.deferredExternalAction.status, 'SUCCEEDED');
        const repeated = response(); await guard(req, repeated, () => { dispatches++; });
        assert.equal(repeated.statusCode, 409); assert.equal(dispatches, 1);
        assert.equal(db.state().employees[0][D.FIELD].id, result.idempotencyKey);
    });
}
test('external middleware rejects altered method/process/period and unselected action without claiming or dispatching', async () => {
    const db = setup(), input = request(db); input.externalIntent = { ma_221: true, isPermanent: true, erganiUploadMethod: 'rest' };
    const { result } = await defer(db, input), before = db.state();
    for (const actionRequest of [
        { xml: false, body: { processCode: '220', erganiUploadMethod: 'rest' } },
        { xml: true, body: { processCode: '221', erganiUploadMethod: 'xml' } },
        { xml: false, body: { processCode: '221', ypokatasthma: 'another-branch' } },
        { xml: false, body: { processCode: '221', forgedPayload: true } }
    ]) {
        await assert.rejects(E.updateAction({ ...db.deps, ...auth, scope, employeeId: input.employeeId,
            key: result.idempotencyKey, type: 'E6N', actionRequest }), { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_PROPOSAL_CHANGED' });
        assert.deepEqual(db.state(), before);
    }
});
test('first departure with missing profile preserves both actual departure and original terms dates for exact later replay', async () => {
    const db = setup(), input = request(db, { hmeromhnia_apoxorhshs: '2026-09-30', pragmatikosMisthos: 1500 });
    input.externalIntent = { ma_217: true, isPermanent: true, erganiUploadMethod: 'rest' };
    const initial = db.state(), { result } = await defer(db, input), pending = db.state().employees[0][D.FIELD];
    assert.equal(result.historyDeferred, true); assert.equal(pending.eventType, 'FIRST_DEPARTURE');
    assert.equal(new Date(pending.effectiveFrom).toISOString().slice(0,10), '2026-09-30');
    assert.equal(new Date(pending.profileEffectiveFrom).toISOString().slice(0,10), '2026-03-01');
    assert.deepEqual(db.state().history, initial.history);
    const completion = request(db, { krathsh_01: '0101' }); completion.externalIntent = {};
    completion.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
    const p = await save(db, completion, { historyPreflight: true });
    assert.equal(p.status, 'READY_FOR_COMBINED_SAVE', p.message);
    const resolved = await save(db, completion, { historyDecision: 'RESOLVE_PENDING', historyConfirmation: p.historyConfirmation });
    assert.equal(resolved.pendingResolved, true); assert.equal(db.state().employees[0][D.FIELD], null);
    assert.equal(new Date(db.state().history.at(-1).hmeromhnia_apoxorhshs).toISOString().slice(0,10), '2026-09-30');
});
test('direct profile append and aggregate deletion cannot bypass the first pending event', async () => {
    const db = setup(), { input } = await defer(db), before = db.state();
    await assert.rejects(W.writeEmployeeEmploymentProfile({ ...db.deps, scope, employeeId: input.employeeId,
        effectiveFrom: '2026-06-01' }), { code: 'EMPLOYEE_HISTORY_DEFER_SECOND_CHANGE' });
    assert.deepEqual(db.state(), before);
    await assert.rejects(W.deleteEmployeeAndEmploymentHistory({ ...db.deps, scope, employeeId: input.employeeId }),
        { code: 'EMPLOYEE_HISTORY_DEFER_SECOND_CHANGE' });
    assert.deepEqual(db.state(), before);
});
test('missing History baseline cannot create an unreplayable pending target or grant Continue', async () => {
    const f = fixture(); f.employee._id = '507f1f77bcf86cd799439199'; delete f.employee.krathsh_01; f.history = [];
    const db = store([f], { cloneFn: A.clone }), initial = db.state();
    const result = await save(db, request(db), { historyPreflight: true });
    assert.equal(result.status, 'UNSAFE_HISTORY_CHANGE'); assert.equal(result.historyConfirmation, undefined);
    assert.deepEqual(db.state(), initial);
});
test('omitting the action key after History reconciliation cannot resubmit the same committed departure', async () => {
    const db = setup(), input = request(db, { hmeromhnia_apoxorhshs: '2026-09-30', pragmatikosMisthos: 1500 });
    input.externalIntent = { ma_217: true, isPermanent: true, erganiUploadMethod: 'rest' };
    const { result } = await defer(db, input), pending = db.state().employees[0][D.FIELD];
    const options = { ...db.deps, ...auth, scope, employeeId: input.employeeId, key: result.idempotencyKey, type: 'E5N' };
    await E.updateAction(options); await E.updateAction({ ...options, outcome: { success: true, protocol: 'SYNTHETIC' } });
    const completion = request(db, { krathsh_01: '0101' }); completion.externalIntent = {};
    completion.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
    const preview = await save(db, completion, { historyPreflight: true });
    await save(db, completion, { historyDecision: 'RESOLVE_PENDING', historyConfirmation: preview.historyConfirmation });
    assert.equal(db.state().employees[0][D.FIELD], null);
    const employeeModel = { ...db.deps.employeeModel, findOne(filter) {
        const query = db.deps.employeeModel.findOne(filter), lean = query.lean;
        query.lean = function() { return this.s ? lean.call(this) : Promise.resolve(db.state().employees[0]); };
        return query;
    } };
    const guard = E.guardDeferredExternalAction('E5N', { ...db.deps, ...auth, employeeModel });
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    let dispatches = 0;
    await guard({ body: { ergazomenosId: input.employeeId }, headers: {},
        session: { userId: actorUserId, userTeam: scope.team, companyInUse: scope.company_kod } }, res, () => { dispatches++; });
    assert.equal(dispatches, 0); assert.equal(res.body.success, false);
    assert.equal(res.statusCode, 403); assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_DEFER_ACTION_FORBIDDEN');
});


test('PR406: an independently authorized second user can complete the first planned pending, without replaying external actions', async () => {
    const db = setup(); const initialSave = await defer(db);
    const pending = db.state().employees[0][D.FIELD];
    const actionsBefore = structuredClone(db.state().employees[0][D.ACTIONS]);
    const otherActor = '700000000000000000000002';
    const secondRights = {
        actorUserId: otherActor,
        userModel: { findById: () => query({ _id: otherActor, team: scope.team, situation: 'A' }) },
        privilegeModel: { findOne: ({ form }) => query({ privileges: {
            update: ['Ergazomenoi', 'ErgazomenoiApodoxes', 'ErgazomenoiKrathseis'].includes(form)
        } }) }
    };
    const input = request(db, { krathsh_01: '0101' });
    input.externalIntent = {};
    input.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
    const preview = await save(db, input, { ...secondRights, historyPreflight: true });
    assert.equal(preview.decision, 'RESOLVE_PENDING');
    assert.equal(preview.status, 'READY_FOR_COMBINED_SAVE');
    const result = await save(db, input, { ...secondRights, historyDecision: 'RESOLVE_PENDING',
        historyConfirmation: preview.historyConfirmation });
    assert.equal(result.pendingResolved, true);
    assert.equal(result.externalActionsAllowed, false);
    assert.equal(db.state().employees[0][D.FIELD], null);
    assert.deepEqual(db.state().employees[0][D.ACTIONS], actionsBefore);
});

// Stage3: pending is shared across authorized users. Only independent contact
// changes may commit; History and previously selected external actions stay fixed.
test('PR406 Stage3: second authorized user may save email while first History pending, without touching History/audit/ERGANI ledger', async () => {
    const db = setup(); await defer(db);
    const before = db.state();
    const secondActor = '700000000000000000000002';
    const actor = { actorUserId: secondActor,
        userModel: { findById: () => query({ _id: secondActor, situation: 'A', team: scope.team }) },
        privilegeModel: { findOne: () => query({ privileges: { update: true } }) } };
    const input = request(db, { email: 'second-actor@example.invalid' });
    input.externalIntent = {};
    const p = await save(db, input, { ...actor, historyPreflight: true });
    assert.equal(p.preflight, true);
    assert.equal(p.decision, 'SAVE_PENDING_CONTACT');
    assert.equal(p.status, 'READY_FOR_PENDING_CONTACT_SAVE');
    assert.deepEqual(db.state(), before);
    const result = await save(db, input, { ...actor, historyDecision: 'SAVE_PENDING_CONTACT',
        historyConfirmation: p.historyConfirmation });
    assert.equal(result.employeeUpdated, true);
    assert.equal(result.historyUpdated, false);
    const after = db.state();
    assert.equal(after.employees[0].email, 'second-actor@example.invalid');
    assert.deepEqual(after.history, before.history);
    assert.deepEqual(after.audits, before.audits);
    assert.deepEqual(after.employees[0][D.FIELD], before.employees[0][D.FIELD]);
    assert.deepEqual(after.employees[0][D.ACTIONS], before.employees[0][D.ACTIONS]);
    assert.equal(db.events.some(event => event.type === 'write' && event.kind === 'history'), false);
});

test('PR406 Stage3: forged confirmation and second salary change fail; separately confirmed ERGANI selection preserves pending', async () => {
    const db = setup(); await defer(db);
    const before = db.state();
    const input = request(db, { email: 'new@example.invalid' });
    input.externalIntent = {};
    const p = await save(db, input, { historyPreflight: true });
    assert.equal(p.decision, 'SAVE_PENDING_CONTACT');
    await assert.rejects(save(db, input, { historyDecision: 'SAVE_PENDING_CONTACT', historyConfirmation: 'forged' }),
        { code: 'EMPLOYEE_HISTORY_DEFER_STALE' });
    assert.deepEqual(db.state(), before);
    const salary = request(db, { email: 'new@example.invalid', pragmatikosMisthos: 1550 });
    salary.externalIntent = {};
    const salaryPreview = await save(db, salary, { historyPreflight: true });
    assert.equal(salaryPreview.status, 'UNSAFE_HISTORY_CHANGE');
    assert.equal(salaryPreview.historyConfirmation, undefined);
    const action = request(db, { email: 'new@example.invalid' });
    action.externalIntent = { e3_metaboles_ergasiakhs_sxeshs: true };
    const actionPreview = await save(db, action, { historyPreflight: true });
    assert.equal(actionPreview.status, 'READY_FOR_PENDING_CONTACT_SAVE');
    assert.deepEqual(db.state(), before);
    await assert.rejects(save(db, action, { historyDecision:'SAVE_PENDING_CONTACT',historyConfirmation:p.historyConfirmation }),
        {code:'EMPLOYEE_HISTORY_DEFER_STALE'});
    assert.deepEqual(db.state(), before);
    const saved = await save(db, action, {historyDecision:actionPreview.decision,historyConfirmation:actionPreview.historyConfirmation});
    assert.equal(saved.employeeUpdated,true);
    assert.equal(saved.externalActionsAllowed,true);
    assert.equal(db.state().employees[0].email,'new@example.invalid');
    assert.deepEqual(db.state().history,before.history);
    assert.deepEqual(db.state().audits,before.audits);
    assert.deepEqual(db.state().employees[0][D.FIELD],before.employees[0][D.FIELD]);
    assert.deepEqual(db.state().employees[0][D.ACTIONS].slice(0,-1),before.employees[0][D.ACTIONS]);
    assert.deepEqual(db.state().employees[0][D.ACTIONS].at(-1).actions,[{type:'MA',status:'SELECTED'}]);
    assert.equal(db.state().employees[0][D.ACTIONS].at(-1).key,saved.idempotencyKey);
});

test('PR406 Stage3: no-update-right actor cannot save independent email during pending', async () => {
    const db = setup(); await defer(db);
    const before = db.state();
    const input = request(db, { email: 'not-authorized@example.invalid' });
    input.externalIntent = {};
    await assert.rejects(save(db, input, { historyPreflight: true,
        privilegeModel: { findOne: () => query({ privileges: { update: false } }) } }),
    { code: 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN' });
    assert.deepEqual(db.state(), before);
});

// PR406 Stage4A: widening independent contact never widens History or ERGANI.
test('PR406 Stage4A: another authorized actor updates phone without History/audit/external ledger writes', async () => {
    const db = setup(); await defer(db);
    const old = db.state();
    const actorId = '700000000000000000000002';
    const actor = { actorUserId: actorId,
        userModel: { findById: () => query({ _id: actorId, situation: 'A', team: scope.team }) },
        privilegeModel: { findOne: () => query({ privileges: { update: true } }) } };
    const input = request(db, { thlefono: '2101234567' });
    input.externalIntent = {};
    const preview = await save(db, input, { ...actor, historyPreflight: true });
    assert.equal(preview.decision, 'SAVE_PENDING_CONTACT');
    assert.deepEqual(db.state(), old);
    const result = await save(db, input, { ...actor, historyDecision: preview.decision,
        historyConfirmation: preview.historyConfirmation });
    assert.equal(result.employeeUpdated, true);
    assert.equal(result.historyUpdated, false);
    const after = db.state();
    assert.equal(after.employees[0].thlefono, '2101234567');
    assert.deepEqual(after.history, old.history);
    assert.deepEqual(after.audits, old.audits);
    assert.deepEqual(after.employees[0][D.FIELD], old.employees[0][D.FIELD]);
    assert.deepEqual(after.employees[0][D.ACTIONS], old.employees[0][D.ACTIONS]);
});
test('PR406 Stage4A: phone cannot smuggle salary; explicit signed PDF selection is kept after Employee commit', async () => {
    const db = setup(); await defer(db);
    const old = db.state();
    const input = request(db, { thlefono: '2101234567', pragmatikosMisthos: 1600 });
    input.externalIntent = {};
    const refused = await save(db, input, { historyPreflight: true });
    assert.equal(refused.status, 'UNSAFE_HISTORY_CHANGE');
    assert.equal(refused.historyConfirmation, undefined);
    const external = request(db, { thlefono: '2101234567' });
    external.externalIntent = { create_contract: true };
    const preview = await save(db, external, { historyPreflight: true });
    assert.equal(preview.status, 'READY_FOR_PENDING_CONTACT_SAVE');
    assert.deepEqual(db.state(), old);
    const saved = await save(db, external, {historyDecision:preview.decision,historyConfirmation:preview.historyConfirmation});
    assert.equal(saved.externalActionsAllowed,true);
    assert.equal(db.state().employees[0].thlefono,'2101234567');
    assert.deepEqual(db.state().history,old.history);
    assert.deepEqual(db.state().audits,old.audits);
    assert.deepEqual(db.state().employees[0][D.FIELD],old.employees[0][D.FIELD]);
    assert.deepEqual(db.state().employees[0][D.ACTIONS].slice(0,-1),old.employees[0][D.ACTIONS]);
    assert.equal(db.state().employees[0][D.ACTIONS].at(-1).intent.create_contract,true);
    assert.equal(db.state().employees[0][D.ACTIONS].at(-1).documents.status,'PREPARING');
    assert.equal(db.state().employees[0][D.ACTIONS].at(-1).key,saved.idempotencyKey);
});

// An existing real planned pending cannot be completed with general update
// rights alone. The feature is checked on the preflight and on final replay.
test('PR406 Stage4B: Employee.update without deduction section cannot complete pending', async () => {
    const db = setup();
    const initialInput = request(db);
    const preflight = await save(db, initialInput, { historyPreflight: true });
    assert.equal(preflight.status, 'MISSING_REQUIRED_HISTORY_FIELDS');
    await save(db, initialInput, {
        historyDecision: 'DEFER_HISTORY', historyConfirmation: preflight.historyConfirmation
    });
    const pending = db.state().employees[0][D.FIELD];
    const initial = db.state();
    const complete = request(db, { krathsh_01: '0101' });
    complete.externalIntent = {};
    complete.pendingResolution = { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true };
    const restrictedModel = { findOne: ({ form }) => query({ privileges:
        { update: form === 'Ergazomenoi' } }) };
    const result = await save(db, complete,
        { privilegeModel: restrictedModel, historyPreflight: true });
    assert.equal(result.status, 'UNSAFE_HISTORY_CHANGE');
    assert.equal(result.reason, 'EMPLOYEE_PENDING_HISTORY_SECTION_FORBIDDEN');
    assert.equal(result.historyConfirmation, undefined);
    assert.deepEqual(db.state(), initial);
});
