const DIAGNOSTIC = Object.freeze({
    INVALID_EXECUTION: 'INVALID_EXECUTION',
    INVALID_ROW_ID: 'INVALID_ROW_ID',
    SCOPE_MISMATCH: 'SCOPE_MISMATCH',
    MALFORMED_PAIR: 'MALFORMED_PAIR',
    MALFORMED_AFTER_SNAPSHOT: 'MALFORMED_AFTER_SNAPSHOT',
    INVALID_SOURCE_APPLIED_IDENTITY: 'INVALID_SOURCE_APPLIED_IDENTITY',
    INVALID_TARGET_APPLIED_IDENTITY: 'INVALID_TARGET_APPLIED_IDENTITY',
    DUPLICATE_APPLIED_EXECUTION: 'DUPLICATE_APPLIED_EXECUTION',
    CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION:
        'CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION',
    APPLIED_REPO_TRANSFER_IDENTITY_WRITE_CONFLICT:
        'APPLIED_REPO_TRANSFER_IDENTITY_WRITE_CONFLICT'
});

const PROTECTION_STATE = Object.freeze({
    UNPROTECTED: 'UNPROTECTED',
    PROTECTED: 'PROTECTED',
    CONFLICT: 'CONFLICT'
});

const ROLE = Object.freeze({
    SOURCE: 'SOURCE',
    TARGET: 'TARGET'
});

const IDENTITY_FIELDS = Object.freeze([
    'kathgoria_ergasias_apologistika',
    'repo_apologistika',
    'apologistiko_biblio'
]);

const SNAPSHOT_FIELD_TYPES = Object.freeze({
    kathgoria_ergasias_apologistika: 'string',
    repo_apologistika: 'boolean',
    apologistiko_biblio: 'boolean',
    adeia_apologistika: 'boolean',
    kathgoria_adeias_apologistika: 'string',
    ores_apoysias_apologistika: 'number',
    apo_ora_01_apologistika: 'string',
    eos_ora_01_apologistika: 'string',
    apo_ora_02_apologistika: 'string',
    eos_ora_02_apologistika: 'string',
    apo_ora_03_apologistika: 'string',
    eos_ora_03_apologistika: 'string',
    ores_ergasias_apologistika: 'number',
    ores_pragmatikhs_ergasias_apologistika: 'number',
    ores_adeias_pistomenes_apologistika: 'number',
    ores_argias_pistomenes_apologistika: 'number',
    compensation_breakdown_apologistika: 'object_or_null'
});

const SNAPSHOT_FIELDS = Object.freeze(Object.keys(SNAPSHOT_FIELD_TYPES));
const LEGACY_SNAPSHOT_FIELDS = Object.freeze(
    SNAPSHOT_FIELDS.filter((field) => field !== 'apologistiko_biblio')
);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
}

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)])
        );
    }
    if (value instanceof Date) return new Date(value.getTime());
    return value;
}

function normalizeRowId(value) {
    let candidate = value;
    if (value && typeof value === 'object') {
        if (typeof value.toHexString === 'function') {
            try {
                candidate = value.toHexString();
            } catch {
                return null;
            }
        } else if (
            typeof value.toString === 'function' &&
            value.toString !== Object.prototype.toString
        ) {
            try {
                candidate = value.toString();
            } catch {
                return null;
            }
        } else {
            return null;
        }
    }
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim().toLowerCase();
    return OBJECT_ID_PATTERN.test(normalized) ? normalized : null;
}

