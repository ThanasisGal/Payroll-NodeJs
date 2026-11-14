'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const controller = require('./erganhController');
const { importHarness, inputRow, scheduleSheet } = require('../../../test/fixtures/erganiImportTransactionFixture');
const { saveTelikoToProdhlomena, assertErganiImportApplied } = controller.__scheduleDownloadTestHooks;

const nonWork = category => ({ ...inputRow, kathgoria: category, apo_ora: '', eos_ora: '' });
const receive = async (h, rows) => assertErganiImportApplied(await saveTelikoToProdhlomena(
    scheduleSheet(rows), '2026', h.dependencies.authorizedScope, h.dependencies));

for (const kind of ['before-hire', 'after-departure', 'gap']) {
    for (const category of ['ΜΕ', 'ΑΝ']) {
        test(`schedule non-work ${category}: preserves ${kind} evidence and valid work together`, async () => {
            const h = importHarness({ kind }), before = h.db.state();
            const workDate = kind === 'after-departure' ? '31/05/2026' : '02/06/2026';
            const result = await receive(h, [nonWork(category), { ...inputRow, hmeromhnia_raw: workDate }]);
            assert.equal(result.bulkOps.length, 2);
            const saved = h.rows().find(row => row.hmeromhnia.toISOString().startsWith('2026-06-01'));
            assert.equal(saved.kathgoria_ergasias, category);
            assert.equal(saved.repo, category === 'ΑΝ');
            assert.equal(saved.ores_ergasias, 0);
            assert.equal(saved.apo_ora_01, '');
            assert.equal(saved.eos_ora_01, '');
            assert.deepEqual(h.db.state().history, before.history);
            assert.equal(h.db.state().employees[0].employee_profile_mutation_sequence, 1);
        });
    }
}

test('schedule date: rejects a nonexistent day instead of moving it into another month', async () => {
    const h = importHarness(), before = h.db.state();
    await assert.rejects(receive(h, [{ ...inputRow, hmeromhnia_raw: '32/05/2026' }]),
        { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
    assert.deepEqual(h.db.state(), before);
});

test('schedule date: an Excel Date retains its UTC calendar day regardless of server timezone', async () => {
    const originalTimezone = process.env.TZ;
    try {
        process.env.TZ = 'America/Los_Angeles';
        const h = importHarness({ existing: false });
        await receive(h, [{ ...inputRow, hmeromhnia_raw: new Date('2026-06-01T00:00:00.000Z') }]);
        assert.equal(h.rows()[0].hmeromhnia.toISOString(), '2026-06-01T00:00:00.000Z');
    } finally {
        if (originalTimezone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimezone;
    }
});

test('schedule protection: the non-work exception still protects periods and locked rows', async () => {
    for (const config of [{ periodStatus: 'LOCKED', existing: false },
        { periodStatus: 'FINALIZED', existing: false }, { locked: true }]) {
        const h = importHarness({ kind: 'before-hire', ...config }), before = h.db.state(), rows = h.rows();
        await assert.rejects(receive(h, [nonWork('ΑΝ')]), {
            code: config.locked ? 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' : 'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED'
        });
        assert.deepEqual(h.db.state(), before);
        assert.deepEqual(h.rows(), rows);
        assert.equal(h.writes.length, 0);
    }
});

test('schedule protection: failure while saving accepted non-work evidence rolls back the whole batch', async () => {
    const h = importHarness({ kind: 'before-hire', failAfterWrite: true }), before = h.db.state(), rows = h.rows();
    await assert.rejects(receive(h, [nonWork('ΜΕ'), { ...inputRow, hmeromhnia_raw: '02/06/2026' }]),
        /SYNTHETIC_IMPORT_WRITE_FAILURE/);
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(h.rows(), rows);
});

test('schedule xlsx: all four categories and text, Date and serial dates reach the correct employee unchanged', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'payroll-ergani-non-work-'));
    const filename = path.join(directory, 'synthetic.xlsx');
    try {
        const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Synthetic');
        sheet.addRow(['Branch', 'AFM', 'Name', 'Surname', 'Date', '', '', '', 'Schedule']);
        const serial = (Date.UTC(2026, 5, 3) - Date.UTC(1899, 11, 30)) / 86400000;
        for (const [day, description] of [
            ['01/06/2026', 'ΜΗ ΕΡΓΑΣΙΑ'],
            [new Date('2026-06-02T00:00:00Z'), 'ΕΡΓΑΣΙΑ 08:00-16:00'],
            [serial, 'ΤΗΛΕΡΓΑΣΙΑ 09:00-17:00'],
            ['04/06/2026', 'ΑΝΑΠΑΥΣΗ/ΡΕΠΟ']
        ]) sheet.addRow([0, inputRow.afm, 'SYNTHETIC', 'EMPLOYEE', day, '', '', '', description]);
        await workbook.xlsx.writeFile(filename);
        const h = importHarness({ kind: 'before-hire', existing: false }), before = h.db.state();
        const result = await controller.__scheduleDownloadTestHooks.processOrariaXlsx(
            filename, '2026', h.dependencies.authorizedScope, h.dependencies);
        assert.equal(result.upsertedCount, 4);
        const rows = h.rows().sort((a, b) => a.hmeromhnia - b.hmeromhnia);
        assert.deepEqual(rows.map(row => [row.hmeromhnia.toISOString().slice(0, 10), row.kathgoria_ergasias]),
            [['2026-06-01', 'ΜΕ'], ['2026-06-02', 'ΕΡΓ'], ['2026-06-03', 'ΤΗΛ'], ['2026-06-04', 'ΑΝ']]);
        assert.equal(rows[1].apo_ora_01, '08:00');
        assert.equal(rows[2].apo_ora_01, '09:00');
        for (const row of rows) {
            for (const field of ['team', 'company_kod', 'ypokatasthma', 'kodikos']) {
                assert.equal(row[field], h.fixture.employee[field]);
            }
        }
        assert.deepEqual(h.db.state().history, before.history);
    } finally {
        // Only this test's newly created synthetic workbook is removed.
        await fs.rm(directory, { recursive: true, force: true });
    }
});
