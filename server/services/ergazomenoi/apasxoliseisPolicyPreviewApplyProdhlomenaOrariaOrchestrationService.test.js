const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    APPLY_EXECUTION_CONFIRMATION_TOKEN
} = require('./apasxoliseisPolicyPreviewApplyExecutionService');
const {
    orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel
} = require('./apasxoliseisPolicyPreviewApplyProdhlomenaOrariaOrchestrationService');

function writeModelsPreview(writeModels = [{ fakeWriteModel: true }]) {
    return { write_models: writeModels };
}

function assertBlockedWithoutWrites(result, blockedCode) {
    assert.strictEqual(result.orchestration_status, 'BLOCKED');
    assert.strictEqual(result.execution_result.execution_guard.blocked_code, blockedCode);
    assert.strictEqual(result.execution_result.execution_summary.writes_performed, 0);
    assert.strictEqual(result.failure, null);
    assert.strictEqual(result.audit_preview.blocked_code, blockedCode);
    assert.strictEqual(result.audit_preview.partial_write_possible, false);
}

async function testDefaultExecutionRemainsLocked() {
    const preview = writeModelsPreview();
    const result = await orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: preview
    });

    assertBlockedWithoutWrites(result, 'LOCKED');
    assert.strictEqual(result.audit_preview.operation_count, preview.write_models.length);
}

async function testMissingAndWrongConfirmationRemainBlocked() {
    for (const options of [
        { execution_enabled: true },
        { execution_enabled: true, confirmation_token: 'WRONG_TOKEN' }
    ]) {
        const result = await orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
            mongoWriteModelsPreview: writeModelsPreview(),
            options
        });

        assertBlockedWithoutWrites(result, 'CONFIRMATION_REQUIRED');
    }
}

async function testEmptyWriteModelsRemainNoop() {
    const result = await orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: writeModelsPreview([]),
        options: {
            execution_enabled: true,
            confirmation_token: APPLY_EXECUTION_CONFIRMATION_TOKEN
        }
    });

    assertBlockedWithoutWrites(result, 'NO_WRITE_MODELS');
    assert.strictEqual(result.audit_preview.operation_count, 0);
}

async function testAuditContextUsesGenericSanitizedPreview() {
    const result = await orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: writeModelsPreview(),
        auditContext: {
            request_id: 'binding-test-request',
            team: 'TEST',
            source: 'isolated-binding-test',
            payload: 'must-not-appear'
        }
    });

    assertBlockedWithoutWrites(result, 'LOCKED');
    assert.deepStrictEqual(result.audit_preview.context, {
        request_id: 'binding-test-request',
        team: 'TEST',
        source: 'isolated-binding-test'
    });
    assert.doesNotMatch(JSON.stringify(result), /must-not-appear/);
}

async function testCallerCannotOverrideExecutorModelOrWriter() {
    let executorCalls = 0;
    let modelCalls = 0;
    let writerCalls = 0;
    const result = await orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: writeModelsPreview(),
        executeWriteModels: async () => {
            executorCalls++;
            return { execution_status: 'EXECUTED' };
        },
        model: {
            bulkWrite: async () => { modelCalls++; }
        },
        writer: async () => { writerCalls++; }
    });

    assert.strictEqual(executorCalls, 0);
    assert.strictEqual(modelCalls, 0);
    assert.strictEqual(writerCalls, 0);
    assertBlockedWithoutWrites(result, 'LOCKED');
}

function testExactCompositionAndNoDuplicatedLogic() {
    const servicePath = require.resolve(
        './apasxoliseisPolicyPreviewApplyProdhlomenaOrariaOrchestrationService'
    );
    const source = fs.readFileSync(servicePath, 'utf8');

    assert.match(source, /apasxoliseisPolicyPreviewApplyOrchestrationService/);
    assert.match(source, /apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService/);
    assert.match(
        source,
        /executeWriteModels:\s*executeWriteModelsWithProdhlomenaOrariaModel/
    );
    assert.doesNotMatch(source, /\.\.\/\.\.\/models\/ergazomenoi/);
    assert.doesNotMatch(source, /require\(['"]mongoose['"]\)/);
    assert.doesNotMatch(source, /ApasxoliseisPolicyPreviewApprovalsModel/);
    assert.doesNotMatch(source, /\.bulkWrite\s*\(/);
    assert.doesNotMatch(source, /require\(['"][^'"]*(controllers?|routes?)/i);
    assert.doesNotMatch(source, /\b(fetch|http|https)\s*\(/i);
    assert.doesNotMatch(source, /\.\.\.|LOCKED|CONFIRMATION_REQUIRED|WRITER_NOT_CONFIGURED/);
    assert.doesNotMatch(source, /NO_WRITE_MODELS|partial_write_possible|sanitize|normalize/i);
    assert.doesNotMatch(source, /\$(set|in|or|gte|lte)\b/i);
}

function testSinglePhysicalBulkWriteLocation() {
    const serviceDirectory = __dirname;
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
    const moduleName =
        'apasxoliseisPolicyPreviewApplyProdhlomenaOrariaOrchestrationService';
    const functionName = 'orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel';
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
                    source.includes(moduleName)
                    || source.includes(functionName)
                ) {
                    references.push(path.relative(repositoryRoot, entryPath));
                }
            }
        });
    }

    assert.deepStrictEqual(references.sort(), [
        'server/services/ergazomenoi/apasxoliseisPolicyPreviewApplyProdhlomenaOrariaOrchestrationService.js',
        'server/services/ergazomenoi/apasxoliseisPolicyPreviewApplyProdhlomenaOrariaOrchestrationService.test.js'
    ]);
}

async function run() {
    await testDefaultExecutionRemainsLocked();
    await testMissingAndWrongConfirmationRemainBlocked();
    await testEmptyWriteModelsRemainNoop();
    await testAuditContextUsesGenericSanitizedPreview();
    await testCallerCannotOverrideExecutorModelOrWriter();
    testExactCompositionAndNoDuplicatedLogic();
    testSinglePhysicalBulkWriteLocation();
    testNoRuntimeCaller();
    console.log(
        'apasxoliseis policy preview ProdhlomenaOraria orchestration binding tests passed'
    );
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
