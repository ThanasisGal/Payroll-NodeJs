'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const functionSource = source.slice(source.indexOf('function zeroLengthCardPairs'),
    source.indexOf('const orphanDerivedPreviewEditableFields'));
const sandbox = {
    pairNo: (value) => String(value).padStart(2, '0'),
    timeToMinutes: (value) => {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return null;
        const [hours, minutes] = value.split(':').map(Number);
        return hours * 60 + minutes;
    },
    escapeHtml: String
};
vm.runInNewContext(`${functionSource}\nthis.api = {
    zeroLengthCardPairs, renderZeroLengthCardResolutionSection
};`, sandbox);

const row = { _id: 'row-1404', cards_apo_ora_01: '14:04',
    cards_eos_ora_01: '14:04', cards_ores_ergasias: 0 };
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.zeroLengthCardPairs(row))),
    [{ pairNumber: 1, rawTime: '14:04' }]);
const html = sandbox.api.renderZeroLengthCardResolutionSection(row);
assert.match(html, /Επίλυση πραγματικής απασχόλησης/);
assert.match(html, /Τα πρωτογενή χτυπήματα δεν θα αλλάξουν/);
assert.match(html, /14:04–14:04/);
assert.match(html, /zeroLengthStart1/);
assert.match(html, /zeroLengthEnd1/);
assert.match(html, /value=""/,
    'no fabricated actual-work end time may be prefilled');
assert.match(html, /id="zeroLengthResolutionConfirm"/);
assert.match(html, /δεν διαβιβάστηκαν\/καταγράφηκαν σωστά στο ΕΡΓΑΝΗ/);

const orphanFunctionSource = source.slice(
    source.indexOf('function renderOrphanCardResolutionSection'),
    source.indexOf('function zeroLengthCardPairs')
);
const orphanSandbox = { escapeHtml: String, formatStage1DateKey: String };
vm.runInNewContext(`${orphanFunctionSource}\nthis.render = renderOrphanCardResolutionSection;`,
    orphanSandbox);
const malformedOrphanHtml = orphanSandbox.render({ ...row,
    orphan_card_resolution_preview: { orphanVisible: true, eligible: false,
        orphanType: 'ZERO_LENGTH', unresolvedPairs: [{ pairNumber: 1,
            orphanType: 'ZERO_LENGTH', knownStart: '14:04', knownEnd: '14:04',
            missingPunch: 'START' }] }
});
assert.strictEqual(malformedOrphanHtml, '');
assert.doesNotMatch(malformedOrphanHtml,
    /Απόφαση ορφανού χτυπήματος|Μόνο είσοδος|Μόνο έξοδος|Λείπει είσοδος|Λείπει έξοδος/);

const factsFunctionSource = source.slice(
    source.indexOf('function renderScenarioFactsSummary'),
    source.indexOf('function renderScenarioDetailsSection')
);
const factsSandbox = {
    escapeHtml: String,
    formatScenarioValue: (value) => typeof value === 'boolean' ? (value ? 'ΝΑΙ' : 'ΟΧΙ') : value
};
vm.runInNewContext(`${factsFunctionSource}\nthis.render = renderScenarioFactsSummary;`,
    factsSandbox);
const factsHtml = factsSandbox.render({ declared_category: 'ΕΡΓ', card_hours: 0,
    has_card_evidence: true, has_cards: false, has_zero_length_card_interval: true,
    is_holiday: false, is_locked: false });
assert.match(factsHtml, /Υπάρχουν χτυπήματα κάρτας:\s*ΝΑΙ/);
assert.match(factsHtml, /Έγκυρο μη μηδενικό διάστημα:\s*ΟΧΙ/);
assert.match(factsHtml, /Μηδενικό διάστημα κάρτας:\s*ΝΑΙ/);
assert.doesNotMatch(factsHtml, /Έχει κάρτες:\s*ΟΧΙ/);

const scenarioFunctionSource = source.slice(
    source.indexOf('function renderScenarioDetailsSection'),
    source.indexOf('function intervalTextHtml')
);
const scenarioSandbox = {
    scenarioCodeLabels: { ZERO_LENGTH_CARD_INTERVAL: 'Μηδενικό διάστημα κάρτας' },
    scenarioConfidenceLabel: () => 'Υψηλή',
    scenarioDecisionStatusLabel: () => 'Προς έλεγχο',
    scenarioReasonLabel: String,
    renderScenarioList: () => '',
    renderScenarioProposedUpdates: () => '',
    renderScenarioFactsSummary: factsSandbox.render,
    escapeHtml: String
};
vm.runInNewContext(`${scenarioFunctionSource}\nthis.render = renderScenarioDetailsSection;`,
    scenarioSandbox);
const unresolvedScenarioHtml = scenarioSandbox.render({ scenarioDecision: {
    scenario_code: 'ZERO_LENGTH_CARD_INTERVAL', confidence: 'HIGH',
    decision_status: 'PENDING_REVIEW', requires_review: true,
    reasons: ['ZERO_LENGTH_CARD_INTERVAL_FOUND'], proposed_updates: {}
}, scenarioFactsSummary: {} });
assert.match(unresolvedScenarioHtml, /ΠΡΟΣ ΕΛΕΓΧΟ/);
assert.doesNotMatch(unresolvedScenarioHtml, /Δεν απαιτείται έλεγχος/);
const approvedScenarioHtml = scenarioSandbox.render({ scenarioDecision: {
    scenario_code: 'ZERO_LENGTH_CARD_INTERVAL', confidence: 'HIGH',
    decision_status: 'CLASSIFIED_ONLY', requires_review: false,
    reasons: ['ZERO_LENGTH_CARD_INTERVAL_FOUND'], proposed_updates: {}
}, scenarioFactsSummary: {} });
assert.match(approvedScenarioHtml, /Δεν απαιτείται έλεγχος/);
assert.doesNotMatch(approvedScenarioHtml, /ΠΡΟΣ ΕΛΕΓΧΟ/);

assert.match(source, /ZERO_LENGTH_CARD_EVIDENCE[\s\S]*?Μη έγκυρο μηδενικό διάστημα κάρτας/);
assert.match(source, /Δηλώστε τις πραγματικές ώρες απασχόλησης\. Τα αρχικά χτυπήματα κάρτας θα διατηρηθούν/);
assert.match(source, /issue_code === 'ZERO_LENGTH_CARD_EVIDENCE'[\s\S]*?Επίλυση πραγματικής απασχόλησης/);
assert.match(source, /zero_length_resolution: zeroLengthResolution/);
assert.match(source, /transmission_failure_confirmed: true/);
assert.match(source, /item\.start === item\.end/);
assert.match(source, /ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION/);

console.log('zero-length employment-review UI contracts passed');
