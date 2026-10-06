'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { buildLegacyEmploymentTypeAliasFalsePositiveFixtures } =
    require('./fixtures/legacyEmploymentTypeAliasFalsePositiveFixtures');
const { RESOLUTION_ANALYSIS_VERSION, RESOLUTION_CLASSES, REFERENCE_CLASSES,
    buildEmployeeHistoryResolutionAnalysis, analyzeCanonicalLegacyAliasResolution,
    canonicalSourceStateFingerprint, buildUniqueSafeRepairStateFingerprint,
    buildUniqueSafeRepairResolutionAnalysis, buildUniqueSafeRepairPublicResolution,
    buildMultipleSafeResolutionStateFingerprint, buildMultipleSafeResolutionAnalysis,
    buildMultipleSafePublicResolution, normalizeUniqueSafeRepairConfirmation,
    buildBusinessFactResolutionStateFingerprint, buildBusinessFactResolutionAnalysis,
    buildBusinessFactPublicResolution, validatePublicFactQuestions,
    normalizeEmployeeHistoryResolutionConfirmation,
    normalizeMultipleSafeResolutionConfirmation,
    normalizeBusinessFactResolutionConfirmation } =
    require('./employeeHistoryResolutionAnalysisService');
const { planEmployeeHistoryUniqueSafeRepair } =
    require('./employeeHistoryUniqueSafeRepairPlannerService');
const { shapeALifecycleFixture } =
    require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures');
const { realStartOfFourDayProfileFixture } =
    require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const { planEmployeeHistoryMultipleSafeResolution } =
    require('./employeeHistoryMultipleSafeResolutionPlannerService');
const { departureAndHistoricalPayFactFixture } =
    require('./fixtures/businessFactEmployeeHistoryResolutionFixtures');
const { planEmployeeHistoryBusinessFactResolution } =
    require('./employeeHistoryBusinessFactResolutionPlannerService');

test('pure resolution analysis represents every future class with a deterministic versioned fingerprint', () => {
    for (const resolutionClass of Object.values(RESOLUTION_CLASSES)) {
        const input = { resolutionClass, reason: `SYNTHETIC_${resolutionClass}`,
            candidateBusinessPlans: [{ id: 'BUSINESS_OPTION', businessMeaning: 'SYNTHETIC' }],
            missingBusinessFacts: [], referenceClass: REFERENCE_CLASSES.NO_REFERENCES,
            hypotheticalCanonicalResult: { status: 'CLEAN', blocksOrdinaryMaintenance: false } };
        const first = buildEmployeeHistoryResolutionAnalysis(input);
        const second = buildEmployeeHistoryResolutionAnalysis(input);
        assert.equal(first.version, RESOLUTION_ANALYSIS_VERSION);
        assert.equal(first.fingerprint, second.fingerprint);
        assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
    }
});

test('source-state fingerprint is deterministic and changes with canonical evidence', () => {
    const fixture = buildLegacyEmploymentTypeAliasFalsePositiveFixtures()[0];
    const first = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.historyRows });
    const replay = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.historyRows });
    const changed = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee,
        historyRows: fixture.historyRows.map((row, index) => index
            ? { ...row, _id: `${row._id}-changed` } : row) });
    assert.equal(canonicalSourceStateFingerprint(first), canonicalSourceStateFingerprint(replay));
    assert.notEqual(canonicalSourceStateFingerprint(first), canonicalSourceStateFingerprint(changed));
});

test('business choices cannot expose physical history-row identities', () => {
    assert.throws(() => buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN,
        reason: 'SYNTHETIC',
        candidateBusinessPlans: [{ id: 'BAD_OPTION', historyId: 'technical-row-id' }]
    }), /cannot expose physical history-row identities/);
});

test('five alias-normalization fixtures describe a non-blocking false positive without mutation', () => {
    for (const fixture of buildLegacyEmploymentTypeAliasFalsePositiveFixtures()) {
        const canonicalResult = canonicalizeEmployeeHistory({ scope: fixture.scope,
            currentEmployee: fixture.currentEmployee, historyRows: fixture.historyRows });
        const analysis = analyzeCanonicalLegacyAliasResolution({ canonicalResult,
            referenceClass: REFERENCE_CLASSES.NO_REFERENCES });
        assert.equal(analysis.resolutionClass,
            RESOLUTION_CLASSES.FALSE_POSITIVE_OR_ALREADY_RESOLVABLE, fixture.name);
        assert.equal(analysis.referenceClass, REFERENCE_CLASSES.NO_REFERENCES, fixture.name);
        assert.match(analysis.sourceStateFingerprint, /^[a-f0-9]{64}$/, fixture.name);
        assert.deepEqual(analysis.missingBusinessFacts, [], fixture.name);
        assert.deepEqual(analysis.hypotheticalCanonicalResult, {
            blocksOrdinaryMaintenance: false,
            reason: 'CANONICAL_CLEAN',
            status: 'CLEAN'
        }, fixture.name);
    }
});

