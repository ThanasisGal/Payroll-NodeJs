'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { MongoClient } = mongoose.mongo;
const { identifyReadOnlyTarget, argument } = require('./checkEmployeeHistoryReadiness');
const { PLAN_STATUSES, sha256, stableStringify,
    planEmployeeLegacyOpenCycleCleanup } =
    require('../server/services/ergazomenoi/employeeLegacyOpenCycleCleanupService');
const { findHistoryIdReferences } =
    require('../server/services/ergazomenoi/employeeHistoryReferenceAuditService');
const { partitionHistoryUpdateReferences } =
    require('../server/services/ergazomenoi/employeeHistoryReferenceSemanticsService');
const { repairEmployeeLegacyOpenCycles } =
    require('../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const { LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE } =
    require('../server/constants/employeeLegacyOpenCycleCleanup');
const { AUDIT_COLLECTION_NAME } = require('../server/constants/employeeHistoryRepairAudit');

const OUTPUT_JSON = '/tmp/employee-history-open-cycle-cleanup-plan.json';
const OUTPUT_CSV = '/tmp/employee-history-open-cycle-cleanup-plan.csv';
const OUTPUT_SHA = '/tmp/employee-history-open-cycle-cleanup-plan.sha256';
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const WRITE_COMMANDS = new Set(['insert', 'update', 'delete', 'findandmodify', 'create',
    'createindexes', 'drop', 'dropdatabase', 'dropindexes', 'renamecollection', 'collmod',
    'bulkwrite']);
const OUTCOMES = Object.freeze({
    APPLYABLE_DELETE_ONLY: 'APPLYABLE_DELETE_ONLY',
    APPLYABLE_DELETE_AND_CANONICAL_UPDATE: 'APPLYABLE_DELETE_AND_CANONICAL_UPDATE',
    APPLYABLE_WITH_CURRENT_HIRE_FOUNDATION: 'APPLYABLE_WITH_CURRENT_HIRE_FOUNDATION',
    BLOCKED_REFERENCED_CORRUPTED_CYCLE: 'BLOCKED_REFERENCED_CORRUPTED_CYCLE',
    BLOCKED_REMAINING_AMBIGUITY: 'BLOCKED_REMAINING_AMBIGUITY',
    BLOCKED_CURRENT_CHANGE_REQUIRED: 'BLOCKED_CURRENT_CHANGE_REQUIRED',
    BLOCKED_OTHER: 'BLOCKED_OTHER'
});

function scopeOf(value = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(value[field] ?? '').trim()]));
}

function scopeKey(value = {}) {
    return SCOPE_FIELDS.map(field => String(value[field] ?? '').trim()).join('|');
}

function validateArguments({ argv = [], env = process.env, knownProductionUri,
    knownDevelopmentUri, readFile = fs.readFileSync } = {}) {
    const dryRun = argv.includes('--dry-run');
    const apply = argv.includes('--apply');
    if (dryRun === apply) throw new Error('LEGACY_CLEANUP_EXACTLY_ONE_MODE_REQUIRED');
    const scopeFile = argument(argv, 'scope-file');
    const expectedCount = Number(argument(argv, 'expected-count'));
    if (!scopeFile) throw new Error('LEGACY_CLEANUP_SCOPE_FILE_REQUIRED');
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 1) {
        throw new Error('LEGACY_CLEANUP_EXPECTED_COUNT_REQUIRED');
    }
    const target = identifyReadOnlyTarget({ argv, env, knownProductionUri,
        knownDevelopmentUri, readFile });
    const expectedPlanSha256 = argument(argv, 'expected-plan-sha256');
    if (apply) {
        if (!/^[0-9a-f]{64}$/i.test(String(expectedPlanSha256 || ''))) {
            throw new Error('LEGACY_CLEANUP_APPLY_PLAN_SHA256_REQUIRED');
        }
        if (!argv.includes('--confirm-legacy-open-cycle-cleanup')) {
            throw new Error('LEGACY_CLEANUP_APPLY_CONFIRMATION_REQUIRED');
        }
        if (target.environment === 'PRODUCTION' &&
            !argv.includes('--confirm-production-history-repair')) {
            throw new Error('LEGACY_CLEANUP_PRODUCTION_CONFIRMATION_REQUIRED');
        }
    }
    return { dryRun, apply, scopeFile: path.resolve(scopeFile), expectedCount,
        expectedPlanSha256: expectedPlanSha256?.toLowerCase() || null, ...target };
}

