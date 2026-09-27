'use strict';

const { canonicalizeEmployeeHistory, CANONICAL_STATUSES } =
    require('./employeeHistoryCanonicalizationService');
const { STATES } = require('./employeeEmploymentProfileMutationResolverService');
const { planEmployeeMaintenanceHistory } =
    require('./employeeMaintenanceHistoryPlannerService');
const { REFERENCE_QUERIES, findHistoryIdReferences } =
    require('./employeeHistoryReferenceAuditService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');

const CLASSIFICATIONS = Object.freeze({
    CANONICAL_CLEAN: 'CANONICAL_CLEAN',
    NO_HISTORY_BASELINE: 'NO_HISTORY_BASELINE',
    REPAIRABLE: 'REPAIRABLE',
    REFERENCED_LEGACY_ARTIFACT: 'REFERENCED_LEGACY_ARTIFACT',
    GENUINE_BUSINESS_AMBIGUITY: 'GENUINE_BUSINESS_AMBIGUITY',
    INVALID_BUSINESS_DATA: 'INVALID_BUSINESS_DATA',
    APPLICATION_LOGIC_FAILURE: 'APPLICATION_LOGIC_FAILURE'
});

function scopeFor(employee = {}) {
    return Object.fromEntries(['team', 'company_kod', 'kodikos']
        .map(field => [field, String(employee[field] ?? '')]));
}

function reasonForCanonical(result) {
    return result.diagnostics?.reason || result.conflicts?.[0]?.reason || 'UNKNOWN_CANONICAL_REASON';
}

function isBusinessDataInvalid(result) {
    return result.diagnostics?.businessDataInvalid === true || [
        'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE',
        'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE',
        'EMPLOYMENT_CYCLE_OVERLAP',
        'PROFILE_EVENT_AFTER_DEPARTURE'
    ].includes(reasonForCanonical(result));
}

async function classifyEmployeeHistory({ currentEmployee, historyRows, connection,
    companyDisplayCode = '',
    referenceChecker = findHistoryIdReferences } = {}) {
    const scope = scopeFor(currentEmployee);
    const reportScope = { ...scope, company_display_code: String(companyDisplayCode || '') };
    if (!historyRows.length) return { scope: reportScope, historyRowCount: 0,
        classification: CLASSIFICATIONS.NO_HISTORY_BASELINE, reason: 'NO_HISTORY_BASELINE',
        blocksOrdinaryMaintenance: false, canonical: null, references: [] };
    const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows });
    if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
        return { scope: reportScope, historyRowCount: historyRows.length,
            classification: isBusinessDataInvalid(canonical)
                ? CLASSIFICATIONS.INVALID_BUSINESS_DATA : CLASSIFICATIONS.GENUINE_BUSINESS_AMBIGUITY,
            reason: reasonForCanonical(canonical), blocksOrdinaryMaintenance: true,
            canonical, references: [] };
    }
    const resolver = planEmployeeMaintenanceHistory({ scope, currentEmployee,
        historyRows, submittedState: { employeePatch: {}, historyPatch: {} } });
    if (resolver.state === STATES.CONFLICT) {
        return { scope: reportScope, historyRowCount: historyRows.length,
            classification: CLASSIFICATIONS.APPLICATION_LOGIC_FAILURE,
            reason: resolver.responseCode, blocksOrdinaryMaintenance: true,
            canonical, resolver, references: [] };
    }
    if (!canonical.cleanupRequired) return { scope: reportScope, historyRowCount: historyRows.length,
        classification: CLASSIFICATIONS.CANONICAL_CLEAN, reason: 'CANONICAL_CLEAN',
        blocksOrdinaryMaintenance: false, canonical, resolver, references: [] };
    const references = [];
    for (const update of canonical.rowsToUpdate) {
        const found = await referenceChecker({ connection, historyIds: [update.historyId] });
        if (!found.length) continue;
        const partitioned = partitionHistoryUpdateReferences(found);
        references.push(...found.map(reference => ({ ...reference,
            historyId: update.historyId, mutation: 'UPDATE' })));
        if (partitioned.liveDereference.length) {
            return { scope: reportScope, historyRowCount: historyRows.length,
                classification: CLASSIFICATIONS.APPLICATION_LOGIC_FAILURE,
                reason: 'EMPLOYEE_HISTORY_REFERENCED_UPDATE_REQUIRES_REPLACEMENT',
                blocksOrdinaryMaintenance: true, canonical, resolver, references };
        }
    }
    let referencedDeletion = false;
    for (const deletion of canonical.rowsToDelete) {
        const found = await referenceChecker({ connection, historyIds: [deletion.historyId] });
        if (!found.length) continue;
        referencedDeletion = true;
        references.push(...found.map(reference => ({ ...reference,
            historyId: deletion.historyId, mutation: 'DELETE' })));
    }
    return { scope: reportScope, historyRowCount: historyRows.length,
        classification: referencedDeletion
            ? CLASSIFICATIONS.REFERENCED_LEGACY_ARTIFACT : CLASSIFICATIONS.REPAIRABLE,
        reason: referencedDeletion ? 'REFERENCED_REDUNDANT_PHYSICAL_ROW' : 'CANONICAL_REPAIR_REQUIRED',
        blocksOrdinaryMaintenance: false, canonical, resolver, references };
}