test('automatic alias resolution fails closed for every non-empty reference class', () => {
    const fixture = buildLegacyEmploymentTypeAliasFalsePositiveFixtures()[0];
    const canonicalResult = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.historyRows });
    for (const referenceClass of [REFERENCE_CLASSES.PROVENANCE_ONLY,
        REFERENCE_CLASSES.LIVE_REFERENCE, REFERENCE_CLASSES.UNKNOWN_REFERENCE]) {
        assert.equal(analyzeCanonicalLegacyAliasResolution({ canonicalResult, referenceClass }), null);
    }
});

test('unique-safe analysis and public contract are deterministic and contain no row identity', () => {
    const fixture = shapeALifecycleFixture();
    const repairPlan = planEmployeeHistoryUniqueSafeRepair(fixture);
    const request = { effectiveFrom: '2026-05-25', input: { krathsh_01: '0115' } };
    const fingerprint = buildUniqueSafeRepairStateFingerprint({
        scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows,
        protectedReferenceSummary: fixture.protectedReferenceSummary,
        repairPlan, normalizedSaveRequest: request
    });
    const repeat = buildUniqueSafeRepairStateFingerprint({
        scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows,
        protectedReferenceSummary: fixture.protectedReferenceSummary,
        repairPlan, normalizedSaveRequest: request
    });
    assert.equal(fingerprint, repeat);
    const analysis = buildUniqueSafeRepairResolutionAnalysis({ repairPlan,
        sourceStateFingerprint: fingerprint });
    assert.equal(analysis.resolutionClass, RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN);
    assert.equal(analysis.action, 'APPLY_UNIQUE_SAFE_PLAN');
    const resolution = buildUniqueSafeRepairPublicResolution({ analysis, fingerprint });
    assert.deepEqual(Object.keys(resolution).sort(),
        ['explanation', 'fingerprint', 'kind', 'options', 'title', 'version']);
    assert.equal(JSON.stringify(resolution).includes('shape-a-'), false);
    assert.equal(JSON.stringify(resolution).includes('historyId'), false);
    assert.equal(JSON.stringify(resolution).includes('_id'), false);
});

test('confirmation fingerprint changes for employee, history, references, plan or save request drift', () => {
    const fixture = shapeALifecycleFixture();
    const repairPlan = planEmployeeHistoryUniqueSafeRepair(fixture);
    const base = { scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows,
        protectedReferenceSummary: fixture.protectedReferenceSummary,
        repairPlan, normalizedSaveRequest: { effectiveFrom: '2026-05-25' } };
    const original = buildUniqueSafeRepairStateFingerprint(base);
    const variants = [
        { ...base, currentEmployee: { ...base.currentEmployee, updatedAt: 'changed' } },
        { ...base, completeHistoryRows: base.completeHistoryRows.map((row, index) =>
            index ? row : { ...row, updatedAt: 'changed' }) },
        { ...base, protectedReferenceSummary: { ...base.protectedReferenceSummary,
            'shape-a-profile': [] } },
        { ...base, repairPlan: { ...base.repairPlan, planFingerprint: 'changed' } },
        { ...base, normalizedSaveRequest: { effectiveFrom: '2026-05-26' } }
    ];
    for (const variant of variants) {
        assert.notEqual(buildUniqueSafeRepairStateFingerprint(variant), original);
    }
});

test('confirmation input accepts only the exact choice and sha256 fingerprint', () => {
    const fingerprint = 'a'.repeat(64);
    assert.deepEqual(normalizeUniqueSafeRepairConfirmation({
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint
    }), { choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint });
    for (const invalid of [
        {},
        { choiceId: 'DELETE_ROW', fingerprint },
        { choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: 'bad' },
        { choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint, historyId: 'forged' },
        ['APPLY_UNIQUE_SAFE_PLAN', fingerprint]
    ]) assert.throws(() => normalizeUniqueSafeRepairConfirmation(invalid),
        error => error.code === 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST');
});

test('multiple-safe fingerprint covers employee, history, references, ambiguity, options and Save', () => {
    const fixture = realStartOfFourDayProfileFixture();
    const canonicalResult = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.completeHistoryRows });
    const multiplePlan = planEmployeeHistoryMultipleSafeResolution(fixture);
    const base = { scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows,
        protectedReferenceSummary: fixture.protectedReferenceSummary,
        canonicalResult, problemScope: multiplePlan.problemScope, multiplePlan,
        normalizedSaveRequest: { effectiveFrom: '2026-07-23' } };
    const original = buildMultipleSafeResolutionStateFingerprint(base);
    assert.equal(original, buildMultipleSafeResolutionStateFingerprint(base));
    for (const variant of [
        { ...base, currentEmployee: { ...base.currentEmployee, updatedAt: 'changed' } },
        { ...base, completeHistoryRows: base.completeHistoryRows.map((row, index) =>
            index ? row : { ...row, updatedAt: 'changed' }) },
        { ...base, protectedReferenceSummary: { ...base.protectedReferenceSummary,
            'm4-full-time': [] } },
        { ...base, canonicalResult: { ...base.canonicalResult,
            diagnostics: { ...base.canonicalResult.diagnostics, changed: true } } },
        { ...base, multiplePlan: { ...base.multiplePlan,
            optionSetFingerprint: 'changed' } },
        { ...base, normalizedSaveRequest: { effectiveFrom: '2026-07-24' } }
    ]) assert.notEqual(buildMultipleSafeResolutionStateFingerprint(variant), original);
});

