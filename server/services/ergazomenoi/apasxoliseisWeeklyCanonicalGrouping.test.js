'use strict';

const assert = require('assert/strict');
const { buildCanonicalWeeklyDecisionSnapshot } = require('./apasxoliseisWeeklyCanonicalDecisionService');
const { groupWeeklyReusableCases } = require('./apasxoliseisReusablePolicyDecisionService');

function snapshot(employee, declaredCategory = 'ΕΡΓ', calculatedCategory = 'ΕΡΓ') {
    return buildCanonicalWeeklyDecisionSnapshot({
        team: 'THA', company_kod: 'company', ypokatasthma: '0001', employee_kodikos: employee,
        week_start: '2026-06-01', week_end: '2026-06-07',
        weekly_rows: [{ _id: `row-${employee}`, hmeromhnia: '2026-06-01',
            kathgoria_ergasias: declaredCategory, kathgoria_ergasias_apologistika: calculatedCategory,
            ores_ergasias: 8, ores_ergasias_apologistika: 8, cards_ores_ergasias: 8,
            cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' }],
        effective_profile: { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: 'ΠΛΗΡΗΣ' },
        current_repo_identities: ['2026-06-06', '2026-06-07'], actual_work_facts: {},
        canonical_status: 'NEEDS_HR_DECISION',
        canonical_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'],
        policy_version: 'weekly:v1', source_version: 'source:v1'
    });
}

const cases = Array.from({ length: 13 }, (_, index) => ({
    decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    snapshot_result: snapshot(String(index + 1).padStart(3, '0')),
    case: { employee_kodikos: String(index + 1).padStart(3, '0'), week_start: '2026-06-01' }
}));
cases.push({ decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    snapshot_result: snapshot('999', 'ΜΕ'), case: { employee_kodikos: '999', week_start: '2026-06-01' } });
cases.push({ decision_type: 'CARD_VERIFICATION_PENDING', snapshot_result: snapshot('998'),
    case: { employee_kodikos: '998', week_start: '2026-06-01' } });
cases.push({ decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    snapshot_result: snapshot('997', 'ΕΡΓ', ''),
    case: { employee_kodikos: '997', week_start: '2026-06-01' } });

const groups = groupWeeklyReusableCases(cases);
assert.equal(groups.length, 2);
assert.equal(groups.find((group) => group.count === 14).employees_count, 14);
assert.equal(groups.find((group) => group.count === 1).cases[0].employee_kodikos, '999');
assert.ok(groups.every((group) => group.decision_type === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));
assert.equal(groups.flatMap((group) => group.cases).some((item) => item.employee_kodikos === '998'), false);

console.log('weekly canonical grouping tests passed (5 contracts)');
