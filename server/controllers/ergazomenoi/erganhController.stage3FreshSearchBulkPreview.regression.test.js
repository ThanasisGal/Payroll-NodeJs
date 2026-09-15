'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Controller = require('./erganhController');
const { buildWeeklyHrLifecycleProjection } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrStage3BulkPreview } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyHrStage3BulkPreviewService');
const { buildStage3InputFingerprint } = require(
    '../../services/ergazomenoi/apasxoliseisStage3FingerprintService');

const { prepareWeeklyHrStage3LifecycleInputs } =
    Controller.__stage3DailyEmploymentProfileTestHooks;
const employeeId = new mongoose.Types.ObjectId();
const employee = { _id: employeeId, kodikos: '0012',
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8 };
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: employeeId, employee_kodikos: employee.kodikos,
    week_start: '2026-05-04', week_end: '2026-05-10' };
const rows = Array.from({ length: 7 }, (_, index) => {
    const day = new Date('2026-05-04T00:00:00.000Z');
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const possible = ['2026-05-06', '2026-05-08'].includes(date);
    return { _id: new mongoose.Types.ObjectId(), team: scope.team,
        company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma,
        kodikos: employee.kodikos, hmeromhnia: day,
        kathgoria_ergasias: index === 0 ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: index === 0 ? 'ΕΡΓ' : '',
        ores_ergasias: possible || index === 0 ? 8 : 0,
        apo_ora_01: possible || index === 0 ? '08:00' : '',
        eos_ora_01: possible || index === 0 ? '16:00' : '',
        cards_ores_ergasias: index === 0 ? 8 : 0,
        cards_apo_ora_01: index === 0 ? '08:00' : '',
        cards_eos_ora_01: index === 0 ? '16:00' : '',
        kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
        repo_apologistika: index === 1 || index === 3,
        adeia_apologistika: false, astheneia_apologistika: false,
        apousia_apologistika: false };
});
const phases = new Map([[employee.kodikos, { operationalPhases: [
    { apo: '2026-05-01', eos: '2026-05-06', detectedKathestosCode: '0' },
    { apo: '2026-05-07', eos: '2026-05-07', detectedKathestosCode: '2' },
    { apo: '2026-05-08', eos: '2026-05-31', detectedKathestosCode: '0' }
] }]]);
function prepared() {
    return prepareWeeklyHrStage3LifecycleInputs({
        weekly: { employee, rows: rows.map((row) => ({ ...row })), histories: [],
            resolveProfileForDate: (day) => ({ ...employee,
                kathestos_apasxolhshs: String(day).slice(0, 10) === '2026-05-07'
                    ? '2' : '0' }) },
        phaseContextByKodikos: phases });
}
function project(input, persistedStage1State = null) {
    return buildWeeklyHrLifecycleProjection({ weekRows: input.preparedRows,
        effectiveProfile: input.effectiveProfile,
        effectiveProfilesByDate: input.preparedProfilesByDate,
        persistedStage1State, scope });
}
const searchInputs = prepared();
const initial = project(searchInputs);
const stage1Fingerprint = initial.stages.stage1.current_completion_fingerprint;
const stage1State = { status: 'COMPLETED', version: 1,
    completion_fingerprint: stage1Fingerprint,
    effective_fingerprint: stage1Fingerprint };
const searchLifecycle = project(searchInputs, stage1State);
const pending = searchLifecycle.stages.stage3.pending_items;
assert.equal(pending.length, 2);
const oldUnpreparedLifecycle = buildWeeklyHrLifecycleProjection({ weekRows: rows,
    effectiveProfile: searchInputs.effectiveProfile,
    effectiveProfilesByDate: searchInputs.preparedProfilesByDate,
    persistedStage1State: stage1State, scope });
assert.notEqual(oldUnpreparedLifecycle.stages.stage3.stage2_fingerprint,
    searchLifecycle.stages.stage3.stage2_fingerprint);
const command = { ypokatasthma: '0000', period_start: '2026-05-01',
    period_end: '2026-05-31', final_classification: 'ABSENCE', leave_category: '',
    items: pending.map((item) => ({ employee_id: String(employeeId),
        employee_kodikos: employee.kodikos,
        week_start: scope.week_start, week_end: scope.week_end,
        row_id: item.row_id, decision_date: item.date,
        expected_input_fingerprint: item.input_fingerprint,
        expected_stage3_version: item.expected_stage3_version })) };

(async () => {
    let reloads = 0;
    const result = await buildWeeklyHrStage3BulkPreview({ command,
        requestScope: { team: scope.team, company_kod: scope.company_kod },
        loadAuthoritativeContext: async (item) => {
            reloads++;
            const freshInputs = prepared();
            const freshLifecycle = project(freshInputs, stage1State);
            const row = freshInputs.preparedRows.find((candidate) =>
                String(candidate._id) === item.row_id);
            const stage3 = freshLifecycle.stages.stage3;
            const context = { scope, row,
                dailyProfile: freshInputs.preparedProfilesByDate[item.decision_date],
                actualFacts: { countsAsActualWorkDay: false },
                isResidual: stage3.pending_dates.includes(item.decision_date),
                stage2: { fingerprint: stage3.stage2_fingerprint,
                    status: stage3.stage2_status,
                    resolution: stage3.stage2_resolution,
                    resolved_dates: stage3.stage2_automatic_resolved_dates },
                upstream: { stage1_attestation_scope: 'WEEKLY',
                    stage1_context_fingerprint: freshLifecycle.stages.stage1
                        .current_context_fingerprint,
                    stage1_current_fingerprint: stage1Fingerprint,
                    stage1_completion_fingerprint: stage1Fingerprint,
                    stage1_effective_fingerprint: stage1Fingerprint,
                    stage1_version: 1, stage2_fingerprint: stage3.stage2_fingerprint,
                    stage2_version: 0, stage3_version: 0 },
                workflowState: { stage1: stage1State,
                    stage3: { status: 'OPEN', version: 0 } },
                lifecycle: { employment_date_scope: {
                    authoritative_date_set: rows.map((day) =>
                        day.hmeromhnia.toISOString().slice(0, 10)),
                    context_only_dates: [] }, stages: freshLifecycle.stages } };
            assert.equal(buildStage3InputFingerprint(context).fingerprint,
                item.expected_input_fingerprint,
                'the authoritative reload must reconstruct the Search input');
            return context;
        } });
    assert.equal(reloads, 2);
    assert.equal(result.can_apply, true, JSON.stringify(result.invalid_items));
    assert.equal(result.invalid_items.length, 0);
    assert.equal(result.items.length, 2);
    const changedRows = rows.map((row) => ({ ...row }));
    changedRows.find((row) => String(row._id) === pending[0].row_id)
        .ores_ergasias = 7;
    const changedInputs = prepareWeeklyHrStage3LifecycleInputs({
        weekly: { employee, rows: changedRows, histories: [],
            resolveProfileForDate: (day) => ({ ...employee,
                kathestos_apasxolhshs: String(day).slice(0, 10) === '2026-05-07'
                    ? '2' : '0' }) }, phaseContextByKodikos: phases });
    assert.notEqual(project(changedInputs, stage1State).stages.stage3.pending_items[0]
        .input_fingerprint, pending[0].input_fingerprint);
    console.log('fresh Search to Stage-3 bulk-preview regression passed');
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
