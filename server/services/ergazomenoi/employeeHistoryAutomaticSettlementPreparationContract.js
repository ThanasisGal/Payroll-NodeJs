'use strict';

// Phase 2C: pure preparation only. A fingerprint is evidence of the reviewed
// snapshot, never authorization or a transferable capability to execute writes.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { SETTLEMENT_VERSION, planEmployeeHistoryAutomaticSettlement,
    verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { isInactiveHistoryRow, REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD,
    REDUNDANT_REFERENCED } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');

const PREPARATION_VERSION = 'employee-history-automatic-settlement-preparation:v1';
const PREFIX = 'EMPLOYEE_HISTORY_SETTLEMENT_PREPARATION_';
const INPUT_KEYS = new Set(['scope', 'employeeId', 'actorUserId', 'currentEmployee',
    'completeHistoryRows', 'protectedReferenceSummary', 'proposal', 'approval', 'now']);
const BUSINESS_FIELDS = new Set([...C.FIELD_GROUPS.TEMPORAL_SEMANTIC, ...C.PROFILE_FIELDS]);
const text = value => typeof value === 'string' && value.length > 0 && value.trim() === value;
const id = row => String(row._id);

function fail(reason) {
    const code = PREFIX + reason;
    throw Object.assign(new Error('Η προετοιμασία της τακτοποίησης σταμάτησε επειδή δεν επιβεβαιώθηκαν όλα τα στοιχεία της πρότασης. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή. 1. Ελέγξτε ξανά την πρόταση και τα στοιχεία του εργαζομένου. ' +
        '2. Αν το πρόβλημα παραμένει, ζητήστε βοήθεια από τον διαχειριστή. Κωδικός αναφοράς: ' + code + '.'),
    { code, statusCode: 409 });
}

function clone(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (value?._bsontype === 'ObjectId') return new value.constructor(value.toHexString());
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}

function validatedProposal(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) ||
        Object.keys(options).some(key => !INPUT_KEYS.has(key))) fail('INVALID_REQUEST');
    const { scope, employeeId, actorUserId, currentEmployee, completeHistoryRows,
        protectedReferenceSummary, proposal } = options;
    // There is deliberately no default actor, role, access mode or admin path.
    if (!text(actorUserId) || !/^[a-f0-9]{24}$/i.test(actorUserId) ||
        !text(employeeId) || !/^[a-f0-9]{24}$/i.test(employeeId) ||
        !scope || !A.equal(Object.keys(scope).sort(), [...C.SCOPE_FIELDS].sort()) ||
        !C.SCOPE_FIELDS.every(field => text(scope[field]) && currentEmployee?.[field] === scope[field]) ||
        String(currentEmployee?._id) !== employeeId) fail('IDENTITY_REQUIRED');
    if (!Array.isArray(completeHistoryRows) || !protectedReferenceSummary ||
        typeof protectedReferenceSummary !== 'object' || Array.isArray(protectedReferenceSummary) ||
        !proposal || proposal.version !== SETTLEMENT_VERSION || proposal.mode !== 'IN_MEMORY_ONLY' ||
        proposal.status !== 'CLEAN' || proposal.verification?.status !== 'CLEAN') fail('CLEAN_PROPOSAL_REQUIRED');
    const fresh = planEmployeeHistoryAutomaticSettlement({ scope, currentEmployee,
        completeHistoryRows, protectedReferenceSummary });
    if (fresh.status !== 'CLEAN' || !A.equal(fresh, proposal)) fail('PROPOSAL_CHANGED');
    const verification = verifyEmployeeHistoryAutomaticSettlement({ scope, currentEmployee,
        proposedRows: fresh.proposedRows, requiredHistoryRows: fresh.proposedRows });
    if (verification.status !== 'CLEAN') fail('VERIFICATION_FAILED');
    return fresh;
}

function buildEmployeeHistorySettlementApprovalFingerprint(options) {
    const proposal = validatedProposal(options);
    // Include complete typed documents, assumptions, retirements, reference
    // evidence AND reference fences; no informational fields are silently omitted.
    return A.hash({ version: PREPARATION_VERSION, actorUserId: options.actorUserId,
        employeeId: options.employeeId, scope: options.scope,
        currentEmployee: options.currentEmployee, historyBefore: A.ordered(options.completeHistoryRows),
        protectedReferenceSummary: options.protectedReferenceSummary, proposal });
}

function assertApprovedSettlement(options) {
    const fingerprint = buildEmployeeHistorySettlementApprovalFingerprint(options);
    const approval = options.approval;
    if (!approval || !A.equal(Object.keys(approval).sort(), ['confirmed', 'fingerprint']) ||
        approval.confirmed !== true || !A.tokenMatches(approval.fingerprint, fingerprint)) fail('APPROVAL_REQUIRED');
    return fingerprint;
}

