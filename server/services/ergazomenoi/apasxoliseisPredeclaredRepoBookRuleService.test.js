'use strict';

const assert = require('node:assert/strict');
const { POLICY_VERSION: ORPHAN_POLICY_VERSION } =
    require('./apasxoliseisOrphanCardResolutionService');
const { isApprovedApologistikoBookOrphan,
    isPredeclaredRepoPreservedInApologistika, belongsToCanonicalApologistikoBook } =
    require('./apasxoliseisPredeclaredRepoBookRuleService');

const preservedRepo = { apologistiko_biblio: true, repo: true,
    repo_apologistika: true, kathgoria_ergasias_apologistika: ' ΑΝ ' };
assert.equal(isPredeclaredRepoPreservedInApologistika(preservedRepo), true);
assert.equal(belongsToCanonicalApologistikoBook(preservedRepo), false);

for (const nonmatching of [
    { ...preservedRepo, repo: false },
    { ...preservedRepo, repo_apologistika: false },
    { ...preservedRepo, kathgoria_ergasias_apologistika: 'ΜΕ' },
    { ...preservedRepo, kathgoria_ergasias_apologistika: 'ΕΡΓ' }
]) assert.equal(belongsToCanonicalApologistikoBook(nonmatching), true);
assert.equal(belongsToCanonicalApologistikoBook({ ...preservedRepo,
    apologistiko_biblio: false }), false);

for (const orphanType of ['START_ONLY', 'END_ONLY']) {
    const orphan = { ...preservedRepo, orphan_card_resolution: {
        status: 'HR_APPROVED', policy_version: ORPHAN_POLICY_VERSION,
        orphan_type: orphanType } };
    assert.equal(isApprovedApologistikoBookOrphan(orphan), true);
    assert.equal(belongsToCanonicalApologistikoBook(orphan), true,
        `approved ${orphanType} orphan has higher-priority book ownership`);
}

assert.equal(isApprovedApologistikoBookOrphan({ ...preservedRepo,
    orphan_card_resolution: { status: 'HR_APPROVED',
        policy_version: ORPHAN_POLICY_VERSION, orphan_type: 'ZERO_LENGTH' } }), false);
console.log('predeclared repo Apologistiko Book rule tests passed');
