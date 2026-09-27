'use strict';

const AUDIT_COLLECTION_NAME = 'Employee_History_Repair_Audit';
const AUDIT_SCOPE_INDEX_NAME = 'employee_history_repair_scope_repaired_at';
const AUDIT_SCOPE_INDEX_KEYS = Object.freeze({
    'employeeScope.team': 1,
    'employeeScope.company_kod': 1,
    'employeeScope.kodikos': 1,
    repairedAt: -1
});

module.exports = {
    AUDIT_COLLECTION_NAME,
    AUDIT_SCOPE_INDEX_NAME,
    AUDIT_SCOPE_INDEX_KEYS
};
