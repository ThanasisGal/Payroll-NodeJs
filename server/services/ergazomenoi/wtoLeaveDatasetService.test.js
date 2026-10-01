'use strict';

const assert = require('assert');
const { loadWtoLeaveDataset } = require('./wtoLeaveDatasetService');

function sortedLean(value) { return { sort: () => ({ lean: async () => value }) }; }
function selectedLean(value) { return { select: () => ({ lean: async () => value }) }; }
const queries = [];
const sourceRows = ['10', '20'].map((day) => ({ _id: `row-${day}`, kodikos: '0001',
    hmeromhnia: new Date(`2026-08-${day}T00:00:00Z`), adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΑΛΛΗ', egkekrimenh_oroadeia_apologistika: false,
    egkekrimena_diastimata_oroadeias_apologistika: [] }));
const models = {
    YpokatasthmataModel: { findOne: (query) => { queries.push(['branch', query]);
        return { lean: async () => ({ _id: 'branch-id', kodikos: '0001' }) }; } },
    ProdhlomenaOrariaModel: { find: (query) => { queries.push(['schedule', query]);
        return sortedLean(sourceRows); } },
    ErgazomenoiModel: { find: (query) => { queries.push(['employee', query]);
        return selectedLean([{ kodikos: '0001', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ',
            onoma: 'ΜΑΡΙΑ', karta_ergasias: true, afora_daneismo_ergazomenoy: false,
            typos_ergodoth_daneismoy: false, hmeromhnia_proslhpshs: new Date('2024-01-01Z'),
            hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '0', typos_apasxolhshs: '',
            proyphresia_adeias_se_eth: 0 }]); } }
};

(async () => {
    const result = await loadWtoLeaveDataset({ scope: { effectiveTeam: 'TEAM1',
        companyId: '507f1f77bcf86cd799439011' }, input: { ypokatasthma: '1',
        from_date: '2026-08-01', to_date: '2026-08-31' }, models });
    const scheduleQuery = queries.find(([kind]) => kind === 'schedule')[1];
    assert.equal(scheduleQuery.team, 'TEAM1');
    assert.equal(scheduleQuery.company_kod, '507f1f77bcf86cd799439011');
    assert.equal(scheduleQuery.ypokatasthma, '0001');
    assert.equal(scheduleQuery.hmeromhnia.$gte.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(scheduleQuery.hmeromhnia.$lte.toISOString(), '2026-08-31T00:00:00.000Z');
    assert.equal(result.response.search_from, '2026-08-01');
    assert.equal(result.response.search_to, '2026-08-31');
    assert.equal(result.response.actual_from, '10/08/2026');
    assert.equal(result.response.actual_to, '20/08/2026');
    assert.equal(result.response.submission_eligible, true);
    assert.equal(result.response.parity.exact, true);
    assert.equal(result.payload.WTOS.WTO[0].f_from_date, '10/08/2026');
    assert.equal(result.payload.WTOS.WTO[0].f_to_date, '20/08/2026');

    const empty = await loadWtoLeaveDataset({ scope: { effectiveTeam: 'TEAM1',
        companyId: '507f1f77bcf86cd799439011' }, input: { ypokatasthma: '1',
        from_date: '2026-09-01', to_date: '2026-09-30' }, models: {
        ...models, ProdhlomenaOrariaModel: { find: () => sortedLean([]) },
        ErgazomenoiModel: { find: () => selectedLean([]) }
    } });
    assert.equal(empty.response.success, true);
    assert.equal(empty.response.employee_day_count, 0);
    assert.equal(empty.response.payload, null);
    assert.equal(empty.response.submission_eligible, false);
    console.log('PASS WTOLeave authoritative search scope, actual payload dates and empty preview');
})().catch((error) => { console.error(error); process.exitCode = 1; });
