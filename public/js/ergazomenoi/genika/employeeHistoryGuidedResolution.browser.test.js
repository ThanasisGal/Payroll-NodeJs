'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const policy = require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const { fixture, scope, historyId } = require('../../../../test/fixtures/employeeProfileTransactionStore');

const root = path.resolve(__dirname, '../../../..');
const { asset } = require('../../../../test/fixtures/employeeMaintenanceBrowserAssets');
const endpoint = 'https://payroll.test/ergazomenoi/ergazomenoi/istoriko/update';
const fingerprint = 'a'.repeat(64);
const correction = { intent: 'REMOVE_ROW', targetHistoryId: historyId('employee', 1),
    facts: {}, confirmation: null };

function guidanceUxWorksheet(sameDates = true) {
    const worksheet=userCorrection();
    worksheet.conflicts=worksheet.conflicts.map((conflict,index)=>({
        ...conflict,kind:'PROFILE',
        period:{from:index && !sameDates ? '2026-05-01' : '2026-04-01',to:null,
            label:index && !sameDates ? '01/05/2026 — χωρίς λήξη' : '01/04/2026 — χωρίς λήξη'},
        intents:[{id:'ENTER_DIFFERENT_VALUE',label:'Ελέγχω αυτή την περίοδο',
            description:'Επιβεβαίωσε μόνο τα στοιχεία της συγκεκριμένης εγγραφής.',
            valueControl:{type:'PROFILE_FIELDS',required:true,
                baselineValues:[{value:'PROFILE_CANDIDATE_1',label:'Καταγεγραμμένη περίοδος'}],
                beforeValues:[{fieldId:'ROW_ACTION',value:'KEEP'},
                    ...(index ? [] : [{fieldId:'PAY',value:1000}]),{fieldId:'NOTE',value:null}],
                fields:[{id:'ROW_ACTION',label:'Εγγραφή περιόδου',inputType:'CATALOG_CHOICE',
                    catalogValues:[{value:'KEEP',label:'Διατήρηση της εγγραφής'},{value:'REMOVE',label:'Αφαίρεση λανθασμένης εγγραφής'}]},
                    {id:'PAY',label:'Αποδοχές',inputType:'DECIMAL',min:0},
                    {id:'NOTE',label:'Πρόσθετη πληροφορία',inputType:'TEXT',nullable:true}]}}]
    }));
    return worksheet;
}

for (const sameDates of [true,false]) test(`guidance UX: distinct records sameDates=${sameDates}, field guidance, answer retention and final-field Enter/F8`,async()=>{
    await withPage(async(page,requests)=>{
        await open(page,guidanceUxWorksheet(sameDates),{correction:{intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{},confirmation:null}});
        await nextStep(page);
        assert.match(await page.locator('.swal2-html-container').innerText(),/Βήμα 2 από 4/);
        const first=page.locator('section').filter({has:page.locator('input[name="employee-history-correction-FIRST"]')});
        const second=page.locator('section').filter({has:page.locator('input[name="employee-history-correction-SECOND"]')});
        await first.locator('input[type="radio"]').check();
        assert.match(await first.innerText(),/Ερώτηση 1/);
        assert.equal((await first.innerText()).includes('διαφορετικές ερωτήσεις με τα ίδια χρονικά όρια'),sameDates);
        assert.match(await first.innerText(),/ΔΙΑΤΗΡΗΣΗ: ισχύει η τιμή ΠΡΙΝ/);
        assert.equal(await first.locator('.employee-history-comparison-before').first().innerText(),'ΠΡΙΝ — Εγγραφή περιόδου\n\nΔιατήρηση της εγγραφής');
        await first.getByLabel('Αποδοχές',{exact:true}).fill('1250');
        await first.getByLabel('Πρόσθετη πληροφορία',{exact:true}).press('Enter');
        await second.waitFor({state:'visible'});
        await second.locator('input[type="radio"]').check();
        assert.equal(await second.getByRole('radio',{name:'Ελέγχω αυτή την περίοδο'}).isChecked(),true);
        const next=page.locator('.swal2-html-container').getByRole('button',{name:/^(Συνέχεια|Έλεγχος αλλαγών)$/});
        assert.equal(await next.isDisabled(),true);
        assert.match(await second.innerText(),/Το «Αποδοχές» χρειάζεται έγκυρη απάντηση/);
        assert.equal(await second.getByLabel('Αποδοχές',{exact:true}).getAttribute('aria-invalid'),'true');
        assert.equal(await second.getByLabel('Αποδοχές',{exact:true}).inputValue(),'');
        await second.getByLabel('Πρόσθετη πληροφορία',{exact:true}).press('Enter');
        assert.equal(await second.isVisible(),true);
        assert.equal(await second.getByLabel('Αποδοχές',{exact:true}).evaluate(input=>input===document.activeElement),true);
        await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        assert.equal(await first.getByLabel('Αποδοχές',{exact:true}).inputValue(),'1250');
        assert.equal(await first.getByLabel('Αποδοχές: ενέργεια',{exact:true}).inputValue(),'CHANGE');
        await nextStep(page);
        assert.equal(await second.locator('input[type="radio"]').isChecked(),true);
        await second.getByLabel('Αποδοχές',{exact:true}).fill('1300');
        assert.equal(await next.isEnabled(),true);
        const last=second.getByLabel('Πρόσθετη πληροφορία',{exact:true});
        await last.fill('Προσωρινή σημείωση');await last.press('F8');
        assert.equal(await second.getByLabel('Πρόσθετη πληροφορία: ενέργεια',{exact:true}).inputValue(),'CLEAR');
        assert.equal(await last.isDisabled(),true);
        // F8 leaves focus on the enabled action selector; Enter can continue directly.
        assert.equal(await second.getByLabel('Πρόσθετη πληροφορία: ενέργεια',{exact:true}).evaluate(input=>input===document.activeElement),true);
        await page.keyboard.press('Enter');
        await page.getByText('Οι απαντήσεις θα ελεγχθούν όλες μαζί.',{exact:false}).first().waitFor({state:'visible'});
        assert.equal(await page.locator('.swal2-html-container section:visible').count(),0,
            'Completed questions must stay hidden on the combined-check step');
        assert.equal(requests.length,0);
        await page.getByRole('button',{name:'Ακύρωση',exact:true}).click();
        await page.waitForFunction(()=>window.modalResult?.cancelled===true);
        assert.equal(requests.length,0);
    });
});

for(const width of [1280,1440,1600,1680,1920]) for(const sidebar of [false,true])
test(`guidance UX responsive fields at ${width}px sidebar=${sidebar}`,async()=>{
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:width===1280 ? 720 : 900});
        await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(sidebar=>{
            const shell=document.createElement('div');shell.className='sections';
            shell.style.cssText=`margin-left:${sidebar ? 280 : 0}px;width:calc(100% - ${sidebar ? 280 : 0}px)`;
            shell.innerHTML='<section><form><div class="card"><div class="card-header">Εργαζόμενος</div><div style="height:600px"></div><div class="card-footer"><button class="submitButton">Αποθήκευση</button></div></div></form></section>';
            document.body.appendChild(shell);
        },sidebar);
        await open(page,guidanceUxWorksheet(),{correction:{intent:'RECONCILE_HISTORY',facts:{},confirmation:null}});
        await nextStep(page);await page.locator('input[name="employee-history-correction-FIRST"]').check();
        const geometry=await page.evaluate(()=>{
            const popup=Swal.getPopup().getBoundingClientRect(),cancel=Swal.getCancelButton().getBoundingClientRect();
            const controls=[...Swal.getHtmlContainer().querySelectorAll('input:not([type="hidden"]),select')].filter(input=>input.getClientRects().length);
            return {overflow:document.documentElement.scrollWidth>innerWidth+1,
                popupFits:popup.left>=0 && popup.right<=innerWidth+1 && popup.top>=0 && popup.bottom<=innerHeight+1,
                cancelFits:cancel.top>=0 && cancel.bottom<=innerHeight+1,
                controlsFit:controls.every(input=>{const r=input.getBoundingClientRect();return r.left>=popup.left && r.right<=popup.right+1;}),
                readable:controls.filter(input=>input.type!=='radio').every(input=>parseFloat(getComputedStyle(input).fontSize)>=13.6)};
        });
        assert.deepEqual(geometry,{overflow:false,popupFits:true,cancelFits:true,controlsFit:true,readable:true});
        assert.equal(requests.length,0);await page.getByRole('button',{name:'Ακύρωση',exact:true}).click();
    });
});

