const assert = require('assert');

const {
    SCHEDULE_CATEGORY,
    parseErganiScheduleCell
} = require('./erganiScheduleCellParserService');

function testSingleWorkIntervalWithoutOvertime() {
    const result = parseErganiScheduleCell('ΕΡΓΑΣΙΑ 08:00-16:00');

    assert.strictEqual(result.category, SCHEDULE_CATEGORY.WORK);
    assert.deepStrictEqual(result.pairs, [{ from: '08:00', to: '16:00' }]);
    assert.strictEqual(result.ignoredOvertimeAnnotation, false);
}

function testOvertimeNeverBecomesSecondDeclaredInterval() {
    const result = parseErganiScheduleCell(
        'ΕΡΓΑΣΙΑ 08:00-16:00 Υπερωρία 17:59-18:00'
    );

    assert.strictEqual(result.category, SCHEDULE_CATEGORY.WORK);
    assert.deepStrictEqual(result.pairs, [{ from: '08:00', to: '16:00' }]);
    assert.strictEqual(result.scheduleText, 'ΕΡΓΑΣΙΑ 08:00-16:00');
    assert.strictEqual(result.ignoredOvertimeAnnotation, true);
}

function testUnaccentedOvertimeIsAlsoIgnored() {
    const result = parseErganiScheduleCell(
        'ΕΡΓΑΣΙΑ 08:00-16:00 Υπερωρια 17:59-18:00'
    );

    assert.deepStrictEqual(result.pairs, [{ from: '08:00', to: '16:00' }]);
    assert.strictEqual(result.ignoredOvertimeAnnotation, true);
}

function testLegitimateSplitShiftBeforeOvertimeIsPreserved() {
    const result = parseErganiScheduleCell(
        'ΕΡΓΑΣΙΑ 09:00-13:00 16:00-20:00 Υπερωρία 20:00-21:00'
    );

    assert.strictEqual(result.category, SCHEDULE_CATEGORY.WORK);
    assert.deepStrictEqual(result.pairs, [
        { from: '09:00', to: '13:00' },
        { from: '16:00', to: '20:00' }
    ]);
}

function testRestWithOvertimeKeepsOnlyRestClassification() {
    const result = parseErganiScheduleCell(
        'ΑΝΑΠΑΥΣΗ/ΡΕΠΟ Υπερωρία 10:01-13:01'
    );

    assert.strictEqual(result.category, SCHEDULE_CATEGORY.REST);
    assert.deepStrictEqual(result.pairs, []);
    assert.strictEqual(result.ignoredOvertimeAnnotation, true);
}

function testTeleworkOvertimeIsIgnored() {
    const result = parseErganiScheduleCell(
        'ΤΗΛΕΡΓΑΣΙΑ 10:00-18:00 Υπερωρία 18:00-19:00'
    );

    assert.strictEqual(result.category, SCHEDULE_CATEGORY.TELEWORK);
    assert.deepStrictEqual(result.pairs, [{ from: '10:00', to: '18:00' }]);
}

function testTwoIntervalsWithoutOvertimeRemainSplitShift() {
    const result = parseErganiScheduleCell(
        'ΕΡΓΑΣΙΑ 09:00-13:00 16:00-20:00'
    );

    assert.deepStrictEqual(result.pairs, [
        { from: '09:00', to: '13:00' },
        { from: '16:00', to: '20:00' }
    ]);
    assert.strictEqual(result.ignoredOvertimeAnnotation, false);
}

testSingleWorkIntervalWithoutOvertime();
testOvertimeNeverBecomesSecondDeclaredInterval();
testUnaccentedOvertimeIsAlsoIgnored();
testLegitimateSplitShiftBeforeOvertimeIsPreserved();
testRestWithOvertimeKeepsOnlyRestClassification();
testTeleworkOvertimeIsIgnored();
testTwoIntervalsWithoutOvertimeRemainSplitShift();

console.log('ERGANI schedule cell parser tests passed');
