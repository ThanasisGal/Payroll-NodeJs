const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    APPLY_EXECUTION_CONFIRMATION_TOKEN
} = require('./apasxoliseisPolicyPreviewApplyExecutionService');
const {
    validateInjectedBulkWriterModel,
    executeWriteModelsWithInjectedModel
} = require('./apasxoliseisPolicyPreviewApplyModelWriterService');

function writeModelsPreview(writeModels = [{
    updateOne: {
        filter: { _id: '507f1f77bcf86cd799439012' },
        update: { $set: { repo_apologistika: true } }
    }
}]) {
    return { write_models: writeModels };
}

function unlockedOptions(confirmationToken = APPLY_EXECUTION_CONFIRMATION_TOKEN) {
    return {
        execution_enabled: true,
        confirmation_token: confirmationToken
    };
}

function createFakeModel(result) {
    const bulkWriteResult = arguments.length === 0
        ? { matchedCount: 1, modifiedCount: 1 }
        : result;
    const calls = [];
    return {
        calls,
        model: {
            bulkWrite: async (writeModels, options) => {
                calls.push({ writeModels, options });
                return bulkWriteResult;
            }
        }
    };
}

async function testDefaultOptionsRemainLocked() {
    const fake = createFakeModel();
    const result = await executeWriteModelsWithInjectedModel({
        mongoWriteModelsPreview: writeModelsPreview(),
        model: fake.model
    });

    assert.strictEqual(fake.calls.length, 0);
    assert.strictEqual(result.execution_guard.blocked_code, 'LOCKED');
    assert.strictEqual(result.execution_summary.writes_performed, 0);
}

async function testMissingAndWrongConfirmationRemainLocked() {
    for (const confirmationToken of [undefined, 'WRONG_TOKEN']) {
        const fake = createFakeModel();
        const result = await executeWriteModelsWithInjectedModel({
            mongoWriteModelsPreview: writeModelsPreview(),
            options: {
                execution_enabled: true,
                confirmation_token: confirmationToken
            },
            model: fake.model
        });

        assert.strictEqual(fake.calls.length, 0);
        assert.strictEqual(result.execution_guard.blocked_code, 'CONFIRMATION_REQUIRED');
    }
}

async function testMissingOrInvalidModelIsNotConfigured() {
    for (const model of [undefined, {}, { bulkWrite: true }]) {
        const result = await executeWriteModelsWithInjectedModel({
            mongoWriteModelsPreview: writeModelsPreview(),
            options: unlockedOptions(),
            model
        });

        assert.strictEqual(result.execution_guard.blocked_code, 'WRITER_NOT_CONFIGURED');
        assert.strictEqual(result.execution_summary.writes_performed, 0);
    }

    assert.strictEqual(validateInjectedBulkWriterModel(undefined), false);
    assert.strictEqual(validateInjectedBulkWriterModel({}), false);
}

async function testFakeModelReceivesExactWriteModelsAndUnorderedOption() {
    const fake = createFakeModel({ matchedCount: 3, modifiedCount: 2 });
    const preview = writeModelsPreview();
    const result = await executeWriteModelsWithInjectedModel({
        mongoWriteModelsPreview: preview,
        options: unlockedOptions(),
        model: fake.model
    });

    assert.strictEqual(fake.calls.length, 1);
    assert.strictEqual(fake.calls[0].writeModels, preview.write_models);
    assert.deepStrictEqual(fake.calls[0].options, { ordered: false });
    assert.strictEqual(result.execution_enabled, true);
    assert.strictEqual(result.execution_status, 'EXECUTED');
    assert.strictEqual(result.execution_summary.matched_count, 3);
    assert.strictEqual(result.execution_summary.modified_count, 2);
    assert.strictEqual(result.execution_summary.writes_performed, 2);
}

async function testNullishBulkWriteResultNormalizesCountsToZero() {
    for (const writerResult of [undefined, null]) {
        const fake = createFakeModel(writerResult);
        const result = await executeWriteModelsWithInjectedModel({
            mongoWriteModelsPreview: writeModelsPreview(),
            options: unlockedOptions(),
            model: fake.model
        });

        assert.strictEqual(result.execution_summary.matched_count, 0);
        assert.strictEqual(result.execution_summary.modified_count, 0);
        assert.strictEqual(result.execution_summary.writes_performed, 0);
    }
}

async function testEmptyWriteModelsDoNotCallBulkWrite() {
    const fake = createFakeModel();
    const result = await executeWriteModelsWithInjectedModel({
        mongoWriteModelsPreview: writeModelsPreview([]),
        options: unlockedOptions(),
        model: fake.model
    });

    assert.strictEqual(fake.calls.length, 0);
    assert.strictEqual(result.execution_guard.blocked_code, 'NO_WRITE_MODELS');
}

function testWriterServiceHasNoRealModelDependencyAndOneBulkWriteCall() {
    const servicePath = require.resolve(
        './apasxoliseisPolicyPreviewApplyModelWriterService'
    );
    const source = fs.readFileSync(servicePath, 'utf8');

    assert.doesNotMatch(source, /ProdhlomenaOrariaModel/);
    assert.doesNotMatch(source, /ApasxoliseisPolicyPreviewApprovalsModel/);
    assert.strictEqual((source.match(/\.bulkWrite\s*\(/g) || []).length, 1);

    const serviceDirectory = path.dirname(servicePath);
    const applyServiceFiles = fs.readdirSync(serviceDirectory)
        .filter((file) => /^apasxoliseisPolicyPreviewApply.*Service\.js$/.test(file));
    const bulkWriteCallFiles = applyServiceFiles.filter((file) => {
        const fileSource = fs.readFileSync(path.join(serviceDirectory, file), 'utf8');
        return /\.bulkWrite\s*\(/.test(fileSource);
    });

    assert.deepStrictEqual(bulkWriteCallFiles, [
        'apasxoliseisPolicyPreviewApplyModelWriterService.js'
    ]);
}

async function run() {
    await testDefaultOptionsRemainLocked();
    await testMissingAndWrongConfirmationRemainLocked();
    await testMissingOrInvalidModelIsNotConfigured();
    await testFakeModelReceivesExactWriteModelsAndUnorderedOption();
    await testNullishBulkWriteResultNormalizesCountsToZero();
    await testEmptyWriteModelsDoNotCallBulkWrite();
    testWriterServiceHasNoRealModelDependencyAndOneBulkWriteCall();
    console.log('apasxoliseis policy preview apply model writer service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
