'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function section(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, startMarker);
    assert.notEqual(end, -1, endMarker);
    return source.slice(start, end);
}

const manual = section(
    'static updateProdhlomenaOrariaReviewRecord = async',
    'static unlockProdhlomenaOrariaReviewRecord = async'
);
const restore = section(
    'static restoreProdhlomenaOrariaReviewRecord = async',
    'static getProdhlomenaOrariaReviewAudit = async'
);
const scheduleImport = section(
    'async function saveTelikoToProdhlomena(',
    'async function prepareKartesXlsx('
);

test('single-row manual review prefetches and sanitizes before updateOne', () => {
    assert.equal((manual.match(/loadAppliedProtectionForRows\(\[oldRecord\]\)/g) || []).length, 1);
    assert.equal((manual.match(/sanitizeAppliedRepoTransferUpdate\(\{/g) || []).length, 1);
    assert.ok(manual.indexOf('sanitizeAppliedRepoTransferUpdate({') < manual.indexOf('.updateOne('));
    assert.ok(manual.includes('$set: permittedUpdates'));
});

test('manual review rejects protected identity conflicts through HTTP 409', () => {
    assert.ok(manual.includes('blocksInteractiveAppliedIdentityChange(protectedManualUpdate)'));
    assert.ok(manual.includes('return res.status(409).json({'));
});

test('manual review keeps safe nonidentity updates and its existing audit flow', () => {
    assert.ok(manual.includes('const permittedUpdates = { ...protectedManualUpdate.sanitizedUpdate }'));
    assert.ok(manual.includes('ProdhlomenaOrariaAuditModel.create([{'));
    assert.ok(manual.includes('}], { session })'));
    assert.ok(manual.includes('oldValues,'));
    assert.ok(manual.includes('newValues'));
});

test('restore authorizes both set and unset with fresh protection inside the transaction', () => {
    assert.equal((restore.match(/loadAppliedProtectionForRows\(\[oldRecord\]\)/g) || []).length, 1);
    assert.equal((restore.match(/sanitizeAppliedRepoTransferUpdate\(\{/g) || []).length, 2);
    assert.ok(restore.indexOf('sanitizeAppliedRepoTransferUpdate({') < restore.indexOf('.updateOne('));
    const fence = restore.indexOf('await runWithPeriodWriteFence({');
    const rowRead = restore.indexOf('const fresh = await', fence);
    const contextRead = restore.indexOf('const freshProtectionContext = await loadAppliedRepoTransferProtectionContext({', rowRead);
    const sanitize = restore.indexOf('const freshProtection = sanitizeAppliedRepoTransferUpdate({', contextRead);
    const finalSet = restore.indexOf('Object.entries(freshProtection.sanitizedUpdate)', sanitize);
    assert.ok(fence >= 0 && rowRead > fence && contextRead > rowRead && sanitize > contextRead && finalSet > sanitize);
    assert.match(restore.slice(rowRead, contextRead), /\.session\(session\)\.lean\(\)/);
    assert.match(restore.slice(contextRead, sanitize), /loadedRowIds: \[fresh\._id\]/);
    assert.match(restore.slice(contextRead, sanitize), /session\s*\}\)/);
    assert.ok(restore.includes('protectionContext: freshProtectionContext'));
    assert.ok(restore.includes('update: { ...requestedRestoreValues, ...unsetProtectionInput }'));
    assert.ok(restore.includes('$set: restoreValues'));
});

test('generic restore rejects identity conflicts and does not mutate audit oldValues', () => {
    assert.ok(restore.includes('blocksInteractiveAppliedIdentityChange(protectedRestoreUpdate)'));
    assert.ok(restore.includes('return res.status(409).json({'));
    assert.ok(restore.includes('const requestedRestoreValues = { ...(audit.oldValues || {}) }'));
    assert.ok(!restore.includes('const restoreValues = audit.oldValues || {}'));
});

test('generic restore does not create or supersede repo-transfer executions', () => {
    assert.ok(!restore.includes('RepoTransferExecution'));
    assert.ok(!restore.includes('execution_status'));
    assert.ok(!restore.includes('SUPERSEDED'));
    assert.ok(!restore.includes('REVERSED'));
});

test('schedule import reads existing rows once and prefetches protection once for the batch', () => {
    assert.equal((scheduleImport.match(/prodhlomenaModel\.find\(\{/g) || []).length, 1);
    assert.equal((scheduleImport.match(/loadAppliedProtectionForRows\(existingRows\)/g) || []).length, 1);
    assert.ok(scheduleImport.includes('preparedRecords.map(({ filter }) => filter)'));
});

test('schedule import sanitizes only existing rows and leaves new-row upsert behavior intact', () => {
    assert.ok(scheduleImport.includes('if (existingRow) {'));
    assert.equal((scheduleImport.match(/sanitizeAppliedRepoTransferUpdate\(\{/g) || []).length, 1);
    assert.ok(scheduleImport.includes('let protectedRecordUpdate = record'));
    assert.ok(scheduleImport.includes('upsert: true'));
});

test('schedule import persists sanitized updates without adding category writes', () => {
    assert.ok(scheduleImport.includes('update: { $set: protectedRecordUpdate }'));
    const recordStart = scheduleImport.indexOf('const record = {');
    const recordEnd = scheduleImport.indexOf('};', recordStart);
    const record = scheduleImport.slice(recordStart, recordEnd);
    assert.ok(record.includes('repo_apologistika: false'));
    assert.ok(!record.includes('kathgoria_ergasias_apologistika'));
});

test('schedule import has no per-row protection query', () => {
    const mapStart = scheduleImport.indexOf('const bulkOps = preparedRecords.map');
    const mapEnd = scheduleImport.indexOf('// -------- 5)', mapStart);
    const perRowMapping = scheduleImport.slice(mapStart, mapEnd);
    assert.ok(!perRowMapping.includes('loadAppliedProtectionForRows'));
    assert.ok(!perRowMapping.includes('loadAppliedRepoTransferProtectionContext'));
});

test('write-path hardening uses field-level sanitation without blanket skip or post-hoc restore', () => {
    for (const code of [manual, restore, scheduleImport]) {
        assert.ok(!code.includes('skipProtectedRow'));
        assert.ok(!code.includes('restoreApplied'));
        assert.ok(!code.includes('reverseApplied'));
    }
});

test('manual, restore and import do not inspect approval, reusable or decision state', () => {
    for (const code of [manual, restore, scheduleImport]) {
        assert.ok(!code.includes('RESOLVED_BY_POLICY'));
        assert.ok(!code.includes('APPROVE_PROPOSAL'));
        assert.ok(!code.includes('reusable_status'));
        assert.ok(!code.includes('decision_status'));
    }
});
