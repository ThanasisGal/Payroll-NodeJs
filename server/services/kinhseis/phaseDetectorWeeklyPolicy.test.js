const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyWeeklySixthSeventhDayFacts,
    filterDailyRowsToRequestedPeriod
} = require('./phaseDetectorService');

function buildWeek({
    changedProfile = false,
    start = '2026-06-08',
    hours = Array(7).fill(7)
} = {}) {
    const dailyRows = [];
    const orariaByDate = new Map();
    const startDate = new Date(`${start}T00:00:00.000Z`);

    for (let index = 0; index < 7; index += 1) {
        const current = new Date(startDate);
        current.setUTCDate(current.getUTCDate() + index);
        const date = current.toISOString().slice(0, 10);
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
            kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
            repo: index >= 5,
            ores_ergasias: 8,
            cards_ores_ergasias: hours[index],
            cards_apo_ora_01: hours[index] > 0 ? '09:00' : '',
            cards_eos_ora_01: hours[index] > 0 ? '17:00' : ''
        });
    }

    return { dailyRows, orariaByDate };
}

test('work-facts weekly path classifies sixth and seventh days without losing actual hours', () => {
    const { dailyRows, orariaByDate } = buildWeek();
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        asOfDate: '2026-06-15'
    });

    assert.equal(result[6].isSixthDay, true);
    assert.equal(result[6].sixthDayHours, 7);
    assert.equal(result[5].isSeventhDay, true);
    assert.equal(result[5].weeklyComplianceStatus, 'READY');
    assert.ok(
        result[5].weeklyComplianceWarnings.includes(
            'SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'
        )
    );
});

test('work-facts propagates canonical sixth-day hours and preserves excess and identities', () => {
    for (const { actualHours, expectedSixthHours, expectedSixthIndex } of [
        { actualHours: 7.42, expectedSixthHours: 7.42, expectedSixthIndex: 6 },
        { actualHours: 8, expectedSixthHours: 8, expectedSixthIndex: 6 }
    ]) {
        const remainingRepoHours = actualHours > 8 ? 10 : 6;
        const { dailyRows, orariaByDate } = buildWeek({
            hours: [7, 7, 7, 7, 7, remainingRepoHours, actualHours]
        });
        const analyses = [];
        const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
            asOfDate: '2026-06-15',
            weeklyAnalyses: analyses
        });
        const analysis = analyses[0];

        assert.equal(result[expectedSixthIndex].isSixthDay, true);
        assert.equal(result[expectedSixthIndex].sixthDayHours, expectedSixthHours);
        assert.equal(analysis.sixthDay.sixthDayHours, expectedSixthHours);
        assert.equal(analysis.sixthDay.illegalOvertimeHours, 0);
        assert.equal(analysis.sixthDay.hmeromhnia,
            expectedSixthIndex === 6 ? '2026-06-14' : '2026-06-12');
        assert.equal(analysis.seventhDay.hmeromhnia, '2026-06-13');
        assert.equal(result[5].isSeventhDay, true);
        assert.equal(analysis.seventhDay.illegalOvertimeHours, remainingRepoHours);
    }
});

test('first cross-month week uses previous-month context but presents requested dates only', () => {
    const { dailyRows, orariaByDate } = buildWeek({
        start: '2026-06-29',
        hours: [4, 4, 4, 4, 4, 4, 8]
    });
    const analyses = [];
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-07-01',
        requestedPeriodEnd: '2026-07-31',
        asOfDate: '2026-07-06',
        weeklyAnalyses: analyses
    });
    const requested = filterDailyRowsToRequestedPeriod(
        result,
        '2026-07-01',
        '2026-07-31'
    );

    assert.equal(analyses[0].complete, true);
    assert.equal(analyses[0].sixthDay.hmeromhnia, '2026-07-05');
    assert.equal(analyses[0].seventhDay.hmeromhnia, '2026-07-04');
    assert.deepEqual(requested.map((day) => day.date), [
        '2026-07-01',
        '2026-07-02',
        '2026-07-03',
        '2026-07-04',
        '2026-07-05'
    ]);
});

test('completed trailing cross-month week classifies next-month seventh day', () => {
    const { dailyRows, orariaByDate } = buildWeek({
        start: '2026-06-29',
        hours: [4, 4, 4, 4, 4, 4, 8]
    });
    const analyses = [];
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-06-01',
        requestedPeriodEnd: '2026-06-30',
        asOfDate: '2026-07-06',
        weeklyAnalyses: analyses
    });
    const requested = filterDailyRowsToRequestedPeriod(
        result,
        '2026-06-01',
        '2026-06-30'
    );

    assert.equal(analyses[0].status, 'READY');
    assert.equal(analyses[0].sixthDay.hmeromhnia, '2026-07-05');
    assert.equal(analyses[0].seventhDay.hmeromhnia, '2026-07-04');
    assert.deepEqual(requested.map((day) => day.date), ['2026-06-29', '2026-06-30']);
});

