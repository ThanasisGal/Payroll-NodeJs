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
    RESOLVED_BY_POLICY: 'Εγκρίθηκε βάσει παλιότερης απόφασης HR',
    NOT_APPLICABLE: ''
});
const ATOMIC_ROLE_ORDER = Object.freeze([
    'SOURCE_BECOMES_WORK',
    'TARGET_BECOMES_REPO'
]);
const ATOMIC_DIAGNOSTIC_LABELS = Object.freeze({
    ATOMIC_LINKED_SET_ROW_OVERLAP:
        'Η ίδια ημέρα συμμετέχει σε περισσότερες ατομικές προτάσεις.',
    ATOMIC_REUSABLE_MULTIPLE_ACTIVE_MATCHES:
        'Βρέθηκαν πολλαπλές ενεργές επαναχρησιμοποιήσιμες πολιτικές.',
    ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED:
        'Δεν επιβεβαιώθηκε με ασφάλεια το παράρτημα της ημέρας προέλευσης.'
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
const NUMERIC_FINDING_FIELDS = Object.freeze([
    'ores_apoysias_apologistika',
    'ores_prostheths_ergasias_apologistika',
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
function atomicDiagnosticLabel(code) {
    return ATOMIC_DIAGNOSTIC_LABELS[code] ||
        'Η συνδεδεμένη πρόταση απαιτεί επιπλέον έλεγχο.';
}
function buildAtomicApprovalNote(reusable = {}) {
    const parts = ['Εγκρίθηκε βάσει παλιότερης απόφασης HR'];
    if (reusable.approved_by_user_name) parts.push(`Εγκρίνων: ${reusable.approved_by_user_name}`);
    if (reusable.approved_at) parts.push(`Ημερομηνία έγκρισης: ${dateKeyUtc(reusable.approved_at)}`);
    if (reusable.effective_from) parts.push(`Ισχύει από: ${dateKeyUtc(reusable.effective_from)}`);
    parts.push(reusable.effective_to
        ? `Ισχύει έως: ${dateKeyUtc(reusable.effective_to)}`
        : 'Ισχύει χωρίς λήξη');
    parts.push(`Έκδοση επαναχρησιμοποιήσιμου αποτυπώματος: ${Number(reusable.fingerprint_version) || 5}`);
    return parts.join(' | ');
}

function selectAtomicExportRows(sourceRows, contextRows, atomicGroupProjection) {
    const sourceIds = new Set(sourceRows.map((row) => id(row?._id || row?.id)).filter(Boolean));
    const contextById = new Map(
        contextRows.map((row) => [id(row?._id || row?.id), row]).filter(([rowId]) => rowId)
    );
    const atomicByRowId = new Map();
    const selectedRows = [...sourceRows];
    const selectedIds = new Set(sourceIds);
    const excludedIncompleteAtomicIds = new Set();

    (Array.isArray(atomicGroupProjection?.groups) ? atomicGroupProjection.groups : [])
        .forEach((group) => {
            const items = Array.isArray(group?.items) ? group.items : [];
            const canonicalItems = ATOMIC_ROLE_ORDER.map((role) =>
                items.find((item) => item?.role === role)
            );
            const itemIds = canonicalItems.map((item) => id(item?.prodhlomena_oraria_id));
            const validStructure = group?.group_type === 'ATOMIC_PAIRED_PROPOSAL' &&
                group?.decision_grain === 'ATOMIC_LINKED_SET' &&
                group?.count === 2 && group?.decision_units_count === 1 &&
                items.length === 2 && canonicalItems.every(Boolean) &&
                itemIds.every(Boolean) && new Set(itemIds).size === 2;
            if (!validStructure || !itemIds.some((rowId) => sourceIds.has(rowId))) return;
            if (!itemIds.every((rowId) => contextById.has(rowId))) {
                itemIds.forEach((rowId) => excludedIncompleteAtomicIds.add(rowId));
                return;
            }

            itemIds.forEach((rowId, index) => {
                if (!selectedIds.has(rowId)) {
                    selectedRows.push(contextById.get(rowId));
                    selectedIds.add(rowId);
                }
                atomicByRowId.set(rowId, {
                    groupId: String(group.group_id || ''),
                    groupKey: String(group.group_key || ''),
                    role: ATOMIC_ROLE_ORDER[index],
                    status: String(group.status || 'NEEDS_REVIEW'),
                    diagnostics: unique(group.atomic_reusable_diagnostics || []),
                    reusableDecision: group.reusable_decision || null
                });
            });
        });

    return {
        rows: selectedRows.filter((row) =>
            !excludedIncompleteAtomicIds.has(id(row?._id || row?.id))
        ),
        atomicByRowId
    };
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
    const deviations = unique([...(deviation?.reasons || []), deviation?.note]);
    if (deviations.length) sections.push(`Απόκλιση ρεπό: ${deviations.join(' | ')}`);
    return sections.join('\n');
}

function hasNumericFinding(row) {
    return NUMERIC_FINDING_FIELDS.some((field) => Math.abs(number(row[field])) > 0) ||
        number(row.illegalOvertime?.total) > 0;
}
function isActualSixthOrSeventhDay(row) {
    return ['SIXTH', 'SEVENTH'].includes(row.policy?.classification) &&
        (number(row.ores_ergasias_apologistika) > 0 || number(row.ores_ergasias) > 0 ||
            number(row.cards_ores_ergasias) > 0);
}
function hasHrOnlyFinding(row) {
    return ['HR', 'PENDING_HR'].includes(row.policy?.source) ||
        String(row.policy?.note || '').trim() !== '';
}
function filterFindingsOnly(rows) {
    const atomicGroupIds = new Set(rows
        .map((row) => row.policy?.atomicGroup?.groupId)
        .filter(Boolean));
    const representativeHrGroups = new Set();
    return rows.filter((row) => {
        if (atomicGroupIds.has(row.policy?.atomicGroup?.groupId)) return true;
        if (hasNumericFinding(row) || isActualSixthOrSeventhDay(row) || row.illegalOvertime?.mismatch) {
            return true;
        }
        if (!hasHrOnlyFinding(row)) return false;
        const key = `${String(row.kodikos || '').trim()}|${row.policy?.weekStart || ''}`;
        if (representativeHrGroups.has(key)) return false;
        representativeHrGroups.add(key);
        return true;
    });
}

function buildReviewExportProjection({ rows = [], policyRows = rows, approvals = [], decisions = [], deviations = [], atomicGroupProjection = null, findingsOnly = false } = {}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const contextRows = Array.isArray(policyRows) ? policyRows : sourceRows;
    const atomicSelection = selectAtomicExportRows(sourceRows, contextRows, atomicGroupProjection);
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
    atomicSelection.rows.forEach((row) => {
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
        const kodikos = String(sorted[0]?.kodikos || '').trim();
        const deviation = deviations.find((item) => exactEmployeeWeek(item, kodikos, week)) || null;
        const profile = {
            hmeres_ergasias_ebdomadas: sorted.at(-1)?.effective_weekly_workdays,
            pososto_prosayxhshs_6hs_hmeras: sorted.at(-1)?.effective_sixth_day_rate ??
                sorted.at(-1)?.pososto_prosayxhshs_6hs_hmeras,
            eidikh_kathgoria_ergazomenoy: sorted.at(-1)?.eidikh_kathgoria_ergazomenoy,
            source: sorted.at(-1)?.effective_profile_source,
            profile_changed_inside_week: deviation?.profile_changed_inside_week === true
        };
        const analysis = analyzeWeeklySixthSeventhDay({ weekRows: sorted, effectiveProfile: profile });
        const deviationRequiresHr = deviation?.status === 'NEEDS_HR_DECISION';
        const decision = decisions.filter((item) => exactEmployeeWeek(item, kodikos, week) && decisionIsActiveApplied(item))
            .sort((a, b) => createdAt(b) - createdAt(a))[0] || null;
        const outputRows = outputGroups.get(groupKey) || [];
        outputRows.forEach((row) => {
            const dateKey = dateKeyUtc(row.hmeromhnia);
            const approval = approvalForDate(approvals, row, dateKey, week);
            const requiresHr = analysis.status === 'NEEDS_HR_DECISION' || deviationRequiresHr;
            const automatic = requiresHr ? 'NORMAL' :
                analysis.sixthDay?.hmeromhnia === dateKey ? 'SIXTH' :
                    analysis.seventhDay?.hmeromhnia === dateKey ? 'SEVENTH' : 'NORMAL';
            const hrClassification = classificationFromRecord(decision, dateKey);
            const approvalClassification = classificationFromApproval(approval, row, dateKey);
            const explicitHrClassification = hrClassification || approvalClassification;
            const classification = explicitHrClassification || automatic;
            const source = decision ? 'HR' : approval ? 'HR' :
                requiresHr ? 'PENDING_HR' : 'AUTOMATIC';
            const illegalOvertime = illegalBreakdown(row);
            const severity = source === 'PENDING_HR' ? 'ΑΠΑΙΤΕΙ ΑΠΟΦΑΣΗ HR' :
                classification === 'SIXTH' ? 'ΠΑΡΑΒΑΣΗ ΠΕΝΘΗΜΕΡΟΥ' :
                classification === 'SEVENTH' ? 'ΣΟΒΑΡΗ ΠΑΡΑΒΑΣΗ' : '';
            const sixthDayHours = classification === 'SIXTH'
                ? rounded(!explicitHrClassification &&
                    analysis.sixthDay?.hmeromhnia === dateKey
                    ? analysis.sixthDay.sixthDayHours
                    : validHours(row.ores_ergasias) ??
                        validHours(row.sixth_day_hours) ?? 0)
                : 0;
            const policy = {
                version: analysis.policyVersion || row.policyVersion || 'legacy',
                legacy: !row.policyVersion,
                weekStart: week.weekStartKey, weekEnd: week.weekEndKey,
                classification, classificationLabel: LABELS[classification],
                source, sourceLabel: LABELS[source],
                status: requiresHr ? 'NEEDS_HR_DECISION' : analysis.status,
                statusLabel: requiresHr
                    ? STATUS_LABELS.NEEDS_HR_DECISION
                    : STATUS_LABELS[analysis.status] ?? String(analysis.status || ''),
                severity, sixthDayHours,
                sixthDayRate: classification === 'SIXTH' ? (analysis.sixthDay?.premiumRate ?? profile.pososto_prosayxhshs_6hs_hmeras ?? null) : null
            };
            policy.note = reasonText({ analysis, decision, approval, deviation, mismatch: illegalOvertime.mismatch });
            const atomicGroup = atomicSelection.atomicByRowId.get(id(row?._id || row?.id));
            if (atomicGroup) {
                const resolved = atomicGroup.status === 'RESOLVED_BY_POLICY' &&
                    atomicGroup.reusableDecision?.approval_id;
                policy.atomicGroup = atomicGroup;
                policy.source = resolved ? 'HR' : 'PENDING_HR';
                policy.sourceLabel = LABELS[policy.source];
                policy.status = resolved ? 'RESOLVED_BY_POLICY' : 'NEEDS_HR_DECISION';
                policy.statusLabel = STATUS_LABELS[policy.status];
                policy.severity = resolved ? '' : 'ΑΠΑΙΤΕΙ ΑΠΟΦΑΣΗ HR';
                const atomicNote = resolved
                    ? buildAtomicApprovalNote(atomicGroup.reusableDecision)
                    : unique(atomicGroup.diagnostics).map(atomicDiagnosticLabel).join(' | ') ||
                        'Συνδεδεμένη πρόταση προέλευσης/προορισμού — απαιτεί έλεγχο.';
                policy.note = unique([policy.note, atomicNote]).join('\n');
            }
            projectedRows.push({ ...row, policy, illegalOvertime });
        });
    });
    projectedRows.sort((a, b) => String(a.exportYpokatasthma || a.ypokatasthma || '').localeCompare(String(b.exportYpokatasthma || b.ypokatasthma || '')) ||
        String(a.kodikos || '').localeCompare(String(b.kodikos || '')) || dateKeyUtc(a.hmeromhnia).localeCompare(dateKeyUtc(b.hmeromhnia)));
    const exportRows = findingsOnly ? filterFindingsOnly(projectedRows) : projectedRows;
    const employeeTotals = {}, branchTotals = {}, grandTotals = emptyTotals();
    exportRows.forEach((row) => {
        const employeeKey = String(row.kodikos || '');
        const branchKey = String(row.exportYpokatasthma || row.ypokatasthma || '');
        employeeTotals[employeeKey] ||= emptyTotals(); branchTotals[branchKey] ||= emptyTotals();
        addTotals(employeeTotals[employeeKey], row); addTotals(branchTotals[branchKey], row); addTotals(grandTotals, row);
    });
    return { policyVersion: POLICY_VERSION, rows: exportRows, totals: { employees: employeeTotals, branches: branchTotals, grand: grandTotals } };
}

module.exports = { LABELS, STATUS_LABELS, TOTAL_FIELDS, NUMERIC_FINDING_FIELDS, illegalBreakdown, emptyTotals, addTotals,
    decisionIsActiveApplied, filterFindingsOnly, selectAtomicExportRows, buildReviewExportProjection };
