'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {forbidRealSettlementMongo}=require('../../test/fixtures/forbidRealSettlementMongo');
const {buildCaseB}=require('./history-case-b.cjs');
const {buildCoordinatedSettlementProposal}=require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const {accessForUser}=require('../../server/services/ergazomenoi/employeeHistoryAuthorizationService');
const {extractEmployeeHistoryReferences}=require('../../server/services/ergazomenoi/employeeHistoryReferenceDefinitionsService');
const bcrypt=require('bcrypt');
const hash=bcrypt.hashSync('synthetic-offline-only',4);
before(()=>forbidRealSettlementMongo(mock));after(()=>mock.restoreAll());
for(const initialGap of [true,false])test(`offline Case B initialGap=${initialGap} uses valid TEST scope and pure preview`,async()=>{
    const data=buildCaseB({initialGap,passwordHash:hash});
    assert.equal(data.executionEnabled,false);assert.equal(data.imported,false);
    assert.equal(data.database,'payroll_test_isolated');
    assert.equal(data.expected.baselineHistoryRows,initialGap?3:4);
    assert.equal(data.expected.proposalStatus,'CLEAN');assert.equal(data.expected.noOp,false);
    const {CompaniesModel}=require('../../server/models/companies');
    const User=require('../../server/models/userModel');
    const {UserPrivilegesModel}=require('../../server/models/privileges');
    for(const [Model,documents] of [[CompaniesModel,data.collections.Companies],[User,data.collections.users],
        [UserPrivilegesModel,data.collections.User_Privileges]])
        for(const document of documents)await new Model(document).validate();
    const actor=data.collections.users[0];
    assert.equal(accessForUser(actor).mode,'ADMIN_FULL');
    assert.ok(actor.email.endsWith('.invalid'));
    assert.equal(data.sessionTemplate.companyInUse,data.scope.company_kod);
    assert.equal(data.sessionTemplate.userTeam,data.scope.team);
    const employee=data.collections.Ergazomenoi[0];
    assert.match(employee.kodikos,/^TEST-/);assert.equal(employee.oristikh_enhmerosh,true);
    assert.equal(employee.afm,undefined);assert.equal(employee.amka,undefined);
    for(const row of data.collections.Istoriko_Proslhpseon_Allagon)
        for(const field of ['team','company_kod','kodikos'])assert.equal(row[field],data.scope[field]);
    const references=extractEmployeeHistoryReferences('Apasxoliseis_Period_Frozen_Snapshots',data.collections.Apasxoliseis_Period_Frozen_Snapshots);
    assert.equal(references.length,data.expected.baselineHistoryRows);
    const encoded=mongoose.mongo.BSON.EJSON.stringify(data,{relaxed:false});
    // Match the driver's normal promotion of numeric BSON values to JavaScript numbers.
    const restored=mongoose.mongo.BSON.EJSON.parse(encoded,{relaxed:true});
    assert.equal(buildCoordinatedSettlementProposal(restored.input).status,'CLEAN');
    assert.equal(mongoose.connection.readyState,0);
});
test('the real apply boundary remains 423 without request reads, a transaction or HTTP POST',()=>{
    const controller=require('../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementController')
        .createEmployeeHistoryAutomaticSettlementController();
    const response={set(){return this;},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
    controller.apply(new Proxy({},{get(){assert.fail('No request data may open the closed boundary');}}),response);
    assert.equal(response.code,423);assert.equal(response.body.executionEnabled,false);
    assert.equal(mongoose.connection.readyState,0);
});
test('the workflow report never implicitly authorizes history execution',()=>{
    const plan=require('./history-activation-plan.json');
    assert.ok(['READY_FOR_SYNTHETIC_SEED','SYNTHETIC_TRANSACTION_PASS'].includes(plan.status));assert.equal(plan.historyExecutionEnabled,false);
    assert.equal(plan.allowedTarget.port,5025);assert.equal(plan.currentPR351Policy.test5025Supported,false);
    assert.equal(plan.ciAdapter.mustNotReuse,true);
});
test('PR351 only allows its original explicit DEV invocation and never the TEST argument',()=>{
    const {eligible}=require('../../server/services/ergazomenoi/employeeHistorySettlementDevActivation');
    const root='/home/thanasis/Projects/Payroll-NodeJs';
    const original={environment:'development',root,cwd:root,port:5000,ci:false,
        argv:['node','app.js',`--employee-history-settlement-dev=${root}:5000`]};
    assert.equal(eligible(original),true);
    const plan=require('./history-activation-plan.json');
    for(const port of [5000,5015,5025])assert.equal(eligible({...original,port,
        argv:['node','app.js',plan.proposedExplicitArgument]}),false);
    assert.equal(eligible({...original,environment:'production'}),false);
    assert.equal(eligible({...original,argv:['node','app.js']}),false);
});
for(const initialGap of [true,false])test(`real preview controller reads offline Case B initialGap=${initialGap} without enabling execution`,async()=>{
    const data=buildCaseB({initialGap,passwordHash:hash});
    const connection={name:data.database};
    const reads=[];
    const query=value=>({select(){return this;},mongooseOptions(){return this;},async lean(){return value;}});
    const controller=require('../../server/controllers/ergazomenoi/employeeHistoryReconstructionPreviewController')
        .createEmployeeHistoryReconstructionPreviewController({
            companyModel:{findOne(filter){assert.equal(String(filter._id),data.scope.company_kod);return query(data.collections.Companies[0]);}},
            employeeModel:{findOne(filter){assert.equal(filter._id,data.employeeId);reads.push(filter);return query(data.input.currentEmployee);}},
            historyModel:{db:connection,find(filter){assert.deepEqual(filter,data.scope);reads.push(filter);return query(data.input.completeHistoryRows);}},
            referenceChecker:async options=>{
                assert.equal(options.connection,connection);assert.equal(options.connection.name,'payroll_test_isolated');
                return data.input.protectedReferenceSummary[String(options.historyIds[0])];
            },loadCatalogs:async()=>({})});
    const response={code:200,set(){return this;},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
    await controller({method:'GET',session:data.sessionTemplate,authenticatedUserTeam:'THA',
        params:{id:data.employeeId},query:{presentation:'settlement'}},response);
    assert.equal(response.code,200);assert.equal(response.body.success,true);
    assert.equal(response.body.executionMode,'PREVIEW_ONLY');
    assert.notEqual(response.body.settlementPreview.executionEnabled,true);
    assert.equal(reads.length,2);assert.equal(mongoose.connection.readyState,0);
});
