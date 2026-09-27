'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { REBUILD_STATUSES, DEFAULT_MAX_HISTORY_ROWS, PERIOD_IDENTITY_FIELDS, PERIOD_STATE_FIELDS,
    calculateCanonicalDiff,
    isSparseHireLifecycleEvidence, rebuildEmployeeHistory } = require('./employeeHistoryRebuilderService');
const { REAL_0069_IDS, buildReal0069SanitizedHistoryFixture } =
    require('./fixtures/real0069SanitizedHistoryFixture');

const scope = { team: 'TEST', company_kod: 'company', kodikos: '0069' };

test('period identity boundaries are classified separately from mutable period state', () => {
    assert.ok(PERIOD_IDENTITY_FIELDS.includes('hmeromhnia_proslhpshs'));
    assert.ok(PERIOD_IDENTITY_FIELDS.includes('hmeromhnia_isxyos_oron_ergasias_apo'));
    assert.ok(PERIOD_IDENTITY_FIELDS.includes('hmeromhnia_isxyos_oron_ergasias_eos'));
    assert.ok(!PERIOD_IDENTITY_FIELDS.includes('hmeromhnia_lhxhs_symbashs'));
    assert.ok(!PERIOD_IDENTITY_FIELDS.includes('hmeromhnia_apoxorhshs'));
    assert.ok(PERIOD_STATE_FIELDS.includes('hmeromhnia_lhxhs_symbashs'));
    assert.ok(PERIOD_STATE_FIELDS.includes('typos_apasxolhshs'));
    assert.ok(PERIOD_STATE_FIELDS.includes('nomimoHmeromisthio'));
    assert.ok(!PERIOD_STATE_FIELDS.includes('hmeromhnia_allaghs_symbashs'));
});

function period(id, from, weeklyHours, extra = {}) {
    return {
        _id: id,
        ...scope,
        aa_eggrafhs: String(extra.aa || 1).padStart(4, '0'),
        hmeromhnia_proslhpshs: extra.hire || '2026-01-01',
        hmeromhnia_allaghs_symbashs: from,
        hmeromhnia_allaghs_orarioy_apo: from,
        hmeromhnia_allaghs_orarioy_eos: extra.scheduleEnd || null,
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: extra.until || null,
        hmeromhnia_lhxhs_symbashs: extra.contractEnd || null,
        hmeromhnia_apoxorhshs: extra.departure || null,
        ores_ergasias_ebdomadas: weeklyHours,
        ...extra.fields
    };
}

test('clean canonical history requires no cleanup and produces an empty minimal diff', () => {
    const row = period('current', '2026-07-01', 40);
    const result = rebuildEmployeeHistory({ scope, currentEmployee: { ...row, _id: 'employee' },
        historyRows: [row] });
    assert.equal(result.status, REBUILD_STATUSES.CLEAN);
    assert.equal(result.cleanupRequired, false);
    assert.deepEqual(result.rowsToUpdate, []);
    assert.deepEqual(result.rowsToDelete, []);
    assert.deepEqual(calculateCanonicalDiff([row], result.canonicalRows), {
        rowsToUpdate: [], rowsToDelete: [], rowsToInsert: []
    });
});

test('30h -> 35h -> 40h genuine periods stay intact and current facts update only the latest period', () => {
    const rows = [
        period('h30', '2026-01-01', 30, { aa: 1, until: '2026-03-31' }),
        period('h35', '2026-04-01', 35, { aa: 2, until: '2026-06-30' }),
        period('h40', '2026-07-01', 39, { aa: 3 })
    ];
    const current = { ...rows[2], _id: 'employee', ores_ergasias_ebdomadas: 40 };
    const result = rebuildEmployeeHistory({ scope, currentEmployee: current, historyRows: rows });
    assert.equal(result.status, REBUILD_STATUSES.AUTO_REPAIRABLE);
    assert.deepEqual(result.canonicalRows.map(row => row.ores_ergasias_ebdomadas), [30, 35, 40]);
    assert.deepEqual(result.rowsToUpdate, [{ historyId: 'h40', patch: { ores_ergasias_ebdomadas: 40 } }]);
    assert.deepEqual(result.rowsToDelete, []);
});

