'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const cssPath = path.join(__dirname, '../../../css/main.css');
const viewPath = path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs');
const source = fs.readFileSync(sourcePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const view = fs.readFileSync(viewPath, 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `Boundary UI helper is missing: ${name}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = bodyStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === quote) quote = '';
            continue;
        }
        if (character === '\'' || character === '"' || character === '`') {
            quote = character;
        } else if (character === '{') {
            depth += 1;
        } else if (character === '}' && --depth === 0) {
            return source.slice(start, index + 1);
        }
    }
    assert.fail(`Boundary UI helper is incomplete: ${name}`);
}

const helperNames = [
    'stage1DateKey',
    'formatStage1DateKey',
    'isFullCalendarMonthRange',
    'enumerateStage1DateKeys',
    'fullMonthBoundaryRanges',
    'compactStage1DateRange',
    'compactBoundaryCoverageDateRange',
    'boundaryCoverageStatusLabel'
];
const helpers = vm.runInNewContext(`(() => {
    ${helperNames.map(extractFunction).join('\n')}
    return { ${helperNames.join(', ')} };
})()`);

assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-01', '2026-01-31'), true);
assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-02', '2026-01-31'), false);
assert.strictEqual(helpers.isFullCalendarMonthRange('2026-01-01', '2026-01-30'), false);

assert.deepStrictEqual(
    JSON.parse(JSON.stringify(helpers.fullMonthBoundaryRanges('2026-01-01', '2026-01-31'))),
    {
        previous: ['2025-12-29', '2025-12-30', '2025-12-31'],
        next: ['2026-02-01']
    }
);
assert.strictEqual(helpers.fullMonthBoundaryRanges('2026-01-02', '2026-01-31'), null);
assert.strictEqual(
    helpers.compactStage1DateRange(['2025-12-29', '2025-12-31']),
    '29/12/2025–31/12/2025'
);
assert.strictEqual(
    helpers.compactBoundaryCoverageDateRange(['2025-12-29', '2025-12-31']),
    '29–31/12/2025'
);
assert.strictEqual(helpers.boundaryCoverageStatusLabel('CARD_DATA_FOUND'),
    'Εντοπίστηκαν δεδομένα Ψηφιακών Καρτών');
assert.strictEqual(helpers.boundaryCoverageStatusLabel('NO_CARD_DATA_FOUND'),
    'Δεν εντοπίστηκαν δεδομένα Ψηφιακών Καρτών');
assert.strictEqual(helpers.boundaryCoverageStatusLabel('NOT_REQUIRED'), 'Δεν απαιτείται');

assert.match(source, /let currentEmploymentReviewBoundaryContextPreflight = null;/);
assert.match(source, /async function loadResults\(\)[\s\S]*?currentEmploymentReviewBoundaryContextPreflight = null;/);
assert.match(source,
    /currentEmploymentReviewBoundaryContextPreflight = payload\.finalized === true[\s\S]*?payload\.boundaryContextPreflight \|\| null;/);

const boundarySectionStart = source.indexOf('function showEmploymentReviewBoundaryContextDialog()');
const boundarySectionEnd = source.indexOf('function naturalWeekScopeForRow(', boundarySectionStart);
assert.ok(boundarySectionStart >= 0 && boundarySectionEnd > boundarySectionStart,
    'Boundary dialog and summary section must be present');
const boundarySection = source.slice(boundarySectionStart, boundarySectionEnd);
assert.match(boundarySection, /function showEmploymentReviewBoundaryContextDialog\(\)/);
assert.match(boundarySection, /function renderEmploymentReviewBoundaryContextSummary\([^)]*\)/);
assert.match(boundarySection, /currentEmploymentReviewBoundaryContextPreflight\?\.\[sideKey\]/);
assert.match(boundarySection,
    /document\.getElementById\('employmentReviewBoundaryContextButton'\)/);
assert.match(boundarySection,
    /button\.onclick = \(\) => \{ showEmploymentReviewBoundaryContextDialog\(\); \};/);
assert.doesNotMatch(boundarySection, /\bfetch\s*\(/);
assert.doesNotMatch(boundarySection, /CardPairResolver|resolveCardPair|preHire|postDeparture/);

assert.match(source,
    /renderWeeklyHrStage1[\s\S]*?renderEmploymentReviewBoundaryContextSummary\(search_start, search_end\);/);
assert.match(source,
    /didClose: \(\) => requestAnimationFrame\(\(\) => refreshEmploymentReviewStickyLayout\(\)\)/);
assert.match(source,
    /function refreshEmploymentReviewStickyLayout\(\)[\s\S]*?const preservedScrollTop = scrollContainer\.scrollTop;[\s\S]*?updateWeeklyDeviationStickyMetrics\(\);[\s\S]*?scrollContainer\.scrollTop = preservedScrollTop;/);

assert.match(view, /<button type="button" id="employmentReviewBoundaryContextButton"/);
assert.match(view, /Πληροφορίες οριακών εβδομάδων/);
assert.doesNotMatch(view, /<button[^>]*id="employmentReviewBoundaryContextButton"[^>]*type="submit"/);

assert.match(css, /\.employment-review-boundary-context-button\s*\{/);
assert.match(css, /\.employment-review-boundary-sides\s*\{[\s\S]*?display: grid;/);
assert.match(css, /\.employment-review-boundary-dialog details summary\s*\{/);
assert.match(css, /\.employment-review-boundary-dialog\s*\{[\s\S]*?overflow: visible;/);
assert.match(css,
    /\.swal2-popup\.employment-review-boundary-popup\s*\{[\s\S]*?max-height: calc\(100vh - 2rem\);[\s\S]*?overflow: hidden;/);

console.log('Boundary UI regression tests: PASS');
