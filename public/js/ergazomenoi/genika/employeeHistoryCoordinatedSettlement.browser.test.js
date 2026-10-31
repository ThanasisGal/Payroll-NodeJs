'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {forbidRealSettlementMongo}=require('../../../../test/fixtures/forbidRealSettlementMongo');
const {startSettlementHarness}=require('../../../../test/fixtures/employeeHistorySettlementHttpHarness');
const {acceptanceB}=require('../../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
let browser;
before(async()=>{forbidRealSettlementMongo(mock);fs.mkdirSync('/tmp/payroll-coordinated-chromium',{recursive:true});browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
for(const [width,height] of [[1920,1080],[1280,720],[390,640]])for(const sidebar of [false,true])test(`unified Chromium ${width}x${height}, sidebar=${sidebar}: one approval, exact result, report, independent action`,async()=>{
    const h=await startSettlementHarness({fixture:acceptanceB(),coordinated:true,enriched:false});
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,h.origin);return route.continue();});
    try{
        await page.goto(h.origin);if(sidebar)await page.evaluate(()=>document.body.classList.add('sidebar-open'));
        await page.click('#employeeHistoryReconstructionPreviewBtn');
        await page.locator('#employeeSettlementPreviewApprove').waitFor({state:'visible'});
        const before=h.db.state();assert.equal(before.audits.length,0);
        await page.click('#employeeSettlementPreviewApprove');
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewBody').textContent==='Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.equal(h.requests.length,1);assert.deepEqual(Object.keys(h.requests[0]),['approval']);
        assert.equal(h.db.state().audits.length,1);assert.deepEqual(h.db.state().references,before.references);
        await page.click('#employeeSettlementPreviewDetails');
        const report=await page.locator('#employeeSettlementPreviewReport').innerText();
        assert.match(report,/διατηρήθηκε.*ιστορικές αναφορές/);assert.doesNotMatch(report,/Δεν αποθηκεύτηκε/);
        const geometry=await page.locator('#employeeSettlementPreviewModal .modal-content').evaluate(el=>{
            const r=el.getBoundingClientRect(),f=el.querySelector('.modal-footer').getBoundingClientRect();
            return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,footer:f.bottom<=innerHeight};});
        assert.equal(geometry.fits,true);assert.equal(geometry.footer,true);
        await page.screenshot({path:`/tmp/payroll-coordinated-chromium/report-${width}-${sidebar}.png`});
        await page.click('#employeeSettlementPreviewBack');await page.click('#employeeSettlementPreviewContinue');
        await page.waitForTimeout(350);await page.click('#independentAction');assert.equal(await page.evaluate(()=>window.independentContinued),true);
        await page.click('#employeeHistoryReconstructionPreviewBtn');await page.locator('#employeeSettlementPreviewBody .employee-settlement-message').waitFor();
        assert.equal(await page.locator('#employeeSettlementPreviewApprove').isVisible(),false);assert.equal(h.db.state().audits.length,1);
        assert.deepEqual(errors,[]);
    }finally{await page.close();await h.close();}
});
for(const fault of ['COMMIT_ACK_LOST','COMMIT_UNKNOWN_BEFORE'])test(`unified Chromium ${fault}: unknown response and exact same approval retry`,async()=>{
    const h=await startSettlementHarness({fixture:acceptanceB(),coordinated:true,enriched:false});
    const page=await browser.newPage();
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,h.origin);return route.continue();});
    try{
        await page.goto(h.origin);await page.click('#employeeHistoryReconstructionPreviewBtn');
        await page.locator('#employeeSettlementPreviewApprove').waitFor({state:'visible'});h.db.failAt(fault);
        await page.click('#employeeSettlementPreviewApprove');
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Επανάληψη με την ίδια έγκριση');
        const message=await page.locator('#employeeSettlementPreviewBody').innerText();assert.match(message,/άγνωστο/);assert.doesNotMatch(message,/επιτυχώς|Δεν αποθηκεύτηκε/);
        await page.click('#employeeSettlementPreviewApprove');
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewBody').textContent==='Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.deepEqual(h.requests[0],h.requests[1]);assert.equal(h.db.state().audits.length,1);
        assert.equal(h.db.events.filter(event=>event.type==='commit').length,1);
    }finally{await page.close();await h.close();}
});
