'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const EmployeeHistoryRepairAuditModel = require('../../models/employeeHistoryRepairAudit');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { IDENTITY_FIELDS, NEW_CURRENT_FIELDS, semanticEmploymentProfileChanged,
    semanticEmploymentProfilePatch } = require('../../utils/ergazomenoi/employmentProfileTransition');
const { BASE_HISTORY_FIELDS, buildCompleteProfileSnapshot, effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { buildEmployeeRehireTransition } = require('./employeeRehireLifecycleTransitionService');
const { buildEmployeeDepartureTransition } = require('./employeeDepartureLifecycleTransitionService');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { CURRENT_SYNC_FIELDS, REBUILD_STATUSES, calculateCanonicalDiff,
    rebuildEmployeeHistory } = require('./employeeHistoryRebuilderService');
const { findHistoryIdReferences } = require('./employeeHistoryReferenceAuditService');
const { HISTORY_REFERENCE_FENCE_FIELD } =
    require('./employeeHistoryReferenceWriteFenceService');
const {
    employeeHistoryRepairAuditCollectionExists
} = require('./employeeHistoryRepairAuditSetupService');
const { STATES: MUTATION_STATES, INTENTS: MUTATION_INTENTS,
    resolveDeterministicPollutedTarget,
    resolveEmployeeHistoryMutation } = require('./employeeEmploymentProfileMutationResolverService');

const MODE_NEW_VERSION = 'MODE_NEW_VERSION';
const MODE_CORRECT_EXISTING = 'MODE_CORRECT_EXISTING';
// Selected internally from fresh transactional reads; callers cannot force it.
const MODE_LEGACY_MAINTENANCE = 'MODE_LEGACY_MAINTENANCE';
const LARGE_EMPLOYEE_FIELDS_EXCLUSION = [
    'bibliario_anhlikoy_base64',
    'arxeio_nomimopoihtikon_eggrafon_base64',
    'arxeio_apodoxhs_oysiodon_oron_base64',
    'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
    'arxeio_symbashs_daneismoy_base64'
].map(field => `-${field}`).join(' ');

function currentProfileProjection(snapshot) {
    return Object.fromEntries(T.STANDARD_FIELDS.filter(field =>
        Object.hasOwn(snapshot, field) && snapshot[field] !== undefined)
        .map(field => [field, snapshot[field]]));
}

async function transactionCapability(connection) {
    const hello = await connection.db.admin().command({ hello: 1 });
    return Boolean((hello.setName || hello.msg === 'isdbgrid') && hello.logicalSessionTimeoutMinutes > 0);
}
function failure(code) { const error = new Error(code); error.code = code; error.statusCode = 409; return error; }

function requestScopedLean(query, session, projection = '') {
    let selected = query;
    if (projection && typeof selected.select === 'function') selected = selected.select(projection);
    return selected.session(session).lean();
}

const AUDIT_FIELDS = [...new Set(['_id', 'team', 'company_kod', 'kodikos', 'aa_eggrafhs',
    'createdAt', 'updatedAt', ...CURRENT_SYNC_FIELDS])];
function auditProjection(record = {}) {
    return Object.fromEntries(AUDIT_FIELDS.filter(field => Object.hasOwn(record, field) &&
        record[field] !== undefined).map(field => [field, record[field]]));
}
function cleanupPatchFor(plan, historyId) {
    return plan.rowsToUpdate.find(row => row.historyId === String(historyId))?.patch || {};
}
function storedComparable(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const timestamp = new Date(value);
        if (!Number.isNaN(timestamp.getTime())) return timestamp.toISOString();
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = C.calendarDate(value.slice(0, 10));
        if (date) return date.toISOString();
    }
    if (value && typeof value === 'object' && typeof value.toHexString === 'function') {
        return value.toHexString();
    }
    if (value?.buffer instanceof Uint8Array && value.buffer.length === 12) {
        return Buffer.from(value.buffer).toString('hex');
    }
    return value;
}
function normalizedHistoryId(value) {
    const normalized = storedComparable(value);
    return typeof normalized === 'string' ? normalized : String(normalized ?? '');
}
function minimalSetPatch(stored, proposed) {
    return Object.fromEntries(Object.entries(proposed).filter(([field, value]) => value !== undefined &&
        JSON.stringify(storedComparable(stored?.[field])) !== JSON.stringify(storedComparable(value))));
}
function normalizeHistoryObjectIds(historyIds = []) {
    if (!Array.isArray(historyIds)) throw new TypeError('historyIds must be an array');
    const normalized = historyIds.map(value => {
        const hex = value instanceof mongoose.Types.ObjectId
            ? value.toHexString()
            : String(value ?? '').trim();
        if (!/^[0-9a-fA-F]{24}$/.test(hex)) {
            throw new TypeError('Invalid employee history ObjectId');
        }
        return new mongoose.Types.ObjectId(hex);
    });
    if (new Set(normalized.map(value => value.toHexString())).size !== normalized.length) {
        throw new TypeError('Duplicate employee history ObjectId');
    }
    return normalized;
}
function buildScopedHistoryDeleteFilter(scope, historyIds = []) {
    const normalizedIds = normalizeHistoryObjectIds(historyIds);
    if (!normalizedIds.length) return null;
    const employeeScope = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(field => {
        const value = String(scope?.[field] ?? '').trim();
        if (!value) throw new TypeError(`Missing employee history scope: ${field}`);
        return [field, value];
    }));
    return {
        ...employeeScope,
        _id: mongoose.trusted({ $in: normalizedIds })
    };
}

function nextHistoryRevision(previous, now = new Date()) {
    const previousTime = previous ? new Date(previous).getTime() : 0;
    const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const safeNow = Number.isFinite(nowTime) ? nowTime : Date.now();
    return new Date(Math.max(safeNow, Number.isFinite(previousTime) ? previousTime + 1 : safeNow));
}

function castPlannedHistoryRow(row, historyModel) {
    if (!historyModel?.schema?.path) return { ...row };
    return Object.fromEntries(Object.entries(row).map(([field, value]) => {
        if (value === undefined) return [field, value];
        const schemaPath = historyModel.schema.path(field);
        return [field, schemaPath ? schemaPath.cast(value) : value];
    }));
}

function materializePlannedHistoryInsert(row, historyModel, now, historyDocumentFactory = null) {
    const createdAt = row.createdAt || now;
    const source = { ...row, createdAt, updatedAt: row.updatedAt || createdAt };
    const document = historyDocumentFactory
        ? historyDocumentFactory(source)
        : typeof historyModel === 'function' ? new historyModel(source) : null;
    return document?.toObject
        ? document.toObject({ depopulate: true, minimize: false, versionKey: false })
        : castPlannedHistoryRow(document || source, historyModel);
}

function buildFinalHistoryMutationPlan({ beforeRows = [], desiredRows = [], now = new Date(),
    historyModel = null, historyDocumentFactory = null }) {
    const beforeById = new Map(beforeRows.map(row => [String(row._id), row]));
    const beforeIds = new Set(beforeById.keys());
    const finalRows = desiredRows.map(row => row._id == null || !beforeIds.has(String(row._id))
        ? materializePlannedHistoryInsert(row, historyModel, now, historyDocumentFactory)
        : castPlannedHistoryRow({ ...beforeById.get(String(row._id)),
            ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) },
        historyModel));
    const diff = calculateCanonicalDiff(beforeRows, finalRows);
    const finalById = new Map(finalRows.map(row => [String(row._id), row]));
    const rowsToUpdate = diff.rowsToUpdate.map(item => {
        const revision = nextHistoryRevision(beforeById.get(item.historyId)?.updatedAt, now);
        finalById.get(item.historyId).updatedAt = revision;
        return { ...item, patch: { ...item.patch, updatedAt: revision } };
    });
    const rowsToInsert = finalRows.filter(row => !beforeById.has(String(row._id)));
    return { beforeRows, finalRows, rowsToUpdate,
        rowsToDelete: diff.rowsToDelete, rowsToInsert };
}

function normalizedAuditRows(rows = []) {
    return rows.map(auditProjection).map(row => Object.fromEntries(Object.entries(row)
        .map(([field, value]) => [field, field === '_id'
            ? normalizedHistoryId(value) : storedComparable(value)])))
        .sort((left, right) => left._id.localeCompare(right._id)).map(row =>
            JSON.parse(JSON.stringify(row)));
}

