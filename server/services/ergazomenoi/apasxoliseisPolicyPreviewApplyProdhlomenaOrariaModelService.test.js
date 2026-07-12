const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    APPLY_EXECUTION_CONFIRMATION_TOKEN
} = require('./apasxoliseisPolicyPreviewApplyExecutionService');
const {
    executeWriteModelsWithProdhlomenaOrariaModel
} = require('./apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService');

function writeModelsPreview(writeModels = [{ fakeWriteModel: true }]) {
    return { write_models: writeModels };
}

function assertBlockedWithoutWrites(result, blockedCode) {
    assert.strictEqual(result.execution_guard.blocked_code, blockedCode);
    assert.strictEqual(result.execution_summary.writes_performed, 0);
}

function testAdapterStructure() {
    const servicePath = require.resolve(
        './apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService'
    );
    const source = fs.readFileSync(servicePath, 'utf8');

    assert.match(
        source,
        /const \{ ProdhlomenaOrariaModel \} = require\('\.\.\/\.\.\/models\/ergazomenoi'\);/
    );
    assert.match(source, /executeWriteModelsWithInjectedModel/);
    assert.match(source, /apasxoliseisPolicyPreviewApplyModelWriterService/);
    assert.doesNotMatch(source, /ApasxoliseisPolicyPreviewApprovalsModel/);
    assert.doesNotMatch(source, /controllers?|routes?/i);
    assert.doesNotMatch(source, /\.bulkWrite\s*\(/);
    assert.doesNotMatch(
        source,
        /function executeWriteModelsWithProdhlomenaOrariaModel\([^)]*model/
    );
}

async function testDefaultExecutionRemainsLocked() {
    const result = await executeWriteModelsWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: writeModelsPreview()
    });

    assertBlockedWithoutWrites(result, 'LOCKED');
}

async function testMissingAndWrongConfirmationRemainBlocked() {
    for (const options of [
        { execution_enabled: true },
        { execution_enabled: true, confirmation_token: 'WRONG_TOKEN' }
    ]) {
        const result = await executeWriteModelsWithProdhlomenaOrariaModel({
            mongoWriteModelsPreview: writeModelsPreview(),
            options
        });

        assertBlockedWithoutWrites(result, 'CONFIRMATION_REQUIRED');
    }
}

async function testEmptyWriteModelsRemainNoop() {
    const result = await executeWriteModelsWithProdhlomenaOrariaModel({
        mongoWriteModelsPreview: writeModelsPreview([]),
        options: {
            execution_enabled: true,
            confirmation_token: APPLY_EXECUTION_CONFIRMATION_TOKEN
        }
    });

    assertBlockedWithoutWrites(result, 'NO_WRITE_MODELS');
}

function testSinglePhysicalBulkWriteLocation() {
    const serviceDirectory = __dirname;
    const applyServiceFiles = fs.readdirSync(serviceDirectory)
        .filter((file) => /^apasxoliseisPolicyPreviewApply.*Service\.js$/.test(file));
    const bulkWriteCallFiles = applyServiceFiles.filter((file) => {
        const source = fs.readFileSync(path.join(serviceDirectory, file), 'utf8');
        return /\.bulkWrite\s*\(/.test(source);
    });

    assert.deepStrictEqual(bulkWriteCallFiles, [
        'apasxoliseisPolicyPreviewApplyModelWriterService.js'
    ]);
}

function testAdapterHasNoRuntimeCaller() {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const runtimeDirectories = ['server/controllers', 'server/routes', 'public', 'views'];
    const adapterModuleName =
        'apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService';
    const references = [];

    runtimeDirectories.forEach((relativeDirectory) => {
        const directory = path.join(repositoryRoot, relativeDirectory);
        if (!fs.existsSync(directory)) return;

        const pending = [directory];
        while (pending.length > 0) {
            const current = pending.pop();
            fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
                const entryPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    pending.push(entryPath);
                } else if (fs.readFileSync(entryPath, 'utf8').includes(adapterModuleName)) {
                    references.push(path.relative(repositoryRoot, entryPath));
                }
            });
        }
    });

    assert.deepStrictEqual(references, []);
}

async function run() {
    testAdapterStructure();
    await testDefaultExecutionRemainsLocked();
    await testMissingAndWrongConfirmationRemainBlocked();
    await testEmptyWriteModelsRemainNoop();
    testSinglePhysicalBulkWriteLocation();
    testAdapterHasNoRuntimeCaller();
    console.log('apasxoliseis policy preview ProdhlomenaOraria model adapter tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
