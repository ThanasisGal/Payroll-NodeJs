'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { incompleteProblems } = require('./employeeHistoryApprovedProposalDiagnostics');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const { fixture } = require('../../../test/fixtures/employeeProfileTransactionStore');

test('INCOMPLETE: πραγματικά πεδία ελεγκτή, ομάδες αποδοχών και απαιτούμενα αριθμητικά στοιχεία', () => {
    const f=fixture(),row={...f.history[0],nomimosMisthos:0,pragmatikosMisthos:0,evelikth_proselefsh:null};
    const inspection=inspectEmployeeHistorySave({scope:{team:row.team,company_kod:row.company_kod,kodikos:row.kodikos},
        currentEmployee:f.employee,historyRows:[row]});
    const problems=incompleteProblems(inspection);
    assert.deepEqual(problems.map(item=>item.fieldId),['nomimosMisthos','pragmatikosMisthos','evelikth_proselefsh']);
    assert.deepEqual(problems.slice(0,2).map(item=>item.field),['Νόμιμες αποδοχές','Πραγματικές αποδοχές']);
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
    assert.deepEqual(incompleteProblems(inspection),[]);
    assert.deepEqual(incompleteProblems({issues:[{reason:'INVALID_TEMPORAL_DATE'}]}),[]);
});
