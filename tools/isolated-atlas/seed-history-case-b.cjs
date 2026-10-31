'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const {ROOT}=require('../../server/services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy');
const {buildCaseB}=require('./history-case-b.cjs');
const {verifyClient}=require('../../server/config/isolatedTestRuntime');
const {AUDIT_COLLECTION_NAME,AUDIT_SCOPE_INDEX_NAME,AUDIT_SCOPE_INDEX_KEYS}=require('../../server/constants/employeeHistoryRepairAudit');
const FILE=path.join(ROOT,'.cache/isolated-atlas/history-first-transaction/case-b.ejson');
const SEED_ARGUMENT='--seed-synthetic-case-b';
function invocationAllowed({root,cwd,ci,environment}) {
    return root===ROOT&&cwd===ROOT&&!ci&&environment!=='production';
}
function validateBundle(bundle) {
    if(bundle?.preparationOnly!==true||bundle.historyExecutionEnabled!==false||!Array.isArray(bundle.cases)
        ||bundle.cases.length!==2||typeof bundle.syntheticLoginPassword!=='string')throw Error('BUNDLE_REJECTED');
    const chosen=bundle.cases.filter(item=>item.variant==='acceptanceBWithInitialGap');
    if(chosen.length!==1)throw Error('VARIANT_REJECTED');
    const data=chosen[0],hash=data.collections?.users?.[0]?.password;
    if(typeof hash!=='string'||!require('bcrypt').compareSync(bundle.syntheticLoginPassword,hash))throw Error('PASSWORD_EVIDENCE_REJECTED');
    const expected=buildCaseB({passwordHash:hash,initialGap:true});
    if(!isDeepStrictEqual(data,expected))throw Error('NON_CANONICAL_TEST_DATA');
    const other=bundle.cases.find(item=>item.variant==='acceptanceB');
    if(!isDeepStrictEqual(other,buildCaseB({passwordHash:hash,initialGap:false})))throw Error('ALTERNATIVE_REJECTED');
    return data;
}
function loadBundle() {
    for(const filename of [path.dirname(path.dirname(FILE)),path.dirname(FILE),FILE]) {
        const stat=fs.lstatSync(filename);
        if(stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o077))throw Error('PRIVATE_BUNDLE_REQUIRED');
    }
    const raw=fs.readFileSync(FILE,'utf8');
    const bundle=require('mongoose').mongo.BSON.EJSON.parse(raw,{relaxed:true});
    return {data:validateBundle(bundle),fingerprint:crypto.createHash('sha256').update(raw).digest('hex')};
}

async function seed({client,data,fingerprint,reload=loadBundle}) {
    // Every future write rechecks the same effective privileges and immutable input.
    const canonical=buildCaseB({passwordHash:data?.collections?.users?.[0]?.password,initialGap:true});
    if(!isDeepStrictEqual(data,canonical))throw Error('NON_CANONICAL_TEST_DATA');
    const names=Object.keys(data.collections);
    const inserted=new Map(names.map(name=>[name,[]]));
    const db=client.db();
    let writesConfirmed=0;
    async function beforeWrite() {
        if(!invocationAllowed({root:fs.realpathSync(path.resolve(__dirname,'../..')),cwd:fs.realpathSync(process.cwd()),
            ci:Boolean(process.env.CI||process.env.GITHUB_ACTIONS),environment:process.env.NODE_ENV}))throw Error('INVOCATION_REJECTED');
        await verifyClient(client);
        const current=reload();
        if(current.fingerprint!==fingerprint||!isDeepStrictEqual(current.data,data))throw Error('STALE_BUNDLE');
        for(const name of names) {
            const owned=inserted.get(name), collection=db.collection(name);
            if(await collection.countDocuments({})!==owned.length)throw Error('EXISTING_DATA_CONFLICT');
            for(const document of owned) {
                const saved=await collection.findOne({_id:document._id});
                if(!isDeepStrictEqual(saved,document))throw Error('CONCURRENT_DATA_CHANGE');
            }
        }
        if(await db.collection(AUDIT_COLLECTION_NAME).countDocuments({})!==0)throw Error('AUDIT_DATA_CONFLICT');
    }
    try {
        await beforeWrite();
        // No real documents are read when any target collection is nonempty.
        const exists=await db.listCollections({name:AUDIT_COLLECTION_NAME},{nameOnly:true}).hasNext();
        if(exists) {
            const indexes=await db.collection(AUDIT_COLLECTION_NAME).listIndexes().toArray();
            if(indexes.some(item=>item.name===AUDIT_SCOPE_INDEX_NAME&&!isDeepStrictEqual(item.key,AUDIT_SCOPE_INDEX_KEYS)))
                throw Error('AUDIT_INDEX_CONFLICT');
        }
        const guardedDb={
            listCollections:(...args)=>db.listCollections(...args),
            async createCollection(name){if(name!==AUDIT_COLLECTION_NAME)throw Error('COLLECTION_REJECTED');
                await beforeWrite();const result=await db.createCollection(name);writesConfirmed++;return result;},
            collection(name){if(name!==AUDIT_COLLECTION_NAME)throw Error('COLLECTION_REJECTED');const collection=db.collection(name);
                return {listIndexes:()=>collection.listIndexes(),async createIndex(keys,options){
                    if(!isDeepStrictEqual(keys,AUDIT_SCOPE_INDEX_KEYS)||options.name!==AUDIT_SCOPE_INDEX_NAME)throw Error('INDEX_REJECTED');
                    await beforeWrite();const result=await collection.createIndex(keys,options);writesConfirmed++;return result;}};}
        };
        await require('../../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService')
            .setupEmployeeHistoryRepairAuditStorage({db:guardedDb});
        for(const name of names)for(const document of data.collections[name]) {
            await beforeWrite();
            await db.collection(name).insertOne(document);
            inserted.get(name).push(document);writesConfirmed++;
        }
        await beforeWrite();
        return {status:'SYNTHETIC_SEED_COMPLETE',variant:data.variant,writesConfirmed,
            documents:Object.fromEntries([...inserted].map(([name,documents])=>[name,documents.length])),historyExecutionEnabled:false};
    } catch(error) {
        // Never retry, delete or overwrite after a partial result. Existing data stays intact.
        throw Object.assign(Error('SYNTHETIC_SEED_STOPPED'),{reason:error.message,writesConfirmed});
    }
}

