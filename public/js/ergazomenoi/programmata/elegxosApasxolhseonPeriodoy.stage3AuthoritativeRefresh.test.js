'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const rowId = '6a7c515e6aeaefb3c8764c37';
const staleRow = {
    _id: rowId,
    hmeromhnia: '2026-06-30',
    ypokatasthma: '0000',
    kodikos: '0015',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
    adeia_apologistika: false
};
let authoritativeRow = {
    ...staleRow,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ',
    adeia_apologistika: true,
    ores_ergasias_apologistika: 8,
    ores_pragmatikhs_ergasias_apologistika: 0
};

const sandbox = {
    console,
    URLSearchParams,
    CSS: { escape: String },
    document: {
        addEventListener: () => {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
            addEventListener: () => {}, appendChild: () => {},
            classList: { add: () => {}, toggle: () => {} }, dataset: {}, style: {}
        }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {} }
    },
    window: {},
    fetch: async () => ({
        ok: true,
        json: async () => ({
            success: true,
            scope: { ypokatasthma: '0000', employee_id: 'employee-15',
                employee_kodikos: '0015', week_start: '2026-06-29', week_end: '2026-07-05' },
            rows: [authoritativeRow],
            lifecycle_projection: { stages: { stage1: { business_status: 'COMPLETED' } } }
        })
    }),
    setTimeout: () => {},
    clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });
vm.runInContext(`
    currentReviewRows = [${JSON.stringify(staleRow)}];
    renderWeeklyHrStage1Presentation = () => {};
    updateEmploymentReviewWorkflowPresentation = () => {};
    this.runRefresh = refreshWeeklyHrStage1Scope;
    this.currentRow = () => currentReviewRows[0];
    this.modalPresentation = () => renderApologistikaFields(currentReviewRows[0]);
    this.gridPresentation = () => resolveReviewApologistikoPresentation(currentReviewRows[0], {});
`, sandbox);

(async () => {
    for (const leaveCategory of ['ΑΔΚΑΝ', 'ΑΔΑΠ']) {
        authoritativeRow = { ...authoritativeRow,
            kathgoria_adeias_apologistika: leaveCategory };
        vm.runInContext(`currentReviewRows = [${JSON.stringify(staleRow)}];`, sandbox);
        assert.equal(sandbox.currentRow().kathgoria_adeias_apologistika, 'POSSIBLE_LEAVE');
        assert.equal(sandbox.currentRow().adeia_apologistika, false);

        await sandbox.runRefresh({ ypokatasthma: '0000', employee_id: 'employee-29',
            employee_kodikos: '0029', week_start: '2026-06-29', week_end: '2026-07-05' });

        assert.equal(sandbox.currentRow().adeia_apologistika, true);
        assert.equal(sandbox.currentRow().kathgoria_adeias_apologistika, leaveCategory);
        assert.equal(sandbox.currentRow().ores_ergasias_apologistika, 8);
        assert.equal(sandbox.currentRow().ores_pragmatikhs_ergasias_apologistika, 0);
        assert.equal(sandbox.gridPresentation().text, 'ΑΔΕΙΑ');
        const modalHtml = sandbox.modalPresentation();
        assert.match(modalHtml, /id="edit_adeia_apologistika"[\s\S]*?checked/);
        assert.ok(modalHtml.includes(`value="${leaveCategory}"`));
        assert.doesNotMatch(modalHtml, /<strong>Κατάσταση:<\/strong> ΠΙΘΑΝΗ ΑΔΕΙΑ/);
    }
    assert.match(source,
        /if \(result\.record\) updateAuthoritativeReviewDailyRow\(result\.record\)/);
    console.log('Stage 3 authoritative refresh regression test passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
