'use strict';

const assert = require('assert');
const FrozenModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const CorrectiveModel = require('../../models/apasxoliseisPeriodCorrectiveCase');
const AuditModel = require('../../models/apasxoliseisPeriodLifecycleAudit');
const { buildEmploymentPeriodFrozenSnapshot, projectFrozenReview } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { buildCorrectiveDelta, correctionSubmissionCapability,
    normalizeCorrectionCommands, reconstructCorrectedHistoricalResult } = require('./apasxoliseisPeriodCorrectiveService');
const { submissionTimeliness } = require('./apasxoliseisPeriodLifecycleService');
const { isPastDeadline } = require('./apasxoliseisPeriodControlService');

const scope = { team: 'T', company_kod: 'C', ypokatasthma: '0001',
    period_start: '2026-06-01', period_end: '2026-06-30' };
const daily = [{ _id: 'row1', kodikos: '001', ypokatasthma: '0001', hmeromhnia: new Date('2026-06-03'),
    apologistiko_biblio: true, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, cards_ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00',
    ores_ergasias_apologistika: 8, ores_yperergasias_apologistika: 1,
    ores_nominhs_yperorias_apologistika: 0.5, ores_paranomhs_yperorias_apologistika: 0.25,
    ores_nyxtas_apologistika: 2, ores_argion_prosayxhsh_apologistika: 1,
    kyriakes_apologistika: true, effective_profile_source: 'HISTORY', effective_profile_istoriko_id: 'history1',
    compensation_breakdown_apologistika: { hours: { sixthDayHours: 8 }, amounts: { premiumTotalAmount: 20 } },
    createdAt: new Date('2026-08-01'), secret: 'excluded' }];
const weeklyRows = Array.from({ length: 7 }, (_, index) => { const date = new Date('2026-06-01T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
    return index === 2 ? daily[0] : { _id: `week-${index}`, kodikos: '001', ypokatasthma: '0001', hmeromhnia: date,
        kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ', repo: index >= 5, repo_apologistika: index >= 5,
        ores_ergasias: 8, cards_ores_ergasias: index < 5 ? 8 : 0,
        cards_apo_ora_01: index < 5 ? '09:00' : '', cards_eos_ora_01: index < 5 ? '17:00' : '',
        effective_profile_resolved: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40,
            pragmatikoOromisthio: 10, nomimoOromisthio: 8 } }; });
daily[0].effective_profile_resolved = weeklyRows[0].effective_profile_resolved;
const input = { scope, dailyResults: daily, weeklyDailyResults: weeklyRows,
    calendarFacts: weeklyRows.map((row) => ({ hmeromhnia: row.hmeromhnia, is_holiday: false })),
    employees: [{ kodikos: '001', afm: '123456789', eponymo: 'ΕΠ', onoma: 'ΟΝ', hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40,
        pragmatikoOromisthio: 10, password: 'excluded' }],
    payrollResults: [{ kodikos: '001', aa_misthodosias: '1', typos_apodoxon: '01', synolo_mikton_apodoxon: 1000 }],
    deviations: [{ kodikos: '001', week_apo: '2026-06-01', status: 'NEEDS_HR', reasons: ['X'] }],
    canonicalDecisions: [{ employee_kodikos: '001', week_start: '2026-06-01', request_id: 'e2', decision_payload: { classification: 'SIXTH' } }],
    appliedRepoTransfers: [{ employee_kodikos: '001', week_start: '2026-06-01', request_id: 'repo', execution_status: 'APPLIED' }],
    payrollPhaseFacts: [{ kodikos: '001', apo: '2026-06-01', eos: '2026-06-30', phases: [{ aa_misthodosias: 1 }] }],
    policyContext: { policy_version: 'v7', sixth_day_rate: 40 }, sourceCalculationVersion: 'calc:v9' };
const one = buildEmploymentPeriodFrozenSnapshot(input);
const two = buildEmploymentPeriodFrozenSnapshot({ ...input, actor: 'other', created_at: new Date('2030-01-01') });
assert.strictEqual(one.frozen_snapshot_fingerprint, two.frozen_snapshot_fingerprint);
const auditNoise = buildEmploymentPeriodFrozenSnapshot({ ...input,
    deviations: input.deviations.map((row) => ({ ...row, created_at: new Date('2030-01-01'), created_by: 'other' })),
    canonicalDecisions: input.canonicalDecisions.map((row) => ({ ...row, created_at: new Date('2030-01-01'), created_by_user_name: 'other' })),
    appliedRepoTransfers: input.appliedRepoTransfers.map((row) => ({ ...row, applied_at: new Date('2030-01-01'), created_by_user_name: 'other' })) });
