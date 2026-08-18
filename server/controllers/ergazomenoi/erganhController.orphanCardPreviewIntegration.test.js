'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
    attachOrphanResolutionPreviews
} = require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService');

const backendRow = {
    _id: '0004-2026-06-14', team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0004', hmeromhnia: '2026-06-14T00:00:00.000Z',
    kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '14:51', eos_ora_01: '22:51',
    apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: '', ores_ergasias: 8,
    cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_apo_ora_02: '',
    cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30
};
const projected = attachOrphanResolutionPreviews({ rows: [backendRow], contextRows: [backendRow] });
const serializedRows = JSON.parse(JSON.stringify(projected));
const modalRow = serializedRows.find((row) => row._id === backendRow._id);
assert.strictEqual(modalRow.orphan_card_resolution_preview.orphanVisible, true);
assert.strictEqual(modalRow.orphan_card_resolution_preview.eligible, true);
assert.strictEqual(modalRow.orphan_card_resolution_preview.proposal.start, '14:51');
assert.strictEqual(modalRow.orphan_card_resolution_preview.proposal.end, '23:21');
const controllerSource = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
assert.match(controllerSource, /const rowsWithOrphanPreview = attachOrphanResolutionPreviews\(\{/);
assert.match(controllerSource, /attachSixthDayPresentationToRows\(\s*rowsWithOrphanPreview/);

const elements = new Map([
    ['edit_apo_ora_01_apologistika', { value: '' }],
    ['edit_eos_ora_01_apologistika', { value: '' }]
]);
const document = { querySelector: () => null, querySelectorAll: () => [],
    getElementById: (id) => elements.get(id) || null, addEventListener: () => {},
    createElement: () => ({ addEventListener: () => {}, appendChild: () => {},
        classList: { add: () => {}, toggle: () => {} }, dataset: {}, style: {} }),
    head: { appendChild: () => {} }, body: { appendChild: () => {} } };
const sandbox = { console, document, window: {}, URLSearchParams,
    fetch: async () => { throw new Error('Unexpected fetch'); },
    setTimeout: () => 0, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8'), sandbox);
const html = sandbox.renderOrphanCardResolutionSection(modalRow);
assert.match(html, /Απόφαση ορφανού χτυπήματος/);
assert.match(html, /Μόνο είσοδος/);
assert.doesNotMatch(html, />START_ONLY<|>END_ONLY</);
assert.match(html, /14:51–23:21/);
assert.match(html, /Συνολική διάρκεια διαστήματος/);
assert.doesNotMatch(html, /Gross span|orphan περίπτωση|>Flags</);
assert.strictEqual(sandbox.prefillOrphanResolutionProposal(modalRow), true);
assert.strictEqual(elements.get('edit_apo_ora_01_apologistika').value, '14:51');
assert.strictEqual(elements.get('edit_eos_ora_01_apologistika').value, '23:21');

console.log('backend projection -> serialization -> modal orphan preview integration passed');
