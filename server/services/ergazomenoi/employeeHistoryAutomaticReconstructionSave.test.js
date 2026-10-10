'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./employeeEmploymentProfileWriter');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const S = require('./employeeHistoryAutomaticReconstructionSaveContract');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { fixture, store, deferred } = require('../../../test/fixtures/employeeProfileTransactionStore');
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
function setup(input = F.caseA(), user = { privileges: 'A', team: 'THA', situation: 'A' }, request = {}) {
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }]);
    db.deps.auditModel.findOne = filter => ({ session(session) { this.s = session; return this; }, async lean() {
        return this.s.draft.audits.find(audit => audit.mutationSource === filter.mutationSource &&
            String(audit.employeeScope.employee_id) === String(filter['employeeScope.employee_id']) &&
            audit.diagnostics.applyTokenHash === filter['diagnostics.applyTokenHash'] &&
            audit.diagnostics.actor.userId === filter['diagnostics.actor.userId']) || null;
    } });
    const options = { ...db.deps, scope: input.scope, employeeId: input.currentEmployee._id,
        actorUserId: 'actor', userModel: { findById: () => query(user) }, correctionCatalogLoader: async () => ({}),
        effectiveFrom: '2026-05-25', maintenance: { employeeChanges: { parathrhseis: 'synthetic note' },
            submittedEmployeeFields: ['parathrhseis'], historyChanges: {}, submittedHistoryChanges: {}, submittedProfileFields: [] }, ...request };
    const run = overrides => W.writeEmployeeEmploymentProfileWithAutomaticReconstruction({ ...options, ...overrides });
    const preview = async () => {
        let error;
        try { await run(); } catch (e) { error = e; }
        assert.equal(error?.code, A.PREFIX + 'REQUIRED');
        return { previewToken: error.previewToken, approvalAccepted: true };
    };
    return { db, input, options, run, preview };
}
function noWrites(db, before) { assert.deepEqual(db.state(), before); assert.equal(db.events.some(e => ['write', 'commit', 'fence'].includes(e.type)), false); }
function noCommit(db, before) { assert.deepEqual(db.state(), before); }

function coincidentArtifactsRequest(input, employeeChanges = {}) {
    return { maintenance: { employeeChanges,
        submittedEmployeeFields: Object.keys(employeeChanges),
        historyChanges: {}, submittedHistoryChanges: {}, submittedProfileFields: [],
        originalHistoryId: input.completeHistoryRows[1]._id,
        expectedRevision: input.completeHistoryRows[1].updatedAt } };
}

test('exact legacy-artifact conflict: normal NO_HISTORY_CHANGE cleanup removes 21 approved values; initial Save preserves all 25', async () => {
    const input = F.coincidentLegacyArtifacts(), plan = planner(input);
    assert.equal(plan.status, 'REVIEW_REQUIRED');
    assert.equal(plan.rowDiffs.length, 25);
    assert.equal(new Set(plan.rowDiffs.map(diff => diff.historyId)).size, 3);
    const legacy = require('./employeeMaintenanceHistoryPlannerService').planEmployeeMaintenanceHistory({
        scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: plan.proposedRows, historyId: 'synthetic-0002',
        submittedState: { effectiveFrom: '2026-05-25', employeePatch: {}, historyPatch: {} }
    });
    assert.equal(legacy.state, 'NO_HISTORY_CHANGE');
    assert.deepEqual(legacy.rowsToDelete.map(row => row.historyId).sort(), ['synthetic-0001', 'synthetic-0002']);
    const conflicts = plan.rowDiffs.filter(diff => !legacy.canonicalRows.some(row =>
        row._id === diff.historyId && A.equal(row[diff.field], diff.after)));
    assert.equal(conflicts.length, 21);
    const exactConflict = conflicts.find(diff => diff.historyId === 'synthetic-0002' &&
        diff.field === 'hmeromhnia_isxyos_oron_ergasias_apo');
    assert.equal(new Date(exactConflict.before).toISOString(), '2026-05-25T00:00:00.000Z');
    assert.equal(new Date(exactConflict.after).toISOString(), '2026-04-23T00:00:00.000Z');
    assert.equal(legacy.canonicalRows.find(row => row._id === exactConflict.historyId), undefined);
    assert.throws(() => S.assertCompatiblePlans(plan, legacy.canonicalRows), { code: A.PREFIX + 'SAVE_CONFLICT' });
    const { db, run } = setup(input, undefined, coincidentArtifactsRequest(input)), before = db.state();
    let error; try { await run(); } catch (e) { error = e; }
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    S.sendReconstructionSaveError(res, error);
    assert.equal(res.body.reason, A.PREFIX + 'REQUIRED');
    assert.equal(res.code, 200);
    assert.equal(res.body.success, false);
    assert.equal(res.body.actionRequired, true);
    noWrites(db, before);
});

