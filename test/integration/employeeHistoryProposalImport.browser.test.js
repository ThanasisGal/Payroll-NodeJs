'use strict';
const {test,mock}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright'),ExcelJS=require('exceljs');
const {forbidRealSettlementMongo}=require('../fixtures/forbidRealSettlementMongo');
const {startUnifiedPreviewHarness}=require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const {importSample}=require('../fixtures/employeeHistoryProposalImportFixture');
const F=require('../fixtures/employee0002HistoryProposalFixture');
const X=require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const A=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const field=(page,id)=>page.locator(`[data-field-id="${id}"]`);
const ready=page=>page.waitForFunction(()=>!document.getElementById('chooseProposalFile').disabled);
const uploadFile=sample=>({name:sample.result.filename,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:sample.buffer});
async function upload(page,sample){
    const response=page.waitForResponse(response=>response.url().endsWith('/history-proposal-import-preview'));
    await page.locator('#proposalImportFile').setInputFiles(uploadFile(sample));
    const result=await (await response).json();await ready(page);return result;
}
const editorState=page=>page.locator('#historyProposalEditor [data-edit-index]').evaluateAll(controls=>controls.map(control=>({
    id:control.dataset.fieldId,value:control.multiple?[...control.selectedOptions].map(option=>option.value):control.value,
    edited:control.dataset.edited,importedNull:control.dataset.importedNull,disabled:control.disabled
})));
const protectedState=page=>page.evaluate(()=>({
    title:document.querySelector('.proposal-context').textContent,
    identity:{...document.getElementById('historyProposalEditor').dataset},
    before:[...document.querySelectorAll('.proposal-before')].map(node=>node.textContent),
    locked:[...document.querySelectorAll('.proposal-after > span')].map(node=>node.textContent)
}));
async function editSample(sample,values){
    for(const [id,value] of Object.entries(values)){
        const entry=sample.result.editableCells.find(item=>(item.canonicalField||item.fieldId)===id);assert.ok(entry,id);
        sample.result.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value=value;
    }
    sample.buffer=await X.serializeEmployeeHistoryProposalWorkbook(sample.result.workbook);return sample;
}
async function openEditor(page,h,selection){
    await page.goto(`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal-editor?selection=${encodeURIComponent(selection)}`);
}
async function isolatedBrowser(h){
    const browser=await chromium.launch({headless:true}),context=await browser.newContext({acceptDownloads:true});
    const external=[],errors=[];
    await context.route('**/*',route=>{
        if(new URL(route.request().url()).origin===h.origin)return route.continue();external.push(route.request().url());return route.abort();
    });
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    return {browser,context,external,errors};
}

