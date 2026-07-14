const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const documentStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    createElement: () => ({
        addEventListener: () => {},
        appendChild: () => {},
        classList: { add: () => {}, toggle: () => {} },
        dataset: {},
        setAttribute: () => {},
        style: {}
    }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} }
};
const sandbox = {
    console,
    document: documentStub,
    window: {},
    URLSearchParams,
    setTimeout: () => {},
    clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });

function holidayRow(overrides = {}) {
    return {
        hmeromhnia: '2026-06-01',
        holiday_description: 'Αγίου Πνεύματος',
        holiday_is_mandatory: false,
        holiday_is_optional: true,
        holiday_company_operates: true,
        holiday_blocks_repo_transfer: false,
        ...overrides
    };
}

function render(row) {
    return sandbox.renderReviewDateCell(row);
}

function testDescriptionAndDateShareTheDateCellContent() {
    const html = render(holidayRow());
    assert.ok(html.includes('Δε'));
    assert.ok(html.includes('01/06/2026'));
    assert.ok(html.includes('review-holiday-description-badge'));
    assert.ok(html.includes('Αγίου Πνεύματος'));
    assert.ok(!html.includes('<td'));
}

function testOrdinaryDateHasNoBadge() {
    const html = render({ hmeromhnia: '2026-06-02' });
    assert.ok(html.includes('02/06/2026'));
    assert.ok(!html.includes('review-holiday-description-badge'));
}

function testOptionalHolidayTooltips() {
    assert.ok(render(holidayRow()).includes('η εταιρεία λειτουργεί'));
    assert.ok(
        render(holidayRow({ holiday_company_operates: false })).includes(
            'η εταιρεία είναι κλειστή'
        )
    );
}

function testMandatoryHolidayTooltip() {
    const html = render(
        holidayRow({
            holiday_is_mandatory: true,
            holiday_is_optional: false,
            holiday_company_operates: true
        })
    );
    assert.ok(html.includes('Υποχρεωτική αργία'));
}

function testDescriptionIsAlwaysEscaped() {
    const html = render(
        holidayRow({ holiday_description: '<script>alert("x")</script>' })
    );
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&quot;x&quot;'));
}

function testLongDescriptionCannotInjectRawHtmlOrHandlers() {
    const description = `${'Πολύ μεγάλη περιγραφή '.repeat(30)}<img src=x onerror=alert(1)>`;
    const html = render(holidayRow({ holiday_description: description }));
    assert.ok(html.includes('01/06/2026'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(!/<[^>]+\son[a-z]+\s*=/i.test(html));
}

function testRenderRowsUsesHelperOnlyForFirstCell() {
    assert.ok(source.includes('<td>${renderReviewDateCell(row)}</td>'));
    assert.strictEqual((source.match(/renderReviewDateCell\(row\)/g) || []).length, 1);
}

[
    testDescriptionAndDateShareTheDateCellContent,
    testOrdinaryDateHasNoBadge,
    testOptionalHolidayTooltips,
    testMandatoryHolidayTooltip,
    testDescriptionIsAlwaysEscaped,
    testLongDescriptionCannotInjectRawHtmlOrHandlers,
    testRenderRowsUsesHelperOnlyForFirstCell
].forEach((test) => test());

console.log('PASS review holiday description badge (10 assertions/contracts)');
