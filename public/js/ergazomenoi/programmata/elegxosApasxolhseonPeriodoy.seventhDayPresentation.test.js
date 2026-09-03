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
this.buildWeeklyHrStage1ScopesForTest = buildWeeklyHrStage1Scopes;
this.weeklyHrStage1PayloadsForTest = weeklyHrStage1Payloads;`, sandbox,
{ filename: sourcePath });

const payloads = sandbox.weeklyHrStage1PayloadsForTest;
const row = {
    kodikos: '0031',
    ypokatasthma: '0000',
    hmeromhnia: '2026-04-05'
};

function lifecyclePayload(overrides = {}) {
    const stage4 = {
        final_weekly_analysis_available: true,
        final_weekly_analysis: {
            status: 'READY',
            seventhDay: {
                hmeromhnia: '2026-04-05',
                severity: 'SERIOUS_VIOLATION',
                classification: 'SEVENTH_DAY_ILLEGAL_OVERTIME',
                illegalOvertimeHours: 6.48
            }
        },
        ...overrides.stage4
    };
    return {
        scope: {
            employee_kodikos: '0031',
            ypokatasthma: '0000',
            ...overrides.scope
        },
        lifecycle_projection: {
            employment_date_scope: {
                authoritative_date_set: ['2026-04-01', '2026-04-02', '2026-04-03',
                    '2026-04-04', '2026-04-05'],
                context_only_dates: ['2026-03-30', '2026-03-31'],
                ...overrides.employment_date_scope
            },
            stages: { stage4 }
        }
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
assert.match(authoritativeHtml, /d-flex flex-column align-items-center gap-1/);

const dailyRowsRenderer = source.slice(
    source.indexOf('function renderReviewRows'),
    source.indexOf('function updateAuthoritativeReviewDailyRow')
);
assert.match(dailyRowsRenderer, /<td>\$\{renderReviewDateCell\(row\)\}<\/td>/);
assert.doesNotMatch(dailyRowsRenderer,
    /<td>\$\{renderReviewDateCell\(row\)\}\$\{renderSeventhDayBadges\(row\)\}<\/td>/);
assert.match(dailyRowsRenderer,
    /rowPresentation\.apologistiko\.text[\s\S]{0,250}renderSeventhDayBadges\(row\)/);
assert.match(dailyRowsRenderer,
    /tdClass\(`\$\{rowPresentation\.apologistiko\.className\} text-center`\)/);
const apologistikoCell = dailyRowsRenderer.slice(
    dailyRowsRenderer.indexOf('${rowPresentation.apologistiko.text}'),
    dailyRowsRenderer.indexOf('</td>',
        dailyRowsRenderer.indexOf('${rowPresentation.apologistiko.text}'))
);
assert.ok(apologistikoCell.indexOf('renderDeclaredRepoWithCardsBadge(row)') <
    apologistikoCell.indexOf('renderSeventhDayBadges(row)'));
assert.ok(apologistikoCell.indexOf('renderApprovedOrphanAuditBadge(row)') <
    apologistikoCell.indexOf('renderSeventhDayBadges(row)'));
assert.ok(apologistikoCell.indexOf('renderScenarioBadge(row, rowPresentation.badgeState)') <
    apologistikoCell.indexOf('renderSeventhDayBadges(row)'));

assert.equal(renderWith(lifecyclePayload(), {
    ...row, hmeromhnia: '2026-04-04'
}), '');

const nonSeriousHtml = renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis: {
        status: 'READY',
        seventhDay: { hmeromhnia: '2026-04-05', severity: 'REVIEW' }
    }
} }));
assert.match(nonSeriousHtml, /7η ημέρα εργασίας/);
assert.doesNotMatch(nonSeriousHtml, /ΣΟΒΑΡΗ ΠΑΡΑΒΑΣΗ/);

assert.equal(renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis_available: false
} })), '');

assert.equal(renderWith(lifecyclePayload({ stage4: {
    final_weekly_analysis: {
        status: 'READY',
        seventhDay: {
            hmeromhnia: '2026-04-04',
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

assert.equal(renderWith(lifecyclePayload({ employment_date_scope: {
    authoritative_date_set: ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04'],
    context_only_dates: ['2026-04-05']
} })), '');

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

const presentationScopes = sandbox.buildWeeklyHrStage1ScopesForTest([{
    employee_id: 'employee-0031', kodikos: '0031', ypokatasthma: '0000',
    hmeromhnia: '2026-04-05'
}], '2026-04-01', '2026-04-30', [], [{
    kodikos: '0031', week_apo: '2026-03-30', week_eos: '2026-04-05',
    seventh_day_date: '2026-04-05'
}]);
assert.equal(presentationScopes.size, 1);
assert.equal([...presentationScopes.values()][0].week_start, '2026-03-30');

console.log('authoritative seventh-day presentation tests: PASS');
