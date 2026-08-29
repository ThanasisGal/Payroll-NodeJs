'use strict';

const { CARD_PAIR_STATE, resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { normalizeTimeValue, timeToMinutes } = require('./apasxoliseisScenarioFactsService');
const { STATUS: REST_STATUS, evaluateSplitShiftRest } =
    require('./apasxoliseisRestPeriodPolicyService');

const DECLARED_PAIRS = Object.freeze(['01', '02', '03']);

function minutesToTime(total) {
    if (!Number.isFinite(total)) return null;
    const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function intervalDurationMinutes(start, end) {
    const from = timeToMinutes(start);
    const to = timeToMinutes(end);
    if (from === null || to === null || from === to) return 0;
    return to < from ? to + 1440 - from : to - from;
}

function totalDeclaredDailyMinutes(row = {}) {
    const intervalTotal = DECLARED_PAIRS.reduce((total, pair) => total + intervalDurationMinutes(
        row[`apo_ora_${pair}`], row[`eos_ora_${pair}`]
    ), 0);
    if (intervalTotal > 0) return intervalTotal;
    const hours = Number(String(row.ores_ergasias ?? '').replace(',', '.').trim());
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
}

function resolveApologistikoArrivalDecision({ declaredStart, actualArrival, flexibleArrivalMinutes = 0 } = {}) {
    const declared = timeToMinutes(declaredStart);
    const actual = timeToMinutes(actualArrival);
    const flexible = Math.max(0, Number.parseInt(flexibleArrivalMinutes, 10) || 0);
    if (declared === null || actual === null) return Object.freeze({ resolved: false, requiresBook: false });
    return Object.freeze({
        resolved: true,
        requiresBook: actual < declared || actual > declared + flexible,
        declaredStartMinutes: declared,
        actualArrivalMinutes: actual,
        inclusiveLatestArrivalMinutes: declared + flexible
    });
}

function buildDurationAnchoredInterval({ row = {}, actualArrival } = {}) {
    const start = normalizeTimeValue(actualArrival);
    const startMinutes = timeToMinutes(start);
    const durationMinutes = totalDeclaredDailyMinutes(row);
    if (!start || startMinutes === null || durationMinutes <= 0) return null;
    return Object.freeze({ start, end: minutesToTime(startMinutes + durationMinutes), durationMinutes });
}

function buildValidSplitProgramCardProjection(row = {}, { flexibleArrivalMinutes = 0 } = {}) {
    const projected = {};
    let pairCount = 0;
    let hasDeviation = false;
    for (const pair of DECLARED_PAIRS) {
        const declaredStart = normalizeTimeValue(row[`apo_ora_${pair}`]);
        const declaredEnd = normalizeTimeValue(row[`eos_ora_${pair}`]);
        const cardStart = normalizeTimeValue(row[`cards_apo_ora_${pair}`]);
        const cardEnd = normalizeTimeValue(row[`cards_eos_ora_${pair}`]);
        if (!declaredStart || !declaredEnd || !cardStart || !cardEnd) continue;
        pairCount += 1;
        const decision = resolveApologistikoArrivalDecision({ declaredStart,
            actualArrival: cardStart, flexibleArrivalMinutes });
        hasDeviation ||= decision.requiresBook;
        const declaredDuration = intervalDurationMinutes(declaredStart, declaredEnd);
        projected[`apo_ora_${pair}_apologistika`] = cardStart;
        projected[`eos_ora_${pair}_apologistika`] = decision.requiresBook
            ? minutesToTime(timeToMinutes(cardStart) + declaredDuration) : cardEnd;
    }
    if (pairCount < 2 || !hasDeviation) return null;
    for (const pair of DECLARED_PAIRS) {
        projected[`apo_ora_${pair}_apologistika`] ||= '';
        projected[`eos_ora_${pair}_apologistika`] ||= '';
    }
    const projectedAsCards = Object.fromEntries(DECLARED_PAIRS.flatMap((pair) => [
        [`cards_apo_ora_${pair}`, projected[`apo_ora_${pair}_apologistika`]],
        [`cards_eos_ora_${pair}`, projected[`eos_ora_${pair}_apologistika`]]
    ]));
    if (evaluateSplitShiftRest(projectedAsCards).status !== REST_STATUS.READY) return null;
    return Object.freeze({ apologistiko_biblio: true, ...projected });
}

function resolveSafeStartOnlyOrphan(row = {}, { flexibleArrivalMinutes = 0 } = {}) {
    const verification = resolveCardPairVerification(row);
    if (verification.completePairs.length !== 0 || verification.unresolvedPairs.length !== 1) return null;
    const orphan = verification.unresolvedPairs[0];
    if (orphan.state !== CARD_PAIR_STATE.START_ONLY) return null;
    const anchored = buildDurationAnchoredInterval({ row, actualArrival: orphan.start });
    if (!anchored) return null;
    const declaredStart = normalizeTimeValue(row[`apo_ora_${orphan.pairNumber}`]) ||
        DECLARED_PAIRS.map((pair) => normalizeTimeValue(row[`apo_ora_${pair}`])).find(Boolean);
    const decision = resolveApologistikoArrivalDecision({ declaredStart, actualArrival: orphan.start,
        flexibleArrivalMinutes });
    if (!decision.resolved) return null;
    return Object.freeze({ pairNumber: orphan.pairNumber, ...anchored,
        requiresBook: decision.requiresBook, diagnostic: 'SAFE_START_ONLY_ORPHAN_DERIVED' });
}

function buildAutoAttendanceReset() {
    return {
        apologistiko_biblio: false,
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: ''
    };
}

module.exports = { intervalDurationMinutes, totalDeclaredDailyMinutes, minutesToTime,
    resolveApologistikoArrivalDecision, buildDurationAnchoredInterval,
    buildValidSplitProgramCardProjection, resolveSafeStartOnlyOrphan, buildAutoAttendanceReset };
