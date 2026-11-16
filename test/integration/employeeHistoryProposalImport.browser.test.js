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

test('Chromium: γνήσια συμπληρωμένα v4 φορτώνουν όλα τα ΜΕΤΑ και απαιτούν νέα επιλογή Ναι', {timeout:45000}, async()=>{
    forbidRealSettlementMongo(mock);
    const sample=await importSample(),h=await startUnifiedPreviewHarness({data:sample.data,catalogs:sample.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        for(const operation of ['UPDATE','INSERT']){
            const legacy=await importSample(operation);
            legacy.buffer=await fs.readFile(path.resolve(__dirname,`../fixtures/employeeHistoryProposalV4${operation}.xlsx`));
            await openEditor(page,h,legacy.selection);
            assert.deepEqual(await field(page,'DECLARATION').locator('option').allTextContents(),['Όχι','Ναι']);
            assert.equal(await field(page,'DECLARATION').locator('option:checked').textContent(),'Όχι');
            const result=await upload(page,legacy);assert.equal(result.success,true,result.message);assert.equal(result.legacyFormat,true);
            assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
            assert.equal(await field(page,'DECLARATION').locator('option:checked').textContent(),'Όχι');
            const loaded=(await editorState(page)).filter(item=>item.id!=='DECLARATION');
            await field(page,'DECLARATION').selectOption({label:'Ναι'});
            assert.deepEqual((await editorState(page)).filter(item=>item.id!=='DECLARATION'),loaded);
            assert.equal(await page.locator('#approveProposalApply').isDisabled(),true);
        }
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});
async function upload(page,sample,{choice='confirm'}={}){
    const response=page.waitForResponse(response=>response.url().endsWith('/history-proposal-import-preview'));
    await page.locator('#proposalImportFile').setInputFiles(uploadFile(sample));
    const result=await (await response).json();
    await page.waitForFunction(()=>!document.getElementById('chooseProposalFile').disabled||document.getElementById('proposalSelectionWarning').open);
    if(await page.locator('#proposalSelectionWarning').isVisible()){
        await page.locator(choice==='cancel'?'#keepProposalEdits':'#confirmProposalSwitch').click();
    }
    await ready(page);return result;
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

test('Α/Β: μία επιλογή XLSX, σύντομη επιτυχία, σωστός editor και αυτόματη μετάβαση χωρίς επαναφόρτωση',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const update=await importSample(),insert=await importSample('INSERT');
    const h=await startUnifiedPreviewHarness({data:update.data,catalogs:update.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        await openEditor(page,h,update.selection);const protectedBefore=await protectedState(page);
        let imports=0;page.on('request',request=>{if(request.url().endsWith('/history-proposal-import-preview'))imports++;});
        const chosen=page.waitForEvent('filechooser');
        await page.getByRole('button',{name:'Επιλέξτε αρχείο',exact:true}).focus();await page.keyboard.press('Enter');
        await (await chosen).setFiles(uploadFile(update));await ready(page);
        assert.equal(imports,1);assert.equal(await page.locator('#proposalImportFilename').textContent(),update.result.filename);
        assert.equal(await page.locator('#proposalImportFile').isVisible(),false);
        assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
        assert.equal(await field(page,'hmeromhnia_allaghs_symbashs').inputValue(),'2026-02-03');
        assert.equal(await page.locator('#proposalImportStatus').textContent(),'Ο έλεγχος ολοκληρώθηκε επιτυχώς. Τα ΜΕΤΑ φορτώθηκαν στα πεδία της ιστορικής εγγραφής 0001. Δεν πραγματοποιήθηκε αποθήκευση στη βάση.');
        assert.equal(await page.locator('#proposalImportPreview,.proposal-import-table,#proposalImportIssues table').count(),0);
        assert.match(await page.locator('#proposalImportPending').textContent(),/παραμένει προς έλεγχο/);
        assert.doesNotMatch(await page.locator('#proposalImportPending').textContent(),/Προέλευση και εκκρεμότητες/);
        assert.equal(await page.locator('#proposalEditorTitle').evaluate(node=>node===document.activeElement),true);
        assert.deepEqual(await protectedState(page),protectedBefore);
        for(const sample of [update,insert]){
            const other=await context.newPage();await openEditor(other,h,`UPDATE:${h.state.completeHistoryRows.at(-1)._id}`);
            let posts=0,navigations=0;other.on('request',request=>{if(request.url().endsWith('/history-proposal-import-preview'))posts++;});
            other.on('request',request=>{if(request.isNavigationRequest())navigations++;});
            await other.evaluate(()=>{window.originalFileInput=document.getElementById('proposalImportFile');window.selectedFiles=0;window.originalFileInput.addEventListener('change',()=>window.selectedFiles++);});
            const result=await upload(other,sample);
            assert.equal(result.success,true);assert.equal(posts,1);assert.equal(navigations,0);
            assert.equal(await other.evaluate(()=>window.originalFileInput===document.getElementById('proposalImportFile')&&window.selectedFiles===1),true);
            assert.equal(await other.locator('#proposalImportFile').evaluate(node=>node.files[0].name),sample.result.filename);
            assert.equal(await other.locator('#proposalSelection').inputValue(),sample.selection);
            assert.equal(await other.locator('#historyProposalEditor').getAttribute('data-case-id'),result.editorValues.caseId);
            assert.equal(await other.locator('#historyProposalEditor').getAttribute('data-snapshot'),result.editorValues.snapshotFingerprint);
            assert.match(await other.locator('#proposalActiveCase').textContent(),new RegExp(sample===update?'UPDATE.*0001':'INSERT.*09/02/2026'));
            assert.equal(await field(other,'nomimosMisthos').inputValue(),'1234.56');
            assert.equal(await other.locator('.proposal-import table').count(),0);
            assert.equal(await other.locator('.proposal-actions').count(),1);
            await other.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--proposal-actions-height'))>0);
            assert.equal(await other.locator('.proposal-actions').evaluate(node=>getComputedStyle(node).position),'fixed');
            const exportUrl=`/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal.xlsx?selection=${encodeURIComponent(sample.selection)}`;
            assert.equal(await other.locator('#historyProposalEditor').getAttribute('data-export-url'),exportUrl);
            assert.equal(await other.locator('.proposal-actions a').getAttribute('href'),exportUrl);
            const originalDownload=other.waitForEvent('download');await other.locator('.proposal-actions a').click();
            const original=await originalDownload;
            assert.equal(original.suggestedFilename(),sample.result.filename);
            const initialBook=new ExcelJS.Workbook();await initialBook.xlsx.load(await fs.readFile(await original.path()));
            const sourceBook=new ExcelJS.Workbook();await sourceBook.xlsx.load(sample.buffer);
            const provenance='Προέλευση και εκκρεμότητες';
            assert.deepEqual(initialBook.getWorksheet(provenance).getSheetValues(),sourceBook.getWorksheet(provenance).getSheetValues());
            assert.equal(initialBook.getWorksheet(provenance).sheetProtection.sheet,true);
            assert.deepEqual(initialBook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value,sourceBook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value);
            assert.equal(await other.evaluate(()=>localStorage.length+sessionStorage.length),0);
            await other.evaluate(()=>{window.showSaveFilePicker=async()=>({createWritable:async()=>({
                write:async blob=>window.savedBytes=Array.from(new Uint8Array(await blob.arrayBuffer())),close:async()=>{}
            })});});
            const downloaded=other.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/history-proposal.xlsx'));
            await other.locator('#saveProposalXlsx').click();const exportedResponse=await downloaded;assert.equal(exportedResponse.status(),200);
            await other.waitForFunction(()=>document.getElementById('proposalSaveStatus').textContent.startsWith('Το XLSX αποθηκεύτηκε'));
            await other.waitForFunction(()=>{
                const height=document.querySelector('.proposal-actions').getBoundingClientRect().height;
                return Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--proposal-actions-height'))-height)<1&&
                    Math.abs(parseFloat(getComputedStyle(document.body).paddingBottom)-height)<1;
            });
            await other.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
            assert.equal(await other.locator('.proposal-table-scroll').evaluate(node=>node.getBoundingClientRect().bottom<document.querySelector('.proposal-actions').getBoundingClientRect().top),true);
            const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await other.evaluate(()=>window.savedBytes)));
            assert.deepEqual(book.getWorksheet(provenance).getSheetValues(),initialBook.getWorksheet(provenance).getSheetValues());
            assert.equal(book.getWorksheet(provenance).sheetProtection.sheet,true);
            const metadata=book.getWorksheet('Ταυτοποίηση').getSheetValues();
            assert.equal(JSON.parse(metadata.find(row=>row?.[1]==='selectedCase')[2]).id,result.editorValues.caseId);
            assert.equal(metadata.find(row=>row?.[1]==='snapshotFingerprint')[2],result.editorValues.snapshotFingerprint);
            const raw=new Map(metadata.filter(row=>row?.[1]==='localCompletion').map(row=>{const value=JSON.parse(row[2]);return [value.canonicalField,value.value];}));
            for(const {fieldId,value} of result.editorValues.values)assert.deepEqual(raw.get(fieldId),value,fieldId);
        }
        for(const [width,height] of [[1920,1080],[1440,900],[1100,800],[700,600],[480,700],[900,450]])for(const sidebar of [false,true]){
            await page.setViewportSize({width,height});
            await page.evaluate(sidebar=>{const main=document.querySelector('.proposal-page');main.style.width=sidebar?'calc(100% - 160px)':'';main.style.marginLeft=sidebar?'160px':'';},sidebar);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await page.locator('#chooseProposalFile').isEnabled(),true);
            assert.ok(await page.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node=>node.scrollHeight>node.clientHeight));
        }
        const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-history-single-file-'));
        await page.screenshot({path:path.join(folder,'editor-loaded.png'),fullPage:true});console.log(`Συνθετική εικόνα: ${folder}/editor-loaded.png`);
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
            assert.match(await page.locator('#proposalImportStatus').textContent(),/ΜΕΤΑ φορτώθηκαν/);
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

test('Γ/Δ: αυτόματη αλλαγή με πληκτρολόγιο, ακύρωση και αποτυχία κρατούν την πραγματική περίπτωση και όλες τις συμπληρώσεις',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const sample=await importSample(),h=await startUnifiedPreviewHarness({data:sample.data,catalogs:sample.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        await openEditor(page,h,sample.selection);
        assert.equal(await page.locator('#proposalCaseSelector button').count(),0);
        await page.locator('#proposalSelection').focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await ready(page);
        const active=`UPDATE:${h.state.completeHistoryRows.at(-1)._id}`;
        assert.equal(await page.locator('#proposalSelection').inputValue(),active);
        assert.match(await page.locator('#proposalActiveCase').textContent(),/UPDATE.*0003/);
        const insert=await importSample('INSERT');
        await page.locator('#proposalSelection').selectOption(insert.selection);await ready(page);
        assert.match(await page.locator('#proposalActiveCase').textContent(),/INSERT.*09\/02\/2026/);
        assert.equal(await page.locator('#proposalSelection').inputValue(),insert.selection);
        await page.locator('#proposalSelection').selectOption(active);await ready(page);
        await field(page,'nomimosMisthos').fill('888,88');await field(page,'hmeres_efarmoghs_egkekrimenhs_rythmishs').selectOption(['2','5']);
        const previous=await editorState(page),protectedBefore=await protectedState(page);
        await page.locator('#proposalSelection').selectOption(sample.selection);
        assert.equal(await page.locator('#proposalSelectionWarning').isVisible(),true);
        for(const [width,height] of [[480,700],[900,450]]){
            await page.setViewportSize({width,height});
            for(const id of ['keepProposalEdits','confirmProposalSwitch']){
                const button=page.locator(`#${id}`);await button.scrollIntoViewIfNeeded();
                assert.equal(await button.evaluate(node=>{
                    const rect=node.getBoundingClientRect();
                    return rect.top>=0&&rect.bottom<=innerHeight&&node.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));
                }),true);
            }
            assert.equal(await page.locator('#proposalSelectionWarning').evaluate(node=>node.matches(':modal')),true);
        }
        await page.setViewportSize({width:1440,height:900});
        assert.equal(await page.locator('#proposalSelection').inputValue(),active);await page.keyboard.press('Escape');await ready(page);
        assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedBefore);
        h.access.read=false;
        await page.locator('#proposalSelection').selectOption(sample.selection);await page.locator('#confirmProposalSwitch').click();await ready(page);
        assert.equal(await page.locator('#proposalSelection').inputValue(),active);
        assert.match(await page.locator('#proposalSelectionStatus').textContent(),/Κωδικός αναφοράς/);
        assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedBefore);h.access.read=true;
        const result=await upload(page,sample,{choice:'cancel'});
        assert.equal(result.success,true);assert.deepEqual(await editorState(page),previous);
        assert.equal(await page.locator('#proposalImportFile').evaluate(node=>node.files[0].name),sample.result.filename);
        assert.equal(await page.locator('#proposalSelection').inputValue(),active);
        const response=page.waitForResponse(response=>response.url().endsWith('/history-proposal-import-preview'));
        await page.locator('#previewProposalImport').click();await response;
        await page.locator('#proposalSelectionWarning').waitFor({state:'visible'});
        assert.deepEqual((await editorState(page)).map(({disabled,...entry})=>entry),previous.map(({disabled,...entry})=>entry));
        await page.locator('#confirmProposalSwitch').click();await ready(page);
        assert.equal(await page.locator('#proposalSelection').inputValue(),sample.selection);
        assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
        assert.equal(await page.locator('#proposalImportFile').evaluate(node=>node.files[0].name),sample.result.filename);
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});

