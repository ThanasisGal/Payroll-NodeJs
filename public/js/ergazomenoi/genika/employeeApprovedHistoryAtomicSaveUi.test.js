'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const UI = require('./employeeApprovedHistoryAtomicSaveUi');
const employeeId = '650000000000000000000010';
const historyId = '650000000000000000000011';
const t5 = { hmeres_ergasias_ebdomadas:5, typos_ebdomadas:'5HMERH',
    ores_ergasias_ebdomadas:40, mo_oron_hmerhsias_ergasias:8 };
const t6 = { hmeres_ergasias_ebdomadas:6, typos_ebdomadas:'6HMERH',
    ores_ergasias_ebdomadas:40, mo_oron_hmerhsias_ergasias:6.67 };
const node = terms => ({ dataset: {
    atomicDays:String(terms.hmeres_ergasias_ebdomadas),
    atomicWeek:terms.typos_ebdomadas,
    atomicHours:String(terms.ores_ergasias_ebdomadas),
    atomicDaily:String(terms.mo_oron_hmerhsias_ergasias)
} });
const context = t => ({success:true,contextOnly:true,currentTerms:t,
    targetHistoryId:historyId,effectiveFrom:'2026-11-23',pendingHistory:false});
const response = (body, status=200) => ({ok:status>=200&&status<300,status,
    async json(){return body;}});
function harness({ initial=t5, next=t6, actions={}, pendingHistory=false, answers,
    responses, isRehire=false, isTemporary=false, pendingAttachments=false, reload=()=>{} }={}) {
    const calls=[], dialogs=[];
    const prompts = answers || [{isConfirmed:true,value:'NEW_CHANGE'},
        {isConfirmed:true,value:'2026-11-23'}, {isConfirmed:true}];
    const mockAnswers = [...prompts];
    const swal={async fire(opts){dialogs.push(opts);
        if(['Είδος ιστορικής ενέργειας','Ημερομηνία ισχύος της πραγματικής μεταβολής','Υπογεγραμμένη επιβεβαίωση'].includes(opts.title))
            return mockAnswers.shift() || {isConfirmed:false};
        return {isConfirmed:true}; }};
    const baseResponses = responses || [response(context(initial)),
        response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT',approval:'SIGNED'}),
        response({success:true,employeeUpdated:true,historyUpdated:true,auditId:'audit-1'})];
    const queue=[...baseResponses];
    const fetcher=async(url,opts)=>{calls.push({url,opts,body:JSON.parse(opts.body)});
        if (!queue.length) throw Error('Unexpected HTTP call'); return queue.shift();};
    const args={formData:{...next},baselineNode:node(initial),employeeId,csrfToken:'csrf-synthetic',
        selectedActions:actions,pendingHistory,isRehire,isTemporary,pendingAttachments,swal,fetcher,reload};
    return {calls,dialogs,args,client:UI.createClient()};
}

