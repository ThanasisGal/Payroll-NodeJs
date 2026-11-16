'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { incompleteProblems } = require('./employeeHistoryApprovedProposalDiagnostics');
const { inspectEmployeeHistorySave, inspectEmployeeHistoryProposedRowSave } = require('./employeeHistorySaveValidationService');
const { fixture } = require('../../../test/fixtures/employeeProfileTransactionStore');

test('INCOMPLETE: πραγματικά πεδία ελεγκτή, ομάδες αποδοχών και απαιτούμενα αριθμητικά στοιχεία', () => {
    const f=fixture(),row={...f.history[0],nomimosMisthos:0,pragmatikosMisthos:0,evelikth_proselefsh:null};
    const inspection=inspectEmployeeHistoryProposedRowSave(row);
    const problems=incompleteProblems(inspection);
    assert.deepEqual(new Set(problems.map(item=>item.fieldId)),new Set(['nomimosMisthos','pragmatikosMisthos','evelikth_proselefsh']));
    assert.equal(problems.find(item=>item.fieldId==='nomimosMisthos').field,'Νόμιμες αποδοχές');
    assert.equal(problems.find(item=>item.fieldId==='pragmatikosMisthos').field,'Πραγματικές αποδοχές');
    assert.ok(problems.every(item=>item.problem&&item.cause&&item.action));
    assert.doesNotMatch(JSON.stringify(problems),new RegExp(String(row._id)));
});

test('INCOMPLETE: χωρίς επινοημένα πεδία από γενικά σφάλματα, διαφορές ή προστατευμένα metadata', () => {
    const inspection={issues:[
        {reason:'INVALID_EMPLOYMENT_PROFILE'},
        {reason:'CURRENT_PROFILE_MISMATCH',field:'nomimosMisthos'},
        {reason:'REQUIRED_PROFILE_FIELD',field:'history_reference_fence',label:'ευαίσθητο στοιχείο'},
        {reason:'UNKNOWN',field:'krathsh_01'}
    ],rows:[{field:'nomimosMisthos',before:1200,after:1300}]};
    const problems=incompleteProblems(inspection);
    assert.ok(problems.every(item=>item.kind==='CHECK'));
    assert.deepEqual(problems.map(item=>item.code),['INVALID_EMPLOYMENT_PROFILE','REQUIRED_PROFILE_FIELD','UNKNOWN']);
    assert.doesNotMatch(JSON.stringify(problems),/history_reference_fence|ευαίσθητο στοιχείο|krathsh_01|nomimosMisthos/);
    const dates=incompleteProblems({issues:[{reason:'INVALID_TEMPORAL_DATE'}]});
    assert.equal(dates.length,1);assert.equal(dates[0].kind,'CHECK');assert.equal(dates[0].code,'INVALID_TEMPORAL_DATE');
});


test('αναλυτικός verifier: ίδια κριτήρια, παλιοί κωδικοί και μορφή απόκρισης χωρίς προαιρετικές λεπτομέρειες',()=>{
    const {verifyEmployeeHistoryAutomaticSettlement:verify}=require('./employeeHistoryAutomaticReconstructionPlannerService');
    for(const values of [{},{hmeres_ergasias_ebdomadas:6,mo_oron_hmerhsias_ergasias:6.67},
        {nomimosMisthos:-1},{dialleima_apo_ora_01:'12:00'},{hmeromhnia_isxyos_oron_ergasias_apo:'2026-02-30'}]){
        const f=fixture();Object.assign(f.history[0],values);
        const row=f.history[0],input={scope:{team:row.team,company_kod:row.company_kod,kodikos:row.kodikos},currentEmployee:f.employee,proposedRows:f.history,strictProfileEvidence:true};
        const original=verify(input),{issueDetails,...detailed}=verify({...input,includeIssueDetails:true});
        assert.deepEqual(detailed,original);assert.equal(Object.hasOwn(original,'issueDetails'),false);
        assert.ok(original.issues.every(reason=>typeof reason==='string'));
        if(Object.keys(values).length)assert.ok(issueDetails.length);
    }
});

test('ημερομηνίες και αριθμοί: ανεξάρτητες πραγματικές αστοχίες ακόμη και αν αποτύχει νωρίς η κανονικοποίηση',()=>{
    const f=fixture(),row=f.history[0];Object.assign(row,{hmeromhnia_isxyos_oron_ergasias_apo:'2026-02-30',nomimosMisthos:-1});
    const inspection=inspectEmployeeHistorySave({scope:{team:row.team,company_kod:row.company_kod,kodikos:row.kodikos},currentEmployee:f.employee,historyRows:f.history,includeIssueDetails:true});
    const problems=incompleteProblems(inspection);
    assert.ok(problems.some(item=>item.fieldId==='hmeromhnia_isxyos_oron_ergasias_apo'&&item.code==='INVALID_TEMPORAL_DATE'));
    assert.ok(problems.some(item=>item.fieldId==='nomimosMisthos'&&item.code==='INVALID_NUMERIC_PROFILE_FACT'));
});

test('απομονωμένη εγγραφή: η γενική αποτυχία κάλυψης/τρέχοντος προφίλ δεν αποτελεί τοπικό ελάττωμα',()=>{
    const f=fixture(),row=f.history[0],scope={team:row.team,company_kod:row.company_kod,kodikos:row.kodikos};
    assert.notEqual(inspectEmployeeHistorySave({scope,currentEmployee:f.employee,historyRows:[row]}).status,'CLEAN');
    assert.deepEqual(inspectEmployeeHistoryProposedRowSave(row).issues,[]);
});