test('Ε/ΣΤ: μόνο πραγματικά προβληματικά πεδία, γενικές απορρίψεις χωρίς επινοημένα πεδία και μηδενική μερική φόρτωση',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const sample=await importSample(),h=await startUnifiedPreviewHarness({data:sample.data,catalogs:sample.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    try{
        await openEditor(page,h,sample.selection);await field(page,'nomimosMisthos').fill('888,88');
        const previous=await editorState(page),protectedBefore=await protectedState(page);
        for(const [id,value] of [['nomimosMisthos','αδύνατος αριθμός'],['eidikothta_symbashs','9999'],['hmeromhnia_allaghs_symbashs','31/02/2026']]){
            const bad=await editSample(await importSample(),{[id]:value});const result=await upload(page,bad);
            assert.equal(result.success,false);assert.equal(result.problems.length,1);
            assert.equal(result.problems[0].fieldId,id);assert.ok(result.problems[0].action);
            await page.setViewportSize({width:480,height:700});
            await page.evaluate(()=>{const main=document.querySelector('.proposal-page');main.style.width='calc(100% - 160px)';main.style.marginLeft='160px';});
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await page.locator('#proposalImportIssues tbody td').first().evaluate(node=>getComputedStyle(node).display),'block');
            assert.deepEqual(await page.locator('#proposalImportIssues th').allTextContents(),['Πεδίο','Πρόβλημα','Απαιτούμενη ενέργεια']);
            assert.equal(await page.locator('#proposalImportIssues tbody tr').count(),1);
            assert.equal(await page.locator('#proposalImportIssues tbody td').first().textContent(),result.problems[0].field);
            assert.match(await page.locator('#proposalImportStatus').textContent(),new RegExp(result.code));
            assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedBefore);
        }
        const mutations=[
            ['PROTECTED',book=>{book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value='Αλλοιωμένο ΠΡΙΝ';}],
            ['SCOPE',book=>{const sheet=book.getWorksheet('Ταυτοποίηση');sheet.eachRow(row=>{if(row.getCell(1).value==='scope'){const scope=JSON.parse(row.getCell(2).value);scope.company_kod='610000000000000000000099';row.getCell(2).value=JSON.stringify(scope);}});}],
            ['SCOPE',book=>{book.getWorksheet('Ταυτοποίηση').eachRow(row=>{if(row.getCell(1).value==='employeeId')row.getCell(2).value='620000000000000000000999';});}],
            ['STALE',()=>{}]
        ];
        for(const [code,mutate] of mutations){
            const book=new ExcelJS.Workbook();await book.xlsx.load(sample.buffer);mutate(book);
            const updatedAt=h.state.currentEmployee.updatedAt;if(code==='STALE')h.state.currentEmployee.updatedAt='2026-11-17';
            const result=await upload(page,{...sample,buffer:Buffer.from(await book.xlsx.writeBuffer())});
            if(updatedAt===undefined)delete h.state.currentEmployee.updatedAt;else h.state.currentEmployee.updatedAt=updatedAt;
            assert.equal(result.code,`EMPLOYEE_HISTORY_XLSX_IMPORT_${code}`);
            assert.equal(await page.locator('#proposalImportIssues').isVisible(),false);assert.equal(await page.locator('#proposalImportIssues table').count(),0);
            assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedBefore);
        }
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});