test('Chromium: ελληνική επιλογή, αυτόματη φόρτωση UPDATE/INSERT, άλλη περίπτωση και απορρίψεις χωρίς απώλεια συμπληρώσεων',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const update=await importSample(),insert=await importSample('INSERT');
    const h=await startUnifiedPreviewHarness({data:update.data,catalogs:update.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        await openEditor(page,h,update.selection);
        const protectedBefore=await protectedState(page);
        await field(page,'nomimosMisthos').fill('777,77');
        let imports=0;page.on('request',request=>{if(request.url().endsWith('/history-proposal-import-preview'))imports++;});
        // Keyboard activation of a real button opens the native accessible picker.
        const chosen=page.waitForEvent('filechooser');
        await page.getByRole('button',{name:'Επιλέξτε αρχείο',exact:true}).focus();await page.keyboard.press('Enter');
        await (await chosen).setFiles(uploadFile(update));await ready(page);
        assert.equal(imports,1);assert.equal(await page.locator('#proposalImportFilename').textContent(),update.result.filename);
        assert.equal(await page.locator('#proposalImportFile').isVisible(),false);
        assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
        assert.equal(await field(page,'hmeromhnia_allaghs_symbashs').inputValue(),'2026-02-03');
        assert.match(await page.locator('#proposalImportRows').textContent(),/UPDATE.*1\.234,56/s);
        assert.match(await page.locator('#proposalImportStatus').textContent(),/τοπικές συμπληρώσεις.*Δεν αποθηκεύτηκε καμία αλλαγή/s);
        assert.deepEqual(await protectedState(page),protectedBefore);
        assert.equal(await page.locator('#proposalImportPreview button').count(),0);
        await field(page,'pragmatikosMisthos').fill('1777.77');
        const completions=await editorState(page);
        const tampered=new ExcelJS.Workbook();await tampered.xlsx.load(update.buffer);
        tampered.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value='Αλλοιωμένο ΠΡΙΝ';
        const bad={...update,buffer:Buffer.from(await tampered.xlsx.writeBuffer())};
        assert.equal((await upload(page,bad)).code,'EMPLOYEE_HISTORY_XLSX_IMPORT_PROTECTED');
        assert.match(await page.locator('#proposalImportStatus').textContent(),/EMPLOYEE_HISTORY_XLSX_IMPORT_PROTECTED/);
        assert.equal(await page.locator('#proposalImportPreview').isVisible(),false);assert.deepEqual(await editorState(page),completions);
        await upload(page,insert);
        assert.match(await page.locator('#proposalImportStatus').textContent(),/Ελλείπουσα περίοδος 2026-02-09.*EMPLOYEE_HISTORY_XLSX_IMPORT_CASE_MISMATCH/s);
        assert.match(await page.locator('#proposalImportRows').textContent(),/INSERT/);assert.deepEqual(await editorState(page),completions);
        const otherResult=await X.buildEmployeeHistoryProposalWorkbook(update.data,update.catalogs,{selection:`UPDATE:${update.data.completeHistoryRows.at(-1)._id}`});
        const other={result:otherResult,buffer:await X.serializeEmployeeHistoryProposalWorkbook(otherResult.workbook)};
        assert.equal((await upload(page,other)).success,true);
        assert.match(await page.locator('#proposalImportStatus').textContent(),/Εγγραφή 0003.*EMPLOYEE_HISTORY_XLSX_IMPORT_CASE_MISMATCH/s);
        assert.deepEqual(await editorState(page),completions);
        await page.locator('#proposalSelection').selectOption(insert.selection);await page.locator('#proposalCaseSelector button').click();
        assert.equal(await page.locator('#proposalSelectionWarning').isVisible(),true);await page.locator('#keepProposalEdits').click();
        const previousUpdatedAt=h.state.currentEmployee.updatedAt;h.state.currentEmployee.updatedAt='2026-11-16';
        assert.equal((await upload(page,update)).code,'EMPLOYEE_HISTORY_XLSX_IMPORT_STALE');
        assert.match(await page.locator('#proposalImportStatus').textContent(),/EMPLOYEE_HISTORY_XLSX_IMPORT_STALE/);
        assert.deepEqual(await editorState(page),completions);
        if(previousUpdatedAt===undefined)delete h.state.currentEmployee.updatedAt;else h.state.currentEmployee.updatedAt=previousUpdatedAt;
        const insertPage=await context.newPage();await openEditor(insertPage,h,insert.selection);await upload(insertPage,insert);
        assert.equal(await field(insertPage,'nomimosMisthos').inputValue(),'1234.56');
        assert.match(await insertPage.locator('#proposalImportStatus').textContent(),/φορτώθηκαν/);
        assert.deepEqual(await protectedState(page),protectedBefore);
        // The standalone editor has no sidebar; reduce its actual content width
        // by a sidebar-sized strip as well as resizing the Chromium viewport.
        for(const [width,height] of [[1920,1080],[1440,900],[1100,800],[700,600],[480,700],[900,450]])for(const sidebar of [false,true]){
            await insertPage.setViewportSize({width,height});
            await insertPage.evaluate(sidebar=>{const main=document.querySelector('.proposal-page');main.style.width=sidebar?'calc(100% - 160px)':'';main.style.marginLeft=sidebar?'160px':'';},sidebar);
            assert.equal(await insertPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await insertPage.locator('#chooseProposalFile').isEnabled(),true);
            assert.ok(await insertPage.locator('.proposal-import-scroll').evaluate(node=>node.scrollWidth>node.clientWidth||node.clientWidth>=1400));
            assert.ok(await insertPage.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node=>node.scrollHeight>node.clientHeight));
        }
        const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-import-browser-'));
        await insertPage.locator('.proposal-import').screenshot({path:path.join(folder,'import-loaded.png')});
        console.log(`Συνθετική εικόνα φόρτωσης: ${path.join(folder,'import-loaded.png')}`);
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});

