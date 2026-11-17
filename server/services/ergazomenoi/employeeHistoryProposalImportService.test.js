'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const ExcelJS=require('exceljs'),JSZip=require('jszip');
const F=require('../../../test/fixtures/employee0002HistoryProposalFixture');
const {forbidRealSettlementMongo}=require('../../../test/fixtures/forbidRealSettlementMongo');
const {startUnifiedPreviewHarness}=require('../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const X=require('./employeeHistoryProposalXlsxService'),E=require('./employeeHistoryProposalEditorService');
const A=require('./employeeHistoryAutomaticReconstructionApplyContract'),C=require('./employeeHistoryAutomaticReconstructionContract');
const {previewEmployeeHistoryProposalImport:preview}=require('./employeeHistoryProposalImportService');
const {readImportProtection}=require('./employeeHistoryProposalImportProtectionService');
const {MAX_FILE_BYTES}=require('./employeeHistoryProposalImportFileService');
const ImportFile=require('./employeeHistoryProposalImportFileService');
const {legacyImportMetadataFixture}=require('../../../test/fixtures/employeeHistoryProposalImportFixture');
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
const protection=async()=>({controls:[],snapshots:[]});
function reqFor(data){return {sessionID:'synthetic-import-session',session:{userId:'630000000000000000000001',userTeam:data.scope.team,
    companyInUse:data.scope.company_kod},params:{id:String(data.currentEmployee._id)}};}
async function exported(operation='UPDATE',data=F.employee0002HistoryProposalFixture(),catalogs=F.catalogs){
    let selection=`UPDATE:${data.completeHistoryRows[0]._id}`;
    if(operation==='INSERT'){
        const initial=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs);
        selection=`INSERT:${initial.caseSelection.cases.find(item=>item.operation==='INSERT').id}`;
    }
    const result=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs,{selection});
    return {data,catalogs,result,req:reqFor(data)};
}
const entry=(f,field)=>f.result.editableCells.find(item=>item.canonicalField===field||item.role===field);
const set=(f,field,value)=>{const item=entry(f,field);assert.ok(item,field);f.result.workbook.getWorksheet(item.sheet).getCell(item.cell).value=value;};
const buffer=f=>X.serializeEmployeeHistoryProposalWorkbook(f.result.workbook);
const check=(f,bytes,loadProtection=protection,data=f.data)=>preview({buffer:bytes,input:data,catalogs:f.catalogs,req:f.req,loadProtection});
async function edited(f){
    set(f,'nomimosMisthos',1234.56);set(f,'EVIDENCE','Συνθετικό έγγραφο — επιβεβαίωση περιόδου');
    set(f,'DECLARATION','Ναι');
    if(f.result.caseSelection.selectedCase.operation==='UPDATE'){
        set(f,C.CHANGE,new Date('2026-02-03T00:00:00Z'));
        set(f,'eidikothta_symbashs','01');
    }
    return buffer(f);
}

test('γνήσια συμπληρωμένα v4 του #395: διατήρηση ΜΕΤΑ, παλιές επιλογές και νέα έγκριση Όχι',async()=>{
    for (const operation of ['UPDATE','INSERT']) {
        const f=await exported(operation),before=A.stringify(f.data);
        const bytes=await fs.readFile(path.resolve(__dirname,`../../../test/fixtures/employeeHistoryProposalV4${operation}.xlsx`));
        let expected;
        for (const declaration of ['Δηλώνω τεκμηριωμένα στοιχεία','Παραμένει αβέβαιο',null]) {
            const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
            const mapping=ImportFile.metadataRows(book).get('editableCell').map(JSON.parse).find(entry=>entry.role==='DECLARATION');
            book.getWorksheet(mapping.sheet).getCell(mapping.cell).value=declaration;
            const result=await check(f,Buffer.from(await book.xlsx.writeBuffer()));
            assert.equal(result.legacyFormat,true);assert.equal(result.declaration,'Όχι');
            const raw=new Map(result.editorValues.values.map(item=>[item.fieldId,item.value]));
            assert.equal(raw.get('DECLARATION'),'Όχι');assert.equal(raw.get('nomimosMisthos'),1234.56);
            assert.equal(raw.get('EVIDENCE'),'Παρατήρηση παλιάς μορφής');
            assert.equal(result.editorValues.values.length,f.result.editableCells.length);
            if(expected)assert.deepEqual(result.editorValues.values,expected);else expected=result.editorValues.values;
        }
        assert.equal(A.stringify(f.data),before);
        for (const mutate of [
            book=>{book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('B8').value='αλλοίωση';},
            book=>{metadataRow(book,'snapshotFingerprint').getCell(2).value='0'.repeat(64);},
            book=>{metadataRow(book,'proposalFingerprint').getCell(2).value='0'.repeat(64);},
            book=>{metadataRow(book,'editableCell').getCell(2).value='{}';},
            book=>{metadataRow(book,'selectedCase').getCell(2).value='{}';},
            book=>{metadataRow(book,'layoutVersion').getCell(2).value=X.LAYOUT_VERSION;},
            book=>{metadataRow(book,'employeeId').getCell(2).value='620000000000000000000999';},
            book=>{metadataRow(book,'comparisonField').getCell(2).value='{}';}
        ]) {
            const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);mutate(book);
            await assert.rejects(check(f,Buffer.from(await book.xlsx.writeBuffer())),error=>Boolean(error.importReason));
        }
    }
});

