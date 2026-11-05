'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {SHARD_COUNT,SHARD_TIMEOUT,inspectInventory,buildPlan,assertCoverage,progressReport}=require('../helpers/formControlsShards');
const {verifyCoverageDirectory}=require('../helpers/verifyFormControlsCoverage');
const root=path.resolve(__dirname,'../..');

test('Search queries match the actual displayed API label, including periods without codes',()=>{
    const {catalogFor}=require('../fixtures/tomSelectCatalogs');
    const {queryForVisibleOption}=require('../helpers/tomSelectBrowser');
    for(const api of ['/api/dropdown/periodoi','/api/dropdown/doy','/api/dropdown/ergazomenoi/apasxolhsh_basei_symbashs','/admin/user-privileges/users']){
        const {items}=catalogFor(api),target=items.at(-1),query=queryForVisibleOption(target);
        assert.ok(target.label.includes(query));
        assert.deepEqual(items.filter(o=>o.label.includes(query)).map(o=>o.value),[target.value]);
    }
});

test('Real EJS inventory: every rendered page/section belongs to exactly one bounded shard', {timeout:30000},async()=>{
    const pages=await inspectInventory(),plan=buildPlan(pages);
    assertCoverage(pages,plan);
    assert.ok(plan.every(s=>s.estimatedMs<SHARD_TIMEOUT/2),'Rebalance before a shard approaches its deadline');
    for(const mutate of [p=>p[0].units.pop(),p=>p[0].units.push(p[1].units[0]),p=>p[0].units[0].section=-1,p=>{p.flatMap(s=>s.units).find(u=>u.modalOwner).modalOwner=false;}]){
        const changed=structuredClone(plan);mutate(changed);assert.throws(()=>assertCoverage(pages,changed));
    }
    assert.throws(()=>assertCoverage(pages.slice(1),plan));
    console.log('SHARD_PLAN',JSON.stringify(plan.map(s=>({shard:s.id,sections:s.units.length,estimatedMs:s.estimatedMs}))));

    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'payroll-shard-contract-'));
    try {
        for(const shard of plan){
            const folder=path.join(dir,`form-controls-coverage-${shard.id}`);fs.mkdirSync(folder);
            fs.writeFileSync(path.join(folder,'shard-plan.json'),JSON.stringify(plan));
            fs.writeFileSync(path.join(folder,'shard-completed.json'),JSON.stringify({shard:shard.id,completed:shard.units.map(u=>u.key)}));
        }
        const summary=verifyCoverageDirectory(dir);assert.equal(summary.templates,pages.length);
        assert.equal(summary.sections,pages.reduce((n,p)=>n+p.sections,0));
        const marker=path.join(dir,'form-controls-coverage-0/shard-completed.json'),original=fs.readFileSync(marker,'utf8');
        fs.writeFileSync(marker,JSON.stringify({shard:0,completed:[]}));assert.throws(()=>verifyCoverageDirectory(dir));
        fs.writeFileSync(marker,original);fs.renameSync(marker,marker+'.cancelled');assert.throws(()=>verifyCoverageDirectory(dir));
        fs.renameSync(marker+'.cancelled',marker);
        const duplicate=JSON.parse(original);duplicate.completed.push(duplicate.completed[0]);
        fs.writeFileSync(marker,JSON.stringify(duplicate));assert.throws(()=>verifyCoverageDirectory(dir));
        let finish;
        const report=progressReport({after(fn){finish=fn;},signal:{aborted:false},diagnostic(){}},0,plan[0].units[0],dir);
        report.at('tom-search','synthetic-field');report.fail('synthetic search failure');report.at('table-scroll');finish();
        const failure=JSON.parse(fs.readFileSync(path.join(dir,plan[0].units[0].key.replace(/[^\w.-]/g,'_')+'-progress.json'),'utf8'));
        assert.equal(failure.status,'failed');assert.equal(failure.failures[0].field,'synthetic-field');
        assert.equal(failure.failures[0].phase,'tom-search');assert.ok(failure.durationMs>=0);
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('CI requires all eight shards and rejects failure, cancellation, skipping and missing jobs',()=>{
    const workflow=fs.readFileSync(path.join(root,'.github/workflows/ci-validation.yml'),'utf8');
    const shard=workflow.slice(workflow.indexOf('\n  form-controls:'),workflow.indexOf('\n  employment-review-browser:'));
    assert.match(shard,/fail-fast: false/);assert.match(shard,/shard: \[0, 1, 2, 3, 4, 5, 6, 7\]/);
    assert.doesNotMatch(shard,/continue-on-error/);
    assert.match(shard,/\^Functional controls shard /);
    assert.match(shard,/formControlsSharding\.contract\.test\.js/);
    const validate=workflow.slice(workflow.indexOf('\n  validate:'));
    assert.match(validate,/if: \$\{\{ always\(\) \}\}/);assert.match(validate,/- form-controls\n/);
    assert.match(validate,/verifyFormControlsCoverage\.js/);assert.match(validate,/form-controls-coverage-\*/);
    const code=validate.match(/node - <<'NODE'\n([\s\S]*?)\n          NODE/)[1].replace(/^          /gm,'');
    const names=['static-validation','focused-tests','employee-history-browser','employee-mongodb','employment-review-browser','employee-history-settlement-mongo','form-controls'];
    for(const status of ['success','failure','cancelled','skipped',undefined]){
        const needs=Object.fromEntries(names.map(n=>[n,{result:'success'}]));
        if(status===undefined)delete needs['form-controls'];else needs['form-controls'].result=status;
        const process={env:{NEEDS_JSON:JSON.stringify(needs)},exitCode:0};
        vm.runInNewContext(code,{process,console:{log(){},error(){}}});
        assert.equal(process.exitCode,status==='success'?0:1,String(status));
    }
    assert.equal(SHARD_COUNT,8);
});
