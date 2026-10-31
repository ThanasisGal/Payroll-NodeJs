'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../../server/config/isolatedTestRuntime');
const { prepare, FIXTURE } = require('./prepare-category.cjs');
const ROOT = '/home/thanasis/Projects/Payroll-NodeJs-atlas-isolated-test-20261031';
const valid = { root:ROOT, cwd:ROOT, entry:path.join(ROOT,'tools/isolated-atlas/start.cjs'),
    environment:'development',host:'127.0.0.1',port:'5025',argumentCount:2 };
function client(database='payroll_test_isolated') {
    const events=[];
    let saved=null;
    const db={ databaseName:database,
        async command(command) { events.push(command); return { authInfo:{
            authenticatedUsers:[{user:'payroll_dev_test',db:'admin'}],
            authenticatedUserRoles:[{role:'readWrite',db:'payroll_test_isolated'}],
            authenticatedUserPrivileges:[{resource:{db:'payroll_test_isolated',collection:''},actions:['insert','update','find']}] } }; },
        collection(name) { assert.equal(name,'Eidikes_Kathgories'); return {
            async findOne() { return saved; }, async insertOne(document) { events.push('insert');saved=document; } }; }
    };
    return {events,db:()=>db,options:{credentials:{username:'payroll_dev_test'}}};
}
class FakeId { constructor(value) { this.value=value; } toString() { return this.value; } }

test('default behavior is enabled and only the exact isolated invocation qualifies', () => {
    assert.equal(policy.automaticTasksEnabled(),true);
    assert.equal(policy.eligible(valid),true);
    for (const patch of [{root:'/tmp/other'},{cwd:'/tmp/other'},{port:'5000'},{port:'5015'},
        {host:'0.0.0.0'},{environment:'production'},{argumentCount:3},{entry:path.join(ROOT,'app.js')}])
        assert.equal(policy.eligible({...valid,...patch}),false);
});
test('fixture writes one synthetic category, is idempotent, and rejects a wrong database before writing', async () => {
    const target=client();
    assert.deepEqual(await prepare(target,FakeId),{inserted:1,existing:0});
    assert.deepEqual(await prepare(target,FakeId),{inserted:0,existing:1});
    assert.equal(target.events.filter(value=>value==='insert').length,1);
    assert.equal(FIXTURE.prefix,'_TEST_5025_');
    const wrong=client('payrollDB');
    await assert.rejects(prepare(wrong,FakeId),/ISOLATED_TARGET_REJECTED/);
    assert.deepEqual(wrong.events,[]);
});
test('environment flags cannot activate the mode; actual bootstrap and two verified clients are required', async t => {
    await assert.rejects(policy.activate({clients:[client(),client()]}),/ISOLATED_RUNTIME_REJECTED/);
    const argv=process.argv, previous={...process.env};
    t.after(()=>{ process.argv=argv; for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,previous); });
    process.argv=[process.execPath,valid.entry];
    Object.assign(process.env,{NODE_ENV:'development',HOST:'127.0.0.1',PORT:'5025'});
    const first=client(),second=client();
    await policy.activate({clients:[first,second]});
    assert.equal(policy.automaticTasksEnabled(),false);
    assert.equal(first.events.length,1);assert.equal(second.events.length,1);
    assert.equal(policy.isolatedCacheDirectory(),path.join(ROOT,'.cache/isolated-atlas/pdf-cache'));
});

function loadService(filename, enabled) {
    const events={intervals:0,startupReads:0,sync:0,load:0,signals:0};
    const policyMock={automaticTasksEnabled:()=>enabled,isolatedCacheDirectory:()=>enabled?null:'/synthetic/test-cache'};
    const fsMock={promises:{},mkdirSync(){},readdirSync(){events.startupReads++;return[];},async ensureDir(){}};
    const log={info(){},warn(){},error(){}};
    const module={exports:{}};
    const context={module,exports:module.exports,__dirname:path.dirname(filename),console:{log(){},error(){}},
        process:{env:{},on(){events.signals++;}},setInterval(){events.intervals++;return{unref(){}};},
        clearInterval(){},setTimeout(){throw Error('Unexpected expiry timer');},clearTimeout(){},
        require(name) {
            if(name.includes('isolatedTestRuntime'))return policyMock;
            if(name==='fs'||name==='fs-extra')return fsMock;
            if(name==='os')return{tmpdir:()=>'/synthetic/default-cache'};
            if(name==='playwright')return{chromium:{}};
            if(name==='./logger')return log;
            if(name==='./s3Helper')return{USE_LOCAL_STORAGE:true};
            if(name==='@aws-sdk/client-s3')return{S3Client:class{}};
            return require(name);
        }};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),context,{filename});
    return {exports:module.exports,events};
}
for(const enabled of [false,true]) {
    test(`session manager starts maintenance only when enabled=${enabled}`,()=>{
        const result=loadService(path.join(ROOT,'server/utils/erganh/sessionManager.js'),enabled);
        assert.equal(result.events.intervals,enabled?1:0);
        assert.equal(result.events.signals,enabled?2:0);
    });
    test(`PDF cache startup cleanup and timers respect enabled=${enabled}`,()=>{
        const result=loadService(path.join(ROOT,'server/services/ergazomenoi/employmentReviewPdfCacheService.js'),enabled);
        assert.equal(result.events.intervals,enabled?1:0);
        assert.equal(result.events.startupReads,enabled?1:0);
        if(!enabled)assert.equal(result.exports.employmentReviewPdfCache.cacheDir,'/synthetic/test-cache');
    });
    test(`text cache automatic sync and refresh respect enabled=${enabled}`,async()=>{
        const result=loadService(path.join(ROOT,'server/utils/textCacheManager.js'),enabled);
        result.exports.syncFromS3=async()=>{result.events.sync++;};
        result.exports.loadToMemory=async()=>{result.events.load++;};
        await result.exports.initialize();
        assert.equal(result.events.sync,enabled?1:0);
        assert.equal(result.events.load,enabled?1:0);
        assert.equal(result.events.intervals,enabled?1:0);
        if(!enabled){result.exports.startAutoRefresh();assert.equal(result.events.intervals,0);}
    });
}
