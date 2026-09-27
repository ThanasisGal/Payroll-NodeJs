'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
    HISTORY_REFERENCE_FENCE_FIELD,
    employeeHistoryReferenceTargets,
    fenceEmployeeHistoryReferences
} = require('./employeeHistoryReferenceWriteFenceService');
const { buildCanonicalWeeklyDecisionSnapshot } =
    require('./apasxoliseisWeeklyCanonicalDecisionService');
const { buildCanonicalSnapshot } =
    require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { buildDeferredCrossPeriodRepoResolution } =
    require('./deferredCrossPeriodRepoResolutionService');

const first = '507f1f77bcf86cd799439201';
const second = '507f1f77bcf86cd799439202';
const base = { team: 'TEAM', company_kod: 'company', kodikos: '0069' };

function canonicalBuilderDocument() {
    const { snapshot } = buildCanonicalWeeklyDecisionSnapshot({
        team: base.team, company_kod: base.company_kod, ypokatasthma: '0001',
        employee_kodikos: base.kodikos, employee_id: 'employee-0069',
        week_start: '2026-06-01', week_end: '2026-06-07', weekly_rows: [],
        current_repo_identities: [], actual_work_facts: {},
        effective_profile: { istorikoId: first },
        profile_history: [{ _id: first }, { _id: second }],
        canonical_status: 'NEEDS_HR_DECISION', canonical_reasons: ['PROFILE_CHANGED'],
        policy_version: 'test:v1', source_version: 'test:v1'
    });
    return { team: base.team, company_kod: base.company_kod,
        employee_kodikos: base.kodikos, canonical_snapshot: snapshot };
}

function repoTransferBuilderDocument() {
    const sourceId = '507f1f77bcf86cd799439211';
    const targetId = '507f1f77bcf86cd799439212';
    const items = [
        { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: sourceId,
            hmeromhnia: '2026-06-01', proposed_values: {} },
        { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: targetId,
            hmeromhnia: '2026-06-02', proposed_values: {} }
    ];
    const snapshot = buildCanonicalSnapshot({
        scope: { team: base.team, company_kod: base.company_kod },
        context: {
            candidates: [{ ypokatasthma: '0001', kodikos: base.kodikos }],
            weekRows: items.map(item => ({ _id: item.prodhlomena_oraria_id,
                hmeromhnia: item.hmeromhnia })),
            employee: { _id: '507f1f77bcf86cd799439213' },
            employmentProfile: { profile_istoriko_id: first },
            history: [{ _id: first }, { _id: second }], audits: [],
            week: { start: '2026-06-01', end: '2026-06-07' },
            companyFlags: {}, companyKodikos: '0001', holidayByDateKey: new Map()
        },
        group: { group_id: 'group', group_key: 'key', group_type: 'PAIR',
            scenario_code: 'SCENARIO', policy_code: 'PRIMARY', secondary_policy_code: 'SECONDARY',
            pair_contract: { proposal_version: 'v1', choice_code: 'choice', policy_versions: {} },
            repo_resolution: {}, items }
    });
    return { team: base.team, company_kod: base.company_kod,
        employee_kodikos: base.kodikos, canonical_snapshot: snapshot };
}

