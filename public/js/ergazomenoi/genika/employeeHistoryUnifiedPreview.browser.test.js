'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {startUnifiedPreviewHarness}=require('../../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const {forbidRealSettlementMongo}=require('../../../../test/fixtures/forbidRealSettlementMongo');
const F=require('../../../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const A=require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const modal='#employeeSettlementPreviewModal',body='#employeeSettlementPreviewBody',approve='#employeeSettlementPreviewApprove';
const screenshots='/tmp/payroll-history-unified-chromium';let browser;
before(async()=>{forbidRealSettlementMongo(mock);fs.mkdirSync(screenshots,{recursive:true});browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
async function withPage({data=F.references(F.initialGap()),width=1280,height=800,sidebar=false,fullForm=true,failReferences=false}={},work){
    const h=await startUnifiedPreviewHarness({data,fullForm,failReferences});
    const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(10000);
    const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,h.origin,'only isolated loopback HTTP is permitted');requests.push({url:route.request().url(),method:route.request().method()});return route.continue();});
    try{await page.goto(h.origin);if(sidebar)await page.evaluate(()=>document.body.classList.add('sidebar-open'));
        if(fullForm)assert.equal(await page.locator('.employee-edit-page').count(),1);
        const before=A.stringify(h.state);await work({page,...h,requests});
        assert.equal(A.stringify(h.state),before,'preview, factual choice and approval must never write');assert.equal(h.counts.applyRequests,0);
        assert.deepEqual(errors,[]);
    }catch(error){console.log(JSON.stringify({message:error.message,errors,body:await page.locator(body).textContent(),trigger:await page.locator('#employeeHistoryReconstructionPreviewBtn').evaluate(node=>({visible:node.getBoundingClientRect().toJSON(),disabled:node.disabled,section:node.closest('section')?.className}))}));throw error;}finally{await page.close();await h.close();}
}
async function open(page){await page.locator('#employeeHistoryReconstructionPreviewBtn').click();await page.locator(`${body} .employee-settlement-message`).waitFor();await page.waitForTimeout(350);}
async function geometry(page){return page.locator(modal).evaluate(node=>{const box=node.querySelector('.modal-content').getBoundingClientRect(),footer=node.querySelector('.modal-footer').getBoundingClientRect(),content=node.querySelector('.modal-body');
    return{fits:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,footerFits:footer.bottom<=innerHeight,overflow:content.scrollWidth>content.clientWidth,font:parseFloat(getComputedStyle(content).fontSize)};});}