function userCorrection() {
    return { version: 1, kind: 'USER_CONFIRMED_HISTORY_CORRECTION',
        title: 'Χρειάζεται διόρθωση του ιστορικού', explanation: 'Επιλέξτε τι ίσχυε πραγματικά.',
        responsibilityText: 'Επιβεβαιώνω ότι οι επιλογές αποτυπώνουν τα πραγματικά ιστορικά στοιχεία.',
        fingerprint, conflicts: ['FIRST', 'SECOND'].map(conflictId => ({
            conflictId, kind: 'BOUNDARY', required: true,
            period: { from: '2026-01-01', to: '2026-02-28', label: 'Ιστορική περίοδος' },
            issue: 'Χρειάζεται η πραγματική ημερομηνία έναρξης.',
            decisionRequired: 'Από πότε ίσχυαν οι όροι;',
            intents: [{ id: 'OTHER_DATE', label: 'Από άλλη ημερομηνία',
                description: 'Δηλώστε την πραγματική ημερομηνία.',
                effectiveDateControl: { type: 'DATE', required: true,
                    label: 'Ημερομηνία έναρξης', min: '2026-01-01', max: '2026-02-28' } }]
        })) };
}

function safePreview() {
    const f = fixture();
    f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-02-28';
    return policy.planHistoryCorrection({ scope, currentEmployee: f.employee,
        historyRows: f.history, request: correction, accessMode: 'ADMIN_FULL',
        catalogs: {}, insertId: historyId('employee', 9) }).public;
}

async function withPage(work, handler = null) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const requests = [];
        await page.route('https://payroll.test/**', async route => {
            if (route.request().method() === 'POST') {
                assert.equal(route.request().url(), endpoint);
                requests.push(route.request().postDataJSON());
                await route.fulfill({ contentType: 'application/json', body: JSON.stringify(
                    handler ? await handler(route.request().postDataJSON()) : {success:true}) });
            } else await route.fulfill({ contentType: 'text/html',
                body: '<!doctype html><html lang="el"><body></body></html>' });
        });
        await page.goto('https://payroll.test/');
        await page.addStyleTag(asset(root, 'node_modules/sweetalert2/dist/sweetalert2.css'));
        await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
        await page.addScriptTag(asset(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js'));
        assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
        await page.addScriptTag({ path: path.join(__dirname, 'employeeHistoryGuidedResolution.js') });
        assert.deepEqual(await page.evaluate(() => ({
            getter: typeof Swal.getConfirmButton,
            enable: typeof Swal.enableConfirmButton,
            disable: typeof Swal.disableConfirmButton
        })), { getter: 'function', enable: 'undefined', disable: 'undefined' });
        await work(page, requests);
    } finally {
        await browser.close();
    }
}

async function open(page, resolution, originalPayload = {}, status = 200) {
    await page.evaluate(({ resolution, originalPayload, endpoint, status }) => {
        window.previousModalPopup = Swal.getPopup();
        window.modalResult = null;
        window.employeeHistoryGuidedResolution.handleInitialResponse({
            response: new Response(JSON.stringify({ resolutionRequired: true, resolution }), { status }),
            originalPayload, retryRequest: payload => fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }), swal: Swal, documentRef: document, windowRef: window
        }).then(result => { window.modalResult = { cancelled: result.cancelled, status: result.response?.status }; });
    }, { resolution, originalPayload, endpoint, status });
    // Cancel resolves before its closing animation finishes. Visibility alone can
    // therefore match the previous popup instead of the one being opened.
    await page.waitForFunction(() => {
        const popup = Swal.getPopup();
        return popup && popup !== window.previousModalPopup && Swal.isVisible() &&
            popup.classList.contains('swal2-show');
    });
    await page.evaluate(async () => {
        const popup = Swal.getPopup();
        await Promise.all(popup.getAnimations().map(animation => animation.finished));
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (Swal.getPopup() !== popup) throw new Error('Popup changed while opening');
    });
}

async function nextStep(page) {
    await page.locator('.swal2-html-container').getByRole('button', { name: /^(Συνέχεια|Έλεγχος αλλαγών)$/ }).click();
}
async function finalStep(page) {
    const next = page.locator('.swal2-html-container').getByRole('button', { name: /^(Συνέχεια|Έλεγχος αλλαγών)$/ });
    for (let count = 0; await next.isVisible() && count < 40; count++) {
        assert.equal(await next.isEnabled(), true);
        await next.click();
    }
}

for (const width of [1280,1920]) test(`1.38 first entry from the real History button at ${width}x900 with sidebar`, async () => {
    const fs = require('node:fs'), ejs = require('ejs');
    const { store } = require('../../../../test/fixtures/employeeProfileTransactionStore');
    const { token, userModel } = require('../../../../test/fixtures/employeeHistorySupervisor');
    const W = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const f=fixture();f.history=[];
    Object.assign(f.employee,{hmeromhnia_proslhpshs:'2025-05-01',
        hmeromhnia_isxyos_oron_ergasias_apo:'2025-06-01',hmeromhnia_isxyos_dialleimatos_apo:'2025-06-01',
        hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});
    const db=store([f]),before=db.state();
    const filename=path.join(root,'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
    const html=ejs.render(fs.readFileSync(filename,'utf8'),{ergazomenoiData:f.employee,istorikoData:[],
        employeeHistoryAccessMode:'ADMIN_FULL',employeeHistoryStateToken:token(db)},{filename});
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:900});
        await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(html=>{
            document.body.style.margin='0';
            const shell=document.createElement('div');shell.className='sections';
            shell.style.cssText='margin-left:280px;width:calc(100% - 280px)';shell.innerHTML=html;
            document.body.appendChild(shell);
        },html);
        await page.addScriptTag({path:path.join(__dirname,'istorikoTable.js')});
        await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
        await page.locator('#employeeHistoryCorrectionStartBtn').click();
        await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Έλεγχος / Διόρθωση Ιστορικού');
        assert.equal(requests[0].correction.targetHistoryId,null);assert.deepEqual(db.state(),before);
        await page.evaluate(()=>window.firstHistoryPopup=Swal.getPopup());
        await nextStep(page);await page.locator('input[value="INITIAL_FROM_HIRE"]').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Θα καταχωριστούν'));
        assert.equal(requests.length,2);assert.deepEqual(db.state(),before);
        assert.equal(await page.evaluate(()=>window.firstHistoryPopup===Swal.getPopup()),true);
        await finalStep(page);assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
        await page.locator('input[type="checkbox"]:visible').check();
        const box=await page.locator('.swal2-confirm').boundingBox();
        assert.ok(box && box.y>=0 && box.y+box.height<=900);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Η διόρθωση αποθηκεύτηκε');
        assert.equal(requests.length,3);assert.equal(db.state().history.length,1);assert.equal(db.state().audits.length,1);
        const dimensions=await page.evaluate(()=>({page:document.documentElement.scrollWidth,window:innerWidth}));
        assert.ok(dimensions.page<=dimensions.window+1,JSON.stringify(dimensions));
    },async body=>{
        try {return await W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',
            operations:[],expectedStateToken:body.expectedStateToken,actorUserId:'admin',
            userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correction:body.correction});}
        catch(error){assert.equal(error.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
            return {success:false,resolutionRequired:true,resolution:error.resolution};}
    });
});

