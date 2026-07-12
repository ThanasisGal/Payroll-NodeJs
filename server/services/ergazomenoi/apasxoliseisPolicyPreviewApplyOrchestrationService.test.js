const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH,
    normalizeCount,
    normalizeApplyExecutionError,
    orchestratePolicyPreviewApply
} = require('./apasxoliseisPolicyPreviewApplyOrchestrationService');

function writeModelsPreview(writeModels = [{ fake_operation: true }]) {
    return { write_models: writeModels, summary: { write_models_total: writeModels.length } };
}

function blockedExecutionResult(blockedCode) {
    return {
        execution_enabled: false,
        execution_status: 'LOCKED',
        execution_guard: { blocked_code: blockedCode },
        execution_summary: {
            writes_performed: 0,
            matched_count: 0,
            modified_count: 0
        }
    };
}

async function testNonFunctionExecutorsAreNotConfigured() {
    for (const executeWriteModels of [undefined, null, false, 0, 'executor', {}]) {
        const result = await orchestratePolicyPreviewApply({
            mongoWriteModelsPreview: writeModelsPreview(),
            executeWriteModels,
            auditContext: { request_id: 'request-a' }
        });

        assert.strictEqual(result.orchestration_status, 'NOT_CONFIGURED');
        assert.strictEqual(result.execution_result, null);
        assert.strictEqual(result.failure, null);
        assert.strictEqual(result.audit_preview.orchestration_status, 'NOT_CONFIGURED');
        assert.strictEqual(result.audit_preview.operation_count, 1);
        assert.strictEqual(result.audit_preview.matched_count, null);
        assert.strictEqual(result.audit_preview.modified_count, null);
        assert.strictEqual(result.audit_preview.writes_performed, null);
        assert.strictEqual(result.audit_preview.partial_write_possible, false);
    }
}

async function testExactArgumentsForwardedWithoutMutation() {
    const mongoWriteModelsPreview = writeModelsPreview();
    const options = { execution_enabled: false, nested: { unchanged: true } };
    const previewSnapshot = structuredClone(mongoWriteModelsPreview);
    const optionsSnapshot = structuredClone(options);
    let calls = 0;

    const result = await orchestratePolicyPreviewApply({
        mongoWriteModelsPreview,
        options,
        executeWriteModels: async (input) => {
            calls++;
            assert.strictEqual(input.mongoWriteModelsPreview, mongoWriteModelsPreview);
            assert.strictEqual(input.options, options);
            return blockedExecutionResult('LOCKED');
        }
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.orchestration_status, 'BLOCKED');
    assert.deepStrictEqual(mongoWriteModelsPreview, previewSnapshot);
    assert.deepStrictEqual(options, optionsSnapshot);
}

async function testRecognizedBlockedCodesRemainBlocked() {
    for (const blockedCode of [
        'LOCKED',
        'CONFIRMATION_REQUIRED',
        'WRITER_NOT_CONFIGURED',
        'NO_WRITE_MODELS'
    ]) {
        const executionResult = blockedExecutionResult(blockedCode);
        const result = await orchestratePolicyPreviewApply({
            executeWriteModels: async () => executionResult
        });

        assert.strictEqual(result.orchestration_status, 'BLOCKED');
        assert.strictEqual(result.execution_result, executionResult);
        assert.strictEqual(result.failure, null);
        assert.strictEqual(result.audit_preview.blocked_code, blockedCode);
        assert.strictEqual(result.audit_preview.partial_write_possible, false);
    }
}

async function testOnlyExecutedStatusCompletes() {
    const executionResult = {
        execution_enabled: true,
        execution_status: 'EXECUTED',
        execution_guard: { blocked_code: null },
        execution_summary: {
            operations_total: 5,
            matched_count: 5,
            modified_count: 2,
            writes_performed: 2
        }
    };
    const result = await orchestratePolicyPreviewApply({
        mongoWriteModelsPreview: { write_models: new Array(5).fill(null) },
        executeWriteModels: async () => executionResult
    });

    assert.strictEqual(result.orchestration_status, 'COMPLETED');
    assert.strictEqual(result.execution_result, executionResult);
    assert.strictEqual(result.audit_preview.operation_count, 5);
    assert.strictEqual(result.audit_preview.matched_count, 5);
    assert.strictEqual(result.audit_preview.modified_count, 2);
    assert.strictEqual(result.audit_preview.writes_performed, 2);
}

async function testInvalidResolvedResultsFailWithoutRetry() {
    const invalidResults = [
        undefined,
        null,
        [],
        {},
        'string',
        123,
        { execution_status: '' },
        { execution_status: 'FAILED' },
        { execution_status: 'ERROR' },
        { execution_status: 'UNKNOWN' },
        { execution_status: 'LOCKED', execution_guard: { blocked_code: 'UNKNOWN_CODE' } }
    ];

    for (const invalidResult of invalidResults) {
        let calls = 0;
        const result = await orchestratePolicyPreviewApply({
            executeWriteModels: async () => {
                calls++;
                return invalidResult;
            }
        });

        assert.strictEqual(calls, 1);
        assert.strictEqual(result.orchestration_status, 'FAILED');
        assert.strictEqual(result.execution_result, null);
        assert.strictEqual(result.failure.code, 'INVALID_EXECUTION_RESULT');
        assert.strictEqual(result.failure.partial_write_possible, true);
        assert.strictEqual(result.failure.matched_count, null);
        assert.strictEqual(result.audit_preview.writes_performed, null);
    }
}

async function testPrimitiveThrownValuesPreserveSafeMessage() {
    const cases = [
        ['primitive message', 'primitive message'],
        [123, '123'],
        [true, 'true'],
        [null, 'Unknown execution error.'],
        [undefined, 'Unknown execution error.']
    ];

    for (const [thrownValue, expectedMessage] of cases) {
        let calls = 0;
        const result = await orchestratePolicyPreviewApply({
            executeWriteModels: async () => {
                calls++;
                throw thrownValue;
            }
        });

        assert.strictEqual(calls, 1);
        assert.strictEqual(result.orchestration_status, 'FAILED');
        assert.strictEqual(result.failure.message, expectedMessage);
        assert.strictEqual(result.failure.partial_write_possible, true);
    }
}

async function testNonEnumerableObjectMessageIsPreserved() {
    const thrownValue = {};
    Object.defineProperty(thrownValue, 'message', {
        value: 'non-enumerable message',
        enumerable: false
    });
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => { throw thrownValue; }
    });

    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.message, 'non-enumerable message');
}

