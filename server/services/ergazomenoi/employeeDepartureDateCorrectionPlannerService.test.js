'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CANONICAL_STATUSES, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { PLAN_STATUSES, CLAMP_OWNERSHIP,
    planEmployeeDepartureDateCorrection } =
    require('./employeeDepartureDateCorrectionPlannerService');
const { THA_0014_SCOPE: scope, THA_0014_IDS: IDS, buildRow: row,
    buildTha0014SanitizedDepartureCorrectionFixture: legacyFixture } =
    require('./fixtures/tha0014SanitizedDepartureCorrectionFixture');
const date = value => value == null ? null : new Date(value).toISOString().slice(0, 10);

function plan(fixture = legacyFixture(), requestedDepartureDate = '2026-09-23', extra = {}) {
    return planEmployeeDepartureDateCorrection({ scope, ...fixture,
        requestedDepartureDate, ...extra });
}

test('THA/0004/0014-shaped legacy correction keeps independently recorded end unchanged', () => {
    const fixture = legacyFixture();
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY);
    assert.equal(result.clampOwnership.currentEnd, CLAMP_OWNERSHIP.INDEPENDENT);
    assert.equal(result.clampOwnership.profileEnd, CLAMP_OWNERSHIP.INDEPENDENT);
    assert.deepEqual(Object.keys(result.currentPatch), ['hmeromhnia_apoxorhshs']);
    assert.equal(date(result.currentPatch.hmeromhnia_apoxorhshs), '2026-09-23');
    assert.deepEqual(Object.keys(result.historyPatches), [IDS.terminal]);
    assert.deepEqual(Object.keys(result.historyPatches[IDS.terminal]),
        ['hmeromhnia_apoxorhshs']);
    assert.equal(date(result.historyPatches[IDS.terminal].hmeromhnia_apoxorhshs),
        '2026-09-23');
    assert.equal(date(result.desiredHistoryRows.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-20');
    assert.equal(date(fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos),
        '2026-09-20');
    assert.equal(date(fixture.currentEmployee.hmeromhnia_lhxhs_symbashs), '2026-10-31');
    assert.deepEqual(result.diagnostics.profileGap,
        ['2026-09-21', '2026-09-22', '2026-09-23']);
    assert.equal(result.canonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.equal(result.canonicalResult.cleanupRequired, false);
    assert.equal(result.secondCanonicalResult.idempotent, true);
});

test('current and History departure mismatch is blocked', () => {
    const fixture = legacyFixture();
    fixture.completeHistoryRows.find(row => row._id === IDS.terminal)
        .hmeromhnia_apoxorhshs = '2026-09-19';
    assert.equal(plan(fixture).status, PLAN_STATUSES.BLOCKED_DEPARTURE_AMBIGUITY);
});

test('multiple current-cycle departure rows are blocked', () => {
    const fixture = legacyFixture();
    fixture.completeHistoryRows.push(row('507f1f77bcf86cd799439108', '0007', {
        hmeromhnia_apoxorhshs: '2026-09-20'
    }));
    assert.equal(plan(fixture).status, PLAN_STATUSES.BLOCKED_DEPARTURE_AMBIGUITY);
});

test('requested departure before hire is blocked', () => {
    assert.equal(plan(legacyFixture(), '2026-04-24').status,
        PLAN_STATUSES.BLOCKED_INVALID_DATE);
});

test('later rehire between old and requested departure is blocked', () => {
    const fixture = legacyFixture();
    fixture.completeHistoryRows.push(row(IDS.rehire, '0007', {
        hmeromhnia_proslhpshs: '2026-09-22', afora_proslhpsh: true
    }));
    assert.equal(plan(fixture).status, PLAN_STATUSES.BLOCKED_REHIRE_CONFLICT);
});

test('unknown equal end provenance is never guessed and departure-only remains allowable', () => {
    const fixture = legacyFixture();
    fixture.departureAuditContext = [];
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY);
    assert.equal(result.clampOwnership.currentEnd, CLAMP_OWNERSHIP.UNKNOWN);
    assert.equal(result.clampOwnership.profileEnd, CLAMP_OWNERSHIP.UNKNOWN);
    assert.equal(Object.hasOwn(result.currentPatch,
        'hmeromhnia_isxyos_oron_ergasias_eos'), false);
    assert.equal(Object.hasOwn(result.historyPatches[IDS.latestProfile] || {},
        'hmeromhnia_isxyos_oron_ergasias_eos'), false);
});

test('controlled departure provenance moves only explicitly owned clamp boundaries', () => {
    const fixture = legacyFixture();
    fixture.currentEmployee.employment_departure_restore = {
        departure: '2026-09-20', terminal_id: IDS.terminal,
        profile_id: IDS.latestProfile, employee_end_clamped: true,
        profile_end_clamped: true, employee_end_before: '2026-10-15',
        profile_end_before: null
    };
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_WITH_PROVEN_CLAMP);
    assert.equal(result.clampOwnership.currentEnd, CLAMP_OWNERSHIP.DEPARTURE_OWNED);
    assert.equal(result.clampOwnership.profileEnd, CLAMP_OWNERSHIP.DEPARTURE_OWNED);
    assert.equal(date(result.currentPatch.hmeromhnia_isxyos_oron_ergasias_eos),
        '2026-09-23');
    assert.equal(date(result.historyPatches[IDS.latestProfile]
        .hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-23');
    assert.equal(result.currentPatch.employment_departure_restore.departure, '2026-09-23');
    assert.equal(date(result.currentPatch.employment_departure_restore.employee_end_before),
        '2026-10-15');
});

test('earlier departure cannot silently clamp an independent or unknown later profile end', () => {
    const fixture = legacyFixture();
    fixture.currentEmployee.hmeromhnia_apoxorhshs = '2026-09-23';
    fixture.completeHistoryRows.find(row => row._id === IDS.terminal)
        .hmeromhnia_apoxorhshs = '2026-09-23';
    fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-09-22';
    fixture.completeHistoryRows.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos = '2026-09-22';
    fixture.departureAuditContext = [];
    assert.equal(plan(fixture, '2026-09-20').status,
        PLAN_STATUSES.BLOCKED_END_PROVENANCE);
});

test('frozen provenance references are retained in an in-place correction plan', () => {
    const result = plan();
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY);
    assert.deepEqual(result.diagnostics.protectedReferenceSummary[IDS.terminal], {
        count: 1, collections: ['Apasxoliseis_Period_Frozen_Snapshots']
    });
    assert.ok(result.survivingHistoryIds.includes(IDS.terminal));
});

test('live dereference blocks the correction plan', () => {
    const result = plan(legacyFixture(), '2026-09-23', {
        referencePartitioner: references => ({ frozenProvenance: [],
            liveDereference: references })
    });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_REFERENCE);
});

test('a non-clean final canonical state blocks the plan', () => {
    let calls = 0;
    const result = plan(legacyFixture(), '2026-09-23', {
        canonicalizer: input => {
            calls += 1;
            if (calls === 1) return canonicalizeEmployeeHistory(input);
            return { status: CANONICAL_STATUSES.TRUE_AMBIGUITY, cleanupRequired: false,
                idempotent: false, rowsToDelete: [], rowsToInsert: [], events: [],
                canonicalRows: [], diagnostics: { reason: 'INJECTED_FINAL_FAILURE' } };
        }
    });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED_FINAL_CANONICAL);
});

test('repeated correction to the already stored date is an idempotent NO_OP', () => {
    const result = plan(legacyFixture(), '2026-09-20');
    assert.equal(result.status, PLAN_STATUSES.NO_OP);
    assert.deepEqual(result.currentPatch, {});
    assert.deepEqual(result.historyPatches, {});
    assert.equal(result.diagnostics.secondPassIdempotent, true);
});