test('multiple-safe public contract exposes only business options and server date bounds', () => {
    const fixture = realStartOfFourDayProfileFixture();
    const multiplePlan = planEmployeeHistoryMultipleSafeResolution(fixture);
    const fingerprint = 'b'.repeat(64);
    const analysis = buildMultipleSafeResolutionAnalysis({ multiplePlan,
        sourceStateFingerprint: fingerprint });
    const publicResolution = buildMultipleSafePublicResolution({ analysis, fingerprint });
    assert.equal(publicResolution.kind, 'GUIDED_BUSINESS_CHOICE');
    assert.deepEqual(publicResolution.options[2].inputs, [{
        id: 'effectiveDate', type: 'date', label: 'Ημερομηνία έναρξης',
        required: true, min: '2026-06-28', max: '2026-07-22'
    }]);
    for (const forbidden of ['historyId', '_id', 'aa_eggrafhs', 'survivorId',
        'deleteId', 'patch']) assert.equal(JSON.stringify(publicResolution).includes(forbidden), false);
});

test('generic confirmation envelope has a strict top-level and answer allowlist', () => {
    const fingerprint = 'c'.repeat(64);
    assert.deepEqual(normalizeEmployeeHistoryResolutionConfirmation({
        choiceId: 'BUSINESS_CHOICE', fingerprint
    }), { choiceId: 'BUSINESS_CHOICE', fingerprint });
    assert.deepEqual(normalizeEmployeeHistoryResolutionConfirmation({
        choiceId: 'BUSINESS_CHOICE', fingerprint,
        answers: { effectiveDate: '2026-07-01' }
    }), { choiceId: 'BUSINESS_CHOICE', fingerprint,
        answers: { effectiveDate: '2026-07-01' } });
    for (const invalid of [
        { choiceId: 'BUSINESS_CHOICE', fingerprint, historyId: 'x' },
        { choiceId: 'BUSINESS_CHOICE', fingerprint, answers: { historyId: 'x' } },
        { choiceId: 'bad-choice', fingerprint }
    ]) assert.throws(() => normalizeEmployeeHistoryResolutionConfirmation(invalid),
        error => error.code === 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST');
});

test('selected option schema controls required and forbidden answers server-side', () => {
    const fixture = realStartOfFourDayProfileFixture();
    const options = planEmployeeHistoryMultipleSafeResolution(fixture).businessOptions;
    const fingerprint = 'd'.repeat(64);
    assert.deepEqual(normalizeMultipleSafeResolutionConfirmation({
        choiceId: 'FOUR_DAY_PROFILE_FROM_HIRE', fingerprint
    }, options), { choiceId: 'FOUR_DAY_PROFILE_FROM_HIRE', fingerprint });
    assert.deepEqual(normalizeMultipleSafeResolutionConfirmation({
        choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', fingerprint,
        answers: { effectiveDate: '2026-07-05' }
    }, options), { choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', fingerprint,
        answers: { effectiveDate: '2026-07-05' } });
    for (const invalid of [
        { choiceId: 'UNKNOWN', fingerprint },
        { choiceId: 'FOUR_DAY_PROFILE_FROM_HIRE', fingerprint, answers: {} },
        { choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', fingerprint,
            answers: { effectiveDate: '2026-07-23' } },
        { choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', fingerprint,
            answers: { effectiveDate: '2026-07-05T00:00:00.000Z' } },
        { choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE', fingerprint,
            answers: { effectiveDate: '2026-07-05T03:00:00+03:00' } }
    ]) assert.throws(() => normalizeMultipleSafeResolutionConfirmation(invalid, options));
});

test('business-fact fingerprint binds state, references, exact questions, rules and original Save', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const canonicalResult = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.completeHistoryRows });
    const businessFactPlan = planEmployeeHistoryBusinessFactResolution(fixture);
    const base = { scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows,
        protectedReferenceSummary: fixture.protectedReferenceSummary,
        canonicalResult, problemScope: businessFactPlan.problemScope, businessFactPlan,
        normalizedSaveRequest: { effectiveFrom: '2026-05-01' } };
    const original = buildBusinessFactResolutionStateFingerprint(base);
    assert.equal(original, buildBusinessFactResolutionStateFingerprint(base));
    for (const variant of [
        { ...base, currentEmployee: { ...base.currentEmployee, updatedAt: 'changed' } },
        { ...base, completeHistoryRows: base.completeHistoryRows.map((row, index) =>
            index ? row : { ...row, updatedAt: 'changed' }) },
        { ...base, protectedReferenceSummary: { ...base.protectedReferenceSummary,
            [String(base.completeHistoryRows[0]._id)]: [{ collection: 'changed' }] } },
        { ...base, businessFactPlan: { ...base.businessFactPlan,
            questionSetFingerprint: 'changed' } },
        { ...base, normalizedSaveRequest: { effectiveFrom: '2026-05-02' } }
    ]) assert.notEqual(buildBusinessFactResolutionStateFingerprint(variant), original);
});

