'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { shiftIntervals, scheduledWorkingDay } = require('./apasxoliseisApprovedHourlyLeaveService');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { exactExternalBreaks } = require('../../utils/ergazomenoi/subtractExternalBreakIntervals');
const { validTimeShiftCompensation } = require('../../utils/ergazomenoi/approvedTimeShiftCompensation');
const FIELD = 'egkekrimenh_anaplhrosh_apologistika';
const duration = intervals => intervals.reduce((sum, x) => sum + (x.eos_lepto - x.apo_lepto), 0);
function union(intervals) {
    const result = [];
    for (const x of intervals.map(x => ({ ...x })).sort((a, b) => a.apo_lepto - b.apo_lepto)) {
        const last = result.at(-1);
        if (last && x.apo_lepto <= last.eos_lepto) last.eos_lepto = Math.max(last.eos_lepto, x.eos_lepto);
        else result.push(x);
    }
    return result;
}
function exclude(intervals, exclusions) {
    return exclusions.reduce((parts, x) => parts.flatMap(p => {
        if (x.eos_lepto <= p.apo_lepto || x.apo_lepto >= p.eos_lepto) return [p];
        return [{ apo_lepto: p.apo_lepto, eos_lepto: Math.min(p.eos_lepto, x.apo_lepto) },
            { apo_lepto: Math.max(p.apo_lepto, x.eos_lepto), eos_lepto: p.eos_lepto }]
            .filter(p => p.eos_lepto > p.apo_lepto);
    }), intervals.map(p => ({ ...p })));
}
function intersect(left, right) {
    return union(left.flatMap(a => right.map(b => ({ apo_lepto: Math.max(a.apo_lepto, b.apo_lepto),
        eos_lepto: Math.min(a.eos_lepto, b.eos_lepto) })).filter(x => x.eos_lepto > x.apo_lepto)));
}
function deriveApprovedTimeShift({ row, effectiveEmployee = {}, resolvedArrangement,
    hrAuthoritative = false, existingCreditedIntervals = [] }) {
    const active = resolvedArrangement?.arrangementEffective === true &&
        resolvedArrangement.facts?.[C.TYPE] === 'APPROVED_TIME_SHIFT_INTERRUPTION';
    const empty = { arrangementEffective: active, eligibleInterruptionIntervals: [], shortageIntervals: [],
        shortageMinutes: 0, eligibleCompensationIntervals: [], matchedCompensationIntervals: [],
        matchedMinutes: 0, unmatchedMinutes: 0, requiresHrReview: false, reason: null, protected: false };
    if (row.is_locked === true || hrAuthoritative || row.orphan_card_resolution?.status === 'HR_APPROVED' ||
        row.adeia === true || row.hr_declared_leave === true || row.kathgoria_adeias || row.astheneia === true ||
        row.astheneia_apologistika === true || (row.egkekrimenh_oroadeia_apologistika !== true &&
        (row.adeia_apologistika === true || Number(row.explicit_hourly_leave_hours) > 0))) {
        return { ...empty, protected: true, reason: 'EXISTING_HR_OR_LEAVE_AUTHORITY' };
    }
    if (!active || !scheduledWorkingDay(row)) return empty;
    const evidence = resolveCardPairVerification(row);
    if (!evidence.hasCompleteCardEvidence || evidence.hasUnresolvedCardEvidence) {
        return { ...empty, reason: 'CARD_EVIDENCE_REQUIRED' };
    }
    const declared = union(shiftIntervals(row));
    let actual = shiftIntervals(row, 'cards_');
    if (declared.at(-1).eos_lepto > 1440 && actual[0]?.apo_lepto < declared[0].apo_lepto &&
        actual[0]?.apo_lepto < declared.at(-1).eos_lepto - 1440) {
        actual = actual.map(x => ({ apo_lepto: x.apo_lepto + 1440, eos_lepto: x.eos_lepto + 1440 }));
    }
    actual = union(actual);
    const arrangement = shiftIntervals({ apo_ora_01: resolvedArrangement.facts[C.START],
        eos_ora_01: resolvedArrangement.facts[C.END] });
    if (!arrangement.length) return { ...empty, requiresHrReview: true, reason: 'INVALID_APPROVED_TIME_SHIFT_INTERVAL' };
    const projected = [], breaks = [];
    const last = Math.max(declared.at(-1).eos_lepto, actual.at(-1)?.eos_lepto || 0);
    for (let day = -1; day <= Math.floor(last / 1440); day++) {
        projected.push(...arrangement.map(x => ({ apo_lepto: x.apo_lepto + day * 1440, eos_lepto: x.eos_lepto + day * 1440 })));
        breaks.push(...exactExternalBreaks(effectiveEmployee).map(x => ({ apo_lepto: x.start + day * 1440, eos_lepto: x.end + day * 1440 })));
    }
    const eligibleInterruptionIntervals = intersect(declared, projected);
    const shortageIntervals = exclude(eligibleInterruptionIntervals, [...actual, ...breaks, ...existingCreditedIntervals]);
    const shortageMinutes = duration(shortageIntervals);
    // Only the uninterrupted actual-work component touching the LAST declared end can compensate.
    // Subtract non-work before testing connectivity; continuity never resumes after a gap.
    const recognized = exclude(actual, [...breaks, ...existingCreditedIntervals]);
    const declaredEnd = declared.at(-1).eos_lepto;
    const extension = recognized.find(x => x.apo_lepto <= declaredEnd && x.eos_lepto > declaredEnd);
    const eligibleCompensationIntervals = extension ? [{ apo_lepto: declaredEnd, eos_lepto: extension.eos_lepto }] : [];
    let cursor = declaredEnd;
    const matched = [];
    for (const shortage of shortageIntervals) {
        if (!extension || cursor >= extension.eos_lepto) break;
        const start = Math.max(cursor, shortage.eos_lepto);
        const end = Math.min(extension.eos_lepto, start + shortage.eos_lepto - shortage.apo_lepto);
        if (end > start) { matched.push({ apo_lepto: start, eos_lepto: end }); cursor = end; }
    }
    const matchedCompensationIntervals = union(matched);
    const matchedMinutes = duration(matchedCompensationIntervals);
    return { ...empty, eligibleInterruptionIntervals, shortageIntervals, shortageMinutes,
        eligibleCompensationIntervals, matchedCompensationIntervals, matchedMinutes,
        unmatchedMinutes: shortageMinutes - matchedMinutes, actualIntervals: recognized,
        unexplainedMinutes: duration(exclude(declared, [...actual, ...breaks, ...existingCreditedIntervals])) - matchedMinutes,
        reason: 'APPROVED_TIME_SHIFT_INTERRUPTION' };
}
function approvedTimeShiftUpdate(fact) {
    if (!fact?.shortageMinutes) return { [FIELD]: null };
    const value = { diastimata_elleimmatos: fact.shortageIntervals.map(x => ({ ...x })),
        diastimata_anaplhroshs: fact.matchedCompensationIntervals.map(x => ({ ...x })),
        antistoixismena_lepta: fact.matchedMinutes, ypoloipomena_lepta: fact.unmatchedMinutes };
    if (!validTimeShiftCompensation(value)) throw new Error('Invalid calculated time shift compensation');
    return { [FIELD]: value };
}
module.exports = { FIELD, deriveApprovedTimeShift, approvedTimeShiftUpdate };
