'use strict';

function buildEmployeeScope({ employeeId, sessionTeam, companyId }) {
    return {
        _id: employeeId,
        team: sessionTeam,
        company_kod: companyId
    };
}

async function requireScopedEmployeeForUpdate({
    req,
    res,
    model,
    objectId,
    logger = console
}) {
    const employeeId = req.params?.ergazomenoiId;
    const sessionTeam = req.session?.userTeam;
    const companyId = req.session?.companyInUse;

    if (!sessionTeam || !companyId || !objectId.isValid(String(employeeId || ''))) {
        res.status(404).json({
            success: false,
            errorMessage: 'Ο εργαζόμενος δεν βρέθηκε'
        });
        return null;
    }

    const employeeScope = buildEmployeeScope({ employeeId, sessionTeam, companyId });
    let employee;
    try {
        employee = await model.findOne(employeeScope).select('_id kodikos').lean();
    } catch (error) {
        logger.error('Employee scope lookup failed', {
            category: error?.name || 'EMPLOYEE_SCOPE_LOOKUP_FAILED'
        });
        res.status(500).json({
            success: false,
            errorMessage: 'Σφάλμα κατά τον έλεγχο πρόσβασης στον εργαζόμενο'
        });
        return null;
    }

    if (!employee) {
        res.status(404).json({
            success: false,
            errorMessage: 'Ο εργαζόμενος δεν βρέθηκε'
        });
        return null;
    }

    const employeeCode = String(employee.kodikos ?? '').trim();
    if (!employeeCode) {
        logger.error('Employee scope lookup returned invalid identity', {
            category: 'EMPLOYEE_CODE_MISSING'
        });
        res.status(500).json({
            success: false,
            errorMessage: 'Σφάλμα ακεραιότητας δεδομένων εργαζομένου'
        });
        return null;
    }

    return { employeeScope, employee, employeeCode };
}

module.exports = {
    buildEmployeeScope,
    requireScopedEmployeeForUpdate
};
