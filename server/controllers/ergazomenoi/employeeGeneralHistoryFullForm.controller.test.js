'use strict';
const {test,before,after,mock} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const R = require('../../utils/ergazomenoi/historicalProfileComparison');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const D = require('../../services/ergazomenoi/employeeHistoryDeferralService');
const Models = require('../../models/ergazomenoi');
const T = require('../../../test/fixtures/employeeGeneralHistoryCases');
const results=[];
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(()=>{
    mock.restoreAll();
    if (process.env.PAYROLL_HISTORY_COVERAGE_OUTPUT)
        fs.writeFileSync(process.env.PAYROLL_HISTORY_COVERAGE_OUTPUT,JSON.stringify({
            scope:'Συνθετικές εγγραφές στη μνήμη, χωρίς MongoDB ή πραγματικό ΕΡΓΑΝΗ',
            expectedFields:93,results,
            blocker:'Η διόρθωση παλιάς εγκεκριμένης έκδοσης συνεχίζεται μέσω στοχευμένου συνδέσμου στην υπάρχουσα οθόνη ΠΡΙΝ/ΜΕΤΑ, με διατήρηση έγκρισης και αναφορών. Η γενικευμένη ατομική διαδρομή δεν τροποποιεί το πρωτότυπο.'},null,2)+'\n');
});
function message(h,response) { return JSON.stringify({response:response.body,errors:h.errors}); }
function fieldsEqual(record,values) {
    const comparison=R.createHistoricalComparison(record);
    for (const [field,value] of Object.entries(values))
        assert.ok(A.equal(record[field],comparison.normalize(field,value)),field);
}
function originalRowsPreserved(h,original) {
    const after=h.db.state();
    for (const row of original.history)
        assert.deepEqual(after.history.find(item=>String(item._id) === String(row._id)),row);
    h.preserved(original);
}
for (const entry of R.fields.filter(e=>e.writable)) test('Γενικό Ιστορικό: νέα περίοδος και ίδια περίοδος — '+entry.field,async()=>{
    const h=await T.createHarness(),original=h.db.state();
    const changes=T.changeFor(entry,original.employees[0]);
    const body=T.payload(h,changes),preview=await h.submit(body);
    assert.equal(preview.body.decision,'COMBINED_SAVE',message(h,preview));
    assert.deepEqual(h.db.state(),original,'η προεπισκόπηση δεν γράφει');
    const saved=await T.confirm(h,body,preview);
    assert.equal(saved.body.success,true,message(h,saved));
    assert.equal(saved.body.historyUpdated,true);
    const after=h.db.state(),inserted=after.history.find(row=>!original.history.some(old=>String(old._id) === String(row._id)));
    assert.equal(after.history.length,original.history.length+1);
    assert.ok(inserted);
    fieldsEqual(inserted,changes);
    fieldsEqual(after.employees[0],changes);
    const profile=require('../../utils/ergazomenoi/employmentProfileContract');
    if (profile.ARRANGEMENT_FIELDS.includes(entry.field)) {
        const resolved=require('../../utils/ergazomenoi/employmentProfileHistory')
            .resolveEmploymentProfileFactsForDate('2026-12-02',[inserted],{
                scheduledWorkingDay:true,currentEmployee:after.employees[0]});
        assert.equal(resolved.recorded,true,'τα αποθηκευμένα στοιχεία αναγνωρίζονται από τον πραγματικό αναγνώστη');
        assert.equal(resolved.arrangementEffective,true);
        assert.equal(resolved.facts[profile.TYPE],T.arrangement[profile.TYPE]);
    }
    for (const field of Object.keys(inserted)) assert.ok(Models.IstorikoProslhpseonAllagonModel.schema.path(field),field);
    assert.equal(after.audits.length,original.audits.length+1);
    for (const field of Object.keys(R.createHistoricalComparison(original.employees[0]).difference(changes)))
        assert.ok(after.audits.at(-1).diagnostics.changedFields.includes(field),field);
    if (!Object.hasOwn(changes,'hmeres_ergasias_ebdomadas'))
        assert.equal(after.audits.at(-1).diagnostics.changedFields.includes('apasxolhsh_basei_symbashs'),false);
    originalRowsPreserved(h,original);
    assert.deepEqual(h.effects,[]);
    // Only the newly created, unapproved atomic successor is corrected. The
    // approved predecessor and every original reference stay byte-identical.
    const correctedTerms=Object.fromEntries(Object.keys(changes).map(field=>[field,original.employees[0][field] ?? null]));
    const correction=T.payload(h,correctedTerms);
    correction.change={kind:'CORRECT_SAVED_ERROR',effectiveFrom:T.date,targetHistoryId:String(inserted._id),correctedTerms};
    const checked=await h.submit(correction);
    assert.equal(checked.body.decision,'COMBINED_SAVE',message(h,checked));
    assert.deepEqual(h.db.state(),after);
    const corrected=await T.confirm(h,correction,checked);
    assert.equal(corrected.body.success,true,message(h,corrected));
    const final=h.db.state(),same=final.history.find(row=>String(row._id) === String(inserted._id));
    assert.equal(final.history.length,after.history.length);
    assert.equal(same.aa_eggrafhs,inserted.aa_eggrafhs);
    assert.equal(new Date(same.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10),T.date);
    fieldsEqual(same,correctedTerms);
    fieldsEqual(final.employees[0],correctedTerms);
    if (profile.ARRANGEMENT_FIELDS.includes(entry.field)) {
        const resolved=require('../../utils/ergazomenoi/employmentProfileHistory')
            .resolveEmploymentProfileFactsForDate('2026-12-02',[same],{
                scheduledWorkingDay:true,currentEmployee:final.employees[0]});
        assert.equal(resolved.recorded,true);
        assert.equal(resolved.arrangementEffective,false);
        assert.equal(same[profile.TYPE_VERSION],null);
    }
    assert.equal(final.audits.length,after.audits.length+1);
    originalRowsPreserved(h,original);
    results.push({field:entry.field,detection:'Τύποι μοντέλου + συγκεντρωτική σύγκριση',
        route:'Ρητή νέα περίοδος / διόρθωση μη εγκεκριμένου ατομικού διαδόχου',
        test:'Γενικό Ιστορικό: νέα περίοδος και ίδια περίοδος — '+entry.field,
        result:'PASS',coupledFields:Object.keys(changes)});
});
test('Παράγωγο misthologiko_klimakio: διατήρηση υπάρχοντος υπολογισμού και απόρριψη άμεσης ιστορικής εντολής',async()=>{
    const h=await T.createHarness(),before=h.db.state();
    const bad=await h.submit(T.payload(h,{misthologiko_klimakio:9}));
    assert.equal(bad.body.success,false);
    assert.deepEqual(h.db.state(),before);
    const body=T.payload(h,{pragmatikosMisthos:1550}),preview=await h.submit(body),saved=await T.confirm(h,body,preview);
    assert.equal(saved.body.success,true,message(h,saved));
    assert.equal(h.db.state().history.at(-1).misthologiko_klimakio,before.history.at(-1).misthologiko_klimakio);
    results.push({field:'misthologiko_klimakio',detection:'Παράγωγο, δεν αποτελεί χειροκίνητη ιστορική αλλαγή',
        route:'Υφιστάμενος υπολογισμός· άμεση εντολή απορρίπτεται',test:'Παράγωγο misthologiko_klimakio',result:'CONTROLLED'});
});
test('Ημερομηνία διαλείμματος: παράγεται στη νέα περίοδο, χωρίς δυνατότητα χειροκίνητης παράκαμψης',async()=>{
    const h=await T.createHarness(),before=h.db.state();
    const bad=await h.submit(T.payload(h,{hmeromhnia_isxyos_dialleimatos_apo:'2026-12-02'}));
    assert.equal(bad.body.success,false);
    assert.deepEqual(h.db.state(),before);
    const body=T.payload(h,{dialleima_se_lepta:15}),preview=await h.submit(body),saved=await T.confirm(h,body,preview);
    assert.equal(saved.body.success,true,message(h,saved));
    const added=h.db.state().history.at(-1);
    assert.equal(added.afora_allagh_dialleimatos,true);
    assert.equal(added.hmeromhnia_isxyos_dialleimatos_apo.toISOString().slice(0,10),T.date);
    originalRowsPreserved(h,before);
    results.push({field:'hmeromhnia_isxyos_dialleimatos_apo',detection:'Ιστορική ημερομηνία συμβάντος',
        route:'Υφιστάμενο buildCompleteProfileSnapshot με ημερομηνία νέας περιόδου',
        test:'Ημερομηνία διαλείμματος',result:'CONTROLLED'});
});
for (const changes of [T.thirty,{pragmatikosMisthos:1550},{dialleima_se_lepta:15}])
    test('Παλιά εγκεκριμένη έκδοση παραμένει προστατευμένη: '+JSON.stringify(changes),async()=>{
        const h=await T.createHarness(),original=h.db.state(),target=original.history.at(-1);
        const body=T.payload(h,changes);
        body.change={...body.change,kind:'CORRECT_SAVED_ERROR',effectiveFrom:'2026-06-03',targetHistoryId:String(target._id)};
        body.formData.hmeromhnia_metabolhs='2026-06-03';
        const result=await h.submit(body);
        assert.equal(result.body.success,false);
        assert.equal(result.body.status,'HISTORY_CORRECTION_EDITION_REQUIRED');
        assert.equal(result.body.saved,false);
        assert.equal(result.body.correctionEditionUrl,
            `/api/ergazomenoi/${original.employees[0]._id}/history-proposal-editor?selection=UPDATE:${target._id}`);
        assert.equal(result.body.historyConfirmation,undefined);
        assert.match(result.body.reason,/APPROVED_TARGET_CANNOT_BE_REWRITTEN|IMMUTABLE.*CORRECTION/);
        assert.deepEqual(h.db.state(),original);
        assert.deepEqual(h.effects,[]);
    });
