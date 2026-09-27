'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const approved = new Set([
    'server/services/ergazomenoi/employeeEmploymentProfileWriter.js',
    'server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService.js'
]);
const writePattern = /(?:IstorikoProslhpseonAllagonModel|historyModel)\s*\.\s*(?:save|create|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteOne|deleteMany)\s*\(/g;

function javascriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return javascriptFiles(absolute);
        return entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')
            ? [absolute] : [];
    });
}

test('employment-history physical writes exist only in approved canonical infrastructure', () => {
    const offenders = [];
    for (const absolute of javascriptFiles(path.join(root, 'server'))) {
        const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
        if (approved.has(relative)) continue;
        const source = fs.readFileSync(absolute, 'utf8');
        if (writePattern.test(source)) offenders.push(relative);
        writePattern.lastIndex = 0;
    }
    assert.deepEqual(offenders, []);
});

test('all public employment-history mutations are exported by the one writer module', () => {
    const writer = fs.readFileSync(path.join(root,
        'server/services/ergazomenoi/employeeEmploymentProfileWriter.js'), 'utf8');
    for (const operation of ['writeEmployeeEmploymentProfile', 'writeEmployeeDeparture',
        'writeEmployeeDepartureCancellation', 'writeEmployeeRehire',
        'writeEmployeeEmploymentHistoryOperations', 'repairEmployeeHistoryCanonical',
        'deleteEmployeeAndEmploymentHistory']) {
        assert.match(writer, new RegExp(`\\b${operation}\\b`));
    }
    assert.match(writer, /executeFinalMutationPlan/);
    assert.match(writer, /canonicalizeEmployeeHistory/);
});

test('history editor and lifecycle commands derive one plan before physical history writes', () => {
    const writer = fs.readFileSync(path.join(root,
        'server/services/ergazomenoi/employeeEmploymentProfileWriter.js'), 'utf8');
    const slice = (startMarker, endMarker) => writer.slice(writer.indexOf(startMarker),
        writer.indexOf(endMarker, writer.indexOf(startMarker)));
    const editor = slice('async function writeEmployeeEmploymentHistoryOperations',
        '\n\nconst HISTORY_CURRENT_FIELDS');
    assert.doesNotMatch(editor,
        /historyModel\.(?:create|updateOne|updateMany|deleteOne|deleteMany)\(/);
    assert.match(editor, /buildFinalHistoryMutationPlan/);
    assert.match(editor, /executeFinalMutationPlan/);

    for (const [start, end] of [
        ['async function writeEmployeeDeparture(', '\n\n// A mistaken departure'],
        ['async function writeEmployeeDepartureCancellation(', '\n\n// Rehire appends'],
        ['async function writeEmployeeRehire(', '\n\n// Removal of the whole employee']
    ]) {
        const operation = slice(start, end);
        assert.doesNotMatch(operation,
            /historyModel\.(?:create|updateOne|updateMany|deleteOne|deleteMany)\(/,
        start);
        assert.match(operation, /writeEmployeeEmploymentProfile|executeFinalMutationPlan/, start);
    }
});

test('the canonical executor is the sole physical history-write boundary in its module', () => {
    const writer = fs.readFileSync(path.join(root,
        'server/services/ergazomenoi/employeeEmploymentProfileWriter.js'), 'utf8');
    const start = writer.indexOf('async function executeFinalMutationPlan');
    const end = writer.indexOf('\n// Private session sharing', start);
    const offenders = [];
    const localPattern = new RegExp(writePattern.source, 'g');
    for (const match of writer.matchAll(localPattern)) {
        if (match.index < start || match.index >= end) offenders.push(match[0]);
    }
    assert.deepEqual(offenders, []);
});