async function continueIndependent(page){if(await page.locator('.employee-edit-page').count()){await page.locator('.menu_Links li').first().click();assert.equal(await page.locator('.sel_1_section').evaluate(node=>node.classList.contains('visible')),true);}else{await page.locator('#independentAction').click();assert.equal(await page.evaluate(()=>window.independentContinued),true);}}
async function close(page){await page.locator('#employeeSettlementPreviewContinue').click();await page.waitForTimeout(350);assert.equal(await page.locator('.modal-backdrop').count(),0);}
for(const width of [1280,1366,1600,1920])for(const sidebar of [false,true])
test(`unified real edit.ejs Chromium ${width}px sidebar=${sidebar}: complete initial-gap proposal, review-only approval, accessible actions`,async()=>{
    await withPage({width,height:width===1920?1080:800,sidebar},async({page,requests})=>{
        await open(page);assert.match(await page.locator(body).innerText(),/μόνο για προεπισκόπηση.*Δεν αποθηκεύτηκε/s);
        assert.equal(await page.locator(approve).textContent(),'Έγκριση προεπισκόπησης');
        let box=await geometry(page);assert.equal(box.fits,true,JSON.stringify(box));assert.equal(box.footerFits,true);assert.equal(box.overflow,false);assert.ok(box.font>=15.2);
        await page.locator('#employeeSettlementPreviewDetails').click();
        const report=await page.locator('#employeeSettlementPreviewReport').innerText();
        assert.match(report,/02\/02\/2026–31\/03\/2026.*1\.100,00/s);assert.doesNotMatch(report,/62000000|canonical|sourceHistoryId|hmeromhnia_/);
        await page.screenshot({path:`${screenshots}/initial-${width}-sidebar-${sidebar}.png`});
        await page.locator('#employeeSettlementPreviewBack').click();await page.locator(approve).click();
        assert.match(await page.locator(body).innerText(),/εγκρίθηκε μόνο για προεπισκόπηση.*Δεν αποθηκεύτηκε/s);assert.equal(await page.locator(approve).isDisabled(),true);
        assert.equal(requests.filter(request=>request.method==='POST').length,0);await close(page);
        await continueIndependent(page);
    });
});
test('generic financial ambiguity displays real amounts, no preselection, and one choice produces one verified HTTP preview',async()=>{
    await withPage({data:F.references(F.payAlternatives()),width:1366,sidebar:true},async({page,requests})=>{
        await open(page);assert.equal(await page.locator(`${body} input[type=radio]`).count(),2);assert.equal(await page.locator(`${body} input:checked`).count(),0);
        assert.equal(await page.locator(approve).isDisabled(),true);assert.match(await page.locator(body).innerText(),/1\.100,00.*1\.300,00/s);
        await page.locator(`${body} input[type=radio]`).first().check();await page.locator(approve).click();
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Έγκριση προεπισκόπησης');
        await page.locator('#employeeSettlementPreviewDetails').click();assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(),/επιβεβαιωμένη επιλογή/);
        assert.equal(requests.filter(request=>request.method==='POST').length,1);await close(page);
    });
});
test('unknown arrival tolerance is a bounded actual-number question; zero is an explicit answer and never an implicit default',async()=>{
    await withPage({data:F.references(F.unknownArrival()),width:1280},async({page,requests})=>{
        await open(page);const number=page.locator(`${body} input[type=number]`);assert.equal(await number.count(),1);assert.equal(await number.inputValue(),'');
        assert.equal(await number.getAttribute('min'),'0');assert.equal(await number.getAttribute('max'),'1440');assert.equal(await page.locator(approve).isDisabled(),true);
        await number.fill('-1');assert.equal(await page.locator(approve).isDisabled(),true);await number.fill('0');assert.equal(await page.locator(approve).isEnabled(),true);
        await page.locator(approve).click();await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Έγκριση προεπισκόπησης');
        assert.equal(requests.filter(request=>request.method==='POST').length,1);await close(page);
    });
});
for(const technical of [false,true])test(`administrator/technical separation technical=${technical}: concrete reason or ΙΣΤ-ΑΥΤ-3Τ retry, independent continuation`,async()=>{
    await withPage({data:technical?F.initialGap():F.openPast(),failReferences:technical},async({page})=>{
        await open(page);const message=await page.locator(body).innerText();assert.match(message,technical?/ΙΣΤ-ΑΥΤ-3Τ/:/παλιά εργασιακή σχέση χωρίς τεκμηριωμένη αποχώρηση.*ΙΣΤ-ΑΥΤ-3Α/s);
        assert.equal(await page.locator(approve).isVisible(),false);if(technical){assert.equal(await page.getByRole('button',{name:'Επανάληψη ελέγχου',exact:true}).isVisible(),true);assert.doesNotMatch(message,/ΙΣΤ-ΑΥΤ-3Α/);}
        await close(page);await continueIndependent(page);
    });
});
test('390×640: a long verified proposal stays readable with a scrollable report and visible footer',async()=>{
    await withPage({width:390,height:640,fullForm:false},async({page})=>{
        await open(page);await page.locator('#employeeSettlementPreviewDetails').click();const box=await geometry(page);
        assert.equal(box.fits,true);assert.equal(box.footerFits,true);assert.equal(box.overflow,false);assert.ok(box.font>=15.2);
        await page.screenshot({path:`${screenshots}/report-390x640.png`});await close(page);
    });
});