function assertSettlementPhysicalPlan({ proposal, completeHistoryRows, protectedReferenceSummary,
    physicalPlan, expectedRows, now }) {
    if (!physicalPlan || !A.equal(Object.keys(physicalPlan).sort(),
        ['beforeRows', 'finalRows', 'rowsToDelete', 'rowsToInsert', 'rowsToUpdate']) ||
        !['beforeRows', 'finalRows', 'rowsToDelete', 'rowsToInsert', 'rowsToUpdate']
            .every(key => Array.isArray(physicalPlan[key])) ||
        physicalPlan.rowsToUpdate.some(item => !item || !item.patch ||
            !A.equal(Object.keys(item).sort(), ['historyId', 'patch'])) ||
        physicalPlan.rowsToDelete.some(item => !item ||
            !A.equal(Object.keys(item).sort(), ['historyId', 'survivingHistoryId']))) fail('UNEXPECTED_MUTATION');
    const before = new Map(completeHistoryRows.map(row => [id(row), row]));
    const expected = new Map(expectedRows.map(row => [id(row), row]));
    const updates = new Map(physicalPlan.rowsToUpdate.map(item => [item.historyId, item]));
    const deletions = new Map(proposal.redundantRows.filter(item =>
        item.disposition === 'EXCLUDE_FROM_ACTIVE_HISTORY').map(item => [item.historyId, item]));
    if (physicalPlan.rowsToInsert.length || expectedRows.some(row => !before.has(id(row))) ||
        expected.size !== expectedRows.length || updates.size !== physicalPlan.rowsToUpdate.length ||
        !A.equal(physicalPlan.beforeRows, completeHistoryRows) ||
        !A.equal(physicalPlan.rowsToDelete.map(item => item.historyId).sort(), [...deletions.keys()].sort())) {
        fail('UNEXPECTED_MUTATION');
    }
    for (const deletion of physicalPlan.rowsToDelete) {
        if (!before.has(deletion.historyId) || protectedReferenceSummary[deletion.historyId]?.length !== 0 ||
            isInactiveHistoryRow(before.get(deletion.historyId)) ||
            deletion.survivingHistoryId !== deletions.get(deletion.historyId)?.survivingHistoryId) {
            fail('PROTECTED_DELETE');
        }
    }
    for (const row of completeHistoryRows) {
        const target = expected.get(id(row));
        const update = updates.get(id(row));
        if (!target) {
            if (!deletions.has(id(row))) fail('UNEXPECTED_MUTATION');
            continue;
        }
        const retired = proposal.redundantRows.find(item => item.historyId === id(row) &&
            item.disposition === 'PRESERVE_REFERENCED');
        if (isInactiveHistoryRow(row) && (!A.equal(row, target) || update)) fail('PROTECTED_PAYLOAD');
        if (retired) {
            const { [REDUNDANT_STATUS_FIELD]: status, [REDUNDANT_SURVIVOR_FIELD]: survivor, ...payload } = target;
            if (status !== REDUNDANT_REFERENCED || String(survivor) !== retired.survivingHistoryId ||
                !A.equal(payload, row) || !expected.has(String(survivor))) fail('PROTECTED_PAYLOAD');
        }
        if (update) {
            const { updatedAt, ...patch } = update.patch;
            const allowed = retired ? new Set([REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD]) : BUSINESS_FIELDS;
            const previous = new Date(row.updatedAt).getTime();
            const revision = new Date(Math.max(now.getTime(), Number.isFinite(previous) ? previous + 1 : now.getTime()));
            if (!Object.keys(patch).length || Object.keys(patch).some(field => !allowed.has(field)) ||
                !A.equal(updatedAt, revision) || !A.equal({ ...row, ...patch }, target)) fail('UNEXPECTED_MUTATION');
        } else if (!A.equal(row, target)) fail('UNEXPECTED_MUTATION');
    }
    const finalRows = expectedRows.map(row => updates.has(id(row))
        ? { ...row, updatedAt: updates.get(id(row)).patch.updatedAt } : row);
    if ([...updates.keys()].some(key => !before.has(key) || !expected.has(key)) ||
        !A.equal(A.ordered(finalRows), A.ordered(physicalPlan.finalRows))) fail('UNEXPECTED_MUTATION');
}

module.exports = { PREPARATION_VERSION, PREFIX, clone, fail,
    buildEmployeeHistorySettlementApprovalFingerprint, assertApprovedSettlement, assertSettlementPhysicalPlan };
