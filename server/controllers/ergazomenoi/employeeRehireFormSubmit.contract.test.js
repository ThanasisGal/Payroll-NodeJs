'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, 'ergazomenoiController.js'),
    'utf8'
);

assert.match(
    source,
    /writeEmployeeEmploymentProfile, writeEmployeeDeparture, writeEmployeeDepartureCancellation, writeEmployeeRehire, writeEmployeeEmploymentHistoryOperations/
);

const start = source.indexOf('static postErgazomenoiUpdate');
const end = source.indexOf('static getErgazomenosById', start);
assert(start >= 0 && end > start);
const handler = source.slice(start, end);

assert.match(
    handler,
    /filesToUpdate, rehireIntent = false, rehireDate = null/
);
assert.match(handler, /const result = rehireIntent === true/);
assert.match(handler, /await writeEmployeeRehire\(\{/);
assert.match(
    handler,
    /rehireDate: rehireDate \|\| formData\.hmeromhnia_proslhpshs/
);
assert.match(handler, /employeeChanges: filteredDataErgazomenoi/);
assert.match(
    handler,
    /historyChanges: \{\s*\.\.\.updateFieldsIstoriko,\s*afora_proslhpsh: true/
);
assert.match(handler, /input: profileInput\(formData, 'edit'\)/);
assert.match(handler, /: await writeEmployeeEmploymentProfile\(\{/);
assert.match(handler, /startsWith\('EMPLOYEE_REHIRE_'\)/);

console.log('PASS rehire final-submit controller contract');
