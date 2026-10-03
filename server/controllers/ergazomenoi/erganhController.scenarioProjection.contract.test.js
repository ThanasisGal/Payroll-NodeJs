const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    buildApasxoliseisScenarioFacts
} = require('../../services/ergazomenoi/apasxoliseisScenarioFactsService');
const {
    matchApasxoliseisScenarioFacts
} = require('../../services/ergazomenoi/apasxoliseisScenarioMatcherService');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function getControllerMethodSource(methodName, nextMethodName) {
    const start = source.indexOf(`static ${methodName}`);
    const end = source.indexOf(`static ${nextMethodName}`, start + 1);

    assert.ok(start >= 0, `missing controller method ${methodName}`);
    assert.ok(end > start, `missing controller method boundary ${nextMethodName}`);

    return source.slice(start, end);
}

function assertScenarioProjectionFields(methodSource, methodName) {
    const findStart = methodSource.indexOf('ProdhlomenaOrariaModel.find(filter)');
    const selectEnd = methodSource.indexOf(
        '.sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })',
        findStart
    );

    assert.ok(findStart >= 0 && selectEnd > findStart, `missing projection in ${methodName}`);

    const projection = methodSource.slice(findStart, selectEnd);

    for (const field of [
        'kathgoria_ergasias_apologistika',
        'ores_ergasias_apologistika',
        'ores_pragmatikhs_ergasias_apologistika',
        'compensation_breakdown_apologistika'
    ]) {
        assert.ok(
            new RegExp(`(?:^|[^A-Za-z0-9_])${field}(?:$|[^A-Za-z0-9_])`).test(
                projection
            ),
            `${methodName} projection is missing ${field}`
        );
    }
}

const policyPreviewSource = getControllerMethodSource(
    'getProdhlomenaOrariaPolicyPreview',
    'getProdhlomenaOrariaPolicyPreviewApprovals'
);
const scenarioClassificationSource = getControllerMethodSource(
    'getProdhlomenaOrariaScenarioClassifications',
    'exportProdhlomenaOrariaReviewExcel'
);

assertScenarioProjectionFields(
    policyPreviewSource,
    'getProdhlomenaOrariaPolicyPreview'
);

assert.match(policyPreviewSource, /reusableApprovals: reusableDecisionRules/);
const approvalCreateSource = getControllerMethodSource(
    'createProdhlomenaOrariaPolicyPreviewApproval',
    'revokeProdhlomenaOrariaPolicyPreviewApproval'
);
assert.match(approvalCreateSource, /requestedDecisionGrain === 'ATOMIC_LINKED_SET'/);
assert.match(approvalCreateSource, /buildAtomicRepoTransferPolicyPreviewProjection\(\{/);
assert.match(approvalCreateSource, /authoritativeAtomicGroup/);
assert.doesNotMatch(approvalCreateSource, /buildAtomicReusableCriteriaV5|fingerprint/);
assertScenarioProjectionFields(
    scenarioClassificationSource,
    'getProdhlomenaOrariaScenarioClassifications'
);
assert.match(scenarioClassificationSource,
    /(?:^|[^A-Za-z0-9_])zero_length_card_resolution(?:$|[^A-Za-z0-9_])/,
    'scenario classification projection must select zero_length_card_resolution');
assert.match(
    scenarioClassificationSource,
    /has_card_evidence:\s*facts\.cards\.hasAnyCardEvidence/
);
assert.doesNotMatch(scenarioClassificationSource, /has_any_card_evidence:/);

const zeroLengthFacts = buildApasxoliseisScenarioFacts({
    hmeromhnia: '2026-08-03',
    cards_apo_ora_01: '14:04',
    cards_eos_ora_01: '14:04',
    cards_ores_ergasias: 0
});
const zeroLengthFactsSummary = {
    has_card_evidence: zeroLengthFacts.cards.hasAnyCardEvidence,
    has_cards: zeroLengthFacts.cards.hasCards,
    has_zero_length_card_interval: zeroLengthFacts.cards.hasZeroLengthCardInterval
};
assert.deepStrictEqual(zeroLengthFactsSummary, {
    has_card_evidence: true,
    has_cards: false,
    has_zero_length_card_interval: true
});

const approvedZeroLengthFacts = buildApasxoliseisScenarioFacts({
    hmeromhnia: '2026-08-03',
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 4,
    cards_apo_ora_01: '14:04', cards_eos_ora_01: '14:04', cards_ores_ergasias: 0,
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    apo_ora_01_apologistika: '10:00', eos_ora_01_apologistika: '14:04',
    ores_ergasias_apologistika: 244 / 60,
    ores_pragmatikhs_ergasias_apologistika: 244 / 60,
    apologistiko_biblio: true,
    zero_length_card_resolution: {
        status: 'HR_APPROVED',
        policy_version: 'zero-length-card-work:v1',
        resolution_kind: 'ACTUAL_WORK_ERGANI_TRANSMISSION_FAILURE',
        affected_pairs: [1],
        approved_intervals: [{ pairNumber: 1, start: '10:00', end: '14:04' }],
        raw_cards_preserved: true,
        transmission_failure_confirmed: true
    }
});
const approvedZeroLengthDecision = matchApasxoliseisScenarioFacts(
    approvedZeroLengthFacts);
assert.strictEqual(approvedZeroLengthFacts.review.zeroLengthResolutionApproved, true);
assert.strictEqual(approvedZeroLengthDecision.scenario_code, 'ZERO_LENGTH_CARD_INTERVAL');
assert.strictEqual(approvedZeroLengthDecision.requires_review, false);
assert.strictEqual(approvedZeroLengthDecision.decision_status, 'CLASSIFIED_ONLY');

console.log('employment review scenario projection controller contract passed');
