'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { buildLegacyEmploymentTypeAliasFalsePositiveFixtures } =
    require('./fixtures/legacyEmploymentTypeAliasFalsePositiveFixtures');
const { RESOLUTION_ANALYSIS_VERSION, RESOLUTION_CLASSES, REFERENCE_CLASSES,
    buildEmployeeHistoryResolutionAnalysis, analyzeCanonicalLegacyAliasResolution,
    canonicalSourceStateFingerprint } =
    require('./employeeHistoryResolutionAnalysisService');

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
