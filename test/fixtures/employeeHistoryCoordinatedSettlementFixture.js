'use strict';
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = require('../../server/models/ergazomenoi');
function typedFixture(data) {
    const input = clone(data);
    const cast = (row, model) => Object.fromEntries(Object.entries(row).map(([key,value]) =>
        [key, (() => { try { return value == null ? value : model.schema.path(key)?.cast(value) ?? value; } catch { return value; } })()]));
    input.currentEmployee = cast(input.currentEmployee, E);
    input.completeHistoryRows = input.completeHistoryRows.map(row => cast(row,H));
    return input;
}
function acceptanceB({ overlap = false } = {}) {
    return typedFixture(F.references(F.input([
        F.period(1,{hire:'2025-12-01',to:overlap ? '2026-04-10' : '2026-03-31',departure:'2026-07-31',pay:1100}),
        F.period(2,{hire:'2025-12-01',from:'2026-04-01',to:overlap ? '2026-07-20' : '2026-07-31',departure:'2026-07-31',pay:1300}),
        F.period(3,{hire:'2025-12-01',from:'2026-04-01',to:overlap ? '2026-07-20' : '2026-07-31',departure:'2026-07-31',pay:1300}),
        F.period(4,{hire:'2026-09-16',to:'2027-07-30',pay:1450})
    ])));
}
function acceptanceBWithInitialGap() {
    const input = acceptanceB();
    const removed = input.completeHistoryRows.shift();
    delete input.protectedReferenceSummary[String(removed._id)];
    return input;
}
module.exports = { typedFixture, acceptanceB, acceptanceBWithInitialGap };
