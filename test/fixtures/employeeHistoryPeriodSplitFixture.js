'use strict';
const { Types } = require('mongoose');
const { settlementDecisionFixture } = require('./employeeHistorySettlementDecisionFixture');
const { optionalIntermediateProfileFixture } = require('../../server/services/ergazomenoi/fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
function periodSplitFixture({ automatic = true, yearly = false, priorCycle = false, intermediate = false } = {}) {
    const input = intermediate ? settlementDecisionFixture(optionalIntermediateProfileFixture) : settlementDecisionFixture();
    if (yearly) {
        const ranges = [ ['2025-12-30', '2025-12-31'], ['2026-01-01', '2026-12-31'],
            ['2026-01-01', '2026-12-31'], ['2027-01-01', '2027-01-31'], ['2027-01-01', '2027-01-31'] ];
        input.completeHistoryRows.forEach((row, index) => {
            const [start, end] = ranges[index];
            Object.assign(row, { hmeromhnia_proslhpshs: new Date('2025-12-30'),
                hmeromhnia_isxyos_oron_ergasias_apo: new Date(start), hmeromhnia_isxyos_oron_ergasias_eos: new Date(end),
                hmeromhnia_allaghs_symbashs: new Date(start),
                hmeromhnia_allaghs_orarioy_apo: new Date(index === 2 ? '2026-07-01' : start),
                hmeromhnia_allaghs_orarioy_eos: new Date(end),
                hmeromhnia_apoxorhshs: index === 4 ? new Date('2027-01-31') : null });
        });
        input.currentEmployee = { ...input.completeHistoryRows.at(-1), _id: input.currentEmployee._id, energos: false };
    }
    if (automatic) input.completeHistoryRows[2].hmeromhnia_allaghs_symbashs =
        new Date(input.completeHistoryRows[2].hmeromhnia_allaghs_orarioy_apo);
    if (priorCycle) {
        const old = { ...input.completeHistoryRows[0], _id: new Types.ObjectId('600000000000000000000099'), aa_eggrafhs: '0000',
            hmeromhnia_proslhpshs: new Date('2025-01-01'), hmeromhnia_apoxorhshs: new Date('2025-01-31'),
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2025-01-01'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2025-01-31'),
            hmeromhnia_allaghs_symbashs: new Date('2025-01-01'), hmeromhnia_allaghs_orarioy_apo: new Date('2025-01-01'),
            hmeromhnia_allaghs_orarioy_eos: new Date('2025-01-31') };
        input.completeHistoryRows.unshift(old);
        input.protectedReferenceSummary[String(old._id)] = [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: 'synthetic-prior-cycle', frozen_snapshot: { finalized: true, amount: 100 } }];
    }
    return input;
}
module.exports = { periodSplitFixture };
