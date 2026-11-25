'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const Archive = require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const digest = value => createHash('sha256').update(value).digest('hex');

test('Large protected BSON: approved correction retains five original snapshots and archive, with bounded Audit',
    { skip: !binary, timeout: 180000 }, async t => {
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    const f = await seedApprovedProposal(db);
    const archived = await db.historyModel.findById(f.history[1]._id).lean();
    await db.auditModel.collection.insertOne({ employeeScope: { ...f.scope, employee_id: f.employee._id },
        repairedAt: new Date(), currentBefore: f.employee, historyBefore: [archived], historyAfter: [archived],
        survivingHistoryIds: [String(archived._id)], deletedLegacyHistoryIds: [], mutationSource: Archive.OPERATION,
        diagnostics: { version: Archive.VERSION, outcome: 'COMMITTED', actorUserId: String(f.actor),
            targetHistoryId: String(archived._id), newState: Archive.STATUS, originalRowHash: Archive.rowHash(archived),
            acceptedIssues: [], acceptedFindings: [] } });
    const originalInput = f.input;
    f.input = async () => { const input = await originalInput(); return { ...input, archiveAudits: await Archive.loadArchives(input, db.auditModel) }; };
    const snapshots = Array.from({ length: 8 }, (_, index) => ({
        _id: new mongoose.Types.ObjectId(), team: f.scope.team, company_kod: f.scope.company_kod, ypokatasthma: '0001',
        period_start: new Date('2026-01-01'), period_end: new Date('2026-12-31'),
        snapshot_schema_version: 'synthetic:v1', source_calculation_version: 'synthetic:v1',
        frozen_snapshot_fingerprint: String(index).repeat(64),
        frozen_snapshot: { daily_results: [{effective_profile_istoriko_id: String(f.history[0]._id)}], numericPayload: new Array(400000).fill(index + 1) },
        finalized_at: new Date(), finalized_by_user_id: f.actor, finalized_by_user_name: 'Synthetic', finalized_by_user_role: 'A'
    }));
    for (const snapshot of snapshots) await db.frozenModel.collection.insertOne(snapshot);
    const frozen = async () => (await db.frozenModel.collection.find({ company_kod: f.scope.company_kod }, { raw: true }).sort({ _id: 1 }).toArray()).map(digest);
    const originalFrozen = await frozen();
    const commands = [], replies = [], timings = []; let phase = 'prepare';
    const onCommand = event => commands.push({ phase, name: event.commandName,
        collection: event.commandName === 'getMore' ? event.command.collection : typeof event.command[event.commandName] === 'string' ? event.command[event.commandName] : null,
        bytes: mongoose.mongo.BSON.calculateObjectSize(event.command) });
    const onReply = event => replies.push({phase, bytes: mongoose.mongo.BSON.calculateObjectSize(event.reply)});
    db.connection.getClient().on('commandSucceeded', onReply);
    t.after(() => db.connection.getClient().off('commandSucceeded', onReply));
    db.connection.getClient().on('commandStarted', onCommand);
    t.after(() => db.connection.getClient().off('commandStarted', onCommand));
    const service = createEmployeeHistoryApprovedProposalService({ ...f.dependencies,
        logger: { info(event, record) { timings.push({ event, ...record }); } } });
    const proposal = await approvedProposalBody(f);
    phase = 'preview'; const previewStart = performance.now();
    const preview = await service.preview(f.req, proposal);
    const previewMs = performance.now() - previewStart;
    assert.equal(preview.physicalWrites.history.mode, 'CORRECTION_EDITION');
    const body = { proposal, approval: { token: preview.approval.token, confirmed: true } };
    phase = 'apply'; const applyStart = performance.now(); let result, failure;
    try { result = await service.apply(f.req, body); } catch (error) { failure = error; }
    const applyMs = performance.now() - applyStart;
    console.log('LARGE_PROTECTION_BENCHMARK', JSON.stringify({ previewMs: +previewMs.toFixed(2), applyMs: +applyMs.toFixed(2),
        commandCount: commands.filter(c => c.phase === 'apply').length,
        snapshotReads: commands.filter(c=>c.phase==='apply' && c.collection===db.frozenModel.collection.name && ['find','getMore'].includes(c.name)).length,
        snapshotUpdates: commands.filter(c=>c.phase==='apply' && c.collection===db.frozenModel.collection.name && c.name==='update').length,
        sentBsonBytes: commands.filter(c=>c.phase==='apply').reduce((sum,c)=>sum+c.bytes,0),
        receivedBsonBytes: replies.filter(c=>c.phase==='apply').reduce((sum,c)=>sum+c.bytes,0),
        reconcileMs: timings.find(t=>t.stage==='apply.reconcile')?.durationMs,
        stages: timings.filter(t=>['apply.prepare','apply.protection.claim','apply.reconcile','apply.commit'].includes(t.stage)),
        largestCommandBytes: Math.max(0, ...commands.filter(c => c.phase === 'apply').map(c => c.bytes)),
        failure: failure ? { name: failure.name, code: failure.code } : null }));
    // This assertion is deliberately RED on the old full-snapshot Audit writer.
    assert.equal(failure?.code || null, null, 'The approved writer must serialize an Audit containing compact protection evidence');
    assert.equal(result.verification.persisted, true);
    assert.deepEqual(await frozen(), originalFrozen);
    assert.equal(A.equal(await db.historyModel.findById(archived._id).lean(), archived), true);
    const audits = await db.auditModel.find({ 'employeeScope.employee_id': f.employee._id }).lean();
    const audit = audits.find(a => a.mutationSource === 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY');
    assert.ok(audit); assert.equal(audits.filter(a => a.mutationSource === Archive.OPERATION).length, 1);
    assert.equal(audit.diagnostics.rowApproval.mode, 'CORRECTION_EDITION');
    assert.equal(audit.diagnostics.rowApproval.status, 'APPROVED_RESOLVED');
    assert.equal(audit.diagnostics.periodProtection.snapshots.length, snapshots.length);
    assert.equal(audit.diagnostics.periodProtection.wire.filter(p => p.collection === db.frozenModel.collection.name).length, snapshots.length);
    assert.ok(audit.diagnostics.periodProtection.snapshots.every(s => !Object.hasOwn(s, 'frozen_snapshot')));
    assert.ok(mongoose.mongo.BSON.calculateObjectSize(audit) < 200000);
    assert.ok(commands.filter(c => c.phase === 'apply').every(c => c.bytes < 16 * 1024 * 1024));
    const duplicate = await service.apply(f.req, body); assert.equal(duplicate.alreadyApplied, true);
    assert.equal(await db.auditModel.countDocuments({ ...Archive.scopeFilter({ scope: f.scope, currentEmployee: f.employee }),
        mutationSource: 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY' }), 1);
    assert.deepEqual(await frozen(), originalFrozen);
    assert.ok(timings.some(t => t.stage === 'apply.authorization'));
    assert.ok(timings.some(t => t.stage === 'apply.audit.insert' && t.bsonBytes > 0));
    assert.ok(timings.some(t => t.stage === 'apply.commit'));
    assert.ok(timings.some(t => t.stage.includes('reconcile')));
    assert.equal(JSON.stringify(timings).includes('Synthetic'), false);
});


test('Compact protection reuse preserves post-claim hashes, conflict detection and transaction-attempt isolation',
    { skip: !binary, timeout: 60000 }, async t => {
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    const f = await seedApprovedProposal(db);
    const Protection = require('../../server/services/ergazomenoi/employeeHistoryLegacyProtectionService');
    const snapshot = { _id: new mongoose.Types.ObjectId(), ...f.scope, ypokatasthma: '0001',
        period_start: new Date('2026-01-01'), period_end: new Date('2026-12-31'),
        frozen_snapshot_fingerprint: 'a'.repeat(64), frozen_snapshot: { privatePayload: [1, 2, 3] } };
    await db.frozenModel.collection.insertOne(snapshot);
    const session = await db.connection.startSession(); t.after(() => session.endSession());
    const input = { scope: f.scope }, period = { from: '2026-01-01', to: '2026-12-31' };
    const read = () => Protection.readLegacyProtection({ input, period, session, dependencies: db, preserveOriginal: true, compactEvidence: true });
    let readingClaims = false, reads = 0;
    const count = e => { if (readingClaims && e.commandName === 'find') reads++; };
    db.connection.getClient().on('commandStarted', count); t.after(() => db.connection.getClient().off('commandStarted', count));
    session.startTransaction();
    const first = await read(); readingClaims = true;
    await Protection.claimLegacyProtection({ protection: first, connection: db.connection, session });
    readingClaims = false;
    assert.equal(reads, first.wire.length, 'Only redundant pre-claim reads are removed');
    await session.abortTransaction();

    session.startTransaction(); reads = 0; readingClaims = true;
    await Protection.claimLegacyProtection({ protection: first, connection: db.connection, session });
    readingClaims = false;
    assert.equal(reads, first.wire.length * 2, 'The same session in a new transaction cannot reuse old reads');
    await session.abortTransaction();

    session.startTransaction(); const tampered = await read();
    await db.frozenModel.collection.updateOne({ _id: snapshot._id }, { $set: { 'frozen_snapshot.privatePayload': [9] } }, { session });
    await assert.rejects(Protection.claimLegacyProtection({ protection: tampered, connection: db.connection, session }), e => e.reason === 'VERIFICATION');
    await session.abortTransaction();
    assert.deepEqual((await db.frozenModel.collection.findOne({ _id: snapshot._id })).frozen_snapshot, snapshot.frozen_snapshot);

    session.startTransaction(); const stale = await read();
    await db.frozenModel.collection.updateOne({ _id: snapshot._id }, { $set: { 'frozen_snapshot.privatePayload': [8] } });
    await assert.rejects(Protection.claimLegacyProtection({ protection: stale, connection: db.connection, session }),
        e => e.code === 112 || e.hasErrorLabel?.('TransientTransactionError'));
    await session.abortTransaction();
    assert.equal(await db.auditModel.countDocuments({ mutationSource: 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY' }), 0);
});
