'use strict';

// Save policy only: the existing canonicalizer, coverage verifier and typed
// field registry continue to own historical semantics. No repair is performed.
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { registryEntry } = require('./employeeHistoryCorrectionFieldRegistryService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');

function inspectEmployeeHistorySave({ scope, currentEmployee, historyRows }) {
    const checked = verifyEmployeeHistoryAutomaticSettlement({ scope, currentEmployee,
        proposedRows: historyRows, requiredHistoryRows: historyRows, strictProfileEvidence: true });
    const issues = checked.issues.map(reason => ({ reason }));
    try {
        const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows, strictProfileEvidence: true });
        const nonProfiles = new Set((canonical.classifications || []).filter(item =>
            item.eventTypes?.length && item.eventTypes.every(type => ['HIRE', 'LEGACY_TECHNICAL', 'DEPARTURE'].includes(type)))
            .map(item => item.historyId));
        for (const row of historyRows.filter(row => !isInactiveHistoryRow(row))) {
            if (nonProfiles.has(String(row._id)) && !row[C.START]) continue;
            const context = { historyId: String(row._id), sequence: row.aa_eggrafhs,
                from: row[C.START], until: row[C.END] };
            for (const id of ['KPK', 'CONTRACT_TYPE', 'CONTRACT_CATEGORY', 'SPECIALTY', 'WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']) {
                const entry = registryEntry(id), value = row[entry.fields[0]];
                try { entry.normalize(value); }
                catch { issues.push({ ...context, reason: 'REQUIRED_PROFILE_FIELD', field: entry.fields[0], label: entry.label }); }
            }
            const employmentType = require('../../utils/ergazomenoi/employmentTypeSemantics')
                .resolveEmploymentTypeSemantics(row);
            if (employmentType.status !== 'RESOLVED')
                issues.push({ ...context, reason: 'REQUIRED_PROFILE_FIELD',
                    field: 'kathestos_apasxolhshs', label: 'Καθεστώς απασχόλησης' });
            for (const [field,label] of [['typos_ebdomadas','Τύπος εβδομάδας']])
                // The existing work-term canonicalizer deliberately has no
                // five/six-day week label for a recorded one-to-four-day week.
                // Its explicit days/hours remain mandatory above.
                if ((field !== 'typos_ebdomadas' || [5, 6].includes(row.hmeres_ergasias_ebdomadas)) &&
                    (typeof row[field] !== 'string' || !row[field].trim()))
                    issues.push({ ...context, reason: 'REQUIRED_PROFILE_FIELD', field, label });
            for (const [fields,label] of [
                [['nomimosMisthos','nomimoHmeromisthio','nomimoOromisthio'],'Νόμιμες αποδοχές'],
                [['pragmatikosMisthos','pragmatikoHmeromisthio','pragmatikoOromisthio'],'Πραγματικές αποδοχές']
            ]) if (!fields.some(field => typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field] > 0))
                issues.push({ ...context, reason: 'REQUIRED_PROFILE_FIELD', field: fields[0], label });
        }
        const terminal = historyRows.filter(row => !isInactiveHistoryRow(row) && row[C.START] &&
            !nonProfiles.has(String(row._id)) && calendarDate(row[C.HIRE])?.getTime() === calendarDate(currentEmployee[C.HIRE])?.getTime())
            .sort((a,b) => calendarDate(a[C.START])-calendarDate(b[C.START])).at(-1);
        if (terminal) {
            const schema = require('../../models/ergazomenoi').ErgazomenoiModel.schema;
            const { equal } = require('./employeeHistoryAutomaticReconstructionApplyContract');
            for (const field of C.PROFILE_FIELDS) {
                if (currentEmployee[field] === undefined || !schema.path(field)) continue;
                if (!equal(schema.path(field).cast(currentEmployee[field]), schema.path(field).cast(terminal[field])))
                    issues.push({ reason: 'CURRENT_PROFILE_MISMATCH', historyId: String(terminal._id),
                        from: terminal[C.START], until: terminal[C.END], field, label: 'Συμφωνία τρεχόντων και τελευταίων ιστορικών όρων' });
            }
        }
        if (!calendarDate(currentEmployee[C.DEPARTURE])) {
            const latest = historyRows.filter(row => !isInactiveHistoryRow(row) && calendarDate(row[C.START]) &&
                calendarDate(row[C.HIRE])?.getTime() === calendarDate(currentEmployee[C.HIRE])?.getTime())
                .sort((a,b) => calendarDate(a[C.START])-calendarDate(b[C.START])).at(-1);
            if (latest && calendarDate(latest[C.END]) && !calendarDate(currentEmployee[C.END]))
                issues.push({ reason: 'ACTIVE_PERIOD_NOT_OPEN', historyId: String(latest._id), from: latest[C.START], until: latest[C.END] });
        }
    } catch (error) { issues.push({ reason: error.code || 'HISTORY_VALIDATION_FAILED' }); }
    return { status: checked.status === 'CLEAN' && issues.length === 0 ? 'CLEAN' : 'LEGACY_REVIEW_REQUIRED',
        accessMode: checked.status === 'CLEAN' && issues.length === 0 ? 'NORMAL' : 'READ_ONLY',
        cleanupRequired: !checked.canonicalIdempotent, issues, verification: checked };
}

