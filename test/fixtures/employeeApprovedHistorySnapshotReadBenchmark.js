'use strict';

// One synthetic preview at a time. No application bootstrap, server, URI or DB.
// Usage: node this-file before|after /tmp/report.json [latencyMs=0] [beforePrefix]
// beforePrefix identifies copies of the two services taken before this change.
require('./correction3OfflineGuard.cjs');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../..'), app = Module.createRequire(root + '/package.json');
const [version, output, latency = '0', beforePrefix] = process.argv.slice(2);
const latencyMs = Number(latency);
assert.ok(['before','after'].includes(version) && output && path.isAbsolute(output));
assert.ok(Number.isInteger(latencyMs) && latencyMs >= 0 && latencyMs <= 20);
// Keep physical plans and confirmation bindings comparable across processes.
Date.now = () => +new Date('2026-11-24T12:00:00.000Z');
if (version === 'before') {
    assert.ok(beforePrefix && path.isAbsolute(beforePrefix));
    for (const name of ['employeeApprovedHistoryFormSaveService','employeeEmploymentProfileWriter']) {
        const file = root + '/server/services/ergazomenoi/' + name + '.js';
        const baseline = new Module(file, module);
        baseline.filename = file; baseline.paths = Module._nodeModulePaths(path.dirname(file));
        require.cache[file] = baseline;
        baseline._compile(fs.readFileSync(beforePrefix + name + '.js', 'utf8'), file);
    }
}
const file = root + '/server/controllers/ergazomenoi/employeeApprovedHistoryFullForm.controller.test.js';
const source = fs.readFileSync(file, 'utf8');
const boundary = source.indexOf("\ntest('Συνθετικό auditModel.find:");
assert.ok(boundary > 0, 'Extract only the existing synthetic controller harness');
const harness = new Module(file, module);
harness.filename = file; harness.paths = Module._nodeModulePaths(path.dirname(file));
const localRequire = harness.require.bind(harness);
harness.require = name => name === 'node:test' ? { before() {}, after() {}, mock: {} } : localRequire(name);
harness._compile(source.slice(0, boundary) + '\nmodule.exports = { harness };', file);
const A = app('./server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const median = values => values.slice().sort((a,b) => a-b)[Math.floor(values.length / 2)];

async function main() {
    const h = await harness.exports.harness({ approveCurrent:true, approvedTerms:{eidikothta_symbashs:'01'} });
    const reads = [], preparations = [];
    let phase = 'initial_snapshot', atomicPreparationMs = 0;
    for (const [name, model, method] of [
        ['employee',h.deps.employeeModel,'findOne'], ['history',h.deps.historyModel,'find'],
        ['audit',h.deps.auditModel,'find'], ['actor',h.deps.userModel,'findById'],
        ['privilege',h.deps.privilegeModel,'findOne']
    ]) {
        const original = model[method];
        model[method] = function (...args) {
            const query = original.apply(this,args), lean = query.lean, attach = query.session;
            let session;
            query.session = function (value) { session=value; return attach.call(this,value); };
            query.lean = async function (...options) {
                if (!session) return lean.apply(this,options);
                const started = performance.now();
                if (latencyMs) await new Promise(resolve => setTimeout(resolve,latencyMs));
                const value = await lean.apply(this,options);
                const ended = performance.now();
                reads.push({phase,name,started,ended,durationMs:ended-started});
                return value;
            };
            return query;
        };
    }
    const factory = h.deps.approvedHistoryServiceFactory;
    h.deps.approvedHistoryServiceFactory = options => {
        const service = factory(options);
        return {...service,async prepareEmployeeSave(...args) {
            phase = 'state.1';
            const started = performance.now();
            try {
                const prepared = await service.prepareEmployeeSave(...args);
                preparations.push(A.hash({input:prepared.input,plan:prepared.plan}));
                return prepared;
            } finally { atomicPreparationMs=performance.now()-started; phase='after-preparation'; }
        }};
    };
    const terms={hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67};
    const body=h.payload({...terms,apasxolhsh_basei_symbashs:'6',hmeromhnia_metabolhs:'2026-12-01'});
    body.change={kind:'NEW_CHANGE',effectiveFrom:'2026-12-01',correctedTerms:terms};
    const before=h.db.state(), samples=[];
    for(let sample=0;sample<4;sample++) {
        reads.length=preparations.length=0; phase='initial_snapshot'; atomicPreparationMs=0;
        const started=performance.now(), result=await h.submit(body), durationMs=performance.now()-started;
        assert.equal(result.body.success,true,JSON.stringify(result.body));
        assert.equal(result.body.preflight,true);
        assert.deepEqual(h.db.state(),before);
        assert.deepEqual(h.effects,[]);
        const initialReads=reads.filter(read=>read.phase==='initial_snapshot').length;
        const stateReads=reads.filter(read=>read.phase==='state.1').length;
        assert.equal(initialReads,version==='before'?5:3); assert.equal(stateReads,5);
        const bound=JSON.parse(Buffer.from(result.body.historyConfirmation.split('.')[0],'base64url')).bound;
        if(sample) samples.push({durationMs,initialReads,stateReads,planHash:preparations[0],bound,
            atomicPreparationMs,reads:structuredClone(reads)});
    }
    assert.equal(new Set(samples.map(sample=>sample.planHash)).size,1);
    assert.equal(new Set(samples.map(sample=>sample.bound)).size,1);
    const summary={version,database:false,serial:true,latencyMs,samples:samples.length,
        note:'latencyMs is simulated per read; read spans and timings are synthetic, independent of application diagnostics',
        medianMs:Number(median(samples.map(sample=>sample.durationMs)).toFixed(3)),
        initialReads:samples[0].initialReads,stateReads:samples[0].stateReads,
        planHash:samples[0].planHash,bound:samples[0].bound,
        atomicPreparationMedianMs:Number(median(samples.map(sample=>sample.atomicPreparationMs)).toFixed(3)),
        readSpanMedianMs:Object.fromEntries(['initial_snapshot','state.1'].map(name=>[name,
            Number(median(samples.map(sample=>{
                const selected=sample.reads.filter(read=>read.phase===name);
                return selected.at(-1).ended-selected[0].started;
            })).toFixed(3))]))};
    fs.writeFileSync(output,JSON.stringify({summary,samples},null,2)+'\n');
    console.log(JSON.stringify(summary,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
