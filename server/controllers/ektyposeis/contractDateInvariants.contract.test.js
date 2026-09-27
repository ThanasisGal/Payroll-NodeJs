'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllers = [
    'symbaseis/ektyposhSymbaseonController.js',
    'apasxolhseis/ektyposhApasxolhseonController.js'
];

for (const relativePath of controllers) {
    test(`${relativePath} blocks contradictory contract dates before duration rendering`, () => {
        const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
        const validation = source.indexOf('validateContractDateInvariants(symbash);');
        const duration = source.indexOf('calculateMonthsDifference(', validation);

        assert.ok(validation >= 0);
        assert.ok(duration > validation);
        assert.match(source, /String\(error\?\.code \|\| ''\)\.startsWith\('CONTRACT_'\)/);
        assert.match(source, /message: error\.message/);
    });
}
