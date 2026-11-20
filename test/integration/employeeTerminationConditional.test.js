'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
    '../../public/js/ergazomenoi/genika/logos_peratoshs.js'), 'utf8');

function fixture({ departure = '', contractEnd = '', ready = true } = {}) {
    const docListeners = new Map(), controls = new Map();
    const control = (id, value = '') => {
        const listeners = new Map();
        const element = { id, value, disabled: false, style: { display: '' },
            addEventListener(type, handler) {
                const list = listeners.get(type) || []; list.push(handler); listeners.set(type, list);
            },
            emit(type = 'input') {
                for (const cb of listeners.get(type) || []) cb({ target: element, type });
            } };
        controls.set(id, element);
        return element;
    };
    const d = control('hmeromhnia_apoxorhshs', departure);
    const e = control('hmeromhnia_lhxhs_symbashs', contractEnd);
    const section = control('logos_peratoshs_section');
    const reason = control('logos_peratoshs');
    const hidden = control('logos_peratoshs_stathera');
    const notes = control('parathrhseis_peratoshs');
    const buttons = [{ disabled: false }];
    let alerts = 0;
    class FakeMutationObserver {
        constructor(callback) { this.callback = callback; }
        observe() {}
        disconnect() {}
        takeRecords() { return []; }
    }
    const readiness = { FORM_READY: ready };
    const window = { EmployeeFormReadiness: readiness };
    const document = {
        getElementById(id) { return controls.get(id); },
        querySelectorAll(selector) { return selector === '.submitButton' ? buttons : []; },
        addEventListener(type, fn) { const list = docListeners.get(type) || [];
            list.push(fn); docListeners.set(type, list); },
        dispatch(type) { for (const fn of docListeners.get(type) || []) fn(); }
    };
    const Swal = { fire: async () => { alerts++; return {}; } };
    vm.runInNewContext(source, { document, window, Swal, MutationObserver: FakeMutationObserver });
    document.dispatch('DOMContentLoaded');
    const change = (element, value) => { element.value = value; element.emit('input'); element.emit('change'); };
    return { d, e, section, reason, hidden, notes, buttons, readiness, document, window,
        change, alerts: () => alerts };
}

for (const [departure, contractEnd, expectedVisible, expectedBlocked] of [
    ['', '', false, false],
    ['2026-10-23', '', false, false],
    ['', '2026-12-31', false, false],
    ['2026-10-23', '2026-12-31', true, true]
]) {
    test(`SOX visibility and Save lock: departure=${Boolean(departure)}, end=${Boolean(contractEnd)}`, async () => {
        const h = fixture({ departure, contractEnd });
        assert.equal(h.section.style.display !== 'none', expectedVisible);
        assert.equal(h.buttons[0].disabled, expectedBlocked);
        assert.equal(await h.window.validateEmployeeTermination(), !expectedBlocked);
        assert.equal(h.alerts(), expectedBlocked ? 1 : 0);
    });
}

test('changing only the contract end immediately toggles SOX requirements and Save', async () => {
    const h = fixture({ departure: '2026-10-23' });
    assert.equal(h.buttons[0].disabled, false);
    h.change(h.e, '2026-12-31');
    assert.equal(h.section.style.display !== 'none', true);
    assert.equal(h.buttons[0].disabled, true);
    h.change(h.hidden, '1'); h.change(h.notes, 'Synthetic reason');
    assert.equal(h.buttons[0].disabled, false);
    assert.equal(await h.window.validateEmployeeTermination(), true);
    h.change(h.e, '');
    assert.equal(h.section.style.display, 'none');
    assert.equal(h.buttons[0].disabled, false);
    // Hidden existing values are not silently deleted when only the contract
    // classification changes; historical stored reason/notes are preserved.
    assert.equal(h.hidden.value, '1');
    assert.equal(h.notes.value, 'Synthetic reason');
    h.change(h.d, '');
    assert.equal(h.hidden.value, '');
    assert.equal(h.notes.value, '');
});

test('readiness remains an independent Save lock', () => {
    const h = fixture({ departure: '2026-10-23', ready: false });
    assert.equal(h.buttons[0].disabled, true);
    h.readiness.FORM_READY = true;
    h.document.dispatch('employeeform:ready');
    assert.equal(h.buttons[0].disabled, false);
    h.change(h.e, '2026-12-31');
    assert.equal(h.buttons[0].disabled, true);
});
