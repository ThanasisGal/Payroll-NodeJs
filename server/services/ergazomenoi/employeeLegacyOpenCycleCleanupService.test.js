'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PLAN_STATUSES,
    FOUNDATION_SOURCE,
    stableStringify,
    planEmployeeLegacyOpenCycleCleanup
} = require('./employeeLegacyOpenCycleCleanupService');

const scope = { team: 'BLG', company_kod: 'company-id', kodikos: '0001' };
const current = (hire = '2024-03-01') => ({
    _id: 'current-id', ...scope, hmeromhnia_proslhpshs: hire,
    hmeromhnia_apoxorhshs: null
});
const row = (id, hire, extra = {}) => ({
    _id: id, ...scope, aa_eggrafhs: id.slice(-4),
    hmeromhnia_proslhpshs: hire,
    afora_proslhpsh: true,
    afora_allagh_oron_ergasias: false,
    ...extra
});

test('legacy cleanup removes previous open corrupted cycle and preserves current cycle', () => {
    const rows = [row('old-open', '2024-01-01'), row('current-row', '2024-03-01')];
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: rows });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(plan.policyRemovedHistoryIds, ['old-open']);
    assert.deepEqual(plan.preservedHistoryIds, ['current-row']);
    assert.deepEqual(plan.desiredHistoryRows.map(item => item._id), ['current-row']);
});

test('legacy cleanup preserves a previous explicitly closed cycle unchanged', () => {
    const closed = row('closed-row', '2024-01-01', { hmeromhnia_apoxorhshs: '2024-02-01' });
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: [closed, row('current-row', '2024-03-01')] });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(plan.policyRemovedHistoryIds, []);
    const persisted = plan.desiredHistoryRows.find(item => item._id === 'closed-row');
    assert.equal(persisted.hmeromhnia_apoxorhshs, '2024-02-01');
});

test('legacy cleanup preserves closed cycle, removes open prior cycle and keeps current', () => {
    const rows = [
        row('closed-row', '2023-01-01', { hmeromhnia_apoxorhshs: '2023-02-01' }),
        row('open-row', '2024-01-01'),
        row('current-row', '2024-03-01')
    ];
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: rows });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.deepEqual(plan.policyRemovedHistoryIds, ['open-row']);
    assert.deepEqual(plan.preservedHistoryIds, ['closed-row', 'current-row']);
});

test('legacy cleanup never converts corrupted-cycle dates into a departure', () => {
    const corrupt = row('old-open', '2024-01-01', {
        hmeromhnia_lhxhs_symbashs: '2024-01-15',
        hmeromhnia_isxyos_oron_ergasias_eos: '2024-01-20',
        hmeromhnia_allaghs_orarioy_eos: '2024-01-25'
    });
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: [corrupt, row('current-row', '2024-03-01')] });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.equal(plan.desiredHistoryRows.some(item => item.hmeromhnia_apoxorhshs), false);
    assert.deepEqual(plan.policyRemovedHistoryIds, ['old-open']);
});

test('legacy cleanup leaves authoritative current employee byte-for-byte unchanged', () => {
    const employee = current();
    const before = stableStringify(employee);
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: employee,
        completeHistoryRows: [row('old-open', '2024-01-01'),
            row('current-row', '2024-03-01')] });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.equal(stableStringify(employee), before);
    assert.equal(plan.diagnostics.currentEmployeeUnchanged, true);
});

test('legacy cleanup preserves every surviving original history id', () => {
    const rows = [
        row('closed-row', '2023-01-01', { hmeromhnia_apoxorhshs: '2023-02-01' }),
        row('old-open', '2024-01-01'), row('current-row', '2024-03-01')
    ];
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: rows });
    assert.deepEqual(plan.desiredHistoryRows.filter(item => item._id).map(item => item._id),
        ['closed-row', 'current-row']);
    assert.equal(plan.insertedFoundationRows.length, 0);
});

test('missing current hire history creates one minimal sparse HIRE foundation', () => {
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: [row('old-open', '2024-01-01')] });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.equal(plan.insertedFoundationRows.length, 1);
    const foundation = plan.insertedFoundationRows[0];
    assert.equal(foundation.hmeromhnia_proslhpshs, '2024-03-01');
    assert.equal(foundation.afora_proslhpsh, true);
    assert.equal(foundation.afora_allagh_oron_ergasias, false);
    assert.equal(foundation.employment_profile_source, FOUNDATION_SOURCE);
    for (const field of ['hmeromhnia_apoxorhshs', 'hmeromhnia_isxyos_oron_ergasias_apo',
        'hmeromhnia_isxyos_oron_ergasias_eos', 'hmeromhnia_allaghs_orarioy_apo',
        'hmeromhnia_allaghs_orarioy_eos', 'hmeromhnia_lhxhs_symbashs']) {
        assert.equal(Object.hasOwn(foundation, field), false, field);
    }
});

test('legacy cleanup final canonical pass is clean and idempotent', () => {
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: [row('old-open', '2024-01-01'),
            row('current-row', '2024-03-01')] });
    assert.equal(plan.status, PLAN_STATUSES.APPLYABLE);
    assert.equal(plan.finalCanonicalResult.status, 'CLEAN');
    assert.equal(plan.finalCanonicalResult.cleanupRequired, false);
    assert.equal(plan.diagnostics.secondPassIdempotent, true);
});

test('unrelated ambiguity remaining after policy cleanup is blocked', () => {
    const conflictingA = row('current-a', '2024-03-01', {
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: '2024-03-01',
        symbash: 'A'
    });
    const conflictingB = row('current-b', '2024-03-01', {
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: '2024-03-01',
        symbash: 'B'
    });
    const plan = planEmployeeLegacyOpenCycleCleanup({ scope, currentEmployee: current(),
        completeHistoryRows: [row('old-open', '2024-01-01'), conflictingA, conflictingB] });
    assert.equal(plan.status, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY);
    assert.equal(plan.reason, 'CONFLICTING_PROFILE_EVENTS');
});
