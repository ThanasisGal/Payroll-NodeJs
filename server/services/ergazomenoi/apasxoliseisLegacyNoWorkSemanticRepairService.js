'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const {
    ErgazomenoiModel,
    ProdhlomenaOrariaModel,
    ProdhlomenaOrariaAuditModel,
    IstorikoProslhpseonAllagonModel
} = require('../../models/ergazomenoi');
const { normalizeScope } = require('./apasxoliseisPeriodControlService');
const { planCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService');
const { resolveNoWorkDaySemanticForDate } = require(
    './apasxoliseisReviewEmploymentProfileService');
const {
    employeeKey,
    preloadBorrowedEmploymentProfileContexts,
    resolveEffectiveEmploymentProfileForReviewDate
} = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { loadAppliedRepoTransferProtectionContext } = require(
    './apasxoliseisWeeklyRepoTransferAppliedProtectionContextService');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');

const AUDIT_CONTEXT = 'Normalize legacy no-work/repo semantic after AN/ME policy correction';
const CANONICAL_FIELDS = Object.freeze([
    'apologistiko_biblio', 'kathgoria_ergasias_apologistika', 'repo_apologistika',
    'adeia_apologistika', 'kathgoria_adeias_apologistika', 'astheneia_apologistika',
    'apousia_apologistika', 'ores_ergasias_apologistika'
]);
const APOLOGISTIKO_INTERVAL_FIELDS = Object.freeze([
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
    'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
]);
const POSITIVE_ACTIVITY_FIELDS = Object.freeze([
    'ores_nyxtas_apologistika', 'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika', 'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika', 'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika', 'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika', 'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika',
    'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
]);
const SOURCE_FIELDS = Object.freeze([
    'kathgoria_ergasias', 'repo',
    'apo_ora_01', 'eos_ora_01', 'apo_ora_02', 'eos_ora_02',
    'apo_ora_03', 'eos_ora_03', 'ores_ergasias',
    'apologistiko_biblio', 'kathgoria_ergasias_apologistika', 'repo_apologistika',
    'adeia', 'hr_declared_leave', 'kathgoria_adeias', 'adeia_apologistika',
    'kathgoria_adeias_apologistika', 'astheneia', 'astheneia_apologistika',
    'apousia_apologistika', 'argia', 'argia_apologistika',
    'cards_ores_ergasias', 'cards_apo_ora_01', 'cards_eos_ora_01',
    'cards_apo_ora_02', 'cards_eos_ora_02', 'cards_apo_ora_03', 'cards_eos_ora_03',
    'orphan_card_resolution', 'ores_ergasias_apologistika',
    'ores_pragmatikhs_ergasias_apologistika', 'is_locked', 'locked_by', 'locked_at',
    'egkekrimenh_oroadeia_apologistika', 'explicit_hourly_leave_hours',
    'egkekrimena_diastimata_oroadeias_apologistika',
    'hmeres_apoysias_apologistika', 'ores_apoysias_apologistika',
    ...APOLOGISTIKO_INTERVAL_FIELDS, ...POSITIVE_ACTIVITY_FIELDS, 'updatedAt'
]);
const text = value => String(value ?? '').trim();
const dateKey = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function normalizedScope(input) {
    const scope = normalizeScope(input);
    return { ...scope, period_start: dateKey(scope.period_start),
        period_end: dateKey(scope.period_end) };
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
        .map(key => [key, stable(value[key])]));
    return value;
}
const fingerprint = value => crypto.createHash('sha256')
    .update(JSON.stringify(stable(value))).digest('hex');

function isCanonicalNoWorkState(row = {}) {
    const category = text(row.kathgoria_ergasias_apologistika);
    return row.apologistiko_biblio === true &&
        ((category === 'ΑΝ' && row.repo_apologistika === true) ||
            (category === 'ΜΕ' && row.repo_apologistika === false));
}

