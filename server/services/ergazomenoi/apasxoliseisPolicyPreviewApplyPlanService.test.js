const assert = require('assert');

const {
    validateDryRunFieldDiffForApply,
    validateDryRunItemForApply,
    buildApplyPlanFromDryRun,
    runPolicyPreviewApplyPlan
} = require('./apasxoliseisPolicyPreviewApplyPlanService');

const recordId = '507f1f77bcf86cd799439012';
const baseItem = {
    prodhlomena_oraria_id: recordId,
    employee_kodikos: '001',
    hmeromhnia: '2026-06-15',
    status: 'WOULD_CHANGE',
    proposed_values: { ores_apoysias_apologistika: 8 }
};

function field(action, overrides = {}) {
    return {
        field: 'ores_apoysias_apologistika',
        label: 'Ώρες απουσίας απολογιστικά',
        current_value: 0,
        proposed_value: 8,
        action,
        ...overrides
    };
}

function approval(items, overrides = {}) {
    return {
        approval_id: '507f1f77bcf86cd799439013',
        group_id: 'policy-preview-group-test',
        decision_type: 'APPROVE_PREFILL',
        items,
        ...overrides
    };
}

function testWouldSetAllowed() {
    const result = validateDryRunFieldDiffForApply(field('WOULD_SET'), baseItem);
    assert.strictEqual(result.plan_action, 'ALLOW_SET');
}

function testAlreadySameNoop() {
    const result = validateDryRunFieldDiffForApply(
        field('ALREADY_SAME'),
        { ...baseItem, status: 'NO_CHANGE' }
    );
    assert.strictEqual(result.plan_action, 'NOOP');
}

function testSkippedBlocked() {
    const result = validateDryRunFieldDiffForApply(field('SKIPPED'), baseItem);
    assert.strictEqual(result.plan_action, 'BLOCKED');
    assert.match(result.block_reason, /παραλείφθηκε/);
}

function testMixedItemPartiallyApplyable() {
    const item = validateDryRunItemForApply({
        ...baseItem,
        field_diffs: [field('WOULD_SET'), field('SKIPPED', { field: 'repo_apologistika' })]
    });
    assert.strictEqual(item.plan_status, 'PARTIALLY_APPLYABLE');
}

function testMissingFieldDiffsBlocked() {
    const item = validateDryRunItemForApply({ ...baseItem, field_diffs: [] });
    assert.strictEqual(item.plan_status, 'BLOCKED');
    assert.match(item.block_reasons.join(' '), /αποτελέσματα πεδίων/);
}

function testAllBlockedApproval() {
    const plan = buildApplyPlanFromDryRun({
        approvals: [approval([{ ...baseItem, status: 'SKIPPED', field_diffs: [field('SKIPPED')] }])]
    });
    assert.strictEqual(plan.approvals[0].plan_status, 'BLOCKED');
    assert.strictEqual(plan.plan_summary.plan_status, 'BLOCKED');
}

function testApplyableAndPartialApprovals() {
    const applyable = buildApplyPlanFromDryRun({
        approvals: [approval([{ ...baseItem, field_diffs: [field('WOULD_SET')] }])]
    });
    assert.strictEqual(applyable.approvals[0].plan_status, 'APPLYABLE');

    const partial = buildApplyPlanFromDryRun({
        approvals: [
            approval([
                { ...baseItem, field_diffs: [field('WOULD_SET')] },
                { ...baseItem, prodhlomena_oraria_id: null, status: 'SKIPPED', field_diffs: [] }
            ])
        ]
    });
    assert.strictEqual(partial.approvals[0].plan_status, 'PARTIALLY_APPLYABLE');
}

function testEmptyApprovals() {
    const plan = buildApplyPlanFromDryRun({ approvals: [] });
    assert.strictEqual(plan.plan_summary.plan_status, 'EMPTY');
}

function testIneligibleApprovalDecisionTypesBlocked() {
    const applyableItem = { ...baseItem, field_diffs: [field('WOULD_SET')] };
    const cases = [
        approval([applyableItem], { decision_type: 'MARK_REVIEWED' }),
        approval([applyableItem], { decision_type: '' }),
        approval([applyableItem], { decision_type: undefined })
    ];

    cases.forEach((candidate) => {
        const plan = buildApplyPlanFromDryRun({ approvals: [candidate] });
        assert.strictEqual(plan.approvals[0].plan_status, 'BLOCKED');
        assert.match(plan.approvals[0].block_reasons.join(' '), /δεν είναι εγκεκριμένη πρόταση/);
        assert.strictEqual(plan.plan_summary.plan_status, 'BLOCKED');
    });
}

function testAllNoopTopLevelPlanIsBlocked() {
    const plan = buildApplyPlanFromDryRun({
        approvals: [
            approval([
                {
                    ...baseItem,
                    status: 'NO_CHANGE',
                    field_diffs: [field('ALREADY_SAME')]
                }
            ])
        ]
    });

    assert.strictEqual(plan.approvals[0].plan_status, 'NOOP');
    assert.strictEqual(plan.plan_summary.plan_status, 'BLOCKED');
    assert.strictEqual(plan.plan_summary.fields_applyable, 0);
}

async function testRunnerDependencyIsReadOnlyPlanInput() {
    let calls = 0;
    const fakeDryRunRunner = async ({ session, filters }) => {
        calls++;
        assert.strictEqual(session.userTeam, 'team-a');
        assert.strictEqual(filters.group_id, 'group-a');
        return {
            scope: {
                team: 'team-a',
                company_kod: 'company-a',
                apo_hmeromhnia: '2026-06-01',
                eos_hmeromhnia: '2026-06-30'
            },
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            summary: { approvals_found: 1 },
            approvals: [approval([{ ...baseItem, field_diffs: [field('WOULD_SET')] }])]
        };
    };

    const result = await runPolicyPreviewApplyPlan({
        session: { userTeam: 'team-a' },
        filters: {
            apo_hmeromhnia: '2026-06-01',
            eos_hmeromhnia: '2026-06-30',
            group_id: 'group-a'
        },
        dryRunRunner: fakeDryRunRunner
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.plan_summary.plan_status, 'APPLYABLE');
    assert.deepStrictEqual(result.dry_run_summary, { approvals_found: 1 });
}

async function run() {
    testWouldSetAllowed();
    testAlreadySameNoop();
    testSkippedBlocked();
    testMixedItemPartiallyApplyable();
    testMissingFieldDiffsBlocked();
    testAllBlockedApproval();
    testApplyableAndPartialApprovals();
    testEmptyApprovals();
    testIneligibleApprovalDecisionTypesBlocked();
    testAllNoopTopLevelPlanIsBlocked();
    await testRunnerDependencyIsReadOnlyPlanInput();
    console.log('apasxoliseis policy preview apply plan service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
