'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const { employeeIsEligibleForProdhlomenaOraria } = require('./erganiImportedEmployeeScopeService');

function primaryDataWriteError(code) {
    const uncertain = code === 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED';
    return Object.assign(new Error('Η ενημέρωση των πρωτογενών στοιχείων ΕΡΓΑΝΗ σταμάτησε επειδή δεν επιβεβαιώθηκαν η αντιστοίχιση ή οι προϋποθέσεις ασφαλούς αποθήκευσης. ' +
        '1. Ελέγξτε την εταιρεία, το υποκατάστημα και τους εργαζομένους. ' +
        '2. Ελέγξτε αν η περίοδος είναι κλειδωμένη ή εκτελείται υπολογισμός και ζητήστε έλεγχο από την υποστήριξη πριν επαναλάβετε τη λήψη. ' +
        (uncertain ? 'Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές. ' : 'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την εισαγωγή. ') +
        'Κωδικός αναφοράς: ' + code), { code, statusCode: 409 });
}

// Technical protection only. No History model, lifecycle resolver or employment
// dates are read. Both imports share the persisted Employee mutation fence.
async function runErganiPrimaryDataWrite({ documents, work, connection = mongoose.connection,
    employeeModel = ErgazomenoiModel, periodControlModel = PeriodControlModel, capabilityProbe } = {}) {
    if (!Array.isArray(documents) || !documents.length || typeof work !== 'function') {
        throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED');
    }
    const grouped = new Map();
    for (const document of documents) {
        const scope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(field => [field, document?.[field]]));
        if (!Object.values(scope).every(value => typeof value === 'string' && value.trim()) ||
            !document.hmeromhnia || !Number.isFinite(new Date(document.hmeromhnia).getTime())) {
            throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED');
        }
        const key = JSON.stringify(Object.values(scope));
        if (!grouped.has(key)) grouped.set(key, { scope, dates: new Set(), documents: [] });
        const group = grouped.get(key);
        group.dates.add(new Date(document.hmeromhnia).toISOString().slice(0, 10));
        group.documents.push(document);
    }
    const W = require('./employeeEmploymentProfileWriter');
    let workCompleted = false;
    try {
        return await W.inProfileTransaction(connection, capabilityProbe || W.transactionCapability, async session => {
            workCompleted = false;
            for (const [, group] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
                const { scope, dates } = group;
                const employeeId = await W.acquireEmployeeMutationFence({ filter: scope, employeeModel, session,
                    notFoundCode: 'EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING' });
                const employee = await employeeModel.findOne({ ...scope, _id: employeeId })
                    .select('_id afm ypokatasthma oristikh_enhmerosh afora_daneismo_ergazomenoy typos_ergodoth_daneismoy')
                    .session(session).lean();
                if (!employeeIsEligibleForProdhlomenaOraria(employee) || group.documents.some(document =>
                    String(document.employee_id) !== String(employee?._id) ||
                    String(document.employee_afm || '') !== String(employee?.afm || '') ||
                    String(document.ypokatasthma) !== String(employee?.ypokatasthma))) {
                    throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING');
                }
                const periods = await periodControlModel.find({ team: scope.team, company_kod: scope.company_kod,
                    ypokatasthma: employee.ypokatasthma,
                    $or: mongoose.trusted([...dates].sort().map(date => ({
                        period_start: mongoose.trusted({ $lte: new Date(date) }),
                        period_end: mongoose.trusted({ $gte: new Date(date) })
                    })))
                }).session(session).lean();
                for (const period of periods) {
                    if (period.status !== 'OPEN' || period.active_calculation_id) {
                        throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED');
                    }
                    const fenced = await periodControlModel.updateOne({ _id: period._id, status: 'OPEN' },
                        { $inc: { write_fence_version: 1 } }, { session });
                    if (fenced.matchedCount !== 1) throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED');
                }
            }
            const result = await work({ session });
            workCompleted = true;
            return result;
        }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) {
        if (workCompleted) throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED');
        if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') {
            throw primaryDataWriteError('EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE');
        }
        throw error;
    }
}

module.exports = { runErganiPrimaryDataWrite, primaryDataWriteError };
