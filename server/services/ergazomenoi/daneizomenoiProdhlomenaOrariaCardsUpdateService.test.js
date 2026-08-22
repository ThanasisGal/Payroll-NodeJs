'use strict';

const assert = require('assert');
const test = require('node:test');
const {
    updateBorrowedEmployeeDigitalCards
} = require('./daneizomenoiProdhlomenaOrariaUpdateService');

const scope = {
    team: 'TEAM-A', company_kod: '64b000000000000000000001',
    target_ypokatasthma: '0001', source_ypokatasthma: '0099',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-30T00:00:00.000Z')
};
const sourceCompanyId = '64b000000000000000000002';

function query(rows) {
    return { select() { return this; }, lean: async () => rows };
}

function harness({ targetRows = [] } = {}) {
    const calls = { finds: [], writes: [] };
    const sourceRow = {
        company_kod: sourceCompanyId, ypokatasthma: '0099', kodikos: '0003',
        hmeromhnia: new Date('2026-06-05T00:00:00.000Z'),
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        cards_ores_ergasias: 8, check_ergasia: true,
        kathgoria_ergasias: 'ΜΕ', apo_ora_01: 'SHOULD_NOT_COPY',
        ores_ergasias_apologistika: 99
    };
    return {
        calls,
        models: {
            employeeModel: { find: () => query([{ kodikos: '0031',
                afm_daneizomenoy_ergodoth: '094259216',
                kodikos_ergazomenoy_alloy_ergodoth: '0003' }]) },
            companiesModel: { find: () => query([{ _id: sourceCompanyId, afm: '094259216' }]) },
            prodhlomenaModel: {
                find(filter) {
                    calls.finds.push(filter);
                    return query(String(filter.company_kod) === sourceCompanyId ? [sourceRow] : targetRows);
                },
                async bulkWrite(ops, options) {
                    calls.writes.push({ ops, options });
                    return { matchedCount: ops.length, modifiedCount: ops.length, upsertedCount: 0 };
                }
            }
        }
    };
}

test('borrowed cards copy only the normal digital-card policy fields with upsert false', async () => {
    const h = harness({ targetRows: [{ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma, kodikos: '0031',
        hmeromhnia: new Date('2026-06-05T00:00:00.000Z') }] });
    const summary = await updateBorrowedEmployeeDigitalCards({ scope, models: h.models });
    const operation = h.calls.writes[0].ops[0].updateOne;
    assert.equal(summary.targetRowsUpdated, 1);
    assert.equal(operation.upsert, false);
    assert.deepStrictEqual(Object.keys(operation.update.$set).sort(), [
        'cards_apo_ora_01', 'cards_apo_ora_02', 'cards_apo_ora_03',
        'cards_eos_ora_01', 'cards_eos_ora_02', 'cards_eos_ora_03',
        'cards_ores_ergasias', 'check_ergasia'
    ]);
    assert.equal(operation.update.$set.cards_apo_ora_01, '08:00');
    assert.equal(operation.update.$set.check_ergasia, true);
    assert.equal(operation.update.$setOnInsert, undefined);
    assert.equal(operation.filter.ypokatasthma, scope.target_ypokatasthma);
    assert.equal(h.calls.finds[0].ypokatasthma, scope.source_ypokatasthma);
});

test('duplicate target identity remains blocked before borrowed-card bulk write', async () => {
    const identity = { team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma, kodikos: '0031',
        hmeromhnia: new Date('2026-06-05T00:00:00.000Z') };
    const h = harness({ targetRows: [identity, identity] });
    const summary = await updateBorrowedEmployeeDigitalCards({ scope, models: h.models });
    assert.equal(summary.targetAmbiguities, 1);
    assert.equal(h.calls.writes.length, 0);
});
