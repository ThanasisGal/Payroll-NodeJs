'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { fixture, browserApp } = require('../helpers/employmentReviewEmployeesApp');
const uri = process.env.PAYROLL_PERIOD_EMPLOYEES_TEST_MONGO_URI;
const baseQuery = { apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', ypokatasthma: '0000' };

test('real MongoDB, sanitizeFilter and HTTP authorization for period selection', { skip: !uri }, async t => {
    const data = await fixture(uri);
    t.after(() => mongoose.disconnect());
    const server = browserApp(data).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const get = (extra = {}, route = '/api/prodhlomena-oraria/review/employees') =>
        fetch(origin + route + '?' + new URLSearchParams({ ...baseQuery, ...extra }));
    const codes = async extra => (await (await get(extra)).json()).items.map(item => item.value);

    await t.test('example 0004/0000/0001 and legacy missing finalization flag', async () => {
        assert.equal(mongoose.get('sanitizeFilter'), true);
        assert.deepEqual(await codes({ search: '0001' }), ['0001']);
        assert.deepEqual(await codes({ value: '0001' }), ['0001']);
        assert.deepEqual(await codes({}), ['0001','0008','0009']);
    });
    await t.test('inclusive real date boundaries and separated rehire cycles', async () => {
        assert.deepEqual(await codes({ search: '0001', apo_hmeromhnia: '2026-10-04', eos_hmeromhnia: '2026-10-04' }), ['0001']);
        assert.deepEqual(await codes({ search: '0001', apo_hmeromhnia: '2026-10-05', eos_hmeromhnia: '2026-10-31' }), []);
        assert.deepEqual(await codes({ search: '0006' }), []);
        assert.deepEqual(await codes({ search: '0006', apo_hmeromhnia: '2026-08-31', eos_hmeromhnia: '2026-08-31' }), ['0006']);
        assert.deepEqual(await codes({ search: '0006', apo_hmeromhnia: '2026-10-10', eos_hmeromhnia: '2026-10-10' }), ['0006']);
    });
    await t.test('legacy duplicate physical records retain separate intervals', async () => {
        assert.deepEqual(await codes({ search:'0010' }), []);
        assert.deepEqual(await codes({ search:'0010', apo_hmeromhnia:'2026-08-31', eos_hmeromhnia:'2026-08-31' }), ['0010']);
        assert.deepEqual(await codes({ search:'0010', apo_hmeromhnia:'2026-10-10', eos_hmeromhnia:'2026-10-10' }), ['0010']);
        assert.deepEqual(await codes({ search:'0010', apo_hmeromhnia:'2026-08-01', eos_hmeromhnia:'2026-10-31' }), ['0010']);
    });
    await t.test('branch changes and scoped preselect never escape company/team/draft rules', async () => {
        assert.deepEqual(await codes({ ypokatasthma: '1' }), ['0007']);
        for (const code of ['0002','0003','0004','0005','0007']) assert.deepEqual(await codes({ value: code }), []);
        assert.equal((await get({ ypokatasthma: '9999' })).status, 404);
    });
    await t.test('malicious and invalid HTTP filters rejected before trusted construction', async () => {
        for (const extra of [{ team:'OTHER' }, { company:String(data.otherCompany) }, { 'search[$ne]':'' },
            { 'ypokatasthma[$ne]':'' }, { '$or[0][team]':'OTHER' }, { filter:'{"$where":"true"}' },
            { apo_hmeromhnia:'2026-02-30' }, { value:'$ne' }, { page:'-1' }, { limit:'5000' }]) {
            assert.equal((await get(extra)).status, 400, JSON.stringify(extra));
        }
        assert.deepEqual(await codes({ search: '.*' }), [], 'regex is escaped, not executed');
        assert.deepEqual(await codes({ search: '$ne' }), []);
    });
    await t.test('real authorization rejects changed team, company and privileges', async () => {
        await data.U.collection.updateOne({ _id: data.actor }, { $set: { team: 'OTHER' } });
        assert.equal((await get()).status, 404);
        await data.U.collection.updateOne({ _id: data.actor }, { $set: { team: 'TEST' } });
        const original = data.session.companyInUse;
        data.session.companyInUse = String(data.otherCompany);
        assert.equal((await get()).status, 404);
        data.session.companyInUse = original;
        await data.V.collection.updateOne({ userId: String(data.actor) }, { $set: { 'privileges.read':false } });
        assert.equal((await get()).status, 403);
        await data.V.collection.updateOne({ userId: String(data.actor) }, { $set: { 'privileges.read':true } });
    });
    await t.test('trusted operators execute with sanitizeFilter; untrusted operator rejected', async () => {
        await assert.rejects(data.E.find({ company_kod: String(data.company), oristikh_enhmerosh: { $ne:false } }).lean(), /Cast to Boolean/);
        const rows = await data.E.find({ team:'TEST', company_kod:String(data.company),
            oristikh_enhmerosh:mongoose.trusted({ $ne:false }),
            ypokatasthma:mongoose.trusted({ $in:['0000','0'] }),
            $or:[{kodikos:'0001'},{kodikos:'0008'}] }).lean();
        assert.deepEqual(rows.map(row=>row.kodikos).sort(), ['0001','0008']);
    });
    await t.test('other forms retain their current active-only/all-employees behavior', async () => {
        const active = await (await get({ search:'0001', energoi:'true' }, '/legacy-employees')).json();
        assert.deepEqual(active.items, []);
        const all = await (await get({ search:'0001', energoi:'false' }, '/legacy-employees')).json();
        assert.deepEqual(all.items.map(item=>item.value), ['0001']);
    });
    await t.test('pagination occurs after temporal exclusions', async () => {
        await data.E.collection.insertMany(Array.from({length:53}, (_,index)=>({ team:'TEST',company_kod:String(data.company),
            ypokatasthma:'0000',kodikos:'P'+String(index).padStart(3,'0'),eponymo:'ΣΕΛΙΔΑ',
            hmeromhnia_proslhpshs:new Date(index===0?'2026-10-01':'2026-09-01') })));
        const first = await (await get({search:'ΣΕΛΙΔΑ'})).json();
        const second = await (await get({search:'ΣΕΛΙΔΑ',page:'2'})).json();
        assert.equal(first.items.length,50);assert.equal(first.totalCount,52);assert.equal(first.hasMore,true);
        assert.equal(second.items.length,2);assert.equal(second.hasMore,false);
        assert.equal(new Set([...first.items,...second.items].map(item=>item.value)).size,52);
    });
});
