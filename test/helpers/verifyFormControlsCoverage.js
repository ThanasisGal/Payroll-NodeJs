'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function verifyCoverageDirectory(directory) {
    let reference,completed=[];
    for(let id=0;id<8;id++){
        const dir=path.join(directory,`form-controls-coverage-${id}`);
        const plan=JSON.parse(fs.readFileSync(path.join(dir,'shard-plan.json'),'utf8'));
        const result=JSON.parse(fs.readFileSync(path.join(dir,'shard-completed.json'),'utf8'));
        if(!reference)reference=plan;
        assert.deepEqual(plan,reference,'All shards must use the same real inventory plan');
        assert.equal(result.shard,id);
        const expected=plan.find(s=>s.id===id).units.map(u=>u.key).sort();
        assert.deepEqual([...result.completed].sort(),expected,`Shard ${id} must complete every assigned section`);
        completed.push(...result.completed);
    }
    const expected=reference.flatMap(s=>s.units.map(u=>u.key)).sort();
    assert.deepEqual(completed.sort(),expected);
    assert.equal(new Set(completed).size,expected.length,'A section cannot be completed by multiple shards');
    return {shards:8,sections:completed.length,templates:new Set(reference.flatMap(s=>s.units.map(u=>u.template))).size};
}
if(require.main===module)console.log(JSON.stringify(verifyCoverageDirectory(process.argv[2])));
module.exports={verifyCoverageDirectory};
