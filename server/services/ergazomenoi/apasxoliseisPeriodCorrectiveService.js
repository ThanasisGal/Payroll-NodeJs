'use strict';

const crypto = require('crypto');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { recalculateFrozenCorrectiveWeeks } = require('./apasxoliseisCorrectiveWeeklyRecalculationService');

const COMMAND_TYPE = 'REPLACE_HISTORICAL_CARD_INTERVALS';
const FORBIDDEN_COMMAND_FIELDS = Object.freeze([
    'correctedRows', 'correctedContext', 'corrected_result', 'corrected_context', 'corrective_delta',
    'baselineSnapshot', 'baseline_snapshot', 'baseline_fingerprint', 'can_submit_correction', 'submitted_at', 'deadline',
    'compensation_breakdown_apologistika', 'policy', 'rates', 'sixth_day_hours',
    'seventh_day_hours'
]);

const DELTA_FIELDS = Object.freeze([
    'ores_ergasias_apologistika', 'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika', 'ores_nominhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_apologistika', 'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika', 'ores_argion_ergasia_apologistika',
    'sixth_day_hours', 'seventh_day_hours', 'baseActualWorkAmount', 'premiumTotalAmount', 'grossWorkAmount'
]);
function amount(row, field) {
    if (Object.hasOwn(row || {}, field)) return Number(row[field]) || 0;
    return Number(row?.compensation_breakdown_apologistika?.amounts?.[field]) || 0;
}
function rowKey(row = {}) { return `${String(row.kodikos || '')}|${String(row.hmeromhnia || '').slice(0, 10)}`; }
function buildCorrectiveDelta({ baselineRows = [], correctedRows = [], payrollResults = [] } = {}) {
    const baseline = new Map(baselineRows.map((row) => [rowKey(row), row]));
    const corrected = new Map(correctedRows.map((row) => [rowKey(row), row]));
    const rows = [...new Set([...baseline.keys(), ...corrected.keys()])].sort().map((key) => {
        const before = baseline.get(key) || {}; const after = corrected.get(key) || {};
        return canonicalize({ key, ...Object.fromEntries(DELTA_FIELDS.map((field) => [field,
            Number((amount(after, field) - amount(before, field)).toFixed(6))])) });
    }).filter((row) => DELTA_FIELDS.some((field) => row[field] !== 0));
    const totals = canonicalize(Object.fromEntries(DELTA_FIELDS.map((field) => [field,
        Number(rows.reduce((sum, row) => sum + row[field], 0).toFixed(6))])));
    const payrollTypesByEmployee = new Map();
    for (const payroll of payrollResults) { const employee = String(payroll.kodikos || '');
        if (!payrollTypesByEmployee.has(employee)) payrollTypesByEmployee.set(employee, new Set());
        if (payroll.typos_apodoxon) payrollTypesByEmployee.get(employee).add(String(payroll.typos_apodoxon)); }
    const monetary_by_employee_and_type = [];
    for (const employee of [...new Set(rows.map((row) => String(row.key || '').split('|')[0]))].sort()) {
        const types = [...(payrollTypesByEmployee.get(employee) || [])].sort();
        if (types.length === 1) monetary_by_employee_and_type.push({ employee_kodikos: employee,
            typos_apodoxon: types[0], gross_corrective_delta: Number(rows.filter((row) =>
                String(row.key || '').startsWith(`${employee}|`)).reduce((sum, row) =>
                sum + Number(row.grossWorkAmount || 0), 0).toFixed(2)) });
    }
    const delta = canonicalize({ schema_version: 'employment-corrective-delta:v2', rows, totals,
        monetary_by_employee_and_type });
    return Object.freeze({ delta, fingerprint: crypto.createHash('sha256').update(JSON.stringify(delta)).digest('hex') });
}
function correctionSubmissionCapability({ requiresNewSubmission = false, deadline, now = new Date(), isPastDeadline }) {
    return Object.freeze({ requires_new_submission: requiresNewSubmission === true,
        can_submit_correction: requiresNewSubmission === true && !isPastDeadline(deadline, now) });
}

