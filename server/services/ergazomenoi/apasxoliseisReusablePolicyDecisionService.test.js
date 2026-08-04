const assert = require('assert');

const {
    buildReusableMatchCriteriaFromGroup,
    buildReusableDecisionFingerprint,
    getReusableDecisionEligibility,
    applyReusablePolicyDecisionsToPreviewRows
} = require('./apasxoliseisReusablePolicyDecisionService');

function group(overrides = {}) {
    return {
        ypokatasthma: '0000',
        status: 'NEEDS_REVIEW',
        policy_code: 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS',
        scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
        action_type: 'REVIEW_ONLY',
        reason_code: 'UNSCHEDULED_DAY_WITH_CARDS',
        items: [{ proposed_values: {} }],
        ...overrides
    };
}

function previewRow(overrides = {}) {
    return {
        prodhlomena_oraria_id: 'row-1',
        ypokatasthma: '0000',
        hmeromhnia: new Date('2026-07-10T00:00:00.000Z'),
        scenarioDecision: {
            scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
            requires_review: true,
            reasons: ['UNSCHEDULED_DAY_WITH_CARDS']
        },
        policyResult: {
            result_status: 'NEEDS_REVIEW',
            policy_code: 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS',
            mode: 'REVIEW_ONLY',
            reasons: ['UNSCHEDULED_DAY_WITH_CARDS'],
            requires_human_approval: true,
            proposed_updates: {}
        },
        ...overrides
    };
}

function reusableRule(criteria, overrides = {}) {
    return {
        _id: 'approval-1',
        decision_type: 'MARK_REVIEWED',
        decision_status: 'RECORDED',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'ACTIVE',
        reuse_fingerprint: buildReusableDecisionFingerprint(criteria),
        reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
        created_by_user_name: 'HR User',
        created_at: new Date('2026-06-30T10:00:00.000Z'),
        group_id: 'source-group',
        apo_hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
        eos_hmeromhnia: new Date('2026-06-30T00:00:00.000Z'),
        ...overrides
    };
}

function testStableFingerprintIgnoresEmployeeAndDate() {
    const left = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const right = buildReusableMatchCriteriaFromGroup(
        { ...group(), employee_kodikos: '9999', hmeromhnia: '2027-01-01' },
        '0000'
    );
    assert.strictEqual(
        buildReusableDecisionFingerprint(left),
        buildReusableDecisionFingerprint(right)
    );
}

function testDifferentBranchDoesNotMatch() {
    const left = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const right = buildReusableMatchCriteriaFromGroup(group(), '0001');
    assert.notStrictEqual(
        buildReusableDecisionFingerprint(left),
        buildReusableDecisionFingerprint(right)
    );
}

function testUnsafeCasesAreNotReusable() {
    const legalRest = getReusableDecisionEligibility({
        group: group({ policy_code: 'INTERDAY_MINIMUM_REST' }),
        decisionType: 'MARK_REVIEWED'
    });
    assert.strictEqual(legalRest.eligible, false);
    assert.strictEqual(legalRest.reason_code, 'LEGAL_REST_RULE');

    const incompleteCards = getReusableDecisionEligibility({
        group: group({ reason_code: 'CARD_VERIFICATION_PENDING' }),
        decisionType: 'MARK_REVIEWED'
    });
    assert.strictEqual(incompleteCards.eligible, false);

    const proposedChange = getReusableDecisionEligibility({
        group: group(),
        decisionType: 'MARK_REVIEWED',
        items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
    });
    assert.strictEqual(proposedChange.eligible, false);
    assert.strictEqual(proposedChange.reason_code, 'PROPOSED_DATA_CHANGE');
}

function testIdenticalFutureCaseIsResolvedWithAuditMetadata() {
    const criteria = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const [resolved] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [previewRow()],
        rules: [reusableRule(criteria)]
    });

    assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(resolved.policyResult.requires_human_approval, false);
    assert.strictEqual(resolved.scenarioDecision.requires_review, false);
    assert.strictEqual(resolved.policyResult.reusable_decision.approval_id, 'approval-1');
    assert.strictEqual(resolved.policyResult.reusable_decision.approved_by_user_name, 'HR User');
}

function testChangedScenarioAndEarlierDateRemainPending() {
    const criteria = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const [changedScenario, earlierDate] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [
            previewRow({
                scenarioDecision: {
                    scenario_code: 'DECLARED_REPO_WITH_CARDS',
                    requires_review: true,
                    reasons: ['DECLARED_REPO_WITH_CARDS']
                }
            }),
            previewRow({ hmeromhnia: new Date('2026-05-31T00:00:00.000Z') })
        ],
        rules: [reusableRule(criteria)]
    });

    assert.strictEqual(changedScenario.policyResult.result_status, 'NEEDS_REVIEW');
    assert.strictEqual(earlierDate.policyResult.result_status, 'NEEDS_REVIEW');
}

function run() {
    testStableFingerprintIgnoresEmployeeAndDate();
    testDifferentBranchDoesNotMatch();
    testUnsafeCasesAreNotReusable();
    testIdenticalFutureCaseIsResolvedWithAuditMetadata();
    testChangedScenarioAndEarlierDateRemainPending();
    console.log('apasxoliseis reusable policy decision service tests passed');
}

run();
