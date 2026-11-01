'use strict';
const {test,before,after,mock}=require('node:test');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
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
 {_id:'2',aa_eggrafhs:'0003',hmeromhnia_proslhpshs:'2026-09-16',hmeromhnia_isxyos_oron_ergasias_apo:'2026-09-16'},
 {_id:'3',aa_eggrafhs:'0002',hmeromhnia_proslhpshs:'2025-12-01',hmeromhnia_isxyos_oron_ergasias_apo:'2026-04-01'},
 {_id:'4',aa_eggrafhs:'0004',hmeromhnia_proslhpshs:'2025-12-01',hmeromhnia_isxyos_oron_ergasias_apo:'2025-12-01'}
];
let browser;
before(async()=>{forbidRealSettlementMongo(mock);browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();mock.restoreAll();});
async function pageFor({mode='ADMIN_FULL',withdraw=false,requestHandler,synthetic=false}={}){
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const html=await ejs.renderFile(partial,{ergazomenoiData:{_id:'synthetic',hmeromhnia_proslhpshs:'2026-09-16'},istorikoData:sortHistoryForPresentation(rows),employeeHistoryAccessMode:mode,canWithdrawEmployeeHistory:withdraw,settlementSyntheticHarness:synthetic});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/')||url.pathname==='/ergazomenoi/ergazomenoi/istoriko/update')return requestHandler?requestHandler(route):route.fulfill({status:503,body:'{}'});
  if(url.pathname==='/swal.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/sweetalert2/dist/sweetalert2.all.js'))});
  if(url.pathname==='/bootstrap.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'public/js/bootstrap.bundle.min.js'))});
  if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(root,url.pathname==='/bootstrap.css'?'public/css/bootstrap.min.css':'public/css/main.css'))});
  const script=scripts.find(name=>url.pathname==='/'+name+'.js');
  if(script)return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'public/js/ergazomenoi/genika',script+'.js'))});
  if(url.pathname!=='/')return route.fulfill({status:204});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="el"><head><meta charset="utf-8"><link rel="stylesheet" href="/bootstrap.css"><link rel="stylesheet" href="/main.css"></head><body class="employee-edit-page"><main id="content" style="height:720px;max-width:100%">'+html+'</main><script src="/bootstrap.js"></script><script src="/swal.js"></script>'+scripts.map(name=>'<script src="/'+name+'.js"></script>').join('')+'</body></html>'});
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
test('table displays sequential row numbers while preserving actual 0004/0002/0003/0001 records',async()=>{
 const {page,errors}=await pageFor();try{
  assert.deepEqual(await page.locator('tr.istoriko-row .istoriko-aa-col').allTextContents(),['0001','0002','0003','0004']);
  const records=await page.locator('tr.istoriko-row').evaluateAll(nodes=>nodes.map(node=>JSON.parse(node.dataset.record)));
  assert.deepEqual(records.map(row=>row.aa_eggrafhs),['0004','0002','0003','0001']);
  assert.deepEqual(records.map(row=>row._id),['4','3','2','1']);
  assert.equal(await page.getByRole('columnheader',{name:'Α/Α',exact:true}).getAttribute('title'),null);
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
  await button.click();await page.locator('#employeeSettlementPreviewModal.show .modal-body .employee-history-progress .spinner-border').waitFor({state:'visible'});
  assert.match(await page.locator('#employeeSettlementPreviewModal .employee-history-progress').innerText(),/Γίνεται έλεγχος του Ιστορικού…/);
  assert.equal(await page.locator('#employeeSettlementPreviewModal .modal-body').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#employeeSettlementPreviewModal .employee-history-progress').evaluate(node=>{const box=node.getBoundingClientRect();return node.closest('.modal').contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}),true);
  assert.equal(await button.getAttribute('aria-busy'),'true');assert.equal(await button.isDisabled(),true);
  await button.dispatchEvent('click');assert.equal(calls,1);
  release();await page.waitForFunction(()=>!document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  assert.equal(await button.locator('.spinner-border').count(),0);assert.equal(await button.getAttribute('aria-busy'),null);
  assert.equal(await page.locator('#employeeSettlementPreviewModal .employee-history-progress').count(),0);
  await page.getByRole('button',{name:'Επανάληψη ελέγχου',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  await page.locator('#employeeSettlementPreviewModal .btn-close').click();
  await page.waitForFunction(()=>!document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  await page.waitForFunction(()=>document.activeElement?.id==='employeeHistoryReconstructionPreviewBtn');
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
function previewPayload(kind='automatic') {
 const input=kind==='decision'
  ? require('../../server/services/ergazomenoi/fixtures/multipleSafeEmployeeHistoryResolutionFixtures').samePeriodMateriallyDifferentProfilesFixture()
  : require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures').real0006BoundaryStructure();
 input.completeHistoryRows.forEach(row=>Object.assign(row,{evelikth_proselefsh:0,symbatikes_ores_ergasias:40}));
 input.protectedReferenceSummary ||= Object.fromEntries(input.completeHistoryRows.map(row=>[String(row._id),[{collection:'Apasxoliseis_Period_Frozen_Snapshots',documentId:'synthetic'}]]));
 return {success:true,settlementPreview:require('../../server/services/ergazomenoi/employeeHistorySettlementPreviewService').buildEmployeeHistorySettlementPreview(input)};
}
const modalProgress='#employeeSettlementPreviewModal.show .modal-body .employee-history-progress';
test('dynamic reorder, local insertion and removal update only display numbering',async()=>{
 const {page,errors}=await pageFor();try{
  const snapshot=()=>page.locator('tr.istoriko-row[data-persisted="true"]').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.id,record:node.dataset.record,original:node.dataset.original})).sort((a,b)=>a.id.localeCompare(b.id)));
  const before=await snapshot();
  await page.evaluate(()=>{const table=document.querySelector('#istorikoTable tbody');table.prepend(table.querySelector('tr[data-id="2"]'));});
  await page.waitForFunction(()=>document.querySelector('tr[data-id="2"] .istoriko-aa-col').textContent==='0001');
  assert.deepEqual(await page.locator('tr.istoriko-row .istoriko-aa-col').allTextContents(),['0001','0002','0003','0004']);
  assert.deepEqual(await snapshot(),before);
  await page.locator('tr[data-id="2"] [data-action="add"]').dispatchEvent('click');
  assert.deepEqual(await page.locator('tr.istoriko-row .istoriko-aa-col').allTextContents(),['0001','0002','0003','0004','0005']);
  assert.deepEqual(await snapshot(),before);
  await page.locator('tr[data-persisted="false"] [data-action="undo"]').dispatchEvent('click');
  assert.deepEqual(await page.locator('tr.istoriko-row .istoriko-aa-col').allTextContents(),['0001','0002','0003','0004']);
  assert.deepEqual(await snapshot(),before);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('pending preview spinner is visible inside the modal and removed on successful response',async()=>{
 let release,calls=0;
 const payload=previewPayload();
 const {page,errors}=await pageFor({requestHandler:async route=>{calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});}});
 try{
  await page.locator('#employeeHistoryReconstructionPreviewBtn').click();await page.locator(modalProgress+' .spinner-border').waitFor({state:'visible'});
  await page.locator('#employeeHistoryReconstructionPreviewBtn').dispatchEvent('click');assert.equal(calls,1);
  for(const viewport of [{width:1280,height:800},{width:390,height:640}]){
   await page.setViewportSize(viewport);
   assert.equal(await page.locator(modalProgress+' .spinner-border').isVisible(),true);
   assert.equal(await page.locator(modalProgress).evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  }
  release();await page.locator('#employeeSettlementPreviewBody .employee-settlement-message').waitFor();
  assert.equal(await page.locator(modalProgress).count(),0);assert.equal(await page.locator('#employeeHistoryReconstructionPreviewBtn').isDisabled(),false);assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
test('decision preview and proposal refresh show in-modal progress without duplicate requests',async()=>{
 const decision={...previewPayload('decision'),decisionEnabled:true};
 const resolved={...previewPayload(),decisionEnabled:true,businessDecision:{choiceId:'synthetic-choice'}};
 let release,calls=0;
 const {page,errors}=await pageFor({requestHandler:async route=>{
  if(route.request().method()==='GET')return route.fulfill({contentType:'application/json',body:JSON.stringify(decision)});
  calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({contentType:'application/json',body:JSON.stringify(resolved)});
 }});
 try{
  await page.locator('#employeeHistoryReconstructionPreviewBtn').click();await page.locator('#employeeSettlementPreviewBody input[type="radio"]').first().check();
  const approve=page.locator('#employeeSettlementPreviewApprove');await approve.click();await page.locator(modalProgress+' .spinner-border').waitFor({state:'visible'});
  await approve.dispatchEvent('click');assert.equal(calls,1);release();
  await page.waitForFunction(()=>!document.querySelector('#employeeSettlementPreviewChangeChoice').hidden&&!document.querySelector('#employeeSettlementPreviewChangeChoice').disabled);
  assert.equal(await page.locator(modalProgress).count(),0);
  await page.locator('#employeeSettlementPreviewChangeChoice').click();await page.locator(modalProgress+' .spinner-border').waitFor({state:'visible'});
  assert.match(await page.locator(modalProgress).innerText(),/ενημέρωση της πρότασης/);release();
  await page.waitForFunction(()=>!document.querySelector('.employee-history-progress'));
  assert.equal(calls,2);assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
test('synthetic pending application keeps visible modal progress and cannot submit twice',async()=>{
 const payload={...previewPayload(),executionMode:'SYNTHETIC_ONLY',approvalFingerprint:'A'.repeat(43)};
 payload.settlementPreview.executionEnabled=true;
 let release,calls=0;
 const {page,errors}=await pageFor({synthetic:true,requestHandler:async route=>{
  if(route.request().method()==='GET')return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});
  calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,historyStatus:'CLEAN',corrections:{actions:[],assumptions:[]}})});
 }});
 try{
  await page.locator('#employeeHistoryReconstructionPreviewBtn').click();const approve=page.locator('#employeeSettlementPreviewApprove');
  await approve.waitFor({state:'visible'});
  await page.locator('#employeeSettlementPreviewModal .modal-body').evaluate(region=>{
   const spacer=document.createElement('div');spacer.style.height='2000px';region.append(spacer);region.scrollTop=region.scrollHeight;
  });
  assert.ok(await page.locator('#employeeSettlementPreviewModal .modal-body').evaluate(region=>region.scrollTop>0));
  await approve.click();
  await page.locator(modalProgress+' .spinner-border').waitFor({state:'visible'});assert.equal(await approve.isDisabled(),true);
  assert.equal(await page.locator(modalProgress).evaluate(node=>{
   const progress=node.getBoundingClientRect(),region=node.parentElement.getBoundingClientRect();
   return progress.top>=region.top&&progress.bottom<=region.bottom;
  }),true,'progress remains inside the visible scroll area after approving a long proposal');
  await approve.dispatchEvent('click');await page.locator('#employeeSettlementPreviewModal .btn-close').dispatchEvent('click');assert.equal(calls,1);
  assert.equal(await page.locator('#employeeSettlementPreviewModal').evaluate(node=>node.classList.contains('show')),true);
  release();await page.getByText('Το Ιστορικό τακτοποιήθηκε επιτυχώς',{exact:true}).waitFor();
  assert.equal(await page.locator(modalProgress).count(),0);assert.equal(await approve.isVisible(),false);assert.equal(calls,1);assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
test('manual History check opens a visible SweetAlert spinner and clears it on failure',async()=>{
 let release,calls=0;
 const {page,errors}=await pageFor({requestHandler:async route=>{calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false})});}});
 try{
  const trigger=page.locator('#employeeHistoryCorrectionStartBtn');await trigger.click();
  await page.locator('.swal2-popup .spinner-border').waitFor({state:'visible'});
  assert.match(await page.locator('.swal2-html-container').innerText(),/Γίνεται έλεγχος του Ιστορικού/);
  await trigger.dispatchEvent('click');assert.equal(calls,1);release();
  await page.getByText('Ο έλεγχος δεν ολοκληρώθηκε',{exact:true}).waitFor();
  assert.equal(await page.locator('.swal2-popup .spinner-border').count(),0);await page.locator('.swal2-confirm').click();
  assert.equal(await trigger.isDisabled(),false);assert.equal(await trigger.getAttribute('aria-busy'),null);assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
for(const cancel of [false,true])test(`legacy preview pending request shows modal progress; cancel=${cancel}`,async()=>{
 let release,calls=0;
 const {page,errors}=await pageFor({mode:'NONE',requestHandler:async route=>{calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({status:503,body:'{}'}).catch(()=>{});}});
 try{
  await page.evaluate(()=>{delete window.employeeHistoryAutomaticSettlementPreview;document.getElementById('employeeSettlementPreviewModal').remove();});
  const trigger=page.locator('#employeeHistoryReconstructionPreviewBtn');await trigger.click();
  await page.locator('#employeeHistoryReconstructionPreviewModal.show .modal-body .employee-history-progress .spinner-border').waitFor({state:'visible'});
  await trigger.dispatchEvent('click');assert.equal(calls,1);
  if(cancel){await page.locator('#employeeHistoryReconstructionPreviewModal .btn-close').click();}
  else{release();await page.locator('.history-preview-message').waitFor();}
  await page.waitForFunction(()=>!document.querySelector('#employeeHistoryReconstructionPreviewBtn').disabled);
  assert.equal(await page.locator('#employeeHistoryReconstructionPreviewModal .employee-history-progress').count(),0);
  assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
test('uncertain synthetic application clears modal progress without an automatic second attempt',async()=>{
 const payload={...previewPayload(),executionMode:'SYNTHETIC_ONLY',approvalFingerprint:'A'.repeat(43)};
 payload.settlementPreview.executionEnabled=true;
 let release,calls=0;
 const {page,errors}=await pageFor({synthetic:true,requestHandler:async route=>{
  if(route.request().method()==='GET')return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});
  calls++;await new Promise(resolve=>{release=resolve;});await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({outcome:'UNKNOWN',code:'SYNTHETIC_COMMIT_UNCERTAIN'})});
 }});
 try{
  await page.locator('#employeeHistoryReconstructionPreviewBtn').click();const approve=page.locator('#employeeSettlementPreviewApprove');await approve.click();
  await page.locator(modalProgress+' .spinner-border').waitFor({state:'visible'});release();
  await page.waitForFunction(()=>document.querySelector('#employeeSettlementPreviewApprove').textContent==='Επανάληψη με την ίδια έγκριση');
  assert.equal(await page.locator(modalProgress).count(),0);assert.equal(await approve.isDisabled(),false);assert.equal(calls,1);
  assert.match(await page.locator('#employeeSettlementPreviewBody').innerText(),/Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές/);
  assert.deepEqual(errors,[]);
 }finally{release?.();await page.close();}
});