test('Η παραπομπή στο ΠΡΙΝ/ΜΕΤΑ δεν επιτρέπει πλαστή επιβεβαίωση ή στόχευση άλλης περιόδου',async()=>{
    const h=await T.createHarness(),before=h.db.state(),target=before.history.at(-1);
    const body=T.payload(h,{pragmatikosMisthos:1550});
    body.change={...body.change,kind:'CORRECT_SAVED_ERROR',effectiveFrom:'2026-06-03',targetHistoryId:String(target._id)};
    body.formData.hmeromhnia_metabolhs='2026-06-03';
    const forged=await h.submit({...body,historyPreflight:false,historyDecision:'COMBINED_SAVE',historyConfirmation:'forged'});
    assert.equal(forged.body.success,false); assert.deepEqual(h.db.state(),before);
    const other=await h.submit({...body,change:{...body.change,targetHistoryId:String(before.history[0]._id)}});
    assert.equal(other.body.status,'UNSAFE_HISTORY_CHANGE'); assert.equal(other.body.correctionEditionUrl,undefined);
    assert.deepEqual(h.db.state(),before); assert.deepEqual(h.effects,[]);
});
test('Πολλαπλές ιστορικές μεταβολές έχουν μία προεπισκόπηση και μία ατομική εγγραφή',async()=>{
    const h=await T.createHarness(),before=h.db.state();
    const changes={...T.thirty,pragmatikosMisthos:1550,poso_symbashs_02:80,krathsh_02:'0102',dialleima_se_lepta:15};
    const body=T.payload(h,changes),preview=await h.submit(body),saved=await T.confirm(h,body,preview);
    assert.equal(saved.body.success,true,message(h,saved));
    fieldsEqual(h.db.state().history.at(-1),changes);
    assert.equal(h.db.state().history.length,before.history.length+1);
    assert.equal(h.db.state().audits.length,before.audits.length+1);
    originalRowsPreserved(h,before);
});
test('Οι γενικές μεταβολές δεν παρακάμπτουν τους καταλόγους μέσω του αυτοτελούς τελικού σημείου',async()=>{
    const h=await T.createHarness(),before=h.db.state();
    const service=h.deps.approvedHistoryServiceFactory(h.deps);
    const change={kind:'NEW_CHANGE',effectiveFrom:T.date,correctedTerms:{symbash:'INVALID'}};
    await assert.rejects(service.preview({},change),/FULL_EMPLOYEE_FORM_REQUIRED/);
    await assert.rejects(service.apply({},change,'forged'),/FULL_EMPLOYEE_FORM_REQUIRED/);
    const body=T.payload(h,{symbash:'INVALID'}),response=await h.submit(body);
    assert.equal(response.body.success,false);
    assert.match(response.body.reason,/INVALID_CATALOG/);
    assert.deepEqual(h.db.state(),before);
});
for (const missing of [false,true]) test('Σταθερές ημέρες και ανεξάρτητο συνθετικό ΕΡΓΑΝΗ, έλλειψη='+missing,async()=>{
    const h=await T.createHarness(),before=h.db.state();
    const changes={...T.thirty,...(missing ? {eidikothta_symbashs:''} : {})};
    const body=T.payload(h,changes);
    body.filesToUpdate={create_contract:false,isPermanent:true,erganiUploadMethod:'rest',e3_metaboles_ergasiakhs_sxeshs:true};
    const preview=await h.submit(body);
    assert.equal(preview.body.decision,missing ? 'DEFER_HISTORY' : 'COMBINED_SAVE',message(h,preview));
    assert.deepEqual(h.db.state(),before,'η Επιστροφή δεν αποθηκεύει ούτε εκτελεί εξωτερική ενέργεια');
    assert.deepEqual(h.effects,[]);
    if (missing) assert.deepEqual(Array.from(preview.body.missingFields,item=>item.field),['eidikothta_symbashs']);
    const saved=await T.confirm(h,body,preview);
    assert.equal(saved.body.success,true,message(h,saved));
    assert.equal(saved.body.historyDeferred,missing);
    assert.equal(saved.body.historyUpdated,!missing);
    assert.equal(saved.body.externalActionsAllowed,true);
    assert.equal(saved.body.maXmlData.success,true);
    assert.deepEqual(h.effects,['MA_XML']);
    const after=h.db.state();
    assert.equal(after.employees[0].hmeres_ergasias_ebdomadas,5);
    assert.equal(after.employees[0].ores_ergasias_ebdomadas,30);
    if (missing) {
        assert.deepEqual(after.history,before.history);
        assert.deepEqual(after.audits,before.audits);
        assert.equal(after.employees[0][D.FIELD].eventType,'NEW_CHANGE');
    }
    originalRowsPreserved(h,before);
});
test('Κανονικοποιημένη πλήρης φόρμα και μη ιστορικό πεδίο δεν ζητούν ιστορική μεταβολή',async()=>{
    const h=await T.createHarness(),before=h.db.state();
    let body=h.payload({poso_symbashs_basei_oron_ergasias_01:'1000',symbash:' 01 ',symbash_stathera:' 01 '});
    body.change={kind:'NEW_CHANGE',effectiveFrom:T.date,correctedTerms:{symbash:' 01 '}};
    const unchanged=await h.submit(body);
    assert.equal(unchanged.body.success,true,message(h,unchanged));
    assert.equal(unchanged.body.historyUpdated,false);
    assert.equal(unchanged.body.employeeUpdated,false);
    assert.deepEqual(h.db.state(),before);
    const saved=await h.save({arithmos:'12'});
    assert.equal(saved.body.success,true,message(h,saved));
    assert.equal(saved.body.historyUpdated,false);
    assert.deepEqual(h.db.state().history,before.history);
    assert.deepEqual(h.db.state().audits,before.audits);
});
