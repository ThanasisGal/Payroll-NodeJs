'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const S = require('./employeeHistoryAutomaticReconstructionSaveContract');
const { buildAutomaticReconstructionAudit } = require('./employeeHistoryAutomaticReconstructionApplyService');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { normalizeEmployeeNormalSaveRequest, PASSIVE_LENDING_DEFAULTS } = require('../../utils/ergazomenoi/employeeNormalSaveNormalization');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { real0006BoundaryStructure } = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { buildEmployeeDepartureTransition } = require('./employeeDepartureLifecycleTransitionService');

function clone(value) {
    if (value instanceof Date) return new Date(value);
    if (value?._bsontype === 'ObjectId') return new mongoose.Types.ObjectId(value.toHexString());
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });

function setup() {
    const input = real0006BoundaryStructure();
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], { cloneFn: clone });
    db.deps.employeeModel.schema = ErgazomenoiModel.schema;
    // Match the real update's schema casts, without introducing document defaults.
    const update = db.deps.employeeModel.updateOne;
    db.deps.employeeModel.updateOne = (filter, patch, options) => update(filter, patch.$set ? {
        ...patch, $set: Object.fromEntries(Object.entries(patch.$set).flatMap(([field, value]) => {
            const schemaPath = ErgazomenoiModel.schema.path(field);
            return schemaPath ? [[field, schemaPath.applySetters(value, null)]] : [];
        }))
    } : patch, options);
    const employeeChanges = { ...PASSIVE_LENDING_DEFAULTS, synolo_proyphresias_se_mhnes: 5,
        forologikh_klimaka: '0200', meiosh_eisforon_mhteron: undefined };
    const request = { scope: input.scope, employeeId: String(input.currentEmployee._id),
        effectiveFrom: '2026-05-25', actorUserId: 'synthetic-actor',
        maintenance: { employeeChanges, submittedEmployeeFields: Object.keys(employeeChanges)
            .filter(field => field !== 'meiosh_eisforon_mhteron'),
        historyChanges: {}, submittedHistoryChanges: {}, submittedProfileFields: [],
        submittedFormValues: { ...employeeChanges, mhteres: false },
        originalHistoryId: String(input.completeHistoryRows[1]._id),
        expectedRevision: input.completeHistoryRows[1].updatedAt } };
    const run = reconstruction => W.writeEmployeeEmploymentProfileWithAutomaticReconstruction({
        ...clone(request), ...db.deps, reconstruction,
        userModel: { findById: () => query({ privileges: 'A', team: 'THA', situation: 'A' }) },
        correctionCatalogLoader: async () => ({})
    });
    const preview = async () => {
        let error;
        try { await run(); } catch (caught) { error = caught; }
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        assert.equal(S.sendReconstructionSaveError(res, error), true);
        assert.equal(res.code, 200);
        assert.equal(res.body.reason, A.PREFIX + 'REQUIRED');
        assert.equal(res.body.actionRequired, true);
        return { previewToken: res.body.previewToken, approvalAccepted: true };
    };
    return { input, db, request, run, preview };
}

