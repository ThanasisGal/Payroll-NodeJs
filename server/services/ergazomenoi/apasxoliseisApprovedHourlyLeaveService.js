'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');
const { isInternalPossibleLeaveCategory } = require('./apasxoliseisHrLeaveCategoryPolicyService');
const { validApprovedHourlyLeaveSegments } = require('../../utils/ergazomenoi/approvedHourlyLeaveSegments');

const SEGMENTS = 'egkekrimena_diastimata_oroadeias_apologistika';
const FLAG = 'egkekrimenh_oroadeia_apologistika';
const START = 'apo_ora_egkekrimenhs_oroadeias_apologistika';
const END = 'eos_ora_egkekrimenhs_oroadeias_apologistika';
const clock = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
const display = minute => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const duration = intervals => intervals.reduce((sum, interval) => sum + interval.eos_lepto - interval.apo_lepto, 0);

function shiftIntervals(row, prefix = '', anchor = 0) {
    let previous = anchor;
    return ['01', '02', '03'].flatMap(pair => {
        let start = clock(row[`${prefix}apo_ora_${pair}`]);
        let end = clock(row[`${prefix}eos_ora_${pair}`]);
        if (start === null || end === null || start === end) return [];
        if (end < start) end += 1440;
        while (start < previous) { start += 1440; end += 1440; }
        previous = start;
        return [{ apo_lepto: start, eos_lepto: end }];
    });
}

function intersection(left, right) {
    return left.flatMap(a => right.flatMap(b => {
        const apo_lepto = Math.max(a.apo_lepto, b.apo_lepto);
        const eos_lepto = Math.min(a.eos_lepto, b.eos_lepto);
        return eos_lepto > apo_lepto ? [{ apo_lepto, eos_lepto }] : [];
    })).sort((a, b) => a.apo_lepto - b.apo_lepto);
}

// Leave credit is an interval difference, independent of payroll break subtraction.
function exclude(intervals, exclusions) {
    return exclusions.reduce((pieces, excluded) => pieces.flatMap(piece => {
        if (excluded.eos_lepto <= piece.apo_lepto || excluded.apo_lepto >= piece.eos_lepto) return [piece];
        return [
            { apo_lepto: piece.apo_lepto, eos_lepto: Math.min(piece.eos_lepto, excluded.apo_lepto) },
            { apo_lepto: Math.max(piece.apo_lepto, excluded.eos_lepto), eos_lepto: piece.eos_lepto }
        ].filter(part => part.eos_lepto > part.apo_lepto);
    }), intervals.map(piece => ({ ...piece })));
}

function scheduledWorkingDay(row) {
    return row.repo !== true && !['ΑΝ', 'ΜΕ'].includes(row.kathgoria_ergasias) && shiftIntervals(row).length > 0;
}

