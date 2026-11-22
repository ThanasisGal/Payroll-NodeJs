'use strict';

// Maintenance UI only. These are DISPLAY projections: physical History rows,
// editor revision tokens, persisted references and frozen results stay intact.
// Never mark the complete legacy History CLEAN from the presence of an audit.
const Row = require('./employeeHistoryRowApprovalService');
const B = require('./employeeApprovedHistoryImmutableBoundaryService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');

async function verifiedEmployeeHistoryDisplay({scope,currentEmployee,physicalRows,auditModel}) {
    const unchanged = {historyRows:physicalRows, boundaryEnds:{}, hasAtomic:false, verified:true};
    if(!scope || !currentEmployee || !Array.isArray(physicalRows) || !auditModel?.find)
        return {...unchanged,hasAtomic:true,verified:false};
    let hasAtomic=false;
    try {
        const atomic = await auditModel.find({
            'employeeScope.team':scope.team,
            'employeeScope.company_kod':scope.company_kod,
            'employeeScope.kodikos':scope.kodikos,
            'employeeScope.employee_id':currentEmployee._id,
            mutationSource:B.OPERATION,
            'diagnostics.version':B.WRITER_VERSION,
            'diagnostics.operation':'NEW_CHANGE'
        }).sort({repairedAt:-1,_id:-1}).lean();
        if (!atomic.length) return unchanged;
        hasAtomic=true;
        const approvals=await Row.loadDecisions({scope,currentEmployee},auditModel);
        const projection=proposalHistoryState({scope,currentEmployee,
            completeHistoryRows:physicalRows,approvedHistoryDecisions:approvals,
            atomicBoundaryAudits:atomic});
        const boundaryEnds={};
        for(const b of projection.atomicBoundaries) {
            if (Object.hasOwn(boundaryEnds,b.priorHistoryId))
                throw B.invalid('DUPLICATE_DISPLAY_BOUNDARY');
            boundaryEnds[b.priorHistoryId]=b.priorEffectiveTo;
        }
        // Normal immutable source facts are retained in the parent controller.
        return {historyRows:projection.historyRows,boundaryEnds,hasAtomic,verified:true};
    } catch {
        // Unknown, missing or altered receipts must NEVER be shown as verified
        // and must not prevent unrelated Employee Maintenance from opening.
        return {...unchanged,hasAtomic:true,verified:false};
    }
}
module.exports = {verifiedEmployeeHistoryDisplay};
