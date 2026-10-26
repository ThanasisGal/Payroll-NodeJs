'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function manager(selects) {
    let creates = 0;
    const context = {
        window: {},
        document: { querySelectorAll: () => selects, activeElement: null },
        initTomDropdown({ selector }) {
            creates++;
            const select = selects.find(node => '#' + node.id === selector);
            return select.tomselect = instance(select);
        }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'dropdownManager.js'), 'utf8')
        .replace(/^import .*$/gm, '').replace(/^export /gm, ''), context);
    return { context, creates: () => creates };
}
function select(id, attrs = {}) {
    return { id, dataset: attrs, getAttribute(name) {
        if (name === 'data-api') return '/synthetic';
        return attrs[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())];
    } };
}
function instance(input) {
    return { input, items: ['kept'], clears: 0, loads: 0,
        clear() { this.clears++; }, clearOptions() {}, load() { this.loads++; } };
}

test('manager reuses singles and registers session filters exactly once', () => {
    const node = select('existing', { companyRelated: 'true', teamRelated: 'true' });
    const existing = node.tomselect = instance(node);
    const run = manager([node]);
    run.context.initDropdowns(); run.context.initDropdowns();
    assert.equal(run.creates(), 0);
    assert.equal(node.tomselect, existing);
    run.context.updateFilter('company', 'next-company');
    assert.equal(existing.loads, 1);
    run.context.updateFilter('team', 'next-team');
    assert.equal(existing.loads, 2);
    assert.deepEqual(existing.items, ['kept']);
});

test('manager creates missing controls once and respects skip-autoload', () => {
    const node = select('new', { xrhshRelated: 'true' });
    const skipped = select('manual', { skipAutoload: 'true' });
    const run = manager([node, skipped]);
    run.context.initDropdowns(); run.context.initDropdowns();
    assert.equal(run.creates(), 1);
    assert.equal(skipped.tomselect, undefined);
    run.context.updateFilter('xrhsh', '2027');
    assert.equal(node.tomselect.loads, 1);
});

test('helper returns the active instance without destroying it and forwards the live source', () => {
    let source;
    const active = { items: ['original'], destroy() { assert.fail('active control destroyed'); },
        updateDropdownSource(url, params) { source = { url, params }; } };
    const context = { window: {}, document: { querySelector: () => ({ tomselect: active }) },
        TomSelect() { assert.fail('active control recreated'); } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'dropdown-item.js'), 'utf8')
        .replace(/^export /gm, '') + '\nwindow.initialize = initTomDropdown;', context);
    const params = { perifereia: '001' };
    assert.equal(context.window.initialize({ selector: '#nomos', url: '/synthetic/nomos', extraParams: params }), active);
    assert.equal(source.params, params);
    params.perifereia = '002';
    assert.equal(source.params.perifereia, '002');
    assert.deepEqual(active.items, ['original']);
});
