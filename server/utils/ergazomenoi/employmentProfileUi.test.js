'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ejs = require('ejs');
const C = require('./employmentProfileContract');
const { getEmploymentProfileUiContext } = require('./employmentProfileUiContext');
const { initEmploymentProfileUi } = require('../../../public/js/ergazomenoi/genika/employmentProfileUi');
const checkpoint = '3b44e851f30b0ff01f60455638e224cd3d4c616c';
const base = 'views/ergazomenoi/ergazomenoi/';
const partial = mode => `${base}partials/${mode}/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs`;
const categories = [{ kodikos: 'fixture-only', perigrafh: 'Δοκιμαστική κατηγορία' }];
async function context() {
    const model = { find(query) {
        assert(query.$nor); return { select() { return this; }, sort() { return this; }, lean: async () => categories };
    } };
    return getEmploymentProfileUiContext(model);
}
async function render(mode, rec = {}) {
    return ejs.render(fs.readFileSync(partial(mode), 'utf8'), { rec, companyInUse: '', userTeam: '', employmentProfileUi: await context() }, { filename: path.resolve(partial(mode)) });
}
const input = (html, id) => html.match(new RegExp(`<(?:input|select)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
for (const mode of ['add', 'edit']) {
    test(`${mode}: optional fields render within existing employment accordion and in prescribed order`, async () => {
        const html = await render(mode);
        const original = execFileSync('git', ['show', `${checkpoint}:${partial(mode)}`], { encoding: 'utf8' });
        assert.equal((html.match(/class="accordion-item/g) || []).length, (original.match(/class="accordion-item/g) || []).length);
        assert(!html.includes('class="card'));
        for (const field of [...C.ARRANGEMENT_FIELDS.filter(f => f !== C.TYPE_VERSION), ...C.BREAK_PAIRS.flat()]) {
            assert(html.includes(`name="${field}"`), field);
            assert(html.indexOf(`name="${field}"`) > html.indexOf('accordion-body'));
        }
        const order = ['dialleima_se_lepta', 'dialleima_apo_ora_01', 'dialleima_apo_ora_03', 'typos_orarioy',
            'pshfiakh_organosh', 'karta_ergasias', C.ENABLED, 'apasxolhsh_gia_proth_fora'];
        for (let i = 1; i < order.length; i++) assert(html.indexOf(`name="${order[i]}"`) > html.indexOf(`name="${order[i - 1]}"`));
        assert(!input(html, C.ENABLED).includes('checked'));
        assert.equal((html.match(/id="approved-arrangement-day-[1-7]"/g) || []).length, 7);
        for (let day = 1; day <= 7; day++) {
            const checkbox = input(html, `approved-arrangement-day-${day}`);
            assert(checkbox.includes('class="form-check-input custom-checkbox checkbox-class m-0"'));
            assert(checkbox.includes(`value="${day}"`));
            assert(checkbox.includes(`name="${C.DAYS}"`));
            assert(!checkbox.includes('checked'));
        }

        for (const field of C.BREAK_PAIRS.flat()) {
            assert(input(html, field).includes('value=""')); assert(!input(html, field).includes('required'));
        }
        for (const field of [C.TYPE, C.FROM, C.UNTIL, C.START, C.END, C.CATEGORY]) assert(input(html, field).includes('disabled'));
        assert(!html.includes('undefined'));
        assert(fs.readFileSync(`${base}${mode}.ejs`, 'utf8').includes("script('ergazomenoi/genika/employmentProfileUi')"));
    });
}
test('Edit displays stored arrangement, exact dates/times/days/category and legacy duration without mutation', async () => {
    const rec = { [C.ENABLED]: true, [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION', [C.FROM]: new Date('2026-09-01'),
        [C.UNTIL]: '2026-09-30', [C.START]: '13:00', [C.END]: '14:00', [C.DAYS]: [1, 7],
        [C.CATEGORY]: 'fixture-only', dialleima_se_lepta: 45, dialleima_apo_ora_01: '23:50', dialleima_eos_ora_01: '00:20' };
    const before = structuredClone(rec); const html = await render('edit', rec);
    for (const [field, value] of [[C.FROM, '2026-09-01'], [C.UNTIL, '2026-09-30'], [C.START, '13:00'], [C.END, '14:00'],
        ['dialleima_se_lepta', '45'], ['dialleima_apo_ora_01', '23:50']]) assert(input(html, field).includes(`value="${value}"`));
    assert(input(html, C.ENABLED).includes('checked')); assert(!input(html, C.CATEGORY).includes('disabled'));
    assert(input(html, 'approved-arrangement-day-1').includes('checked'));
    assert(input(html, 'approved-arrangement-day-7').includes('checked'));
    assert(!input(html, 'approved-arrangement-day-2').includes('checked'));
    assert.deepEqual(rec, before);
    assert(input(await render('edit', { dialleima_se_lepta: 0 }), 'dialleima_se_lepta').includes('value="0"'));
});
test('type labels and identifiers come from the central contract', async () => {
    const ui = await context(); assert.deepEqual(ui.types.map(t => t.value), Object.keys(C.ARRANGEMENT_TYPES));
    assert.deepEqual(ui.types.map(t => t.label), ['Εγκεκριμένη Άδεια / Ωροάδεια', 'Διακοπή με Αναπλήρωση Χρόνου', 'Άλλη Εγκεκριμένη Ρύθμιση']);
});
function element(value = '') {
    return { value, checked: false, disabled: false, dataset: {}, listeners: {}, textContent: '',
        addEventListener(event, callback) { this.listeners[event] = callback; }, setCustomValidity(message) { this.validation = message; } };
}
test('common handler toggles controls and category without clearing any values or day choices', () => {
    const ids = Object.fromEntries([C.ENABLED, C.TYPE, C.CATEGORY, C.FROM, 'day', 'dialleima_se_lepta', `label-${C.ENABLED}`].map(k => [k, element(k)]));
    const controls = [ids[C.TYPE], ids[C.CATEGORY], ids[C.FROM], ids.day];
    ids[C.TYPE].selectedOptions = [{ dataset: { leaveCategory: 'true' } }]; ids.day.checked = true;
    ids.dialleima_se_lepta.value = '45';
    initEmploymentProfileUi({ getElementById: id => ids[id], querySelectorAll: () => controls });
    assert(controls.every(c => c.disabled)); assert.equal(ids.dialleima_se_lepta.value, '45');
    assert.equal(ids.dialleima_se_lepta.validation, undefined);
    ids[C.ENABLED].checked = true; ids[C.ENABLED].listeners.change(); assert(controls.every(c => !c.disabled));
    ids[C.TYPE].selectedOptions[0].dataset.leaveCategory = 'false'; ids[C.TYPE].listeners.change(); assert(ids[C.CATEGORY].disabled);
    ids[C.ENABLED].checked = false; ids[C.ENABLED].listeners.change();
    ids[C.ENABLED].checked = true; ids[C.ENABLED].listeners.change();
    for (const [key, control] of Object.entries(ids)) if (key !== 'dialleima_se_lepta') assert.equal(control.value, key);
    assert(ids.day.checked);
    for (const n of ['0', '15', '30', '14', '45']) {
        ids.dialleima_se_lepta.value = n; ids.dialleima_se_lepta.listeners.input();
        assert.equal(Boolean(ids.dialleima_se_lepta.validation), ['14', '45'].includes(n));
    }
});
test('controller changes are limited to import and two GET render context properties', () => {
    const file = 'server/controllers/ergazomenoi/ergazomenoiController.js';
    const baseline = execFileSync('git', ['show', `${checkpoint}:${file}`], { encoding: 'utf8' });
    const current = fs.readFileSync(file, 'utf8');
    assert.equal(current.replace("const { getEmploymentProfileUiContext } = require('../../utils/ergazomenoi/employmentProfileUiContext');\n", '')
        .replaceAll('\n                employmentProfileUi: await getEmploymentProfileUiContext(),', '').replaceAll('\r', ''), baseline.replaceAll('\r', ''));
    const allowed = new Set([
        file,
        `${base}add.ejs`, `${base}edit.ejs`, partial('add'), partial('edit'),
        `${base}partials/employmentProfileBreakRows.ejs`,
        `${base}partials/employmentProfileArrangementRows.ejs`,
        'public/js/ergazomenoi/genika/employmentProfileUi.js',
        'server/utils/ergazomenoi/employmentProfileUiContext.js',
        'server/utils/ergazomenoi/employmentProfileUi.test.js'
    ]);
    const changed = [
        ...execFileSync('git', ['diff', '--name-only', '-z', checkpoint], { encoding: 'utf8' }).split('\0'),
        ...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0')
    ].filter(Boolean);
    for (const changedFile of changed) assert(allowed.has(changedFile), `Outside approved UI slice: ${changedFile}`);
});
