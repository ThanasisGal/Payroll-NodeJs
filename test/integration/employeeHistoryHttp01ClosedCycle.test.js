'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { createSyntheticSettlementStore } = require('../fixtures/employeeHistorySettlementSyntheticStore');
const { typedFixture } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const { store } = require('../fixtures/employeeProfileTransactionStore');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { PROFILE_FIELDS } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const N = require('../../server/services/ergazomenoi/employeeHistorySettlementNormalActivation');
const { createEmployeeHistorySettlementHttpController: create } = require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

function setup() {
    // No real employee data, database, HTTP listener or network requests.
    const fixture = typedFixture(F.references(F.input([1, 2, 3].map(n => F.period(n, {
        hire: '2026-04-23', to: '2026-10-04', hmeromhnia_lhxhs_symbashs: '2026-10-15',
        departure: n === 3 ? '2026-10-04' : null, afora_allagh_oron_ergasias: n !== 3
    })))));
    fixture.currentEmployee.synolo_symbashs = 1300;
    const actor = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };
    const permission = { update: true };
    const db = createSyntheticSettlementStore({ fixture, enriched: false, actor, permission, executionMode: 'NORMAL' });
    const input = db.approvalInput(actor._id);
    const controller = create({ contextProvider: () => db.handle, readSessionProvider: () => {
        const state = db.state();
        return { draft: state, syntheticActor: actor, syntheticPermission: permission, syntheticReferences: state.references };
    } });
    const request = { method: 'GET', session: { userId: actor._id, userTeam: input.scope.team, companyInUse: input.scope.company_kod },
        params: { id: input.employeeId } };
    return { db, controller, request };
}
function response() {
    return { statusCode: 200, set() {}, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } };
}

test('HTTP-01 regression: closed-cycle preview and transactional verification use the same recorded terms', async t => {
    const { db, controller, request } = setup();
    const preview = response(); await controller.preview(request, preview);
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.body.historyStatus, 'CLEAN');
    assert.equal(preview.body.settlementPreview.executionEnabled, true);
    const before = db.state();
    let failure = null, claims = 0;
    const originalApply = W.applyEmployeeEmploymentHistorySettlementInSyntheticStore;
    t.mock.method(W, 'applyEmployeeEmploymentHistorySettlementInSyntheticStore', async options => {
        try { return await originalApply(options); }
        catch (error) { failure = { code: error.code, verificationReason: error.verificationReason }; throw error; }
    });
    const originalClaim = N.claimNormalSettlementAttempt;
    t.mock.method(N, 'claimNormalSettlementAttempt', async input => { claims++; return originalClaim(input); });
    const result = response();
    await controller.apply({ ...request, method: 'POST', body: { approval: {
        confirmed: true, fingerprint: preview.body.approvalFingerprint } } }, result);
    const state = db.state();
    assert.equal(result.statusCode, 200, JSON.stringify({ responseCode: result.body.code, failure, claims,
        commits: db.events.filter(e => e.type === 'commit').length, audits: state.audits.length }));
    assert.equal(result.body.historyStatus, 'CLEAN');
    assert.equal(claims, 1);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT');
    assert.deepEqual(state.references, before.references);
    assert.equal(state.history.length, before.history.length);
    for (const original of before.history) {
        const retained = state.history.find(row => String(row._id) === String(original._id));
        assert.ok(retained, 'every original identity must survive');
        assert.deepEqual(retained._id, original._id);
        assert.equal(retained.aa_eggrafhs, original.aa_eggrafhs);
        for (const field of PROFILE_FIELDS) assert.deepEqual(retained[field], original[field], field);
    }
    const audit = state.audits[0];
    assert.deepEqual(audit.deletedLegacyHistoryIds, []);
    assert.deepEqual(audit.survivingHistoryIds.slice().sort(), before.history.map(row => String(row._id)).sort());
    assert.deepEqual(audit.diagnostics.historyBefore, before.history);
    const ordered = rows => rows.slice().sort((left, right) => String(left._id).localeCompare(String(right._id)));
    assert.deepEqual(ordered(audit.diagnostics.historyAfter), ordered(state.history));
    assert.equal(audit.diagnostics.approvalFingerprint, preview.body.approvalFingerprint);
    assert.ok(audit.diagnostics.referencedUpdates.length > 0, 'protected references must still be checked');
    const active = state.history.filter(row => !row.employment_history_canonical_status);
    assert.equal(active.length, 1);
    assert.equal(active[0].synolo_symbashs, 1200);
    assert.equal(state.employees[0].synolo_symbashs, 1300);
    const clean = response(); await controller.preview(request, clean);
    assert.equal(clean.statusCode, 200);
    assert.equal(clean.body.historyStatus, 'CLEAN');
    assert.equal(clean.body.noOp, true);
    const recognized = response();
    await controller.apply({ ...request, method: 'POST', body: { approval: {
        confirmed: true, fingerprint: preview.body.approvalFingerprint } } }, recognized);
    assert.equal(recognized.statusCode, 200);
    assert.equal(recognized.body.alreadyApplied, true);
    assert.equal(claims, 1, 'recognition must not claim or apply again');
    assert.equal(db.events.filter(e => e.type === 'commit').length, 1);
    assert.deepEqual(db.state(), state);
});

