'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PLAN_STATUSES, planEmployeeLegacyOpenCycleCleanup } =
    require('../server/services/ergazomenoi/employeeLegacyOpenCycleCleanupService');
const { OUTCOMES, validateArguments, readExactScopes, buildScopedEmployeeQuery,
    assertExactScopePopulation, classifyDryRunPlan, applyableRecordsFor,
    verifyAppliedPlan, buildDryRunPlan } =
    require('./repairEmployeeLegacyOpenCycles');

const developmentUri = 'mongodb://development.example.test/payroll_development';
const productionUri = 'mongodb://production.example.test/payroll_production';
const baseArgs = ['--expected-database=payroll_development', '--scope-file=/tmp/scopes.json',
    '--expected-count=53'];

test('dry-run blocks referenced corrupted cycle without a real canonical survivor', () => {
    const id = '507f1f77bcf86cd799439161';
    const classified = classifyDryRunPlan({ plan: {
        status: PLAN_STATUSES.APPLYABLE,
        reason: 'LEGACY_OPEN_CYCLE_POLICY_PLAN_READY',
        policyRemovedHistoryIds: [id], canonicalRemovedHistoryIds: [],
        updatedHistoryIds: [], insertedFoundationRows: [], replacementByDeletedId: {}
    }, referenceById: { [id]: [{ collection: 'Prodhlomena_Oraria_Deviations',
        documentId: 'frozen-1' }] } });
    assert.equal(classified.outcome, OUTCOMES.BLOCKED_REFERENCED_CORRUPTED_CYCLE);
    assert.deepEqual(classified.physicalDeleteIds, []);
});

test('dry-run blocks a referenced later stray row without a canonical survivor', () => {
    const scope = { team: 'BLG', company_kod: 'company', kodikos: '0319' };
    const laterId = '507f1f77bcf86cd799439181';
    const currentEmployee = { _id: '507f1f77bcf86cd799439182', ...scope,
        hmeromhnia_proslhpshs: '2026-05-30', hmeromhnia_apoxorhshs: null };
    const history = [
        { _id: '507f1f77bcf86cd799439183', ...scope, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2026-05-30', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false },
        { _id: laterId, ...scope, aa_eggrafhs: '0002',
            hmeromhnia_proslhpshs: '2026-06-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false }
    ];
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee,
        completeHistoryRows: history });
    assert.deepEqual(plan.diagnostics.corruptedLaterStrayHireDates, ['2026-06-01']);
    const classified = classifyDryRunPlan({ plan,
        referenceById: { [laterId]: [{ collection: 'Oraria_Apologistika',
            documentId: 'frozen-1' }] } });
    assert.equal(classified.outcome, OUTCOMES.BLOCKED_REFERENCED_CORRUPTED_CYCLE);
    assert.deepEqual(classified.physicalDeleteIds, []);
});

test('later closed cycle maps to its dedicated dry-run outcome', () => {
    const classified = classifyDryRunPlan({ plan: {
        status: PLAN_STATUSES.BLOCKED_LATER_CLOSED_CYCLE,
        reason: 'LATER_NON_CURRENT_CYCLE_HAS_EXPLICIT_DEPARTURE'
    } });
    assert.equal(classified.outcome, OUTCOMES.BLOCKED_LATER_CLOSED_CYCLE);
});

test('exact scope query and population assertion reject any out-of-scope employee', () => {
    const scopes = [{ team: 'BLG', company_kod: 'company-a', kodikos: '0001' }];
    assert.deepEqual(buildScopedEmployeeQuery(scopes), { $or: [scopes[0]] });
    assert.doesNotThrow(() => assertExactScopePopulation([{ ...scopes[0], _id: 'employee' }],
        scopes));
    assert.throws(() => assertExactScopePopulation([
        { ...scopes[0], _id: 'employee' },
        { team: 'BLG', company_kod: 'company-a', kodikos: 'outside' }
    ], scopes), /LEGACY_CLEANUP_DATABASE_SCOPE_MISMATCH/);
});

test('classified scope file selects only the exact open-before-next-hire population', () => {
    const selected = { team: 'BLG', company_kod: 'company-a', kodikos: '0001',
        classification: 'INVALID_BUSINESS_DATA',
        reason: 'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE' };
    const unrelated = { team: 'BLG', company_kod: 'company-a', kodikos: '0002',
        classification: 'GENUINE_BUSINESS_AMBIGUITY', reason: 'OTHER' };
    const scopes = readExactScopes('/tmp/not-read.json', 1,
        () => JSON.stringify([unrelated, selected]));
    assert.deepEqual(scopes, [{ team: 'BLG', company_kod: 'company-a', kodikos: '0001' }]);
});

test('apply requires the expected fingerprint and explicit cleanup confirmation', () => {
    const common = { env: { MONGODB_URL: developmentUri },
        knownDevelopmentUri: developmentUri, knownProductionUri: productionUri };
    assert.throws(() => validateArguments({ ...common,
        argv: ['--apply', ...baseArgs] }), /LEGACY_CLEANUP_APPLY_PLAN_SHA256_REQUIRED/);
    const withSha = ['--apply', ...baseArgs, `--expected-plan-sha256=${'a'.repeat(64)}`];
    assert.throws(() => validateArguments({ ...common, argv: withSha }),
        /LEGACY_CLEANUP_APPLY_CONFIRMATION_REQUIRED/);
    const validated = validateArguments({ ...common,
        argv: [...withSha, '--confirm-legacy-open-cycle-cleanup'] });
    assert.equal(validated.apply, true);
    assert.equal(validated.environment, 'DEVELOPMENT');
});

