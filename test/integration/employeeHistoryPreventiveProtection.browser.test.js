"use strict";
const {test,before,after,mock}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startSettlementHarness}=require('../fixtures/employeeHistorySettlementHttpHarness');
const {typedFixture}=require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
const F=require('../fixtures/employee0015ReviewFixture');
let browser;before(async()=>{require('../fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock);browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
for(const [width,height] of [[1440,900],[1280,720],[390,720]])for(const sidebar of [false,true])
test(`legacy read-only notice ${width}x${height}, sidebar=${sidebar}`,async()=>{
 const h=await startSettlementHarness({fixture:typedFixture(F.data()),enriched:false,historyAccessMode:'READ_ONLY'});
 const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 try{const before=h.db.state();await page.goto(h.origin);await page.evaluate(value=>document.body.classList.toggle('sidebar-open',value),sidebar);
 const notice=page.locator('[data-history-status="LEGACY_REVIEW_REQUIRED"]');await notice.waitFor();
 assert.match(await notice.innerText(),/μόνο για ανάγνωση/);assert.equal(await page.locator('#employeeHistoryReconstructionPreviewBtn').count(),0);
 assert.equal(await page.locator('#employeeHistoryCorrectionStartBtn').count(),0);assert.equal(await page.locator('#istorikoTable').getAttribute('data-history-access-mode'),'READ_ONLY');
 assert.equal(await page.locator('#istorikoTable tbody tr[data-id]').count(),6);
 const box=await notice.boundingBox();assert.ok(box.width>0&&box.x>=0&&box.x+box.width<=width+1);
 await page.click('#independentAction');assert.equal(await page.evaluate(()=>window.independentContinued),true);
 assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);assert.deepEqual(h.db.state(),before);
 }finally{await page.close();await h.close();}
});
