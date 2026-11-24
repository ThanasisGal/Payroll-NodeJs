'use strict';

// Row decisions are independent of canonical certification of the whole history.
// Operational readers opt into verified editions separately. Frozen reports,
// physical write fences and persisted references retain their original semantics.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const P = require('./employeeHistoryApprovedProposalContract');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const VERSION = 'employee-history-row-approval:v1';
const STATUS = 'APPROVED_RESOLVED';
const blank = value => value == null || typeof value === 'string' && value.trim() === '';
const day = value => { try { return calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
const state = (row, field) => Object.hasOwn(row, field) ? { recorded: true, value: row[field] } : { recorded: false };

async function loadDecisions(input, auditModel, session = null) {
    if (!auditModel) return [];
    return auditModel.find({ 'employeeScope.team': input.scope.team,
        'employeeScope.company_kod': input.scope.company_kod, 'employeeScope.kodikos': input.scope.kodikos,
        'employeeScope.employee_id': input.currentEmployee._id, mutationSource: P.OPERATION,
        'diagnostics.rowApproval.version': VERSION, 'diagnostics.rowApproval.status': STATUS }).sort({ repairedAt: -1, _id: -1 }).session(session).lean();
}
function activeDecision(input, row) {
    return (input.approvedHistoryDecisions || []).find(audit => audit.diagnostics.targetHistoryId === String(row._id) &&
        audit.diagnostics.rowApproval?.status === STATUS &&
        audit.diagnostics.rowApproval.verification?.actorUserId === audit.diagnostics.actorUserId &&
        audit.diagnostics.rowApproval.verification?.approvedContentHash === audit.diagnostics.rowApproval.approvedContentHash &&
        audit.diagnostics.rowApproval.verification?.persistedRowHash === audit.diagnostics.rowApproval.persistedRowHash &&
        audit.diagnostics.rowApproval.persistedRowHash === A.hash(audit.diagnostics.actualAfter) &&
        A.equal(withoutReferenceFence(audit.diagnostics.actualAfter), withoutReferenceFence(row)));
}
const withoutReferenceFence = row => Object.fromEntries(Object.entries(row || {}).filter(([field]) => field !== 'history_reference_fence'));
function reviewedRow(input, row) {
    const content = activeDecision(input, row)?.diagnostics.rowApproval.approvedContent;
    return content ? { ...content, ...(Object.hasOwn(row, 'updatedAt') ? { updatedAt: row.updatedAt } : {}) } : row;
}
function factsAudit(original, candidate, explicit, entries) {
    const fields = [...new Set([...Object.keys(original), ...Object.keys(candidate),
        ...entries.filter(entry => entry.role === 'ANSWER').map(entry => entry.canonicalField)])];
    return fields.map(field => ({ field, specified: Object.hasOwn(explicit, field),
        changed: !A.equal(state(original, field), state(candidate, field)),
        before: state(original, field), after: state(candidate, field) }));
}
function validateDates(original, candidate, patch) {
    const reject = issue => { const error = P.failure('DATES', 422);
        error.problems = require('./employeeHistoryApprovedProposalDiagnostics').incompleteProblems({ issues: [issue] }); throw error; };
    for (const [from, to] of [[C.START, C.END], [C.CHANGE, C.CONTRACT_END],
        ['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos'],
        ['hmnia_enarxhs_egkekrimenhs_rythmishs', 'hmnia_lhxhs_egkekrimenhs_rythmishs']]) {
        if (!Object.hasOwn(patch, from) && !Object.hasOwn(patch, to)) continue;
        if (day(candidate[from]) && day(candidate[to]) && day(candidate[from]) > day(candidate[to])) reject({ reason: 'INVALID_TEMPORAL_DATE', fields: [from, to],
                check: 'DATE_RANGE_REVERSED', values: { fromDate: day(candidate[from]), toDate: day(candidate[to]) } });
    }
    for (const field of Object.keys(patch).filter(field => field.startsWith('hmeromhnia_') || field.startsWith('hmnia_'))) {
        if (day(candidate[C.HIRE]) && day(candidate[field]) < day(candidate[C.HIRE]) ||
            day(candidate[C.DEPARTURE]) && day(candidate[field]) > day(candidate[C.DEPARTURE])) reject({ reason: 'INVALID_TEMPORAL_DATE', field,
                check: 'DATE_OUTSIDE_EMPLOYMENT_CYCLE', values: { date: day(candidate[field]), hire: day(candidate[C.HIRE]), departure: day(candidate[C.DEPARTURE]) } });
    }
}
async function prepare({ input, baseline, completions, original, dependencies: d, session, evidence, declaration }) {
    const selected = baseline.caseSelection.selectedCase;
    const inserting = selected.operation === 'INSERT';
    const reviewed = inserting ? { ...input.scope, [C.HIRE]: calendarDate(selected.period.hire),
        [C.START]: calendarDate(selected.period.from), [C.END]: calendarDate(selected.period.to),
        afora_proslhpsh: false, afora_allagh_oron_ergasias: true } : reviewedRow(input, original);
    const explicit = {}, patch = {};
    for (const answer of completions.filter(answer => answer.entry.role === 'ANSWER' && !blank(answer.raw))) {
        const field = answer.entry.canonicalField, path = d.historyModel.schema.path(field);
        if (!P.permittedFields.includes(field)) throw P.failure('LIFECYCLE', 422);
        if (!path) throw P.failure('VALUE', 422);
        const value = path.cast(answer.raw);
        if (blank(value)) throw P.failure('VALUE', 422);
        explicit[field] = value;
        if (!A.equal(reviewed[field], value)) patch[field] = value;
    }
    const candidate = { ...reviewed, ...patch };
    validateDates(reviewed, candidate, patch);
    const period = { from: day(effectiveStart(candidate)), to: day(effectiveEnd(candidate)) };
    if (inserting && (period.from !== selected.period.from || period.to !== selected.period.to)) throw P.failure('DATES', 422);
    const oldPeriod = inserting ? period : { from: day(effectiveStart(original)), to: day(effectiveEnd(original)) };
    const affected = { from: [oldPeriod.from, period.from].filter(Boolean).sort()[0] || null,
        to: oldPeriod.to && period.to ? [oldPeriod.to, period.to].sort().at(-1) : null };
    // Serialize even absent periods using the existing company write fence. A
    // locked/finalized/unknown window always selects an immutable edition.
    const protection = await require('./employeeHistoryLegacyProtectionService').readLegacyProtection({
        input, period: affected, session, dependencies: d, preserveOriginal: true });
    const referenceEvidence = await require('./employeeHistorySettlementReferenceEvidence')
        .referenceSummary(d.connection, inserting ? input.completeHistoryRows.filter(row => selected.sourceHistoryIds.includes(String(row._id))) : [original], session);
    const hasReferences = Object.values(referenceEvidence).some(value => Array.isArray(value) && value.length);
    const bounded = oldPeriod.from && oldPeriod.to && period.from && period.to;
    const protectedPeriod = protection.uncertain || protection.controls.some(row => row.status !== 'OPEN' || row.active_calculation_id) || protection.snapshots.length;
    const ambiguous = input.completeHistoryRows.some(row => String(row._id) !== String(original?._id) &&
        (!day(effectiveStart(row)) || day(effectiveStart(row)) <= (affected.to || '9999-12-31') &&
            (!day(effectiveEnd(row)) || day(effectiveEnd(row)) >= (affected.from || '0001-01-01'))));
    if (inserting && (protectedPeriod || hasReferences)) throw P.failure('PERIOD_PROTECTED');
    const previousApproval = inserting ? null : activeDecision(input, original);
    const previousEdition = previousApproval?.diagnostics.rowApproval;
    const hasCorrectionEdition = previousEdition?.mode === 'CORRECTION_EDITION' || previousEdition?.hasCorrectionEdition === true;
    // An approval freezes its source even when that approval originally used
    // PHYSICAL_UPDATE or APPROVAL_ONLY in an OPEN, unreferenced period.
    const mode = inserting ? 'INSERT' : !Object.keys(patch).length ? 'APPROVAL_ONLY' :
        previousApproval || hasCorrectionEdition || !bounded ||
        protectedPeriod || hasReferences || ambiguous ? 'CORRECTION_EDITION' : 'PHYSICAL_UPDATE';
    const contents = { operation: selected.operation, caseId: selected.id, targetHistoryId: selected.targetHistoryId,
        period, affected, branch: original?.ypokatasthma || input.currentEmployee.ypokatasthma,
        patch, candidate, reviewedOriginal: reviewed, explicit, evidence, declaration, certification: null,
        referenceEvidence, rowApproval: { version: VERSION, status: STATUS, mode, hasCorrectionEdition: hasCorrectionEdition || mode === 'CORRECTION_EDITION',
            previousApprovalId: previousApproval?.diagnostics.approvalId || null,
            originalRowHash: A.hash(original || null), facts: factsAudit(inserting ? {} : reviewed, candidate, explicit, baseline.editableCells) } };
    return { ...contents, protection, snapshot: baseline.snapshotFingerprint,
        fingerprint: A.hash({ version: P.VERSION, snapshot: baseline.snapshotFingerprint, contents, protection }),
        rows: Object.entries(patch).map(([field, after]) => ({ fieldId: field, field: labels[field] || field,
            before: inserting ? null : reviewed[field] ?? null, after })) };
}
function findingSignature(item, targetId, input) {
    return A.hash({ kind: item.kind, reasons: [...item.reasons].sort(), fields: [...item.fields].sort(),
        period: item.period, sourceHistoryIds: item.sourceHistoryIds,
        related: item.sourceHistoryIds.filter(id => id !== targetId).map(id => ({ id,
            rowHash: A.hash(input.completeHistoryRows.find(row => String(row._id) === id)) })) });
}
function acceptedFindings(input, targetId) {
    const selection = require('./employeeHistoryProposalCaseService').selectEmployeeHistoryProposalCase(
        { ...input, approvedHistoryDecisions: [] }, { status: 'REVIEW_REQUIRED' });
    return selection.cases.filter(item => item.sourceHistoryIds.includes(targetId))
        .map(item => findingSignature(item, targetId, input));
}
function pendingFinding(input, item, historyRows = require('./employeeHistoryProposalReadService').proposalHistoryState(input).historyRows) {
    if (item.operation === 'INSERT') {
        const gaps = require('../../utils/ergazomenoi/employmentHistoryCoverage').employeeHistoryCoverageGaps({
            currentEmployee: input.currentEmployee, historyRows });
        return gaps.some(gap => !gap.reason && gap.hire === item.period.hire && gap.from === item.period.from &&
            gap.to === item.period.to) ? item : null;
    }
    // Approval of one row does not resolve an independent structural/current
    // discrepancy, even if an old audit accepted its former physical finding.
    if (item.kind === 'AMBIGUITY' || item.reasons.some(reason =>
        ['CURRENT_PROFILE_MISMATCH', 'ACTIVE_PERIOD_NOT_OPEN'].includes(reason))) return item;
    const pending = item.sourceHistoryIds.filter(id => {
        const row = input.completeHistoryRows.find(row => String(row._id) === id);
        const audit = row && activeDecision(input, row);
        return !audit?.diagnostics.rowApproval.acceptedFindings?.includes(findingSignature(item, id, input));
    });
    if (!pending.length) return null;
    return pending.length === item.sourceHistoryIds.length ? item : { ...item,
        existingHistoryId: pending[0], sourceHistoryIds: pending,
        period: { ...item.period, beforeHistoryId: pending[0] } };
}
function verify(input, audit) {
    const decision = audit.diagnostics.rowApproval;
    const row = input.completeHistoryRows.find(row => String(row._id) === audit.diagnostics.targetHistoryId);
    if (decision?.status === STATUS && (decision.verification?.actorUserId !== audit.diagnostics.actorUserId ||
        decision.verification?.persistedRowHash !== decision.persistedRowHash ||
        decision.verification?.approvedContentHash !== decision.approvedContentHash)) throw P.failure('VERIFICATION');
    if (decision?.version !== VERSION || ![STATUS, 'COMMITTED_AWAITING_VERIFICATION'].includes(decision.status) || !row ||
        decision.persistedRowHash !== A.hash(audit.diagnostics.actualAfter) ||
        !A.equal(withoutReferenceFence(row), withoutReferenceFence(audit.diagnostics.actualAfter)) ||
        decision.approvedContentHash !== A.hash(decision.approvedContent) ||
        !A.equal(decision.approvedContent, { ...audit.diagnostics.reviewedOriginal, ...audit.diagnostics.explicitChanges }))
        throw P.failure('VERIFICATION');
    return { selectedCaseStatus: STATUS, correctionEdition: decision.mode === 'CORRECTION_EDITION',
        historyStatus: 'REVIEW_REQUIRED', verification: { version: VERSION, persisted: true,
            selectedCaseResolved: true, auditId: String(audit._id), rowFingerprint: decision.persistedRowHash,
            approvedContentHash: decision.approvedContentHash } };
}
module.exports = { VERSION, STATUS, blank, state, loadDecisions, activeDecision, reviewedRow, prepare, verify, acceptedFindings, pendingFinding };