function readExactScopes(scopeFile, expectedCount, readFile = fs.readFileSync) {
    const parsed = JSON.parse(readFile(scopeFile, 'utf8'));
    const input = Array.isArray(parsed) ? parsed : parsed?.scopes;
    if (!Array.isArray(input)) throw new Error('LEGACY_CLEANUP_SCOPE_FILE_INVALID');
    const classifiedInput = input.some(item => item?.classification != null || item?.reason != null);
    const selected = classifiedInput ? input.filter(item =>
        item.classification === 'INVALID_BUSINESS_DATA' &&
        item.reason === 'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE') : input;
    const scopes = selected.map(scopeOf);
    if (scopes.some(scope => SCOPE_FIELDS.some(field => !scope[field]))) {
        throw new Error('LEGACY_CLEANUP_SCOPE_INCOMPLETE');
    }
    if (new Set(scopes.map(scopeKey)).size !== scopes.length) {
        throw new Error('LEGACY_CLEANUP_SCOPE_DUPLICATE');
    }
    if (scopes.length !== expectedCount) throw new Error('LEGACY_CLEANUP_SCOPE_COUNT_MISMATCH');
    return scopes.sort((left, right) => scopeKey(left).localeCompare(scopeKey(right)));
}

function buildScopedEmployeeQuery(scopes) {
    if (!Array.isArray(scopes) || !scopes.length) {
        throw new Error('LEGACY_CLEANUP_EMPTY_SCOPE');
    }
    return { $or: scopes.map(scope => ({ ...scopeOf(scope) })) };
}

function assertExactScopePopulation(employees, scopes) {
    const expected = new Set(scopes.map(scopeKey));
    const actual = employees.map(scopeKey);
    if (employees.length !== scopes.length || new Set(actual).size !== actual.length ||
        actual.some(key => !expected.has(key)) || [...expected].some(key => !actual.includes(key))) {
        throw new Error('LEGACY_CLEANUP_DATABASE_SCOPE_MISMATCH');
    }
}

function referenceMapFor(ids, referenceRows) {
    const byId = Object.fromEntries(ids.map(id => [id, []]));
    for (const item of referenceRows) byId[item.historyId].push(...item.references);
    return byId;
}

function blockedOutcome(plan) {
    if (plan.status === PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY) {
        return OUTCOMES.BLOCKED_REMAINING_AMBIGUITY;
    }
    if (plan.status === PLAN_STATUSES.BLOCKED_CURRENT_CHANGE_REQUIRED) {
        return OUTCOMES.BLOCKED_CURRENT_CHANGE_REQUIRED;
    }
    return OUTCOMES.BLOCKED_OTHER;
}

function classifyDryRunPlan({ plan, referenceById = {} }) {
    if (plan.status !== PLAN_STATUSES.APPLYABLE) {
        return { outcome: blockedOutcome(plan), reason: plan.reason,
            physicalDeleteIds: [], finalUpdateIds: [], referencedRemovedIds: [] };
    }
    const policy = new Set(plan.policyRemovedHistoryIds);
    const canonical = new Set(plan.canonicalRemovedHistoryIds);
    const proposedRemovalIds = [...new Set([...policy, ...canonical])].sort();
    const referencedRemovedIds = proposedRemovalIds.filter(id =>
        (referenceById[id] || []).length).sort();
    const referencedPolicyWithoutReplacement = referencedRemovedIds.filter(id =>
        policy.has(id) && !plan.replacementByDeletedId[id]);
    if (referencedPolicyWithoutReplacement.length) {
        return { outcome: OUTCOMES.BLOCKED_REFERENCED_CORRUPTED_CYCLE,
            reason: 'PROTECTED_REFERENCE_WITHOUT_CANONICAL_SURVIVOR', physicalDeleteIds: [],
            finalUpdateIds: [], referencedRemovedIds };
    }
    const semanticRetireIds = [];
    for (const id of referencedRemovedIds.filter(id => canonical.has(id))) {
        if (!plan.replacementByDeletedId[id]) {
            return { outcome: OUTCOMES.BLOCKED_OTHER,
                reason: 'REFERENCED_CANONICAL_DELETE_WITHOUT_SURVIVOR', physicalDeleteIds: [],
                finalUpdateIds: [], referencedRemovedIds };
        }
        const partitioned = partitionHistoryUpdateReferences(referenceById[id] || []);
        if (partitioned.liveDereference.length) {
            return { outcome: OUTCOMES.BLOCKED_OTHER,
                reason: 'LIVE_REFERENCE_PREVENTS_SEMANTIC_RETIREMENT', physicalDeleteIds: [],
                finalUpdateIds: [], referencedRemovedIds };
        }
        semanticRetireIds.push(id);
    }
    for (const id of plan.updatedHistoryIds) {
        const references = referenceById[id] || [];
        if (references.length && partitionHistoryUpdateReferences(references).liveDereference.length) {
            return { outcome: OUTCOMES.BLOCKED_OTHER,
                reason: 'LIVE_REFERENCE_PREVENTS_CANONICAL_UPDATE', physicalDeleteIds: [],
                finalUpdateIds: [], referencedRemovedIds };
        }
    }
    const retired = new Set(semanticRetireIds);
    const physicalDeleteIds = proposedRemovalIds.filter(id => !retired.has(id));
    const finalUpdateIds = [...new Set([...plan.updatedHistoryIds, ...semanticRetireIds])].sort();
    let outcome = OUTCOMES.APPLYABLE_DELETE_ONLY;
    if (plan.insertedFoundationRows.length) {
        outcome = OUTCOMES.APPLYABLE_WITH_CURRENT_HIRE_FOUNDATION;
    } else if (finalUpdateIds.length) {
        outcome = OUTCOMES.APPLYABLE_DELETE_AND_CANONICAL_UPDATE;
    }
    return { outcome, reason: plan.reason, physicalDeleteIds, finalUpdateIds,
        referencedRemovedIds, semanticRetireIds };
}

