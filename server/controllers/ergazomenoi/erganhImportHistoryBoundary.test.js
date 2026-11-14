'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const controller = require('./erganhController');
const { importHarness, inputRow, scheduleSheet, employmentFixture, date } = require('../../../test/fixtures/erganiImportTransactionFixture');
const { runEmployeeWorkWrite } = require('../../services/ergazomenoi/employeeWorkWriteFenceService');
const { resolveEmploymentCycleForDate } = require('../../services/ergazomenoi/employeeEmploymentCycleResolverService');
const { resolveErganiImportEmploymentEvidence } = require('../../services/ergazomenoi/erganiImportEmploymentEvidenceService');
const { transient } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { saveTelikoToProdhlomena, assertErganiImportApplied } = controller.__scheduleDownloadTestHooks;
const { saveKartesPayloadToMongo, downloadPrepareStoreAndPersistCards, codes } = controller.__cardsDownloadTestHooks;

async function receive(kind, h, rows = [inputRow]) {
    const result = kind === 'schedule'
        ? await saveTelikoToProdhlomena(scheduleSheet(rows), '2026', h.dependencies.authorizedScope, h.dependencies)
        : await saveKartesPayloadToMongo(rows, h.dependencies);
    return assertErganiImportApplied(result);
}

for (const kind of ['schedule', 'cards']) {
    for (const history of ['valid', 'missing', 'incomplete-past', 'overlap', 'before-hire', 'after-departure', 'gap']) {
        test(`${kind}: shared ${history} fixture receives real primary evidence without reading or changing History`, async () => {
            const h = importHarness({ kind: history, existing: kind === 'cards' });
            const before = h.db.state();
            const result = await receive(kind, h);
            assert.equal(result.bulkOps.length, 1);
            assert.equal(result.matchedCount + (result.upsertedCount || 0), 1);
            assert.equal(h.rows().length, 1);
            assert.equal(h.rows()[0][kind === 'cards' ? 'cards_apo_ora_01' : 'apo_ora_01'], '08:00');
            assert.deepEqual(h.db.state().history, before.history);
            assert.equal(h.db.events.some(event => event.kind === 'history'), false);
            const { employee_profile_mutation_sequence, ...employee } = h.db.state().employees[0];
            assert.deepEqual(employee, before.employees[0]);
            assert.equal(employee_profile_mutation_sequence, 1);
            assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
        });
    }
    for (const failure of ['missingEmployee', 'ambiguousEmployee']) {
        test(`${kind}: shared ${failure} fixture cannot report a successful import`, async () => {
            const h = importHarness({ [failure]: true }), before = h.db.state();
            await assert.rejects(receive(kind, h), { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.writes.length, 0);
        });
    }
    test(`${kind}: an unresolved row prevents partial import of the valid row`, async () => {
        const h = importHarness(), before = h.db.state();
        await assert.rejects(receive(kind, h, [inputRow, { ...inputRow, afm: '999999999' }]),
            { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
        assert.deepEqual(h.db.state(), before);
        assert.equal(h.writes.length, 0);
    });
    test(`${kind}: repeated receipt matches an existing row and explicitly reports zero modifications`, async () => {
        const h = importHarness();
        await receive(kind, h);
        const before = h.rows();
        const result = await receive(kind, h);
        assert.equal(result.matchedCount, 1);
        assert.equal(result.modifiedCount, 0);
        assert.deepEqual(h.rows(), before);
        assert.equal(h.rows().length, 1);
    });
    test(`${kind}: empty input cannot be reported as an applied import`, async () => {
        const h = importHarness(), before = h.db.state();
        await assert.rejects(receive(kind, h, []), { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
        assert.deepEqual(h.db.state(), before);
    });
    test(`${kind}: failure after real synthetic writes rolls back the complete import and employee fence`, async () => {
        const h = importHarness({ failAfterWrite: true }), before = h.db.state(), rows = h.rows();
        await assert.rejects(receive(kind, h), /SYNTHETIC_IMPORT_WRITE_FAILURE/);
        assert.equal(h.writes.length, 1);
        assert.deepEqual(h.db.state(), before);
        assert.deepEqual(h.rows(), rows);
    });
    for (const status of ['LOCKED', 'FINALIZED']) {
        test(`${kind}: ${status} period protects even a missing schedule row`, async () => {
            const h = importHarness({ periodStatus: status, existing: false }), before = h.db.state();
            await assert.rejects(receive(kind, h), { code: 'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED' });
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.writes.length, 0);
        });
    }
    test(`${kind}: a locked daily row remains byte-for-byte unchanged`, async () => {
        const h = importHarness({ locked: true }), before = h.db.state(), rows = h.rows();
        await assert.rejects(receive(kind, h), { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
        assert.deepEqual(h.db.state(), before);
        assert.deepEqual(h.rows(), rows);
    });
    test(`${kind}: mixed locked and writable dates cannot produce a partially successful import`, async () => {
        const h = importHarness({ locked: true }), before = h.db.state();
        await assert.rejects(receive(kind, h, [inputRow, { ...inputRow, hmeromhnia_raw: '02/06/2026' }]),
            { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
        assert.deepEqual(h.db.state(), before);
    });
    test(`${kind}: retry accepts changed employment bounds without reading History`, async () => {
        const h = importHarness();
        h.db.hooks.beforeCommit = session => {
            if (session.attempt !== 1) return;
            h.db.changeCommittedEmployee('employee', { hmeromhnia_apoxorhshs: '2026-05-31' });
            throw transient();
        };
        await receive(kind, h);
        assert.equal(h.db.state().employees[0].employee_profile_mutation_sequence, 1);
        assert.equal(h.db.events.some(event => event.kind === 'history'), false);
    });
    test(`${kind}: stale AFM or branch discovery cannot update another employee`, async () => {
        for (const patch of [{ afm: '999999999' }, { ypokatasthma: '0001' }, { oristikh_enhmerosh: false }]) {
            const h = importHarness(), originalFind = h.dependencies.ergazomenoiModel.find;
            h.dependencies.ergazomenoiModel.find = filter => {
                const q = originalFind(filter), lean = q.lean;
                q.lean = async () => { const found = await lean(); h.db.changeCommittedEmployee('employee', patch); return found; };
                return q;
            };
            await assert.rejects(receive(kind, h), { code: 'EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING' });
            assert.equal(h.db.state().audits.length, 0);
        }
    });
    for (const history of ['missing', 'overlap']) {
        test(`${kind}: ${history} old history and a current departure do not restrict primary evidence`, async () => {
            const h = importHarness({ kind: history });
            h.db.changeCommittedEmployee('employee', { hmeromhnia_apoxorhshs: '2026-05-31' });
            const before = h.db.state();
            await receive(kind, h);
            assert.deepEqual(h.db.state().history, before.history);
            assert.equal(h.db.events.some(event => event.kind === 'history'), false);
        });
    }
    test(`${kind}: lost acknowledgement after commit is reported as unconfirmed, never as rolled back`, async () => {
        const h = importHarness(), start = h.dependencies.workWriteDependencies.connection.startSession;
        h.dependencies.workWriteDependencies.connection = { startSession: async () => {
            const session = await start(), transaction = session.withTransaction;
            session.withTransaction = async (...args) => { await transaction(...args); throw Error('SYNTHETIC_ACK_LOSS'); };
            return session;
        } };
        await assert.rejects(receive(kind, h), error => {
            assert.equal(error.code, 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED');
            assert.match(error.message, /Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές/);
            assert.doesNotMatch(error.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
            return true;
        });
        assert.equal(h.db.events.filter(event => event.type === 'commit').length, 1);
        assert.equal(h.rows()[0][kind === 'cards' ? 'cards_apo_ora_01' : 'apo_ora_01'], '08:00');
    });
}

test('cards: a missing target refuses the entire batch after a partial match', async () => {
    const h = importHarness(), before = h.db.state(), rows = h.rows();
    await assert.rejects(receive('cards', h, [inputRow, { ...inputRow, hmeromhnia_raw: '02/06/2026' }]),
        { code: 'EMPLOYEE_WORK_WRITE_NOT_APPLIED' });
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(h.rows(), rows);
});

test('cards: successful file storage cannot conceal zero database matches or unresolved identities', async () => {
    for (const config of [{ existing: false }, { missingEmployee: true }, { ambiguousEmployee: true }, { locked: true }]) {
        const h = importHarness(config), calls = [], before = h.db.state();
        await assert.rejects(downloadPrepareStoreAndPersistCards({ authorizedScope: h.dependencies.authorizedScope }, {
            download: async () => Buffer.from('synthetic-source'), validate: async () => {},
            prepare: async () => ({ processedBuffer: Buffer.from('synthetic-processed'), persistencePayload: [inputRow] }),
            store: async () => calls.push('file-stored'),
            persist: rows => { calls.push('database-attempt'); return saveKartesPayloadToMongo(rows, h.dependencies); }
        }), { code: codes.databaseFailed });
        assert.deepEqual(calls, ['file-stored', 'database-attempt']);
        assert.deepEqual(h.db.state(), before);
    }
});

test('legacy policy leaves the strict resolver and generic work writer unchanged', async () => {
    const f = employmentFixture('missing');
    assert.equal(resolveEmploymentCycleForDate(date, { currentEmployee: f.employee, history: f.history }).status, 'NO_EMPLOYMENT_HISTORY');
    assert.equal(resolveErganiImportEmploymentEvidence(date, { currentEmployee: f.employee, history: f.history }).status, 'UNKNOWN');
    const h = importHarness({ kind: 'missing' }), before = h.db.state();
    await assert.rejects(runEmployeeWorkWrite({ ...h.dependencies.workWriteDependencies,
        documents: [{ ...f.employee, hmeromhnia: date }], work: async () => assert.fail('strict work must not run') }),
    { code: 'EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT' });
    assert.deepEqual(h.db.state(), before);
});
