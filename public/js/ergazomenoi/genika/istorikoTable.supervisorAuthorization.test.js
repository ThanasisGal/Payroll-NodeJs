'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/istorikoTable.js', 'utf8');
const fields = ['hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs', 'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos', 'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_apoxorhshs'];
function browser(mode = 'SUPERVISOR_PROBLEM_SCOPE') {
    const rows = [], requests = [], dialogs = [], details = { innerHTML: '' };
    let click, save, modalShows = 0;
    function cell(field) {
        let html = '', input = null, text = '';
        return { dataset: { field, iso: '' },
            get innerHTML() { return html; }, set innerHTML(value) {
                html = value; input = value.startsWith('<input') ? { value: value.match(/value="([^"]*)"/)?.[1] || '',
                    addEventListener() {} } : null;
            }, get textContent() { return text; }, set textContent(value) { text = value; input = null; }, input: () => input };
    }
    function row(id = '', canManage = true) {
        const children = [cell(), ...fields.map(cell), cell(), cell()];
        const value = { children, dataset: { id, state: 'clean', persisted: 'true', canManageRow: String(canManage),
            original: JSON.stringify({ hmeromhnia_proslhpshs: '2026-01-01' }),
            record: JSON.stringify({ hmeromhnia_proslhpshs: '2026-01-01', dialleima_se_lepta: 30 }) },
            classList: { add() {}, remove() {} },
            querySelector(selector) {
                if (selector === '.istoriko-aa-col') return children[0];
                if (selector === '.istoriko-state') return children[7];
                const field = selector.match(/data-field(?:-input)?="([^"]+)"/)?.[1];
                const c = children.find(c => c.dataset.field === field);
                return selector.includes('data-field-input') ? c?.input() : c || null;
            }, querySelectorAll(selector) { return selector === '.istoriko-date-input' ? children.map(c => c.input()).filter(Boolean) : []; },
            insertAdjacentElement(position, newRow) { assert.equal(position, 'afterend'); rows.splice(rows.indexOf(value) + 1, 0, newRow); },
            remove() { rows.splice(rows.indexOf(value), 1); } };
        return value;
    }
    const problem = row('persisted-problem'), clean = row('persisted-clean', false); rows.push(problem, clean);
    const table = { dataset: { historyAccessMode: mode, expectedStateToken: 'a'.repeat(64) },
        querySelectorAll: () => rows, addEventListener(event, callback) { if (event === 'click') click = callback; } };
    const document = { createElement(tag) { assert.equal(tag, 'tr'); return row(); },
        addEventListener(event, callback) { if (event === 'DOMContentLoaded') callback(); },
        querySelector: () => ({ content: 'synthetic-token' }), getElementById(id) {
            if (id === 'istorikoTable') return table;
            if (id === 'updateIstorikoBtn') return { addEventListener(event, callback) { save = callback; } };
            if (id === 'istorikoEmployeeId') return { value: 'synthetic-employee' };
            if (id === 'istorikoDetailsModal') return {};
            if (id === 'istorikoDetailsBody') return details;
            return null;
        } };
    vm.runInNewContext(source, { document, Date, Intl,
        bootstrap: { Modal: { getOrCreateInstance: () => ({ show() { modalShows++; } }) } },
        window: { employeeHistoryGuidedResolution: { async handleInitialResponse() { return { handled:true,cancelled:true }; } }, location: { reload() {} } }, Swal: { async fire(options) { dialogs.push(options); return { isConfirmed: true }; } },
        async fetch(url, options) { requests.push(JSON.parse(options.body)); return { status: 200, json: async () => ({ success: true }) }; } });
    return { rows, problem, clean, requests, dialogs, details, modalShows: () => modalShows,
        save: () => save(), action(target, action) {
            const button = { dataset: { action }, closest: selector => selector === 'tr.istoriko-row' ? target : null };
            return click({ target: { closest: selector => selector === '[data-action]' ? button : null }, preventDefault() {} });
        }, openDetails(target) {
            click({ target: { closest: selector => selector === 'tr.istoriko-row' ? target : null }, preventDefault() {} });
        } };
}