for (const width of [1280,1920]) for (const sidebar of [false,true])
test(`coverage correction at ${width}px sidebar=${sidebar} confirms only after preview`, async () => {
    const { store } = require('../../../../test/fixtures/employeeProfileTransactionStore');
    const { token, userModel } = require('../../../../test/fixtures/employeeHistorySupervisor');
    const W = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const f = fixture(); f.history = [f.history[2]];
    const db = store([f]), before = db.state();
    const review = { intent: 'REVIEW', targetHistoryId: f.history[0]._id, facts: {}, confirmation: null };
    const initial = policy.planHistoryCorrection({ scope, currentEmployee: f.employee,
        historyRows: f.history, request: review, accessMode: 'ADMIN_FULL', catalogs: {}, insertId: historyId('employee', 9) }).public;
    assert.equal(initial.choices[0].id, 'CONFIRM_PERIODS');
    await withPage(async (page, requests) => {
        await page.setViewportSize({width,height:900});
        await page.evaluate(({sidebar})=>{
            const shell=document.createElement('div');shell.className='sections';
            shell.style.marginLeft=sidebar?'260px':'0';shell.style.height='900px';
            document.body.appendChild(shell);
        },{sidebar});
        await open(page, initial, { employeeId: 'employee', expectedStateToken: token(db), correction: review });
        await nextStep(page);
        await page.locator('input[value="CONFIRM_PERIODS"]').check();
        assert.equal(requests.length, 0);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Επιβεβαίωση πραγματικών περιόδων');
        assert.deepEqual(db.state(), before);
        await nextStep(page);
        await page.locator('input[value="FROM_HIRE"]').check();
        await finalStep(page);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Έλεγχος / Διόρθωση Ιστορικού');
        assert.equal(requests.length, 2); assert.deepEqual(db.state(), before);
        await finalStep(page);
        assert.equal(await page.locator('.swal2-confirm').isEnabled(), false);
        const bounds=await page.locator('.swal2-confirm').boundingBox();
        assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=900);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.modalResult !== null);
        assert.equal(requests.length, 3);
        assert.equal(requests[0].correction.confirmation, null);
        assert.equal(requests[1].correction.confirmation, null);
        assert.equal(requests[2].correction.confirmation.confirmed, true);
        assert.equal(db.state().audits.length, 1);
    }, async body => {
        try {
            return await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope,
                employeeId: 'employee', operations: [], expectedStateToken: body.expectedStateToken,
                actorUserId: 'admin', userModel: userModel({ privileges: 'A', team: 'THA', situation: 'A' }),
                correction: body.correction, correctionCatalogLoader: async () => ({}), referenceChecker: async () => [] });
        } catch (error) {
            assert.equal(error.code, 'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');
            return { success: false, resolutionRequired: true, resolution: error.resolution };
        }
    });
});

async function state(page, disabled, requests, count = 0) {
    const buttons = await page.evaluate(() => ({
        exists: Swal.getConfirmButton() instanceof HTMLButtonElement,
        disabled: Swal.getConfirmButton().disabled,
        cancelDisabled: Swal.getCancelButton().disabled
    }));
    assert.deepEqual(buttons, { exists: true, disabled, cancelDisabled: false });
    assert.equal(requests.length, count);
}

test('real SweetAlert shows one period, preserves answers with Back and confirms only at the end', async () => {
    await withPage(async (page, requests) => {
        await open(page, userCorrection(), { safe: 'original' });
        await state(page, true, requests);
        assert.equal(await page.locator('input[name="employee-history-correction-FIRST"]').isVisible(), false);
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-FIRST"]').check();
        await page.locator('input[type="date"]').first().fill('2026-01-15');
        assert.equal(await page.locator('input[name="employee-history-correction-SECOND"]').isVisible(), false);
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-SECOND"]').check();
        await page.locator('input[type="date"]').last().fill('2026-02-15');
        await finalStep(page);
        await state(page, true, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await state(page, false, requests);
        await page.getByRole('button', {name: 'Πίσω', exact: true}).click();
        await nextStep(page);
        assert.equal(await page.locator('.swal2-html-container input[type="checkbox"]:visible').isChecked(), false);
        await state(page, true, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.modalResult !== null);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], { safe: 'original', resolution: { fingerprint,
            responsibilityAccepted: true, decisions: [
                { conflictId: 'FIRST', intent: 'OTHER_DATE', effectiveDate: '2026-01-15' },
                { conflictId: 'SECOND', intent: 'OTHER_DATE', effectiveDate: '2026-02-15' }
            ] } });
    });
});

test('real SweetAlert Cancel stays available before and after acceptance and sends no request', async () => {
    await withPage(async (page, requests) => {
        for (let opening = 0; opening < 10; opening += 1) {
            const accepted = opening % 2 === 1;
            await open(page, safePreview(), { correction }, accepted ? 409 : 200);
            await state(page, true, requests);
            if (accepted) {
                await finalStep(page);
                await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
                await state(page, false, requests);
            }
            await page.locator('.swal2-cancel').click();
            await page.waitForFunction(() => window.modalResult?.cancelled === true);
            assert.equal(requests.length, 0);
        }
    });
});

test('real SweetAlert preview retains preConfirm guard and sends exactly one confirmed correction', async () => {
    await withPage(async (page, requests) => {
        const preview = safePreview();
        const payload = { employeeId: 'synthetic', updates: [], expectedStateToken: 'b'.repeat(64), correction };
        await open(page, preview, payload);
        await state(page, true, requests);
        // Deliberately bypass the DOM state to prove the independent preConfirm guard remains effective.
        await page.evaluate(() => { Swal.getConfirmButton().disabled = false; Swal.clickConfirm(); });
        await page.waitForFunction(() => Swal.getValidationMessage()?.textContent.includes('Δεν αποθηκεύτηκε'));
        assert.equal(requests.length, 0);
        await finalStep(page);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await state(page, false, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').uncheck();
        await state(page, true, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await state(page, false, requests);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.modalResult?.status === 200);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], { ...payload, correction: { ...correction,
            confirmation: { fingerprint: preview.fingerprint, confirmed: true } } });
    });
});

function plannerProfileResolution(factory) {
    const fixtures = require('../../../../server/services/ergazomenoi/fixtures/userConfirmedEmployeeHistoryCorrectionFixtures');
    const analysis = require('../../../../server/services/ergazomenoi/employeeHistoryResolutionAnalysisService');
    const planner = require('../../../../server/services/ergazomenoi/employeeHistoryUserConfirmedCorrectionPlannerService');
    const plan = planner.planEmployeeHistoryUserConfirmedCorrection(fixtures[factory]());
    return analysis.buildUserConfirmedCorrectionPublicResolution({
        analysis: analysis.buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan: plan,
            sourceStateFingerprint: fingerprint }), fingerprint });
}