test('real-0006 structure: complete two-stage Save, BSON ids, hidden fences, exactly 25 fields and one transaction', async () => {
    const { input, db, request, run, preview } = setup(), before = db.state(), plan = planner(input);
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(IstorikoProslhpseonAllagonModel.schema.path('history_reference_fence').options.select, false);
    assert.equal(plan.status, 'REVIEW_REQUIRED');
    assert.equal(plan.rowDiffs.length, 25);
    assert.deepEqual(input.completeHistoryRows.map(row => plan.rowDiffs.filter(diff =>
        String(diff.historyId) === String(row._id)).length), [16, 5, 4]);
    assert.equal(plan.assumptions.length, 1);
    assert.equal(plan.warnings.length, 0);
    const retainedIntent = clone(request), approval = await preview();
    assert.deepEqual(request, retainedIntent);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => ['write', 'fence', 'commit'].includes(event.type)), false);
    assert.deepEqual(Object.keys(approval).sort(), ['approvalAccepted', 'previewToken']);
    assert.deepEqual(request.maintenance.historyChanges, {});
    assert.deepEqual(request.maintenance.submittedHistoryChanges, {});
    const continuationStart = db.events.length;
    const result = await run(approval), after = db.state(), events = db.events.slice(continuationStart);
    assert.equal(result.automaticReconstructionApplied, true);
    assert.equal(result.mode, 'NO_HISTORY_CHANGE');
    assert.deepEqual(events.slice(0, 3).map(event => [event.type, event.kind]),
        [['fence', 'employees'], ['read', 'employees'], ['read', 'history']]);
    assert.equal(new Set(events.map(event => event.session)).size, 1);
    assert.equal(events.filter(event => event.type === 'commit').length, 1);
    assert.equal(events.filter(event => event.type === 'fence').length, 1);
    assert.equal(events.filter(event => event.type === 'write' && event.kind === 'history').length, 3);
    assert.equal(after.history.length, 3); // No inserts/deletes, including 0001/0002 cleanup.
    assert.equal(after.audits.length, 1);
    assert.equal(after.audits[0].mutationSource, A.OPERATION);
    let changedFields = 0;
    for (const original of before.history) {
        const actual = after.history.find(row => String(row._id) === String(original._id));
        assert.ok(actual);
        const diffs = plan.rowDiffs.filter(diff => String(diff.historyId) === String(original._id));
        const expected = { ...original, ...Object.fromEntries(diffs.map(diff => [diff.field, diff.after])) };
        const withoutRevision = ({ updatedAt, ...row }) => row;
        assert.deepEqual(withoutRevision(actual), withoutRevision(expected));
        for (const diff of diffs) {
            assert.ok(!A.equal(original[diff.field], actual[diff.field]));
            assert.ok(A.equal(actual[diff.field], diff.after), diff.field);
            changedFields++;
        }
        assert.ok(actual.updatedAt > original.updatedAt);
        for (const field of ['_id', 'aa_eggrafhs', 'createdAt', '__v', 'history_reference_fence',
            'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']) {
            assert.deepEqual(actual[field], original[field]);
        }
    }
    assert.equal(changedFields, 25);
    assert.deepEqual(after.employees[0], { ...before.employees[0], employee_profile_mutation_sequence: 1 });
    assert.equal(after.employees[0].synolo_proyphresias_se_mhnes, 3);
    assert.equal(after.employees[0].meiosh_eisforon_mhteron, false);
    for (const field of Object.keys(PASSIVE_LENDING_DEFAULTS)) assert.equal(Object.hasOwn(after.employees[0], field), false);
    assert.deepEqual(after.audits[0].historyBefore, before.history);
    assert.deepEqual(A.ordered(after.audits[0].historyAfter), A.ordered(after.history));
    assert.deepEqual(after.audits[0].survivingHistoryIds.sort(), before.history.map(row => String(row._id)).sort());
    const post = planner({ ...input, currentEmployee: after.employees[0], completeHistoryRows: after.history });
    assert.equal(A.isNoOp(post), true);
    assert.equal(post.rowDiffs.length, 0);
    assert.deepEqual(normalizeEmployeeNormalSaveRequest(request, input.currentEmployee)
        .maintenance.submittedProfileFields, []);
});

