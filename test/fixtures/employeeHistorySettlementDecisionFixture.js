'use strict';
const { Types } = require('mongoose');
const { IstorikoProslhpseonAllagonModel: History } = require('../../server/models/ergazomenoi');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const { samePeriodMateriallyDifferentProfilesFixture } = require('../../server/services/ergazomenoi/fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
function settlementDecisionFixture(factory = samePeriodMateriallyDifferentProfilesFixture) {
    const input = factory();
    input.protectedReferenceSummary = {};
    input.completeHistoryRows = input.completeHistoryRows.map((source, index) => {
        const row = History.castObject({ ...source, _id: new Types.ObjectId((600000000000000000000001n + BigInt(index)).toString()),
            evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
        // Explicit synthetic recorded values, never inferred by application code.
        for (const [field, type] of Object.entries(C.PROFILE_FIELD_TYPES)) if (type === 'Number' && row[field] == null) row[field] = 0;
        input.protectedReferenceSummary[String(row._id)] = [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: `synthetic-decision-${index}`, frozen_snapshot: { finalized: true, amount: 123.45, hours: 8 } }];
        return row;
    });
    input.currentEmployee = { ...input.completeHistoryRows.at(-1), _id: new Types.ObjectId('700000000000000000000002'), energos: false };
    return input;
}
module.exports = { settlementDecisionFixture };
