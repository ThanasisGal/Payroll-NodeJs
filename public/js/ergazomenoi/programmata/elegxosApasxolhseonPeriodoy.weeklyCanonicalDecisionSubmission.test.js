'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const document = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener: () => {},
    createElement: () => ({ addEventListener: () => {}, appendChild: () => {},
        classList: { add: () => {}, toggle: () => {} }, dataset: {}, style: {},
        setAttribute: () => {} }),
    head: { appendChild: () => {} }, body: { appendChild: () => {} }
};
const sandbox = { console, document, window: {}, URLSearchParams,
    fetch: async () => { throw new Error('Unexpected fetch'); },
    setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });
const submit = vm.runInContext('runCanonicalDecisionSubmission', sandbox);

(async () => {
    let postCalls = 0; const loading = []; let successShown = false;
    let result = await submit({
        postDecision: async () => { postCalls++; return { success: true, message: 'stored' }; },
        refreshContext: async () => true,
        onStoredAndRefreshed: () => { successShown = true; },
        setLoading: (value) => loading.push(value)
    });
    assert.equal(result.saved, true); assert.equal(result.refreshed, true);
    assert.equal(postCalls, 1); assert.equal(successShown, true);
    assert.deepEqual(loading, [true, false]);

    postCalls = 0; loading.length = 0; let refreshWarning = false; let postFailed = false;
    result = await submit({
        postDecision: async () => { postCalls++; return { success: true, message: 'stored' }; },
        refreshContext: async () => false,
        onStoredRefreshFailed: () => { refreshWarning = true; },
        onPostFailed: () => { postFailed = true; },
        setLoading: (value) => loading.push(value)
    });
    assert.equal(result.saved, true); assert.equal(result.refreshed, false);
    assert.equal(postCalls, 1); assert.equal(refreshWarning, true); assert.equal(postFailed, false);
    assert.deepEqual(loading, [true, false]);

    postCalls = 0; loading.length = 0; let errorCode = '';
    result = await submit({
        postDecision: async () => { postCalls++; const error = new Error('failed');
            error.code = 'REAL_ERROR'; throw error; },
        refreshContext: async () => { throw new Error('must not refresh'); },
        onPostFailed: (error) => { errorCode = error.code; },
        setLoading: (value) => loading.push(value)
    });
    assert.equal(result.saved, false); assert.equal(postCalls, 1);
    assert.equal(errorCode, 'REAL_ERROR'); assert.deepEqual(loading, [true, false]);

    console.log('weekly canonical decision submission tests passed (16 contracts)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
