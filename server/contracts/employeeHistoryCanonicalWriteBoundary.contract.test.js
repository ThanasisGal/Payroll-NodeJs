'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const approved = new Set([
    'server/services/ergazomenoi/employeeEmploymentProfileWriter.js',
    'server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService.js',
    // PR406 is a separate opt-in, signed, all-or-nothing History boundary.
    // Its exceptional physical writes are exhaustively attested below.
    'server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService.js'
]);
const writePattern = /(?:IstorikoProslhpseonAllagonModel|historyModel)\s*\.\s*(?:save|create|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteOne|deleteMany|bulkWrite)\s*\(/g;

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

test('PR406 approved atomic writer is the sole narrowly scoped additional physical History boundary', () => {
    const src = fs.readFileSync(path.join(root,
        'server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService.js'), 'utf8');
    // These checks are not a generic allowlist: any new write operation, missing
    // feature gate, changed transaction boundary or absent audit fails the CI.
    assert.match(src, /const FLAG = 'PAYROLL_PR406_APPROVED_ATOMIC_MAINTENANCE_ENABLED';/);
    assert.match(src, /enabled: \(\) => process\.env\[FLAG\] === 'true'/);
    assert.match(src, /const ready = \(\) => d\.enabled\(\) === true && signingSecret\.length >= 16/);
    const start = src.indexOf('async function apply(req,change,confirmation)');
    const end = src.indexOf('async function context(req)', start);
    assert.ok(start >= 0 && end > start, 'distinct, bounded apply-only writer');
    const apply = src.slice(start, end);
    assert.match(apply, /if \(!ready\(\)\) throw blocked\('DISABLED',403\)/);
    assert.match(apply, /const signed = verify\(confirmation\)/);
    assert.match(apply, /W\.inProfileTransaction\(d\.connection,d\.capabilityProbe,async session =>/);
    assert.match(apply, /signed\.binding !== binding\(req,input,change,plan\)/);
    assert.match(apply, /await W\.acquireEmployeeMutationFence/);
    assert.match(apply, /await claimUnchangedHistoryReferences\(/);
    assert.match(apply, /await d\.claimCompanyPeriod\(/);
    assert.match(apply, /await d\.claimPeriodProtection\(/);
    assert.match(apply, /if \(!\(await d\.auditReady\(\)\)\)/);
    assert.match(apply, /await d\.auditModel\.create\(\[operation\], \{ session \}\)/);
    assert.match(apply, /const final = await state\(req,session\)/);
    assert.match(apply, /UNPLANNED_OLD_HISTORY_MUTATION/);
    assert.match(apply, /FINAL_HISTORY_COUNT/);
    assert.match(apply, /PRIOR_APPROVAL_LOST/);
    // Exact direct write inventory; no deletes, bulk writes, upserts or new
    // commands outside the server-owned signed apply transaction.
    const exactWrites = [...src.matchAll(new RegExp(writePattern.source, 'g'))].map(m => m[0]);
    assert.deepEqual(exactWrites, ['historyModel.updateOne(', 'historyModel.create(']);
    const guardedUpdate = apply.indexOf('if (plan.targetPatch) {');
    const update = apply.indexOf('await d.historyModel.updateOne(');
    const guardedInsert = apply.indexOf('if (plan.nextRow) {');
    const insert = apply.indexOf('await d.historyModel.create(');
    assert.ok(guardedUpdate >= 0 && guardedUpdate < update &&
        update < guardedInsert && guardedInsert < insert,
        'only an explicitly planned same-period update or a new-row insert');
    // Creating a genuinely new period NEVER updates the old physical row.
    const decideStart = src.indexOf('function decide(input, request, periodProtection, options = {})');
    const decideEnd = src.indexOf('function createApprovedHistoryAtomicMaintenanceService(', decideStart);
    assert.ok(decideStart >= 0 && decideEnd > decideStart);
    const planner = src.slice(decideStart, decideEnd);
    const newBranch = planner.indexOf("if (request.kind === 'NEW_CHANGE') {");
    const elseBranch = planner.indexOf('} else {', newBranch);
    const patchAssign = planner.indexOf('targetPatch = {', elseBranch);
    assert.ok(newBranch >= 0 && elseBranch > newBranch && patchAssign > elseBranch);
    assert.ok(!planner.slice(newBranch, elseBranch).includes('targetPatch ='),
        'an immutable predecessor must never receive a physical patch');
    assert.match(planner, /APPROVED_TARGET_CANNOT_BE_REWRITTEN/);
    assert.match(planner, /IMMUTABLE_TARGET_REQUIRES_CORRECTION_EDITION/);
    assert.match(planner, /PENDING_HISTORY_FIRST/);
    // Normal full-form Save reuses this same private physical writer inside
    // its existing transaction. Its own signed decision precedes the commit;
    // it cannot introduce a second, less protected History write boundary.
    const commitStart = src.indexOf('async function commit(req,change,input,plan,session,employeeSave = false)');
    const prepareStart = src.indexOf('async function prepareEmployeeSave(req,change,session,options = {})');
    assert.ok(start < commitStart && commitStart < prepareStart && prepareStart < end);
    const formPreparation = src.slice(prepareStart,end);
    assert.match(formPreparation, /if \(!ready\(\)\) throw blocked\('DISABLED',403\)/);
    assert.match(formPreparation, /const input = await state\(req,session\)/);
    assert.match(formPreparation, /commit:\(\) => commit\(req,change,input,plan,session,true\)/);
    const formSave = fs.readFileSync(path.join(root,
        'server/services/ergazomenoi/employeeApprovedHistoryFormSaveService.js'), 'utf8');
    const confirmation = formSave.indexOf('D.verifyConfirmation(request.historyConfirmation,bound,decision)',
        formSave.indexOf("const decision = missing.length ? 'DEFER_HISTORY'"));
    const formCommit = formSave.indexOf('await prepared.commit()');
    assert.ok(confirmation >= 0 && formCommit > confirmation);
    assert.match(src.slice(commitStart,prepareStart), /plan\.missingFields\?\.length \|\| !plan\.protectionProof/);
    assert.doesNotMatch(formSave, writePattern);
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
        assert.match(operation, /writeEmployeeEmploymentProfile|applyOrExecuteFinalMutationPlan|executeFinalMutationPlan/, start);
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
