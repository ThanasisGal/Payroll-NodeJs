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
            assert.match(options.html.textContent, /Η «Συνέχεια» οδηγεί στην τελική έγκριση.*χωρίς ενημέρωση του Ιστορικού/);
            assert.match(options.html.textContent, /ΚΠΚ <img/); assert.equal(options.html.children[1].children[0].children.length, 0);
            return { isConfirmed: false };
        } }, retryRequest: async () => { retries++; } });
    assert.equal(result.cancelled, true); assert.equal(prompts, 1); assert.equal(retries, 0);
    assert.equal(payload.formData.email, 'retained@example.invalid');
});
test('Continue resubmits the identical selected document/ERGANI intent with explicit server confirmation', async () => {
    const ctx = context(); let retries = 0, prompts = 0;
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(missing), originalPayload: payload,
        documentRef: doc, swal: { fire: async options => {
            assert.equal(retries, 0);
            assert.equal(options.confirmButtonText, ++prompts === 1 ? 'Συνέχεια' : 'Έγκριση και αποθήκευση');
            return { isConfirmed: true };
        } }, retryRequest: async approved => {
            retries++; assert.equal(approved.historyDecision, 'DEFER_HISTORY'); assert.equal(approved.historyPreflight, false);
            assert.equal(approved.historyConfirmation, missing.historyConfirmation);
            assert.deepEqual(approved.filesToUpdate, payload.filesToUpdate); assert.deepEqual(approved.formData, payload.formData);
            return reply({ success: true });
        } });
    assert.equal(prompts, 2); assert.equal(retries, 1); assert.equal((await result.response.json()).success, true);
});
for (const decision of ['DEFER_HISTORY', 'DEFER_LEGACY'])
    test(`Continue then cancel final approval (${decision}): zero writes`, async () => {
        const ctx = context(); let retries = 0, prompts = 0;
        const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply({ ...missing, decision }),
            originalPayload: payload, documentRef: doc,
            swal: { fire: async options => {
                prompts++;
                assert.equal(options.confirmButtonText, prompts === 1 ? 'Συνέχεια' : 'Έγκριση και αποθήκευση');
                if (prompts === 2) assert.match(options.text, /Το Ιστορικό θα παραμείνει αμετάβλητο/);
                return { isConfirmed: prompts === 1 };
            } }, retryRequest: async () => { retries++; } });
        assert.equal(result.cancelled, true);
        assert.equal(prompts, 2);
        assert.equal(retries, 0);
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
for (const url of [
    '/api/ergazomenoi/650000000000000000000031/history-proposal-editor?selection=UPDATE:650000000000000000000004',
    'https://example.invalid/history-proposal-editor', 'javascript:alert(1)', '//example.invalid'
]) test('Διορθωτική έκδοση: ασφαλής σύνδεσμος, διατήρηση φόρμας και καμία επανάληψη αποθήκευσης — '+url, async () => {
    const ctx = context(), before = structuredClone(payload); let retries = 0;
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({
        response: reply({preflight:true,success:false,saved:false,status:'HISTORY_CORRECTION_EDITION_REQUIRED',
            correctionEditionUrl:url,message:'Δεν αποθηκεύτηκε καμία αλλαγή.'}),
        originalPayload:payload,documentRef:doc,swal:{fire:async options => {
            const links = options.html.children.filter(node => node.tag === 'a');
            assert.equal(links.length,url.startsWith('/api/') ? 1 : 0);
            if (links.length) {
                assert.equal(links[0].href,url); assert.equal(links[0].target,'_blank');
                assert.equal(links[0].rel,'noopener noreferrer');
            }
            assert.equal(options.confirmButtonText,'Επιστροφή για διόρθωση');
            return {isConfirmed:true};
        }},retryRequest:async()=>{retries++;}
    });
    assert.equal(result.cancelled,true); assert.equal(retries,0); assert.deepEqual(payload,before);
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
const ready = { preflight: true, success: true, status: 'READY_FOR_COMBINED_SAVE',
    decision: 'COMBINED_SAVE', historyConfirmation: 'server-owned' };
test('ready preview waits for separate explicit approval before exactly one combined save', { timeout: 2000 }, async () => {
    const ctx = context(); let count = 0, approve, showPreview;
    const shown = new Promise(resolve => { showPreview = resolve; });
    const result = ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(ready),
        originalPayload: payload, documentRef: doc, swal: { fire: options => {
            assert.equal(options.confirmButtonText, 'Έγκριση και αποθήκευση');
            assert.equal(options.cancelButtonText, 'Ακύρωση');
            assert.equal(options.focusCancel, true);
            assert.equal(options.allowOutsideClick, false);
            assert.equal(options.allowEscapeKey, false);
            assert.match(options.text, /Δεν αποθηκεύτηκε καμία αλλαγή/);
            showPreview();
            return new Promise(resolve => { approve = resolve; });
        } }, retryRequest: async approved => {
            count++;
            assert.equal(approved.historyPreflight, false);
            assert.equal(approved.historyDecision, 'COMBINED_SAVE');
            assert.equal(approved.historyConfirmation, ready.historyConfirmation);
            assert.deepEqual(approved.filesToUpdate, payload.filesToUpdate);
            assert.deepEqual(approved.formData, payload.formData);
            return reply({ success: true });
        } });
    await shown;
    assert.equal(count, 0, 'η προβολή της προεπισκόπησης δεν αποθηκεύει');
    approve({ isConfirmed: true });
    assert.equal((await (await result).response.json()).success, true);
    assert.equal(count, 1);
    assert.equal(payload.historyPreflight, true);
    assert.equal(payload.historyConfirmation, undefined);
});
for (const decision of ['cancel', 'close', 'backdrop', 'esc'])
    test(`ready preview dismissed (${decision}): zero save requests`, async () => {
        const ctx = context(); let retries = 0;
        const result = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(ready),
            originalPayload: payload, documentRef: doc,
            swal: { fire: async () => ({ isConfirmed: false, isDismissed: true, dismiss: decision }) },
            retryRequest: async () => { retries++; return reply({ success: true }); } });
        assert.equal(result.cancelled, true);
        assert.equal(retries, 0);
    });