function deriveApprovedHourlyLeave({ row, effectiveEmployee = {}, resolvedArrangement,
    leaveCategories = [], hrAuthoritative = false, existingCreditedIntervals = [] }) {
    const active = resolvedArrangement?.arrangementEffective === true &&
        resolvedArrangement.facts[C.TYPE] === 'APPROVED_LEAVE_INTERRUPTION';
    const empty = { arrangementEffective: active, eligibleIntervals: [], creditedIntervals: [],
        creditedMinutes: 0, creditedHours: 0, leaveCategory: null, requiresHrReview: false,
        reason: null, protected: false };
    if (row.is_locked === true || hrAuthoritative || row.orphan_card_resolution?.status === 'HR_APPROVED' ||
        row.adeia === true || row.hr_declared_leave === true || row.kathgoria_adeias ||
        row.astheneia === true || row.astheneia_apologistika === true ||
        (row[FLAG] !== true && (row.adeia_apologistika === true || Number(row.explicit_hourly_leave_hours) > 0))) {
        return { ...empty, protected: true, reason: 'EXISTING_HR_OR_LEAVE_AUTHORITY' };
    }
    if (!active) return empty;
    const verification = resolveCardPairVerification(row);
    if (!verification.hasCompleteCardEvidence || verification.hasUnresolvedCardEvidence) {
        return { ...empty, reason: 'CARD_EVIDENCE_REQUIRED' };
    }
    const declaredIntervals = shiftIntervals(row);
    const actualIntervals = shiftIntervals(row, 'cards_');
    // A first card after midnight belongs to the overnight declared shift.
    if (declaredIntervals.at(-1)?.eos_lepto > 1440 &&
        actualIntervals[0]?.apo_lepto < declaredIntervals[0]?.apo_lepto &&
        actualIntervals[0]?.apo_lepto < declaredIntervals.at(-1).eos_lepto - 1440) {
        for (const interval of actualIntervals) { interval.apo_lepto += 1440; interval.eos_lepto += 1440; }
    }
    const facts = resolvedArrangement.facts;
    const start = clock(facts[C.START]);
    const finish = clock(facts[C.END]);
    if (start === null || finish === null || start === finish) return { ...empty, requiresHrReview: true, reason: 'INVALID_APPROVED_LEAVE_INTERVAL' };
    const end = finish > start ? finish : finish + 1440;
    const last = declaredIntervals.at(-1)?.eos_lepto || 0;
    const projected = [];
    const resolvedBreak = resolvePayrollBreakIntervals({ row, effectiveEmployee,
        workIntervals: actualIntervals.map(x => ({ start: x.apo_lepto, end: x.eos_lepto })) });
    const externalBreakIntervals = resolvedBreak.insideSchedule ? [] : resolvedBreak.breakIntervals
        .map(x => ({ apo_lepto: x.start, eos_lepto: x.end }));
    for (let day = -1; day <= Math.floor(last / 1440); day++) {
        projected.push({ apo_lepto: start + day * 1440, eos_lepto: end + day * 1440 });
    }
    const eligibleIntervals = intersection(declaredIntervals, projected);
    const candidate = exclude(eligibleIntervals, [...actualIntervals, ...externalBreakIntervals, ...existingCreditedIntervals]);
    const category = leaveCategories.find(item => item.kodikos === facts[C.CATEGORY] &&
        !isInternalPossibleLeaveCategory(item.kodikos, item.perigrafh));
    if (!category) return { ...empty, eligibleIntervals, requiresHrReview: true, reason: 'APPROVED_HOURLY_LEAVE_CATEGORY_REQUIRES_HR_DECISION' };
    if (!candidate.length) return { ...empty, eligibleIntervals };
    if (!validApprovedHourlyLeaveSegments(candidate)) throw new Error('Invalid derived hourly leave segments');
    const creditedMinutes = duration(candidate);
    return { ...empty, eligibleIntervals, declaredIntervals, actualIntervals, externalBreakIntervals,
        creditedIntervals: candidate, creditedMinutes, creditedHours: creditedMinutes / 60,
        leaveCategory: category.kodikos, reason: 'APPROVED_LEAVE_INTERRUPTION',
        unexplainedMinutes: duration(exclude(declaredIntervals,
            [...actualIntervals, ...externalBreakIntervals, ...existingCreditedIntervals, ...candidate])) };
}

function approvedHourlyLeaveUpdate(fact) {
    const segments = fact.creditedIntervals;
    return { [FLAG]: segments.length > 0, [SEGMENTS]: segments.map(segment => ({ ...segment })),
        [START]: segments.length === 1 ? display(segments[0].apo_lepto) : '',
        [END]: segments.length === 1 ? display(segments[0].eos_lepto) : '',
        explicit_hourly_leave_hours: fact.creditedHours,
        ...(segments.length ? { kathgoria_adeias_apologistika: fact.leaveCategory } : {}) };
}

module.exports = { SEGMENTS, FLAG, scheduledWorkingDay, shiftIntervals,
    deriveApprovedHourlyLeave, approvedHourlyLeaveUpdate };
