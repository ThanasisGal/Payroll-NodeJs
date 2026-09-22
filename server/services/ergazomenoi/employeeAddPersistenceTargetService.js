'use strict';

const mongoose = require('mongoose');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function conflict(reason, message) {
    const error = new Error(message);
    error.code = reason;
    error.statusCode = 409;
    return error;
}

async function resolveEmployeeAddPersistenceTarget({ employeeModel, historyModel, scope, formData,
    existingEmployeeId }) {
    const afm = String(formData.afm_ergazomenoyHidden || '').trim();
    const amka = String(formData.amka_ergazomenoyHidden || '').trim();
    const hireDate = dateKeyUtc(formData.hmeromhnia_proslhpshs);
    const filter = { team: scope.team, company_kod: scope.company_kod };
    const escapedAfm = afm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const employees = afm ? await employeeModel.find({ ...filter,
        afm: mongoose.trusted({ $regex: `^\\s*${escapedAfm}\\s*$` }) }) : [];
    if (existingEmployeeId != null && existingEmployeeId !== '') {
        if (!mongoose.isValidObjectId(existingEmployeeId)) throw conflict(
            'EMPLOYEE_ADD_IDENTITY_CONFLICT', 'Μη έγκυρο αναγνωριστικό επανάληψης.');
        const hinted = await employeeModel.findOne({ ...filter, _id: existingEmployeeId });
        if (!hinted || String(hinted.afm || '').trim() !== afm) {
            throw conflict('EMPLOYEE_ADD_IDENTITY_CONFLICT', 'Το αναγνωριστικό επανάληψης δεν αντιστοιχεί στον εργαζόμενο της τρέχουσας εταιρείας.');
        }
    }
    if (employees.length > 1) throw conflict('EMPLOYEE_ADD_AFM_AMBIGUOUS',
        'Υπάρχουν πολλαπλές εγγραφές με το ίδιο ΑΦΜ στην εταιρεία. Απαιτείται χειροκίνητος έλεγχος.');
    if (!employees.length) return { action: 'CREATE_NEW', afm };
    const employee = employees[0];
    if (employee.archived === true || employee.energos !== true ||
        dateKeyUtc(employee.hmeromhnia_apoxorhshs)) {
        throw conflict('EMPLOYEE_ADD_REQUIRES_REHIRE',
            'Ο εργαζόμενος υπάρχει ήδη με κλειστή ή ανενεργή σχέση. Χρησιμοποιήστε την επαναπρόσληψη.');
    }
    if (amka && String(employee.amka || '').trim() && amka !== String(employee.amka).trim()) {
        throw conflict('EMPLOYEE_ADD_IDENTITY_CONFLICT', 'Το ΑΜΚΑ διαφέρει από την υπάρχουσα εγγραφή.');
    }
    if (!hireDate || hireDate !== dateKeyUtc(employee.hmeromhnia_proslhpshs)) {
        throw conflict('EMPLOYEE_ADD_HIRE_DATE_CONFLICT',
            'Η ημερομηνία πρόσληψης διαφέρει. Χρησιμοποιήστε Συντήρηση ή Επαναπρόσληψη.');
    }
    const rows = await historyModel.find({ ...filter, kodikos: employee.kodikos });
    if (rows.length !== 1 || rows[0].afora_proslhpsh !== true ||
        dateKeyUtc(rows[0].hmeromhnia_proslhpshs) !== hireDate ||
        dateKeyUtc(rows[0].hmeromhnia_apoxorhshs)) {
        throw conflict('EMPLOYEE_ADD_RETRY_HISTORY_AMBIGUOUS',
            'Δεν μπορεί να προσδιοριστεί με ασφάλεια η αρχική εγγραφή πρόσληψης.');
    }
    return { action: 'CORRECT_EXISTING', employee, history: rows[0], afm };
}

module.exports = { resolveEmployeeAddPersistenceTarget };
