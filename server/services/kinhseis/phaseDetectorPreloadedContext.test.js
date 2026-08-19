'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { detectPayrollPhasesForDateRange } = require('./phaseDetectorService');

test('preloaded daily context preserves the first UTC date of the dependency window', async () => {
    const dailyRows = Array.from({ length: 7 }, (_, index) => {
        const date = new Date('2026-06-01T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return {
            hmeromhnia: date,
            kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
            kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : '',
            ores_ergasias: index < 5 ? 8 : 0,
            ores_ergasias_apologistika: index < 5 ? 8 : 0,
            ores_pragmatikhs_ergasias_apologistika: index < 5 ? 8 : 0
        };
    });
    const result = await detectPayrollPhasesForDateRange({
        team: 'TEST', company_kod: 'COMPANY', kodikos: '0001', ypokatasthma: '0000',
        apo: '2026-06-01', eos: '2026-06-07', asOfDate: '2026-06-07',
        preloadedContext: {
            employee: {
                kodikos: '0001', hmeromhnia_proslhpshs: new Date('2020-01-01T00:00:00.000Z'),
                hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
                mo_oron_hmerhsias_ergasias: 8, kathestos_apasxolhshs: '0',
                typos_ebdomadas: '5', karta_ergasias: false
            },
            contractHistoryRows: [], workTermsHistoryRows: [], dailyRows
        }
    });
    const presentedDates = result.phases.flatMap((phase) => phase.daily || [])
        .map((row) => row.date);
    assert.ok(presentedDates.includes('2026-06-01'));
    assert.ok(presentedDates.includes('2026-06-07'));
});