test('real SweetAlert single profile source is fixed for both intents while business facts remain explicit', async () => {
    await withPage(async (page, requests) => {
        await open(page, plannerProfileResolution('h1MissingInitialProfileFixture'));
        await state(page, true, requests);
        assert.equal(await page.locator('.swal2-html-container input[type="radio"]:checked').count(), 0);
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_START"][value="FROM_KNOWN_HISTORY_DATE"]').check();
        await nextStep(page);
        const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INITIAL_PROFILE_TERMS"]') });
        for (const intent of ['CONFIRM_EXISTING', 'ENTER_DIFFERENT_VALUE']) {
            await terms.locator(`input[type="radio"][value="${intent}"]`).check();
            assert.equal(await terms.locator('input[type="hidden"]:enabled').inputValue(), 'PROFILE_CANDIDATE_1');
            const visible = await terms.innerText();
            assert.match(visible, /Καταχωρημένοι όροι εργασίας/);
            assert.match(visible, /Οι όροι που είναι καταχωρημένοι στην εγγραφή της 25\/05\/2026/);
            assert.match(visible, /Οι ημερομηνίες ισχύος επιβεβαιώνονται χωριστά/);
            assert.doesNotMatch(visible, /PROFILE_CANDIDATE|h1-later-profile|aa_eggrafhs/);
            await state(page, true, requests);
        }
        // A fixed baseline cannot supply the four historical facts requested by
        // ENTER_DIFFERENT_VALUE; all four must still be entered by the user.
        await state(page, true, requests);
        await terms.locator('select:enabled').selectOption('0109');
        const numbers = terms.locator('input[type="number"]:enabled');
        await numbers.nth(0).fill('5');
        await numbers.nth(1).fill('40');
        await state(page, true, requests);
        await numbers.nth(2).fill('8');
        await finalStep(page);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await state(page, false, requests);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').uncheck();
        await state(page, true, requests);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.modalResult?.cancelled === true);
        assert.equal(requests.length, 0);
    });
});

test('real SweetAlert multiple profile sources require an explicit source with clear Greek labels', async () => {
    await withPage(async (page, requests) => {
        await open(page, plannerProfileResolution('h3IntermediateOverlapFixture'));
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-INITIAL_PROFILE_START"][value="FROM_HIRE"]').check();
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-INTERMEDIATE_PERIOD_MEANING"][value="CONFIRM_REAL_PERIOD"]').check();
        await nextStep(page);
        await page.locator('input[name="employee-history-correction-INTERMEDIATE_PROFILE_TERMS"][value="CONFIRM_EXISTING"]').check();
        const terms = page.locator('section').filter({ has: page.locator('input[name="employee-history-correction-INTERMEDIATE_PROFILE_TERMS"]') });
        const select = terms.locator('select:enabled');
        assert.equal(await select.inputValue(), '');
        assert.deepEqual(await select.locator('option').allTextContents(), ['Επιλέξτε…',
            'Οι καταχωρημένοι όροι της εγγραφής 17/05/2026',
            'Οι καταχωρημένοι όροι της εγγραφής 25/05/2026']);
        const visible = await terms.innerText();
        assert.match(visible, /Οι ημερομηνίες ισχύος επιβεβαιώνονται χωριστά/);
        assert.doesNotMatch(visible, /PROFILE_CANDIDATE|h3-earlier-profile|h3-later-profile/);
        await state(page, true, requests);
        await select.selectOption('PROFILE_CANDIDATE_2');
        await state(page, true, requests);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.modalResult?.cancelled === true);
        assert.equal(requests.length, 0);
    });
});

for(const width of [1280,1440,1680,1920]) for(const sidebar of [false,true]) {
    test(`withdrawal preview fits actual Chromium at ${width}px, sidebar=${sidebar}`,async()=>{
        await withPage(async(page,requests)=>{
            await page.setViewportSize({width,height:900});
            await page.evaluate(({sidebar})=>{
                const shell=document.createElement('div');shell.className='sections';
                shell.style.marginLeft=sidebar?'280px':'0';
                shell.innerHTML='<section><form><div class="card" style="height:850px;display:flex;flex-direction:column"><div class="card-header" style="height:60px">Εργαζόμενος</div><div style="flex:1"></div><div class="card-footer" style="height:70px"><button class="submitButton" type="button">Αποθήκευση</button></div></div></form></section>';
                document.body.appendChild(shell);
            },{sidebar});
            const f=fixture();
            f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-02-28';
            const resolution=policy.planHistoryCorrection({scope,currentEmployee:f.employee,historyRows:f.history,
                request:correction,accessMode:'ADMIN_FULL',targetReferences:[{
                    collection:'Apasxoliseis_Weekly_Canonical_Decisions',documentId:'synthetic'}]}).public;
            await open(page,resolution,{correction});
            const bounds=await page.locator('.swal2-popup').evaluate(popup=>{
                const rect=popup.getBoundingClientRect(),actions=popup.querySelector('.swal2-actions').getBoundingClientRect();
                const html=popup.querySelector('.swal2-html-container');
                return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
                    actionsBottom:actions.bottom,overflow:html.scrollWidth>html.clientWidth+1,
                    font:parseFloat(getComputedStyle(html).fontSize)};
            });
            assert.ok(bounds.left>=0&&bounds.right<=width+1);
            assert.ok(bounds.top>=0&&bounds.bottom<=900);
            assert.ok(bounds.actionsBottom<=900);assert.equal(bounds.overflow,false);assert.ok(bounds.font>=13.6);
            await page.locator('.swal2-cancel').click();
            await page.waitForFunction(()=>window.modalResult?.cancelled===true);
            assert.equal(requests.length,0);
        });
    });
}

test('withdrawal guided dates lead to a preview and require a separate final confirmation',async()=>{
    const f=fixture();f.history[0].hmeromhnia_isxyos_oron_ergasias_eos=null;
    let confirmed=0;
    const proposal=body=>policy.planHistoryCorrection({scope,currentEmployee:f.employee,historyRows:f.history,
        request:body.correction,accessMode:'ADMIN_FULL'}).public;
    await withPage(async(page,requests)=>{
        await open(page,proposal({correction}),{correction});
        await nextStep(page);
        await page.locator('.swal2-html-container input[type="radio"]').check();
        await page.locator('.swal2-html-container input[type="date"]').fill('2026-02-28');
        await finalStep(page);
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => document.querySelector('.swal2-html-container')?.textContent.includes('Έλεγξε τη διόρθωση πριν την αποθηκεύσεις.'));
        await finalStep(page);
        assert.equal(requests.length,1);assert.equal(confirmed,0);
        assert.equal(requests[0].correction.confirmation,null);
        assert.equal(requests[0].correction.facts.periodCorrections[0].effectiveDate,'2026-02-28');
        await page.locator('.swal2-html-container input[type="checkbox"]:visible').check();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>window.modalResult?.cancelled===false);
        assert.equal(requests.length,2);assert.equal(confirmed,1);
        assert.equal(requests[1].correction.confirmation.confirmed,true);
    },async body=>{
        if(body.correction.confirmation) {confirmed++;return {success:true};}
        return {resolutionRequired:true,resolution:proposal(body)};
    });
});

