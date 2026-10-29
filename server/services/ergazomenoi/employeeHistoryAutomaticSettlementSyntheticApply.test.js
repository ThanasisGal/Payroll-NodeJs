'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const P = require('./employeeHistoryAutomaticReconstructionPlannerService');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { createSyntheticSettlementStore } = require('../../../test/fixtures/employeeHistorySettlementSyntheticStore');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const FIELD = 'employee_profile_mutation_sequence';
const ACTOR = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
const now = new Date('2026-10-28T12:00:00.000Z');

before(() => {
    const forbidden = () => assert.fail('Real MongoDB access is forbidden in synthetic application tests');
    for (const method of ['connect', 'createConnection', 'startSession']) mock.method(mongoose, method, forbidden);
    for (const method of ['openUri', 'startSession', 'transaction']) mock.method(mongoose.connection, method, forbidden);
    mock.method(mongoose.Model.prototype, 'save', forbidden);
    for (const method of ['find', 'findOne', 'findById', 'aggregate', 'create', 'updateOne',
        'updateMany', 'deleteOne', 'deleteMany', 'insertMany', 'bulkWrite']) mock.method(mongoose.Model, method, forbidden);
});
after(() => mock.restoreAll());

function setup({ actor = ACTOR, permission = { update: true }, enriched = true, recordedCoverage = false } = {}) {
    const db = createSyntheticSettlementStore({ actor, permission, enriched, recordedCoverage });
    const input = db.approvalInput(ACTOR._id);
    const proposal = P.planEmployeeHistoryAutomaticSettlement(input);
    const fingerprint = proposal.status === 'CLEAN'
        ? S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) : 'x'.repeat(43);
    const options = { syntheticStore: db.handle, scope: input.scope, employeeId: input.employeeId,
        actorUserId: ACTOR._id, approval: { confirmed: true, fingerprint }, now };
    return { db, input, proposal, options,
        run: overrides => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ ...options, ...overrides }) };
}
function unchanged(db, before) { assert.deepEqual(db.state(), before); }

