'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('./employeeEmploymentProfileWriter');
const {fixture,store}=require('../../../test/fixtures/employeeProfileTransactionStore');
const query=value=>({select(){return this;},session(){return this;},lean:async()=>value});
function setup(){
 const f=fixture('507f1f77bcf86cd799439199');
 const row=f.history[2];f.history.push({...row,_id:'507f1f77bcf86cd799439299',aa_eggrafhs:'0004',pragmatikosMisthos:1900});
 const db=store([f]);
 const run=(changes={},extra={})=>W.writeEmployeeMaintenance({...db.deps,scope:{team:f.employee.team,company_kod:f.employee.company_kod,kodikos:f.employee.kodikos},employeeId:f.employee._id,actorUserId:'synthetic',
 userModel:{findById:()=>query({team:'TEST',situation:'A'})},privilegeModel:{findOne:()=>query({privileges:{update:true}})},input:{},maintenance:{employeeChanges:changes,submittedEmployeeFields:Object.keys(changes),historyChanges:{},submittedProfileFields:[],submittedFormValues:changes},...extra});
 return {db,run};
}
test('ambiguous ordinary Maintenance saves contact data and preserves all History',async()=>{
 const {db,run}=setup(),before=db.state();const r=await run({email:'synthetic@example.invalid'});
 assert.equal(r.ambiguousHistoryPreserved,true);assert.equal(r.employeeUpdated,true);assert.equal(r.historyUpdated,false);
 assert.equal(db.state().employees[0].email,'synthetic@example.invalid');assert.deepEqual(db.state().history,before.history);
});
test('mixed dependent changes are rejected atomically',async()=>{
 const {db,run}=setup(),before=db.state();await assert.rejects(run({email:'synthetic@example.invalid',pragmatikosMisthos:2000}),{code:'EMPLOYEE_PROFILE_AMBIGUOUS_CHANGES_BLOCKED'});assert.deepEqual(db.state(),before);
});
test('ambiguous Maintenance does not bypass authorization',async()=>{
 const {db,run}=setup(),before=db.state();await assert.rejects(run({email:'synthetic@example.invalid'},{privilegeModel:{findOne:()=>query({privileges:{update:false}})}}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});assert.deepEqual(db.state(),before);
});
