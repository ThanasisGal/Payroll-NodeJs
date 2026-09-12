'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.notEqual(start, -1);
    const end = source.indexOf('\n}\n\ndocument.addEventListener', start);
    assert.notEqual(end, -1);
    return source.slice(start, end + 2);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extractFunction('runTemporaryTerminationXmlAfterEmployeeSave'), sandbox);

test('successful employee save uploads temporary termination XML once and presents success', async () => {
    const calls = [];
    const presentations = [];
    const result = await sandbox.runTemporaryTerminationXmlAfterEmployeeSave({
        employeeSaveSucceeded: true,
        employeeId: 'employee-1',
        xmlReference: 'uploads/e7n.xml',
        processCode: '222',
        upload: async (...args) => {
            calls.push(args);
            return { success: true, message: 'ok' };
        },
        present: async value => presentations.push(value)
    });
    assert.deepEqual(calls, [['employee-1', 'uploads/e7n.xml', false, '222', 'xml']]);
    assert.equal(result.success, true);
    assert.deepEqual(presentations, [{ success: true, message: 'ok' }]);
});

test('failed employee save never invokes the temporary XML uploader', async () => {
    let uploads = 0;
    const result = await sandbox.runTemporaryTerminationXmlAfterEmployeeSave({
        employeeSaveSucceeded: false,
        employeeId: 'employee-1',
        xmlReference: 'uploads/e7n.xml',
        processCode: '222',
        upload: async () => { uploads += 1; },
        present: async () => {}
    });
    assert.equal(uploads, 0);
    assert.equal(result.skipped, true);
});

test('edit flow uses the termination XML contract only after a successful local save', () => {
    assert.match(source, /employeeSaveSucceeded: data\?\.success === true/);
    assert.match(source, /processCode,[\s\S]*upload: uploadMaToErganh/);
});
