'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const add = source.slice(source.indexOf('static postErgazomenoiForm'),
    source.indexOf('static uploadE3ToErganh'));
const start = add.indexOf('        const orarioValidation = validateOrarioFields(formData);');
const end = add.indexOf('        try {\n            // ✅ Get company data for email', start);
assert(start >= 0 && end > start);
const schedule = add.slice(start, end);

test('two Add saves update scoped date rows without wiping later-stage facts', async () => {
    const rows = [];
    const ProdhlomenaOrariaModel = { async findOneAndUpdate(filter, update, options) {
        assert.equal(options.upsert, true);
        let row = rows.find(candidate => Object.keys(filter).every(key => candidate[key] === filter[key]));
        if (!row) { row = { ...update.$setOnInsert }; rows.push(row); }
        Object.assign(row, update.$set);
        return row;
    } };
    const run = async time => {
        const formData = { hmeromhnia_allaghs_orarioy_apo: '2026-09-21',
            hmeromhnia_allaghs_orarioy_eos: '2026-09-22',
            hmeromhnia_01: '2026-09-21', hmeromhnia_02: '2026-09-22',
            apo_ora_01_01: time, apo_ora_01_02: time,
            eos_ora_01_01: '16:00', eos_ora_01_02: '16:00' };
        await vm.runInNewContext(`(async () => { ${schedule} })()`, {
            Date, formData, sessionUserTeam: 'team', sessionCompanyInUse: 'company',
            persistenceTarget: { employee: { kodikos: '0004' } },
            aa_kod: null, newErgazomenos: { kodikos: '0004' },
            ProdhlomenaOrariaModel,
            validateOrarioFields: () => ({ valid: true }),
            validateOrarioDateRangeFields: () => ({ valid: true }),
            normalizeTemporaryOrarioValue: (data, index) => ({
                kathgoriaErgasias: 'ΕΡΓ',
                getTimeValue: field => data[field] ?? null,
                getHourMetricValue: () => 0
            }),
            firstPositiveHours: () => 8, calcHoursFromTimePairs: () => 8,
            console: { warn() {}, error() {} }
        });
    };
    await run('08:00');
    assert.equal(rows.length, 2);
    for (const row of rows) {
        row.cards_apo_ora_01 = '08:07'; row.cards_eos_ora_01 = '16:03'; row.is_locked = true;
    }
    await run('09:00');
    assert.equal(rows.length, 2);
    for (const date of ['2026-09-21', '2026-09-22']) {
        const matching = rows.filter(row => row.team === 'team' && row.company_kod === 'company' &&
            row.kodikos === '0004' && row.hmeromhnia === date);
        assert.equal(matching.length, 1);
        assert.equal(matching[0].apo_ora_01, '09:00');
        assert.equal(matching[0].cards_apo_ora_01, '08:07');
        assert.equal(matching[0].cards_eos_ora_01, '16:03');
        assert.equal(matching[0].is_locked, true);
    }
});