test('exact real 0069 fixture reproduces the old false-ambiguity evidence before correction', () => {
    const fixture = buildReal0069SanitizedHistoryFixture();
    const oldGroup = fixture.history;
    const oldStateFields = ['nomimoHmeromisthio', 'typos_apasxolhshs'];
    const firstDifference = oldStateFields.find(field =>
        new Set(oldGroup.map(row => JSON.stringify(row[field] ?? null))).size > 1);
    const oldResult = {
        status: REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED,
        conflict: 'AMBIGUOUS_SEMANTIC_PERIOD',
        historyIds: oldGroup.map(row => row._id),
        firstDifference
    };
    assert.deepEqual(oldResult, {
        status: REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED,
        conflict: 'AMBIGUOUS_SEMANTIC_PERIOD',
        historyIds: Object.values(REAL_0069_IDS).slice(1),
        firstDifference: 'nomimoHmeromisthio'
    });
    assert.deepEqual([...new Set(oldGroup.map(row => row.nomimoHmeromisthio))], [0, 48.0128]);
    assert.deepEqual([...new Set(oldGroup.slice(1).map(row => row.typos_apasxolhshs))], ['5', '1']);
    assert.ok(oldGroup.every(row => row.afora_proslhpsh === true));
    assert.equal(isSparseHireLifecycleEvidence(oldGroup[0]), true);
    assert.ok(oldGroup.slice(1).every(row => !isSparseHireLifecycleEvidence(row)));
});