test('νέο XLSX: προεπιλογή Όχι, αποκλειστικά Ναι/Όχι και προαιρετική αυτούσια αιτιολογία',async()=>{
    const f=await exported();
    const declaration=entry(f,'DECLARATION'),sheet=f.result.workbook.getWorksheet(declaration.sheet);
    assert.equal(sheet.getCell(declaration.cell).value,'Όχι');
    assert.deepEqual(declaration.options.map(option=>option.id),['Όχι','Ναι']);
    assert.equal(sheet.getCell(declaration.cell).dataValidation.allowBlank,false);
    await edited(f);
    for(const reason of ['', '-', '  Ελεύθερη παρατήρηση χωρίς παραπομπή  ', 'x'.repeat(4000)])for(const approval of ['Όχι','Ναι']){
        set(f,'EVIDENCE',reason);set(f,'DECLARATION',approval);
        const result=await check(f,await buffer(f));
        assert.equal(result.evidence,reason);assert.equal(result.declaration,approval);assert.equal(result.saved,false);
    }
    for(const invalid of ['Δηλώνω τεκμηριωμένα στοιχεία','Παραμένει αβέβαιο','true']){
        set(f,'DECLARATION',invalid);await assert.rejects(check(f,await buffer(f)),{importReason:'VALUE'});
    }
    set(f,'DECLARATION','Ναι');set(f,'EVIDENCE','x'.repeat(4001));
    await assert.rejects(check(f,await buffer(f)),{importReason:'VALUE'});
});