for (const width of [1280,1920]) test(`different terms missing period atomic flow at ${width}x900 with visible sidebar`, async()=>{
    const {store}=require('../../../../test/fixtures/employeeProfileTransactionStore');
    const {token,userModel}=require('../../../../test/fixtures/employeeHistorySupervisor');
    const W=require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const {sanitizedEmployeeHistoryResolution}=require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],
        CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    const values=['0101','01','01','01','5','35','7','900','1000','1000'];
    const f=fixture();f.history=[];Object.assign(f.employee,{hmeres_ergasias_ebdomadas:5,
        ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8});
    const db=store([f]),before=db.state();
    const request={intent:'FILL_MISSING_PERIODS',targetHistoryId:null,facts:{},confirmation:null};
    const options={...db.deps,scope,employeeId:'employee',operations:[],actorUserId:'admin',
        userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs};
    let worksheet;
    try{await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:token(db),correction:request});}
    catch(e){worksheet=sanitizedEmployeeHistoryResolution(e.resolution);}
    assert.ok(worksheet);
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:900});
        await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(()=>{
            const sidebar=document.createElement('aside');sidebar.textContent='Μενού';
            sidebar.style.cssText='position:fixed;left:0;top:0;width:280px;height:900px;background:#ddd';
            document.body.appendChild(sidebar);
            const shell=document.createElement('div');shell.className='sections';
            shell.style.cssText='margin-left:280px;width:calc(100% - 280px)';
            shell.innerHTML='<section class="visible"><form><div class="card"><div class="card-header">Εργαζόμενος</div><div style="height:720px"></div><div class="card-footer"><button class="submitButton" type="button">Αποθήκευση</button></div></div></form></section>';
            document.body.appendChild(shell);
        });
        await open(page,worksheet,{employeeId:'employee',expectedStateToken:token(db),correction:request});
        await nextStep(page);
        await page.locator('input[value="ENTER_DIFFERENT_VALUE"]').check();
        const fields=page.locator('section [data-profile-field]:not([data-profile-optional])').filter({visible:true});
        assert.equal(await fields.count(),10);
        for(let i=0;i<10;i++) {
            const input=fields.nth(i);
            if(i<4)await input.selectOption(values[i]);else await input.fill(values[i]);
        }
        const facts=JSON.parse(JSON.stringify(f.employee));
        for(const field of worksheet.conflicts[0].intents[0].valueControl.fields.filter(field=>field.optional)) {
            const value=field.id === 'dialleima_se_lepta' ? 20 : facts[field.id];
            const mode=page.getByLabel(`${field.label}: ενέργεια`,{exact:true});
            if(value == null || value === '') await mode.selectOption('CLEAR');
            else {
                await mode.selectOption('CHANGE');
                await page.locator(`[data-profile-field="${field.id}"]`).fill(Array.isArray(value) ? value.join(',') || '0' :
                    typeof value === 'boolean' ? value ? 'Ναι' : 'Όχι' : String(value).slice(0,field.inputType==='DATE'?10:undefined));
            }
        }
        assert.equal(await page.getByRole('button',{name:/^(Συνέχεια|Έλεγχος αλλαγών)$/}).isEnabled(),true,
            JSON.stringify(await page.locator('.employee-history-comparison-row').evaluateAll(rows=>rows.map(row=>({
                mode:row.getAttribute('data-edit-state'),name:row.querySelector('[data-profile-field]')?.getAttribute('data-profile-field'),
                value:row.querySelector('[data-profile-field]')?.value,message:row.querySelector('[role="status"]')?.textContent})))));
        await nextStep(page);await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        assert.equal(await fields.nth(5).inputValue(),'35');
        await nextStep(page);
        assert.equal(await page.locator('input[type="checkbox"]:visible').count(),0);
        await page.evaluate(()=>window.totalCorrectionPopup=Swal.getPopup());
        assert.deepEqual(db.state(),before);assert.equal(requests.length,0);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Έλεγξε τους πραγματικούς όρους όλων'));
        assert.equal(requests.length,1);assert.deepEqual(db.state(),before);
        assert.equal(await page.evaluate(()=>window.totalCorrectionPopup===Swal.getPopup()),true);
        assert.equal(await page.locator('.swal2-html-container > .employee-history-safe-correction').count(),1);
        await finalStep(page);
        assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
        const bounds=await page.locator('.swal2-popup').boundingBox();
        assert.ok(bounds.x>=280 && bounds.x+bounds.width<=width+1,JSON.stringify({bounds,layout:await page.evaluate(()=>({card:document.querySelector('.sections .card').getBoundingClientRect().toJSON(),popup:Swal.getPopup().style.cssText,section:getComputedStyle(document.querySelector('.sections')).cssText}))}));
        assert.ok(bounds.y>=0 && bounds.y+bounds.height<=901,JSON.stringify(bounds));
        await page.locator('input[type="checkbox"]:visible').check();await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>window.modalResult!==null);
        assert.equal(requests.length,2);assert.equal(db.state().audits.length,1);assert.equal(db.state().history.length,2);
        assert.equal(db.state().history.find(r=>new Date(r.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10)==='2026-01-01').ores_ergasias_ebdomadas,35);
        assert.equal(db.state().history.find(r=>new Date(r.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10)==='2026-01-01').dialleima_se_lepta,20);
    },async payload=>{
        try{return await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:payload.expectedStateToken,correction:payload.correction});}
        catch(e){return {success:false,resolutionRequired:e.resolutionRequired,resolution:sanitizedEmployeeHistoryResolution(e.resolution)};}
    });
});

for(const width of [1280,1920]) test(`before/after Enter F8 button undo and real sidebar at ${width}x900`,async()=>{
    const fs=require('node:fs'),ejs=require('ejs');
    const sidebar=ejs.render(fs.readFileSync(path.join(root,'views/partials/sidebar.ejs'),'utf8'),{
        userRole:'A',isAdminOrSupervisorRole:()=>true,NODE_ENV:'test',nonce:'',userId:'synthetic',script:()=>''});
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:900});
        await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(sidebar=>{
            const nav=document.createElement('aside');nav.innerHTML=sidebar;document.body.appendChild(nav);
            const menu=document.getElementById('sidebarMenu');menu.style.cssText='position:fixed;left:0;top:0;width:280px;height:900px;display:block;z-index:1';
            const shell=document.createElement('div');shell.className='sections';
            shell.style.cssText='margin-left:280px;width:calc(100% - 280px)';
            shell.innerHTML='<section class="visible"><form><div class="card"><div class="card-header">Εργαζόμενος</div><div style="height:740px"></div><div class="card-footer">Ενέργειες</div></div></form></section>';
            document.body.appendChild(shell);
            const grid=document.createElement('div');grid.className='employee-history-profile-comparison';
            const api=window.employeeHistoryGuidedResolution;
            window.comparisonFields=[
                api.buildBeforeAfterField(document,{id:'PAY',label:'Αποδοχές',inputType:'DECIMAL',min:0},1200),
                api.buildBeforeAfterField(document,{id:'OPTIONAL',label:'Στοιχείο σύμβασης',inputType:'TEXT',nullable:true},'Παλαιό'),
                api.buildBeforeAfterField(document,{id:'MISSING',label:'Πραγματική τιμή',inputType:'TEXT',nullable:true},undefined)];
            for(const item of window.comparisonFields)grid.appendChild(item.wrapper);
            window.confirmedByKeyboard=0;
            Swal.fire({titleText:'Διόρθωση Ιστορικού',html:grid,allowEnterKey:false,showCancelButton:true,
                confirmButtonText:'Έλεγχος αλλαγών',cancelButtonText:'Ακύρωση',
                customClass:{popup:'employee-history-correction-popup',htmlContainer:'employee-history-correction-html'},
                preConfirm(){window.confirmedByKeyboard++;return false;}});
            api.applyCorrectionModalGeometry(Swal.getPopup(),api.findActiveEmployeeCardBounds(document,window),window);
        },sidebar);
        const pay=page.getByLabel('Αποδοχές',{exact:true}),optional=page.getByLabel('Στοιχείο σύμβασης',{exact:true});
        await pay.fill('1300');await pay.fill('');await pay.press('Enter');await optional.waitFor();
        assert.equal(await optional.evaluate(input=>input===document.activeElement),true);
        assert.deepEqual(await page.evaluate(()=>comparisonFields[0].value()),{value:1200});
        await optional.fill('Νέο');await optional.press('F8');
        assert.equal(await optional.inputValue(),'');
        assert.deepEqual(await page.evaluate(()=>comparisonFields[1].value()),{value:null});
        await page.locator('.employee-history-comparison-row').nth(1).getByRole('button',{name:'Αναίρεση',exact:true}).click();
        assert.equal(await optional.inputValue(),'Νέο');
        await page.locator('.employee-history-comparison-row').nth(1).getByRole('button',{name:'Κενό (F8)',exact:true}).click();
        assert.equal(await page.evaluate(()=>comparisonFields[1].state.action),'CLEAR');
        await pay.press('F8');
        assert.equal(await page.evaluate(()=>comparisonFields[0].state.action),'KEEP');
        assert.match(await page.locator('.employee-history-comparison-row').first().innerText(),/είναι υποχρεωτικό/);
        assert.equal(await page.evaluate(()=>window.confirmedByKeyboard),0);assert.equal(requests.length,0);
        const [before,after]=await page.locator('.employee-history-comparison-row').first().locator(':scope > div').all();
        const a=await before.boundingBox(),b=await after.boundingBox();assert.ok(b.x>a.x && Math.abs(a.y-b.y)<2);
        const popup=await page.locator('.swal2-popup').boundingBox(),menu=await page.locator('#sidebarMenu').boundingBox();
        assert.ok(menu && popup.x>=menu.x+menu.width-1);assert.ok(popup.x+popup.width<=width+1 && popup.y+popup.height<=901);
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await page.screenshot({path:path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,`before-after-${width}.png`),animations:'disabled'});
        await page.evaluate(()=>Swal.close());
    });
});

