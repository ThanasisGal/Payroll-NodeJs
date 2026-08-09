'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const PeriodControlAuditModel = require('../../models/apasxoliseisPeriodControlAudit');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { startOfWeekMondayUtc, endOfWeekSundayUtc } = require('../../utils/date/mondaySundayWeek');
const { assertPeriodControlIndexesReady } = require('./apasxoliseisPeriodControlIndexGuardService');

const MODES = Object.freeze({ NORMAL: 'NORMAL', LOCKED: 'LOCKED', FINALIZED: 'FINALIZED',
    HISTORICAL_RECONSTRUCTION_REQUIRED: 'HISTORICAL_RECONSTRUCTION_REQUIRED',
    HISTORICAL_RECONSTRUCTED: 'HISTORICAL_RECONSTRUCTED',
    HISTORICAL_RECONSTRUCTION_STALE: 'HISTORICAL_RECONSTRUCTION_STALE',
    CORRECTIVE_ONLY: 'CORRECTIVE_ONLY' });

function periodError(code, statusCode, message) {
    const error = new Error(message || code); error.code = code; error.statusCode = statusCode; return error;
}
function dateOnly(value, label) {
    const key = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw periodError('INVALID_PERIOD_SCOPE', 400, `Μη έγκυρη ${label}.`);
    const date = new Date(`${key}T00:00:00.000Z`);
    if (date.toISOString().slice(0, 10) !== key) throw periodError('INVALID_PERIOD_SCOPE', 400, `Μη έγκυρη ${label}.`);
    return date;
}
function calculatePeriodDeadline(periodEnd) {
    const end = dateOnly(periodEnd, 'λήξη περιόδου');
    return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 2, 0));
}
function normalizeScope(input = {}) {
    const scope = {
        team: String(input.team || '').trim(),
        company_kod: String(input.company_kod || '').trim(),
        ypokatasthma: String(input.ypokatasthma || '').trim().padStart(4, '0'),
        period_start: dateOnly(input.period_start, 'έναρξη περιόδου'),
        period_end: dateOnly(input.period_end, 'λήξη περιόδου')
    };
    if (!scope.team || !scope.company_kod || !scope.ypokatasthma || scope.period_start > scope.period_end) {
        throw periodError('INVALID_PERIOD_SCOPE', 400, 'Μη έγκυρο πλαίσιο περιόδου.');
    }
    return scope;
}
function isDateInsideEmploymentPeriod({ period_start, period_end, date } = {}) {
    const scope = normalizeScope({ team: '_', company_kod: '_', ypokatasthma: '_', period_start, period_end });
    const candidate = dateOnly(date, 'ημερομηνία μεταβολής');
    return candidate >= scope.period_start && candidate <= scope.period_end;
}
function isWeekAllowedForEmploymentPeriod({ period_start, period_end, week_start, week_end } = {}) {
    const scope = normalizeScope({ team: '_', company_kod: '_', ypokatasthma: '_', period_start, period_end });
    const start = dateOnly(week_start, 'έναρξη εβδομάδας');
    const end = dateOnly(week_end, 'λήξη εβδομάδας');
    const naturalStart = startOfWeekMondayUtc(start);
    const naturalEnd = endOfWeekSundayUtc(start);
    if (start.toISOString().slice(0, 10) !== naturalStart.toISOString().slice(0, 10) ||
        end.toISOString().slice(0, 10) !== naturalEnd.toISOString().slice(0, 10)) return false;
    if (end > scope.period_end) return false;
    return start >= scope.period_start || (start <= scope.period_start && scope.period_start <= end);
}
function isPastDeadline(deadline, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value;
        return result;
    }, {});
    const today = dateOnly(`${parts.year}-${parts.month}-${parts.day}`, 'τρέχουσα ημερομηνία');
    return today > dateOnly(deadline, 'προθεσμία');
}
function resolveEffectiveMode({ storedStatus = 'OPEN', deadline, now = new Date(), record = null,
    dependencyFingerprint = '' }) {
    if (storedStatus === 'FINALIZED') return MODES.FINALIZED;
    if (storedStatus === 'LOCKED') return MODES.LOCKED;
    if (!isPastDeadline(deadline, now)) return MODES.NORMAL;
    const historical = require('./apasxoliseisHistoricalPeriodReconstructionService')
        .projectionForHistoricalState({ record, pastDeadline: true, dependencyFingerprint });
    return historical || MODES.HISTORICAL_RECONSTRUCTION_REQUIRED;
}
function projectPeriodControl({ scope, record = null, now = new Date(), dependencyFingerprint = '' }) {
    const deadline = record?.deadline ? dateOnly(record.deadline, 'προθεσμία') : calculatePeriodDeadline(scope.period_end);
    const storedStatus = ['LOCKED', 'FINALIZED'].includes(record?.status) ? record.status : 'OPEN';
    const effectiveMode = resolveEffectiveMode({ storedStatus, deadline, now, record, dependencyFingerprint });
    const normal = effectiveMode === MODES.NORMAL;
    const reconstructed = effectiveMode === MODES.HISTORICAL_RECONSTRUCTED;
    const pastDeadline = isPastDeadline(deadline, now);
    return Object.freeze({
        scope, exists: Boolean(record), stored_status: storedStatus, effective_mode: effectiveMode,
        deadline: deadline.toISOString().slice(0, 10), past_deadline: pastDeadline,
        locked_at: record?.locked_at || null, locked_by_user_name: record?.locked_by_user_name || '',
        locked_by_user_role: record?.locked_by_user_role || '', version: record?.version || 0,
        finalized_at: record?.finalized_at || null, finalized_by_user_name: record?.finalized_by_user_name || '',
        frozen_snapshot_id: record?.frozen_snapshot_id || null,
        frozen_snapshot_fingerprint: record?.frozen_snapshot_fingerprint || '',
        submitted_at: record?.submitted_at || null, submission_reference: record?.submission_reference || null,
        submission_protocol: record?.submission_protocol || '', submission_status: record?.submission_status || '',
        submission_timeliness: record?.submission_timeliness || 'NOT_SUBMITTED',
        historical_reconstruction_status: record?.historical_reconstruction_status || '',
        historical_reconstruction_version: Number(record?.historical_reconstruction_version || 0),
        historical_reconstruction_pending_version:
            Number(record?.historical_reconstruction_pending_version || 0),
        historical_reconstruction_started_at: record?.historical_reconstruction_started_at || null,
        historical_reconstruction_started_by_user_name: record?.historical_reconstruction_started_by_user_name || '',
        historical_reconstruction_started_by_user_role: record?.historical_reconstruction_started_by_user_role || '',
        historical_reconstruction_completed_at: record?.historical_reconstruction_completed_at || null,
        historical_reconstruction_reason: record?.historical_reconstruction_reason || '',
        historical_dependency_window_start: record?.historical_dependency_window_start || null,
        historical_dependency_window_end: record?.historical_dependency_window_end || null,
        historical_dependency_fingerprint: record?.historical_dependency_fingerprint || '',
        current_dependency_fingerprint: dependencyFingerprint,
        dependency_status: reconstructed ? 'CURRENT' : effectiveMode === MODES.HISTORICAL_RECONSTRUCTION_STALE ? 'STALE' : '',
        can_calculate: normal, can_historical_calculate: pastDeadline &&
            record?.historical_reconstruction_status === 'AUTHORIZED',
        can_record_decision: normal || reconstructed, can_repo_transfer: normal || reconstructed,
        can_manual_edit: normal || reconstructed, can_unlock_period: effectiveMode === MODES.LOCKED,
        can_finalize: storedStatus === 'LOCKED',
        can_historical_reconstruct: effectiveMode === MODES.HISTORICAL_RECONSTRUCTION_REQUIRED,
        can_historical_reassess: effectiveMode === MODES.HISTORICAL_RECONSTRUCTION_STALE,
        can_corrective: storedStatus === 'FINALIZED'
    });
}
function filterForScope(scope) { return { ...scope }; }
async function queryLean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
function withSession(query, session) { return session && query && typeof query.session === 'function' ? query.session(session) : query; }
async function runTransaction(work) {
    const session = await mongoose.startSession();
    try {
        let output;
        await session.withTransaction(async () => { output = await work(session); });
        return output;
    } finally { await session.endSession(); }
}
async function getPeriodControl({ scope: input, now = new Date(), periodControlModel = PeriodControlModel }) {
    const scope = normalizeScope(input);
    const record = await queryLean(periodControlModel.findOne(filterForScope(scope)));
    let dependencyFingerprint = '';
    if (record?.historical_reconstruction_status === 'COMPLETED' && record.status !== 'FINALIZED') {
        dependencyFingerprint = (await require('./apasxoliseisHistoricalPeriodReconstructionService')
            .calculateHistoricalFingerprints({ scope })).dependency_fingerprint;
    }
    return projectPeriodControl({ scope, record, now, dependencyFingerprint });
}
function stateToken(state) {
    return Object.freeze({ exists: state.exists, stored_status: state.stored_status, version: state.version });
}
async function assertNormalPeriod({ scope, now = new Date(), expectedToken = null, periodControlModel = PeriodControlModel }) {
    const state = await getPeriodControl({ scope, now, periodControlModel });
    if (expectedToken && (state.exists !== expectedToken.exists || state.stored_status !== expectedToken.stored_status || state.version !== expectedToken.version)) {
        throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
    }
    if (state.effective_mode === MODES.LOCKED) throw periodError('PERIOD_CONTROL_LOCKED', 409, 'Η περίοδος είναι κλειδωμένη.');
    if (state.effective_mode === MODES.FINALIZED) throw periodError('PERIOD_CONTROL_FINALIZED', 409, 'Η περίοδος είναι οριστικοποιημένη.');
    if (state.effective_mode === MODES.HISTORICAL_RECONSTRUCTION_REQUIRED ||
        state.effective_mode === MODES.HISTORICAL_RECONSTRUCTION_STALE) throw periodError(
        'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED', 409,
        'Απαιτείται ρητή ανακατασκευή ή επανεκτίμηση της εκπρόθεσμης περιόδου.');
    if (state.effective_mode === MODES.CORRECTIVE_ONLY) throw periodError('PERIOD_CONTROL_CORRECTIVE_ONLY', 409, 'Η περίοδος επιτρέπει μόνο διορθωτική μισθοδοσία.');
    return { state, token: stateToken(state) };
}
async function fencePeriodForWrite({ scope: input, expectedToken = null, now = new Date(), session,
    periodControlModel = PeriodControlModel }) {
    if (!session) throw periodError('PERIOD_CONTROL_TRANSACTION_REQUIRED', 503, 'Δεν είναι διαθέσιμη η ασφαλής μεταβολή περιόδου.');
    const scope = normalizeScope(input);
    const deadline = calculatePeriodDeadline(scope.period_end);
    const overdue = isPastDeadline(deadline, now);
    if (overdue && expectedToken?.exists === false) throw periodError(
        'HISTORICAL_RECONSTRUCTION_REQUIRED', 409, 'Απαιτείται ιστορική ανακατασκευή.');
    let record;
    if (expectedToken?.exists === false) {
        try {
            const created = await periodControlModel.create([{
                ...scope, status: 'OPEN', deadline, version: 1, write_fence_version: 1,
                created_at: now, updated_at: now
            }], { session });
            record = Array.isArray(created) ? created[0] : created;
        } catch (error) {
            if (error?.code === 11000) {
                throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
            }
            throw error;
        }
    } else {
        const filter = { ...filterForScope(scope), status: 'OPEN' };
        if (expectedToken?.exists === true) filter.version = Number(expectedToken.version);
        record = await periodControlModel.findOneAndUpdate(filter, {
            $inc: { write_fence_version: 1 }, $set: { updated_at: now }
        }, { new: true, session });
        if (!record) {
            throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
        }
    }
    const plain = record?.toObject ? record.toObject() : record;
    let dependencyFingerprint = '';
    if (overdue && plain?.historical_reconstruction_status === 'COMPLETED') {
        dependencyFingerprint = (await require('./apasxoliseisHistoricalPeriodReconstructionService')
            .calculateHistoricalFingerprints({ scope, session })).dependency_fingerprint;
    }
    const state = projectPeriodControl({ scope, record: plain, now, dependencyFingerprint });
    if (![MODES.NORMAL, MODES.HISTORICAL_RECONSTRUCTED].includes(state.effective_mode)) {
        throw periodError(state.effective_mode === MODES.LOCKED ? 'PERIOD_CONTROL_LOCKED' : 'PERIOD_CONTROL_CORRECTIVE_ONLY', 409,
            state.effective_mode === MODES.LOCKED ? 'Η περίοδος είναι κλειδωμένη.' : 'Η περίοδος επιτρέπει μόνο διορθωτική μισθοδοσία.');
    }
    return { state, token: stateToken(state) };
}
async function runWithPeriodWriteFence({ scope, expectedToken = null, now = new Date(), work,
    periodControlModel = PeriodControlModel, indexGuard = assertPeriodControlIndexesReady,
    transactionRunner = runTransaction }) {
    if (typeof work !== 'function') throw new TypeError('Period-fenced work callback is required.');
    if (typeof indexGuard === 'function') await indexGuard();
    try {
        return await transactionRunner(async (session) => {
            const fenced = await fencePeriodForWrite({ scope, expectedToken, now, session, periodControlModel });
            return { result: await work({ session, state: fenced.state, token: fenced.token }), ...fenced };
        });
    } catch (error) {
        if (error?.code && String(error.code).startsWith('PERIOD_CONTROL_')) throw error;
        if (error?.errorLabels?.includes?.('TransientTransactionError') || error?.code === 112 || error?.codeName === 'WriteConflict') {
            throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
        }
        throw error;
    }
}
function normalizeCalculationId(value) {
    const calculationId = String(value || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(calculationId)) {
        throw periodError('INVALID_PERIOD_CALCULATION_ID', 400, 'Μη έγκυρο αναγνωριστικό υπολογισμού.');
    }
    return calculationId;
}
async function acquirePeriodCalculationOwnership({ scope: input, now = new Date(), calculationId = crypto.randomUUID(),
    historicalRequestId = '',
    periodControlModel = PeriodControlModel, indexGuard = assertPeriodControlIndexesReady,
    transactionRunner = runTransaction }) {
    const scope = normalizeScope(input);
    const ownerId = normalizeCalculationId(calculationId);
    if (typeof indexGuard === 'function') await indexGuard();
    const overdue = isPastDeadline(calculatePeriodDeadline(scope.period_end), now);
    if (overdue && !String(historicalRequestId || '').trim()) {
        throw periodError('PERIOD_CONTROL_CORRECTIVE_ONLY', 409, 'Η περίοδος επιτρέπει μόνο διορθωτική μισθοδοσία.');
    }
    try {
        return await transactionRunner(async (session) => {
            const ownershipFilter = {
                ...filterForScope(scope), status: 'OPEN',
                $or: [{ active_calculation_id: '' }, { active_calculation_id: null },
                    { active_calculation_id: mongoose.trusted({ $exists: false }) }]
            };
            if (overdue) Object.assign(ownershipFilter, { historical_reconstruction_status: 'AUTHORIZED',
                last_historical_reconstruction_request_id: String(historicalRequestId).trim() });
            let record = await periodControlModel.findOneAndUpdate(ownershipFilter,
            { $set: { active_calculation_id: ownerId, active_calculation_started_at: now, updated_at: now } },
            { new: true, session });
            if (!record) {
                const current = await queryLean(withSession(periodControlModel.findOne(filterForScope(scope)), session));
                if (current) {
                    if (current.status === 'LOCKED') throw periodError('PERIOD_CONTROL_LOCKED', 409, 'Η περίοδος είναι κλειδωμένη.');
                    if (current.active_calculation_id) throw periodError('PERIOD_CONTROL_CALCULATION_IN_PROGRESS', 409,
                        'Βρίσκεται ήδη σε εξέλιξη Υπολογισμός Απασχολήσεων για την περίοδο.');
                    throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
                }
                if (overdue) throw periodError('HISTORICAL_RECONSTRUCTION_AUTHORIZATION_REQUIRED', 409,
                    'Δεν υπάρχει ενεργή εξουσιοδότηση ιστορικής ανακατασκευής.');
                try {
                    const created = await periodControlModel.create([{ ...scope, status: 'OPEN',
                        deadline: calculatePeriodDeadline(scope.period_end), version: 1, write_fence_version: 0,
                        active_calculation_id: ownerId, active_calculation_started_at: now,
                        created_at: now, updated_at: now }], { session });
                    record = Array.isArray(created) ? created[0] : created;
                } catch (error) {
                    if (error?.code === 11000) throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409,
                        'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
                    throw error;
                }
            }
            const plain = record?.toObject ? record.toObject() : record;
            return Object.freeze({ calculationId: ownerId, historical: overdue,
                historicalRequestId: overdue ? String(historicalRequestId).trim() : '',
                state: projectPeriodControl({ scope, record: plain, now }) });
        });
    } catch (error) {
        if (error?.code && String(error.code).startsWith('PERIOD_CONTROL_')) throw error;
        if (error?.errorLabels?.includes?.('TransientTransactionError') || error?.code === 112 || error?.codeName === 'WriteConflict') {
            throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
        }
        throw error;
    }
}
async function runWithPeriodCalculationWriteFence({ scope: input, calculationId, work,
    periodControlModel = PeriodControlModel, indexGuard = assertPeriodControlIndexesReady,
    transactionRunner = runTransaction }) {
    if (typeof work !== 'function') throw new TypeError('Calculation-owned work callback is required.');
    const scope = normalizeScope(input);
    const ownerId = normalizeCalculationId(calculationId);
    if (typeof indexGuard === 'function') await indexGuard();
    try {
        return await transactionRunner(async (session) => {
            const record = await periodControlModel.findOneAndUpdate({
                ...filterForScope(scope), status: 'OPEN', active_calculation_id: ownerId
            }, { $inc: { write_fence_version: 1 }, $set: { updated_at: new Date() } }, { new: true, session });
            if (!record) throw periodError('PERIOD_CONTROL_CALCULATION_OWNERSHIP_LOST', 409,
                'Ο Υπολογισμός Απασχολήσεων δεν κατέχει πλέον την περίοδο.');
            return work({ session });
        });
    } catch (error) {
        if (error?.code && String(error.code).startsWith('PERIOD_CONTROL_')) throw error;
        if (error?.errorLabels?.includes?.('TransientTransactionError') || error?.code === 112 || error?.codeName === 'WriteConflict') {
            throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε. Η ενέργεια ακυρώθηκε.');
        }
        throw error;
    }
}
async function fencePeriodCalculationForWrite({ scope: input, calculationId, session,
    periodControlModel = PeriodControlModel, indexGuard = assertPeriodControlIndexesReady }) {
    const scope = normalizeScope(input);
    const ownerId = normalizeCalculationId(calculationId);
    if (!session) throw new TypeError('Transaction session is required.');
    if (typeof indexGuard === 'function') await indexGuard();
    const record = await periodControlModel.findOneAndUpdate({
        ...filterForScope(scope), status: 'OPEN', active_calculation_id: ownerId
    }, { $inc: { write_fence_version: 1 }, $set: { updated_at: new Date() } }, { new: true, session });
    if (!record) throw periodError('PERIOD_CONTROL_CALCULATION_OWNERSHIP_LOST', 409,
        'Ο Υπολογισμός Απασχολήσεων δεν κατέχει πλέον την περίοδο.');
    return record;
}
async function releasePeriodCalculationOwnership({ scope: input, calculationId,
    periodControlModel = PeriodControlModel, indexGuard = assertPeriodControlIndexesReady,
    transactionRunner = runTransaction }) {
    const scope = normalizeScope(input);
    const ownerId = normalizeCalculationId(calculationId);
    if (typeof indexGuard === 'function') await indexGuard();
    return transactionRunner(async (session) => {
        const record = await periodControlModel.findOneAndUpdate({ ...filterForScope(scope), active_calculation_id: ownerId },
            { $set: { active_calculation_id: '', active_calculation_started_at: null, updated_at: new Date() } },
            { new: true, session });
        if (!record) throw periodError('PERIOD_CONTROL_CALCULATION_OWNERSHIP_LOST', 409,
            'Δεν ήταν δυνατή η ασφαλής απελευθέρωση του Υπολογισμού Απασχολήσεων.');
        return true;
    });
}
function actorFromSession(session = {}) {
    const role = assertCriticalEmploymentDecisionRole(session);
    const userId = String(session.userId || '').trim();
    if (!mongoose.isValidObjectId(userId)) throw periodError('NOT_AUTHORIZED', 403, 'Μη έγκυρη ενεργή συνεδρία.');
    return { user_id: userId, user_name: String(session.userName || session.username || userId).trim(), role };
}