test('the existing factual-correction renderer remains inside the unified preview, retains earlier answers and completes the final numeric check',async()=>{
    const data=require('../../../../server/services/ergazomenoi/fixtures/userConfirmedEmployeeHistoryCorrectionFixtures').h2KpkBoundaryFixture();
    const summary={};data.scope={...data.scope,team:'SYNTHETIC',company_kod:F.scope.company_kod};Object.assign(data.currentEmployee,data.scope,{_id:F.identity(900)});
    data.completeHistoryRows.forEach((row,index)=>{const references=data.protectedReferenceSummary[String(row._id)];Object.assign(row,data.scope,{_id:F.identity(index+1)});summary[String(row._id)]=references;});
    data.protectedReferenceSummary=summary;
    await withPage({data,width:1280,sidebar:true},async({page,requests})=>{
        await open(page);assert.equal(await page.locator(`${body} input[type=radio]:checked`).count(),0);
        await page.screenshot({path:`${screenshots}/factual-correction-1280-sidebar-true.png`});
        await page.locator(`${body} input[name$=employee-history-correction-INITIAL_PROFILE_START][value=FROM_HIRE]`).check();
        await page.locator(`${body} input[name$=employee-history-correction-INITIAL_PROFILE_TERMS][value=CONFIRM_EXISTING]`).check();
        await page.locator(`${body} summary:visible`).filter({hasText:'Προβολή καταχωρημένων όρων'}).first().click();
        assert.match(await page.locator(body).innerText(),/Καταχωρημένοι όροι εργασίας.*5.*40.*8/s);
        assert.equal(await page.locator(approve).isDisabled(),true,'all actual conflicts still need an answer');
        await page.locator(`${body} input[name$=employee-history-correction-FIELD_KPK][value=CONFIRM_EXISTING]`).check();
        assert.equal(await page.locator(approve).isEnabled(),true);await page.locator(approve).click();
        await page.locator(`${body} input[type=number]`).first().waitFor();
        const numbers=page.locator(`${body} input[type=number]`);assert.equal(await numbers.count(),3);
        for(const number of await numbers.all())assert.equal(await number.inputValue(),'','historical facts have no default answer');
        const arrival=page.getByRole('spinbutton',{name:/Ευέλικτη προσέλευση.*24\/04\/2026–24\/05\/2026/});
        const weekly=page.getByRole('spinbutton',{name:/Συμβατικές εβδομαδιαίες ώρες/});
        assert.equal(await arrival.count(),1);assert.equal(await weekly.count(),2);
        for(const number of await weekly.all())await number.fill('40');
        assert.equal(await page.locator(approve).isDisabled(),true,'the third historical fact must also be answered');
        await arrival.fill('15');assert.equal(await page.locator(approve).isEnabled(),true);
        const resolved=page.waitForResponse(response=>response.request().method()==='POST' &&
            new URL(response.url()).pathname.endsWith('/history-automatic-settlement-resolve'));
        await page.locator(approve).click();
        const response=await resolved,payload=await response.json();assert.equal(response.status(),200);
        assert.equal(payload.settlementPreview.state,'automatic');assert.equal(payload.settlementPreview.executionEnabled,false);
        assert.deepEqual(payload.settlementPreview.questions,[]);
        const selection=payload.businessDecision.selections.cycle_1;
        assert.deepEqual(Object.values(selection.facts).sort((left,right)=>left-right),[15,40,40]);
        assert.deepEqual(selection.confirmation.decisions.map(({conflictId,intent})=>({conflictId,intent})),[
            {conflictId:'INITIAL_PROFILE_START',intent:'FROM_HIRE'},
            {conflictId:'INITIAL_PROFILE_TERMS',intent:'CONFIRM_EXISTING'},
            {conflictId:'FIELD_KPK',intent:'CONFIRM_EXISTING'}]);
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Έγκριση προεπισκόπησης');
        const box=await geometry(page);assert.equal(box.footerFits,true);assert.equal(box.overflow,false);
        assert.equal(requests.filter(request=>request.method==='POST').length,2);await close(page);
    });
});

test('three ambiguous periods show a small choice per real period and one combined verified proposal',async()=>{
    await withPage({data:F.references(F.threeIndependentAlternatives()),width:1366,sidebar:true},async({page,requests})=>{
        await open(page);const groups=page.locator(`${body} fieldset`);assert.equal(await groups.count(),3);
        assert.equal(await page.locator(`${body} input[type=radio]`).count(),6);assert.equal(await page.locator(`${body} input:checked`).count(),0);
        for(const group of await groups.all()){assert.equal(await group.locator('input[type=radio]').count(),2);await group.locator('input[type=radio]').first().check();}
        assert.equal(await page.locator(approve).isEnabled(),true);await page.locator(approve).click();
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Έγκριση προεπισκόπησης');
        assert.match(await page.locator(body).innerText(),/μόνο για προεπισκόπηση/);assert.equal(requests.filter(request=>request.method==='POST').length,1);
        await close(page);
    });
});
