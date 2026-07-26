'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const programmata = fs.readFileSync(path.join(__dirname, 'programmataController.js'), 'utf8');
const erganh = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

for (const method of [
    'getAllErgazomenoi',
    'getErgazomeno',
    'postOrariaUpdate',
    'deleteOrariaErgazomenoyApoEos',
    'antigrafhProgrammaton',
    'getOraria'
]) {
    const start = programmata.indexOf(`static ${method}`);
    assert.ok(start >= 0, `${method} missing`);
    const next = programmata.indexOf('\n    static ', start + 10);
    const block = programmata.slice(start, next < 0 ? programmata.length : next);
    assert.ok(block.includes('req.programmataAccessScope'), `${method} does not use canonical scope`);
}

const getOrariaStart = programmata.indexOf('static getOraria');
const getOrariaBlock = programmata.slice(getOrariaStart);
assert.ok(getOrariaBlock.includes('getErganiCredsFromPasswordsModel'));
assert.ok(!getOrariaBlock.includes('} = req.body'));

const calcStart = erganh.indexOf('static calcApasxolhseisPeriodoy');
const calcEnd = erganh.indexOf('\n    static ', calcStart + 10);
const calc = erganh.slice(calcStart, calcEnd);
assert.ok(calc.includes('req.programmataAccessScope'));
assert.ok(calc.includes('team: sessionTeam'));
assert.ok(calc.includes('company_kod: companyId'));
assert.ok(calc.includes('kodikos: rec.kodikos'));

console.log('PASS programmata controllers consume canonical scope and server credentials');
