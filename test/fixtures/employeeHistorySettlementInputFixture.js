'use strict';
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { real0006BoundaryStructure } = require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { completeSyntheticEmploymentTerms } = require('./employeeCompleteProfileFixture');

// Shared input evidence for the memory and guarded MongoDB adapters. These
// positive-case terms are independent synthetic contract facts recorded before
// preview/approval, never inferred from a later period or schema defaults.
function createSettlementInputFixture({ enriched = true, fixture } = {}) {
    const input = fixture ? S.clone(fixture) : real0006BoundaryStructure();
    if (enriched && !fixture) {
        const terms = completeSyntheticEmploymentTerms();
        Object.assign(input.currentEmployee, { dialleima_se_lepta: 0,
            evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
        for (const row of [input.currentEmployee, ...input.completeHistoryRows]) {
            for (const field of ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs'])
                if (!row[field]) row[field] = terms[field];
            for (const field of ['nomimosMisthos', 'pragmatikosMisthos'])
                if (!(row[field] > 0)) row[field] = terms[field];
        }
    }
    if (enriched) for (const row of input.completeHistoryRows)
        Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    return input;
}
module.exports = { createSettlementInputFixture };
