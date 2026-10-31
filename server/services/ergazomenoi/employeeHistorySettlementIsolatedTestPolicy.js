'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT='/home/thanasis/Projects/Payroll-NodeJs-atlas-isolated-test-20261031';
const FLAG=`--employee-history-settlement-isolated-test=${ROOT}:127.0.0.1:5025:payroll_test_isolated`;
const EXECUTE_FLAG=`${FLAG}:execute-once`;
const TARGET=Object.freeze({team:'THA',company:'5025b0010000000000000001',actor:'5025b0010000000000000002',
    employee:'5025b0010000000000000004',code:'TEST-5025-CASE-B'});
const contexts=new WeakMap();
let active=null;
function eligible(c) {
    return c.root===ROOT && c.cwd===ROOT && c.entry===path.join(ROOT,'tools/isolated-atlas/start.cjs')
        && c.environment==='development' && !c.ci && c.host==='127.0.0.1' && c.port===5025
        && Array.isArray(c.argv) && c.argv.length===3 && [FLAG,EXECUTE_FLAG].includes(c.argv[2]);
}
function invocation(server,appRoot) {
    try{return eligible({root:fs.realpathSync(appRoot),cwd:fs.realpathSync(process.cwd()),
        entry:path.resolve(process.argv[1]||''),argv:process.argv,environment:process.env.NODE_ENV,
        ci:Boolean(process.env.CI||process.env.GITHUB_ACTIONS),host:server.address()?.address,port:server.address()?.port}) && server.listening;}
    catch{return false;}
}
function assertScope(req) {
    if(req.session?.userId!==TARGET.actor || req.session?.companyInUse!==TARGET.company
        || req.session?.userTeam!==TARGET.team || req.params?.id!==TARGET.employee)
        throw Error('ISOLATED_HISTORY_SCOPE_REJECTED');
}
async function initialize({server,appRoot}) {
    if(active || !invocation(server,appRoot))return false;
    const runtime=require('../../config/isolatedTestRuntime');
    const clients=runtime.verifiedClients();
    if(!clients || clients.length!==2 || clients[0]===clients[1])return false;
    const mongoose=require('mongoose'), connection=mongoose.connection;
    const {ErgazomenoiModel:employeeModel,IstorikoProslhpseonAllagonModel:historyModel}=require('../../models/ergazomenoi');
    const companyModel=require('../../models/companies').CompaniesModel;
    const userModel=require('../../models/userModel');
    const privilegeModel=require('../../models/privileges').UserPrivilegesModel;
    const auditModel=require('../../models/employeeHistoryRepairAudit');
    async function assertIsolation() {
        if(!invocation(server,appRoot) || runtime.automaticTasksEnabled())throw Error('ISOLATION_LOST');
        for(const client of clients)await runtime.verifyClient(client);
        if(connection.getClient()!==clients[0] || connection.name!=='payroll_test_isolated'
            || connection.db?.databaseName!=='payroll_test_isolated')throw Error('CONNECTION_CHANGED');
        for(const model of [employeeModel,historyModel,companyModel,userModel,privilegeModel,auditModel])
            if(model.db!==connection)throw Error('MODEL_CONNECTION_REJECTED');
    }
    async function assertSyntheticRecords() {
        const employee=await employeeModel.findOne({_id:TARGET.employee,team:TARGET.team,company_kod:TARGET.company,kodikos:TARGET.code}).lean();
        const company=await companyModel.findOne({_id:TARGET.company,team:TARGET.team}).lean();
        const actor=await userModel.findById(TARGET.actor).lean();
        if(!employee || employee.onoma!=='TEST' || employee.eponymo!=='CASE B SYNTHETIC' || employee.afm || employee.amka
            || company?.eponymia!=='TEST 5025 CASE B SYNTHETIC' || actor?.firstName!=='TEST'
            || actor.lastName!=='CASE B' || actor.team!=='THA' || actor.privileges!=='A' || actor.situation!=='A'
            || actor.email!=='test-5025-case-b@example.invalid')throw Error('NON_SYNTHETIC_IDENTITY_REJECTED');
    }
    await assertIsolation();await assertSyntheticRecords();
    if(active || !invocation(server,appRoot))return false;
    const handle=Object.freeze({});
    let executionAvailable=process.argv[2]===EXECUTE_FLAG;
    const referenceChecker=require('./employeeHistoryReferenceAuditService').findHistoryIdReferences;
    const context={mode:'CONTROLLED_DEV',get executionEnabled(){return executionAvailable&&invocation(server,appRoot);},
        deps:{connection,employeeModel,historyModel,companyModel,userModel,privilegeModel,auditModel,referenceChecker,
            capabilityProbe:require('./employeeEmploymentProfileWriter').transactionCapability,
            auditCollectionChecker:require('./employeeHistoryRepairAuditSetupService').employeeHistoryRepairAuditCollectionExists},
        async assertRequest(req){try{assertScope(req);await assertIsolation();await assertSyntheticRecords();}
            catch{throw Object.assign(Error('ISOLATED_HISTORY_PREREQUISITE_REJECTED'),{code:'ISOLATED_HISTORY_PREREQUISITE_REJECTED',statusCode:423});}},
        async claimExecution({scope,actorUserId,employeeId,fingerprint,approvedFingerprint}) {
            if(!executionAvailable || actorUserId!==TARGET.actor || employeeId!==TARGET.employee || scope.team!==TARGET.team
                || scope.company_kod!==TARGET.company || scope.kodikos!==TARGET.code
                || !/^[A-Za-z0-9_-]{43}$/.test(fingerprint||'') || fingerprint!==approvedFingerprint)
                throw Object.assign(Error('ISOLATED_EXECUTION_REJECTED'),{statusCode:423});
            // Consume before awaiting: concurrent requests and uncertain outcomes cannot claim a second transaction.
            executionAvailable=false;
            await assertIsolation();await assertSyntheticRecords();
        },
        readAudits(session,{scope,employeeId}) {
            if(scope.team!==TARGET.team || scope.company_kod!==TARGET.company || scope.kodikos!==TARGET.code || employeeId!==TARGET.employee)
                throw Error('ISOLATED_AUDIT_SCOPE_REJECTED');
            return auditModel.find({'employeeScope.team':TARGET.team,'employeeScope.company_kod':TARGET.company,
                'employeeScope.kodikos':TARGET.code,'employeeScope.employee_id':employeeId}).session(session).sort({_id:1}).lean();
        },
        async referenceSummary(rows,session){const result={};for(const row of rows)result[String(row._id)]=await referenceChecker({connection,historyIds:[String(row._id)],session});return result;}
    };
    contexts.set(handle,{context,server,appRoot});active={handle,server,appRoot};
    server.once('close',()=>{contexts.delete(handle);if(active?.handle===handle)active=null;});
    return true;
}
function getReadHandle(req) {
    if(!active || !invocation(active.server,active.appRoot))return null;
    if(req.socket?.server!==active.server || req.socket.localPort!==5025)return null;
    try{assertScope(req);return active.handle;}catch{return null;}
}
function contextFor(handle) {
    const entry=handle&&contexts.get(handle);
    return entry&&invocation(entry.server,entry.appRoot)?entry.context:null;
}
function getApplyHandle(req){const handle=getReadHandle(req);return handle&&contextFor(handle)?.executionEnabled?handle:null;}
module.exports={ROOT,FLAG,EXECUTE_FLAG,TARGET,eligible,assertScope,initialize,getReadHandle,contextFor,getApplyHandle};
