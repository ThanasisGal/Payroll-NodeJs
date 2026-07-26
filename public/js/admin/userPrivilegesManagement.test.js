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
assert.strictEqual(api.getFormDisplayLabel({
    form: 'Companies',
    formLabel: 'Παλιό label',
    navigation: { itemLabel: 'Γενικά Στοιχεία' }
}), 'Γενικά Στοιχεία');
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

function row(form, label, itemOrder, ancestors, id = null) {
    return {
        id,
        form,
        applicableKeys: ['read'],
        privileges: { read: true },
        navigation: { itemLabel: label, itemOrder, ancestors }
    };
}

const files = { key: 'files', label: 'Αρχεία', order: 0 };
const companies = { key: 'companies', label: 'Εταιρείες', order: 0 };
const submissions = { key: 'submissions', label: 'Αποστολή Αρχείων', order: 2 };
const unordered = [
    row('Second', 'Δεύτερη', 3, [files, companies]),
    row('Nested', 'Ένθετη', 0, [files, companies, submissions]),
    row('First', 'Πρώτη', 0, [files, companies], null)
];
const tree = api.buildPrivilegeNavigationTree(unordered);
assert.strictEqual(tree[0].label, 'Αρχεία');
assert.strictEqual(tree[0].children[0].label, 'Εταιρείες');
assert.strictEqual(
    JSON.stringify(tree[0].children[0].children.map((node) => node.type === 'form' ? node.form : node.label)),
    JSON.stringify(['First', 'Αποστολή Αρχείων', 'Second'])
);
assert.strictEqual(tree[0].children[0].children[1].children[0].form, 'Nested');
assert.strictEqual(api.hierarchyPathKey('files/companies', 'submissions'), 'files/companies/submissions');
assert.strictEqual(api.isDescendantPath('files/companies/submissions', 'files'), true);
assert.strictEqual(api.isDescendantPath('reports', 'files'), false);
assert.strictEqual(
    JSON.stringify(Array.from(api.collectHierarchyPaths(tree)).sort()),
    JSON.stringify(['files', 'files/companies', 'files/companies/submissions'])
);

const collapsed = new Set();
assert.strictEqual(api.toggleHierarchyPath(collapsed, 'files'), false);
assert.strictEqual(collapsed.has('files'), true);
assert.strictEqual(api.toggleHierarchyPath(collapsed, 'files'), true);
assert.strictEqual(collapsed.size, 0);

class MockNode {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.className = '';
        this.hidden = false;
        this.style = { values: {}, setProperty: (key, value) => { this.style.values[key] = value; } };
        this.classList = { toggle() {} };
    }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    get lastChild() { return this.children[this.children.length - 1]; }
}
const documentRef = { createElement: (tagName) => new MockNode(tagName) };
const header = api.renderHierarchyHeaderRow(tree[0], ['read', 'update'], new Set(), documentRef);
assert.strictEqual(header.children[0].colSpan, 3);
assert.strictEqual(header.children[0].children[0].tagName, 'BUTTON');
assert.strictEqual(header.children[0].children[0].getAttribute('aria-expanded'), 'true');
assert.strictEqual(header.children[0].children[0].children.some((child) => child.tagName === 'INPUT'), false);
const formRow = api.renderPrivilegeFormRow(unordered[2], ['read'], 2, documentRef);
assert.strictEqual(formRow.dataset.privilegeFormRow, 'true');
assert.strictEqual(formRow.dataset.rowId, '');
assert.strictEqual(formRow.children[0].scope, 'row');
assert.strictEqual(formRow.children[0].textContent, 'Πρώτη');
assert.strictEqual(formRow.children[1].children[0].tagName, 'INPUT');
const submitted = api.collectPrivilegeRows({
    querySelectorAll(selector) {
        assert.strictEqual(selector, 'tr[data-privilege-form-row="true"]');
        return [{
            dataset: { rowId: '', form: 'First' },
            querySelectorAll(inputSelector) {
                assert.strictEqual(inputSelector, 'input[data-key]:not(:disabled)');
                return [{ dataset: { key: 'read' }, checked: true }];
            }
        }];
    }
});
assert.strictEqual(submitted.length, 1);
assert.strictEqual(submitted[0].id, null);
assert.strictEqual(submitted[0].form, 'First');
assert.strictEqual(submitted[0].privileges.read, true);

assert.throws(() => api.validateNavigationMetadata({ form: 'Bad', navigation: {} }));
assert.ok(source.includes("querySelectorAll('tr[data-privilege-form-row=\"true\"]')"));
assert.ok(!/\binnerHTML\b|insertAdjacentHTML|\beval\s*\(|new Function/.test(source));

console.log('PASS user privileges frontend hierarchy/tree/DOM/toggle/save-selector contracts');
