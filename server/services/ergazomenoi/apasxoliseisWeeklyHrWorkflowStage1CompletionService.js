'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const StateModel = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { NEXT_STAGE, resolveWeeklyHrWorkflow } = require(
    './apasxoliseisWeeklyHrWorkflowResolverService'
);

const WORKFLOW_VERSION = 'weekly-hr-workflow:v1';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;

function commandError(code, statusCode = 400, message = code) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function text(value, maxLength = Infinity) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function dateOnly(value, label) {
    const key = dateKeyUtc(value);
    if (!key) throw commandError('INVALID_WEEK_SCOPE', 400, `Μη έγκυρη ${label}.`);
    return new Date(`${key}T00:00:00.000Z`);
}

function normalizeScope(input = {}) {
    const scope = {
        team: text(input.team, 100),
        company_kod: text(input.company_kod, 100),
        ypokatasthma: text(input.ypokatasthma, 20),
        employee_id: text(input.employee_id, 50),
        employee_kodikos: text(input.employee_kodikos, 50),
        week_start: dateOnly(input.week_start, 'έναρξη εβδομάδας'),
        week_end: dateOnly(input.week_end, 'λήξη εβδομάδας')
    };
    if (!scope.team || !scope.company_kod || !scope.ypokatasthma ||
        !scope.employee_kodikos || !mongoose.isValidObjectId(scope.employee_id) ||
        scope.week_start.getUTCDay() !== 1 || scope.week_end.getUTCDay() !== 0 ||
        scope.week_end.getTime() - scope.week_start.getTime() !== 6 * 86400000) {
        throw commandError('INVALID_WEEK_SCOPE', 400,
            'Απαιτείται έγκυρο employee scope φυσικής εβδομάδας Δευτέρα-Κυριακή.');
    }
    scope.employee_id = new mongoose.Types.ObjectId(scope.employee_id);
    return scope;
}

function normalizeActor(actor = {}) {
    const role = assertCriticalEmploymentDecisionRole({ userRole: actor.role });
    const userId = text(actor.user_id || actor.userId || actor._id, 50);
    const userName = text(actor.user_name || actor.userName || actor.name, 150);
    if (!mongoose.isValidObjectId(userId) || !userName) {
        throw commandError('INVALID_STAGE1_ACTOR', 400, 'Μη έγκυρα στοιχεία χρήστη.');
    }
    return { user_id: new mongoose.Types.ObjectId(userId), user_name: userName, role };
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function commandIdentity({ scope, fingerprint, actor, reason }) {
    const material = {
        action: 'STAGE1_COMPLETED', workflow_version: WORKFLOW_VERSION,
        scope: { team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, employee_id: String(scope.employee_id),
            week_start: dateKeyUtc(scope.week_start), week_end: dateKeyUtc(scope.week_end) },
        input_fingerprint: fingerprint,
        actor: { user_id: String(actor.user_id), user_name: actor.user_name, role: actor.role },
        reason_or_notes: reason
    };
    return crypto.createHash('sha256').update(stableStringify(material)).digest('hex');
}

function stateScope(scope) {
    return { team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, employee_id: scope.employee_id,
        week_start: scope.week_start, week_end: scope.week_end };
}

async function lean(query) {
    return query && typeof query.lean === 'function' ? query.lean() : query;
}

function inSession(query, session) {
    return session && query && typeof query.session === 'function' ? query.session(session) : query;
}

async function defaultTransactionRunner(work) {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await work(session); });
        return result;
    } finally {
        await session.endSession();
    }
}

function validateWorkflowPrerequisite(weekRows, workflowContext = {}) {
    const result = resolveWeeklyHrWorkflow({
        ...workflowContext,
        weekRows,
        leave_classification_completed: false
    });
    if (result.next_required_hr_stage === NEXT_STAGE.BLOCKED) {
        throw commandError('STAGE1_COMPLETION_BLOCKED', 409,
            `Το Stage 1 δεν μπορεί να ολοκληρωθεί: ${result.blocking_reasons.join(', ')}`);
    }
    return result;
}

