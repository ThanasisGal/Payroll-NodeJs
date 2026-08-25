'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const presentationStart = source.indexOf('const possibleLeavePresentationStates');
const presentationEnd = source.indexOf('function isCompletedSingleDayNoActionPresentation',
    presentationStart);
const suggestionFunction = source.match(/function hasAdeiaSuggestion\(row\) \{[\s\S]*?\n}/)?.[0] || '';
const presentationSandbox = {
    num: (value) => Number(value || 0),
    hasMeaningfulValue: (value) => ![null, undefined, '', '-', '0', '0.0', '0.00']
        .includes(value),
    hasAnyCardEvidence: () => false,
    pairNo: (number) => String(number).padStart(2, '0')
};
vm.runInNewContext(`${source.slice(presentationStart, presentationEnd)}\n${suggestionFunction}\n` +
    'this.helpers = { resolvePossibleLeavePresentationState, hasAdeiaSuggestion };',
presentationSandbox);

const confirmed = { adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' };
assert.equal(presentationSandbox.helpers.resolvePossibleLeavePresentationState(confirmed),
    'CONFIRMED_LEAVE');
assert.equal(presentationSandbox.helpers.hasAdeiaSuggestion(confirmed), false);
assert.equal(presentationSandbox.helpers.hasAdeiaSuggestion({ kathgoria_ergasias: 'ΕΡΓ',
    ores_ergasias: 6, cards_ores_ergasias: 0, noCardsDisplayStatus: 'ΑΔΕΙΑ' }), true);
assert.equal(presentationSandbox.helpers.hasAdeiaSuggestion({
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }), true);

const detailsContainer = { innerHTML: '' };
const modalMarkup = source.slice(source.indexOf('function showDetailsModal'),
    source.indexOf('function initModalMoveByEnter'));
const detailsSandbox = {
    document: { getElementById: (id) => id === 'detailsContainer' ? detailsContainer :
        id === 'detailsModal' ? {} : null },
    bootstrap: { Modal: function () { this.show = () => {}; } },
    setTimeout: () => {}, formatDate: String,
    renderReadOnlyTimeRows: () => '', renderEditableApologistikaRows: () => '',
    renderOrphanCardResolutionSection: () => '', renderScenarioDetailsSection: () => '',
    renderApologistikaFields: () => '', userCanReviewEdit: () => false,
    hasAdeiaSuggestion: presentationSandbox.helpers.hasAdeiaSuggestion,
    initModalMoveByEnter: () => {}, initializeOrphanResolutionPreview: () => {}
};
vm.runInNewContext(`${modalMarkup}\nthis.show = showDetailsModal;`, detailsSandbox);
detailsSandbox.show(confirmed);
assert.doesNotMatch(detailsContainer.innerHTML, /Προτείνεται έλεγχος άδειας/);
detailsSandbox.show({ kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' });
assert.equal((detailsContainer.innerHTML.match(/Προτείνεται έλεγχος άδειας/g) || []).length, 2);

const modalStart = source.indexOf('function initModalKathgoriaAdeiasTomSelect');
const modalEnd = source.indexOf('\nlet suppressLoaderUntil', modalStart);
const elements = {
    edit_kathgoria_adeias_apologistika: { dataset: {} },
    edit_kathgoria_adeias_apologistika_hidden: { value: 'ΑΔΚΑΝ',
        dataset: { presentationValue: 'ΑΔΚΑΝ' } },
    edit_adeia_apologistika: { checked: true, addEventListener(event, handler) {
        this[event] = handler;
    } },
    edit_ores_ergasias_apologistika: { value: '0.00' }
};
let tomSelect;
function TomSelect(select, options) {
    tomSelect = this;
    this.addOption = () => {};
    this.setValue = () => {};
    this.clear = () => {};
    this.change = options.onChange.bind(this);
    options.onInitialize.call(this);
    return this;
}
const modalSandbox = {
    document: { getElementById: (id) => elements[id] }, TomSelect,
    csrfToken: '', fetch: async () => ({ json: async () => [] }), console,
    hours: (value) => Number(value || 0).toFixed(2),
    isHrSelectableLeaveCategoryOption: ({ value }) => Boolean(value)
};
vm.runInNewContext(`${source.slice(modalStart, modalEnd)}\n` +
    'this.init = initModalKathgoriaAdeiasTomSelect;', modalSandbox);
modalSandbox.init({ apo_ora_01: '10:00', eos_ora_01: '16:00', ores_ergasias: 6 });
assert.equal(elements.edit_ores_ergasias_apologistika.value, '6.00');
assert.equal(elements.edit_adeia_apologistika.checked, true);
elements.edit_ores_ergasias_apologistika.value = '0.00';
tomSelect.change('ΑΔΚΑΝ');
assert.equal(elements.edit_ores_ergasias_apologistika.value, '6.00');
elements.edit_ores_ergasias_apologistika.value = '0.00';
elements.edit_adeia_apologistika.checked = true;
elements.edit_adeia_apologistika.change();
assert.equal(elements.edit_ores_ergasias_apologistika.value, '6.00');
elements.edit_ores_ergasias_apologistika.value = '3.00';
tomSelect.change('POSSIBLE_LEAVE');
assert.equal(elements.edit_ores_ergasias_apologistika.value, '3.00');

assert.equal((modalMarkup.match(/Προτείνεται έλεγχος άδειας/g) || []).length, 2);
assert.match(source, /CONFIRMED[\s\S]*text: 'ΑΔΕΙΑ'/);
assert.match(source, /DERIVED[\s\S]*PERSISTED[\s\S]*LEGACY[\s\S]*text: 'ΠΙΘΑΝΗ ΑΔΕΙΑ'/);

console.log('confirmed leave modal regression tests passed');