test('public business-fact contract exposes only controlled questions without physical identities', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const businessFactPlan = planEmployeeHistoryBusinessFactResolution(fixture);
    const fingerprint = 'e'.repeat(64);
    const analysis = buildBusinessFactResolutionAnalysis({ businessFactPlan,
        sourceStateFingerprint: fingerprint });
    const resolution = buildBusinessFactPublicResolution({ analysis, fingerprint });
    assert.equal(resolution.kind, 'BUSINESS_FACT_COLLECTION');
    assert.deepEqual(resolution.questions.map(question => question.id), [
        'departureOutcome', 'departureDate', 'payEffectiveOutcome', 'payEffectiveDate'
    ]);
    assert.deepEqual(resolution.questions[1].condition, {
        questionId: 'departureOutcome', equals: 'DEPARTED_ON_OTHER_DATE'
    });
    for (const forbidden of ['historyId', '_id', 'aa_eggrafhs', 'survivorId',
        'deleteId', 'patch']) assert.equal(JSON.stringify(resolution).includes(forbidden), false);
});

test('business-fact confirmation accepts exactly the currently required answer keys', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const questions = planEmployeeHistoryBusinessFactResolution(fixture).factQuestions;
    const fingerprint = 'f'.repeat(64);
    assert.deepEqual(normalizeBusinessFactResolutionConfirmation({ fingerprint, answers: {
        departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: '2026-08-15',
        payEffectiveOutcome: 'PAY_APPLIED_FROM_OTHER_DATE', payEffectiveDate: '2026-07-01'
    } }, questions), { fingerprint, answers: {
        departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: '2026-08-15',
        payEffectiveOutcome: 'PAY_APPLIED_FROM_OTHER_DATE', payEffectiveDate: '2026-07-01'
    } });
    assert.deepEqual(normalizeBusinessFactResolutionConfirmation({ fingerprint, answers: {
        departureOutcome: 'NO_DEPARTURE', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE'
    } }, questions), { fingerprint, answers: {
        departureOutcome: 'NO_DEPARTURE', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE'
    } });
    for (const invalid of [
        { fingerprint, answers: { departureOutcome: 'NO_DEPARTURE' } },
        { fingerprint, answers: { departureOutcome: 'UNKNOWN',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' } },
        { fingerprint, answers: { departureOutcome: 'NO_DEPARTURE', departureDate: '2026-08-15',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' } },
        { fingerprint, answers: { departureOutcome: 'DEPARTED_ON_OTHER_DATE',
            departureDate: '2026-02-30', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' } },
        { fingerprint, answers: { departureOutcome: 'NO_DEPARTURE',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE', historyId: 'forged' } },
        { fingerprint, answers: { departureOutcome: 'NO_DEPARTURE',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' }, patch: {} }
    ]) assert.throws(() => normalizeBusinessFactResolutionConfirmation(invalid, questions));
});

test('business-fact question schema rejects arbitrary form definitions', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const questions = planEmployeeHistoryBusinessFactResolution(fixture).factQuestions;
    assert.deepEqual(validatePublicFactQuestions(questions), questions);
    for (const invalid of [
        questions.map((question, index) => index ? question : { ...question, historyId: 'x' }),
        questions.map((question, index) => index === 1 ? { ...question, type: 'text' } : question),
        questions.map((question, index) => index === 1
            ? { ...question, condition: { questionId: 'other', equals: 'x' } } : question)
    ]) assert.throws(() => validatePublicFactQuestions(invalid));
});
