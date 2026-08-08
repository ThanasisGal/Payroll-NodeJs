const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildWeeklyCarryOverDifferences,
    generateWorkFactsForEmployeePeriod,
    buildReadyWorkFactsPayload,
    resolveWorkFactsAsOfContext
} = require('./workFactsPrecalcService');
const phaseDetectorService = require('./phaseDetectorService');

function completedAnalysis({
    sixthDayHours = 7,
    status = 'READY',
    complete = true,
    requestedMonth = '2026-07'
} = {}) {
    const requestedEnd = requestedMonth === '2026-06' ? '2026-06-30' : '2026-07-31';
    return {
        weekStart: '2026-06-29',
        weekEnd: '2026-07-05',
        requestedPeriod: {
            start: `${requestedMonth}-01`,
            end: requestedEnd
        },
        status,
        complete,
        dailyFacts: [
            {
                date: '2026-06-30',
                yperergasiaHours: 1,
                nomimiYperoriaHours: 0.5,
                paranomiYperoriaHours: 0,
                sixthDayHours
            },
            {
                date: '2026-07-02',
                yperergasiaHours: 2,
                nomimiYperoriaHours: 1,
                paranomiYperoriaHours: 0.5,
                sixthDayHours: 3
            }
        ]
    };
}

test('completed cross-month weekly facts produce auditable carry-over metadata', () => {
    const result = buildWeeklyCarryOverDifferences({
        detectorResult: { weeklyAnalyses: [completedAnalysis()] },
        scopeKey: 'THA|company|employee'
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].sourceWeekStart, '2026-06-29');
    assert.equal(result[0].sourceWeekEnd, '2026-07-05');
    assert.equal(result[0].sourcePayrollMonth, '2026-06');
    assert.equal(result[0].targetPayrollMonth, '2026-07');
    assert.deepEqual(result[0].sourceFactDates, ['2026-06-30']);
    assert.deepEqual(result[0].breakdown, {
        yperergasia: 1,
        yperoria: 0.5,
        sixthDay: 7,
        otherWeekly: 0
    });
    assert.match(result[0].idempotencyKey, /^[a-f0-9]{64}$/);
    assert.equal(result[0].policyVersion, 'weekly-payroll-carry-over:v1');
});

test('only complete READY analyses can produce carry-over', () => {
    for (const fixture of [
        completedAnalysis({ status: 'OPEN_WEEK_PENDING_COMPLETION', complete: false }),
        completedAnalysis({ status: 'NEEDS_HR_DECISION' }),
        completedAnalysis({ status: 'NOT_APPLICABLE' }),
        completedAnalysis({ status: 'READY', complete: false })
    ]) {
        const result = buildWeeklyCarryOverDifferences({
            detectorResult: { weeklyAnalyses: [fixture] },
            scopeKey: 'THA|company|employee'
        });
        assert.deepEqual(result, []);
    }
});

test('carry-over replay is idempotent and changed breakdown conflicts on the same identity', () => {
    const store = new Map();
    const first = buildWeeklyCarryOverDifferences({
        detectorResult: { weeklyAnalyses: [completedAnalysis()] },
        scopeKey: 'THA|company|employee',
        materializedStore: store
    });
    const replay = buildWeeklyCarryOverDifferences({
        detectorResult: { weeklyAnalyses: [completedAnalysis()] },
        scopeKey: 'THA|company|employee',
        materializedStore: store
    });
    const changed = buildWeeklyCarryOverDifferences({
        detectorResult: {
            weeklyAnalyses: [completedAnalysis({ sixthDayHours: 8 })]
        },
        scopeKey: 'THA|company|employee',
        materializedStore: store
    });

    assert.equal(first[0].materializationStatus, 'CREATED');
    assert.equal(replay[0].materializationStatus, 'IDEMPOTENT_REPLAY');
    assert.equal(changed[0].materializationStatus, 'CONFLICT');
    assert.equal(first[0].idempotencyKey, replay[0].idempotencyKey);
    assert.equal(first[0].idempotencyKey, changed[0].idempotencyKey);
});

