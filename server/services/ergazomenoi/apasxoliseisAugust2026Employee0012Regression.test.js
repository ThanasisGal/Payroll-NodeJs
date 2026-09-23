'use strict';

const assert = require('node:assert/strict');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    attachSixthDayPresentationToRows
} = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const {
    buildWeeklyHrLifecycleProjection
} = require('./apasxoliseisWeeklyHrLifecycleProjectionService');

const hours = [8, 8, 8, 8, 7.5, 7.97, 0];
const rows = hours.map((actualWorkHours, index) => {
    const date = new Date('2026-08-03T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    const worked = actualWorkHours > 0;
    return {
        team: 'TEST', company_kod: 'test-company', ypokatasthma: '0000',
        kodikos: 'test-employee', hmeromhnia: date.toISOString().slice(0, 10),
        kathgoria_ergasias: worked ? 'ΕΡΓ' : 'ΑΝ',
        kathgoria_ergasias_apologistika: worked ? 'ΕΡΓ' : 'ΑΝ',
        repo: !worked, repo_apologistika: !worked,
        ores_ergasias: worked ? 8 : 0,
        cards_ores_ergasias: actualWorkHours,
        ores_ergasias_apologistika: actualWorkHours,
        cards_apo_ora_01: worked ? '09:00' : '',
        cards_eos_ora_01: worked ? '17:00' : ''
    };
});

Object.assign(rows[4], {
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
    orphan_card_resolution: { status: 'HR_APPROVED',
        policy_version: 'orphan-card-continuous:v1', orphan_type: 'START_ONLY',
        approved_interval: { start: '09:00', end: '17:00', workDurationHours: 7.5 },
        raw_cards_preserved: true },
    apologistiko_biblio: true,
    apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '17:00'
});

const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0',
    pososto_prosayxhshs_6hs_hmeras: 0, eidikh_kathgoria_ergazomenoy: '0009' };
const analysis = analyzeWeeklySixthSeventhDay({ weekRows: rows,
    effectiveProfile: profile });
assert.equal(analysis.status, 'READY');
assert.equal(String(analysis.sixthDay.hmeromhnia).slice(0, 10), '2026-08-08');
assert.equal(analysis.sixthDay.sixthDayHours, 7.97);
assert.equal(analysis.sixthDay.premiumRate, 0);
const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows: rows,
    effectiveProfile: profile });
assert.deepEqual(lifecycle.stages.stage4.final_weekly_analysis, analysis);
assert.equal(lifecycle.stages.stage4.final_weekly_analysis.sixthDay.hmeromhnia,
    '2026-08-08');

const projected = attachSixthDayPresentationToRows(rows.map((row) => ({ ...row,
    is_sixth_day: row.hmeromhnia === '2026-08-07' })), [{
    kodikos: 'test-employee', ypokatasthma: '0000',
    sixth_day_date: '2026-08-08', sixth_day_premium_rate: 0,
    sixth_seventh_day_status: analysis.status
}]);
assert.equal(projected.filter((row) => row.is_sixth_day).length, 1);
assert.equal(projected[4].is_sixth_day, false);
assert.equal(projected[5].is_sixth_day, true);
assert.equal(projected[5].sixth_day_premium_rate, 0);
assert.equal(rows[4].cards_eos_ora_01, '');

console.log('August 2026 canonical sixth-day regression tests passed');
