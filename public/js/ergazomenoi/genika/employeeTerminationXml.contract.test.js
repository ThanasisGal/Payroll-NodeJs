'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const start = source.indexOf('async function runTemporaryTerminationXmlAfterEmployeeSave(');
const end = source.indexOf('\n\ndocument.addEventListener', start);
assert.notEqual(start, -1); assert.notEqual(end, -1);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

async function runOrchestration(processCode, maXmlData, uploadResult = { success: true }) {
    const events = []; let uploads = 0; let redirects = 0; let uploadArgs;
    const maResult = await sandbox.runTemporaryTerminationXmlAfterEmployeeSave({
        employeeSaveSucceeded: true, employeeId: 'employee-1', maXmlData, processCode,
        upload: async (...args) => { uploads += 1; uploadArgs = args; events.push('upload'); return uploadResult; },
        present: async result => { events.push(`present:${result.success}`); }
    });
    const redirectAllowed = sandbox.finishEmployeeUpdateAfterUploads(
        { e3Result: { success: true }, maResult, wtoResult: { success: true } },
        () => { redirects += 1; events.push('redirect'); });
    return { events, uploads, redirects, uploadArgs, maResult, redirectAllowed };
}

for (const processCode of ['217', '222']) test(
    `${processCode} generation success uploads once, presents result, then allows redirect`, async () => {
        const result = await runOrchestration(processCode,
            { success: true, relativePath: `uploads/${processCode}.xml` });
        assert.equal(result.uploads, 1);
        assert.deepEqual(result.uploadArgs, ['employee-1', `uploads/${processCode}.xml`, false, processCode, 'xml']);
        assert.deepEqual(result.events, ['upload', 'present:true', 'redirect']);
        assert.equal(result.redirects, 1); assert.equal(result.redirectAllowed, true);
    });

test('missing maXmlData is fail-closed without upload or redirect', async () => {
    const result = await runOrchestration('217', null);
    assert.equal(result.uploads, 0); assert.equal(result.redirects, 0);
    assert.deepEqual(result.events, ['present:false']);
});

for (const processCode of ['217', '222']) test(
    `${processCode} generation failure presents its error without upload or redirect`, async () => {
        const result = await runOrchestration(processCode, { success: false, error: `generator-${processCode}` });
        assert.equal(result.uploads, 0); assert.equal(result.redirects, 0);
        assert.equal(result.maResult.error, `generator-${processCode}`);
        assert.deepEqual(result.events, ['present:false']);
    });

for (const processCode of ['217', '222']) test(
    `${processCode} missing XML reference is fail-closed`, async () => {
        const result = await runOrchestration(processCode, { success: true });
        assert.equal(result.uploads, 0); assert.equal(result.redirects, 0);
        assert.deepEqual(result.events, ['present:false']);
    });

test('temporary termination XML upload failure prevents redirect', async () => {
    const result = await runOrchestration('217', { success: true, s3Key: 'termination.xml' },
        { success: false, error: 'upload failed' });
    assert.equal(result.uploads, 1); assert.equal(result.redirects, 0);
    assert.deepEqual(result.events, ['upload', 'present:false']);
});

test('failed employee save never invokes the temporary XML uploader', async () => {
    let uploads = 0;
    const result = await sandbox.runTemporaryTerminationXmlAfterEmployeeSave({
        employeeSaveSucceeded: false, employeeId: 'employee-1',
        maXmlData: { success: true, s3Key: 'termination.xml' }, processCode: '222',
        upload: async () => { uploads += 1; }, present: async () => {} });
    assert.equal(uploads, 0); assert.equal(result.skipped, true);
});

test('real edit orchestration routes requested 217/222 XML through fail-closed result', () => {
    assert.match(source, /temporaryTerminationXmlRequested[\s\S]*runTemporaryTerminationXmlAfterEmployeeSave/);
    assert.match(source, /!temporaryTerminationXmlRequested[\s\S]*uploadMaToErganh/);
    assert.match(source, /finishEmployeeUpdateAfterUploads\(uploadResults/);
});