function legacyCandidateReasons(row = {}, { appliedRepoTransfer = false } = {}) {
    const reasons = [];
    const verification = resolveCardPairVerification(row);
    if (!['ΑΝ', 'ΜΕ'].includes(text(row.kathgoria_ergasias))) {
        reasons.push('DECLARED_CATEGORY_NOT_AN_ME');
    }
    if (row.apologistiko_biblio === true) reasons.push('APOLOGISTIKO_BOOK_ALREADY_TRUE');
    if (text(row.kathgoria_ergasias_apologistika)) reasons.push('APOLOGISTIKO_CATEGORY_PRESENT');
    if (row.repo_apologistika !== true) reasons.push('LEGACY_REPO_SIGNAL_MISSING');
    if (row.adeia === true || row.hr_declared_leave === true ||
        text(row.kathgoria_adeias) || row.adeia_apologistika === true ||
        text(row.kathgoria_adeias_apologistika)) reasons.push('LEAVE_PRESENT');
    if (row.astheneia === true || row.astheneia_apologistika === true) reasons.push('SICKNESS_PRESENT');
    if (row.apousia_apologistika === true) reasons.push('ABSENCE_PRESENT');
    if (row.argia === true || row.argia_apologistika === true) reasons.push('HOLIDAY_PRESENT');
    if (Number(row.cards_ores_ergasias || 0) !== 0 ||
        verification.completePairs.length > 0) reasons.push('CARD_WORK_PRESENT');
    if (verification.hasUnresolvedCardEvidence || row.orphan_card_resolution) {
        reasons.push('UNRESOLVED_OR_ORPHAN_CARD_EVIDENCE');
    }
    if (Number(row.ores_pragmatikhs_ergasias_apologistika || 0) !== 0) {
        reasons.push('ACTUAL_WORK_PRESENT');
    }
    if (APOLOGISTIKO_INTERVAL_FIELDS.some(field => text(row[field]))) {
        reasons.push('APOLOGISTIKO_INTERVAL_PRESENT');
    }
    if (POSITIVE_ACTIVITY_FIELDS.some(field => Number(row[field] || 0) !== 0)) {
        reasons.push('POSITIVE_ACTIVITY_CLASSIFICATION_PRESENT');
    }
    if (row.egkekrimenh_oroadeia_apologistika === true ||
        Number(row.explicit_hourly_leave_hours || 0) !== 0 ||
        (Array.isArray(row.egkekrimena_diastimata_oroadeias_apologistika) &&
            row.egkekrimena_diastimata_oroadeias_apologistika.length > 0)) {
        reasons.push('APPROVED_HOURLY_LEAVE_PRESENT');
    }
    if (Number(row.hmeres_apoysias_apologistika || 0) !== 0 ||
        Number(row.ores_apoysias_apologistika || 0) !== 0) reasons.push('ABSENCE_PRESENT');
    if (row.is_locked === true) reasons.push('LOCKED_LEGACY_ROW');
    if (appliedRepoTransfer) reasons.push('APPLIED_REPO_TRANSFER_IDENTITY');
    return [...new Set(reasons)];
}

function hasManualClassificationAudit(audits = []) {
    const protectedFields = new Set([...CANONICAL_FIELDS, 'is_locked']);
    return audits.some(audit => Object.keys(audit?.newValues || {})
        .some(field => protectedFields.has(field)));
}

function changedFields(row, proposed) {
    const changes = {};
    for (const field of CANONICAL_FIELDS) {
        if (!same(row[field], proposed[field])) {
            changes[field] = { current: row[field] ?? null, proposed: proposed[field] ?? null };
        }
    }
    return changes;
}

function evaluateRow({ row = {}, effectiveProfile = {}, appliedRepoTransfer = false,
    manualClassificationAudit = false } = {}) {
    const profileDate = dateKey(row.hmeromhnia);
    const semantic = resolveNoWorkDaySemanticForDate({ date: profileDate,
        effectiveProfilesByDate: { [profileDate]: effectiveProfile } });
    if (isCanonicalNoWorkState(row)) return { status: 'ALREADY_CANONICAL',
        exclusionReasons: [], semantic, proposed: null, changes: {} };
    const reasons = legacyCandidateReasons(row, { appliedRepoTransfer });
    if (manualClassificationAudit) reasons.push('MANUAL_OR_PRIOR_CLASSIFICATION_AUDIT');
    if (effectiveProfile?.resolution_blocked === true) {
        reasons.push(effectiveProfile.resolution_reason || 'PROFILE_RESOLUTION_BLOCKED');
    }
    if (semantic.status !== 'RESOLVED' ||
        !['REST_REPO', 'NON_WORK'].includes(semantic.classification)) {
        reasons.push(`SEMANTIC_${semantic.reason || semantic.status || 'UNKNOWN'}`);
    }
    if (reasons.length) return { status: 'EXCLUDED', exclusionReasons: [...new Set(reasons)],
        semantic, proposed: null, changes: {} };
    const proposed = planCanonicalDailyClassification({ row,
        classification: semantic.classification });
    return { status: 'REPAIRABLE', exclusionReasons: [], semantic, proposed,
        changes: changedFields(row, proposed) };
}

function sourceSnapshot(row) {
    const result = { _id: String(row._id), team: row.team, company_kod: String(row.company_kod),
        ypokatasthma: row.ypokatasthma, kodikos: row.kodikos,
        hmeromhnia: row.hmeromhnia instanceof Date ? row.hmeromhnia.toISOString() : row.hmeromhnia };
    for (const field of SOURCE_FIELDS) result[field] = row[field] instanceof Date
        ? row[field].toISOString() : row[field];
    return result;
}