test('No change: original Save owns the request, no new HTTP route used', async()=>{
    const h=harness({next:t5});assert.deepEqual(await h.client.tryHandle(h.args),{handled:false});
    assert.equal(h.calls.length,0);assert.equal(h.dialogs.length,0);
});
test('Valid actual 5→6: context, preview and signed apply exactly once', async()=>{
    let reloaded=0;const h=harness({reload:()=>reloaded++});
    const r=await h.client.tryHandle(h.args);assert.equal(r.saved,true);
    assert.deepEqual(h.calls.map(c=>c.url.split('-').at(-1)),['context','preview','apply']);
    for(const item of h.calls) {assert.equal(item.opts.method,'POST');
        assert.equal(item.opts.credentials,'include');assert.equal(item.opts.headers['CSRF-Token'],'csrf-synthetic');}
    const preview=h.calls[1].body;assert.deepEqual(Object.keys(preview),['change']);
    assert.deepEqual(preview.change,{kind:'NEW_CHANGE',effectiveFrom:'2026-11-23',correctedTerms:t6});
    assert.deepEqual(h.calls[2].body,{change:preview.change,approval:{token:'SIGNED',confirmed:true}});
    assert.equal(reloaded,1);
    const again=await h.client.tryHandle(h.args);assert.equal(again.skipped,true);
    assert.equal(h.calls.length,3);assert.equal(reloaded,1);
});
test('Mistaken saved 6→5: exact same period and target; no invented second event', async()=>{
    const h=harness({initial:t6,next:t5,answers:[{isConfirmed:true,value:'CORRECT_SAVED_ERROR'},
        {isConfirmed:true}] ,responses:[response(context(t6)),
            response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT',approval:'SIGNED'}),
            response({success:true,employeeUpdated:true,historyUpdated:true,auditId:'audit-2'})]});
    const r=await h.client.tryHandle(h.args);assert.equal(r.saved,true);
    assert.deepEqual(h.calls[1].body.change,{
        kind:'CORRECT_SAVED_ERROR',effectiveFrom:'2026-11-23',correctedTerms:t5,targetHistoryId:historyId });
    assert.equal(h.calls.some(c=>c.url.includes('update/')),false);
});
test('Pending history: changed work terms do not create a second event; no HTTP',async()=>{
    const h=harness({pendingHistory:true});const r=await h.client.tryHandle(h.args);
    assert.equal(r.handled,true);assert.equal(r.saved,false);assert.equal(h.calls.length,0);
});
test('External ERGANI/documents: do not run either Save branch or any external action',async()=>{
    const h=harness({actions:{isPermanent:true,erganiUploadMethod:'rest',wto_pshfiakh_organosh_xronoy_ergasias:true}});
    const r=await h.client.tryHandle(h.args);assert.equal(r.handled,true);
    assert.equal(r.saved,false);assert.equal(h.calls.length,0);
});
test('Pending attachments cannot be silently omitted',async()=>{
    const h=harness({pendingAttachments:true});assert.equal((await h.client.tryHandle(h.args)).saved,false);
    assert.equal(h.calls.length,0);
});
test('Temporary/re-hire bypass blocked, independent ordinary Save remains untouched',async()=>{
    for (const flags of [{isTemporary:true},{isRehire:true}]) {
        const h=harness(flags);assert.equal((await h.client.tryHandle(h.args)).saved,false);
        assert.equal(h.calls.length,0);
    }
});
test('Incompatible working-hours, fake week type, invalid days: fail closed before HTTP',async()=>{
    const bad=[{...t6,mo_oron_hmerhsias_ergasias:7},
        {...t6,typos_ebdomadas:'5HMERH'}, {...t6,hmeres_ergasias_ebdomadas:7},
        {...t6,ores_ergasias_ebdomadas:0}];
    for (const next of bad) { const h=harness({next});
        assert.equal((await h.client.tryHandle(h.args)).saved,false);assert.equal(h.calls.length,0); }
});
test('Permits expected 6 × 6.67 = 40.02 tolerance',()=>{
    assert.deepEqual(UI.validTerms(t6),t6);
    assert.equal(UI.validTerms({...t6, mo_oron_hmerhsias_ergasias:6.68}),null);
});
test('Context read is authoritative; EJS stale baseline cannot be used for write',async()=>{
    const h=harness({responses:[response(context(t6))]});
    assert.equal((await h.client.tryHandle(h.args)).saved,false);
    assert.deepEqual(h.calls.map(x=>x.url.split('-').at(-1)),['context']);
});
test('Default-off 423: no normal fallback or apply',async()=>{
    const h=harness({responses:[response({success:false,saved:false,code:'EMPLOYEE_APPROVED_ATOMIC_DISABLED'},423)]});
    const r=await h.client.tryHandle(h.args);assert.equal(r.handled,true);
    assert.equal(r.saved,false);assert.equal(h.calls.length,1);
});
test('Unresolved server pending history stops before preview',async()=>{
    const h=harness({responses:[response({...context(t5),pendingHistory:true})]});
    assert.equal((await h.client.tryHandle(h.args)).saved,false);assert.equal(h.calls.length,1);
});
test('User cancellation at decision, date, or final approval never applies changes',async()=>{
    for (const answers of [[{isConfirmed:false}],
        [{isConfirmed:true,value:'NEW_CHANGE'},{isConfirmed:false}],
        [{isConfirmed:true,value:'NEW_CHANGE'},{isConfirmed:true,value:'2026-11-23'}, {isConfirmed:false}]]) {
        const h=harness({answers});const r=await h.client.tryHandle(h.args);
        assert.equal(r.cancelled,true);assert.equal(h.calls.filter(x=>x.url.endsWith('-apply')).length,0);
    }
});
test('Malformed date is rejected without preview/write', async()=>{
    const h=harness({answers:[{isConfirmed:true,value:'NEW_CHANGE'},
        {isConfirmed:true,value:'2026-02-30'}]});
    assert.equal((await h.client.tryHandle(h.args)).saved,false);assert.equal(h.calls.length,1);
    assert.equal(UI.exactDay('2026-02-30'),false);
});
test('No signed approval: do not attempt apply or infer success',async()=>{
    const h=harness({responses:[response(context(t5)),response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT'})]});
    assert.equal((await h.client.tryHandle(h.args)).saved,false);assert.equal(h.calls.length,2);
});
test('Uncertain commit: never retry, no success and no reload',async()=>{
    let refreshed=0;const h=harness({reload:()=>refreshed++, responses:[response(context(t5)),
        response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT',approval:'SIGNED'}),
        response({success:false,saved:null,outcome:'UNKNOWN',message:'UNKNOWN'},503)]});
    assert.equal((await h.client.tryHandle(h.args)).outcome,'UNKNOWN');assert.equal(refreshed,0);
    assert.equal((await h.client.tryHandle(h.args)).skipped,true);assert.equal(h.calls.length,3);
});
test('Network failure never falls back to legacy Save or repeats external actions',async()=>{
    const h=harness({responses:[]});const r=await h.client.tryHandle(h.args);
    assert.equal(r.handled,true);assert.equal(h.calls.length,1);assert.equal(r.outcome,'NOT_APPLIED');
});
test('No comparable baseline: block unsafe legacy fallback for changed terms',async()=>{
    const h=harness();h.args.baselineNode={dataset:{}};
    const result=await h.client.tryHandle(h.args);
    assert.equal(result.handled,true);assert.equal(result.saved,false);assert.equal(h.calls.length,0);
});


test('Malformed apply response is UNKNOWN, never a safe retry or success',async()=>{
    const h=harness({responses:[response(context(t5)),
        response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT',approval:'SIGNED'}),
        response({success:true,employeeUpdated:true,historyUpdated:true})]});
    const r=await h.client.tryHandle(h.args);assert.equal(r.outcome,'UNKNOWN');
    assert.equal((await h.client.tryHandle(h.args)).skipped,true);
    assert.equal(h.calls.length,3);
});
test('Confirmed commit remains successful if the success dialog fails',async()=>{
    let reloaded=0;const h=harness({reload:()=>reloaded++});
    const old=h.args.swal.fire;
    h.args.swal.fire=async(opts)=>{
        if(opts.title==='Η ιστορική μεταβολή αποθηκεύτηκε') throw Error('UI presentation broken');
        return old(opts);
    };
    assert.equal((await h.client.tryHandle(h.args)).saved,true);
    assert.equal(reloaded,1);
    assert.equal((await h.client.tryHandle(h.args)).skipped,true);
});


test('PR406 actual 0002 screen: missing stored week, recorded 5-day contract, no change uses normal save',async()=>{
 const initial={...t5,typos_ebdomadas:''};
 const h=harness({initial,next:{...initial,apasxolhsh_basei_symbashs:'5',apasxolhsh_basei_symbashs_stathera:'5'}});
 h.args.baselineNode.dataset.atomicContract='5';
 assert.deepEqual(UI.baselineFromNode(h.args.baselineNode).typos_ebdomadas,'');
 const r=await h.client.tryHandle(h.args);
 assert.equal(r.handled,false);assert.equal(h.calls.length,0);
});
test('PR406 actual 0002 screen: 5->6 with contract=6 reaches signed atomic route',async()=>{
 const initial={...t5,typos_ebdomadas:''};
 const h=harness({initial,next:{...t6,typos_ebdomadas:'',apasxolhsh_basei_symbashs:'6',apasxolhsh_basei_symbashs_stathera:'6'},
  responses:[response({...context(initial),currentContract:'5'}),
   response({success:true,previewOnly:true,status:'READY_FOR_SIGNED_ATOMIC_COMMIT',approval:'signed'}),
   response({success:true,employeeUpdated:true,historyUpdated:true,auditId:'audit'})]});
 h.args.baselineNode.dataset.atomicContract='5';
 const r=await h.client.tryHandle(h.args);
 assert.equal(r.saved,true);assert.equal(h.calls.length,3);
 assert.deepEqual(h.calls[1].body.change.correctedTerms,t6);
});
test('PR406 0002 mismatch: 6 days but contract remains 5 cannot call any HTTP endpoint',async()=>{
 const initial={...t5,typos_ebdomadas:''};
 const h=harness({initial,next:{...t6,typos_ebdomadas:'',apasxolhsh_basei_symbashs:'5',apasxolhsh_basei_symbashs_stathera:'5'}});
 h.args.baselineNode.dataset.atomicContract='5';
 assert.equal((await h.client.tryHandle(h.args)).saved,false);
 assert.equal(h.calls.length,0);assert.equal(h.dialogs[0].title,'Ασυνεπείς ημέρες και ώρες');
});
test('PR406 0002 missing contract proof: changed days never use legacy Save',async()=>{
 const initial={...t5,typos_ebdomadas:''};
 const h=harness({initial,next:{...t6,typos_ebdomadas:''}});
 assert.equal(UI.baselineFromNode(h.args.baselineNode),null);
 const result=await h.client.tryHandle(h.args);
 assert.equal(result.handled,true);assert.equal(result.saved,false);
 assert.equal(h.calls.length,0);
});
test('PR406 0002 stale contract detected from server context before preview',async()=>{
 const initial={...t5,typos_ebdomadas:''};
 const h=harness({initial,next:{...t6,typos_ebdomadas:'',apasxolhsh_basei_symbashs:'6',apasxolhsh_basei_symbashs_stathera:'6'},
  responses:[response({...context(initial),currentContract:'6'})]});
 h.args.baselineNode.dataset.atomicContract='5';
 assert.equal((await h.client.tryHandle(h.args)).saved,false);
 assert.equal(h.calls.length,1);
});