test('HTTP-01 protection: an actual deletion of referenced history is still forbidden and rolls back', async t => {
    const fixture = typedFixture(F.input([
        F.period(1, { hire: '2026-01-01', from: null, afora_proslhpsh: false,
            afora_allagh_oron_ergasias: false, hmeromhnia_allaghs_symbashs: '2026-02-01',
            hmeromhnia_allaghs_orarioy_apo: '2026-02-01',
            hmeromhnia_isxyos_dialleimatos_apo: '2026-02-01' }),
        F.period(2, { hire: '2026-01-01' })
    ]));
    const db = store([{ employee: fixture.currentEmployee, history: fixture.completeHistoryRows }], { cloneFn: clone });
    const before = db.state();
    const historyId = String(fixture.completeHistoryRows[0]._id);
    const references = [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-frozen-result' }];
    let checked = false;
    t.mock.method(db.deps.historyModel, 'deleteMany', () => assert.fail('referenced history cannot reach physical deletion'));
    await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({ ...db.deps,
        scope: fixture.scope, employeeId: String(fixture.currentEmployee._id),
        operations: [{ state: 'deleted', historyId }],
        referenceChecker: async options => {
            assert.ok(options.session);
            assert.deepEqual(options.historyIds, [historyId]);
            checked = true;
            return references;
        }
    }), error => {
        assert.equal(error.code, 'EMPLOYEE_HISTORY_REFERENCED_DELETE_FORBIDDEN');
        assert.equal(error.statusCode, 409);
        assert.deepEqual(error.references, references);
        return true;
    });
    assert.equal(checked, true);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(event => event.type === 'commit').length, 0);
});

test('HTTP-01 regression: aborted synthetic attempt keeps its receipt and cannot be applied by another invocation', async t => {
    const { db, controller, request } = setup();
    let attemptAuditModel, receiptId;
    const originalClaim = N.claimNormalSettlementAttempt;
    t.mock.method(N, 'claimNormalSettlementAttempt', async input => {
        attemptAuditModel = input.auditModel;
        return originalClaim({ ...input, auditModel: { ...input.auditModel,
            async create(...args) {
                const created = await input.auditModel.create(...args);
                receiptId = created[0]._id;
                return created;
            }
        } });
    });
    const preview = response(); await controller.preview(request, preview);
    assert.equal(preview.statusCode, 200);
    const body = { approval: { confirmed: true, fingerprint: preview.body.approvalFingerprint } };
    const before = db.state();
    db.failAt('WRITE');
    const failed = response(); await controller.apply({ ...request, method: 'POST', body }, failed);
    assert.equal(failed.statusCode, 409);
    assert.match(failed.body.message, /ΙΣΤ-ΑΥΤ-HTTP-01/);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 0);
    const readReceipt = () => attemptAuditModel.findById(receiptId).session(null).read('primary').readConcern('majority').lean();
    const receipt = clone(await readReceipt());
    assert.equal(receipt.mutationSource, 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT');
    assert.equal(receipt.diagnostics.fingerprint, body.approval.fingerprint);
    db.failAt(null);
    const blocked = response(); await controller.apply({ ...request, method: 'POST', body }, blocked);
    assert.equal(blocked.statusCode, 503);
    assert.equal(blocked.body.outcome, 'BLOCKED');
    assert.deepEqual(await readReceipt(), receipt, 'the original attempt must remain unchanged');
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 0);
});

test('HTTP-01 regression: changed historical facts still reject the original synthetic approval before a receipt', async t => {
    const { db, controller, request } = setup();
    const preview = response(); await controller.preview(request, preview);
    assert.equal(preview.statusCode, 200);
    const historyId = db.state().history[0]._id;
    db.changeHistory(historyId, { synolo_symbashs: 1400 });
    const before = db.state();
    t.mock.method(N, 'claimNormalSettlementAttempt', () => assert.fail('changed facts cannot claim an attempt'));
    const result = response();
    await controller.apply({ ...request, method: 'POST', body: { approval: {
        confirmed: true, fingerprint: preview.body.approvalFingerprint } } }, result);
    assert.equal(result.statusCode, 409);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.filter(e => e.type === 'commit').length, 0);
});
