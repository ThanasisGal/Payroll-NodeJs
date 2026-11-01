'use strict';
// Offline administrator operation. Never imports app.js or starts a listener.
// No action is selected by default and no capability is issued to HTTP callers.
const fs=require('node:fs'),path=require('node:path');
const ROOT='/home/thanasis/Projects/Payroll-NodeJs';
function option(argv,name){const matches=argv.filter(value=>value.startsWith('--'+name+'='));if(matches.length!==1)throw Error('PILOT_ARGUMENT_REQUIRED_'+name);return matches[0].slice(name.length+3);}
function assertInvocation(){
    if(process.env.NODE_ENV!=='development'||process.env.CI||process.env.GITHUB_ACTIONS||
        fs.realpathSync(process.cwd())!==ROOT||fs.realpathSync(path.join(__dirname,'../..'))!==ROOT||
        path.resolve(process.argv[1]||'')!==path.join(ROOT,'tools/history-pilot/operations.cjs'))throw Error('PILOT_OFFLINE_ENVIRONMENT_REJECTED');
}
async function main(){
    assertInvocation();
    const [action,...argv]=process.argv.slice(2);
    if(!['backup','reconcile','undo'].includes(action))throw Error('PILOT_EXPLICIT_ACTION_REQUIRED');
    const allowed=new Set(['expected-database','actor-id',...(action==='backup'
        ?['employee-id','team','company-id','employee-code','output-directory','business-decision-file']
        :['grant-file','grant-sha256',...(action==='undo'?['audit-id','confirm-undo']:[])])]);
    for(const arg of argv){const match=/^--([^=]+)=.+$/.exec(arg);if(!match||!allowed.has(match[1]))throw Error('PILOT_UNEXPECTED_ARGUMENT');}
    require('dotenv').config({quiet:true});
    assertInvocation();
    const mongoose=require('mongoose');mongoose.set('autoCreate',false);mongoose.set('autoIndex',false);
    const Files=require('../../server/services/ergazomenoi/employeeHistoryPilotFiles');
    const Recovery=require('../../server/services/ergazomenoi/employeeHistoryPilotRecoveryService');
    const Gate=require('../../server/services/ergazomenoi/employeeHistoryPilotGate');
    const expectedDatabase=option(argv,'expected-database'),actorUserId=option(argv,'actor-id');
    const client=new mongoose.mongo.MongoClient(process.env.MONGODB_URL||'');
    if(client.options.dbName!==expectedDatabase)throw Error('PILOT_DATABASE_MISMATCH');
    let grantFile;
    if(action!=='backup'){
        grantFile=option(argv,'grant-file');
        const bytes=Files.readPrivate(grantFile,ROOT);
        if(Files.digest(bytes)!==option(argv,'grant-sha256'))throw Error('PILOT_GRANT_HASH_MISMATCH');
        const grant=JSON.parse(bytes);
        if(grant.identity?.database!==expectedDatabase||grant.actorUserId!==actorUserId)throw Error('PILOT_GRANT_TARGET_MISMATCH');
    }
    try{
        await mongoose.connect(process.env.MONGODB_URL,{autoIndex:false,autoCreate:false});
        const models=require('../../server/models/ergazomenoi');
        const W=require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
        const deps={connection:mongoose.connection,employeeModel:models.ErgazomenoiModel,historyModel:models.IstorikoProslhpseonAllagonModel,
            auditModel:require('../../server/models/employeeHistoryRepairAudit'),userModel:require('../../server/models/userModel'),
            privilegeModel:require('../../server/models/privileges').UserPrivilegesModel,companyModel:require('../../server/models/companies').CompaniesModel,
            capabilityProbe:W.transactionCapability,referenceChecker:require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences};
        if(action==='backup'){
            let businessDecision;
            if(argv.some(arg=>arg.startsWith('--business-decision-file=')))businessDecision=JSON.parse(Files.readPrivate(option(argv,'business-decision-file'),ROOT));
            return await Recovery.prepareBackup({deps,actorUserId,employeeId:option(argv,'employee-id'),
                scope:{team:option(argv,'team'),company_kod:option(argv,'company-id'),kodikos:option(argv,'employee-code')},
                outputDirectory:option(argv,'output-directory'),appRoot:ROOT,...(businessDecision===undefined?{}:{businessDecision})});
        }
        const pilot=Gate.createGate({grantFile,deps,root:ROOT});
        const context={deps,pilot,referenceSummary:async(rows,session)=>{
            const result={};for(const row of rows)result[String(row._id)]=await deps.referenceChecker({connection:deps.connection,historyIds:[String(row._id)],session});return result;
        }};
        if(action==='reconcile')return await Recovery.reconcile({context,actorUserId});
        const auditId=option(argv,'audit-id');
        if(option(argv,'confirm-undo')!==auditId)throw Error('PILOT_UNDO_EXPLICIT_CONFIRMATION_REQUIRED');
        return await Recovery.undo({context,actorUserId,auditId,confirmed:true});
    }finally{await mongoose.disconnect();}
}
if(require.main===module)main().then(result=>console.log(JSON.stringify(result))).catch(error=>{
    // Driver errors can contain connection details; never print their messages.
    console.error('Η ενέργεια δεν ολοκληρώθηκε. Η αποθήκευση δεν επιβεβαιώθηκε.\n1. Μην επαναλάβετε εγγραφή.\n2. Ζητήστε έλεγχο άδειας και audit από τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-PILOT-CLI-01.');
    process.exitCode=1;
});
module.exports={assertInvocation,main};
