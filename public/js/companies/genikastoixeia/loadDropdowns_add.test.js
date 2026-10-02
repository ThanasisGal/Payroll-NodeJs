'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');

const source = fs.readFileSync(path.join(__dirname, 'loadDropdowns_add.js'), 'utf8');
const partialPath = path.resolve(
    __dirname,
    '../../../../views/companies/genikastoixeia/partials/add/cardBodies/statheraStoixeia.ejs'
);
const partial = fs.readFileSync(partialPath, 'utf8');

function renderTeamField(managedTeam, canManageAllTeams) {
    const html = ejs.render(partial, { rec: {}, managedTeam, canManageAllTeams }, {
        filename: partialPath
    });
    const namePosition = html.indexOf('name="companyTeam"');
    const inputStart = html.lastIndexOf('<input', namePosition);
    const inputEnd = html.indexOf('/>', namePosition);
    return html.slice(inputStart, inputEnd + 2);
}

function element(value = '') {
    const listeners = {};
    return {
        value,
        disabled: false,
        options: [],
        listeners,
        addEventListener(type, handler) { listeners[type] = handler; },
        appendChild(option) { this.options.push(option); },
        set innerHTML(value) {
            this._innerHTML = value;
            this.options = [];
        },
        get innerHTML() { return this._innerHTML || ''; }
    };
}

function response(data, ok = true) {
    return { ok, async json() { return data; } };
}

function createPage({ companyTeam = '', teamResponses = {} } = {}) {
    let domReady;
    const calls = [];
    const elements = {
        perifereies: element(),
        nomos: element(),
        dhmos: element(),
        polh: element(),
        selectedUsers: element(),
        companyTeam: element(companyTeam)
    };
    const fetch = async (url) => {
        calls.push(url);
        if (url === '/api/perifereies') return response([]);
        const configured = teamResponses[url];
        if (typeof configured === 'function') return configured();
        if (configured) return response(configured);
        return response([], false);
    };
    const context = {
        console,
        Headers,
        fetch,
        Option: function Option(text, value) { this.text = text; this.value = value; },
        AbortController,
        document: {
            addEventListener(type, handler) { if (type === 'DOMContentLoaded') domReady = handler; },
            querySelector(selector) {
                if (selector === 'meta[name="csrf-token"]') return { content: 'csrf-token' };
                return null;
            },
            getElementById(id) { return elements[id]; }
        }
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'loadDropdowns_add.js' });
    domReady();
    return { calls, elements };
}

async function flush() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
}

(async () => {
    const thaHtml = renderTeamField('THA', true);
    assert.match(thaHtml, /name="companyTeam"/);
    assert.match(thaHtml, /id="companyTeam"/);
    assert.match(thaHtml, /value=""/);
    assert.match(thaHtml, /required/);
    assert.doesNotMatch(thaHtml, /readonly/);

    const restrictedHtml = renderTeamField('BLG', false);
    assert.match(restrictedHtml, /value="BLG"/);
    assert.match(restrictedHtml, /readonly/);
    assert.match(restrictedHtml, /required/);

    const empty = createPage();
    await flush();
    assert.strictEqual(empty.elements.selectedUsers.disabled, true);
    assert.deepStrictEqual(empty.elements.selectedUsers.options, []);
    assert.ok(!empty.calls.some((url) => url.includes('/api/allUser')));

    const scoped = createPage({
        companyTeam: 'BLG',
        teamResponses: {
            '/api/allUsersByTeam/BLG': [
                { _id: 'blg-user', lastName: 'Βήτα', firstName: 'Λάμδα' }
            ]
        }
    });
    await flush();
    assert.ok(scoped.calls.includes('/api/allUsersByTeam/BLG'));
    assert.ok(!scoped.calls.includes('/api/allUser'));
    assert.strictEqual(scoped.elements.selectedUsers.disabled, false);
    assert.deepStrictEqual(
        scoped.elements.selectedUsers.options.map((option) => option.value),
        ['blg-user']
    );

    let resolveTeamB;
    const changing = createPage({
        companyTeam: 'TEAM-A',
        teamResponses: {
            '/api/allUsersByTeam/TEAM-A': [{ _id: 'old-user', lastName: 'Old', firstName: 'User' }],
            '/api/allUsersByTeam/TEAM-B': () => new Promise((resolve) => { resolveTeamB = resolve; })
        }
    });
    await flush();
    changing.elements.selectedUsers.options[0].selected = true;
    changing.elements.companyTeam.value = 'TEAM-B';
    const teamChange = changing.elements.companyTeam.listeners.change();
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(changing.elements.selectedUsers.disabled, true);
    assert.deepStrictEqual(changing.elements.selectedUsers.options, []);
    resolveTeamB(response([{ _id: 'new-user', lastName: 'New', firstName: 'User' }]));
    await teamChange;
    assert.deepStrictEqual(
        changing.elements.selectedUsers.options.map((option) => option.value),
        ['new-user']
    );

    changing.elements.companyTeam.value = '';
    await changing.elements.companyTeam.listeners.change();
    assert.strictEqual(changing.elements.selectedUsers.disabled, true);
    assert.deepStrictEqual(changing.elements.selectedUsers.options, []);

    const failing = createPage({ companyTeam: 'FAIL' });
    await flush();
    assert.strictEqual(failing.elements.selectedUsers.disabled, true);
    assert.deepStrictEqual(failing.elements.selectedUsers.options, []);

    console.log('PASS company add team field and team-scoped user dropdown behavior');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
