'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const packageJson = require(path.join(repositoryRoot, 'package.json'));
const packageLock = require(path.join(repositoryRoot, 'package-lock.json'));
const source = fs.readFileSync(path.join(__dirname, 's3Helper.js'), 'utf8');

assert.strictEqual(packageJson.dependencies['fast-glob'], undefined);
assert.strictEqual(packageJson.devDependencies['fast-glob'], '^3.3.3');
assert.strictEqual(packageLock.packages[''].dependencies['fast-glob'], undefined);
assert.strictEqual(packageLock.packages[''].devDependencies['fast-glob'], '^3.3.3');
assert.strictEqual(packageLock.packages['node_modules/fast-glob'].dev, true);
assert.strictEqual(packageLock.packages['node_modules/braces'].dev, true);
assert.doesNotThrow(() => require.resolve('fast-glob'));

const fastGlobRequires = source.match(/require\('fast-glob'\)/g) || [];
assert.strictEqual(fastGlobRequires.length, 2);
assert.doesNotMatch(source.slice(0, source.indexOf('async function deleteXmlFilesForEmployee')),
    /require\('fast-glob'\)/);

function assertLocalGlobAndProductionS3(functionName, nextMarker) {
    const start = source.indexOf(`async function ${functionName}`);
    const end = source.indexOf(nextMarker, start);
    const functionSource = source.slice(start, end);
    const localBranch = functionSource.indexOf('if (USE_LOCAL_STORAGE)');
    const fastGlob = functionSource.indexOf("require('fast-glob')");
    const productionBranch = functionSource.indexOf('PRODUCTION: List & delete from S3');
    assert.ok(start >= 0 && end > start);
    assert.ok(localBranch >= 0 && fastGlob > localBranch && productionBranch > fastGlob);
    assert.doesNotMatch(functionSource.slice(productionBranch), /require\('fast-glob'\)/);
    assert.match(functionSource.slice(productionBranch), /ListObjectsV2Command/);
    assert.match(functionSource.slice(productionBranch), /deleteFileFromS3/);
}

assertLocalGlobAndProductionS3(
    'deleteXmlFilesForEmployee',
    'async function deleteContractsForEmployee'
);
assertLocalGlobAndProductionS3(
    'deleteContractsForEmployee',
    'async function uploadOrariaXlsx'
);

console.log('PASS s3Helper development-only fast-glob dependency boundary');