async function testSensitiveFailureMessageIsRedactedEverywhere() {
    const sensitiveMessage = [
        'mongodb://admin:secret@db/payroll',
        'mongodb+srv://user:pass@example.mongodb.net/db',
        'email=user@example.com',
        'afm=123456789',
        'password=my-secret',
        'token=my-token',
        'authorization: Bearer abc123',
        'api_key=test-key',
        'filter={"afm":"123456789"}',
        'update={"password":"hidden-value"}'
    ].join(' ');
    const error = new Error(sensitiveMessage);
    error.code = 'token=code-secret';
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => { throw error; }
    });
    const serialized = JSON.stringify(result);

    for (const sensitiveValue of [
        'admin:secret',
        'user:pass',
        'user@example.com',
        '123456789',
        'my-secret',
        'my-token',
        'abc123',
        'test-key',
        'hidden-value',
        'code-secret'
    ]) {
        assert.ok(!serialized.includes(sensitiveValue), sensitiveValue);
    }
    assert.match(result.failure.message, /\[REDACTED\]/);
    assert.strictEqual(result.failure.message, result.audit_preview.failure_message);
    assert.ok(result.failure.message.length <= APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH);
    assert.doesNotMatch(serialized, /stack/i);
}

async function testAuthorizationSchemesAreFullyRedacted() {
    const cases = [
        ['Authorization=Basic abc123', ['abc123']],
        ['Authorization: Bearer abc123', ['abc123']],
        [
            'Authorization: Digest username="user", response="secret"',
            ['username="user"', 'response="secret"']
        ],
        ['Authorization=Negotiate abc123', ['abc123']],
        ['Authorization=CustomScheme value-with-spaces', ['value-with-spaces']]
    ];

    for (const [message, sensitiveValues] of cases) {
        const result = await orchestratePolicyPreviewApply({
            executeWriteModels: async () => { throw new Error(message); }
        });
        const serialized = JSON.stringify(result);

        assert.strictEqual(result.orchestration_status, 'FAILED');
        assert.match(result.failure.message, /authorization=\[REDACTED\]/i);
        sensitiveValues.forEach((value) => assert.ok(!serialized.includes(value), value));
    }
}

async function testNestedWritePayloadsAreFullyRedacted() {
    const cases = [
        'filter={"employee":{"name":"Thanasis"}}',
        'update={"profile":{"name":"Thanasis"}}',
        'write_model={"updateOne":{"filter":{"_id":"x"}}}',
        'write_models=[{"updateOne":{"filter":{"employee":"Thanasis"}}}]',
        'operations=[{"deleteOne":{"filter":{"employee":"Thanasis"}}}]'
    ];

    for (const message of cases) {
        const result = await orchestratePolicyPreviewApply({
            executeWriteModels: async () => { throw new Error(message); }
        });
        const serialized = JSON.stringify(result);

        assert.strictEqual(result.orchestration_status, 'FAILED');
        assert.match(result.failure.message, /\[REDACTED\]/);
        for (const rawValue of ['Thanasis', 'updateOne', 'deleteOne', 'employee', 'profile']) {
            assert.ok(!serialized.includes(rawValue), rawValue);
        }
    }
}

