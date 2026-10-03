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

function testProductionUnscheduledHolidayWorkIsResolvedWithoutHrReview() {
    const row = productionUnscheduledRow();
    const facts = buildApasxoliseisScenarioFacts(row, {
        holiday: {
            isHoliday: true,
            isOptionalHoliday: true,
            description: 'ΑΓΙΟΥ ΠΝΕΥΜΑΤΟΣ'
        }
    });
    const decision = matchApasxoliseisScenarioFacts(facts);

    assert.strictEqual(decision.scenario_code, 'UNSCHEDULED_DAY_WITH_CARDS');
    assert.strictEqual(decision.requires_review, false);
    assert.strictEqual(decision.display_labels.show_badge, false);

    const [preview] = buildApasxoliseisPolicyPreviewRows({
        rows: [row],
        argiesByDateKey: new Map([
            [
                '2026-06-01',
                {
                    ypoxreotikh_argia: false,
                    description: 'ΑΓΙΟΥ ΠΝΕΥΜΑΤΟΣ'
                }
            ]
        ])
    });
    assert.strictEqual(preview.policyResult.success, true);
    assert.strictEqual(preview.scenarioFactsSummary.is_holiday, true);
    assert.strictEqual(preview.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(preview.policyResult.requires_human_approval, false);
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
        assert.strictEqual(decision.rule_branch, 'UNKNOWN_PATTERN_REQUIRES_REVIEW', label);
    });
}

function testScenarioExposesStableRuleBranch() {
    const facts = buildApasxoliseisScenarioFacts(productionUnscheduledRow({
        kathgoria_ergasias: 'ΜΕ', cards_ores_ergasias: 8
    }));
    const decision = matchApasxoliseisScenarioFacts(facts);
    assert.strictEqual(decision.rule_branch, decision.scenario_code);
}

function testAnyCardEvidenceContract() {
    const cases = [
        ['start only', { cards_apo_ora_01: '14:51', cards_eos_ora_01: '' }],
        ['end only', { cards_apo_ora_01: '', cards_eos_ora_01: '22:51' }],
        ['invalid non-empty', { cards_apo_ora_01: 'invalid', cards_eos_ora_01: '' }],
        ['zero length', { cards_apo_ora_01: '14:51', cards_eos_ora_01: '14:51' }]
    ];

    cases.forEach(([label, cardFields]) => {
        const facts = buildApasxoliseisScenarioFacts({
            hmeromhnia: '2026-06-14',
            kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8,
            cards_ores_ergasias: 0,
            ...cardFields
        });
        assert.strictEqual(facts.cards.hasAnyCardEvidence, true, label);
        assert.strictEqual(facts.cards.hasCards, false, label);
    });

    const noCards = buildApasxoliseisScenarioFacts({
        hmeromhnia: '2026-06-11',
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 0
    });
    assert.strictEqual(noCards.cards.hasAnyCardEvidence, false);
}

function zeroLengthRow(overrides = {}) {
    return {
        _id: 'zero-length-2026-08-03',
        hmeromhnia: '2026-08-03',
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_apo_ora_01: '14:04',
        cards_eos_ora_01: '14:04',
        cards_ores_ergasias: 0,
        zero_length_card_resolution: null,
        ...overrides
    };
}

function testZeroLengthRequiresReviewUntilCanonicalApproval() {
    const unresolvedRow = zeroLengthRow();
    const unresolvedFacts = buildApasxoliseisScenarioFacts(unresolvedRow);
    const unresolvedDecision = matchApasxoliseisScenarioFacts(unresolvedFacts);
    assert.strictEqual(unresolvedFacts.cards.hasZeroLengthCardInterval, true);
    assert.strictEqual(unresolvedFacts.cards.hasAnyCardEvidence, true);
    assert.strictEqual(unresolvedFacts.cards.hasCards, false);
    assert.strictEqual(unresolvedFacts.review.zeroLengthResolutionApproved, false);
    assert.strictEqual(unresolvedDecision.scenario_code, 'ZERO_LENGTH_CARD_INTERVAL');
    assert.strictEqual(unresolvedDecision.requires_review, true);
    assert.strictEqual(unresolvedDecision.decision_status, 'PENDING_REVIEW');
    assert.deepStrictEqual(unresolvedDecision.proposed_updates, {});

    const [unresolvedPreview] = buildApasxoliseisPolicyPreviewRows({ rows: [unresolvedRow] });
    assert.strictEqual(unresolvedPreview.scenarioFactsSummary.has_card_evidence, true);
    assert.strictEqual(unresolvedPreview.scenarioFactsSummary.has_cards, false);
    assert.strictEqual(unresolvedPreview.scenarioFactsSummary.has_zero_length_card_interval, true);
    assert.strictEqual(unresolvedPreview.policyResult.policy_code, 'ZERO_LENGTH_CARD_REVIEW');
    assert.strictEqual(unresolvedPreview.policyResult.result_status, 'NEEDS_REVIEW');
    assert.deepStrictEqual(unresolvedPreview.policyResult.proposed_updates, {});

    const approvedRow = zeroLengthRow({
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '14:04',
        eos_ora_01_apologistika: '22:04',
        ores_ergasias_apologistika: 8,
        ores_pragmatikhs_ergasias_apologistika: 8,
        apologistiko_biblio: true,
        zero_length_card_resolution: {
            status: 'HR_APPROVED',
            policy_version: 'zero-length-card-work:v1',
            resolution_kind: 'ACTUAL_WORK_ERGANI_TRANSMISSION_FAILURE',
            affected_pairs: [1],
            approved_intervals: [
                { pairNumber: 1, start: '14:04', end: '22:04' }
            ],
            raw_cards_preserved: true,
            transmission_failure_confirmed: true
        }
    });
    const approvedFacts = buildApasxoliseisScenarioFacts(approvedRow);
    const approvedDecision = matchApasxoliseisScenarioFacts(approvedFacts);
    assert.strictEqual(approvedFacts.review.zeroLengthResolutionApproved, true);
    assert.strictEqual(approvedDecision.scenario_code, 'ZERO_LENGTH_CARD_INTERVAL');
    assert.strictEqual(approvedDecision.requires_review, false);
    assert.strictEqual(approvedDecision.decision_status, 'CLASSIFIED_ONLY');
    assert.deepStrictEqual(approvedDecision.proposed_updates, {});
    const approvedBefore = JSON.stringify(approvedRow);
    const [approvedPreview] = buildApasxoliseisPolicyPreviewRows({ rows: [approvedRow] });
    assert.strictEqual(approvedPreview.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.deepStrictEqual(approvedPreview.policyResult.proposed_updates, {});
    assert.strictEqual(JSON.stringify(approvedRow), approvedBefore);
    assert.strictEqual(approvedRow.apo_ora_01_apologistika, '14:04');
    assert.strictEqual(approvedRow.eos_ora_01_apologistika, '22:04');
}

function run() {
    testProductionUnscheduledDayIsResolvedWithoutHrReview();
    testProductionUnscheduledHolidayWorkIsResolvedWithoutHrReview();
    testIncompleteApologistikaStillRequireReview();
    testUnsafeBlankDaysRemainUnknown();
    testScenarioExposesStableRuleBranch();
    testAnyCardEvidenceContract();
    testZeroLengthRequiresReviewUntilCanonicalApproval();
    console.log('apasxoliseis scenario matcher tests passed');
}

run();