const metadataDiagnostic=(phase,key,row)=>`phase=${phase} key=${key} row=${row}`;
function metadataRow(book,key){
    const sheet=book.getWorksheet('Ταυτοποίηση');
    let found;
    sheet.eachRow(row=>{if(!found&&row.getCell(1).value===key)found=row;});
    assert.ok(Boolean(found),metadataDiagnostic('locate',key,0));
    return found;
}
async function legacyExport(){
    const f=await exported('UPDATE',legacyImportMetadataFixture());
    const row=metadataRow(f.result.workbook,'plannerSnapshotFingerprint');
    assert.ok(row.getCell(2).value==='',metadataDiagnostic('generated','plannerSnapshotFingerprint',row.number));
    assert.ok(f.result.caseSelection.selectedCase.manualSelection===true,metadataDiagnostic('generated','selectedCase',0));
    return f;
}
async function legacyPreview(f,bytes){
    const row=metadataRow(f.result.workbook,'plannerSnapshotFingerprint');
    try{return await check(f,bytes);}
    catch(error){assert.fail(metadataDiagnostic(`import:${error.importReason||'unexpected'}`,'plannerSnapshotFingerprint',row.number));}
}
test('legacy metadata: νέο XLSX χειροκίνητου UPDATE εισάγεται αμέσως χωρίς επεξεργασία',async()=>{
    const f=await legacyExport(),before=A.stringify(f.data),bytes=await buffer(f);
    const uploaded=await ImportFile.readImportWorkbook(bytes),row=metadataRow(uploaded,'plannerSnapshotFingerprint');
    assert.ok(ImportFile.cellValue(row.getCell(2))===null,metadataDiagnostic('uploaded','plannerSnapshotFingerprint',row.number));
    const result=await legacyPreview(f,bytes);
    assert.ok(result.success&&result.previewOnly&&!result.saved&&!result.executionEnabled,metadataDiagnostic('preview','selectedCase',0));
    assert.ok(result.operation==='UPDATE'&&result.historyStatus==='REVIEW_REQUIRED',metadataDiagnostic('preview','selectedCase',0));
    assert.ok(A.stringify(f.data)===before,metadataDiagnostic('unchanged','snapshotFingerprint',0));
});
test('legacy metadata: συμπλήρωση ΜΕΤΑ και νέα αναφορά διατηρούν την αναγνωστική προεπισκόπηση',async()=>{
    const f=await legacyExport(),before=A.stringify(f.data),result=await legacyPreview(f,await edited(f));
    assert.ok(result.rows.some(row=>row.field==='Νόμιμος Μισθός'&&row.after==='1.234,56'),metadataDiagnostic('preview','nomimosMisthos',0));
    assert.ok(result.previewOnly&&!result.saved&&!result.executionEnabled&&A.stringify(f.data)===before,metadataDiagnostic('unchanged','snapshotFingerprint',0));
});
test('legacy metadata: κρίσιμα κλειδιά, JSON, fingerprints και ΠΡΙΝ παραμένουν προστατευμένα',async()=>{
    const f=await legacyExport(),bytes=await buffer(f);
    for(const key of ['schemaVersion','layoutVersion','employeeId','scope','selectedCase','snapshotFingerprint','proposalFingerprint']){
        for(const phase of ['blank','missing']){
            const book=await ImportFile.readImportWorkbook(bytes),row=metadataRow(book,key),number=row.number;
            if(phase==='blank')row.getCell(2).value=null;
            else book.getWorksheet('Ταυτοποίηση').spliceRows(number,1);
            await assert.rejects(check(f,Buffer.from(await book.xlsx.writeBuffer())),error=>{
                assert.ok(error.importReason===(phase==='missing'&&key==='proposalFingerprint'?'PROTECTED':'METADATA'),metadataDiagnostic(phase,key,number));return true;
            },metadataDiagnostic(phase,key,number));
        }
    }
    const mutations=[
        ['scope',()=>'{', 'METADATA'],
        ['selectedCase',()=>'{', 'METADATA'],
        ['scope',value=>JSON.stringify({...JSON.parse(value),company_kod:'610000000000000000000099'}),'SCOPE'],
        ['employeeId',()=> '620000000000000000000999', 'SCOPE'],
        ['selectedCase',value=>JSON.stringify({...JSON.parse(value),targetHistoryId:'620000000000000000000999'}),'SCOPE'],
        ['selectedCase',value=>JSON.stringify({...JSON.parse(value),id:'history-case-forged'}),'STALE'],
        ['snapshotFingerprint',()=> 'forged', 'STALE'],
        ['proposalFingerprint',()=> 'forged', 'PROTECTED'],
        ['plannerSnapshotFingerprint',()=> 'forged', 'PROTECTED']
    ];
    for(const [key,mutate,reason] of mutations){
        const book=await ImportFile.readImportWorkbook(bytes),row=metadataRow(book,key);
        row.getCell(2).value=mutate(row.getCell(2).value);
        await assert.rejects(check(f,Buffer.from(await book.xlsx.writeBuffer())),error=>{
            assert.ok(error.importReason===reason,metadataDiagnostic('altered',key,row.number));return true;
        },metadataDiagnostic('altered',key,row.number));
    }
    const missingPlanner=await ImportFile.readImportWorkbook(bytes),plannerRow=metadataRow(missingPlanner,'plannerSnapshotFingerprint');
    missingPlanner.getWorksheet('Ταυτοποίηση').spliceRows(plannerRow.number,1);
    await assert.rejects(check(f,Buffer.from(await missingPlanner.xlsx.writeBuffer())),error=>{
        assert.ok(error.importReason==='PROTECTED',metadataDiagnostic('missing','plannerSnapshotFingerprint',plannerRow.number));return true;
    },metadataDiagnostic('missing','plannerSnapshotFingerprint',plannerRow.number));
    const regular=await exported(),row=metadataRow(regular.result.workbook,'plannerSnapshotFingerprint');
    assert.ok(Boolean(row.getCell(2).value),metadataDiagnostic('generated','plannerSnapshotFingerprint',row.number));
    row.getCell(2).value=null;
    await assert.rejects(check(regular,await buffer(regular)),error=>{
        assert.ok(error.importReason==='PROTECTED',metadataDiagnostic('cleared','plannerSnapshotFingerprint',row.number));return true;
    },metadataDiagnostic('cleared','plannerSnapshotFingerprint',row.number));
    const protectedBook=await ImportFile.readImportWorkbook(bytes),cell=protectedBook.getWorksheet(entry(f,'nomimosMisthos').sheet).getCell(entry(f,'nomimosMisthos').cell);
    protectedBook.getWorksheet(cell.worksheet.name).getCell(`B${cell.row}`).value=999;
    await assert.rejects(check(f,Buffer.from(await protectedBook.xlsx.writeBuffer())),error=>{
        assert.ok(error.importReason==='PROTECTED',metadataDiagnostic('before','nomimosMisthos',cell.row));return true;
    },metadataDiagnostic('before','nomimosMisthos',cell.row));
});
test('legacy metadata: πραγματικό Calc διατηρεί την άμεση και τη συμπληρωμένη εισαγωγή',{timeout:60000},async()=>{
    const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-legacy-metadata-'));
    try{
        for(const completed of [false,true]){
            const f=await legacyExport(),before=A.stringify(f.data),filename=completed?'completed.xlsx':'original.xlsx';
            const source=path.join(folder,filename),output=path.join(folder,completed?'completed':'original');
            await fs.writeFile(source,completed?await edited(f):await buffer(f));await fs.mkdir(output);
            try{
                await promisify(execFile)('libreoffice',[`-env:UserInstallation=file://${path.join(folder,'profile')}`,'--headless','--convert-to','xlsx','--outdir',output,source],{timeout:25000});
            }catch{assert.fail(metadataDiagnostic('calc','plannerSnapshotFingerprint',0));}
            const result=await legacyPreview(f,await fs.readFile(path.join(output,filename)));
            assert.ok(result.previewOnly&&!result.saved&&!result.executionEnabled&&A.stringify(f.data)===before,metadataDiagnostic('calc-preview','snapshotFingerprint',0));
            if(completed)assert.ok(result.rows.some(row=>row.field==='Νόμιμος Μισθός'&&row.after==='1.234,56'),metadataDiagnostic('calc-preview','nomimosMisthos',0));
        }
    }finally{await fs.rm(folder,{recursive:true,force:true});}
});

