// Pure, shared projection for the employment-review screen exports.
// It performs no persistence and deliberately consumes already-loaded records.

const { getMondaySundayWeekRange, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const {
    analyzeWeeklySixthSeventhDay,
    POLICY_VERSION
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

const LABELS = Object.freeze({
    NORMAL: 'Κανονική', SIXTH: '6η ημέρα', SEVENTH: '7η ημέρα',
    AUTOMATIC: 'Αυτόματα', HR: 'HR', PENDING_HR: 'Εκκρεμεί HR'
});
const STATUS_LABELS = Object.freeze({
    READY: 'Έτοιμο',
    NEEDS_HR_DECISION: 'Απαιτεί απόφαση HR',
    NOT_APPLICABLE: ''
});
const TOTAL_FIELDS = Object.freeze([
    'ores_ergasias_apologistika', 'ores_apoysias_apologistika',
    'ores_nyxtas_apologistika', 'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika', 'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika', 'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika', 'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika', 'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika', 'ores_nominhs_yperorias_argion_nyxtas_apologistika'
]);

function number(value) {
    const parsed = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
}
function rounded(value) { return Number(number(value).toFixed(2)); }
function validHours(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function id(value) { return String(value?._id ?? value ?? ''); }
function createdAt(value) {
    const time = new Date(value?.applied_at || value?.updated_at || value?.created_at || 0).getTime();
    return Number.isFinite(time) ? time : 0;
}
function unique(values) {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}
function illegalBreakdown(row = {}) {
    const result = {
        normal: number(row.ores_paranomhs_yperorias_apologistika),
        night: number(row.ores_paranomhs_yperorias_nyxtas_apologistika),
        holiday: number(row.ores_paranomhs_yperorias_argion_apologistika),
        holidayNight: number(row.ores_paranomhs_yperorias_argion_nyxtas_apologistika)
    };
    result.total = rounded(result.normal + result.night + result.holiday + result.holidayNight);
    const rawCanonical = row.canonical_illegal_overtime_total ??
        row.ores_paranomhs_yperorias_total_apologistika ?? row.paranomi_yperoria_total;
    result.canonicalTotal = rawCanonical === undefined || rawCanonical === null || rawCanonical === ''
        ? null : rounded(rawCanonical);
    result.mismatch = result.canonicalTotal !== null &&
        Math.abs(result.canonicalTotal - result.total) > 0.02;
    return result;
}
function emptyTotals() {
    const totals = Object.fromEntries(TOTAL_FIELDS.map((field) => [field, 0]));
    return { ...totals, sixthDayCount: 0, seventhDayCount: 0, sixthDayHours: 0,
        illegalNormal: 0, illegalNight: 0, illegalHoliday: 0, illegalHolidayNight: 0,
        illegalTotal: 0 };
}
function addTotals(target, row) {
    TOTAL_FIELDS.forEach((field) => { target[field] = rounded(target[field] + number(row[field])); });
    if (row.policy?.classification === 'SIXTH') target.sixthDayCount += 1;
    if (row.policy?.classification === 'SEVENTH') target.seventhDayCount += 1;
    target.sixthDayHours = rounded(target.sixthDayHours + number(row.policy?.sixthDayHours));
    target.illegalNormal = rounded(target.illegalNormal + row.illegalOvertime.normal);
    target.illegalNight = rounded(target.illegalNight + row.illegalOvertime.night);
    target.illegalHoliday = rounded(target.illegalHoliday + row.illegalOvertime.holiday);
    target.illegalHolidayNight = rounded(target.illegalHolidayNight + row.illegalOvertime.holidayNight);
    target.illegalTotal = rounded(target.illegalNormal + target.illegalNight +
        target.illegalHoliday + target.illegalHolidayNight);
    return target;
}
function exactEmployeeWeek(record, kodikos, week) {
    return String(record?.employee_kodikos || record?.kodikos || '').trim() === kodikos &&
        dateKeyUtc(record?.week_start || record?.week_apo) === week.weekStartKey &&
        dateKeyUtc(record?.week_end || record?.week_eos) === week.weekEndKey;
}
function decisionIsActiveApplied(record) {
    const active = String(record?.decision_status || '').toUpperCase() === 'RECORDED' &&
        String(record?.decision_code || '').toUpperCase() === 'APPROVE_PROPOSAL';
    const applied = record?.applied === true || String(record?.apply_status || '').toUpperCase() === 'APPLIED' ||
        String(record?.execution_status || '').toUpperCase() === 'APPLIED' || record?.applied_at;
    return Boolean(active && applied && record?.stale !== true && record?.is_current !== false);
}
function classificationFromRecord(record, dateKey) {
    const snapshot = record?.canonical_snapshot || {};
    const value = record?.classification_by_date?.[dateKey] || snapshot?.classification_by_date?.[dateKey] ||
        record?.classification || snapshot?.classification;
    const normalized = String(value || '').toUpperCase();
    if (normalized.includes('SEVENTH') || normalized === '7') return 'SEVENTH';
    if (normalized.includes('SIXTH') || normalized === '6') return 'SIXTH';
    return normalized === 'NORMAL' ? 'NORMAL' : null;
}
function approvalForDate(approvals, row, dateKey, week) {
    return approvals.filter((approval) =>
        String(approval?.decision_status || '').toUpperCase() === 'RECORDED' &&
        approval?.reuse_status !== 'REVOKED' && approval?.stale !== true &&
        dateKeyUtc(approval?.apo_hmeromhnia) === week.weekStartKey &&
        dateKeyUtc(approval?.eos_hmeromhnia) === week.weekEndKey &&
        ['APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED'].includes(String(approval?.decision_type || '').toUpperCase()) &&
        (approval.items || []).some((item) => String(item.employee_kodikos || '') === String(row.kodikos || '') &&
            dateKeyUtc(item.hmeromhnia) === dateKey)
    ).sort((a, b) => createdAt(b) - createdAt(a))[0] || null;
}
function classificationFromApproval(approval, row, dateKey) {
    const item = (approval?.items || []).find((entry) =>
        String(entry.employee_kodikos || '') === String(row.kodikos || '') &&
        dateKeyUtc(entry.hmeromhnia) === dateKey);
    return classificationFromRecord(item?.proposed_values || item?.flags || {}, dateKey);
}
function reasonText({ analysis, decision, approval, deviation, mismatch }) {
    const sections = [];
    const policy = unique([...(analysis?.reasons || []), ...(analysis?.warnings || [])]);
    if (policy.length) sections.push(`Πολιτική: ${policy.join(', ')}`);
    const warnings = unique([mismatch ? 'ΑΣΥΜΦΩΝΙΑ ΔΕΔΟΜΕΝΩΝ' : '']);
    if (warnings.length) sections.push(`Προειδοποιήσεις: ${warnings.join(', ')}`);
    const hr = unique([decision?.notes, approval?.notes]);
    if (hr.length) sections.push(`Απόφαση HR: ${hr.join(' | ')}`);
    const deviations = unique([deviation?.note]);
    if (deviations.length) sections.push(`Απόκλιση ρεπό: ${deviations.join(' | ')}`);
    return sections.join('\n');
}

function buildReviewExportProjection({ rows = [], policyRows = rows, approvals = [], decisions = [], deviations = [] } = {}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const contextRows = Array.isArray(policyRows) ? policyRows : sourceRows;
    const groups = new Map();
    contextRows.forEach((row) => {
        const date = dateKeyUtc(row.hmeromhnia);
        const week = getMondaySundayWeekRange(date);
        if (!date || !week) return;
        const key = `${String(row.kodikos || '')}|${week.weekStartKey}`;
        if (!groups.has(key)) groups.set(key, { week, rows: [] });
        groups.get(key).rows.push(row);
    });
    const outputGroups = new Map();
    sourceRows.forEach((row) => {
        const date = dateKeyUtc(row.hmeromhnia);
        const week = getMondaySundayWeekRange(date);
        if (!date || !week) return;
        const key = `${String(row.kodikos || '')}|${week.weekStartKey}`;
        if (!outputGroups.has(key)) outputGroups.set(key, []);
        outputGroups.get(key).push(row);
    });
    const projectedRows = [];
    groups.forEach(({ week, rows: weekRows }, groupKey) => {
        const sorted = [...weekRows].sort((a, b) => dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
        const profile = {
            hmeres_ergasias_ebdomadas: sorted.at(-1)?.effective_weekly_workdays,
            pososto_prosayxhshs_6hs_hmeras: sorted.at(-1)?.effective_sixth_day_rate ??
                sorted.at(-1)?.pososto_prosayxhshs_6hs_hmeras,
            eidikh_kathgoria_ergazomenoy: sorted.at(-1)?.eidikh_kathgoria_ergazomenoy,
            source: sorted.at(-1)?.effective_profile_source
        };
        const analysis = analyzeWeeklySixthSeventhDay({ weekRows: sorted, effectiveProfile: profile });
        const kodikos = String(sorted[0]?.kodikos || '').trim();
        const decision = decisions.filter((item) => exactEmployeeWeek(item, kodikos, week) && decisionIsActiveApplied(item))
            .sort((a, b) => createdAt(b) - createdAt(a))[0] || null;
        const outputRows = outputGroups.get(groupKey) || [];
        outputRows.forEach((row) => {
            const dateKey = dateKeyUtc(row.hmeromhnia);
            const approval = approvalForDate(approvals, row, dateKey, week);
            const deviation = deviations.find((item) => exactEmployeeWeek(item, kodikos, week)) || null;
            const automatic = analysis.sixthDay?.hmeromhnia === dateKey ? 'SIXTH' :
                analysis.seventhDay?.hmeromhnia === dateKey ? 'SEVENTH' : 'NORMAL';
            const hrClassification = classificationFromRecord(decision, dateKey);
            const requiresHr = analysis.status === 'NEEDS_HR_DECISION';
            const approvalClassification = classificationFromApproval(approval, row, dateKey);
            const classification = hrClassification || approvalClassification || automatic;
            const source = decision ? 'HR' : approval ? 'HR' :
                requiresHr ? 'PENDING_HR' : 'AUTOMATIC';
            const illegalOvertime = illegalBreakdown(row);
            const severity = source === 'PENDING_HR' ? 'ΑΠΑΙΤΕΙ ΑΠΟΦΑΣΗ HR' :
                classification === 'SIXTH' ? 'ΠΑΡΑΒΑΣΗ ΠΕΝΘΗΜΕΡΟΥ' :
                classification === 'SEVENTH' ? 'ΣΟΒΑΡΗ ΠΑΡΑΒΑΣΗ' : '';
            const sixthDayHours = classification === 'SIXTH'
                ? rounded(validHours(row.ores_ergasias) ?? analysis.sixthDay?.sixthDayHours ??
                    row.sixth_day_hours ?? 0) : 0;
            const policy = {
                version: analysis.policyVersion || row.policyVersion || 'legacy',
                legacy: !row.policyVersion,
                weekStart: week.weekStartKey, weekEnd: week.weekEndKey,
                classification, classificationLabel: LABELS[classification],
                source, sourceLabel: LABELS[source], status: analysis.status,
                statusLabel: STATUS_LABELS[analysis.status] ?? String(analysis.status || ''),
                severity, sixthDayHours,
                sixthDayRate: classification === 'SIXTH' ? (analysis.sixthDay?.premiumRate ?? profile.pososto_prosayxhshs_6hs_hmeras ?? null) : null
            };
            policy.note = reasonText({ analysis, decision, approval, deviation, mismatch: illegalOvertime.mismatch });
            projectedRows.push({ ...row, policy, illegalOvertime });
        });
    });
    projectedRows.sort((a, b) => String(a.exportYpokatasthma || a.ypokatasthma || '').localeCompare(String(b.exportYpokatasthma || b.ypokatasthma || '')) ||
        String(a.kodikos || '').localeCompare(String(b.kodikos || '')) || dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
    const employeeTotals = {}, branchTotals = {}, grandTotals = emptyTotals();
    projectedRows.forEach((row) => {
        const employeeKey = String(row.kodikos || '');
        const branchKey = String(row.exportYpokatasthma || row.ypokatasthma || '');
        employeeTotals[employeeKey] ||= emptyTotals(); branchTotals[branchKey] ||= emptyTotals();
        addTotals(employeeTotals[employeeKey], row); addTotals(branchTotals[branchKey], row); addTotals(grandTotals, row);
    });
    return { policyVersion: POLICY_VERSION, rows: projectedRows, totals: { employees: employeeTotals, branches: branchTotals, grand: grandTotals } };
}

module.exports = { LABELS, STATUS_LABELS, TOTAL_FIELDS, illegalBreakdown, emptyTotals, addTotals,
    decisionIsActiveApplied, buildReviewExportProjection };
