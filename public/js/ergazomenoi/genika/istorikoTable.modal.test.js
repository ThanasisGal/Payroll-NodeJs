'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IstorikoProslhpseonAllagonModel } = require('../../../../server/models/ergazomenoi');

const source = fs.readFileSync(__dirname + '/istorikoTable.js', 'utf8')
    .replace('    hydrateExistingRows();',
        '    globalThis.modalContract = { render: buildIstorikoDetailsHtml, labels: fieldLabels, excluded: excludedModalFields };');
const table = { dataset: { canManageHistory: 'false' }, addEventListener() {} };
const document = { addEventListener(event, callback) { if (event === 'DOMContentLoaded') callback(); },
    getElementById(id) { return id === 'istorikoTable' ? table : null; } };
const context = { document, Intl };
vm.runInNewContext(source, context);
const { render, labels, excluded } = context.modalContract;

test('history schema fields are labelled, structured, or explicitly excluded', () => {
    for (const field of Object.keys(IstorikoProslhpseonAllagonModel.schema.paths)) {
        assert.ok(labels[field] || excluded.has(field), field);
    }
    for (const field of ['employment_profile_source', 'employment_profile_schema_version',
        'ekdosh_typoy_egkekrimenhs_rythmishs']) assert.ok(excluded.has(field));
});

test('history details show Greek business labels and no technical keys', () => {
    const html = render({ symbash: 'contract', stoixeio_symbashs_01: 'A', poso_symbashs_01: 100,
        nomimosMisthos: 100, krathsh_01: 'K', eidikh_kathgoria_ergazomenoy: '0001',
        eidikh_periptosh: 'περίπτωση', typos_ergazomenon: 'τύπος',
        afora_allagh_dialleimatos: true, hmeromhnia_isxyos_dialleimatos_apo: '2026-09-21T00:00:00.000Z',
        dialleima_se_lepta: 10, dialleima_entos_ektos_orarioy: true,
        synexes_diakekomeno: true, evelikth_proselefsh: 10,
        employment_profile_source: 'employment profile source', employment_profile_schema_version: 1,
        ekdosh_typoy_egkekrimenhs_rythmishs: '1', unknown_future_key: 'secret' });
    for (const section of ['Στοιχεία Σύμβασης', 'Στοιχεία Σύμβασης / Ποσά',
        'Νόμιμες / Πραγματικές Αποδοχές', 'Κρατήσεις', 'Λοιπά Στοιχεία']) assert.ok(html.includes(section), section);
    for (const label of ['Ειδική Κατηγορία Εργαζόμενου', 'Ειδική Περίπτωση', 'Τύπος Εργαζόμενου',
        'Αφορά Αλλαγή Διαλείμματος', 'Ημ/νία Ισχύος Διαλείμματος Από',
        'Διάρκεια Διαλείμματος (Λεπτά)', 'Διάλειμμα Εντός / Εκτός Ωραρίου',
        'Συνεχές / Διακεκομμένο Ωράριο', 'Ευέλικτη Προσέλευση']) assert.ok(html.includes(label), label);
    for (const forbidden of ['employment_profile_source', 'employment profile source',
        'employment_profile_schema_version', 'ekdosh_typoy_egkekrimenhs_rythmishs',
        'unknown_future_key', 'secret']) assert.equal(html.includes(forbidden), false, forbidden);
    assert.equal(/<th>[^<]*[a-z]+_[a-z_]+[^<]*<\/th>/.test(html), false);
});
