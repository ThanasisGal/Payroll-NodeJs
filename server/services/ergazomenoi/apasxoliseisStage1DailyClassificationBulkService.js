'use strict';

const BULK_DAILY_CLASSIFICATION_CONCURRENCY = 12;
const { buildAutoAttendanceReset } = require('./apasxoliseisAttendanceDerivedScheduleService');
const { buildApasxoliseisScenarioFacts } = require('./apasxoliseisScenarioFactsService');
const {
    matchApasxoliseisScenarioFacts,
    SCENARIO_CODES
} = require('./apasxoliseisScenarioMatcherService');

const ALLOWED_CLASSIFICATIONS = new Set([
    'UNCLASSIFIED', 'LEAVE', 'SICKNESS', 'ABSENCE', 'HOLIDAY'
]);
const ERGANI_II_SICKNESS_LEAVE_CATEGORY = 'ΑΔΑΣ';

// Locked future ERGANI II contract: a daily sickness remains sickness internally,
// but a future leave submission must project it as leave category ΑΔΑΣ.

function serviceError(code, message, statusCode = 400) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function normalizeChange(change = {}) {
    const rowId = String(change.row_id || '').trim();
    const classification = String(change.classification || '').trim().toUpperCase();
    if (!rowId || !ALLOWED_CLASSIFICATIONS.has(classification)) {
        throw serviceError('INVALID_DAILY_CLASSIFICATION', 'Μη έγκυρη ημερήσια αλλαγή.');
    }
    const leaveCategory = String(change.kathgoria_adeias_apologistika || '').trim();
    if (classification === 'LEAVE' && (!leaveCategory || leaveCategory === 'POSSIBLE_LEAVE')) {
        throw serviceError('LEAVE_CATEGORY_REQUIRED', 'Η κατηγορία άδειας είναι υποχρεωτική.');
    }
    return { row_id: rowId, classification,
        ...(classification === 'LEAVE' ? { kathgoria_adeias_apologistika: leaveCategory } : {}),
        ...(classification === 'SICKNESS'
            ? { kathgoria_adeias_apologistika: ERGANI_II_SICKNESS_LEAVE_CATEGORY } : {}) };
}

function classificationUpdates(change, row = {}) {
    if (change.classification === 'HOLIDAY') {
        return {
            ...buildAutoAttendanceReset(),
            argia: true,
            repo_apologistika: false,
            adeia_apologistika: false,
            kathgoria_adeias_apologistika: '',
            astheneia_apologistika: false,
            apousia_apologistika: false,
            ores_ergasias_apologistika: Number(row.ores_ergasias || 0),
            ores_pragmatikhs_ergasias_apologistika: 0
        };
    }
    return {
        repo_apologistika: false,
        adeia_apologistika: change.classification === 'LEAVE',
        kathgoria_adeias_apologistika: change.classification === 'SICKNESS'
            ? ERGANI_II_SICKNESS_LEAVE_CATEGORY
            : (change.classification === 'LEAVE' ? change.kathgoria_adeias_apologistika : ''),
        astheneia_apologistika: change.classification === 'SICKNESS',
        apousia_apologistika: change.classification === 'ABSENCE'
    };
}

function resolveAuthoritativeHolidayClassification({ row = {}, holiday = {},
    companyFlags = {} } = {}) {
    const facts = buildApasxoliseisScenarioFacts(row, { holiday, companyFlags });
    const decision = matchApasxoliseisScenarioFacts(facts);
    return Object.freeze({
        eligible: decision.scenario_code ===
            SCENARIO_CODES.DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED,
        scenario_code: decision.scenario_code,
        decision
    });
}

async function loadAuthoritativeStage1HolidayContext({ team, companyId, etos,
    periodStart, periodEnd, presentationSnapshot = null, loadHolidayContext } = {}) {
    if (typeof loadHolidayContext !== 'function') {
        throw serviceError('HOLIDAY_CONTEXT_LOADER_REQUIRED',
            'Δεν είναι διαθέσιμο το authoritative πλαίσιο αργιών.', 500);
    }
    // Τα frozen calendar facts δεν περιέχουν όλα τα mandatory/company-operation
    // facts που απαιτεί ο authoritative scenario matcher.
    void presentationSnapshot;
    return loadHolidayContext({ team, companyId, etos, periodStart, periodEnd });
}

function nonNegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function applyCanonicalAbsenceMetrics(currentRow = {}, updates = {}) {
    const result = { ...updates };
    if (!Object.prototype.hasOwnProperty.call(result, 'apousia_apologistika')) return result;
    if (result.apousia_apologistika === true) {
        const currentIsCanonicalAbsence = currentRow.apousia_apologistika === true;
        result.ores_apoysias_base_apologistika = currentIsCanonicalAbsence
            ? nonNegativeNumber(currentRow.ores_apoysias_base_apologistika)
            : nonNegativeNumber(currentRow.ores_apoysias_apologistika);
        result.ores_apoysias_apologistika = nonNegativeNumber(currentRow.ores_ergasias);
        result.hmeres_apoysias_apologistika = 1;
    } else if (currentRow.apousia_apologistika === true) {
        result.ores_apoysias_apologistika = nonNegativeNumber(
            currentRow.ores_apoysias_base_apologistika
        );
        result.hmeres_apoysias_apologistika = 0;
    }
    return result;
}

