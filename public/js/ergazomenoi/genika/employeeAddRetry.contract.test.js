'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'getFieldValues.js'), 'utf8');
const helperEnd = source.indexOf("document.addEventListener('DOMContentLoaded'");
const createState = vm.runInNewContext(`${source.slice(0, helperEnd)}\ncreateEmployeeAddRetryState`);

test('a failed REST submission retains the first local employee ID for the next Add POST', async () => {
    const state = createState();
    const posts = [];
    const fetch = async (url, options) => {
        assert.equal(url, '/ergazomenoi/ergazomenoi/add');
        posts.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ success: true,
            data: { _id: 'employee-0004', kodikos: '0004' } }) };
    };
    const save = async () => {
        const payload = state.createPayload({ karta_ergasias: true }, { e3_anaggelia_proslhpshs: true }, false);
        const response = await fetch('/ergazomenoi/ergazomenoi/add', {
            method: 'POST', body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok && data.success) state.rememberLocalSave(data);
    };
    await save();
    assert.equal(posts[0].existingEmployeeId, null);
    const erganiRestResult = { success: false, reason: 'MISSING_REQUIRED_ERGANI_FIELD' };
    assert.equal(erganiRestResult.success, false);
    await save();
    assert.equal(posts.length, 2);
    assert.equal(posts[1].existingEmployeeId, 'employee-0004');
    assert(source.includes('employeeAddRetryState.createPayload('));
    assert(source.includes('employeeAddRetryState.rememberLocalSave(data)'));
});
