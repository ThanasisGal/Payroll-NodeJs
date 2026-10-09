'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const OPERATION = 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION';
const APPLY_VERSION = 'employee-history-automatic-reconstruction-apply:v1';
const PREFIX = 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_';
const NO_OP_STATUSES = new Set(['NO_OP', 'NO_HISTORY', 'NO_ACTIVE_HISTORY']);
const isNoOp = plan => NO_OP_STATUSES.has(plan.status) ||
    (['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status) && plan.rowDiffs.length === 0);
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
function buildAutomaticReconstructionPreviewToken({ scope, currentEmployee, completeHistoryRows, plan }) {
    const project = record => Object.fromEntries(Object.entries(record).filter(([field]) => !TOKEN_IGNORED.has(field)));
    // Public opaque digest, not a client-side execution plan or authorization.
    // Informational schedule dates cannot alter either evidence or token identity.
    return hash({ operation: APPLY_VERSION, engine: C.VERSION, scope,
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
module.exports = { OPERATION, APPLY_VERSION, PREFIX, NO_OP_STATUSES, isNoOp, stringify, equal, hash, ordered,
    failure, tokenMatches, buildAutomaticReconstructionPreviewToken,
    buildAutomaticReconstructionPhysicalPlan, assertAutomaticReconstructionBoundary };
