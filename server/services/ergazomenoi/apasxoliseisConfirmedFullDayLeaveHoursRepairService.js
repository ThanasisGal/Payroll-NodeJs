'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const ModelsA = require('../../models/stathera_arxeia');
const { normalizeScope } = require('./apasxoliseisPeriodControlService');
const { buildHrSelectableLeaveCategoryQuery, isInternalPossibleLeaveCategory } =
    require('./apasxoliseisHrLeaveCategoryPolicyService');

const AUDIT_CONTEXT = 'Repair confirmed full-day leave credited hours after Stage-1 canonical fix';
const RELEVANT_FIELDS = [
    'adeia_apologistika', 'kathgoria_adeias_apologistika', 'ores_ergasias',
    'ores_ergasias_apologistika', 'ores_pragmatikhs_ergasias_apologistika',
    'explicit_hourly_leave_hours', 'egkekrimenh_oroadeia_apologistika',
    'egkekrimena_diastimata_oroadeias_apologistika',
    'apo_ora_egkekrimenhs_oroadeias_apologistika',
    'eos_ora_egkekrimenhs_oroadeias_apologistika',
    'astheneia', 'astheneia_apologistika', 'apousia_apologistika',
    'hmeres_apoysias_apologistika', 'ores_apoysias_apologistika',
    'repo', 'repo_apologistika', 'is_locked', 'locked_by', 'locked_at'
];
const text = value => String(value ?? '').trim();
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);
const truthy = value => value === true;

function normalizedScope(input) {
    const scope = normalizeScope(input);
    return { ...scope, period_start: scope.period_start.toISOString().slice(0, 10),
        period_end: scope.period_end.toISOString().slice(0, 10) };
}

function hasHourlyLeaveMarker(row = {}) {
    return Number(row.explicit_hourly_leave_hours) > 0 ||
        row.egkekrimenh_oroadeia_apologistika === true ||
        (Array.isArray(row.egkekrimena_diastimata_oroadeias_apologistika) &&
            row.egkekrimena_diastimata_oroadeias_apologistika.length > 0) ||
        text(row.apo_ora_egkekrimenhs_oroadeias_apologistika) !== '' ||
        text(row.eos_ora_egkekrimenhs_oroadeias_apologistika) !== '';
}

function identifyRepairCandidate(row = {}, hrSelectableCategoryCodes = new Set()) {
    const category = text(row.kathgoria_adeias_apologistika);
    const scheduled = row.ores_ergasias;
    const reasons = [];
    if (row.adeia_apologistika !== true) reasons.push('NOT_CONFIRMED_LEAVE');
    if (!category) reasons.push('EMPTY_LEAVE_CATEGORY');
    else if (isInternalPossibleLeaveCategory(category)) reasons.push('POSSIBLE_LEAVE');
    else if (!hrSelectableCategoryCodes.has(category)) reasons.push('NON_HR_SELECTABLE_LEAVE_CATEGORY');
    if (hasHourlyLeaveMarker(row)) reasons.push('HOURLY_LEAVE');
    if (truthy(row.astheneia) || truthy(row.astheneia_apologistika)) reasons.push('SICKNESS');
    if (truthy(row.apousia_apologistika) || Number(row.hmeres_apoysias_apologistika) > 0 ||
        Number(row.ores_apoysias_apologistika) > 0) reasons.push('ABSENCE');
    if (truthy(row.repo) || truthy(row.repo_apologistika)) reasons.push('REPO');
    if (row.is_locked !== true) reasons.push('NOT_LOCKED');
    if (!finiteNumber(scheduled) || scheduled < 0) reasons.push('INVALID_SCHEDULED_HOURS');
    const proposedCredited = finiteNumber(scheduled) && scheduled >= 0 ? scheduled : null;
    const currentCredited = row.ores_ergasias_apologistika;
    const currentActual = row.ores_pragmatikhs_ergasias_apologistika;
    const needsRepair = proposedCredited !== null &&
        (!Object.is(currentCredited, proposedCredited) || !Object.is(currentActual, 0));
    return { repairable: reasons.length === 0 && needsRepair,
        alreadyCorrect: reasons.length === 0 && !needsRepair, exclusionReasons: reasons,
        proposedCredited, proposedActual: 0 };
}

function sourceSnapshot(row) {
    return Object.fromEntries(['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia',
        ...RELEVANT_FIELDS].map(key => [key, key === '_id' ? String(row[key]) :
        row[key] instanceof Date ? row[key].toISOString() : row[key]]));
}

function safeRow(row, decision) {
    return { employee_code: text(row.kodikos), date: row.hmeromhnia instanceof Date
        ? row.hmeromhnia.toISOString().slice(0, 10) : String(row.hmeromhnia).slice(0, 10),
    leave_category: text(row.kathgoria_adeias_apologistika), scheduled_hours: row.ores_ergasias,
    current_credited_hours: row.ores_ergasias_apologistika,
    proposed_credited_hours: decision.proposedCredited,
    current_actual_work_hours: row.ores_pragmatikhs_ergasias_apologistika,
    proposed_actual_work_hours: decision.proposedActual,
    status: decision.repairable ? 'REPAIRABLE' : decision.alreadyCorrect ? 'ALREADY_CORRECT' : 'EXCLUDED',
    exclusion_reasons: decision.exclusionReasons };
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
        .map(key => [key, stable(value[key])]));
    return value;
}
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