for(const width of [1280,1920]) test(`unified History correction combines two periods with one final commit at ${width}x900`,async()=>{
    const fs=require('node:fs'),ejs=require('ejs');
    const {store}=require('../../../../test/fixtures/employeeProfileTransactionStore');
    const {token,userModel}=require('../../../../test/fixtures/employeeHistorySupervisor');
    const W=require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const {sanitizedEmployeeHistoryResolution}=require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const f=fixture();for(const row of [...f.history,f.employee])Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    const db=store([f]),before=db.state();
    const request={intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{},confirmation:null};
    const options={...db.deps,scope,employeeId:'employee',operations:[],actorUserId:'admin',userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs};
    let worksheet;try{await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:token(db),correction:request});}catch(e){worksheet=sanitizedEmployeeHistoryResolution(e.resolution);}
    assert.ok(worksheet);assert.equal(worksheet.conflicts.length,3);
    const sidebar=ejs.render(fs.readFileSync(path.join(root,'views/partials/sidebar.ejs'),'utf8'),{userRole:'A',isAdminOrSupervisorRole:()=>true,NODE_ENV:'test',nonce:'',userId:'synthetic',script:()=>''});
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:900});await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(sidebar=>{const nav=document.createElement('aside');nav.innerHTML=sidebar;document.body.appendChild(nav);document.getElementById('sidebarMenu').style.cssText='position:fixed;left:0;top:0;width:280px;height:900px;display:block;z-index:1';
            const shell=document.createElement('div');shell.className='sections';shell.style.cssText='margin-left:280px;width:calc(100% - 280px)';shell.innerHTML='<section class="visible"><form><div class="card"><div class="card-header">Εργαζόμενος</div><div style="height:740px"></div><div class="card-footer">Ενέργειες</div></div></form></section>';document.body.appendChild(shell);},sidebar);
        await open(page,worksheet,{employeeId:'employee',expectedStateToken:token(db),correction:request});await nextStep(page);
        for(let index=0;index<3;index++){
            const section=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${worksheet.conflicts[index].conflictId}"]`)});
            await section.locator('input[type="radio"]').check();
            if(index===0)await section.getByLabel('Λήξη περιόδου',{exact:true}).fill('2026-02-04');
            if(index===1)await section.getByLabel('Έναρξη περιόδου',{exact:true}).fill('2026-02-05');
            await nextStep(page);
        }
        await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        await nextStep(page);
        assert.equal(await page.locator('input[type="checkbox"]:visible').count(),0);
        await page.evaluate(()=>window.totalCorrectionPopup=Swal.getPopup());
        assert.equal(requests.length,0);assert.deepEqual(db.state(),before);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Έλεγξε τη συνολική διόρθωση'));
        assert.equal(requests.length,1);assert.deepEqual(db.state(),before);
        assert.equal(await page.evaluate(()=>window.totalCorrectionPopup===Swal.getPopup()),true);
        await finalStep(page);assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
        await page.locator('input[type="checkbox"]:visible').check();await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>window.modalResult!==null);
        assert.equal(requests.length,2);assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
        assert.deepEqual(db.state().history.map(row=>row._id).sort(),f.history.map(row=>row._id).sort());
    },async payload=>{try{return await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:payload.expectedStateToken,correction:payload.correction});}catch(e){return {success:false,resolutionRequired:e.resolutionRequired,resolution:sanitizedEmployeeHistoryResolution(e.resolution)};}});
});

test('dependent worksheet reopens with recorded answers and without carrying old approval',async()=>{
    const {planUnifiedHistoryCorrection}=require('../../../../server/services/ergazomenoi/employeeHistoryUnifiedCorrectionService');
    const f=fixture();for(const row of [...f.history,f.employee])Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    const params={scope,currentEmployee:f.employee,historyRows:f.history,catalogs,insertId:'507f1f77bcf86cd799439199'};
    const initial=planUnifiedHistoryCorrection(params);
    const periods=initial.conflicts.map(c=>({conflictId:c.conflictId,intent:'ENTER_DIFFERENT_VALUE',value:'PROFILE_CANDIDATE_1',values:Object.fromEntries(c.intents[0].valueControl.beforeValues.map(item=>[item.fieldId,item.value]))}));
    periods[1].values.PERIOD_START='2026-02-05';
    const r={intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{periods},confirmation:null};
    const worksheet=policy.planHistoryCorrection({...params,request:r,accessMode:'ADMIN_FULL'}).public;
    assert.equal(worksheet.conflicts.length,4);
    await withPage(async(page,requests)=>{
        await open(page,worksheet,{correction:r});await nextStep(page);await nextStep(page);
        const current=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${worksheet.conflicts[1].conflictId}"]`)});
        assert.equal(await current.locator('input[type="radio"]').isChecked(),true);
        assert.equal(await current.getByLabel('Έναρξη περιόδου',{exact:true}).inputValue(),'2026-02-05');
        assert.equal(await current.getByLabel('Έναρξη περιόδου: ενέργεια',{exact:true}).inputValue(),'CHANGE');
        assert.equal(await current.getByLabel('Πραγματικές αποδοχές: ενέργεια',{exact:true}).inputValue(),'KEEP');
        assert.equal(await page.locator('.form-check-input[type="checkbox"]').evaluateAll(inputs=>inputs.every(input=>!input.checked)),true);
        assert.equal(requests.length,0);await page.getByRole('button',{name:'Ακύρωση',exact:true}).click();
    });
});

