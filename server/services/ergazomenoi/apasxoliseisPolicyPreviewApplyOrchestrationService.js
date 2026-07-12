const APPLY_ORCHESTRATION_EVENT_TYPE = 'POLICY_PREVIEW_APPLY_ORCHESTRATION';
const APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH = 300;
const APPLY_ORCHESTRATION_BLOCKED_CODES = Object.freeze([
    'LOCKED',
    'CONFIRMATION_REQUIRED',
    'WRITER_NOT_CONFIGURED',
    'NO_WRITE_MODELS'
]);
const APPLY_ORCHESTRATION_AUDIT_CONTEXT_KEYS = Object.freeze([
    'request_id',
    'correlation_id',
    'actor_id',
    'user_id',
    'team',
    'company_kod',
    'approval_id',
    'group_id',
    'policy_id',
    'source'
]);

function isArraySafely(value) {
    try {
        return Array.isArray(value);
    } catch {
        return false;
    }
}

function isNonArrayObjectSafely(value) {
    if (value === null || typeof value !== 'object') return false;
    try {
        return !Array.isArray(value);
    } catch {
        return false;
    }
}

function asObject(value) {
    return isNonArrayObjectSafely(value) ? value : {};
}

function safeReadProperty(object, key) {
    try {
        return object?.[key];
    } catch {
        return undefined;
    }
}

function safeStringForPublicMessage(value, fallback = 'Unknown execution error.') {
    const type = typeof value;
    const safelyConvertible = type === 'string'
        || (type === 'number' && Number.isFinite(value))
        || type === 'boolean'
        || type === 'bigint'
        || type === 'symbol';
    if (!safelyConvertible) return fallback;

    try {
        return String(value);
    } catch {
        return fallback;
    }
}

function isThenableSafely(value) {
    return typeof safeReadProperty(value, 'then') === 'function';
}

