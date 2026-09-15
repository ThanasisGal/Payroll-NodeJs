'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { buildWeeklyHrLifecycleProjection } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { resolveWeeklyHrStage3Day } = require('./apasxoliseisWeeklyHrWorkflowStage3ResolutionService');

const periodScope = { period_start: '2026-05-01', period_end: '2026-05-31' };
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: new mongoose.Types.ObjectId(), employee_kodikos: '0007',
    week_start: new Date('2026-04-27T00:00:00.000Z'),
    week_end: new Date('2026-05-03T00:00:00.000Z') };
const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '1',
    pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };
const dates = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
    '2026-05-01', '2026-05-02', '2026-05-03'];
const rows = dates.map((day) => ({ _id: new mongoose.Types.ObjectId(),
    team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma,
    kodikos: scope.employee_kodikos, hmeromhnia: new Date(`${day}T00:00:00.000Z`),
    kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
    ores_ergasias: 8, ores_ergasias_apologistika: 8,
    apo_ora_01: '09:00', eos_ora_01: '17:00', cards_ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', repo: false,
    repo_apologistika: false, adeia_apologistika: false,
    astheneia_apologistika: false, apousia_apologistika: false,
    kathgoria_adeias_apologistika: '' }));
for (const row of rows.slice(5)) Object.assign(row, {
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    ores_ergasias_apologistika: 0, kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE'
});
const actor = { user_id: new mongoose.Types.ObjectId(), user_name: 'HR', role: 'HR' };
function lifecycle(weekRows = rows, stage1 = state.stage1) {
    return buildWeeklyHrLifecycleProjection({ weekRows, effectiveProfile: profile,
        scope, periodScope, persistedStage1State: stage1 });
}
const initialLifecycle = buildWeeklyHrLifecycleProjection({ weekRows: rows,
    effectiveProfile: profile, scope, periodScope });
const originalCompletion = initialLifecycle.stages.stage1.current_completion_fingerprint;
const state = { ...scope, stage1: { status: 'OPEN', version: 1,
    completion_fingerprint: '', effective_fingerprint: '', period_slices: [{
        period_start: new Date('2026-05-01T00:00:00.000Z'),
        period_end: new Date('2026-05-31T00:00:00.000Z'), status: 'COMPLETED',
        actionable_dates: dates.slice(4), context_only_dates: dates.slice(0, 4),
        context_fingerprint: initialLifecycle.stages.stage1.current_context_fingerprint,
        completion_fingerprint: originalCompletion,
        effective_fingerprint: originalCompletion, version: 1 }] } };
