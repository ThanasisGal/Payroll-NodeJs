'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const ejs=require('ejs');
const {chromium}=require('playwright');
const {sortHistoryForPresentation}=require('../../server/utils/ergazomenoi/employmentHistoryPresentation');
const root=path.resolve(__dirname,'../..');
const partial=path.join(root,'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
const scripts=['employeeHistoryGuidedResolution','istorikoTable','employeeHistoryAutomaticSettlementPreview','employeeHistoryReconstructionPreview'];
const rows=[
 {_id:'1',aa_eggrafhs:'0001',hmeromhnia_proslhpshs:'2025-12-01',hmeromhnia_isxyos_oron_ergasias_apo:'2026-04-01',employment_history_canonical_status:'REDUNDANT_REFERENCED',employment_history_canonical_survivor_id:'3'},
 {_id:'2',aa_eggrafhs:'0002',hmeromhnia_proslhpshs:'2026-09-16',hmeromhnia_isxyos_oron_ergasias_apo:'2026-09-16'},
 {_id:'3',aa_eggrafhs:'0003',hmeromhnia_proslhpshs:'2025-12-01',hmeromhnia_isxyos_oron_ergasias_apo:'2026-04-01'},
 {_id:'4',aa_eggrafhs:'0004',hmeromhnia_proslhpshs:'2025-12-01',hmeromhnia_isxyos_oron_ergasias_apo:'2025-12-01'}
];
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function pageFor({mode='ADMIN_FULL',withdraw=false,requestHandler}={}){
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const html=await ejs.renderFile(partial,{ergazomenoiData:{_id:'synthetic',hmeromhnia_proslhpshs:'2026-09-16'},istorikoData:sortHistoryForPresentation(rows),employeeHistoryAccessMode:mode,canWithdrawEmployeeHistory:withdraw});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/'))return requestHandler?requestHandler(route):route.fulfill({status:503,body:'{}'});
  if(url.pathname==='/bootstrap.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'public/js/bootstrap.bundle.min.js'))});
  if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(root,url.pathname==='/bootstrap.css'?'public/css/bootstrap.min.css':'public/css/main.css'))});
  const script=scripts.find(name=>url.pathname==='/'+name+'.js');
  if(script)return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'public/js/ergazomenoi/genika',script+'.js'))});
  if(url.pathname!=='/')return route.fulfill({status:204});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="el"><head><meta charset="utf-8"><link rel="stylesheet" href="/bootstrap.css"><link rel="stylesheet" href="/main.css"></head><body class="employee-edit-page"><main id="content" style="height:720px;max-width:100%">'+html+'</main><script src="/bootstrap.js"></script>'+scripts.map(name=>'<script src="/'+name+'.js"></script>').join('')+'</body></html>'});
 });
 await page.goto('http://history-presentation.invalid/');
 return {page,errors};
}
test('business dates sort active periods first with stable sequence/id ties without mutating documents',()=>{
 const before=JSON.stringify(rows);assert.deepEqual(sortHistoryForPresentation(rows).map(row=>row._id),['4','3','2','1']);assert.equal(JSON.stringify(rows),before);
 const a={_id:'a',aa_eggrafhs:'0002',hmeromhnia_proslhpshs:'2025-01-01',hmeromhnia_allaghs_symbashs:'2026-06-01'};
 const b={...a,_id:'b',aa_eggrafhs:'0001',hmeromhnia_allaghs_symbashs:'2026-03-01'};
 assert.deepEqual(sortHistoryForPresentation([a,b]).map(row=>row._id),['b','a']);
 assert.deepEqual(sortHistoryForPresentation([{...a,_id:'z'},a]).map(row=>row._id),['a','z']);
 assert.deepEqual(sortHistoryForPresentation([{...a,_id:'invalid',hmeromhnia_isxyos_oron_ergasias_apo:'broken'},a]).map(row=>row._id),['a','invalid']);
});
test('real table hydration preserves 0004/0003/0002/0001 and marks retained originals read-only',async()=>{
 const {page,errors}=await pageFor();try{
  assert.deepEqual(await page.locator('tr.istoriko-row .istoriko-aa-col').allTextContents(),['0004','0003','0002','0001']);
  assert.equal(await page.getByText('Ιστορικά διατηρημένη — εκτός ενεργού Ιστορικού',{exact:true}).count(),1);
  assert.equal(await page.locator('tr[data-id="1"] button').count(),0);
  assert.equal(await page.locator('tr[data-id="4"] button[data-action="edit"]').count(),1);
  for(const width of [1440,1280,800])for(const sidebar of [false,true]){
   await page.setViewportSize({width,height:800});await page.locator('#content').evaluate((node,margin)=>{node.style.width=`calc(100% - ${margin}px)`;},sidebar?260:0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
for(const mode of ['NONE','SUPERVISOR_PROBLEM_SCOPE'])test(mode+' does not render management controls or the Actions column',async()=>{
 const {page,errors}=await pageFor({mode});try{
  assert.equal(await page.locator('#employeeHistoryGuidedHelp,#employeeHistoryCorrectionStartBtn,#updateIstorikoBtn,#cancelIstorikoBtn,[data-action]').count(),0);
  assert.equal(await page.getByRole('columnheader',{name:'Ενέργειες',exact:true}).count(),0);
  assert.equal(await page.locator('tr.istoriko-row').count(),4);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('withdrawal-only capability retains its specific review without general management',async()=>{
 const {page}=await pageFor({mode:'WITHDRAWAL_ONLY',withdraw:true});try{
  assert.equal(await page.locator('[data-action="add"],[data-action="edit"],[data-action="delete"],[data-action="undo"]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Έλεγχος αποχώρησης',exact:true}).count(),3);
 }finally{await page.close();}
});
test('preview immediately shows accessible spinner, rejects duplicate clicks and restores after failure/cancel',async()=>{
 let calls=0,release;
 const {page,errors}=await pageFor({requestHandler:async route=>{calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({status:503,body:'{}'}).catch(()=>{});}});
 try{
  const button=page.locator('#employeeHistoryReconstructionPreviewBtn');
  await button.click();await page.waitForFunction(()=>document.querySelector('#employeeHistoryReconstructionPreviewBtn .spinner-border'));
  assert.equal(await button.getAttribute('aria-busy'),'true');assert.equal(await button.isDisabled(),true);
  await button.dispatchEvent('click');assert.equal(calls,1);
  release();await page.waitForFunction(()=>!document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  assert.equal(await button.locator('.spinner-border').count(),0);assert.equal(await button.getAttribute('aria-busy'),null);
  await page.getByRole('button',{name:'Επανάληψη ελέγχου',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  await page.locator('#employeeSettlementPreviewModal .btn-close').click();
  await page.waitForFunction(()=>!document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  release();assert.equal(await button.locator('.spinner-border').count(),0);assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
test('busy helper restores controls but preserves a newly installed uncertain-result label',async()=>{
 const {page}=await pageFor();try{
  const result=await page.evaluate(()=>{
   const button=document.querySelector('#employeeHistoryReconstructionPreviewBtn'),original=button.textContent;
   const end=employeeHistoryGuidedResolution.beginButtonBusy(button,'Εργασία…');
   const during=button.disabled&&button.getAttribute('aria-busy')==='true'&&!!button.querySelector('.spinner-border');end();
   const restored=!button.disabled&&button.textContent===original&&!button.hasAttribute('aria-busy');
   const finish=employeeHistoryGuidedResolution.beginButtonBusy(button,'Εργασία…');button.textContent='Άγνωστο αποτέλεσμα';finish(false);
   return {during,restored,label:button.textContent};
  });assert.deepEqual(result,{during:true,restored:true,label:'Άγνωστο αποτέλεσμα'});
 }finally{await page.close();}
});