test('coincident artifacts: approval persists exactly 25 approved fields, three rows and one audit; Employee-only edit survives', async () => {
    const input = F.coincidentLegacyArtifacts(), plan = planner(input);
    const { db, run, preview } = setup(input, undefined,
        coincidentArtifactsRequest(input, { parathrhseis: 'intentional note' }));
    const reconstruction = await preview();
    const result = await run({ reconstruction }), after = db.state();
    assert.equal(result.automaticReconstructionApplied, true);
    assert.equal(after.employees[0].parathrhseis, 'intentional note');
    assert.equal(after.employees[0].meiosh_eisforon_mhteron, false);
    assert.equal(after.history.length, 3);
    S.assertCompatiblePlans(plan, after.history);
    for (const original of input.completeHistoryRows) {
        const row = after.history.find(item => item._id === original._id);
        const approved = plan.rowDiffs.filter(diff => diff.historyId === original._id);
        const expected = { ...original, ...Object.fromEntries(approved.map(diff => [diff.field, diff.after])) };
        const withoutRevision = value => Object.fromEntries(Object.entries(value).filter(([field]) => field !== 'updatedAt'));
        assert.deepEqual(withoutRevision(row), withoutRevision(expected));
    }
    assert.equal(after.audits.length, 1);
    assert.equal(after.audits[0].mutationSource, A.OPERATION);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    assert.equal(A.isNoOp(planner({ ...input, currentEmployee: after.employees[0], completeHistoryRows: after.history })), true);
    const beforeRetry = db.state();
    assert.equal((await run({ reconstruction })).alreadyApplied, true);
    noCommit(db, beforeRetry);
});

test('H: passive lending, derived seniority and equivalent tax echoes do not stale approval or enter original Save', async () => {
    const input = F.caseA();
    Object.assign(input.currentEmployee, { afora_daneismo_ergazomenoy: false,
        synolo_proyphresias_se_mhnes: 3, forologikh_klimaka: '20260200 - existing description' });
    const { db, run, preview, options } = setup(input);
    const reconstruction = await preview();
    const defaults = require('../../utils/ergazomenoi/employeeNormalSaveNormalization').PASSIVE_LENDING_DEFAULTS;
    const employeeChanges = { ...options.maintenance.employeeChanges, ...defaults,
        synolo_proyphresias_se_mhnes: 5, forologikh_klimaka: '0200' };
    await run({ reconstruction, maintenance: { ...options.maintenance, employeeChanges,
        submittedEmployeeFields: Object.keys(employeeChanges), submittedFormValues: employeeChanges } });
    const after = db.state().employees[0];
    for (const field of Object.keys(defaults)) assert.equal(Object.hasOwn(after, field), false, field);
    assert.equal(after.synolo_proyphresias_se_mhnes, 3);
    assert.equal(after.forologikh_klimaka, input.currentEmployee.forologikh_klimaka);
    assert.equal(after.parathrhseis, 'synthetic note');
});

test('forged non-neutral lending submission changes approval intent even when non-lending controller cleanup is neutral', async () => {
    const { db, run, preview, options } = setup(), reconstruction = await preview(), before = db.state();
    const employeeChanges = { ...options.maintenance.employeeChanges, afm_daneizontos_ergodoth: '' };
    await assert.rejects(() => run({ reconstruction, maintenance: { ...options.maintenance, employeeChanges,
        submittedFormValues: { afm_daneizontos_ergodoth: '123456789' } } }), { code: A.PREFIX + 'STALE' });
    noCommit(db, before);
});