for(const width of [1280,1920]) for(const lifecycle of ['hire','departure']) test(`unified ${lifecycle} correction has one approval and commit at ${width}x900`,async()=>{
    const fs=require('node:fs'),ejs=require('ejs');
    const {store}=require('../../../../test/fixtures/employeeProfileTransactionStore');
    const {token,userModel}=require('../../../../test/fixtures/employeeHistorySupervisor');
    const W=require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const {sanitizedEmployeeHistoryResolution}=require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const f=fixture();for(const row of [...f.history,f.employee])Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    if(lifecycle==='departure'){Object.assign(f.employee,{hmeromhnia_apoxorhshs:'2026-03-31',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31',energos:false});Object.assign(f.history[2],{hmeromhnia_apoxorhshs:'2026-03-31',hmeromhnia_isxyos_oron_ergasias_eos:'2026-03-31'});}
    const db=store([f]),before=db.state();
    db.deps.connection.collection=()=>({findOne:async()=>null});
    const request={intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{},confirmation:null};
    const options={...db.deps,scope,employeeId:'employee',operations:[],actorUserId:'admin',userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs};
    let worksheet;try{await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:token(db),correction:request});}catch(e){worksheet=sanitizedEmployeeHistoryResolution(e.resolution);}
    assert.ok(worksheet);assert.equal(worksheet.conflicts.length,3);
    const sidebar=ejs.render(fs.readFileSync(path.join(root,'views/partials/sidebar.ejs'),'utf8'),{userRole:'A',isAdminOrSupervisorRole:()=>true,NODE_ENV:'test',nonce:'',userId:'synthetic',script:()=>''});
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height:900});await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.evaluate(sidebar=>{const nav=document.createElement('aside');nav.innerHTML=sidebar;document.body.appendChild(nav);document.getElementById('sidebarMenu').style.cssText='position:fixed;left:0;top:0;width:280px;height:900px;display:block;z-index:1';
            const shell=document.createElement('div');shell.className='sections';shell.style.cssText='margin-left:280px;width:calc(100% - 280px)';shell.innerHTML='<section class="visible"><form><div class="card"><div class="card-header">Εργαζόμενος</div><div style="height:740px"></div><div class="card-footer">Ενέργειες</div></div></form></section>';document.body.appendChild(shell);},sidebar);
        await open(page,worksheet,{employeeId:'employee',expectedStateToken:token(db),correction:request});await nextStep(page);
        for(let index=0;index<3;index++){
            const section=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${worksheet.conflicts[index].conflictId}"]`)});
            await section.locator('input[type="radio"]').check();
            if(lifecycle==='hire' && index===0){
                const hire=section.getByLabel('Πρόσληψη του συγκεκριμένου κύκλου',{exact:true});
                assert.equal(await hire.getAttribute('max'),'2026-01-01');
                assert.match(await section.innerText(),/Μεταγενέστερη πρόσληψη δεν διατίθεται/);
                await hire.fill('2026-01-02');
                assert.equal(await page.getByRole('button',{name:'Συνέχεια',exact:true}).isEnabled(),false);
                assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
                assert.equal(requests.length,0);
                await hire.fill('2025-12-31');await section.getByLabel('Έναρξη περιόδου',{exact:true}).fill('2025-12-31');
            }
            if(lifecycle==='departure' && index===0)await section.getByLabel('Πραγματικές αποδοχές',{exact:true}).fill('1100');
            if(lifecycle==='departure' && index===2)await section.getByLabel('Αποχώρηση του συγκεκριμένου κύκλου',{exact:true}).fill('2026-04-01');
            await nextStep(page);
        }
        await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        await nextStep(page);
        assert.equal(await page.locator('input[type="checkbox"]:visible').count(),0);
        await page.evaluate(()=>window.totalCorrectionPopup=Swal.getPopup());
        assert.equal(requests.length,0);assert.deepEqual(db.state(),before);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Έλεγξε τη συνολική διόρθωση'));
        assert.equal(requests.length,1);assert.deepEqual(db.state(),before);
        assert.equal(await page.evaluate(()=>window.totalCorrectionPopup===Swal.getPopup()),true);
        await finalStep(page);assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
        await page.locator('input[type="checkbox"]:visible').check();await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>window.modalResult!==null);
        assert.equal(requests.length,2);assert.equal(db.state().audits.length,1);assert.equal(db.events.filter(e=>e.type==='commit').length,1);
        assert.equal(new Date(db.state().employees[0][lifecycle==='hire'?'hmeromhnia_proslhpshs':'hmeromhnia_apoxorhshs']).toISOString().slice(0,10),lifecycle==='hire'?'2025-12-31':'2026-04-01');
        assert.deepEqual(db.state().history.map(row=>row._id).sort(),f.history.map(row=>row._id).sort());
    },async payload=>{try{return await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:payload.expectedStateToken,correction:payload.correction});}catch(e){return {success:false,resolutionRequired:e.resolutionRequired,resolution:sanitizedEmployeeHistoryResolution(e.resolution)};}});
});

for (const [width,height,sidebar] of [[1920,1080,true],[1280,720,false],[960,720,true]])
test(`central automatic action collects two gaps in one popup at ${width}x${height} sidebar=${sidebar}`,async()=>{
    const fs=require('node:fs'),ejs=require('ejs');
    const {store}=require('../../../../test/fixtures/employeeProfileTransactionStore');
    const {token,userModel}=require('../../../../test/fixtures/employeeHistorySupervisor');
    const W=require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const {CORRECTION_FIELD_REGISTRY}=require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionFieldRegistryService');
    const {sanitizedEmployeeHistoryResolution}=require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const f=fixture();for(const row of [...f.history,f.employee])Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});
    f.history[0].hmeromhnia_isxyos_oron_ergasias_eos='2026-01-15';
    f.history[1].hmeromhnia_isxyos_oron_ergasias_eos='2026-02-15';
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    const db=store([f]),before=db.state();db.deps.connection.collection=()=>({findOne:async()=>null});
    const filename=path.join(root,'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
    const html=ejs.render(fs.readFileSync(filename,'utf8'),{ergazomenoiData:f.employee,istorikoData:f.history,
        employeeHistoryAccessMode:'ADMIN_FULL',employeeHistoryStateToken:token(db)},{filename});
    let lastResolution,previewCount=0;
    await withPage(async(page,requests)=>{
        await page.setViewportSize({width,height});await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.addScriptTag({path:path.join(root,'public/js/bootstrap.bundle.min.js')});
        await page.evaluate(({html,sidebar})=>{
            const shell=document.createElement('div');shell.className='sections';
            shell.style.cssText=sidebar?'margin-left:280px;width:calc(100% - 280px)':'width:100%';
            shell.innerHTML='<section class="visible"><form><div class="card"><div class="card-header">Εργαζόμενος</div>'+html+'<div class="card-footer"><button type="button" class="submitButton">Αποθήκευση</button></div></div></form></section>';
            document.body.appendChild(shell);
        },{html,sidebar});
        await page.addScriptTag({path:path.join(__dirname,'istorikoTable.js')});
        await page.addScriptTag({path:path.join(__dirname,'employeeHistoryReconstructionPreview.js')});
        await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
        await page.locator('#employeeHistoryReconstructionPreviewBtn').click();
        await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Συνολική τακτοποίηση Ιστορικού');
        assert.equal(requests.length,1);assert.equal(requests[0].correction.intent,'RECONCILE_HISTORY');
        const worksheet=lastResolution;assert.equal(worksheet.conflicts.filter(c=>c.conflictId.startsWith('GAP_')).length,2);
        await page.evaluate(()=>window.centralHistoryPopup=Swal.getPopup());
        await nextStep(page);
        for(const conflict of worksheet.conflicts){
            const section=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${conflict.conflictId}"]`)});
            await section.locator('input[type="radio"]').check();
            if(conflict.conflictId.startsWith('GAP_')){
                await section.locator('.ms-4 > select').selectOption('PROFILE_CANDIDATE_2');
                for(const field of conflict.intents[0].valueControl.fields){
                    const name=CORRECTION_FIELD_REGISTRY.find(entry=>entry.id===field.id)?.fields[0] || field.id;
                    const value=f.history[0][name],input=section.locator(`[data-profile-field="${field.id}"]`);
                    if(value==null || value==='')await input.press('F8');
                    else if(field.inputType==='CATALOG_CHOICE')await input.selectOption(String(value));
                    else await input.fill(Array.isArray(value)?value.join(',') || '0':typeof value==='boolean'?value?'Ναι':'Όχι':value instanceof Date?value.toISOString().slice(0,10):String(value));
                }
            }
            await nextStep(page);
        }
        assert.equal(await page.locator('input[type="checkbox"]:visible').count(),0);
        assert.equal(requests.length,1);assert.deepEqual(db.state(),before);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Έλεγξε τη συνολική διόρθωση'));
        assert.equal(await page.evaluate(()=>window.centralHistoryPopup===Swal.getPopup()),true);
        assert.equal(await page.locator('.swal2-html-container > .employee-history-safe-correction').count(),1);
        assert.equal(previewCount,1);assert.deepEqual(db.state(),before);
        await finalStep(page);
        assert.equal(await page.locator('input[type="checkbox"]:visible').count(),1);
        assert.equal(await page.locator('.swal2-confirm').isEnabled(),false);
        const geometry=await page.locator('.swal2-popup').boundingBox();
        assert.ok(geometry.x>=0 && geometry.x+geometry.width<=width+1,JSON.stringify(geometry));
        if(sidebar)assert.ok(geometry.x>=280,JSON.stringify(geometry));
        assert.ok(geometry.y>=0 && geometry.y+geometry.height<=height+1,JSON.stringify(geometry));
        const action=await page.locator('.swal2-confirm').boundingBox();
        assert.ok(action.y>=0 && action.y+action.height<=height+1,JSON.stringify(action));
        if(process.env.PAYROLL_VISUAL_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,`central-two-gaps-${width}-${sidebar}.png`),animations:'disabled'});
        await page.locator('input[type="checkbox"]:visible').check();await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Η διόρθωση αποθηκεύτηκε');
        assert.equal(requests.length,3);assert.equal(requests.filter(r=>r.correction.confirmation).length,1);
        assert.equal(db.state().history.length,5);assert.equal(db.state().audits.length,1);
        assert.equal(db.events.filter(event=>event.type==='commit').length,1);
    },async payload=>{
        try{await W.writeEmployeeEmploymentHistoryOperations({...db.deps,scope,employeeId:'employee',operations:[],expectedStateToken:payload.expectedStateToken,
            actorUserId:'admin',userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs,correction:payload.correction});return {success:true};}
        catch(error){assert.equal(error.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');lastResolution=sanitizedEmployeeHistoryResolution(error.resolution);
            if(lastResolution.phase==='PREVIEW')previewCount++;return {success:false,resolutionRequired:true,resolution:lastResolution};}
    });
});

