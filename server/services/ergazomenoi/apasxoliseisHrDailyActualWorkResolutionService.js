'use strict';

const { isDeepStrictEqual } = require('node:util');
const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');
const { validEmergencyHourlyLeaveSegments, emergencyHourlyLeaveMinutes } =
    require('../../utils/ergazomenoi/emergencyHourlyLeaveSegments');
const { buildDeclaredIntervals, timeToMinutes } = require('./apasxoliseisScenarioFactsService');
const { assertHrSelectableLeaveCategory } = require('./apasxoliseisHrLeaveCategoryPolicyService');

const POLICY_VERSION = 'hr-daily-actual-work:v1';
const RESOLUTION_KIND = 'HR_DAILY_ACTUAL_WORK_AND_EMERGENCY_HOURLY_LEAVE';
const SOURCE_CASES = new Set([
    'SUSPICIOUS_SHORT_CARD_INTERVAL',
    'HR_CORRECTED_ACTUAL_DAY'
]);

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}

function isApprovedHrDailyActualWorkResolution(row = {}) {
    const value = row.hr_daily_actual_work_resolution;
    const structural = value?.status === 'HR_APPROVED' && value.policy_version === POLICY_VERSION &&
        value.resolution_kind === RESOLUTION_KIND && Array.isArray(value.approved_work_intervals) &&
        Array.isArray(value.emergency_hourly_leave_intervals) &&
        value.raw_card_snapshot && typeof value.raw_card_snapshot === 'object' &&
        !Array.isArray(value.raw_card_snapshot) && String(value.reason || '').trim() !== '' &&
        SOURCE_CASES.has(String(value.source_case || '').trim()) &&
        String(value.approved_by || '').trim() !== '' && Boolean(value.approved_at) &&
        value.raw_cards_preserved === true && Number.isInteger(value.revision_number) &&
        value.revision_number >= 0;
    if (!structural || value.approved_work_intervals.length < 1 ||
        value.approved_work_intervals.length > 3 ||
        !validEmergencyHourlyLeaveSegments(value.emergency_hourly_leave_intervals)) return false;
    try {
        const work = value.approved_work_intervals.map(normalizeWorkInterval);
        assertOrderedNonOverlapping(work, 'HR_DAILY_WORK_INTERVAL_OVERLAP', 'Πραγματική εργασία');
        const leave = value.emergency_hourly_leave_intervals;
        const declared = buildDeclaredIntervals(row);
        if (leave.some(segment => !insideDeclaredSchedule(segment, declared)) ||
            leave.some(segment => work.some(interval =>
                segment.apo_lepto < interval.eos_lepto &&
                segment.eos_lepto > interval.apo_lepto)) ||
            row.egkekrimenh_oroadeia_apologistika === true ||
            row.adeia_apologistika === true || row.astheneia_apologistika === true ||
            row.adeia === true || row.astheneia === true || row.hr_declared_leave === true) {
            return false;
        }
        const intervalsMatchRow = [1, 2, 3].every((number) => {
            const pair = String(number).padStart(2, '0');
            const approved = work.find(interval => interval.pairNumber === number);
            return String(row[`apo_ora_${pair}_apologistika`] || '') ===
                String(approved?.start || '') &&
                String(row[`eos_ora_${pair}_apologistika`] || '') ===
                String(approved?.end || '');
        });
        const emergencyMinutes = emergencyHourlyLeaveMinutes(
            value.emergency_hourly_leave_intervals);
        if (leave.length > 0) {
            assertHrSelectableLeaveCategory(value.leave_category);
            if (String(value.leave_category || '').trim() === 'ΑΔΚΑΝ') return false;
        }
        return work.every((interval, index) => interval.pairNumber === index + 1) &&
            intervalsMatchRow &&
            isDeepStrictEqual(value.emergency_hourly_leave_intervals,
                row.ektakta_diastimata_oroadeias_apologistika || []) &&
            row.ektakth_oroadeia_apologistika ===
                (value.emergency_hourly_leave_intervals.length > 0) &&
            Math.abs(Number(row.ores_ektakths_oroadeias_apologistika || 0) -
                emergencyMinutes / 60) <= 1e-9 &&
            isDeepStrictEqual(value.raw_card_snapshot, rawCardSnapshot(row)) &&
            (value.emergency_hourly_leave_intervals.length > 0
                ? String(value.leave_category || '').trim() !== '' &&
                    String(row.kathgoria_adeias_apologistika || '').trim() ===
                        String(value.leave_category).trim()
                : String(value.leave_category || '').trim() === '' &&
                    String(row.kathgoria_adeias_apologistika || '').trim() === '');
    } catch (_) {
        return false;
    }
}

