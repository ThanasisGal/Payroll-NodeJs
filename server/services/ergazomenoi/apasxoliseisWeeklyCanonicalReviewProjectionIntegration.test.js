'use strict';

const assert = require('node:assert/strict');
const { buildWeeklyRepoDeviationPreview } = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const { buildWeeklyCanonicalDecisionSnapshotInput } = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const { buildCanonicalWeeklyDecisionSnapshot, fingerprint } = require('./apasxoliseisWeeklyCanonicalDecisionService');
const { resolveWeeklyCanonicalDecisionAnalysis } = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const dates = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05'];
const hours = [0, 8.62, 4.2333, 4.5, 8.8167, 7.9, 6.9333];
const declaredRepos = new Set(['2026-06-30', '2026-07-02']);
const rows = dates.map((date, index) => ({
    _id: `0014-${date}`, team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0014', hmeromhnia: date,
    kathgoria_ergasias: declaredRepos.has(date) ? 'ΑΝ' : 'ΕΡΓ',
    kathgoria_ergasias_apologistika: index === 0 ? '' : 'ΕΡΓ',
    repo: declaredRepos.has(date), repo_apologistika: false,
    ores_ergasias: declaredRepos.has(date) ? 0 : 8,
    ores_ergasias_apologistika: hours[index], cards_ores_ergasias: hours[index],
    cards_apo_ora_01: index === 0 ? '' : '14:00',
    cards_eos_ora_01: index === 0 ? '' : '22:00'
}));
const employee = { _id: 'employee-0014', kodikos: '0014', ypokatasthma: '0000',
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, pososto_prosayxhshs_6hs_hmeras: 40,
    pragmatikoOromisthio: 10 };
const week = { naturalWeekStart: '2026-06-29', naturalWeekEnd: '2026-07-05',
    weekStart: '2026-06-29', weekEnd: '2026-07-05', isFullWeek: true };
const automatic = analyzeWeeklySixthSeventhDay({
    weekRows: rows, effectiveProfile: employee, hourlyRate: 10
});
assert.equal(automatic.status, 'READY');
assert.equal(automatic.sixthDay.hmeromhnia, '2026-07-05');
assert.equal(automatic.seventhDay, null);

const historicalAutomatic = { ...automatic,
    status: 'NEEDS_HR_DECISION',
    reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'],
    canonicalRepoDayIdentities: [], sixthDay: null, seventhDay: null };
const storedInput = buildWeeklyCanonicalDecisionSnapshotInput({
    team: 'THA', company_kod: 'company', employee: {
        ...employee, pososto_prosayxhshs_6hs_hmeras: null
    }, week, weekRows: rows, effectiveProfile: {
        ...employee, pososto_prosayxhshs_6hs_hmeras: null
    }, profileHistory: [], automaticAnalysis: historicalAutomatic,
    appliedProtectionContext: { entriesByRowId: {} }
});
const storedSnapshot = buildCanonicalWeeklyDecisionSnapshot(storedInput);
const payload = { current_repo_identities: ['2026-06-30', '2026-07-02'],
    applied_execution_id: null };
const decision = { ...storedSnapshot.scope, decision_status: 'RECORDED',
    decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    decision_payload: payload, decision_payload_fingerprint: fingerprint(payload),
    snapshot_fingerprint: storedSnapshot.fingerprint,
    canonical_snapshot: storedSnapshot.snapshot, created_at: new Date('2026-08-14T12:08:28.775Z') };

const preview = buildWeeklyRepoDeviationPreview({
    rows, periodStart: '2026-06-01', periodEnd: '2026-06-30',
    asOfDate: '2026-08-12',
    resolveWeeklyProfile: () => ({ repoResolutionReason: null,
        effectiveProfile: employee }),
    resolveDailyProfile: () => ({ fullTime: true }),
    isFullTimeProfile: (profile) => profile.fullTime === true,
    resolveCanonicalAnalysis: ({ base, weekRows, effectiveProfile, automaticAnalysis }) => {
        const currentInput = buildWeeklyCanonicalDecisionSnapshotInput({
            team: 'THA', company_kod: 'company', employee, week: {
                naturalWeekStart: base.weekStart, naturalWeekEnd: base.weekEnd,
                weekStart: base.weekStart, weekEnd: base.weekEnd, isFullWeek: true
            }, weekRows, effectiveProfile: { ...effectiveProfile,
                effective_break_minutes: 30, effective_break_inside_schedule: false },
            profileHistory: [], automaticAnalysis,
            appliedProtectionContext: { entriesByRowId: {} }
        });
        return resolveWeeklyCanonicalDecisionAnalysis({
            automaticAnalysis, snapshotInput: currentInput, decisionRecords: [decision],
            weekRows, effectiveProfile, employee, profileHistory: []
        });
    }
});

const deviation = preview.deviations.find((item) => item.kodikos === '0014');
assert.ok(deviation);
assert.equal(deviation.canonical_decision_applicability, 'APPLICABLE');
assert.deepEqual(deviation.resolved_repo_identities, ['2026-06-30', '2026-07-02']);
assert.equal(deviation.actual_repo, 2);
assert.equal(deviation.resolved_repo, 2);
assert.equal(deviation.missing_repo, 0);
assert.equal(deviation.requires_new_hr_decision, false);
assert.ok(!deviation.presentation_reasons.includes(
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));

console.log('weekly canonical applicable review projection integration: PASS');
