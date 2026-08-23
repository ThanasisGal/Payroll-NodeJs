'use strict';

const assert = require('assert');
const erganhController = require('./erganhController');
const {
    resolveOrphanCardResolution
} = require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService');

const { buildApprovedOrphanDailyDerivedUpdate, buildApprovedOrphanDerivedPreview,
    buildStaleOrphanResolutionWriteSet,
    getPayrollCalculationIntervals, getPayrollDailyWorkMinutes,
    calculateAdditionalAndOverworkForDay, ORPHAN_DERIVED_PREVIEW_FIELDS,
    ORPHAN_WEEKLY_DEPENDENT_FIELDS } =
    erganhController.__orphanDailyCalculationTestHooks;

function row(overrides = {}) {
    return {
        _id: '64b000000000000000000014', kodikos: '0004',
        hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
        kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '14:51', eos_ora_01: '22:51',
        apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: '', ores_ergasias: 8,
        cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '', cards_ores_ergasias: 0,
        repo: false, adeia: false, astheneia: false, argia: false, is_locked: false,
        ...overrides
    };
}

function calculate(inputRow, manualInterval, effectiveEmployeeOverrides = {}) {
    const effectiveEmployee = { hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        dialleima_entos_ektos_orarioy: true, dialleima_se_lepta: 30,
        ...effectiveEmployeeOverrides };
    const approval = resolveOrphanCardResolution({
        row: inputRow, contextRows: [inputRow], manualInterval,
        riskAcknowledged: true, reuseScope: 'ONE_TIME', effectiveEmployee
    });
    assert.strictEqual(approval.canApprove, true);
    return { approval, result: buildApprovedOrphanDailyDerivedUpdate({
        row: inputRow,
        effectiveEmployee,
        argiesDateSet: new Set(), approvedOrphanResolution: approval
    }) };
}

const original = row();
const automatic = calculate(original, { start: '14:51', end: '22:51' });
assert.deepStrictEqual(getPayrollCalculationIntervals(automatic.result.workingRow), [{
    index: 1, apo: '14:51', eos: '22:51', start: 891, end: 1371, source: 'APOLOGISTIKA'
}]);
assert.deepStrictEqual(automatic.result.derivedUpdate, {
    kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
    adeia_apologistika: false, kathgoria_adeias_apologistika: '',
    astheneia_apologistika: false, apousia_apologistika: false,
    kyriakes_apologistika: true, ores_ergasias_apologistika: 8,
    ores_apoysias_apologistika: 0, ores_apoysias_base_apologistika: 0,
    hmeres_apoysias_apologistika: 0, ores_nyxtas_apologistika: 0.85,
    ores_argion_prosayxhsh_apologistika: 8, ores_argion_ergasia_apologistika: 0
});
assert.strictEqual(original.cards_apo_ora_01, '14:51');
assert.strictEqual(original.cards_eos_ora_01, '');
assert.strictEqual(original.apo_ora_01_apologistika, undefined);

const manual = calculate(row(), { start: '14:51', end: '22:30' });
assert.strictEqual(manual.result.derivedUpdate.ores_ergasias_apologistika, 7.65);
assert.strictEqual(manual.result.derivedUpdate.ores_apoysias_apologistika, 0.35);
assert.strictEqual(manual.result.derivedUpdate.ores_nyxtas_apologistika, 0.5);
assert.strictEqual(manual.result.derivedUpdate.ores_argion_prosayxhsh_apologistika, 7.65);

const splitRow = row({ apo_ora_01: '08:00', eos_ora_01: '12:00',
    apo_ora_02: '16:00', eos_ora_02: '20:00' });
const splitManual = calculate(splitRow, { start: '08:15', end: '17:45' },
    { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 });
assert.strictEqual(splitManual.approval.proposal.durationSource, 'HR_MANUAL_SPLIT_INTERVAL');
assert.strictEqual(splitManual.approval.proposal.manualIntervalMatchesRule, false);
assert.strictEqual(splitManual.approval.reuseScope, 'ONE_TIME');
assert.strictEqual(splitManual.approval.reusableDecisionRule, null);
assert.strictEqual(splitManual.result.derivedUpdate.ores_ergasias_apologistika, 9);
assert.strictEqual(splitManual.result.derivedUpdate.ores_nyxtas_apologistika, 0);
assert.strictEqual(splitManual.result.derivedUpdate.ores_argion_prosayxhsh_apologistika, 9);

const riskRow = row();
const riskContextRows = [{ _id: 'previous', hmeromhnia: new Date('2026-06-13T00:00:00Z'),
    cards_apo_ora_01: '23:00', cards_eos_ora_01: '08:00' }, riskRow];
const riskEffectiveEmployee = { hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
    dialleima_entos_ektos_orarioy: true, dialleima_se_lepta: 30 };
const riskPreview = resolveOrphanCardResolution({ row: riskRow,
    contextRows: riskContextRows, effectiveEmployee: riskEffectiveEmployee,
    riskAcknowledged: false });
assert.strictEqual(riskPreview.eligible, true);
assert.strictEqual(riskPreview.rest.hasViolation, true);
assert.strictEqual(riskPreview.canApprove, false);
assert.strictEqual(riskPreview.approvedUpdates, null);
const riskCalculationPreview = resolveOrphanCardResolution({ row: riskRow,
    contextRows: riskContextRows, effectiveEmployee: riskEffectiveEmployee,
    riskAcknowledged: true });
const riskDerivedPreview = buildApprovedOrphanDerivedPreview({ row: riskRow,
    effectiveEmployee: riskEffectiveEmployee, argiesDateSet: new Set(),
    approvedOrphanResolution: riskCalculationPreview });
