'use strict';
const {test,before,after,mock}=require('node:test');const assert=require('node:assert/strict');
const {chromium}=require('playwright');const fs=require('node:fs');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
const {startUnifiedPreviewHarness}=require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const F=require('../fixtures/employee0015ReviewFixture');
let browser;before(async()=>{forbidRealSettlementMongo(mock);browser=await chromium.launch({headless:true});fs.mkdirSync('/tmp/payroll-0015-interactive',{recursive:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
for(const [width,height] of [[1440,900],[1280,720],[390,720]])for(const sidebar of [false,true])
test(`0015 guided preview ${width}x${height}, sidebar=${sidebar}: complete answers, no Apply and preserved originals`,async()=>{
    const h=await startUnifiedPreviewHarness({data:F.data(),catalogs:F.catalogs});
    const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
    const before=structuredClone(h.state),body='#employeeSettlementPreviewBody',approve='#employeeSettlementPreviewApprove';
    try{
        await page.goto(h.origin);await page.evaluate(value=>document.body.classList.toggle('sidebar-open',value),sidebar);
        await page.click('#employeeHistoryReconstructionPreviewBtn');
        await page.locator(`${body} [data-profile-field="VALID_FROM"]`).waitFor({state:'attached'});
        const text=await page.locator(body).innerText();
        for(const fact of ['0002','0003','0004','09/06/2026','22/06/2026','31/10/2026','15/09/2026','1 ημέρα / 8 ώρες'])assert.ok(text.includes(fact),fact);
        assert.equal(await page.locator(approve).isDisabled(),true);
        for(const radio of await page.locator(`${body} input[type="radio"]`).all())await radio.check();
        for(const select of await page.locator(`${body} select:has(option[value="CONFIRMED_FACTS"])`).all())await select.selectOption('CONFIRMED_FACTS');
        const worksheetBounds=await page.locator('#employeeSettlementPreviewModal .modal-content').boundingBox();
        assert.ok(worksheetBounds.x>=0 && worksheetBounds.x+worksheetBounds.width<=width+1 && worksheetBounds.y+worksheetBounds.height<=height+1);
        assert.ok(await page.locator(`${body} legend`).first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize))>=13.6);
        await page.screenshot({path:`/tmp/payroll-0015-interactive/${width}-sidebar-${sidebar}-worksheet.png`});
        const boundary={VALID_FROM:'2026-05-25',VALID_UNTIL:'2026-05-31',PERIOD_EVIDENCE:'Συνθετικό έγγραφο Β2 με τις περιόδους'};
        for(const [field,value] of Object.entries({...boundary,...F.initial})){
            const control=page.locator(`${body} [data-profile-field="${field}"]`);
            if(await control.evaluate(node=>node.tagName==='SELECT'))await control.selectOption(String(value));
            else await control.fill(typeof value==='boolean'?value?'Ναι':'Όχι':String(value));
        }
        assert.equal(await page.locator(approve).isDisabled(),false);
        await page.click(approve);
        await page.locator(`${body} .employee-settlement-message`).filter({hasText:'Η συνολική προεπισκόπηση επικυρώθηκε'}).waitFor();
        assert.equal(await page.locator(approve).isVisible(),false);
        await page.click('#employeeSettlementPreviewDetails');
        const report=await page.locator('#employeeSettlementPreviewReport').innerText();
        for(const range of ['26/04/2026–24/05/2026','25/05/2026–31/05/2026','01/06/2026–08/06/2026','09/06/2026–21/06/2026','22/06/2026–15/09/2026'])assert.ok(report.includes(range),report);
        const bounds=await page.locator('#employeeSettlementPreviewModal .modal-content').boundingBox();
        assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y>=0 && bounds.y+bounds.height<=height+1,JSON.stringify(bounds));
        const footer=await page.locator('#employeeSettlementPreviewModal .modal-footer').boundingBox();assert.ok(footer.y+footer.height<=height+1);
        assert.equal(await page.locator('#istorikoTable tbody tr[data-id]').count(),6);
        assert.equal(posts.filter(url=>url.includes('settlement-resolve')).length,1);assert.equal(posts.some(url=>url.includes('settlement-apply')),false);
        assert.deepEqual(h.state,before);assert.deepEqual(errors,[]);
        await page.screenshot({path:`/tmp/payroll-0015-interactive/${width}-sidebar-${sidebar}.png`});
    }finally{await page.close();await h.close();}
});
