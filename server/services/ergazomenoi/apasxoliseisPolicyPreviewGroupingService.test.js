const assert = require('assert');

const {
    buildApasxoliseisPolicyPreviewGrouping
} = require('./apasxoliseisPolicyPreviewGroupingService');

function makeRow({
    id,
    kodikos,
    date,
    status,
    policyCode,
    scenarioCode,
    mode = 'REVIEW_ONLY',
    reason = 'DEFAULT_REASON',
    proposedUpdates = {},
    cardHours = 0,
    apologistikaCategory = '',
    previewId = '',
    diagnosticDetails = null,
    reusableDecision = null,
    ypokatasthma = '0000'
}) {
    return {
        preview_id: previewId,
        prodhlomena_oraria_id: id,
        kodikos,
        ypokatasthma,
        hmeromhnia: date,
        scenarioDecision: {
            scenario_code: scenarioCode,
            scenario_version: 'scenario:v1',
            rule_branch: reason,
            reasons: [reason]
        },
        scenarioFactsSummary: {
            declared_category: 'ΕΡΓ',
            apologistika_category: apologistikaCategory,
            card_hours: cardHours,
            has_cards: cardHours > 0,
            rest_period_diagnostic: diagnosticDetails
        },
        policyResult: {
            result_status: status,
            policy_code: policyCode,
            policy_version: 'policy:v1',
            rule_branch: reason,
            policy_title: policyCode ? `Policy ${policyCode}` : null,
            mode,
            reasons: [reason],
            proposed_updates: proposedUpdates,
            reusable_decision: reusableDecision,
            blocked: false,
            requires_human_approval: false,
            batch_approvable: false
        }
    };
}

function testReusableDecisionMetadataIsProjectedWithoutNewHrObligation() {
    const reusableDecision = {
        approval_id: 'approval-1',
        approved_by_user_name: 'HR User',
        approved_at: '2026-06-30T10:00:00.000Z'
    };
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'resolved-1',
            kodikos: '001',
            date: '2026-07-01',
            status: 'RESOLVED_BY_POLICY',
            policyCode: 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS',
            scenarioCode: 'UNSCHEDULED_DAY_WITH_CARDS',
            reason: 'UNSCHEDULED_DAY_WITH_CARDS',
            reusableDecision
        })
    ]);

    assert.deepStrictEqual(grouping.groups[0].reusable_decision, reusableDecision);
    assert.strictEqual(grouping.groups[0].items[0].reusable_decision.approval_id, 'approval-1');
    assert.strictEqual(grouping.groups[0].status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(grouping.summary.by_status.RESOLVED_BY_POLICY, 1);
    assert.strictEqual(grouping.summary.by_status.PREFILLED_PENDING_APPROVAL, undefined);
    assert.strictEqual(grouping.groups[0].reusable_eligible, false);
}

function testPresentationKeepsUnderlyingApologistikaCategory() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'employee-0001-2026-06-26',
            kodikos: '0001',
            date: '2026-06-26',
            status: 'NEEDS_REVIEW',
            policyCode: 'WEEKLY_REPO_BALANCE',
            scenarioCode: 'REPO_TRANSFER_WITHIN_WEEK',
            reason: 'REPO_TRANSFER_CANDIDATE',
            apologistikaCategory: 'ΑΔΕΙΑ',
            proposedUpdates: {
                kathgoria_ergasias_apologistika: 'ΑΝ'
            }
        })
    ]);
    const item = grouping.groups[0].items[0];
    assert.strictEqual(item.kathgoria_ergasias, 'ΕΡΓ');
    assert.strictEqual(item.kathgoria_ergasias_apologistika, 'ΑΔΕΙΑ');
    assert.strictEqual(item.proposed_values.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.strictEqual(item.policy_context.policy_version, 'POLICY:V1');
    assert.strictEqual(item.policy_context.scenario_version, 'SCENARIO:V1');
    assert.strictEqual(item.policy_context.decision_grain, 'ROW_DAY');
    assert.strictEqual(item.policy_context.rule_branch, 'REPO_TRANSFER_CANDIDATE');
    assert.strictEqual(item.policy_context.proposed_values, undefined);
}

function testRestDiagnosticKeepsCompositePreviewIdentityAndDecisionFacts() {
    const diagnosticDetails = {
        check_type: 'INTERDAY_REST',
        current_date: '2026-06-01',
        next_date: '2026-06-02',
        previous_end: '22:00',
        next_start: '08:59',
        measured_rest_minutes: 659,
        minimum_rest_minutes: 660
    };
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: '507f1f77bcf86cd799439011',
            previewId: '507f1f77bcf86cd799439011:INTERDAY_REST:2026-06-01',
            kodikos: '0001',
            date: '2026-06-02',
            status: 'NEEDS_REVIEW',
            policyCode: 'INTERDAY_MINIMUM_REST',
            scenarioCode: 'INTERDAY_REST_VIOLATION',
            reason: 'INTERDAY_REST_BELOW_MINIMUM',
            diagnosticDetails
        })
    ]);
    const item = grouping.groups[0].items[0];

    assert.strictEqual(
        item.preview_id,
        '507f1f77bcf86cd799439011:INTERDAY_REST:2026-06-01'
    );
    assert.strictEqual(item.prodhlomena_oraria_id, '507f1f77bcf86cd799439011');
    assert.deepStrictEqual(item.diagnostic_details, diagnosticDetails);
}

function testEmptyList() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([]);

    assert.strictEqual(grouping.version, 1);
    assert.strictEqual(grouping.scope, 'page');
    assert.strictEqual(grouping.summary.total, 0);
    assert.strictEqual(grouping.summary.groups_count, 0);
    assert.deepStrictEqual(grouping.groups, []);
}