function csvValue(value) {
    const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function recordsCsv(records) {
    const fields = ['team', 'company_display_code', 'company_kod', 'kodikos', 'employee_id',
        'original_history_ids', 'corrupted_cycle_hire_dates', 'policy_removed_ids',
        'canonical_removed_ids', 'updated_ids', 'inserted_row_count', 'surviving_ids',
        'referenced_removed_ids', 'final_canonical_status', 'final_cleanup_required',
        'second_pass_idempotent', 'outcome', 'reason'];
    return [fields.join(','), ...records.map(record => fields.map(field =>
        csvValue(record[field])).join(','))].join('\n') + '\n';
}

function applyableRecordsFor(plan) {
    return plan.records.filter(record => record.outcome.startsWith('APPLYABLE_'));
}

function verificationSnapshot(employee, rows) {
    return {
        currentFingerprint: sha256(employee),
        historyFingerprint: sha256(rows),
        historyIds: rows.map(row => String(row._id)).sort(),
        foundationIds: rows.filter(row => row.employment_profile_source ===
            LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE).map(row => String(row._id)).sort()
    };
}

async function buildDryRunPlan({ db, scopes, target, expectedCount,
    referenceChecker = findHistoryIdReferences }) {
    const employees = await db.collection('Ergazomenoi').find(buildScopedEmployeeQuery(scopes), {
        projection: { bibliario_anhlikoy_base64: 0,
            arxeio_nomimopoihtikon_eggrafon_base64: 0,
            arxeio_apodoxhs_oysiodon_oron_base64: 0,
            arxeio_apodoxhs_oron_atomikhs_symbashs_base64: 0,
            arxeio_symbashs_daneismoy_base64: 0 },
        sort: { team: 1, company_kod: 1, kodikos: 1, _id: 1 }
    }).toArray();
    assertExactScopePopulation(employees, scopes);
    const historyRows = await db.collection('Istoriko_Proslhpseon_Allagon')
        .find(buildScopedEmployeeQuery(scopes))
        .sort({ team: 1, company_kod: 1, kodikos: 1, aa_eggrafhs: 1,
            createdAt: 1, _id: 1 }).toArray();
    const companyIds = [...new Set(employees.map(item => String(item.company_kod)))].flatMap(id =>
        mongoose.Types.ObjectId.isValid(id) ? [id, new mongoose.Types.ObjectId(id)] : [id]);
    const companies = await db.collection('Companies').find({
        _id: { $in: companyIds }
    }, { projection: { _id: 1, team: 1, kod: 1 } }).toArray();
    const companyDisplay = new Map(companies.map(company =>
        [`${company.team}|${company._id}`, String(company.kod ?? '')]));
    const historyByScope = new Map();
    for (const row of historyRows) {
        const key = scopeKey(row);
        if (!historyByScope.has(key)) historyByScope.set(key, []);
        historyByScope.get(key).push(row);
    }
    const records = [];
    for (const employee of employees) {
        const scope = scopeOf(employee);
        const rows = historyByScope.get(scopeKey(scope)) || [];
        const plan = planEmployeeLegacyOpenCycleCleanup({ scope,
            currentEmployee: employee, completeHistoryRows: rows });
        const proposedIds = plan.status === PLAN_STATUSES.APPLYABLE
            ? [...new Set([...plan.policyRemovedHistoryIds,
                ...plan.canonicalRemovedHistoryIds, ...plan.updatedHistoryIds])].sort() : [];
        const referenceRows = [];
        for (const historyId of proposedIds) {
            const references = await referenceChecker({ connection: db,
                historyIds: [historyId] });
            referenceRows.push({ historyId, references });
        }
        const referenceById = referenceMapFor(proposedIds, referenceRows);
        const classified = classifyDryRunPlan({ plan, referenceById });
        const finalCanonical = plan.finalCanonicalResult || plan.canonicalResult;
        const physicalSurvivingIds = [...new Set([
            ...plan.desiredHistoryRows.map(row => String(row._id)),
            ...(classified.semanticRetireIds || [])
        ])].sort();
        records.push({
            team: scope.team,
            company_display_code: companyDisplay.get(`${scope.team}|${scope.company_kod}`) || '',
            company_kod: scope.company_kod,
            kodikos: scope.kodikos,
            employee_id: String(employee._id),
            original_history_ids: plan.diagnostics.originalHistoryIds,
            corrupted_cycle_hire_dates: plan.diagnostics.corruptedCycleHireDates,
            policy_removed_ids: plan.policyRemovedHistoryIds,
            canonical_removed_ids: plan.canonicalRemovedHistoryIds,
            updated_ids: classified.finalUpdateIds,
            inserted_row_count: plan.insertedFoundationRows.length,
            inserted_foundation_ids: plan.insertedFoundationRows.map(row => String(row._id)),
            surviving_ids: physicalSurvivingIds,
            referenced_removed_ids: classified.referencedRemovedIds,
            reference_collections: [...new Set(classified.referencedRemovedIds.flatMap(id =>
                (referenceById[id] || []).map(reference => reference.collection)))].sort(),
            final_canonical_status: finalCanonical?.status || null,
            final_cleanup_required: finalCanonical?.cleanupRequired ?? null,
            second_pass_idempotent: plan.diagnostics.secondPassIdempotent,
            outcome: classified.outcome,
            reason: classified.reason,
            planned_physical_delete_ids: classified.physicalDeleteIds,
            planned_update_ids: classified.finalUpdateIds,
            plan_fingerprint: plan.planFingerprint
        });
    }
    records.sort((left, right) => [left.outcome, left.team, left.company_display_code,
        left.kodikos].join('|').localeCompare([right.outcome, right.team,
        right.company_display_code, right.kodikos].join('|')));
    const outcomeCounts = Object.fromEntries(Object.values(OUTCOMES).map(value => [value, 0]));
    for (const record of records) outcomeCounts[record.outcome] += 1;
    const applyable = records.filter(record => record.outcome.startsWith('APPLYABLE_'));
    const summary = {
        selected_development_employees: records.length,
        expected_count: expectedCount,
        outcome_counts: outcomeCounts,
        applyable_total: applyable.length,
        blocked_total: records.length - applyable.length,
        total_planned_deletes: applyable.reduce((sum, record) =>
            sum + record.planned_physical_delete_ids.length, 0),
        total_planned_updates: applyable.reduce((sum, record) =>
            sum + record.planned_update_ids.length, 0),
        total_planned_inserts: applyable.reduce((sum, record) =>
            sum + record.inserted_row_count, 0),
        total_unchanged_surviving_ids: applyable.reduce((sum, record) => {
            const updated = new Set(record.planned_update_ids);
            return sum + record.original_history_ids.filter(id =>
                record.surviving_ids.includes(id) && !updated.has(id)).length;
        }, 0),
        total_referenced_proposed_removals: records.reduce((sum, record) =>
            sum + record.referenced_removed_ids.length, 0),
        foundation_employee_scopes: applyable.filter(record => record.inserted_row_count)
            .map(record => ({ team: record.team,
                company_display_code: record.company_display_code,
                company_kod: record.company_kod, kodikos: record.kodikos }))
    };
    const result = { schema_version: 'legacy-open-cycle-cleanup-plan:v1',
        environment: target.environment, database: target.database, summary, records };
    Object.defineProperty(result, '_verificationSnapshots', { enumerable: false,
        value: Object.fromEntries(employees.map(employee => {
            const key = scopeKey(employee);
            return [key, verificationSnapshot(employee, historyByScope.get(key) || [])];
        })) });
    return result;
}

async function verifyAppliedPlan({ db, beforePlan, afterPlan, applySummary }) {
    const beforeByScope = new Map(beforePlan.records.map(record => [scopeKey(record), record]));
    const afterByScope = new Map(afterPlan.records.map(record => [scopeKey(record), record]));
    const applyable = applyableRecordsFor(beforePlan);
    const blocked = beforePlan.records.filter(record => !record.outcome.startsWith('APPLYABLE_'));
    let alreadyClean = 0;
    let stillBlocked = 0;
    let unexpectedNewMutations = 0;
    for (const record of applyable) {
        const key = scopeKey(record);
        const beforeSnapshot = beforePlan._verificationSnapshots[key];
        const afterSnapshot = afterPlan._verificationSnapshots[key];
        const afterRecord = afterByScope.get(key);
        const expectedIds = [...record.surviving_ids].sort();
        const expectedFoundationIds = [...record.inserted_foundation_ids].sort();
        const clean = beforeSnapshot.currentFingerprint === afterSnapshot.currentFingerprint &&
            stableStringify(afterSnapshot.historyIds) === stableStringify(expectedIds) &&
            stableStringify(afterSnapshot.foundationIds) === stableStringify(expectedFoundationIds) &&
            record.planned_physical_delete_ids.every(id => !afterSnapshot.historyIds.includes(id)) &&
            afterRecord.final_canonical_status === 'CLEAN' &&
            afterRecord.final_cleanup_required === false &&
            afterRecord.second_pass_idempotent === true;
        const proposesNoWrites = afterRecord.planned_physical_delete_ids.length === 0 &&
            afterRecord.planned_update_ids.length === 0 && afterRecord.inserted_row_count === 0;
        if (!clean) throw new Error(`LEGACY_CLEANUP_POST_APPLY_VERIFICATION_FAILED:${key}`);
        if (proposesNoWrites) alreadyClean += 1;
        else unexpectedNewMutations += 1;
    }
    for (const record of blocked) {
        const key = scopeKey(record);
        const beforeSnapshot = beforePlan._verificationSnapshots[key];
        const afterSnapshot = afterPlan._verificationSnapshots[key];
        const afterRecord = afterByScope.get(key);
        if (beforeSnapshot.currentFingerprint !== afterSnapshot.currentFingerprint ||
            beforeSnapshot.historyFingerprint !== afterSnapshot.historyFingerprint ||
            stableStringify(beforeSnapshot.historyIds) !== stableStringify(afterSnapshot.historyIds)) {
            throw new Error(`LEGACY_CLEANUP_BLOCKED_SCOPE_CHANGED:${key}`);
        }
        if (afterRecord.outcome.startsWith('BLOCKED_')) stillBlocked += 1;
        else unexpectedNewMutations += 1;
    }
    const fingerprints = applyable.map(record => record.plan_fingerprint);
    const auditRows = await db.collection(AUDIT_COLLECTION_NAME).countDocuments({
        mutationSource: 'LEGACY_OPEN_CYCLE_CLEANUP',
        'diagnostics.planFingerprint': { $in: fingerprints }
    });
    if (auditRows !== applySummary.employees_mutated) {
        throw new Error('LEGACY_CLEANUP_AUDIT_COUNT_MISMATCH');
    }
    return { employees_verified: applyable.length, blocked_verified_untouched: blocked.length,
        audit_rows_written: auditRows, already_clean_after_apply: alreadyClean,
        still_blocked: stillBlocked, unexpected_new_mutations: unexpectedNewMutations };
}

async function run({ argv = process.argv.slice(2), env = process.env,
    knownProductionUri, knownDevelopmentUri, readFile = fs.readFileSync,
    writeFile = fs.writeFileSync, output = value => console.log(value),
    clientFactory = uri => new MongoClient(uri, { appName: 'legacy-open-cycle-cleanup-dry-run',
        retryWrites: false, monitorCommands: true }) } = {}) {
    const request = validateArguments({ argv, env, knownProductionUri,
        knownDevelopmentUri, readFile });
    const scopes = readExactScopes(request.scopeFile, request.expectedCount, readFile);
    const client = clientFactory(request.uri);
    const observedWriteCommands = [];
    if (typeof client.on === 'function') client.on('commandStarted', event => {
        if (WRITE_COMMANDS.has(String(event.commandName).toLowerCase())) {
            observedWriteCommands.push(event.commandName);
        }
    });
    let plan;
    try {
        await client.connect();
        plan = await buildDryRunPlan({ db: client.db(), scopes, target: request,
            expectedCount: request.expectedCount });
    } finally {
        await client.close();
    }
    if (observedWriteCommands.length) throw new Error('LEGACY_CLEANUP_DRY_RUN_WRITE_DETECTED');
    const fingerprint = sha256(plan);
    const machine = { ...plan, plan_sha256: fingerprint,
        safety: { mongodb_write_commands: 0, production_access: request.environment === 'PRODUCTION' } };
    if (request.apply) {
        if (request.expectedPlanSha256 !== fingerprint) {
            throw new Error('LEGACY_CLEANUP_GLOBAL_PLAN_SHA256_MISMATCH');
        }
        const applyable = applyableRecordsFor(plan);
        const applySummary = { employees_mutated: 0, physical_deletes: 0,
            updates: 0, inserts: 0, audit_rows_written: 0 };
        await mongoose.connect(request.uri, { autoIndex: false });
        try {
            for (const record of applyable) {
                const result = await repairEmployeeLegacyOpenCycles({ scope: scopeOf(record),
                    employeeId: record.employee_id,
                    expectedPlanFingerprint: record.plan_fingerprint });
                applySummary.employees_mutated += 1;
                applySummary.physical_deletes += result.applied.deleted;
                applySummary.updates += result.applied.updated;
                applySummary.inserts += result.applied.inserted.length;
                applySummary.audit_rows_written += result.applied.auditWritten ? 1 : 0;
            }
        } finally {
            await mongoose.disconnect();
        }
        if (applySummary.physical_deletes !== plan.summary.total_planned_deletes ||
            applySummary.updates !== plan.summary.total_planned_updates ||
            applySummary.inserts !== plan.summary.total_planned_inserts ||
            applySummary.audit_rows_written !== applyable.length) {
            const error = new Error('LEGACY_CLEANUP_ACTUAL_MUTATION_COUNT_MISMATCH');
            error.applySummary = applySummary;
            throw error;
        }
        const verificationClient = clientFactory(request.uri);
        const verificationWriteCommands = [];
        if (typeof verificationClient.on === 'function') {
            verificationClient.on('commandStarted', event => {
                if (WRITE_COMMANDS.has(String(event.commandName).toLowerCase())) {
                    verificationWriteCommands.push(event.commandName);
                }
            });
        }
        try {
            await verificationClient.connect();
            const verificationDb = verificationClient.db();
            const afterPlan = await buildDryRunPlan({ db: verificationDb, scopes,
                target: request, expectedCount: request.expectedCount });
            applySummary.verification = await verifyAppliedPlan({ db: verificationDb,
                beforePlan: plan, afterPlan, applySummary });
        } finally {
            await verificationClient.close();
        }
        if (verificationWriteCommands.length) {
            throw new Error('LEGACY_CLEANUP_POST_APPLY_WRITE_DETECTED');
        }
        machine.apply_result = applySummary;
    } else {
        writeFile(OUTPUT_JSON, `${JSON.stringify(machine, null, 2)}\n`);
        writeFile(OUTPUT_CSV, recordsCsv(machine.records));
        writeFile(OUTPUT_SHA, `${fingerprint}\n`);
    }
    output(JSON.stringify({ environment: request.environment, database: request.database,
        mode: request.dryRun ? 'DRY_RUN' : 'APPLY', ...plan.summary,
        plan_sha256: fingerprint, mongodb_write_commands: observedWriteCommands.length,
        output_json: request.dryRun ? OUTPUT_JSON : null,
        output_csv: request.dryRun ? OUTPUT_CSV : null,
        output_sha256: request.dryRun ? OUTPUT_SHA : null,
        apply_result: machine.apply_result || null }, null, 2));
    return machine;
}

async function main() {
    dotenv.config();
    return run();
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

module.exports = { OUTCOMES, OUTPUT_JSON, OUTPUT_CSV, OUTPUT_SHA, scopeOf, scopeKey,
    validateArguments, readExactScopes, buildScopedEmployeeQuery, assertExactScopePopulation,
    classifyDryRunPlan, recordsCsv, applyableRecordsFor, verificationSnapshot,
    buildDryRunPlan, verifyAppliedPlan, run, main };