async function transitionPeriodControl({ session, scope: input, action, reason, requestId, now = new Date(), expectedVersion,
    periodControlModel = PeriodControlModel, auditModel = PeriodControlAuditModel, indexGuard,
    dbSession = null, transactionRunner = runTransaction,
    historicalFingerprintResolver = (options) => require('./apasxoliseisHistoricalPeriodReconstructionService')
        .calculateHistoricalFingerprints(options) }) {
    const actor = actorFromSession(session); const scope = normalizeScope(input);
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) throw periodError('PERIOD_CONTROL_REASON_REQUIRED', 400, 'Απαιτείται αιτιολογία.');
    const cleanRequestId = String(requestId || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(cleanRequestId)) {
        throw periodError('INVALID_PERIOD_CONTROL_REQUEST_ID', 400, 'Μη έγκυρο αναγνωριστικό αιτήματος.');
    }
    if (typeof indexGuard === 'function') await indexGuard();
    if (!dbSession && transactionRunner && periodControlModel === PeriodControlModel && auditModel === PeriodControlAuditModel) {
        try {
            return await transactionRunner((transactionSession) => transitionPeriodControl({
                session, scope, action, reason: cleanReason, requestId: cleanRequestId, now, expectedVersion,
                periodControlModel, auditModel, indexGuard: null, dbSession: transactionSession,
                transactionRunner: null, historicalFingerprintResolver
            }));
        } catch (error) {
            if (error?.code !== 11000) throw error;
            const raced = await queryLean(periodControlModel.findOne(filterForScope(scope)));
            const commandIdentity = crypto.createHash('sha256').update(JSON.stringify({
                scope: { ...scope, period_start: scope.period_start.toISOString(), period_end: scope.period_end.toISOString() },
                action, reason: cleanReason
            })).digest('hex');
            if (raced?.last_transition_request_id === cleanRequestId &&
                raced?.last_transition_command_identity === commandIdentity) {
                return { state: projectPeriodControl({ scope, record: raced, now }), idempotent: true };
            }
            throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
        }
    }
    const current = await queryLean(withSession(periodControlModel.findOne(filterForScope(scope)), dbSession));
    const previousStatus = ['LOCKED', 'FINALIZED'].includes(current?.status) ? current.status : 'OPEN';
    const target = action === 'LOCK' ? 'LOCKED' : action === 'UNLOCK' ? 'OPEN' : null;
    if (!target) throw periodError('INVALID_PERIOD_TRANSITION', 400, 'Μη έγκυρη μετάβαση περιόδου.');
    if (previousStatus === 'FINALIZED') throw periodError('PERIOD_CONTROL_FINALIZED', 409, 'Η οριστικοποιημένη περίοδος δεν ξεκλειδώνεται.');
    if (isPastDeadline(calculatePeriodDeadline(scope.period_end), now)) {
        if (!current || current.historical_reconstruction_status !== 'COMPLETED') {
            throw periodError('HISTORICAL_RECONSTRUCTION_REQUIRED', 409,
                'Η εκπρόθεσμη περίοδος πρέπει πρώτα να ανακατασκευαστεί.');
        }
        if (action === 'LOCK') {
            const fingerprints = await historicalFingerprintResolver({ scope });
            if (fingerprints.dependency_fingerprint !== current.historical_dependency_fingerprint) {
                throw periodError('HISTORICAL_RECONSTRUCTION_STALE_CANNOT_FINALIZE', 409,
                    'Η ανακατασκευασμένη περίοδος είναι παρωχημένη και απαιτεί επανεκτίμηση.');
            }
        }
    }
    if (action === 'LOCK' && current?.active_calculation_id) {
        throw periodError('PERIOD_CONTROL_CALCULATION_IN_PROGRESS', 409,
            'Δεν είναι δυνατή η ολοκλήρωση του κλειδώματος επειδή βρίσκεται σε εξέλιξη Υπολογισμός Απασχολήσεων.');
    }
    const commandIdentity = crypto.createHash('sha256').update(JSON.stringify({
        scope: { ...scope, period_start: scope.period_start.toISOString(), period_end: scope.period_end.toISOString() },
        action, reason: cleanReason
    })).digest('hex');
    if (previousStatus === target) {
        if (current?.last_transition_request_id === cleanRequestId &&
            current?.last_transition_command_identity === commandIdentity) {
            return { state: projectPeriodControl({ scope, record: current, now }), idempotent: true };
        }
        throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η περίοδος βρίσκεται ήδη σε διαφορετικά καταγεγραμμένη κατάσταση.');
    }
    if (action === 'UNLOCK' && !current) throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η περίοδος δεν είναι κλειδωμένη.');
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(current?.version || 0)) {
        throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
    }
    const at = new Date(now); const beforeVersion = Number(current?.version || 0); const afterVersion = beforeVersion + 1;
    let updated;
    if (!current) {
        try {
            const createDocument = { ...scope, status: target,
                deadline: calculatePeriodDeadline(scope.period_end), locked_at: at,
                locked_by_user_id: actor.user_id, locked_by_user_name: actor.user_name,
                locked_by_user_role: actor.role, lock_reason: cleanReason,
                last_transition_at: at, last_transition_request_id: cleanRequestId,
                last_transition_command_identity: commandIdentity,
                version: afterVersion, created_at: at, updated_at: at };
            const created = dbSession
                ? await periodControlModel.create([createDocument], { session: dbSession })
                : await periodControlModel.create(createDocument);
            updated = Array.isArray(created) ? created[0] : created;
        } catch (error) {
            if (error?.code === 11000 && !dbSession) {
                const raced = await queryLean(periodControlModel.findOne(filterForScope(scope)));
                if (raced?.last_transition_request_id === cleanRequestId &&
                    raced?.last_transition_command_identity === commandIdentity) {
                    return { state: projectPeriodControl({ scope, record: raced, now }), idempotent: true };
                }
                throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
            }
            if (error?.code === 11000) throw error;
            throw error;
        }
    } else {
        const set = target === 'LOCKED' ? { status: target, locked_at: at,
            locked_by_user_id: actor.user_id, locked_by_user_name: actor.user_name,
            locked_by_user_role: actor.role, lock_reason: cleanReason,
            last_transition_at: at, last_transition_request_id: cleanRequestId,
            last_transition_command_identity: commandIdentity, updated_at: at, version: afterVersion }
            : { status: target, locked_at: null, locked_by_user_id: null,
                locked_by_user_name: '', locked_by_user_role: '', lock_reason: '',
                last_transition_at: at, last_transition_request_id: cleanRequestId,
                last_transition_command_identity: commandIdentity, updated_at: at, version: afterVersion };
        const transitionFilter = { ...filterForScope(scope), status: previousStatus, version: beforeVersion };
        if (action === 'LOCK') transitionFilter.$or = [
            { active_calculation_id: '' }, { active_calculation_id: null }, { active_calculation_id: { $exists: false } }
        ];
        updated = await periodControlModel.findOneAndUpdate(transitionFilter, { $set: set }, { new: true, ...(dbSession ? { session: dbSession } : {}) });
        if (!updated) throw periodError('PERIOD_CONTROL_STATE_CONFLICT', 409, 'Η κατάσταση της περιόδου άλλαξε.');
    }
    const updatedPlain = updated?.toObject ? updated.toObject() : updated;
    const auditDocument = { ...scope, previous_status: previousStatus, new_status: target,
        effective_mode_before: resolveEffectiveMode({ storedStatus: previousStatus, deadline: calculatePeriodDeadline(scope.period_end), now }),
        effective_mode_after: resolveEffectiveMode({ storedStatus: target, deadline: calculatePeriodDeadline(scope.period_end), now }),
        actor_user_id: actor.user_id, actor_user_name: actor.user_name, actor_user_role: actor.role,
        reason: cleanReason, request_id: cleanRequestId, command_identity: commandIdentity,
        transitioned_at: at, version_before: beforeVersion, version_after: afterVersion };
    if (dbSession) await auditModel.create([auditDocument], { session: dbSession });
    else await auditModel.create(auditDocument);
    return { state: projectPeriodControl({ scope, record: updatedPlain, now }), idempotent: false };
}

module.exports = { MODES, periodError, dateOnly, calculatePeriodDeadline, normalizeScope,
    isDateInsideEmploymentPeriod, isWeekAllowedForEmploymentPeriod,
    isPastDeadline, resolveEffectiveMode, projectPeriodControl, getPeriodControl, stateToken,
    assertNormalPeriod, fencePeriodForWrite, runWithPeriodWriteFence,
    fencePeriodCalculationForWrite,
    acquirePeriodCalculationOwnership, runWithPeriodCalculationWriteFence,
    releasePeriodCalculationOwnership, transitionPeriodControl };