async function testSymbolArrayThrowReturnsGenericFailure() {
    let calls = 0;
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => {
            calls++;
            throw [Symbol('secret')];
        }
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.message, 'Unknown execution error.');
    assert.doesNotMatch(JSON.stringify(result), /secret/);
}

async function testRevokedErrorProxyReturnsGenericFailure() {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    let calls = 0;
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => {
            calls++;
            throw revocable.proxy;
        }
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.message, 'Unknown execution error.');
    assert.strictEqual(result.failure.partial_write_possible, true);
}

async function testRevokedAuditContextProxyIsIgnored() {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    const result = await orchestratePolicyPreviewApply({ auditContext: revocable.proxy });

    assert.strictEqual(result.orchestration_status, 'NOT_CONFIGURED');
    assert.deepStrictEqual(result.audit_preview.context, {});
}

async function testRevokedExecutionResultProxyFailsWithoutRetry() {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    let calls = 0;
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: () => {
            calls++;
            return revocable.proxy;
        }
    });

    assert.strictEqual(calls, 1);
    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.code, 'INVALID_EXECUTION_RESULT');
    assert.strictEqual(result.failure.partial_write_possible, true);
}

async function testThrowingErrorGettersReturnGenericFailure() {
    const error = {};
    for (const key of [
        'name',
        'code',
        'message',
        'result',
        'writeErrors',
        'matchedCount',
        'modifiedCount',
        'upsertedCount',
        'deletedCount'
    ]) {
        Object.defineProperty(error, key, {
            enumerable: true,
            get() { throw new Error(`${key} getter must not escape`); }
        });
    }
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => { throw error; }
    });

    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.message, 'Unknown execution error.');
    assert.strictEqual(result.failure.name, 'Error');
    assert.strictEqual(result.failure.code, null);
}

async function testPartialMongoBulkErrorCountsAreNormalizedWithoutMutation() {
    const error = {
        name: 'MongoBulkWriteError',
        code: 11000,
        message: 'Partial unordered bulk failure',
        writeErrors: [{ code: 11000 }, { code: 121 }],
        result: {
            result: { nMatched: 4, nModified: 2, nUpserted: 1, nRemoved: 0 }
        }
    };
    const snapshot = structuredClone(error);
    const result = await orchestratePolicyPreviewApply({
        executeWriteModels: async () => { throw error; }
    });

    assert.strictEqual(result.orchestration_status, 'FAILED');
    assert.strictEqual(result.failure.matched_count, 4);
    assert.strictEqual(result.failure.modified_count, 2);
    assert.strictEqual(result.failure.upserted_count, 1);
    assert.strictEqual(result.failure.deleted_count, 0);
    assert.strictEqual(result.failure.write_errors_count, 2);
    assert.strictEqual(result.failure.partial_write_possible, true);
    assert.deepStrictEqual(error, snapshot);
}

function testCountNormalizationAcceptsOnlyNonNegativeIntegers() {
    assert.strictEqual(normalizeCount(0), 0);
    assert.strictEqual(normalizeCount(2), 2);
    assert.strictEqual(normalizeCount('0'), 0);
    assert.strictEqual(normalizeCount('2'), 2);

    for (const invalidValue of [
        2.5,
        true,
        false,
        '',
        '   ',
        '2.5',
        Infinity,
        NaN,
        -1,
        {},
        []
    ]) {
        assert.strictEqual(normalizeCount(invalidValue), null);
    }
}

async function testOperationCountDescribesOnlyValidPreviewArray() {
    const cases = [
        [{}, null],
        [{ write_models: null }, null],
        [{ write_models: 'invalid' }, null],
        [{ write_models: [] }, 0],
        [{ write_models: [{}, {}, {}] }, 3]
    ];

    for (const [mongoWriteModelsPreview, expectedCount] of cases) {
        const result = await orchestratePolicyPreviewApply({ mongoWriteModelsPreview });
        assert.strictEqual(result.audit_preview.operation_count, expectedCount);
    }
}