async function buildRepairPreview({ scope: rawScope, rowModel = ProdhlomenaOrariaModel,
    leaveCategoryModel = ModelsA.KathgoriesAdeiasModel } = {}) {
    const scope = normalizedScope(rawScope);
    const [rows, categories] = await Promise.all([
        rowModel.find({ team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma,
            hmeromhnia: mongoose.trusted({
                $gte: new Date(`${scope.period_start}T00:00:00.000Z`),
                $lte: new Date(`${scope.period_end}T23:59:59.999Z`)
            }),
            adeia_apologistika: true })
            .select(['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia',
                ...RELEVANT_FIELDS].join(' ')).sort({ hmeromhnia: 1, kodikos: 1, _id: 1 }).lean(),
        leaveCategoryModel.find(buildHrSelectableLeaveCategoryQuery()).select('kodikos').lean()
    ]);
    const categoryCodes = new Set(categories.map(item => text(item.kodikos)).filter(Boolean));
    const evaluated = rows.map(row => ({ row, decision: identifyRepairCandidate(row, categoryCodes) }));
    const repairable = evaluated.filter(item => item.decision.repairable);
    const excluded = evaluated.filter(item => item.decision.exclusionReasons.length > 0);
    const exclusionReasons = {};
    for (const item of excluded) for (const reason of item.decision.exclusionReasons) {
        exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1;
    }
    const fingerprintInput = { scope, rows: evaluated.map(item => ({ source: sourceSnapshot(item.row),
        employee_code: text(item.row.kodikos), date: item.row.hmeromhnia,
        classification: item.decision })) };
    return { scope, matched_count: rows.length,
        already_correct_count: evaluated.filter(item => item.decision.alreadyCorrect).length,
        repairable_count: repairable.length, excluded_count: excluded.length,
        exclusion_reasons: exclusionReasons, rows: evaluated.map(item => safeRow(item.row, item.decision)),
        preview_fingerprint: fingerprint(fingerprintInput),
        _repairable: repairable.map(item => ({ row: item.row, source: sourceSnapshot(item.row),
            proposedCredited: item.decision.proposedCredited })) };
}

function publicPreview(preview) {
    const { _repairable, ...safe } = preview; return safe;
}

function casFilter(item) {
    const filter = {};
    for (const [key, value] of Object.entries(item.source)) {
        filter[key] = value === undefined ? { $exists: false } : value;
    }
    return filter;
}

async function applyRepairBatch({ scope, previewFingerprint, confirmed, reason, changedBy,
    rowModel = ProdhlomenaOrariaModel, auditModel = ProdhlomenaOrariaAuditModel,
    leaveCategoryModel = ModelsA.KathgoriesAdeiasModel, connection = mongoose.connection } = {}) {
    if (confirmed !== true) throw Object.assign(new Error('Explicit confirmation is required'), { code: 'CONFIRMATION_REQUIRED' });
    if (!text(reason)) throw Object.assign(new Error('A non-empty reason is required'), { code: 'REASON_REQUIRED' });
    if (!text(changedBy)) throw Object.assign(new Error('A non-empty changedBy is required'), { code: 'ACTOR_REQUIRED' });
    if (!/^[a-f\d]{64}$/.test(text(previewFingerprint))) throw Object.assign(new Error('A valid preview fingerprint is required'), { code: 'PREVIEW_REQUIRED' });
    const preview = await buildRepairPreview({ scope, rowModel, leaveCategoryModel });
    if (preview.preview_fingerprint !== previewFingerprint) throw Object.assign(
        new Error('Preview set changed; obtain a new preview'), { code: 'STALE_PREVIEW' });
    let repaired = 0;
    const stale = [];
    for (const item of preview._repairable) {
        const session = await connection.startSession();
        let outcome = 'STALE';
        try {
            await session.withTransaction(async () => {
                const result = await rowModel.updateOne(casFilter(item), { $set: {
                    ores_ergasias_apologistika: item.proposedCredited,
                    ores_pragmatikhs_ergasias_apologistika: 0
                } }, { session });
                if (Number(result?.matchedCount ?? result?.n ?? 0) !== 1) {
                    return;
                }
                await auditModel.create([{ team: item.row.team, company_kod: item.row.company_kod,
                    prodhlomena_oraria_id: item.row._id, kodikos: item.row.kodikos,
                    ypokatasthma: item.row.ypokatasthma, hmeromhnia: item.row.hmeromhnia,
                    changedBy: text(changedBy), reason: `${AUDIT_CONTEXT}: ${text(reason)}`,
                    oldValues: {
                        ores_ergasias_apologistika: item.row.ores_ergasias_apologistika,
                        ores_pragmatikhs_ergasias_apologistika: item.row.ores_pragmatikhs_ergasias_apologistika
                    }, newValues: { ores_ergasias_apologistika: item.proposedCredited,
                        ores_pragmatikhs_ergasias_apologistika: 0 }
                }], { session });
                outcome = 'REPAIRED';
            });
        } finally { await session.endSession(); }
        if (outcome === 'REPAIRED') repaired++;
        else stale.push({ employee_code: text(item.row.kodikos),
            date: item.row.hmeromhnia.toISOString().slice(0, 10),
            status: 'STALE / REVIEW_REQUIRED' });
    }
    return { mode: 'APPLY', repairable_count: preview.repairable_count, repaired_count: repaired,
        stale_count: stale.length, stale };
}

module.exports = { AUDIT_CONTEXT, hasHourlyLeaveMarker, identifyRepairCandidate,
    buildRepairPreview, publicPreview, applyRepairBatch };
