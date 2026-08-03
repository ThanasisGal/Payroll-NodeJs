const assert = require('node:assert/strict');
const test = require('node:test');

const {
    groupDailyRowsIntoPhases,
    buildOperationalPhases
} = require('./phaseDetectorService');

function buildDay({
    date,
    category,
    hours = 0,
    baseEmploymentCode = '0',
    fullDailyHours = 8,
    weeklyDays = 5,
    weeklyHours = 40
}) {
    const expectedWorkDay = hours > 0;

    return {
        date,
        scheduledKathgoria: category,
        actualKathgoria: category,
        effectiveKathgoria: category,
        scheduledHours: hours,
        actualHours: hours,
        payHours: hours,
        classificationHours: hours,
        fullDailyHours,
        classificationFullDailyHours: fullDailyHours,
        classification: hours >= fullDailyHours ? 'FULL_DAY' : hours > 0 ? 'PARTIAL_DAY' : 'NO_WORK',
        expectedWorkDay,
        actualWorkedDay: expectedWorkDay,
        actualWorkHours: hours,
        leaveHours: 0,
        sicknessHours: 0,
        countsAsActualWorkDay: expectedWorkDay,
        actualWorkFactReasons: [],
        actualWorkFactWarnings: [],
        hmeres_ergasias_ebdomadas: weeklyDays,
        ores_ergasias_ebdomadas: weeklyHours,
        mo_oron_hmerhsias_ergasias: fullDailyHours,
        pososto_prosayxhshs_6hs_hmeras: 40,
        sourceField: 'ores_ergasias',
        expectedWorkDaysForClassification: expectedWorkDay ? 1 : 0,
        scheduledHoursTotalForClassification: expectedWorkDay ? hours : 0,
        repo: category === 'ΑΝ',
        repo_apologistika: false,
        isRepoDay: category === 'ΑΝ',
        baseEmploymentCode,
        kathestos_apasxolhshs: baseEmploymentCode,
        typos_ebdomadas: '5',
        karta_ergasias: false,
        warnings: []
    };
}

function buildWeek(specs) {
    const start = new Date('2026-06-01T00:00:00.000Z');
    return specs.map((spec, index) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + index);
        return buildDay({ date: date.toISOString().slice(0, 10), ...spec });
    });
}

test('same week is split into full, non-full and full daily schedule phases', () => {
    const days = buildWeek([
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 4 },
        { category: 'ΜΕ' },
        { category: 'ΜΕ' },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 }
    ]);

    const phases = groupDailyRowsIntoPhases(days, {}, false);
    const operationalPhases = buildOperationalPhases(phases);

    assert.deepEqual(
        phases.map((phase) => [phase.apo, phase.eos, phase.detectedKathestosCode]),
        [
            ['2026-06-01', '2026-06-02', '0'],
            ['2026-06-03', '2026-06-05', '1'],
            ['2026-06-06', '2026-06-07', '0']
        ]
    );
    assert.deepEqual(days.map((day) => day.dailyEmploymentCode), [
        '0', '0', '1', '1', '1', '0', '0'
    ]);
    assert.deepEqual(
        operationalPhases.map((phase) => [phase.apo, phase.eos, phase.detectedKathestosCode]),
        [
            ['2026-06-01', '2026-06-02', '0'],
            ['2026-06-03', '2026-06-05', '1'],
            ['2026-06-06', '2026-06-07', '0']
        ]
    );
});

test('rotational daily terms keep full-hour work and ME days in one non-full phase', () => {
    const days = buildWeek([
        { category: 'ΕΡΓ', hours: 8, baseEmploymentCode: '2' },
        { category: 'ΕΡΓ', hours: 8, baseEmploymentCode: '2' },
        { category: 'ΜΕ', baseEmploymentCode: '2' },
        { category: 'ΜΕ', baseEmploymentCode: '2' },
        { category: 'ΜΕ', baseEmploymentCode: '2' },
        { category: 'ΜΕ', baseEmploymentCode: '2' },
        { category: 'ΜΕ', baseEmploymentCode: '2' }
    ]);

    const phases = groupDailyRowsIntoPhases(days, {}, false);

    assert.equal(phases.length, 1);
    assert.equal(phases[0].detectedKathestosCode, '2');
    assert.ok(days.every((day) => day.dailyEmploymentCode === '2'));
});

test('full-time rest rows remain full-time AN schedule context', () => {
    const days = buildWeek([
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΕΡΓ', hours: 8 },
        { category: 'ΑΝ' },
        { category: 'ΑΝ' }
    ]);

    const phases = groupDailyRowsIntoPhases(days, {}, false);

    assert.equal(phases.length, 1);
    assert.equal(phases[0].detectedKathestosCode, '0');
    assert.ok(days.every((day) => day.dailyEmploymentCode === '0'));
});

test('six-day 40-hour schedule is not misclassified as six partial days', () => {
    const dailyHours = 40 / 6;
    const days = buildWeek([
        ...Array.from({ length: 6 }, () => ({
            category: 'ΕΡΓ',
            hours: dailyHours,
            fullDailyHours: 8,
            weeklyDays: 6
        })),
        { category: 'ΑΝ', fullDailyHours: 8, weeklyDays: 6 }
    ]);

    const phases = groupDailyRowsIntoPhases(days, {}, false);

    assert.equal(phases.length, 1);
    assert.equal(phases[0].detectedKathestosCode, '0');
    assert.ok(days.every((day) => day.dailyEmploymentCode === '0'));
});
