'use strict';

const assert = require('assert');
const { buildEmploymentDailyCalculationUpdate } = require('./apasxoliseisEmploymentDailyCalculationAdapterService');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const calls = [];
const operation = (name, result) => (...args) => { calls.push({ name, args }); return typeof result === 'function' ? result(...args) : result; };
const operations = {
    normalizeZeroLengthCardPairs: operation('normalize', (row) => ({ ...row, normalized: true })),
    resolveCardPairVerification: operation('verify', { hasUnresolvedCardEvidence: false }),
    buildPartialVerifiedCardUpdate: operation('partial', { update: { partial: true } }),
    checkBrokenProgramVsBrokenCards: operation('broken-program-cards', {}),
    checkEarlyOrLateCard: operation('early-late', (_context, pair) => ({ [`pair_${pair}`]: pair })),
    checkContinuousVsBrokenCards: operation('continuous-broken', { continuous: true }),
    checkBrokenProgramVsContinuousCards: operation('broken-continuous', { broken_continuous: true }),
    checkNoDeclaredScheduleCards: operation('no-schedule', { no_schedule: true }),
    checkNightHours: operation('night', { night: 2 }),
    checkSundayHolidayHours: operation('sunday-holiday', { holiday: 1 }),
    checkRepoAdeiaAstheneiaApologistika: operation('repo-leave', { repo: false }),
    checkOresApoysias: operation('absence', { absence: 0 }),
    calculateAdditionalAndOverworkForDay: operation('overtime', { overwork: 3 }),
    sanitizeAppliedRepoTransferUpdate: operation('protection', ({ update }) => ({ sanitizedUpdate: update,
        diagnostics: ['PROTECTED'] }))
};
const expected = { apologistiko_biblio: false,
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
    apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
    pair_1: 1, pair_2: 2, pair_3: 3, continuous: true, broken_continuous: true,
    no_schedule: true, night: 2, holiday: 1, repo: false, absence: 0, overwork: 3 };
const normal = buildEmploymentDailyCalculationUpdate({ row: { _id: '1' }, effectiveEmployee: {},
    argiesDateSet: new Set(), weeklyState: {}, operations });
const corrective = buildEmploymentDailyCalculationUpdate({ row: { _id: '1', apologistiko_biblio: true,
    apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '17:00' }, effectiveEmployee: {},
    argiesDateSet: new Set(), weeklyState: {}, operations });
assert.deepStrictEqual(normal.sanitizedUpdate, expected);
assert.deepStrictEqual(corrective.sanitizedUpdate, expected);
assert.deepStrictEqual(corrective.sanitizedUpdate, normal.sanitizedUpdate);

const locked = buildEmploymentDailyCalculationUpdate({
    row: { _id: 'locked', is_locked: true, apologistiko_biblio: true,
        apo_ora_01_apologistika: '13:00', eos_ora_01_apologistika: '21:00',
        astheneia_apologistika: true, ores_apoysias: 8,
        ores_apoysias_apologistika: 8, hmeres_apoysias_apologistika: 1 },
    effectiveEmployee: {}, argiesDateSet: new Set(), weeklyState: {}, operations
});
assert.deepStrictEqual(locked.sanitizedUpdate, {});
assert.strictEqual(locked.workingRow.apologistiko_biblio, true);
assert.strictEqual(locked.workingRow.apo_ora_01_apologistika, '13:00');
assert.strictEqual(locked.workingRow.astheneia_apologistika, true);
assert.strictEqual(locked.workingRow.ores_apoysias, 8);
assert.strictEqual(locked.workingRow.ores_apoysias_apologistika, 8);
assert.strictEqual(locked.workingRow.hmeres_apoysias_apologistika, 1);
assert.strictEqual(locked.manualOwnership, 'LOCKED_HR_ROW');

