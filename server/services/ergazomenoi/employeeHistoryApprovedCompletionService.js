'use strict';
const C = require('./employeeHistoryAutomaticReconstructionContract');
const P = require('./employeeHistoryApprovedProposalContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const day = value => calendarDate(value)?.toISOString().slice(0, 10) || null;

// A missing initial boundary is NOT the XLSX's displayed range. A recorded hire
// event can establish the lower bound; the canonical successor contract can
// establish its end. No current date, external description or user text is used.
function evidencedBeforePeriod(input, original) {
    let from = day(effectiveStart(original)), to = day(effectiveEnd(original));
    if (from && to) return { from, to, evidence: null };
    const hire = day(original[C.HIRE]);
    const rows = semanticHistoryRows(input.completeHistoryRows);
    if (!hire || original.afora_proslhpsh !== true ||
        rows.some(row => String(row._id) !== String(original._id) && day(row[C.HIRE]) === hire &&
            (!effectiveStart(row) || day(effectiveStart(row)) <= (from || hire)))) throw P.failure('BEFORE_BOUNDS_REQUIRED');
    require('./employeeEmploymentCycleResolverService').buildEmploymentCycles({ currentEmployee: input.currentEmployee, history: rows });
    if (!from) {
        if (original[C.CHANGE] && day(original[C.CHANGE]) !== hire) throw P.failure('BEFORE_BOUNDS_REQUIRED');
        from = hire;
    }
    const normalized = canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: rows.map(row => String(row._id) === String(original._id) ? { ...row, [C.START]: calendarDate(from) } : row) });
    const canonicalRows = normalized.canonicalRows || [];
    const canonical = canonicalRows.find(row => String(row._id) === String(original._id));
    // Canonicalization must preserve every identity. Cleanup/retirement is a
    // separate approval and can never be smuggled into this selected UPDATE.
    if (!canonical || normalized.status === 'TRUE_AMBIGUITY' || canonicalRows.length !== rows.length ||
        !rows.every(row => canonicalRows.some(item => String(item._id) === String(row._id)))) throw P.failure('BEFORE_BOUNDS_REQUIRED');
    to = to || day(effectiveEnd(canonical));
    if (!to || to < from) throw P.failure('BEFORE_BOUNDS_REQUIRED');
    const successor = rows.filter(row => String(row._id) !== String(original._id) && day(row[C.HIRE]) === hire &&
        day(effectiveStart(row)) > from).sort((a, b) => effectiveStart(a) - effectiveStart(b))[0];
    return { from, to, evidence: { version: 'recorded-initial-history-bounds:v1', hire,
        sourceHistoryId: String(original._id), successorHistoryId: successor ? String(successor._id) : null,
        departure: day(original[C.DEPARTURE]), from, to } };
}

function affectedPeriod(input, candidate, original, operation) {
    if (operation !== 'UPDATE') return require('./employeeHistoryProposalImportService').affectedPeriod(candidate, original, operation);
    const before = evidencedBeforePeriod(input, original);
    const from = day(effectiveStart(candidate)), to = day(effectiveEnd(candidate));
    if (!from || !to) throw P.failure('PROTECTION_UNKNOWN');
    if (before.evidence && (from !== before.from || to !== before.to)) throw P.failure('BEFORE_BOUNDS_REQUIRED');
    return { from: [before.from, from].sort()[0], to: [before.to, to].sort().at(-1), beforeEvidence: before.evidence };
}

function verifyCompletion(input, audit) {
    const { inspectEmployeeHistorySave, inspectEmployeeHistoryProposedRowSave } = require('./employeeHistorySaveValidationService');
    const inspection = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee,
        historyRows: input.completeHistoryRows, includeIssueDetails: true });
    const target = input.completeHistoryRows.find(row => String(row._id) === audit.diagnostics.targetHistoryId);
    const targetIssues = target ? inspectEmployeeHistoryProposedRowSave(target).issues : [{ reason: 'TARGET_MISSING' }];
    const scopedIssues = inspection.issues.filter(issue => String(issue.historyId) === String(target?._id));
    const structural = inspection.verification;
    const structuralOK = structural.canonicalIdempotent === true && !(structural.coverageGaps || []).length &&
        !inspection.issues.some(issue => /CYCLE|OVERLAP|AMBIGU|COVERAGE|ACTIVE_PERIOD/.test(issue.reason));
    const resolved = targetIssues.length === 0 && scopedIssues.length === 0 && structuralOK &&
        (!audit.diagnostics.legacyCertification || inspection.status === 'CLEAN');
    return { historyStatus: inspection.status === 'CLEAN' ? 'CLEAN' : 'REVIEW_REQUIRED',
        selectedCaseStatus: resolved ? 'VERIFIED_RESOLVED' : 'COMMITTED_REVIEW_REQUIRED',
        verification: { version: 'approved-history-persisted-verification:v1', persisted: true,
            fullHistoryStatus: inspection.status, selectedCaseResolved: resolved,
            historyFingerprint: A.hash(A.ordered(input.completeHistoryRows)), auditId: String(audit._id),
            remainingIssues: inspection.issues.map(issue => ({ reason: issue.reason, field: issue.field || null,
                selectedCase: String(issue.historyId) === String(target?._id) })),
            targetIssues: targetIssues.map(issue => ({ reason: issue.reason, field: issue.field || null })),
            canonicalIdempotent: structural.canonicalIdempotent === true, coverageGapCount: (structural.coverageGaps || []).length } };
}
module.exports = { evidencedBeforePeriod, affectedPeriod, verifyCompletion };
