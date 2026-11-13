'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { resolveEmploymentCycleForDate, STATUS } = require('./employeeEmploymentCycleResolverService');
const { ERGANI_PRIMARY_EVIDENCE, UNKNOWN, resolveErganiImportEmploymentEvidence } = require('./erganiImportEmploymentEvidenceService');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const { employeeIsEligibleForProdhlomenaOraria } = require('./erganiImportedEmployeeScopeService');

function workWriteError(code) {
    const error = new Error('Η εισαγωγή των στοιχείων εργασίας σταμάτησε επειδή οι ημερομηνίες, η αντιστοίχιση εργαζομένων ή οι διαθέσιμες εγγραφές δεν επιτρέπουν ασφαλή αποθήκευση. ' +
        '1. Ελέγξτε την εταιρεία, το παράρτημα και τις ημερομηνίες πρόσληψης και αποχώρησης. ' +
        '2. Ελέγξτε ότι υπάρχουν προδηλωμένα ωράρια και ότι η περίοδος δεν έχει οριστικοποιηθεί. Αν το πρόβλημα παραμένει, ζητήστε έλεγχο από την υποστήριξη. ' +
        (code === 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED'
            ? 'Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές από αυτή την εισαγωγή. '
            : 'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την εισαγωγή. ') + 'Κωδικός αναφοράς: ' + code);
    error.code = code;
    error.statusCode = 409;
    return error;
}

// This is the SAME persisted Employee increment used by History corrections.
// No timer or process-local lock. Each retry reacquires before business reads.
// The caller must execute its complete write batch with the supplied session.
async function runEmployeeWorkWrite({ documents, work, connection = mongoose.connection,
    employeeModel = ErgazomenoiModel, historyModel = IstorikoProslhpseonAllagonModel,
    capabilityProbe, employmentPolicy = 'STRICT', periodControlModel = PeriodControlModel } = {}) {
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
        if (!grouped.has(key)) grouped.set(key, { scope, dates: new Set(), documents: [] });
        grouped.get(key).dates.add(new Date(document.hmeromhnia).toISOString().slice(0, 10));
        grouped.get(key).documents.push(document);
    }
    const W = require('./employeeEmploymentProfileWriter');
    let workCompleted = false;
    try {
        return await W.inProfileTransaction(connection, capabilityProbe || W.transactionCapability, async session => {
            workCompleted = false;
            // Stable ordering also avoids reversed multi-employee acquisition.
            for (const [, { scope, dates, documents: scopedDocuments }] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
                const employeeId = await W.acquireEmployeeMutationFence({ filter: scope, employeeModel, session,
                    notFoundCode: 'EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING' });
                const employee = await employeeModel.findOne({ ...scope, _id: employeeId }).session(session).lean();
                if (!employee) throw workWriteError('EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING');
                if (employmentPolicy === ERGANI_PRIMARY_EVIDENCE) {
                    if (!employeeIsEligibleForProdhlomenaOraria(employee) || scopedDocuments.some(document =>
                        (document.employee_id && String(document.employee_id) !== String(employee._id)) ||
                        String(document.employee_afm || '') !== String(employee.afm || '') ||
                        String(document.ypokatasthma) !== String(employee.ypokatasthma))) {
                        throw workWriteError('EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING');
                    }
                    const periods = await periodControlModel.find({ team: scope.team, company_kod: scope.company_kod,
                        ypokatasthma: employee.ypokatasthma,
                        $or: mongoose.trusted([...dates].sort().map(date => ({
                            period_start: mongoose.trusted({ $lte: new Date(date) }), period_end: mongoose.trusted({ $gte: new Date(date) })
                        })))
                    }).session(session).lean();
                    for (const period of periods) {
                        if (period.status !== 'OPEN') throw workWriteError('EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED');
                        const fenced = await periodControlModel.updateOne({ _id: period._id, status: 'OPEN' },
                            { $inc: { write_fence_version: 1 } }, { session });
                        if (fenced.matchedCount !== 1) throw workWriteError('EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED');
                    }
                }
                const history = await historyModel.find(scope).session(session).lean();
                for (const date of dates) {
                    const resolution = (employmentPolicy === ERGANI_PRIMARY_EVIDENCE
                        ? resolveErganiImportEmploymentEvidence : resolveEmploymentCycleForDate)(date, { currentEmployee: employee, history });
                    if (resolution.status !== STATUS.EMPLOYED &&
                        !(employmentPolicy === ERGANI_PRIMARY_EVIDENCE && resolution.status === UNKNOWN)) {
                        throw workWriteError('EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT');
                    }
                }
            }
            const result = await work({ session });
            workCompleted = true;
            return result;
        }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) {
        if (workCompleted) throw workWriteError('EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED');
        if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') {
            throw workWriteError('EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE');
        }
        throw error;
    }
}

module.exports = { runEmployeeWorkWrite, workWriteError };
