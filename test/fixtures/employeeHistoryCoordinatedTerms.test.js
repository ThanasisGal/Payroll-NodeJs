'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { forbidRealSettlementMongo } = require('./forbidRealSettlementMongo');
const { startSettlementHarness } = require('./employeeHistorySettlementHttpHarness');
const { acceptanceB, acceptanceBRecordedTerms, typedFixture } = require('./employeeHistoryCoordinatedSettlementFixture');
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const { coordinateEmployeeHistorySettlement: coordinate } = require('../../server/services/ergazomenoi/employeeHistorySettlementCoordinatorService');
const { inspectEmployeeHistorySave: inspect } = require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const { semanticHistoryRows } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { resolveEmploymentTypeSemantics } = require('../../server/utils/ergazomenoi/employmentTypeSemantics');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const day = value => value && new Date(value).toISOString().slice(0, 10);
const family = number => typedFixture(F.references(F.families.find(item => item.number === number).make()));
const finalInspection = (input, proposal) => inspect({ scope: input.scope,
    currentEmployee: { ...input.currentEmployee, ...proposal.currentPatch }, historyRows: proposal.proposedRows });

test('non-gap acceptance B uses the three original dated documents despite physical overlaps', () => {
    const input = acceptanceB({ overlap: true }), proposal = coordinate(input);
    assert.equal(finalInspection(input, proposal).status, 'CLEAN');
    const rows = semanticHistoryRows(proposal.proposedRows);
    for (const terms of Object.values(acceptanceBRecordedTerms)) {
        const row = rows.find(item => day(item.hmeromhnia_isxyos_oron_ergasias_apo) === terms.from);
        assert.ok(row, terms.documentId);
        assert.equal(day(row.hmeromhnia_isxyos_oron_ergasias_eos), terms.until);
        for (const field of ['krathsh_01', 'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs',
            'nomimosMisthos', 'pragmatikosMisthos', 'synolo_symbashs']) assert.equal(row[field], terms[field]);
    }
});

test('typed split retains its own dated earnings and employment types, independently of acceptance B', () => {
    const input = family(9), proposal = coordinate(input);
    assert.equal(finalInspection(input, proposal).status, 'CLEAN');
    const rows = semanticHistoryRows(proposal.proposedRows).sort((a, b) =>
        a.hmeromhnia_isxyos_oron_ergasias_apo - b.hmeromhnia_isxyos_oron_ergasias_apo);
    assert.deepEqual(rows.map(row => [day(row.hmeromhnia_isxyos_oron_ergasias_apo),
        day(row.hmeromhnia_isxyos_oron_ergasias_eos), row.pragmatikosMisthos, row.nomimosMisthos,
        resolveEmploymentTypeSemantics(row).effectiveValue]), [
        ['2025-12-30', '2025-12-31', 100, 1000, '2'],
        ['2026-01-01', '2026-06-30', 350, 1000, '2'],
        ['2026-07-01', '2026-12-31', 750, 1000, '2'],
        ['2027-01-01', '2027-01-31', 1000, 1000, '0']
    ]);
    assert.ok(rows.every(row => row.krathsh_01 === '0909' && row.symbash === 'SYNTHETIC_SPLIT_CONTRACT'));
});

test('casting never repairs sparse terms, and the unproved February initial gap remains unresolved by the save validator', () => {
    const sparse = F.input([F.period(1)]), cast = typedFixture(sparse);
    for (const row of [cast.currentEmployee, ...cast.completeHistoryRows]) {
        assert.equal(Object.hasOwn(row, 'krathsh_01'), false);
        assert.equal(Object.hasOwn(row, 'kathgoria_symbashs'), false);
    }
    const input = family(2), proposal = coordinate(input), result = finalInspection(input, proposal);
    assert.equal(result.status, 'LEGACY_REVIEW_REQUIRED');
    assert.ok(result.issues.some(issue => issue.field === 'krathsh_01'));
    assert.equal(input.completeHistoryRows.some(row => day(row.hmeromhnia_isxyos_oron_ergasias_apo) === '2026-02-02'), false);
});

for (const [name, make] of [['acceptanceB overlap', () => acceptanceB({ overlap: true })],
    ['typed family 3', () => family(3)], ['typed family 9', () => family(9)]]) {
    for (const field of ['krathsh_01', 'kathgoria_symbashs', 'symbash', 'eidikothta_symbashs',
        'nomimosMisthos', 'pragmatikosMisthos']) {
        test(`${name}: missing initial ${field} cannot commit, retire originals or borrow later terms`, async () => {
            const fixture = make();
            delete fixture.completeHistoryRows[0][field];
            if (name === 'typed family 3') {
                const proposal = coordinate(fixture);
                assert.notEqual(proposal.status, 'CLEAN');
                assert.deepEqual(proposal.proposedRows, []);
            }
            const h = await startSettlementHarness({ fixture, coordinated: true, enriched: false });
            try {
                const before = h.db.state(), preview = await (await h.preview()).json();
                const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
                const result = await response.json();
                assert.equal(response.status, 409, JSON.stringify(result));
                assert.notEqual(result.historyStatus, 'CLEAN');
                assert.deepEqual(h.db.state(), before);
                assert.deepEqual(h.db.state().history, before.history, 'no original can be retired or changed');
                assert.deepEqual(h.db.state().audits, before.audits, 'no successful audit can be persisted');
                assert.equal(h.db.events.some(event => event.type === 'commit'), false);
            } finally { await h.close(); }
        });
    }
    test(`${name}: contradictory employment aliases remain blocked without partial changes`, async () => {
        const fixture = make(), row = fixture.completeHistoryRows[0];
        row.typos_apasxolhshs = row.kathestos_apasxolhshs === '0' ? '2' : '0';
        const h = await startSettlementHarness({ fixture, coordinated: true, enriched: false });
        try {
            const before = h.db.state(), preview = await (await h.preview()).json();
            const response = await h.apply({ approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
            assert.equal(response.status, 409);
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.db.events.some(event => event.type === 'commit'), false);
        } finally { await h.close(); }
    });
}