test('Chromium: typed ΜΕΤΑ, 0/1/2, εξαρτώμενοι κατάλογοι με ίδιους κωδικούς, αρχικά μηδενικά και επανεξαγωγή',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const catalogs=structuredClone(F.catalogs);
    catalogs.CONTRACT_TYPE.push({code:'02',label:'Δεύτερη συνθετική σύμβαση'});
    catalogs.CONTRACT_CATEGORY.push({...catalogs.CONTRACT_CATEGORY[0],afora_thn_symbash:'02'});
    catalogs.CONTRACT_SPECIALTY.push({...catalogs.CONTRACT_SPECIALTY[0],afora_thn_symbash_kathgoria:'0201'});
    catalogs.CONTRACT_ITEM.push({code:'0007',label:'Συνθετικό επίδομα',afora_thn_symbash_kathgoria_eidikothta:'020101'});
    const sample=await importSample('UPDATE',F.employee0002HistoryProposalFixture(),catalogs);
    const h=await startUnifiedPreviewHarness({data:sample.data,catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        await openEditor(page,h,sample.selection);const protectedBefore=await protectedState(page);
        await page.evaluate(()=>{window.showSaveFilePicker=async()=>({createWritable:async()=>({
            write:async blob=>window.savedBytes=Array.from(new Uint8Array(await blob.arrayBuffer())),close:async()=>{}
        })});});
        for(const employment of [0,1,2]){
            await editSample(sample,{symbash:'02',kathgoria_symbashs:'01',eidikothta_symbashs:'01',stoixeio_symbashs_01:'0007',
                eidikh_kathgoria_ergazomenoy:'0004',typos_apasxolhshs:employment,kathestos_apasxolhshs:employment,
                nomimosMisthos:employment===1?'1234.56':'1234,56',nomimoOromisthio:'7.35',
                typos_orarioy:employment!==1,dialleima_entos_ektos_orarioy:false,
                hmeres_efarmoghs_egkekrimenhs_rythmishs:employment===1?'Καμία ημέρα':'1, 3, 7',
                hmeromhnia_allaghs_symbashs:'03/02/2026',hmnia_enarxhs_egkekrimenhs_rythmishs:'2026-02-03',
                dialleima_apo_ora_01:'12:00',dialleima_eos_ora_01:'12:30'});
            const result=await upload(page,sample);assert.equal(result.success,true,result.message);
            assert.match(await page.locator('#proposalImportStatus').textContent(),/φορτώθηκαν/);
            assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
            assert.equal(await field(page,'nomimoOromisthio').inputValue(),'7.35');
            assert.equal(await field(page,'hmeromhnia_allaghs_symbashs').inputValue(),'2026-02-03');
            assert.equal(await field(page,'dialleima_apo_ora_01').inputValue(),'12:00');
            for(const id of ['typos_apasxolhshs','kathestos_apasxolhshs'])
                assert.equal(await field(page,id).locator('option:checked').getAttribute('data-raw-value'),JSON.stringify(String(employment)));
            for(const [id,code,parent] of [['symbash','02',''],['kathgoria_symbashs','01','02'],['eidikothta_symbashs','01','0201'],['stoixeio_symbashs_01','0007','020101'],['eidikh_kathgoria_ergazomenoy','0004','']]){
                const selected=field(page,id).locator('option:checked');assert.equal(await selected.getAttribute('data-code'),code);
                assert.equal(await selected.getAttribute('data-parent'),parent);assert.equal(await selected.isEnabled(),true);
            }
            assert.deepEqual(await field(page,'hmeres_efarmoghs_egkekrimenhs_rythmishs').evaluate(node=>[...node.selectedOptions].map(option=>Number(option.value))),employment===1?[]:[1,3,7]);
            assert.equal(await field(page,'typos_orarioy').locator('option:checked').getAttribute('data-raw-value'),JSON.stringify(employment!==1));
            assert.equal(await page.locator('[data-edit-index][data-edited="true"]').count(),result.editorValues.values.length);
            // A subsequent manual edit must still take precedence on export.
            if(employment===2)await field(page,'nomimosMisthos').fill('2345,67');
            const response=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/history-proposal.xlsx'));
            await page.locator('#saveProposalXlsx').click();assert.equal((await response).status(),200);
            await page.waitForFunction(()=>document.getElementById('proposalSaveStatus').textContent.startsWith('Το XLSX αποθηκεύτηκε'));
            const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await page.evaluate(()=>window.savedBytes)));
            const completions=book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row=>row?.[1]==='localCompletion').map(row=>JSON.parse(row[2]));
            const exported=new Map(completions.map(item=>[item.canonicalField,item.value]));
            for(const {fieldId,value} of result.editorValues.values) assert.deepEqual(exported.get(fieldId),fieldId==='nomimosMisthos'&&employment===2?2345.67:value,fieldId);
            assert.ok(completions.every(item=>item.approval===false&&item.confirmed===false&&item.importEnabled===false));
            assert.deepEqual(await protectedState(page),protectedBefore);
            // Re-import the exported workbook through the same independent checks.
            const reimport=await upload(page,{...sample,buffer:Buffer.from(await book.xlsx.writeBuffer())});assert.equal(reimport.success,true,reimport.message);
        }
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});