function historySaveFailure(inspection, legacy = false) {
    const issue = inspection.issues.find(item => item.field) || inspection.issues[0] || {};
    const fmt = value => calendarDate(value)?.toISOString().slice(0,10) || 'χωρίς καταγεγραμμένη ημερομηνία';
    const detail = issue.field ? `Η εγγραφή ${issue.sequence || issue.historyId}, περίοδος ${fmt(issue.from)} έως ${fmt(issue.until)}, δεν έχει έγκυρο πεδίο «${issue.label}».`
        : inspection.verification?.coverageGaps?.length ? `Λείπει ιστορική κάλυψη από ${fmt(inspection.verification.coverageGaps[0].from)} έως ${fmt(inspection.verification.coverageGaps[0].to)}.`
            : 'Οι περίοδοι ή οι όροι του Ιστορικού δεν επιβεβαιώθηκαν ως πλήρεις και χωρίς συγκρούσεις.';
    const code = legacy ? 'EMPLOYEE_SAVE_LEGACY_HISTORY_READ_ONLY' : 'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN';
    return Object.assign(new Error(`Η οριστική αποθήκευση σταμάτησε. ${detail} Δεν αποθηκεύτηκε καμία αλλαγή.\n` +
        '1. Ελέγξτε τις αναφερόμενες ημερομηνίες και τα υποχρεωτικά στοιχεία.\n' +
        '2. Για παλαιό προβληματικό Ιστορικό αποθηκεύστε μόνο ανεξάρτητα στοιχεία και ζητήστε τεκμηριωμένο έλεγχο από διαχειριστή.\n' +
        `Κωδικός αναφοράς: ${code}.`), { code, statusCode: 409, historyValidation: inspection });
}
function assertEmployeeHistorySaveClean(input) {
    const inspection = inspectEmployeeHistorySave(input);
    if (inspection.status !== 'CLEAN') throw historySaveFailure(inspection);
    return inspection;
}
function isVerifiedHistoryRetirement({ scope, currentEmployee, currentPatch, physicalPlan, diagnostics }) {
    if (diagnostics?.operation !== 'EMPLOYEE_HISTORY_SAFE_CORRECTION' || diagnostics.intent !== 'REMOVE_ROW' ||
        !diagnostics.planFingerprint || Object.keys(currentPatch).length || physicalPlan.rowsToInsert.length ||
        physicalPlan.rowsToDelete.length || physicalPlan.rowsToUpdate.length !== 1 ||
        physicalPlan.beforeRows.length !== physicalPlan.finalRows.length) return false;
    const { equal } = require('./employeeHistoryAutomaticReconstructionApplyContract');
    const update = physicalPlan.rowsToUpdate[0];
    const allowed = ['employment_history_canonical_status','employment_history_canonical_survivor_id','updatedAt'];
    if (Object.keys(update.patch).some(field => !allowed.includes(field)) ||
        update.patch.employment_history_canonical_status !== 'REDUNDANT_REFERENCED') return false;
    const survivor = require('./employeeHistoryCorrectionPolicyService').verifiedRedundantSurvivor({
        scope, currentEmployee, historyRows: physicalPlan.beforeRows, targetHistoryId: update.historyId });
    if (!survivor || String(update.patch.employment_history_canonical_survivor_id) !== String(survivor._id)) return false;
    return physicalPlan.beforeRows.every(before => {
        const after = physicalPlan.finalRows.find(row => String(row._id) === String(before._id));
        return after && equal(after, String(before._id) === String(update.historyId) ? { ...before, ...update.patch } : before);
    });
}
module.exports = { inspectEmployeeHistorySave, assertEmployeeHistorySaveClean, historySaveFailure, isVerifiedHistoryRetirement };
