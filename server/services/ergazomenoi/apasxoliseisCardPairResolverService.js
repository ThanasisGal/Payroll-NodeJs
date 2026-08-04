// Pure resolver for the currently persisted card-pair slots.
//
// It never fabricates a missing punch, never joins different slots and never
// changes the source row. Complete pairs remain usable even when another pair
// of the same day is incomplete or invalid.

const {
    normalizeTimeValue,
    timeToMinutes
} = require('./apasxoliseisScenarioFactsService');

const CARD_PAIR_NUMBERS = Object.freeze(['01', '02', '03']);

const CARD_PAIR_STATE = Object.freeze({
    EMPTY: 'EMPTY',
    COMPLETE: 'COMPLETE',
    START_ONLY: 'START_ONLY',
    END_ONLY: 'END_ONLY',
    INVALID_TIME: 'INVALID_TIME',
    ZERO_LENGTH: 'ZERO_LENGTH'
});

const CARD_VERIFICATION_STATUS = Object.freeze({
    READY: 'READY',
    PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
    UNVERIFIED: 'UNVERIFIED'
});

function rawValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function buildResolvedPair(row = {}, pairNumber) {
    const startField = `cards_apo_ora_${pairNumber}`;
    const endField = `cards_eos_ora_${pairNumber}`;
    const rawStart = rawValue(row[startField]);
    const rawEnd = rawValue(row[endField]);
    const hasRawStart = rawStart !== '';
    const hasRawEnd = rawEnd !== '';
    const start = normalizeTimeValue(rawStart);
    const end = normalizeTimeValue(rawEnd);

    let state = CARD_PAIR_STATE.EMPTY;
    if ((hasRawStart && start === null) || (hasRawEnd && end === null)) {
        state = CARD_PAIR_STATE.INVALID_TIME;
    } else if (hasRawStart && !hasRawEnd) {
        state = CARD_PAIR_STATE.START_ONLY;
    } else if (!hasRawStart && hasRawEnd) {
        state = CARD_PAIR_STATE.END_ONLY;
    } else if (hasRawStart && hasRawEnd) {
        state = start === end ? CARD_PAIR_STATE.ZERO_LENGTH : CARD_PAIR_STATE.COMPLETE;
    }

    const isComplete = state === CARD_PAIR_STATE.COMPLETE;
    const startMinutes = isComplete ? timeToMinutes(start) : null;
    const endMinutes = isComplete ? timeToMinutes(end) : null;
    const isOvernight = isComplete && endMinutes < startMinutes;
    const durationMinutes = isComplete
        ? isOvernight
            ? endMinutes + 24 * 60 - startMinutes
            : endMinutes - startMinutes
        : 0;

    return Object.freeze({
        pairNumber,
        startField,
        endField,
        rawStart,
        rawEnd,
        start,
        end,
        startMinutes,
        endMinutes,
        state,
        isComplete,
        isOvernight,
        durationMinutes
    });
}

function discoverPairNumbers(row = {}) {
    const discovered = new Set(CARD_PAIR_NUMBERS);
    for (const field of Object.keys(row && typeof row === 'object' ? row : {})) {
        const match = field.match(/^cards_(?:apo|eos)_ora_(\d+)$/);
        if (match) discovered.add(String(match[1]).padStart(2, '0'));
    }
    return [...discovered].sort((left, right) => Number(left) - Number(right));
}

function resolveCardPairVerification(row = {}, options = {}) {
    const configuredPairNumbers = Array.isArray(options.pairNumbers)
        ? options.pairNumbers
        : discoverPairNumbers(row);
    const pairNumbers = configuredPairNumbers.map((value) => String(value).padStart(2, '0'));
    const pairs = pairNumbers.map((pairNumber) => buildResolvedPair(row, pairNumber));
    const completePairs = pairs.filter((pair) => pair.isComplete);
    const unresolvedPairs = pairs.filter(
        (pair) => !pair.isComplete && pair.state !== CARD_PAIR_STATE.EMPTY
    );
    const reportedCardHours = Number(
        String(row.cards_ores_ergasias ?? '').replace(',', '.').trim()
    );
    const hasPositiveReportedCardHours =
        Number.isFinite(reportedCardHours) && reportedCardHours > 0;
    const aggregateHoursWithoutPairs =
        hasPositiveReportedCardHours &&
        completePairs.length === 0 &&
        unresolvedPairs.length === 0;
    const hasUnresolvedCardEvidence =
        unresolvedPairs.length > 0 || aggregateHoursWithoutPairs;

    let status = CARD_VERIFICATION_STATUS.READY;
    if (hasUnresolvedCardEvidence) {
        status = completePairs.length > 0
            ? CARD_VERIFICATION_STATUS.PARTIALLY_VERIFIED
            : CARD_VERIFICATION_STATUS.UNVERIFIED;
    }

    const verifiedMinutes = completePairs.reduce(
        (total, pair) => total + pair.durationMinutes,
        0
    );

    return Object.freeze({
        status,
        pairs: Object.freeze(pairs),
        completePairs: Object.freeze(completePairs),
        unresolvedPairs: Object.freeze(unresolvedPairs),
        completePairNumbers: Object.freeze(completePairs.map((pair) => pair.pairNumber)),
        unresolvedPairNumbers: Object.freeze(
            unresolvedPairs.map((pair) => pair.pairNumber)
        ),
        verifiedMinutes,
        verifiedHours: verifiedMinutes / 60,
        hasCompleteCardEvidence: completePairs.length > 0,
        hasUnresolvedCardEvidence,
        aggregateHoursWithoutPairs
    });
}

module.exports = {
    CARD_PAIR_NUMBERS,
    CARD_PAIR_STATE,
    CARD_VERIFICATION_STATUS,
    buildResolvedPair,
    discoverPairNumbers,
    resolveCardPairVerification
};