function testStatusCountsAndGroups() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'a1',
            kodikos: '002',
            date: '2026-06-02',
            status: 'OK',
            policyCode: 'NO_APOLOGISTIKO_BIBLIO_OK',
            scenarioCode: 'SCENARIO_A'
        }),
        makeRow({
            id: 'a2',
            kodikos: '001',
            date: '2026-06-01',
            status: 'NEEDS_REVIEW',
            policyCode: 'POLICY_REVIEW',
            scenarioCode: 'SCENARIO_B'
        })
    ]);

    assert.strictEqual(grouping.summary.total, 2);
    assert.strictEqual(grouping.summary.groups_count, 2);
    assert.strictEqual(grouping.summary.by_status.OK, 1);
    assert.strictEqual(grouping.summary.by_status.NEEDS_REVIEW, 1);
}

function testSamePatternBecomesOneGroup() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'b2',
            kodikos: '002',
            date: '2026-06-02',
            status: 'PREFILLED_PENDING_APPROVAL',
            policyCode: 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY',
            scenarioCode: 'DECLARED_WORK_NO_CARDS_LEAVE',
            mode: 'PREFILL',
            reason: 'DECLARED_LEAVE_FOUND'
        }),
        makeRow({
            id: 'b1',
            kodikos: '001',
            date: '2026-06-01',
            status: 'PREFILLED_PENDING_APPROVAL',
            policyCode: 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY',
            scenarioCode: 'DECLARED_WORK_NO_CARDS_LEAVE',
            mode: 'PREFILL',
            reason: 'DECLARED_LEAVE_FOUND'
        }),
        makeRow({
            id: 'b3',
            kodikos: '001',
            date: '2026-06-03',
            status: 'PREFILLED_PENDING_APPROVAL',
            policyCode: 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY',
            scenarioCode: 'DECLARED_WORK_NO_CARDS_LEAVE',
            mode: 'PREFILL',
            reason: 'DECLARED_LEAVE_FOUND'
        })
    ]);

    assert.strictEqual(grouping.summary.groups_count, 1);
    assert.strictEqual(grouping.groups[0].count, 3);
    assert.strictEqual(grouping.groups[0].employees_count, 2);
    assert.strictEqual(grouping.groups[0].first_date, '2026-06-01');
    assert.strictEqual(grouping.groups[0].last_date, '2026-06-03');
    assert.deepStrictEqual(
        grouping.groups[0].items.map((item) => item.prodhlomena_oraria_id),
        ['b1', 'b3', 'b2']
    );
}

function testDeterministicSorting() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'c1',
            kodikos: '001',
            date: '2026-06-01',
            status: 'OK',
            policyCode: 'POLICY_OK',
            scenarioCode: 'SCENARIO_OK'
        }),
        makeRow({
            id: 'c2',
            kodikos: '001',
            date: '2026-06-01',
            status: 'UNKNOWN_PATTERN',
            policyCode: '',
            scenarioCode: 'UNKNOWN_PATTERN_REQUIRES_REVIEW',
            reason: 'UNKNOWN_PATTERN'
        }),
        makeRow({
            id: 'c3',
            kodikos: '001',
            date: '2026-06-01',
            status: 'NEEDS_REVIEW',
            policyCode: 'POLICY_REVIEW',
            scenarioCode: 'SCENARIO_REVIEW'
        }),
        makeRow({
            id: 'c4',
            kodikos: '001',
            date: '2026-06-01',
            status: 'PREFILLED_PENDING_APPROVAL',
            policyCode: 'POLICY_PREFILL',
            scenarioCode: 'SCENARIO_PREFILL'
        })
    ]);

    assert.deepStrictEqual(
        grouping.groups.map((group) => group.status),
        ['NEEDS_REVIEW', 'UNKNOWN_PATTERN', 'PREFILLED_PENDING_APPROVAL', 'OK']
    );
}

function testMissingPolicyOrScenario() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'd1',
            kodikos: '001',
            date: '2026-06-01',
            status: 'UNKNOWN_PATTERN',
            policyCode: '',
            scenarioCode: ''
        })
    ]);

    assert.strictEqual(grouping.summary.by_policy_code.UNKNOWN, 1);
    assert.strictEqual(grouping.summary.by_scenario_code.UNKNOWN, 1);
    assert.strictEqual(grouping.groups[0].policy_code, 'UNKNOWN');
    assert.strictEqual(grouping.groups[0].scenario_code, 'UNKNOWN');
}

function testDateOnlyStringPassesThrough() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([
        makeRow({
            id: 'e1',
            kodikos: '001',
            date: '2026-06-01',
            status: 'OK',
            policyCode: 'NO_APOLOGISTIKO_BIBLIO_OK',
            scenarioCode: 'SCENARIO_DATE'
        })
    ]);

    assert.strictEqual(grouping.groups[0].first_date, '2026-06-01');
    assert.strictEqual(grouping.groups[0].last_date, '2026-06-01');
    assert.strictEqual(grouping.groups[0].items[0].hmeromhnia, '2026-06-01');
}

testEmptyList();
testStatusCountsAndGroups();
testSamePatternBecomesOneGroup();
testDeterministicSorting();
testMissingPolicyOrScenario();
testDateOnlyStringPassesThrough();
testPresentationKeepsUnderlyingApologistikaCategory();
testRestDiagnosticKeepsCompositePreviewIdentityAndDecisionFacts();
testReusableDecisionMetadataIsProjectedWithoutNewHrObligation();

console.log('apasxoliseis policy preview grouping tests passed');
