'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./fixtures/targetedCanonicalIntegrationFixture');
const { calculateHistoricalFingerprints } = require('./apasxoliseisHistoricalPeriodReconstructionService');
for (const borrowed of [false, true]) test(`historical dependency reads propagate session, legacy parity; borrowed=${borrowed}`, async () => {
    const h = harness();
    if (borrowed) {
        Object.assign(h.employee, { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
            afm_daneizomenoy_ergodoth: '987654321', kodikos_ergazomenoy_alloy_ergodoth: '0088',
            hmnia_enarxhs_daneismoy: new Date('2026-04-02') });
        h.data.companiesModel.push({ ...h.data.companiesModel[0], _id: '8'.repeat(24), kod: '0008', afm: '987654321' });
        h.data.employeeModel.push({ ...h.employee, _id: '9'.repeat(24), kodikos: '0088', company_kod: '8'.repeat(24) });
    }
    const args = { scope: h.scope, prodhlomenaModel: h.models.rowModel, models: h.models };
    const legacy = await calculateHistoricalFingerprints(args);
    assert.ok(h.reads.every((r) => r.session === undefined));
    h.reads.length = 0;
    const session = {};
    const current = await calculateHistoricalFingerprints({ ...args, session });
    assert.deepEqual(current, legacy);
    assert.ok(h.reads.length > 6);
    assert.ok(h.reads.every((r) => r.session === session));
    for (const name of ['rowModel', 'employeeModel', 'historyModel', 'companiesModel', 'argiesModel']) {
        assert.ok(h.reads.some((read) => read.name === name), name);
    }
});
