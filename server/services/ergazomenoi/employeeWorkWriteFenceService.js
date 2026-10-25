'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { resolveEmploymentCycleForDate, STATUS } = require('./employeeEmploymentCycleResolverService');

function workWriteError(code) {
    const error = new Error('Η εισαγωγή των στοιχείων εργασίας σταμάτησε επειδή δεν επιβεβαιώθηκε ότι οι ημερομηνίες καλύπτονται από το ισχύον Ιστορικό ή ότι η αποθήκευση μπορεί να γίνει με ασφάλεια. ' +
        '1. Άνοιξε ξανά τον εργαζόμενο και έλεγξε τις ημερομηνίες πρόσληψης και αποχώρησης στο Ιστορικό. ' +
        '2. Επανάλαβε την εισαγωγή. Αν το πρόβλημα παραμένει, ζήτησε έλεγχο από διαχειριστή. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την εισαγωγή. Κωδικός αναφοράς: ' + code);
    error.code = code;
    error.statusCode = 409;
    return error;
}

// This is the SAME persisted Employee increment used by History corrections.
// No timer or process-local lock. Each retry reacquires before business reads.
// The caller must execute its complete write batch with the supplied session.
async function runEmployeeWorkWrite({ documents, work, connection = mongoose.connection,
    employeeModel = ErgazomenoiModel, historyModel = IstorikoProslhpseonAllagonModel,
    capabilityProbe } = {}) {
    if (!Array.isArray(documents) || !documents.length || typeof work !== 'function') {
        throw workWriteError('EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED');
    }
    const grouped = new Map();
    for (const document of documents) {
        const scope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(field => [field, document?.[field]]));
        if (!Object.values(scope).every(value => typeof value === 'string' && value.trim()) ||
            !document.hmeromhnia || !Number.isFinite(new Date(document.hmeromhnia).getTime())) {
            throw workWriteError('EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED');
        }
        const key = JSON.stringify(Object.values(scope));
        if (!grouped.has(key)) grouped.set(key, { scope, dates: new Set() });
        grouped.get(key).dates.add(new Date(document.hmeromhnia).toISOString().slice(0, 10));
    }
    const W = require('./employeeEmploymentProfileWriter');
    try {
        return await W.inProfileTransaction(connection, capabilityProbe || W.transactionCapability, async session => {
            // Stable ordering also avoids reversed multi-employee acquisition.
            for (const [, { scope, dates }] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
                const employeeId = await W.acquireEmployeeMutationFence({ filter: scope, employeeModel, session });
                const employee = await employeeModel.findOne({ ...scope, _id: employeeId }).session(session).lean();
                if (!employee) throw workWriteError('EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING');
                const history = await historyModel.find(scope).session(session).lean();
                for (const date of dates) {
                    if (resolveEmploymentCycleForDate(date, { currentEmployee: employee, history }).status !== STATUS.EMPLOYED) {
                        throw workWriteError('EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT');
                    }
                }
            }
            return work({ session });
        }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) {
        if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') {
            throw workWriteError('EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE');
        }
        throw error;
    }
}

module.exports = { runEmployeeWorkWrite };
