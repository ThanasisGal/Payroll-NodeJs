const assert = require('assert');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');

function facts(category, ores, cards, flags = {}) {
    return resolveDailyActualWorkFacts({
        kathgoria_ergasias: category,
        ores_ergasias: ores,
        cards_ores_ergasias: cards,
        ...flags
    });
}

assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 0, { adeia: true }),
    { category: 'ΑΔΕΙΑ', actualWorkHours: 8, leaveHours: 0, sicknessHours: 0, countsAsActualWorkDay: true, reasons: [], warnings: [] }
);
assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 4, { adeia: true }),
    { category: 'ΑΔΕΙΑ', actualWorkHours: 4, leaveHours: 4, sicknessHours: 0, countsAsActualWorkDay: true, reasons: [], warnings: ['MIXED_WORK_AND_HOURLY_LEAVE'] }
);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 8, { argia: true }).actualWorkHours, 8);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 0, { argia: true }).actualWorkHours, 8);
assert.deepStrictEqual(
    facts('ΑΣΘΕΝΕΙΑ', 0, 0, { astheneia: true }),
    { category: 'ΑΣΘΕΝΕΙΑ', actualWorkHours: 0, leaveHours: 0, sicknessHours: 0, countsAsActualWorkDay: false, reasons: [], warnings: [] }
);
assert.deepStrictEqual(
    facts('ΑΣΘΕΝΕΙΑ', 8, 6, { astheneia: true }),
    { category: 'ΑΣΘΕΝΕΙΑ', actualWorkHours: 6, leaveHours: 0, sicknessHours: 2, countsAsActualWorkDay: true, reasons: [], warnings: ['MIXED_WORK_AND_SICKNESS'] }
);
assert.strictEqual(facts('ΑΣΘΕΝΕΙΑ', 8, 0, { astheneia: true }).sicknessHours, 8);
assert.strictEqual(facts('ΕΡΓ', 8, 8).actualWorkHours, 8);
assert.strictEqual(facts('ΕΡΓ', 8, 0).actualWorkHours, 0);
assert.ok(facts('ΑΔΕΙΑ', 8, 9, { adeia: true }).warnings.includes('CARD_HOURS_EXCEED_DECLARED_HOURS'));
assert.ok(facts('ΕΡΓ', 'bad', 8).reasons.includes('INVALID_DECLARED_HOURS'));

console.log('daily actual-work facts tests passed');
