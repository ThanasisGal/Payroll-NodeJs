'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./ergazomenoiController.js'),'utf8');
const SaveState=require('../../utils/ergazomenoi/employeeSaveState');
for(const name of ['postErgazomenoiForm','postErgazomenoiUpdate']) {
 const start=source.indexOf(`static ${name} = `);
 const end=source.indexOf('\n    static ',start+1);
 const body=source.slice(start,end);
 for(const [reason,notes] of [['',''],['1',''],['','Συνθετική']])test(`${name} rejects incomplete termination before model/storage access ${reason}/${notes}`,async()=>{
  let code,response;
  const context={SaveState};
  for(const model of ['ErgazomenoiModel','IstorikoProslhpseonAllagonModel'])context[model]=new Proxy({},
   {get(){throw Error('Model must not be accessed');}});
  const handler=vm.runInNewContext(`(class { ${body} }).${name}`,context);
  await handler({session:{},params:{ergazomenoiId:'synthetic'},body:{formData:{
   hmeromhnia_apoxorhshs:'2026-10-23',logos_peratoshs_stathera:reason,parathrhseis_peratoshs:notes},
   filesToUpdate:{create_contract:true,ma_217:true}}},
   {status(value){code=value;return this;},json(value){response=value;return this;}});
  assert.equal(code,400);assert.equal(response.success,false);
  assert.equal(response.reason,'EMPLOYEE_SAVE_TERMINATION_REQUIRED');
  assert.match(response.message,/Δεν αποθηκεύτηκε καμία αλλαγή/);
 });
}
