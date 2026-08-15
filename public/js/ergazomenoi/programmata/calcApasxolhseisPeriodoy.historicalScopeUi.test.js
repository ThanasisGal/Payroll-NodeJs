'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'calcApasxolhseisPeriodoy.js'), 'utf8');

async function run(effectiveMode, employeeCode) {
    let handler;
    const fetchCalls = [];
    const swalCalls = [];
    const elements = {
        calcApasxolhseonButton: { addEventListener(event, callback) { assert.equal(event, 'click'); handler = callback; } },
        apo_hmeromhnia: { value: '2026-06-01' }, eos_hmeromhnia: { value: '2026-06-30' },
        ypokatasthmata_stathera: { value: '0000' }, xronosProetoimasias_stathera: { value: '0' },
        proorhApoxorhsh_stathera: { value: '0' }, kodikos: { value: employeeCode }
    };
    const context = {
        document: { getElementById: id => elements[id] || null,
            querySelector: () => ({ value: 'csrf' }) },
        fetch: async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return { ok: true, async json() { return { success: true,
                effective_mode: effectiveMode, past_deadline: effectiveMode !== 'NORMAL' }; } };
        },
        Swal: { async fire(options) { swalCalls.push(options); return { isConfirmed: false }; } },
        console
    };
    vm.runInNewContext(source, context);
    await handler();
    return { fetchCalls, swalCalls };
}

(async () => {
    const blocked = await run('HISTORICAL_RECONSTRUCTION_STALE', '0014');
    assert.equal(blocked.fetchCalls.length, 1);
    assert.equal(blocked.fetchCalls[0].options.method, undefined);
    assert.equal(blocked.swalCalls.length, 1);
    assert.match(blocked.swalCalls[0].text, /Αδειάστε το πεδίο Κωδικός/);
    assert.ok(!blocked.fetchCalls.some(call => call.url.includes('/historical-reconstruction/authorize')));

    const periodWide = await run('HISTORICAL_RECONSTRUCTION_REQUIRED', '');
    assert.equal(periodWide.fetchCalls.length, 1);
    assert.equal(periodWide.swalCalls.length, 1);
    assert.equal(periodWide.swalCalls[0].input, 'textarea');

    console.log('historical calculation scope UI safety tests: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
