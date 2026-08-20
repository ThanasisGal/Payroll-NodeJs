'use strict';

const assert = require('assert');
const erganhController = require('./erganhController');

const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: `00000000000000000000000${index}`,
    kodikos: '0004',
    ypokatasthma: '0000',
    hmeromhnia: new Date(Date.UTC(2026, 5, 8 + index)).toISOString(),
    is_locked: true,
    effective_profile_resolved: { hmeres_ergasias_ebdomadas: 5,
        typos_apasxolhshs: 'ΠΛΗΡΗΣ', pragmatikoOromisthio: 10 },
    cards_apo_ora_01: '', cards_eos_ora_01: '',
    cards_apo_ora_02: '', cards_eos_ora_02: '',
    cards_apo_ora_03: '', cards_eos_ora_03: ''
}));
const baselineSnapshot = {
    snapshot_schema_version: 'employment-period-frozen:v3',
    source_calculation_version: 'employment-calculation:v2',
    scope: { team: 'THA', company_kod: 'company-id', ypokatasthma: '0000',
        period_start: '2026-06-01', period_end: '2026-06-30' },
    employees: [{ kodikos: '0004', ypokatasthma: '0000', hmeres_ergasias_ebdomadas: 5,
        typos_apasxolhshs: 'ΠΛΗΡΗΣ', pragmatikoOromisthio: 10 }],
    daily_results: rows,
    deviations: [], canonical_decisions: [], applied_repo_transfers: [],
    policy_context: { rules: [] },
    weekly_calculation_context: { rows, calendar_facts: [], profile_history: [] }
};

assert.strictEqual(typeof erganhController.frozenCorrectivePreview.runAuthoritativeWeek, 'function');
const result = erganhController.frozenCorrectivePreview.preview({
    baselineSnapshot, employee_kodikos: '0004', week_start: '2026-06-08'
});
assert.strictEqual(result.status, 'NEEDS_HR_DECISION');
assert.strictEqual(result.baselineRows.length, 7);
assert.ok(result.deviations.some((item) => item.status === 'NEEDS_HR_DECISION'));
assert.strictEqual(Object.hasOwn(result, 'save'), false);
assert.strictEqual(Object.hasOwn(result, 'bulkOps'), false);

console.log('frozen corrective real-runner read-only preview: PASS');
