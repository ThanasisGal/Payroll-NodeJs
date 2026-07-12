const assert = require('assert');
const fs = require('fs');

const {
    APPLY_EXECUTION_CONFIRMATION_TOKEN,
    validateApplyExecutionInput,
    buildApplyWriteOperationsFromPlan,
    buildMongoWriteModelsFromPreview,
    executeMongoWriteModelsWithInjectedWriter,
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

function planField(field, planAction, proposedValue) {
    return {
        field,
        plan_action: planAction,
        proposed_value: proposedValue
    };
}

function planItem(overrides = {}) {
    return {
        prodhlomena_oraria_id: '507f1f77bcf86cd799439012',
        employee_kodikos: '001',
        hmeromhnia: '2026-06-15',
        plan_status: 'APPLYABLE',
        fields: [
            planField('repo_apologistika', 'ALLOW_SET', true),
            planField('kathgoria_ergasias_apologistika', 'ALLOW_SET', 'ΑΝ')
        ],
        ...overrides
    };
}

function writeOperationsPlan({
    approvalStatus = 'APPLYABLE',
    items = [planItem()]
} = {}) {
    return {
        approvals: [
            {
                approval_id: 'approval-a',
                group_id: 'group-a',
                plan_status: approvalStatus,
                items
            }
        ]
    };
}

function testApplyableItemBuildsOneOperationWithTwoFields() {
    const result = buildApplyWriteOperationsFromPlan(writeOperationsPlan());
    assert.strictEqual(result.summary.operations_total, 1);
    assert.strictEqual(result.summary.fields_total, 2);
    assert.deepStrictEqual(result.operations[0].set, {
        repo_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΝ'
    });
}

function testNoopAndBlockedFieldsAreSkipped() {
    const result = buildApplyWriteOperationsFromPlan(
        writeOperationsPlan({
            items: [
                planItem({
                    fields: [
                        planField('repo_apologistika', 'ALLOW_SET', true),
                        planField('ores_ergasias_apologistika', 'NOOP', 8),
                        planField('ores_apoysias_apologistika', 'BLOCKED', 4)
                    ]
                })
            ]
        })
    );

    assert.deepStrictEqual(result.operations[0].set, { repo_apologistika: true });
    assert.strictEqual(result.summary.skipped_fields, 2);
}

function testPartiallyApplyableItemIncludesOnlyAllowedFields() {
    const result = buildApplyWriteOperationsFromPlan(
        writeOperationsPlan({
            approvalStatus: 'PARTIALLY_APPLYABLE',
            items: [
                planItem({
                    plan_status: 'PARTIALLY_APPLYABLE',
                    fields: [
                        planField('repo_apologistika', 'ALLOW_SET', true),
                        planField('ores_apoysias_apologistika', 'BLOCKED', 4)
                    ]
                })
            ]
        })
    );

    assert.strictEqual(result.summary.operations_total, 1);
    assert.deepStrictEqual(result.operations[0].set, { repo_apologistika: true });
    assert.strictEqual(result.summary.skipped_fields, 1);
}

function testBlockedAndNoopApprovalsBuildNoOperations() {
    ['BLOCKED', 'NOOP'].forEach((approvalStatus) => {
        const result = buildApplyWriteOperationsFromPlan(
            writeOperationsPlan({ approvalStatus })
        );
        assert.strictEqual(result.summary.operations_total, 0);
        assert.strictEqual(result.summary.skipped_items, 1);
    });
}

function testMissingRecordIdBuildsNoOperation() {
    const result = buildApplyWriteOperationsFromPlan(
        writeOperationsPlan({ items: [planItem({ prodhlomena_oraria_id: null })] })
    );
    assert.strictEqual(result.summary.operations_total, 0);
    assert.strictEqual(result.summary.skipped_items, 1);
}

function testUndefinedProposedValueIsSkipped() {
    const result = buildApplyWriteOperationsFromPlan(
        writeOperationsPlan({
            items: [
                planItem({
                    fields: [
                        planField('repo_apologistika', 'ALLOW_SET', true),
                        planField('ores_ergasias_apologistika', 'ALLOW_SET', undefined)
                    ]
                })
            ]
        })
    );
    assert.deepStrictEqual(result.operations[0].set, { repo_apologistika: true });
    assert.strictEqual(result.summary.skipped_fields, 1);
}

function mongoPreview(operations) {
    return buildMongoWriteModelsFromPreview({ operations });
}

function domainOperation(overrides = {}) {
    return {
        prodhlomena_oraria_id: '507f1f77bcf86cd799439012',
        set: {
            repo_apologistika: true,
            kathgoria_ergasias_apologistika: 'ΑΝ'
        },
        fields: [
            { field: 'repo_apologistika', proposed_value: true },
            { field: 'kathgoria_ergasias_apologistika', proposed_value: 'ΑΝ' }
        ],
        ...overrides
    };
}

function testMongoWriteModelContainsFilterAndTwoSetFields() {
    const result = mongoPreview([domainOperation()]);
    assert.strictEqual(result.summary.write_models_total, 1);
    assert.strictEqual(result.summary.fields_total, 2);
    assert.deepStrictEqual(result.write_models[0], {
        updateOne: {
            filter: { _id: '507f1f77bcf86cd799439012' },
            update: {
                $set: {
                    repo_apologistika: true,
                    kathgoria_ergasias_apologistika: 'ΑΝ'
                }
            }
        }
    });
}

function testMongoWriteModelSkipsMissingIdAndEmptySet() {
    const result = mongoPreview([
        domainOperation({ prodhlomena_oraria_id: '' }),
        domainOperation({ set: {}, fields: [] })
    ]);
    assert.strictEqual(result.summary.write_models_total, 0);
    assert.strictEqual(result.summary.skipped_operations, 2);
    assert.strictEqual(result.summary.skipped_fields, 2);
}

function testMongoWriteModelSkipsUndefinedAndNullFields() {
    const result = mongoPreview([
        domainOperation({
            set: {
                repo_apologistika: true,
                ores_ergasias_apologistika: undefined,
                ores_apoysias_apologistika: null
            }
        })
    ]);
    assert.deepStrictEqual(result.write_models[0].updateOne.update.$set, {
        repo_apologistika: true
    });
    assert.strictEqual(result.summary.skipped_fields, 2);
}

function testMongoWriteModelSkipsOperationWhenNoSetFieldsRemain() {
    const result = mongoPreview([
        domainOperation({
            set: {
                ores_ergasias_apologistika: undefined,
                ores_apoysias_apologistika: null
            }
        })
    ]);
    assert.strictEqual(result.summary.write_models_total, 0);
    assert.strictEqual(result.summary.skipped_operations, 1);
    assert.strictEqual(result.summary.skipped_fields, 2);
}

function testMongoWriteModelsSupportMultipleOperations() {
    const result = mongoPreview([
        domainOperation(),
        domainOperation({ prodhlomena_oraria_id: '507f1f77bcf86cd799439014' })
    ]);
    assert.strictEqual(result.summary.write_models_total, 2);
    assert.strictEqual(result.summary.fields_total, 4);
}

function guardedExecutorInput(overrides = {}) {
    return {
        mongoWriteModelsPreview: mongoPreview([domainOperation()]),
        ...overrides
    };
}

async function testGuardedExecutorDefaultsToLockedWithoutCallingWriter() {
    let calls = 0;
    const result = await executeMongoWriteModelsWithInjectedWriter(
        guardedExecutorInput({ writer: async () => { calls++; } })
    );
    assert.strictEqual(calls, 0);
    assert.strictEqual(result.execution_status, 'LOCKED');
    assert.strictEqual(result.execution_summary.writes_performed, 0);
    assert.strictEqual(result.execution_guard.blocked_code, 'LOCKED');
}

async function testGuardedExecutorExplicitFalseDoesNotCallWriter() {
    let calls = 0;
    const result = await executeMongoWriteModelsWithInjectedWriter(
        guardedExecutorInput({
            options: { execution_enabled: false },
            writer: async () => { calls++; }
        })
    );
    assert.strictEqual(calls, 0);
    assert.strictEqual(result.execution_guard.blocked_code, 'LOCKED');
}

async function testGuardedExecutorRequiresValidConfirmation() {
    for (const confirmationToken of [undefined, 'WRONG_TOKEN']) {
        let calls = 0;
        const result = await executeMongoWriteModelsWithInjectedWriter(
            guardedExecutorInput({
                options: {
                    execution_enabled: true,
                    confirmation_token: confirmationToken
                },
                writer: async () => { calls++; }
            })
        );
        assert.strictEqual(calls, 0);
        assert.strictEqual(result.execution_guard.blocked_code, 'CONFIRMATION_REQUIRED');
        assert.strictEqual(result.execution_summary.writes_performed, 0);
    }
}

async function testGuardedExecutorRequiresConfiguredWriter() {
    const result = await executeMongoWriteModelsWithInjectedWriter(
        guardedExecutorInput({
            options: {
                execution_enabled: true,
                confirmation_token: APPLY_EXECUTION_CONFIRMATION_TOKEN
            }
        })
    );
    assert.strictEqual(result.execution_guard.blocked_code, 'WRITER_NOT_CONFIGURED');
    assert.strictEqual(result.execution_summary.writes_performed, 0);
}

async function testGuardedExecutorCallsFakeWriterOnceAndReportsCounts() {
    let calls = 0;
    const preview = mongoPreview([domainOperation()]);
    const result = await executeMongoWriteModelsWithInjectedWriter({
        mongoWriteModelsPreview: preview,
        options: {
            execution_enabled: true,
            confirmation_token: APPLY_EXECUTION_CONFIRMATION_TOKEN
        },
        writer: async (writeModels) => {
            calls++;
            assert.deepStrictEqual(writeModels, preview.write_models);
            return { matchedCount: 1, modifiedCount: 1 };
        }
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.execution_status, 'EXECUTED');
    assert.strictEqual(result.execution_summary.matched_count, 1);
    assert.strictEqual(result.execution_summary.modified_count, 1);
    assert.strictEqual(result.execution_summary.writes_performed, 1);
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

async function testLockedResponseIncludesWriteOperationsPreviewWithoutWrites() {
    let calls = 0;
    const result = await runPolicyPreviewApplyExecutionLocked({
        session: { ...baseSession, userRole: 'A' },
        filters: baseFilters,
        applyPlanRunner: async () => ({
            ...applyPlan(),
            ...writeOperationsPlan()
        }),
        options: {
            execution_enabled: true,
            confirmation_token: APPLY_EXECUTION_CONFIRMATION_TOKEN
        },
        writer: async () => { calls++; }
    });

    assert.strictEqual(calls, 0);
    assert.strictEqual(result.write_operations_preview.summary.operations_total, 1);
    assert.strictEqual(result.write_operations_preview.summary.fields_total, 2);
    assert.strictEqual(result.mongo_write_models_preview.summary.write_models_total, 1);
    assert.strictEqual(result.mongo_write_models_preview.summary.fields_total, 2);
    assert.strictEqual(result.execution_summary.writes_performed, 0);
    assert.strictEqual(result.execution_status, 'LOCKED');
    assert.strictEqual(result.execution_guard.blocked_code, 'LOCKED');
}

function testExecutionServiceHasNoWriteDependency() {
    const source = fs.readFileSync(
        require.resolve('./apasxoliseisPolicyPreviewApplyExecutionService'),
        'utf8'
    );
    assert.doesNotMatch(source, /ProdhlomenaOrariaModel/);
    assert.doesNotMatch(source, /ApasxoliseisPolicyPreviewApprovalsModel/);
    assert.doesNotMatch(
        source,
        /\.(save|updateOne|updateMany|findOneAndUpdate|bulkWrite|create|insertMany|deleteOne|deleteMany|findByIdAndUpdate)\s*\(/
    );
}

async function run() {
    testApplyableItemBuildsOneOperationWithTwoFields();
    testNoopAndBlockedFieldsAreSkipped();
    testPartiallyApplyableItemIncludesOnlyAllowedFields();
    testBlockedAndNoopApprovalsBuildNoOperations();
    testMissingRecordIdBuildsNoOperation();
    testUndefinedProposedValueIsSkipped();
    testMongoWriteModelContainsFilterAndTwoSetFields();
    testMongoWriteModelSkipsMissingIdAndEmptySet();
    testMongoWriteModelSkipsUndefinedAndNullFields();
    testMongoWriteModelSkipsOperationWhenNoSetFieldsRemain();
    testMongoWriteModelsSupportMultipleOperations();
    await testGuardedExecutorDefaultsToLockedWithoutCallingWriter();
    await testGuardedExecutorExplicitFalseDoesNotCallWriter();
    await testGuardedExecutorRequiresValidConfirmation();
    await testGuardedExecutorRequiresConfiguredWriter();
    await testGuardedExecutorCallsFakeWriterOnceAndReportsCounts();
    await testAdminApplyablePlanRemainsLocked();
    await testSupervisorApplyablePlanRemainsLocked();
    await testNormalUserRejected();
    testMissingDateFiltersRejected();
    await testBlockedPlanRemainsLockedWithoutWrites();
    await testApplyPlanRunnerCalledOnce();
    await testLockedResponseIncludesWriteOperationsPreviewWithoutWrites();
    testExecutionServiceHasNoWriteDependency();
    console.log('apasxoliseis policy preview locked apply execution service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
