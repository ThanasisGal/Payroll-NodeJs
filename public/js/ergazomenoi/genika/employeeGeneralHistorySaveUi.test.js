'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const UI = require('./employeeApprovedHistoryAtomicSaveUi');
const R = require('../../../../server/utils/ergazomenoi/historicalProfileComparison');
const Models = require('../../../../server/models/ergazomenoi');
const F = require('../../../../test/fixtures/employeeHistoryResolvedProposal');
const T = require('../../../../test/fixtures/employeeGeneralHistoryCases');
const current = new Models.ErgazomenoiModel(F.resolvedProposalFixture({independent:false}).currentEmployee).toObject();
const baseline = JSON.parse(JSON.stringify(R.clientBaseline(current)));
function harness(changes={},contextChanges={}) {
    const calls=[],dialogs=[];
    const baselineNode={dataset:{atomicDays:'5',atomicWeek:'5HMERH',atomicHours:'40',atomicDaily:'8',atomicContract:'5',
        profileBaseline:JSON.stringify(baseline)}};
    const formData={...current,apasxolhsh_basei_symbashs:'5',...T.formChanges(changes)};
    const context={success:true,contextOnly:true,currentTerms:current,currentContract:'5',currentProfile:baseline,
        pendingHistory:false,approvedHistoryRequired:true,targetHistoryId:'620000000000000000000002',
        effectiveFrom:'2026-06-03',...contextChanges};
    let selected;
    const args={formData,baselineNode,employeeId:String(current._id),csrfToken:'synthetic-csrf',
        onChange:change=>{selected=change;},swal:{async fire(options) {
            dialogs.push(options);return {isConfirmed:true,value:'NEW_CHANGE'};
        }},fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>context};}};
    return {client:UI.createClient(),args,calls,dialogs,selected:()=>selected};
}
for (const entry of R.fields.filter(e=>e.writable)) test('Διεπαφή ιστορικής μεταβολής από την κοινή αντιστοίχιση: '+entry.field,async()=>{
    const changes=T.changeFor(entry,current),h=harness(changes);
    const result=await h.client.tryHandle(h.args);
    assert.equal(result.handled,false);
    assert.equal(result.change.kind,'NEW_CHANGE');
    assert.equal(result.change.effectiveFrom,T.date);
    assert.equal(h.selected(),result.change);
    for (const field of Object.keys(changes)) assert.deepEqual(result.change.correctedTerms[field],changes[field],field);
    assert.equal(h.calls.length,1,'μία υπάρχουσα ανάγνωση πλαισίου, χωρίς αναζήτηση ανά πεδίο');
    assert.match(h.calls[0].url,/-context$/);
    assert.equal(h.dialogs.length,1,'επαναχρησιμοποιείται η ημερομηνία της φόρμας');
    assert.equal(h.dialogs[0].title,'Είδος ιστορικής ενέργειας');
});
test('Αμετάβλητα 91 πεδία και μη ιστορική αλλαγή δεν προκαλούν αίτημα ή παράθυρο',async()=>{
    const h=harness({});
    for (const entry of baseline.fields) {
        if (entry.value == null) continue;
        h.args.formData[entry.field]=entry.type === 'Number' || entry.type === 'Boolean' ? String(entry.value) :
            entry.type === 'Array' ? [...entry.value].reverse().map(String) : entry.trim ? ' '+entry.value+' ' : entry.value;
    }
    h.args.formData.arithmos='12';
    assert.deepEqual(await h.client.tryHandle(h.args),{handled:false});
    assert.equal(h.calls.length,0);
    assert.equal(h.dialogs.length,0);
});
test('Αλλαγή αποδοχών σε φρέσκια κατάσταση μεταξύ ανοίγματος και επιλογής απορρίπτεται',async()=>{
    const changed=structuredClone(baseline);
    changed.fields.find(e=>e.field === 'pragmatikosMisthos').value=1800;
    const h=harness(T.thirty,{currentProfile:changed});
    const result=await h.client.tryHandle(h.args);
    assert.equal(result.saved,false);
    assert.equal(h.selected(),undefined);
    assert.equal(h.calls.length,1);
    assert.match(h.dialogs[0].text,/Δεν αποθηκεύτηκε αλλαγή/);
    assert.match(h.dialogs[0].text,/EMPLOYEE_HISTORY_BASELINE_STALE/);
});
test('Χωρίς εγκεκριμένες εκδόσεις η υφιστάμενη γενική διαδρομή διατηρεί την ευθύνη',async()=>{
    const h=harness({pragmatikosMisthos:1550},{approvedHistoryRequired:false});
    assert.deepEqual(await h.client.tryHandle(h.args),{handled:false});
    assert.equal(h.selected(),undefined);
    assert.equal(h.calls.length,1);
    assert.equal(h.dialogs.length,0);
});
