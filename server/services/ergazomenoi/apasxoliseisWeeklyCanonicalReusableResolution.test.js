'use strict';

const assert = require('assert/strict');
const {
    buildCanonicalWeeklyDecisionSnapshot
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const {
    buildWeeklyReusableDecisionRule,
    findApplicableWeeklyReusableDecision
} = require('./apasxoliseisReusablePolicyDecisionService');
const {
    resolveWeeklyCanonicalDecisionAnalysis
} = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const profile = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    typos_apasxolhshs: 'ΠΛΗΡΗΣ', typos_ebdomadas: 'ΣΤΑΘΕΡΗ', pragmatikoOromisthio: 10 };
function weeklyInput(weekStart, employee = '001', rowOverride = {}) {
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const rows = Array.from({ length: 7 }, (_, position) => {
        const date = new Date(start); date.setUTCDate(date.getUTCDate() + position);
        const repo = position >= 5;
        return { _id: `${employee}-${position}`, hmeromhnia: date.toISOString().slice(0, 10),
            kathgoria_ergasias: repo ? 'ΑΝ' : 'ΕΡΓ',
            kathgoria_ergasias_apologistika: repo ? 'ΑΝ' : 'ΕΡΓ', repo, repo_apologistika: repo,
            ores_ergasias: position === 5 ? 9 : repo ? 7 : 8,
            ores_ergasias_apologistika: position === 5 ? 9 : repo ? 7 : 8,
            cards_ores_ergasias: position === 5 ? 9 : repo ? 7 : 8,
            cards_apo_ora_01: '09:00', cards_eos_ora_01: position === 5 ? '18:00' : repo ? '16:00' : '17:00',
            ...(position === 0 ? rowOverride : {}) };
    });
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    return { team: 'THA', company_kod: 'company', ypokatasthma: '0001',
        employee_kodikos: employee, week_start: weekStart, week_end: end.toISOString().slice(0, 10),
        weekly_rows: rows, current_repo_identities: [rows[5].hmeromhnia, rows[6].hmeromhnia],
        actual_work_facts: {}, effective_profile: profile,
        canonical_status: 'NEEDS_HR_DECISION',
        canonical_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'],
        policy_version: 'weekly:v1', source_version: 'source:v1' };
}

const june = weeklyInput('2026-06-08');
const source = buildCanonicalWeeklyDecisionSnapshot(june);
const reusable = buildWeeklyReusableDecisionRule({ snapshotResult: source,
    decisionType: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    decisionPayload: { current_repo_identities: ['2026-06-13', '2026-06-14'] } });
const rule = { _id: 'rule-1', decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', decision_status: 'RECORDED',
    reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE', reuse_fingerprint: reusable.fingerprint,
    reuse_match_criteria: reusable.criteria, reusable_decision_payload: reusable.decision_payload,
    reuse_effective_from: new Date('2026-06-10T00:00:00.000Z'), reuse_effective_to: null };

const julyOtherEmployee = weeklyInput('2026-07-06', '999');
let match = findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(julyOtherEmployee), rules: [rule]
});
assert.equal(match.applicability, 'APPLICABLE');
assert.deepEqual(match.record.decision_payload.current_repo_identities,
    ['2026-07-11', '2026-07-12']);

const materiallyDifferent = weeklyInput('2026-07-06', '999', { kathgoria_ergasias: 'ΜΕ' });
assert.equal(findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(materiallyDifferent), rules: [rule]
}).applicability, 'NOT_FOUND');

const crossingMonth = weeklyInput('2026-06-29', '777');
assert.equal(crossingMonth.week_end, '2026-07-05');
assert.equal(findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(crossingMonth), rules: [rule]
}).applicability, 'APPLICABLE');
assert.equal(findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(crossingMonth),
    rules: [{ ...rule, reuse_effective_from: new Date('2026-07-01T00:00:00.000Z') }]
}).applicability, 'APPLICABLE');

assert.equal(findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(julyOtherEmployee),
    rules: [{ ...rule, reuse_effective_to: new Date('2026-07-05T00:00:00.000Z') }]
}).applicability, 'NOT_FOUND');
assert.equal(findApplicableWeeklyReusableDecision({
    snapshotResult: buildCanonicalWeeklyDecisionSnapshot(julyOtherEmployee),
    rules: [{ ...rule, reuse_status: 'REVOKED' }]
}).applicability, 'NOT_FOUND');

const automaticReady = analyzeWeeklySixthSeventhDay({
    weekRows: julyOtherEmployee.weekly_rows, effectiveProfile: profile, hourlyRate: 10
});
const automaticBlocked = { ...automaticReady, status: 'NEEDS_HR_DECISION',
    reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'], sixthDay: null, seventhDay: null };
const resolved = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis: automaticBlocked,
    snapshotInput: julyOtherEmployee, decisionRecords: [rule],
    weekRows: julyOtherEmployee.weekly_rows, effectiveProfile: profile });
assert.equal(resolved.applicability, 'APPLICABLE');
assert.equal(resolved.reusable, true);
assert.equal(resolved.decision._id, 'rule-1');
assert.deepEqual(resolved.decision.decision_payload.current_repo_identities,
    ['2026-07-11', '2026-07-12']);

console.log('weekly canonical reusable resolution tests passed (11 contracts)');
