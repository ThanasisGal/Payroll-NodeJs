const mongoose = require('mongoose');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const {
    DIAGNOSTIC,
    PROTECTION_STATE,
    normalizeRowId,
    buildAppliedRepoTransferProtectionContext
} = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionService');

const EXECUTION_PROTECTION_FIELDS = Object.freeze([
    '_id',
    'decision_id',
    'decision_fingerprint',
    'proposal_id',
    'source_prodhlomena_oraria_id',
    'target_prodhlomena_oraria_id',
    'team',
    'company_kod',
    'ypokatasthma',
    'employee_id',
    'employee_kodikos',
    'week_start',
    'week_end',
    'request_id',
    'command_identity',
    'created_by_user_id',
    'created_by_user_name',
    'created_by_user_role',
    'execution_status',
    'before_snapshot',
    'after_snapshot',
    'applied_at',
    'created_at'
]);

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
}

function requiredString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeScopes(scopes) {
    if (!Array.isArray(scopes)) throw new TypeError('Applied protection scopes are required.');
    const normalized = [];
    for (const scope of scopes) {
        const team = requiredString(scope?.team);
        const company_kod = requiredString(scope?.company_kod);
        const ypokatasthma = requiredString(scope?.ypokatasthma);
        if (!team || !company_kod || !ypokatasthma || !Array.isArray(scope.loadedRowIds)) {
            throw new TypeError('Invalid applied protection scope.');
        }
        const loadedRowIds = [...new Set(scope.loadedRowIds.map(normalizeRowId).filter(Boolean))];
        if (loadedRowIds.length !== scope.loadedRowIds.length) {
            throw new TypeError('Invalid applied protection row ID.');
        }
        if (loadedRowIds.length === 0) continue;
        normalized.push(Object.freeze({ team, company_kod, ypokatasthma, loadedRowIds }));
    }
    return Object.freeze(normalized);
}

function rowMatchClause(scope) {
    return {
        ypokatasthma: scope.ypokatasthma,
        $or: [
            { source_prodhlomena_oraria_id: { $in: scope.loadedRowIds } },
            { target_prodhlomena_oraria_id: { $in: scope.loadedRowIds } }
        ]
    };
}

function buildAppliedExecutionQuery(scopes) {
    const normalized = normalizeScopes(scopes);
    if (normalized.length === 0) return null;
    const [first] = normalized;
    const sameTeamCompany = normalized.every(
        (scope) => scope.team === first.team && scope.company_kod === first.company_kod
    );
    if (sameTeamCompany) {
        const query = {
            team: first.team,
            company_kod: first.company_kod,
            execution_status: 'APPLIED'
        };
        if (normalized.length === 1) return { ...query, ...rowMatchClause(first) };
        return { ...query, $or: normalized.map(rowMatchClause) };
    }
    return {
        execution_status: 'APPLIED',
        $or: normalized.map((scope) => ({
            team: scope.team,
            company_kod: scope.company_kod,
            ...rowMatchClause(scope)
        }))
    };
}

function trustServerGeneratedInOperators(value) {
    if (Array.isArray(value)) {
        value.forEach(trustServerGeneratedInOperators);
        return value;
    }
    if (!value || typeof value !== 'object') return value;
    if (Object.hasOwn(value, '$in')) mongoose.trusted(value);
    Object.values(value).forEach(trustServerGeneratedInOperators);
    return value;
}

function mergeProtectionContexts(contexts) {
    const entriesByRowId = {};
    const diagnostics = [];
    const diagnosticKeys = new Set();
    let hasConflicts = false;

    for (const context of contexts) {
        hasConflicts ||= context.hasConflicts;
        for (const item of context.diagnostics) {
            const key = JSON.stringify(item);
            if (!diagnosticKeys.has(key)) {
                diagnosticKeys.add(key);
                diagnostics.push(item);
            }
        }
        for (const [rowId, entry] of Object.entries(context.entriesByRowId)) {
            const existing = entriesByRowId[rowId];
            if (!existing) {
                entriesByRowId[rowId] = entry;
                continue;
            }
            hasConflicts = true;
            entriesByRowId[rowId] = deepFreeze({
                state: PROTECTION_STATE.CONFLICT,
                rowId,
                diagnostics: [DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION]
            });
        }
    }
    return deepFreeze({ entriesByRowId, diagnostics, hasConflicts });
}

async function loadAppliedRepoTransferProtectionContext({
    scopes,
    executionModel = ExecutionModel
} = {}) {
    const normalizedScopes = normalizeScopes(scopes);
    const query = buildAppliedExecutionQuery(normalizedScopes);
    if (!query) {
        return deepFreeze({ entriesByRowId: {}, diagnostics: [], hasConflicts: false });
    }
    const executions = await executionModel
        .find(trustServerGeneratedInOperators(query))
        .select(EXECUTION_PROTECTION_FIELDS.join(' '))
        .lean();
    const contexts = normalizedScopes.map((scope) =>
        buildAppliedRepoTransferProtectionContext({
            executions: executions.filter(
                (execution) =>
                    execution.team === scope.team &&
                    execution.company_kod === scope.company_kod &&
                    execution.ypokatasthma === scope.ypokatasthma
            ),
            scope: {
                team: scope.team,
                company_kod: scope.company_kod,
                ypokatasthma: scope.ypokatasthma
            },
            loadedRowIds: scope.loadedRowIds
        })
    );
    return mergeProtectionContexts(contexts);
}

module.exports = {
    EXECUTION_PROTECTION_FIELDS,
    normalizeScopes,
    buildAppliedExecutionQuery,
    mergeProtectionContexts,
    loadAppliedRepoTransferProtectionContext
};
