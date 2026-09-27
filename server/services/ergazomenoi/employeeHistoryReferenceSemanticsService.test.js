'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { SUPPORTED_COLLECTIONS } = require('./employeeHistoryReferenceDefinitionsService');
const { REFERENCE_BEHAVIORS, REFERENCE_SEMANTICS, referenceBehavior,
    assertCompleteReferenceSemantics, partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');

test('every protected history reference is explicitly classified as frozen provenance', () => {
    assert.equal(assertCompleteReferenceSemantics(), true);
    assert.deepEqual(Object.keys(REFERENCE_SEMANTICS).sort(), [...SUPPORTED_COLLECTIONS].sort());
    for (const collection of SUPPORTED_COLLECTIONS) {
        assert.equal(referenceBehavior(collection), REFERENCE_BEHAVIORS.FROZEN_PROVENANCE,
            collection);
    }
});

test('unknown reference collections fail closed for an in-place history update', () => {
    assert.throws(() => partitionHistoryUpdateReferences([
        { collection: 'Future_Live_History_Consumer', documentId: 'future-1' }
    ]), /reference semantics missing/);
});

test('protected consumers never dereference a stored provenance id into live history', () => {
    const root = path.resolve(__dirname, '../..');
    const productionFiles = [];
    const visit = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(absolute);
            else if (entry.isFile() && entry.name.endsWith('.js') &&
                !entry.name.endsWith('.test.js')) productionFiles.push(absolute);
        }
    };
    visit(root);
    const source = productionFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.doesNotMatch(source,
        /IstorikoProslhpseonAllagonModel\s*\.\s*(?:findById|findOne)\s*\([^)]*(?:effective_profile_istoriko_id|previous_profile_istoriko_id|profile_history_id)/s);
    assert.doesNotMatch(source,
        /populate\s*\(\s*['"](?:effective_profile_istoriko_id|previous_profile_istoriko_id|profile_history_id)['"]/);

    const frozen = fs.readFileSync(path.join(root,
        'services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService.js'), 'utf8');
    assert.match(frozen, /effective_profile_resolved/);
    assert.match(frozen, /profile_history/);
    const decisions = fs.readFileSync(path.join(root,
        'services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionService.js'), 'utf8');
    assert.match(decisions, /canonical_snapshot/);
    assert.match(decisions, /profile_history/);
    const transfers = fs.readFileSync(path.join(root,
        'services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionService.js'), 'utf8');
    assert.match(transfers, /canonical_snapshot/);
});
