'use strict';
const { settlementDecisionFixture } = require('./employeeHistorySettlementDecisionFixture');
const { shapeBCorrectedProfileFixture } = require('../../server/services/ergazomenoi/fixtures/uniqueSafeEmployeeHistoryRepairFixtures');
const { periodSplitFixture } = require('./employeeHistoryPeriodSplitFixture');
const { competingDepartureDatesFixture, departureAndHistoricalPayFactFixture } = require('../../server/services/ergazomenoi/fixtures/businessFactEmployeeHistoryResolutionFixtures');
function correctedPayFixture() {
    const input = settlementDecisionFixture(shapeBCorrectedProfileFixture);
    input.completeHistoryRows.forEach((row, index) => Object.assign(row, {
        synolo_symbashs: index ? 1100 : 1000, synolo_symbashs_basei_oron_ergasias: index ? 1100 : 1000,
        pragmatikosMisthos: index ? 1100 : 1000, nomimosMisthos: index ? 1100 : 1000 }));
    input.currentEmployee = { ...input.completeHistoryRows.at(-1), _id: input.currentEmployee._id,
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-06-01'), energos: false };
    return input;
}
function datedPayChangeFixture() {
    const input = periodSplitFixture({ yearly: true });
    // Explicit synthetic historical terms on two already recorded dates.
    input.completeHistoryRows.splice(2, 1);
    const old = input.completeHistoryRows[1], later = input.completeHistoryRows[2];
    Object.assign(old, { hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-06-30') });
    Object.assign(later, { hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-07-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-07-01'), hmeromhnia_isxyos_oron_ergasias_eos: null });
    Object.assign(input.completeHistoryRows.at(-1), { hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-07-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-07-01'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-12-31'),
        hmeromhnia_apoxorhshs: new Date('2026-12-31') });
    input.protectedReferenceSummary[String(later._id)] = [];
    for (const row of input.completeHistoryRows) Object.assign(row, {
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        synolo_symbashs: row === old ? 1000 : 1100, synolo_symbashs_basei_oron_ergasias: row === old ? 1000 : 1100,
        pragmatikosMisthos: row === old ? 1000 : 1100, nomimosMisthos: row === old ? 1000 : 1100 });
    input.currentEmployee = { ...input.completeHistoryRows.at(-1), _id: input.currentEmployee._id, energos: false };
    return input;
}
function departureFactsFixture(pay = false) {
    const input = settlementDecisionFixture(pay ? departureAndHistoricalPayFactFixture : competingDepartureDatesFixture);
    input.currentEmployee.energos = true;
    return input;
}
module.exports = { correctedPayFixture, datedPayChangeFixture, departureFactsFixture };
