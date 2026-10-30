'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const OPERATION = 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION';
const APPLY_VERSION = 'employee-history-automatic-reconstruction-apply:v1';
const PREFIX = 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_';
const NO_OP_STATUSES = new Set(['NO_OP', 'NO_HISTORY', 'NO_ACTIVE_HISTORY']);
// This is only a fixed point of reconstruction, never a CLEAN certificate.
const isNoOp = plan => NO_OP_STATUSES.has(plan.status) ||
    (['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) && plan.rowDiffs.length === 0);
function historyCompletionStatus({ scope, currentEmployee, completeHistoryRows, plan } = {}) {
    if (!scope || !currentEmployee || !Array.isArray(completeHistoryRows) || plan?.status === 'BLOCKED') return 'UNVERIFIED';
    try {
        const { CANONICAL_STATUSES, canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
        const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
        const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows: completeHistoryRows });
        const gaps = employeeHistoryCoverageGaps({ currentEmployee, historyRows: completeHistoryRows });
        const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
        const currentHire = T.day(currentEmployee[C.HIRE])?.getTime();
        const terminal = canonical.canonicalRows?.filter(row =>
            T.day(row[C.HIRE])?.getTime() === currentHire && T.day(row[C.START]))
            .sort((a, b) => T.day(a[C.START]) - T.day(b[C.START])).at(-1);
        // Contract expiry bounds required coverage; it cannot certify that the
        // current open/unknown terms end agrees with a finite History period.
        // Keep this completion check separate from the calculation coverage guard.
        if (!T.day(currentEmployee[C.DEPARTURE]) && T.day(terminal?.[C.END]) &&
            !T.day(currentEmployee[C.END])) return 'REVIEW_REQUIRED';
        return canonical.status === CANONICAL_STATUSES.CLEAN && !canonical.cleanupRequired &&
            canonical.idempotent && gaps.length === 0 ? 'CLEAN' : 'REVIEW_REQUIRED';
    } catch {
        // A failed independent check cannot certify completion. It does not
        // authorize writes or alter the existing maintenance execution policy.
        return 'UNVERIFIED';
    }
}
function historyCompletionMessage(historyStatus, applied = false) {
    if (historyStatus === 'CLEAN') return applied
        ? 'Οι εγκεκριμένες αλλαγές αποθηκεύτηκαν και το Ιστορικό ελέγχθηκε ως πλήρως τακτοποιημένο.'
        : 'Το Ιστορικό είναι ήδη τακτοποιημένο.';
    return (applied ? 'Οι εγκεκριμένες αλλαγές ανακατασκευής αποθηκεύτηκαν. '
        : 'Ο έλεγχος ανακατασκευής δεν προτείνει άλλες αλλαγές. Δεν αποθηκεύτηκε καμία αλλαγή. ') +
        'Το Ιστορικό εξακολουθεί να χρειάζεται έλεγχο περιόδων ή κάλυψης.\n' +
        '1. Ανοίξτε τον «Έλεγχο / Διόρθωση» του Ιστορικού.\n' +
        '2. Αν δεν μπορείτε να συνεχίσετε, επικοινωνήστε με τον διαχειριστή.\n' +
        'Κωδικός αναφοράς: ΙΣΤ-ΟΛΟΚΛ-01.';
}
const ALLOWED_FIELDS = new Set([...C.FIELD_GROUPS.TEMPORAL_SEMANTIC, ...C.PROFILE_FIELDS]);
const TOKEN_IGNORED = new Set(['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'updatedAt', 'history_reference_fence', 'employee_profile_mutation_sequence', '__v']);

// Typed, deterministic comparison: missing != null, BSON IDs stay BSON IDs.
function stable(value) {
    if (value === undefined) return { $missing: true };
    if (value instanceof Date) return { $date: Number.isNaN(value.getTime()) ? 'INVALID' : value.toISOString() };
    if (value?._bsontype === 'ObjectId') return { $oid: value.toHexString() };
    if (Buffer.isBuffer(value)) return { $binary: value.toString('base64') };
    if (Array.isArray(value)) return value.map(stable);
    if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
const stringify = value => JSON.stringify(stable(value));
const equal = (a, b) => stringify(a) === stringify(b);
const hash = value => createHash('sha256').update(stringify(value)).digest('base64url');
const identity = row => String(row._id);
const ordered = rows => [...rows].sort((a, b) => identity(a).localeCompare(identity(b)));
function failure(suffix, statusCode = 409) {
    return Object.assign(new Error(PREFIX + suffix), { code: PREFIX + suffix, statusCode });
}
function buildAutomaticReconstructionPreviewToken({ scope, currentEmployee, completeHistoryRows, plan, actorUserId = null }) {
    const project = record => Object.fromEntries(Object.entries(record).filter(([field]) => !TOKEN_IGNORED.has(field)));
    // Public opaque digest, not a client-side execution plan or authorization.
    // Informational schedule dates cannot alter either evidence or token identity.
    return hash({ operation: APPLY_VERSION, engine: C.VERSION, scope, actorUserId: actorUserId == null ? null : String(actorUserId),
        semanticFingerprint: plan.semanticFingerprint,
        employee: project(currentEmployee), history: ordered(completeHistoryRows).map(project),
        result: { version: plan.version, status: plan.status, rowDiffs: plan.rowDiffs,
            logicalPeriods: plan.logicalPeriods, assumptions: plan.assumptions, warnings: plan.warnings } });
}
function tokenMatches(submitted, actual) {
    return typeof submitted === 'string' && /^[A-Za-z0-9_-]{43}$/.test(submitted) &&
        timingSafeEqual(Buffer.from(submitted), Buffer.from(actual));
}
function buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows, now = new Date() }) {
    if (plan.version !== C.VERSION || !['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) || !plan.rowDiffs.length) {
        throw failure('BOUNDARY_FAILED');
    }
    const before = new Map(completeHistoryRows.map(row => [identity(row), row]));
    const proposed = new Map(plan.proposedRows.map(row => [identity(row), row]));
    if (before.size !== completeHistoryRows.length || proposed.size !== before.size ||
        plan.proposedRows.length !== before.size || [...before.keys()].some(id => !proposed.has(id))) {
        throw failure('BOUNDARY_FAILED');
    }
    const patches = new Map();
    for (const diff of plan.rowDiffs) {
        const id = String(diff.historyId), original = before.get(id);
        if (!original || !ALLOWED_FIELDS.has(diff.field) || diff.after === undefined ||
            (diff.beforeMissing !== (original[diff.field] === undefined)) ||
            !equal(diff.before, original[diff.field] === undefined ? null : original[diff.field]) ||
            equal(original[diff.field], diff.after) || !equal(proposed.get(id)[diff.field], diff.after)) {
            throw failure('BOUNDARY_FAILED');
        }
        if (!patches.has(id)) patches.set(id, {});
        const patch = patches.get(id);
        if (Object.hasOwn(patch, diff.field)) throw failure('BOUNDARY_FAILED');
        patch[diff.field] = diff.after;
    }
    // Full-document parity catches extra fields, inserts, deletes and protected
    // metadata changes hidden outside rowDiffs (including schedule dates).
    for (const [id, row] of before) {
        if (!equal({ ...row, ...patches.get(id) }, proposed.get(id))) throw failure('BOUNDARY_FAILED');
    }
    const rowsToUpdate = [...patches].map(([historyId, patch]) => {
        const previous = new Date(before.get(historyId).updatedAt).getTime();
        const updatedAt = new Date(Math.max(now.getTime(), Number.isFinite(previous) ? previous + 1 : 0));
        return { historyId, patch: { ...patch, updatedAt } };
    });
    const byId = new Map(rowsToUpdate.map(item => [item.historyId, item.patch]));
    const expectedRows = completeHistoryRows.map(row => ({ ...row, ...byId.get(identity(row)) }));
    const result = { rowsToUpdate, expectedRows };
    assertAutomaticReconstructionBoundary({ plan, completeHistoryRows, physicalPlan: result });
    return result;
}
function assertAutomaticReconstructionBoundary({ plan, completeHistoryRows, physicalPlan }) {
    const fail = () => { throw failure('BOUNDARY_FAILED'); };
    if (plan.version !== C.VERSION || !['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) || !plan.rowDiffs.length ||
        !equal(Object.keys(physicalPlan).sort(), ['expectedRows', 'rowsToUpdate'])) fail();
    const originals = new Map(completeHistoryRows.map(row => [identity(row), row]));
    if (originals.size !== completeHistoryRows.length) fail();
    const diffs = new Map();
    for (const diff of plan.rowDiffs) {
        const id = String(diff.historyId);
        const original = originals.get(id);
        if (!original || !ALLOWED_FIELDS.has(diff.field) || diff.after === undefined ||
            diff.beforeMissing !== (original[diff.field] === undefined) ||
            !equal(diff.before, original[diff.field] === undefined ? null : original[diff.field]) ||
            equal(original[diff.field], diff.after)) fail();
        if (!diffs.has(id)) diffs.set(id, {});
        if (Object.hasOwn(diffs.get(id), diff.field)) fail();
        diffs.get(id)[diff.field] = diff.after;
    }
    const proposed = completeHistoryRows.map(row => ({ ...row, ...diffs.get(identity(row)) }));
    if (!equal(ordered(proposed), ordered(plan.proposedRows))) fail();
    const updates = new Map(physicalPlan.rowsToUpdate.map(row => [row.historyId, row]));
    if (updates.size !== physicalPlan.rowsToUpdate.length || !equal([...updates.keys()].sort(), [...diffs.keys()].sort())) fail();
    for (const [id, { patch, ...metadata }] of updates) {
        if (!equal(metadata, { historyId: id }) || !(patch.updatedAt instanceof Date) || !Number.isFinite(patch.updatedAt.getTime())) fail();
        const { updatedAt, ...businessPatch } = patch;
        if (!equal(businessPatch, diffs.get(id))) fail();
    }
    const expected = completeHistoryRows.map(row => ({ ...row, ...updates.get(identity(row))?.patch }));
    if (!equal(ordered(expected), ordered(physicalPlan.expectedRows))) fail();
}
module.exports = { OPERATION, APPLY_VERSION, PREFIX, NO_OP_STATUSES, isNoOp, historyCompletionStatus, historyCompletionMessage, stringify, equal, hash, ordered,
    failure, tokenMatches, buildAutomaticReconstructionPreviewToken,
    buildAutomaticReconstructionPhysicalPlan, assertAutomaticReconstructionBoundary };