async function verifyFinalMutationState({ filter, employeeId, session, employeeModel,
    historyModel, expectedCurrent, expectedHistory, targetedHistoryId = null,
    targetedPatch = {} }) {
    const persistedCurrent = await requestScopedLean(
        employeeModel.findOne({ ...filter, _id: employeeId }), session,
        LARGE_EMPLOYEE_FIELDS_EXCLUSION);
    const persistedHistory = await historyModel.find(filter).session(session).lean();
    const failVerification = reason => {
        const error = failure('EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
        error.verificationReason = reason;
        throw error;
    };
    if (!persistedCurrent || !['team', 'company_kod', 'kodikos'].every(field =>
        String(persistedCurrent[field] ?? '') === String(filter[field] ?? ''))) {
        failVerification('CURRENT_SCOPE');
    }
    if (persistedHistory.some(row => !['team', 'company_kod', 'kodikos'].every(field =>
        String(row[field] ?? '') === String(filter[field] ?? '')))) {
        failVerification('HISTORY_SCOPE');
    }
    const expectedIds = expectedHistory.map(row => normalizedHistoryId(row._id)).sort();
    const persistedIds = persistedHistory.map(row => normalizedHistoryId(row._id)).sort();
    if (JSON.stringify(persistedIds) !== JSON.stringify(expectedIds)) {
        failVerification('HISTORY_IDENTITIES');
    }
    if (JSON.stringify(normalizedAuditRows(persistedHistory)) !==
        JSON.stringify(normalizedAuditRows(expectedHistory))) {
        failVerification('HISTORY_PROJECTED_STATE');
    }
    if (targetedHistoryId) {
        const target = persistedHistory.find(row => normalizedHistoryId(row._id) ===
            normalizedHistoryId(targetedHistoryId));
        if (!target || Object.entries(targetedPatch).some(([field, value]) =>
            JSON.stringify(storedComparable(target[field])) !==
                JSON.stringify(storedComparable(value)))) {
            failVerification('TARGETED_UPDATE');
        }
    }
    const rebuilt = rebuildEmployeeHistory({ scope: filter, currentEmployee: persistedCurrent,
        authoritativeCurrent: persistedCurrent, historyRows: persistedHistory });
    if (rebuilt.status === REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED || rebuilt.cleanupRequired) {
        failVerification(rebuilt.diagnostics?.reason || 'NOT_IDEMPOTENT');
    }
    const currentFields = [...new Set(['team', 'company_kod', 'kodikos', ...CURRENT_SYNC_FIELDS])];
    const currentProjection = record => Object.fromEntries(currentFields.filter(field =>
        Object.hasOwn(record, field) && record[field] !== undefined)
        .map(field => [field, storedComparable(record[field])]));
    if (JSON.stringify(currentProjection(persistedCurrent)) !==
        JSON.stringify(currentProjection(expectedCurrent))) {
        failVerification('CURRENT_PROJECTED_STATE');
    }
    return { current: persistedCurrent, history: persistedHistory, rebuilt };
}

async function executeFinalMutationPlan({ physicalPlan, currentBefore, currentPatch, filter,
    employeeId, session, employeeModel, historyModel, auditModel,
    auditCollectionChecker, referenceChecker, connection, diagnostics,
    targetedHistoryId = null, targetedPatch = {}, historyDocumentFactory = null }) {
    const deletedIds = physicalPlan.rowsToDelete.map(row => row.historyId);
    const deleteFilter = buildScopedHistoryDeleteFilter(filter, deletedIds);
    if (deletedIds.length) {
        let auditCollectionExists;
        try {
            auditCollectionExists = await auditCollectionChecker({ connection });
        } catch {
            throw failure('EMPLOYEE_HISTORY_AUDIT_COLLECTION_CHECK_FAILED');
        }
        if (!auditCollectionExists) throw failure('EMPLOYEE_HISTORY_AUDIT_COLLECTION_MISSING');
        const fenced = await historyModel.updateMany(deleteFilter, {
            $inc: { [HISTORY_REFERENCE_FENCE_FIELD]: 1 }
        }, { session });
        if (fenced.matchedCount !== deletedIds.length) {
            throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
        }
        let references;
        try {
            references = await referenceChecker({ connection, historyIds: deletedIds, session });
        } catch {
            throw failure('EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED');
        }
        if (references.length) {
            const error = failure('EMPLOYEE_HISTORY_REFERENCED_CLEANUP_REQUIRED');
            error.references = references;
            throw error;
        }
        await auditModel.create([{
            employeeScope: { ...filter, employee_id: currentBefore._id },
            repairedAt: new Date(),
            currentBefore: auditProjection(currentBefore),
            historyBefore: physicalPlan.beforeRows.map(auditProjection),
            historyAfter: physicalPlan.finalRows.map(auditProjection),
            survivingHistoryIds: physicalPlan.finalRows.map(row => String(row._id)),
            deletedLegacyHistoryIds: deletedIds,
            mutationSource: 'EMPLOYEE_MAINTENANCE_SAVE',
            diagnostics
        }], { session });
    }
    if (Object.keys(currentPatch).length) {
        const result = await employeeModel.updateOne({ ...filter, _id: employeeId },
            { $set: currentPatch }, { session });
        if (result.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
    }
    for (const item of physicalPlan.rowsToUpdate) {
        const result = await historyModel.updateOne({ ...filter, _id: item.historyId },
            { $set: item.patch }, { session });
        if (result.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
    }
    if (deleteFilter) {
        const result = await historyModel.deleteMany(deleteFilter, { session });
        if (result.deletedCount !== deletedIds.length) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
    }
    const inserted = [];
    for (const record of physicalPlan.rowsToInsert) {
        const historyDocument = historyDocumentFactory
            ? historyDocumentFactory(record)
            : typeof historyModel === 'function' ? new historyModel(record) : record;
        const created = await historyModel.create([historyDocument], { session });
        inserted.push(created[0]);
    }
    const expectedCurrent = { ...currentBefore, ...currentPatch };
    const verified = await verifyFinalMutationState({ filter, employeeId, session, employeeModel,
        historyModel, expectedCurrent, expectedHistory: physicalPlan.finalRows,
        targetedHistoryId, targetedPatch });
    return { inserted, verified, auditWritten: deletedIds.length > 0,
        updated: physicalPlan.rowsToUpdate.length, deleted: deletedIds.length };
}
// Private session sharing keeps all accepted history operations in one transaction.
const ACTIVE_SESSION = Symbol('employeeProfileTransaction');
const EDITOR_OPERATION = Symbol('historyEditorOperation');
const REHIRE_OPERATION = Symbol('employeeRehireOperation');
async function inProfileTransaction(connection, capabilityProbe, work, activeSession = null) {
    if (activeSession) return work(activeSession);
    let capable = false;
    try { capable = await capabilityProbe(connection); } catch { capable = false; }
    if (!capable) throw failure('EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    const session = await connection.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await work(session); });
        return result;
    } finally { await session.endSession(); }
}
async function writeEmployeeEmploymentProfileCorrections({ scope, employeeId, corrections,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!Array.isArray(corrections) || !corrections.length ||
        corrections.some(item => !item.historyId) || new Set(corrections.map(item => item.historyId)).size !== corrections.length) {
        C.invalid('historyId', 'unique exact correction identities required');
    }
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const results = [];
        for (const correction of corrections) results.push(await writeEmployeeEmploymentProfile({
            ...correction, scope, employeeId, mode: MODE_CORRECT_EXISTING,
            connection, employeeModel, historyModel, capabilityProbe, [ACTIVE_SESSION]: session
        }));
        return results;
    });
}

// The existing editor batches modifications, append insertions and exact deletions.
// Deletions never reopen/extend neighbors or restore current from another period:
// neither action exists in the baseline editor.
async function writeEmployeeEmploymentHistoryOperations({ scope, employeeId, operations,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel,
    referenceChecker = findHistoryIdReferences,
    capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(key => typeof scope[key] === 'string' && scope[key].trim())) C.invalid('scope', 'complete scope required');
    if (typeof employeeId !== 'string' || !employeeId || !Array.isArray(operations) ||
        operations.some(op => !['modified', 'inserted', 'deleted'].includes(op.state) ||
            (op.state !== 'inserted' && (typeof op.historyId !== 'string' || !op.historyId)))) C.invalid('historyId', 'exact history operation required');
    const identities = operations.filter(op => op.state !== 'inserted').map(op => op.historyId);
    if (new Set(identities).size !== identities.length) C.invalid('historyId', 'duplicate operations on the same row');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, scope[key]]));
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const current = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
        if (!current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
        const originalRows = await historyModel.find(filter).session(session).lean();
        const originalLatest = Math.max(0, ...originalRows.map(row => effectiveStart(row)?.getTime() || 0));
        const appendFloor = Math.max(originalLatest, effectiveStart(current)?.getTime() || 0);
        const deleted = [];
        for (let op of operations) {
            if (op.state === 'deleted') {
                const rows = await historyModel.find(filter).session(session).lean();
                const target = rows.find(row => String(row._id) === op.historyId);
                if (!target) throw failure('EMPLOYEE_PROFILE_DELETE_IDENTITY_MISMATCH');
                const fenced = await historyModel.updateOne({ ...filter, _id: target._id }, {
                    $inc: { [HISTORY_REFERENCE_FENCE_FIELD]: 1 }
                }, { session });
                if (fenced.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                let references;
                try {
                    references = await referenceChecker({ connection,
                        historyIds: [String(target._id)], session });
                } catch {
                    throw failure('EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED');
                }
                if (references.length) {
                    throw failure('EMPLOYEE_HISTORY_REFERENCED_DELETE_FORBIDDEN');
                }
                const result = await historyModel.deleteOne({ ...filter, _id: target._id }, { session });
                if (result.deletedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                deleted.push(target);
            } else {
                if (op.state === 'modified') {
                    const rows = await historyModel.find(filter).session(session).lean();
                    const target = rows.find(row => String(row._id) === op.historyId);
                    if (!target) throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                    const submitted = op.maintenance.submittedFields || Object.keys(op.maintenance.historyChanges);
                    const patch = { ...op.maintenance.historyChanges };
                    const sameDate = (a, b) => (C.calendarDate(a)?.getTime() ?? null) === (C.calendarDate(b)?.getTime() ?? null);
                    if (!submitted.includes('hmeromhnia_isxyos_oron_ergasias_apo')) {
                        const changedScheduleStart = submitted.includes('hmeromhnia_allaghs_orarioy_apo') &&
                            !sameDate(patch.hmeromhnia_allaghs_orarioy_apo, target.hmeromhnia_allaghs_orarioy_apo);
                        patch.hmeromhnia_isxyos_oron_ergasias_apo = changedScheduleStart
                            ? patch.hmeromhnia_allaghs_orarioy_apo : effectiveStart(target);
                    }
                    if (!submitted.includes('hmeromhnia_isxyos_oron_ergasias_eos')) {
                        patch.hmeromhnia_isxyos_oron_ergasias_eos = effectiveEnd(target);
                    }
                    op = { ...op, effectiveFrom: patch.hmeromhnia_isxyos_oron_ergasias_apo,
                        maintenance: { ...op.maintenance, historyChanges: patch, employeeChanges: patch } };
                }
                if (op.state === 'inserted' && C.calendarDate(op.effectiveFrom)?.getTime() <= appendFloor) throw failure('EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
                const result = await writeEmployeeEmploymentProfile({ ...op, scope, employeeId,
                    historyId: op.state === 'inserted' ? null : op.historyId,
                    mode: op.state === 'inserted' ? MODE_NEW_VERSION : MODE_CORRECT_EXISTING,
                    connection, employeeModel, historyModel, capabilityProbe,
                    [ACTIVE_SESSION]: session, [EDITOR_OPERATION]: true });
                if (op.state === 'inserted') {
                    // Baseline editor inserts at 0000 before sorting and renumbering.
                    const revision = nextHistoryRevision(result.history.updatedAt);
                    const changed = await historyModel.updateOne({ ...filter, _id: result.history._id },
                        { $set: { aa_eggrafhs: '0000', updatedAt: revision } }, { session });
                    if (changed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                }
            }
        }
        if (deleted.length) {
            const finalCurrent = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
            const remaining = await historyModel.find(filter).session(session).lean();
            const from = effectiveStart(finalCurrent)?.getTime();
            const needsSupport = deleted.some(row =>
                (C.readEmploymentProfile(row).recorded || C.readEmploymentProfile(finalCurrent).recorded) &&
                (effectiveStart(row)?.getTime() === from || effectiveStart(row)?.getTime() === originalLatest));
            const supporting = remaining.some(row => effectiveStart(row)?.getTime() === from &&
                C.readEmploymentProfile(row).recorded && C.FACT_FIELDS.every(field => {
                    const value = source => [C.FROM, C.UNTIL].includes(field)
                        ? C.calendarDate(source[field])?.getTime() ?? null : source[field];
                    return JSON.stringify(value(row)) === JSON.stringify(value(finalCurrent));
                }));
            if (needsSupport && !supporting) throw failure('EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED');
        }
        // Exact baseline ordering, including inserted 0000 rows. Only aa changes.
        const rows = await historyModel.find(filter).session(session).sort({ aa_eggrafhs: 1, createdAt: 1, _id: 1 }).lean();
        for (let index = 0; index < rows.length; index++) {
            const aa = String(index + 1).padStart(4, '0');
            if (rows[index].aa_eggrafhs === aa) continue;
            const changed = await historyModel.updateOne({ ...filter, _id: rows[index]._id },
                { $set: { aa_eggrafhs: aa,
                    updatedAt: nextHistoryRevision(rows[index].updatedAt) } }, { session });
            if (changed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
        }
        return { success: true };
    });
}


const HISTORY_CURRENT_FIELDS = new Set([...BASE_HISTORY_FIELDS, ...IDENTITY_FIELDS, ...C.FACT_FIELDS,
    'eidikh_kathgoria_ergazomenoy', 'afora_allagh_oron_ergasias', 'afora_proslhpsh', 'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo',
    'kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas', 'apasxolhsh_basei_symbashs',
    'pososto_prosayxhshs_6hs_hmeras', 'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias']);
function cleanMaintenancePatch(patch = {}) {
    return Object.fromEntries(Object.entries(patch).filter(([field, value]) => value !== undefined &&
        !C.FACT_FIELDS.includes(field) && !['_id', 'team', 'company_kod', 'kodikos', 'aa_eggrafhs',
            'createdAt', 'updatedAt', T.ANCHOR, 'employment_profile_source',
            'employment_departure_restore'].includes(field)));
}
function legacyMaintenancePatch(patch = {}, stored, history = false) {
    const changes = cleanMaintenancePatch(patch);
    // Baseline current mapping included scalar profile facts; history did not.
    // Never fill a missing legacy fact merely because the form supplied a default.
    if (!history) for (const field of C.FACT_FIELDS) {
        if (!NEW_CURRENT_FIELDS.includes(field) && Object.hasOwn(stored, field) && patch[field] !== undefined) changes[field] = patch[field];
    }
    for (const field of [...NEW_CURRENT_FIELDS, ...T.STANDARD_FIELDS]) {
        if (NEW_CURRENT_FIELDS.includes(field) || (stored && !Object.hasOwn(stored, field))) delete changes[field];
    }
    if (history && patch.employment_profile_source !== undefined) changes.employment_profile_source = patch.employment_profile_source;
    return changes;
}
function selectMaintenanceMode(rows, identity, currentEmployee = null) {
    if (!identity || !IDENTITY_FIELDS.every(field => Object.hasOwn(identity, field))) C.invalid('historyIdentity', 'complete identity required');
    if (currentEmployee) {
        const stableIdentityFields = IDENTITY_FIELDS.filter(field =>
            field !== 'hmeromhnia_lhxhs_symbashs');
        const identityValue = (row, field) => field === 'hmeromhnia_isxyos_oron_ergasias_apo'
            ? effectiveStart(row)?.getTime() ?? null
            : field === 'hmeromhnia_isxyos_oron_ergasias_eos'
                ? effectiveEnd(row)?.getTime() ?? null
                : C.calendarDate(row[field], field)?.getTime() ?? null;
        const stableIdentityMatch = row => stableIdentityFields.every(field =>
            identityValue(row, field) === identityValue(identity, field));
        const starts = new Map();
        for (const row of rows) {
            const key = `${C.calendarDate(row.hmeromhnia_proslhpshs)?.getTime() ?? ''}:` +
                `${effectiveStart(row)?.getTime() ?? ''}`;
            if (!starts.has(key)) starts.set(key, []);
            starts.get(key).push(row);
        }
        for (const group of starts.values()) {
            if (!group.some(stableIdentityMatch)) continue;
            const resolved = resolveDeterministicPollutedTarget(group, currentEmployee);
            if (resolved.target) return { mode: MODE_CORRECT_EXISTING,
                historyId: String(resolved.target._id) };
        }
    }
    const date = (row, field) => field === 'hmeromhnia_isxyos_oron_ergasias_apo' ? effectiveStart(row) :
        field === 'hmeromhnia_isxyos_oron_ergasias_eos' ? effectiveEnd(row) :
            C.calendarDate(row[field], field);
    const matches = rows.filter(row => IDENTITY_FIELDS.every(field =>
        (date(row, field)?.getTime() ?? null) === (date(identity, field)?.getTime() ?? null)));
    if (matches.length > 1) throw failure('EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY');
    return matches.length ? { mode: MODE_CORRECT_EXISTING, historyId: String(matches[0]._id) } :
        { mode: MODE_NEW_VERSION, historyId: null };
}

function appendPredecessors({ openRows, datedRows, rows, current, from, rehireOperation }) {
    if (openRows.length <= 1) return openRows;
    const overlap = () => { throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP'); };
    if (rehireOperation) overlap();
    const day = value => C.calendarDate(value)?.getTime() ?? null;
    const hire = day(current?.hmeromhnia_proslhpshs);
    const start = effectiveStart(openRows[0])?.getTime() ?? null;
    const end = effectiveEnd(openRows[0])?.getTime() ?? null;
    const complete = openRows.filter(row => C.readEmploymentProfile(row).recorded);
    // Creation order and sequence must identify the complete snapshot as the
    // latest predecessor, independently of Mongo's result order.
    const sequence = row => Number(row.aa_eggrafhs);
    const created = row => row.createdAt ? new Date(row.createdAt).getTime() : null;
    const authoritative = complete[0];
    if (!hire || !start || from.getTime() <= start || !authoritative || complete.length !== 1 ||
        current.archived === true || current.energos === false || day(current.hmeromhnia_apoxorhshs) ||
        !C.readEmploymentProfile(current).recorded || effectiveStart(current)?.getTime() !== start ||
        (effectiveEnd(current)?.getTime() ?? null) !== end ||
        !Number.isSafeInteger(sequence(authoritative)) || !Number.isFinite(created(authoritative)) ||
        datedRows.some(row => effectiveStart(row)?.getTime() >= from.getTime()) ||
        rows.some(row => day(row.hmeromhnia_proslhpshs) > hire ||
            (day(row.hmeromhnia_proslhpshs) === hire && day(row.hmeromhnia_apoxorhshs))) ||
        openRows.some(row => day(row.hmeromhnia_proslhpshs) !== hire ||
            effectiveStart(row)?.getTime() !== start || (effectiveEnd(row)?.getTime() ?? null) !== end ||
            day(row.hmeromhnia_apoxorhshs) || !Number.isSafeInteger(sequence(row)) ||
            !Number.isFinite(created(row)) ||
            (row !== authoritative && (created(row) > created(authoritative) ||
                (created(row) === created(authoritative) && sequence(row) >= sequence(authoritative)))))) overlap();
    // A newer recorded profile outside the overlapping group would make the
    // supposedly authoritative predecessor stale.
    if (datedRows.some(row => row !== authoritative && C.readEmploymentProfile(row).recorded &&
        (effectiveStart(row)?.getTime() ?? 0) > start)) overlap();
    return openRows;
}

// Shared Add/Edit/profile writer. Never falls
// back to two independent writes on standalone MongoDB. Same transaction pattern
// as the existing weekly repo-transfer writer, without coupling its payroll code.
// New versions append chronologically. Corrections target an exact existing row
// without moving its boundaries. Retrospective INSERTION remains unsupported.
// The existing business-code allocator still owns uniqueness for NEW employees:
// the repository has no unique employee business-key index. This writer guarantees
// current/history atomicity, not cross-route concurrent code allocation.
async function writeEmployeeEmploymentProfile({ scope, input = {}, effectiveFrom, newEmployee = null, employeeId = null,
    mode = MODE_NEW_VERSION, historyId = null, maintenance = null, [ACTIVE_SESSION]: activeSession = null,
    [EDITOR_OPERATION]: editorOperation = false, [REHIRE_OPERATION]: rehireOperation = false,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel,
    auditModel = EmployeeHistoryRepairAuditModel,
    auditCollectionChecker = employeeHistoryRepairAuditCollectionExists,
    referenceChecker = findHistoryIdReferences,
    capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every((key) => typeof scope[key] === 'string' && scope[key].trim())) {
        C.invalid('scope', 'team, company_kod and kodikos required');
    }
    if (![MODE_NEW_VERSION, MODE_CORRECT_EXISTING].includes(mode)) C.invalid('mode', 'unsupported mode');
    if (mode === MODE_CORRECT_EXISTING && (newEmployee || typeof historyId !== 'string' || !historyId.trim())) {
        C.invalid('historyId', 'correction requires an exact historical ID and an existing employee');
    }
    if (mode === MODE_NEW_VERSION && historyId !== null) C.invalid('historyId', 'not allowed for new version');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map((key) => [key, scope[key]]));
    for (const field of Object.keys(input)) if (!C.FACT_FIELDS.includes(field)) C.invalid(field, 'not an employment profile fact');
    let from = effectiveFrom ? C.calendarDate(effectiveFrom, 'effectiveFrom') : null;
    return inProfileTransaction(connection, capabilityProbe, async session => {
        let result;
        const submittedInput = input, submittedMaintenance = maintenance;
        const write = async () => {
            let input = submittedInput, maintenance = submittedMaintenance;
            if (!rehireOperation && newEmployee &&
                C.calendarDate(newEmployee.hmeromhnia_apoxorhshs)) {
                newEmployee = { ...newEmployee, energos: false };
            }
            const current = await requestScopedLean(
                employeeModel.findOne(employeeId ? { ...filter, _id: employeeId } : filter),
                session,
                LARGE_EMPLOYEE_FIELDS_EXCLUSION
            );
            if (employeeId && String(current?._id) !== String(employeeId)) throw failure('EMPLOYEE_PROFILE_STALE');
            if (newEmployee && current) throw failure('EMPLOYEE_PROFILE_ALREADY_EXISTS');
            if (!newEmployee && !current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
            let rows = await historyModel.find(filter).session(session).lean();
            const persistedRows = rows;
            if (!from && maintenance && current && rows.length === 0) {
                const proposed = { ...current, ...Object.fromEntries(Object.entries(
                    maintenance.employeeChanges || {}).filter(([, value]) => value !== undefined)) };
                for (const field of ['hmeromhnia_isxyos_oron_ergasias_apo',
                    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_proslhpshs']) {
                    from = C.calendarDate(proposed[field], field);
                    if (from) break;
                }
            }
            if (!from) C.invalid('effectiveFrom', 'required safe baseline date');
            // Enforce the form policy before even the legacy Maintenance shortcut.
            // Use mapped employee category (Add and Edit have different form names).
            if (!editorOperation && (newEmployee || maintenance)) {
                const context = { ...(current || newEmployee), ...Object.fromEntries(
                    Object.entries(maintenance?.employeeChanges || {}).filter(([, value]) => value !== undefined)) };
                const breaks = C.normalizeEmploymentBreakSubmission(input, context, { allowLegacyDuration: false });
                input = { ...input, ...breaks };
                // The legacy path writes the mapped patch rather than snapshot facts.
                if (maintenance) maintenance = { ...maintenance,
                    employeeChanges: { ...maintenance.employeeChanges, ...breaks } };
                if (context.eidikh_kathgoria_ergazomenoy !== undefined) maintenance = { ...maintenance,
                    historyChanges: { ...maintenance?.historyChanges, eidikh_kathgoria_ergazomenoy: context.eidikh_kathgoria_ergazomenoy } };
            }
            let datedRows = rows.filter((row) => effectiveStart(row));
            // Maintenance supplies existing server-mapped fields, never raw request data.
            // Resolve the exact identity inside the transaction, including on retries.
            const legacyMaintenance = !editorOperation && maintenance && !newEmployee && !T.versioned(current, rows) &&
                !semanticEmploymentProfileChanged(current, maintenance, input);
            let patch = legacyMaintenance ? legacyMaintenancePatch(maintenance.employeeChanges, current) : cleanMaintenancePatch(maintenance?.employeeChanges);
            let historyPatch = cleanMaintenancePatch(maintenance?.historyChanges);
            if (!rehireOperation && C.calendarDate(current?.hmeromhnia_apoxorhshs) &&
                Object.hasOwn(patch, 'hmeromhnia_apoxorhshs') &&
                !C.calendarDate(patch.hmeromhnia_apoxorhshs)) {
                throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_REQUIRES_CONTROLLED_FLOW');
            }

            const correctableIdentityFields = new Set(maintenance?.correctableIdentityFields || []);
            if ([...correctableIdentityFields].some(field => field !== 'hmeromhnia_apoxorhshs')) {
                C.invalid('correctableIdentityFields', 'unsupported maintenance identity correction');
            }

            // Hire date is employment-cycle identity. Normal Maintenance may send
            // the unchanged hire date back from the form, but it may not create a
            // different hire identity. Only the dedicated rehire command may do so.
            if (!editorOperation && !rehireOperation && current && !newEmployee && rows.length > 0) {
                const requestedHires = [
                    patch.hmeromhnia_proslhpshs,
                    historyPatch.hmeromhnia_proslhpshs
                ]
                    .filter(value => value !== undefined && value !== null && value !== '')
                    .map(value => C.calendarDate(value));
                if (requestedHires.length) {
                    const currentHire = C.calendarDate(current.hmeromhnia_proslhpshs);
                    if (!currentHire || requestedHires.some(value =>
                        !value || value.getTime() !== currentHire.getTime())) {
                        throw failure('EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE');
                    }
                }
            }

            let mutationPlan = null;
            let selection = { mode, historyId };
            if (!editorOperation && !rehireOperation && maintenance && !newEmployee && mode === MODE_NEW_VERSION) {
                const ownedInput = Object.fromEntries((maintenance.submittedProfileFields || [])
                    .filter(field => input[field] !== undefined).map(field => [field, input[field]]));
                const semanticProfilePatch = semanticEmploymentProfilePatch(current, {
                    employeeChanges: Object.fromEntries(Object.entries(patch)
                        .filter(([field]) => HISTORY_CURRENT_FIELDS.has(field))),
                    historyChanges: maintenance.submittedHistoryChanges || historyPatch,
                    identity: maintenance.identity
                }, ownedInput);
                const submittedHistory = {
                    ...(maintenance.submittedHistoryChanges || historyPatch),
                    ...(!legacyMaintenance ? semanticProfilePatch : {})
                };
                const ownedEmployeeFields = maintenance.submittedEmployeeFields || Object.keys(patch);
                const submittedEmployeePatch = {
                    ...Object.fromEntries(Object.entries(patch).filter(([field]) =>
                        ownedEmployeeFields.includes(field) && !HISTORY_CURRENT_FIELDS.has(field))),
                    ...semanticProfilePatch
                };
                const appendSnapshot = maintenance.intentHint === MUTATION_INTENTS.APPEND_NEW_VERSION
                    ? buildCompleteProfileSnapshot({ input,
                        current: { ...current, ...patch, ...historyPatch }, effectiveFrom: from })
                    : null;
                mutationPlan = resolveEmployeeHistoryMutation({
                    scope: filter,
                    currentEmployee: current,
                    historyRows: rows,
                    submittedState: {
                        effectiveFrom: from,
                        identity: maintenance.identity,
                        employeePatch: submittedEmployeePatch,
                        historyPatch: submittedHistory,
                        appendSnapshot
                    },
                    intentHint: maintenance.intentHint || MUTATION_INTENTS.MAINTENANCE,
                    historyId: maintenance.originalHistoryId || null,
                    expectedRevision: maintenance.expectedRevision ?? null
                });
                if (mutationPlan.state === MUTATION_STATES.CONFLICT) {
                    const error = failure(mutationPlan.responseCode);
                    error.field = mutationPlan.conflicts[0]?.field || undefined;
                    error.operation = MUTATION_INTENTS.MAINTENANCE;
                    throw error;
                }
                const deferredHistoryId = [MUTATION_STATES.CORRECT_EXISTING,
                    MUTATION_STATES.MOVE_EXISTING_BOUNDARY].includes(mutationPlan.state)
                    ? mutationPlan.targetHistoryId : null;
                if (deferredHistoryId) {
                    mutationPlan.historyPatch = {
                        ...cleanupPatchFor(mutationPlan, deferredHistoryId),
                        ...mutationPlan.historyPatch
                    };
                }
                rows = mutationPlan.canonicalRows;
                datedRows = rows.filter(row => effectiveStart(row));
                if (mutationPlan.state === MUTATION_STATES.NO_HISTORY_CHANGE) {
                    const physicalPlan = buildFinalHistoryMutationPlan({ beforeRows: persistedRows,
                        desiredRows: rows, historyModel });
                    const cleanup = await executeFinalMutationPlan({ physicalPlan,
                        currentBefore: current, currentPatch: mutationPlan.employeePatch,
                        filter, employeeId: current._id, session, employeeModel, historyModel,
                        auditModel, auditCollectionChecker, referenceChecker, connection,
                        diagnostics: mutationPlan.diagnostics });
                    const target = cleanup.verified.history.find(row =>
                        String(row._id) === mutationPlan.targetHistoryId) || null;
                    result = { facts: {}, history: target,
                        currentUpdated: Object.keys(mutationPlan.employeePatch).length > 0,
                        employee: cleanup.verified.current,
                        mode: MUTATION_STATES.NO_HISTORY_CHANGE, status: mutationPlan.status,
                        cleanupRequired: mutationPlan.cleanupRequired,
                        cleanup, diagnostics: mutationPlan.diagnostics,
                        idempotent: mutationPlan.idempotent };
                    return;
                }
                selection = mutationPlan.state === MUTATION_STATES.APPEND_NEW_VERSION
                    ? { mode: MODE_NEW_VERSION, historyId: null }
                    : { mode: MODE_CORRECT_EXISTING, historyId: mutationPlan.targetHistoryId };
                if (selection.mode === MODE_CORRECT_EXISTING) {
                    patch = { ...mutationPlan.employeePatch, ...mutationPlan.historyPatch };
                    historyPatch = mutationPlan.historyPatch;
                }
            }
            const selectedHistoryId = selection.historyId;
            if (selection.mode === MODE_CORRECT_EXISTING) {
                const target = rows.find((row) => String(row._id) === selectedHistoryId);
                const boundaryMove = mutationPlan?.state === MUTATION_STATES.MOVE_EXISTING_BOUNDARY;
                if (!target || !effectiveStart(target) || (!editorOperation && !boundaryMove &&
                    effectiveStart(target).getTime() !== from.getTime())) {
                    throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                }
                if (!mutationPlan && !editorOperation && maintenance?.identity && selectMaintenanceMode([target], maintenance.identity).historyId !== selectedHistoryId) {
                    throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                }
                if (editorOperation && Object.hasOwn(historyPatch, 'hmeromhnia_proslhpshs')) {
                    const requestedHire = C.calendarDate(historyPatch.hmeromhnia_proslhpshs);
                    const storedHire = C.calendarDate(target.hmeromhnia_proslhpshs);
                    if ((requestedHire?.getTime() ?? null) !== (storedHire?.getTime() ?? null)) {
                        throw failure('EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_LIFECYCLE_REPAIR');
                    }
                }
                const originalFrom = effectiveStart(target);
                const latest = !datedRows.some(row => effectiveStart(row) > originalFrom);
                const end = (editorOperation || boundaryMove) &&
                    Object.hasOwn(historyPatch, 'hmeromhnia_isxyos_oron_ergasias_eos')
                    ? C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_eos) : effectiveEnd(target);
                const baseline = T.anchor(current);
                if (editorOperation && baseline && originalFrom.getTime() === T.day(baseline.before).getTime() && from.getTime() !== originalFrom.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
                }
                const boundaryChanged = from.getTime() !== originalFrom.getTime() ||
                    (end?.getTime() ?? null) !== (effectiveEnd(target)?.getTime() ?? null);
                if (editorOperation && boundaryChanged && (!latest || from < originalFrom ||
                    (end && end < from) || !C.readEmploymentProfile(target).recorded)) {
                    throw failure('EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
                }
                if (boundaryChanged && datedRows.some((row) => String(row._id) !== selectedHistoryId &&
                    (!end || effectiveStart(row) <= end) && (!effectiveEnd(row) || effectiveEnd(row) >= from))) {
                    throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP');
                }
                const currentFrom = effectiveStart(current);
                // A latest-row correction can update current only when its identity
                // agrees. Missing current dates are allowed for legacy Maintenance.
                if (latest && currentFrom && currentFrom.getTime() !== originalFrom.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_CURRENT_IDENTITY_MISMATCH');
                }
                if (!latest || editorOperation) {
                    // Never fill an old historical gap from today's employee facts.
                    // Missing facts need an explicit correction, not inferred false/0.
                    const missing = C.readEmploymentProfile(target).unrecordedFields.filter((field) =>
                        ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field) &&
                        (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === undefined));
                    if (missing.length) throw failure('EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS');
                }
                if (legacyMaintenance) historyPatch = legacyMaintenancePatch(maintenance.historyChanges, target, true);
                const source = { ...(latest && !editorOperation ? { ...current, ...target } : target), ...historyPatch };
                const snapshot = legacyMaintenance ? {} : buildCompleteProfileSnapshot({ input, current: source, effectiveFrom: from });
                const capturedBaseline = latest && !legacyMaintenance ? T.capture(current, rows, from) : null;
                const facts = legacyMaintenance ? {} : Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
                const proposedCurrentChanges = latest ? { ...patch, ...facts,
                    ...(!legacyMaintenance ? currentProfileProjection(snapshot) : {}),
                    ...(capturedBaseline ? { [T.ANCHOR]: capturedBaseline } : {}) } :
                    Object.fromEntries(Object.entries(patch).filter(([field]) => !HISTORY_CURRENT_FIELDS.has(field)));
                const currentChanges = minimalSetPatch(current, proposedCurrentChanges);
                if (latest && !rehireOperation) {
                    const proposedDeparture = Object.hasOwn(currentChanges, 'hmeromhnia_apoxorhshs')
                        ? currentChanges.hmeromhnia_apoxorhshs
                        : current.hmeromhnia_apoxorhshs;
                    if (C.calendarDate(proposedDeparture)) currentChanges.energos = false;
                }
                if (Object.keys(currentChanges).length && !mutationPlan) {
                    const update = await employeeModel.updateOne({ ...filter, _id: current._id },
                        { $set: currentChanges }, { session });
                    if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
                }
                // Include the existing Maintenance contract mapping; preserve all
                // identity dates, sequence, creation time and surrounding rows.
                const correction = legacyMaintenance ? { ...historyPatch } : { ...historyPatch, ...snapshot,
                    afora_allagh_dialleimatos: true, hmeromhnia_isxyos_dialleimatos_apo: from };
                // Corrections cannot move any identity date or overwrite the sequence.
                const mutationCorrectableFields = new Set(correctableIdentityFields);
                if (mutationPlan) {
                    mutationCorrectableFields.add('hmeromhnia_lhxhs_symbashs');
                    if (boundaryMove) for (const field of [
                        'hmeromhnia_allaghs_symbashs',
                        'hmeromhnia_allaghs_orarioy_apo',
                        'hmeromhnia_allaghs_orarioy_eos',
                        'hmeromhnia_isxyos_oron_ergasias_apo',
                        'hmeromhnia_isxyos_oron_ergasias_eos'
                    ]) mutationCorrectableFields.add(field);
                }
                for (const field of IDENTITY_FIELDS) {
                    if (!mutationCorrectableFields.has(field)) delete correction[field];
                }
                if (editorOperation || boundaryMove) {
                    for (const field of IDENTITY_FIELDS) {
                        const value = historyPatch[field];
                        if ((editorOperation || mutationCorrectableFields.has(field)) &&
                            (C.calendarDate(value)?.getTime() ?? null) !== (C.calendarDate(target[field])?.getTime() ?? null)) {
                            correction[field] = value;
                        }
                    }
                    if (boundaryChanged) {
                        correction.hmeromhnia_isxyos_oron_ergasias_apo = from;
                        correction.hmeromhnia_isxyos_oron_ergasias_eos = end;
                    }
                }
                let storedHistory = { ...target, ...correction };
                let storedEmployee = { ...current, ...currentChanges };
                let cleanup = { auditWritten: false, updated: 0, deleted: 0 };
                if (mutationPlan) {
                    const desiredRows = rows.map(row => String(row._id) === String(target._id)
                        ? storedHistory : row);
                    const physicalPlan = buildFinalHistoryMutationPlan({ beforeRows: persistedRows,
                        desiredRows, historyModel });
                    cleanup = await executeFinalMutationPlan({ physicalPlan,
                        currentBefore: current, currentPatch: currentChanges,
                        filter, employeeId: current._id, session, employeeModel, historyModel,
                        auditModel, auditCollectionChecker, referenceChecker, connection,
                        diagnostics: mutationPlan.diagnostics,
                        targetedHistoryId: target._id,
                        targetedPatch: minimalSetPatch(target, correction) });
                    storedHistory = cleanup.verified.history.find(row =>
                        normalizedHistoryId(row._id) === normalizedHistoryId(target._id));
                    storedEmployee = cleanup.verified.current;
                } else {
                    const semanticCorrection = minimalSetPatch(target, correction);
                    if (Object.keys(semanticCorrection).length) {
                        semanticCorrection.updatedAt = nextHistoryRevision(target.updatedAt);
                        const update = await historyModel.updateOne({ ...filter, _id: target._id,
                            hmeromhnia_isxyos_oron_ergasias_apo: target.hmeromhnia_isxyos_oron_ergasias_apo ?? null,
                            hmeromhnia_allaghs_orarioy_apo: target.hmeromhnia_allaghs_orarioy_apo ?? null },
                        { $set: semanticCorrection }, { session });
                        if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                        storedHistory = { ...target, ...semanticCorrection };
                    }
                }
                result = { facts, history: storedHistory, currentUpdated: latest,
                    employee: storedEmployee,
                    status: mutationPlan?.status || 'CLEAN',
                    cleanupRequired: mutationPlan?.cleanupRequired === true,
                    cleanup,
                    diagnostics: mutationPlan?.diagnostics || {},
                    mode: legacyMaintenance ? MODE_LEGACY_MAINTENANCE : selection.mode };
                return;
            }
            if (datedRows.some((row) => effectiveStart(row) >= from)) throw failure('EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
            const openRows = datedRows.filter((row) => !effectiveEnd(row) || effectiveEnd(row) >= from);
            const currentHireKey = C.calendarDate(current?.hmeromhnia_proslhpshs)?.getTime() ?? null;
            const rowsToClose = rehireOperation
                ? openRows.filter(row =>
                    (C.calendarDate(row.hmeromhnia_proslhpshs)?.getTime() ?? null) === currentHireKey)
                : openRows;
            appendPredecessors({ openRows: rowsToClose, datedRows, rows, current, from, rehireOperation });
            if (legacyMaintenance) historyPatch = legacyMaintenancePatch(maintenance.historyChanges, null, true);
            if (maintenance && rows.length === 0 &&
                !C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_apo)) {
                historyPatch.hmeromhnia_isxyos_oron_ergasias_apo = from;
            }
            if (current && !newEmployee && !rehireOperation && rows.length > 0) {
                const currentHire = C.calendarDate(current.hmeromhnia_proslhpshs);
                if (currentHire) {
                    patch.hmeromhnia_proslhpshs = current.hmeromhnia_proslhpshs;
                    historyPatch.hmeromhnia_proslhpshs = current.hmeromhnia_proslhpshs;
                    patch.hmeromhnia_apoxorhshs = current.hmeromhnia_apoxorhshs ?? null;
                    historyPatch.hmeromhnia_apoxorhshs =
                        current.hmeromhnia_apoxorhshs ?? null;
                    historyPatch.afora_proslhpsh = false;
                }
            }
            const snapshot = legacyMaintenance ? {} : buildCompleteProfileSnapshot({ input,
                current: { ...(current || newEmployee), ...patch, ...historyPatch }, effectiveFrom: from });
            const facts = legacyMaintenance ? {} : Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
            const until = C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_eos);
            if (until && until < from) C.invalid('hmeromhnia_isxyos_oron_ergasias_eos', 'end precedes start');
            if (!legacyMaintenance) snapshot.hmeromhnia_isxyos_oron_ergasias_eos = until;
            const baseline = legacyMaintenance ? null : T.capture(current, rows, from);
            const currentUpdate = legacyMaintenance ? patch : { ...patch, ...facts,
                ...currentProfileProjection(snapshot), ...(baseline ? { [T.ANCHOR]: baseline } : {}),
                hmeromhnia_isxyos_oron_ergasias_apo: snapshot.hmeromhnia_isxyos_oron_ergasias_apo,
                hmeromhnia_isxyos_oron_ergasias_eos: until };
            if (rehireOperation) currentUpdate.employment_departure_restore = null;
            if (current && !rehireOperation) {
                const proposedDeparture = Object.hasOwn(currentUpdate, 'hmeromhnia_apoxorhshs')
                    ? currentUpdate.hmeromhnia_apoxorhshs
                    : current.hmeromhnia_apoxorhshs;
                if (C.calendarDate(proposedDeparture)) currentUpdate.energos = false;
            }
            let employee;
            if (current) {
                employee = { ...current, ...currentUpdate };
                // Updating the employee inside the transaction serializes competing
                // profile writes. Mongo write conflicts retry the entire fresh read.
                if (!mutationPlan) {
                    const update = await employeeModel.updateOne({ ...filter, _id: current._id }, { $set: currentUpdate }, { session });
                    if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
                }
            } else {
                [employee] = await employeeModel.create([{ ...newEmployee, ...filter, ...currentUpdate }], { session });
            }
            for (const predecessor of mutationPlan ? [] : rowsToClose) {
                const until = new Date(from); until.setUTCDate(until.getUTCDate() - 1);
                const revision = nextHistoryRevision(predecessor.updatedAt);
                const closed = await historyModel.updateOne({ ...filter, _id: predecessor._id,
                    hmeromhnia_isxyos_oron_ergasias_eos: predecessor.hmeromhnia_isxyos_oron_ergasias_eos ?? null },
                    { $set: { hmeromhnia_isxyos_oron_ergasias_eos: until,
                        updatedAt: revision } }, { session });
                if (closed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
            }
            const sequence = Math.max(0, ...rows.map((row) => Number(row.aa_eggrafhs) || 0)) + 1;
            const record = { ...historyPatch, ...filter, ...snapshot,
                aa_eggrafhs: String(sequence).padStart(4, '0'),
                afora_proslhpsh: historyPatch.afora_proslhpsh ?? !current };
            if (mutationPlan && rows.length === 0 && current) {
                for (const field of T.STANDARD_FIELDS) {
                    if ((!Object.hasOwn(record, field) || record[field] === undefined) &&
                        Object.hasOwn(current, field) && current[field] !== undefined) {
                        record[field] = current[field];
                    }
                }
            }
            if (mutationPlan && rows.length === 0 && current?.hmeromhnia_proslhpshs &&
                !record.hmeromhnia_proslhpshs) {
                record.hmeromhnia_proslhpshs = current.hmeromhnia_proslhpshs;
            }
            if (mutationPlan) record._id = typeof historyModel === 'function'
                ? new mongoose.Types.ObjectId() : `history-${rows.length}`;
            // Carry original omission context into schema validation for inherited legacy breaks.
            const prepareHistoryDocument = planned => {
                const historyDocument = typeof historyModel === 'function'
                    ? new historyModel(planned) : planned;
                if (legacyMaintenance && historyDocument.set) {
                    for (const field of C.FACT_FIELDS) historyDocument.set(field, undefined);
                }
                if (!legacyMaintenance && historyDocument.$locals) {
                    historyDocument.$locals.employmentProfileValidation = { input,
                        current: { ...(current || newEmployee), ...patch, ...historyPatch } };
                }
                return historyDocument;
            };
            const historyDocument = prepareHistoryDocument(record);
            // Mongoose defaults are not legacy facts. A baseline-compatible history
            // insertion must also remain physically unversioned after construction.
            let history;
            let cleanup = { auditWritten: false, updated: 0, deleted: 0 };
            if (mutationPlan) {
                const until = new Date(from); until.setUTCDate(until.getUTCDate() - 1);
                const closingIds = new Set(rowsToClose.map(row => String(row._id)));
                const desiredRows = rows.map(row => closingIds.has(String(row._id))
                    ? { ...row, hmeromhnia_isxyos_oron_ergasias_eos: until } : row);
                desiredRows.push(record);
                const physicalPlan = buildFinalHistoryMutationPlan({ beforeRows: persistedRows,
                    desiredRows, historyModel, historyDocumentFactory: prepareHistoryDocument });
                const plannedCurrentPatch = minimalSetPatch(current, currentUpdate);
                if (persistedRows.length === 0 &&
                    (current?.hmeromhnia_isxyos_oron_ergasias_apo == null ||
                        current.hmeromhnia_isxyos_oron_ergasias_apo === '') &&
                    record.hmeromhnia_isxyos_oron_ergasias_apo != null) {
                    plannedCurrentPatch.hmeromhnia_isxyos_oron_ergasias_apo =
                        record.hmeromhnia_isxyos_oron_ergasias_apo;
                }
                cleanup = await executeFinalMutationPlan({ physicalPlan,
                    currentBefore: current, currentPatch: plannedCurrentPatch,
                    filter, employeeId: current._id, session, employeeModel, historyModel,
                    auditModel, auditCollectionChecker, referenceChecker, connection,
                    diagnostics: mutationPlan.diagnostics,
                    targetedHistoryId: record._id,
                    targetedPatch: auditProjection(physicalPlan.finalRows.find(row =>
                        normalizedHistoryId(row._id) === normalizedHistoryId(record._id)) || {}),
                    historyDocumentFactory: prepareHistoryDocument });
                history = cleanup.inserted[0];
                employee = cleanup.verified.current;
            } else {
                [history] = await historyModel.create([historyDocument], { session });
            }
            result = { facts, history, employee,
                status: mutationPlan?.status || 'CLEAN',
                cleanupRequired: mutationPlan?.cleanupRequired === true,
                cleanup,
                diagnostics: mutationPlan?.diagnostics || {},
                mode: legacyMaintenance ? MODE_LEGACY_MAINTENANCE : selection.mode };
        };
        await write();
        // Created documents are used by the existing post-commit PDF workflow.
        result.employee?.$session?.(null);
        return result;
    }, activeSession);
}

// First departure closes the current cycle's terminal evidence and latest
// work-terms profile without inserting another history version.
async function writeEmployeeDeparture({ scope, employeeId, departureDate, input = {}, effectiveFrom,
    maintenance = {}, connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(key =>
        typeof scope[key] === 'string' && scope[key].trim()) ||
        typeof employeeId !== 'string' || !employeeId.trim()) C.invalid('scope', 'complete employee scope required');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, scope[key]]));
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const current = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
        if (!current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
        const rows = await historyModel.find(filter).session(session).lean();
        const transition = buildEmployeeDepartureTransition({ currentEmployee: current, history: rows, departureDate });
        if (!rows.length) {
            // Imported employees retain the established one-row baseline transaction.
            // A future schedule start is not the validity start of a same-day
            // departure's first work-terms baseline.
            const baselineFrom = C.calendarDate(effectiveFrom) > C.calendarDate(transition.departure)
                ? current.hmeromhnia_proslhpshs : effectiveFrom;
            return writeEmployeeEmploymentProfile({ scope, employeeId, input, effectiveFrom: baselineFrom,
                maintenance, connection, employeeModel, historyModel, capabilityProbe,
                [ACTIVE_SESSION]: session });
        }
        const departure = C.calendarDate(transition.departure);
        const submitted = new Set(maintenance.submittedFormFields || []);
        const mappedEmployee = cleanMaintenancePatch(maintenance.employeeChanges);
        if (maintenance.submittedEmployeeFields) {
            const owned = new Set(maintenance.submittedEmployeeFields);
            for (const field of Object.keys(mappedEmployee)) if (!owned.has(field)) delete mappedEmployee[field];
        }
        for (const field of [...IDENTITY_FIELDS, 'hmeromhnia_isxyos_dialleimatos_apo']) {
            if (field === 'hmeromhnia_apoxorhshs' || field === 'hmeromhnia_isxyos_oron_ergasias_eos') continue;
            if (submitted.has(field) && Object.hasOwn(mappedEmployee, field) &&
                (C.calendarDate(mappedEmployee[field])?.getTime() ?? null) !==
                (C.calendarDate(current[field])?.getTime() ?? null)) {
                throw failure(field === 'hmeromhnia_proslhpshs'
                    ? 'EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE'
                    : 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
            }
            delete mappedEmployee[field];
        }
        delete mappedEmployee.energos;
        const profileFactsChanged = semanticEmploymentProfileChanged(current, {}, input);
        let factChanges = {};
        if (profileFactsChanged) {
            if (!C.readEmploymentProfile(current).recorded ||
                !C.readEmploymentProfile(transition.latestProfileRow).recorded ||
                effectiveStart(current)?.getTime() !== effectiveStart(transition.latestProfileRow)?.getTime()) {
                throw failure('EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
            }
            const before = C.normalizeEmploymentProfileSubmission({}, current);
            const after = C.normalizeEmploymentProfileSubmission(input, current);
            factChanges = Object.fromEntries(C.FACT_FIELDS.filter(field =>
                JSON.stringify(before[field]) !== JSON.stringify(after[field])).map(field => [field, after[field]]));
        }
        const employeePatch = { ...mappedEmployee, ...factChanges,
            hmeromhnia_apoxorhshs: departure, energos: false };
        if (!C.calendarDate(current.hmeromhnia_apoxorhshs)) {
            employeePatch.employment_departure_restore = {
                departure: transition.departure,
                terminal_id: String(transition.terminalHistoryRow._id),
                profile_id: String(transition.latestProfileRow._id),
                employee_end_clamped: Boolean(transition.clampEmployeeEnd),
                profile_end_clamped: Boolean(transition.clampProfileEnd),
                employee_end_before: current.hmeromhnia_isxyos_oron_ergasias_eos ?? null,
                profile_end_before: transition.latestProfileRow.hmeromhnia_isxyos_oron_ergasias_eos ?? null
            };
        }
        if (transition.clampEmployeeEnd) employeePatch.hmeromhnia_isxyos_oron_ergasias_eos = departure;
        else delete employeePatch.hmeromhnia_isxyos_oron_ergasias_eos;
        const mappedHistory = cleanMaintenancePatch(
            maintenance.submittedHistoryChanges || maintenance.historyChanges);
        const profilePatch = { ...factChanges };
        for (const [field, value] of Object.entries(mappedHistory)) {
            if (field === 'hmeromhnia_isxyos_dialleimatos_apo') {
                if ((C.calendarDate(value)?.getTime() ?? null) !==
                    (C.calendarDate(current[field])?.getTime() ?? null)) {
                    throw failure('EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
                }
                continue;
            }
            if (!HISTORY_CURRENT_FIELDS.has(field) || IDENTITY_FIELDS.includes(field) ||
                ['afora_proslhpsh', 'afora_allagh_oron_ergasias', 'afora_allagh_dialleimatos'].includes(field)) continue;
            if (JSON.stringify(value) !== JSON.stringify(current[field])) profilePatch[field] = value;
        }
        const storedEmployeePatch = minimalSetPatch(current, employeePatch);
        if (Object.keys(storedEmployeePatch).length) {
            const updated = await employeeModel.updateOne({ ...filter, _id: current._id },
                { $set: storedEmployeePatch }, { session });
            if (updated.matchedCount !== 1) throw failure('EMPLOYEE_DEPARTURE_CONFLICT');
        }

        const historyPatches = new Map();
        const terminal = transition.terminalHistoryRow;
        const profile = transition.latestProfileRow;
        historyPatches.set(String(terminal._id), { hmeromhnia_apoxorhshs: departure });
        if (transition.clampProfileEnd) {
            const id = String(profile._id);
            historyPatches.set(id, { ...(historyPatches.get(id) || {}),
                hmeromhnia_isxyos_oron_ergasias_eos: departure });
        }
        if (Object.keys(profilePatch).length) {
            const id = String(profile._id);
            historyPatches.set(id, { ...(historyPatches.get(id) || {}), ...profilePatch });
        }
        for (const [id, patch] of historyPatches) {
            const row = rows.find(item => String(item._id) === id);
            const storedPatch = minimalSetPatch(row, patch);
            if (!Object.keys(storedPatch).length) {
                historyPatches.set(id, {});
                continue;
            }
            storedPatch.updatedAt = nextHistoryRevision(row.updatedAt);
            historyPatches.set(id, storedPatch);
            const changed = await historyModel.updateOne({ ...filter, _id: row._id },
                { $set: storedPatch }, { session });
            if (changed.matchedCount !== 1) throw failure('EMPLOYEE_DEPARTURE_CONFLICT');
        }
        return { employee: { ...current, ...storedEmployeePatch }, mode: 'MODE_DEPARTURE',
            history: { ...terminal, ...historyPatches.get(String(terminal._id)) } };
    });
}

// A mistaken departure is reversed only with the before-image recorded by the
// departure writer. Older clamped records without provenance fail closed.
async function writeEmployeeDepartureCancellation({ scope, employeeId, input = {}, maintenance = {},
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(key =>
        typeof scope[key] === 'string' && scope[key].trim()) ||
        typeof employeeId !== 'string' || !employeeId.trim()) C.invalid('scope', 'complete employee scope required');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, scope[key]]));
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const current = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
        if (!current || current.archived === true || current.energos !== false) {
            throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_CONFLICT');
        }
        const rows = await historyModel.find(filter).session(session).lean();
        const departure = C.calendarDate(current.hmeromhnia_apoxorhshs);
        const marker = current.employment_departure_restore;
        if (!departure || !marker || marker.departure !== departure.toISOString().slice(0, 10)) {
            throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_PROVENANCE_REQUIRED');
        }
        const comparable = (field, value) => {
            if (value == null || value === '') return null;
            const path = ErgazomenoiModel.schema.path(field);
            const cast = path ? path.cast(value) : value;
            if (cast == null || cast === '') return null;
            return cast instanceof Date ? cast.toISOString() : JSON.stringify(cast);
        };
        const submitted = new Set(maintenance.submittedEmployeeFields || []);
        const mapped = cleanMaintenancePatch(maintenance.employeeChanges);
        const restoredEnd = marker.employee_end_clamped
            ? marker.employee_end_before : current.hmeromhnia_isxyos_oron_ergasias_eos;
        const hasOtherEmployeeChange = [...submitted].some(field => {
            if (!Object.hasOwn(mapped, field) ||
                ['energos', 'hmeromhnia_apoxorhshs', 'updatedAt'].includes(field)) return false;
            const submittedValue = comparable(field, mapped[field]);
            return submittedValue !== comparable(field, current[field]) &&
                !(field === 'hmeromhnia_isxyos_oron_ergasias_eos' &&
                    submittedValue === comparable(field, restoredEnd));
        });
        const hasOtherHistoryChange = Object.entries(maintenance.submittedHistoryChanges || {})
            .some(([field, value]) => !['hmeromhnia_apoxorhshs', 'updatedAt'].includes(field) &&
                comparable(field, value) !== comparable(field, current[field]));
        if (hasOtherEmployeeChange || hasOtherHistoryChange ||
            semanticEmploymentProfileChanged(current, {}, input)) {
            throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_SEPARATE_SAVE_REQUIRED');
        }
        const cycles = buildEmploymentCycles({ currentEmployee: current, history: rows });
        const cycle = cycles.at(-1);
        if (!cycle?.is_current_cycle || cycle.departure_date !== marker.departure) {
            throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_CONFLICT');
        }
        const terminal = rows.find(row => String(row._id) === marker.terminal_id);
        const profile = rows.find(row => String(row._id) === marker.profile_id);
        if (!terminal || !profile || !cycle.history_ids.includes(marker.terminal_id) ||
            !cycle.history_ids.includes(marker.profile_id) ||
            C.calendarDate(terminal.hmeromhnia_apoxorhshs)?.getTime() !== departure.getTime() ||
            (marker.employee_end_clamped && C.calendarDate(current.hmeromhnia_isxyos_oron_ergasias_eos)?.getTime() !== departure.getTime()) ||
            (marker.profile_end_clamped && C.calendarDate(profile.hmeromhnia_isxyos_oron_ergasias_eos)?.getTime() !== departure.getTime())) {
            throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_CONFLICT');
        }
        const employeePatch = { hmeromhnia_apoxorhshs: null, energos: true,
            employment_departure_restore: null };
        if (marker.employee_end_clamped) employeePatch.hmeromhnia_isxyos_oron_ergasias_eos = marker.employee_end_before;
        const updated = await employeeModel.updateOne({ ...filter, _id: current._id },
            { $set: employeePatch }, { session });
        if (updated.matchedCount !== 1) throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_CONFLICT');
        const historyPatches = new Map([[marker.terminal_id, { hmeromhnia_apoxorhshs: null }]]);
        if (marker.profile_end_clamped) historyPatches.set(marker.profile_id,
            { ...(historyPatches.get(marker.profile_id) || {}),
                hmeromhnia_isxyos_oron_ergasias_eos: marker.profile_end_before });
        for (const [id, patch] of historyPatches) {
            const row = rows.find(item => String(item._id) === id);
            patch.updatedAt = nextHistoryRevision(row.updatedAt);
            const changed = await historyModel.updateOne({ ...filter, _id: row._id }, { $set: patch }, { session });
            if (changed.matchedCount !== 1) throw failure('EMPLOYEE_DEPARTURE_CANCELLATION_CONFLICT');
        }
        return { employee: { ...current, ...employeePatch }, mode: 'MODE_DEPARTURE_CANCELLATION',
            history: { ...terminal, ...historyPatches.get(marker.terminal_id) } };
    });
}