function applyCardDerivedAbsenceMetrics(currentRow = {}, updates = {}) {
    if (!Object.prototype.hasOwnProperty.call(updates, 'ores_apoysias_apologistika')) {
        return { ...updates };
    }
    const cardDerivedHours = nonNegativeNumber(updates.ores_apoysias_apologistika);
    if (currentRow.apousia_apologistika === true) {
        return { ...updates,
            ores_apoysias_base_apologistika: cardDerivedHours,
            ores_apoysias_apologistika: nonNegativeNumber(currentRow.ores_ergasias),
            hmeres_apoysias_apologistika: 1 };
    }
    return { ...updates,
        ores_apoysias_base_apologistika: cardDerivedHours,
        ores_apoysias_apologistika: cardDerivedHours,
        hmeres_apoysias_apologistika: 0 };
}

function resolveEffectiveAbsenceMetrics(row = {}) {
    const hasExplicitDays = row.hmeres_apoysias_apologistika !== undefined &&
        row.hmeres_apoysias_apologistika !== null;
    if (!hasExplicitDays && row.apousia_apologistika === true) {
        return { days: 1, hours: nonNegativeNumber(row.ores_ergasias) };
    }
    return { days: nonNegativeNumber(row.hmeres_apoysias_apologistika),
        hours: nonNegativeNumber(row.ores_apoysias_apologistika) };
}

function buildEffectiveAbsenceDaysAggregationExpression() {
    return { $cond: [
        { $eq: [{ $type: '$hmeres_apoysias_apologistika' }, 'missing'] },
        { $cond: [{ $eq: ['$apousia_apologistika', true] }, 1, 0] },
        { $ifNull: ['$hmeres_apoysias_apologistika', 0] }
    ] };
}

function buildEffectiveAbsenceHoursAggregationExpression() {
    return { $cond: [
        { $and: [
            { $eq: [{ $type: '$hmeres_apoysias_apologistika' }, 'missing'] },
            { $eq: ['$apousia_apologistika', true] }
        ] },
        { $ifNull: ['$ores_ergasias', 0] },
        { $ifNull: ['$ores_apoysias_apologistika', 0] }
    ] };
}

async function mapLimited(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function run() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

async function saveStage1DailyClassificationsBulk({ changes, reason, applyOne,
    concurrency = BULK_DAILY_CLASSIFICATION_CONCURRENCY } = {}) {
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) throw serviceError('REASON_REQUIRED', 'Η αιτιολογία είναι υποχρεωτική.');
    if (normalizedReason.length > 1000) throw serviceError('REASON_TOO_LONG', 'Η αιτιολογία είναι πολύ μεγάλη.');
    if (!Array.isArray(changes) || changes.length === 0) {
        throw serviceError('CHANGES_REQUIRED', 'Δεν υπάρχουν ημερήσιες αλλαγές για αποθήκευση.');
    }
    if (typeof applyOne !== 'function') throw serviceError('APPLY_ONE_REQUIRED', 'Δεν είναι διαθέσιμη η ασφαλής ημερήσια εγγραφή.', 500);
    const normalized = changes.map(normalizeChange);
    if (new Set(normalized.map((item) => item.row_id)).size !== normalized.length) {
        throw serviceError('DUPLICATE_ROW_ID', 'Η ίδια ημέρα περιλαμβάνεται περισσότερες από μία φορές.');
    }
    const results = await mapLimited(normalized, concurrency, async (change) => {
        try {
            const outcome = await applyOne({ row_id: change.row_id,
                classification: change.classification,
                updates: classificationUpdates(change), reason: normalizedReason });
            return { row_id: change.row_id, status: outcome?.unchanged ? 'UNCHANGED' : 'SAVED',
                ...(outcome?.record ? { record: outcome.record } : {}) };
        } catch (error) {
            const retry = ['PERIOD_CONTROL_STATE_CONFLICT', 'PERIOD_CONTROL_STALE',
                'DAILY_REVIEW_INPUT_CHANGED'].includes(error?.code);
            return { row_id: change.row_id, status: retry ? 'REVIEW_REQUIRED' : 'FAILED',
                code: error?.code || 'DAILY_CLASSIFICATION_FAILED',
                message: error?.statusCode && error.statusCode < 500
                    ? error.message : 'Η ημερήσια αλλαγή δεν αποθηκεύτηκε.' };
        }
    });
    return { requested_count: results.length,
        saved_count: results.filter((item) => item.status === 'SAVED').length,
        unchanged_count: results.filter((item) => item.status === 'UNCHANGED').length,
        failed_count: results.filter((item) => ['FAILED', 'REVIEW_REQUIRED'].includes(item.status)).length,
        results };
}

module.exports = { BULK_DAILY_CLASSIFICATION_CONCURRENCY, ERGANI_II_SICKNESS_LEAVE_CATEGORY,
    classificationUpdates, resolveAuthoritativeHolidayClassification,
    loadAuthoritativeStage1HolidayContext,
    applyCanonicalAbsenceMetrics, applyCardDerivedAbsenceMetrics,
    resolveEffectiveAbsenceMetrics,
    buildEffectiveAbsenceDaysAggregationExpression,
    buildEffectiveAbsenceHoursAggregationExpression,
    saveStage1DailyClassificationsBulk };
