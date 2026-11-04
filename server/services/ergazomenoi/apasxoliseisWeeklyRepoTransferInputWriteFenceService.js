'use strict';
const mongoose = require('mongoose');
const { ErgazomenoiModel, ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
function conflict(message, code) { return Object.assign(new Error(message), { statusCode: 409, code, blocking_reasons: [] }); }

// Retain write intents on the existing Employee mutation sequence and schedule
// versions, restoring their exact values in this transaction. Snapshot reads
// alone do not detect an input changed after the period fence was acquired.
async function claimWeeklyRepoTransferInputs({ rebuilt, scope, session }) {
    const changed = () => conflict('Η μεταφορά ρεπό σταμάτησε επειδή δεν επιβεβαιώθηκαν τα ισχύοντα στοιχεία της πρότασης. Δεν αποθηκεύτηκε αλλαγή σε αυτό το στάδιο. Αν είχε ήδη καταγραφεί απόφαση, η καταγραφή της διατηρείται.\n1. Ανανεώστε τον έλεγχο απασχολήσεων.\n2. Ελέγξτε τη νέα πρόταση και δοκιμάστε ξανά.\nΚωδικός αναφοράς: REPO_DECISION_INPUT_CHANGED.', 'REPO_DECISION_INPUT_CHANGED');
    if (!session?.inTransaction()) throw changed();
    const employee = await ErgazomenoiModel.findOne({ _id: rebuilt.context.employee._id,
        team: scope.team, company_kod: scope.company_kod }).select('+employee_profile_mutation_sequence').session(session).lean();
    if (!employee) throw changed();
    const versions = await ProdhlomenaOrariaModel.find({ team: scope.team, company_kod: scope.company_kod,
        _id: mongoose.trusted({ $in: rebuilt.context.weekRows.map(row => row._id) }) }).select('_id __v').session(session).lean();
    if (versions.length !== rebuilt.context.weekRows.length) throw changed();
    const claims = [[ErgazomenoiModel, employee, 'employee_profile_mutation_sequence'],
        ...versions.map(row => [ProdhlomenaOrariaModel, row, '__v'])];
    for (const [model, row, field] of claims) {
        const filter = { _id: row._id, team: scope.team, company_kod: scope.company_kod };
        const options = { session, timestamps: false };
        if ((await model.updateOne(filter, { $inc: { [field]: 1 } }, options)).matchedCount !== 1)
            throw changed();
        const restore = Object.hasOwn(row, field) ? { $set: { [field]: row[field] } } : { $unset: { [field]: 1 } };
        if ((await model.updateOne(filter, restore, options)).matchedCount !== 1)
            throw changed();
    }
}


module.exports = { claimWeeklyRepoTransferInputs };
