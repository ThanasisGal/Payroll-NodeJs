'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const LifecycleAuditModel = require('../../models/apasxoliseisPeriodLifecycleAudit');
const { ProdhlomenaOrariaModel, ErgazomenoiModel,
    IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');
const { ArgiesModel } = require('../../models/stathera_arxeia');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { startOfWeekMondayUtc } = require('../../utils/date/mondaySundayWeek');
const { employeeKey, preloadBorrowedEmploymentProfileContexts } =
    require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { preloadEffectiveHolidayContextProvider } =
    require('./apasxoliseisEffectiveHolidayContextProviderService');
const { buildNoCardsDisplayContext } =
    require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const FINGERPRINT_VERSION = 'HISTORICAL_PERIOD_FACTS_V1';
const EMPLOYMENT_CALCULATION_SEMANTICS_VERSION = 'employment-calculation-semantics:v2';
const SOURCE_FIELDS = Object.freeze([
    'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia',
    'kathgoria_ergasias', 'apo_ora_01', 'eos_ora_01', 'apo_ora_02', 'eos_ora_02',
    'apo_ora_03', 'eos_ora_03', 'ores_ergasias', 'repo', 'adeia', 'kathgoria_adeias',
    'astheneia', 'argia', 'cards_apo_ora_01', 'cards_eos_ora_01', 'cards_apo_ora_02',
    'cards_eos_ora_02', 'cards_apo_ora_03', 'cards_eos_ora_03', 'cards_ores_ergasias',
    'is_locked'
]);
const DEPENDENCY_FIELDS = Object.freeze([...SOURCE_FIELDS,
    'kathgoria_ergasias_apologistika', 'repo_apologistika', 'adeia_apologistika',
    'kathgoria_adeias_apologistika', 'astheneia_apologistika',
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
    'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
]);
const RESULT_FIELDS = Object.freeze([...DEPENDENCY_FIELDS,
    'ores_ergasias_apologistika', 'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika', 'ores_nominhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_apologistika', 'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika', 'kyriakes_apologistika'
]);

function reconstructionError(code, statusCode, message) {
    const error = new Error(message || code); error.code = code; error.statusCode = statusCode; return error;
}
function dateOnly(value) {
    const key = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
    const date = new Date(`${key}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(date.getTime())) {
        throw reconstructionError('INVALID_PERIOD_SCOPE', 400, 'Μη έγκυρη περίοδος.');
    }
    return date;
}
function isPastDeadline(periodEnd, now = new Date()) {
    const end = dateOnly(periodEnd);
    const deadline = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 2, 0));
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric',
        month: '2-digit', day: '2-digit' }).formatToParts(now).reduce((out, part) => {
        if (part.type !== 'literal') out[part.type] = part.value; return out;
    }, {});
    return dateOnly(`${parts.year}-${parts.month}-${parts.day}`) > deadline;
}
function dependencyWindow(periodStart) {
    const start = dateOnly(periodStart);
    const weekStart = startOfWeekMondayUtc(start);
    if (weekStart.getTime() === start.getTime()) return Object.freeze({ start: null, end: null });
    const end = new Date(start); end.setUTCDate(end.getUTCDate() - 1);
    return Object.freeze({ start: weekStart, end });
}
function selectFields(row, fields) {
    const selected = {};
    for (const field of fields) if (row[field] !== undefined) selected[field] = row[field];
    return selected;
}
function fingerprintRows(rows = [], fields = DEPENDENCY_FIELDS, {
    calculationSemanticsVersion = null
} = {}) {
    const normalized = [...rows]
        .map((row) => selectFields(row, fields))
        .sort((a, b) => [String(a.kodikos || ''), String(a.hmeromhnia || ''), String(a._id || '')]
            .join('|').localeCompare([String(b.kodikos || ''), String(b.hmeromhnia || ''), String(b._id || '')].join('|')));
    return crypto.createHash('sha256').update(JSON.stringify({ version: FINGERPRINT_VERSION,
        ...(calculationSemanticsVersion
            ? { calculation_semantics_version: calculationSemanticsVersion } : {}),
        rows: canonicalize(normalized) })).digest('hex');
}
function projectionForHistoricalState({ record, pastDeadline, dependencyFingerprint }) {
    if (!pastDeadline || record?.status === 'FINALIZED') return null;
    if (record?.historical_reconstruction_status === 'COMPLETED') {
        return record.historical_dependency_fingerprint === dependencyFingerprint
            ? 'HISTORICAL_RECONSTRUCTED' : 'HISTORICAL_RECONSTRUCTION_STALE';
    }
    return 'HISTORICAL_RECONSTRUCTION_REQUIRED';
}
function actor(session = {}) {
    const role = assertCriticalEmploymentDecisionRole(session);
    const userId = String(session.userId || '').trim();
    if (!mongoose.isValidObjectId(userId)) throw reconstructionError('NOT_AUTHORIZED', 403, 'Μη έγκυρη ενεργή συνεδρία.');
    return { user_id: userId, user_name: String(session.userName || session.username || userId).trim(), role };
}
function commandIdentity({ scope, reason, requestId, action }) {
    return crypto.createHash('sha256').update(JSON.stringify({ action, requestId, reason,
        scope: { ...scope, period_start: dateOnly(scope.period_start).toISOString(),
            period_end: dateOnly(scope.period_end).toISOString() } })).digest('hex');
}
async function transaction(work) {
    const session = await mongoose.startSession();
    try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
    finally { await session.endSession(); }
}
async function loadRows({ scope, start, end, fields, prodhlomenaModel = ProdhlomenaOrariaModel, session = null }) {
    if (!start || !end) return [];
    let query = prodhlomenaModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma,
        hmeromhnia: mongoose.trusted({ $gte: start, $lte: end }) })
        .select(fields.join(' ')).sort({ kodikos: 1, hmeromhnia: 1, _id: 1 });
    if (session && typeof query.session === 'function') query = query.session(session);
    return typeof query.lean === 'function' ? query.lean() : query;
}
function hash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}
async function calculateHolidayDependencies({ scope, start, end, rows, models = {} }) {
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel === undefined
        ? IstorikoProslhpseonAllagonModel : models.historyModel;
    const companiesModel = models.companiesModel || CompaniesModel;
    const argiesModel = models.argiesModel || ArgiesModel;
    const codes = [...new Set(rows.map((row) => String(row.kodikos || '').trim()).filter(Boolean))];
    if (!codes.length) return { fingerprint: hash([]), legacy_compatible: true };
    const employees = await employeeModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, kodikos: mongoose.trusted({ $in: codes }) }).lean();
    const histories = historyModel ? await historyModel.find({ team: scope.team,
        company_kod: scope.company_kod,
        kodikos: mongoose.trusted({ $in: codes }) }).lean() : [];
    const historyByCode = new Map();
    histories.forEach((row) => { const code = String(row.kodikos || '').trim();
        if (!historyByCode.has(code)) historyByCode.set(code, []);
        historyByCode.get(code).push(row); });
    const historiesByEmployeeKey = new Map(employees.map((employee) => [employeeKey(employee),
        historyByCode.get(String(employee.kodikos || '').trim()) || []]));
    const borrowedProfileContexts = await preloadBorrowedEmploymentProfileContexts({
        team: scope.team, employees, models: { companiesModel, employeeModel, historyModel } });
    const provider = await preloadEffectiveHolidayContextProvider({ team: scope.team, employees,
        etos: String(start.getUTCFullYear()), periodStart: start, periodEnd: end,
        normalHistoryByEmployeeKey: historiesByEmployeeKey, borrowedProfileContexts,
        models: { companiesModel, argiesModel } });
    const legacyContext = await buildNoCardsDisplayContext({ team: scope.team,
        companyId: scope.company_kod, etos: String(start.getUTCFullYear()), periodStart: start,
        periodEnd: end, companiesModel, argiesModel });
    const employeeByCode = new Map(employees.map((employee) =>
        [String(employee.kodikos || '').trim(), employee]));
    const dependencies = [];
    let legacyCompatible = true;
    for (const row of rows) {
        const code = String(row.kodikos || '').trim();
        const employee = employeeByCode.get(code);
        if (!employee) continue;
        const date = dateOnly(row.hmeromhnia).toISOString().slice(0, 10);
        const resolution = provider.resolveForEmployeeDate({ employee, reviewDate: row.hmeromhnia,
            normalHistory: historyByCode.get(code) || [] });
        if (resolution.blocked === true) {
            dependencies.push({ employee: code, date, blocked: true,
                resolution_reason: resolution.resolution_reason });
            legacyCompatible = false;
            continue;
        }
        const effectiveHoliday = resolution.holidayContext.argiesByDateKey.get(date) || null;
        const legacyHoliday = legacyContext.argiesByDateKey.get(date) || null;
        if (!effectiveHoliday && !legacyHoliday) continue;
        const effectiveDecision = effectiveHoliday
            ? Boolean(effectiveHoliday.companyOperatesOnHoliday) : null;
        const legacyDecision = legacyHoliday
            ? Boolean(legacyHoliday.companyOperatesOnHoliday) : null;
        const effectiveMandatory = effectiveHoliday?.isMandatoryHoliday === true;
        const legacyMandatory = legacyHoliday?.isMandatoryHoliday === true;
        if (effectiveDecision !== legacyDecision ||
            Boolean(effectiveHoliday) !== Boolean(legacyHoliday) ||
            effectiveMandatory !== legacyMandatory) {
            legacyCompatible = false;
        }
        dependencies.push({ employee: code, date,
            effective_company_id: resolution.effective_company_id,
            holiday_exists: Boolean(effectiveHoliday),
            is_mandatory: effectiveMandatory,
            company_operates: effectiveDecision,
            operation_source: effectiveHoliday?.companyOperationSource || null });
    }
    return { fingerprint: hash(dependencies), legacy_compatible: legacyCompatible };
}
function isHistoricalDependencyCurrent(record, fingerprints) {
    if (!Object.prototype.hasOwnProperty.call(fingerprints || {},
        'holiday_dependency_fingerprint') &&
        !Object.prototype.hasOwnProperty.call(fingerprints || {},
            'legacy_dependency_fingerprint')) {
        return record?.historical_dependency_fingerprint === fingerprints?.dependency_fingerprint;
    }
    if (record?.historical_holiday_dependency_fingerprint) {
        return record.historical_dependency_fingerprint === fingerprints.dependency_fingerprint &&
            record.historical_holiday_dependency_fingerprint ===
                fingerprints.holiday_dependency_fingerprint;
    }
    return record?.historical_dependency_fingerprint === fingerprints.legacy_dependency_fingerprint &&
        fingerprints.legacy_holiday_semantics_compatible === true;
}
async function calculateHistoricalFingerprints({ scope, prodhlomenaModel = ProdhlomenaOrariaModel,
    session = null, models = {}, holidayDependencyResolver = calculateHolidayDependencies }) {
    const periodStart = dateOnly(scope.period_start), periodEnd = dateOnly(scope.period_end);
    const window = dependencyWindow(periodStart);
    const [sourceRows, dependencyRows, resultRows] = await Promise.all([
        loadRows({ scope, start: periodStart, end: periodEnd, fields: SOURCE_FIELDS, prodhlomenaModel, session }),
        loadRows({ scope, start: window.start, end: window.end, fields: DEPENDENCY_FIELDS, prodhlomenaModel, session }),
        loadRows({ scope, start: periodStart, end: periodEnd, fields: RESULT_FIELDS, prodhlomenaModel, session })
    ]);
    const dependencyStart = window.start || periodStart;
    const holidayRows = await loadRows({ scope, start: dependencyStart, end: periodEnd,
        fields: ['_id', 'kodikos', 'hmeromhnia'], prodhlomenaModel, session });
    const holiday = await holidayDependencyResolver({ scope, start: dependencyStart,
        end: periodEnd, rows: holidayRows, models });
    const legacyDependencyFingerprint = fingerprintRows(dependencyRows, DEPENDENCY_FIELDS, {
        calculationSemanticsVersion: EMPLOYMENT_CALCULATION_SEMANTICS_VERSION
    });
    return Object.freeze({ dependency_window_start: window.start, dependency_window_end: window.end,
        source_fingerprint: fingerprintRows(sourceRows, SOURCE_FIELDS),
        legacy_dependency_fingerprint: legacyDependencyFingerprint,
        dependency_fingerprint: legacyDependencyFingerprint,
        holiday_dependency_fingerprint: holiday.fingerprint,
        legacy_holiday_semantics_compatible: holiday.legacy_compatible,
        result_fingerprint: fingerprintRows(resultRows, RESULT_FIELDS) });
}
async function authorizeHistoricalReconstruction({ session: userSession, scope, reason, requestId,
    confirmation, now = new Date(), periodControlModel = PeriodControlModel,
    auditModel = LifecycleAuditModel, transactionRunner = transaction,
    fingerprintResolver = calculateHistoricalFingerprints }) {
    const by = actor(userSession); const cleanReason = String(reason || '').trim();
    const cleanRequestId = String(requestId || '').trim();
    if (!cleanReason) throw reconstructionError('HISTORICAL_RECONSTRUCTION_REASON_REQUIRED', 400, 'Απαιτείται αιτιολογία ανακατασκευής.');
    if (confirmation !== true) throw reconstructionError('HISTORICAL_RECONSTRUCTION_CONFIRMATION_REQUIRED', 400, 'Απαιτείται ρητή επιβεβαίωση ευθύνης.');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(cleanRequestId)) throw reconstructionError('INVALID_HISTORICAL_RECONSTRUCTION_REQUEST_ID', 400, 'Μη έγκυρο αναγνωριστικό αιτήματος.');
    if (!isPastDeadline(scope.period_end, now)) throw reconstructionError(
        'HISTORICAL_RECONSTRUCTION_NOT_OVERDUE', 409,
        'Η περίοδος είναι εντός προθεσμίας και χρησιμοποιεί τον κανονικό υπολογισμό.');
    const identity = commandIdentity({ scope, reason: cleanReason, requestId: cleanRequestId, action: 'AUTHORIZE' });
    try {
        return await transactionRunner(async (dbSession) => {
        const current = await periodControlModel.findOne({ ...scope }).session(dbSession).lean();
        if (current?.status === 'FINALIZED' || current?.frozen_snapshot_id) throw reconstructionError('PERIOD_CONTROL_FINALIZED', 409, 'Η οριστικοποιημένη περίοδος δέχεται μόνο διορθωτική επανεκτίμηση.');
        if (current?.status === 'LOCKED') throw reconstructionError('PERIOD_CONTROL_LOCKED', 409, 'Η περίοδος είναι κλειδωμένη.');
        if (current?.active_calculation_id) throw reconstructionError('PERIOD_CONTROL_CALCULATION_IN_PROGRESS', 409, 'Υπάρχει υπολογισμός σε εξέλιξη.');
        if (current?.last_historical_reconstruction_request_id === cleanRequestId &&
            ['AUTHORIZED', 'COMPLETED'].includes(current?.historical_reconstruction_status)) {
            if (current.last_historical_reconstruction_command_identity !== identity) throw reconstructionError('HISTORICAL_RECONSTRUCTION_REQUEST_CONFLICT', 409, 'Το request_id έχει διαφορετική εντολή.');
            return { record: current, idempotent: true };
        }
        const abandonedAuthorization = current?.historical_reconstruction_status === 'AUTHORIZED'
            ? current : null;
        let staleDetails = null;
        if (current?.historical_reconstruction_status === 'COMPLETED') {
            const fingerprints = await fingerprintResolver({ scope, session: dbSession });
            if (isHistoricalDependencyCurrent(current, fingerprints)) {
                throw reconstructionError('HISTORICAL_RECONSTRUCTION_DEPENDENCY_CURRENT', 409,
                    'Η εξάρτηση της ανακατασκευασμένης περιόδου παραμένει τρέχουσα.');
            }
            staleDetails = { previous_dependency_fingerprint: current.historical_dependency_fingerprint,
                current_dependency_fingerprint: fingerprints.dependency_fingerprint,
                previous_reconstruction_version: current.historical_reconstruction_version };
        }
        const nextVersion = Number(current?.historical_reconstruction_version || 0) + 1;
        const eventType = nextVersion === 1 ? 'HISTORICAL_RECONSTRUCTION_OPEN' : 'HISTORICAL_RECONSTRUCTION_REASSESS';
        const deadline = new Date(Date.UTC(dateOnly(scope.period_end).getUTCFullYear(), dateOnly(scope.period_end).getUTCMonth() + 2, 0));
        const filter = current ? { ...scope, status: 'OPEN', version: current.version,
            active_calculation_id: mongoose.trusted({ $in: ['', null] }) } : { ...scope, _id: { $exists: false } };
        const set = { historical_reconstruction_status: 'AUTHORIZED',
            historical_reconstruction_pending_version: nextVersion,
            historical_reconstruction_pending_started_at: now,
            historical_reconstruction_pending_by_user_id: by.user_id,
            historical_reconstruction_pending_by_user_name: by.user_name,
            historical_reconstruction_pending_by_user_role: by.role,
            historical_reconstruction_pending_reason: cleanReason,
            last_historical_reconstruction_request_id: cleanRequestId,
            last_historical_reconstruction_command_identity: identity, updated_at: now };
        let updated;
        if (!current) {
            const docs = await periodControlModel.create([{ ...scope, status: 'OPEN', deadline, ...set,
                historical_reconstruction_version: 0,
                version: 1, write_fence_version: 0, created_at: now }], { session: dbSession }); updated = docs[0];
        } else updated = await periodControlModel.findOneAndUpdate(filter, { $set: set, $inc: { version: 1 } }, { new: true, session: dbSession });
        if (!updated) throw reconstructionError('HISTORICAL_RECONSTRUCTION_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
        const auditDocuments = [];
        if (abandonedAuthorization) auditDocuments.push({ ...scope,
            event_type: 'HISTORICAL_RECONSTRUCTION_FAILED',
            actor_user_id: abandonedAuthorization.historical_reconstruction_pending_by_user_id,
            actor_user_name: abandonedAuthorization.historical_reconstruction_pending_by_user_name,
            actor_user_role: abandonedAuthorization.historical_reconstruction_pending_by_user_role,
            reason: abandonedAuthorization.historical_reconstruction_pending_reason || 'AUTHORIZATION_SUPERSEDED',
            reference_id: abandonedAuthorization.last_historical_reconstruction_request_id,
            details: { pending_reconstruction_version:
                abandonedAuthorization.historical_reconstruction_pending_version,
            error_code: 'AUTHORIZATION_SUPERSEDED' }, occurred_at: now });
        if (staleDetails) auditDocuments.push({ ...scope,
            event_type: 'HISTORICAL_RECONSTRUCTION_STALE', actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
            reference_id: cleanRequestId, details: staleDetails, occurred_at: now });
        auditDocuments.push({ ...scope, event_type: eventType, actor_user_id: by.user_id,
            actor_user_name: by.user_name, actor_user_role: by.role, reason: cleanReason,
            reference_id: cleanRequestId, details: { reconstruction_version: nextVersion,
                command_identity: identity }, occurred_at: now });
        await auditModel.create(auditDocuments, { session: dbSession, ordered: true });
            return { record: updated, idempotent: false };
        });
    } catch (error) {
        if (error?.code && String(error.code).startsWith('HISTORICAL_')) throw error;
        if (error?.code === 11000 || error?.code === 112 || error?.codeName === 'WriteConflict' ||
            error?.errorLabels?.includes?.('TransientTransactionError')) {
            throw reconstructionError('HISTORICAL_RECONSTRUCTION_CONFLICT', 409,
                'Η κατάσταση της ιστορικής ανακατασκευής άλλαξε ταυτόχρονα.');
        }
        throw error;
    }
}
async function completeHistoricalReconstruction({ scope, calculationId, requestId, now = new Date(),
    periodControlModel = PeriodControlModel, auditModel = LifecycleAuditModel,
    prodhlomenaModel = ProdhlomenaOrariaModel, transactionRunner = transaction,
    fingerprintResolver = calculateHistoricalFingerprints }) {
    return transactionRunner(async (dbSession) => {
        const current = await periodControlModel.findOne({ ...scope, status: 'OPEN',
            historical_reconstruction_status: 'AUTHORIZED', active_calculation_id: calculationId,
            last_historical_reconstruction_request_id: requestId }).session(dbSession).lean();
        if (!current) throw reconstructionError('HISTORICAL_RECONSTRUCTION_OWNERSHIP_LOST', 409, 'Η εξουσιοδότηση ανακατασκευής δεν είναι πλέον ενεργή.');
        const fingerprints = await fingerprintResolver({ scope, prodhlomenaModel,
            session: dbSession });
        const completedVersion = Number(current.historical_reconstruction_pending_version || 0);
        if (completedVersion !== Number(current.historical_reconstruction_version || 0) + 1) {
            throw reconstructionError('HISTORICAL_RECONSTRUCTION_VERSION_CONFLICT', 409,
                'Η έκδοση της ανακατασκευής έχει αλλάξει.');
        }
        const updated = await periodControlModel.findOneAndUpdate({ ...scope, status: 'OPEN', version: current.version,
            historical_reconstruction_status: 'AUTHORIZED', active_calculation_id: calculationId,
            historical_reconstruction_pending_version: completedVersion }, { $set: {
            historical_reconstruction_status: 'COMPLETED', historical_reconstruction_completed_at: now,
            historical_reconstruction_version: completedVersion,
            historical_reconstruction_pending_version: 0,
            historical_reconstruction_started_at: current.historical_reconstruction_pending_started_at,
            historical_reconstruction_started_by_user_id: current.historical_reconstruction_pending_by_user_id,
            historical_reconstruction_started_by_user_name: current.historical_reconstruction_pending_by_user_name,
            historical_reconstruction_started_by_user_role: current.historical_reconstruction_pending_by_user_role,
            historical_reconstruction_reason: current.historical_reconstruction_pending_reason,
            historical_reconstruction_pending_started_at: null,
            historical_reconstruction_pending_by_user_id: null,
            historical_reconstruction_pending_by_user_name: '',
            historical_reconstruction_pending_by_user_role: '',
            historical_reconstruction_pending_reason: '',
            historical_source_fingerprint: fingerprints.source_fingerprint,
            historical_dependency_fingerprint: fingerprints.dependency_fingerprint,
            historical_holiday_dependency_fingerprint:
                fingerprints.holiday_dependency_fingerprint,
            historical_dependency_window_start: fingerprints.dependency_window_start,
            historical_dependency_window_end: fingerprints.dependency_window_end,
            historical_result_fingerprint: fingerprints.result_fingerprint, updated_at: now
        }, $inc: { version: 1 } }, { new: true, session: dbSession });
        if (!updated) throw reconstructionError('HISTORICAL_RECONSTRUCTION_CONFLICT', 409, 'Η ανακατασκευή άλλαξε ταυτόχρονα.');
        await auditModel.create([{ ...scope, event_type: 'HISTORICAL_RECONSTRUCTION_CALCULATION',
            actor_user_id: current.historical_reconstruction_pending_by_user_id,
            actor_user_name: current.historical_reconstruction_pending_by_user_name,
            actor_user_role: current.historical_reconstruction_pending_by_user_role,
            reason: current.historical_reconstruction_pending_reason, reference_id: requestId,
            details: { reconstruction_version: completedVersion,
                calculation_id: calculationId }, occurred_at: now }, { ...scope,
            event_type: 'HISTORICAL_RECONSTRUCTION_COMPLETE',
            actor_user_id: current.historical_reconstruction_pending_by_user_id,
            actor_user_name: current.historical_reconstruction_pending_by_user_name,
            actor_user_role: current.historical_reconstruction_pending_by_user_role,
            reason: current.historical_reconstruction_pending_reason, reference_id: requestId,
            details: { reconstruction_version: completedVersion,
                source_fingerprint: fingerprints.source_fingerprint,
                dependency_fingerprint: fingerprints.dependency_fingerprint,
                holiday_dependency_fingerprint: fingerprints.holiday_dependency_fingerprint,
                result_fingerprint: fingerprints.result_fingerprint,
                dependency_window_start: fingerprints.dependency_window_start,
                dependency_window_end: fingerprints.dependency_window_end }, occurred_at: now }],
        { session: dbSession, ordered: true });
        return { record: updated, fingerprints };
    });
}

async function failHistoricalReconstruction({ scope, requestId, calculationId = '', errorCode = '',
    now = new Date(), periodControlModel = PeriodControlModel, auditModel = LifecycleAuditModel,
    transactionRunner = transaction }) {
    const cleanRequestId = String(requestId || '').trim();
    return transactionRunner(async (dbSession) => {
        const current = await periodControlModel.findOne({ ...scope, status: 'OPEN',
            historical_reconstruction_status: 'AUTHORIZED',
            last_historical_reconstruction_request_id: cleanRequestId }).session(dbSession).lean();
        if (!current) return { recovered: false };
        const activeCalculationId = String(current.active_calculation_id || '');
        if ((calculationId && activeCalculationId !== calculationId) ||
            (!calculationId && activeCalculationId)) return { recovered: false };
        const completedVersion = Number(current.historical_reconstruction_version || 0);
        const restoredStatus = completedVersion > 0 ? 'COMPLETED' : '';
        const filter = { ...scope, status: 'OPEN', version: current.version,
            historical_reconstruction_status: 'AUTHORIZED',
            historical_reconstruction_pending_version: current.historical_reconstruction_pending_version,
            last_historical_reconstruction_request_id: cleanRequestId,
            active_calculation_id: activeCalculationId };
        const updated = await periodControlModel.findOneAndUpdate(filter, { $set: {
            historical_reconstruction_status: restoredStatus,
            historical_reconstruction_pending_version: 0,
            historical_reconstruction_pending_started_at: null,
            historical_reconstruction_pending_by_user_id: null,
            historical_reconstruction_pending_by_user_name: '',
            historical_reconstruction_pending_by_user_role: '',
            historical_reconstruction_pending_reason: '',
            last_historical_reconstruction_request_id: '',
            last_historical_reconstruction_command_identity: '',
            active_calculation_id: '', active_calculation_started_at: null, updated_at: now
        }, $inc: { version: 1, write_fence_version: activeCalculationId ? 1 : 0 } },
        { new: true, session: dbSession });
        if (!updated) throw reconstructionError('HISTORICAL_RECONSTRUCTION_RECOVERY_CONFLICT', 409,
            'Η κατάσταση της ανακατασκευής άλλαξε κατά την επαναφορά.');
        await auditModel.create([{ ...scope, event_type: 'HISTORICAL_RECONSTRUCTION_FAILED',
            actor_user_id: current.historical_reconstruction_pending_by_user_id,
            actor_user_name: current.historical_reconstruction_pending_by_user_name,
            actor_user_role: current.historical_reconstruction_pending_by_user_role,
            reason: current.historical_reconstruction_pending_reason || 'CALCULATION_FAILED',
            reference_id: cleanRequestId,
            details: { pending_reconstruction_version: current.historical_reconstruction_pending_version,
                calculation_id: activeCalculationId, error_code: String(errorCode || '') },
            occurred_at: now }], { session: dbSession });
        return { recovered: true, record: updated };
    });
}

module.exports = { FINGERPRINT_VERSION, EMPLOYMENT_CALCULATION_SEMANTICS_VERSION,
    SOURCE_FIELDS, DEPENDENCY_FIELDS, RESULT_FIELDS,
    dependencyWindow, fingerprintRows, projectionForHistoricalState, isPastDeadline,
    calculateHistoricalFingerprints, calculateHolidayDependencies,
    isHistoricalDependencyCurrent,
    authorizeHistoricalReconstruction,
    completeHistoricalReconstruction, failHistoricalReconstruction, reconstructionError };
