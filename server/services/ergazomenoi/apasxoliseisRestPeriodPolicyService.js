// Pure policy checks for rest periods between verified card intervals.
//
// The service never completes a missing punch and never uses declared hours as
// a substitute for card evidence. Any unresolved card evidence makes the
// relevant rest check an HR/technical pending case.

const {
    CARD_VERIFICATION_STATUS,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');

const POLICY_VERSION = 'verified-card-rest-periods:v1';

const MINIMUM_SPLIT_REST_MINUTES = 3 * 60;
const MINIMUM_INTERDAY_REST_MINUTES = 11 * 60;

const STATUS = Object.freeze({
    READY: 'READY',
    VIOLATION: 'VIOLATION',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    NEEDS_HR_DECISION: 'NEEDS_HR_DECISION'
});

const REASON = Object.freeze({
    CARD_VERIFICATION_PENDING: 'CARD_VERIFICATION_PENDING',
    MISSING_OR_INVALID_DATE: 'MISSING_OR_INVALID_DATE',
    INVALID_DATE_SEQUENCE: 'INVALID_DATE_SEQUENCE',
    SPLIT_REST_BELOW_MINIMUM: 'SPLIT_REST_BELOW_MINIMUM',
    SPLIT_INTERVALS_OVERLAP: 'SPLIT_INTERVALS_OVERLAP',
    INTERDAY_REST_BELOW_MINIMUM: 'INTERDAY_REST_BELOW_MINIMUM',
    INTERDAY_INTERVALS_OVERLAP: 'INTERDAY_INTERVALS_OVERLAP'
});

function freezeArray(values = []) {
    return Object.freeze([...values]);
}

function makeResult({
    checkType,
    status,
    reasons = [],
    warnings = [],
    minimumRestMinutes,
    measuredRestMinutes = null,
    details = []
}) {
    return Object.freeze({
        policyVersion: POLICY_VERSION,
        checkType,
        status,
        reasons: freezeArray([...new Set(reasons)]),
        warnings: freezeArray([...new Set(warnings)]),
        minimumRestMinutes,
        measuredRestMinutes,
        details: freezeArray(details.map((detail) => Object.freeze({ ...detail })))
    });
}

function dateStartUtc(value) {
    if (!value) return null;

    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
    );
}

function completePairBounds(pair) {
    const start = Number(pair.startMinutes);
    const end = start + Number(pair.durationMinutes);

    return { start, end };
}

function pendingCardResult({ checkType, minimumRestMinutes, verifications }) {
    return makeResult({
        checkType,
        status: STATUS.NEEDS_HR_DECISION,
        reasons: [REASON.CARD_VERIFICATION_PENDING],
        warnings: verifications.flatMap((verification, index) =>
            verification.unresolvedPairNumbers.map(
                (pairNumber) => `ROW_${index + 1}_UNRESOLVED_CARD_PAIR_${pairNumber}`
            )
        ),
        minimumRestMinutes
    });
}

function evaluateSplitShiftRest(row = {}, options = {}) {
    const minimumRestMinutes = Number.isFinite(Number(options.minimumRestMinutes))
        ? Math.max(0, Number(options.minimumRestMinutes))
        : MINIMUM_SPLIT_REST_MINUTES;
    const verification = resolveCardPairVerification(row);

    const occupiedPairCount = verification.pairs.filter(
        (pair) => pair.state !== 'EMPTY'
    ).length;

    if (occupiedPairCount < 2) {
        return makeResult({
            checkType: 'SPLIT_SHIFT_REST',
            status: STATUS.NOT_APPLICABLE,
            minimumRestMinutes
        });
    }

    if (verification.status !== CARD_VERIFICATION_STATUS.READY) {
        return pendingCardResult({
            checkType: 'SPLIT_SHIFT_REST',
            minimumRestMinutes,
            verifications: [verification]
        });
    }

    const details = [];
    const reasons = [];

    for (let index = 1; index < verification.completePairs.length; index += 1) {
        const previousPair = verification.completePairs[index - 1];
        const nextPair = verification.completePairs[index];
        const previousBounds = completePairBounds(previousPair);
        const nextBounds = completePairBounds(nextPair);
        const restMinutes = nextBounds.start - previousBounds.end;

        details.push({
            previousPairNumber: previousPair.pairNumber,
            nextPairNumber: nextPair.pairNumber,
            previousEnd: previousPair.end,
            nextStart: nextPair.start,
            restMinutes
        });

        if (restMinutes < 0) {
            reasons.push(REASON.SPLIT_INTERVALS_OVERLAP);
        } else if (restMinutes < minimumRestMinutes) {
            reasons.push(REASON.SPLIT_REST_BELOW_MINIMUM);
        }
    }

    const measuredRestMinutes = Math.min(...details.map((detail) => detail.restMinutes));

    return makeResult({
        checkType: 'SPLIT_SHIFT_REST',
        status: reasons.length > 0 ? STATUS.VIOLATION : STATUS.READY,
        reasons,
        minimumRestMinutes,
        measuredRestMinutes,
        details
    });
}

