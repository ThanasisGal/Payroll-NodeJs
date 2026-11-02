'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { buildEmployeeHistorySettlementPreview: project } = require('../../../../server/services/ergazomenoi/employeeHistorySettlementPreviewService');
const { planEmployeeHistoryAutomaticSettlement: settle } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const M = require('../../../../server/services/ergazomenoi/fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const B = require('../../../../server/services/ergazomenoi/fixtures/businessFactEmployeeHistoryResolutionFixtures');
const root = path.resolve(__dirname, '../../../..');
const modal = '#employeeSettlementPreviewModal';
const body = '#employeeSettlementPreviewBody';
const trigger = '#employeeHistoryReconstructionPreviewBtn';
const approve = '#employeeSettlementPreviewApprove';
const screenshots = '/tmp/payroll-phase3a-visual';
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); fs.mkdirSync(screenshots, { recursive: true }); });
after(async () => { await browser?.close(); });
function fixture(kind) {
    const input = kind === 'decision' ? M.samePeriodMateriallyDifferentProfilesFixture() : F.real0006BoundaryStructure();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    input.protectedReferenceSummary ||= Object.fromEntries(input.completeHistoryRows.map(row => [String(row._id), [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-frozen' }]]));
    if (kind === 'clean') input.completeHistoryRows = settle(input).proposedRows;
    if (kind === 'unknown') input.protectedReferenceSummary = {};
    return { input, preview: project(input) };
}
async function withPage({ kind = 'automatic', width = 1280, height = 800, sidebar = false, delay = 0, payload, status = 200, historyInput, accessMode = 'ADMIN_FULL' } = {}, work) {
    const { input: defaultInput, preview } = fixture(kind);
    const input = historyInput || defaultInput;
    const page = await browser.newPage({ viewport: { width, height } });
    const requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.route('**/*', async route => {
            const request = route.request();
            if (request.url().includes('/history-reconstruction-preview')) {
                requests.push({ url: request.url(), method: request.method() });
                if (delay) await new Promise(resolve => setTimeout(resolve, delay));
                return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload || { success: true, settlementPreview: preview }) }).catch(() => {});
            }
            assert.equal(request.method(), 'GET');
            const partial = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
                ergazomenoiData: input.currentEmployee, istorikoData: input.completeHistoryRows,
                employeeHistoryAccessMode: accessMode, employeeHistoryStateToken: 'synthetic', problematicHistoryIds: [] });
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el"><meta charset="utf-8"><body><aside id="syntheticSidebar"></aside><main>${partial}<button type="button" id="independentAction">Ανεξάρτητη λειτουργία</button></main></body></html>` });
        });
        await page.goto('https://payroll.test/');
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css']) await page.addStyleTag({ path: path.join(root, file) });
        await page.addStyleTag({ content: `main { margin-left:${sidebar ? 280 : 0}px; min-width:0; } #syntheticSidebar { width:${sidebar ? 280 : 0}px; position:fixed; inset:0 auto 0 0; background:#edf0f3; }` });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'public/js/ergazomenoi/genika/employeeHistoryAutomaticSettlementPreview.js',
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js']) await page.addScriptTag({ path: path.join(root, file) });
        await page.evaluate(() => {
            window.guidedCalls = 0;
            window.employeeHistoryGuidedResolution = {};
            document.getElementById('employeeHistoryCorrectionStartBtn')?.addEventListener('click', () => { window.guidedCalls += 1; });
            document.getElementById('independentAction').addEventListener('click', () => { window.independentContinued = true; });
            document.dispatchEvent(new Event('DOMContentLoaded'));
        });
        await work({ page, requests, preview });
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.guidedCalls), 0);
        assert.ok(requests.every(request => request.method === 'GET' && request.url.endsWith('?presentation=settlement')));
    } finally { await page.close(); }
}
async function open(page) {
    await page.click(trigger);
    await page.locator(`${body} .employee-settlement-message`).waitFor();
    await page.waitForTimeout(350);
}
async function close(page) {
    await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.modal-backdrop').count(), 0);
    assert.equal(await page.locator(trigger).evaluate(node => node === document.activeElement), true);
}
for (const width of [1280, 1366, 1600, 1920]) for (const sidebar of [false, true])
test(`Chromium ${width}px sidebar=${sidebar}: automatic proposal, report and ephemeral approval`, async () => {
    await withPage({ width, sidebar }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(`${body} input`).count(), 0, 'approved assumptions never prompt');
        assert.equal(await page.locator(approve).textContent(), 'Έγκριση & Τακτοποίηση');
        const geometry = await page.locator(modal).evaluate(element => {
            const content = element.querySelector('.modal-content').getBoundingClientRect();
            const footer = element.querySelector('.modal-footer').getBoundingClientRect();
            return { fits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
                footerFits: footer.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth,
                font: parseFloat(getComputedStyle(element.querySelector('.modal-body')).fontSize) };
        });
        assert.equal(geometry.fits, true, JSON.stringify(geometry));
        assert.equal(geometry.footerFits, true);
        assert.equal(geometry.overflow, false);
        assert.ok(geometry.font >= 15.2);
        await page.screenshot({ path: `${screenshots}/automatic-${width}-sidebar-${sidebar}.png` });
        await page.click('#employeeSettlementPreviewDetails');
        assert.equal(await page.locator('#employeeSettlementPreviewTitle').textContent(), 'Προβολή διορθώσεων');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Εγκεκριμένες υποθέσεις.*23\/04\/2026/s);
        await page.click('#employeeSettlementPreviewBack');
        await page.click(approve);
        assert.match(await page.locator(body).innerText(), /εγκρίθηκε μόνο για προεπισκόπηση.*Δεν αποθηκεύτηκε/s);
        assert.equal(await page.locator(approve).isDisabled(), true);
        assert.equal(requests.length, 1);
        await close(page);
        await open(page);
        assert.equal(await page.locator(approve).isEnabled(), true, 'approval is discarded when closed');
        await close(page);
    });
});
test('clean History has exact success message and no approval', async () => {
    await withPage({ kind: 'clean' }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
    });
});
test('business decisions use unselected radios and report choices without applying them', async () => {
    await withPage({ kind: 'decision', width: 1366, sidebar: true }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(`${body} input[type=radio]`).count(), 3);
        assert.equal(await page.locator(`${body} input:checked`).count(), 0);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Δεν έχουν συμπληρωθεί οι απαιτούμενες επιλογές/);
        await page.click('#employeeSettlementPreviewBack');
        await page.locator(`${body} input[type=radio]`).first().check();
        assert.equal(await page.locator(approve).isEnabled(), true);
        await page.screenshot({ path: `${screenshots}/decision-1366-sidebar-true.png` });
        await page.click(approve);
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /2 ημέρες \/ 14 ώρες.*επανέλεγχο.*Δεν αποθηκεύτηκε/s);
        assert.equal(requests.length, 1);
        await close(page);
    });
});
for (const failure of [false, true]) test(`unknown/error ${failure} preserves independent actions and hides approval`, async () => {
    await withPage({ kind: 'unknown', ...(failure ? { status: 500, payload: { stack: 'SECRET_INTERNAL' } } : {}) }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), failure ? /1\..*Επανάληψη.*2\..*ΙΣΤ-ΑΥΤ-3Τ/s : /1\..*διαχειριστή.*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
        if (failure) assert.doesNotMatch(await page.locator(body).innerText(), /ΙΣΤ-ΑΥΤ-3Α/);
        assert.doesNotMatch(await page.locator(body).innerText(), /SECRET_INTERNAL/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
    });
});
test('closing an in-flight preview aborts and prevents stale content', async () => {
    await withPage({ delay: 700 }, async ({ page }) => {
        await page.click(trigger);
        await page.waitForTimeout(350);
        await close(page);
        await page.waitForTimeout(750);
        assert.equal(await page.locator(body).innerText(), '');
        assert.equal(await page.locator(trigger).isEnabled(), true);
    });
});
test('malformed preview content cannot report a clean History', async () => {
    await withPage({ payload: { success: true, settlementPreview: { state: 'clean', previewOnly: true,
        questions: [], assumptions: [{}], actions: [] } } }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), /ΙΣΤ-ΑΥΤ-3Τ/);
        assert.doesNotMatch(await page.locator(body).innerText(), /ΙΣΤ-ΑΥΤ-3Α|είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
    });
});
test('report escapes strings and stays scrollable at 390×640 with accessible footer', async () => {
    const preview = fixture('automatic').preview;
    preview.assumptions.push('<img src=x onerror="window.injected=true">');
    preview.actions.push(...Array.from({ length: 50 }, () => 'Προτεινόμενη αλλαγή για έλεγχο.'));
    await withPage({ width: 390, height: 640, payload: { success: true, settlementPreview: preview } }, async ({ page }) => {
        await open(page);
        await page.click('#employeeSettlementPreviewDetails');
        const geometry = await page.locator(modal).evaluate(element => {
            const body = element.querySelector('.modal-body'), footer = element.querySelector('.modal-footer').getBoundingClientRect();
            return { scrolls: body.scrollHeight > body.clientHeight, footerFits: footer.bottom <= innerHeight,
                fits: body.scrollWidth <= body.clientWidth };
        });
        assert.deepEqual(geometry, { scrolls: true, footerFits: true, fits: true });
        assert.equal(await page.locator(`${modal} img`).count(), 0);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        await page.screenshot({ path: `${screenshots}/report-390x640.png` });
        await close(page);
    });
});