async function main() {
    if(!invocationAllowed({root:fs.realpathSync(path.resolve(__dirname,'../..')),cwd:fs.realpathSync(process.cwd()),
        ci:Boolean(process.env.CI||process.env.GITHUB_ACTIONS),environment:process.env.NODE_ENV}))throw Error('INVOCATION_REJECTED');
    const args=process.argv.slice(2);
    if(args.length!==1||!['--check',SEED_ARGUMENT].includes(args[0]))throw Error('EXPLICIT_ARGUMENT_REQUIRED');
    const {data,fingerprint}=loadBundle();
    if(args[0]==='--check') {
        console.log(JSON.stringify({status:'READY_FOR_SYNTHETIC_SEED',variant:data.variant,fingerprint,
            documents:Object.fromEntries(Object.entries(data.collections).map(([name,rows])=>[name,rows.length])),
            mongoConnections:0,writes:0,historyExecutionEnabled:false}));return;
    }
    // This branch is prepared for a separately authorized future invocation; never run by --check.
    const {loadEnvironment}=require('./runtime.cjs');
    const uri=loadEnvironment();
    const {MongoClient}=require('mongoose').mongo;
    const client=new MongoClient(uri,{dbName:'payroll_test_isolated',retryWrites:false,maxPoolSize:1,serverSelectionTimeoutMS:8000});
    try {await client.connect();console.log(JSON.stringify(await seed({client,data,fingerprint})));}
    finally{await client.close();}
}
module.exports={invocationAllowed,validateBundle,loadBundle,seed,SEED_ARGUMENT};
if(require.main===module)main().catch(error=>{
    console.error('Η προετοιμασία ή εισαγωγή του συνθετικού σεναρίου σταμάτησε επειδή δεν επιβεβαιώθηκαν ο προορισμός, τα δεδομένα ή η απουσία συγκρούσεων. '+
        `Επιβεβαιωμένες ενέργειες εγγραφής: ${Number(error.writesConfirmed||0)}. Δεν εκτελέστηκε τακτοποίηση Ιστορικού. Αν επιχειρήθηκε εισαγωγή, ελέγξτε τη δοκιμαστική βάση για πιθανό μερικό αποτέλεσμα.\n`+
        '1. Μην επαναλάβετε αυτόματα και μην διαγράψετε δεδομένα.\n2. Ελέγξτε το συνθετικό πακέτο με --check και ζητήστε έλεγχο του προορισμού.\nΚωδικός αναφοράς: TEST-SYNTHETIC-SEED-STOPPED.');
    process.exitCode=1;
});
