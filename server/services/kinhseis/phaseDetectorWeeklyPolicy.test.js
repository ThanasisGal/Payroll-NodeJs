const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyWeeklySixthSeventhDayFacts
} = require('./phaseDetectorService');

function buildWeek({ changedProfile = false } = {}) {
    const dailyRows = [];
    const orariaByDate = new Map();

    for (let index = 0; index < 7; index += 1) {
        const date = `2026-06-${String(8 + index).padStart(2, '0')}`;
        dailyRows.push({
            date,
            kathestos_apasxolhshs: 'FULL',
            hmeres_ergasias_ebdomadas: changedProfile && index === 6 ? 6 : 5,
            ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8,
            pososto_prosayxhshs_6hs_hmeras: 40,
            termsSource: 'ERG_AKTUAL',
            sixthDayHours: 0
        });
        orariaByDate.set(date, {
            kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8,
            cards_ores_ergasias: 7
        });
    }

    return { dailyRows, orariaByDate };
}

test('work-facts weekly path classifies sixth and seventh days without losing actual hours', () => {
    const { dailyRows, orariaByDate } = buildWeek();
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate);

    assert.equal(result[5].isSixthDay, true);
    assert.equal(result[5].sixthDayHours, 7);
    assert.equal(result[6].isSeventhDay, true);
    assert.equal(result[6].weeklyComplianceStatus, 'READY');
    assert.ok(
        result[6].weeklyComplianceWarnings.includes(
            'SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'
        )
    );
});

test('work-facts weekly path keeps an in-week profile change visible for HR decision', () => {
    const { dailyRows, orariaByDate } = buildWeek({ changedProfile: true });
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate);

    result.forEach((day) => {
        assert.equal(day.weeklyComplianceStatus, 'NEEDS_HR_DECISION');
        assert.deepEqual(day.weeklyComplianceReasons, ['PROFILE_CHANGED_INSIDE_WEEK']);
        assert.equal(day.isSixthDay, false);
        assert.equal(day.isSeventhDay, false);
    });
});
