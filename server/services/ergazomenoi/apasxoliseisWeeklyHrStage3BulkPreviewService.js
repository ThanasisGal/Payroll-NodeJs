'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { stableStringify, buildStage3InputFingerprint,
    positiveClassification } = require('./apasxoliseisStage3FingerprintService');
const { assertDecisionAllowed } = require(
    './apasxoliseisWeeklyHrWorkflowStage3ResolutionService'
);
const { findStage1PeriodSlice } = require('./apasxoliseisStage1PeriodSliceService');
const { assertHrSelectableLeaveCategory } = require(
    './apasxoliseisHrLeaveCategoryPolicyService'
);

const MAX_STAGE3_BULK_PREVIEW_ITEMS = 100;
const PREVIEW_LOAD_CONCURRENCY = 8;
const ALLOWED_CLASSIFICATIONS = new Set(['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK']);
const COMMAND_FIELDS = new Set([
    'ypokatasthma', 'period_start', 'period_end', 'final_classification',
    'leave_category', 'items'
]);
const ITEM_FIELDS = new Set([
    'employee_id', 'employee_kodikos', 'week_start', 'week_end', 'row_id',
    'decision_date', 'expected_input_fingerprint', 'expected_stage3_version'
]);

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function text(value) { return String(value ?? '').trim(); }
function date(value, field) {
    const normalized = dateKeyUtc(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        fail('INVALID_STAGE3_BULK_DATE', `Μη έγκυρη ημερομηνία στο πεδίο ${field}.`);
    }
    return normalized;
}
function fingerprint(value, field) {
    const normalized = text(value).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
        fail('INVALID_STAGE3_BULK_FINGERPRINT', `Μη έγκυρο fingerprint στο πεδίο ${field}.`);
    }
    return normalized;
}
function strictFields(value, allowed, code, message) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some((field) => !allowed.has(field))) fail(code, message);
}
function normalizeClassification(value) {
    const normalized = text(value).toUpperCase();
    if (!ALLOWED_CLASSIFICATIONS.has(normalized)) fail('INVALID_STAGE3_CLASSIFICATION',
        'Μη έγκυρος τελικός χαρακτηρισμός Stage 3.');
    return normalized;
}
function normalizeLeaveCategory(classification, value) {
    const normalized = text(value);
    if (classification !== 'LEAVE') return '';
    if (!normalized) fail('LEAVE_CATEGORY_REQUIRED', 'Η κατηγορία άδειας είναι υποχρεωτική.');
    assertHrSelectableLeaveCategory(normalized);
    return normalized;
}
function normalizeItem(item, index) {
    strictFields(item, ITEM_FIELDS, 'STAGE3_BULK_ITEM_FIELDS_NOT_ALLOWED',
        `Η επιλεγμένη εγγραφή ${index + 1} περιέχει μη επιτρεπτά πεδία.`);
    const employeeId = text(item.employee_id);
    const rowId = text(item.row_id);
    const base = { employee_id: employeeId,
        employee_kodikos: text(item.employee_kodikos),
        week_start: text(item.week_start), week_end: text(item.week_end),
        row_id: rowId, decision_date: text(item.decision_date),
        expected_input_fingerprint: text(item.expected_input_fingerprint).toLowerCase(),
        expected_stage3_version: Number(item.expected_stage3_version) };
    try {
        if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(rowId)) {
            fail('INVALID_STAGE3_BULK_ROW_ID',
                `Η επιλεγμένη εγγραφή ${index + 1} δεν έχει έγκυρα αναγνωριστικά.`);
        }
        const expectedVersion = Number(item.expected_stage3_version);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
            fail('INVALID_STAGE3_VERSION',
                `Η επιλεγμένη εγγραφή ${index + 1} δεν έχει έγκυρη έκδοση Stage 3.`);
        }
        const weekStart = date(item.week_start, 'week_start');
        const weekEnd = date(item.week_end, 'week_end');
        const decisionDate = date(item.decision_date, 'decision_date');
        if (weekStart > weekEnd || decisionDate < weekStart || decisionDate > weekEnd) {
            fail('INVALID_STAGE3_BULK_WEEK_SCOPE',
                `Η επιλεγμένη εγγραφή ${index + 1} δεν ανήκει στο δηλωμένο εβδομαδιαίο πλαίσιο.`);
        }
        return Object.freeze({ ...base, week_start: weekStart, week_end: weekEnd,
            decision_date: decisionDate,
            expected_input_fingerprint: fingerprint(item.expected_input_fingerprint,
                'expected_input_fingerprint'), expected_stage3_version: expectedVersion });
    } catch (error) {
        return Object.freeze({ ...base, input_error: error });
    }
}
function normalizeStage3BulkPreviewCommand(command = {}) {
    strictFields(command, COMMAND_FIELDS, 'STAGE3_BULK_FIELDS_NOT_ALLOWED',
        'Το αίτημα μαζικής προεπισκόπησης Stage 3 περιέχει μη επιτρεπτά πεδία.');
    const ypokatasthma = text(command.ypokatasthma);
    if (!ypokatasthma) fail('STAGE3_BULK_BRANCH_REQUIRED', 'Το υποκατάστημα είναι υποχρεωτικό.');
    const periodStart = date(command.period_start, 'period_start');
    const periodEnd = date(command.period_end, 'period_end');
    if (periodStart > periodEnd) fail('INVALID_STAGE3_BULK_PERIOD',
        'Τα όρια της περιόδου δεν είναι έγκυρα.');
    const classification = normalizeClassification(command.final_classification);
    const leaveCategory = normalizeLeaveCategory(classification, command.leave_category);
    if (!Array.isArray(command.items) || command.items.length === 0) {
        fail('STAGE3_BULK_ITEMS_REQUIRED', 'Δεν επιλέχθηκαν εγγραφές Stage 3.');
    }
    if (command.items.length > MAX_STAGE3_BULK_PREVIEW_ITEMS) {
        fail('STAGE3_BULK_LIMIT_EXCEEDED',
            `Επιτρέπονται έως ${MAX_STAGE3_BULK_PREVIEW_ITEMS} επιλεγμένες εγγραφές.`);
    }
    const items = command.items.map(normalizeItem);
    const identities = new Set();
    for (const item of items) {
        if (item.input_error) continue;
        const identity = `${item.row_id}|${item.decision_date}`;
        if (identities.has(identity)) fail('STAGE3_BULK_DUPLICATE_ITEM',
            'Η ίδια ημερήσια εγγραφή έχει επιλεγεί περισσότερες από μία φορές.');
        identities.add(identity);
    }
    return Object.freeze({ ypokatasthma, period_start: periodStart, period_end: periodEnd,
        final_classification: classification, leave_category: leaveCategory,
        items: Object.freeze(items) });
}

