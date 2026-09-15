'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require(
    './apasxoliseisStage1PeriodSliceService');
const { buildWeeklyHrLifecycleProjection } = require(
    './apasxoliseisWeeklyHrLifecycleProjectionService');
const { makeSimulation } = require(
    './apasxoliseisWeeklyHrStage3BulkPreviewSimulationService');

const ids = Array.from({ length: 7 }, () => new mongoose.Types.ObjectId());
const weekRows = ids.map((id, index) => ({ _id: id, team: 'THA',
    company_kod: 'company', ypokatasthma: '0000', kodikos: '0011',
    hmeromhnia: new Date(Date.UTC(2026, 3, 27 + index)),
    kathgoria_ergasias: index === 6 ? 'ΑΝ' : 'ΕΡΓ',
    ores_ergasias: index === 6 ? 0 : 8,
    cards_ores_ergasias: index >= 1 && index <= 3 ? 8 : 0,
    cards_apo_ora_01: index >= 1 && index <= 3 ? '08:00' : '',
    cards_eos_ora_01: index >= 1 && index <= 3 ? '16:00' : '',
    apo_ora_01: index === 6 ? '' : '08:00',
    eos_ora_01: index === 6 ? '' : '16:00',
    kathgoria_adeias_apologistika: [4, 5].includes(index) ? 'POSSIBLE_LEAVE' : '',
    repo: index === 6, repo_apologistika: index === 6,
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: false }));
const dates = weekRows.map((row) => row.hmeromhnia.toISOString().slice(0, 10));
const periodScope = { period_start: new Date('2026-05-01T00:00:00.000Z'),
    period_end: new Date('2026-05-31T00:00:00.000Z') };
const employmentDateScope = { employment_owned_dates: dates,
    authoritative_date_set: dates.filter((date) => date >= '2026-05-01'),
    context_only_dates: dates.filter((date) => date < '2026-05-01'),
    is_full_natural_week: true };
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: new mongoose.Types.ObjectId(), employee_kodikos: '0011',
    week_start: '2026-04-27', week_end: '2026-05-03' };
const profile = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0' };
const profiles = Object.fromEntries(dates.map((date) => [date, profile]));
const slice = deriveStage1PeriodSlice({ weekRows, week_start: scope.week_start,
    week_end: scope.week_end, period_start: periodScope.period_start,
    period_end: periodScope.period_end, employment_date_scope: employmentDateScope });
const fingerprints = buildStage1PeriodSliceFingerprints({ weekRows, slice });
const workflowState = { stage1: { status: 'OPEN', version: 1,
    period_slices: [{ ...slice, status: 'COMPLETED', version: 1,
        context_fingerprint: fingerprints.context_fingerprint,
        completion_fingerprint: fingerprints.completion_fingerprint,
        effective_fingerprint: fingerprints.completion_fingerprint }] },
stage3: { status: 'OPEN', version: 0 } };
const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows,
    effectiveProfile: profile, effectiveProfilesByDate: profiles,
    persistedStage1State: workflowState.stage1, scope,
    periodScope, employmentDateScope });
assert.equal(lifecycle.stages.stage1.business_status, 'COMPLETED');
assert.deepEqual(lifecycle.stages.stage3.pending_dates, ['2026-05-01', '2026-05-02']);
const simulation = makeSimulation({ weekRows, workflowState, scope,
    upstream: { stage1_attestation_scope: 'PERIOD_SLICE',
        stage1_period_start: periodScope.period_start,
        stage1_period_end: periodScope.period_end },
    simulation_inputs: { effectiveProfile: profile,
        effectiveProfilesByDate: profiles, periodScope, employmentDateScope } });
const first = { row_id: String(ids[4]), decision_date: '2026-05-01' };
const second = { row_id: String(ids[5]), decision_date: '2026-05-02' };
assert.equal(simulation.inspect(first).outcome, 'APPLY');
simulation.apply(first, { final_classification: 'ABSENCE', leave_category: '' });
assert.deepEqual(simulation.inspect(second), { outcome: 'AUTO_SATISFIED',
    automatic_classification: 'REST_REPO',
    reason: 'DETERMINISTIC_STAGE2_REPO_RESOLUTION' });
console.log('Stage-3 period-slice sequential preview regression passed');