test('real-0006 structure: reconstruction NO_OP then first departure uses the canonical legacy profile atomically', async () => {
    const { input, db, run, preview } = setup();
    const plan = planner(input);
    assert.equal(input.completeHistoryRows.length, 3);
    assert.equal(plan.rowDiffs.length, 25);
    await run(await preview());
    const before = db.state();
    const post = planner({ ...input, currentEmployee: before.employees[0], completeHistoryRows: before.history });
    assert.equal(A.isNoOp(post), true);
    assert.equal(post.rowDiffs.length, 0);
    const canonical = canonicalizeEmployeeHistory({ scope: input.scope,
        currentEmployee: before.employees[0], historyRows: before.history });
    assert.equal(canonical.status, 'AUTO_REPAIRABLE');
    assert.equal(canonical.canonicalRows.length, 1);
    const survivor = canonical.canonicalRows[0];
    assert.equal(String(survivor._id), String(input.completeHistoryRows[2]._id));
    assert.equal(survivor.afora_allagh_oron_ergasias, false);
    assert.equal(survivor.employment_profile_schema_version, undefined);
    assert.ok(survivor.hmeromhnia_isxyos_oron_ergasias_apo);
    // This exact canonical view used to throw at latestProfileRow == null,
    // even though the raw three-row transition could find a different profile.
    const transition = buildEmployeeDepartureTransition({ currentEmployee: before.employees[0],
        history: canonical.canonicalRows, departureDate: '2026-10-04' });
    assert.equal(String(transition.terminalHistoryRow._id), String(survivor._id));
    assert.equal(String(transition.latestProfileRow._id), String(survivor._id));
    const references = before.history.map(row => ({ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
        documentId: `synthetic-reference-${row.aa_eggrafhs}`, historyId: String(row._id) }));
    const referencesBefore = clone(references);
    db.deps.referenceChecker = async ({ historyIds }) => references.filter(ref => historyIds.includes(ref.historyId));
    const eventStart = db.events.length;
    const result = await W.writeEmployeeDeparture({ ...db.deps, scope: input.scope,
        employeeId: String(input.currentEmployee._id), departureDate: '2026-10-04' });
    assert.equal(result.mode, 'MODE_DEPARTURE');
    const after = db.state(), events = db.events.slice(eventStart);
    assert.equal(new Set(events.map(event => event.session)).size, 1);
    assert.equal(events.filter(event => event.type === 'commit').length, 1);
    assert.equal(after.history.length, 3);
    assert.deepEqual(A.ordered(after.history.map(row => ({ _id: row._id, aa_eggrafhs: row.aa_eggrafhs }))),
        A.ordered(before.history.map(row => ({ _id: row._id, aa_eggrafhs: row.aa_eggrafhs }))));
    assert.deepEqual(references, referencesBefore);
    assert.equal(after.employees[0].hmeromhnia_apoxorhshs.toISOString().slice(0, 10), '2026-10-04');
    assert.equal(after.employees[0].energos, false);
    assert.equal(after.employees[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), '2026-10-04');
    assert.equal(after.audits.filter(audit => audit.mutationSource === 'DEPARTURE').length, 1);
    assert.equal(after.audits.filter(audit => audit.mutationSource === A.OPERATION).length, 1);
    assert.deepEqual(after.audits[0], before.audits[0]);
    for (const original of before.history) {
        const actual = after.history.find(row => String(row._id) === String(original._id));
        for (const field of ['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']) {
            assert.deepEqual(actual[field], original[field]);
        }
        const allowed = String(original._id) === String(survivor._id)
            ? ['hmeromhnia_apoxorhshs', 'hmeromhnia_isxyos_oron_ergasias_eos', 'updatedAt']
            : ['employment_history_canonical_status', 'employment_history_canonical_survivor_id',
                'history_reference_fence', 'updatedAt'];
        assert.deepEqual(Object.fromEntries(Object.entries(actual).filter(([field]) => !allowed.includes(field))),
            Object.fromEntries(Object.entries(original).filter(([field]) => !allowed.includes(field))));
        if (String(original._id) === String(survivor._id)) {
            assert.equal(actual.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10), '2026-10-04');
        } else {
            assert.equal(actual.employment_history_canonical_status, 'REDUNDANT_REFERENCED');
            assert.equal(actual.employment_history_canonical_survivor_id, String(survivor._id));
        }
    }
});