let correctedAttendanceRuleCalls = 0;
const correctedOperations = {
    ...operations,
    resolveCardPairVerification,
    checkEarlyOrLateCard: (_context, pair) => {
        correctedAttendanceRuleCalls += 1;
        return pair === 1 ? { normal_attendance_rule_applied: true } : {};
    }
};
const correctedOrphan = buildEmploymentDailyCalculationUpdate({
    row: { _id: 'corrected', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
        apo_ora_01: '14:51', eos_ora_01: '22:51', cards_ores_ergasias: 8,
        cards_apo_ora_01: '14:51', cards_eos_ora_01: '22:51' },
    effectiveEmployee: { evelikth_proselefsh: 120 }, argiesDateSet: new Set(),
    weeklyState: {}, operations: correctedOperations
});
assert.strictEqual(correctedOrphan.rawCardEvidenceUnresolved, false);
assert.strictEqual(correctedOrphan.safeOrphan, null);
assert.strictEqual(correctedOrphan.sanitizedUpdate.normal_attendance_rule_applied, true);
assert.strictEqual(correctedAttendanceRuleCalls, 3);
const canonicalAbsenceRecalculation = buildEmploymentDailyCalculationUpdate({
    row: { _id: 'canonical-absence', apousia_apologistika: true,
        ores_ergasias: 8, hmeres_apoysias_apologistika: 1,
        ores_apoysias_apologistika: 8 },
    effectiveEmployee: {}, argiesDateSet: new Set(), weeklyState: {},
    operations: { ...operations,
        checkOresApoysias: () => ({ ores_apoysias_apologistika: 2 }) }
});
assert.strictEqual(canonicalAbsenceRecalculation.sanitizedUpdate
    .ores_apoysias_base_apologistika, 2);
assert.strictEqual(canonicalAbsenceRecalculation.sanitizedUpdate
    .ores_apoysias_apologistika, 8);
assert.strictEqual(canonicalAbsenceRecalculation.sanitizedUpdate
    .hmeres_apoysias_apologistika, 1);
const reusableResolution = {
    automaticReusableApplied: true, policyVersion: 'orphan-card-continuous:v1',
    orphanType: 'START_ONLY', proposal: { start: '14:51', end: '22:51', durationHours: 8 },
    apologistikoBookUpdate: false,
    approvedUpdates: { kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '22:51',
        ores_ergasias_apologistika: 8, ores_pragmatikhs_ergasias_apologistika: 8,
        apologistiko_biblio: false }
};
const autoReused = buildEmploymentDailyCalculationUpdate({ row: { _id: 'reused' },
    effectiveEmployee: {}, argiesDateSet: new Set(), weeklyState: {},
    operations: { ...operations,
        resolveCardPairVerification: () => ({ hasUnresolvedCardEvidence: true }) },
    orphanReusableResolution: reusableResolution });
assert.strictEqual(autoReused.unresolved, false);
assert.strictEqual(autoReused.sanitizedUpdate.apo_ora_01_apologistika, '14:51');
assert.strictEqual(autoReused.sanitizedUpdate.orphan_card_resolution.automatically_reused, true);
const unsafeReuse = buildEmploymentDailyCalculationUpdate({ row: { _id: 'unsafe' },
    effectiveEmployee: {}, argiesDateSet: new Set(), weeklyState: {},
    operations: { ...operations,
        resolveCardPairVerification: () => ({ hasUnresolvedCardEvidence: true }) },
    orphanReusableResolution: { ...reusableResolution, automaticReusableApplied: false } });
assert.strictEqual(unsafeReuse.unresolved, true);
assert.strictEqual(unsafeReuse.sanitizedUpdate.orphan_card_resolution, undefined);
const directApprovedResolution = {
    eligible: true, canApprove: true, policyVersion: 'orphan-card-continuous:v1',
    orphanType: 'START_ONLY', proposal: { start: '14:51', end: '22:30', durationHours: 7.65 },
    apologistikoBookUpdate: false,
    approvedUpdates: { kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '22:30',
        ores_ergasias_apologistika: 7.65, ores_pragmatikhs_ergasias_apologistika: 7.65,
        apologistiko_biblio: false }
};
const directApproved = buildEmploymentDailyCalculationUpdate({
    row: { _id: 'direct-approved', cards_apo_ora_01: '14:51', cards_eos_ora_01: '' },
    effectiveEmployee: {}, argiesDateSet: new Set(), weeklyState: null,
    operations: { ...operations,
        resolveCardPairVerification: () => ({ hasUnresolvedCardEvidence: true }) },
    orphanApprovedResolution: directApprovedResolution
});
assert.strictEqual(directApproved.unresolved, false);
assert.strictEqual(directApproved.sanitizedUpdate.apo_ora_01_apologistika, '14:51');
assert.strictEqual(directApproved.sanitizedUpdate.eos_ora_01_apologistika, '22:30');
assert.strictEqual(directApproved.sanitizedUpdate.orphan_card_resolution.automatically_reused, false);
assert.strictEqual(directApproved.sanitizedUpdate.overwork, undefined,
    'weekly-dependent fields must not be fabricated without weeklyState');
for (const required of ['normalize', 'verify', 'broken-program-cards', 'early-late', 'continuous-broken',
    'broken-continuous', 'no-schedule', 'night', 'sunday-holiday', 'repo-leave', 'absence', 'overtime', 'protection']) {
    assert.ok(calls.some((call) => call.name === required), required);
}
console.log('shared authoritative daily adapter characterization/parity: PASS');