assert.strictEqual(riskDerivedPreview.fields.ores_ergasias_apologistika, 8);
assert.strictEqual(riskPreview.canApprove, false);

const endOnlyRow = row({ cards_apo_ora_01: '', cards_eos_ora_01: '22:51' });
const endOnly = calculate(endOnlyRow, { start: '14:51', end: '22:51' });
assert.strictEqual(endOnly.approval.orphanType, 'END_ONLY');
assert.strictEqual(endOnly.approval.apologistikoBookUpdate, true);
assert.strictEqual(endOnly.result.derivedUpdate.ores_ergasias_apologistika, 8);
assert.strictEqual(endOnlyRow.cards_apo_ora_01, '');
assert.strictEqual(endOnlyRow.cards_eos_ora_01, '22:51');

const external = calculate(row(), null, { dialleima_entos_ektos_orarioy: false });
assert.strictEqual(external.approval.proposal.start, '14:51');
assert.strictEqual(external.approval.proposal.end, '23:21');
assert.strictEqual(external.approval.proposal.durationHours, 8.5);
assert.strictEqual(external.approval.proposal.workDurationHours, 8);
assert.strictEqual(external.result.derivedUpdate.ores_ergasias_apologistika, 8);
assert.strictEqual(external.result.derivedUpdate.ores_nyxtas_apologistika, 1.35);
assert.strictEqual(external.result.derivedUpdate.ores_argion_prosayxhsh_apologistika, 8);
assert.strictEqual(getPayrollDailyWorkMinutes(external.result.workingRow,
    { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 }), 480);
const externalPreview = buildApprovedOrphanDerivedPreview({
    row: original,
    effectiveEmployee: { hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    argiesDateSet: new Set(), approvedOrphanResolution: external.approval
});
const simulatedFinalUpdate = {
    ...external.approval.approvedUpdates,
    ...external.result.derivedUpdate
};
for (const field of ORPHAN_DERIVED_PREVIEW_FIELDS) {
    assert.deepStrictEqual(externalPreview.fields[field],
        Object.prototype.hasOwnProperty.call(simulatedFinalUpdate, field)
            ? simulatedFinalUpdate[field] : original[field], field);
}
assert.deepStrictEqual(externalPreview.weekly_dependent_fields,
    ORPHAN_WEEKLY_DEPENDENT_FIELDS);
assert.strictEqual(externalPreview.calculation_source,
    'buildApprovedOrphanDailyDerivedUpdate');

const weeklyRow = { ...external.result.workingRow, eos_ora_01_apologistika: '00:21' };
const weeklyEmployee = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0',
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 };
const weeklyState = { weeklyRegularCardsMinutes: 41 * 60, processedRegularMinutes: 0 };
const weeklyResult = calculateAdditionalAndOverworkForDay({ rec: weeklyRow,
    ergazomenos: weeklyEmployee, argiesDateSet: new Set() }, weeklyState);
assert.strictEqual(weeklyResult.ores_yperergasias_apologistika, 0);
assert.strictEqual(weeklyResult.ores_yperergasias_nyxtas_apologistika +
    weeklyResult.ores_yperergasias_argion_nyxtas_apologistika, 1);
assert.strictEqual(weeklyResult.ores_nominhs_yperorias_apologistika +
    weeklyResult.ores_nominhs_yperorias_nyxtas_apologistika +
    weeklyResult.ores_nominhs_yperorias_argion_apologistika +
    weeklyResult.ores_nominhs_yperorias_argion_nyxtas_apologistika, 0);
const overtimeResult = calculateAdditionalAndOverworkForDay({
    rec: { ...weeklyRow, eos_ora_01_apologistika: '00:51' },
    ergazomenos: weeklyEmployee, argiesDateSet: new Set()
}, { weeklyRegularCardsMinutes: 41 * 60, processedRegularMinutes: 0 });
assert.strictEqual(overtimeResult.ores_nominhs_yperorias_nyxtas_apologistika, 0.5);

const sixDayEmployee = { ...weeklyEmployee, hmeres_ergasias_ebdomadas: 6,
    mo_oron_hmerhsias_ergasias: 40 / 6 };
const sixDayRow = { ...external.result.workingRow, apo_ora_01_apologistika: '14:51',
    eos_ora_01_apologistika: '22:31' };
const sixDayResult = calculateAdditionalAndOverworkForDay({ rec: sixDayRow,
    ergazomenos: sixDayEmployee, argiesDateSet: new Set() },
{ weeklyRegularCardsMinutes: 41 * 60, processedRegularMinutes: 0 });
assert.strictEqual(sixDayResult.ores_yperergasias_argion_nyxtas_apologistika, 0.5);

for (const weeklyField of ['ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika', 'ores_nominhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_apologistika', 'compensation_breakdown_apologistika']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(
        automatic.result.derivedUpdate, weeklyField), false, weeklyField);
}

const staleWriteSet = buildStaleOrphanResolutionWriteSet({
    approvedUpdates: automatic.approval.approvedUpdates,
    metadata: { status: 'HR_APPROVED' },
    derivedUpdate: {
        ...automatic.result.derivedUpdate,
        ores_nominhs_yperorias_apologistika: 99,
        compensation_breakdown_apologistika: { client: 'forged' },
        cards_eos_ora_01: '22:51'
    }
});
assert.strictEqual(staleWriteSet.ores_ergasias_apologistika, 8);
assert.strictEqual(staleWriteSet.ores_nominhs_yperorias_apologistika, undefined);
assert.strictEqual(staleWriteSet.compensation_breakdown_apologistika, undefined);
assert.strictEqual(staleWriteSet.cards_eos_ora_01, undefined);
assert.strictEqual(staleWriteSet.orphan_card_resolution.status, 'HR_APPROVED');

console.log('approved orphan daily derived calculation contract: PASS');

