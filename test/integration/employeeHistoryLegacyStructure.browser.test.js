'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startApprovedProposalMongo,startApprovedProposalHttp}=require('../fixtures/employeeHistoryApprovedProposalMongo');
const {seedLegacyStructure,legacyProposal,seedLegacyFrozen}=require('../fixtures/employeeHistoryLegacyStructure');
const {createEmployeeHistoryApprovedProposalService:create}=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const X=require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E=require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const P=require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const binary=process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
test('Chromium: τρεις legacy εγγραφές, πραγματικό XLSX, απλή έγκριση και επαληθευμένη διορθωτική έκδοση',
    {skip:!binary,timeout:180000},async t=>{
    assert.equal(P.enabled(),false);
    const db=await startApprovedProposalMongo(binary);t.after(db.close);
    const f=await seedLegacyStructure(db);
    await db.historyModel.collection.updateOne({_id:f.history[2]._id},{$unset:{hmeres_efarmoghs_egkekrimenhs_rythmishs:1}});
    const frozen=await seedLegacyFrozen(f);
    await seedLegacyFrozen(f,{finalized:true,historyIndex:1,from:'2026-09-01',to:'2026-09-30'});
    // References are part of the authentic exported snapshot: rebuild contexts.
    const proposal=await legacyProposal(f),baseline=await X.buildEmployeeHistoryProposalWorkbook(await f.input(),f.catalogs,{selection:proposal.selection});
    E.applyLocalCompletion(baseline,proposal.completion,f.req,f.catalogs);
    const buffer=await X.serializeEmployeeHistoryProposalWorkbook(baseline.workbook);
    const before=await f.snapshot(),raw=await frozen.raw(),h=await startApprovedProposalHttp(f,create(f.dependencies),{csrf:true});t.after(h.close);
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===h.origin?r.continue():r.abort());
    await page.goto(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=${proposal.selection}`);
    let response=page.waitForResponse(r=>r.url().endsWith('/history-proposal-import-preview'));
    await page.locator('#proposalImportFile').setInputFiles({name:'synthetic-0001-before-after.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
    const imported=await(await response).json();assert.equal(imported.success,true,imported.message);assert.equal(imported.legacyCertificationRequired,false);
    await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
    assert.equal(await f.snapshot(),before);assert.equal(await page.locator('[data-field-id="hmeromhnia_isxyos_oron_ergasias_eos"]').inputValue(),'2026-03-31');
    assert.equal(await page.locator('#legacyHistoryCertification').count(),0);
    response=page.waitForResponse(r=>r.url().endsWith('/history-proposal-apply-preview'));
    await page.locator('#previewProposalApply').click();
    const preview=await(await response).json();assert.equal(preview.success,true,preview.message);
    assert.equal(preview.physicalWrites.history.mode,'CORRECTION_EDITION');
    await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
    // Verify adaptive layout at the actual available content width. Tables own
    // their scrolling; the document and dialogs cannot overflow the viewport.
    for(const [width,height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[800,600],[390,740]]){
        await page.setViewportSize({width,height});
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
            smallest:Math.min(...[...document.querySelectorAll('.proposal-table input,.proposal-table select,.proposal-table textarea')].filter(e=>e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize)))}));
        assert.equal(layout.overflow,false,`${width}×${height}`);assert.ok(layout.smallest>=13.6);
    }
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await f.snapshot(),before);
    response=page.waitForResponse(r=>r.url().endsWith('/history-proposal-apply'));
    await page.locator('#approveProposalApply').click();
    const result=await(await response).json();assert.equal(result.selectedCaseStatus,'APPROVED_RESOLVED',result.message);
    assert.equal(result.verification.persisted,true);assert.equal(result.verification.selectedCaseResolved,true);
    await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#proposalEditState').innerText(),/Δεν απαιτείται επανεισαγωγή/);
    assert.deepEqual(await frozen.raw(),raw);assert.equal(await db.historyModel.collection.countDocuments(f.scope),3);
    assert.equal(await db.periodControlModel.collection.countDocuments({company_kod:f.scope.company_kod}),1);
    assert.equal(await db.auditModel.collection.countDocuments({'employeeScope.employee_id':f.employee._id}),1);
    await page.screenshot({path:`${db.folder}/legacy-history-verified.png`,fullPage:false});
    await page.locator('#openPersistedProposal').click();
    assert.equal(await page.locator('[data-field-id="hmeromhnia_isxyos_oron_ergasias_eos"]').inputValue(),'2026-03-31');
    assert.equal(await page.locator('#proposalImportFilename').innerText(),'Δεν έχει επιλεγεί αρχείο');
    assert.deepEqual(errors,[]);
});
