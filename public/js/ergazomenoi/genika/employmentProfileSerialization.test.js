'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { serializeEmploymentProfileField, initEmploymentProfileUi } = require('./employmentProfileUi');
const C = require('../../../../server/utils/ergazomenoi/employmentProfileContract');
const field = (name, extra = {}) => ({ name, tagName: 'INPUT', type: 'checkbox', value: '', checked: false,
    disabled: false, hasAttribute: key => key === 'data-approved-arrangement-control', ...extra });
// Run the actual collection loops in both serializers, including fallback behavior.
function collect(mode, inputs) {
    const code = fs.readFileSync(__dirname + '/' + (mode === 'add' ? 'getFieldValues' : 'putFieldValues') + '.js', 'utf8');
    const start = code.indexOf('        const formData = {}');
    const end = code.indexOf('// ✅ CONVERT PDFs TO BASE64', start);
    const body = code.slice(start, end);
    return vm.runInNewContext(`(() => { ${body}\nreturn formData; })()`, {
        document: { querySelectorAll: () => [{ querySelectorAll: () => inputs }] },
        window: { serializeEmploymentProfileField }
    });
}
for (const mode of ['add', 'edit']) {
    test(`${mode}: weekday checkbox group sends unique integers or explicit []`, () => {
        const days = [1, 2, 7].map(day => field(C.DAYS, { value: String(day) }));
        assert.deepEqual(JSON.parse(JSON.stringify(collect(mode, days)))[C.DAYS], []);
        days[0].checked = days[2].checked = true;
        assert.deepEqual(JSON.parse(JSON.stringify(collect(mode, [...days, ...days])))[C.DAYS], [1, 7]);
    });
    test(`${mode}: master false is explicit; disabled dependent values are omitted`, () => {
        const master = field(C.ENABLED, { hasAttribute: () => false });
        const disabled = field(C.DAYS, { disabled: true, value: '7', checked: true });
        const result = collect(mode, [master, disabled]);
        assert.equal(result[C.ENABLED], false); assert.equal(Object.hasOwn(result, C.DAYS), false);
    });
    test(`${mode}: explicit optional blank is serialized, old forms do not invent fields`, () => {
        assert.deepEqual(JSON.parse(JSON.stringify(collect(mode, []))), {});
        const input = field(C.UNTIL, { type: 'date', value: '' });
        assert.equal(collect(mode, [input])[C.UNTIL], null);
    });
}
test('unchanged legacy duration is submitted on Add and Edit for category validation', () => {
    const duration = field('dialleima_se_lepta', { type: 'number', defaultValue: '45', value: '45', hasAttribute: () => false });
    assert.equal(collect('edit', [duration])[duration.name], 45);
    assert.equal(collect('add', [duration])[duration.name], 45);
    duration.value = '50'; assert.equal(collect('edit', [duration])[duration.name], 50);
    duration.value = '30'; assert.equal(collect('edit', [duration])[duration.name], 30);
});
test('temporary master toggle never changes stored/input values; explicitly saved disabled is ineffective', () => {
    const listeners = {};
    const master = { checked: true, addEventListener: (name, fn) => { listeners[name] = fn; } };
    const type = { value: 'APPROVED_LEAVE_INTERRUPTION', selectedOptions: [{ dataset: { leaveCategory: 'true' } }], addEventListener() {} };
    const category = { value: 'existing-category' }, day = { checked: true, value: '7' }, label = {};
    const ids = { [C.ENABLED]: master, [C.TYPE]: type, [C.CATEGORY]: category, ['label-' + C.ENABLED]: label };
    initEmploymentProfileUi({ getElementById: name => ids[name], querySelectorAll: () => [type, category, day] });
    master.checked = false; listeners.change();
    assert.equal(category.value, 'existing-category'); assert.equal(day.checked, true);
    master.checked = true; listeners.change(); assert.equal(day.disabled, false); assert.equal(category.value, 'existing-category');
    const snapshot = require('../../../../server/utils/ergazomenoi/employmentProfileHistory').buildCompleteProfileSnapshot({
        input: { [C.ENABLED]: false }, current: { [C.ENABLED]: true, [C.TYPE]: type.value, [C.CATEGORY]: category.value,
            [C.FROM]: '2026-09-01', [C.START]: '12:00', [C.END]: '13:00' }, effectiveFrom: '2026-09-01' });
    assert.equal(snapshot[C.TYPE], type.value); assert.equal(snapshot[C.CATEGORY], category.value);
    assert.equal(require('../../../../server/utils/ergazomenoi/employmentProfileHistory').resolveEmploymentProfileFactsForDate(
        '2026-09-07', [snapshot], { scheduledWorkingDay: true }).arrangementEffective, false);
});