test('Η: σειριοποίηση αιτημάτων, καμία πρόωρη φόρτωση και επαλήθευση του νέου editor πριν την αντικατάσταση',{timeout:45000},async()=>{
    forbidRealSettlementMongo(mock);
    const sample=await importSample(),h=await startUnifiedPreviewHarness({data:sample.data,catalogs:sample.catalogs}),before=A.stringify(h.state);
    const {browser,context,external,errors}=await isolatedBrowser(h),page=await context.newPage();
    const pattern='**/history-proposal-import-preview';
    try{
        const other=`UPDATE:${h.state.completeHistoryRows.at(-1)._id}`;await openEditor(page,h,other);
        let release,received,posts=0;
        const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{received=resolve;});
        await page.route(pattern,async route=>{posts++;const response=await route.fetch();received();await gate;await route.fulfill({response});});
        const initial=await editorState(page),protectedBefore=await protectedState(page);
        await page.locator('#proposalImportFile').setInputFiles(uploadFile(sample));await started;
        assert.equal(await page.locator('#saveProposalXlsx').isDisabled(),true);assert.equal(await page.locator('#proposalSelection').isDisabled(),true);
        await page.evaluate(()=>{document.getElementById('historyProposalImport').requestSubmit();document.getElementById('historyProposalImport').requestSubmit();const select=document.getElementById('proposalSelection');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));});
        assert.equal(await page.locator('#proposalSelection').inputValue(),other);assert.equal(posts,1);
        assert.deepEqual((await editorState(page)).map(({disabled,...entry})=>entry),initial.map(({disabled,...entry})=>entry));
        assert.deepEqual(await protectedState(page),protectedBefore);
        release();await ready(page);await page.unroute(pattern);
        assert.equal(await page.locator('#proposalSelection').inputValue(),sample.selection);assert.equal(await field(page,'nomimosMisthos').inputValue(),'1234.56');
        // A transition arriving with another scope, case or snapshot must never
        // replace the live editor, even though its HTTP request succeeded.
        const insert=await importSample('INSERT');await field(page,'nomimosMisthos').fill('999,99');
        const previous=await editorState(page),protectedLoaded=await protectedState(page);
        const editorPattern='**/history-proposal-editor?*';
        for(const mutate of [
            text=>text.replace(/data-scope-context="[^"]*"/,'data-scope-context="other-authorized-company"'),
            text=>text.replaceAll(insert.result.caseSelection.selectedCase.id,'history-case-wrong-but-consistent'),
            text=>text.replaceAll(insert.result.snapshotFingerprint,'synthetic-wrong-snapshot')
        ]){
            await page.route(editorPattern,async route=>{const response=await route.fetch();await route.fulfill({response,body:mutate(await response.text())});});
            await upload(page,insert);await page.unroute(editorPattern);
            assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedLoaded);
            assert.match(await page.locator('#proposalImportStatus').textContent(),/Κωδικός αναφοράς/);
        }
        for(const mutate of [
            result=>{result.editorValues.values.at(-1).fieldId='_id';},
            result=>{result.editorValues.values.at(-1).fieldId=result.editorValues.values[0].fieldId;},
            result=>{result.editorValues.values.find(item=>item.fieldId==='nomimosMisthos').value='1234,56';}
        ]){
            await page.route(pattern,async route=>{const response=await route.fetch(),result=await response.json();mutate(result);await route.fulfill({response,json:result});});
            await upload(page,sample);await page.unroute(pattern);
            assert.deepEqual(await editorState(page),previous);assert.deepEqual(await protectedState(page),protectedLoaded);
        }
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await h.close();mock.restoreAll();}
});
