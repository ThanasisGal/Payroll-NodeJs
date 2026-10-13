'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
test('production selection, daily read, weekly scope and writes honor dated lender ownership', {
    skip: !uri || !vendor, timeout: 60000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z') });
    t.after(() => t.mock.timers.reset());
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const prefix = `http://127.0.0.1:${server.address().port}/api/prodhlomena-oraria/review`;
    const query = new URLSearchParams({ apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30',
        ypokatasthma: '0000', kodikos: '0039' });
    await data.E.updateOne({ _id: data.employee._id }, { $set: {
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-01-01'), hmnia_lhxhs_daneismoy: new Date('2027-12-31') } });
    let response = await fetch(`${prefix}?${query}`);
    let result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.rows.length, 0);
    assert.equal(result.total, 0);
    assert.equal(result.canonicalLifecycleProjections.length, 0);
    const selection = new URLSearchParams({ apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30',
        ypokatasthma: '0000', value: '0039' });
    result = await (await fetch(`${prefix}/employees?${selection}`)).json();
    assert.deepEqual(result.items, []);

    await data.E.updateOne({ _id: data.employee._id }, { $set: {
        hmnia_enarxhs_daneismoy: new Date('2026-09-10'), hmnia_lhxhs_daneismoy: new Date('2026-09-20') } });
    const before = await data.snapshot();
    response = await fetch(`${prefix}?${query}`);
    result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.ok(result.rows.length > 0);
    assert.ok(result.rows.every(row => {
        const date = row.hmeromhnia.slice(0, 10);
        return date < '2026-09-10' || date > '2026-09-20';
    }));
    const weekly = await (await fetch(`${prefix}/weekly-hr-workflow/stage1?${new URLSearchParams(data.scope)}`)).json();
    assert.deepEqual(weekly.employment_date_scope.authoritative_date_set,
        ['2026-09-07', '2026-09-08', '2026-09-09']);
    const forbidden = data.rows.find(row => row.hmeromhnia.toISOString().slice(0, 10) === '2026-09-12');
    response = await fetch(`${prefix}/weekly-hr-workflow/stage1/bulk-classify-days`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30',
            reason: 'Συνθετικός έλεγχος απαγόρευσης', changes: [{ row_id: String(forbidden._id), classification: 'ABSENCE' }] }) });
    result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.saved_count, 0);
    assert.equal(result.failed_count, 1);
    assert.equal(result.results[0].code, 'EMPLOYMENT_REVIEW_DATE_OUTSIDE_EMPLOYMENT');
    assert.equal(await data.snapshot(), before);
    // The same dated agreement on the borrowing side exposes only its interval.
    await data.E.updateOne({ _id: data.employee._id }, { $set: { typos_ergodoth_daneismoy: true } });
    const borrowerBefore = await data.snapshot();
    result = await (await fetch(`${prefix}?${query}`)).json();
    assert.ok(result.rows.length > 0);
    assert.ok(result.rows.every(row => {
        const date = row.hmeromhnia.slice(0, 10);
        return date >= '2026-09-10' && date <= '2026-09-20';
    }));
    const borrowedWeek = await (await fetch(`${prefix}/weekly-hr-workflow/stage1?${new URLSearchParams(data.scope)}`)).json();
    assert.deepEqual(borrowedWeek.employment_date_scope.authoritative_date_set,
        ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
    assert.equal(await data.snapshot(), borrowerBefore);
    assert.equal(mongoose.get('sanitizeFilter'), true);
});
