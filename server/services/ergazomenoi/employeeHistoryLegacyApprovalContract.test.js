'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const U = require('./employeeHistoryCoordinatedSettlementContract');
const H = require('./employeeHistoryLegacyApprovalContract');
const F = require('./employeeHistoryLegacyFenceService');
const root = path.resolve(__dirname, '../../..');
// Independent oracle: the actual historical Git tree, never the replay bundle.
const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-373-contract-proof-'));
execFileSync('tar', ['-x', '-C', oldRoot], { input: execFileSync('git', ['archive', H.COMMIT, 'server'],
    { cwd: root, maxBuffer: 40 * 1024 * 1024 }) });
fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(oldRoot, 'node_modules'), 'dir');
const oldS = require(oldRoot + '/server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const oldU = require(oldRoot + '/server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const oldClaim = require(oldRoot + '/server/services/ergazomenoi/employeeHistorySettlementNormalActivation').claimNormalSettlementAttempt;
async function setup({ current = false, changeProposal, fingerprint: replacement } = {}) {
    const db = require('../../../test/fixtures/employeeHistoryLegacyFenceMemory').createLegacyFenceMemory();
    const original = await db.approvalInput();
    const proposal = (current ? U : oldU).buildCoordinatedSettlementProposal(original);
    let fingerprint = (current ? S : oldS).buildEmployeeHistorySettlementApprovalFingerprint({ ...original, proposal });
    if (changeProposal) {
        const changed = S.clone(proposal); changeProposal(changed);
        fingerprint = A.hash({ version: oldS.PREPARATION_VERSION, actorUserId: original.actorUserId,
            employeeId: original.employeeId, scope: original.scope, currentEmployee: original.currentEmployee,
            historyBefore: A.ordered(original.completeHistoryRows), protectedReferenceSummary: original.protectedReferenceSummary,
            proposal: changed });
    }
    if (replacement) fingerprint = replacement;
    await oldClaim({ ...original, fingerprint, claimId: 'actual-historical-synthetic-claim', auditModel: db.auditModel });
    const legacyAttemptId = db.state().receipts[0]._id;
    return { db, original, proposal, fingerprint, input: { ...db.input, legacyAttemptId, fingerprint } };
}
test('the complete read-only contract bundle is byte-identical to pinned historical Git blobs', () => {
    const bundle = JSON.parse(fs.readFileSync(__dirname + '/legacyApprovalContracts/d4483357.json', 'utf8'));
    assert.equal(bundle.commit, H.COMMIT); assert.equal(Object.keys(bundle.files).length, 34);
    for (const [filename, entry] of Object.entries(bundle.files)) {
        assert.equal(entry.source.join('\n'), execFileSync('git', ['show', H.COMMIT + ':' + filename], { cwd: root, encoding: 'utf8' }));
        assert.equal(entry.gitBlob, execFileSync('git', ['rev-parse', H.COMMIT + ':' + filename], { cwd: root, encoding: 'utf8' }).trim());
        assert.ok(!filename.startsWith('server/models/'));
    }
});
test('genuine d4483357 approval with different attempts/sourceProposal fences exactly once', async () => {
    const x = await setup(), before = x.db.state(), current = U.buildCoordinatedSettlementProposal(x.original);
    assert.equal(x.proposal.status, 'CLEAN'); assert.equal(current.status, 'CLEAN');
    assert.equal(x.proposal.proposedRows.length, 4);
    assert.ok(A.equal(x.proposal.proposedRows, current.proposedRows));
    assert.ok(A.equal(x.proposal.verification, current.verification));
    assert.deepEqual(Object.keys(x.proposal).filter(key => !A.equal(x.proposal[key], current[key])).sort(), ['attempts', 'sourceProposal']);
    assert.notEqual(S.buildEmployeeHistorySettlementApprovalFingerprint({ ...x.original, proposal: current }), x.fingerprint);
    assert.equal(H.verifyLegacyApprovalContract(x.original, x.fingerprint), H.COMMIT);
    const preview = await F.previewLegacyApproval(x.input);
    assert.ok(A.equal(x.db.state(), before));
    for (const approval of [undefined, { confirmed: false, fingerprint: preview.approvalFingerprint },
        { confirmed: true, fingerprint: x.fingerprint }])
        await assert.rejects(() => F.fenceLegacyApproval({ ...x.input, approval }), e => e.reason === 'EXPLICIT_APPROVAL_REQUIRED');
    assert.ok(A.equal(x.db.state(), before));
    const request = { ...x.input, approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
    const result = await F.fenceLegacyApproval(request), after = x.db.state();
    assert.equal(result.sequence, 1); assert.equal(result.requiresNewIndependentApproval, true);
    const { employee_profile_mutation_sequence, ...employee } = after.employees[0];
    assert.ok(A.equal(employee, before.employees[0])); assert.equal(employee_profile_mutation_sequence, 1);
    assert.ok(A.equal(after.history, before.history)); assert.ok(A.equal(after.references, before.references));
    assert.ok(A.equal(after.receipts[0], before.receipts[0]));
    assert.equal(after.audits.length, 1); assert.equal(after.audits[0].mutationSource, F.SOURCE);
    assert.equal(after.audits[0].diagnostics.legacyHash, A.hash(before.receipts[0]));
    await assert.rejects(() => F.fenceLegacyApproval(request), e => e.reason === 'ALREADY_REQUESTED');
    assert.ok(A.equal(x.db.state(), after));
    const fresh = await x.db.approvalInput(), freshProposal = oldU.buildCoordinatedSettlementProposal(fresh);
    assert.notEqual(oldS.buildEmployeeHistorySettlementApprovalFingerprint({ ...fresh, proposal: freshProposal }), x.fingerprint);
});
test('current unversioned receipt still uses the unchanged full current fingerprint', async () => {
    const x = await setup({ current: true });
    assert.equal(H.verifyLegacyApprovalContract(x.original, x.fingerprint), 'CURRENT');
    assert.equal((await F.previewLegacyApproval(x.input)).outcome, 'PREVIEW');
});
for (const [field, mutate] of Object.entries({
    attempts: p => { p.attempts[0].reason = 'ARBITRARY'; },
    sourceProposal: p => { p.sourceProposal.snapshotFingerprint = 'ARBITRARY'; },
    assumptions: p => { p.assumptions.push({ code: 'ARBITRARY' }); },
    currentPatch: p => { p.currentPatch.energos = false; },
    proposedRows: p => { p.proposedRows[0].synolo_symbashs = 999; },
    verification: p => { p.verification.unreviewed = true; }
})) test('altered ' + field + ' never becomes a supported historical approval', async () => {
    const x = await setup({ changeProposal: mutate }), before = x.db.state();
    await assert.rejects(() => F.previewLegacyApproval(x.input), e =>
        e.reason === 'ORIGINAL_APPROVAL_CHANGED' && e.code === 'EMPLOYEE_HISTORY_LEGACY_FENCE_BLOCKED');
    assert.ok(A.equal(x.db.state(), before));
});
for (const change of ['employee', 'sequence', 'history', 'reference', 'actor', 'rights', 'inactive', 'scope',
    'stored-actor', 'missing-claim', 'missing-history', 'surviving-ids', 'deleted-ids', 'protocol'])
test('changed or uncertain ' + change + ' remains BLOCKED without a write', async () => {
    const x = await setup(), preview = await F.previewLegacyApproval(x.input);
    if (change === 'employee') x.db.changeEmployee({ email: 'synthetic-change@example.test' });
    if (change === 'sequence') x.db.changeEmployee({ employee_profile_mutation_sequence: 1 });
    if (change === 'history') x.db.changeHistory(x.original.completeHistoryRows[0]._id, { synolo_symbashs: 999 });
    if (change === 'reference') x.db.changeReference();
    if (change === 'actor') x.db.changeActor({ privileges: 'S' });
    if (change === 'rights') x.db.changePermission({ update: false, admin: false });
    if (change === 'inactive') x.db.changeActor({ situation: 'I' });
    if (change === 'scope') x.input.scope = { ...x.input.scope, kodikos: 'wrong' };
    const corruptions = {
        'stored-actor': row => { row.diagnostics.actorUserId = '507f1f77bcf86cd799439099'; },
        'missing-claim': row => { delete row.diagnostics.claimId; },
        'missing-history': row => { delete row.historyBefore; },
        'surviving-ids': row => { row.survivingHistoryIds.pop(); },
        'deleted-ids': row => { row.deletedLegacyHistoryIds.push('unproven'); },
        protocol: row => { row.diagnostics.protocol = null; }
    };
    if (corruptions[change]) x.db.changeReceipt(x.input.legacyAttemptId, corruptions[change]);
    const before = x.db.state();
    await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
        approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.outcome === 'BLOCKED');
    assert.ok(A.equal(x.db.state(), before));
});
test('unknown historical fingerprint stays BLOCKED', async () => {
    const x = await setup({ fingerprint: 'x'.repeat(43) }), before = x.db.state();
    await assert.rejects(() => F.previewLegacyApproval(x.input), e => e.reason === 'ORIGINAL_APPROVAL_CHANGED');
    assert.ok(A.equal(x.db.state(), before));
});
test('audit failure rolls back the sequence; durable reservation prevents a second execution', async () => {
    const x = await setup(), before = x.db.state(), preview = await F.previewLegacyApproval(x.input);
    x.db.failAudit();
    const request = { ...x.input, approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
    await assert.rejects(() => F.fenceLegacyApproval(request), e => e.reason === 'FENCE_RESULT_UNCERTAIN');
    const after = x.db.state();
    assert.ok(A.equal(after.employees, before.employees)); assert.ok(A.equal(after.history, before.history));
    assert.ok(A.equal(after.references, before.references)); assert.equal(after.audits.length, 0);
    assert.equal(after.receipts.length, 2);
    await assert.rejects(() => F.fenceLegacyApproval(request), e => e.reason === 'ALREADY_REQUESTED');
    assert.ok(A.equal(x.db.state(), after));
});
test('two independently approved requests still have exactly one durable owner', async () => {
    const x = await setup(), preview = await F.previewLegacyApproval(x.input);
    const request = { ...x.input, approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
    const results = await Promise.allSettled([F.fenceLegacyApproval(request), F.fenceLegacyApproval(request)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.outcome === 'BLOCKED').length, 1);
    assert.equal(x.db.state().employees[0].employee_profile_mutation_sequence, 1);
    assert.equal(x.db.state().audits.length, 1);
});
test('historical reservation recovery requires separate approval and never repeats a committed fence', async () => {
    const x = await setup(), preview = await F.previewLegacyApproval(x.input);
    x.db.failAudit();
    await assert.rejects(() => F.fenceLegacyApproval({ ...x.input,
        approval: { confirmed: true, fingerprint: preview.approvalFingerprint } }), e => e.reason === 'FENCE_RESULT_UNCERTAIN');
    x.db.failAudit(false);
    const reservation = x.db.state().receipts.find(row => row.mutationSource === F.SOURCE + '_ATTEMPT');
    const input = { ...x.input, reservationId: reservation._id }, before = x.db.state();
    const recovery = await F.previewLegacyFenceRecovery(input);
    assert.equal(recovery.outcome, 'RECOVERABLE'); assert.ok(A.equal(x.db.state(), before));
    await assert.rejects(() => F.completeLegacyFenceReservation(input), e => e.reason === 'EXPLICIT_RECOVERY_APPROVAL_REQUIRED');
    assert.ok(A.equal(x.db.state(), before));
    const request = { ...input, recoveryApproval: { confirmed: true, fingerprint: recovery.recoveryFingerprint } };
    assert.equal((await F.completeLegacyFenceReservation(request)).sequence, 1);
    const after = x.db.state();
    assert.equal((await F.completeLegacyFenceReservation(request)).outcome, 'COMMITTED');
    assert.ok(A.equal(x.db.state(), after));
});
test('missing or corrupted historical contract remains BLOCKED before any write', () => {
    for (const mode of ['missing', 'corrupt']) execFileSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const fs = require('node:fs'), read = fs.readFileSync;
        fs.readFileSync = (file, ...args) => {
            if (String(file).endsWith('/d4483357.json')) {
                if (${JSON.stringify(mode)} === 'missing') throw Error('SYNTHETIC_MISSING_CONTRACT');
                return Buffer.from('SYNTHETIC_CORRUPT_CONTRACT');
            }
            return read(file, ...args);
        };
        const db = require('./test/fixtures/employeeHistoryLegacyFenceMemory').createLegacyFenceMemory();
        const F = require('./server/services/ergazomenoi/employeeHistoryLegacyFenceService');
        const oldRoot = ${JSON.stringify(oldRoot)};
        (async () => {
            const input = await db.approvalInput();
            const U = require(oldRoot + '/server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
            const S = require(oldRoot + '/server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
            const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal: U.buildCoordinatedSettlementProposal(input) });
            await require(oldRoot + '/server/services/ergazomenoi/employeeHistorySettlementNormalActivation')
                .claimNormalSettlementAttempt({ ...input, fingerprint, claimId: 'original', auditModel: db.auditModel });
            const before = db.state();
            await assert.rejects(() => F.previewLegacyApproval({ ...db.input, fingerprint,
                legacyAttemptId: before.receipts[0]._id }), e => e.outcome === 'BLOCKED' && e.reason === 'EVIDENCE_NOT_CONFIRMED');
            assert.ok(require('./server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract').equal(db.state(), before));
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { cwd: root, stdio: 'pipe', timeout: 10000 });
});
