'use strict';

const crypto = require('crypto');
const { canonicalize, SNAPSHOT_SCHEMA_VERSION } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { startOfWeekMondayUtc, addDaysUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function fail(code, message) { const error = new Error(message); error.code = code; error.statusCode = 409; throw error; }
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

function recalculateFrozenCorrectiveWeeks({ baselineSnapshot, commands, runAuthoritativeWeek }) {
    if (baselineSnapshot?.snapshot_schema_version !== SNAPSHOT_SCHEMA_VERSION ||
        !Array.isArray(baselineSnapshot?.weekly_calculation_context?.rows)) fail(
        'CORRECTIVE_FROZEN_WEEKLY_CONTEXT_UNSUPPORTED',
        'Το παγωμένο αποτέλεσμα δεν διαθέτει τα απαιτούμενα ιστορικά στοιχεία για ασφαλή εβδομαδιαίο επανυπολογισμό.');
    if (typeof runAuthoritativeWeek !== 'function') throw new TypeError('Authoritative weekly calculation adapter is required.');
    const contextRows = baselineSnapshot.weekly_calculation_context.rows.map((row) => canonicalize(row));
    const outputByKey = new Map((baselineSnapshot.daily_results || []).map((row) =>
        [`${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`, canonicalize(row)]));
    const affected = new Map();
    for (const command of commands) { const weekStart = dateKeyUtc(startOfWeekMondayUtc(command.date));
        const key = `${command.employee_kodikos}|${weekStart}`;
        if (!affected.has(key)) affected.set(key, []); affected.get(key).push(command); }
    const affectedDeviationKeys = new Set(); const correctedDeviations = []; const contexts = [];
    for (const [key, weekCommands] of affected) { const separator = key.lastIndexOf('|');
        const employee = key.slice(0, separator); const weekStart = key.slice(separator + 1);
        const weekDates = new Set(Array.from({ length: 7 }, (_, index) => dateKeyUtc(addDaysUtc(weekStart, index))));
        const commandByDate = new Map(weekCommands.map((command) => [command.date, command]));
        const frozenWeek = contextRows.filter((row) => String(row.kodikos) === employee && weekDates.has(dateKeyUtc(row.hmeromhnia)))
            .sort((a, b) => dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
        if (frozenWeek.length !== 7) fail('CORRECTIVE_FROZEN_WEEK_INCOMPLETE',
            'Το παγωμένο αποτέλεσμα δεν περιέχει πλήρη φυσική εβδομάδα.');
        if (weekCommands.some((command) => frozenWeek.some((row) =>
            dateKeyUtc(row.hmeromhnia) === command.date && row.is_locked === true))) fail(
            'CORRECTIVE_ROW_MANUALLY_LOCKED', 'Η χειροκίνητα κλειδωμένη εγγραφή δεν μπορεί να διορθωθεί.');
        const rawPatchedWeek = frozenWeek.map((row) => commandByDate.has(dateKeyUtc(row.hmeromhnia)) ?
            patchHistoricalCardFacts(row, commandByDate.get(dateKeyUtc(row.hmeromhnia))) : { ...row });
        const planned = runAuthoritativeWeek({ employeeKodikos: employee, weekStart,
            frozenRows: rawPatchedWeek, baselineSnapshot });
        if (!Array.isArray(planned?.correctedRows) || planned.correctedRows.length !== 7) {
            fail('CORRECTIVE_AUTHORITATIVE_WEEK_INVALID', 'Ο authoritative εβδομαδιαίος υπολογισμός δεν επέστρεψε πλήρη εβδομάδα.');
        }
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

module.exports = { patchHistoricalCardFacts, recalculateFrozenCorrectiveWeeks };
