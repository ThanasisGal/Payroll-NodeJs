'use strict';
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = require('../../server/models/ergazomenoi');
// Independent, test-owned documents. The hire's 1100 is not the later 1300.
// These facts exist before preview/approval; no writer supplies missing terms.
const acceptanceBRecordedTerms = Object.freeze({
    initial: Object.freeze({ documentId: 'SYNTHETIC-HIRE-2025-12-01',
        from: '2025-12-01', until: '2026-03-31', krathsh_01: '0101',
        symbash: 'SYNTHETIC_CONTRACT', kathgoria_symbashs: '01',
        eidikothta_symbashs: 'SYNTHETIC_SPECIALTY', nomimosMisthos: 1000,
        pragmatikosMisthos: 1100, synolo_symbashs: 1100 }),
    change: Object.freeze({ documentId: 'SYNTHETIC-AMENDMENT-2026-04-01',
        from: '2026-04-01', until: '2026-07-31', krathsh_01: '0102',
        symbash: 'SYNTHETIC_CONTRACT', kathgoria_symbashs: '01',
        eidikothta_symbashs: 'SYNTHETIC_SPECIALTY', nomimosMisthos: 1000,
        pragmatikosMisthos: 1300, synolo_symbashs: 1300 }),
    rehire: Object.freeze({ documentId: 'SYNTHETIC-REHIRE-2026-09-16',
        from: '2026-09-16', until: '2027-07-30', krathsh_01: '0103',
        symbash: 'SYNTHETIC_CONTRACT', kathgoria_symbashs: '01',
        eidikothta_symbashs: 'SYNTHETIC_SPECIALTY', nomimosMisthos: 1000,
        pragmatikosMisthos: 1450, synolo_symbashs: 1450 })
});
function typedFixture(data) {
    const input = clone(data);
    const cast = (row, model) => Object.fromEntries(Object.entries(row).map(([key,value]) =>
        [key, (() => { try { return value == null ? value : model.schema.path(key)?.cast(value) ?? value; } catch { return value; } })()]));
    input.currentEmployee = cast(input.currentEmployee, E);
    input.completeHistoryRows = input.completeHistoryRows.map(row => cast(row,H));
    return input;
}
function acceptanceB({ overlap = false } = {}) {
    const input = typedFixture(F.references(F.input([
        F.period(1,{hire:'2025-12-01',to:overlap ? '2026-04-10' : '2026-03-31',departure:'2026-07-31',pay:1100}),
        F.period(2,{hire:'2025-12-01',from:'2026-04-01',to:overlap ? '2026-07-20' : '2026-07-31',departure:'2026-07-31',pay:1300}),
        F.period(3,{hire:'2025-12-01',from:'2026-04-01',to:overlap ? '2026-07-20' : '2026-07-31',departure:'2026-07-31',pay:1300}),
        F.period(4,{hire:'2026-09-16',to:'2027-07-30',pay:1450})
    ])));
    // The same three independent documents apply to the non-gap scenario.
    // Overlapping physical dates do not move April's terms back to the hire.
    const facts = ({ documentId, from, until, ...terms }) => terms;
    for (const row of input.completeHistoryRows) Object.assign(row, facts(
        row.aa_eggrafhs === '0001' ? acceptanceBRecordedTerms.initial :
            row.aa_eggrafhs === '0004' ? acceptanceBRecordedTerms.rehire : acceptanceBRecordedTerms.change));
    Object.assign(input.currentEmployee, facts(acceptanceBRecordedTerms.rehire));
    return input;
}
function acceptanceBWithInitialGap() {
    const input = acceptanceB();
    const facts = ({ documentId, from, until, ...terms }) => terms;
    for (const row of input.completeHistoryRows) Object.assign(row, facts(
        row.aa_eggrafhs === '0001' ? acceptanceBRecordedTerms.initial :
            row.aa_eggrafhs === '0004' ? acceptanceBRecordedTerms.rehire : acceptanceBRecordedTerms.change));
    Object.assign(input.currentEmployee, facts(acceptanceBRecordedTerms.rehire));
    // Keep the documented hire event and its frozen reference, but no effective
    // initial profile period. Coverage must still report 01/12--31/03 missing.
    // The existing planner must materialize that period atomically, retaining
    // the physical hire event instead of borrowing the April terms.
    Object.assign(input.completeHistoryRows[0], {
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_allagh_oron_ergasias: false
    });
    return input;
}
module.exports = { typedFixture, acceptanceB, acceptanceBWithInitialGap, acceptanceBRecordedTerms };
