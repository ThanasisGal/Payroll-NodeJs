'use strict';
const {test,before,after,mock} = require('node:test');
const assert = require('node:assert/strict');
const R = require('./historicalProfileComparison');
const P = require('./employmentProfileContract');
const T = require('./employmentProfileTransition');
const N = require('./employeeMaintenanceIntent');
const Change = require('./historicalProfileChange');
const {normalizeEmployeeHistoryChange} = require('./employmentProfileMaintenance');
const C = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const F = require('../../../test/fixtures/employeeHistoryResolvedProposal');
const Cases = require('../../../test/fixtures/employeeGeneralHistoryCases');
const UI = require('../../../public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi');
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(()=>mock.restoreAll());
function baseline() {
    const current = {...F.resolvedProposalFixture({independent:false}).currentEmployee};
    for (const entry of R.fields) if (current[entry.field] == null) current[entry.field] =
        entry.type === 'Number' ? 0 : entry.type === 'Boolean' ? false : entry.type === 'Array' ? [] :
            entry.type === 'Date' ? new Date('2026-06-03') : '01';
    Object.assign(current,Cases.arrangement,{[P.FROM]:new Date(Cases.date),[P.UNTIL]:new Date('2026-12-31')},Cases.intervals);
    return current;
}
const current = baseline();
function equivalent(entry,value) {
    if (entry.type === 'Number' || entry.type === 'Boolean') return String(value);
    if (entry.type === 'Date') return new Date(value).toISOString().slice(0,10);
    if (entry.type === 'Array') return [...value].reverse().map(String);
    return entry.trim ? ' '+value+' ' : value;
}
function request(values) {
    return {input:{},maintenance:{employeeChanges:values,historyChanges:values,submittedHistoryChanges:values,
        submittedEmployeeFields:Object.keys(values),submittedFormValues:values}};
}
test('Η κεντρική αντιστοίχιση καλύπτει ακριβώς τα επίσημα 93 πεδία και τις δύο ειδικές ιδιοκτησίες',()=>{
    assert.equal(R.fields.length,93);
    assert.deepEqual(R.fields.map(e=>e.field),C.PROFILE_FIELDS);
    assert.equal(R.writableFields.length,91);
    assert.equal(R.byField.get('misthologiko_klimakio').role,'SERVER_DERIVED');
    assert.equal(R.byField.get('hmeromhnia_isxyos_dialleimatos_apo').role,'HISTORY_EVENT_DATE');
});
for (const entry of R.fields) test('Τύποι, ισοδυναμία και πραγματική διαφορά: '+entry.field,()=>{
    const immutable=A.stringify(current), comparison=R.createHistoricalComparison(current);
    assert.equal(comparison.same(entry.field,current[entry.field]),true);
    assert.equal(comparison.same(entry.field,equivalent(entry,current[entry.field])),true);
    let alternative = entry.type === 'Number' ? Number(current[entry.field])+1 :
        entry.type === 'Boolean' ? !current[entry.field] : entry.type === 'Date' ? '2027-01-01' :
        entry.type === 'Array' ? [2,4] : '02';
    if (['kathestos_apasxolhshs','typos_apasxolhshs'].includes(entry.field)) alternative='1';
    if (entry.field === 'typos_ebdomadas') alternative='6HMERH';
    const changes = {[entry.field]:alternative};
    assert.equal(Object.hasOwn(comparison.difference(changes),entry.field),true);
    assert.equal(A.stringify(current),immutable);
    if (entry.writable) {
        const client=R.clientBaseline(current);
        assert.deepEqual(UI.profileDifference({[entry.field]:equivalent(entry,current[entry.field])},client),{});
        assert.equal(Object.hasOwn(UI.profileDifference(changes,client),entry.field),true);
    }
});
const previousFalseChanges = R.fields.filter(e=>e.writable && !T.TRANSITION_FIELDS.includes(e.field));
test('Οι 61 αποδεδειγμένες ψευδείς διαφορές έχουν ακριβώς 36 αριθμούς και 25 κωδικούς',()=>{
    assert.equal(previousFalseChanges.length,61);
    assert.equal(previousFalseChanges.filter(e=>e.type === 'Number').length,36);
    assert.equal(previousFalseChanges.filter(e=>e.type === 'String').length,25);
});
for (const entry of previousFalseChanges) test('Κανονικοποίηση πρόθεσης πλήρους φόρμας: '+entry.field,()=>{
    const result=N.normalizeEmployeeMaintenanceIntent(request({[entry.field]:equivalent(entry,current[entry.field])}),current);
    for (const values of [result.input,result.maintenance.employeeChanges,result.maintenance.historyChanges,
        result.maintenance.submittedHistoryChanges]) assert.equal(Object.hasOwn(values,entry.field),false);
});
test('Προστατευμένα, παράγωγα, άγνωστα πεδία και μη έγκυροι τύποι δεν γίνονται εγγράψιμα',()=>{
    for (const field of ['_id','team','history_reference_fence','employment_profile_schema_version',
        'misthologiko_klimakio','hmeromhnia_isxyos_dialleimatos_apo','apasxolhsh_basei_symbashs',
        'eidikh_periptosh','typos_ergazomenon','invented'])
        assert.equal(Change.normalizeProfileChangeTerms({[field]:'01'},current),null,field);
    assert.throws(()=>R.createHistoricalComparison(current).same('poso_symbashs_02','invalid'));
    assert.throws(()=>R.createHistoricalComparison(current).same(P.FROM,'2026-02-30'));
    assert.equal(R.createHistoricalComparison({symbash:'01'}).same('symbash','1'),false,'οι κωδικοί διατηρούν τα αρχικά μηδενικά');
});
test('Ισοδύναμη ρητή ιστορική πρόθεση αφαιρείται πριν από την ατομική διαδρομή',()=>{
    assert.equal(normalizeEmployeeHistoryChange({kind:'NEW_CHANGE',effectiveFrom:Cases.date,
        correctedTerms:{pragmatikosMisthos:String(current.pragmatikosMisthos)}},current),undefined);
});
test('Απουσία προαιρετικών τιμών και ουδέτερων προεπιλογών δεν αποτελεί μεταβολή στον φυλλομετρητή',()=>{
    const baseline=R.clientBaseline({});
    assert.deepEqual(UI.profileDifference({dialleima_se_lepta:0,typos_orarioy:false,
        hmnia_enarxhs_egkekrimenhs_rythmishs:'',stoixeio_symbashs_02:''},baseline),{});
});
module.exports={baseline};