function requiredString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function validDateValue(value) {
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validSnapshot(snapshot, { nullable = false } = {}) {
    if (!isPlainObject(snapshot)) return false;
    const keys = Object.keys(snapshot);
    const fields = keys.length === LEGACY_SNAPSHOT_FIELDS.length &&
        !Object.hasOwn(snapshot, 'apologistiko_biblio')
        ? LEGACY_SNAPSHOT_FIELDS : SNAPSHOT_FIELDS;
    if (
        keys.length !== fields.length ||
        keys.some((field) => !Object.hasOwn(SNAPSHOT_FIELD_TYPES, field)) ||
        fields.some((field) => !Object.hasOwn(snapshot, field))
    ) {
        return false;
    }
    return fields.every((field) => {
        const value = snapshot[field];
        const expected = SNAPSHOT_FIELD_TYPES[field];
        if (value === null) return nullable || expected === 'object_or_null';
        if (expected === 'object_or_null') {
            return isPlainObject(value);
        }
        if (typeof value !== expected) return false;
        return expected !== 'number' || Number.isFinite(value);
    });
}

function diagnostic(code, rowId = null, executionId = null) {
    return deepFreeze({ code, rowId, executionId });
}

function addDiagnostic(target, code, rowId = null, executionId = null) {
    const key = `${code}|${rowId || ''}|${executionId || ''}`;
    if (target.keys.has(key)) return;
    target.keys.add(key);
    target.values.push(diagnostic(code, rowId, executionId));
}

function referencedLoadedIds(execution, loadedSet, hasLoadedFilter) {
    const candidates = [
        normalizeRowId(execution?.source_prodhlomena_oraria_id),
        normalizeRowId(execution?.target_prodhlomena_oraria_id)
    ].filter(Boolean);
    const distinct = [...new Set(candidates)];
    return hasLoadedFilter ? distinct.filter((rowId) => loadedSet.has(rowId)) : distinct;
}

function markConflict(entries, rowId, diagnostics) {
    if (!rowId) return;
    const existing = entries[rowId];
    const codes = new Set(existing?.diagnostics || []);
    for (const code of diagnostics) codes.add(code);
    entries[rowId] = deepFreeze({
        state: PROTECTION_STATE.CONFLICT,
        rowId,
        diagnostics: Object.freeze([...codes].sort())
    });
}

function executionEvidence(execution, scope) {
    if (!isPlainObject(execution)) {
        return { error: DIAGNOSTIC.INVALID_EXECUTION, rowIds: [] };
    }

    const executionId = normalizeRowId(execution._id);
    const decisionId = normalizeRowId(execution.decision_id);
    const employeeId = normalizeRowId(execution.employee_id);
    const actorId = normalizeRowId(execution.created_by_user_id);
    const proposalId = requiredString(execution.proposal_id);
    const employeeKodikos = requiredString(execution.employee_kodikos);
    const fingerprint = requiredString(execution.decision_fingerprint);
    const requestId = requiredString(execution.request_id);
    const commandIdentity = requiredString(execution.command_identity);
    const actorName = requiredString(execution.created_by_user_name);
    const actorRole = requiredString(execution.created_by_user_role);
    const weekStart = validDateValue(execution.week_start);
    const weekEnd = validDateValue(execution.week_end);
    const appliedAt = validDateValue(execution.applied_at);
    const createdAt = validDateValue(execution.created_at);
    const sourceRowId = normalizeRowId(execution.source_prodhlomena_oraria_id);
    const targetRowId = normalizeRowId(execution.target_prodhlomena_oraria_id);
    const rowIds = [sourceRowId, targetRowId].filter(Boolean);

    if (
        !executionId || !decisionId || !employeeId || !actorId || !proposalId ||
        !employeeKodikos || !fingerprint || !requestId || !commandIdentity ||
        !actorName || !actorRole || !weekStart || !weekEnd || !appliedAt || !createdAt
    ) {
        return { error: DIAGNOSTIC.INVALID_EXECUTION, executionId, rowIds };
    }
    if (!sourceRowId || !targetRowId || sourceRowId === targetRowId) {
        return { error: DIAGNOSTIC.MALFORMED_PAIR, executionId, rowIds };
    }
    if (
        execution.team !== scope.team ||
        execution.company_kod !== scope.company_kod ||
        execution.ypokatasthma !== scope.ypokatasthma
    ) {
        return { error: DIAGNOSTIC.SCOPE_MISMATCH, executionId, rowIds };
    }

    const sourceBefore = execution.before_snapshot?.source;
    const targetBefore = execution.before_snapshot?.target;
    const sourceAfter = execution.after_snapshot?.source;
    const targetAfter = execution.after_snapshot?.target;
    if (
        !validSnapshot(sourceBefore, { nullable: true }) ||
        !validSnapshot(targetBefore, { nullable: true }) ||
        typeof execution.before_snapshot?.source_locked !== 'boolean' ||
        typeof execution.before_snapshot?.target_locked !== 'boolean' ||
        !validSnapshot(sourceAfter) ||
        !validSnapshot(targetAfter) ||
        typeof execution.after_snapshot?.source_locked !== 'boolean' ||
        typeof execution.after_snapshot?.target_locked !== 'boolean'
    ) {
        return {
            error: DIAGNOSTIC.MALFORMED_AFTER_SNAPSHOT,
            executionId,
            rowIds
        };
    }
    if (
        sourceAfter.kathgoria_ergasias_apologistika !== 'ΕΡΓ' ||
        sourceAfter.repo_apologistika !== false
    ) {
        return {
            error: DIAGNOSTIC.INVALID_SOURCE_APPLIED_IDENTITY,
            executionId,
            rowIds
        };
    }
    if (
        !['ΑΝ', 'ΜΕ'].includes(targetAfter.kathgoria_ergasias_apologistika) ||
        targetAfter.repo_apologistika !== true
    ) {
        return {
            error: DIAGNOSTIC.INVALID_TARGET_APPLIED_IDENTITY,
            executionId,
            rowIds
        };
    }

    const common = {
        executionId,
        decisionId,
        proposalId,
        appliedAt,
        pair: {
            sourceRowId,
            targetRowId
        }
    };
    const source = {
        ...common,
        state: PROTECTION_STATE.PROTECTED,
        rowId: sourceRowId,
        role: ROLE.SOURCE,
        protectedValues: {
            kathgoria_ergasias_apologistika:
                sourceAfter.kathgoria_ergasias_apologistika,
            repo_apologistika: sourceAfter.repo_apologistika,
            ...(typeof sourceAfter.apologistiko_biblio === 'boolean'
                ? { apologistiko_biblio: sourceAfter.apologistiko_biblio } : {})
        }
    };
    const target = {
        ...common,
        state: PROTECTION_STATE.PROTECTED,
        rowId: targetRowId,
        role: ROLE.TARGET,
        protectedValues: {
            kathgoria_ergasias_apologistika:
                targetAfter.kathgoria_ergasias_apologistika,
            repo_apologistika: targetAfter.repo_apologistika,
            ...(typeof targetAfter.apologistiko_biblio === 'boolean'
                ? { apologistiko_biblio: targetAfter.apologistiko_biblio } : {})
        }
    };
    const signature = JSON.stringify({
        executionId,
        decisionId,
        proposalId,
        fingerprint,
        requestId,
        commandIdentity,
        employeeId,
        employeeKodikos,
        actorId,
        actorName,
        actorRole,
        weekStart,
        weekEnd,
        appliedAt,
        createdAt,
        scope: {
            team: execution.team,
            company_kod: execution.company_kod,
            ypokatasthma: execution.ypokatasthma
        },
        source,
        target
    });
    return { executionId, rowIds, source: deepFreeze(source), target: deepFreeze(target), signature };
}

function buildAppliedRepoTransferProtectionContext({
    executions = [],
    scope,
    loadedRowIds
} = {}) {
    const entries = {};
    const diagnostics = { values: [], keys: new Set() };
    const validScope = isPlainObject(scope) &&
        ['team', 'company_kod', 'ypokatasthma'].every((field) => requiredString(scope[field]));
    if (!validScope || !Array.isArray(executions)) {
        addDiagnostic(diagnostics, DIAGNOSTIC.INVALID_EXECUTION);
        return deepFreeze({ entriesByRowId: entries, diagnostics: diagnostics.values, hasConflicts: true });
    }

    const hasLoadedFilter = loadedRowIds !== undefined;
    const loadedSet = new Set();
    if (hasLoadedFilter) {
        if (!Array.isArray(loadedRowIds)) {
            addDiagnostic(diagnostics, DIAGNOSTIC.INVALID_ROW_ID);
        } else {
            for (const value of loadedRowIds) {
                const rowId = normalizeRowId(value);
                if (rowId) loadedSet.add(rowId);
                else addDiagnostic(diagnostics, DIAGNOSTIC.INVALID_ROW_ID);
            }
        }
    }

    const seenExecutions = new Map();
    for (const execution of executions) {
        if (execution?.execution_status !== 'APPLIED') continue;

        const evidence = executionEvidence(execution, scope);
        const affectedRows = referencedLoadedIds(execution, loadedSet, hasLoadedFilter);
        if (evidence.error) {
            addDiagnostic(diagnostics, evidence.error, null, evidence.executionId || null);
            for (const rowId of affectedRows) markConflict(entries, rowId, [evidence.error]);
            continue;
        }

        const previousEvidence = seenExecutions.get(evidence.executionId);
        if (previousEvidence !== undefined) {
            if (previousEvidence.signature === evidence.signature) continue;
            addDiagnostic(
                diagnostics,
                DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION,
                null,
                evidence.executionId
            );
            const ambiguousRows = [...new Set([
                ...previousEvidence.rowIds,
                ...evidence.rowIds
            ])].filter((rowId) => !hasLoadedFilter || loadedSet.has(rowId));
            for (const rowId of ambiguousRows) {
                markConflict(entries, rowId, [DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION]);
            }
            continue;
        }
        seenExecutions.set(evidence.executionId, {
            signature: evidence.signature,
            rowIds: evidence.rowIds
        });

        for (const candidate of [evidence.source, evidence.target]) {
            if (hasLoadedFilter && !loadedSet.has(candidate.rowId)) continue;
            const existing = entries[candidate.rowId];
            if (!existing) {
                entries[candidate.rowId] = candidate;
                continue;
            }
            if (
                existing.state === PROTECTION_STATE.PROTECTED &&
                existing.executionId === candidate.executionId
            ) {
                continue;
            }
            markConflict(entries, candidate.rowId, [DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION]);
            addDiagnostic(
                diagnostics,
                DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION,
                candidate.rowId
            );
        }
    }

    const hasEntryConflict = Object.values(entries).some(
        (entry) => entry.state === PROTECTION_STATE.CONFLICT
    );
    return deepFreeze({
        entriesByRowId: entries,
        diagnostics: diagnostics.values,
        hasConflicts: hasEntryConflict || diagnostics.values.length > 0
    });
}

function sanitizerResult({
    protectionState,
    sanitizedUpdate,
    removedIdentityFields = [],
    blockedIdentityFields = [],
    diagnostics = []
}) {
    return deepFreeze({
        protectionState,
        sanitizedUpdate,
        removedIdentityFields: [...removedIdentityFields].sort(),
        blockedIdentityFields: [...blockedIdentityFields].sort(),
        diagnostics: [...new Set(diagnostics)].sort(),
        hasConflict: diagnostics.length > 0 || blockedIdentityFields.length > 0
    });
}

function sanitizeAppliedRepoTransferUpdate({
    rowId,
    currentRow,
    update = {},
    protectionContext
} = {}) {
    const normalizedRowId = normalizeRowId(rowId);
    const safeUpdate = isPlainObject(update) ? cloneValue(update) : {};
    if (!normalizedRowId) {
        const blocked = [];
        for (const field of IDENTITY_FIELDS) {
            if (Object.hasOwn(safeUpdate, field)) {
                blocked.push(field);
                delete safeUpdate[field];
            }
        }
        return sanitizerResult({
            protectionState: PROTECTION_STATE.CONFLICT,
            sanitizedUpdate: safeUpdate,
            blockedIdentityFields: blocked,
            diagnostics: [DIAGNOSTIC.INVALID_ROW_ID]
        });
    }

    const entry = protectionContext?.entriesByRowId?.[normalizedRowId];
    if (!entry) {
        return sanitizerResult({
            protectionState: PROTECTION_STATE.UNPROTECTED,
            sanitizedUpdate: safeUpdate
        });
    }

    if (entry.state === PROTECTION_STATE.CONFLICT) {
        const blocked = [];
        for (const field of IDENTITY_FIELDS) {
            if (Object.hasOwn(safeUpdate, field)) {
                blocked.push(field);
                delete safeUpdate[field];
            }
        }
        return sanitizerResult({
            protectionState: PROTECTION_STATE.CONFLICT,
            sanitizedUpdate: safeUpdate,
            blockedIdentityFields: blocked,
            diagnostics: entry.diagnostics || [DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION]
        });
    }

    const diagnostics = [];
    const removed = [];
    const blocked = [];
    if (
        currentRow !== undefined &&
        (
            !isPlainObject(currentRow) ||
            Object.keys(entry.protectedValues).some(
                (field) => currentRow[field] !== entry.protectedValues[field]
            )
        )
    ) {
        diagnostics.push(DIAGNOSTIC.CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION);
    }

    for (const field of Object.keys(entry.protectedValues)) {
        if (!Object.hasOwn(safeUpdate, field)) continue;
        if (safeUpdate[field] === entry.protectedValues[field]) removed.push(field);
        else {
            blocked.push(field);
            diagnostics.push(DIAGNOSTIC.APPLIED_REPO_TRANSFER_IDENTITY_WRITE_CONFLICT);
        }
        delete safeUpdate[field];
    }

    return sanitizerResult({
        protectionState: PROTECTION_STATE.PROTECTED,
        sanitizedUpdate: safeUpdate,
        removedIdentityFields: removed,
        blockedIdentityFields: blocked,
        diagnostics
    });
}

module.exports = {
    DIAGNOSTIC,
    PROTECTION_STATE,
    ROLE,
    IDENTITY_FIELDS,
    SNAPSHOT_FIELDS,
    normalizeRowId,
    buildAppliedRepoTransferProtectionContext,
    sanitizeAppliedRepoTransferUpdate
};
