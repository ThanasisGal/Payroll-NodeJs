'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ejs = require('ejs');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const Maintenance = require('../../utils/ergazomenoi/employmentProfileMaintenance');

const controllerSource = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const viewSource = fs.readFileSync(
    __dirname + '/../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs',
    'utf8'
);
const clientSource = fs.readFileSync(
    __dirname + '/../../../public/js/ergazomenoi/genika/istorikoTable.js',
    'utf8'
);

function historyHandler({ authorized, writerCalls }) {
    const start = controllerSource.indexOf('static updateIstorikoData = ');
    const end = controllerSource.indexOf('    static searchPostErgazomenoi', start);
    const method = controllerSource.slice(start, end).trim()
        .replace('static updateIstorikoData = ', '')
        .replace(/;$/, '');
    const helpers = controllerSource.slice(
        controllerSource.indexOf('function valueOrEmpty('),
        controllerSource.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού')
    );
    const employee = { _id: 'employee-id', kodikos: '0001' };
    const query = {
        async lean() {
            return employee;
        }
    };

    return vm.runInNewContext(`${helpers}\n(${method})`, {
        Date,
        console: { error() {} },
        ...Terms,
        ...Maintenance,
        ErgazomenoiModel: { findOne: () => query },
        canManageEmployeeHistory: async (userId) => {
            assert.equal(userId, 'authenticated-user-id');
            return authorized;
        },
        writeEmployeeEmploymentHistoryOperations: async (args) => {
            writerCalls.push(args);
        }
    });
}

async function submit(authorized, updates) {
    const writerCalls = [];
    const req = {
        session: {
            userId: 'authenticated-user-id',
            userTeam: 'BLG',
            companyInUse: 'company-id'
        },
        body: {
            employeeId: 'employee-id',
            updates,
            privileges: 'A',
            team: 'THA',
            situation: 'A',
            canManageEmployeeHistory: true
        }
    };
    const res = {
        code: 200,
        status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; }
    };
    await historyHandler({ authorized, writerCalls })(req, res);
    return { res, writerCalls };
}

function renderHistory(canManageEmployeeHistory) {
    return ejs.render(viewSource, {
        canManageEmployeeHistory,
        ergazomenoiData: { _id: 'employee-id' },
        istorikoData: [{ _id: 'history-id', aa_eggrafhs: '0001' }]
    });
}

test('active Admin/THA capability renders all four existing row actions enabled', () => {
    const html = renderHistory(true);
    assert.match(html, /data-can-manage-history="true"/);
    for (const action of ['add', 'edit', 'delete', 'undo']) {
        const button = html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0] || '';
        assert.ok(button, action);
        assert.doesNotMatch(button, /\bdisabled\b/, action);
        assert.doesNotMatch(button, /aria-disabled=/, action);
    }
});

test('client uses the server capability for all dynamic buttons and defensively blocks all actions', () => {
    assert.match(clientSource, /table\.dataset\.canManageHistory === 'true'/);
    for (const action of ['add', 'edit', 'delete', 'undo']) {
        assert.match(
            clientSource,
            new RegExp(`data-action="${action}"[^>]+\\$\\{canManageHistory \\? '' : 'disabled aria-disabled="true"'\\}`),
            action
        );
    }
    assert.match(
        clientSource,
        /\['add', 'edit', 'delete', 'undo'\]\.includes\(action\) && !canManageHistory/
    );
});

test('non-capable users render all four existing row actions disabled with aria semantics', () => {
    const html = renderHistory(false);
    assert.match(html, /data-can-manage-history="false"/);
    for (const action of ['add', 'edit', 'delete', 'undo']) {
        assert.match(html, new RegExp(`data-action="${action}"[^>]*disabled aria-disabled="true">`), action);
    }
});

test('capable user may submit inserted, modified and deleted operations', async () => {
    for (const update of [
        { state: 'inserted', data: {} },
        { state: 'modified', _id: 'history-id', data: {} },
        { state: 'deleted', _id: 'history-id' }
    ]) {
        const { res, writerCalls } = await submit(true, [update]);
        assert.equal(res.code, 200);
        assert.equal(writerCalls.length, 1);
    }
});

for (const identity of [
    'active Admin/non-THA',
    'active non-Admin/THA',
    'inactive Admin/THA'
]) {
    test(`${identity} receives 403 with zero writer calls for every mutation state`, async () => {
        for (const state of ['inserted', 'modified', 'deleted']) {
            const { res, writerCalls } = await submit(false, [{ state, _id: 'forged-history-id', data: {} }]);
            assert.equal(res.code, 403);
            assert.equal(res.body.success, false);
            assert.equal(writerCalls.length, 0);
        }
    });
}

test('forged inserted payload is rejected without calling the writer', async () => {
    const { res, writerCalls } = await submit(false, [{ state: 'inserted', data: {} }]);
    assert.equal(res.code, 403);
    assert.equal(writerCalls.length, 0);
});

test('row details remain available without the management capability', () => {
    assert.match(clientSource, /if \(!button\) \{[\s\S]*openIstorikoDetailsModal\(rowForModal\)/);
    assert.match(clientSource, /if \(row\.dataset\.editing === '1'\) return;[\s\S]*bootstrap\.Modal/);
});
