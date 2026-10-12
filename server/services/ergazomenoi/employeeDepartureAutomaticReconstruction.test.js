'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const D = require('./employeeDepartureAutomaticReconstructionContract');
const S = require('./employeeHistoryAutomaticReconstructionSaveContract');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { tha0030DepartureStructure } = require('./fixtures/tha0030SanitizedDepartureReconstructionFixture');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { store, deferred } = require('../../../test/fixtures/employeeProfileTransactionStore');
function clone(value) {
    if (value instanceof Date) return new Date(value);
    if (value?._bsontype === 'ObjectId') return new mongoose.Types.ObjectId(value.toHexString());
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
function setup(input = tha0030DepartureStructure({ missingLatestValidity: true }), changes = {}) {
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], { cloneFn: clone });
    const request = { scope: input.scope, employeeId: String(input.currentEmployee._id),
        departureDate: '2026-10-04', actorUserId: 'synthetic-actor',
        userModel: { findById: () => query({ privileges: 'A', team: 'THA', situation: 'A' }) },
        correctionCatalogLoader: async () => ({}),
        maintenance: { rejectConcurrentProfileChanges: true, employeeChanges: { hmeromhnia_apoxorhshs: '2026-10-04' },
            submittedEmployeeFields: ['hmeromhnia_apoxorhshs'], submittedFormFields: ['hmeromhnia_apoxorhshs'],
            submittedFormValues: { hmeromhnia_apoxorhshs: '2026-10-04' }, historyChanges: {}, submittedHistoryChanges: {} }, ...changes };
    const run = overrides => W.writeEmployeeDepartureWithAutomaticReconstruction({ ...clone(request), ...db.deps, ...overrides });
    const preview = async () => {
        let error;
        try { await run(); } catch (caught) { error = caught; }
        assert.equal(error?.code, D.REQUIRED);
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        assert.equal(S.sendReconstructionSaveError(res, error), true);
        assert.equal(res.code, 200);
        assert.equal(res.body.operation, 'FIRST_DEPARTURE');
        assert.equal(res.body.success, false);
        assert.equal(res.body.actionRequired, true);
        assert.equal(res.body.nextAction.type, D.NEXT_ACTION);
        assert.doesNotMatch(JSON.stringify(res.body), /proposedRows|rowDiffs|sourceHistoryIds|history_reference_fence|600000/);
        return { previewToken: error.previewToken, approvalAccepted: true };
    };
    return { input, db, request, run, preview };
}
function unchanged(db, before, start = 0) {
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.slice(start).some(event => event.type === 'commit'), false);
}
function zeroWrites(db, before) {
    unchanged(db, before);
    assert.equal(db.events.some(event => ['write', 'fence'].includes(event.type)), false);
}

test('0030 minimal blocking variant: preview and cancel have zero writes, including technical fence', async () => {
    const { db, preview, request } = setup(), before = db.state(), intent = clone(request);
    await preview();
    zeroWrites(db, before);
    assert.deepEqual(request, intent);
    assert.equal(mongoose.connection.readyState, 0);
});

