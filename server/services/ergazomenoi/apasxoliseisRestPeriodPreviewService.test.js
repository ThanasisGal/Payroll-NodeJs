const assert = require('assert');

const {
    buildRestPeriodPolicyPreviewRows
} = require('./apasxoliseisRestPeriodPreviewService');

function row(id, date, overrides = {}) {
    return {
        _id: id,
        team: 'THA',
        company_kod: 'company-a',
        ypokatasthma: '0000',
        kodikos: '0001',
        hmeromhnia: date,
        kathgoria_ergasias: 'ΕΡΓ',
        cards_ores_ergasias: 8,
        ...overrides
    };
}

let result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1', '2026-06-01', {
            cards_apo_ora_01: '09:00',
            cards_eos_ora_01: '13:00',
            cards_apo_ora_02: '15:59',
            cards_eos_ora_02: '20:00'
        })
    ],
    presentationRowIds: ['day-1']
});
assert.strictEqual(result.length, 1);
assert.strictEqual(result[0].preview_id, 'day-1:SPLIT_SHIFT_REST');
assert.strictEqual(result[0].policyResult.result_status, 'NEEDS_REVIEW');
assert.strictEqual(result[0].policyResult.policy_code, 'SPLIT_SHIFT_MINIMUM_REST');
assert.deepStrictEqual(result[0].policyResult.proposed_updates, {});
assert.strictEqual(
    result[0].scenarioFactsSummary.rest_period_diagnostic.measured_rest_minutes,
    179
);

result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1', '2026-06-01', {
            cards_apo_ora_01: '09:00',
            cards_eos_ora_01: '13:00',
            cards_apo_ora_02: '16:00',
            cards_eos_ora_02: ''
        })
    ]
});
assert.strictEqual(result.length, 1);
assert.strictEqual(result[0].policyResult.result_status, 'UNKNOWN_PATTERN');
assert.strictEqual(result[0].policyResult.requires_human_approval, false);
assert.strictEqual(
    result[0].scenarioFactsSummary.rest_period_diagnostic.verification_pending,
    true
);

// One incomplete slot alone is handled by the separate incomplete-punch
// workflow and must not produce a false split-rest diagnostic.
result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1', '2026-06-01', {
            cards_apo_ora_01: '09:00',
            cards_eos_ora_01: ''
        })
    ]
});
assert.deepStrictEqual(result, []);

result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1', '2026-06-01', {
            cards_apo_ora_01: '12:00',
            cards_eos_ora_01: '22:00'
        }),
        row('day-2', '2026-06-02', {
            cards_apo_ora_01: '08:59',
            cards_eos_ora_01: '17:00'
        })
    ],
    presentationRowIds: ['day-2']
});
assert.strictEqual(result.length, 1);
assert.strictEqual(result[0].prodhlomena_oraria_id, 'day-2');
assert.strictEqual(result[0].policyResult.policy_code, 'INTERDAY_MINIMUM_REST');
assert.strictEqual(result[0].policyResult.result_status, 'NEEDS_REVIEW');
assert.strictEqual(
    result[0].scenarioFactsSummary.rest_period_diagnostic.measured_rest_minutes,
    659
);
assert.strictEqual(result[0].scenarioFactsSummary.rest_period_diagnostic.current_date, '2026-06-01');
assert.strictEqual(result[0].scenarioFactsSummary.rest_period_diagnostic.next_date, '2026-06-02');

// The previous day can be context-only; the violation is attached to the
// next day that belongs to the current page.
assert.strictEqual(result[0].preview_id, 'day-2:INTERDAY_REST:2026-06-01');

// Non-consecutive dates are never compared.
result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1', '2026-06-01', {
            cards_apo_ora_01: '12:00',
            cards_eos_ora_01: '22:00'
        }),
        row('day-3', '2026-06-03', {
            cards_apo_ora_01: '08:00',
            cards_eos_ora_01: '17:00'
        })
    ]
});
assert.deepStrictEqual(result, []);

// Duplicate daily rows are ambiguous and are safely skipped for interday
// comparison instead of choosing one arbitrarily.
result = buildRestPeriodPolicyPreviewRows({
    rows: [
        row('day-1-a', '2026-06-01', {
            cards_apo_ora_01: '12:00',
            cards_eos_ora_01: '22:00'
        }),
        row('day-1-b', '2026-06-01', {
            cards_apo_ora_01: '12:00',
            cards_eos_ora_01: '22:00'
        }),
        row('day-2', '2026-06-02', {
            cards_apo_ora_01: '08:00',
            cards_eos_ora_01: '17:00'
        })
    ]
});
assert.deepStrictEqual(result, []);

console.log('rest-period policy preview tests passed');
