'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'selectRowInTable.js'), 'utf8');
const employeeId = '507f1f77bcf86cd799439025';

function classList(initial = []) {
    const values = new Set(initial);
    return {
        add: (value) => values.add(value), remove: (value) => values.delete(value),
        contains: (value) => values.has(value), values
    };
}

function row(id) {
    const listeners = {};
    return { id, classList: classList(), parentElement: null,
        getAttribute: (name) => name === 'data-id' ? id : null,
        getBoundingClientRect: () => ({ top: id === employeeId ? 160 : 0 }),
        addEventListener: (name, handler) => { listeners[name] = handler; }, listeners };
}

function run({ referrer = '', pathname = '/ergazomenoi/ergazomenoi',
    search = '?page=2&perx=1', stored = null } = {}) {
    const rows = [row('507f1f77bcf86cd799439001'), row(employeeId),
        row('507f1f77bcf86cd799439030')];
    const tbody = {};
    rows.forEach((item) => { item.parentElement = tbody; });
    const scrollContainer = { scrollTop: 240,
        getBoundingClientRect: () => ({ top: 40 }) };
    const table = { closest: (selector) => selector === '.overflow-auto'
        ? scrollContainer : null };
    const editListeners = {};
    const edit = { dataset: { allowed: '1' }, href: '#',
        addEventListener: (name, handler) => { editListeners[name] = handler; } };
    const storage = new Map();
    if (stored) storage.set('employee-maintenance-return:v1', JSON.stringify(stored));
    let ready;
    let replaced = '';
    const location = { origin: 'https://example.test', pathname, search, href: '',
        replace: (value) => { replaced = value; } };
    const sandbox = { console, URL, location, window: { location },
        sessionStorage: { getItem: (key) => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key) },
        document: { referrer,
            addEventListener: (name, handler) => { if (name === 'DOMContentLoaded') ready = handler; },
            querySelectorAll: () => rows,
            getElementById: (id) => id === 'edit-btn' ? edit :
                (id === 'myTable' ? table : null),
            querySelector: () => null },
        Swal: { fire: async () => ({}) }
    };
    vm.runInNewContext(source, sandbox);
    ready();
    return { rows, edit, editListeners, storage, sandbox, replaced, scrollContainer };
}

const departure = run();
departure.rows[1].listeners.click.call(departure.rows[1]);
departure.editListeners.click({ preventDefault: () => {}, stopPropagation: () => {} });
const savedState = JSON.parse(departure.storage.get('employee-maintenance-return:v1'));
assert.equal(savedState.employeeId, employeeId);
assert.equal(savedState.returnUrl, '/ergazomenoi/ergazomenoi?page=2&perx=1');
assert.equal(savedState.scrollTop, 240);

for (const returnKind of ['Επιστροφή', 'Αποθήκευση']) {
    const returned = run({
        referrer: '',
        stored: savedState
    });
    assert.deepEqual(returned.rows.map((item) => item.id), [
        '507f1f77bcf86cd799439001', employeeId, '507f1f77bcf86cd799439030'
    ], `${returnKind}: row order must remain unchanged`);
    assert.equal(returned.rows[1].classList.contains('selected-row'), true,
        `${returnKind}: employee must remain selected`);
    assert.equal(returned.scrollContainer.scrollTop, 240,
        `${returnKind}: table scroll position must be restored`);
    assert.equal(returned.edit.href,
        `/ergazomenoi/ergazomenoi/edit/${employeeId}`);
    assert.equal(returned.storage.has('employee-maintenance-return:v1'), false);
}

const paginationReturn = run({ pathname: '/ergazomenoi/ergazomenoi', search: '',
    referrer: '',
    stored: savedState });
assert.equal(paginationReturn.replaced, '/ergazomenoi/ergazomenoi?page=2&perx=1');
assert.equal(JSON.parse(paginationReturn.storage.get(
    'employee-maintenance-return:v1')).redirectPending, true);
const redirectedPage = run({ referrer: '',
    stored: JSON.parse(paginationReturn.storage.get('employee-maintenance-return:v1')) });
assert.deepEqual(redirectedPage.rows.map((item) => item.id), [
    '507f1f77bcf86cd799439001', employeeId, '507f1f77bcf86cd799439030'
]);
assert.equal(redirectedPage.rows[1].classList.contains('selected-row'), true);
assert.equal(redirectedPage.scrollContainer.scrollTop, 240);
assert.equal(redirectedPage.storage.has('employee-maintenance-return:v1'), false);

const fallbackState = { ...savedState, scrollTop: null };
const fallbackReturn = run({ referrer: '', stored: fallbackState });
assert.deepEqual(fallbackReturn.rows.map((item) => item.id), [
    '507f1f77bcf86cd799439001', employeeId, '507f1f77bcf86cd799439030'
]);
assert.equal(fallbackReturn.scrollContainer.scrollTop, 360);

const independentVisit = run({ referrer: '' });
assert.deepEqual(independentVisit.rows.map((item) => item.id), [
    '507f1f77bcf86cd799439001', employeeId, '507f1f77bcf86cd799439030'
]);
assert.equal(independentVisit.rows.some((item) => item.classList.contains('selected-row')), false);
assert.equal(independentVisit.scrollContainer.scrollTop, 240);
assert.equal(independentVisit.storage.has('employee-maintenance-return:v1'), false);

console.log('employee maintenance return state tests passed');