function normalizeWorkInterval(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(field => !['pairNumber', 'start', 'end'].includes(field))) {
        fail('HR_DAILY_WORK_INTERVAL_FIELDS_NOT_ALLOWED', 'Το διάστημα εργασίας περιέχει μη επιτρεπτά πεδία.');
    }
    const pairNumber = Number(value.pairNumber);
    const start = String(value.start ?? '').trim();
    const end = String(value.end ?? '').trim();
    const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!Number.isInteger(pairNumber) || pairNumber < 1 || pairNumber > 3 ||
        !clock.test(start) || !clock.test(end) || timeToMinutes(start) >= timeToMinutes(end)) {
        fail('HR_DAILY_WORK_INTERVAL_INVALID', 'Απαιτούνται έως τρία πλήρη, θετικά διαστήματα εργασίας της ίδιας ημέρας.');
    }
    return Object.freeze({ pairNumber, start, end, apo_lepto: timeToMinutes(start), eos_lepto: timeToMinutes(end) });
}

function assertOrderedNonOverlapping(intervals, code, label) {
    for (let index = 1; index < intervals.length; index += 1) {
        if (intervals[index].apo_lepto < intervals[index - 1].eos_lepto) {
            fail(code, `${label}: τα διαστήματα πρέπει να είναι ταξινομημένα και να μην επικαλύπτονται.`);
        }
    }
}

function rawCardSnapshot(row) {
    return Object.freeze(Object.fromEntries([1, 2, 3].flatMap(number => {
        const pair = String(number).padStart(2, '0');
        return [[`cards_apo_ora_${pair}`, row[`cards_apo_ora_${pair}`] || ''],
            [`cards_eos_ora_${pair}`, row[`cards_eos_ora_${pair}`] || '']];
    })));
}

function insideDeclaredSchedule(segment, declared) {
    return declared.some(interval => segment.apo_lepto >= interval.startMinutes &&
        segment.eos_lepto <= (interval.isOvernight ? 1440 : interval.endMinutes));
}

function minutesInsideDeclaredSchedule(workIntervals = [], declared = []) {
    const declaredIntervals = declared.filter(interval => interval.isComplete &&
        !interval.isZeroLength).map(interval => ({ start: interval.startMinutes,
        end: interval.isOvernight ? interval.endMinutes + 1440 : interval.endMinutes }));
    return workIntervals.reduce((sum, work) => sum + declaredIntervals.reduce(
        (inside, interval) => inside + Math.max(0,
            Math.min(work.end, interval.end) - Math.max(work.start, interval.start)), 0), 0);
}

