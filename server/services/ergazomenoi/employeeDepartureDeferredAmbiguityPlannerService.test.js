'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PLAN_STATUSES, OPERATION, planEmployeeDepartureWithDeferredHistoryAmbiguity,
    verifyDepartureWithDeferredHistoryAmbiguity } =
    require('./employeeDepartureDeferredAmbiguityPlannerService');

const scope = { team: 'TEST', company_kod: 'company', kodikos: '0030' };
const ids = { old: '507f1f77bcf86cd799439301', overlap: '507f1f77bcf86cd799439302',
    latest: '507f1f77bcf86cd799439303' };

function profile(id, aa, from, until, scheduleFrom, scheduleUntil, facts = {}) {
    return { _id: id, ...scope, aa_eggrafhs: aa,
        hmeromhnia_proslhpshs: new Date('2026-06-27T00:00:00.000Z'),
        hmeromhnia_apoxorhshs: null,
        hmeromhnia_allaghs_symbashs: new Date(from === '2026-07-23'
            ? '2026-07-23T00:00:00.000Z' : '2026-06-27T00:00:00.000Z'),
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-15T00:00:00.000Z'),
        hmeromhnia_allaghs_orarioy_apo: new Date(`${scheduleFrom}T00:00:00.000Z`),
        hmeromhnia_allaghs_orarioy_eos: new Date(`${scheduleUntil}T00:00:00.000Z`),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date(`${from}T00:00:00.000Z`),
        hmeromhnia_isxyos_oron_ergasias_eos: until
            ? new Date(`${until}T00:00:00.000Z`) : null,
        afora_proslhpsh: aa !== '0003', afora_allagh_oron_ergasias: true,
        employment_profile_source: 'ERGOMENOI_CONTROLLER',
        kathestos_apasxolhshs: facts.regime, typos_apasxolhshs: facts.type,
        typos_ebdomadas: facts.weekType, hmeres_ergasias_ebdomadas: facts.days,
        ores_ergasias_ebdomadas: facts.hours,
        mo_oron_hmerhsias_ergasias: facts.average,
        pragmatikosMisthos: facts.wage,
        createdAt: new Date(`${scheduleFrom}T06:00:00.000Z`),
        updatedAt: new Date(`${scheduleFrom}T06:10:00.000Z`) };
}

function fixture() {
    const old = profile(ids.old, '0001', '2026-06-27', '2026-07-22',
        '2026-06-27', '2026-07-03', { regime: '2', type: '5', weekType: '',
            days: 2, hours: 16, average: 8, wage: 435.6 });
    const overlap = profile(ids.overlap, '0002', '2026-06-27', null,
        '2026-07-13', '2026-07-19', { regime: '2', type: '5', weekType: '',
            days: 4, hours: 34, average: 8.5, wage: 925.65 });
    const latest = profile(ids.latest, '0003', '2026-07-23', null,
        '2026-07-23', '2026-07-29', { regime: '0', type: '0', weekType: '5HMERH',
            days: 5, hours: 40, average: 8, wage: 1089 });
    const current = { ...latest, _id: '507f1f77bcf86cd799439300', aa_eggrafhs: undefined,
        energos: true, afora_proslhpsh: undefined, createdAt: new Date('2026-06-27T06:00:00.000Z') };
    const history = [old, overlap, latest];
    const protectedReferences = Object.fromEntries(history.map(row => [row._id, []]));
    return { current, history, protectedReferences };
}

function plan(input = fixture(), departure = '2026-09-29') {
    return planEmployeeDepartureWithDeferredHistoryAmbiguity({ scope,
        currentEmployee: input.current, completeHistoryRows: input.history,
        requestedDepartureDate: departure, protectedReferences: input.protectedReferences });
}

test('THA/0030-shaped historical overlap permits only the unique latest departure mutation', () => {
    const input = fixture();
    input.protectedReferences[ids.latest] = [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots' }];
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.APPLYABLE);
    assert.equal(result.diagnostics.operation, OPERATION);
    assert.deepEqual(result.unresolvedHistoryIds, [ids.old, ids.overlap].sort());
    assert.equal(result.latestAuthoritativeHistoryId, ids.latest);
    assert.deepEqual(result.changedHistoryIds, [ids.latest]);
    assert.deepEqual(Object.keys(result.historyPatches), [ids.latest]);
    assert.equal(result.historyPatches[ids.latest].hmeromhnia_apoxorhshs
        .toISOString(), '2026-09-29T00:00:00.000Z');
    assert.equal(result.historyPatches[ids.latest].hmeromhnia_isxyos_oron_ergasias_eos
        .toISOString(), '2026-09-29T00:00:00.000Z');
    assert.equal(result.currentPatch.energos, false);
});

test('special postcondition preserves both historical rows byte-for-byte', () => {
    const input = fixture(), result = plan(input);
    const currentAfter = { ...input.current, ...result.currentPatch };
    const historyAfter = input.history.map(row => ({ ...row,
        ...(result.historyPatches[row._id] || {}) }));
    const verified = verifyDepartureWithDeferredHistoryAmbiguity({ plan: result,
        currentBefore: input.current, historyBefore: input.history,
        currentAfter, historyAfter });
    assert.equal(verified.ok, true);
    assert.deepEqual(historyAfter[0], input.history[0]);
    assert.deepEqual(historyAfter[1], input.history[1]);
});

test('an overlap that includes the latest authoritative row remains blocked', () => {
    const input = fixture();
    input.history[1].hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-07-23T00:00:00.000Z');
    input.history[1].hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-08-01T00:00:00.000Z');
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.match(result.reason, /LATEST_PROFILE/);
});

test('ambiguous latest profile remains blocked', () => {
    const input = fixture();
    input.history.push({ ...input.history[2], _id: '507f1f77bcf86cd799439304', aa_eggrafhs: '0004' });
    input.protectedReferences['507f1f77bcf86cd799439304'] = [];
    const result = plan(input);
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.equal(result.reason, 'LATEST_PROFILE_AMBIGUOUS');
});

test('departure before hire and a stored departure cannot use the escape hatch', () => {
    assert.equal(plan(fixture(), '2026-06-26').reason, 'DEPARTURE_BEFORE_HIRE');
    const input = fixture();
    input.current.hmeromhnia_apoxorhshs = new Date('2026-09-20T00:00:00.000Z');
    assert.equal(plan(input).reason, 'NOT_FIRST_DEPARTURE');
});

test('cycle ambiguity and unsafe live dereference remain blocked', () => {
    const cycle = fixture();
    cycle.history.push({ ...cycle.history[0], _id: '507f1f77bcf86cd799439305',
        hmeromhnia_proslhpshs: new Date('2026-01-01T00:00:00.000Z') });
    cycle.protectedReferences['507f1f77bcf86cd799439305'] = [];
    assert.equal(plan(cycle).status, PLAN_STATUSES.BLOCKED);

    const refs = fixture();
    refs.protectedReferences[ids.latest] = [{ collection: 'synthetic-live' }];
    const blocked = planEmployeeDepartureWithDeferredHistoryAmbiguity({ scope,
        currentEmployee: refs.current, completeHistoryRows: refs.history,
        requestedDepartureDate: '2026-09-29', protectedReferences: refs.protectedReferences,
        referencePartitioner: values => ({ frozenProvenance: [], liveDereference: values }) });
    assert.equal(blocked.reason, 'LIVE_DEREFERENCE_BLOCKS_DEPARTURE');
});