test('duplicate continuation verifies original pre-save normalization after real lending cleanup and tax change', async () => {
    const input = F.caseA();
    Object.assign(input.currentEmployee, { afora_daneismo_ergazomenoy: true, forologikh_klimaka: '0100',
        afm_daneizontos_ergodoth: '123456789' });
    const defaults = require('../../utils/ergazomenoi/employeeNormalSaveNormalization').PASSIVE_LENDING_DEFAULTS;
    const employeeChanges = { afora_daneismo_ergazomenoy: false, ...defaults, forologikh_klimaka: '0200' };
    const { db, preview, run } = setup(input, undefined, { maintenance: { employeeChanges,
        submittedEmployeeFields: Object.keys(employeeChanges), historyChanges: {}, submittedHistoryChanges: {} } });
    const reconstruction = await preview();
    await run({ reconstruction });
    const before = db.state();
    assert.equal((await run({ reconstruction })).alreadyApplied, true);
    noCommit(db, before);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
});

test('B/C: initial Save is HTTP 200 actionRequired, zero writes including fence; cancellation is just no continuation', async () => {
    const { db, run } = setup(), before = db.state();
    let error; try { await run(); } catch (e) { error = e; }
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    assert.equal(S.sendReconstructionSaveError(res, error), true);
    assert.equal(res.code, 200); assert.equal(res.body.actionRequired, true);
    assert.equal(res.body.nextAction.type, 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_SAVE');
    assert.doesNotMatch(JSON.stringify(res.body), /proposedRows|rowDiffs|sourceHistoryIds|synthetic-current/);
    noWrites(db, before);
});
test('D/T: original Employee edit and exact reconstruction commit once with one audit; final planner NO_OP', async () => {
    const { db, run, preview, input } = setup(); const reconstruction = await preview();
    const result = await run({ reconstruction }), after = db.state();
    assert.equal(result.automaticReconstructionApplied, true); assert.equal(after.employees[0].parathrhseis, 'synthetic note');
    assert.equal(after.audits.filter(a => a.mutationSource === A.OPERATION).length, 1);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
    assert.equal(db.events.filter(e => e.type === 'fence').length, 1);
    assert.ok(A.isNoOp(planner({ scope: input.scope, currentEmployee: after.employees[0], completeHistoryRows: after.history })));
    assert.equal(new Set(db.events.filter(e => ['write', 'fence', 'commit'].includes(e.type)).map(e => e.session)).size, 1);
});
test('A: clean History has no approval or reconstruction audit and keeps ordinary Save behavior', async () => {
    const input = F.caseA(); input.completeHistoryRows = planner(input).proposedRows;
    const { run, db } = setup(input); const result = await run();
    assert.equal(result.automaticReconstructionApplied, undefined); assert.equal(db.state().audits.length, 0);
    assert.equal(db.state().employees[0].parathrhseis, 'synthetic note');
});
for (const kind of ['Employee', 'History']) test(`H/I: stale ${kind}, 409, no committed changes`, async () => {
    const { db, preview, run } = setup(); const reconstruction = await preview();
    if (kind === 'Employee') db.changeCommittedEmployee('synthetic-current', { parathrhseis: 'concurrent' });
    else db.changeCommittedHistory('synthetic-0001', { pragmatikosMisthos: 999 });
    const before = db.state(); await assert.rejects(() => run({ reconstruction }), { code: A.PREFIX + 'STALE', statusCode: 409 }); noCommit(db, before);
});
for (const reconstruction of [{ approvalAccepted: false, previewToken: 'a'.repeat(43) },
    { approvalAccepted: true }, { approvalAccepted: true, previewToken: {} },
    { approvalAccepted: true, previewToken: 'a'.repeat(43), proposedRows: [] }]) test(`Q/R/S: invalid approval rejected before reads: ${JSON.stringify(reconstruction)}`, async () => {
    const { db, run } = setup(), before = db.state(); await assert.rejects(() => run({ reconstruction }), e => e.statusCode === 400); noWrites(db, before);
});
test('Q: forged planner output outside the allowed Save intent has no authority', async () => {
    const { db, run, preview } = setup(); const reconstruction = await preview();
    await run({ reconstruction, proposedRows: [{ pragmatikosMisthos: 99999 }], rowDiffs: [{ field: 'pragmatikosMisthos', after: 99999 }] });
    assert.ok(db.state().history.every(row => row.pragmatikosMisthos !== 99999));
});
test('M: exact duplicate continuation returns saved result without a second commit, version or audit', async () => {
    const { db, run, preview } = setup(); const reconstruction = await preview(); await run({ reconstruction });
    const before = db.state(), result = await run({ reconstruction });
    assert.equal(result.alreadyApplied, true); assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
});
test('F: original Employee write fails after reconstruction and audit; all roll back', async () => {
    const { db, run, preview } = setup(); const reconstruction = await preview(), before = db.state();
    const update = db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne = async (filter, patch, options) => {
        if (patch.$set) { assert.equal(options.session.draft.audits.length, 1); throw new Error('synthetic original save failure'); }
        return update(filter, patch, options);
    };
    await assert.rejects(() => run({ reconstruction }), /synthetic original save failure/); noCommit(db, before);
});
test('G: original Save validation blocks before any reconstruction write or audit', async () => {
    const { db, run, options } = setup(), before = db.state();
    await assert.rejects(() => run({ maintenance: { ...options.maintenance, employeeChanges: { hmeromhnia_proslhpshs: '2020-01-01' } } }),
        { code: 'EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE' }); noWrites(db, before);
});
for (const [name, user] of [['Supervisor outside repair scope', { privileges: 'S', team: 'TEST', situation: 'A' }],
    ['ordinary user', { privileges: 'U', team: 'TEST', situation: 'A' }], ['inactive Admin', { privileges: 'A', team: 'THA', situation: 'I' }]]) {
    test(`N: ${name}, existing authorization preserved with no writes`, async () => {
        const { db, run } = setup(F.caseA(), user), before = db.state(); await assert.rejects(run, e => e.statusCode === 403); noWrites(db, before);
    });
}
test('J: concurrent informational schedule-only edit survives reconstruction', async () => {
    const { db, run, preview } = setup(); const reconstruction = await preview();
    db.changeCommittedHistory('synthetic-0001', { hmeromhnia_allaghs_orarioy_apo: '2044-12-01' });
    await run({ reconstruction }); assert.equal(db.state().history.find(row => row._id === 'synthetic-0001').hmeromhnia_allaghs_orarioy_apo, '2044-12-01');
});
test('K/L: exact typed equality composes; different, missing and removed reconstructed fields fail closed', () => {
    const plan = { rowDiffs: [{ historyId: 'row', field: 'salary', after: 1200 }] };
    S.assertCompatiblePlans(plan, [{ _id: 'row', salary: 1200 }]);
    for (const rows of [[{ _id: 'row', salary: 1300 }], [{ _id: 'row', salary: '1200' }], [{ _id: 'row' }], []])
        assert.throws(() => S.assertCompatiblePlans(plan, rows), { code: A.PREFIX + 'SAVE_CONFLICT' });
});
test('submitted new salary/hours never become reconstruction evidence; persisted Employee hire fallback is retained', async () => {
    const input = F.caseA(); input.completeHistoryRows[0].hmeromhnia_proslhpshs = null;
    const { preview, options, run, db } = setup(input);
    let error; try { await run({ input: { pragmatikosMisthos: 9999, ores_ergasias_ebdomadas: 20 } }); } catch (e) { error = e; }
    // A changed current profile may be separately rejected, but never writes or feeds historical evidence.
    assert.ok(error); assert.ok(db.state().history.every(row => row.pragmatikosMisthos !== 9999));
    const plan = planner(input); assert.ok(plan.proposedRows.some(row => new Date(row.hmeromhnia_proslhpshs).getTime() === new Date(input.currentEmployee.hmeromhnia_proslhpshs).getTime()));
    assert.ok(plan.proposedRows.every(row => row.ores_ergasias_ebdomadas !== 20));
    await preview();
});

test('E: legacy reconstruction and legitimate appended History version share one commit; future facts never rewrite old rows', async () => {
    const f = fixture(), scope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, f.employee[key]]));
    f.history = planner({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }).proposedRows;
    delete f.history[0].poso_symbashs_01;
    const C = require('../../utils/ergazomenoi/employmentProfileContract');
    const input = { [C.ENABLED]: true, [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION',
        [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00' };
    const { db, preview, run } = setup({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }, undefined, {
        input, effectiveFrom: '2026-09-01', maintenance: { intentHint: 'APPEND_NEW_VERSION',
            employeeChanges: { hmeromhnia_proslhpshs: '2026-01-01' }, historyChanges: { hmeromhnia_proslhpshs: '2026-01-01' },
            submittedHistoryChanges: { hmeromhnia_proslhpshs: '2026-01-01' }, submittedProfileFields: Object.keys(input) } });
    const reconstruction = await preview(); const result = await run({ reconstruction });
    assert.equal(result.mode, W.MODE_NEW_VERSION); assert.equal(db.state().history.length, 4);
    assert.equal(db.state().history.find(row => row._id === f.history[0]._id).poso_symbashs_01, 0);
    assert.equal(db.state().history.find(row => row._id === f.history[0]._id)[C.START], null);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1); assert.equal(db.state().audits.length, 1);
    const before = db.state(); assert.equal((await run({ reconstruction })).alreadyApplied, true); noCommit(db, before);
});
for (const value of [0, 1300]) test(`K/L: actual normal History correction overlapping reconstruction with ${value}`, async () => {
    const f = fixture(), scope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, f.employee[key]]));
    f.history = planner({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }).proposedRows;
    delete f.history[0].poso_symbashs_01;
    const { db, run, preview } = setup({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }, undefined, {
        mode: W.MODE_CORRECT_EXISTING, historyId: f.history[0]._id, effectiveFrom: '2026-01-01',
        maintenance: { employeeChanges: {}, historyChanges: { poso_symbashs_01: value }, submittedHistoryChanges: { poso_symbashs_01: value } }
    });
    const before = db.state();
    if (value === 1300) { await assert.rejects(run, { code: A.PREFIX + 'SAVE_CONFLICT' }); noWrites(db, before); }
    else { const reconstruction = await preview(); await run({ reconstruction }); assert.equal(db.state().history.find(row => row._id === f.history[0]._id).poso_symbashs_01, 0); }
});
test('P: BLOCKED automatic reconstruction reaches existing guided/manual fallback', async () => {
    const input = F.caseA(); input.completeHistoryRows.forEach(row => { row.employment_history_canonical_status = 'UNKNOWN'; });
    assert.equal(planner(input).status, 'BLOCKED');
    const { db, run } = setup(input), before = db.state();
    const result = await run(); assert.equal(result.automaticReconstructionApplied, undefined);
    assert.equal(db.state().audits.filter(a => a.mutationSource === A.OPERATION).length, 0);
});
test('M: concurrent continuation retries fresh under the Employee fence and commits once', async () => {
    const { db, run, preview } = setup(); const reconstruction = await preview();
    const held = deferred(), resume = deferred(); let first = true;
    db.hooks.read = async (session, kind) => { if (kind === 'employees' && first) { first = false; held.resolve(); await resume.promise; } };
    const one = run({ reconstruction }); await held.promise;
    db.hooks.retry = async () => { resume.resolve(); await one; };
    const two = run({ reconstruction }); await Promise.all([one, two]);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1); assert.equal(db.state().audits.length, 1);
});