function stage1CurrentState(context = {}) {
    const current = context.workflowState;
    const sliceAttestation = context.upstream?.stage1_attestation_scope === 'PERIOD_SLICE';
    const slice = sliceAttestation ? findStage1PeriodSlice(current?.stage1,
        context.upstream?.stage1_period_start, context.upstream?.stage1_period_end) : null;
    if (!current || (sliceAttestation ? slice?.status !== 'COMPLETED'
        : current.stage1?.status !== 'COMPLETED')) fail('STAGE3_UPSTREAM_NOT_COMPLETED',
        'Το Στάδιο 1 δεν είναι ολοκληρωμένο για το εφαρμοστέο πλαίσιο.', 409);
    const effective = text(sliceAttestation
        ? slice.effective_fingerprint || slice.completion_fingerprint
        : current.stage1.effective_fingerprint || current.stage1.completion_fingerprint);
    const authoritative = text(context.upstream?.stage1_current_fingerprint ||
        context.upstream?.stage1_fingerprint);
    if (!effective || effective !== authoritative) fail('STAGE3_UPSTREAM_STAGE1_STALE',
        'Τα δεδομένα του Σταδίου 1 άλλαξαν. Κάντε νέα Αναζήτηση και επανελέγξτε την εβδομάδα.', 409);
}
function assertAuthoritativePreviewItem({ context, item, command }) {
    if (text(context.scope?.ypokatasthma) !== command.ypokatasthma ||
        dateKeyUtc(context.scope?.week_start) !== item.week_start ||
        dateKeyUtc(context.scope?.week_end) !== item.week_end ||
        String(context.scope?.employee_id || '') !== item.employee_id ||
        String(context.row?._id || '') !== item.row_id ||
        dateKeyUtc(context.row?.hmeromhnia) !== item.decision_date) {
        fail('STAGE3_ROW_SCOPE_MISMATCH',
            'Η ημερήσια εγγραφή δεν ανήκει στο επιλεγμένο εβδομαδιαίο πλαίσιο.', 409);
    }
    if (item.employee_kodikos && text(context.scope?.employee_kodikos) !==
        item.employee_kodikos) fail('STAGE3_EMPLOYEE_CODE_MISMATCH',
        'Ο κωδικός εργαζομένου δεν συμφωνεί με την επιλεγμένη εγγραφή.', 409);
    const dateScope = context.lifecycle?.employment_date_scope || {};
    if ((dateScope.context_only_dates || []).includes(item.decision_date) ||
        !(dateScope.authoritative_date_set || []).includes(item.decision_date)) {
        fail('STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD',
            'Η ημέρα ανήκει σε άλλη περίοδο και εμφανίζεται μόνο για πλαίσιο.', 409);
    }
    assertDecisionAllowed(context, command.final_classification);
    const pending = (context.lifecycle?.stages?.stage3?.pending_items || []).find((candidate) =>
        String(candidate.row_id) === item.row_id && candidate.date === item.decision_date);
    if (!pending || !(pending.allowed_classifications || [])
        .includes(command.final_classification)) fail('STAGE3_CLASSIFICATION_NOT_ALLOWED',
        'Ο κοινός χαρακτηρισμός δεν επιτρέπεται για αυτή την εγγραφή.', 409);
    const currentFingerprint = buildStage3InputFingerprint(context).fingerprint;
    if (currentFingerprint !== item.expected_input_fingerprint) fail('STAGE3_INPUT_CHANGED',
        'Κάντε νέα Αναζήτηση και δοκιμάστε ξανά.', 409);
    if (Number(context.upstream?.stage3_version || 0) !== item.expected_stage3_version) {
        fail('STAGE3_VERSION_CONFLICT',
            'Η έκδοση του Σταδίου 3 άλλαξε. Κάντε νέα Αναζήτηση.', 409);
    }
    stage1CurrentState(context);
    return pending;
}
function publicFailure(item, error) {
    return { row_id: item.row_id, employee_kodikos: item.employee_kodikos,
        decision_date: item.decision_date,
        code: text(error?.code) || 'STAGE3_BULK_ITEM_NOT_ELIGIBLE',
        message: error?.statusCode ? text(error.message) :
            'Η εγγραφή δεν μπορεί να ελεγχθεί αυτή τη στιγμή. Κάντε νέα Αναζήτηση.' };
}
async function mapWithConcurrency(items, worker, limit = PREVIEW_LOAD_CONCURRENCY) {
    const results = new Array(items.length); let cursor = 0;
    async function run() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}