test('production work-facts payload no longer hardcodes an empty carry-over array', async () => {
    const originalDetector = phaseDetectorService.detectPayrollPhasesForDateRange;
    phaseDetectorService.detectPayrollPhasesForDateRange = async () => ({
        phases: [],
        operationalPhases: [],
        warnings: [],
        weeklyAnalyses: [completedAnalysis()]
    });
    try {
        const payload = await generateWorkFactsForEmployeePeriod({
            team: 'THA',
            company_kod: 'company',
            kodikos: 'employee',
            apo: '2026-07-01',
            eos: '2026-07-31',
            scope: 'MONTHLY',
            asOfDate: '28/07/2026',
            asOfDateSource: 'SESSION_APP_DATE'
        });

        assert.equal(payload.status, 'READY');
        assert.equal(payload.asOfDate, '2026-07-28');
        assert.equal(payload.asOfDateSource, 'SESSION_APP_DATE');
        assert.equal(payload.weeklyCarryOverDifferences.length, 1);
        assert.equal(payload.weeklyCarryOverDifferences[0].targetPayrollMonth, '2026-07');
    } finally {
        phaseDetectorService.detectPayrollPhasesForDateRange = originalDetector;
    }
});

test('session appDate is normalized and invalid explicit values never use the clock', () => {
    let clockCalls = 0;
    const valid = resolveWorkFactsAsOfContext({
        explicitAsOfDate: '02/07/2026',
        explicitSource: 'SESSION_APP_DATE',
        clock: () => {
            clockCalls += 1;
            return new Date('2030-01-01T00:00:00.000Z');
        }
    });
    const invalid = resolveWorkFactsAsOfContext({
        explicitAsOfDate: '31/02/2026',
        explicitSource: 'SESSION_APP_DATE',
        clock: () => {
            clockCalls += 1;
            return new Date('2030-01-01T00:00:00.000Z');
        }
    });

    assert.deepEqual(valid, {
        ok: true,
        asOfDate: '2026-07-02',
        asOfDateSource: 'SESSION_APP_DATE',
        reason: null
    });
    assert.deepEqual(invalid, {
        ok: false,
        asOfDate: null,
        asOfDateSource: 'SESSION_APP_DATE',
        reason: 'INVALID_AS_OF_DATE'
    });
    assert.equal(clockCalls, 0);
});

test('system clock fallback is deterministic and used only when appDate is absent', () => {
    let clockCalls = 0;
    const context = resolveWorkFactsAsOfContext({
        explicitAsOfDate: '',
        clock: () => {
            clockCalls += 1;
            return new Date('2026-07-03T23:59:59.000Z');
        }
    });

    assert.deepEqual(context, {
        ok: true,
        asOfDate: '2026-07-03',
        asOfDateSource: 'SYSTEM_CLOCK',
        reason: null
    });
    assert.equal(clockCalls, 1);
});

test('invalid explicit appDate fails generation before phase detection', async () => {
    const originalDetector = phaseDetectorService.detectPayrollPhasesForDateRange;
    let detectorCalls = 0;
    phaseDetectorService.detectPayrollPhasesForDateRange = async () => {
        detectorCalls += 1;
        return {};
    };
    try {
        const payload = await generateWorkFactsForEmployeePeriod({
            team: 'THA',
            company_kod: 'company',
            kodikos: 'employee',
            apo: '2026-07-01',
            eos: '2026-07-31',
            scope: 'MONTHLY',
            asOfDate: 'invalid',
            asOfDateSource: 'SESSION_APP_DATE',
            clock: () => new Date('2026-07-28T00:00:00.000Z')
        });

        assert.equal(payload.status, 'FAILED');
        assert.equal(payload.asOfDate, null);
        assert.equal(payload.asOfDateSource, 'SESSION_APP_DATE');
        assert.ok(payload.warnings.includes('INVALID_AS_OF_DATE'));
        assert.equal(detectorCalls, 0);
    } finally {
        phaseDetectorService.detectPayrollPhasesForDateRange = originalDetector;
    }
});

