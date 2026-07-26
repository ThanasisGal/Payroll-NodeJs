'use strict';

const assert = require('assert');
const {
    userPrivilegeSidebarHierarchy,
    validateUserPrivilegeSidebarHierarchy,
    compareHierarchyEntries,
    pathIdentity
} = require('./userPrivilegeSidebarHierarchy');

const clone = (value) => JSON.parse(JSON.stringify(value));
const base = [
    {
        form: 'First',
        sidebarNodeId: 'li100',
        itemLabel: 'Πρώτη',
        itemOrder: 200,
        ancestors: [{ key: 'root', label: 'Ρίζα', order: 100 }]
    },
    {
        form: 'Second',
        sidebarNodeId: 'li200',
        itemLabel: 'Δεύτερη',
        itemOrder: 100,
        ancestors: [
            { key: 'root', label: 'Ρίζα', order: 100 },
            { key: 'nested', label: 'Ένθετη', order: 100 }
        ]
    }
];

assert.strictEqual(validateUserPrivilegeSidebarHierarchy(base), true);
assert.strictEqual(pathIdentity(base[1].ancestors), 'root/nested');
assert.deepStrictEqual(clone(base).sort(compareHierarchyEntries).map((entry) => entry.form), ['Second', 'First']);
assert.ok(userPrivilegeSidebarHierarchy.some((entry) => entry.ancestors.length === 3));
assert.ok(Object.isFrozen(userPrivilegeSidebarHierarchy));
assert.ok(Object.isFrozen(userPrivilegeSidebarHierarchy[0]));
assert.ok(Object.isFrozen(userPrivilegeSidebarHierarchy[0].ancestors));
assert.ok(userPrivilegeSidebarHierarchy.every((entry) => /^li[0-9]+$/.test(entry.sidebarNodeId)));

const insertionSafe = [100, 200, 150].map((itemOrder, index) => ({
    form: `Inserted${index}`,
    sidebarNodeId: `li90${index}`,
    itemLabel: `Εγγραφή ${index}`,
    itemOrder,
    ancestors: [{ key: 'root', label: 'Ρίζα', order: 100 }]
}));
assert.strictEqual(validateUserPrivilegeSidebarHierarchy(insertionSafe), true);
assert.deepStrictEqual(
    clone(insertionSafe).sort(compareHierarchyEntries).map((entry) => entry.itemOrder),
    [100, 150, 200]
);
assert.strictEqual(insertionSafe.find((entry) => entry.itemOrder === 200).itemOrder, 200);

function rejects(mutator, code) {
    const candidate = clone(base);
    mutator(candidate);
    assert.throws(
        () => validateUserPrivilegeSidebarHierarchy(candidate),
        (error) => error.code === code && error.status === 500
    );
}

rejects((entries) => { entries[1].form = 'First'; }, 'DUPLICATE_PRIVILEGE_HIERARCHY_FORM');
rejects((entries) => { entries[0].itemOrder = 100; entries[0].ancestors.push(entries[1].ancestors[1]); },
    'DUPLICATE_PRIVILEGE_HIERARCHY_ORDER');
rejects((entries) => { delete entries[0].sidebarNodeId; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[0].sidebarNodeId = 'sidebar-100'; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[1].sidebarNodeId = 'li100'; },
    'DUPLICATE_PRIVILEGE_HIERARCHY_NODE_ID');
rejects((entries) => { entries[1].ancestors[0].label = 'Άλλη Ρίζα'; },
    'CONFLICTING_PRIVILEGE_HIERARCHY_PATH');
rejects((entries) => { entries[0].form = 'bad-form'; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[0].itemLabel = ' '; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[0].itemOrder = -1; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[0].ancestors = []; }, 'INVALID_PRIVILEGE_HIERARCHY_ENTRY');
rejects((entries) => { entries[0].ancestors[0].key = 'Bad Key'; },
    'INVALID_PRIVILEGE_HIERARCHY_ANCESTOR');
rejects((entries) => { entries[0].ancestors[0].order = 1.5; },
    'INVALID_PRIVILEGE_HIERARCHY_ANCESTOR');

console.log(`PASS canonical user privilege hierarchy (${userPrivilegeSidebarHierarchy.length} forms, immutable, validated)`);