test('memory:v3 enriched 0006 commits exact approved changes, one audit, CLEAN coverage and intact frozen provenance', async () => {
    const { db, input, proposal, run, options } = setup(), before = db.state();
    assert.equal(proposal.version, 'employee-history-automatic-settlement:memory:v3');
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(before.history.filter(row => !isInactiveHistoryRow(row)).length, 3);
    const result = await run(), after = db.state();
    assert.equal(result.applied, true);
    assert.equal(result.changedRows, 3);
    assert.equal(result.physicalRows, 3);
    assert.equal(result.activeRows, 1);
    assert.equal(result.verification.status, 'CLEAN');
    assert.deepEqual(result.verification.coverageGaps, []);
    assert.equal(result.verification.cycles.length, 1);
    assert.equal(result.verification.canonicalIdempotent, true);
    assert.equal(after.history.length, 3);
    assert.equal(after.history.filter(isInactiveHistoryRow).length, 2);
    const { [FIELD]: sequence, ...current } = after.employees[0];
    assert.equal(sequence, 1);
    assert.deepEqual(current, before.employees[0]);
    assert.deepEqual(after.references, before.references);
    for (const original of before.history.slice(0, 2)) {
        const target = after.history.find(row => String(row._id) === String(original._id));
        const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = target;
        const { updatedAt: oldRevision, ...oldPayload } = original;
        assert.equal(employment_history_canonical_status, 'REDUNDANT_REFERENCED');
        assert.equal(String(employment_history_canonical_survivor_id), '600000000000000000000003');
        assert.deepEqual(updatedAt, now);
        assert.deepEqual(payload, oldPayload);
        assert.ok(target._id instanceof mongoose.Types.ObjectId);
    }
    const survivor = after.history.find(row => !isInactiveHistoryRow(row));
    assert.deepEqual(survivor, { ...before.history[2], hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-15'), updatedAt: now });
    assert.equal(after.audits.length, 1);
    assert.equal(after.audits[0].diagnostics.approvalFingerprint, options.approval.fingerprint);
    assert.deepEqual(after.audits[0].diagnostics.historyBefore, before.history);
    assert.deepEqual(A.ordered(after.audits[0].diagnostics.historyAfter), A.ordered(after.history));
    assert.equal(after.audits[0].diagnostics.actorUserId, ACTOR._id);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    assert.equal(new Set(db.events.map(event => event.session)).size, 1);
    assert.equal(mongoose.connection.readyState, 0);
    assert.deepEqual(input.currentEmployee, before.employees[0]);
});

test('second application of the exact same approval makes no additional committed changes or audit', async () => {
    const { db, run } = setup();
    await run(); const committed = db.state();
    const second = await run();
    assert.deepEqual(second, { applied: false, alreadyApplied: true, historyStatus: 'CLEAN' });
    unchanged(db, committed);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});

test('Supervisor applies once and recognizes the exact approval without duplicate changes or audit', async () => {
    const actor = { ...ACTOR, privileges: 'S', team: 'TEST' };
    const { db, run } = setup({ actor, recordedCoverage: true }), before = db.state();
    assert.equal((await run()).applied, true);
    const committed = db.state();
    assert.deepEqual(await run(), { applied: false, alreadyApplied: true, historyStatus: 'CLEAN' });
    unchanged(db, committed);
    assert.equal(committed.audits.length, 1);
    assert.equal(committed.history.length, 3);
    assert.equal(committed.history.filter(isInactiveHistoryRow).length, 2);
    assert.deepEqual(committed.references, before.references);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});

test('Supervisor cannot settle the original uncovered cycle, even with an approved deterministic proposal', async () => {
    const { db, run } = setup({ actor: { ...ACTOR, privileges: 'S', team: 'TEST' } });
    const before = db.state();
    await assert.rejects(run, { code: 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN' });
    unchanged(db, before);
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});

test('an administrator-only correction remains forbidden to Supervisor, including replay after administrator application', async () => {
    const actor = { ...ACTOR, privileges: 'S', team: 'TEST' };
    const { db, run } = setup({ actor });
    for (const row of db.state().history) db.changeHistory(row._id, { hmeromhnia_proslhpshs: undefined });
    const input = db.approvalInput(ACTOR._id), proposal = P.planEmployeeHistoryAutomaticSettlement(input);
    assert.equal(proposal.status, 'CLEAN');
    const approval = { confirmed: true, fingerprint: S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) };
    const before = db.state();
    await assert.rejects(() => run({ approval }), error =>
        ['EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN', 'EMPLOYEE_HISTORY_CORRECTION_ADMIN_REQUIRED'].includes(error.code));
    unchanged(db, before);
    actor.privileges = 'A'; actor.team = 'THA';
    assert.equal((await run({ approval })).applied, true);
    const committed = db.state();
    actor.privileges = 'S'; actor.team = 'TEST';
    await assert.rejects(() => run({ approval }), error =>
        ['EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN', 'EMPLOYEE_HISTORY_CORRECTION_ADMIN_REQUIRED'].includes(error.code));
    unchanged(db, committed);
    assert.equal(committed.audits.length, 1);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});

for (const revoked of ['role', 'permission', 'team', 'active']) {
    test(`already-applied approval cannot bypass revoked ${revoked} authorization`, async () => {
        const actor = { ...ACTOR, privileges: 'S', team: 'TEST' }, permission = { update: true };
        const { db, run } = setup({ actor, permission, recordedCoverage: true });
        await run();
        const committed = db.state();
        if (revoked === 'role') actor.privileges = 'U';
        if (revoked === 'permission') permission.update = false;
        if (revoked === 'team') actor.team = 'OTHER';
        if (revoked === 'active') actor.situation = 'I';
        await assert.rejects(run, error => error.statusCode === 403);
        unchanged(db, committed);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    });
}

for (const role of ['A', 'S']) {
    test(`${role}: lost acknowledgement after commit is UNKNOWN; same approval safely recognizes the single application`, async () => {
        const actor = { ...ACTOR, privileges: role, team: role === 'S' ? 'TEST' : 'THA' };
        const { db, run } = setup({ actor, recordedCoverage: role === 'S' }), before = db.state();
        db.failAt('COMMIT_ACK_LOST');
        await assert.rejects(run, error => {
            assert.equal(error.code, A.PREFIX + 'COMMIT_UNCERTAIN');
            assert.equal(error.statusCode, 503);
            assert.equal(error.commitStatus, 'UNKNOWN');
            assert.equal(error.retryWithSameApproval, true);
            assert.match(error.message, /άγνωστο αν αποθηκεύτηκαν αλλαγές/);
            assert.match(error.message, /1\..*2\./);
            assert.doesNotMatch(error.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
            return true;
        });
        const committed = db.state();
        assert.equal(committed.audits.length, 1);
        assert.equal(committed.history.length, 3);
        assert.equal(committed.history.filter(isInactiveHistoryRow).length, 2);
        assert.deepEqual(committed.references, before.references);
        assert.deepEqual(committed.audits[0].diagnostics.historyBefore, before.history);
        for (const original of before.history.slice(0, 2)) {
            const target = committed.history.find(row => String(row._id) === String(original._id));
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = target;
            const { updatedAt: previousRevision, ...oldPayload } = original;
            assert.deepEqual(payload, oldPayload);
        }
        assert.deepEqual(await run(), { applied: false, alreadyApplied: true, historyStatus: 'CLEAN' });
        unchanged(db, committed);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    });
}

test('unknown outcome without a committed draft allows the same approval to apply exactly once on retry', async () => {
    const { db, run } = setup({ actor: { ...ACTOR, privileges: 'S', team: 'TEST' }, recordedCoverage: true });
    const before = db.state();
    db.failAt('COMMIT_UNKNOWN_BEFORE');
    await assert.rejects(run, { code: A.PREFIX + 'COMMIT_UNCERTAIN', commitStatus: 'UNKNOWN' });
    unchanged(db, before);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 0);
    assert.equal((await run()).applied, true);
    const committed = db.state();
    assert.equal((await run()).alreadyApplied, true);
    unchanged(db, committed);
    assert.equal(committed.audits.length, 1);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
});

test('repeat approval fails closed after a later employee change or protected reference', async () => {
    for (const change of ['employee', 'reference', 'approval']) {
        const { db, run, input } = setup({ actor: { ...ACTOR, privileges: 'S', team: 'TEST' }, recordedCoverage: true });
        await run();
        if (change === 'employee') db.changeEmployee({ parathrhseis: 'later synthetic change' });
        if (change === 'reference') db.addReference(input.completeHistoryRows[0]._id);
        const committed = db.state();
        await assert.rejects(() => run(change === 'approval'
            ? { approval: { confirmed: true, fingerprint: 'x'.repeat(43) } } : {}), { code: S.PREFIX + 'STALE' });
        unchanged(db, committed);
        assert.equal(committed.audits.length, 1);
    }
});

for (const failure of ['WRITE', 'AUDIT', 'AUDIT_EMPTY', 'AUDIT_TAMPER', 'FINAL', 'AUDIT_MISSING', 'REFERENCES']) {
    test(`${failure}: discard employee fence, every history change and audit together`, async () => {
        const { db, run } = setup(), before = db.state();
        db.failAt(failure);
        await assert.rejects(run);
        unchanged(db, before);
        assert.equal(db.events.some(event => event.type === 'commit'), false);
        if (['WRITE', 'AUDIT', 'AUDIT_EMPTY', 'AUDIT_TAMPER', 'FINAL'].includes(failure)) {
            assert.ok(db.events.some(event => event.type === 'write' && event.kind === 'history'));
        }
    });
}

for (const [label, actor, permission] of [
    ['inactive user', { ...ACTOR, situation: 'I' }, { update: true }],
    ['other team', { ...ACTOR, team: 'OTHER' }, { update: true }],
    ['read only', ACTOR, { read: true }],
    ['ordinary role lacks history management', { ...ACTOR, privileges: 'U', team: 'TEST' }, { update: true }],
    ['missing user record', null, { update: true }]
]) test(`${label}: existing authorization rejects and rolls back`, async () => {
    const { db, run } = setup({ actor, permission }), before = db.state();
    await assert.rejects(run, error => error.statusCode === 403);
    unchanged(db, before);
});

test('missing identity, explicit approval and extra mutation instructions are rejected before any transaction', async () => {
    for (const override of [
        { actorUserId: undefined }, { employeeId: undefined }, { scope: { team: 'TEST' } },
        { approval: undefined }, { approval: { confirmed: false, fingerprint: 'x'.repeat(43) } },
        { operations: [] }, { proposal: {} }, { connection: mongoose.connection }
    ]) {
        const { db, run } = setup(), before = db.state();
        await assert.rejects(() => run(override));
        unchanged(db, before);
        assert.equal(db.events.length, 0);
    }
});

test('a JSON object or real MongoDB connection cannot masquerade as the synthetic capability', async () => {
    for (const syntheticStore of [{}, mongoose.connection, null]) {
        const { db, run } = setup(), before = db.state();
        await assert.rejects(() => run({ syntheticStore }), { code: S.PREFIX + 'SYNTHETIC_STORE_REQUIRED' });
        unchanged(db, before);
        assert.equal(db.events.length, 0);
    }
});

test('changed approval and post-preview Employee state are stale, including unrelated business fields', async () => {
    const first = setup(), original = first.db.state();
    await assert.rejects(() => first.run({ approval: { confirmed: true, fingerprint: 'x'.repeat(43) } }),
        { code: S.PREFIX + 'STALE' });
    unchanged(first.db, original);
    const second = setup();
    second.db.changeEmployee({ parathrhseis: 'synthetic second-user edit' });
    const changed = second.db.state();
    await assert.rejects(second.run, { code: S.PREFIX + 'STALE' });
    unchanged(second.db, changed);
});

test('new protected reference after approval invalidates the plan even in an already referenced collection', async () => {
    const { db, run, input } = setup();
    db.addReference(input.completeHistoryRows[0]._id);
    const changed = db.state();
    await assert.rejects(run, { code: S.PREFIX + 'STALE' });
    unchanged(db, changed);
});

for (const kind of ['Employee', 'History reference']) test(`concurrent ${kind} change: snapshot conflict retries then rejects old approval without losing the other change`, async () => {
    const { db, run, input } = setup(), barrier = db.pauseNextHistoryRead();
    const pending = run();
    await barrier.reached;
    if (kind === 'Employee') db.changeEmployee({ parathrhseis: 'synthetic concurrent user' });
    else db.addReference(input.completeHistoryRows[0]._id);
    const otherCommitted = db.state();
    barrier.resume();
    await assert.rejects(() => pending, { code: S.PREFIX + 'STALE' });
    unchanged(db, otherCommitted);
    assert.ok(db.events.some(event => event.type === 'retry'));
    assert.equal(db.events.some(event => event.type === 'commit'), false);
});

test('the original incomplete 0006 remains REVIEW_REQUIRED and cannot be applied with a forged approval', async () => {
    const { db, run, proposal } = setup({ enriched: false }), before = db.state();
    assert.equal(proposal.status, 'REVIEW_REQUIRED');
    assert.equal(proposal.reason, 'NUMERIC_PROFILE_FACT_UNRECORDED');
    await assert.rejects(run, { code: S.PREFIX + 'REVIEW_REQUIRED' });
    unchanged(db, before);
    assert.equal(db.events.some(event => event.type === 'write' || event.type === 'commit'), false);
});