function evaluateInterdayRest(currentRow = {}, nextRow = {}, options = {}) {
    const minimumRestMinutes = Number.isFinite(Number(options.minimumRestMinutes))
        ? Math.max(0, Number(options.minimumRestMinutes))
        : MINIMUM_INTERDAY_REST_MINUTES;
    const currentVerification = resolveCardPairVerification(currentRow);
    const nextVerification = resolveCardPairVerification(nextRow);
    const currentHasCardEvidence =
        currentVerification.completePairs.length > 0 ||
        currentVerification.unresolvedPairs.length > 0 ||
        currentVerification.aggregateHoursWithoutPairs;
    const nextHasCardEvidence =
        nextVerification.completePairs.length > 0 ||
        nextVerification.unresolvedPairs.length > 0 ||
        nextVerification.aggregateHoursWithoutPairs;

    if (!currentHasCardEvidence || !nextHasCardEvidence) {
        return makeResult({
            checkType: 'INTERDAY_REST',
            status: STATUS.NOT_APPLICABLE,
            minimumRestMinutes
        });
    }

    if (
        currentVerification.status !== CARD_VERIFICATION_STATUS.READY ||
        nextVerification.status !== CARD_VERIFICATION_STATUS.READY
    ) {
        return pendingCardResult({
            checkType: 'INTERDAY_REST',
            minimumRestMinutes,
            verifications: [currentVerification, nextVerification]
        });
    }

    const currentDateStart = dateStartUtc(currentRow.hmeromhnia);
    const nextDateStart = dateStartUtc(nextRow.hmeromhnia);

    if (currentDateStart === null || nextDateStart === null) {
        return makeResult({
            checkType: 'INTERDAY_REST',
            status: STATUS.NEEDS_HR_DECISION,
            reasons: [REASON.MISSING_OR_INVALID_DATE],
            minimumRestMinutes
        });
    }

    if (nextDateStart <= currentDateStart) {
        return makeResult({
            checkType: 'INTERDAY_REST',
            status: STATUS.NEEDS_HR_DECISION,
            reasons: [REASON.INVALID_DATE_SEQUENCE],
            minimumRestMinutes
        });
    }

    const currentLastPair = currentVerification.completePairs.reduce((latest, pair) =>
        completePairBounds(pair).end > completePairBounds(latest).end ? pair : latest
    );
    const nextFirstPair = nextVerification.completePairs.reduce((earliest, pair) =>
        completePairBounds(pair).start < completePairBounds(earliest).start
            ? pair
            : earliest
    );
    const currentLastBounds = completePairBounds(currentLastPair);
    const nextFirstBounds = completePairBounds(nextFirstPair);
    const currentEndTimestamp = currentDateStart + currentLastBounds.end * 60 * 1000;
    const nextStartTimestamp = nextDateStart + nextFirstBounds.start * 60 * 1000;
    const measuredRestMinutes = (nextStartTimestamp - currentEndTimestamp) / (60 * 1000);
    const reasons = [];

    if (measuredRestMinutes < 0) {
        reasons.push(REASON.INTERDAY_INTERVALS_OVERLAP);
    } else if (measuredRestMinutes < minimumRestMinutes) {
        reasons.push(REASON.INTERDAY_REST_BELOW_MINIMUM);
    }

    return makeResult({
        checkType: 'INTERDAY_REST',
        status: reasons.length > 0 ? STATUS.VIOLATION : STATUS.READY,
        reasons,
        minimumRestMinutes,
        measuredRestMinutes,
        details: [
            {
                currentPairNumber: currentLastPair.pairNumber,
                nextPairNumber: nextFirstPair.pairNumber,
                currentEnd: currentLastPair.end,
                nextStart: nextFirstPair.start,
                currentDate: new Date(currentDateStart).toISOString().slice(0, 10),
                nextDate: new Date(nextDateStart).toISOString().slice(0, 10),
                restMinutes: measuredRestMinutes
            }
        ]
    });
}

module.exports = {
    POLICY_VERSION,
    MINIMUM_SPLIT_REST_MINUTES,
    MINIMUM_INTERDAY_REST_MINUTES,
    STATUS,
    REASON,
    evaluateSplitShiftRest,
    evaluateInterdayRest
};
