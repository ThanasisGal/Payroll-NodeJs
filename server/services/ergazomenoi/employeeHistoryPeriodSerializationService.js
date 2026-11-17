'use strict';

// Serialize the ABSENCE of period rows on the existing Company identity.
// A range read is not a MongoDB predicate lock. Every official period creator,
// lock transition and calculation acquisition shares this same write intent.
// No period, index, OPEN status or business value is manufactured. The existing
// company receives only a technical monotonic sequence, so a transaction which
// read the old absence cannot miss a period committed before it acquired intent.
const mongoose = require('mongoose');
const field = 'employee_history_period_mutation_sequence';
function unavailable() {
    return Object.assign(new Error('Η ενέργεια σταμάτησε επειδή δεν επιβεβαιώθηκε η κοινή προστασία εταιρείας και περιόδων. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή. 1. Ανανεώστε την εταιρεία και την περίοδο. ' +
        '2. Επαναλάβετε την ενέργεια μετά την αποκατάσταση της ασφαλούς αποθήκευσης. ' +
        'Κωδικός αναφοράς: PERIOD_CONTROL_COMPANY_SERIALIZATION_REQUIRED.'),
    { code: 'PERIOD_CONTROL_COMPANY_SERIALIZATION_REQUIRED', statusCode: 503 });
}
async function claimCompanyPeriodSerialization({ connection, scope, session }) {
    if (!connection?.collection || !session?.inTransaction?.() || typeof scope?.team !== 'string' ||
        !/^[a-f\d]{24}$/i.test(String(scope?.company_kod || ''))) throw unavailable();
    const collection = connection.collection('Companies');
    const identity = { _id: new mongoose.Types.ObjectId(String(scope.company_kod)), team: scope.team };
    const before = await collection.findOne(identity, { session, projection: { [field]: 1 } });
    if (!before || Object.hasOwn(before, field) && (!Number.isSafeInteger(before[field]) || before[field] < 0) || before[field] === Number.MAX_SAFE_INTEGER)
        throw unavailable();
    const previous = Object.hasOwn(before, field) ? before[field] : null;
    if ((await collection.updateOne({ ...identity, [field]: previous === null ? { $exists: false } : previous },
        { $inc: { [field]: 1 } }, { session })).matchedCount !== 1) throw unavailable();
    return { field, before: previous, after: (previous || 0) + 1 };
}
async function claimPeriodModelCompany({ periodControlModel, scope, session }) {
    // Existing pure unit tests inject models without a database. Production
    // Mongoose models always have db.collection; no request chooses this model.
    if (typeof periodControlModel?.db?.collection !== 'function') return;
    await claimCompanyPeriodSerialization({ connection: periodControlModel.db, scope, session });
}
module.exports = { field, claimCompanyPeriodSerialization, claimPeriodModelCompany };