for (const [name, tamper, departureDate, codes] of [
    ['no History for current cycle', state => {
        state.history.forEach(row => Object.assign(row, { hmeromhnia_proslhpshs: new Date('2025-01-01'),
            hmeromhnia_apoxorhshs: new Date('2025-12-31') }));
    }, '2026-10-04', ['EMPLOYEE_DEPARTURE_HISTORY_REQUIRED', 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']],
    ['ambiguous employment cycles', state => {
        state.history[0].hmeromhnia_proslhpshs = new Date('2025-01-01');
    }, '2026-10-04', ['EMPLOYEE_DEPARTURE_CURRENT_CYCLE_MISMATCH', 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']],
    ['no applicable profile', state => {
        state.history.forEach(row => Object.assign(row, { afora_allagh_oron_ergasias: false,
            hmeromhnia_isxyos_oron_ergasias_apo: null }));
    }, '2026-10-04', ['EMPLOYEE_DEPARTURE_HISTORY_REQUIRED', 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']],
    ['competing profile facts', state => {
        state.history[1].ores_ergasias_ebdomadas = 20;
    }, '2026-10-04', ['EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']],
    ['before hire', () => {}, '2026-04-22', ['EMPLOYEE_DEPARTURE_BEFORE_HIRE']],
    ['conflicting departure', state => {
        state.employees[0].hmeromhnia_apoxorhshs = new Date('2026-10-03');
        state.history.forEach(row => { row.hmeromhnia_apoxorhshs = new Date('2026-10-03'); });
    }, '2026-10-04', ['EMPLOYEE_DEPARTURE_CONFLICT']],
    ['future real work terms', state => {
        state.employees[0].hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-10-05');
    }, '2026-10-04', ['EMPLOYEE_DEPARTURE_CONFLICT', 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']],
    ['unsafe canonical ambiguity', state => {
        state.history[1].hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-09-30');
    }, '2026-10-04', ['EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']]
]) {
    test(`reconstruct then departure rejects ${name} with zero committed writes`, async () => {
        const { input, db, run, preview } = setup();
        await run(await preview());
        const initial = db.state();
        tamper(initial);
        const other = store([{ employee: initial.employees[0], history: initial.history }], { cloneFn: clone });
        const before = other.state();
        await assert.rejects(W.writeEmployeeDeparture({ ...other.deps, scope: input.scope,
            employeeId: String(input.currentEmployee._id), departureDate }), error => codes.includes(error.code));
        assert.deepEqual(other.state(), before);
        assert.equal(other.events.some(event => event.type === 'commit'), false);
    });
}

for (const boundary of ['history', 'audit', 'stale-history']) {
    test(`reconstruct then departure rolls back all changes after ${boundary} failure`, async () => {
        const { input, db, run, preview } = setup();
        await run(await preview());
        const before = db.state();
        db.deps.referenceChecker = async () => [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: 'synthetic-protected-reference' }];
        if (boundary === 'audit') db.deps.auditModel.create = async () => { throw Error('injected audit failure'); };
        else db.deps.historyModel.updateOne = async () => {
            if (boundary === 'stale-history') return { matchedCount: 0 };
            throw Error('injected history failure');
        };
        const start = db.events.length;
        await assert.rejects(W.writeEmployeeDeparture({ ...db.deps, scope: input.scope,
            employeeId: String(input.currentEmployee._id), departureDate: '2026-10-04' }));
        assert.deepEqual(db.state(), before);
        assert.equal(db.events.slice(start).some(event => event.type === 'commit'), false);
    });
}

// Test-only access to the private strict boundaries. Production exports and all
// assertions stay unchanged; use this same module's fence registry for each call.
const filename = require.resolve('./employeeEmploymentProfileWriter');
const isolated = new Module(filename, module);
isolated.filename = filename;
isolated.paths = Module._nodeModulePaths(path.dirname(filename));
isolated._compile(fs.readFileSync(filename, 'utf8') +
    '\nmodule.exports.testBoundary = { executeFinalMutationPlan, executeReconstructionCurrentOnlySave };', filename);
const B = isolated.exports;

async function atBoundary(tamper = () => {}, { acquireFence = true } = {}) {
    const { input, db } = setup(), before = db.state();
    const invoke = () => B.inProfileTransaction(db.deps.connection, db.deps.capabilityProbe, async session => {
        if (acquireFence) await B.acquireEmployeeMutationFence({ filter: input.scope,
            employeeId: String(input.currentEmployee._id), employeeModel: db.deps.employeeModel, session });
        const current = await db.deps.employeeModel.findOne({ _id: input.currentEmployee._id })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        const history = await db.deps.historyModel.find(input.scope).select('+history_reference_fence').session(session).lean();
        const plan = planner({ scope: input.scope, currentEmployee: current, completeHistoryRows: history });
        const physicalPlan = A.buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows: history });
        const audit = buildAutomaticReconstructionAudit({ scope: input.scope, current, history, physicalPlan,
            plan, actorUserId: 'synthetic-actor', previewToken: 'synthetic', persistedToken: 'synthetic' });
        const options = { ...db.deps, session, physicalPlan, currentBefore: current, currentPatch: {},
            filter: input.scope, employeeId: String(current._id), controlledAutomaticReconstruction: true,
            automaticReconstructionPlan: plan, automaticHistoryBefore: history, automaticAuditRecord: audit };
        tamper(options);
        return B.testBoundary.executeFinalMutationPlan(options);
    });
    return { db, before, invoke };
}

test('negative-test baseline reaches and passes every automatic boundary with a valid audit', async () => {
    const { db, invoke } = await atBoundary();
    assert.equal((await invoke()).changedFields, 25);
    assert.equal(db.state().audits.length, 1);
});

for (const [name, tamper] of [
    ['physical plan extra field', o => { o.physicalPlan.rowsToInsert = []; }],
    ['missing rowDiff', o => { o.automaticReconstructionPlan.rowDiffs.pop(); }],
    ['wrong after value', o => { o.automaticReconstructionPlan.rowDiffs[0].after = 'FORGED'; }],
    ['identity mismatch', o => { o.physicalPlan.rowsToUpdate[0].historyId = 'unknown'; }],
    ['extra History row', o => { o.physicalPlan.expectedRows.push({ _id: 'unknown' }); }],
    ['deleted History row', o => { o.physicalPlan.expectedRows.pop(); }],
    ['altered schedule field', o => { o.physicalPlan.rowsToUpdate[0].patch.hmeromhnia_allaghs_orarioy_apo = new Date(); }],
    ['wrong historyBefore audit', o => { o.automaticAuditRecord.historyBefore = clone(o.automaticHistoryBefore); o.automaticAuditRecord.historyBefore[0].aa_eggrafhs = '9999'; }],
    ['wrong historyAfter audit', o => { o.automaticAuditRecord.historyAfter = clone(o.physicalPlan.expectedRows); o.automaticAuditRecord.historyAfter[0].aa_eggrafhs = '9999'; }],
    ['wrong employeeScope', o => { o.automaticAuditRecord.employeeScope.kodikos = 'other'; }],
    ['wrong survivor ids', o => { o.automaticAuditRecord.survivingHistoryIds.pop(); }],
    ['non-empty automatic currentPatch', o => { o.currentPatch = { parathrhseis: 'FORGED' }; }],
    ['wrong currentBefore audit', o => { o.automaticAuditRecord.currentBefore = { ...o.currentBefore, employee_profile_mutation_sequence: 99 }; }],
    ['wrong mutationSource', o => { o.automaticAuditRecord.mutationSource = 'FORGED'; }],
    ['deleted legacy ids', o => { o.automaticAuditRecord.deletedLegacyHistoryIds = ['FORGED']; }],
    ['simultaneous controlled mode', o => { o.controlledUniqueSafeRepair = true; }]
]) test(`strict automatic boundary: ${name} fails closed with zero committed writes`, async () => {
    const { db, before, invoke } = await atBoundary(tamper);
    await assert.rejects(invoke, { code: A.PREFIX + 'BOUNDARY_FAILED' });
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => ['write', 'commit'].includes(event.type)), false);
});

test('strict automatic boundary: missing fence fails closed with zero committed writes', async () => {
    const { db, before, invoke } = await atBoundary(undefined, { acquireFence: false });
    await assert.rejects(invoke, { code: A.PREFIX + 'BOUNDARY_FAILED' });
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => ['write', 'fence', 'commit'].includes(event.type)), false);
});

for (const [name, tamper] of [
    ['hidden fence', rows => { rows[0].history_reference_fence++; }],
    ['business field', rows => { rows[0].dialleima_se_lepta = 99; }],
    ['schedule field', rows => { rows[0].hmeromhnia_allaghs_orarioy_eos = new Date('2099-01-01'); }],
    ['row identity', rows => { rows[0]._id = new mongoose.Types.ObjectId('600000000000000000000099'); }],
    ['deleted row', rows => { rows.pop(); }]
]) test(`Employee-only continuation boundary retains full-document strictness: ${name}`, async () => {
    const { input, db } = setup(), before = db.state();
    await assert.rejects(() => B.inProfileTransaction(db.deps.connection, db.deps.capabilityProbe, async session => {
        await B.acquireEmployeeMutationFence({ filter: input.scope, employeeId: String(input.currentEmployee._id),
            employeeModel: db.deps.employeeModel, session });
        const planned = clone(input.completeHistoryRows);
        tamper(session.draft.history);
        return B.testBoundary.executeReconstructionCurrentOnlySave({ ...db.deps, session,
            employeeId: String(input.currentEmployee._id), filter: input.scope, currentPatch: {},
            physicalPlan: { beforeRows: planned, finalRows: clone(planned), rowsToUpdate: [], rowsToInsert: [], rowsToDelete: [] } });
    }), { code: A.PREFIX + 'BOUNDARY_FAILED' });
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(event => ['write', 'commit'].includes(event.type)), false);
});