function profileSnapshot(semantic = {}) {
    return { employment_type: semantic.employment_type,
        weekly_system_days: semantic.weekly_system_days,
        contractual_weekly_days: semantic.contractual_weekly_days,
        classification: semantic.classification, ergani_code: semantic.ergani_code,
        reason: semantic.reason, source: semantic.source };
}

function safeRow(item) {
    const { row, evaluation } = item;
    return { employee_code: text(row.kodikos), date: dateKey(row.hmeromhnia),
        declared_category: text(row.kathgoria_ergasias),
        current_apologistiko_state: {
            apologistiko_biblio: row.apologistiko_biblio === true,
            kathgoria_ergasias_apologistika:
                row.kathgoria_ergasias_apologistika ?? null,
            repo_apologistika: row.repo_apologistika === true
        }, ...profileSnapshot(evaluation.semantic), status: evaluation.status,
        proposed_changed_fields: evaluation.changes,
        lock_state: row.is_locked === true ? 'LOCKED' : 'UNLOCKED',
        exclusion_reasons: evaluation.exclusionReasons };
}

async function defaultProfileLoader({ scope, rows, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel } = {}) {
    const codes = [...new Set(rows.map(row => text(row.kodikos)).filter(Boolean))];
    const employees = await employeeModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, kodikos: mongoose.trusted({ $in: codes }) }).lean();
    const histories = await historyModel.find({ team: scope.team, company_kod: scope.company_kod,
        kodikos: mongoose.trusted({ $in: codes }) })
        .sort({ hmeromhnia_isxyos_oron_ergasias_apo: 1 }).lean();
    const historyByCode = new Map(codes.map(code => [code,
        histories.filter(row => text(row.kodikos) === code)]));
    const employeeByCode = new Map(employees.map(employee => [text(employee.kodikos), employee]));
    const borrowed = await preloadBorrowedEmploymentProfileContexts({ team: scope.team, employees });
    return new Map(rows.map(row => {
        const employee = employeeByCode.get(text(row.kodikos));
        if (!employee) return [String(row._id), { resolution_blocked: true,
            resolution_reason: 'EMPLOYEE_PROFILE_NOT_FOUND' }];
        return [String(row._id), resolveEffectiveEmploymentProfileForReviewDate({
            reviewDate: row.hmeromhnia, normalEmployee: employee,
            normalHistory: historyByCode.get(text(row.kodikos)) || [],
            borrowedContext: borrowed.get(employeeKey(employee)) || null
        })];
    }));
}

async function buildRepairPreview({ scope: rawScope, rowModel = ProdhlomenaOrariaModel,
    profileLoader = defaultProfileLoader,
    protectionLoader = loadAppliedRepoTransferProtectionContext,
    auditModel = ProdhlomenaOrariaAuditModel } = {}) {
    const scope = normalizedScope(rawScope);
    const rows = await rowModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma,
        hmeromhnia: mongoose.trusted({ $gte: new Date(`${scope.period_start}T00:00:00.000Z`),
            $lte: new Date(`${scope.period_end}T23:59:59.999Z`) }),
        $or: mongoose.trusted([{ repo_apologistika: true },
            { kathgoria_ergasias_apologistika: mongoose.trusted({ $in: ['ΑΝ', 'ΜΕ'] }) }])
    }).select(['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia',
        ...SOURCE_FIELDS].join(' ')).sort({ hmeromhnia: 1, kodikos: 1, _id: 1 }).lean();
    const [profiles, protection, audits] = await Promise.all([
        profileLoader({ scope, rows }),
        protectionLoader({ scopes: [{ team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, loadedRowIds: rows.map(row => String(row._id)) }] }),
        rows.length ? auditModel.find({ team: scope.team, company_kod: scope.company_kod,
            prodhlomena_oraria_id: mongoose.trusted({ $in: rows.map(row => row._id) }) })
            .select('prodhlomena_oraria_id newValues').lean() : []
    ]);
    const auditsByRowId = new Map();
    for (const audit of audits) {
        const rowId = String(audit.prodhlomena_oraria_id || '');
        if (!auditsByRowId.has(rowId)) auditsByRowId.set(rowId, []);
        auditsByRowId.get(rowId).push(audit);
    }
    const evaluated = rows.map(row => ({ row, effectiveProfile: profiles.get(String(row._id)) || {},
        evaluation: evaluateRow({ row, effectiveProfile: profiles.get(String(row._id)) || {},
            appliedRepoTransfer: Boolean(protection.entriesByRowId?.[String(row._id)]),
            manualClassificationAudit: hasManualClassificationAudit(
                auditsByRowId.get(String(row._id)) || []) }) }));
    const exclusions = {};
    for (const item of evaluated) for (const reason of item.evaluation.exclusionReasons) {
        exclusions[reason] = (exclusions[reason] || 0) + 1;
    }
    const fingerprintRows = evaluated.map(item => ({ source: sourceSnapshot(item.row),
        profile: profileSnapshot(item.evaluation.semantic), status: item.evaluation.status,
        proposed: item.evaluation.proposed, exclusions: item.evaluation.exclusionReasons }));
    const repairable = evaluated.filter(item => item.evaluation.status === 'REPAIRABLE');
    return { scope, matched_count: rows.length, repairable_count: repairable.length,
        already_canonical_count: evaluated.filter(item =>
            item.evaluation.status === 'ALREADY_CANONICAL').length,
        excluded_count: evaluated.filter(item => item.evaluation.status === 'EXCLUDED').length,
        exclusion_reasons: exclusions, rows: evaluated.map(safeRow),
        preview_fingerprint: fingerprint({ scope, rows: fingerprintRows }),
        _repairable: repairable.map(item => ({ row: item.row,
            source: sourceSnapshot(item.row), proposed: item.evaluation.proposed })) };
}