const audits = [];
let stateUpdates = 0;
function query(value) { return { session() { return this; }, async lean() { return value; } }; }
function decisionContext(day) {
    const current = lifecycle();
    const row = rows.find((item) => item.hmeromhnia.toISOString().slice(0, 10) === day);
    const remaining = rows.filter((item) => dates.slice(4).includes(
        item.hmeromhnia.toISOString().slice(0, 10)) &&
        item.kathgoria_adeias_apologistika === 'POSSIBLE_LEAVE')
        .map((item) => item.hmeromhnia.toISOString().slice(0, 10));
    return { scope, row, dailyProfile: { kathestos_apasxolhshs: '1' },
        actualFacts: { countsAsActualWorkDay: false }, isResidual: remaining.includes(day),
        remaining_dates: remaining, stage2: { status: 'COMPLETED',
            resolution: 'NOT_APPLICABLE', resolved_dates: [], fingerprint: 'a'.repeat(64) },
        upstream: { stage1_attestation_scope: 'PERIOD_SLICE',
            stage1_period_start: periodScope.period_start,
            stage1_period_end: periodScope.period_end,
            stage1_context_fingerprint: current.stages.stage1.current_context_fingerprint,
            stage1_current_fingerprint: current.stages.stage1.current_completion_fingerprint,
            stage1_completion_fingerprint: originalCompletion,
            stage1_effective_fingerprint: state.stage1.period_slices[0].effective_fingerprint,
            stage1_version: state.stage1.version,
            stage2_fingerprint: 'a'.repeat(64), stage2_version: 0,
            stage3_version: state.stage3?.version || 0 } };
}
async function apply(day, requestId) {
    const initialContext = decisionContext(day);
    return resolveWeeklyHrStage3Day({ initialContext,
        expected_input_fingerprint: buildStage3InputFingerprint(initialContext).fingerprint,
        expected_stage3_version: state.stage3?.version || 0,
        final_classification: 'ABSENCE', reason_or_notes: 'Απουσία',
        request_id: requestId, actor,
        auditModel: { findOne: () => query(null),
            create: async (items) => { audits.push(...items); } },
        stateModel: { findOne: () => query(state), collection: { updateOne: async (filter, update) => {
            assert.equal(filter['stage1.version'], state.stage1.version);
            assert.equal(filter['stage3.version']?.$exists === false
                ? 0 : filter['stage3.version'], state.stage3?.version || 0);
            stateUpdates += 1;
            state.stage1 = update.$set.stage1;
            state.stage3 = update.$set.stage3;
            return { matchedCount: 1 };
        } } },
        transactionRunner: async (work) => work({ session: {}, period_control_version: 4,
            period_write_fence_version: 8 }),
        loadFreshContext: async () => decisionContext(day),
        loadPostWriteContext: async () => decisionContext(day),
        writeDaily: async () => {
            const row = rows.find((item) => item.hmeromhnia.toISOString().slice(0, 10) === day);
            Object.assign(row, { kathgoria_adeias_apologistika: '',
                apousia_apologistika: true, kathgoria_ergasias_apologistika: '' });
            return { unchanged: false, row };
        } });
}
function assertTrustedRebase(version, previousContext, previousEffective) {
    const projected = lifecycle();
    const slice = state.stage1.period_slices[0];
    assert.equal(projected.stages.stage1.business_status, 'COMPLETED');
    assert.equal(slice.context_fingerprint,
        projected.stages.stage1.current_context_fingerprint);
    assert.equal(slice.effective_fingerprint,
        projected.stages.stage1.current_completion_fingerprint);
    assert.equal(slice.completion_fingerprint, originalCompletion);
    assert.equal(state.stage3.version, version);
    assert.notEqual(slice.context_fingerprint, previousContext);
    assert.notEqual(slice.effective_fingerprint, previousEffective);
}

(async () => {
    assert.equal(lifecycle().stages.stage1.business_status, 'COMPLETED');
    const originalContext = state.stage1.period_slices[0].context_fingerprint;
    await apply('2026-05-02', 'stage3:boundary-0001');
    assertTrustedRebase(1, originalContext, originalCompletion);
    const firstContext = state.stage1.period_slices[0].context_fingerprint;
    const firstEffective = state.stage1.period_slices[0].effective_fingerprint;
    await apply('2026-05-03', 'stage3:boundary-0002');
    assertTrustedRebase(2, firstContext, firstEffective);
    assert.equal(stateUpdates, 2);
    assert.equal(audits.length, 2);
    assert.equal(state.stage3.status, 'COMPLETED');

    const actionableChange = rows.map((row) => ({ ...row }));
    actionableChange[4].apo_ora_01 = '10:00';
    assert.equal(lifecycle(actionableChange).stages.stage1.business_status, 'STALE');
    assert.notEqual(lifecycle(actionableChange).stages.stage1.current_completion_fingerprint,
        state.stage1.period_slices[0].effective_fingerprint);

    const contextOnlyChange = rows.map((row) => ({ ...row }));
    contextOnlyChange[3].apo_ora_01 = '10:00';
    const contextOnlyLifecycle = lifecycle(contextOnlyChange);
    assert.equal(contextOnlyLifecycle.stages.stage1.business_status, 'STALE');
    assert.notEqual(contextOnlyLifecycle.stages.stage1.current_context_fingerprint,
        state.stage1.period_slices[0].context_fingerprint);
    assert.equal(contextOnlyLifecycle.stages.stage1.current_completion_fingerprint,
        state.stage1.period_slices[0].effective_fingerprint);
    console.log('Stage-3 boundary period-slice rebase regression tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
