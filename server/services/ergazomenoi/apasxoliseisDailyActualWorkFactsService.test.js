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
const expected = (values) => ({
    declaredWorkHours: values.actualWorkHours === 0 ? 0 : 8,
    cardHours: 0,
    hasCompleteCardEvidence: false,
    ...values
});

assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 0, { adeia: true }),
    {
        category: 'ΑΔΕΙΑ',
        declaredWorkHours: 8,
        cardHours: 0,
        hasCompleteCardEvidence: false,
        actualWorkHours: 0,
        leaveHours: 8,
        holidayCreditedHours: 0,
        sicknessHours: 0,
        countsAsActualWorkDay: false,
        reasons: [],
        warnings: []
    }
);
assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 4, { adeia: true }),
    expected({ category: 'ΑΔΕΙΑ', cardHours: 4, actualWorkHours: 4, leaveHours: 0, holidayCreditedHours: 0, sicknessHours: 0, countsAsActualWorkDay: true, reasons: ['FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION'], warnings: [] })
);
assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 4, { adeia: true, explicit_hourly_leave_hours: 4 }),
    expected({ category: 'ΑΔΕΙΑ', cardHours: 4, actualWorkHours: 4, leaveHours: 4, holidayCreditedHours: 0, sicknessHours: 0, countsAsActualWorkDay: true, reasons: [], warnings: ['MIXED_WORK_AND_HOURLY_LEAVE'] })
);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 8, { argia: true }).actualWorkHours, 8);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 0, { argia: true }).actualWorkHours, 0);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 0, { argia: true }).holidayCreditedHours, 8);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 4, { argia: true }).holidayCreditedHours, 4);
assert.strictEqual(facts('ΑΡΓΙΑ', 8, 0, { argia: true }).countsAsActualWorkDay, false);
assert.deepStrictEqual(
    facts('ΑΣΘΕΝΕΙΑ', 0, 0, { astheneia: true }),
    expected({ category: 'ΑΣΘΕΝΕΙΑ', actualWorkHours: 0, leaveHours: 0, holidayCreditedHours: 0, sicknessHours: 0, countsAsActualWorkDay: false, reasons: [], warnings: [] })
);
assert.deepStrictEqual(
    facts('ΑΣΘΕΝΕΙΑ', 8, 6, { astheneia: true }),
    expected({ category: 'ΑΣΘΕΝΕΙΑ', cardHours: 6, actualWorkHours: 6, leaveHours: 0, holidayCreditedHours: 0, sicknessHours: 2, countsAsActualWorkDay: true, reasons: [], warnings: ['MIXED_WORK_AND_SICKNESS'] })
);
assert.strictEqual(facts('ΑΣΘΕΝΕΙΑ', 8, 0, { astheneia: true }).sicknessHours, 8);
assert.strictEqual(facts('ΕΡΓ', 8, 8).actualWorkHours, 8);
assert.strictEqual(facts('ΕΡΓ', 8, 0).actualWorkHours, 0);
assert.ok(facts('ΑΔΕΙΑ', 8, 9, { adeia: true }).warnings.includes('CARD_HOURS_EXCEED_DECLARED_HOURS'));
assert.ok(facts('ΕΡΓ', 'bad', 8).reasons.includes('INVALID_DECLARED_HOURS'));
const cardFacts = facts('ΕΡΓ', 8, 8, {
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '17:00'
});
assert.strictEqual(cardFacts.cardHours, 8);
assert.strictEqual(cardFacts.hasCompleteCardEvidence, true);

const incompleteCardFacts = facts('ΕΡΓ', 8, 8, {
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: ''
});
assert.strictEqual(incompleteCardFacts.actualWorkHours, 0);
assert.strictEqual(incompleteCardFacts.leaveHours, 0);
assert.strictEqual(incompleteCardFacts.holidayCreditedHours, 0);
assert.strictEqual(incompleteCardFacts.countsAsActualWorkDay, false);
assert.deepStrictEqual(incompleteCardFacts.reasons, []);
assert.deepStrictEqual(incompleteCardFacts.warnings, ['INCOMPLETE_CARD_INTERVAL']);

console.log('daily actual-work facts tests passed');
