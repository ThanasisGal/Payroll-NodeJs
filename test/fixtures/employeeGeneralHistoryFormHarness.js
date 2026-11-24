'use strict';

// Reuse the actual controller mapping and the existing isolated transaction
// store, without modifying the already staged regression suite. The ERGANI
// double checks the expected workweek of THIS scenario, never a fixed six days.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const filename = path.resolve(__dirname, '../../server/controllers/ergazomenoi/employeeApprovedHistoryFullForm.controller.test.js');
let source = fs.readFileSync(filename,'utf8');
const boundary = source.indexOf("\ntest('Συνθετικό auditModel.find:");
assert.ok(boundary > 0);
source = source.slice(0,boundary);
const signature = 'independent = false, alter = () => {} } = {})';
const weekAssertion = 'assert.equal(db.state().employees[0].hmeres_ergasias_ebdomadas,6);';
assert.equal(source.split(signature).length,2);
assert.equal(source.split(weekAssertion).length,2);
source = source.replace(signature,'independent = false, expectedErganiDays = 5, alter = () => {} } = {})')
    .replace(weekAssertion,'assert.equal(db.state().employees[0].hmeres_ergasias_ebdomadas,expectedErganiDays);');
const harness = new Module(filename,module);
harness.filename=filename;harness.paths=Module._nodeModulePaths(path.dirname(filename));
const originalRequire=harness.require.bind(harness);
harness.require=name=>name==='node:test'?{before(){},after(){},mock:{}}:originalRequire(name);
harness._compile(source+'\nmodule.exports={harness,fullForm};',filename);
module.exports=harness.exports;
