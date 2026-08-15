'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = {
    console,
    document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        createElement: () => ({
            addEventListener: () => {}, appendChild: () => {},
            classList: { add: () => {}, toggle: () => {} }, dataset: {},
            setAttribute: () => {}, style: {}
        }),
        head: { appendChild: () => {} }, body: { appendChild: () => {} }
    },
    window: {}, URLSearchParams,
    fetch: async () => { throw new Error('Unexpected fetch'); },
    setTimeout: () => {}, clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });

function row(overrides = {}) {
    return {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        effective_is_full_time: true,
        cards_apo_ora_01: '15:41',
        cards_eos_ora_01: '22:40',
        cards_ores_ergasias: 6.98,
        ...overrides
    };
}

const declaredRepoWithCards = row();
const before = JSON.stringify(declaredRepoWithCards);
assert.match(
    sandbox.renderDeclaredRepoWithCardsBadge(declaredRepoWithCards),
    /Ρεπό με κάρτες/
);
assert.strictEqual(JSON.stringify(declaredRepoWithCards), before);

assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({ repo: false })), /Ρεπό με κάρτες/);
assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΜΕ', repo: false, effective_is_full_time: false
})), /Ρεπό με κάρτες/);

assert.strictEqual(sandbox.renderDeclaredRepoWithCardsBadge(row({
    cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0
})), '');

assert.strictEqual(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΕΡΓ', repo: false
})), '');

assert.match(source,
    /\$\{rowPresentation\.apologistiko\.text\}[\s\S]*\$\{renderDeclaredRepoWithCardsBadge\(row\)\}/);

console.log('declared repo with cards apologistiko badge: PASS');