function sanitizeApplyExecutionFailureMessage(
    message,
    maxLength = APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH
) {
    const limit = Number.isInteger(maxLength) && maxLength > 0
        ? maxLength
        : APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH;
    return safeStringForPublicMessage(message, '')
        .replace(
            /\b(mongodb(?:\+srv)?):\/\/[^@\s/]+@([^\s/'"]+)/gi,
            '$1://[REDACTED]@$2'
        )
        .replace(
            /\bauthorization\s*[=:][\s\S]*/gi,
            'authorization=[REDACTED]'
        )
        .replace(
            /\b(password|passwd|pwd|token|secret|api[_-]?key|apikey|access[_-]?key|private[_-]?key|credential)\s*([=:])\s*(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi,
            '$1$2[REDACTED]'
        )
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
        .replace(/\b\d{9}\b/g, '[REDACTED]')
        .replace(
            /\b(filter|update|write_models?|operations?)\s*[=:][\s\S]*/gi,
            '$1=[REDACTED]'
        )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limit);
}

function normalizeCount(...candidates) {
    for (const candidate of candidates) {
        if (typeof candidate === 'number') {
            if (Number.isSafeInteger(candidate) && candidate >= 0) return candidate;
            continue;
        }
        if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
            const count = Number(candidate);
            if (Number.isSafeInteger(count)) return count;
        }
    }
    return null;
}

function normalizeFailureCode(code) {
    if (typeof code === 'number' && Number.isFinite(code)) return code;
    if (typeof code === 'string') {
        return sanitizeApplyExecutionFailureMessage(code, 100) || null;
    }
    return null;
}

function normalizeApplyExecutionError(error) {
    const source = asObject(error);
    const result = asObject(safeReadProperty(source, 'result'));
    const nestedResult = asObject(safeReadProperty(result, 'result'));
    const writeErrors = [
        safeReadProperty(source, 'writeErrors'),
        safeReadProperty(result, 'writeErrors'),
        safeReadProperty(nestedResult, 'writeErrors')
    ]
        .find(isArraySafely);
    const objectError = isNonArrayObjectSafely(error);
    const objectMessage = safeReadProperty(source, 'message');
    const primitiveMessage = error === null || error === undefined
        ? 'Unknown execution error.'
        : safeStringForPublicMessage(error);

    return {
        name: sanitizeApplyExecutionFailureMessage(
            safeReadProperty(source, 'name') || 'Error',
            100
        ) || 'Error',
        code: normalizeFailureCode(safeReadProperty(source, 'code')),
        message: sanitizeApplyExecutionFailureMessage(
            objectMessage !== undefined && objectMessage !== null
                ? objectMessage
                : objectError
                  ? 'Unknown execution error.'
                  : primitiveMessage
        ),
        matched_count: normalizeCount(
            safeReadProperty(source, 'matchedCount'),
            safeReadProperty(result, 'matchedCount'),
            safeReadProperty(result, 'nMatched'),
            safeReadProperty(nestedResult, 'matchedCount'),
            safeReadProperty(nestedResult, 'nMatched')
        ),
        modified_count: normalizeCount(
            safeReadProperty(source, 'modifiedCount'),
            safeReadProperty(result, 'modifiedCount'),
            safeReadProperty(result, 'nModified'),
            safeReadProperty(nestedResult, 'modifiedCount'),
            safeReadProperty(nestedResult, 'nModified')
        ),
        upserted_count: normalizeCount(
            safeReadProperty(source, 'upsertedCount'),
            safeReadProperty(result, 'upsertedCount'),
            safeReadProperty(result, 'nUpserted'),
            safeReadProperty(nestedResult, 'upsertedCount'),
            safeReadProperty(nestedResult, 'nUpserted')
        ),
        deleted_count: normalizeCount(
            safeReadProperty(source, 'deletedCount'),
            safeReadProperty(result, 'deletedCount'),
            safeReadProperty(result, 'nRemoved'),
            safeReadProperty(nestedResult, 'deletedCount'),
            safeReadProperty(nestedResult, 'nRemoved')
        ),
        write_errors_count: writeErrors ? writeErrors.length : null,
        partial_write_possible: true
    };
}

function sanitizeAuditContext(auditContext = {}) {
    const sanitized = {};
    const source = asObject(auditContext);

    APPLY_ORCHESTRATION_AUDIT_CONTEXT_KEYS.forEach((key) => {
        let descriptor;
        try {
            descriptor = Object.getOwnPropertyDescriptor(source, key);
        } catch {
            return;
        }
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return;
        const value = descriptor.value;
        if (typeof value === 'string') {
            sanitized[key] = sanitizeApplyExecutionFailureMessage(value, 250);
        } else if (
            (typeof value === 'number' && Number.isFinite(value))
            || typeof value === 'boolean'
            || value === null
        ) {
            sanitized[key] = value;
        }
    });

    return sanitized;
}

function countWriteModels(mongoWriteModelsPreview = {}) {
    const writeModels = safeReadProperty(mongoWriteModelsPreview, 'write_models');
    return isArraySafely(writeModels) ? writeModels.length : null;
}

function executionBlockedCode(executionResult = {}) {
    const executionGuard = asObject(safeReadProperty(executionResult, 'execution_guard'));
    const executionSummary = asObject(safeReadProperty(executionResult, 'execution_summary'));
    return safeReadProperty(executionGuard, 'blocked_code')
        || safeReadProperty(executionSummary, 'blocked_code')
        || null;
}

function classifyApplyExecutionResult(executionResult) {
    if (!isNonArrayObjectSafely(executionResult)) return 'INVALID';

    const blockedCode = executionBlockedCode(executionResult);
    if (APPLY_ORCHESTRATION_BLOCKED_CODES.includes(blockedCode)) return 'BLOCKED';
    if (safeReadProperty(executionResult, 'execution_status') === 'EXECUTED') return 'COMPLETED';
    return 'INVALID';
}

function buildApplyAuditPreview({
    orchestrationStatus,
    mongoWriteModelsPreview = {},
    executionResult = null,
    failure = null,
    auditContext = {}
} = {}) {
    const executionSummary = asObject(safeReadProperty(executionResult, 'execution_summary'));

    return {
        event_type: APPLY_ORCHESTRATION_EVENT_TYPE,
        orchestration_status: orchestrationStatus,
        execution_status: safeReadProperty(executionResult, 'execution_status') || null,
        blocked_code: executionBlockedCode(executionResult || {}),
        operation_count: countWriteModels(mongoWriteModelsPreview),
        matched_count: failure
            ? failure.matched_count
            : normalizeCount(executionSummary.matched_count),
        modified_count: failure
            ? failure.modified_count
            : normalizeCount(executionSummary.modified_count),
        writes_performed: failure
            ? null
            : normalizeCount(executionSummary.writes_performed),
        partial_write_possible: failure?.partial_write_possible === true,
        failure_name: failure?.name || null,
        failure_code: failure?.code ?? null,
        failure_message: failure?.message || null,
        context: sanitizeAuditContext(auditContext)
    };
}

function buildOrchestrationResult({
    orchestrationStatus,
    mongoWriteModelsPreview,
    executionResult = null,
    failure = null,
    auditContext
}) {
    return {
        orchestration_status: orchestrationStatus,
        execution_result: executionResult,
        failure,
        audit_preview: buildApplyAuditPreview({
            orchestrationStatus,
            mongoWriteModelsPreview,
            executionResult,
            failure,
            auditContext
        })
    };
}

async function orchestratePolicyPreviewApply({
    mongoWriteModelsPreview = {},
    options = {},
    executeWriteModels,
    auditContext = {}
} = {}) {
    if (typeof executeWriteModels !== 'function') {
        return buildOrchestrationResult({
            orchestrationStatus: 'NOT_CONFIGURED',
            mongoWriteModelsPreview,
            auditContext
        });
    }

    try {
        const executionCandidate = executeWriteModels({
            mongoWriteModelsPreview,
            options
        });
        const executionResult = isThenableSafely(executionCandidate)
            ? await executionCandidate
            : executionCandidate;
        const classification = classifyApplyExecutionResult(executionResult);
        if (classification === 'INVALID') {
            const error = new Error('Ο executor δεν επέστρεψε έγκυρο execution result.');
            error.code = 'INVALID_EXECUTION_RESULT';
            throw error;
        }

        return buildOrchestrationResult({
            orchestrationStatus: classification,
            mongoWriteModelsPreview,
            executionResult,
            auditContext
        });
    } catch (error) {
        const failure = normalizeApplyExecutionError(error);
        return buildOrchestrationResult({
            orchestrationStatus: 'FAILED',
            mongoWriteModelsPreview,
            failure,
            auditContext
        });
    }
}

module.exports = {
    APPLY_ORCHESTRATION_EVENT_TYPE,
    APPLY_ORCHESTRATION_FAILURE_MESSAGE_MAX_LENGTH,
    APPLY_ORCHESTRATION_BLOCKED_CODES,
    APPLY_ORCHESTRATION_AUDIT_CONTEXT_KEYS,
    isArraySafely,
    isNonArrayObjectSafely,
    safeReadProperty,
    safeStringForPublicMessage,
    isThenableSafely,
    sanitizeApplyExecutionFailureMessage,
    normalizeCount,
    normalizeApplyExecutionError,
    sanitizeAuditContext,
    countWriteModels,
    classifyApplyExecutionResult,
    buildApplyAuditPreview,
    orchestratePolicyPreviewApply
};
