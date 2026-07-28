const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildWeeklyCarryOverDifferences,
    generateWorkFactsForEmployeePeriod
} = require('./workFactsPrecalcService');
const phaseDetectorService = require('./phaseDetectorService');

function completedAnalysis({ sixthDayHours = 7 } = {}) {
    return {
        weekStart: '2026-06-29',
        weekEnd: '2026-07-05',
        status: 'READY',
        complete: true,
        dailyFacts: [
            {
                date: '2026-06-29',
                yperergasiaHours: 1,
                nomimiYperoriaHours: 0.5,
                paranomiYperoriaHours: 0,
                sixthDayHours
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
    assert.deepEqual(result[0].breakdown, {
        yperergasia: 1,
        yperoria: 0.5,
        sixthDay: 7,
        otherWeekly: 0
    });
    assert.match(result[0].idempotencyKey, /^[a-f0-9]{64}$/);
    assert.equal(result[0].policyVersion, 'weekly-payroll-carry-over:v1');
});

test('open trailing week produces no carry-over', () => {
    const result = buildWeeklyCarryOverDifferences({
        detectorResult: {
            weeklyAnalyses: [{
                ...completedAnalysis(),
                complete: false,
                status: 'OPEN_WEEK_PENDING_COMPLETION'
            }]
        },
        scopeKey: 'THA|company|employee'
    });

    assert.deepEqual(result, []);
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
            scope: 'MONTHLY'
        });

        assert.equal(payload.status, 'READY');
        assert.equal(payload.weeklyCarryOverDifferences.length, 1);
        assert.equal(payload.weeklyCarryOverDifferences[0].targetPayrollMonth, '2026-07');
    } finally {
        phaseDetectorService.detectPayrollPhasesForDateRange = originalDetector;
    }
});
