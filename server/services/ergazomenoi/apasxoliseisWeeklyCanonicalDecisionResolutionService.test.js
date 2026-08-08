'use strict';

const assert = require('node:assert/strict');
const {
    fingerprint,
    selectedProfileFingerprint,
    buildCanonicalWeeklyDecisionSnapshot
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const {
    buildWeeklyCanonicalDecisionSnapshotInput,
    groupWeeklyCanonicalDecisions
} = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const {
    resolveWeeklyCanonicalDecisionAnalysis
} = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');

function employee(overrides = {}) { return { _id: '507f191e810c19729de860eb', kodikos: 'E2',
    ypokatasthma: '0000', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0', typos_ergazomenon: 'Μ',
    pososto_prosayxhshs_6hs_hmeras: 40, nomimoOromisthio: 8, pragmatikoOromisthio: 10,
    source: 'CURRENT_EMPLOYEE_FALLBACK', ...overrides }; }
function rows(hours = [7, 7, 7, 7, 7, 9, 7]) { return hours.map((value, index) => {
    const date = new Date('2026-08-03T00:00:00.000Z'); date.setUTCDate(date.getUTCDate() + index);
    return { _id: `row-${index}`, team: 'THA', company_kod: 'company', ypokatasthma: '0000', kodikos: 'E2',
        hmeromhnia: date.toISOString().slice(0, 10), kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: index >= 5 ? 'ΑΝ' : 'ΕΡΓ', repo: index >= 5,
        repo_apologistika: index >= 5, ores_ergasias: value, ores_ergasias_apologistika: value,
        cards_ores_ergasias: value, cards_apo_ora_01: value ? '10:00' : '',
        cards_eos_ora_01: value ? (value === 9 ? '19:00' : '17:00') : '' };
}); }
const week = { naturalWeekStart: '2026-08-03', naturalWeekEnd: '2026-08-09',
    weekStart: '2026-08-03', weekEnd: '2026-08-09' };
const profile = employee();
function context(weekRows = rows(), automatic = null, overrides = {}) {
    const analysis = automatic || analyzeWeeklySixthSeventhDay({ weekRows, effectiveProfile: profile,
        hourlyRate: profile.pragmatikoOromisthio });
    const input = buildWeeklyCanonicalDecisionSnapshotInput({ team: 'THA', company_kod: 'company',
        employee: profile, week, weekRows, effectiveProfile: profile, profileHistory: [],
        automaticAnalysis: analysis, appliedProtectionContext: { entriesByRowId: {} }, ...overrides });
    return { analysis, input, weekRows };
}
function record(input, decision_type, decision_payload, overrides = {}) {
    const snapshot = buildCanonicalWeeklyDecisionSnapshot(input);
    return { team: 'THA', company_kod: 'company', ypokatasthma: '0000', employee_kodikos: 'E2',
        week_start: new Date('2026-08-03'), week_end: new Date('2026-08-09'), decision_status: 'RECORDED',
        snapshot_fingerprint: snapshot.fingerprint, decision_type, decision_payload,
        decision_payload_fingerprint: fingerprint(decision_payload), created_at: new Date(), ...overrides };
}
function blockedContext(weekRows = rows(), reasons = ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']) {
    const ready = analyzeWeeklySixthSeventhDay({ weekRows, effectiveProfile: profile, hourlyRate: 10 });
    return context(weekRows, { ...ready, status: 'NEEDS_HR_DECISION', reasons, sixthDay: null, seventhDay: null });
}

let base = blockedContext();
let result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis,
    snapshotInput: base.input, decisionRecords: [], weekRows: base.weekRows, effectiveProfile: profile });
assert.equal(result.analysis, base.analysis);

const stale = record(base.input, 'CARD_VERIFICATION_PENDING', { verified: true });
stale.snapshot_fingerprint = '0'.repeat(64);
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [stale], weekRows: base.weekRows, effectiveProfile: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_STALE'));

const left = record(base.input, 'CARD_VERIFICATION_PENDING', { verified: true });
const right = record(base.input, 'CLASSIFICATION_BY_DATE', { classification_by_date: { '2026-08-09': 'SIXTH' } });
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [left, right], weekRows: base.weekRows, effectiveProfile: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_CONFLICT'));

result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [left], weekRows: base.weekRows, effectiveProfile: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));
assert.equal(result.analysis.sixthDay, null);

const alternate = record(base.input, 'CLASSIFICATION_BY_DATE', { classification_by_date: {
    '2026-08-08': 'SEVENTH', '2026-08-09': 'SIXTH'
} });
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [alternate], weekRows: base.weekRows, effectiveProfile: profile });
assert.equal(result.analysis.status, 'READY');
assert.equal(result.analysis.sixthDay.hmeromhnia, '2026-08-09');
assert.equal(result.analysis.sixthDay.sixthDayHours, 7);
assert.equal(result.analysis.seventhDay.hmeromhnia, '2026-08-08');
assert.equal(result.analysis.seventhDay.illegalOvertimeHours, 9);

