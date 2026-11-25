'use strict';

const { proposalHistoryState } = require('./employeeHistoryProposalReadService');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');

const VERSION = 'employee-approved-maintenance-baseline:v1';
const day = value => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(+d) ? d.toISOString().slice(0,10) : null;
};
const issueKey = item => [day(item?.hire), day(item?.from), day(item?.to), item?.reason || ''].join('|');

// This is a classification of PRE-EXISTING findings only, not permission to
// overwrite History. A future 5->6 days change needs a *new* dated plan.
function assessApprovedMaintenanceBaseline(input, proposed = null) {
    if (!input?.currentEmployee || !input?.scope ||
        !Array.isArray(input.completeHistoryRows) ||
        !Array.isArray(input.approvedHistoryDecisions)) {
        throw new TypeError('APPROVED_HISTORY_BASELINE_INPUT_REQUIRED');
    }
    const original = input.completeHistoryRows;
    const projection = proposalHistoryState(input); // validates each audit against persisted original
    const approved = projection.decisions;
    const physicalGaps = employeeHistoryCoverageGaps({
        currentEmployee: input.currentEmployee, historyRows: original });
    const acceptedGaps = employeeHistoryCoverageGaps({
        currentEmployee: input.currentEmployee, historyRows: projection.historyRows });
    const remainingGaps = new Set(acceptedGaps.map(issueKey));
    const resolvedGaps = physicalGaps.filter(gap => !remainingGaps.has(issueKey(gap)));
    // Maintenance consumes the verified decisions; it does not reopen XLSX
    // completion checks on the approved editions. Structural and unapproved
    // row checks still use the common save validator.
    const inspection = inspectEmployeeHistorySave({ scope: input.scope,
        currentEmployee: input.currentEmployee, historyRows: projection.historyRows,
        approvedHistoryInput: input, includeIssueDetails: true });
    const pendingCount = new Set(inspection.issues.filter(issue => issue.historyId)
        .map(issue => issue.historyId)).size + acceptedGaps.length;
    const reviewCount = new Set(inspection.issues.filter(issue => !issue.historyId)
        .map(issue => issue.reason)).size;
    const priorFindingsResolved = (approved.length > 0 || require('./employeeHistoryArchiveStateService').archives(input).length > 0) &&
        require('./employeeHistoryArchiveStateService').managementReady(inspection);
    const state = !approved.length ? 'NO_VERIFIED_APPROVALS' :
        priorFindingsResolved ? 'VERIFIED_PRIOR_FINDINGS_RESOLVED' :
            'APPROVED_BUT_RESIDUAL_FINDINGS';
    const plan = proposed == null ? null : (() => {
        // Pure eligibility check only. The physical write boundary still owns
        // authorization, full profile validation, concurrency and all mutations.
        if (!priorFindingsResolved) return 'PRIOR_FINDINGS_STILL_OPEN';
        if (input.currentEmployee.employee_pending_history) return 'PRIOR_CHANGE_PENDING';
        const when = day(proposed.effectiveFrom), hire = day(input.currentEmployee.hmeromhnia_proslhpshs);
        const departure = day(input.currentEmployee.hmeromhnia_apoxorhshs);
        if (!when || !hire || when < hire || departure && when > departure)
            return 'INVALID_NEW_EFFECTIVE_DATE';
        const latest = projection.historyRows
            .filter(row => day(row.hmeromhnia_proslhpshs) === hire)
            .map(row => day(row.hmeromhnia_isxyos_oron_ergasias_apo)).filter(Boolean)
            .sort().at(-1);
        if (!latest || when <= latest) return 'NEW_DATE_NOT_AFTER_CURRENT_START';
        if (proposed.profileChanges == null && (!Number.isInteger(proposed.weekDays) || proposed.weekDays < 1 || proposed.weekDays > 7 ||
            proposed.weekDays === Number(input.currentEmployee.hmeres_ergasias_ebdomadas)))
            return 'INVALID_OR_UNCHANGED_DAYS';
        if (proposed.profileChanges != null && !Object.keys(proposed.profileChanges).length) return 'NO_PROFILE_CHANGE';
        return 'ELIGIBLE_FOR_FURTHER_VERSION_PLANNING';
    })();
    return {
        version: VERSION, state,
        verifiedApprovalCount: approved.length,
        resolvedPriorGapCount: resolvedGaps.length,
        residualGapCount: acceptedGaps.length,
        pendingCaseCount: pendingCount,
        reviewFindingCount: reviewCount,
        newVersionPlanningStatus: plan,
        // Deliberately NOT "CLEAN". A passed prior approval does not mean a new
        // mutation is valid, or permit overwriting historical physical rows.
        priorFindingsResolved,
        newMutationAuthorized: false,
        requiresNewEffectiveDateAndPhysicalWritePlan: true
    };
}
module.exports = { VERSION, assessApprovedMaintenanceBaseline };