assert.strictEqual(one.frozen_snapshot_fingerprint, auditNoise.frozen_snapshot_fingerprint);
assert.strictEqual(one.frozen_snapshot_fingerprint.length, 64);
assert.strictEqual(one.snapshot.snapshot_schema_version, 'employment-period-frozen:v3');
assert.strictEqual(one.snapshot.employees[0].afm, '123456789');
assert.strictEqual(one.snapshot.daily_results[0].apologistiko_biblio, true);
assert.strictEqual(one.snapshot.daily_results[0].cards_apo_ora_01, '09:00');
assert.strictEqual(one.snapshot.daily_results[0].cards_eos_ora_01, '17:00');
assert.strictEqual(one.snapshot.policy_context.policy_version, 'v7');
assert.strictEqual(one.snapshot.employees[0].pososto_prosayxhshs_6hs_hmeras, 40);
assert.strictEqual(one.snapshot.canonical_decisions[0].request_id, 'e2');
assert.strictEqual(one.snapshot.applied_repo_transfers[0].request_id, 'repo');
assert.strictEqual(one.snapshot.deviations[0].status, 'NEEDS_HR');
assert.strictEqual(one.snapshot.daily_results[0].kyriakes_apologistika, true);
assert.strictEqual(one.snapshot.daily_results[0].compensation_breakdown_apologistika.amounts.premiumTotalAmount, 20);
assert.strictEqual(one.snapshot.daily_results[0].secret, undefined);
assert.strictEqual(one.snapshot.daily_results[0].createdAt, undefined);
assert.strictEqual(one.snapshot.payroll_results[0].aa_misthodosias, '1');
assert.strictEqual(one.snapshot.payroll_phase_facts[0].phases[0].aa_misthodosias, 1);
const changedPolicy = buildEmploymentPeriodFrozenSnapshot({ ...input, policyContext: { policy_version: 'v8' } });
assert.notStrictEqual(one.frozen_snapshot_fingerprint, changedPolicy.frozen_snapshot_fingerprint);
const changedProfile = buildEmploymentPeriodFrozenSnapshot({ ...input, employees: [{ ...input.employees[0], pragmatikoOromisthio: 11 }] });
assert.notStrictEqual(one.frozen_snapshot_fingerprint, changedProfile.frozen_snapshot_fingerprint);
const reviewBefore = projectFrozenReview(one.snapshot);
input.dailyResults[0].ores_ergasias_apologistika = 99;
input.policyContext.policy_version = 'current-v99';
assert.strictEqual(reviewBefore.rows[0].ores_ergasias_apologistika, 8);
assert.strictEqual(reviewBefore.source, 'FROZEN_FINALIZED');
assert.strictEqual(projectFrozenReview(one.snapshot, { kodikos: 'other' }).total, 0);

daily[0].ores_ergasias_apologistika = 8;
const corrected = [{ ...daily[0], ores_ergasias_apologistika: 9,
    ores_nominhs_yperorias_apologistika: 1.5,
    compensation_breakdown_apologistika: { amounts: { premiumTotalAmount: 35 } } }];
const deltaOne = buildCorrectiveDelta({ baselineRows: one.snapshot.daily_results, correctedRows: corrected });
const deltaTwo = buildCorrectiveDelta({ baselineRows: one.snapshot.daily_results, correctedRows: corrected });
assert.deepStrictEqual(deltaOne, deltaTwo);
const differentDelta = buildCorrectiveDelta({ baselineRows: one.snapshot.daily_results,
    correctedRows: [{ ...corrected[0], ores_ergasias_apologistika: 10 }] });
