'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { typedFixture } = require('../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const F = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { planEmployeeHistoryAutomaticReconstruction: reconstruct } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { coordinateEmployeeHistorySettlement: coordinate } = require('./employeeHistorySettlementCoordinatorService');
const { inspectEmployeeHistorySave: inspect } = require('./employeeHistorySaveValidationService');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { historyCompletionStatus, isNoOp } = require('./employeeHistoryAutomaticReconstructionApplyContract');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const input = (number = 3) => typedFixture(F.references(F.families.find(f => f.number === number).make()));
const strict = data => reconstruct({ ...data, requireRecordedNumericFacts: true,
    preserveUnrecordedNumbers: true, preserveRecordedBoundaries: true });
const day = value => value && new Date(value).toISOString().slice(0, 10);
const contractFields = ['krathsh_01', 'kathgoria_symbashs', 'symbash', 'eidikothta_symbashs'];

for (const field of [...contractFields, ...C.CRITICAL_NUMBERS, 'kathestos_apasxolhshs',
    'typos_ebdomadas', 'nomimosMisthos', 'pragmatikosMisthos', 'evelikth_proselefsh']) {
    test(`a later period alone cannot certify earlier ${field}`, () => {
        const data = input(), earlier = data.completeHistoryRows[0];
        delete earlier[field];
        const before = clone(data), result = strict(data);
        assert.equal(result.status, 'REVIEW_REQUIRED');
        assert.ok(result.warnings.some(w => w.code === 'HISTORICAL_PROFILE_FACT_UNRECORDED' && w.field === field));
        assert.equal(Object.hasOwn(result.logicalPeriods[0].profile, field), false);
        assert.equal(result.rowDiffs.some(change => String(change.historyId) === String(earlier._id) && change.field === field), false);
        assert.equal(historyCompletionStatus({ ...data, plan: result }), 'REVIEW_REQUIRED');
        assert.deepEqual(data, before);
    });
}

async function assertCommitted(data) {
    const proposal = coordinate(data);
    assert.equal(proposal.status, 'CLEAN', JSON.stringify(proposal));
    assert.equal(inspect({ scope: data.scope, currentEmployee: { ...data.currentEmployee, ...proposal.currentPatch },
        historyRows: proposal.proposedRows }).status, 'CLEAN');
    const h = await startSettlementHarness({ fixture: data, coordinated: true, enriched: false });
    try {
        const before = h.db.state(), preview = await (await h.preview()).json();
        const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
        const result = await response.json(), after = h.db.state();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(result.historyStatus, 'CLEAN');
        assert.equal(after.audits.length, 1);
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
        assert.deepEqual(after.references, before.references);
        assert.ok(before.history.every(row => after.history.some(stored => String(stored._id) === String(row._id))));
        return semanticHistoryRows(after.history);
    } finally { await h.close(); }
}

test('documented compatible previous terms still continue forward and commit CLEAN', async () => {
    const data = input();
    for (const field of contractFields) {
        delete data.completeHistoryRows[1][field];
        delete data.currentEmployee[field];
    }
    const result = strict(data), later = result.logicalPeriods.find(period => period.from === '2026-04-10');
    for (const field of contractFields) {
        assert.equal(later.profile[field], data.completeHistoryRows[0][field]);
        assert.equal(later.fieldProvenance[field].sourceType, 'PREVIOUS_PERIOD');
    }
    const rows = await assertCommitted(data);
    assert.ok(rows.every(row => row.pragmatikosMisthos === 1200 && row.nomimosMisthos === 1000 && row.krathsh_01 === '0901'));
});

test('independent evidence explicitly effective in the earlier period survives later physical recording and different later pay/KPK', async () => {
    const data = input(4), earlier = data.completeHistoryRows[0];
    const document = { ...earlier, _id: F.identity(99), aa_eggrafhs: '0099', krathsh_01: '0888',
        createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-01') };
    delete earlier.krathsh_01;
    data.completeHistoryRows.push(document);
    data.protectedReferenceSummary[String(document._id)] = [];
    const result = strict(data);
    assert.equal(result.logicalPeriods[0].profile.krathsh_01, '0888');
    assert.equal(String(result.logicalPeriods[0].fieldProvenance.krathsh_01.sourceHistoryId), String(document._id));
    assert.equal(result.warnings.some(w => w.code === 'HISTORICAL_PROFILE_FACT_UNRECORDED'), false);
    const rows = await assertCommitted(data);
    const initial = rows.find(row => day(row[C.START]) === '2026-01-01');
    const later = rows.find(row => day(row[C.START]) === '2026-04-10');
    assert.equal(initial.krathsh_01, '0888'); assert.equal(initial.pragmatikosMisthos, 1200);
    assert.equal(later.krathsh_01, '0901'); assert.equal(later.pragmatikosMisthos, 1400);
});

test('an independently dated applicable current snapshot resolves uncertainty without a stale future-only warning', () => {
    const data = input();
    delete data.completeHistoryRows[0].krathsh_01;
    data.currentEmployee[C.START] = new Date('2026-01-01');
    data.currentEmployee[C.CHANGE] = new Date('2026-01-01');
    const result = strict(data);
    assert.equal(result.logicalPeriods[0].profile.krathsh_01, '0901');
    assert.equal(result.logicalPeriods[0].fieldProvenance.krathsh_01.sourceType, 'CURRENT_EMPLOYEE');
    assert.equal(result.warnings.some(w => w.code === 'HISTORICAL_PROFILE_FACT_UNRECORDED'), false);
});

test('undated current values cannot disguise rejected future-only evidence', () => {
    const data = input();
    delete data.completeHistoryRows[0].krathsh_01;
    delete data.currentEmployee[C.START];
    delete data.currentEmployee[C.CHANGE];
    const result = reconstruct(data);
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.equal(Object.hasOwn(result.logicalPeriods[0].profile, 'krathsh_01'), false);
    assert.ok(result.warnings.some(w => w.code === 'HISTORICAL_PROFILE_FACT_UNRECORDED' && w.field === 'krathsh_01'));
});

test('a second-pass structural fixed point cannot certify unresolved initial terms CLEAN', () => {
    const data = input();
    delete data.completeHistoryRows[0].krathsh_01;
    const first = strict(data), repeatedInput = { ...data, completeHistoryRows: first.proposedRows };
    const repeated = strict(repeatedInput);
    assert.equal(repeated.rowDiffs.length, 0);
    assert.equal(isNoOp(repeated), true);
    assert.equal(historyCompletionStatus({ ...repeatedInput, plan: repeated }), 'REVIEW_REQUIRED');
});