test('carry-over is emitted only by the target payroll snapshot', () => {
    function payloadFor(month) {
        const end = month === '2026-06' ? '2026-06-30' : '2026-07-31';
        return buildReadyWorkFactsPayload({
            input: {
                team: 'THA',
                company_kod: 'company',
                kodikos: 'employee',
                apo: `${month}-01`,
                eos: end
            },
            normalizedScope: 'MONTHLY',
            detectorResult: {
                phases: [],
                operationalPhases: [],
                warnings: [],
                weeklyAnalyses: [completedAnalysis({ requestedMonth: month })]
            }
        });
    }
    const june = payloadFor('2026-06');
    const july = payloadFor('2026-07');

    assert.deepEqual(june.weeklyCarryOverDifferences, []);
    assert.equal(july.weeklyCarryOverDifferences.length, 1);
    assert.equal(
        july.weeklyCarryOverDifferences[0].sourcePayrollMonth,
        '2026-06'
    );
    assert.equal(
        july.weeklyCarryOverDifferences[0].targetPayrollMonth,
        '2026-07'
    );
});

test('real weekly analysis flows through work-facts payload into target-only carry-over', () => {
    const dailyRows = [];
    const orariaByDate = new Map();
    const start = new Date('2026-06-29T00:00:00.000Z');
    const hours = [4, 7, 4, 4, 4, 4, 6];
    for (let index = 0; index < 7; index += 1) {
        const current = new Date(start);
        current.setUTCDate(current.getUTCDate() + index);
        const date = current.toISOString().slice(0, 10);
        dailyRows.push({
            date,
            kathestos_apasxolhshs: 'FULL',
            hmeres_ergasias_ebdomadas: 5,
            ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8,
            pososto_prosayxhshs_6hs_hmeras: 40,
            termsSource: 'ERG_AKTUAL',
            sixthDayHours: 0,
            yperergasiaHours: date === '2026-06-30' ? 1 : date === '2026-07-02' ? 2 : 0,
            nomimiYperoriaHours: date === '2026-06-30' ? 0.5 : date === '2026-07-02' ? 1 : 0,
            paranomiYperoriaHours: 0
        });
        orariaByDate.set(date, {
            kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
            repo: index >= 5,
            ores_ergasias: 8,
            cards_ores_ergasias: hours[index],
            cards_apo_ora_01: '09:00',
            cards_eos_ora_01: '17:00'
        });
    }
    const weeklyAnalyses = [];
    phaseDetectorService.applyWeeklySixthSeventhDayFacts(
        dailyRows,
        orariaByDate,
        {
            requestedPeriodStart: '2026-07-01',
            requestedPeriodEnd: '2026-07-31',
            asOfDate: '2026-07-06',
            weeklyAnalyses
        }
    );
    const detectorResult = {
        phases: [],
        operationalPhases: [],
        warnings: [],
        weeklyAnalyses
    };
    const payload = buildReadyWorkFactsPayload({
        input: {
            team: 'THA',
            company_kod: 'company',
            kodikos: 'employee',
            apo: '2026-07-01',
            eos: '2026-07-31'
        },
        normalizedScope: 'MONTHLY',
        detectorResult
    });
    const replay = buildReadyWorkFactsPayload({
        input: {
            team: 'THA',
            company_kod: 'company',
            kodikos: 'employee',
            apo: '2026-07-01',
            eos: '2026-07-31'
        },
        normalizedScope: 'MONTHLY',
        detectorResult
    });

    assert.equal(weeklyAnalyses[0].status, 'READY');
    assert.equal(payload.weeklyCarryOverDifferences.length, 1);
    assert.deepEqual(payload.weeklyCarryOverDifferences[0].breakdown, {
        yperergasia: 1,
        yperoria: 0.5,
        sixthDay: 0,
        otherWeekly: 0
    });
    assert.deepEqual(
        payload.weeklyCarryOverDifferences[0].sourceFactDates,
        ['2026-06-30']
    );
    assert.equal(
        payload.weeklyCarryOverDifferences[0].idempotencyKey,
        replay.weeklyCarryOverDifferences[0].idempotencyKey
    );
});