test('PR406: unsafe historical preflight lists exact missing fields but never grants Continue', async () => {
    const ctx = context(); let retries = 0;
    const response = reply({ preflight: true, success: false,
        status: 'UNSAFE_HISTORY_CHANGE', missingFields: [
            { field: 'krathsh_01', group: 'Ασφάλιση', label: 'ΚΠΚ <img onerror=bad>',
              reason: 'Δεν έχει καταγραφεί.', periodFrom: '2026-04-01' } ],
        message: 'Βρέθηκαν ελλιπή ιστορικά στοιχεία.' });
    const outcome = await ctx.continueEmployeeSaveWithHistoryDecision({ response,
        originalPayload: payload, documentRef: doc,
        swal: { fire: async options => {
            assert.equal(options.confirmButtonText, 'Επιστροφή για διόρθωση');
            assert.equal(options.showDenyButton, undefined);
            assert.equal(options.showCancelButton, undefined);
            assert.match(options.html.textContent, /ΚΠΚ <img onerror=bad>/);
            assert.match(options.html.textContent, /2026-04-01/);
            return { isConfirmed: true };
        } }, retryRequest: async () => { retries++; } });
    assert.equal(outcome.cancelled, true); assert.equal(retries, 0);
});

test('PR406: signed safe missing-fields preflight keeps two choices with date context', async () => {
    const ctx = context(); let retries = 0;
    const input = { ...missing, missingFields: [
        { field: 'krathsh_01', group: 'Ασφάλιση', label: 'ΚΠΚ', reason: 'Λείπει.',
          periodFrom: '2026-06-01', periodUntil: '2026-06-30' }] };
    const outcome = await ctx.continueEmployeeSaveWithHistoryDecision({ response: reply(input),
        originalPayload: payload, documentRef: doc,
        swal: { fire: async options => {
            assert.equal(options.confirmButtonText, 'Συνέχεια');
            assert.equal(options.cancelButtonText, 'Επιστροφή για διόρθωση');
            assert.match(options.html.textContent, /περίοδος 2026-06-01 έως 2026-06-30/);
            return { isConfirmed: false };
        } }, retryRequest: async () => { retries++; } });
    assert.equal(outcome.cancelled, true); assert.equal(retries, 0);
});


test('PR406 stage2: signed first legacy change offers two choices and retains ERGANI intent', async () => {
    const ctx = context(); let requests = 0, prompts = 0;
    const preview = { ...missing, decision: 'DEFER_LEGACY',
        historyConfirmation: 'server-owned-signature-legacy',
        missingFields: [{ group: 'Ασφάλιση', field: 'krathsh_01', label: 'ΚΠΚ',
            reason: 'Δεν έχει καταγραφεί.', periodFrom: '2026-03-01' }] };
    const result = await ctx.continueEmployeeSaveWithHistoryDecision({
        response: reply(preview), originalPayload: payload, documentRef: doc,
        swal: { fire: async options => {
            if (++prompts === 2) {
                assert.equal(options.confirmButtonText, 'Έγκριση και αποθήκευση');
                assert.equal(options.cancelButtonText, 'Ακύρωση');
                return { isConfirmed: true };
            }
            assert.equal(options.confirmButtonText, 'Συνέχεια');
            assert.equal(options.cancelButtonText, 'Επιστροφή για διόρθωση');
            assert.match(options.html.textContent, /δεν επιτρέπεται δεύτερη ιστορική μεταβολή/);
            assert.match(options.html.textContent, /ΚΠΚ/);
            return { isConfirmed: true };
        } }, retryRequest: async approved => {
            requests++;
            assert.equal(approved.historyDecision, 'DEFER_LEGACY');
            assert.equal(approved.historyPreflight, false);
            assert.equal(approved.historyConfirmation, preview.historyConfirmation);
            assert.deepEqual(approved.filesToUpdate, payload.filesToUpdate);
            return reply({ success: true });
        } });
    assert.equal(requests, 1);
    assert.equal(prompts, 2);
    assert.equal((await result.response.json()).success, true);
});
