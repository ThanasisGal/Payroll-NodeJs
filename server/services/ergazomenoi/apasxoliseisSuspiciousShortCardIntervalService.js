'use strict';

const { resolveCardPairVerification, CARD_PAIR_STATE } =
    require('./apasxoliseisCardPairResolverService');
const { buildDeclaredIntervals } = require('./apasxoliseisScenarioFactsService');
const { isApprovedHrDailyActualWorkResolution } =
    require('./apasxoliseisHrDailyActualWorkResolutionService');

const REASON = 'SUSPICIOUS_SHORT_CARD_INTERVAL_REQUIRES_HR_DECISION';
const DEFAULTS = Object.freeze({ enabled: false, veryShortMinutes: 5, shortMinutes: 60,
    maxDeclaredPercentage: 25, minimumMissingDeclaredMinutes: 60 });

function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSuspiciousShortPolicy(company = {}) {
    return Object.freeze({
        enabled: company.elegxos_ypopta_mikron_diastimaton_kartas === true,
        veryShortMinutes: number(company.poly_mikro_diastima_kartas_eos_lepta, 5),
        shortMinutes: number(company.mikro_diastima_kartas_eos_lepta, 60),
        maxDeclaredPercentage: number(
            company.mikro_diastima_kartas_max_pososto_programmatos, 25),
        minimumMissingDeclaredMinutes: number(
            company.mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta,
            60)
    });
}

function detectSuspiciousShortCardInterval(row = {}, company = {}) {
    const policy = normalizeSuspiciousShortPolicy(company);
    const verification = resolveCardPairVerification(row);
    const declaredMinutes = buildDeclaredIntervals(row)
        .reduce((sum, interval) => sum + Number(interval.durationMinutes || 0), 0);
    const base = { suspicious: false, reason: null, matchedRule: null,
        verifiedMinutes: verification.verifiedMinutes, declaredMinutes,
        percentage: declaredMinutes > 0
            ? verification.verifiedMinutes / declaredMinutes * 100 : null,
        missingDeclaredMinutes: Math.max(0, declaredMinutes - verification.verifiedMinutes),
        thresholds: policy };
    const excludedAuthority = row.egkekrimenh_oroadeia_apologistika === true ||
        row.adeia_apologistika === true || row.astheneia_apologistika === true ||
        row.adeia === true || row.astheneia === true ||
        isApprovedHrDailyActualWorkResolution(row);
    const hasZeroLength = verification.unresolvedPairs.some(
        pair => pair.state === CARD_PAIR_STATE.ZERO_LENGTH);
    const isDeclaredWork = String(row.kathgoria_ergasias || '').trim().toUpperCase() === 'ΕΡΓ';
    if (!policy.enabled || !isDeclaredWork || excludedAuthority || declaredMinutes <= 0 ||
        verification.verifiedMinutes <= 0 || verification.hasUnresolvedCardEvidence ||
        !verification.hasCompleteCardEvidence || hasZeroLength) return Object.freeze(base);

    const percentage = base.percentage;
    const missing = base.missingDeclaredMinutes;
    const matchedRule = verification.verifiedMinutes <= policy.veryShortMinutes
        ? 'VERY_SHORT'
        : verification.verifiedMinutes <= policy.shortMinutes &&
            percentage <= policy.maxDeclaredPercentage &&
            missing >= policy.minimumMissingDeclaredMinutes
            ? 'SHORT_RELATIVE_TO_DECLARED' : null;
    return Object.freeze({ ...base, suspicious: Boolean(matchedRule),
        reason: matchedRule ? REASON : null, matchedRule });
}

module.exports = { REASON, DEFAULTS, normalizeSuspiciousShortPolicy,
    detectSuspiciousShortCardInterval };