function resolveHrDailyActualWorkResolution({ row = {}, command = {}, effectiveEmployee = {},
    actor = '', reason = '', now = new Date(), sourceCase = '' } = {}) {
    const allowed = ['approve', 'revise_approved', 'work_intervals',
        'emergency_hourly_leave_intervals', 'leave_category', 'source_case'];
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
        Object.keys(command).some(field => !allowed.includes(field))) {
        fail('HR_DAILY_RESOLUTION_FIELDS_NOT_ALLOWED', 'Η εντολή ημερήσιας επίλυσης περιέχει μη επιτρεπτά πεδία.');
    }
    if (command.approve !== true) fail('HR_DAILY_EXPLICIT_APPROVAL_REQUIRED', 'Απαιτείται ρητή έγκριση HR.');
    if (!String(reason).trim()) fail('HR_DAILY_REASON_REQUIRED', 'Απαιτείται αιτιολογία ημερήσιας επίλυσης.');
    if (!String(actor).trim()) fail('HR_DAILY_ACTOR_REQUIRED', 'Δεν είναι διαθέσιμη η ταυτότητα του χρήστη HR.', 403);
    const resolvedSourceCase = String(command.source_case || sourceCase || '').trim();
    if (!SOURCE_CASES.has(resolvedSourceCase)) fail('HR_DAILY_SOURCE_CASE_REQUIRED',
        'Δεν είναι διαθέσιμη έγκυρη αιτία έναρξης του ελέγχου.');
    const revisingApproved = command.revise_approved === true;
    if (revisingApproved && (!isApprovedHrDailyActualWorkResolution(row) || row.is_locked !== true)) {
        fail('HR_DAILY_APPROVED_REVISION_NOT_ALLOWED', 'Δεν υπάρχει έγκυρη κλειδωμένη ημερήσια επίλυση προς διόρθωση.', 409);
    }
    const replayingApproved = !revisingApproved && row.is_locked === true &&
        isApprovedHrDailyActualWorkResolution(row);
    if (!revisingApproved && row.is_locked === true && !replayingApproved) {
        fail('EMPLOYMENT_REVIEW_RECORD_LOCKED', 'Η εγγραφή είναι κλειδωμένη.', 409);
    }
    if (row.adeia_apologistika === true || row.astheneia_apologistika === true ||
        row.adeia === true || row.astheneia === true || row.hr_declared_leave === true) {
        fail('HR_DAILY_FULL_DAY_LEAVE_CONFLICT', 'Η έκτακτη ωροάδεια δεν συνδυάζεται με ολοήμερη άδεια ή ασθένεια.', 409);
    }
    if (row.egkekrimenh_oroadeia_apologistika === true) fail(
        'HR_DAILY_AGREEMENT_HOURLY_LEAVE_CONFLICT',
        'Η έκτακτη ωροάδεια δεν συνδυάζεται με την ωροάδεια έγγραφης συμφωνίας.', 409);

    if (!Array.isArray(command.work_intervals) || command.work_intervals.length > 3) {
        fail('HR_DAILY_WORK_INTERVALS_REQUIRED', 'Δηλώστε έως τρία διαστήματα πραγματικής εργασίας.');
    }
    const work = command.work_intervals.map(normalizeWorkInterval);
    if (!work.length) fail('HR_DAILY_POSITIVE_WORK_REQUIRED', 'Απαιτείται θετική πραγματική εργασία.');
    if (!work.every((item, index) => item.pairNumber === index + 1)) {
        fail('HR_DAILY_WORK_PAIR_ORDER_INVALID',
            'Τα διαστήματα εργασίας πρέπει να χρησιμοποιούν διαδοχικά ζεύγη από το 1.');
    }
    assertOrderedNonOverlapping(work, 'HR_DAILY_WORK_INTERVAL_OVERLAP', 'Πραγματική εργασία');

    const leave = command.emergency_hourly_leave_intervals ?? [];
    if (!validEmergencyHourlyLeaveSegments(leave)) fail('HR_DAILY_EMERGENCY_LEAVE_INVALID',
        'Τα διαστήματα έκτακτης ωροάδειας δεν είναι έγκυρα.');
    const declared = buildDeclaredIntervals(row);
    if (leave.some(segment => !insideDeclaredSchedule(segment, declared))) fail(
        'HR_DAILY_EMERGENCY_LEAVE_OUTSIDE_DECLARED_SCHEDULE',
        'Η έκτακτη ωροάδεια πρέπει να βρίσκεται μέσα στο προδηλωμένο ωράριο.');
    for (const leaveSegment of leave) {
        if (work.some(interval => leaveSegment.apo_lepto < interval.eos_lepto &&
            leaveSegment.eos_lepto > interval.apo_lepto)) fail('HR_DAILY_WORK_LEAVE_OVERLAP',
            'Η πραγματική εργασία δεν επιτρέπεται να επικαλύπτει την έκτακτη ωροάδεια.');
    }
    const leaveMinutes = emergencyHourlyLeaveMinutes(leave) || 0;
    const leaveCategory = String(command.leave_category || '').trim();
    if (leaveMinutes > 0) {
        assertHrSelectableLeaveCategory(leaveCategory);
        if (!leaveCategory) fail('HR_DAILY_LEAVE_CATEGORY_REQUIRED', 'Επιλέξτε κατηγορία έκτακτης ωροάδειας.');
        if (leaveCategory === 'ΑΔΚΑΝ') fail('HR_DAILY_ADKAN_HOURLY_CONFLICT',
            'Η ΑΔΚΑΝ δεν επιτρέπεται ως ωριαία άδεια.');
    } else if (leaveCategory) fail('HR_DAILY_LEAVE_CATEGORY_WITHOUT_INTERVAL',
        'Η κατηγορία ωροάδειας απαιτεί διάστημα ωροάδειας.');

    const approvedUpdates = { kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apologistiko_biblio: true, repo_apologistika: false, adeia_apologistika: false,
        astheneia_apologistika: false, apousia_apologistika: false,
        ektakth_oroadeia_apologistika: leaveMinutes > 0,
        ektakta_diastimata_oroadeias_apologistika: leave.map(segment => ({ ...segment })),
        ores_ektakths_oroadeias_apologistika: leaveMinutes / 60,
        ores_adeias_pistomenes_apologistika: leaveMinutes / 60,
        kathgoria_adeias_apologistika: leaveMinutes > 0 ? leaveCategory : '' };
    for (let number = 1; number <= 3; number += 1) {
        const pair = String(number).padStart(2, '0');
        const interval = work.find(item => item.pairNumber === number);
        approvedUpdates[`apo_ora_${pair}_apologistika`] = interval?.start || '';
        approvedUpdates[`eos_ora_${pair}_apologistika`] = interval?.end || '';
    }
    const proposed = { ...row, ...approvedUpdates };
    const workIntervals = work.map(({ apo_lepto: start, eos_lepto: end }) => ({ start, end }));
    const breakResolution = resolvePayrollBreakIntervals({ row: proposed, effectiveEmployee,
        workIntervals });
    const netMinutes = breakResolution.netMinutes;
    if (!(netMinutes > 0)) fail('HR_DAILY_POSITIVE_WORK_REQUIRED', 'Δεν προκύπτει θετική πραγματική εργασία.');
    const declaredMinutes = declared.reduce((sum, interval) => sum + interval.durationMinutes, 0);
    const workMinutesInsideDeclared = minutesInsideDeclaredSchedule(
        breakResolution.workIntervals, declared);
    const contractualCoveredMinutes = Math.min(declaredMinutes,
        workMinutesInsideDeclared + leaveMinutes);
    const absenceMinutes = Math.max(0, declaredMinutes - contractualCoveredMinutes);
    Object.assign(approvedUpdates, {
        ores_ergasias_apologistika: netMinutes / 60,
        ores_pragmatikhs_ergasias_apologistika: netMinutes / 60,
        ores_apoysias_apologistika: absenceMinutes / 60,
        ores_apoysias_base_apologistika: absenceMinutes / 60,
        hmeres_apoysias_apologistika: 0
    });
    const previous = row.hr_daily_actual_work_resolution || {};
    const nextMetadata = { status: 'HR_APPROVED', policy_version: POLICY_VERSION,
        resolution_kind: RESOLUTION_KIND, source_case: resolvedSourceCase,
        reason: String(reason).trim(),
        approved_work_intervals: work.map(({ pairNumber, start, end }) => ({ pairNumber, start, end })),
        emergency_hourly_leave_intervals: leave.map(segment => ({ ...segment })),
        leave_category: leaveCategory, raw_card_snapshot: rawCardSnapshot(row), raw_cards_preserved: true,
        approved_by: revisingApproved ? previous.approved_by : String(actor || ''),
        approved_at: revisingApproved ? previous.approved_at : now,
        revision_number: revisingApproved ? Number(previous.revision_number) + 1 : 0,
        ...(revisingApproved ? { revised_by: String(actor || ''), revised_at: now } : {}) };
    if (replayingApproved && (!isDeepStrictEqual(previous.approved_work_intervals,
        nextMetadata.approved_work_intervals) || !isDeepStrictEqual(
        previous.emergency_hourly_leave_intervals, nextMetadata.emergency_hourly_leave_intervals) ||
        previous.leave_category !== leaveCategory || previous.source_case !== resolvedSourceCase ||
        previous.reason !== String(reason).trim())) {
        fail('HR_DAILY_APPROVED_REVISION_REQUIRED',
            'Η εγκεκριμένη ημερήσια επίλυση αλλάζει μόνο μέσω ρητής διόρθωσης.', 409);
    }
    const metadata = replayingApproved ? previous : nextMetadata;
    if (revisingApproved && isDeepStrictEqual(previous.approved_work_intervals,
        metadata.approved_work_intervals) && isDeepStrictEqual(previous.emergency_hourly_leave_intervals,
        metadata.emergency_hourly_leave_intervals) && previous.leave_category === leaveCategory) {
        fail('HR_DAILY_REVISION_NO_CHANGE', 'Η αναθεώρηση πρέπει να αλλάζει την εγκεκριμένη επίλυση.', 409);
    }
    return Object.freeze({ approvedUpdates: Object.freeze(approvedUpdates), metadata: Object.freeze(metadata),
        netWorkMinutes: netMinutes, emergencyLeaveMinutes: leaveMinutes,
        coveredMinutes: netMinutes + leaveMinutes, contractualCoveredMinutes,
        workMinutesInsideDeclared, absenceMinutes, revisingApproved,
        idempotentReplay: replayingApproved });
}

