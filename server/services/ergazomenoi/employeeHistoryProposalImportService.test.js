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
    set(f,'DECLARATION','Δηλώνω τεκμηριωμένα στοιχεία');
    if(f.result.caseSelection.selectedCase.operation==='UPDATE'){
        set(f,C.CHANGE,new Date('2026-02-03T00:00:00Z'));
        set(f,'eidikothta_symbashs','01');
    }
    return buffer(f);
}

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
        ['eidikh_kathgoria_ergazomenoy','9999'],[C.CHANGE,'31/02/2026'],['hmeres_ergasias_ebdomadas',4]]){
        const f=await exported();await edited(f);set(f,field,value);await assert.rejects(check(f,await buffer(f)),error=>Boolean(error.importReason),field);
    }
});
test('ανεστραμμένες ημερομηνίες, επικαλύψεις, νέο κενό και αβέβαιη περίπτωση δεν γίνονται προεπισκόπηση αποθήκευσης',async()=>{
    for(const [field,value] of [[C.CHANGE,'2026-01-01'],[C.END,'2026-06-01'],[C.START,'2026-02-04']]){
        const f=await exported();await edited(f);set(f,field,value);await assert.rejects(check(f,await buffer(f)),error=>['DATES','COVERAGE','COVERAGE_GAP'].includes(error.importReason),field);
    }
    const f=await exported('INSERT'),data=structuredClone(f.data);data.completeHistoryRows[0][C.END]='2026-03-31';
    await assert.rejects(check(f,await buffer(f),protection,data),{statusCode:409});
    const ambiguous=F.employee0002HistoryProposalFixture();ambiguous.completeHistoryRows[0][C.END]='2026-04-15';
    const result=await X.buildEmployeeHistoryProposalWorkbook(ambiguous,F.catalogs);
    assert.equal(result.caseSelection.selectedCase.operation,'REVIEW_REQUIRED');
    const review={data:ambiguous,catalogs:F.catalogs,result,req:reqFor(ambiguous)};
    await assert.rejects(check(review,await buffer(review)),{importReason:'CASE'});
});
test('κλειδωμένες/οριστικοποιημένες περίοδοι και άγνωστη προστασία απορρίπτονται, χωρίς κλήση εφαρμογής',async()=>{
    const f=await exported(),bytes=await edited(f);
    const period={...f.data.scope,ypokatasthma:'0000',period_start:'2026-02-01',period_end:'2026-02-28'};
    for(const result of [{controls:[{...period,status:'LOCKED'}],snapshots:[]},{controls:[{...period,status:'FINALIZED'}],snapshots:[]},
        {controls:[],snapshots:[period]},{controls:[{...period,period_start:null,status:'OPEN'}],snapshots:[]},null])await assert.rejects(check(f,bytes,async()=>result),{statusCode:409});
    await assert.rejects(check(f,bytes,async()=>{throw Error('synthetic read failure');}),{importReason:'PROTECTION_UNKNOWN'});
    const open=await check(f,bytes,async()=>({controls:[{...period,status:'OPEN'}],snapshots:[]}));assert.equal(open.saved,false);
});
test('ο πραγματικός αναγνώστης προστασίας χρησιμοποιεί μόνο scoped find/select/limit/lean στα υπάρχοντα μοντέλα',async()=>{
    const events=[],model={find(query){events.push(query);return {select(value){assert.match(value,/period_start/);return this;},limit(n){assert.equal(n,1001);return this;},async lean(){return [];}};}};
    const result=await readImportProtection({scope:{team:'THA',company_kod:'610000000000000000000001'},branch:'0000',period:{from:'2026-02-02',to:'2026-02-08'}},
        {periodControlModel:model,frozenModel:model});
    assert.deepEqual(result,{controls:[],snapshots:[]});assert.equal(events.length,2);
    assert.deepEqual(events[0],{team:'THA',company_kod:'610000000000000000000001',ypokatasthma:'0000',
        period_start:{$lte:new Date('2026-02-08')},period_end:{$gte:new Date('2026-02-02')}});
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
        const result=await response.json();assert.equal(result.previewOnly,true);assert.equal(result.saved,false);assert.equal(h.counts.protectionReads,1);
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
        for(const operation of ['UPDATE','INSERT']){
            const f=await exported(operation),source=path.join(folder,`${operation}.xlsx`),output=path.join(folder,operation);
            await fs.writeFile(source,await edited(f));await fs.mkdir(output);
            await promisify(execFile)('libreoffice',[`-env:UserInstallation=file://${path.join(folder,'profile')}`,'--headless','--convert-to','xlsx','--outdir',output,source],{timeout:25000});
            const result=await check(f,await fs.readFile(path.join(output,`${operation}.xlsx`)));
            assert.equal(result.operation,operation);assert.equal(result.historyStatus,'REVIEW_REQUIRED');
        }
    }finally{await fs.rm(folder,{recursive:true,force:true});}
});
