'use strict';

const assert = require('assert');
const { loadWtoOvertimeDataset } = require('./wtoOvertimeDatasetService');

function query(value) {
    const chain = {
        sort() { return chain; },
        select() { return chain; },
        async lean() { return value; }
    };
    return chain;
}

(async () => {
    const scheduleFilters = [];
    const sourceRows = [{ _id: 'row-1', kodikos: '0001',
        hmeromhnia: new Date('2026-08-10T00:00:00.000Z'),
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        apo_ora_yperories: '17:15', eos_ora_yperories: '18:45',
        ores_nominhs_yperorias_apologistika: 1.5 }];
    const employees = [{ kodikos: '0001', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ',
        onoma: 'ΜΑΡΙΑ', karta_ergasias: true, afora_daneismo_ergazomenoy: false }];
    const dataset = await loadWtoOvertimeDataset({
        scope: { effectiveTeam: 'TEAM1', companyId: '507f1f77bcf86cd799439011' },
        input: { ypokatasthma: '1', from_date: '2026-08-01', to_date: '2026-08-31' },
        models: {
            YpokatasthmataModel: { findOne: () => query({ _id: 'branch-1', kodikos: '0001' }) },
            ProdhlomenaOrariaModel: { find: (filter) => {
                scheduleFilters.push(filter); return query(sourceRows);
            } },
            ErgazomenoiModel: { find: () => query(employees) }
        }
    });
    assert.equal(scheduleFilters.length, 1, 'γίνεται μόνο canonical ανάγνωση ProdhlomenaOraria');
    assert.equal(scheduleFilters[0].team, 'TEAM1');
    assert.equal(scheduleFilters[0].ypokatasthma, '0001');
    assert.equal(dataset.response.submission_eligible, true);
    assert.equal(dataset.response.analytics_count, 1);
    assert.equal(dataset.response.total_legal_overtime_minutes, 90);
    assert.equal(dataset.response.actual_from, '10/08/2026');
    assert.equal(dataset.response.actual_to, '10/08/2026');
    assert.equal(dataset.response.rows[0].f_from, '17:15');
    assert.equal(dataset.response.rows[0].f_to, '18:45');
    assert.equal(dataset.response.parity.exact, true);
    assert.ok(!JSON.stringify(scheduleFilters).includes('FINALIZED'),
        'η OPEN περίοδος δεν αποκλείεται ούτε απαιτείται FINALIZED');
    console.log('PASS WTOOvA authoritative dataset query and OPEN-period contract');
})().catch((error) => { console.error(error); process.exitCode = 1; });