assert.notStrictEqual(deltaOne.fingerprint, differentDelta.fingerprint);
assert.strictEqual(deltaOne.delta.totals.ores_ergasias_apologistika, 1);
assert.strictEqual(deltaOne.delta.totals.ores_nominhs_yperorias_apologistika, 1);
assert.strictEqual(deltaOne.delta.totals.premiumTotalAmount, 15);
assert.strictEqual(one.snapshot.daily_results[0].ores_ergasias_apologistika, 8);
assert.strictEqual(submissionTimeliness({ submittedAt: '2026-07-31T20:59:59Z', deadline: '2026-07-31' }), 'TIMELY');
assert.strictEqual(submissionTimeliness({ submittedAt: '2026-07-31T21:00:00Z', deadline: '2026-07-31' }), 'LATE');
assert.deepStrictEqual(correctionSubmissionCapability({ requiresNewSubmission: true, deadline: '2026-07-31',
    now: new Date('2026-07-31T20:00:00Z'), isPastDeadline }), { requires_new_submission: true, can_submit_correction: true });
assert.deepStrictEqual(correctionSubmissionCapability({ requiresNewSubmission: true, deadline: '2026-07-31',
    now: new Date('2026-08-01T00:00:00Z'), isPastDeadline }), { requires_new_submission: true, can_submit_correction: false });
assert.deepStrictEqual(correctionSubmissionCapability({ requiresNewSubmission: false, deadline: '2026-07-31',
    now: new Date('2026-07-01'), isPastDeadline }), { requires_new_submission: false, can_submit_correction: false });
const correctionCommands = [{ type: 'REPLACE_HISTORICAL_CARD_INTERVALS', employee_kodikos: '001',
    date: '2026-06-03', intervals: [{ start: '09:00', end: '18:00' }] }];
const testAuthoritativeWeek = ({ frozenRows }) => ({ correctedRows: frozenRows.map((row) => {
    if (!String(row.hmeromhnia).startsWith('2026-06-03')) return row;
    return { ...row, ores_ergasias_apologistika: 9, ores_nominhs_yperorias_apologistika: 1.5,
        compensation_breakdown_apologistika: { amounts: { premiumTotalAmount: 35 } } };
}), deviations: [], diagnostics: [], canonical: null });
const reconstructed = reconstructCorrectedHistoricalResult({ baselineSnapshot: one.snapshot,
    commands: correctionCommands, runAuthoritativeWeek: testAuthoritativeWeek });
assert.strictEqual(reconstructed.correctedRows[0].ores_ergasias_apologistika, 9);
assert.strictEqual(reconstructed.correctedRows[0].cards_apo_ora_01, '09:00');
assert.strictEqual(reconstructed.correctedContext.authoritative_source,
    'SHARED_NORMAL_DAILY_ADAPTER_AND_WEEKLY_POST_CHECK_PLAN');
assert.throws(() => normalizeCorrectionCommands({ corrections: correctionCommands, correctedRows: [] }),
    (error) => error.code === 'CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN');
for (const forbidden of ['corrected_result', 'corrective_delta', 'baselineSnapshot', 'baseline_fingerprint',
    'can_submit_correction', 'deadline']) {
    assert.throws(() => normalizeCorrectionCommands({ corrections: correctionCommands, [forbidden]: 'forged' }),
        (error) => error.code === 'CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN');
}

for (const model of [FrozenModel, CorrectiveModel, AuditModel]) {
    assert.strictEqual(model.schema.options.autoIndex, false);
    assert.strictEqual(model.schema.options.autoCreate, false);
}
const frozenScopeVersionIndex = FrozenModel.schema.indexes().find(([, options]) =>
    options.name === 'unique_apasxoliseis_frozen_snapshot_scope_version');
assert.ok(frozenScopeVersionIndex);
assert.deepStrictEqual(frozenScopeVersionIndex[0], { team: 1, company_kod: 1, ypokatasthma: 1,
    period_start: 1, period_end: 1, historical_reconstruction_version: 1 });
assert.strictEqual(frozenScopeVersionIndex[1].unique, true);
assert.ok(!FrozenModel.schema.indexes().some(([, options]) =>
    options.name === 'unique_apasxoliseis_frozen_snapshot_scope'));
assert.ok(CorrectiveModel.schema.indexes().some(([, options]) => options.name === 'unique_active_apasxoliseis_corrective_case' && options.unique));
assert.deepStrictEqual(CorrectiveModel.schema.path('status').enumValues, ['ACTIVE', 'CLOSED']);
assert.ok(AuditModel.schema.path('event_type').enumValues.includes('SUBMISSION_NEEDED_DETERMINATION'));
console.log('employment period frozen/corrective pure contracts: PASS');
