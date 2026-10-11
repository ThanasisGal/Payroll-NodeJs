'use strict';
const { finalizedEmployeeFilter } = require('./../../utils/ergazomenoi/finalizedEmployeeFilter');

async function generatePersistedEmployeeContract({
    employeeModel,
    employeeScope,
    generateContractPDF,
    userContext
}) {
    const persistedEmployee = await employeeModel.findOne(finalizedEmployeeFilter(employeeScope));
    if (!persistedEmployee) {
        const error = new Error(
            'Ο αποθηκευμένος εργαζόμενος δεν βρέθηκε. Δεν δημιουργήθηκε PDF σύμβασης.'
        );
        error.code = 'CONTRACT_PERSISTED_EMPLOYEE_NOT_FOUND';
        error.statusCode = 409;
        throw error;
    }

    return generateContractPDF(persistedEmployee, userContext);
}

module.exports = { generatePersistedEmployeeContract };