function commandError(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
function timeMinutes(value) {
    const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
function normalizeCorrectionCommands(input) {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    for (const field of FORBIDDEN_COMMAND_FIELDS) {
        if (Object.hasOwn(body, field)) throw commandError('CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN',
            'Το αίτημα περιέχει πεδίο αποτελέσματος που υπολογίζεται αποκλειστικά από τον server.');
    }
    const allowedBodyFields = new Set(['ypokatasthma', 'case_id', 'reason', 'request_id',
        'requires_new_submission', 'corrections']);
    if (Object.keys(body).some((key) => !allowedBodyFields.has(key))) {
        throw commandError('INVALID_CORRECTIVE_COMMAND_FIELD', 'Το αίτημα περιέχει μη επιτρεπτό πεδίο.');
    }
    const corrections = body.corrections;
    if (!Array.isArray(corrections) || corrections.length < 1 || corrections.length > 100) {
        throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Απαιτείται από μία έως εκατό διορθώσεις ιστορικών στοιχείων.');
    }
    return corrections.map((command) => {
        if (!command || typeof command !== 'object' || Array.isArray(command)) throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Μη έγκυρη διορθωτική εντολή.');
        for (const field of FORBIDDEN_COMMAND_FIELDS) if (Object.hasOwn(command, field)) {
            throw commandError('CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN', 'Δεν επιτρέπονται έτοιμα αποτελέσματα στη διορθωτική εντολή.');
        }
        const allowed = new Set(['type', 'employee_kodikos', 'date', 'intervals']);
        if (Object.keys(command).some((key) => !allowed.has(key))) throw commandError('INVALID_CORRECTIVE_COMMAND_FIELD', 'Η διορθωτική εντολή περιέχει μη επιτρεπτό πεδίο.');
        const type = String(command.type || ''); const employee = String(command.employee_kodikos || '').trim();
        const date = String(command.date || ''); const intervals = command.intervals;
        if (type !== COMMAND_TYPE || !employee || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(intervals) || intervals.length > 3) {
            throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Μη έγκυρα ιστορικά διαστήματα κάρτας.');
        }
        const normalizedIntervals = intervals.map((interval) => {
            if (!interval || Object.keys(interval).some((key) => !['start', 'end'].includes(key))) throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Μη έγκυρο διάστημα κάρτας.');
            const start = String(interval.start || ''); const end = String(interval.end || '');
            if (timeMinutes(start) === null || timeMinutes(end) === null || start === end) throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Μη έγκυρη ώρα κάρτας.');
            return { start, end };
        });
        const spans = normalizedIntervals.map((interval) => { const start = timeMinutes(interval.start);
            let end = timeMinutes(interval.end); if (end < start) end += 24 * 60; return { start, end }; })
            .sort((a, b) => a.start - b.start);
        if (spans.some((span, index) => index > 0 && span.start < spans[index - 1].end) ||
            spans.reduce((sum, span) => sum + span.end - span.start, 0) > 24 * 60) {
            throw commandError('INVALID_CORRECTIVE_COMMANDS', 'Τα ιστορικά διαστήματα κάρτας αλληλεπικαλύπτονται.');
        }
        return canonicalize({ type, employee_kodikos: employee, date, intervals: normalizedIntervals });
    }).sort((a, b) => `${a.employee_kodikos}|${a.date}`.localeCompare(`${b.employee_kodikos}|${b.date}`));
}
function reconstructCorrectedHistoricalResult({ baselineSnapshot, commands, runAuthoritativeWeek }) {
    const normalized = normalizeCorrectionCommands({ corrections: commands });
    const byKey = new Map(normalized.map((command) => [`${command.employee_kodikos}|${command.date}`, command]));
    const baselineRows = baselineSnapshot?.daily_results || [];
    for (const key of byKey.keys()) {
        if (!baselineRows.some((row) => `${row.kodikos}|${String(row.hmeromhnia).slice(0, 10)}` === key)) {
            throw commandError('CORRECTIVE_BASELINE_ROW_NOT_FOUND', 'Η διορθωτική εντολή δεν αντιστοιχεί σε γραμμή του παγωμένου αποτελέσματος.');
        }
    }
    const recalculated = recalculateFrozenCorrectiveWeeks({ baselineSnapshot, commands: normalized,
        runAuthoritativeWeek });
    return Object.freeze({ correctedRows: recalculated.correctedRows,
        correctedDeviations: recalculated.correctedDeviations,
        correctedContext: canonicalize({ ...recalculated.correctedContext, correction_type: COMMAND_TYPE,
            commands: normalized, historical_references: normalized.map((item) => ({
                employee_kodikos: item.employee_kodikos, date: item.date })) }),
        commandFingerprint: crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex') });
}
module.exports = { DELTA_FIELDS, COMMAND_TYPE, FORBIDDEN_COMMAND_FIELDS, buildCorrectiveDelta,
    correctionSubmissionCapability, normalizeCorrectionCommands, reconstructCorrectedHistoricalResult };
