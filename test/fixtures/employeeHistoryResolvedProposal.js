'use strict';

// Synthetic, in-memory committed receipt. No application flag, database or URI.
const assert = require('node:assert/strict');
const F = require('./employee0002HistoryProposalFixture');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const Row = require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService');

function resolvedProposalFixture({ independent = true } = {}) {
    const data = F.employee0002HistoryProposalFixture({ datedInitialProfile: false, reviewRequired: false });
    delete data.completeHistoryRows[0][C.START];
    delete data.completeHistoryRows[0][C.END];
    data.completeHistoryRows[1].aa_eggrafhs = '0003';
    data.completeHistoryRows[2].aa_eggrafhs = '0002';
    if (independent) delete data.completeHistoryRows[1].krathsh_01;
    data.protectedReferenceSummary[String(data.completeHistoryRows[0]._id)] = Array.from({ length: 7 }, (_, i) => ({
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: `synthetic-protected-${i}`,
        frozen_snapshot: { finalized: true, amount: 1234.56, minutes: 480, source: data.completeHistoryRows[0]._id }
    }));
    return data;
}

function approveSyntheticEdition(data, explicit = { [C.START]: new Date('2026-02-02'), [C.END]: new Date('2026-03-31') },
    { n = 1, mode = 'CORRECTION_EDITION', previous } = {}) {
    const original = structuredClone(data.completeHistoryRows[0]);
    const reviewedOriginal = structuredClone(previous?.diagnostics.rowApproval.approvedContent || original);
    const candidate = { ...reviewedOriginal, ...explicit };
    const actorUserId = '630000000000000000000001';
    const audit = { _id: `6500000000000000${String(n).padStart(8, '0')}`, repairedAt: new Date(`2026-11-18T10:${String(n).padStart(2, '0')}:00Z`),
        employeeScope: { ...data.scope, employee_id: data.currentEmployee._id }, mutationSource: P.OPERATION,
        diagnostics: { version: P.VERSION, operation: 'UPDATE', outcome: 'COMMITTED', actorUserId,
            binding: { actorUserId, employeeId: String(data.currentEmployee._id), scope: { ...data.scope } },
            targetHistoryId: String(original._id), declaration: 'Ναι', explicitChanges: structuredClone(explicit), reviewedOriginal,
            actualBefore: structuredClone(original), actualAfter: structuredClone(original),
            rowApproval: { version: Row.VERSION, status: 'COMMITTED_AWAITING_VERIFICATION', mode,
                hasCorrectionEdition: mode === 'CORRECTION_EDITION' || previous?.diagnostics.rowApproval.hasCorrectionEdition === true,
                originalRowHash: A.hash(original), persistedRowHash: A.hash(original),
                approvedContent: candidate, approvedContentHash: A.hash(candidate),
                acceptedFindings: Row.acceptedFindings(data, String(original._id)) } } };
    // Independent reread of the synthetic committed receipt, using the real
    // verifier. The physical history and seven references remain byte-identical.
    assert.equal(Row.verify(structuredClone(data), structuredClone(audit)).selectedCaseStatus, Row.STATUS);
    const decision = audit.diagnostics.rowApproval;
    decision.status = Row.STATUS;
    decision.verification = { version: Row.VERSION, verifiedAt: new Date('2026-11-18T11:00:00Z'),
        actorUserId, approvedContentHash: decision.approvedContentHash, persistedRowHash: decision.persistedRowHash };
    assert.equal(Row.verify(structuredClone(data), structuredClone(audit)).selectedCaseStatus, Row.STATUS);
    data.approvedHistoryDecisions = [...(data.approvedHistoryDecisions || []), audit];
    return audit;
}

module.exports = { resolvedProposalFixture, approveSyntheticEdition, catalogs: F.catalogs };