test('new gap and preview editing preserve every answer and source inside the same physical popup',async()=>{
    const {store}=require('../../../../test/fixtures/employeeProfileTransactionStore');
    const {token,userModel}=require('../../../../test/fixtures/employeeHistorySupervisor');
    const W=require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const {CORRECTION_FIELD_REGISTRY}=require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionFieldRegistryService');
    const {sanitizedEmployeeHistoryResolution}=require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const f=fixture();for(const row of [...f.history,f.employee])Object.assign(row,{krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,nomimosMisthos:900,pragmatikosMisthos:1000,synolo_symbashs:1000,eidikh_kathgoria_ergazomenoy:null});
    const catalogs={KPK_EFKA:[{code:'0101',label:'Ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Σύμβαση'}],CONTRACT_CATEGORY:[{code:'01',label:'Κατηγορία',afora_thn_symbash:'01'}],CONTRACT_SPECIALTY:[{code:'01',label:'Ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
    const db=store([f]),before=db.state();db.deps.connection.collection=()=>({findOne:async()=>null});
    const request={intent:'RECONCILE_HISTORY',targetHistoryId:null,facts:{},confirmation:null};
    const options={...db.deps,scope,employeeId:'employee',operations:[],actorUserId:'admin',userModel:userModel({privileges:'A',team:'THA',situation:'A'}),correctionCatalogLoader:async()=>catalogs};
    let current;
    async function handle(payload){try{await W.writeEmployeeEmploymentHistoryOperations({...options,expectedStateToken:payload.expectedStateToken,correction:payload.correction});return {success:true};}
        catch(error){assert.equal(error.code,'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED');current=sanitizedEmployeeHistoryResolution(error.resolution);return {resolutionRequired:true,resolution:current};}}
    await handle({expectedStateToken:token(db),correction:request});const initial=current;
    await withPage(async(page,requests)=>{
        await open(page,initial,{employeeId:'employee',expectedStateToken:token(db),correction:request});
        await page.evaluate(()=>window.dependentPopup=Swal.getPopup());await nextStep(page);
        for(let i=0;i<3;i++){
            const section=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${initial.conflicts[i].conflictId}"]`)});
            await section.locator('input[type="radio"]').check();
            if(i===1)await section.getByLabel('Έναρξη περιόδου',{exact:true}).fill('2026-02-05');
            await nextStep(page);
        }
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>document.querySelectorAll('.swal2-html-container section').length===4);
        assert.equal(await page.evaluate(()=>window.dependentPopup===Swal.getPopup()),true);
        assert.deepEqual(db.state(),before);assert.equal(requests.length,1);
        const gap=current.conflicts.find(c=>c.conflictId.startsWith('GAP_'));
        assert.equal(await page.locator(`input[name="employee-history-correction-${gap.conflictId}"]`).isVisible(),true);
        await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        await page.getByRole('button',{name:'Πίσω',exact:true}).click();
        assert.equal(await page.getByLabel('Έναρξη περιόδου',{exact:true}).filter({visible:true}).inputValue(),'2026-02-05');
        await nextStep(page);await nextStep(page);
        const section=page.locator('section').filter({has:page.locator(`input[name="employee-history-correction-${gap.conflictId}"]`)});
        await section.locator('input[type="radio"]').check();await section.locator('.ms-4 > select').selectOption('PROFILE_CANDIDATE_2');
        for(const field of gap.intents[0].valueControl.fields){
            const name=CORRECTION_FIELD_REGISTRY.find(entry=>entry.id===field.id)?.fields[0] || field.id;
            const value=f.history[0][name],input=section.locator(`[data-profile-field="${field.id}"]`);
            if(value==null || value==='')await input.press('F8');
            else if(field.inputType==='CATALOG_CHOICE')await input.selectOption(String(value));
            else await input.fill(Array.isArray(value)?value.join(',') || '0':typeof value==='boolean'?value?'Ναι':'Όχι':value instanceof Date?value.toISOString().slice(0,10):String(value));
        }
        await nextStep(page);await page.locator('.swal2-confirm').click();
        await page.waitForFunction(()=>Swal.getHtmlContainer()?.textContent.includes('Έλεγξε τη συνολική διόρθωση'));
        await finalStep(page);await page.locator('input[type="checkbox"]:visible').check();
        await page.getByRole('button',{name:'Αλλαγή απαντήσεων',exact:true}).click();
        assert.equal(await page.evaluate(()=>window.dependentPopup===Swal.getPopup()),true);
        assert.equal(await page.locator('.swal2-html-container > .employee-history-safe-correction').count(),1);
        await nextStep(page);await nextStep(page);await nextStep(page);await nextStep(page);
        assert.equal(await section.locator('.ms-4 > select').inputValue(),'PROFILE_CANDIDATE_2');
        assert.equal(await section.getByLabel('Ώρες εργασίας ανά εβδομάδα',{exact:true}).inputValue(),'40');
        assert.equal(requests.length,2);assert.deepEqual(db.state(),before);
        await page.getByRole('button',{name:'Ακύρωση',exact:true}).click();
        await page.waitForFunction(()=>window.modalResult?.cancelled===true);
        assert.equal(db.state().audits.length,0);assert.equal(db.events.some(event=>event.type==='commit'),false);
    },handle);
});
