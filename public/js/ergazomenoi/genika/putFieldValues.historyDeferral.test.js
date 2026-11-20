'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/putFieldValues.js', 'utf8');
const helpers = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.style = {}; }
    set textContent(value) { this.text = value; }
    get textContent() { return [this.text || '', ...this.children.map(child => child.textContent)].join('\n'); }
    set innerHTML(value) { throw Error('Untrusted markup must never be interpolated'); }
    append(element) { this.children.push(element); }
}
const doc = { createElement: tag => new Element(tag) };
const payload = { saveMode: 'final', historyPreflight: true, formData: { email: 'retained@example.invalid', salary: 1400 },
    filesToUpdate: { create_contract: true, ma_217: true, isPermanent: true, erganiUploadMethod: 'rest' } };
const missing = { preflight: true, success: true, status: 'MISSING_REQUIRED_HISTORY_FIELDS',
    decision: 'DEFER_HISTORY', historyConfirmation: 'server-signed-confirmation',
    missingFields: [{ field: 'krathsh_01', label: 'ΚΠΚ <img src=x onerror="alert(1)">', group: 'Ασφάλιση', reason: 'Λείπει η τιμή.' }] };
const reply = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function context() { const ctx = vm.createContext({}); vm.runInContext(helpers, ctx); return ctx; }
test('Return shows exact Greek choices, lists safe text and sends no save request', async () => {
    const ctx = context(); let prompts = 0, retries = 0;
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(missing), originalPayload: payload,
        documentRef: doc, swal: { fire: async options => {
            prompts++; assert.equal(options.confirmButtonText, 'Συνέχεια'); assert.equal(options.cancelButtonText, 'Επιστροφή για διόρθωση');
            assert.match(options.html.textContent, /Η Συνέχεια αποθηκεύει τον Εργαζόμενο και τις επιλεγμένες ενέργειες, αλλά ΔΕΝ ενημερώνει το Ιστορικό/);
            assert.match(options.html.textContent, /ΚΠΚ <img/); assert.equal(options.html.children[1].children[0].children.length, 0);
            return { isConfirmed: false };
        } }, retryRequest: async () => { retries++; } });
    assert.equal(result.cancelled, true); assert.equal(prompts, 1); assert.equal(retries, 0);
    assert.equal(payload.formData.email, 'retained@example.invalid');
});
test('Continue resubmits the identical selected document/ERGANI intent with explicit server confirmation', async () => {
    const ctx = context(); let retries = 0;
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(missing), originalPayload: payload,
        documentRef: doc, swal: { fire: async () => ({ isConfirmed: true }) }, retryRequest: async approved => {
            retries++; assert.equal(approved.historyDecision, 'DEFER_HISTORY'); assert.equal(approved.historyPreflight, false);
            assert.equal(approved.historyConfirmation, missing.historyConfirmation);
            assert.deepEqual(approved.filesToUpdate, payload.filesToUpdate); assert.deepEqual(approved.formData, payload.formData);
            return reply({ success: true });
        } });
    assert.equal(retries, 1); assert.equal((await result.response.json()).success, true);
});
test('unsafe preflight never offers Continue or sends a second request', async () => {
    const ctx = context(); let retries = 0;
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply({ preflight: true, success: false,
        status: 'UNSAFE_HISTORY_CHANGE', message: 'Σύγκρουση περιόδων. Δεν αποθηκεύτηκε καμία αλλαγή.' }), originalPayload: payload,
        documentRef: doc, swal: { fire: async options => {
            assert.equal(options.confirmButtonText, 'Επιστροφή για διόρθωση'); assert.equal(options.showCancelButton, undefined);
        } }, retryRequest: async () => { retries++; } });
    assert.equal(result.cancelled, true); assert.equal(retries, 0);
});
test('only the complete committed deferral envelope allows the READ_ONLY continuation', () => {
    const ctx = context(), valid = { success: true, employeeUpdated: true, historyUpdated: false,
        historyDeferred: true, historyStatus: 'PENDING_EMPLOYEE_RECONCILIATION', externalActionsAllowed: true,
        idempotencyKey: 'server-owned-identity-one', historyAccessMode: 'READ_ONLY' };
    assert.equal(ctx.isCommittedEmployeeHistoryDeferral(valid), true);
    for (const [key,value] of Object.entries(valid).filter(([key]) => key !== 'historyAccessMode')) {
        assert.equal(ctx.isCommittedEmployeeHistoryDeferral({ ...valid, [key]: undefined }), false, key);
        assert.equal(ctx.isCommittedEmployeeHistoryDeferral({ ...valid, [key]: typeof value === 'boolean' ? !value : '' }), false, key);
    }
    assert.match(source, /historyAccessMode === 'READ_ONLY' &&\s*!isCommittedEmployeeHistoryDeferral\(data\)/);
});
test('ready preflight uses combined save without prompting or changing selected actions', async () => {
    const ctx = context(); let count = 0;
    await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply({ preflight: true, success: true,
        status: 'READY_FOR_COMBINED_SAVE', decision: 'COMBINED_SAVE', historyConfirmation: 'server-owned' }),
        originalPayload: payload, documentRef: doc, swal: { fire: () => assert.fail('Ready must not offer a deferral') },
        retryRequest: async approved => { count++; assert.equal(approved.historyDecision, 'COMBINED_SAVE');
            assert.deepEqual(approved.filesToUpdate, payload.filesToUpdate); return reply({ success: true }); } });
    assert.equal(count, 1);
});
