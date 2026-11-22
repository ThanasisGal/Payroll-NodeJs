'use strict';

// PR406: an immutable *logical* period boundary created by a signed, committed
// atomic change. The existing physical History document stays byte-for-byte
// unchanged. This is NOT a legacy approval nor a global CLEAN certificate.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const OPERATION = 'EMPLOYEE_APPROVED_HISTORY_ATOMIC_MAINTENANCE';
const WRITER_VERSION = 'employee-approved-atomic-maintenance:v1';
const VERSION = 'employee-approved-immutable-boundary:v1';
const SHA = row => A.hash(Object.fromEntries(Object.entries(row || {})
    .filter(([field]) => field !== 'history_reference_fence')));
const id = row => String(row?._id || '');
const day = value => {
    if (value == null || value === '') return null;
    const date = new Date(value);
    return Number.isFinite(+date) ? date.toISOString().slice(0, 10) : null;
};
function yesterday(date) {
    const d = new Date(date + 'T00:00:00.000Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== date) throw invalid('DATE');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function invalid(reason) {
    return Object.assign(new Error('EMPLOYEE_APPROVED_ATOMIC_BOUNDARY_' + reason), {
        code:'EMPLOYEE_APPROVED_ATOMIC_BOUNDARY_' + reason, statusCode:409 });
}
function stableSuccessor(row) {
    return { _id:id(row),team:row?.team,company_kod:row?.company_kod,
        kodikos:row?.kodikos, hire:day(row?.[C.HIRE]), start:day(row?.[C.START]) };
}
function identityMatches(row, scope) {
    return row && ['team','company_kod','kodikos'].every(k => row[k] === scope[k]);
}
// `businessPrior` is the independently VERIFIED legacy approval edition, if
// there is one. `prior` always remains the untouched persisted source document.
// This receipt binds both provenance chains, never replaces either one.
function receipt({ scope, currentEmployee, prior, successor, effectiveFrom,
    businessPrior = prior, approvedEdition = null }) {
    const end = yesterday(effectiveFrom);
    if (approvedEdition !== null && (typeof approvedEdition !== 'object' ||
        Array.isArray(approvedEdition) ||
        Object.keys(approvedEdition).sort().join(',') !==
            'approvalAuditId,approvedContentHash,editionFingerprint' ||
        ![approvedEdition.approvalAuditId, approvedEdition.approvedContentHash,
          approvedEdition.editionFingerprint].every(v => typeof v === 'string' && v.length >= 16) ||
        SHA(businessPrior) !== approvedEdition.editionFingerprint)) throw invalid('APPROVED_PROOF');
    if (!approvedEdition && SHA(businessPrior) !== SHA(prior)) throw invalid('UNVERIFIED_EDITION');
    if (!currentEmployee || !identityMatches(currentEmployee,scope) ||
        !identityMatches(prior,scope) || !identityMatches(successor,scope) ||
        !id(prior) || !id(successor) || id(prior) === id(successor) ||
        !identityMatches(businessPrior,scope) || id(businessPrior) !== id(prior) ||
        !day(businessPrior[C.START]) || day(businessPrior[C.START]) >= effectiveFrom ||
        day(businessPrior[C.END]) ||
        day(successor[C.START]) !== effectiveFrom ||
        day(businessPrior[C.HIRE]) !== day(prior[C.HIRE]) ||
        day(prior[C.HIRE]) !== day(successor[C.HIRE]) ||
        day(currentEmployee[C.HIRE]) !== day(prior[C.HIRE]) ||
        day(successor[C.END]) || successor.afora_allagh_oron_ergasias !== true)
        throw invalid('RECEIPT');
    return Object.freeze({ version:VERSION, priorHistoryId:id(prior), successorHistoryId:id(successor),
        effectiveFrom, priorEffectiveTo:end, priorFingerprint:SHA(prior),
        successorIdentityFingerprint:A.hash(stableSuccessor(successor)),
        ...(approvedEdition ? { approvedEdition:{...approvedEdition} } : {}) });
}
function committedBoundary(audit) {
    const d=audit?.diagnostics;
    if(audit?.mutationSource !== OPERATION || d?.version !== WRITER_VERSION ||
        d?.operation !== 'NEW_CHANGE') return false;
    // A completed atomic write that lacks the independent receipt is unsafe.
    if(d?.outcome !== 'COMMITTED' || d?.boundary?.version !== VERSION)
        throw invalid('MISSING_OR_UNVERIFIED_RECEIPT');
    return true;
}
// `verifiedApprovals` must contain ONLY approvals that were independently
// checked by `boundDecision` against their current physical source. Never pass
// raw audit query results here as proof of an edition.
function project({ scope, currentEmployee, physicalRows, historyRows,
    atomicAudits = [], verifiedApprovals = [] }) {
    if(!Array.isArray(physicalRows) || !Array.isArray(historyRows) || !Array.isArray(atomicAudits) || !Array.isArray(verifiedApprovals))
        throw invalid('CONTEXT');
    // Old proposal readers do not carry atomic receipts; they must remain
    // byte-for-byte compatible with their existing read-only projection.
    if (!atomicAudits.length) return {historyRows,boundaries:[],successors:[]};
    if (!scope || !currentEmployee) throw invalid('CONTEXT');
    const raw = new Map(physicalRows.map(row => [id(row),row]));
    const virtual = new Map(historyRows.map(row => [id(row),row]));
    const closings = new Map(), successors = new Set();
    for(const audit of atomicAudits) {
        if(!committedBoundary(audit)) continue;
        const d=audit.diagnostics, b=d.boundary;
        const prior=raw.get(b.priorHistoryId), successor=raw.get(b.successorHistoryId);
        const auditScope=audit.employeeScope;
        if(!['team','company_kod','kodikos'].every(k => auditScope?.[k] === scope[k]) ||
            String(auditScope?.employee_id || '') !== id(currentEmployee) ||
            !d.actorUserId || d.insertedHistoryId !== b.successorHistoryId ||
            d.fromHistoryId !== b.priorHistoryId || d.effectiveFrom !== b.effectiveFrom ||
            !prior || !successor || !virtual.has(b.priorHistoryId) ||
            closings.has(b.priorHistoryId) || successors.has(b.successorHistoryId) ||
            !Array.isArray(audit.historyBefore) || !Array.isArray(audit.historyAfter))
            throw invalid('SCOPE_OR_CHAIN');
        const storedBefore = audit.historyBefore.find(row => id(row) === b.priorHistoryId);
        const storedAfter = audit.historyAfter.find(row => id(row) === b.priorHistoryId);
        const storedNext = audit.historyAfter.find(row => id(row) === b.successorHistoryId);
        if(!storedBefore || !storedAfter || !storedNext ||
            SHA(storedBefore) !== SHA(prior) || SHA(storedAfter) !== SHA(prior) ||
            A.hash(stableSuccessor(storedNext)) !== A.hash(stableSuccessor(successor)))
            throw invalid('PERSISTED_PROVENANCE');
        const businessPrior=virtual.get(b.priorHistoryId);
        // A different business edition is legal ONLY when the atomic receipt
        // binds the exact independently VERIFIED legacy approval. A forged,
        // revoked or reissued approval cannot be silently substituted.
        if(b.approvedEdition) {
            const approval=verifiedApprovals.find(audit =>
                id(audit) === b.approvedEdition.approvalAuditId &&
                audit?.diagnostics?.targetHistoryId === b.priorHistoryId &&
                audit?.diagnostics?.rowApproval?.approvedContentHash ===
                    b.approvedEdition.approvedContentHash &&
                SHA(audit.diagnostics.rowApproval.approvedContent) ===
                    b.approvedEdition.editionFingerprint);
            if(!approval || SHA(businessPrior) !== b.approvedEdition.editionFingerprint)
                throw invalid('APPROVED_EDITION_MISSING_OR_CHANGED');
        } else if(SHA(businessPrior) !== SHA(prior)) {
            throw invalid('UNBOUND_APPROVED_EDITION');
        }
        const calculated=receipt({scope,currentEmployee,prior,successor,
            effectiveFrom:b.effectiveFrom,businessPrior,
            approvedEdition:b.approvedEdition || null});
        if(!A.equal(b,calculated)) throw invalid('SOURCE_CHANGED_OR_APPROVED_VERSION');
        closings.set(b.priorHistoryId,{ priorHistoryId:b.priorHistoryId,
            successorHistoryId:b.successorHistoryId, effectiveFrom:b.effectiveFrom,
            priorEffectiveTo:b.priorEffectiveTo });
        successors.add(b.successorHistoryId);
    }
    const projected = historyRows.map(row => {
        const b=closings.get(id(row));
        return b ? { ...row, [C.END]:new Date(b.priorEffectiveTo + 'T00:00:00.000Z') } : row;
    });
    return { historyRows:projected, boundaries:[...closings.values()], successors:[...successors] };
}
module.exports = { VERSION, OPERATION, WRITER_VERSION, invalid, receipt, project, committedBoundary, fingerprint:SHA };