test('Chromium: καμία φόρτωση πριν από την επικύρωση και πλήρης διατήρηση σε μη έγκυρη απάντηση',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const sample=await importSample(),h=await startUnifiedPreviewHarness({data:sample.data,catalogs:sample.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    const pattern='**/history-proposal-import-preview';
    try{
        await openEditor(page,h,sample.selection);await field(page,'nomimosMisthos').fill('888,88');
        const previous=await editorState(page),protectedBefore=await protectedState(page);
        let release,received;
        const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{received=resolve;});
        await page.route(pattern,async route=>{const response=await route.fetch();received();await gate;await route.fulfill({response});});
        await page.locator('#proposalImportFile').setInputFiles(uploadFile(sample));await started;
        assert.equal(await field(page,'nomimosMisthos').inputValue(),'888,88');
        assert.equal(await page.locator('#saveProposalXlsx').isDisabled(),true);
        assert.equal(await page.locator('#proposalCaseSelector button').isDisabled(),true);
        assert.deepEqual((await editorState(page)).map(({disabled,...item})=>item),previous.map(({disabled,...item})=>item));
        release();await ready(page);await page.unroute(pattern);
        assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
        await field(page,'nomimosMisthos').fill('999,99');
        const completions=await editorState(page);
        for(const mutate of [
            result=>{result.editorValues.values.at(-1).fieldId='_id';},
            result=>{result.editorValues.values.at(-1).fieldId=result.editorValues.values[0].fieldId;},
            result=>{result.editorValues.values.find(item=>item.fieldId==='nomimosMisthos').value='1234,56';},
            result=>{result.editorValues.values.find(item=>item.fieldId==='eidikothta_symbashs').value='9999';},
            result=>{result.editorValues.snapshotFingerprint='synthetic-stale-editor';}
        ]){
            await page.route(pattern,async route=>{const response=await route.fetch(),result=await response.json();mutate(result);await route.fulfill({response,json:result});});
            await upload(page,sample);await page.unroute(pattern);
            assert.deepEqual(await editorState(page),completions);assert.deepEqual(await protectedState(page),protectedBefore);
            assert.match(await page.locator('#proposalImportStatus').textContent(),/Δεν άλλαξε κανένα πεδίο.*Κωδικός αναφοράς:/s);
        }
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});
