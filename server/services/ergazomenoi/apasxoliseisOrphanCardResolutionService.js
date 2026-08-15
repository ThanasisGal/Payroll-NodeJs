'use strict';

const {
    CARD_PAIR_STATE,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');
const {
    buildDeclaredIntervals,
    buildApologistikaIntervals,
    normalizeTimeValue,
    timeToMinutes
} = require('./apasxoliseisScenarioFactsService');
const {
    MINIMUM_INTERDAY_REST_MINUTES
} = require('./apasxoliseisRestPeriodPolicyService');

const POLICY_VERSION = 'orphan-card-continuous:v1';
const RESOLUTION_SCOPE = Object.freeze({
    ONE_TIME: 'ONE_TIME',
    FUTURE_IDENTICAL: 'FUTURE_IDENTICAL'
});

function dateStartUtc(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function intervalBounds(dateValue, startValue, endValue) {
    const day = dateStartUtc(dateValue);
    const start = timeToMinutes(startValue);
    const end = timeToMinutes(endValue);
    if (day === null || start === null || end === null || start === end) return null;
    const startAt = day + start * 60000;
    const endAt = day + (end <= start ? end + 1440 : end) * 60000;
    return { start: normalizeTimeValue(startValue), end: normalizeTimeValue(endValue),
        startAt, endAt, durationMinutes: (endAt - startAt) / 60000 };
}

function authoritativeWorkIntervals(row = {}) {
    const apologistika = buildApologistikaIntervals(row)
        .filter((item) => item.isComplete && !item.isZeroLength);
    const category = String(
        row.kathgoria_ergasias_apologistika || row.kathgoria_ergasias || ''
    ).trim().toUpperCase();
    const source = apologistika.length > 0 && category === 'ΕΡΓ'
        ? apologistika
        : resolveCardPairVerification(row).completePairs;
    return source.map((item) => intervalBounds(
        row.hmeromhnia, item.start, item.end
    )).filter(Boolean);
}

function nearestPreviousInterval(rows = [], proposedStartAt) {
    return rows.flatMap(authoritativeWorkIntervals)
        .filter((interval) => interval.endAt <= proposedStartAt)
        .sort((left, right) => right.endAt - left.endAt)[0] || null;
}

function nearestNextInterval(rows = [], proposedEndAt) {
    return rows.flatMap(authoritativeWorkIntervals)
        .filter((interval) => interval.startAt >= proposedEndAt)
        .sort((left, right) => left.startAt - right.startAt)[0] || null;
}

function resolveContinuousDeclaredSchedule(row = {}) {
    const occupied = buildDeclaredIntervals(row).filter((item) => item.start || item.end);
    const complete = occupied.filter((item) => item.isComplete && !item.isZeroLength);
    if (occupied.length !== 1 || complete.length !== 1) {
        return { eligible: false, reason: 'SPLIT_OR_INVALID_DECLARED_SCHEDULE' };
    }
    return { eligible: true, interval: complete[0], durationMinutes: complete[0].durationMinutes };
}

function resolveEffectiveBreakContext(row = {}, effectiveEmployee = {}, breakConfiguration = null) {
    if (!breakConfiguration && row.effective_break_configuration) {
        breakConfiguration = row.effective_break_configuration;
    }
    if (breakConfiguration) {
        const insideSchedule = breakConfiguration.break_inside_schedule === true;
        const declaredBreakMinutes = Math.max(
            Number.parseInt(breakConfiguration.break_minutes || 0, 10) || 0, 0
        );
        return Object.freeze({ insideSchedule, declaredBreakMinutes,
            externalBreakMinutes: insideSchedule ? 0 : declaredBreakMinutes,
            source: breakConfiguration.source || 'BREAK_CONFIGURATION_RESOLVER',
            effectiveFrom: breakConfiguration.effective_from || null });
    }
    const source = {
        ...row,
        ...(row.effective_profile_resolved || {}),
        ...effectiveEmployee
    };
    const insideSchedule = (source.dialleima_entos_ektos_orarioy ??
        source.effective_break_inside_schedule) === true;
    const declaredBreakMinutes = Math.max(
        Number.parseInt(source.dialleima_se_lepta ?? source.effective_break_minutes ?? 0, 10) || 0,
        0
    );
    return Object.freeze({ insideSchedule, declaredBreakMinutes,
        externalBreakMinutes: insideSchedule ? 0 : declaredBreakMinutes });
}

function buildProposal(row = {}, override = {}, effectiveEmployee = {}, breakConfiguration = null) {
    const declared = resolveContinuousDeclaredSchedule(row);
    const verification = resolveCardPairVerification(row);
    if (!declared.eligible || verification.completePairs.length !== 0 ||
        verification.unresolvedPairs.length !== 1) {
        return { eligible: false, reason: declared.reason || 'NOT_SINGLE_ORPHAN_CARD_PUNCH' };
    }
    const orphan = verification.unresolvedPairs[0];
    if (![CARD_PAIR_STATE.START_ONLY, CARD_PAIR_STATE.END_ONLY].includes(orphan.state)) {
        return { eligible: false, reason: 'UNSUPPORTED_ORPHAN_TYPE' };
    }
    const breakContext = resolveEffectiveBreakContext(row, effectiveEmployee, breakConfiguration);
    const duration = declared.durationMinutes;
    const automaticSpanMinutes = duration + breakContext.externalBreakMinutes;
    let start = normalizeTimeValue(override.start);
    let end = normalizeTimeValue(override.end);
    if (!start || !end) {
        if (orphan.state === CARD_PAIR_STATE.START_ONLY) {
            const anchor = timeToMinutes(orphan.start);
            start = orphan.start;
            end = normalizeTimeValue(`${String(Math.floor(((anchor + automaticSpanMinutes) % 1440) / 60)).padStart(2, '0')}:${String((anchor + automaticSpanMinutes) % 60).padStart(2, '0')}`);
        } else {
            const anchor = timeToMinutes(orphan.end);
            end = orphan.end;
            const value = ((anchor - automaticSpanMinutes) % 1440 + 1440) % 1440;
            start = `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
        }
    }
    const bounds = intervalBounds(row.hmeromhnia, start, end);
    if (!bounds) return { eligible: false, reason: 'INVALID_PROPOSED_INTERVAL' };
    const netWorkMinutes = Math.max(0,
        bounds.durationMinutes - breakContext.externalBreakMinutes);
    return { eligible: true, orphanType: orphan.state, pairNumber: orphan.pairNumber,
        declaredDurationMinutes: duration, netWorkMinutes, ...breakContext, ...bounds };
}

function evaluateRestRisk({ row, proposal, contextRows = [], minimumRestMinutes = MINIMUM_INTERDAY_REST_MINUTES }) {
    const otherRows = contextRows.filter((candidate) =>
        String(candidate?._id || candidate?.id || '') !== String(row?._id || row?.id || ''));
    const previous = nearestPreviousInterval(otherRows, proposal.startAt);
    const next = nearestNextInterval(otherRows, proposal.endAt);
    const backwardMinutes = previous ? (proposal.startAt - previous.endAt) / 60000 : null;
    const forwardMinutes = next ? (next.startAt - proposal.endAt) / 60000 : null;
    const conflicts = [];
    if (backwardMinutes !== null && backwardMinutes < minimumRestMinutes) conflicts.push('PREVIOUS');
    if (forwardMinutes !== null && forwardMinutes < minimumRestMinutes) conflicts.push('NEXT');
    return { minimumRestMinutes, previous, next, backwardMinutes, forwardMinutes,
        conflicts, hasViolation: conflicts.length > 0 };
}

function resolveOrphanCardResolution({ row = {}, contextRows = [], manualInterval = null,
    riskAcknowledged = false, reuseScope = RESOLUTION_SCOPE.ONE_TIME,
    reusableRule = null, effectiveEmployee = null, breakConfiguration = null } = {}) {
    const proposal = buildProposal(row, manualInterval || {}, effectiveEmployee || {},
        breakConfiguration);
    const hasRawPunch = resolveCardPairVerification(row).unresolvedPairs.length > 0;
    if (!proposal.eligible) return { eligible: false, category: hasRawPunch ? 'ΕΡΓ' : '',
        orphanVisible: hasRawPunch, blocking: hasRawPunch, reason: proposal.reason };
    const rest = evaluateRestRisk({ row, proposal, contextRows });
    const reusableRuleMatches = Boolean(reusableRule &&
        reusableRule.policy_version === POLICY_VERSION &&
        reusableRule.orphan_type === proposal.orphanType &&
        reusableRule.schedule_kind === 'CONTINUOUS');
    const automaticReusableApplied = reusableRuleMatches && !rest.hasViolation;
    const acknowledged = riskAcknowledged === true;
    const canApprove = !rest.hasViolation || acknowledged;
    return {
        eligible: true,
        policyVersion: POLICY_VERSION,
        category: 'ΕΡΓ',
        orphanType: proposal.orphanType,
        orphanVisible: true,
        blocking: !canApprove,
        proposal: { start: proposal.start, end: proposal.end,
            durationMinutes: proposal.durationMinutes, durationHours: proposal.durationMinutes / 60,
            workDurationMinutes: proposal.netWorkMinutes,
            workDurationHours: proposal.netWorkMinutes / 60,
            declaredDurationMinutes: proposal.declaredDurationMinutes,
            breakInsideSchedule: proposal.insideSchedule,
            breakMinutes: proposal.declaredBreakMinutes,
            externalBreakMinutes: proposal.externalBreakMinutes,
            breakConfigurationSource: proposal.source || null,
            breakConfigurationEffectiveFrom: proposal.effectiveFrom || null },
        rest,
        requiresRiskAcknowledgement: rest.hasViolation && !acknowledged,
        canApprove,
        reusableEligible: reuseScope === RESOLUTION_SCOPE.FUTURE_IDENTICAL,
        canAutomaticReuse: automaticReusableApplied,
        automaticReusableApplied,
        reusableDecisionRule: reuseScope === RESOLUTION_SCOPE.FUTURE_IDENTICAL ? {
            policy_version: POLICY_VERSION,
            orphan_type: proposal.orphanType,
            schedule_kind: 'CONTINUOUS',
            rule: proposal.orphanType === CARD_PAIR_STATE.START_ONLY
                ? 'ACTUAL_START_PLUS_DECLARED_DURATION'
                : 'ACTUAL_END_MINUS_DECLARED_DURATION'
        } : null,
        apologistikoBookUpdate: proposal.orphanType === CARD_PAIR_STATE.END_ONLY,
        approvedUpdates: canApprove ? {
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            apo_ora_01_apologistika: proposal.start,
            eos_ora_01_apologistika: proposal.end,
            apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
            apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
            ores_ergasias_apologistika: proposal.netWorkMinutes / 60,
            ores_pragmatikhs_ergasias_apologistika: proposal.netWorkMinutes / 60,
            apologistiko_biblio: proposal.orphanType === CARD_PAIR_STATE.END_ONLY
        } : null
    };
}

function isApprovedOrphanResolution(row = {}) {
    const metadata = row.orphan_card_resolution;
    return Boolean(metadata && metadata.status === 'HR_APPROVED' &&
        metadata.policy_version === POLICY_VERSION);
}

function attachOrphanResolutionPreviews({ rows = [], contextRows = rows,
    reusableApprovals = [] } = {}) {
    const contexts = new Map();
    contextRows.forEach((row) => {
        const key = `${String(row?.ypokatasthma || '')}|${String(row?.kodikos || '')}`;
        if (!contexts.has(key)) contexts.set(key, []);
        contexts.get(key).push(row);
    });
    return rows.map((row) => {
        const key = `${String(row?.ypokatasthma || '')}|${String(row?.kodikos || '')}`;
        const employeeRows = contexts.get(key) || [];
        const base = resolveOrphanCardResolution({ row, contextRows: employeeRows });
        const rowDate = new Date(row.hmeromhnia);
        const approval = reusableApprovals.find((candidate) => {
            const criteria = candidate?.reuse_match_criteria?.criteria || {};
            const from = new Date(candidate.reuse_effective_from);
            const to = candidate.reuse_effective_to ? new Date(candidate.reuse_effective_to) : null;
            return candidate.policy_code === 'ORPHAN_CARD_CONTINUOUS' &&
                criteria.policy_version === base.policyVersion &&
                criteria.orphan_type === base.orphanType &&
                criteria.schedule_kind === 'CONTINUOUS' && from <= rowDate && (!to || to >= rowDate);
        });
        return { ...row, orphan_card_resolution_preview: resolveOrphanCardResolution({
            row, contextRows: employeeRows,
            reusableRule: approval?.reuse_match_criteria?.criteria || null
        }) };
    });
}

module.exports = { POLICY_VERSION, RESOLUTION_SCOPE, resolveContinuousDeclaredSchedule,
    resolveEffectiveBreakContext,
    buildProposal, authoritativeWorkIntervals, evaluateRestRisk,
    resolveOrphanCardResolution, isApprovedOrphanResolution, attachOrphanResolutionPreviews };