// Rehire appends a new profile only after the prior lifecycle evidence and
// latest work-terms profile are closed in the same transaction.
async function writeEmployeeRehire({ scope, employeeId, rehireDate, input = {},
    employeeChanges = {}, historyChanges = {},
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(key =>
        typeof scope[key] === 'string' && scope[key].trim())) {
        C.invalid('scope', 'complete scope required');
    }
    if (typeof employeeId !== 'string' || !employeeId.trim()) {
        C.invalid('employeeId', 'required');
    }

    const filter = Object.fromEntries(
        ['team', 'company_kod', 'kodikos'].map(key => [key, scope[key]])
    );

    return inProfileTransaction(connection, capabilityProbe, async session => {
        const current = await employeeModel
            .findOne({ ...filter, _id: employeeId })
            .session(session)
            .lean();
        if (!current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');

        const rows = await historyModel.find(filter).session(session).lean();
        const transition = buildEmployeeRehireTransition({
            currentEmployee: current,
            history: rows,
            rehireDate,
            employeeChanges,
            historyChanges
        });

        const previousRows = transition.previous_cycle.history_ids.map(id =>
            rows.find(row => String(row._id) === String(id)));
        const terminalRow = previousRows.at(-1);
        const previousRow = [...previousRows].reverse().find(row => row && effectiveStart(row));
        if (!terminalRow || !previousRow) throw failure('EMPLOYEE_REHIRE_HISTORY_REQUIRED');

        const departure = C.calendarDate(transition.previous_cycle.departure_date);
        const previousStart = effectiveStart(previousRow);
        const previousEnd = effectiveEnd(previousRow);
        if (!departure || !previousStart || previousStart > departure) {
            throw failure('EMPLOYEE_REHIRE_HISTORY_INVALID');
        }
        const profilePatch = {};
        if (!previousEnd || previousEnd > departure) profilePatch.hmeromhnia_isxyos_oron_ergasias_eos = departure;
        if (String(previousRow._id) === String(terminalRow._id)) profilePatch.hmeromhnia_apoxorhshs = departure;
        if (Object.keys(profilePatch).length) {
            profilePatch.updatedAt = nextHistoryRevision(previousRow.updatedAt);
            const closed = await historyModel.updateOne({ ...filter, _id: previousRow._id },
                { $set: profilePatch }, { session });
            if (closed.matchedCount !== 1) throw failure('EMPLOYEE_REHIRE_HISTORY_STALE');
        }
        if (String(previousRow._id) !== String(terminalRow._id) &&
            C.calendarDate(terminalRow.hmeromhnia_apoxorhshs)?.getTime() !== departure.getTime()) {
            const terminalClosed = await historyModel.updateOne({ ...filter, _id: terminalRow._id },
                { $set: { hmeromhnia_apoxorhshs: departure,
                    updatedAt: nextHistoryRevision(terminalRow.updatedAt) } }, { session });
            if (terminalClosed.matchedCount !== 1) throw failure('EMPLOYEE_REHIRE_HISTORY_STALE');
        }

        const result = await writeEmployeeEmploymentProfile({
            scope,
            employeeId,
            effectiveFrom: transition.effective_from,
            mode: MODE_NEW_VERSION,
            input,
            maintenance: {
                employeeChanges: transition.employee_changes,
                historyChanges: transition.history_changes,
                identity: transition.history_changes
            },
            connection,
            employeeModel,
            historyModel,
            capabilityProbe,
            [ACTIVE_SESSION]: session,
            [REHIRE_OPERATION]: true
        });

        return {
            ...result,
            cycle_no: transition.cycle_no,
            rehire_date: transition.effective_from,
            previous_cycle: transition.previous_cycle
        };
    });
}
module.exports = { MODE_NEW_VERSION, MODE_CORRECT_EXISTING, MODE_LEGACY_MAINTENANCE,
    transactionCapability, normalizeHistoryObjectIds, buildScopedHistoryDeleteFilter,
    writeEmployeeEmploymentProfile, writeEmployeeDeparture, writeEmployeeDepartureCancellation,
    writeEmployeeRehire, writeEmployeeEmploymentProfileCorrections,
    writeEmployeeEmploymentHistoryOperations, selectMaintenanceMode };
