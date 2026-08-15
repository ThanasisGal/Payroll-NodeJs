'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = {
    console,
    document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        createElement: () => ({
            addEventListener: () => {}, appendChild: () => {},
            classList: { add: () => {}, toggle: () => {} }, dataset: {},
            setAttribute: () => {}, style: {}
        }),
        head: { appendChild: () => {} }, body: { appendChild: () => {} }
    },
    window: {}, URLSearchParams,
    fetch: async () => { throw new Error('Unexpected fetch'); },
    setTimeout: () => {}, clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });

function orphanRow(status) {
    return {
        _id: 'row-0004-2026-06-14', kodikos: '0004',
        hmeromhnia: '2026-06-14T00:00:00.000Z',
        cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '23:21',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        orphan_card_resolution: status ? { status } : undefined
    };
}

const approved = orphanRow('HR_APPROVED');
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(sandbox.buildPreCalculationDataIssueGroups([approved]))),
    []
);

const unresolvedGroups = JSON.parse(JSON.stringify(
    sandbox.buildPreCalculationDataIssueGroups([orphanRow(null)])
));
assert.strictEqual(unresolvedGroups.length, 1);
assert.strictEqual(unresolvedGroups[0].issue_code, 'ORPHAN_CARD_PUNCH');
assert.strictEqual(unresolvedGroups[0].count, 1);

const presentation = sandbox.resolveReviewRowPresentation(approved, {
    apologistikoText: '14:51 - 23:21',
    isApologistikoRepoRow: false,
    isApologistikoNonWorkRow: false,
    declaredText: '14:51 - 22:51',
    declaredClass: ''
}, null);
assert.strictEqual(presentation.apologistiko.text, '14:51 - 23:21');
const badge = sandbox.renderApprovedOrphanAuditBadge(approved);
assert.match(badge, /ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ/);
assert.strictEqual(sandbox.renderApprovedOrphanAuditBadge(orphanRow(null)), '');

assert.match(source,
    /\$\{rowPresentation\.apologistiko\.text\}[\s\S]*\$\{renderApprovedOrphanAuditBadge\(row\)\}/);

console.log('approved orphan pending/audit renderer regression: PASS');
