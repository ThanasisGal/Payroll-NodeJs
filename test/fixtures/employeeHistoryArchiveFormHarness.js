'use strict';

// Reuse the real full-form HTTP/Mongo harness, without registering its tests.
// Only the outbound document generator is replaced; writer, planners, models,
// authorization, transactions, persisted-state reads and controller stay real.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const filename = path.resolve(__dirname, '../integration/employeeApprovedHistoryFullFormMongo.test.js');
let source = fs.readFileSync(filename, 'utf8');
const boundary = source.indexOf("\ntest('Πλήρης φόρμα 6→5");
assert.ok(boundary > 0);
source = source.slice(0, boundary);
function replace(before, after) {
    assert.equal(source.split(before).length, 2, 'The existing full-form harness seam must match exactly');
    source = source.replace(before, after);
}
replace('async function controller(db, f, { corrupt = false } = {}) {',
    'async function controller(db, f, { corrupt = false } = {}) {\n    const effects = [];');
replace("            throw new Error('Unexpected external dependency: ' + name);", `            if (name.endsWith('/e3_MA_v1Generator')) return { async generateMAXML(employee) {
                const persisted = await db.employeeModel.findById(f.employee._id).lean();
                assert.equal(persisted.thlefono, employee.thlefono);
                effects.push({ type: 'MA_XML', days: persisted.hmeres_ergasias_ebdomadas });
                return { success: true, xml: '<synthetic/>', s3Key: 'synthetic/ma.xml' };
            } };
            throw new Error('Unexpected external dependency: ' + name);`);
replace('return { payload, submit, confirm, plans, reads, requests, errors, results, mutations,',
    'return { payload, submit, confirm, plans, reads, requests, errors, results, mutations, effects,');
const harness = new Module(filename, module);
harness.filename = filename;
harness.paths = Module._nodeModulePaths(path.dirname(filename));
harness._compile(source + '\nmodule.exports = { seed, controller };', filename);
module.exports = harness.exports;
