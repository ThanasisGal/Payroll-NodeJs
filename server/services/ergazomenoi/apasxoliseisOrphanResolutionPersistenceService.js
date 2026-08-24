'use strict';

const mongoose = require('mongoose');

const RAW_CARD_FIELDS = Object.freeze([
    'cards_apo_ora_01', 'cards_eos_ora_01', 'cards_apo_ora_02',
    'cards_eos_ora_02', 'cards_apo_ora_03', 'cards_eos_ora_03',
    'cards_ores_ergasias'
]);

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function comparable(value) {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value.toHexString === 'function') return value.toHexString();
    if (Array.isArray(value)) return value.map(comparable);
    if (isPlainObject(value)) return Object.fromEntries(Object.keys(value).sort()
        .map((key) => [key, comparable(value[key])]));
    return value;
}

function sameValue(left, right) {
    return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function removeClientRawCardUpdates(updates = {}) {
    const safe = { ...updates };
    for (const field of RAW_CARD_FIELDS) delete safe[field];
    return safe;
}

function canonicalOrphanResolutionMetadata(value = {}) {
    const interval = value.approved_interval || (
        value.approved_start || value.approved_end
            ? { start: value.approved_start || '', end: value.approved_end || '',
                durationHours: value.approved_hours ?? null }
            : {}
    );
    const reuseScope = value.reuse_scope || value.resolution_scope || 'ONE_TIME';
    const riskAcknowledged = value.risk_acknowledged ?? value.rest_risk_acknowledged ??
        value.risk_acknowledgement ?? false;
    const restViolation = value.rest_violation ??
        (Array.isArray(value.rest_conflicts) && value.rest_conflicts.length > 0);
    return {
        status: value.status || '',
        policy_version: value.policy_version || '',
        orphan_type: value.orphan_type || '',
        reuse_scope: reuseScope,
        approved_interval: interval,
        reusable_decision_rule: value.reusable_decision_rule || null,
        rest_violation: restViolation === true,
        risk_acknowledged: riskAcknowledged === true,
        rest_conflicts: Array.isArray(value.rest_conflicts) ? value.rest_conflicts : [],
        raw_cards_preserved: value.raw_cards_preserved === true,
        approved_by: value.approved_by || '',
        approved_at: value.approved_at || null
    };
}

function orphanResolutionSemanticView(value = {}) {
    const canonical = canonicalOrphanResolutionMetadata(value);
    delete canonical.approved_at;
    return canonical;
}

function isIdenticalOrphanResolution(oldRecord, updates) {
    return Object.entries(updates).every(([field, value]) => {
        if (field === 'orphan_card_resolution') {
            return sameValue(
                orphanResolutionSemanticView(oldRecord[field]),
                orphanResolutionSemanticView(value)
            );
        }
        return sameValue(oldRecord[field], value);
    });
}

function buildReviewCompareAndSetFilter({ oldRecord, schemaPaths = [] }) {
    const filter = {
        _id: oldRecord._id,
        team: oldRecord.team,
        company_kod: oldRecord.company_kod
    };
    const guardedPaths = [...new Set(schemaPaths)]
        .filter((field) => !['_id', '__v', 'team', 'company_kod'].includes(field));
    filter.$and = guardedPaths.map((field) => Object.hasOwn(oldRecord, field)
        ? { [field]: oldRecord[field] }
        : { [field]: mongoose.trusted({ $exists: false }) });
    return filter;
}

function buildAuditDiff(oldRecord, updates) {
    const oldValues = {};
    const newValues = {};
    for (const [field, value] of Object.entries(updates)) {
        if (sameValue(oldRecord[field], value)) continue;
        oldValues[field] = oldRecord[field] ?? '';
        newValues[field] = value ?? '';
    }
    return { oldValues, newValues };
}

function staleWriteError() {
    return Object.assign(new Error(
        'Η εγγραφή άλλαξε από άλλη ενέργεια. Ανανεώστε τα αποτελέσματα και προσπαθήστε ξανά.'
    ), { code: 'EMPLOYMENT_REVIEW_STALE_WRITE', statusCode: 409 });
}

function buildEmploymentReviewUpdateErrorResponse(error) {
    const known = Number.isInteger(error?.statusCode) && error.statusCode >= 400 &&
        error.statusCode < 500 && typeof error?.code === 'string' && error.code;
    return {
        status: known ? error.statusCode : 500,
        body: {
            success: false,
            code: known ? error.code : 'EMPLOYMENT_REVIEW_UPDATE_FAILED',
            message: known ? error.message
                : 'Η ενημέρωση δεν ολοκληρώθηκε. Παρακαλώ δοκιμάστε ξανά.'
        }
    };
}

async function persistOrphanResolutionWrite({
    oldRecord, semanticUpdates, changedBy, reason, now = new Date(), schemaPaths,
    rowModel, auditModel, createReusableApproval, session
}) {
    if (isIdenticalOrphanResolution(oldRecord, semanticUpdates)) {
        return { idempotent: true, updated: false };
    }
    const finalUpdates = {
        ...semanticUpdates,
        orphan_card_resolution: semanticUpdates.orphan_card_resolution
            ? { ...canonicalOrphanResolutionMetadata(semanticUpdates.orphan_card_resolution),
                approved_at: now }
            : semanticUpdates.orphan_card_resolution,
        is_locked: true,
        locked_by: changedBy,
        locked_at: now
    };
    const { oldValues, newValues } = buildAuditDiff(oldRecord, finalUpdates);
    const result = await rowModel.updateOne(
        buildReviewCompareAndSetFilter({ oldRecord, schemaPaths }),
        { $set: finalUpdates }, { session }
    );
    if (result?.matchedCount !== 1) throw staleWriteError();
    if (createReusableApproval) await createReusableApproval(session);
    await auditModel.create([{
        team: oldRecord.team, company_kod: oldRecord.company_kod,
        prodhlomena_oraria_id: oldRecord._id, kodikos: oldRecord.kodikos,
        ypokatasthma: oldRecord.ypokatasthma, hmeromhnia: oldRecord.hmeromhnia,
        changedBy, reason, oldValues, newValues
    }], { session });
    return { idempotent: false, updated: true, oldValues, newValues, finalUpdates };
}

module.exports = {
    RAW_CARD_FIELDS,
    removeClientRawCardUpdates,
    canonicalOrphanResolutionMetadata,
    orphanResolutionSemanticView,
    isIdenticalOrphanResolution,
    buildReviewCompareAndSetFilter,
    buildAuditDiff,
    buildEmploymentReviewUpdateErrorResponse,
    persistOrphanResolutionWrite
};
