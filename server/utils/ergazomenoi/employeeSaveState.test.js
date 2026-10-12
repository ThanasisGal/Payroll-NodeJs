'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('./employeeSaveState');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { finalizedEmployeeFilter } = require('./finalizedEmployeeFilter');
for (const value of [true, undefined, null, 0, 'false', 'true']) test(`only explicit Boolean false is temporary: ${value}`,()=>{
    assert.equal(S.isTemporaryEmployee({oristikh_enhmerosh:value}),false);
});
test('new employees default to finalized without migrating legacy BSON',()=>{
    assert.equal(new ErgazomenoiModel().oristikh_enhmerosh,true);
    assert.equal(S.isTemporaryEmployee({oristikh_enhmerosh:false}),true);
    assert.deepEqual(finalizedEmployeeFilter({team:'TEST'}).oristikh_enhmerosh.$ne,false);
});
test('state token is order independent and ignores the transaction fence only',()=>{
    const a={email:'a',updatedAt:new Date('2026-10-02'),_id:'test'};
    assert.equal(S.employeeStateToken(a),S.employeeStateToken({...a,employee_profile_mutation_sequence:99}));
    assert.equal(S.employeeStateToken(a),S.employeeStateToken({_id:'test',updatedAt:a.updatedAt,email:'a'}));
    assert.notEqual(S.employeeStateToken(a),S.employeeStateToken({...a,email:'b'}));
    assert.throws(()=>S.assertEmployeeState(a,'stale',true),{code:'EMPLOYEE_SAVE_STATE_STALE'});
    assert.throws(()=>S.assertEmployeeState(a,undefined,true),{code:'EMPLOYEE_SAVE_STATE_STALE'});
});
for(const body of [{saveMode:'bogus'},{oristikh_enhmerosh:false},{formData:{oristikh_enhmerosh:false}},
    {saveMode:'temporary',rehireIntent:true},{saveMode:'temporary',reconstruction:{}},{saveMode:'temporary',resolution:{}},
    {formData:[]},null])test(`reject invalid lifecycle command ${JSON.stringify(body)}`,()=>{
    assert.throws(()=>S.employeeSaveMode(body),{code:'EMPLOYEE_SAVE_INVALID_MODE'});
});
test('legacy missing command is final, with Greek actionable failure text',()=>{
    assert.equal(S.employeeSaveMode({}),'final');assert.equal(S.employeeSaveMode({saveMode:'temporary'}),'temporary');
    let status,body;const res={status(s){status=s;return this;},json(b){body=b;}};
    S.sendEmployeeSaveStateError(res,S.saveStateError('EMPLOYEE_SAVE_ALREADY_FINAL'));
    assert.equal(status,409);assert.match(body.message,/Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.match(body.message,/1\.[\s\S]*2\.[\s\S]*3\.[\s\S]*Κωδικός αναφοράς/);
});
test('draft attachment mapping accepts declared PDFs only and rejects invalid data',()=>{
    const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nsynthetic').toString('base64');
    assert.deepEqual(S.draftAttachmentFields({bibliario_anhlikoy_base64:pdf,arbitrary:'ignored'}),{bibliario_anhlikoy_base64:pdf});
    assert.throws(()=>S.draftAttachmentFields({bibliario_anhlikoy_base64:'not a PDF'}),{code:'EMPLOYEE_SAVE_INVALID_DATA'});
});

test('new draft and final Add share the same scoped business-code reservation',()=>{
    const scope={team:'T',company_kod:'C',kodikos:'0001'};
    assert.equal(require('./employeeSaveState').employeeCreationId(scope),require('./employeeSaveState').employeeCreationId({...scope}));
    assert.notEqual(require('./employeeSaveState').employeeCreationId(scope),require('./employeeSaveState').employeeCreationId({...scope,kodikos:'0002'}));
    assert.notEqual(require('./employeeSaveState').employeeCreationId(scope),require('./employeeSaveState').employeeCreationId({...scope,company_kod:'D'}));
});
