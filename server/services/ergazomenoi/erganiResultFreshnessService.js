'use strict';

const { pendingSourceStage } = require('./erganiDataPipelineService');
const PENDING_CODES = new Set(['ERGANI_CARDS_RECEIPT_REQUIRED', 'ERGANI_CALCULATION_REQUIRED',
    'ERGANI_CARDS_REQUIRED_BEFORE_CALCULATION']);

function pendingResultError(stage) {
    const cards = stage === 'CARDS';
    const code = cards ? 'ERGANI_CARDS_RECEIPT_REQUIRED' : 'ERGANI_CALCULATION_REQUIRED';
    const message = 'Η ενέργεια σταμάτησε επειδή τα αποθηκευμένα αποτελέσματα δεν είναι επίκαιρα μετά την ενημέρωση των πρωτογενών στοιχείων. ' +
        (cards ? '1. Εκτελέστε Λήψη Ψηφιακών Καρτών για την ίδια εταιρεία, υποκατάστημα και περίοδο. ' +
            '2. Συνεχίστε με Υπολογισμό και Έλεγχο. Δεν χρειάζεται νέα λήψη προδηλωμένων. '
            : '1. Εκτελέστε Υπολογισμό για την ίδια εταιρεία, υποκατάστημα και περίοδο. ' +
            '2. Συνεχίστε με Έλεγχο. Δεν χρειάζεται νέα λήψη προδηλωμένων ή καρτών. ') +
        'Η ενέργεια αυτή δεν αποθήκευσε καμία αλλαγή. Κωδικός αναφοράς: ' + code;
    return Object.assign(new Error(message), { code, statusCode: 409, pendingStage: stage });
}

function assertErganiResultsCurrent(rows = []) {
    const stage = pendingSourceStage(Array.isArray(rows) ? rows : []);
    if (stage) throw pendingResultError(stage);
}

// Read the source scope before derived-value filters can hide pending rows and
// expose a plausible but incomplete total. Never reads employment history.
async function assertErganiScopeCurrent(model, filter, session = null) {
    const scope = Object.fromEntries(['team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia', '_id']
        .filter(field => filter[field] !== undefined).map(field => [field, filter[field]]));
    for (const value of Object.values(scope)) {
        if (value && typeof value === 'object' && Object.keys(value).some(key => key.startsWith('$'))) {
            require('mongoose').trusted(value);
        }
    }
    const query = model.find({ ...scope, $or: require('mongoose').trusted([
        { 'ergani_pipeline.cards_pending': true }, { 'ergani_pipeline.calculation_pending': true }
    ]) }).select('ergani_pipeline');
    if (session) query.session(session);
    assertErganiResultsCurrent(await query.lean());
}

function pendingResultResponse(error) {
    if (error?.code === 'ERGANI_CACHED_RESULT_STALE') {
        const safe = cachedResultError();
        return { success: false, code: safe.code, message: safe.message, error: safe.message,
            pendingStages: ['REVIEW'], save_state: 'READ_ONLY', pipelineComplete: false };
    }
    if (!PENDING_CODES.has(error?.code)) return null;
    const safe = pendingResultError(error.code.includes('CARDS') ? 'CARDS' : 'CALCULATION');
    return { success: false, code: safe.code, message: safe.message, error: safe.message,
        pendingStages: safe.pendingStage === 'CARDS' ? ['CARDS', 'CALCULATION', 'REVIEW'] : ['CALCULATION', 'REVIEW'],
        save_state: 'READ_ONLY', pipelineComplete: false };
}

function cachedResultError() {
    return Object.assign(new Error('Το προσωρινό PDF δεν μπορεί να χρησιμοποιηθεί επειδή τα στοιχεία έχουν αλλάξει ή δεν επιβεβαιώνεται σε ποια στοιχεία βασίστηκε. ' +
        '1. Εκτελέστε νέα Αναζήτηση στην ίδια εταιρεία, υποκατάστημα και περίοδο. ' +
        '2. Δημιουργήστε νέα προεπισκόπηση και κατόπιν κατεβάστε το PDF. Δεν χρειάζεται επανάληψη ολοκληρωμένων προηγούμενων σταδίων. ' +
        'Η λήψη αυτή δεν αποθήκευσε καμία αλλαγή. Κωδικός αναφοράς: ERGANI_CACHED_RESULT_STALE'),
    { code: 'ERGANI_CACHED_RESULT_STALE', statusCode: 409 });
}

function assertErganiRevisionMatches(expected, actual) {
    if (!expected || expected !== actual) throw cachedResultError();
}

async function readErganiSourceRevision(scope, { rowModel, periodModel } = {}) {
    const mongoose = require('mongoose');
    const base = { team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma };
    const { dateKeyUtc, startOfWeekMondayUtc, endOfWeekSundayUtc } = require('../../utils/date/mondaySundayWeek');
    const start = startOfWeekMondayUtc(scope.period_start), end = endOfWeekSundayUtc(scope.period_end);
    const periods = await (periodModel || require('../../models/apasxoliseisPeriodControl')).find({ ...base,
        period_start: mongoose.trusted({ $lte: end }), period_end: mongoose.trusted({ $gte: start }) })
        .select('_id period_start period_end write_fence_version successful_calculation_version status frozen_snapshot_fingerprint')
        .sort({ _id: 1 }).lean();
    const frozen = periods.find(period => period.status === 'FINALIZED' && period.frozen_snapshot_fingerprint &&
        dateKeyUtc(period.period_start) === dateKeyUtc(scope.period_start) &&
        dateKeyUtc(period.period_end) === dateKeyUtc(scope.period_end));
    if (frozen) return JSON.stringify(['FROZEN', frozen.frozen_snapshot_fingerprint]);
    await assertErganiScopeCurrent(rowModel || require('../../models/ergazomenoi').ProdhlomenaOrariaModel,
        { ...base, hmeromhnia: mongoose.trusted({ $gte: start, $lte: end }) });
    return JSON.stringify(periods.map(period => [String(period._id), period.write_fence_version || 0,
        period.successful_calculation_version || 0, period.status, period.frozen_snapshot_fingerprint || '']));
}

module.exports = { assertErganiResultsCurrent, assertErganiScopeCurrent, pendingResultResponse,
    assertErganiRevisionMatches, readErganiSourceRevision };