function emptyCounts() {
    return Object.fromEntries(Object.values(CLASSIFICATIONS).map(key => [key, 0]));
}

async function scanEmployeeHistoryPopulation({ db, batchSize = 100,
    employeeCollectionName = 'Ergazomenoi', historyCollectionName = 'Istoriko_Proslhpseon_Allagon',
    companyCollectionName = 'Companies',
    referenceChecker = findHistoryIdReferences, onProgress = null } = {}) {
    if (!db?.collection) throw new TypeError('MongoDB database handle required');
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
        throw new TypeError('batchSize must be between 1 and 500');
    }
    const started = process.hrtime.bigint();
    const counts = emptyCounts();
    const reasons = {};
    const blockers = [];
    let totalEmployees = 0;
    let totalHistoryRows = 0;
    let readQueries = 2;
    const companies = await db.collection(companyCollectionName).find({}, {
        projection: { _id: 1, team: 1, kod: 1 }
    }).toArray();
    const companyDisplayByScope = new Map(companies.map(company => [
        `${String(company.team ?? '')}|${String(company._id ?? '')}`,
        String(company.kod ?? '')
    ]));
    const cursor = db.collection(employeeCollectionName).find({}, {
        projection: { bibliario_anhlikoy_base64: 0,
            arxeio_nomimopoihtikon_eggrafon_base64: 0,
            arxeio_apodoxhs_oysiodon_oron_base64: 0,
            arxeio_apodoxhs_oron_atomikhs_symbashs_base64: 0,
            arxeio_symbashs_daneismoy_base64: 0 },
        sort: { team: 1, company_kod: 1, kodikos: 1, _id: 1 }, batchSize
    });
    try {
        while (await cursor.hasNext()) {
            const employees = [];
            while (employees.length < batchSize && await cursor.hasNext()) {
                employees.push(await cursor.next());
            }
            if (!employees.length) break;
            const scopes = employees.map(scopeFor);
            const historyRows = await db.collection(historyCollectionName)
                .find({ $or: scopes }).sort({ team: 1, company_kod: 1, kodikos: 1,
                    aa_eggrafhs: 1, createdAt: 1, _id: 1 }).toArray();
            readQueries += 1;
            totalHistoryRows += historyRows.length;
            const byScope = new Map();
            for (const row of historyRows) {
                const key = JSON.stringify(scopeFor(row));
                if (!byScope.has(key)) byScope.set(key, []);
                byScope.get(key).push(row);
            }
            for (const employee of employees) {
                const classified = await classifyEmployeeHistory({ currentEmployee: employee,
                    historyRows: byScope.get(JSON.stringify(scopeFor(employee))) || [],
                    companyDisplayCode: companyDisplayByScope.get(
                        `${String(employee.team ?? '')}|${String(employee.company_kod ?? '')}`) || '',
                    connection: db, referenceChecker: async args => {
                        readQueries += referenceChecker === findHistoryIdReferences
                            ? REFERENCE_QUERIES.length : 1;
                        return referenceChecker(args);
                    } });
                totalEmployees += 1;
                counts[classified.classification] += 1;
                reasons[classified.reason] = (reasons[classified.reason] || 0) + 1;
                if (classified.blocksOrdinaryMaintenance) blockers.push({
                    ...classified.scope,
                    historyRowCount: classified.historyRowCount,
                    classification: classified.classification,
                    reason: classified.reason,
                    historyIds: classified.canonical?.diagnostics?.historyIds || []
                });
            }
            if (onProgress) onProgress({ totalEmployees, totalHistoryRows });
        }
    } finally {
        await cursor.close();
    }
    return { totalEmployees, totalHistoryRows, counts, reasons,
        WOULD_ORDINARY_MAINTENANCE_BLOCK_COUNT: blockers.length,
        blockers, performance: {
            elapsedMilliseconds: Number(process.hrtime.bigint() - started) / 1e6,
            rssBytes: process.memoryUsage().rss,
            approximateReadQueries: readQueries
        } };
}

module.exports = { CLASSIFICATIONS, scopeFor, classifyEmployeeHistory,
    scanEmployeeHistoryPopulation };
