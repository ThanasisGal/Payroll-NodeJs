const assert = require('assert');
const fs = require('fs');

const {
    validateApplyExecutionInput,
    runPolicyPreviewApplyExecutionLocked
} = require('./apasxoliseisPolicyPreviewApplyExecutionService');

const baseSession = {
    userId: '507f1f77bcf86cd799439011',
    userTeam: 'team-a',
    companyInUse: 'company-a',
    yearInUse: '2026',
    userStatus: 'A'
};
const baseFilters = {
    apo_hmeromhnia: '2026-06-01',
    eos_hmeromhnia: '2026-06-30',
    group_id: 'group-a',
    approval_id: '507f1f77bcf86cd799439013'
};

function applyPlan(
    planStatus = 'APPLYABLE',
    fieldsApplyable = planStatus === 'APPLYABLE' ? 2 : 0
) {
    return {
        scope: {
            team: 'team-a',
            company_kod: 'company-a',
            apo_hmeromhnia: '2026-06-01',
            eos_hmeromhnia: '2026-06-30'
        },
        dry_run_summary: { approvals_found: 1, fields_would_change: 2 },
        plan_summary: { plan_status: planStatus, fields_applyable: fieldsApplyable },
        approvals: [{ approval_id: 'approval-a', plan_status: planStatus }]
    };
}

async function runForRole(userRole, planStatus = 'APPLYABLE') {
    return runPolicyPreviewApplyExecutionLocked({
        session: { ...baseSession, userRole },
        filters: baseFilters,
        applyPlanRunner: async () => applyPlan(planStatus)
    });
}

async function testAdminApplyablePlanRemainsLocked() {
    const result = await runForRole('A');
    assert.strictEqual(result.execution_enabled, false);
    assert.strictEqual(result.execution_status, 'LOCKED');
    assert.strictEqual(result.execution_summary.would_apply_fields, 2);
    assert.strictEqual(result.execution_summary.writes_performed, 0);
}

async function testSupervisorApplyablePlanRemainsLocked() {
    const result = await runForRole('S');
    assert.strictEqual(result.execution_status, 'LOCKED');
    assert.strictEqual(result.execution_summary.writes_performed, 0);
}

async function testNormalUserRejected() {
    await assert.rejects(
        () => runForRole('U'),
        (error) => error.statusCode === 403 && error.code === 'NOT_AUTHORIZED'
    );
}

function testMissingDateFiltersRejected() {
    assert.throws(
        () => validateApplyExecutionInput({}),
        (error) => error.statusCode === 400 && error.code === 'INVALID_FILTERS'
    );
}

async function testBlockedPlanRemainsLockedWithoutWrites() {
    const result = await runForRole('A', 'BLOCKED');
    assert.strictEqual(result.execution_status, 'LOCKED');
    assert.strictEqual(result.execution_summary.would_apply_fields, 0);
    assert.strictEqual(result.execution_summary.writes_performed, 0);
    assert.strictEqual(result.execution_summary.blocked_code, 'NO_APPLYABLE_PLAN');
}

async function testApplyPlanRunnerCalledOnce() {
    let calls = 0;
    const result = await runPolicyPreviewApplyExecutionLocked({
        session: { ...baseSession, userRole: 'A' },
        filters: baseFilters,
        applyPlanRunner: async ({ session, filters }) => {
            calls++;
            assert.strictEqual(session.userRole, 'A');
            assert.strictEqual(filters.group_id, 'group-a');
            return applyPlan();
        }
    });

    assert.strictEqual(calls, 1);
    assert.deepStrictEqual(result.plan_summary, {
        plan_status: 'APPLYABLE',
        fields_applyable: 2
    });
    assert.deepStrictEqual(result.dry_run_summary, {
        approvals_found: 1,
        fields_would_change: 2
    });
}

function testExecutionServiceHasNoWriteDependency() {
    const source = fs.readFileSync(
        require.resolve('./apasxoliseisPolicyPreviewApplyExecutionService'),
        'utf8'
    );
    assert.doesNotMatch(source, /ProdhlomenaOrariaModel/);
    assert.doesNotMatch(
        source,
        /\.(save|updateOne|updateMany|findOneAndUpdate|bulkWrite|create|insertMany|deleteOne|deleteMany|findByIdAndUpdate)\s*\(/
    );
}

async function run() {
    await testAdminApplyablePlanRemainsLocked();
    await testSupervisorApplyablePlanRemainsLocked();
    await testNormalUserRejected();
    testMissingDateFiltersRejected();
    await testBlockedPlanRemainsLockedWithoutWrites();
    await testApplyPlanRunnerCalledOnce();
    testExecutionServiceHasNoWriteDependency();
    console.log('apasxoliseis policy preview locked apply execution service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