function publicPreview(preview) {
    const { _repairable, ...safe } = preview;
    return safe;
}

function casFilter(source) {
    const filter = {};
    for (const [field, value] of Object.entries(source)) {
        filter[field] = value === undefined ? mongoose.trusted({ $exists: false }) : value;
    }
    return filter;
}

async function applyRepairBatch({ scope, previewFingerprint, confirmed, reason, changedBy,
    rowModel = ProdhlomenaOrariaModel, auditModel = ProdhlomenaOrariaAuditModel,
    connection = mongoose.connection, previewBuilder = buildRepairPreview } = {}) {
    if (confirmed !== true) throw Object.assign(new Error('Explicit confirmation is required'),
        { code: 'CONFIRMATION_REQUIRED' });
    if (!text(reason)) throw Object.assign(new Error('A non-empty reason is required'),
        { code: 'REASON_REQUIRED' });
    if (!text(changedBy)) throw Object.assign(new Error('A non-empty changedBy is required'),
        { code: 'ACTOR_REQUIRED' });
    if (!/^[a-f\d]{64}$/.test(text(previewFingerprint))) throw Object.assign(
        new Error('A valid preview fingerprint is required'), { code: 'PREVIEW_REQUIRED' });
    const preview = await previewBuilder({ scope, rowModel });
    if (preview.preview_fingerprint !== previewFingerprint) throw Object.assign(
        new Error('Preview set changed; obtain a new preview'), { code: 'STALE_PREVIEW' });
    let repaired = 0;
    const stale = [];
    for (const item of preview._repairable) {
        const session = await connection.startSession();
        let outcome = 'STALE';
        try {
            await session.withTransaction(async () => {
                const now = new Date();
                const $set = { ...item.proposed, is_locked: true,
                    locked_by: text(changedBy), locked_at: now };
                const oldValues = {}; const newValues = {};
                for (const [field, value] of Object.entries($set)) {
                    if (!same(item.row[field], value)) {
                        oldValues[field] = item.row[field] ?? '';
                        newValues[field] = value;
                    }
                }
                const result = await rowModel.updateOne(casFilter(item.source), { $set }, { session });
                if (Number(result?.matchedCount ?? result?.n ?? 0) !== 1) return;
                await auditModel.create([{ team: item.row.team,
                    company_kod: item.row.company_kod,
                    prodhlomena_oraria_id: item.row._id, kodikos: item.row.kodikos,
                    ypokatasthma: item.row.ypokatasthma, hmeromhnia: item.row.hmeromhnia,
                    changedBy: text(changedBy),
                    reason: `${AUDIT_CONTEXT}: ${text(reason)}`, oldValues, newValues
                }], { session });
                outcome = 'REPAIRED';
            });
        } finally {
            await session.endSession();
        }
        if (outcome === 'REPAIRED') repaired++;
        else stale.push({ employee_code: text(item.row.kodikos),
            date: dateKey(item.row.hmeromhnia), status: 'STALE / REVIEW_REQUIRED' });
    }
    return { mode: 'APPLY', repairable_count: preview.repairable_count,
        repaired_count: repaired, stale_count: stale.length, stale };
}

module.exports = { AUDIT_CONTEXT, CANONICAL_FIELDS, APOLOGISTIKO_INTERVAL_FIELDS,
    POSITIVE_ACTIVITY_FIELDS, SOURCE_FIELDS, normalizedScope,
    isCanonicalNoWorkState, legacyCandidateReasons, hasManualClassificationAudit,
    evaluateRow, sourceSnapshot,
    defaultProfileLoader, buildRepairPreview, publicPreview, casFilter, applyRepairBatch };
