const assert = require('assert');

const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');
const {
    matchApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioMatcherService');
const {
    buildApasxoliseisPolicyPreviewRows
} = require('./apasxoliseisPolicyPreviewService');

function productionUnscheduledRow(overrides = {}) {
    return {
        _id: 'production-unscheduled-row',
        team: 'THA',
        company_kod: 'company-a',
        ypokatasthma: '0000',
        kodikos: '0001',
        hmeromhnia: '2026-06-01',
        kathgoria_ergasias: '',
        ores_ergasias: 0,
        apo_ora_01: '',
        eos_ora_01: '',
        cards_apo_ora_01: '08:12',
        cards_eos_ora_01: '16:16',
        cards_ores_ergasias: 8.066666666666666,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '08:12',
        eos_ora_01_apologistika: '16:12',
        ores_ergasias_apologistika: 7.57,
        ores_pragmatikhs_ergasias_apologistika: 8.066666666666666,
        compensation_breakdown_apologistika: { status: 'READY', reasons: [] },
        apologistiko_biblio: true,
        ...overrides
    };
}

function classify(row) {
    return matchApasxoliseisScenarioFacts(buildApasxoliseisScenarioFacts(row));
}

function testProductionUnscheduledDayIsResolvedWithoutHrReview() {
    const decision = classify(productionUnscheduledRow());

    assert.strictEqual(decision.scenario_code, 'UNSCHEDULED_DAY_WITH_CARDS');
    assert.strictEqual(decision.confidence, 'HIGH');
    assert.strictEqual(decision.requires_review, false);
    assert.strictEqual(decision.can_auto_apply, false);
    assert.deepStrictEqual(decision.proposed_updates, {});
    assert.strictEqual(decision.display_labels.show_badge, false);

    const [preview] = buildApasxoliseisPolicyPreviewRows({
        rows: [productionUnscheduledRow()]
    });
    assert.strictEqual(preview.policyResult.success, true);
    assert.strictEqual(
        preview.policyResult.policy_code,
        'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS'
    );
    assert.strictEqual(preview.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(preview.policyResult.requires_human_approval, false);
    assert.strictEqual(preview.policyResult.blocked, false);
}

function testIncompleteApologistikaStillRequireReview() {
    const incomplete = productionUnscheduledRow({
        compensation_breakdown_apologistika: { status: 'NEEDS_HR_DECISION', reasons: [] }
    });
    const decision = classify(incomplete);
    assert.strictEqual(decision.scenario_code, 'UNSCHEDULED_DAY_WITH_CARDS');
    assert.strictEqual(decision.requires_review, true);
    assert.deepStrictEqual(decision.proposed_updates, {
        kathgoria_ergasias_apologistika: 'ΕΡΓ'
    });

    const [preview] = buildApasxoliseisPolicyPreviewRows({ rows: [incomplete] });
    assert.strictEqual(preview.policyResult.policy_code, 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS');
    assert.strictEqual(preview.policyResult.result_status, 'NEEDS_REVIEW');
}

function testUnsafeBlankDaysRemainUnknown() {
    const cases = [
        ['without cards', { cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0 }],
        ['declared interval', { apo_ora_01: '08:00', eos_ora_01: '16:00' }],
        ['incomplete cards', { cards_eos_ora_01: '' }],
        ['declared repo flag', { repo: true }],
        ['declared leave', { adeia: true }],
        ['declared sickness', { astheneia: true }],
        ['sickness', { astheneia_apologistika: true }],
        ['raw holiday', { argia: true }],
        ['leave category', { kathgoria_adeias_apologistika: 'ΑΔΑΛ' }],
        ['holiday', {}, { isHoliday: true }],
        ['conflicting category', { kathgoria_ergasias_apologistika: 'ΑΝ' }]
    ];

    cases.forEach(([label, overrides, holiday]) => {
        const facts = buildApasxoliseisScenarioFacts(productionUnscheduledRow(overrides), {
            holiday
        });
        const decision = matchApasxoliseisScenarioFacts(facts);
        assert.strictEqual(
            decision.scenario_code,
            'UNKNOWN_PATTERN_REQUIRES_REVIEW',
            label
        );
        assert.strictEqual(decision.can_auto_apply, false, label);
    });
}

function run() {
    testProductionUnscheduledDayIsResolvedWithoutHrReview();
    testIncompleteApologistikaStillRequireReview();
    testUnsafeBlankDaysRemainUnknown();
    console.log('apasxoliseis scenario matcher tests passed');
}

run();
