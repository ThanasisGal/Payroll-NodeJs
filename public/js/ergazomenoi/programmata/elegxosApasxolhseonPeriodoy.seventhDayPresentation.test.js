'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
vm.runInContext(`${source}
this.renderSeventhDayBadgesForTest = renderSeventhDayBadges;
this.resolveSeventhDayRowPresentationForTest = resolveSeventhDayRowPresentation;
this.weeklyHrStage1PayloadsForTest = weeklyHrStage1Payloads;`, sandbox,
{ filename: sourcePath });

const payloads = sandbox.weeklyHrStage1PayloadsForTest;
const row = {
    kodikos: '0004',
    ypokatasthma: '0000',
    hmeromhnia: '2026-06-17'
};

function lifecyclePayload(overrides = {}) {
    const stage4 = {
        final_weekly_analysis_available: true,
        final_weekly_analysis: {
            status: 'READY',
            seventhDay: {
                hmeromhnia: '2026-06-17',
                severity: 'SERIOUS_VIOLATION',
                classification: 'SEVENTH_DAY_ILLEGAL_OVERTIME',
                illegalOvertimeHours: 6.48
            }
        },
        ...overrides.stage4
    };
    return {
        scope: {
            employee_kodikos: '0004',
            ypokatasthma: '0000',
            ...overrides.scope
        },
        lifecycle_projection: { stages: { stage4 } }
    };
}

function renderWith(payload, candidateRow = row) {
    payloads.clear();
    if (payload) payloads.set('fixture', payload);
    return sandbox.renderSeventhDayBadgesForTest(candidateRow);
}

const authoritativeHtml = renderWith(lifecyclePayload());
assert.match(authoritativeHtml, /7η ημέρα εργασίας/);
assert.match(authoritativeHtml, /ΣΟΒΑΡΗ ΠΑΡΑΒΑΣΗ/);

assert.equal(renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis_available: false
} })), '');

assert.equal(renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis: {
        status: 'READY',
        seventhDay: {
            hmeromhnia: '2026-06-18',
            severity: 'SERIOUS_VIOLATION'
        }
    }
} })), '');

assert.equal(renderWith(lifecyclePayload({ scope: {
    employee_kodikos: '9999'
} })), '');
assert.equal(renderWith(lifecyclePayload({ scope: {
    ypokatasthma: '9999'
} })), '');

assert.equal(renderWith(null, {
    ...row,
    is_seventh_day: true,
    seventh_day_severity: 'SERIOUS_VIOLATION'
}), '');

assert.equal(renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis: { status: 'NEEDS_HR_DECISION', seventhDay: null }
} }), {
    ...row,
    kathgoria_ergasias: 'ΑΝ',
    repo: true,
    cards_apo_ora_01: '15:41',
    cards_eos_ora_01: '22:40'
}), '');

payloads.clear();
console.log('authoritative seventh-day presentation tests: PASS');
