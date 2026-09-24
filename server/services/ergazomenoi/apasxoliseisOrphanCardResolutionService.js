'use strict';

const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');

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
    MINIMUM_INTERDAY_REST_MINUTES,
    evaluateSplitShiftRest
} = require('./apasxoliseisRestPeriodPolicyService');

const POLICY_VERSION = 'orphan-card-continuous:v1';
const LEGACY_REUSABLE_ORPHAN_REASON =
    'Εφαρμογή προϋπάρχουσας έγκρισης σε μελλοντική όμοια περίπτωση.';
const ORPHAN_RULE = Object.freeze({
    ACTUAL_START_PLUS_DECLARED_DURATION: 'ACTUAL_START_PLUS_DECLARED_DURATION',
    ACTUAL_END_MINUS_DECLARED_DURATION: 'ACTUAL_END_MINUS_DECLARED_DURATION',
    ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE:
        'ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE'
});
const SCHEDULE_KIND = Object.freeze({
    CONTINUOUS: 'CONTINUOUS',
    NON_DECLARED: 'NON_DECLARED',
    SPLIT: 'SPLIT'
});
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

function resolveAverageFallback(row = {}, verification = {}, effectiveEmployee = {}) {
    const occupied = buildDeclaredIntervals(row).filter((item) => item.start || item.end);
    const orphan = verification.unresolvedPairs?.[0];
    const category = String(row.kathgoria_ergasias || '').trim().toUpperCase();
    const allowedNonDeclaredScenario = row.repo === true || ['ΑΝ', 'ΜΕ'].includes(category);
    const dailyAverageHours = Number(
        effectiveEmployee.mo_oron_hmerhsias_ergasias ?? row.effective_daily_hours
    );
    if (orphan?.state !== CARD_PAIR_STATE.END_ONLY || !orphan.end || occupied.length !== 0 ||
        !allowedNonDeclaredScenario || !Number.isFinite(dailyAverageHours) ||
        dailyAverageHours <= 0) return { eligible: false };
    return { eligible: true, durationMinutes: dailyAverageHours * 60,
        dailyAverageHours, allowedNonDeclaredScenario };
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
    const occupiedDeclared = buildDeclaredIntervals(row).filter((item) => item.start || item.end);
    const splitSchedule = occupiedDeclared.length >= 2;
    if (splitSchedule && verification.unresolvedPairs.length > 0) {
        const requestedPairs = Array.isArray(override.pairs) ? override.pairs :
            (verification.unresolvedPairs.length === 1 && override.start && override.end
                ? [{ pairNumber: verification.unresolvedPairs[0].pairNumber,
                    start: override.start, end: override.end }] : []);
        const unresolvedPairs = verification.unresolvedPairs.map((item) => ({
            pairNumber: Number(item.pairNumber),
            orphanType: item.state,
            knownStart: normalizeTimeValue(item.start),
            knownEnd: normalizeTimeValue(item.end),
            missingPunch: item.state === CARD_PAIR_STATE.START_ONLY ? 'END' : 'START'
        }));
        const actualNumbers = unresolvedPairs.map((item) => item.pairNumber).sort();
        const suppliedNumbers = requestedPairs.map((item) => Number(item.pairNumber)).sort();
        const pairSetMatches = actualNumbers.length === suppliedNumbers.length &&
            actualNumbers.every((value, index) => value === suppliedNumbers[index]) &&
            new Set(suppliedNumbers).size === suppliedNumbers.length;
        if (!pairSetMatches) return { eligible: false, reason: 'ORPHAN_PAIR_SET_MISMATCH',
            scheduleKind: SCHEDULE_KIND.SPLIT, unresolvedPairs };
        const resolvedPairs = unresolvedPairs.map((orphan) => {
            const input = requestedPairs.find((item) => Number(item.pairNumber) === orphan.pairNumber);
            const start = normalizeTimeValue(input?.start);
            const end = normalizeTimeValue(input?.end);
            const bounds = intervalBounds(row.hmeromhnia, start, end);
            return bounds ? { ...orphan, start, end, ...bounds } : null;
        });
        if (resolvedPairs.some((item) => !item)) return { eligible: false,
            reason: 'INCOMPLETE_OR_INVALID_ORPHAN_PAIR_INTERVAL',
            scheduleKind: SCHEDULE_KIND.SPLIT, unresolvedPairs };
        const approvedUpdates = { kathgoria_ergasias_apologistika: 'ΕΡΓ',
            apologistiko_biblio: true };
        resolvedPairs.forEach((item) => {
            const pair = String(item.pairNumber).padStart(2, '0');
            approvedUpdates[`apo_ora_${pair}_apologistika`] = item.start;
            approvedUpdates[`eos_ora_${pair}_apologistika`] = item.end;
        });
        const proposedRow = { ...row, ...approvedUpdates };
        // Η ζευγοκεντρική επίλυση είναι μερική ως προς την εντολή του HR,
        // αλλά η κανονική ημερήσια μηχανή χρειάζεται πάντοτε ολόκληρη την
        // προτεινόμενη απολογιστική γραμμή. Έτσι ο κοινός μηδενισμός δεν
        // μπορεί να εξαφανίσει ένα ήδη έγκυρο, ανεξάρτητο ζεύγος.
        [1, 2, 3].forEach((number) => {
            const pair = String(number).padStart(2, '0');
            approvedUpdates[`apo_ora_${pair}_apologistika`] =
                normalizeTimeValue(proposedRow[`apo_ora_${pair}_apologistika`]) || '';
            approvedUpdates[`eos_ora_${pair}_apologistika`] =
                normalizeTimeValue(proposedRow[`eos_ora_${pair}_apologistika`]) || '';
        });
        const proposedIntervals = buildApologistikaIntervals(proposedRow)
            .filter((item) => item.isComplete && !item.isZeroLength);
        const splitValidationRow = { ...proposedRow };
        [1, 2, 3].forEach((number) => {
            const pair = String(number).padStart(2, '0');
            splitValidationRow[`cards_apo_ora_${pair}`] =
                proposedRow[`apo_ora_${pair}_apologistika`] || '';
            splitValidationRow[`cards_eos_ora_${pair}`] =
                proposedRow[`eos_ora_${pair}_apologistika`] || '';
        });
        const splitValidation = evaluateSplitShiftRest(splitValidationRow);
        if (splitValidation.status === 'VIOLATION') return { eligible: false,
            reason: splitValidation.reasons[0] || 'SPLIT_REST_POLICY_VIOLATION',
            scheduleKind: SCHEDULE_KIND.SPLIT, unresolvedPairs, splitValidation };
        const netWorkMinutes = proposedIntervals.reduce(
            (sum, item) => sum + Number(item.durationMinutes || 0), 0);
        approvedUpdates.ores_ergasias_apologistika = netWorkMinutes / 60;
        approvedUpdates.ores_pragmatikhs_ergasias_apologistika = netWorkMinutes / 60;
        const bounds = resolvedPairs.reduce((result, item) => ({
            startAt: Math.min(result.startAt, item.startAt),
            endAt: Math.max(result.endAt, item.endAt)
        }), { startAt: Infinity, endAt: -Infinity });
        return { eligible: true, orphanType: unresolvedPairs.length === 1
            ? unresolvedPairs[0].orphanType : 'MULTIPLE',
        pairNumber: unresolvedPairs.length === 1 ? unresolvedPairs[0].pairNumber : null,
        unresolvedPairs, resolvedPairs, approvedUpdates, proposedRow,
        start: resolvedPairs[0].start, end: resolvedPairs[resolvedPairs.length - 1].end,
        startAt: bounds.startAt, endAt: bounds.endAt,
        durationMinutes: netWorkMinutes, netWorkMinutes,
        durationSource: resolvedPairs.length === 1 ? 'HR_MANUAL_SPLIT_INTERVAL'
            : 'HR_MANUAL_SPLIT_PAIRS', scheduleKind: SCHEDULE_KIND.SPLIT,
        rule: null, automaticStart: null, automaticEnd: null,
        manualIntervalMatchesRule: false, declaredDurationMinutes: null,
        effectiveDailyAverageHours: null, insideSchedule: false,
        declaredBreakMinutes: 0, externalBreakMinutes: 0 };
    }
    if (verification.completePairs.length !== 0 || verification.unresolvedPairs.length !== 1) {
        return { eligible: false, reason: 'NOT_SINGLE_ORPHAN_CARD_PUNCH' };
    }
    const orphan = verification.unresolvedPairs[0];
    if (![CARD_PAIR_STATE.START_ONLY, CARD_PAIR_STATE.END_ONLY].includes(orphan.state)) {
        return { eligible: false, reason: 'UNSUPPORTED_ORPHAN_TYPE' };
    }
    const averageFallback = declared.eligible ? null
        : resolveAverageFallback(row, verification, effectiveEmployee);
    const requestedStart = normalizeTimeValue(override.start);
    const requestedEnd = normalizeTimeValue(override.end);
    const manualSplitInterval = declared.reason === 'SPLIT_OR_INVALID_DECLARED_SCHEDULE' &&
        Boolean(requestedStart && requestedEnd);
    if (!declared.eligible && !averageFallback?.eligible && !manualSplitInterval) {
        return { eligible: false, reason: declared.reason || 'INVALID_EFFECTIVE_DAILY_AVERAGE' };
    }
    const breakContext = resolveEffectiveBreakContext(row, effectiveEmployee, breakConfiguration);
    const netMinutesForBounds = bounds => resolvePayrollBreakIntervals({ row,
        effectiveEmployee: { ...row, ...(row.effective_profile_resolved || {}), ...effectiveEmployee,
            ...(breakConfiguration || row.effective_break_configuration || {}),
            dialleima_entos_ektos_orarioy: breakContext.insideSchedule,
            dialleima_se_lepta: breakContext.declaredBreakMinutes },
        workIntervals: [{ start: timeToMinutes(bounds.start),
            end: timeToMinutes(bounds.start) + bounds.durationMinutes }]
    }).netMinutes;
    if (manualSplitInterval) {
        const bounds = intervalBounds(row.hmeromhnia, requestedStart, requestedEnd);
        if (!bounds) return { eligible: false, reason: 'INVALID_PROPOSED_INTERVAL' };
        return { eligible: true, orphanType: orphan.state, pairNumber: orphan.pairNumber,
            declaredDurationMinutes: null, effectiveDailyAverageHours: null,
            durationSource: 'HR_MANUAL_SPLIT_INTERVAL', effectiveProfileSource:
                effectiveEmployee._workTermsSource || row.effective_profile_source || null,
            effectiveProfileHistoryId: effectiveEmployee._workTermsIstorikoId ||
                row.effective_profile_istoriko_id || null,
            scheduleKind: SCHEDULE_KIND.SPLIT, rule: null,
            automaticStart: null, automaticEnd: null, manualIntervalMatchesRule: false,
            netWorkMinutes: netMinutesForBounds(bounds),
            ...breakContext, ...bounds };
    }
    const duration = declared.eligible ? declared.durationMinutes : averageFallback.durationMinutes;
    // Αναζητούμε την ελάχιστη παρουσία που δίνει την απαιτούμενη καθαρή εργασία.
    // Η αφαίρεση και η θέση του διαλείμματος ανήκουν αποκλειστικά στον επιλυτή.
    let automaticSpanMinutes = duration;
    let automaticStart;
    let automaticEnd;
    for (; automaticSpanMinutes < 1440; automaticSpanMinutes += 1) {
        if (orphan.state === CARD_PAIR_STATE.START_ONLY) {
            const anchor = timeToMinutes(orphan.start);
            automaticStart = orphan.start;
            automaticEnd = normalizeTimeValue(`${String(Math.floor(((anchor + automaticSpanMinutes) % 1440) / 60)).padStart(2, '0')}:${String((anchor + automaticSpanMinutes) % 60).padStart(2, '0')}`);
        } else {
            const anchor = timeToMinutes(orphan.end);
            automaticEnd = orphan.end;
            const value = ((anchor - automaticSpanMinutes) % 1440 + 1440) % 1440;
            automaticStart = `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
        }
        const automaticBounds = intervalBounds(row.hmeromhnia, automaticStart, automaticEnd);
        if (automaticBounds && netMinutesForBounds(automaticBounds) >= duration) break;
    }
    if (automaticSpanMinutes >= 1440) return { eligible: false, reason: 'INVALID_PROPOSED_INTERVAL' };
    const start = requestedStart || automaticStart;
    const end = requestedEnd || automaticEnd;
    const bounds = intervalBounds(row.hmeromhnia, start, end);
    if (!bounds) return { eligible: false, reason: 'INVALID_PROPOSED_INTERVAL' };
    const netWorkMinutes = netMinutesForBounds(bounds);
    const rule = declared.eligible
        ? orphan.state === CARD_PAIR_STATE.START_ONLY
            ? ORPHAN_RULE.ACTUAL_START_PLUS_DECLARED_DURATION
            : ORPHAN_RULE.ACTUAL_END_MINUS_DECLARED_DURATION
        : ORPHAN_RULE.ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE;
    return { eligible: true, orphanType: orphan.state, pairNumber: orphan.pairNumber,
        declaredDurationMinutes: declared.eligible ? duration : null,
        effectiveDailyAverageHours: averageFallback?.dailyAverageHours ?? null,
        durationSource: declared.eligible ? 'DECLARED_CONTINUOUS_DURATION'
            : 'EFFECTIVE_DAILY_AVERAGE',
        effectiveProfileSource: effectiveEmployee._workTermsSource ||
            row.effective_profile_source || null,
        effectiveProfileHistoryId: effectiveEmployee._workTermsIstorikoId ||
            row.effective_profile_istoriko_id || null,
        scheduleKind: declared.eligible ? SCHEDULE_KIND.CONTINUOUS
            : SCHEDULE_KIND.NON_DECLARED,
        rule, automaticStart, automaticEnd,
        manualIntervalMatchesRule: start === automaticStart && end === automaticEnd,
        netWorkMinutes, ...breakContext, ...bounds };
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
    const verification = resolveCardPairVerification(row);
    const hasRawPunch = verification.unresolvedPairs.length > 0;
    if (!proposal.eligible) return { eligible: false, category: hasRawPunch ? 'ΕΡΓ' : '',
        orphanVisible: hasRawPunch, blocking: hasRawPunch,
        orphanType: verification.unresolvedPairs[0]?.state || null,
        unresolvedPairs: verification.unresolvedPairs.map((item) => ({
            pairNumber: Number(item.pairNumber), orphanType: item.state,
            knownStart: normalizeTimeValue(item.start), knownEnd: normalizeTimeValue(item.end),
            missingPunch: item.state === CARD_PAIR_STATE.START_ONLY ? 'END' : 'START'
        })),
        scheduleKind: proposal.scheduleKind || null,
        splitValidation: proposal.splitValidation || null,
        reason: proposal.reason };
    const rest = evaluateRestRisk({ row, proposal, contextRows });
    const reusableRuleMatches = Boolean(reusableRule &&
        reusableRule.policy_version === POLICY_VERSION &&
        reusableRule.orphan_type === proposal.orphanType &&
        reusableRule.schedule_kind === proposal.scheduleKind &&
        reusableRule.rule === proposal.rule);
    const automaticReusableApplied = reusableRuleMatches && !rest.hasViolation;
    const acknowledged = riskAcknowledged === true;
    const canApprove = !rest.hasViolation || acknowledged;
    return {
        eligible: true,
        policyVersion: POLICY_VERSION,
        category: 'ΕΡΓ',
        orphanType: proposal.orphanType,
        pairNumber: proposal.pairNumber,
        unresolvedPairs: proposal.unresolvedPairs || [{ pairNumber: proposal.pairNumber,
            orphanType: proposal.orphanType,
            knownStart: verification.unresolvedPairs[0]?.start || '',
            knownEnd: verification.unresolvedPairs[0]?.end || '',
            missingPunch: proposal.orphanType === CARD_PAIR_STATE.START_ONLY ? 'END' : 'START' }],
        resolvedPairs: proposal.resolvedPairs || null,
        orphanVisible: true,
        blocking: !canApprove,
        proposal: { start: proposal.start, end: proposal.end,
            durationMinutes: proposal.durationMinutes, durationHours: proposal.durationMinutes / 60,
            workDurationMinutes: proposal.netWorkMinutes,
            workDurationHours: proposal.netWorkMinutes / 60,
            declaredDurationMinutes: proposal.declaredDurationMinutes,
            durationSource: proposal.durationSource,
            effectiveDailyAverageHours: proposal.effectiveDailyAverageHours,
            effectiveProfileSource: proposal.effectiveProfileSource,
            effectiveProfileHistoryId: proposal.effectiveProfileHistoryId,
            scheduleKind: proposal.scheduleKind,
            rule: proposal.rule,
            automaticStart: proposal.automaticStart,
            automaticEnd: proposal.automaticEnd,
            manualIntervalMatchesRule: proposal.manualIntervalMatchesRule,
            breakInsideSchedule: proposal.insideSchedule,
            breakMinutes: proposal.declaredBreakMinutes,
            externalBreakMinutes: proposal.externalBreakMinutes,
            breakConfigurationSource: proposal.source || null,
            breakConfigurationEffectiveFrom: proposal.effectiveFrom || null },
        rest,
        requiresRiskAcknowledgement: rest.hasViolation && !acknowledged,
        canApprove,
        durationSource: proposal.durationSource,
        effectiveDailyAverageHours: proposal.effectiveDailyAverageHours,
        effectiveProfileSource: proposal.effectiveProfileSource,
        effectiveProfileHistoryId: proposal.effectiveProfileHistoryId,
        scheduleKind: proposal.scheduleKind,
        rule: proposal.rule,
        manualIntervalMatchesRule: proposal.manualIntervalMatchesRule,
        reuseScope: reuseScope === RESOLUTION_SCOPE.FUTURE_IDENTICAL &&
            proposal.manualIntervalMatchesRule && !rest.hasViolation
            ? RESOLUTION_SCOPE.FUTURE_IDENTICAL : RESOLUTION_SCOPE.ONE_TIME,
        reusableEligible: reuseScope === RESOLUTION_SCOPE.FUTURE_IDENTICAL &&
            proposal.manualIntervalMatchesRule && !rest.hasViolation,
        canAutomaticReuse: automaticReusableApplied,
        automaticReusableApplied,
        reusableDecisionRule: reuseScope === RESOLUTION_SCOPE.FUTURE_IDENTICAL &&
            proposal.manualIntervalMatchesRule && !rest.hasViolation ? {
            policy_version: POLICY_VERSION,
            orphan_type: proposal.orphanType,
            schedule_kind: proposal.scheduleKind,
            rule: proposal.rule
        } : null,
        // Κάθε ρητά εγκεκριμένη ανακατασκευή ορφανού χτυπήματος ανήκει
        // υποχρεωτικά στη ροή του Απολογιστικού Βιβλίου.
        apologistikoBookUpdate: true,
        approvedUpdates: canApprove ? (proposal.approvedUpdates || {
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            [`apo_ora_${String(proposal.pairNumber).padStart(2, '0')}_apologistika`]: proposal.start,
            [`eos_ora_${String(proposal.pairNumber).padStart(2, '0')}_apologistika`]: proposal.end,
            ores_ergasias_apologistika: proposal.netWorkMinutes / 60,
            ores_pragmatikhs_ergasias_apologistika: proposal.netWorkMinutes / 60,
            apologistiko_biblio: true
        }) : null
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
                criteria.schedule_kind === base.scheduleKind &&
                criteria.rule === base.rule && from <= rowDate && (!to || to >= rowDate);
        });
        const preview = resolveOrphanCardResolution({
            row, contextRows: employeeRows,
            reusableRule: approval?.reuse_match_criteria?.criteria || null
        });
        return { ...row, orphan_card_resolution_preview: {
            ...preview,
            ...(preview.automaticReusableApplied ? {
                reusableDecisionReason: String(approval?.notes || '').trim() ||
                    LEGACY_REUSABLE_ORPHAN_REASON
            } : {})
        } };
    });
}

module.exports = { POLICY_VERSION, ORPHAN_RULE, SCHEDULE_KIND, RESOLUTION_SCOPE,
    LEGACY_REUSABLE_ORPHAN_REASON,
    resolveContinuousDeclaredSchedule, resolveAverageFallback,
    resolveEffectiveBreakContext,
    buildProposal, authoritativeWorkIntervals, evaluateRestRisk,
    resolveOrphanCardResolution, isApprovedOrphanResolution, attachOrphanResolutionPreviews };