test('submitted current salary/hours commit only to their legitimate profile; repair audit uses persisted earlier evidence', async () => {
    const f = fixture(), scope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, f.employee[key]]));
    for (const row of f.history) Object.assign(row, { ...F.workTerms, pragmatikosMisthos: 1200 });
    Object.assign(f.employee, { ...F.workTerms, pragmatikosMisthos: 1200 });
    f.history = planner({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }).proposedRows;
    delete f.history[0].poso_symbashs_01;
    const changes = { pragmatikosMisthos: 9999, hmeres_ergasias_ebdomadas: 4, ores_ergasias_ebdomadas: 32, mo_oron_hmerhsias_ergasias: 8 };
    const { db, preview, run } = setup({ scope, currentEmployee: f.employee, completeHistoryRows: f.history }, undefined, {
        mode: W.MODE_CORRECT_EXISTING, historyId: f.history[2]._id, effectiveFrom: '2026-03-01',
        maintenance: { employeeChanges: changes, historyChanges: changes, submittedHistoryChanges: changes } });
    const reconstruction = await preview(); await run({ reconstruction });
    const audit = db.state().audits.find(a => a.mutationSource === A.OPERATION);
    assert.ok(audit.historyAfter.every(row => row.pragmatikosMisthos === 1200 && row.ores_ergasias_ebdomadas === 40));
    assert.equal(db.state().history.find(row => row._id === f.history[0]._id).pragmatikosMisthos, 1200);
    assert.equal(db.state().history.find(row => row._id === f.history[2]._id).pragmatikosMisthos, 9999);
});
test('G: another controlled actionRequired discovered downstream rolls back reconstruction and its audit', async () => {
    const { db, preview, run } = setup(); const reconstruction = await preview(), before = db.state();
    const update = db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne = async (filter, patch, options) => {
        if (patch.$set) throw Object.assign(new Error('downstream decision'), { code: 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE' });
        return update(filter, patch, options);
    };
    let error; try { await run({ reconstruction }); } catch (e) { error = e; }
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    require('../../utils/ergazomenoi/employmentProfileMaintenance').profileError(res, error, { employeeSaveActionRequired: true });
    assert.equal(res.code, 200); assert.equal(res.body.actionRequired, true); noCommit(db, before);
});
test('approval token is bound to the retained original Save intent; altered form intent requires a fresh preview', async () => {
    const { db, run, preview, options } = setup(); const reconstruction = await preview(), before = db.state();
    await assert.rejects(() => run({ reconstruction, maintenance: { ...options.maintenance, employeeChanges: { parathrhseis: 'different intent' } } }), { code: A.PREFIX + 'STALE' });
    noCommit(db, before);
});

test('composite prediction matches existing Mongoose Employee casts and strict fields, without adding defaults', async () => {
    const { db, run, preview, options } = setup();
    const schema = require('../../models/ergazomenoi').ErgazomenoiModel.schema;
    db.deps.employeeModel.schema = schema;
    const update = db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne = (filter, patch, tx) => update(filter, patch.$set ? { $set:
        Object.fromEntries(Object.entries(patch.$set).flatMap(([field, value]) => schema.path(field)
            ? [[field, schema.path(field).applySetters(value, null)]] : [])) } : patch, tx);
    options.maintenance.employeeChanges = { parathrhseis: 'synthetic note', pososto_apasxolhshs_kk1: '42' };
    options.maintenance.submittedEmployeeFields.push('pososto_apasxolhshs_kk1');
    const reconstruction = await preview(); await run({ reconstruction });
    assert.equal(db.state().employees[0].pososto_apasxolhshs_kk1, 42);
});

test('full-form unchanged empty end date is an echo, not a command to undo reconstructed contract end', async () => {
    const input = F.caseA(); input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = null;
    const { db, run, preview } = setup(input, undefined, { maintenance: {
        originalHistoryId: 'synthetic-0002', employeeChanges: { parathrhseis: 'synthetic note', hmeromhnia_isxyos_oron_ergasias_eos: null },
        submittedEmployeeFields: ['parathrhseis', 'hmeromhnia_isxyos_oron_ergasias_eos'],
        historyChanges: { hmeromhnia_isxyos_oron_ergasias_eos: null }, submittedHistoryChanges: { hmeromhnia_isxyos_oron_ergasias_eos: null }
    } });
    const reconstruction = await preview(); await run({ reconstruction });
    assert.equal(new Date(db.state().history.find(row => row._id === 'synthetic-0002').hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0, 10), '2026-10-05');
    assert.equal(db.state().employees[0].parathrhseis, 'synthetic note');
    assert.equal(db.state().audits.length, 1);
});
test('changed submitted end date remains an actual competing intent and is rejected before writes', async () => {
    const input = F.caseA(); input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = null;
    const { db, run } = setup(input, undefined, { maintenance: {
        originalHistoryId: 'synthetic-0002', employeeChanges: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-30' },
        historyChanges: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-30' }, submittedHistoryChanges: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-30' }
    } }); const before = db.state();
    await assert.rejects(run, { code: A.PREFIX + 'SAVE_CONFLICT' }); noWrites(db, before);
});
