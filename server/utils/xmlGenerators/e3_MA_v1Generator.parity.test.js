'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildMAData, buildMAJSON, buildMAXML } = require('./e3_MA_v1Generator');

const employee = {
    eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΔΟΚΙΜΗ', patronymo: 'ΔΟΚΙΜΗ', mhtronymo: 'ΔΟΚΙΜΗ',
    hmeromhnia_gennhshs: '1990-01-01', afm: '000000000', amka: '00000000000', adt: 'Α00000000',
    eidikothta_erganh: '123456', antikeimeno_ergasion: 'ΣΥΝΘΕΤΙΚΗ ΕΙΔΙΚΟΤΗΤΑ',
    oysiodeis_oroi: '0', typos_metabolhs_table: '[{"kodikos":"009"}]'
};
const branch = { kodikos: '00001' };

async function fixture(changes = {}) {
    const oldLog = console.log;
    console.log = () => {};
    try {
        return await buildMAData({ ...employee, ...changes }, {}, branch, { hmeromhnia_metabolhs: '2026-09-22' });
    } finally { console.log = oldLog; }
}

test('synthetic MA XML and WebMA JSON preserve the same business values', async () => {
    const { xmlData, typesMetabolon } = await fixture();
    const xml = buildMAXML(xmlData);
    const json = buildMAJSON(xmlData).AnaggeliesMA.AnaggeliaMA[0];
    for (const field of ['f_date_metabolhs', 'f_eidikothta', 'f_eidikothta_anal',
        'f_basics_acceptance', 'f_eidos_dieuthethshs', 'f_periodos_anaforas_from',
        'f_periodos_anaforas_to', 'f_aa_pararthmatos']) {
        assert.equal(json[field], xmlData[field], field);
        assert.ok(xml.includes(`<${field}>${xmlData[field]}</${field}>`), field);
    }
    assert.equal(json.f_file, null);
    assert.equal(xmlData.f_file, '');
    assert.deepEqual(json.TypesMetabolon.TypesMetabolonMA,
        typesMetabolon.map(type => ({ f_typos_metabolhs: type.typos_metabolhs.padStart(3, '0') })));
    assert.deepEqual(json.TypesMetabolon.TypesMetabolonMA, [{ f_typos_metabolhs: '009' }]);
    assert.ok(!json.TypesMetabolon.TypesMetabolonMA.some(type => ['001', '004'].includes(type.f_typos_metabolhs)));
});

test('MA acceptance override is restricted to a single 001 mutation', async () => {
    const single = await fixture({ typos_metabolhs_table: '[{"kodikos":"001"}]' });
    assert.equal(single.xmlData.f_basics_acceptance, '2');
    const mixed = await fixture({ typos_metabolhs_table: '[{"kodikos":"001"},{"kodikos":"009"}]' });
    assert.equal(mixed.xmlData.f_basics_acceptance, '0');
    const other = await fixture({ oysiodeis_oroi: '1' });
    assert.equal(other.xmlData.f_basics_acceptance, '1');
});

test('WebMA f_file reads the essential-terms document, not the contract document', async () => {
    const helperPath = require.resolve('../s3Helper');
    const previous = require.cache[helperPath];
    const reads = [];
    require.cache[helperPath] = { id: helperPath, filename: helperPath, loaded: true,
        exports: { downloadFileFromS3: async key => {
            reads.push(key);
            return Buffer.from('%PDF-synthetic-terms');
        } } };
    try {
        const { xmlData } = await fixture({
            arxeio_apodoxhs_oysiodon_oron_path: 'synthetic-terms-key',
            arxeio_apodoxhs_oron_atomikhs_symbashs_path: 'synthetic-contract-decoy'
        });
        assert.deepEqual(reads, ['synthetic-terms-key']);
        assert.equal(xmlData.f_file, Buffer.from('%PDF-synthetic-terms').toString('base64'));
        assert.equal(buildMAJSON(xmlData).AnaggeliesMA.AnaggeliaMA[0].f_file, xmlData.f_file);
    } finally {
        if (previous) require.cache[helperPath] = previous;
        else delete require.cache[helperPath];
    }
});

test('WebMA never falls back to the contract document when essential terms are missing', async () => {
    const helperPath = require.resolve('../s3Helper');
    const previous = require.cache[helperPath];
    const reads = [];
    require.cache[helperPath] = { id: helperPath, filename: helperPath, loaded: true,
        exports: { downloadFileFromS3: async key => {
            reads.push(key);
            return Buffer.from('%PDF-contract-must-not-be-read');
        } } };
    try {
        const { xmlData } = await fixture({
            arxeio_apodoxhs_oysiodon_oron_path: '',
            arxeio_apodoxhs_oron_atomikhs_symbashs_path: 'synthetic-contract-decoy'
        });
        const xml = buildMAXML(xmlData);
        const json = buildMAJSON(xmlData).AnaggeliesMA.AnaggeliaMA[0];
        assert.deepEqual(reads, []);
        assert.equal(xmlData.f_file, '');
        assert.match(xml, /<f_file><\/f_file>/);
        assert.equal(json.f_file, null);
    } finally {
        if (previous) require.cache[helperPath] = previous;
        else delete require.cache[helperPath];
    }
});

test('existing no-file acceptance branch performs no unrelated S3 read', async () => {
    const helperPath = require.resolve('../s3Helper');
    const previous = require.cache[helperPath];
    const reads = [];
    require.cache[helperPath] = { id: helperPath, filename: helperPath, loaded: true,
        exports: { downloadFileFromS3: async key => {
            reads.push(key);
            return Buffer.from('%PDF-must-not-be-read');
        } } };
    try {
        const { xmlData } = await fixture({
            oysiodeis_oroi: '1',
            arxeio_apodoxhs_oysiodon_oron_path: 'synthetic-terms-decoy',
            arxeio_apodoxhs_oron_atomikhs_symbashs_path: 'synthetic-contract-decoy'
        });
        assert.deepEqual(reads, []);
        assert.equal(xmlData.f_file, '');
        assert.equal(buildMAJSON(xmlData).AnaggeliesMA.AnaggeliaMA[0].f_file, null);
    } finally {
        if (previous) require.cache[helperPath] = previous;
        else delete require.cache[helperPath];
    }
});

test('MA and E3N document source mapping agrees on essential terms', () => {
    const ma = fs.readFileSync(path.join(__dirname, 'e3_MA_v1Generator.js'), 'utf8');
    const e3 = fs.readFileSync(path.join(__dirname, 'e3N_v2Generator.js'), 'utf8');
    assert.match(ma, /arxeio_apodoxhs_oysiodon_oron_path/);
    assert.match(e3, /arxeio_apodoxhs_oysiodon_oron_path/);
    assert.match(e3, /f_file_symbash: symbashPdfBase64/);
});
