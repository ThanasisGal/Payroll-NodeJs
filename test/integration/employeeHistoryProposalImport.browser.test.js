'use strict';
const {test,mock}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright'),ExcelJS=require('exceljs');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
const {startUnifiedPreviewHarness}=require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const {importSample}=require('../fixtures/employeeHistoryProposalImportFixture');
const A=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');

test('Chromium: εισαγωγή UPDATE/INSERT, αναγνώσιμη προεπισκόπηση, καθαρισμός αποτυχίας και μηδενική αποθήκευση',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const update=await importSample(),insert=await importSample('INSERT');
    const h=await startUnifiedPreviewHarness({data:update.data,catalogs:update.catalogs}),before=A.stringify(h.state);
    const browser=await chromium.launch({headless:true}),context=await browser.newContext();
    const external=[],errors=[];
    await context.route('**/*',route=>{
        if(new URL(route.request().url()).origin===h.origin)return route.continue();external.push(route.request().url());return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    try{
        await page.goto(`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal-editor?selection=${encodeURIComponent(update.selection)}`);
        const upload=async(sample)=>{
            await page.locator('#proposalImportFile').setInputFiles({name:sample.result.filename,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:sample.buffer});
            await page.locator('#previewProposalImport').click();
            await page.locator('#proposalImportPreview:not([hidden])').waitFor();
        };
        await upload(update);
        assert.match(await page.locator('#proposalImportRows').textContent(),/UPDATE.*1\.234,56/s);
        assert.match(await page.locator('#proposalImportStatus').textContent(),/Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal(await page.locator('#proposalImportPreview button').count(),0);
        await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.move(8,8);await page.mouse.wheel(0,600);
        await page.waitForFunction(()=>window.scrollY>0||document.body.scrollTop>0);
        for(const [width,height] of [[1440,900],[1100,800],[700,600],[480,700],[900,450]])for(const reduced of [false,true]){
            await page.setViewportSize({width,height});
            await page.evaluate(reduced=>{const main=document.querySelector('.proposal-page');main.style.width=reduced?'calc(100% - 160px)':'';main.style.marginLeft=reduced?'160px':'';},reduced);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await page.locator('#previewProposalImport').isEnabled(),true);
            assert.ok(await page.locator('.proposal-import-scroll').evaluate(node=>node.scrollWidth>node.clientWidth));
        }
        await page.evaluate(()=>{const main=document.querySelector('.proposal-page');main.style.width='';main.style.marginLeft='';});
        const tampered=new ExcelJS.Workbook();await tampered.xlsx.load(update.buffer);
        tampered.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value='Αλλοιωμένο ΠΡΙΝ';
        await page.locator('#proposalImportFile').setInputFiles({name:'tampered.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await tampered.xlsx.writeBuffer())});
        assert.equal(await page.locator('#proposalImportPreview').isVisible(),false);
        await page.locator('#previewProposalImport').click();
        await page.waitForFunction(()=>document.getElementById('proposalImportStatus').textContent.includes('EMPLOYEE_HISTORY_XLSX_IMPORT_'));
        assert.equal(await page.locator('#proposalImportPreview').isVisible(),false);
        await upload(insert);assert.match(await page.locator('#proposalImportRows').textContent(),/INSERT/);
        assert.doesNotMatch(await page.locator('#proposalImportPreview').textContent(),/candidate-period-|620000000000/);
        const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-import-browser-'));
        await page.locator('#historyProposalImport').scrollIntoViewIfNeeded();
        await page.locator('.proposal-import').screenshot({path:path.join(folder,'import-preview.png')});
        console.log(`Συνθετική εικόνα προεπισκόπησης: ${path.join(folder,'import-preview.png')}`);
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});
