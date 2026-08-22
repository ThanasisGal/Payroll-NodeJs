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

const approvedSidebarOverrides = new Map([
    ['LhpshOrarionApoErganh', {
        itemLabel: 'ΜΗ Δανειζόμενων Εργαζόμενων'
    }],
    ['LhpshOrarionApoKartes', {
        itemLabel: 'ΜΗ Δανειζόμενων Εργαζόμενων'
    }],
    ['LhpshProdhlomenonOrarionMonoDaneizomenon', {
        itemLabel: 'ΜΟΝΟ Δανειζόμενων Εργαζόμενων'
    }],
    ['LhpshPshfiakonKartonMonoDaneizomenon', {
        itemLabel: 'ΜΟΝΟ Δανειζόμενων Εργαζόμενων'
    }]
]);

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

assert.strictEqual(sidebarForms.length, 27);
assert.strictEqual(visibleCatalog.length, 27);
assert.deepStrictEqual(
    visibleCatalog
        .filter((entry) => [
            'LhpshProdhlomenonOrarionMonoDaneizomenon',
            'LhpshPshfiakonKartonMonoDaneizomenon'
        ].includes(entry.form))
        .map(({ form, sidebarOrder }) => ({ form, sidebarOrder })),
    [
        { form: 'LhpshProdhlomenonOrarionMonoDaneizomenon', sidebarOrder: 9500 },
        { form: 'LhpshPshfiakonKartonMonoDaneizomenon', sidebarOrder: 10500 }
    ]
);
assert.strictEqual(visibleCatalog.find((entry) => entry.form === 'LhpshOrarionApoErganh').sidebarOrder, 9000);
assert.strictEqual(visibleCatalog.find((entry) => entry.form === 'LhpshOrarionApoKartes').sidebarOrder, 10000);
assert.strictEqual(visibleCatalog.find((entry) => entry.form === 'CalcApasxolhseisPeriodoy').sidebarOrder, 11000);
assert.ok(!visibleCatalog.some((entry) => entry.sidebarOrder === 12000));
assert.ok(!visibleCatalog.some((entry) => entry.form === 'CalcApasxolhseisDaneizomenoyProsopikoy'));
assert.deepStrictEqual(
    sortedHierarchy.find((entry) => entry.form === 'YpobolhAdeion'),
    {
        form: 'YpobolhAdeion',
        sidebarNodeId: 'li2373',
        itemLabel: 'Υποβολή Αδειών',
        itemOrder: 300,
        ancestors: [
            { key: 'files', label: 'Αρχεία', order: 100 },
            { key: 'ergani-ii', label: 'ΕΡΓΑΝΗ ΙΙ', order: 300 },
            { key: 'file-submissions', label: 'Αποστολή Αρχείων', order: 600 }
        ]
    }
);
assert.strictEqual(visibleCatalog.find((entry) => entry.form === 'YpobolhAdeion').sidebarOrder, 15500);
assert.deepStrictEqual(sidebarForms.map((entry) => entry.form), visibleCatalog.map((entry) => entry.form));
assert.deepStrictEqual(
    sidebarForms.map((entry) => entry.itemLabel),
    visibleCatalog.map((entry) => approvedSidebarOverrides.get(entry.form)?.itemLabel || entry.formLabel)
);
assert.deepStrictEqual(sortedHierarchy.map((entry) => entry.form), sidebarForms.map((entry) => entry.form));

sortedHierarchy.forEach((entry, index) => {
    const sidebar = sidebarForms[index];
    const approvedOverride = approvedSidebarOverrides.get(entry.form);
    assert.strictEqual(
        approvedOverride?.itemLabel || entry.itemLabel,
        sidebar.itemLabel,
        `${entry.form}: leaf label`
    );
    assert.strictEqual(entry.sidebarNodeId, sidebar.sidebarNodeId, `${entry.form}: sidebar node id`);
    assert.deepStrictEqual(
        approvedOverride?.ancestorLabels || entry.ancestors.map(({ label }) => label),
        sidebar.ancestorLabels,
        `${entry.form}: hierarchy path`
    );
});

assert.ok(sortedHierarchy.every((entry) => /^li[0-9]+$/.test(entry.sidebarNodeId)));
assert.strictEqual(new Set(sortedHierarchy.map((entry) => entry.sidebarNodeId)).size, sidebarForms.length);
assert.ok(visibleCatalog.every((entry) => entry.sidebarOrder >= 1000));

const hiddenCatalog = seedData.filter((entry) => entry.showInPrivileges === false);
assert.ok(hiddenCatalog.every((entry) => !userPrivilegeSidebarHierarchy.some((item) => item.form === entry.form)));
assert.ok(!userPrivilegeSidebarHierarchy.some((entry) =>
    ['Μικτές από Καθαρές Αποδοχές', 'Ετήσιες Μονάδες Εργασίας (EME)']
        .includes(entry.itemLabel)));

console.log(`PASS sidebar/catalog/hierarchy contract (${sidebarForms.length} visible forms, exact labels/nesting/order)`);
