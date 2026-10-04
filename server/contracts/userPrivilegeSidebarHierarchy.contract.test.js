'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    userPrivilegeSidebarHierarchy,
    compareHierarchyEntries
} = require('../constants/userPrivilegeSidebarHierarchy');
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
            const idMatch = token.match(/\bid=["']([^"']+)["']/i);
            stack.push({ label: '', id: idMatch?.[1] || '' });
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
                    sidebarNodeId: stack[stack.length - 1].id,
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

const sidebarSource = fs.readFileSync(
    path.join(__dirname, '../../views/partials/sidebar.ejs'),
    'utf8'
);
const sidebarForms = parseSidebar(sidebarSource);
const visibleCatalog = seedData
    .filter((entry) => entry.active === true && entry.showInPrivileges === true)
    .sort((left, right) => left.sidebarOrder - right.sidebarOrder);
const sortedHierarchy = [...userPrivilegeSidebarHierarchy].sort(compareHierarchyEntries);
const catalogByForm = new Map(visibleCatalog.map((entry) => [entry.form, entry]));
const sidebarFormNames = sidebarForms.map((entry) => entry.form);
const nonNavigationCatalogForms = visibleCatalog
    .map((entry) => entry.form)
    .filter((form) => !sidebarFormNames.includes(form));

assert.strictEqual(sidebarForms.length, 28);
assert.strictEqual(sortedHierarchy.length, 28);
assert.deepStrictEqual(nonNavigationCatalogForms, ['ApologistikosPinakasOrarion']);
assert.ok(catalogByForm.has('ApologistikosPinakasOrarion'));
assert.ok(!sidebarFormNames.includes('ApologistikosPinakasOrarion'));
assert.ok(!sortedHierarchy.some((entry) => entry.form === 'ApologistikosPinakasOrarion'));
assert.ok(sidebarForms.every((entry) => catalogByForm.has(entry.form)));
assert.deepStrictEqual(
    sidebarForms.map((entry) => entry.itemLabel),
    sidebarForms.map((entry) => catalogByForm.get(entry.form).formLabel)
);
assert.deepStrictEqual(sortedHierarchy.map((entry) => entry.form), sidebarFormNames);

sortedHierarchy.forEach((entry, index) => {
    const sidebar = sidebarForms[index];
    assert.strictEqual(entry.itemLabel, sidebar.itemLabel, `${entry.form}: leaf label`);
    assert.strictEqual(entry.sidebarNodeId, sidebar.sidebarNodeId, `${entry.form}: sidebar node id`);
    assert.deepStrictEqual(
        entry.ancestors.map(({ label }) => label),
        sidebar.ancestorLabels,
        `${entry.form}: hierarchy path`
    );
});

assert.ok(sortedHierarchy.every((entry) => /^li[0-9]+$/.test(entry.sidebarNodeId)));
assert.strictEqual(new Set(sortedHierarchy.map((entry) => entry.sidebarNodeId)).size, sidebarForms.length);
assert.ok(visibleCatalog.every((entry) => entry.sidebarOrder >= 1000));

const employmentReviewIndex = sidebarFormNames.indexOf('ElegxosApasxolhseonPeriodoy');
assert.strictEqual(
    sidebarFormNames[employmentReviewIndex + 1],
    'KatastashElegxouApologistikouPinaka'
);
assert.strictEqual(
    sidebarFormNames[employmentReviewIndex + 2],
    'EktyposhOristikouApologistikouPinaka'
);
for (const form of ['ApologistikosPinakasYperorion', 'YpobolhAdeion']) {
    assert.deepStrictEqual(
        sortedHierarchy.find((entry) => entry.form === form).ancestors.map(({ label }) => label),
        ['Αρχεία', 'ΕΡΓΑΝΗ ΙΙ', 'Αποστολή Αρχείων']
    );
}

const hiddenCatalog = seedData.filter((entry) => entry.showInPrivileges === false);
assert.ok(hiddenCatalog.every((entry) => !userPrivilegeSidebarHierarchy.some((item) => item.form === entry.form)));
assert.ok(!userPrivilegeSidebarHierarchy.some((entry) =>
    ['Μικτές από Καθαρές Αποδοχές', 'Ετήσιες Μονάδες Εργασίας (EME)']
        .includes(entry.itemLabel)));
assert.deepStrictEqual(userPrivilegeSidebarHierarchy.find((entry) => entry.form === 'YpobolhAdeion'), {
    form: 'YpobolhAdeion', sidebarNodeId: 'li2373', itemLabel: 'Υποβολή Αδειών', itemOrder: 400,
    ancestors: [
        { key: 'files', label: 'Αρχεία', order: 100 },
        { key: 'ergani-ii', label: 'ΕΡΓΑΝΗ ΙΙ', order: 300 },
        { key: 'file-submissions', label: 'Αποστολή Αρχείων', order: 600 }
    ]
});

console.log(`PASS sidebar/catalog/hierarchy contract (${sidebarForms.length} visible forms, exact labels/nesting/order)`);