test('exact real 0069 fixture preserves lifecycle 0001 and repairs profile snapshots 0002-0005', () => {
    const fixture = buildReal0069SanitizedHistoryFixture();
    assert.equal(C.readEmploymentProfile(fixture.history[4]).recorded, true);
    const originalHire = structuredClone(fixture.history[0]);
    const result = rebuildEmployeeHistory({ scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        historyRows: fixture.history });
    assert.equal(result.status, REBUILD_STATUSES.AUTO_REPAIRABLE);
    assert.deepEqual(result.canonicalRows.map(row => row._id),
        [REAL_0069_IDS['0001'], REAL_0069_IDS['0005']]);
    assert.deepEqual(result.rowsToDelete.map(row => row.historyId),
        [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']]);
    assert.deepEqual(result.canonicalRows.map(row => row.aa_eggrafhs), ['0001', '0005']);
    assert.equal(result.canonicalRows[1].hmeromhnia_lhxhs_symbashs, '2026-10-31');
    assert.equal(result.canonicalRows[1].typos_apasxolhshs, '1');
    assert.deepEqual(result.canonicalRows[0], originalHire);
    assert.deepEqual(result.rowsToInsert, []);
});

test('invalid legacy employment type 5 is state pollution without a separate effective boundary', () => {
    const fixture = buildReal0069SanitizedHistoryFixture();
    assert.equal(fixture.history[1].typos_apasxolhshs, '5');
    assert.equal(fixture.history[1].hmeromhnia_isxyos_oron_ergasias_apo,
        fixture.history[4].hmeromhnia_isxyos_oron_ergasias_apo);
    const result = rebuildEmployeeHistory({ scope: fixture.scope, currentEmployee: fixture.currentEmployee,
        historyRows: fixture.history });
    assert.equal(result.status, REBUILD_STATUSES.AUTO_REPAIRABLE);
    assert.equal(result.diagnostics.collapsedGroups[0].survivorId, REAL_0069_IDS['0005']);
});

test('departure, rehire, prior cycle and explicit future version are preserved', () => {
    const rows = [
        period('cycle1-a', '2025-01-01', 30, { hire: '2025-01-01', aa: 1,
            until: '2025-03-31', departure: '2025-06-30' }),
        period('cycle1-b', '2025-04-01', 35, { hire: '2025-01-01', aa: 2,
            until: '2025-06-30', departure: '2025-06-30' }),
        period('cycle2-current', '2026-01-01', 40, { hire: '2026-01-01', aa: 3,
            until: '2026-09-30' }),
        period('cycle2-future', '2026-10-01', 38, { hire: '2026-01-01', aa: 4 })
    ];
    const current = { ...rows[3], _id: 'employee' };
    const result = rebuildEmployeeHistory({ scope, currentEmployee: current, historyRows: rows });
    assert.equal(result.status, REBUILD_STATUSES.CLEAN);
    assert.deepEqual(result.canonicalRows.map(row => row._id), rows.map(row => row._id));
    assert.equal(result.canonicalRows[1].hmeromhnia_apoxorhshs, '2025-06-30');
});

test('competing sparse hire events with contradictory effective boundaries require manual review', () => {
    const first = period('first-hire', '2026-05-01', 0, { aa: 1,
        fields: { afora_proslhpsh: true, afora_allagh_oron_ergasias: false } });
    const second = { ...first, _id: 'second-hire', aa_eggrafhs: '0002',
        hmeromhnia_allaghs_symbashs: '2026-05-02',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-02' };
    delete first.hmeromhnia_isxyos_oron_ergasias_apo;
    delete second.hmeromhnia_isxyos_oron_ergasias_apo;
    const result = rebuildEmployeeHistory({ scope, currentEmployee: { ...first, _id: 'employee' },
        historyRows: [first, second] });
    assert.equal(result.status, REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED);
    assert.deepEqual(result.rowsToUpdate, []);
    assert.deepEqual(result.rowsToDelete, []);
    assert.equal(result.diagnostics.reason, 'AMBIGUOUS_LIFECYCLE_EVENTS');
});

test('pre-indexed grouping is equivalent for every semantic fixture and input ordering', () => {
    const real = buildReal0069SanitizedHistoryFixture();
    const chronologicalRows = [
        period('equivalent-30', '2026-01-01', 30, { aa: 1, until: '2026-03-31' }),
        period('equivalent-35', '2026-04-01', 35, { aa: 2, until: '2026-06-30' }),
        period('equivalent-40', '2026-07-01', 40, { aa: 3 })
    ];
    const fixtures = [
        { fixtureScope: real.scope, current: real.currentEmployee, rows: real.history },
        { fixtureScope: scope, current: { ...chronologicalRows[2], _id: 'employee' },
            rows: chronologicalRows }
    ];
    const normalized = result => ({
        status: result.status,
        cleanupRequired: result.cleanupRequired,
        canonicalRows: [...result.canonicalRows].sort((left, right) =>
            String(left._id).localeCompare(String(right._id))),
        rowsToUpdate: [...result.rowsToUpdate].sort((left, right) =>
            left.historyId.localeCompare(right.historyId)),
        rowsToDelete: [...result.rowsToDelete].sort((left, right) =>
            left.historyId.localeCompare(right.historyId)),
        employeePatch: result.employeePatch
    });
    for (const fixture of fixtures) {
        const expected = normalized(rebuildEmployeeHistory({ scope: fixture.fixtureScope,
            currentEmployee: fixture.current, historyRows: fixture.rows }));
        for (const orderedRows of [
            [...fixture.rows].reverse(),
            [...fixture.rows.slice(1), fixture.rows[0]]
        ]) {
            assert.deepEqual(normalized(rebuildEmployeeHistory({ scope: fixture.fixtureScope,
                currentEmployee: fixture.current, historyRows: orderedRows })), expected);
        }
    }
});

test('defensive history-size guard fails closed', () => {
    const row = period('one', '2026-01-01', 40);
    const rows = Array.from({ length: DEFAULT_MAX_HISTORY_ROWS + 1 }, (_, index) => ({
        ...row, _id: `row-${index}`
    }));
    const result = rebuildEmployeeHistory({ scope, currentEmployee: { ...row, _id: 'employee' },
        historyRows: rows });
    assert.equal(result.status, REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED);
    assert.equal(result.diagnostics.reason, 'HISTORY_SIZE_LIMIT_EXCEEDED');
    assert.deepEqual(result.rowsToDelete, []);
});

for (const size of [5, 20, 100, 500, 1000]) test(`CPU and memory benchmark ${size} rows`, t => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const rows = Array.from({ length: size }, (_, index) => {
        const from = new Date(start); from.setUTCDate(from.getUTCDate() + index * 2);
        const until = new Date(from); until.setUTCDate(until.getUTCDate() + 1);
        return period(`benchmark-${index}`, from.toISOString().slice(0, 10), 40, {
            aa: index + 1,
            until: index === size - 1 ? null : until.toISOString().slice(0, 10)
        });
    });
    const current = { ...rows.at(-1), _id: 'employee' };
    const serializedInputBytes = Buffer.byteLength(JSON.stringify({ current, rows }));
    const heapBefore = process.memoryUsage().heapUsed;
    const cpuBefore = process.cpuUsage();
    const rebuildStarted = process.hrtime.bigint();
    const result = rebuildEmployeeHistory({ scope, currentEmployee: current, historyRows: rows });
    const rebuildMilliseconds = Number(process.hrtime.bigint() - rebuildStarted) / 1e6;
    const cpu = process.cpuUsage(cpuBefore);
    const diffStarted = process.hrtime.bigint();
    const diff = calculateCanonicalDiff(rows, result.canonicalRows);
    const diffMilliseconds = Number(process.hrtime.bigint() - diffStarted) / 1e6;
    const heapAfter = process.memoryUsage().heapUsed;
    const metrics = { rows: size, serializedInputBytes, rebuildMilliseconds, diffMilliseconds,
        cpuUserMilliseconds: cpu.user / 1000, cpuSystemMilliseconds: cpu.system / 1000,
        heapBefore, heapAfter, approximateAdditionalHeapBytes: Math.max(0, heapAfter - heapBefore),
        canonicalRowCount: result.canonicalRows.length };
    t.diagnostic(JSON.stringify(metrics));
    assert.equal(result.status, REBUILD_STATUSES.CLEAN);
    assert.equal(result.canonicalRows.length, size);
    assert.deepEqual(diff, { rowsToUpdate: [], rowsToDelete: [], rowsToInsert: [] });
    assert.ok(rebuildMilliseconds < 2000);
    assert.ok(diffMilliseconds < 2000);
});
