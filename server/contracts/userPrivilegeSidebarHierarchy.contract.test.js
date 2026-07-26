'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { userPrivilegeSidebarHierarchy } = require('../constants/userPrivilegeSidebarHierarchy');
const {
    USER_PRIVILEGE_FORM_CATALOG_SEED: seedData
} = require('../seeds/userPrivilegeFormCatalogSeedData');

function normalizeLabel(value) {
    return value.replace(/\s+/g, ' ').trim();
}

function parseSidebar(source) {
    const withoutComments = source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(?!\/?(?:li|a)\b)[^>]*>/gi, '');
    const tokens = withoutComments.match(/<\/?(?:li|a)\b[^>]*>|[^<]+/gi) || [];
    const stack = [];
    const forms = [];
    let anchor = null;

    tokens.forEach((token) => {
        if (/^<li\b/i.test(token)) {
            stack.push({ label: '' });
        } else if (/^<\/li/i.test(token)) {
            stack.pop();
        } else if (/^<a\b/i.test(token)) {
            const match = token.match(/\bdata-privilege-form=["']([^"']+)["']/i);
            anchor = { form: match?.[1] || '', text: '' };
        } else if (/^<\/a/i.test(token)) {
            if (!anchor || !stack.length) {
                anchor = null;
                return;
            }
            const label = normalizeLabel(anchor.text);
            stack[stack.length - 1].label = label;
            if (anchor.form) {
                const allAncestors = stack.slice(0, -1).map((item) => item.label).filter(Boolean);
                const rootIndex = allAncestors.findIndex((item) =>
                    ['Αρχεία', 'Κινήσεις', 'Εκτυπώσεις'].includes(item));
                forms.push({
                    form: anchor.form,
                    itemLabel: label,
                    ancestorLabels: allAncestors.slice(rootIndex)
                });
            }
            anchor = null;
        } else if (anchor) {
            anchor.text += ` ${token.replace(/<%[\s\S]*?%>/g, '')}`;
        }
    });
    return forms;
}

function addOrders(forms) {
    const siblingCounters = new Map();
    const pathOrders = new Map();
    return forms.map((form) => {
        let parentPath = '';
        const ancestors = form.ancestorLabels.map((label) => {
            const pathKey = `${parentPath}\u0000${label}`;
            if (!pathOrders.has(pathKey)) {
                const nextOrder = siblingCounters.get(parentPath) || 0;
                pathOrders.set(pathKey, nextOrder);
                siblingCounters.set(parentPath, nextOrder + 1);
            }
            const order = pathOrders.get(pathKey);
            parentPath = pathKey;
            return { label, order };
        });
        const itemOrder = siblingCounters.get(parentPath) || 0;
        siblingCounters.set(parentPath, itemOrder + 1);
        return { ...form, ancestors, itemOrder };
    });
}

const sidebarSource = fs.readFileSync(
    path.join(__dirname, '../../views/partials/sidebar.ejs'),
    'utf8'
);
const sidebarForms = addOrders(parseSidebar(sidebarSource));
const visibleCatalog = seedData
    .filter((entry) => entry.active === true && entry.showInPrivileges === true)
    .sort((left, right) => left.sidebarOrder - right.sidebarOrder);

assert.strictEqual(sidebarForms.length, 24);
assert.deepStrictEqual(sidebarForms.map((entry) => entry.form), visibleCatalog.map((entry) => entry.form));
assert.deepStrictEqual(sidebarForms.map((entry) => entry.itemLabel), visibleCatalog.map((entry) => entry.formLabel));
assert.deepStrictEqual(userPrivilegeSidebarHierarchy.map((entry) => entry.form), sidebarForms.map((entry) => entry.form));

userPrivilegeSidebarHierarchy.forEach((entry, index) => {
    const sidebar = sidebarForms[index];
    assert.strictEqual(entry.itemLabel, sidebar.itemLabel, `${entry.form}: leaf label`);
    assert.strictEqual(entry.itemOrder, sidebar.itemOrder, `${entry.form}: item order`);
    assert.deepStrictEqual(
        entry.ancestors.map(({ label, order }) => ({ label, order })),
        sidebar.ancestors,
        `${entry.form}: hierarchy path`
    );
});

const hiddenCatalog = seedData.filter((entry) => entry.showInPrivileges === false);
assert.ok(hiddenCatalog.every((entry) => !userPrivilegeSidebarHierarchy.some((item) => item.form === entry.form)));
assert.ok(!userPrivilegeSidebarHierarchy.some((entry) =>
    ['Μικτές από Καθαρές Αποδοχές', 'Ετήσιες Μονάδες Εργασίας (EME)', 'Υποβολή Αδειών']
        .includes(entry.itemLabel)));

console.log(`PASS sidebar/catalog/hierarchy contract (${sidebarForms.length} visible forms, exact labels/nesting/order)`);
