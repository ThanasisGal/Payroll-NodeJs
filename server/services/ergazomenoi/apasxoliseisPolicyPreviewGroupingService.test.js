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
    cardHours = 0
}) {
    return {
        prodhlomena_oraria_id: id,
        kodikos,
        hmeromhnia: date,
        scenarioDecision: {
            scenario_code: scenarioCode,
            reasons: [reason]
        },
        scenarioFactsSummary: {
            declared_category: 'ΕΡΓ',
            card_hours: cardHours,
            has_cards: cardHours > 0
        },
        policyResult: {
            result_status: status,
            policy_code: policyCode,
            policy_title: policyCode ? `Policy ${policyCode}` : null,
            mode,
            reasons: [reason],
            proposed_updates: proposedUpdates,
            blocked: false,
            requires_human_approval: false,
            batch_approvable: false
        }
    };
}

function testEmptyList() {
    const grouping = buildApasxoliseisPolicyPreviewGrouping([]);

    assert.strictEqual(grouping.version, 1);
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

console.log('apasxoliseis policy preview grouping tests passed');