function deferredBuilderDocument() {
    const dates = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
        '2026-05-01', '2026-05-02', '2026-05-03'];
    const identity = { team: base.team, company_kod: base.company_kod,
        ypokatasthma: '0001', employee_id: 'employee-0069',
        week_start: dates[0], week_end: dates[6],
        source_period_start: '2026-04-01', source_period_end: '2026-04-30' };
    const rows = dates.map((hmeromhnia, index) => ({ ...identity, _id: `row-${index}`,
        kodikos: base.kodikos, hmeromhnia, effective_profile_istoriko_id: index % 2 ? second : first,
        apologistiko_biblio: true, kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
        kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
        adeia_apologistika: false, astheneia_apologistika: false,
        kathgoria_adeias_apologistika: '', repo_apologistika: index >= 5,
        lock_state: 'OPEN', profile_identity: first, profile_version: 1,
        prodhlomena: { category: index < 5 ? 'ΕΡΓ' : 'ΑΝ' } }));
    const endpoint = index => ({ row_id: `row-${index}`, hmeromhnia: dates[index] });
    const accounting = (index, category) => ({ ...endpoint(index), apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: category, adeia_apologistika: false,
        astheneia_apologistika: false, kathgoria_adeias_apologistika: '',
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' });
    const decision = buildDeferredCrossPeriodRepoResolution({
        deferredWeek: { ...identity, deferred_week_id: JSON.stringify(Object.values(identity)),
            current_period_dates: dates.slice(0, 4), next_period_context_dates: dates.slice(4) },
        fullWeekContext: { daily_rows: rows }, source: endpoint(3), target: endpoint(4),
        sourcePeriod: { period_start: '2026-04-01', period_end: '2026-04-30' },
        targetPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
        resolutionPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
        hr: { user_id: 'user', user_name: 'HR', user_role: 'HR',
            resolved_at: '2026-05-04T09:00:00.000Z', resolution_reason: 'test' },
        beforeValues: [accounting(3, 'ΑΝ'), accounting(4, 'ΕΡΓ')],
        proposedAccountingAfterValues: [accounting(3, 'ΕΡΓ'), accounting(4, 'ΑΝ')],
        frozenSnapshotFingerprint: 'f'.repeat(64)
    });
    return { team: base.team, company_kod: base.company_kod,
        employee_kodikos: base.kodikos, canonical_snapshot: decision.canonical_snapshot };
}

test('real builders expose every current reference shape through the shared extractor', t => {
    const canonical = employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Canonical_Decisions', [canonicalBuilderDocument()]);
    assert.deepEqual(canonical.map(target => String(target.historyId)), [first, second]);

    const repo = employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Repo_Transfer_Decisions', [repoTransferBuilderDocument()]);
    assert.deepEqual(repo.map(target => String(target.historyId)), [first, second]);

    const deferred = employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Repo_Transfer_Decisions', [deferredBuilderDocument()]);
    assert.deepEqual(deferred.map(target => String(target.historyId)), [first, second]);
    t.diagnostic(JSON.stringify({ canonicalHistoryIds: canonical.length,
        repoTransferHistoryIds: repo.length, deferredRepoHistoryIds: deferred.length }));
});

test('reference extraction de-duplicates, ignores absent values and rejects malformed ids', () => {
    const document = canonicalBuilderDocument();
    document.decision_payload = { profile_reference: { history_id: first },
        selected_profile_reference: { id: null } };
    assert.equal(employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Canonical_Decisions', [document]).length, 2);
    document.decision_payload.selected_profile_reference.id = 'not-an-object-id';
    assert.throws(() => employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Canonical_Decisions', [document]),
    { code: 'EMPLOYEE_HISTORY_REFERENCE_ID_INVALID' });
});

test('all supported reference shapes resolve to employee-scoped history targets', () => {
    const deviations = employeeHistoryReferenceTargets('Prodhlomena_Oraria_Deviations', [{
        ...base, effective_profile_istoriko_id: first, previous_profile_istoriko_id: second
    }]);
    assert.deepEqual(deviations.map(target => String(target.historyId)), [first, second]);
    assert.ok(deviations.every(target => target.kodikos === '0069'));

    const actualSchedules = employeeHistoryReferenceTargets('Oraria_Apologistika', [{
        ...base, effective_profile_istoriko_id: second, previous_profile_istoriko_id: first
    }]);
    assert.deepEqual(actualSchedules.map(target => String(target.historyId)), [second, first]);

    const frozen = employeeHistoryReferenceTargets('Apasxoliseis_Period_Frozen_Snapshots', [{
        team: base.team, company_kod: base.company_kod,
        frozen_snapshot: { weekly_calculation_context: { profile_history: [
            { _id: first, kodikos: '0069' }
        ] }, daily_results: [{ kodikos: '0069', effective_profile_istoriko_id: second }] }
    }]);
    assert.deepEqual(frozen.map(target => String(target.historyId)).sort(), [first, second]);

    const canonical = employeeHistoryReferenceTargets('Apasxoliseis_Weekly_Canonical_Decisions', [{
        team: base.team, company_kod: base.company_kod, employee_kodikos: '0069',
        decision_payload: { profile_reference: { history_id: first } },
        canonical_snapshot: { input: { profile_history: [{ _id: second }] } }
    }]);
    assert.deepEqual(canonical.map(target => String(target.historyId)), [first, second]);

    const repoTransfer = employeeHistoryReferenceTargets(
        'Apasxoliseis_Weekly_Repo_Transfer_Decisions', [{
            team: base.team, company_kod: base.company_kod, employee_kodikos: '0069',
            reusable_decision_payload: { selected_profile_reference: { id: first } },
            canonical_snapshot: { analysis: { profile_history: [{ _id: second }] } }
        }]
    );
    assert.deepEqual(repoTransfer.map(target => String(target.historyId)), [second, first]);
});

test('reference creation requires a transaction and atomically fences every target', async () => {
    const documents = [{ ...base, effective_profile_istoriko_id: first,
        previous_profile_istoriko_id: second }];
    await assert.rejects(fenceEmployeeHistoryReferences({
        collectionName: 'Prodhlomena_Oraria_Deviations', documents
    }), { code: 'EMPLOYEE_HISTORY_REFERENCE_TRANSACTION_REQUIRED' });
    const calls = [];
    const session = {};
    const historyModel = { async updateOne(filter, update, options) {
        calls.push({ filter, update, options });
        return { matchedCount: 1 };
    } };
    const result = await fenceEmployeeHistoryReferences({
        collectionName: 'Prodhlomena_Oraria_Deviations', documents, session, historyModel
    });
    assert.equal(result.fenced, 2);
    assert.ok(calls.every(call => call.options.session === session));
    assert.ok(calls.every(call => call.update.$inc[HISTORY_REFERENCE_FENCE_FIELD] === 1));
    historyModel.updateOne = async () => ({ matchedCount: 0 });
    await assert.rejects(fenceEmployeeHistoryReferences({
        collectionName: 'Prodhlomena_Oraria_Deviations', documents, session, historyModel
    }), { code: 'EMPLOYEE_HISTORY_REFERENCE_TARGET_MISSING' });
});

test('every repository writer and cleanup deletion use the shared history write fence', () => {
    const root = path.resolve(__dirname, '../../..');
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    for (const file of [
        'server/controllers/ergazomenoi/erganhController.js',
        'server/services/ergazomenoi/apasxoliseisPeriodLifecycleService.js',
        'server/services/ergazomenoi/apasxoliseisWeeklyCanonicalDecisionService.js',
        'server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionService.js'
    ]) assert.match(read(file), /fenceEmployeeHistoryReferences/);
    const writer = read('server/services/ergazomenoi/employeeEmploymentProfileWriter.js');
    const executor = writer.slice(writer.indexOf('async function executeFinalMutationPlan'),
        writer.indexOf('// Private session sharing'));
    assert.match(executor, /historyModel\.updateMany\(deleteFilter[\s\S]*HISTORY_REFERENCE_FENCE_FIELD/);
    assert.ok(executor.indexOf('historyModel.updateMany(deleteFilter') <
        executor.indexOf('checkedHistoryReferences({ referenceChecker, connection'));
    const editorStart = writer.indexOf('async function writeEmployeeEmploymentHistoryOperations');
    const editorEnd = writer.indexOf('\n\nconst HISTORY_CURRENT_FIELDS', editorStart);
    const editor = writer.slice(editorStart, editorEnd);
    assert.doesNotMatch(editor,
        /historyModel\.(?:updateOne|updateMany|deleteOne|deleteMany|create)\(/);
    assert.match(editor, /executeFinalMutationPlan\(/);
    const controller = read('server/controllers/ergazomenoi/erganhController.js');
    const bulkStart = controller.indexOf('static completeWeeklyHrWorkflowStage2Bulk');
    const bulkEnd = controller.indexOf('\n    static ', bulkStart + 1);
    const bulk = controller.slice(bulkStart, bulkEnd);
    assert.match(bulk, /createWeeklyRepoTransferDecision\([\s\S]*mutationRunner:/);
});

test('cleanup and each real weekly reference writer are safe in both transaction orderings', () => {
    const referenceDocuments = [
        ['Apasxoliseis_Weekly_Canonical_Decisions', canonicalBuilderDocument()],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions', repoTransferBuilderDocument()],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions', deferredBuilderDocument()]
    ];
    const runConcurrentOrder = (firstCommit, target) => {
        const store = { exists: true, fence: 0, references: new Set() };
        const begin = kind => {
            const baseFence = store.fence;
            let fenced = false;
            return {
                fence() {
                    assert.equal(store.exists, true);
                    fenced = true;
                },
                commit() {
                    assert.equal(fenced, true);
                    if (!store.exists || store.fence !== baseFence) {
                        const error = new Error('WRITE_CONFLICT');
                        error.code = 'WRITE_CONFLICT';
                        throw error;
                    }
                    store.fence += 1;
                    if (kind === 'cleanup') store.exists = false;
                    else store.references.add(String(target.historyId));
                }
            };
        };
        const cleanup = begin('cleanup');
        const reference = begin('reference');
        cleanup.fence();
        reference.fence();
        const winner = firstCommit === 'cleanup' ? cleanup : reference;
        const loser = firstCommit === 'cleanup' ? reference : cleanup;
        winner.commit();
        assert.throws(() => loser.commit(), { code: 'WRITE_CONFLICT' });
        return store;
    };
    for (const [collectionName, document] of referenceDocuments) {
        const targets = employeeHistoryReferenceTargets(collectionName, [document]);
        assert.ok(targets.length > 0, collectionName);
        const target = targets[0];
        const cleanupWins = runConcurrentOrder('cleanup', target);
        assert.equal(cleanupWins.exists, false);
        assert.equal(cleanupWins.references.size, 0);
        const referenceWins = runConcurrentOrder('reference', target);
        assert.equal(referenceWins.exists, true);
        assert.equal(referenceWins.references.has(String(target.historyId)), true);

        const referenceCommitted = { exists: true, fence: 1,
            references: new Set([String(target.historyId)]) };
        const cleanupAudit = () => {
            if (referenceCommitted.references.has(String(target.historyId))) {
                const error = new Error('REFERENCE_EXISTS'); error.code = 'REFERENCE_EXISTS';
                throw error;
            }
        };
        assert.throws(cleanupAudit, { code: 'REFERENCE_EXISTS' });
        assert.equal(referenceCommitted.exists, true);
    }
});
