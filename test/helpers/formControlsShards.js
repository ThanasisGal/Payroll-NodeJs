'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { render } = require('../fixtures/responsiveForms');

const SHARD_COUNT = 8;
// CI Add: 232 s / 62 Tom controls; local Edit: 241 s / 63 controls.
// Budget four seconds/control, plus document/native-control overhead. The
// heaviest section has 41 controls (~170 s), below the 300 s section deadline.
const SECTION_TIMEOUT = 300000;
const SHARD_TIMEOUT = 480000;
async function inspectInventory() {
    const pages=inventory.templates.filter(f=>f.kind==='page');
    const html=await Promise.all(pages.map(async f=>({template:f.template,html:await render(f.template)})));
    const browser=await chromium.launch({headless:true});
    try {
        const page=await browser.newPage();await page.route('**/*',r=>r.abort());
        return await page.evaluate(pages=>pages.map(({template,html})=>{
            // Inert documents: real rendered EJS structure, no startup/write handlers.
            const doc=new DOMParser().parseFromString(html,'text/html');
            const sections=[...doc.querySelectorAll('.sections > section')];
            const shared=[...doc.querySelectorAll('select.tom-dropdown')].filter(e=>!e.closest('.sections > section')).length;
            return {template,sections:Math.max(1,sections.length),units:(sections.length?sections:[doc]).map((section,index)=>({
                template,section:index,tom:section.querySelectorAll('select.tom-dropdown').length+(sections.length?shared:0),
                native:section.querySelectorAll('select:not(.tom-dropdown)').length
            }))};
        }),html);
    } finally {await browser.close();}
}
function buildPlan(pages) {
    const shards=Array.from({length:SHARD_COUNT},(_,id)=>({id,estimatedMs:0,units:[]}));
    const units=pages.flatMap(p=>p.units.map(u=>({...u,sections:p.sections,modalOwner:u.section===p.sections-1,key:`${u.template}#${u.section}`,
        estimatedMs:1000+4000*u.tom+100*u.native})));
    for(const unit of units.sort((a,b)=>b.estimatedMs-a.estimatedMs||a.key.localeCompare(b.key))){
        const shard=[...shards].sort((a,b)=>a.estimatedMs-b.estimatedMs||a.id-b.id)[0];
        shard.units.push(unit);shard.estimatedMs+=unit.estimatedMs;
    }
    for(const shard of shards)shard.units.sort((a,b)=>a.key.localeCompare(b.key));
    assertCoverage(pages,shards);
    return shards;
}
function assertCoverage(pages,shards) {
    assert.deepEqual(pages.map(p=>p.template).sort(),inventory.templates.filter(p=>p.kind==='page').map(p=>p.template).sort());
    const expected=pages.flatMap(p=>Array.from({length:p.sections},(_,section)=>`${p.template}#${section}`)).sort();
    const assigned=shards.flatMap(s=>s.units.map(u=>u.key)).sort();
    assert.deepEqual(assigned,expected,'Every real template/section must belong to exactly one shard');
    assert.equal(new Set(assigned).size,assigned.length,'Duplicate section assignment');
    assert.deepEqual(shards.map(s=>s.id),Array.from({length:SHARD_COUNT},(_,i)=>i));
    assert.ok(shards.every(s=>s.units.length),'Empty shard');
    for(const unit of shards.flatMap(s=>s.units)){
        assert.equal(unit.key,`${unit.template}#${unit.section}`);
        assert.ok(Number.isInteger(unit.section)&&unit.section>=0&&unit.section<unit.sections);
    }
    for(const page of pages){
        const owners=shards.flatMap(s=>s.units).filter(u=>u.template===page.template&&u.modalOwner);
        assert.equal(owners.length,1,'Modal actions must run exactly once per page');
        assert.equal(owners[0].section,page.sections-1,'Preserve the original final-section modal state');
    }
}
function progressReport(t,shard,unit,dir) {
    const start=performance.now(),state={shard,template:unit.template,section:unit.section,status:'running',phase:'load',field:null,failures:[]};
    const file=dir&&path.join(dir,unit.key.replace(/[^\w.-]/g,'_')+'-progress.json');
    function write(){state.durationMs=Math.round(performance.now()-start);if(file){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,JSON.stringify(state,null,2));}}
    write();
    t.after(()=>{if(state.status==='running')state.status=t.signal.aborted?'cancelled':'failed';write();t.diagnostic(JSON.stringify(state));});
    return {at(phase,field=null){state.phase=phase;state.field=field;write();},
        fail(error,field=state.field){state.failures.push({phase:state.phase,field,error});write();},
        complete(){state.status='passed';state.phase='complete';write();console.log('FORM_CONTROL_COMPLETE',JSON.stringify(state));}};
}
module.exports={SHARD_COUNT,SECTION_TIMEOUT,SHARD_TIMEOUT,inspectInventory,buildPlan,assertCoverage,progressReport};
