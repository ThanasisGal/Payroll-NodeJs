const assert = require('assert');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');

function facts(category, ores, cards, flags = {}) {
    const numericCards = Number(cards);
    const endMinutes = 9 * 60 + Math.round(numericCards * 60);
    const completePair = Number.isFinite(numericCards) && numericCards > 0
        ? {
              cards_apo_ora_01: '09:00',
              cards_eos_ora_01: `${String(Math.floor(endMinutes / 60) % 24).padStart(
                  2,
                  '0'
              )}:${String(endMinutes % 60).padStart(2, '0')}`
          }
        : {};
    return resolveDailyActualWorkFacts({
        kathgoria_ergasias: category,
        ores_ergasias: ores,
        cards_ores_ergasias: cards,
        ...completePair,
        ...flags
    });
}
const expected = (values) => {
    const cardHours = values.cardHours ?? 0;
    const hasCompleteCardEvidence = cardHours > 0;
    return {
        declaredWorkHours: values.actualWorkHours === 0 ? 0 : 8,
        cardHours: 0,
        hasCompleteCardEvidence,
        cardVerificationStatus: 'READY',
        verifiedCardHours: hasCompleteCardEvidence ? cardHours : 0,
        completeCardPairNumbers: hasCompleteCardEvidence ? ['01'] : [],
        unresolvedCardPairNumbers: [],
        ...values
    };
};

