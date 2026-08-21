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
    sandbox.renderDeclaredRepoWithCardsBadge(declaredRepoWithCards, '0'),
    /Απασχόληση σε ρεπό/
);
assert.strictEqual(JSON.stringify(declaredRepoWithCards), before);

const duplicateRepoEvent = row({
    scenarioDecision: {
        scenario_code: 'DECLARED_REPO_WITH_CARDS',
        display_labels: { show_badge: true }
    }
});
const singleRepoPresentation =
    sandbox.renderDeclaredRepoWithCardsBadge(duplicateRepoEvent, '0') +
    sandbox.renderScenarioBadge(duplicateRepoEvent);
assert.equal(
    (singleRepoPresentation.match(/Απασχόληση σε ρεπό/g) || []).length,
    1
);
assert.doesNotMatch(singleRepoPresentation, /Ρεπό με κάρτες|Δηλωμένο ρεπό με κάρτες/);

assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({ repo: false }), '0'), /Απασχόληση σε ρεπό/);
assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΜΕ', repo: false, effective_is_full_time: false
}), '1'), /Μη εργασία με κάρτες/);

assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΜΕ', repo: false,
    effective_is_full_time: false, effective_kathestos_apasxolhshs: '1'
}), '1'), /Μη εργασία με κάρτες/);

assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΜΕ', repo: false,
    effective_is_full_time: false, effective_kathestos_apasxolhshs: '2'
}), '2'), /Μη εργασία με κάρτες/);

const mixedJune0014 = [
    ['2026-06-12', false, 'Μη εργασία με κάρτες'],
    ['2026-06-13', false, 'Μη εργασία με κάρτες'],
    ['2026-06-15', true, 'Απασχόληση σε ρεπό'],
    ['2026-06-25', true, 'Απασχόληση σε ρεπό'],
    ['2026-06-30', true, 'Απασχόληση σε ρεπό']
];
mixedJune0014.forEach(([hmeromhnia, effective_is_full_time, expected]) => {
    const html = sandbox.renderDeclaredRepoWithCardsBadge(row({
        hmeromhnia,
        kathgoria_ergasias: effective_is_full_time ? 'ΑΝ' : 'ΜΕ',
        repo: effective_is_full_time,
        effective_is_full_time
    }), effective_is_full_time ? '0' : '1');
    assert.match(html, new RegExp(expected));
});

const transitionRows = [
    { date: '2026-06-14', employment_type: '1' },
    { date: '2026-06-15', employment_type: '0' }
];
const transitionMap = sandbox.buildCanonicalDailyEmploymentTypeByKey([{
    scope: { employee_kodikos: '0014' }, stage1_daily_presentation: transitionRows
}]);
assert.equal(transitionMap.get(sandbox.stage2DailyResolutionKey('0014', '2026-06-14')), '1');
assert.equal(transitionMap.get(sandbox.stage2DailyResolutionKey('0014', '2026-06-15')), '0');
assert.match(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kodikos: '0014', hmeromhnia: '2026-06-15', kathgoria_ergasias: 'ΜΕ',
    repo: false, effective_is_full_time: false
}), transitionMap.get(sandbox.stage2DailyResolutionKey('0014', '2026-06-15'))),
/Απασχόληση σε ρεπό/);

assert.strictEqual(sandbox.renderDeclaredRepoWithCardsBadge(row({
    cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0
}), '0'), '');

assert.strictEqual(sandbox.renderDeclaredRepoWithCardsBadge(row({
    kathgoria_ergasias: 'ΕΡΓ', repo: false
}), '0'), '');

assert.strictEqual(sandbox.renderDeclaredRepoWithCardsBadge(row(), ''), '');

assert.match(source,
    /\$\{rowPresentation\.apologistiko\.text\}[\s\S]*\$\{renderDeclaredRepoWithCardsBadge\(row\)\}/);

console.log('declared repo with cards apologistiko badge: PASS');