test('conditional factual dates appear only when needed, enforce bounds and leave hidden answers out of the report', async () => {
    const input = B.competingDepartureDatesFixture();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const preview = project(input);
    assert.equal(preview.state, 'decision');
    await withPage({ payload: { success: true, settlementPreview: preview } }, async ({ page, requests }) => {
        await open(page);
        const date = page.locator(`${body} input[type=date]`);
        assert.equal(await date.isVisible(), false);
        await page.locator(`${body} input[value=DEPARTED_ON_OTHER_DATE]`).check();
        assert.equal(await date.isVisible(), true);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill('2026-01-01');
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill('2026-08-18');
        assert.equal(await page.locator(approve).isEnabled(), true);
        await page.locator(`${body} input[value=NO_DEPARTURE]`).check();
        assert.equal(await date.isVisible(), false);
        assert.equal(await date.isDisabled(), true);
        await page.click(approve);
        const report = await page.locator('#employeeSettlementPreviewReport').innerText();
        assert.match(report, /Δεν πραγματοποιήθηκε αποχώρηση/);
        assert.doesNotMatch(report, /2026-08-18/);
        assert.equal(requests.length, 1);
        await close(page);
    });
});

test('business option date inputs require a value and remain disabled for unselected alternatives', async () => {
    const input = M.correctionFromHireOrSpecialtyChangeFixture();
    input.completeHistoryRows.forEach(row => Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    const preview = project(input);
    const option = preview.questions[0].options.find(option => option.inputs?.length);
    assert.ok(option);
    await withPage({ payload: { success: true, settlementPreview: preview } }, async ({ page }) => {
        await open(page);
        const date = page.locator(`${body} input[type=date]`);
        await page.locator(`${body} input[value="${option.id}"]`).check();
        assert.equal(await date.isVisible(), true);
        assert.equal(await page.locator(approve).isDisabled(), true);
        await date.fill(option.inputs[0].min);
        assert.equal(await page.locator(approve).isEnabled(), true);
        const other = preview.questions[0].options.find(item => !item.inputs?.length);
        await page.locator(`${body} input[value="${other.id}"]`).check();
        assert.equal(await date.isVisible(), false);
        assert.equal(await date.isDisabled(), true);
        await close(page);
    });
});


const Unified = require('../../../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const { buildUnifiedEmployeeHistorySettlementPreview: unifiedProject } = require('../../../../server/services/ergazomenoi/employeeHistorySettlementPreviewService');
const why = '#employeeSettlementPreviewWhy';
for (const [width,height] of [[1920,1080],[1280,720],[390,640]]) for (const sidebar of [false,true])
test(`settlement explanation: Chromium ${width}x${height} sidebar=${sidebar}, back and no writes without apply permission`, async () => {
    const data = Unified.families.find(item => item.number === 26).make(), before = JSON.stringify(data);
    const preview = unifiedProject(data);
    await withPage({width,height,sidebar,historyInput:data,accessMode:'NONE',
        payload:{success:true,executionMode:'PREVIEW_ONLY',settlementPreview:preview}}, async ({page,requests}) => {
        await open(page);
        assert.equal(await page.locator(why).isVisible(),true);
        assert.equal(await page.locator(approve).isVisible(),false);
        await page.click(why);
        const report = await page.locator('#employeeSettlementPreviewReport').innerText();
        for (const label of ['Α. Τι ελέγξαμε;', 'Β. Τι βρήκαμε στο δικό σας Ιστορικό;', 'Γ. Ένα παράδειγμα για να καταλάβετε', 'Δ. Γιατί δεν διορθώσαμε αυτόματα το Ιστορικό;', 'Ε. Τι πρέπει να κάνετε τώρα;']) assert.ok(report.includes(label));
        assert.match(report,/διαφορετικές ημερομηνίες αποχώρησης/);
        assert.match(report,/Α\/Α 0001.*31\/07\/2026/s);
        assert.match(report,/Α\/Α 0002.*10\/08\/2026/s);
        const example = page.locator('.employee-settlement-hypothetical');
        assert.match(await example.innerText(), /Υποθετικό παράδειγμα.*δεν είναι στοιχεία του εργαζομένου/s);
        assert.equal(await example.locator('h6').innerText(), 'Γ. Ένα παράδειγμα για να καταλάβετε');
        assert.doesNotMatch(report, /διαγνωστικ|κανονικοποίη|υποψήφια σχέδια|εσωτερική επαλήθευση|ασφαλής τελική διάταξη|CLEAN|fingerprint|canonical|620000000000|SYNTHETIC/i);
        assert.equal(await page.locator('#employeeSettlementPreviewReport input, #employeeSettlementPreviewReport button').count(), 0);
        assert.ok(await page.locator('#employeeSettlementPreviewReport strong').count() > 0);
        assert.match(report,/Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal(await page.locator('#employeeSettlementPreviewBack').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator(why).getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator(`${modal}.show`).count(),1);
        const geometry = await page.locator(`${modal} .modal-content`).evaluate(el=>{
            const r=el.getBoundingClientRect(),footer=el.querySelector('.modal-footer').getBoundingClientRect(),body=el.querySelector('.modal-body');
            return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,footer:footer.bottom<=innerHeight,overflow:body.scrollWidth>body.clientWidth,font:parseFloat(getComputedStyle(body).fontSize)};
        });
        assert.equal(geometry.fits,true,JSON.stringify(geometry));assert.equal(geometry.footer,true);assert.equal(geometry.overflow,false);assert.ok(geometry.font>=13.6);
        await page.screenshot({path:`${screenshots}/explanation-${width}-${sidebar}.png`});
        await page.click('#employeeSettlementPreviewBack');
        assert.equal(await page.locator(body).isVisible(),true);
        assert.equal(await page.locator(why).evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#employeeSettlementPreviewDetails').isVisible(),false);
        assert.equal(await page.locator(approve).isVisible(),false);
        await page.click(why);
        await page.click('#employeeSettlementPreviewContinue');
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.modal-backdrop').count(),0);
        assert.equal(requests.length,1,'explanation and back make no requests');
        assert.equal(JSON.stringify(data),before);
    });
});
test('settlement explanation: technical loading failure offers retry and never a business explanation', async () => {
    await withPage({status:500,payload:{success:false,reason:'SECRET_INTERNAL',stack:'SECRET_STACK'}}, async ({page,requests})=>{
        await open(page);
        assert.equal(await page.locator(why).isVisible(),false);
        assert.equal(await page.getByRole('button',{name:'Επανάληψη ελέγχου',exact:true}).isVisible(),true);
        assert.doesNotMatch(await page.locator(body).innerText(),/SECRET|αντίφαση/);
        assert.equal(await page.locator(approve).isVisible(),false);
        await close(page);
        assert.equal(requests.length,1);
    });
});
test('settlement explanation: displayed row references match the real sorted table and remain text only', async ()=>{
    const {sortHistoryForPresentation}=require('../../../../server/utils/ergazomenoi/employmentHistoryPresentation');
    const {buildSettlementExplanation}=require('../../../../server/services/ergazomenoi/employeeHistorySettlementExplanationService');
    const first=Unified.period(91,{to:'2026-01-31',aa_eggrafhs:'9999'}),second=Unified.period(92,{from:'2026-03-01',aa_eggrafhs:'0000'});
    const data=Unified.input([second,first]);
    const explanation=buildSettlementExplanation({completeHistoryRows:data.completeHistoryRows,plan:{reason:'HISTORY_COVERAGE_MISSING',attempts:[{solver:'EXISTING_STATE',coverageGaps:[{hire:'2026-01-01',from:'2026-02-01',to:'2026-02-28',beforeHistoryId:first._id,afterHistoryId:second._id}]}]}});
    explanation.checks.push('<img src=x onerror="window.injected=true">');
    data.completeHistoryRows=sortHistoryForPresentation(data.completeHistoryRows);
    await withPage({historyInput:data,payload:{success:true,settlementPreview:{state:'unknown',previewOnly:true,executionEnabled:false,questions:[],assumptions:[],actions:[],explanation}}},async({page,requests})=>{
        await open(page);await page.click(why);
        const table=page.locator('#istorikoTable tbody tr.istoriko-row');
        assert.equal(await table.nth(0).getAttribute('data-id'),first._id);
        assert.equal(await table.nth(0).locator('.istoriko-aa-col').innerText(),'0001');
        assert.equal(await table.nth(1).getAttribute('data-id'),second._id);
        const report=await page.locator('#employeeSettlementPreviewReport').innerText();
        assert.match(report,/Α\/Α 0001, 0002/);assert.match(report,/01\/02\/2026 έως 28\/02\/2026/);
        assert.doesNotMatch(report,/9999|620000000000/);
        assert.equal(await page.locator(`${modal} img`).count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
        assert.equal(requests.length,1);await close(page);
    });
});


for (const width of [1440, 390]) test(`settlement explanation: general failure ${width}px separates uncertainty, example and recorded facts`, async () => {
    const { buildSettlementExplanation } = require('../../../../server/services/ergazomenoi/employeeHistorySettlementExplanationService');
    const data = Unified.families.find(item => item.number === 26).make();
    const explanation = buildSettlementExplanation({ plan: { reason: 'CANONICAL_STATE_NOT_CLEAN' } });
    await withPage({ width, height: width === 390 ? 640 : 900, historyInput: data, accessMode: 'NONE',
        payload: { success: true, settlementPreview: { state: 'unknown', previewOnly: true, executionEnabled: false,
            questions: [], assumptions: [], actions: [], explanation } } }, async ({ page, requests }) => {
        await open(page);
        await page.click(why);
        const sections = page.locator('#employeeSettlementPreviewReport section');
        assert.equal(await sections.count(), 5);
        const actual = await sections.nth(1).innerText();
        assert.match(actual, /Δεν μπορέσαμε να εντοπίσουμε με βεβαιότητα ποια εγγραφή χρειάζεται διόρθωση/);
        assert.doesNotMatch(actual, /\d{2}\/\d{2}\/\d{4}|Α\/Α|40 ώρες|20 ώρες/);
        const example = page.locator('.employee-settlement-hypothetical');
        await example.scrollIntoViewIfNeeded();
        assert.match(await example.innerText(), /Υποθετικό παράδειγμα.*δεν είναι στοιχεία του εργαζομένου/s);
        const style = await example.evaluate(el => ({ background: getComputedStyle(el).backgroundColor,
            border: parseFloat(getComputedStyle(el).borderInlineStartWidth) }));
        assert.notEqual(style.background, 'rgba(0, 0, 0, 0)');
        assert.ok(style.border >= 3);
        await page.screenshot({ path: `${screenshots}/general-example-${width}.png` });
        await sections.nth(4).scrollIntoViewIfNeeded();
        assert.ok(await sections.nth(4).locator('ol li').count() >= 2);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(await page.locator('#employeeSettlementPreviewReport input, #employeeSettlementPreviewReport button').count(), 0);
        await page.click('#employeeSettlementPreviewBack');
        assert.equal(await page.locator(body).isVisible(), true);
        assert.equal(await page.locator(why).evaluate(el => el === document.activeElement), true);
        assert.equal(requests.length, 1);
        await close(page);
    });
});