assert.deepStrictEqual(
    facts('ΑΔΕΙΑ', 8, 0, { adeia: true }),
    {
        category: 'ΑΔΕΙΑ',
        declaredWorkHours: 8,
        cardHours: 0,
        hasCompleteCardEvidence: false,
        cardVerificationStatus: 'READY',
        verifiedCardHours: 0,
        completeCardPairNumbers: [],
        unresolvedCardPairNumbers: [],
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
const finalizedAbsence = facts('ΕΡΓ', 8, 0, { apousia_apologistika: true });
assert.strictEqual(finalizedAbsence.category, 'ΑΠΟΥΣΙΑ');
assert.strictEqual(finalizedAbsence.actualWorkHours, 0);
assert.strictEqual(finalizedAbsence.countsAsActualWorkDay, false);
const finalizedAbsenceWithWork = facts('ΕΡΓ', 8, 4, {
    apousia_apologistika: true
});
assert.strictEqual(finalizedAbsenceWithWork.category, 'ΑΠΟΥΣΙΑ');
assert.strictEqual(finalizedAbsenceWithWork.actualWorkHours, 4);
assert.strictEqual(finalizedAbsenceWithWork.countsAsActualWorkDay, true);
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

const breakAdjustedFacts = facts('ΕΡΓ', 8, 419 / 60, {
    cards_apo_ora_01: '15:41',
    cards_eos_ora_01: '22:40',
    ores_ergasias_apologistika: 6.48
});
assert.strictEqual(breakAdjustedFacts.cardHours, 419 / 60);
assert.strictEqual(breakAdjustedFacts.hasCompleteCardEvidence, true);
assert.strictEqual(breakAdjustedFacts.actualWorkHours, 6.48);
assert.strictEqual(breakAdjustedFacts.countsAsActualWorkDay, true);

const zeroCalculatedRow = {
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_ores_ergasias: 6.98,
    cards_apo_ora_01: '15:41', cards_eos_ora_01: '22:40',
    ores_ergasias_apologistika: 0
};
assert.strictEqual(
    resolveDailyActualWorkFacts(zeroCalculatedRow).actualWorkHours,
    6.98,
    'pre-calculation callers retain the card-hours fallback'
);
assert.strictEqual(
    resolveDailyActualWorkFacts(zeroCalculatedRow, {
        calculatedWorkHoursAuthoritative: true
    }).actualWorkHours,
    0,
    'post-daily callers preserve a calculated zero'
);
assert.strictEqual(
    resolveDailyActualWorkFacts({ ...zeroCalculatedRow, _id: 'same-run' }, {
        calculatedWorkHoursAuthoritative: true,
        isCalculatedWorkHoursAuthoritativeForRow: (row) => row._id === 'same-run'
    }).actualWorkHours,
    0,
    'a row calculated in the same run preserves its calculated zero'
);
assert.strictEqual(
    resolveDailyActualWorkFacts({ ...zeroCalculatedRow, _id: 'context-only' }, {
        calculatedWorkHoursAuthoritative: true,
        isCalculatedWorkHoursAuthoritativeForRow: (row) => row._id === 'same-run'
    }).actualWorkHours,
    6.98,
    'a read-only weekly context row retains the card-hours fallback'
);
assert.strictEqual(
    resolveDailyActualWorkFacts({
        ...zeroCalculatedRow,
        is_locked: true,
        locked_by: 'HR',
        locked_at: new Date('2026-06-17T12:00:00.000Z')
    }).actualWorkHours,
    0,
    'locked HR ownership preserves a manual calculated zero'
);

const incompleteCardFacts = facts('ΕΡΓ', 8, 8, {
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: ''
});
assert.strictEqual(incompleteCardFacts.actualWorkHours, 0);
assert.strictEqual(incompleteCardFacts.leaveHours, 0);
assert.strictEqual(incompleteCardFacts.holidayCreditedHours, 0);
assert.strictEqual(incompleteCardFacts.category, 'ΕΡΓ');
assert.strictEqual(incompleteCardFacts.countsAsActualWorkDay, true);
assert.deepStrictEqual(incompleteCardFacts.reasons, ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION']);
assert.deepStrictEqual(incompleteCardFacts.warnings, ['INCOMPLETE_CARD_INTERVAL']);
assert.strictEqual(incompleteCardFacts.cardVerificationStatus, 'UNVERIFIED');
assert.strictEqual(incompleteCardFacts.verifiedCardHours, 0);
assert.deepStrictEqual(incompleteCardFacts.unresolvedCardPairNumbers, ['01']);

const approvedOrphanFacts = resolveDailyActualWorkFacts({
    ...incompleteCardFacts,
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
    ores_ergasias_apologistika: 8,
    orphan_card_resolution: {
        status: 'HR_APPROVED', policy_version: 'orphan-card-continuous:v1'
    }
}, { calculatedWorkHoursAuthoritative: true });
assert.strictEqual(approvedOrphanFacts.cardVerificationStatus, 'HR_APPROVED_ORPHAN');
assert.strictEqual(approvedOrphanFacts.actualWorkHours, 8);
assert.strictEqual(approvedOrphanFacts.countsAsActualWorkDay, true);
const unapprovedAuthoritativeOrphanFacts = resolveDailyActualWorkFacts({
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
    ores_ergasias_apologistika: 8
}, { calculatedWorkHoursAuthoritative: true });
assert.strictEqual(unapprovedAuthoritativeOrphanFacts.actualWorkHours, 0);
assert.deepStrictEqual(unapprovedAuthoritativeOrphanFacts.reasons,
    ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION']);

const partiallyVerifiedFacts = facts('ΕΡΓ', 8, 8, {
    cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '13:00',
    cards_apo_ora_02: '16:00',
    cards_eos_ora_02: ''
});
assert.strictEqual(partiallyVerifiedFacts.cardVerificationStatus, 'PARTIALLY_VERIFIED');
assert.strictEqual(partiallyVerifiedFacts.verifiedCardHours, 4);
assert.strictEqual(partiallyVerifiedFacts.actualWorkHours, 4);
assert.strictEqual(partiallyVerifiedFacts.countsAsActualWorkDay, true);
assert.deepStrictEqual(partiallyVerifiedFacts.completeCardPairNumbers, ['01']);
assert.deepStrictEqual(partiallyVerifiedFacts.unresolvedCardPairNumbers, ['02']);
assert.deepStrictEqual(partiallyVerifiedFacts.warnings, ['INCOMPLETE_CARD_INTERVAL']);

console.log('daily actual-work facts tests passed');