async function completeWeeklyHrWorkflowStage1({
    scope: rawScope,
    weekRows,
    actor: rawActor,
    reason_or_notes,
    request_id,
    workflow_context = {},
    stateModel = StateModel,
    auditModel = AuditModel,
    transactionRunner = defaultTransactionRunner,
    fenceWeeklyInput,
    loadFreshWeekRows,
    now = () => new Date()
} = {}) {
    const scope = normalizeScope(rawScope);
    const actor = normalizeActor(rawActor);
    const reason = text(reason_or_notes, 2001);
    const requestId = text(request_id, 101);
    if (!reason || reason.length > 2000) {
        throw commandError('STAGE1_REASON_REQUIRED', 400,
            'Απαιτείται αιτιολογία έως 2000 χαρακτήρες.');
    }
    if (!REQUEST_ID_PATTERN.test(requestId)) {
        throw commandError('INVALID_REQUEST_ID', 400, 'Μη έγκυρο request_id.');
    }
    if (typeof loadFreshWeekRows !== 'function') {
        throw commandError('STAGE1_FRESHNESS_LOADER_REQUIRED', 503,
            'Απαιτείται authoritative φόρτωση εβδομάδας μέσα στη συναλλαγή.');
    }
    if (typeof fenceWeeklyInput !== 'function') {
        throw commandError('STAGE1_INPUT_FENCE_REQUIRED', 503,
            'Απαιτείται write fence για τα ημερήσια δεδομένα της εβδομάδας.');
    }
    validateWorkflowPrerequisite(weekRows, workflow_context);
    const initialFingerprint = buildStage1Fingerprint(weekRows).fingerprint;
    const identity = commandIdentity({ scope, fingerprint: initialFingerprint, actor, reason });

    return transactionRunner(async (session) => {
        const requestFilter = { team: scope.team, company_kod: scope.company_kod,
            request_id: requestId };
        const priorRequest = await lean(inSession(auditModel.findOne(requestFilter), session));
        if (priorRequest) {
            if (priorRequest.command_identity !== identity) {
                throw commandError('STAGE1_REQUEST_ID_CONFLICT', 409,
                    'Το request_id έχει ήδη χρησιμοποιηθεί για διαφορετική εντολή.');
            }
            return { completed: true, idempotent: true, replayed_request: true,
                fingerprint: priorRequest.new_completion_fingerprint,
                stage1_version: priorRequest.after_stage.version };
        }

        await fenceWeeklyInput({ scope, session, initial_fingerprint: initialFingerprint });
        const freshRows = await loadFreshWeekRows({ scope, session });
        validateWorkflowPrerequisite(freshRows, workflow_context);
        const finalFingerprint = buildStage1Fingerprint(freshRows).fingerprint;
        if (finalFingerprint !== initialFingerprint) {
            throw commandError('STAGE1_INPUT_CHANGED', 409,
                'Τα ημερήσια δεδομένα άλλαξαν πριν από την ολοκλήρωση του Stage 1.');
        }

        const filter = stateScope(scope);
        const current = await lean(inSession(stateModel.findOne(filter), session));
        const previous = current?.stage1 || { status: 'OPEN', completion_fingerprint: '', version: 0 };
        const previousVersion = Number(previous.version || 0);
        const previousFingerprint = text(previous.completion_fingerprint);
        if (previous.status === 'COMPLETED' && previousFingerprint === finalFingerprint) {
            return { completed: true, idempotent: true, replayed_request: false,
                fingerprint: finalFingerprint, stage1_version: previousVersion,
                stage1: previous };
        }

        const performedAt = now();
        const nextVersion = current ? previousVersion + 1 : 1;
        const nextStage1 = { status: 'COMPLETED', completion_fingerprint: finalFingerprint,
            effective_fingerprint: finalFingerprint,
            completed_at: performedAt, completed_by_user_id: actor.user_id,
            completed_by_user_name: actor.user_name, completed_by_user_role: actor.role,
            reason_or_notes: reason, version: nextVersion };

        if (!current) {
            try {
                await stateModel.create([{ ...scope, workflow_version: WORKFLOW_VERSION,
                    stage1: nextStage1 }], { session });
            } catch (error) {
                if (error?.code === 11000) throw commandError('STAGE1_VERSION_CONFLICT', 409,
                    'Το weekly workflow state δημιουργήθηκε ταυτόχρονα.');
                throw error;
            }
        } else {
            const updated = await stateModel.updateOne({ ...filter,
                'stage1.version': previousVersion }, { $set: { stage1: nextStage1 } }, { session });
            if (Number(updated?.matchedCount ?? updated?.n ?? 0) !== 1) {
                throw commandError('STAGE1_VERSION_CONFLICT', 409,
                    'Η έκδοση του Stage 1 άλλαξε πριν από την αποθήκευση.');
            }
        }

        const beforeStage = { status: previous.status || 'OPEN',
            completion_fingerprint: previousFingerprint, version: previousVersion };
        const afterStage = { status: 'COMPLETED', completion_fingerprint: finalFingerprint,
            version: nextVersion };
        await auditModel.create([{ ...scope, workflow_version: WORKFLOW_VERSION,
            stage: 'STAGE1', action: 'STAGE1_COMPLETED', stage_version: nextVersion,
            input_fingerprint: finalFingerprint,
            previous_completion_fingerprint: previousFingerprint,
            new_completion_fingerprint: finalFingerprint,
            before_stage: beforeStage, after_stage: afterStage, performed_at: performedAt,
            performed_by_user_id: actor.user_id, performed_by_user_name: actor.user_name,
            performed_by_user_role: actor.role, reason_or_notes: reason,
            request_id: requestId, command_identity: identity }], { session });

        return { completed: true, idempotent: false, replayed_request: false,
            fingerprint: finalFingerprint, previous_fingerprint: previousFingerprint,
            stage1_version: nextVersion, stage1: nextStage1 };
    });
}

module.exports = {
    WORKFLOW_VERSION,
    commandIdentity,
    completeWeeklyHrWorkflowStage1
};