test('0030 structure: one approval commits exact reconstruction, original departure and two distinct audits atomically', async () => {
    const { db, input, preview, run } = setup(), before = db.state(), plan = planner(input);
    assert.equal(plan.status, 'REVIEW_REQUIRED');
    assert.equal(plan.rowDiffs.length, 27);
    const approval = await preview();
    zeroWrites(db, before);
    const start = db.events.length, result = await run({ reconstruction: approval }), after = db.state();
    const events = db.events.slice(start);
    assert.equal(result.mode, 'MODE_DEPARTURE');
    assert.equal(result.automaticReconstructionApplied, true);
    assert.equal(new Date(after.employees[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-10-04');
    assert.equal(after.employees[0].energos, false);
    assert.equal(after.employees[0].employee_profile_mutation_sequence, 1);
    assert.equal(after.history.length, 3);
    assert.deepEqual(events.slice(0, 3).map(event => [event.type, event.kind]),
        [['fence', 'employees'], ['read', 'employees'], ['read', 'history']]);
    assert.equal(new Set(events.map(event => event.session)).size, 1);
    assert.equal(events.filter(event => event.type === 'commit').length, 1);
    assert.equal(events.filter(event => event.type === 'fence').length, 1);
    assert.deepEqual(after.audits.map(audit => audit.mutationSource), [A.OPERATION, 'DEPARTURE']);
    const [reconstructionAudit, departureAudit] = after.audits;
    assert.deepEqual(reconstructionAudit.historyBefore, before.history);
    assert.equal(reconstructionAudit.diagnostics.compositeOperation, 'FIRST_DEPARTURE');
    assert.equal(reconstructionAudit.diagnostics.requestedDeparture, '2026-10-04T00:00:00.000Z');
    const withoutRevision = ({ updatedAt, ...row }) => row;
    for (const original of before.history) {
        const repaired = reconstructionAudit.historyAfter.find(row => String(row._id) === String(original._id));
        const expected = { ...original, ...Object.fromEntries(plan.rowDiffs.filter(diff =>
            String(diff.historyId) === String(original._id)).map(diff => [diff.field, diff.after])) };
        assert.deepEqual(withoutRevision(repaired), withoutRevision(expected));
        const final = after.history.find(row => String(row._id) === String(original._id));
        const expectedDeparture = original.aa_eggrafhs === '0003' ? {
            ...repaired, hmeromhnia_apoxorhshs: new Date('2026-10-04'),
            hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-04') } : repaired;
        assert.deepEqual(withoutRevision(final), withoutRevision(expectedDeparture));
        for (const field of ['_id', 'aa_eggrafhs', 'createdAt', '__v', 'history_reference_fence',
            'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']) {
            assert.deepEqual(final[field], original[field]);
        }
    }
    assert.equal(departureAudit.deletedLegacyHistoryIds.length, 0);
    const finalPlan = planner({ ...input, currentEmployee: after.employees[0], completeHistoryRows: after.history });
    assert.equal(A.isNoOp(finalPlan), true);
    assert.equal(finalPlan.rowDiffs.length, 0);
    assert.deepEqual(after.employees[0], { ...before.employees[0], employee_profile_mutation_sequence: 1,
        hmeromhnia_apoxorhshs: new Date('2026-10-04'), energos: false,
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-04'),
        employment_departure_restore: after.employees[0].employment_departure_restore });
});

test('safe History uses normal departure with no reconstruction approval', async () => {
    const input = tha0030DepartureStructure();
    input.completeHistoryRows = planner(input).proposedRows.filter(row => row.aa_eggrafhs !== '0002');
    const { run, db } = setup(input);
    const result = await run();
    assert.equal(result.mode, 'MODE_DEPARTURE');
    assert.equal(result.automaticReconstructionApplied, undefined);
    assert.equal(db.state().audits.some(audit => audit.mutationSource === A.OPERATION), false);
});

test('0030 audit BEFORE structural facts already allow ordinary departure; optional reconstruction does not force a modal', async () => {
    const input = tha0030DepartureStructure();
    assert.equal(planner(input).rowDiffs.length, 26);
    const { run, db } = setup(input);
    const result = await run();
    assert.equal(result.mode, 'MODE_DEPARTURE');
    assert.equal(result.automaticReconstructionApplied, undefined);
    assert.equal(db.state().audits.some(audit => audit.mutationSource === A.OPERATION), false);
});

for (const [label, alter] of [
    ['History business field', ({ db, input }) => db.changeCommittedHistory(input.completeHistoryRows[0]._id, { pragmatikosMisthos: 999 })],
    ['History hidden fence', ({ db, input }) => db.changeCommittedHistory(input.completeHistoryRows[0]._id, { history_reference_fence: 9 })],
    ['History informational schedule', ({ db, input }) => db.changeCommittedHistory(input.completeHistoryRows[0]._id, { hmeromhnia_allaghs_orarioy_eos: new Date('2026-09-01') })],
    ['Employee', ({ db, input }) => db.changeCommittedEmployee(input.currentEmployee._id, { parathrhseis: 'concurrent edit' })]
]) test(`stale ${label}: no committed reconstruction, departure, audits or fence`, async () => {
    const env = setup(), reconstruction = await env.preview(); alter(env);
    const before = env.db.state();
    await assert.rejects(env.run({ reconstruction }), { code: A.PREFIX + 'STALE' });
    unchanged(env.db, before);
});

for (const [label, mutate] of [
    ['departure date', options => { options.departureDate = '2026-10-05'; }],
    ['normalized Employee intent', options => { options.maintenance.employeeChanges.parathrhseis = 'different'; }],
    ['retained raw form', options => { options.maintenance.submittedFormValues.email = 'different@example.test'; }],
    ['actor', options => { options.actorUserId = 'another-actor'; }],
    ['token', options => { options.reconstruction.previewToken = 'x'.repeat(43); }]
]) test(`changed ${label} stales approval with zero committed writes`, async () => {
    const { db, request, preview, run } = setup(), reconstruction = await preview(), before = db.state();
    const options = { ...clone(request), reconstruction }; mutate(options);
    await assert.rejects(run(options), { code: A.PREFIX + 'STALE' });
    unchanged(db, before);
});

for (const key of ['rowDiffs', 'proposedRows', 'sourceHistoryIds', 'historyPatches']) {
    test(`client reconstruction mutation instructions ${key} are rejected before reads/writes`, async () => {
        const { db, preview, run } = setup(), approval = await preview(), before = db.state();
        await assert.rejects(run({ reconstruction: { ...approval, [key]: [] } }), { code: A.PREFIX + 'INVALID_REQUEST' });
        zeroWrites(db, before);
    });
}

test('ordinary Save approval cannot authorize FIRST_DEPARTURE', async () => {
    const env = setup(), before = env.db.state();
    let ordinary;
    try { await W.writeEmployeeEmploymentProfileWithAutomaticReconstruction({ ...env.request, ...env.db.deps,
        effectiveFrom: '2026-05-01', maintenance: { employeeChanges: {}, historyChanges: {} } }); }
    catch (error) { ordinary = error; }
    assert.equal(ordinary.code, A.PREFIX + 'REQUIRED');
    await assert.rejects(env.run({ reconstruction: { previewToken: ordinary.previewToken, approvalAccepted: true } }),
        { code: A.PREFIX + 'STALE' });
    unchanged(env.db, before);
});

for (const [label, user] of [['inactive', { privileges: 'A', team: 'THA', situation: 'I' }],
    ['ordinary employee', { privileges: 'U', team: 'THA', situation: 'A' }],
    ['wrong team', { privileges: 'S', team: 'BLG', situation: 'A' }]]) {
    test(`${label} cannot authorize automatic reconstruction`, async () => {
        const { db, preview, run } = setup(), reconstruction = await preview(), before = db.state();
        await assert.rejects(run({ reconstruction, userModel: { findById: () => query(user) } }), { code: A.PREFIX + 'FORBIDDEN' });
        unchanged(db, before);
    });
}

test('planner BLOCKED opens only History and remains zero-write', async () => {
    const input = F.caseB();
    for (const row of [input.currentEmployee, ...input.completeHistoryRows]) {
        for (const field of ['hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs', 'hmeromhnia_isxyos_oron_ergasias_apo']) delete row[field];
    }
    assert.equal(planner(input).status, 'BLOCKED');
    const { db, run } = setup(input), before = db.state();
    let error; try { await run(); } catch (caught) { error = caught; }
    assert.equal(error.code, D.BLOCKED);
    const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { this.body = body; } };
    assert.equal(S.sendReconstructionSaveError(res, error), true);
    assert.deepEqual(res.body.nextAction, { type: 'OPEN_EMPLOYEE_HISTORY_TAB' });
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.match(res.body.message, /1\.[\s\S]*2\.[\s\S]*Κωδικός αναφοράς/);
    zeroWrites(db, before);
});

for (const [label, mutate] of [
    ['future real work-terms event', input => { input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-10-05'); }],
    ['conflicting stored departure', input => { input.completeHistoryRows[1].hmeromhnia_apoxorhshs = new Date('2026-10-03'); }],
    ['competing latest profile tie', input => {
        input.completeHistoryRows.push({ ...clone(input.completeHistoryRows[1]),
            _id: new mongoose.Types.ObjectId('600000000000000000000004'),
            aa_eggrafhs: '0004', symbash: 'INCOMPATIBLE', ores_ergasias_ebdomadas: 20 });
    }]
]) test(`valid reconstruction but unsafe departure (${label}) never applies reconstruction`, async () => {
    const input = tha0030DepartureStructure({ missingLatestValidity: true }); mutate(input);
    const plan = planner(input);
    assert.ok(['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status));
    assert.ok(plan.rowDiffs.length);
    const { db, run } = setup(input), before = db.state();
    await assert.rejects(run(), { code: D.BLOCKED });
    zeroWrites(db, before);
});

test('protected live History reference fails discovery and approved continuation without committed writes', async () => {
    const { db, run, preview } = setup(), reconstruction = await preview(), before = db.state();
    db.deps.referenceChecker = async () => [{ collection: 'Apasxoliseis', documentId: 'synthetic-reference' }];
    await assert.rejects(run(), { code: A.PREFIX + 'REFERENCE_CHECK_FAILED' });
    await assert.rejects(run({ reconstruction }), { code: A.PREFIX + 'REFERENCE_CHECK_FAILED' });
    unchanged(db, before);
});

test('frozen provenance remains protected: composite preserves every original referenced row and sequence', async () => {
    const { db, preview, run } = setup(), before = db.state();
    db.deps.referenceChecker = async () => [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
        documentId: 'synthetic-frozen-provenance' }];
    const reconstruction = await preview();
    await run({ reconstruction });
    assert.deepEqual(A.ordered(db.state().history).map(row => [row._id, row.aa_eggrafhs, row.history_reference_fence]),
        A.ordered(before.history).map(row => [row._id, row.aa_eggrafhs, row.history_reference_fence]));
    assert.equal(db.state().audits.length, 2);
});

test('departure recomputation after reconstruction detects an unsafe transactional state and rolls back the reconstruction audit', async () => {
    const { db, preview, run } = setup(), reconstruction = await preview(), before = db.state();
    let historyReads = 0;
    db.hooks.read = async (session, kind) => {
        if (kind === 'history' && ++historyReads === 3) {
            assert.equal(session.draft.audits.length, 1, 'reconstruction and its audit already ran');
            session.draft.history.find(row => row.aa_eggrafhs === '0003').hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-10-05');
        }
    };
    await assert.rejects(run({ reconstruction }));
    unchanged(db, before);
    assert.ok(db.events.some(event => event.type === 'write' && event.kind === 'history'));
});

for (const point of ['after-reconstruction', 'departure-audit', 'reconstruction-audit', 'audit-empty', 'final-verification', 'commit']) {
    test(`${point} failure rolls back reconstruction, departure, both audits and fence`, async () => {
        const { db, run, preview } = setup(), reconstruction = await preview(), before = db.state();
        let reconstructionDone = false, departureDone = false;
        const create = db.deps.auditModel.create;
        db.deps.auditModel.create = async ([audit], options) => {
            if (point === 'reconstruction-audit' && audit.mutationSource === A.OPERATION) throw Error('injected audit failure');
            if (point === 'departure-audit' && audit.mutationSource === 'DEPARTURE') throw Error('injected departure audit failure');
            if (point === 'audit-empty' && audit.mutationSource === 'DEPARTURE') return [];
            reconstructionDone ||= audit.mutationSource === A.OPERATION;
            return create([audit], options);
        };
        const update = db.deps.employeeModel.updateOne;
        db.deps.employeeModel.updateOne = async (filter, patch, options) => {
            if (point === 'after-reconstruction' && reconstructionDone && patch.$set) throw Error('injected departure failure');
            const result = await update(filter, patch, options);
            departureDone ||= Boolean(patch.$set?.hmeromhnia_apoxorhshs);
            return result;
        };
        if (point === 'final-verification') db.hooks.read = async (session, kind) => {
            if (departureDone && kind === 'history') session.draft.history[0].history_reference_fence = 999;
        };
        if (point === 'commit') db.hooks.beforeCommit = async () => { throw Error('injected commit failure'); };
        await assert.rejects(run({ reconstruction }));
        unchanged(db, before);
        assert.ok(db.events.some(event => event.type === 'write' && event.kind === 'history'));
    });
}

test('concurrent approved continuations serialize at the fence and commit both operations exactly once', async () => {
    const { db, preview, run } = setup(), reconstruction = await preview();
    const entered = deferred(), release = deferred(), completed = deferred();
    let held = false;
    db.hooks.read = async (_session, kind) => {
        if (!held && kind === 'employees') { held = true; entered.resolve(); await release.promise; }
    };
    db.hooks.retry = async () => completed.promise;
    const first = run({ reconstruction }).finally(() => completed.resolve()); await entered.promise;
    const second = run({ reconstruction }); release.resolve();
    const results = await Promise.allSettled([first, second]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, A.PREFIX + 'STALE');
    assert.deepEqual(db.state().audits.map(audit => audit.mutationSource), [A.OPERATION, 'DEPARTURE']);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    assert.equal(db.state().employees[0].employee_profile_mutation_sequence, 1);
});
