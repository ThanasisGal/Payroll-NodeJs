'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./employeeHistorySettlementDevActivation');
const root = '/home/thanasis/Projects/Payroll-NodeJs';
const allowed = { environment: 'development', argv: ['node','app.js',`--employee-history-settlement-dev=${root}:5000`], root, cwd: root, port: 5000, ci: false };
test('only an explicit root-bound startup argument on development port 5000 qualifies',()=>assert.equal(P.eligible(allowed),true));
for (const patch of [{argv:['node','app.js']},{argv:[...allowed.argv,...allowed.argv.slice(2)]},{argv:[...allowed.argv,'--employee-history-settlement-dev']},{argv:[...allowed.argv,null]},{port:5015},{port:80},{port:'5000'},
    {environment:'production'},{environment:'test'},{environment:undefined},{ci:true},{root:'/tmp/other',cwd:'/tmp/other'},
    {cwd:'/tmp/other'},{argv:['node','other.js',allowed.argv[2]]},{argv:['node','app.js','--employee-history-settlement-dev=true']}])
    test(`activation fails closed for ${JSON.stringify(patch)}`,()=>assert.equal(P.eligible({...allowed,...patch}),false));
test('browser, headers, query and role cannot issue a server capability',()=>{
    assert.equal(P.getEmployeeHistorySettlementDevHandle({headers:{host:'localhost:5000'},query:{enabled:true},session:{privileges:'A'},socket:{localPort:5000}}),null);
    assert.equal(P.runtimeSettlementContext({}),null);
});