async function testAuditContextUsesAllowlistRedactionAndSafeDescriptors() {
    const auditContext = {
        request_id: 'request-c',
        correlation_id: 'correlation-c',
        user_id: 'user@example.com',
        team: 'team-a',
        company_kod: 123,
        source: true,
        approval_id: null,
        payload: 'password=payload-secret',
        body: 'body-secret',
        data: 'data-secret',
        details: 'details-secret',
        mongo: 'mongo-secret',
        document: 'document-secret',
        nested: { ignored: true },
        array: ['ignored']
    };
    for (let index = 0; index < 500; index++) {
        auditContext[`arbitrary_${index}`] = 'x'.repeat(250);
    }
    Object.defineProperty(auditContext, 'actor_id', {
        enumerable: true,
        get() { throw new Error('getter must not execute'); }
    });

    const result = await orchestratePolicyPreviewApply({ auditContext });
    assert.deepStrictEqual(result.audit_preview.context, {
        request_id: 'request-c',
        correlation_id: 'correlation-c',
        user_id: '[REDACTED]',
        team: 'team-a',
        company_kod: 123,
        approval_id: null,
        source: true
    });
    assert.ok(JSON.stringify(result.audit_preview.context).length < 500);
}

function testStructuralIsolationAndSingleBulkWriteLocation() {
    const servicePath = require.resolve(
        './apasxoliseisPolicyPreviewApplyOrchestrationService'
    );
    const source = fs.readFileSync(servicePath, 'utf8');

    assert.doesNotMatch(source, /ProdhlomenaOrariaModel/);
    assert.doesNotMatch(source, /apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService/);
    assert.doesNotMatch(source, /ApasxoliseisPolicyPreviewApprovalsModel/);
    assert.doesNotMatch(source, /\.bulkWrite\s*\(/);
    assert.doesNotMatch(source, /require\(['"][^'"]*(controllers?|routes?)/i);
    assert.doesNotMatch(source, /\b(fetch|http|https)\s*\(/i);

    const serviceDirectory = path.dirname(servicePath);
    const bulkWriteCallFiles = fs.readdirSync(serviceDirectory)
        .filter((file) => /^apasxoliseisPolicyPreviewApply.*Service\.js$/.test(file))
        .filter((file) => /\.bulkWrite\s*\(/.test(
            fs.readFileSync(path.join(serviceDirectory, file), 'utf8')
        ));
    assert.deepStrictEqual(bulkWriteCallFiles, [
        'apasxoliseisPolicyPreviewApplyModelWriterService.js'
    ]);
}

function testNoRuntimeCaller() {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const ignoredDirectories = new Set(['.git', 'node_modules']);
    const searchableExtensions = new Set(['.js', '.cjs', '.mjs', '.ejs']);
    const references = [];
    const pending = [repositoryRoot];

    while (pending.length > 0) {
        const current = pending.pop();
        fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
            if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return;
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                pending.push(entryPath);
            } else if (searchableExtensions.has(path.extname(entry.name))) {
                const source = fs.readFileSync(entryPath, 'utf8');
                if (
                    source.includes('apasxoliseisPolicyPreviewApplyOrchestrationService')
                    || source.includes('orchestratePolicyPreviewApply')
                ) {
                    references.push(path.relative(repositoryRoot, entryPath));
                }
            }
        });
    }

    assert.deepStrictEqual(references.sort(), [
        'server/services/ergazomenoi/apasxoliseisPolicyPreviewApplyOrchestrationService.js',
        'server/services/ergazomenoi/apasxoliseisPolicyPreviewApplyOrchestrationService.test.js'
    ]);
}

async function run() {
    await testNonFunctionExecutorsAreNotConfigured();
    await testExactArgumentsForwardedWithoutMutation();
    await testRecognizedBlockedCodesRemainBlocked();
    await testOnlyExecutedStatusCompletes();
    await testInvalidResolvedResultsFailWithoutRetry();
    await testPrimitiveThrownValuesPreserveSafeMessage();
    await testNonEnumerableObjectMessageIsPreserved();
    await testSensitiveFailureMessageIsRedactedEverywhere();
    await testAuthorizationSchemesAreFullyRedacted();
    await testNestedWritePayloadsAreFullyRedacted();
    await testSymbolArrayThrowReturnsGenericFailure();
    await testRevokedErrorProxyReturnsGenericFailure();
    await testRevokedAuditContextProxyIsIgnored();
    await testRevokedExecutionResultProxyFailsWithoutRetry();
    await testThrowingErrorGettersReturnGenericFailure();
    await testPartialMongoBulkErrorCountsAreNormalizedWithoutMutation();
    testCountNormalizationAcceptsOnlyNonNegativeIntegers();
    await testOperationCountDescribesOnlyValidPreviewArray();
    await testAuditContextUsesAllowlistRedactionAndSafeDescriptors();
    testStructuralIsolationAndSingleBulkWriteLocation();
    testNoRuntimeCaller();
    console.log('apasxoliseis policy preview apply orchestration service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
