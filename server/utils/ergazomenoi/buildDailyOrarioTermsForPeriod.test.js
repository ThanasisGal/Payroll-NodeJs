'use strict';

const assert = require('assert/strict');
const {
    buildDailyOrarioTermsForPeriod
} = require('./buildDailyOrarioTermsForPeriod');

const rows = buildDailyOrarioTermsForPeriod({
    periodApo: '2026-06-14',
    periodEos: '2026-06-15',
    ergazomenos: { kodikos: '0014', kathestos_apasxolhshs: '0' },
    istorikoRows: [
        { afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-01',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14',
            kathestos_apasxolhshs: '1' },
        { afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
            kathestos_apasxolhshs: '0' }
    ]
});

assert.deepEqual(rows.map((row) => ({ date: row.hmeromhnia,
    snapshot: row.kathestos_apasxolhshs_hmeras })), [
    { date: '2026-06-14', snapshot: '1' },
    { date: '2026-06-15', snapshot: '0' }
]);

console.log('daily orario employment snapshot behavioral tests passed');