function canonicalFingerprintCommand({ command, requestScope, readyItems }) {
    return { contract: 'weekly-hr-stage3-bulk-preview:v1',
        scope: { team: text(requestScope.team), company_kod: text(requestScope.company_kod),
            ypokatasthma: command.ypokatasthma, period_start: command.period_start,
            period_end: command.period_end }, final_classification: command.final_classification,
        leave_category: command.leave_category,
        items: readyItems.map((item) => ({ employee_id: item.employee_id,
            week_start: item.week_start, week_end: item.week_end, row_id: item.row_id,
            decision_date: item.decision_date,
            expected_input_fingerprint: item.expected_input_fingerprint,
            expected_stage3_version: item.expected_stage3_version }))
            .sort((a, b) => `${a.employee_id}|${a.week_start}|${a.decision_date}|${a.row_id}`
                .localeCompare(`${b.employee_id}|${b.week_start}|${b.decision_date}|${b.row_id}`)) };
}
async function buildWeeklyHrStage3BulkPreview({ command: rawCommand, requestScope = {},
    loadAuthoritativeContext, leaveCategoryLabel = '' } = {}) {
    if (typeof loadAuthoritativeContext !== 'function') fail(
        'STAGE3_BULK_CONTEXT_LOADER_REQUIRED',
        'Δεν είναι διαθέσιμη η ασφαλής προεπισκόπηση Stage 3.', 503);
    const command = normalizeStage3BulkPreviewCommand(rawCommand);
    const results = await mapWithConcurrency(command.items, async (item) => {
        try {
            if (item.input_error) throw item.input_error;
            const context = await loadAuthoritativeContext(item, command);
            assertAuthoritativePreviewItem({ context, item, command });
            return { valid: true, item: { ...item,
                employee_kodikos: text(context.scope?.employee_kodikos) || item.employee_kodikos,
                employee_name: text(context.employee_name), status: 'READY',
                before: positiveClassification(context.row) || 'UNCLASSIFIED',
                after: command.final_classification } };
        } catch (error) {
            return { valid: false, failure: publicFailure(item, error) };
        }
    });
    const items = results.filter((result) => result.valid).map((result) => result.item);
    const invalidItems = results.filter((result) => !result.valid).map((result) => result.failure);
    const canApply = invalidItems.length === 0;
    const previewFingerprint = canApply ? crypto.createHash('sha256').update(stableStringify(
        canonicalFingerprintCommand({ command, requestScope, readyItems: items })
    )).digest('hex') : '';
    return { can_apply: canApply, selected_count: command.items.length,
        employee_count: new Set(items.map((item) => item.employee_id)).size,
        classification: command.final_classification,
        leave_category: command.final_classification === 'LEAVE'
            ? { value: command.leave_category,
                label: text(leaveCategoryLabel) || command.leave_category } : null,
        preview_fingerprint: previewFingerprint, items, invalid_items: invalidItems };
}

module.exports = { MAX_STAGE3_BULK_PREVIEW_ITEMS, PREVIEW_LOAD_CONCURRENCY,
    normalizeStage3BulkPreviewCommand, assertAuthoritativePreviewItem,
    canonicalFingerprintCommand, buildWeeklyHrStage3BulkPreview };
