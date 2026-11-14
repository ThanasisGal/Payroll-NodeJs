'use strict';

const { buildDeclaredScheduleUpdate } = require('./prodhlomenaOrariaSchedulePolicy');
const { buildDigitalCardsUpdate } = require('./prodhlomenaOrariaCardsPolicy');

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function declaredPipelineState(current, declared) {
    if (current?.ergani_pipeline && same(buildDeclaredScheduleUpdate(current, { sourceOnly: true }),
        buildDeclaredScheduleUpdate(declared, { sourceOnly: true }))) return current.ergani_pipeline;
    return { ...current?.ergani_pipeline, cards_pending: true, calculation_pending: true };
}

function cardsPipelineState(current, cards) {
    const changed = !current?.ergani_pipeline || current.ergani_pipeline.cards_pending ||
        !same(buildDigitalCardsUpdate(current), buildDigitalCardsUpdate(cards));
    return { ...current?.ergani_pipeline, cards_pending: false,
        calculation_pending: changed || current.ergani_pipeline.calculation_pending === true };
}

function pendingSourceStage(rows = []) {
    if (rows.some(row => row.ergani_pipeline?.cards_pending === true)) return 'CARDS';
    if (rows.some(row => row.ergani_pipeline?.calculation_pending === true)) return 'CALCULATION';
    return null;
}

function assertCardsReceivedForCalculation(rows = []) {
    if (!rows.some(row => row.ergani_pipeline?.cards_pending === true)) return;
    const code = 'ERGANI_CARDS_REQUIRED_BEFORE_CALCULATION';
    throw Object.assign(new Error('Ο υπολογισμός σταμάτησε επειδή άλλαξαν τα προδηλωμένα ωράρια και εκκρεμεί η λήψη καρτών για την ίδια περίοδο. ' +
        '1. Εκτελέστε τη Λήψη Ψηφιακών Καρτών για την εταιρεία, το υποκατάστημα και τις ίδιες ημερομηνίες. ' +
        '2. Εκτελέστε ξανά τον Υπολογισμό και κατόπιν τον Έλεγχο. Δεν χρειάζεται νέα λήψη προδηλωμένων. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή στα αποτελέσματα υπολογισμού από αυτή την προσπάθεια. Κωδικός αναφοράς: ' + code),
    { code, statusCode: 409 });
}

function calculatedPipelineState(row) {
    return row.ergani_pipeline ? { ...row.ergani_pipeline, calculation_pending: false } : undefined;
}

// Called only after daily, weekly and automatic calculations have all succeeded.
// A single transaction acknowledges the complete set; partial acknowledgement
// must not make an unfinished calculation look current.
async function completeCalculationPipeline({ rows, model, runTransaction }) {
    const tracked = rows.filter(row => row.ergani_pipeline && row.is_locked !== true);
    if (!tracked.length) return;
    await runTransaction(async session => {
        const result = await model.bulkWrite(tracked.map(row => ({ updateOne: {
            filter: { _id: row._id, is_locked: require('mongoose').trusted({ $ne: true }) },
            update: { $set: { ergani_pipeline: calculatedPipelineState(row) } }, upsert: false
        } })), { ordered: false, session });
        if (result.matchedCount !== tracked.length) {
            const code = 'ERGANI_CALCULATION_COMPLETION_NOT_APPLIED';
            throw Object.assign(new Error('Δεν επιβεβαιώθηκε η ολοκλήρωση του υπολογισμού για όλες τις ημέρες. ' +
                '1. Ελέγξτε αν άλλαξε το κλείδωμα της περιόδου ή κάποιας εγγραφής. ' +
                '2. Ζητήστε έλεγχο από την υποστήριξη πριν επαναλάβετε τον Υπολογισμό. ' +
                'Τυχόν αποθηκευμένα ενδιάμεσα αποτελέσματα παραμένουν μη επίκαιρα. Κωδικός αναφοράς: ' + code),
            { code, statusCode: 409 });
        }
    });
}

module.exports = { declaredPipelineState, cardsPipelineState, pendingSourceStage,
    assertCardsReceivedForCalculation, calculatedPipelineState, completeCalculationPipeline };
