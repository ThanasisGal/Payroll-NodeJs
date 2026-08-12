'use strict';

const assert = require('assert/strict');
const {
    buildCanonicalWeeklyDecisionSnapshot,
    validateDecisionCommand
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const {
    buildWeeklyReusableDecisionRule
} = require('./apasxoliseisReusablePolicyDecisionService');

const session = { userTeam: 'THA', companyInUse: 'company-a',
    userId: '507f191e810c19729de860ea', userName: 'HR User', userRole: 'HR', userStatus: 'A' };
const input = {
    team: 'THA', company_kod: 'company-a', ypokatasthma: '0001', employee_kodikos: '001',
    week_start: '2026-06-08', week_end: '2026-06-14',
    weekly_rows: [
        { _id: 'row-1', hmeromhnia: '2026-06-08', kathgoria_ergasias: 'ΕΡΓ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_ergasias: 8,
            ores_ergasias_apologistika: 8, cards_ores_ergasias: 8,
            cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' },
        { _id: 'row-2', hmeromhnia: '2026-06-13', kathgoria_ergasias: 'ΑΝ',
            kathgoria_ergasias_apologistika: 'ΑΝ', repo: true, repo_apologistika: true },
        { _id: 'row-3', hmeromhnia: '2026-06-14', kathgoria_ergasias: 'ΑΝ',
            kathgoria_ergasias_apologistika: 'ΑΝ', repo: true, repo_apologistika: true }
    ],
    current_repo_identities: ['2026-06-13', '2026-06-14'],
    actual_work_facts: { actual_work_dates: ['2026-06-08'] },
    effective_profile: { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: 'ΠΛΗΡΗΣ' },
    canonical_status: 'NEEDS_HR_DECISION',
    canonical_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'],
    policy_version: 'weekly-sixth-seventh:v1', source_version: 'post-check:v1'
};

const snapshot = buildCanonicalWeeklyDecisionSnapshot(input);
const repoRule = buildWeeklyReusableDecisionRule({
    snapshotResult: snapshot,
    decisionType: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    decisionPayload: { current_repo_identities: ['2026-06-13', '2026-06-14'] }
});
assert.equal(repoRule.eligible, true);
assert.equal(repoRule.criteria.employee_kodikos, undefined);
assert.equal(repoRule.criteria.week_start, undefined);
assert.equal(repoRule.criteria.week_end, undefined);
assert.deepEqual(repoRule.decision_payload, { repo_day_positions: [5, 6] });
assert.ok(!JSON.stringify(repoRule).includes('2026-06-13'));
assert.ok(!JSON.stringify(repoRule).includes('2026-06-14'));

const classificationRule = buildWeeklyReusableDecisionRule({
    snapshotResult: snapshot,
    decisionType: 'CLASSIFICATION_BY_DATE',
    decisionPayload: { classification_by_date: {
        '2026-06-13': 'SIXTH', '2026-06-14': 'SEVENTH'
    } }
});
assert.deepEqual(classificationRule.decision_payload, {
    classifications_by_day_position: [
        { day_position: 5, classification: 'SIXTH' },
        { day_position: 6, classification: 'SEVENTH' }
    ]
});

const reusableCommand = validateDecisionCommand({ session, currentInput: input, command: {
    decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    request_id: 'request-reusable-week',
    decision_payload: { current_repo_identities: ['2026-06-13', '2026-06-14'] },
    reuse_scope: 'FUTURE_IDENTICAL', reuse_effective_from: '2026-06-10'
} });
assert.equal(reusableCommand.reusable.criteria.employee_kodikos, undefined);
assert.equal(reusableCommand.command.reuse_effective_to, null);

for (const unsafe of [
    { decision_type: 'CARD_VERIFICATION_PENDING', request_id: 'request-unsafe-card',
        decision_payload: { verified: true, evidence_reference: 'unique evidence' } },
    { decision_type: 'PROFILE_CHANGED_INSIDE_WEEK', request_id: 'request-unsafe-profile',
        decision_payload: { profile_outcome: 'USE_PROFILE', profile_reference: { history_id: 'history-1' },
            selected_profile_reference: { kind: 'HISTORY', id: 'history-1' },
            selected_profile_fingerprint: 'a'.repeat(64) } }
]) {
    assert.throws(() => validateDecisionCommand({ session, currentInput: input,
        command: { ...unsafe, reuse_scope: 'FUTURE_IDENTICAL', reuse_effective_from: '2026-06-10' } }),
    (error) => ['UNIQUE_CARD_EVIDENCE', 'EMPLOYEE_SPECIFIC_DECISION'].includes(error.code));
}

console.log('weekly canonical reusable decision tests passed (12 contracts)');
