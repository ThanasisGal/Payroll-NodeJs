'use strict';
const assert = require('node:assert/strict');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const { isInactiveHistoryRow } = require('../../server/utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { acceptanceBRecordedTerms } = require('./employeeHistoryCoordinatedSettlementFixture');
const day = value => value == null ? null : new Date(value).toISOString().slice(0, 10);

// One new foundation, TWO retirements. The frozen hire event has no effective
// period and cannot be edited; the other retirement removes an April duplicate.
// Match originals by their recorded sequence, never by generated MongoDB ids.
function assertInitialGapSettlement(before, after) {
    assert.equal(before.history.length, 4);
    assert.equal(after.history.length, 5);
    assert.deepEqual(after.references, before.references);
    const oldIds = new Set(before.history.map(row => String(row._id)));
    const inserted = after.history.filter(row => !oldIds.has(String(row._id)));
    assert.equal(inserted.length, 1, 'Only the missing hire period requires an insert');
    const foundation = inserted[0];
    assert.equal(foundation._id?._bsontype, 'ObjectId');
    assert.equal(foundation.aa_eggrafhs, '0005');
    assert.equal(new Set(after.history.map(row => String(row._id))).size, 5);
    assert.equal(new Set(after.history.map(row => row.aa_eggrafhs)).size, 5);
    const active = after.history.filter(row => !isInactiveHistoryRow(row))
        .sort((a, b) => new Date(a[C.START]) - new Date(b[C.START]));
    const recorded = Object.values(acceptanceBRecordedTerms);
    assert.equal(active.length, 3);
    active.forEach((row, index) => {
        const { documentId, from, until, ...terms } = recorded[index];
        assert.deepEqual([day(row[C.START]), day(row[C.END])], [from, until], documentId);
        for (const [field, value] of Object.entries(terms)) assert.deepEqual(row[field], value, `${documentId}: ${field}`);
        assert.equal(day(row[C.HIRE]), index === 2 ? '2026-09-16' : '2025-12-01');
        assert.equal(day(row[C.CHANGE]), from);
        assert.equal(day(row[C.DEPARTURE]), index === 2 ? null : '2026-07-31');
    });
    assert.equal(String(active[0]._id), String(foundation._id));
    assert.ok(['0002', '0003'].includes(active[1].aa_eggrafhs));
    assert.equal(active[2].aa_eggrafhs, '0004');
    const hire = before.history.find(row => row.aa_eggrafhs === '0001');
    assert.equal(hire.afora_proslhpsh, true);
    assert.equal(hire.afora_allagh_oron_ergasias, false);
    assert.equal(hire[C.START], null);
    assert.equal(hire[C.END], null);
    assert.equal(foundation.afora_proslhpsh, true);
    assert.equal(foundation.afora_allagh_oron_ergasias, false);
    // Every profile value comes from the original hire, including absent values.
    for (const field of C.PROFILE_FIELDS) assert.deepEqual(foundation[field], hire[field], field);
    const retired = after.history.filter(isInactiveHistoryRow);
    assert.equal(retired.length, 2);
    for (const original of before.history) {
        const stored = after.history.find(row => String(row._id) === String(original._id));
        assert.ok(stored, 'All four original physical identities survive');
        if (!isInactiveHistoryRow(stored)) {
            assert.deepEqual(stored, original);
            continue;
        }
        const { employment_history_canonical_status: status, employment_history_canonical_survivor_id: survivor,
            updatedAt, ...payload } = stored;
        const { updatedAt: oldRevision, ...originalPayload } = original;
        assert.deepEqual(payload, originalPayload);
        assert.equal(status, 'REDUNDANT_REFERENCED');
        assert.equal(String(survivor), String(original.aa_eggrafhs === '0001' ? foundation._id : active[1]._id));
        assert.ok(original.aa_eggrafhs === '0001' || ['0002', '0003'].includes(original.aa_eggrafhs));
    }
    assert.ok(retired.some(row => String(row._id) === String(hire._id)));
    const currentEmployee = after.employee || after.employees[0];
    const { team, company_kod, kodikos } = currentEmployee;
    const verification = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService')
        .verifyEmployeeHistoryAutomaticSettlement({ scope: { team, company_kod, kodikos }, currentEmployee,
            proposedRows: after.history, requiredHistoryRows: before.history, strictProfileEvidence: true });
    assert.equal(verification.status, 'CLEAN');
    assert.deepEqual(verification.coverageGaps, []);
    assert.deepEqual(verification.issues, []);
    assert.deepEqual(verification.cycles.map(cycle => [cycle.hire_date, cycle.departure_date]),
        [['2025-12-01', '2026-07-31'], ['2026-09-16', null]]);
}
module.exports = { assertInitialGapSettlement };
