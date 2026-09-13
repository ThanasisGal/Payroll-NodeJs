'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { positiveClassification } = require('./apasxoliseisStage3FingerprintService');
const { planCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService');
const { AUTOMATIC_INSPECTION, inspectAutomaticMaterialization } = require(
    './apasxoliseisWeeklyHrWorkflowStage2CompletionService');
const { buildWeeklyHrStage2BulkPreview } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService');

function text(value) { return String(value ?? '').trim(); }
function classificationLabel(value, row = {}) {
    const normalized = text(value).toUpperCase();
    if (normalized === 'REST_REPO' || normalized === 'ΑΝ') return 'Ρεπό';
    if (normalized === 'NON_WORK' || normalized === 'ΜΕ') return 'Μη εργασία';
    if (normalized === 'WORK' || normalized === 'ΕΡΓ') return 'Εργασία';
    if (normalized === 'POSSIBLE_LEAVE' ||
        text(row.kathgoria_adeias_apologistika).toUpperCase() === 'POSSIBLE_LEAVE') {
        return 'Πιθανή άδεια';
    }
    if (normalized === 'LEAVE') return 'Άδεια';
    if (normalized === 'SICKNESS') return 'Ασθένεια';
    if (normalized === 'ABSENCE') return 'Απουσία';
    return 'Χωρίς τελικό χαρακτηρισμό';
}
function employeeLabel(context = {}) {
    const code = text(context.scope?.employee_kodikos);
    const name = `${text(context.employee?.eponymo)} ${text(context.employee?.onoma)}`.trim();
    return name ? `${code} — ${name}` : code;
}
function automaticDetails(context, inspection) {
    return inspection.items.map((item) => {
        const intended = planCanonicalDailyClassification({ row: item.row,
            classification: item.classification });
        return { employee: employeeLabel(context), employee_kodikos:
            text(context.scope?.employee_kodikos), week_start: dateKeyUtc(context.scope?.week_start),
        week_end: dateKeyUtc(context.scope?.week_end), date: item.date,
        before: classificationLabel(positiveClassification(item.row), item.row),
        after: classificationLabel(intended.kathgoria_ergasias_apologistika, intended),
        safety_reason: 'Η αλλαγή προκύπτει μονοσήμαντα από τον ολοκληρωμένο εβδομαδιαίο έλεγχο.' };
    });
}
function pairDetails(context) {
    const proposal = context.preparedStage2Record?.current_proposal || {};
    const rowById = new Map((context.rows || []).map((row) => [text(row._id), row]));
    return ['source', 'target'].map((side) => proposal[side]).filter(Boolean).map((item) => ({
        employee: employeeLabel(context), employee_kodikos: text(context.scope?.employee_kodikos),
        week_start: dateKeyUtc(context.scope?.week_start),
        week_end: dateKeyUtc(context.scope?.week_end), date: dateKeyUtc(
            rowById.get(text(item.prodhlomena_oraria_id))?.hmeromhnia),
        before: classificationLabel(item.current_category),
        after: classificationLabel(item.proposed_values?.kathgoria_ergasias_apologistika),
        safety_reason: 'Η μεταφορά έχει μία μόνο ασφαλή εφαρμογή για τη συγκεκριμένη εβδομάδα.'
    }));
}
function buildWeeklyHrStage2BulkDetails({ contexts = [], cachedSeeds = [], page_size = 50 } = {}) {
    const seedByIdentity = new Map(cachedSeeds.map((seed) => [
        `${text(seed.employee_id)}|${dateKeyUtc(seed.week_start)}|${dateKeyUtc(seed.week_end)}`, seed]));
    const details = [];
    for (const context of contexts) {
        const key = `${text(context.scope?.employee_id)}|${dateKeyUtc(
            context.scope?.week_start)}|${dateKeyUtc(context.scope?.week_end)}`;
        const seed = seedByIdentity.get(key);
        const currentSafe = buildWeeklyHrStage2BulkPreview({ contexts: [context] }).safe_scope_ids[0];
        if (!seed || !currentSafe || currentSafe.scope_fingerprint !== seed.scope_fingerprint) {
            throw Object.assign(new Error('Τα στοιχεία έχουν αλλάξει από την τελευταία αναζήτηση.'),
                { code: 'STAGE2_INPUT_CHANGED', statusCode: 409 });
        }
        if (seed.bulk_kind === 'SAFE_AUTOMATIC_MATERIALIZATION') {
            const inspection = inspectAutomaticMaterialization(context);
            if (inspection.status !== AUTOMATIC_INSPECTION.READY_TO_MATERIALIZE) {
                throw Object.assign(new Error('Τα στοιχεία έχουν αλλάξει από την τελευταία αναζήτηση.'),
                    { code: 'STAGE2_INPUT_CHANGED', statusCode: 409 });
            }
            details.push(...automaticDetails(context, inspection));
        } else if (seed.bulk_kind === 'SAFE_PAIR_TRANSFER') details.push(...pairDetails(context));
    }
    return details.slice(0, Math.max(1, Math.min(50, Number(page_size) || 50)));
}

module.exports = { classificationLabel, buildWeeklyHrStage2BulkDetails };
