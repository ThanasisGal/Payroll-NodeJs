'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {forbidRealSettlementMongo}=require('../../../../test/fixtures/forbidRealSettlementMongo');
const {startSettlementHarness}=require('../../../../test/fixtures/employeeHistorySettlementHttpHarness');
const {startUnifiedPreviewHarness}=require('../../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const {acceptanceBWithInitialGap}=require('../../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
let browser;
before(async()=>{forbidRealSettlementMongo(mock);fs.mkdirSync('/tmp/payroll-real-http-chromium',{recursive:true});browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
for(const [width,height] of [[1280,720],[390,640]])for(const sidebar of [false,true])test(`real controller Chromium ${width}x${height}, sidebar=${sidebar}`,async()=>{
    const h=await startSettlementHarness({realHttp:true,fixture:acceptanceBWithInitialGap(),enriched:false});
    const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,h.origin);return route.continue();});
    try{
        await page.goto(h.origin);if(sidebar)await page.evaluate(()=>document.body.classList.add('sidebar-open'));
        assert.equal(await page.locator('#employeeSettlementPreviewModal').getAttribute('data-execution-mode'),'PREVIEW_ONLY');
        await page.click('#employeeHistoryReconstructionPreviewBtn');await page.locator('#employeeSettlementPreviewApprove').waitFor({state:'visible'});
        await page.click('#employeeSettlementPreviewApprove');
        await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewBody').textContent==='Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.equal(h.requests.length,1);assert.deepEqual(Object.keys(h.requests[0]),['approval']);assert.equal(h.db.state().audits.length,1);
        await page.click('#employeeSettlementPreviewDetails');const report=await page.locator('#employeeSettlementPreviewReport').innerText();assert.match(report,/Δημιουργήθηκε η εγγραφή/);
        const fits=await page.locator('#employeeSettlementPreviewModal .modal-content').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;});assert.equal(fits,true);
        await page.screenshot({path:`/tmp/payroll-real-http-chromium/${width}-${sidebar}.png`});
        await page.click('#employeeSettlementPreviewBack');await page.click('#employeeSettlementPreviewContinue');await page.waitForTimeout(350);
        await page.click('#independentAction');assert.equal(await page.evaluate(()=>window.independentContinued),true);assert.deepEqual(errors,[]);
    }finally{await page.close();await h.close();}
});
test('normal disabled server remains PREVIEW_ONLY and HTTP 423 in isolated Chromium',async()=>{
    const h=await startUnifiedPreviewHarness({data:acceptanceBWithInitialGap()}),page=await browser.newPage();
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,h.origin);return route.continue();});
    try{await page.goto(h.origin);await page.click('#employeeHistoryReconstructionPreviewBtn');await page.locator('#employeeSettlementPreviewApprove').waitFor({state:'visible'});
        await page.click('#employeeSettlementPreviewApprove');assert.equal(h.counts.applyRequests,0);
        const response=await h.apply({approval:{confirmed:true,fingerprint:'x'.repeat(43)}});assert.equal(response.status,423);
    }finally{await page.close();await h.close();}
});
test('real controller Chromium uncertain commit keeps the exact approval and applies once',async()=>{
    const h=await startSettlementHarness({realHttp:true,fixture:acceptanceBWithInitialGap(),enriched:false}),page=await browser.newPage();
    try{await page.goto(h.origin);await page.click('#employeeHistoryReconstructionPreviewBtn');await page.locator('#employeeSettlementPreviewApprove').waitFor({state:'visible'});h.db.failAt('COMMIT_ACK_LOST');
        await page.click('#employeeSettlementPreviewApprove');await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Επανάληψη με την ίδια έγκριση');
        assert.doesNotMatch(await page.locator('#employeeSettlementPreviewBody').innerText(),/επιτυχώς|Δεν αποθηκεύτηκε/);
        await page.click('#employeeSettlementPreviewApprove');await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewBody').textContent==='Το Ιστορικό τακτοποιήθηκε επιτυχώς');
        assert.deepEqual(h.requests[0],h.requests[1]);assert.equal(h.db.state().audits.length,1);
    }finally{await page.close();await h.close();}
});
