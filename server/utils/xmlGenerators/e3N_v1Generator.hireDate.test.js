'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateE3NJSON } = require('./e3N_v1Generator');

const employee = {
    eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΔΟΚΙΜΗ', patronymo: 'ΔΟΚΙΜΗ', mhtronymo: 'ΔΟΚΙΜΗ',
    hmeromhnia_gennhshs: '1990-01-01', afm: '000000000', amka: '00000000000',
    adt: 'Α00000000', xronos_katabolhs_apodoxon: 'ΜΗΝΙΑΙΑ', oysiodeis_oroi: '1'
};

async function create(changes) {
    const previous = console.log;
    const previousError = console.error;
    console.log = () => {};
    console.error = () => {};
    try { return await generateE3NJSON({ ...employee, ...changes }, {}, {}); }
    finally { console.log = previous; console.error = previousError; }
}

test('E3N hire date remains independent of WebMA mutation date', async () => {
    const first = await create({ hmeromhnia_proslhpshs: '2026-01-02', hmeromhnia_metabolhs: '2026-09-22' });
    assert.equal(first.payload.AnaggeliesE3N.AnaggeliaE3N[0].f_proslipsidate, '02/01/2026');
    const second = await create({ hmeromhnia_proslhpshs: '2026-01-02', hmeromhnia_metabolhs: '2026-10-01' });
    assert.equal(second.payload.AnaggeliesE3N.AnaggeliaE3N[0].f_proslipsidate, '02/01/2026');
    await assert.rejects(create({ hmeromhnia_metabolhs: '2026-09-22' }), /Ημ\/νία Πρόσληψης/);
});