async function persistHrDailyActualWorkResolutionWrite({ oldRecord, semanticUpdates, changedBy,
    reason, reviseApproved = false, now = new Date(), schemaPaths, rowModel, auditModel, session } = {}) {
    const { buildReviewCompareAndSetFilter, buildAuditDiff } =
        require('./apasxoliseisOrphanResolutionPersistenceService');
    const metadata = { ...semanticUpdates.hr_daily_actual_work_resolution,
        ...(reviseApproved ? { revised_at: now } : { approved_at: now }) };
    if (reviseApproved && (!isApprovedHrDailyActualWorkResolution(oldRecord) || oldRecord.is_locked !== true)) {
        fail('HR_DAILY_APPROVED_REVISION_NOT_ALLOWED', 'Η εγκεκριμένη επίλυση δεν μπορεί να αναθεωρηθεί με ασφάλεια.', 409);
    }
    if (!reviseApproved && isApprovedHrDailyActualWorkResolution(oldRecord)) {
        const exactReplay = Object.entries(semanticUpdates).every(([field, value]) =>
            isDeepStrictEqual(oldRecord[field], value));
        if (exactReplay) return { idempotent: true, updated: false };
        fail('HR_DAILY_APPROVED_REVISION_REQUIRED',
            'Η εγκεκριμένη ημερήσια επίλυση αλλάζει μόνο μέσω ρητής διόρθωσης.', 409);
    }
    const finalUpdates = { ...semanticUpdates, hr_daily_actual_work_resolution: metadata,
        is_locked: true, locked_by: changedBy, locked_at: now };
    const same = Object.entries(finalUpdates).every(([field, value]) =>
        ['locked_at'].includes(field) || isDeepStrictEqual(oldRecord[field], value));
    if (same) return { idempotent: true, updated: false };
    const { oldValues, newValues } = buildAuditDiff(oldRecord, finalUpdates);
    const result = await rowModel.updateOne(buildReviewCompareAndSetFilter({ oldRecord, schemaPaths }),
        { $set: finalUpdates }, { session });
    if (Number(result?.matchedCount ?? result?.n ?? 0) !== 1) fail('EMPLOYMENT_REVIEW_STALE_WRITE',
        'Η εγγραφή άλλαξε. Ανανεώστε τα αποτελέσματα.', 409);
    await auditModel.create([{ team: oldRecord.team, company_kod: oldRecord.company_kod,
        prodhlomena_oraria_id: oldRecord._id, kodikos: oldRecord.kodikos,
        ypokatasthma: oldRecord.ypokatasthma, hmeromhnia: oldRecord.hmeromhnia,
        changedBy, reason, oldValues, newValues }], { session });
    return { idempotent: false, updated: true, oldValues, newValues, finalUpdates };
}

module.exports = { POLICY_VERSION, RESOLUTION_KIND, SOURCE_CASES,
    isApprovedHrDailyActualWorkResolution,
    resolveHrDailyActualWorkResolution, persistHrDailyActualWorkResolutionWrite };
