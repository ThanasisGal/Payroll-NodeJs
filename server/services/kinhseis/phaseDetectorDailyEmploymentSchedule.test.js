const assert = require('node:assert/strict');
const test = require('node:test');

const {
    detectPayrollPhasesForDateRange,
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

test('short and no-work daily schedules do not change a full-time contractual regime', () => {
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
        [['2026-06-01', '2026-06-07', '0']]
    );
    assert.deepEqual(days.map((day) => day.dailyEmploymentCode), [
        '0', '0', '0', '0', '0', '0', '0'
    ]);
    assert.equal(days[2].classification, 'PARTIAL_DAY');
    assert.equal(phases[0].phasePatternKind, 'PARTIAL_DAY_TERMS');
    assert.deepEqual(
        operationalPhases.map((phase) => [phase.apo, phase.eos, phase.detectedKathestosCode]),
        [['2026-06-01', '2026-06-07', '0']]
    );
});

for (const hours of [8, 40 / 6, 5, 2, 0]) {
    test(`authoritative full-time remains full-time for ${hours} declared hours`, () => {
        const category = hours > 0 ? 'ΕΡΓ' : 'ΑΝ';
        const days = buildWeek([{ category, hours, baseEmploymentCode: '0',
            fullDailyHours: 40 / 6, weeklyDays: 6, weeklyHours: 40 }]);
        const phases = groupDailyRowsIntoPhases(days, {}, false);

        assert.equal(days[0].dailyEmploymentCode, '0');
        assert.equal(phases[0].detectedKathestosCode, '0');
        if (hours > 0 && hours < 40 / 6) assert.equal(days[0].classification, 'PARTIAL_DAY');
    });
}

for (const hours of [8, 5, 2, 0]) {
    test(`authoritative non-full remains non-full for ${hours} declared hours`, () => {
        const category = hours > 0 ? 'ΕΡΓ' : 'ΜΕ';
        const days = buildWeek([{ category, hours, baseEmploymentCode: '1' }]);
        const phases = groupDailyRowsIntoPhases(days, {}, false);

        assert.equal(days[0].dailyEmploymentCode, '1');
        assert.equal(phases[0].detectedKathestosCode, '1');
    });
}

test('date-effective contractual changes still split employment phases', () => {
    const days = buildWeek([
        { category: 'ΕΡΓ', hours: 5, baseEmploymentCode: '0' },
        { category: 'ΕΡΓ', hours: 8, baseEmploymentCode: '1' }
    ]);
    const phases = groupDailyRowsIntoPhases(days, {}, false);

    assert.deepEqual(phases.map((phase) => phase.detectedKathestosCode), ['0', '1']);
});

test('unknown contractual terms remain unknown instead of being inferred from hours', () => {
    const days = buildWeek([{ category: 'ΕΡΓ', hours: 8,
        baseEmploymentCode: '' }]);
    const phases = groupDailyRowsIntoPhases(days, {}, false);

    assert.equal(days[0].dailyEmploymentCode, '');
    assert.equal(days[0].dailyEmploymentCodeSource, 'UNKNOWN_DAILY_TERMS');
    assert.equal(phases[0].detectedKathestos, 'UNKNOWN');
    assert.equal(phases[0].detectedKathestosCode, '');
});

test('date-effective contract history overrides the current master in both directions', async () => {
    async function detectedCode({ masterCode, historicalCode }) {
        const result = await detectPayrollPhasesForDateRange({
            team: 'THA', company_kod: 'company', kodikos: '0031',
            apo: '2026-08-05', eos: '2026-08-05', asOfDate: '2026-08-31',
            preparedContext: {
                employee: { kodikos: '0031', hmeromhnia_proslhpshs: '2020-01-01',
                    kathestos_apasxolhshs: masterCode, typos_apasxolhshs: masterCode,
                    hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40,
                    mo_oron_hmerhsias_ergasias: 40 / 6 },
                contractStatusHistoryRows: [{ hmeromhnia_allaghs_symbashs: '2026-08-01',
                    kathestos_apasxolhshs: historicalCode }],
                workingTermsHistoryRows: [],
                rows: [{ hmeromhnia: '2026-08-05', kathgoria_ergasias: 'ΕΡΓ',
                    ores_ergasias: 5, apo_ora_01: '10:00', eos_ora_01: '15:00' }]
            }
        });
        assert.equal(result.phases[0].phasePatternKind, 'PARTIAL_DAY_TERMS');
        return result.phases[0].detectedKathestosCode;
    }

    assert.equal(await detectedCode({ masterCode: '1', historicalCode: '0' }), '0');
    assert.equal(await detectedCode({ masterCode: '0', historicalCode: '1' }), '1');
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