const invalidClassification = record(base.input, 'CLASSIFICATION_BY_DATE', {
    classification_by_date: { '2026-08-08': 'NORMAL' }
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [invalidClassification], weekRows: base.weekRows, effectiveProfile: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_CLASSIFICATION_INVALID'));

const repoRows = rows();
repoRows[4].repo_apologistika = true; repoRows[4].kathgoria_ergasias_apologistika = 'ΑΝ';
base = blockedContext(repoRows);
const repoDecision = record(base.input, 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', {
    current_repo_identities: ['2026-08-08', '2026-08-09'], applied_execution_id: null
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis, snapshotInput: base.input,
    decisionRecords: [repoDecision], weekRows: base.weekRows, effectiveProfile: profile });
assert.equal(result.analysis.status, 'READY');
assert.deepEqual(result.analysis.canonicalRepoDayIdentities, ['2026-08-08', '2026-08-09']);

const ambiguousClassification = record(base.input, 'CLASSIFICATION_BY_DATE', {
    classification_by_date: { '2026-08-08': 'SIXTH', '2026-08-09': 'SEVENTH' }
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: base.analysis,
    snapshotInput: base.input, decisionRecords: [ambiguousClassification], weekRows: base.weekRows,
    effectiveProfile: profile, employee: profile });
assert.equal(result.analysis.status, 'READY');
assert.equal(result.analysis.sixthDay.hmeromhnia, '2026-08-08');
assert.equal(result.analysis.sixthDay.sixthDayHours, 8);
assert.equal(result.analysis.sixthDay.illegalOvertimeHours, 1);
assert.equal(result.analysis.seventhDay.hmeromhnia, '2026-08-09');
assert.equal(result.analysis.seventhDay.illegalOvertimeHours, 7);

const profileBase = blockedContext(rows(), ['PROFILE_CHANGED_INSIDE_WEEK']);
const oldProfile = record(profileBase.input, 'PROFILE_CHANGED_INSIDE_WEEK', {
    profile_outcome: 'USE_PROFILE', profile_reference: { history_id: 'old' }
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis, snapshotInput: profileBase.input,
    decisionRecords: [oldProfile], weekRows: profileBase.weekRows, effectiveProfile: profile, employee: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_OUTCOME_NOT_CONSUMABLE'));

const confirmProfile = record(profileBase.input, 'PROFILE_CHANGED_INSIDE_WEEK', {
    profile_outcome: 'CONFIRM_PROFILE_TRANSITION', profile_reference: { source: 'AUDIT' }
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis,
    snapshotInput: profileBase.input, decisionRecords: [confirmProfile],
    weekRows: profileBase.weekRows, effectiveProfile: profile, employee: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_OUTCOME_NOT_CONSUMABLE'));

const missingProfile = record(profileBase.input, 'PROFILE_CHANGED_INSIDE_WEEK', {
    profile_outcome: 'USE_PROFILE', profile_reference: { history_id: 'missing' },
    selected_profile_reference: { kind: 'HISTORY', id: 'missing' },
    selected_profile_fingerprint: 'a'.repeat(64)
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis,
    snapshotInput: profileBase.input, decisionRecords: [missingProfile],
    weekRows: profileBase.weekRows, effectiveProfile: profile, employee: profile, profileHistory: [] });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_PROFILE_REFERENCE_INVALID'));

const currentSelected = { ...getOrarioTermsForDate(new Date(0), [], profile),
    profile_changed_inside_week: false };
const validProfile = record(profileBase.input, 'PROFILE_CHANGED_INSIDE_WEEK', {
    profile_outcome: 'USE_PROFILE', profile_reference: { source: 'CURRENT' },
    selected_profile_reference: { kind: 'CURRENT_EMPLOYEE', id: profile._id },
    selected_profile_fingerprint: selectedProfileFingerprint(currentSelected)
});
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis, snapshotInput: profileBase.input,
    decisionRecords: [validProfile], weekRows: profileBase.weekRows, effectiveProfile: profile, employee: profile });
assert.equal(result.analysis.status, 'READY');

const appliedContext = { entriesByRowId: {
    'row-5': { state: 'PROTECTED', rowId: 'row-5', executionId: 'execution-1', role: 'SOURCE' },
    'row-6': { state: 'PROTECTED', rowId: 'row-6', executionId: 'execution-1', role: 'TARGET' }
} };
const appliedBase = blockedContext(repoRows, ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']);
appliedBase.input = buildWeeklyCanonicalDecisionSnapshotInput({ team: 'THA', company_kod: 'company',
    employee: profile, week, weekRows: repoRows, effectiveProfile: profile, profileHistory: [],
    automaticAnalysis: appliedBase.analysis, appliedProtectionContext: appliedContext });
const conflictingApplied = record(appliedBase.input,
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', {
        current_repo_identities: ['2026-08-08', '2026-08-09'], applied_execution_id: 'other'
    });
result = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: appliedBase.analysis,
    snapshotInput: appliedBase.input, decisionRecords: [conflictingApplied], weekRows: repoRows,
    effectiveProfile: profile, employee: profile });
assert.ok(result.analysis.reasons.includes('CANONICAL_DECISION_APPLIED_TRANSFER_CONFLICT'));

const rerunLeft = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis,
    snapshotInput: profileBase.input, decisionRecords: [validProfile], weekRows: profileBase.weekRows,
    effectiveProfile: profile, employee: profile });
const rerunRight = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: profileBase.analysis,
    snapshotInput: profileBase.input, decisionRecords: [validProfile], weekRows: profileBase.weekRows,
    effectiveProfile: profile, employee: profile });
assert.deepEqual(rerunLeft.analysis, rerunRight.analysis);

const grouped = groupWeeklyCanonicalDecisions([validProfile]);
assert.equal(grouped.size, 1);
assert.equal(grouped.values().next().value.length, 1);

console.log('weekly canonical decision resolution tests passed (25 contracts)');
