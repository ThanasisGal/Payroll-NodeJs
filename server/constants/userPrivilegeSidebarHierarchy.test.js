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
        itemLabel: 'Πρώτη',
        itemOrder: 1,
        ancestors: [{ key: 'root', label: 'Ρίζα', order: 0 }]
    },
    {
        form: 'Second',
        itemLabel: 'Δεύτερη',
        itemOrder: 0,
        ancestors: [
            { key: 'root', label: 'Ρίζα', order: 0 },
            { key: 'nested', label: 'Ένθετη', order: 0 }
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

function rejects(mutator, code) {
    const candidate = clone(base);
    mutator(candidate);
    assert.throws(
        () => validateUserPrivilegeSidebarHierarchy(candidate),
        (error) => error.code === code && error.status === 500
    );
}

rejects((entries) => { entries[1].form = 'First'; }, 'DUPLICATE_PRIVILEGE_HIERARCHY_FORM');
rejects((entries) => { entries[0].itemOrder = 0; entries[0].ancestors.push(entries[1].ancestors[1]); },
    'DUPLICATE_PRIVILEGE_HIERARCHY_ORDER');
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
