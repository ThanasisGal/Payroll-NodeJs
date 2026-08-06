const assert = require('assert');
const {
    getApasxoliseisPolicyByCode,
    resolveEffectivePolicyParameters
} = require('./apasxoliseisPolicyCatalogService');
const { evaluateApasxoliseisPolicyForScenario } = require('./apasxoliseisPolicyEngineService');

function testCatalogDefaultsAndOverrides() {
    const noCards = getApasxoliseisPolicyByCode('NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY');
    assert.deepStrictEqual(resolveEffectivePolicyParameters(noCards), {
        allow_optional_holiday_leave_suggestion: true,
        default_leave_category: 'ΑΔΑΛ'
    });
    assert.strictEqual(resolveEffectivePolicyParameters(noCards, {
        allow_optional_holiday_leave_suggestion: false
    }).allow_optional_holiday_leave_suggestion, false);

    const repo = getApasxoliseisPolicyByCode('WEEKLY_REPO_BALANCE');
    assert.deepStrictEqual(resolveEffectivePolicyParameters(repo), {
        expected_weekly_repo_count: 1,
        allow_same_week_repo_transfer: true
    });
    const cards = getApasxoliseisPolicyByCode('DECLARED_REPO_OR_NON_WORK_WITH_CARDS');
    assert.deepStrictEqual(resolveEffectivePolicyParameters(cards), {
        copy_card_intervals_to_apologistika: true,
        default_work_category: 'ΕΡΓ'
    });
}

function testEngineAuditsEffectiveParametersAndExplicitBranch() {
    const result = evaluateApasxoliseisPolicyForScenario({
        policyCode: 'WEEKLY_REPO_BALANCE',
        scenarioDecision: {
            scenario_code: 'REPO_TRANSFER_WITHIN_WEEK', scenario_version: 'mvp:v1',
            rule_branch: 'REPO_TRANSFER_WITHIN_WEEK', requires_review: true, reasons: ['DISPLAY_REASON']
        }
    });
    assert.strictEqual(result.rule_branch, 'REPO_TRANSFER_WITHIN_WEEK');
    assert.strictEqual(result.audit_payload.parameters.expected_weekly_repo_count, 1);
    assert.strictEqual(result.audit_payload.parameters.allow_same_week_repo_transfer, true);
}

testCatalogDefaultsAndOverrides();
testEngineAuditsEffectiveParametersAndExplicitBranch();
console.log('apasxoliseis effective policy parameter tests passed');
