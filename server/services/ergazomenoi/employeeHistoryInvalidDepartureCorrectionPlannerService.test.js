'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { buildCompleteProfileSnapshot } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');
const { PLAN_STATUSES, planEmployeeHistoryInvalidDepartureCorrection } =
    require('./employeeHistoryInvalidDepartureCorrectionPlannerService');

const scope = { team: 'BLG', company_kod: 'company-id', kodikos: '0287' };
const targetId = '6a149e44452cce439d38287a';

function fixture({ currentDeparture = '2026-04-30', historyDeparture = '2026-04-30',
    extraRows = [] } = {}) {
    const profile = buildCompleteProfileSnapshot({ effectiveFrom: '2026-05-01' });
    const lifecycle = {
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_apoxorhshs: historyDeparture,
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: '2026-10-31'
    };
    const row = { _id: targetId, ...scope, ...profile, ...lifecycle,
        aa_eggrafhs: '0001', afora_proslhpsh: true };
    const employee = { ...row, _id: 'employee',
        hmeromhnia_apoxorhshs: currentDeparture, energos: true, archived: false };
    return { employee, history: [row, ...extraRows] };
}

function plan(input = fixture()) {
    return planEmployeeHistoryInvalidDepartureCorrection({ scope,
        currentEmployee: input.employee, completeHistoryRows: input.history,
        targetHistoryId: targetId });
}

test('0287-shaped invalid departure is cleared from current and History in a clean idempotent plan', () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.currentPatch, { hmeromhnia_apoxorhshs: null });
    assert.equal(result.desiredHistoryRows[0]._id, targetId);
    assert.equal(result.desiredHistoryRows[0].hmeromhnia_apoxorhshs, null);
    assert.equal(result.desiredHistoryRows[0].hmeromhnia_proslhpshs, '2026-05-01');
    assert.deepEqual(result.updateIds, [targetId]);
    assert.equal(result.canonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.equal(result.finalCanonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.equal(result.diagnostics.secondPassIdempotent, true);
    assert.deepEqual(input, before);
});

test('real MongoDB ObjectId identities survive the 0287-shaped planning copies', () => {
    const input = fixture();
    input.employee._id = new mongoose.Types.ObjectId('6a12f31fc62a2cdb72514516');
    input.history[0]._id = new mongoose.Types.ObjectId(targetId);
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(result.updateIds, [targetId]);
    assert.deepEqual(result.survivingHistoryIds, [targetId]);
    assert.equal(String(result.desiredHistoryRows[0]._id), targetId);
    assert.equal(result.desiredHistoryRows[0].hmeromhnia_apoxorhshs, null);
    assert.equal(result.desiredHistoryRows[0].hmeromhnia_lhxhs_symbashs, '2026-10-31');
    assert.equal(result.desiredHistoryRows[0].hmeromhnia_allaghs_orarioy_eos, '2026-05-07');
});

test('current-only invalid departure is blocked when target History does not match', () => {
    const result = plan(fixture({ historyDeparture: null }));
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_TARGET_MISMATCH);
});

test('History-only invalid departure is not routed through the controlled correction', () => {
    const result = plan(fixture({ currentDeparture: null }));
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_NOT_DEPARTURE_BEFORE_HIRE);
});

test('a departure after hire remains outside the legacy correction', () => {
    const result = plan(fixture({ currentDeparture: '2026-05-31',
        historyDeparture: '2026-05-31' }));
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_NOT_DEPARTURE_BEFORE_HIRE);
});

test('a competing departure for the same current cycle is blocked', () => {
    const input = fixture();
    input.history.push({ ...input.history[0], _id: 'competing-departure', aa_eggrafhs: '0002',
        hmeromhnia_apoxorhshs: '2026-06-30' });
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_COMPETING_DEPARTURE);
    assert.deepEqual(result.diagnostics.competingDepartureIds, ['competing-departure']);
});

test('a second invalid row leaves ambiguity and is blocked without deleting lifecycle evidence', () => {
    const input = fixture();
    input.history.push({ ...input.history[0], _id: 'second-invalid', aa_eggrafhs: '0002' });
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.desiredHistoryRows, []);
});

test('plan fingerprint and desired state are deterministic across repeated runs', () => {
    const input = fixture();
    const first = plan(input);
    const second = plan(input);
    assert.equal(first.planFingerprint, second.planFingerprint);
    assert.deepEqual(first.desiredHistoryRows, second.desiredHistoryRows);
    assert.deepEqual(first.survivingHistoryIds, [targetId]);
});