test('dry-run accepts a distinct tmp output prefix and rejects repository paths', () => {
    const common = { env: { MONGODB_URL: developmentUri },
        knownDevelopmentUri: developmentUri, knownProductionUri: productionUri };
    const validated = validateArguments({ ...common, argv: ['--dry-run', ...baseArgs,
        '--output-prefix=/tmp/later-stray-plan'] });
    assert.equal(validated.outputPrefix, '/tmp/later-stray-plan');
    assert.throws(() => validateArguments({ ...common, argv: ['--dry-run', ...baseArgs,
        '--output-prefix=/home/example/later-stray-plan'] }),
    /LEGACY_CLEANUP_OUTPUT_PREFIX_MUST_BE_TMP_BASENAME/);
});

test('dry-run plan reads only the exact scope and emits a delete-only plan', async () => {
    const scope = { team: 'BLG', company_kod: '507f1f77bcf86cd799439171', kodikos: '0001' };
    const collections = {
        Ergazomenoi: [{ _id: '507f1f77bcf86cd799439172', ...scope,
            hmeromhnia_proslhpshs: '2026-05-01', hmeromhnia_apoxorhshs: null }],
        Istoriko_Proslhpseon_Allagon: [
            { _id: '507f1f77bcf86cd799439173', ...scope, aa_eggrafhs: '0001',
                hmeromhnia_proslhpshs: '2025-05-01', afora_proslhpsh: true,
                afora_allagh_oron_ergasias: false },
            { _id: '507f1f77bcf86cd799439174', ...scope, aa_eggrafhs: '0002',
                hmeromhnia_proslhpshs: '2026-05-01', afora_proslhpsh: true,
                afora_allagh_oron_ergasias: false }
        ],
        Companies: [{ _id: scope.company_kod, team: 'BLG', kod: '0007' }]
    };
    const db = { collection(name) {
        return { find() {
            return { sort() { return this; }, async toArray() { return collections[name]; } };
        } };
    } };
    const plan = await buildDryRunPlan({ db, scopes: [scope],
        target: { environment: 'DEVELOPMENT', database: 'payroll_development' },
        expectedCount: 1, referenceChecker: async () => [] });
    assert.equal(plan.records.length, 1);
    assert.equal(plan.records[0].outcome, OUTCOMES.APPLYABLE_DELETE_ONLY);
    assert.deepEqual(plan.records[0].planned_physical_delete_ids,
        ['507f1f77bcf86cd799439173']);
    assert.equal(plan.summary.total_planned_deletes, 1);
    assert.equal(Object.keys(plan).includes('_verificationSnapshots'), false);
});

test('apply selection excludes blocked scopes and post-check proves they stayed untouched', async () => {
    const applyable = { team: 'BLG', company_kod: 'company', kodikos: '0001',
        outcome: OUTCOMES.APPLYABLE_DELETE_ONLY, plan_fingerprint: 'a'.repeat(64),
        surviving_ids: ['current'], inserted_foundation_ids: [],
        planned_physical_delete_ids: ['old'] };
    const blocked = { team: 'BLG', company_kod: 'company', kodikos: '0002',
        outcome: OUTCOMES.BLOCKED_REMAINING_AMBIGUITY };
    const cleanAfter = { ...applyable, planned_physical_delete_ids: [],
        planned_update_ids: [], inserted_row_count: 0, final_canonical_status: 'CLEAN',
        final_cleanup_required: false, second_pass_idempotent: true };
    const blockedAfter = { ...blocked };
    const before = { records: [applyable, blocked], _verificationSnapshots: {
        'BLG|company|0001': { currentFingerprint: 'current-1',
            historyFingerprint: 'history-before', historyIds: ['old', 'current'],
            foundationIds: [] },
        'BLG|company|0002': { currentFingerprint: 'current-2',
            historyFingerprint: 'blocked-history', historyIds: ['blocked'],
            foundationIds: [] }
    } };
    const after = { records: [cleanAfter, blockedAfter], _verificationSnapshots: {
        'BLG|company|0001': { currentFingerprint: 'current-1',
            historyFingerprint: 'history-after', historyIds: ['current'], foundationIds: [] },
        'BLG|company|0002': { currentFingerprint: 'current-2',
            historyFingerprint: 'blocked-history', historyIds: ['blocked'],
            foundationIds: [] }
    } };
    assert.deepEqual(applyableRecordsFor(before), [applyable]);
    const verified = await verifyAppliedPlan({
        db: { collection() { return { countDocuments: async () => 1 }; } },
        beforePlan: before, afterPlan: after, applySummary: { employees_mutated: 1 }
    });
    assert.deepEqual(verified, { employees_verified: 1, blocked_verified_untouched: 1,
        audit_rows_written: 1, already_clean_after_apply: 1, still_blocked: 1,
        unexpected_new_mutations: 0 });
});
