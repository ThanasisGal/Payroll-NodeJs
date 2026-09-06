'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const C = require('./employmentProfileContract');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { buildTblProsopExistingUpdate, mapRowToDocument } = require('../../../importTblProsop');

test('existing import preserves all facts, arbitrary local fields and insert constants', () => {
    const existing = { ...C.normalizeEmploymentProfileSubmission({ [C.ENABLED]: true, [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION',
        [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00', [C.DAYS]: [1, 5],
        dialleima_se_lepta: 30, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:30' }), localOnly: 'keep', archived: true,
        parathrhseis: 'local note', dialleima_se_lepta: 45, evelikth_proselefsh: 60 };
    const mapped = { eponymo: 'NEW', parathrhseis: undefined, localOnly: 'erase', archived: false,
        ...C.normalizeEmploymentProfileSubmission({ dialleima_se_lepta: 30 }) };
    const update = buildTblProsopExistingUpdate({ D: 'NEW' }, mapped);
    assert.deepEqual(update, { $set: { eponymo: 'NEW' } });
    const after = { ...existing, ...update.$set };
    for (const key of Object.keys(existing)) assert.deepEqual(after[key], existing[key], key);
});
test('absent spreadsheet columns and blank cells do not clear stored fields', () => {
    assert.deepEqual(buildTblProsopExistingUpdate({ D: '', T: null, FC: 0 },
        { eponymo: '', parathrhseis: null, energos: false }), { $set: { energos: false } });
    assert.deepEqual(buildTblProsopExistingUpdate({}, { mo_oron_hmerhsias_ergasias: 0,
        typos_orarioy: false, dialleima_se_lepta: 30 }), { $set: {} });
});
test('new spreadsheet employee uses existing mapper and safe schema defaults', async () => {
    const mapped = mapRowToDocument({ C: '0031', D: 'TEST', E: 'TEST', H: '1980-01-01',
        U: '2026-04-01', FH: '00000000000', AB: -1, AC: 5, AD: 40, AV: 1 });
    const employee = new ErgazomenoiModel(mapped); await employee.validate();
    assert.equal(employee[C.ENABLED], false); assert.equal(employee[C.TYPE], null);
    assert.deepEqual([...employee[C.DAYS]], []);
    for (const field of C.BREAK_PAIRS.flat()) assert.equal(employee[field], null);
    assert.equal(employee.dialleima_se_lepta, 30);
    assert.equal(mongoose.connection.readyState, 0);
});
test('CLI uses scoped $set and does not run on import', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../importTblProsop.js'), 'utf8');
    assert(!source.includes('.replaceOne('));
    assert(source.includes('buildTblProsopExistingUpdate(row, doc)'));
    assert(source.includes('if (require.main === module)'));
    assert(source.includes('updateOne({ ...filter, _id: existing._id }, update)'));
});

test('mapper and source-backed update values match the original baseline mapper', () => {
    const { execFileSync } = require('node:child_process');
    const vm = require('node:vm');
    const { SOURCE_COLUMNS } = require('./tblProsopImportUpdate');
    const baseline = execFileSync('git', ['show', 'bba736417cf30ff9d2de6e460496b96b552b21ba:importTblProsop.js'], { encoding: 'utf8' });
    // Evaluate only pure functions; never evaluate baseline imports or main().
    const pure = baseline.slice(baseline.indexOf('function columnIndexToLetter'), baseline.indexOf('async function main()'));
    const context = vm.createContext({});
    vm.runInContext(pure, context);
    const baseRow = Object.fromEntries([...new Set(Object.values(SOURCE_COLUMNS).flat())].map((column) => [column, 1]));
    const dates = { H: '1980-01-01', U: '2026-04-01', V: '2026-04-02', BT: '2026-12-31',
        W: '2026-12-31', NW: '2020-01-01', FS: '2030-01-01' };
    for (const variants of [{ AB: -1, AO: 3, BU: 83, BV: 2 }, { AB: 0, AO: 14, BU: 1001, BV: 1 }, { AB: 2, AO: 23, BU: 9, BV: 7 }]) {
        const row = { ...baseRow, ...dates, ...variants, AC: 5, AD: 40, C: '0031', J: '048', FZ: 'source-FZ' };
        const oldMapped = context.mapRowToDocument(row);
        const mapped = mapRowToDocument(row);
        // JSON normalizes cross-realm Dates/objects only; source values are identical.
        assert.equal(JSON.stringify(mapped), JSON.stringify(oldMapped));
        const update = buildTblProsopExistingUpdate(row, mapped).$set;
        for (const field of Object.keys(SOURCE_COLUMNS)) {
            assert.equal(JSON.stringify(update[field]), JSON.stringify(oldMapped[field]), field);
        }
        assert.equal(new Date(update.hmeromhnia_allaghs_orarioy_eos).getTime(),
            new Date(oldMapped.hmeromhnia_allaghs_orarioy_eos).getTime());
    }
});
