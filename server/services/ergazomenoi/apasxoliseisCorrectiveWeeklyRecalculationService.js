'use strict';

const crypto = require('crypto');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { startOfWeekMondayUtc, addDaysUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

const VERIFIED_CORRECTIVE_ORPHAN_EVIDENCE = Symbol.for(
    'payroll.verifiedCorrectiveOrphanEvidence');

function attachVerifiedCorrectiveOrphanEvidence(row, evidence) {
    Object.defineProperty(row, VERIFIED_CORRECTIVE_ORPHAN_EVIDENCE, {
        value: evidence, enumerable: false, configurable: false, writable: false
    });
    return row;
}

function getVerifiedCorrectiveOrphanEvidence(row) {
    return row?.[VERIFIED_CORRECTIVE_ORPHAN_EVIDENCE] || null;
}

function fail(code, message, details) { const error = new Error(message); error.code = code;
    error.statusCode = 409; if (details) error.preview = Object.freeze(details); throw error; }
function patchHistoricalCardFacts(row, command) {
    const patched = { ...row };
    for (let index = 0; index < 3; index += 1) { const suffix = String(index + 1).padStart(2, '0');
        const interval = command.intervals[index];
        patched[`cards_apo_ora_${suffix}`] = interval?.start || '';
        patched[`cards_eos_ora_${suffix}`] = interval?.end || '';
    }
    return patched;
}
function deviationWeekKey(row = {}) { return `${String(row.kodikos || '')}|${dateKeyUtc(row.week_apo || row.weekStart)}`; }

function recalculateFrozenCorrectiveWeeks({ baselineSnapshot, commands, runAuthoritativeWeek,
    verifiedEvidence = [] }) {
    if (!['employment-period-frozen:v2', 'employment-period-frozen:v3'].includes(
        baselineSnapshot?.snapshot_schema_version) ||
        !Array.isArray(baselineSnapshot?.weekly_calculation_context?.rows)) fail(
        'CORRECTIVE_FROZEN_WEEKLY_CONTEXT_UNSUPPORTED',
        'Το παγωμένο αποτέλεσμα δεν διαθέτει τα απαιτούμενα ιστορικά στοιχεία για ασφαλή εβδομαδιαίο επανυπολογισμό.');
    if (typeof runAuthoritativeWeek !== 'function') throw new TypeError('Authoritative weekly calculation adapter is required.');
    const contextRows = baselineSnapshot.weekly_calculation_context.rows.map((row) => canonicalize(row));
    const evidenceByRowId = new Map(verifiedEvidence.map((item) => [String(item.row_id), item]));
    const outputByKey = new Map((baselineSnapshot.daily_results || []).map((row) =>
        [`${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`, canonicalize(row)]));
    const affected = new Map();
    const periodStart = dateKeyUtc(baselineSnapshot.scope?.period_start);
    const periodEnd = dateKeyUtc(baselineSnapshot.scope?.period_end);
    for (const command of commands) {
        const requestedDate = command.week_start || command.date;
        const weekStart = dateKeyUtc(startOfWeekMondayUtc(requestedDate));
        if (command.week_start && weekStart !== command.week_start) fail('CORRECTIVE_WEEK_START_INVALID',
            'Η διορθωτική εβδομάδα πρέπει να ξεκινά Δευτέρα.');
        const weekEnd = dateKeyUtc(addDaysUtc(weekStart, 6));
        if (weekStart < periodStart || weekEnd > periodEnd) fail('CORRECTIVE_WEEK_OUTSIDE_BASELINE_PERIOD',
            'Η διορθωτική εβδομάδα δεν ανήκει στην παγωμένη περίοδο.');
        const key = `${command.employee_kodikos}|${weekStart}`;
        if (!affected.has(key)) affected.set(key, []); affected.get(key).push(command); }
    const affectedDeviationKeys = new Set(); const correctedDeviations = []; const contexts = [];
    for (const [key, weekCommands] of affected) { const separator = key.lastIndexOf('|');
        const employee = key.slice(0, separator); const weekStart = key.slice(separator + 1);
        const weekDates = new Set(Array.from({ length: 7 }, (_, index) => dateKeyUtc(addDaysUtc(weekStart, index))));
        const commandByDate = new Map(weekCommands.filter((command) => command.date)
            .map((command) => [command.date, command]));
        const frozenWeek = contextRows.filter((row) => String(row.kodikos) === employee && weekDates.has(dateKeyUtc(row.hmeromhnia)))
            .sort((a, b) => dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
        if (frozenWeek.length !== 7) fail('CORRECTIVE_FROZEN_WEEK_INCOMPLETE',
            'Το παγωμένο αποτέλεσμα δεν περιέχει πλήρη φυσική εβδομάδα.');
        if (weekCommands.some((command) => frozenWeek.some((row) =>
            dateKeyUtc(row.hmeromhnia) === command.date && row.is_locked === true))) fail(
            'CORRECTIVE_ROW_MANUALLY_LOCKED', 'Η χειροκίνητα κλειδωμένη εγγραφή δεν μπορεί να διορθωθεί.');
        const rawPatchedWeek = frozenWeek.map((row) => {
            const patched = commandByDate.has(dateKeyUtc(row.hmeromhnia))
                ? patchHistoricalCardFacts(row, commandByDate.get(dateKeyUtc(row.hmeromhnia))) : { ...row };
            const evidence = evidenceByRowId.get(String(row._id));
            if (!evidence) return patched;
            return attachVerifiedCorrectiveOrphanEvidence({ ...patched,
                orphan_card_resolution: canonicalize(evidence.orphan_card_resolution) }, evidence);
        });
        const planned = runAuthoritativeWeek({ employeeKodikos: employee, weekStart,
            frozenRows: rawPatchedWeek, baselineSnapshot });
        if (!Array.isArray(planned?.correctedRows) || planned.correctedRows.length !== 7) {
            fail('CORRECTIVE_AUTHORITATIVE_WEEK_INVALID', 'Ο authoritative εβδομαδιαίος υπολογισμός δεν επέστρεψε πλήρη εβδομάδα.');
        }
        const correctiveRowIds = new Set(rawPatchedWeek.filter((row) =>
            evidenceByRowId.has(String(row._id)) || commandByDate.has(dateKeyUtc(row.hmeromhnia)))
            .map((row) => String(row._id)));
        const compensationIssues = planned.correctedRows.filter((row) =>
            correctiveRowIds.has(String(row?._id)) &&
            row?.compensation_breakdown_apologistika?.status !== 'READY').map((row) => ({
                row_id: String(row?._id || ''), date: dateKeyUtc(row?.hmeromhnia),
                status: row?.compensation_breakdown_apologistika?.status || 'MISSING',
                reasons: row?.compensation_breakdown_apologistika?.reasons || []
            }));
        const unresolved = compensationIssues.length > 0 || (planned.deviations || []).some((item) =>
            item?.status === 'NEEDS_HR_DECISION') || (Array.isArray(planned.canonical) &&
            planned.canonical.some((item) => item?.status === 'NEEDS_HR_DECISION'));
        if (unresolved) fail('CORRECTIVE_WEEK_NEEDS_HR_DECISION',
            'Η παγωμένη εβδομάδα απαιτεί ανθρώπινη απόφαση και δεν αποθηκεύτηκε διορθωτικό αποτέλεσμα.', {
                status: 'NEEDS_HR_DECISION', employee_kodikos: employee, week_start: weekStart,
                baselineRows: frozenWeek.map(canonicalize), deviations: (planned.deviations || []).map(canonicalize),
                canonical: canonicalize(planned.canonical || null), diagnostics: planned.diagnostics || [],
                compensation_issues: canonicalize(compensationIssues)
            });
        for (const row of planned.correctedRows) { const rowKey = `${employee}|${dateKeyUtc(row.hmeromhnia)}`;
            if (outputByKey.has(rowKey)) outputByKey.set(rowKey, canonicalize(row)); }
        affectedDeviationKeys.add(`${employee}|${weekStart}`);
        correctedDeviations.push(...(planned.deviations || []).map(canonicalize));
        contexts.push(canonicalize({ employee_kodikos: employee, week_start: weekStart,
            canonical: planned.canonical || null, diagnostics: planned.diagnostics || [] }));
    }
    const deviations = [...(baselineSnapshot.deviations || []).filter((row) =>
        !affectedDeviationKeys.has(deviationWeekKey(row))), ...correctedDeviations]
        .map(canonicalize).sort((a, b) => deviationWeekKey(a).localeCompare(deviationWeekKey(b)));
    const correctedRows = [...outputByKey.values()].sort((a, b) =>
        `${a.kodikos}|${dateKeyUtc(a.hmeromhnia)}`.localeCompare(`${b.kodikos}|${dateKeyUtc(b.hmeromhnia)}`));
    const correctedContext = canonicalize({ context_schema_version: 'employment-corrective-weekly:v3',
        authoritative_source: 'SHARED_NORMAL_DAILY_ADAPTER_AND_WEEKLY_POST_CHECK_PLAN',
        calculation_version: baselineSnapshot.source_calculation_version, affected_weeks: contexts,
        corrected_deviations: deviations });
    return Object.freeze({ correctedRows, correctedDeviations: deviations, correctedContext,
        resultFingerprint: crypto.createHash('sha256').update(JSON.stringify(canonicalize({ correctedRows,
            deviations, correctedContext }))).digest('hex') });
}

module.exports = { patchHistoricalCardFacts, recalculateFrozenCorrectiveWeeks,
    getVerifiedCorrectiveOrphanEvidence };
