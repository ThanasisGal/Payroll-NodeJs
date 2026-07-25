const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'userPrivilegesManagement.js'), 'utf8');
let readyHandler;
const sandbox = {
    window: { setInterval() { return 1; }, clearInterval() {}, setTimeout() {}, Swal: { async fire() {} } },
    document: { addEventListener(name, handler) { if (name === 'DOMContentLoaded') readyHandler = handler; } },
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URL,
    encodeURIComponent
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'userPrivilegesManagement.js' });

const api = sandbox.window.UserPrivilegesManagement.test;
assert.strictEqual(api.getFormDisplayLabel({ form: 'Companies', formLabel: 'Γενικά Στοιχεία' }), 'Γενικά Στοιχεία');
assert.strictEqual(api.getFormDisplayLabel({ form: 'FutureForm' }), 'Μη έγκυρη ρύθμιση φόρμας');
assert.strictEqual(api.canStartSave({ saving: false, loading: false, loaded: true, userId: 'user-1' }), true);
assert.strictEqual(api.canStartSave({ saving: true, loading: false, loaded: true, userId: 'user-1' }), false);
assert.strictEqual(api.canStartSave({ saving: false, loading: true, loaded: true, userId: 'user-1' }), false);
assert.strictEqual(api.canStartSave({ saving: false, loading: false, loaded: false, userId: 'user-1' }), false);
const enabled = [{ checked: false }, { checked: true }];
const disabled = { checked: false, disabled: true };
const root = { querySelectorAll(selector) { assert.strictEqual(selector, 'input[type="checkbox"]:not(:disabled)'); return enabled; } };

assert.strictEqual(api.toggleAllActive(root), true);
assert.deepStrictEqual(enabled.map((box) => box.checked), [true, true]);
assert.strictEqual(disabled.checked, false);
assert.strictEqual(api.toggleAllActive(root), false);
assert.deepStrictEqual(enabled.map((box) => box.checked), [false, false]);

enabled[0].checked = true;
assert.strictEqual(api.getActiveCheckboxes(root).every((box) => box.checked), false);
enabled[1].checked = true;
assert.strictEqual(api.getActiveCheckboxes(root).every((box) => box.checked), true);
const readBoxes = [{ checked: false }, { checked: true }];
const columnRoot = {
    querySelectorAll(selector) {
        assert.strictEqual(selector, 'input[type="checkbox"][data-key="read"]:not(:disabled)');
        return readBoxes;
    }
};
assert.strictEqual(api.toggleColumn(columnRoot, 'read'), true);
assert.deepStrictEqual(readBoxes.map((box) => box.checked), [true, true]);
assert.strictEqual(api.checkboxState(readBoxes).all, true);
assert.strictEqual(api.checkboxState(readBoxes).partial, false);
assert.strictEqual(api.toggleColumn(columnRoot, 'read'), false);
assert.deepStrictEqual(readBoxes.map((box) => box.checked), [false, false]);
readBoxes[0].checked = true;
assert.strictEqual(api.checkboxState(readBoxes).all, false);
assert.strictEqual(api.checkboxState(readBoxes).partial, true);
assert.strictEqual(typeof readyHandler, 'function');

console.log('PASS user privileges frontend DOM contract (submit guard, global/column toggles, manual state, disabled isolation)');