test('seven future source rows do not prove temporal week completion', () => {
    const { dailyRows, orariaByDate } = buildWeek({ start: '2026-06-29' });
    const analyses = [];
    applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-06-01',
        requestedPeriodEnd: '2026-06-30',
        asOfDate: '2026-07-02',
        weeklyAnalyses: analyses
    });

    assert.equal(orariaByDate.size, 7);
    assert.equal(analyses[0].status, 'OPEN_WEEK_PENDING_COMPLETION');
    assert.equal(analyses[0].complete, false);
    assert.equal(analyses[0].sixthDay, undefined);
    assert.equal(analyses[0].seventhDay, undefined);
    assert.ok(dailyRows.every((day) => !day.isSixthDay && !day.isSeventhDay));
});

test('uncompleted trailing week is explicitly pending and is not an HR error', () => {
    const { dailyRows, orariaByDate } = buildWeek({ start: '2026-06-29' });
    for (const key of [...orariaByDate.keys()]) {
        if (key > '2026-06-30') orariaByDate.delete(key);
    }
    const analyses = [];
    applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-06-01',
        requestedPeriodEnd: '2026-06-30',
        asOfDate: '2026-07-02',
        weeklyAnalyses: analyses
    });

    assert.equal(analyses[0].complete, false);
    assert.equal(analyses[0].status, 'OPEN_WEEK_PENDING_COMPLETION');
    assert.deepEqual(analyses[0].reasons, []);
    assert.ok(dailyRows.every((day) =>
        day.weeklyComplianceStatus === 'OPEN_WEEK_PENDING_COMPLETION'
    ));
});

test('completed trailing week is analyzed normally after its authoritative as-of boundary', () => {
    const { dailyRows, orariaByDate } = buildWeek({ start: '2026-06-29' });
    const analyses = [];
    applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-06-01',
        requestedPeriodEnd: '2026-06-30',
        asOfDate: '2026-07-06',
        weeklyAnalyses: analyses
    });

    assert.equal(analyses[0].complete, true);
    assert.equal(analyses[0].status, 'READY');
    assert.equal(analyses[0].asOfDate, '2026-07-06');
});

test('missing rows after week completion require HR decision instead of remaining open', () => {
    const { dailyRows, orariaByDate } = buildWeek({ start: '2026-06-29' });
    orariaByDate.delete('2026-07-05');
    const analyses = [];
    applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-06-01',
        requestedPeriodEnd: '2026-06-30',
        asOfDate: '2026-07-10',
        weeklyAnalyses: analyses
    });

    assert.equal(analyses[0].complete, false);
    assert.equal(analyses[0].status, 'NEEDS_HR_DECISION');
    assert.deepEqual(analyses[0].reasons, ['INCOMPLETE_COMPLETED_WEEK_DATA']);
    assert.equal(analyses[0].asOfDate, '2026-07-10');
});

test('work-facts weekly path accepts a deterministic in-week profile change', () => {
    const { dailyRows, orariaByDate } = buildWeek({ changedProfile: true });
    const result = applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        asOfDate: '2026-06-15'
    });

    result.forEach((day) => {
        assert.equal(day.weeklyComplianceStatus, 'NOT_APPLICABLE');
        assert.deepEqual(day.weeklyComplianceReasons, []);
        assert.equal(day.isSixthDay, false);
        assert.equal(day.isSeventhDay, false);
    });
});

test('invalid explicit as-of date fails closed without clock fallback or classification', () => {
    const { dailyRows, orariaByDate } = buildWeek({ start: '2026-06-29' });
    const analyses = [];
    applyWeeklySixthSeventhDayFacts(dailyRows, orariaByDate, {
        requestedPeriodStart: '2026-07-01',
        requestedPeriodEnd: '2026-07-31',
        asOfDate: 'not-a-date',
        weeklyAnalyses: analyses
    });

    assert.equal(analyses[0].status, 'NEEDS_HR_DECISION');
    assert.equal(analyses[0].complete, false);
    assert.deepEqual(analyses[0].reasons, ['INVALID_AS_OF_DATE']);
    assert.ok(dailyRows.every((day) => !day.isSixthDay && !day.isSeventhDay));
});
