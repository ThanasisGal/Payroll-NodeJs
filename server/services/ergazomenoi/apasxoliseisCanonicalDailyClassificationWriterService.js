'use strict';

const { ProdhlomenaOrariaModel, ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const {
    classificationUpdates,
    applyCanonicalAbsenceMetrics
} = require('./apasxoliseisStage1DailyClassificationBulkService');
const { positiveClassification } = require('./apasxoliseisStage3FingerprintService');
const { applyPredeclaredRepoBookRule } =
    require('./apasxoliseisPredeclaredRepoBookRuleService');

const ALLOWED = new Set(['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK', 'REST_REPO']);

function error(code, message, statusCode = 400) {
    return Object.assign(new Error(message), { code, statusCode });
}

function buildCanonicalClassificationUpdates({ classification, leave_category = '', row = {} } = {}) {
    const normalized = String(classification || '').trim().toUpperCase();
    if (!ALLOWED.has(normalized)) throw error('INVALID_STAGE3_CLASSIFICATION',
        'Μη έγκυρος τελικός χαρακτηρισμός Stage 3.');
    if (['LEAVE', 'SICKNESS'].includes(normalized) &&
        !String(leave_category || '').trim()) {
        throw error(normalized === 'SICKNESS'
            ? 'SICKNESS_CATEGORY_REQUIRED' : 'LEAVE_CATEGORY_REQUIRED',
        'Η κατηγορία άδειας/ασθένειας είναι υποχρεωτική.');
    }
    if (['LEAVE', 'SICKNESS'].includes(normalized) &&
        String(leave_category).trim() === 'POSSIBLE_LEAVE') {
        throw error('POSSIBLE_LEAVE_NOT_HR_SELECTABLE',
            'Η ένδειξη POSSIBLE_LEAVE δεν είναι τελική κατηγορία επιλογής HR.');
    }
    if (normalized === 'NON_WORK') {
        return { apologistiko_biblio: true,
            kathgoria_ergasias_apologistika: 'ΜΕ', repo_apologistika: false,
            adeia_apologistika: false, kathgoria_adeias_apologistika: '',
            astheneia_apologistika: false, apousia_apologistika: false,
            ores_ergasias_apologistika: 0 };
    }
    if (normalized === 'REST_REPO') {
        return applyPredeclaredRepoBookRule(row, { apologistiko_biblio: true,
            kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
            adeia_apologistika: false, kathgoria_adeias_apologistika: '',
            astheneia_apologistika: false, apousia_apologistika: false,
            ores_ergasias_apologistika: 0 });
    }
    return classificationUpdates({ classification: normalized,
        kathgoria_adeias_apologistika: String(leave_category || '').trim() }, row);
}

function planCanonicalDailyClassification({ row = {}, classification,
    leave_category = '' } = {}) {
    return applyCanonicalAbsenceMetrics(row,
        buildCanonicalClassificationUpdates({ classification, leave_category, row }));
}

async function writeCanonicalDailyClassification({
    row, classification, leave_category = '', reason, actor_name, session,
    prodhlomenaModel = ProdhlomenaOrariaModel,
    prodhlomenaAuditModel = ProdhlomenaOrariaAuditModel
} = {}) {
    if (!session) throw error('DAILY_CLASSIFICATION_TRANSACTION_REQUIRED',
        'Απαιτείται ασφαλής συναλλαγή.', 503);
    const updates = planCanonicalDailyClassification({ row, classification, leave_category });
    const oldValues = {}; const newValues = {};
    for (const [field, value] of Object.entries(updates)) {
        if (String(row?.[field] ?? '') !== String(value ?? '')) {
            oldValues[field] = row?.[field] ?? '';
            newValues[field] = value ?? '';
        }
    }
    if (!Object.keys(newValues).length) return { unchanged: true, row,
        previous_classification: positiveClassification(row), updates };
    const write = await prodhlomenaModel.updateOne({ _id: row._id,
        team: row.team, company_kod: row.company_kod, updatedAt: row.updatedAt }, {
        $set: { ...updates, is_locked: true, locked_by: actor_name,
            locked_at: new Date() }
    }, { session });
    if (Number(write?.matchedCount ?? write?.n ?? 0) !== 1) {
        throw error('DAILY_REVIEW_INPUT_CHANGED',
            'Η ημερήσια εγγραφή άλλαξε. Επαναλάβετε τον έλεγχο.', 409);
    }
    await prodhlomenaAuditModel.create([{ team: row.team, company_kod: row.company_kod,
        prodhlomena_oraria_id: row._id, kodikos: row.kodikos,
        ypokatasthma: row.ypokatasthma, hmeromhnia: row.hmeromhnia,
        changedBy: actor_name, reason: String(reason || '').trim(), oldValues, newValues
    }], { session });
    return { unchanged: false, previous_classification: positiveClassification(row),
        updates, row: { ...row, ...updates } };
}

module.exports = { ALLOWED, applyPredeclaredRepoBookRule,
    buildCanonicalClassificationUpdates, planCanonicalDailyClassification,
    writeCanonicalDailyClassification };
