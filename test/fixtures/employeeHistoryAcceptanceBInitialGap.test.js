'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { acceptanceBWithInitialGap, acceptanceBRecordedTerms } = require('./employeeHistoryCoordinatedSettlementFixture');
const { startSettlementHarness } = require('./employeeHistorySettlementHttpHarness');
const { forbidRealSettlementMongo } = require('./forbidRealSettlementMongo');
const { coordinateEmployeeHistorySettlement } = require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService');
const { inspectEmployeeHistorySave } = require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const { employeeHistoryCoverageGaps } = require('../../server/utils/ergazomenoi/employmentHistoryCoverage');
const { semanticHistoryRows } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const inspect = data => inspectEmployeeHistorySave({ scope: data.scope,
    currentEmployee: data.currentEmployee, historyRows: data.completeHistoryRows });
const day = value => value && new Date(value).toISOString().slice(0, 10);

test('acceptanceB retains the initial coverage gap despite complete documentary hire terms', () => {
    const input = acceptanceBWithInitialGap(), before = clone(input);
    const gaps = employeeHistoryCoverageGaps({ currentEmployee: input.currentEmployee, historyRows: input.completeHistoryRows });
    assert.deepEqual(gaps.map(({ from, to }) => ({ from, to })), [{ from: '2025-12-01', to: '2026-03-31' }]);
    assert.notEqual(inspect(input).status, 'CLEAN');
    const hire = input.completeHistoryRows[0];
    assert.equal(hire.hmeromhnia_isxyos_oron_ergasias_apo, null);
    assert.equal(hire.afora_proslhpsh, true);
    assert.equal(hire.afora_allagh_oron_ergasias, false);
    const proposal = coordinateEmployeeHistorySettlement(input);
    assert.equal(proposal.status, 'CLEAN');
    assert.equal(proposal.insertedRows.length, 1);
    assert.deepEqual(proposal.removedHistoryIds, []);
    const final = { ...input, currentEmployee: { ...input.currentEmployee, ...proposal.currentPatch },
        completeHistoryRows: proposal.proposedRows };
    assert.equal(inspect(final).status, 'CLEAN');
    assert.equal(inspect(final).cleanupRequired, false);
    const active = semanticHistoryRows(proposal.proposedRows);
    const initial = active.find(row => day(row.hmeromhnia_isxyos_oron_ergasias_apo) === acceptanceBRecordedTerms.initial.from);
    assert.equal(day(initial.hmeromhnia_isxyos_oron_ergasias_eos), acceptanceBRecordedTerms.initial.until);
    assert.equal(initial.pragmatikosMisthos, 1100);
    assert.equal(initial.krathsh_01, '0101');
    assert.equal(active.find(row => day(row.hmeromhnia_isxyos_oron_ergasias_apo) === '2026-04-01').pragmatikosMisthos, 1300);
    for (const row of input.completeHistoryRows) assert.ok(proposal.proposedRows.some(after => String(after._id) === String(row._id)));
    assert.deepEqual(input, before);
});

test('documented initial terms commit atomically, retain physical originals and reload CLEAN', async () => {
    const fixture = acceptanceBWithInitialGap();
    const h = await startSettlementHarness({ fixture, realHttp: true, normal: true, enriched: false });
    try {
        const before = h.db.state(), preview = await (await h.preview()).json();
        const body = { approval: { confirmed: true, fingerprint: preview.approvalFingerprint } };
        assert.deepEqual(h.db.state(), before, 'preview must not close the gap by writing');
        const response = await h.apply(body), result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(result.historyStatus, 'CLEAN');
        const after = h.db.state();
        assert.equal(after.history.length, before.history.length + 1);
        assert.equal(after.audits.length, 1);
        assert.deepEqual(after.references, before.references);
        for (const original of before.history) {
            const retained = after.history.find(row => String(row._id) === String(original._id));
            assert.ok(retained);
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, updatedAt, ...payload } = retained;
            const { updatedAt: beforeRevision, ...originalPayload } = original;
            assert.deepEqual(payload, originalPayload, 'protected original payload must remain intact');
        }
        const active = semanticHistoryRows(after.history);
        const initial = active.find(row => day(row.hmeromhnia_isxyos_oron_ergasias_apo) === '2025-12-01');
        assert.equal(initial.pragmatikosMisthos, 1100);
        assert.equal(initial.krathsh_01, '0101');
        assert.equal(day(initial.hmeromhnia_isxyos_oron_ergasias_eos), '2026-03-31');
        assert.equal(inspect({ ...fixture, currentEmployee: after.employees[0], completeHistoryRows: after.history }).status, 'CLEAN');
        assert.equal((await (await h.preview()).json()).settlementPreview.state, 'clean');
        assert.equal((await (await h.apply(body)).json()).alreadyApplied, true);
        assert.deepEqual(h.db.state(), after);
    } finally { await h.close(); }
});

for (const fault of ['WRITE', 'AUDIT', 'FINAL']) {
    test(`documented initial-gap ${fault} reaches its failure boundary and rolls everything back`, async () => {
        const h = await startSettlementHarness({ fixture: acceptanceBWithInitialGap(), realHttp: true, normal: true, enriched: false });
        try {
            const preview = await (await h.preview()).json(), before = h.db.state();
            h.db.failAt(fault);
            const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
            const result = await response.json();
            assert.notEqual(response.status, 200);
            if (fault === 'AUDIT') {
                // The writer deliberately validates/persists the final audit
                // before History writes. Prove this specific failure was reached.
                // The normal protocol wraps this thrown audit-create error as
                // a persistence failure; it must not fall back to term validation.
                assert.equal(result.reason, 'PERSISTENCE_FAILED');
                assert.equal(h.db.events.some(event => event.type === 'write' && event.kind === 'history'), false);
            } else assert.ok(h.db.events.some(event => event.type === 'write' && event.kind === 'history'),
                'the injected failure must follow a real transactional History write');
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.db.events.some(event => event.type === 'commit'), false);
        } finally { await h.close(); }
    });
}

for (const field of ['krathsh_01', 'kathgoria_symbashs', 'symbash', 'nomimosMisthos', 'pragmatikosMisthos']) {
    test(`missing actual initial ${field} cannot commit or borrow later terms`, async () => {
        const fixture = acceptanceBWithInitialGap();
        delete fixture.completeHistoryRows[0][field];
        const h = await startSettlementHarness({ fixture, realHttp: true, normal: true, enriched: false });
        try {
            const preview = await (await h.preview()).json(), before = h.db.state();
            const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
            const result = await response.json();
            assert.equal(response.status, 409);
            assert.equal(result.code, 'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN');
            assert.notEqual(result.historyStatus, 'CLEAN');
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.db.events.some(event => event.type === 'commit'), false);
            // Reference fences may be acquired inside the aborted snapshot;
            // no profile insertion or committed business change is allowed.
            assert.equal(h.db.events.some(event => event.type === 'syntheticInsert'), false);
            assert.notEqual(inspect({ ...fixture, currentEmployee: before.employees[0], completeHistoryRows: before.history }).status, 'CLEAN');
        } finally { await h.close(); }
    });
}