test('Supervisor Add from persisted problem stores its exact anchor and disables new-row Add', () => {
    const page = browser(); page.action(page.problem, 'add');
    assert.equal(page.rows.length, 3);
    const inserted = page.rows[1];
    assert.equal(inserted.dataset.anchorHistoryId, 'persisted-problem');
    assert.equal(inserted.dataset.persisted, 'false'); assert.equal(inserted.dataset.id, '');
    assert.match(inserted.innerHTML.match(/<button[^>]*data-action="add"[^>]*>/)[0], /disabled aria-disabled="true"/);
    for (const action of ['edit', 'delete', 'undo']) {
        assert.doesNotMatch(inserted.innerHTML.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))[0], /disabled/);
    }
    page.action(inserted, 'add'); assert.equal(page.rows.length, 3, 'programmatic click cannot chain Add either');
});

test('Supervisor clean row Add/Edit/Delete/Undo remain blocked by the actual client handler', () => {
    const page = browser();
    for (const action of ['add', 'edit', 'delete', 'undo']) page.action(page.clean, action);
    assert.equal(page.rows.length, 2); assert.equal(page.clean.dataset.state, 'clean'); assert.equal(page.clean.dataset.editing, '0');
});

test('inserted row local editing retains anchor and sends only narrow insert hint', async () => {
    const page = browser(); page.action(page.problem, 'add');
    const inserted = page.rows[1];
    inserted.querySelector('[data-field-input="hmeromhnia_lhxhs_symbashs"]').value = '2026-11-30';
    page.action(inserted, 'edit'); assert.equal(inserted.dataset.editing, '0');
    page.action(inserted, 'edit'); assert.equal(inserted.dataset.editing, '1');
    await page.save();
    assert.equal(page.requests.length, 1);
    const update = page.requests[0].updates[0];
    assert.equal(update.anchorHistoryId, 'persisted-problem'); assert.equal(update.state, 'inserted');
    assert.equal(update._id, null); assert.equal(update.data.hmeromhnia_lhxhs_symbashs, '2026-11-30');
    assert.deepEqual(Object.keys(update).sort(), ['_id', 'aa_eggrafhs', 'anchorHistoryId', 'data', 'state']);
    assert.equal(page.requests[0].expectedStateToken, 'a'.repeat(64));
});

for (const action of ['delete', 'undo']) test(`Supervisor ${action} removes local insertion without turning it into persisted authority`, async () => {
    const page = browser(); page.action(page.problem, 'add'); page.action(page.rows[1], action);
    assert.equal(page.rows.length, 2); assert.equal(page.problem.dataset.state, 'clean');
    await page.save(); assert.equal(page.requests.length, 0);
});

test('Supervisor local persisted-row edit/delete/undo preserves identity and deletion opens correction', async () => {
    const page = browser(); page.action(page.problem, 'edit');
    assert.equal(page.problem.dataset.editing, '1');
    page.action(page.problem, 'undo'); assert.equal(page.problem.dataset.editing, '0');
    await page.action(page.problem, 'delete'); assert.equal(page.problem.dataset.state, 'clean');
    assert.equal(page.requests.length, 1); assert.equal(page.requests[0].correction.intent, 'REVIEW');
    assert.deepEqual(page.requests[0].updates, []);
    page.action(page.problem, 'undo'); assert.equal(page.problem.dataset.state, 'clean');
    assert.equal(page.problem.dataset.id, 'persisted-problem');
});

test('Admin retains Add from clean and unsaved rows without needing persisted anchors', () => {
    const page = browser('ADMIN_FULL'); page.action(page.clean, 'add');
    const inserted = page.rows[2]; assert.equal(inserted.dataset.anchorHistoryId, '');
    assert.doesNotMatch(inserted.innerHTML.match(/<button[^>]*data-action="add"[^>]*>/)[0], /disabled/);
    page.action(inserted, 'add'); assert.equal(page.rows.length, 4);
});

test('NONE cannot act even when a forged row data attribute claims management', () => {
    const page = browser('NONE');
    for (const action of ['add', 'edit', 'delete', 'undo']) page.action(page.problem, action);
    assert.equal(page.rows.length, 2); assert.equal(page.problem.dataset.state, 'clean');
});

for (const mode of ['ADMIN_FULL', 'SUPERVISOR_PROBLEM_SCOPE', 'NONE']) {
    test(`${mode} retains readable clean-row details modal`, () => {
        const page = browser(mode); page.openDetails(page.clean);
        assert.equal(page.modalShows(), 1); assert.match(page.details.innerHTML, /Διάρκεια Διαλείμματος/);
    });
}