test('έγκυρο UPDATE διαβάζει τα ορατά ΜΕΤΑ μετά από αλλαγές Calc και αγνοεί παλιά localCompletion ως πηγή τιμών',async()=>{
    const f=await exported(),before=A.stringify(f.data);
    const index=f.result.editableCells.indexOf(entry(f,'nomimosMisthos'));
    E.applyLocalCompletion(f.result,{caseId:f.result.caseSelection.selectedCase.id,snapshotFingerprint:f.result.snapshotFingerprint,
        context:E.editorContext(f.req,f.result.snapshotFingerprint,f.result.caseSelection.selectedCase.id),changes:[{index,value:'1111,11'}]},f.req,f.catalogs);
    const result=await check(f,await edited(f));
    assert.equal(result.operation,'UPDATE');assert.equal(result.historySequence,'0001');
    assert.equal(result.previewOnly,true);assert.equal(result.executionEnabled,false);assert.equal(result.saved,false);
    assert.equal(result.historyStatus,'REVIEW_REQUIRED');assert.ok(result.pendingCases>0);
    assert.equal(result.rows.find(row=>row.field==='Νόμιμος Μισθός')?.after,'1.234,56');
    assert.ok(result.rows.some(row=>row.after==='03/02/2026'));
    assert.ok(result.rows.some(row=>row.source.includes('εγγραφή 0001')));
    assert.equal(result.rows.some(row=>row.field===require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels')[C.HIRE]),false);
    assert.deepEqual(Object.keys(result.editorValues).sort(),['caseId','selectionLabel','snapshotFingerprint','values']);
    assert.equal(result.editorValues.caseId,f.result.caseSelection.selectedCase.id);
    assert.equal(result.editorValues.snapshotFingerprint,f.result.snapshotFingerprint);
    assert.deepEqual(result.editorValues.values.map(item=>item.fieldId),f.result.editableCells.map(item=>item.canonicalField||item.fieldId));
    for(const item of result.editorValues.values) assert.deepEqual(Object.keys(item).sort(),['fieldId','value']);
    const raw=new Map(result.editorValues.values.map(item=>[item.fieldId,item.value]));
    assert.equal(raw.get('nomimosMisthos'),1234.56);assert.equal(raw.get(C.CHANGE),'2026-02-03');
    assert.equal(raw.get('dialleima_entos_ektos_orarioy'),false);assert.deepEqual(raw.get('hmeres_efarmoghs_egkekrimenhs_rythmishs'),[]);
    assert.equal(raw.get('krathsh_01'),'0101');assert.equal(raw.has(C.HIRE),false);assert.equal(raw.has('ypokatasthma'),false);
    assert.equal(A.stringify(f.data),before);
});
test('έγκυρο INSERT επαληθεύει το πραγματικό κενό και δεν δημιουργεί ή επιστρέφει φυσική ταυτότητα',async()=>{
    const f=await exported('INSERT'),before=A.stringify(f.data),result=await check(f,await edited(f));
    assert.equal(result.operation,'INSERT');assert.equal(result.historySequence,null);
    assert.deepEqual(result.period,{from:'2026-02-09',to:'2026-03-31'});
    assert.ok(result.rows.length>10);assert.ok(result.rows.every(row=>row.before==='Δεν υπάρχει εγγραφή στην ελλείπουσα περίοδο'));
    assert.equal(result.rows.some(row=>row.field===require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels')[C.CHANGE]),false);
    assert.doesNotMatch(JSON.stringify(result),/candidate-period-|targetHistoryId|"_id"/);
    assert.equal(result.previousInsertProposalsReusable,false);assert.equal(A.stringify(f.data),before);
});
test('το Calc μπορεί να δώσει αριθμητικό κωδικό 0/1/2 χωρίς να χαθούν οι μηδενικοί χαρακτήρες καταλόγου',async()=>{
    const f=await exported();await edited(f);set(f,'typos_apasxolhshs',0);set(f,'eidikh_kathgoria_ergazomenoy','0001');
    const result=await check(f,await buffer(f));
    assert.ok(result.rows.some(row=>row.field===require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels').eidikh_kathgoria_ergazomenoy&&row.after.startsWith('0001')));
    set(f,'eidikh_kathgoria_ergazomenoy',1);await assert.rejects(check(f,await buffer(f)),{importReason:'VALUE'});
});
test('αλλοιωμένο XLSX: ΠΡΙΝ, πληροφοριακά πεδία, κλειδιά, αντιστοιχίσεις, φύλλα και τύποι απορρίπτονται',async()=>{
    const f=await exported(),original=await edited(f);
    const mutations=[
        book=>book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(`B${book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(entry(f,'nomimosMisthos').cell).row}`).value=999,
        book=>{const mapping=f.result.workbook.getWorksheet('Ταυτοποίηση').getSheetValues().find(row=>row?.[1]==='comparisonField'&&JSON.parse(row[2]).canonicalField===C.HIRE);book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(JSON.parse(mapping[2]).cell).value=new Date('2020-01-01');},
        book=>{const row=book.getWorksheet('Ταυτοποίηση').getColumn(1).values.findIndex(value=>value==='employeeId');book.getWorksheet('Ταυτοποίηση').getCell(`B${row}`).value='620000000000000000000999';},
        book=>{const row=book.getWorksheet('Ταυτοποίηση').getColumn(1).values.findIndex(value=>value==='editableCell');const cell=book.getWorksheet('Ταυτοποίηση').getCell(`B${row}`);cell.value=cell.value.replace('hmeromhnia_','forged_');},
        book=>book.addWorksheet('Ανεξάρτητες αλλαγές'),
        book=>book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(entry(f,'nomimosMisthos').cell).value={formula:'1+1',result:2}
    ];
    for(const mutate of mutations){const book=new ExcelJS.Workbook();await book.xlsx.load(original);mutate(book);
        await assert.rejects(check(f,Buffer.from(await book.xlsx.writeBuffer())),error=>Boolean(error.importReason));}
});
test('παρωχημένο στιγμιότυπο, άλλη εταιρεία/εργαζόμενος/υποκατάστημα και νέες αναφορές δεν παρακάμπτονται από metadata',async()=>{
    const f=await exported(),bytes=await edited(f);
    for(const mutate of [data=>data.currentEmployee.nomimosMisthos++,data=>data.completeHistoryRows[0].nomimosMisthos++,
        data=>data.currentEmployee.ypokatasthma='0001',data=>data.protectedReferenceSummary[data.completeHistoryRows[0]._id].push({collection:'Oraria_Apologistika',documentId:'synthetic-new'})]){
        const data=structuredClone(f.data);mutate(data);await assert.rejects(check(f,bytes,protection,data),{statusCode:409});
    }
    for(const mutate of [data=>data.scope.company_kod='610000000000000000000099',data=>data.currentEmployee._id='620000000000000000000999']){
        const data=structuredClone(f.data);mutate(data);await assert.rejects(check(f,bytes,protection,data),{statusCode:403});
    }
});
test('μη έγκυρα ΜΕΤΑ και μη επιτρεπόμενες επιλογές σταματούν χωρίς αυτόματη διόρθωση',async()=>{
    for(const [field,value] of [['nomimosMisthos','1.234,56'],['nomimosMisthos',-1],['typos_apasxolhshs','5'],
        ['eidikh_kathgoria_ergazomenoy','9999'],[C.CHANGE,'31/02/2026'],['hmeres_ergasias_ebdomadas',8]]){
        const f=await exported();await edited(f);set(f,field,value);await assert.rejects(check(f,await buffer(f)),error=>Boolean(error.importReason),field);
    }
});
test('η φόρτωση UPDATE διατηρεί τις τιμές για τελική απόφαση, INSERT και αβέβαιες περιπτώσεις παραμένουν προστατευμένα',async()=>{
    for(const [field,value] of [[C.CHANGE,'2026-01-01'],[C.END,'2026-06-01'],[C.START,'2026-02-04']]){
        const f=await exported();await edited(f);set(f,field,value);const result=await check(f,await buffer(f));assert.equal(result.saved,false);assert.equal(result.executionEnabled,false);
    }
    const f=await exported('INSERT'),data=structuredClone(f.data);data.completeHistoryRows[0][C.END]='2026-03-31';
    await assert.rejects(check(f,await buffer(f),protection,data),{statusCode:409});
    const ambiguous=F.employee0002HistoryProposalFixture();ambiguous.completeHistoryRows[0][C.END]='2026-04-15';
    const result=await X.buildEmployeeHistoryProposalWorkbook(ambiguous,F.catalogs);
    assert.equal(result.caseSelection.selectedCase.operation,'REVIEW_REQUIRED');
    const review={data:ambiguous,catalogs:F.catalogs,result,req:reqFor(ambiguous)};
    await assert.rejects(check(review,await buffer(review)),{importReason:'CASE'});
});
test('η αναγνωστική φόρτωση προστατευμένης εγγραφής δεν ζητά πιστοποίηση ή άνοιγμα περιόδου',async()=>{
    const f=await exported(),bytes=await edited(f);
    const result=await check(f,bytes,async()=>{assert.fail('η εισαγωγή δεν επιλέγει διαδρομή εγγραφής');});
    assert.equal(result.saved,false);assert.equal(result.legacyCertificationRequired,false);
});
test('ο πραγματικός αναγνώστης προστασίας χρησιμοποιεί μόνο scoped find/select/limit/lean στα υπάρχοντα μοντέλα',async()=>{
    const events=[],model={find(query){events.push(query);return {select(value){assert.match(value,/period_start/);return this;},limit(n){assert.equal(n,1001);return this;},async lean(){return [];}};}};
    const result=await readImportProtection({scope:{team:'THA',company_kod:'610000000000000000000001'},branch:'0000',period:{from:'2026-02-02',to:'2026-02-08'}},
        {periodControlModel:model,frozenModel:model});
    assert.deepEqual(result,{controls:[],snapshots:[]});assert.equal(events.length,2);
    const sanitized=require('mongoose').sanitizeFilter(events[0]);
    assert.equal(sanitized.period_start.$eq,undefined);assert.equal(sanitized.period_end.$eq,undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(sanitized)),{team:'THA',company_kod:'610000000000000000000001',ypokatasthma:'0000',
        period_start:{$lte:new Date('2026-02-08').toISOString()},period_end:{$gte:new Date('2026-02-02').toISOString()}});
});
test('όρια μεταφόρτωσης/ZIP και ενεργό περιεχόμενο απορρίπτονται πριν από προεπισκόπηση',async()=>{
    const f=await exported(),bytes=await edited(f);
    await assert.rejects(check(f,Buffer.alloc(MAX_FILE_BYTES+1)),{statusCode:413});
    await assert.rejects(check(f,Buffer.from('x')),{importReason:'FORMAT'});
    for(const [name,text] of [['xl/activeX/activeX1.xml','<xml/>'],['xl/test.xml','<!DOCTYPE test><xml/>'],
        ['xl/test.rels','<Relationship TargetMode="External" Target="https://example.invalid"/>'],['xl/oversized.xml','x'.repeat(9*1024*1024)]]){
        const zip=await JSZip.loadAsync(bytes);zip.file(name,text);
        await assert.rejects(check(f,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})),error=>Boolean(error.importReason));
    }
});
test('συνθετικό HTTP: πραγματική διαδρομή μεταφόρτωσης, επανέλεγχος εξουσιοδότησης και αμετάβλητη κατάσταση',async()=>{
    const f=await exported(),h=await startUnifiedPreviewHarness({data:f.data,catalogs:f.catalogs}),bytes=await edited(f);
    const url=`${h.origin}/api/ergazomenoi/${f.data.currentEmployee._id}/history-proposal-import-preview`;
    const post=(filename='synthetic.xlsx',body=bytes)=>{const data=new FormData();data.append('proposal',new Blob([body]),filename);return fetch(url,{method:'POST',body:data});};
    try{
        const before=A.stringify(h.state),response=await post();assert.equal(response.status,200);
        const result=await response.json();assert.equal(result.previewOnly,true);assert.equal(result.saved,false);assert.equal(h.counts.protectionReads,0);
        assert.equal((await post('synthetic.xlsm')).status,415);assert.equal((await post('synthetic.xlsx',Buffer.from('bad'))).status,422);
        h.access.company='610000000000000000000099';assert.equal((await post()).status,404);delete h.access.company;
        h.access.read=false;assert.equal((await post()).status,403);h.access.read=true;
        h.access.authenticated=false;assert.equal((await post()).status,401);
        assert.equal(A.stringify(h.state),before);assert.equal(h.counts.applyRequests,0);
    }finally{await h.close();}
});
test('πραγματικό LibreOffice επαναποθηκεύει συνθετικά UPDATE/INSERT και διατηρεί αναγνώσιμα τα επιτρεπόμενα ΜΕΤΑ',{timeout:60000},async()=>{
    const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-import-calc-'));
    try{
        for(const operation of ['UPDATE','INSERT'])for(const legacy of [false,true]){
            const name=`${operation}-${legacy?'v4':'v5'}`;
            const f=await exported(operation),source=path.join(folder,`${name}.xlsx`),output=path.join(folder,name);
            const bytes=legacy ? await fs.readFile(path.resolve(__dirname,`../../../test/fixtures/employeeHistoryProposalV4${operation}.xlsx`)) : await edited(f);
            await fs.writeFile(source,bytes);await fs.mkdir(output);
            await promisify(execFile)('libreoffice',[`-env:UserInstallation=file://${path.join(folder,'profile')}`,'--headless','--convert-to','xlsx','--outdir',output,source],{timeout:25000});
            const result=await check(f,await fs.readFile(path.join(output,`${name}.xlsx`)));
            assert.equal(result.operation,operation);assert.equal(result.historyStatus,'REVIEW_REQUIRED');
            assert.equal(result.legacyFormat,legacy);if(legacy)assert.equal(result.declaration,'Όχι');
        }
    }finally{await fs.rm(folder,{recursive:true,force:true});}
});
