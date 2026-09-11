'use strict';

const assert = require('node:assert/strict');
const {
    RESOLUTION_KIND,
    fingerprint,
    buildDeferredCrossPeriodRepoResolution
} = require('./deferredCrossPeriodRepoResolutionService');
const {
    OVERLAY_ALLOWED_FIELDS,
    applyWtoDailyAccountingOverlay
} = require('./wtoDailyAccountingOverlayService');
const {
    READY,
    REQUIRED,
    resolveWtoDailyDeferredBoundaryReadiness
} = require('./wtoDailyDeferredBoundaryReadinessService');
const { buildWtoDailySubmissionProjection } = require('./wtoDailySubmissionProjectionService');
const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');

const dates = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
    '2026-05-01', '2026-05-02', '2026-05-03'];
const deferredIdentity = { team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
    employee_id: 'employee-1', week_start: dates[0], week_end: dates[6],
    source_period_start: '2026-04-01', source_period_end: '2026-04-30' };
const deferredWeekId = JSON.stringify(Object.values(deferredIdentity));
const frozenRows = dates.map((hmeromhnia, index) => ({
    ...deferredIdentity, _id: `row-${index}`, kodikos: '1', hmeromhnia, apologistiko_biblio: true,
    kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
    kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
    adeia_apologistika: false, astheneia_apologistika: false,
    kathgoria_adeias_apologistika: index === 4 ? 'POSSIBLE_LEAVE' : '',
    apo_ora_01_apologistika: index < 5 ? '08:00' : '',
    eos_ora_01_apologistika: index < 5 ? '16:00' : '',
    cards_apo_ora_01: index < 5 ? '08:01' : '', cards_eos_ora_01: index < 5 ? '16:02' : '',
    ores_ergasias_apologistika: index < 5 ? 8 : 0,
    compensation_breakdown_apologistika: { amount: index }, gross_amount: 100 + index,
    repo_apologistika: index >= 5, lock_state: index < 4 ? 'FINALIZED' : 'OPEN',
    profile_identity: 'profile-1', profile_version: 7,
    prodhlomena: { category: index < 5 ? 'ΕΡΓ' : 'ΑΝ', from: index < 5 ? '08:00' : '' }
}));

const deferredWeek = {
    ...deferredIdentity, deferred_week_id: deferredWeekId,
    current_period_dates: dates.slice(0, 4), next_period_context_dates: dates.slice(4)
};
const sourcePeriod = { period_start: '2026-04-01', period_end: '2026-04-30' };
const targetPeriod = { period_start: '2026-05-01', period_end: '2026-05-31' };
const resolutionPeriod = targetPeriod;
const source = { row_id: 'row-3', hmeromhnia: '2026-04-30' };
const target = { row_id: 'row-4', hmeromhnia: '2026-05-01' };
const hr = { user_id: '507f191e810c19729de860ea', user_name: 'HR User', user_role: 'HR',
    resolved_at: '2026-05-04T09:00:00.000Z', resolution_reason: 'Επιλογή πραγματικού ρεπό' };
const beforeValues = [
    { row_id: source.row_id, hmeromhnia: source.hmeromhnia,
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true },
    { row_id: target.row_id, hmeromhnia: target.hmeromhnia,
        kathgoria_ergasias_apologistika: 'ΕΡΓ', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }
];
const proposedAccountingAfterValues = [
    { row_id: source.row_id, hmeromhnia: source.hmeromhnia, apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ', adeia_apologistika: false,
        astheneia_apologistika: false, kathgoria_adeias_apologistika: '',
        apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '16:00',
        ores_ergasias_apologistika: 999, compensation_breakdown_apologistika: { amount: 999 },
        gross_amount: 999 },
    { row_id: target.row_id, hmeromhnia: target.hmeromhnia, apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΑΝ', adeia_apologistika: false,
        astheneia_apologistika: false, kathgoria_adeias_apologistika: '',
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
        ores_ergasias_apologistika: 999, compensation_breakdown_apologistika: { amount: 999 },
        gross_amount: 999 }
];

function input(overrides = {}) {
    return { deferredWeek, fullWeekContext: { daily_rows: frozenRows }, source, target,
        sourcePeriod, targetPeriod, resolutionPeriod, hr, beforeValues,
        proposedAccountingAfterValues, frozenSnapshotFingerprint: 'f'.repeat(64), ...overrides };
}

const originalInput = input();
const serializedInput = JSON.stringify(originalInput);
const decision = buildDeferredCrossPeriodRepoResolution(originalInput);
assert.equal(JSON.stringify(originalInput), serializedInput);
assert.equal(decision.resolution_kind, RESOLUTION_KIND);
assert.equal(decision.period_projections.length, 2);
const aprilProjection = decision.period_projections.find((projection) => projection.side === 'SOURCE_PERIOD');
const mayProjection = decision.period_projections.find((projection) => projection.side === 'TARGET_PERIOD');
assert.deepEqual(aprilProjection.accounting_rows.map((row) => row.hmeromhnia), ['2026-04-30']);
assert.deepEqual(mayProjection.accounting_rows.map((row) => row.hmeromhnia), ['2026-05-01']);
assert.ok(aprilProjection.accounting_rows.every((row) => row.hmeromhnia <= '2026-04-30'));
assert.ok(mayProjection.accounting_rows.every((row) => row.hmeromhnia >= '2026-05-01'));
assert.match(decision.proposal_identity, /^[a-f0-9]{64}$/);
assert.match(decision.resolution_fingerprint, /^[a-f0-9]{64}$/);
assert.match(aprilProjection.projection_fingerprint, /^[a-f0-9]{64}$/);
assert.match(mayProjection.projection_fingerprint, /^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(decision.period_projections).includes('ores_ergasias_apologistika'), false);
assert.equal(JSON.stringify(decision.period_projections).includes('compensation_breakdown_apologistika'), false);
assert.equal(JSON.stringify(decision.period_projections).includes('gross_amount'), false);
for (const field of ['resolution_kind', 'deferred_week_id', 'resolution_status',
    'resolution_period_start', 'resolution_period_end', 'source_period_start', 'source_period_end',
    'target_period_start', 'target_period_end', 'resolution_reason', 'resolution_fingerprint',
    'resolved_by_user_id', 'resolved_by_user_name', 'resolved_by_user_role', 'resolved_at',
    'period_projections']) assert.ok(DecisionModel.schema.path(field), `missing optional model field ${field}`);
assert.ok(DecisionModel.schema.path('canonical_snapshot'));
assert.equal(DecisionModel.schema.path('canonical_snapshot').options.required, true);
assert.equal(DecisionModel.schema.path('resolved_by_user_id').instance, 'ObjectId');
assert.equal(DecisionModel.schema.options.autoIndex, false);
assert.equal(DecisionModel.schema.options.autoCreate, false);
for (const field of ['resolution_kind', 'deferred_week_id', 'resolution_status',
    'resolution_fingerprint', 'resolved_by_user_id', 'period_projections']) {
    assert.notEqual(DecisionModel.schema.path(field).options.required, true);
}
const deferredUniqueIndex = DecisionModel.schema.indexes().find(([, options]) =>
    options.name === 'unique_deferred_cross_period_resolution_revision');
assert.deepEqual(deferredUniqueIndex[0], { team: 1, company_kod: 1, ypokatasthma: 1,
    deferred_week_id: 1, resolution_revision: 1 });
assert.equal(deferredUniqueIndex[1].unique, true);
assert.deepEqual(deferredUniqueIndex[1].partialFilterExpression, {
    resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION', resolution_status: 'RESOLVED'
});

const repeat = buildDeferredCrossPeriodRepoResolution(input());
assert.equal(repeat.proposal_identity, decision.proposal_identity);
assert.equal(repeat.resolution_fingerprint, decision.resolution_fingerprint);
assert.deepEqual(repeat, decision);
assert.equal(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: [...frozenRows].reverse() },
    beforeValues: [...beforeValues].reverse(),
    proposedAccountingAfterValues: [...proposedAccountingAfterValues].reverse()
})).resolution_fingerprint, decision.resolution_fingerprint);
const reorderedRows = frozenRows.map((row) => Object.fromEntries(Object.entries(row).reverse()));
assert.equal(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: reorderedRows }
})).resolution_fingerprint, decision.resolution_fingerprint);

const changedCardRows = frozenRows.map((row) => ({ ...row }));
changedCardRows[0].cards_apo_ora_01 = '08:02';
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: changedCardRows }
})).resolution_fingerprint, decision.resolution_fingerprint);
assert.equal(buildDeferredCrossPeriodRepoResolution(input({
    hr: { ...hr, resolution_reason: 'Άλλη ρητή αιτιολογία' }
})).resolution_fingerprint, decision.resolution_fingerprint);
const changedAccountingRows = frozenRows.map((row) => ({ ...row }));
changedAccountingRows[2].kathgoria_ergasias_apologistika = 'ΑΝ';
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: changedAccountingRows }
})).resolution_fingerprint, decision.resolution_fingerprint);
const changedDeclaredRows = frozenRows.map((row) => ({ ...row }));
changedDeclaredRows[1].prodhlomena = { ...changedDeclaredRows[1].prodhlomena, from: '08:05' };
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: changedDeclaredRows }
})).resolution_fingerprint, decision.resolution_fingerprint);
const changedProfileRows = frozenRows.map((row) => ({ ...row }));
changedProfileRows[2].profile_version = 8;
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: changedProfileRows }
})).resolution_fingerprint, decision.resolution_fingerprint);
const changedLockRows = frozenRows.map((row) => ({ ...row }));
changedLockRows[2].lock_state = 'OPEN';
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: changedLockRows }
})).resolution_fingerprint, decision.resolution_fingerprint);
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    frozenSnapshotFingerprint: '0'.repeat(64)
})).resolution_fingerprint, decision.resolution_fingerprint);
const otherIdentity = { ...deferredIdentity, employee_id: 'employee-2' };
const otherDeferredWeek = { ...deferredWeek, ...otherIdentity,
    deferred_week_id: JSON.stringify(Object.values(otherIdentity)) };
const otherEmployeeRows = frozenRows.map((row) => ({ ...row, employee_id: 'employee-2' }));
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({ deferredWeek: otherDeferredWeek,
    fullWeekContext: { daily_rows: otherEmployeeRows } })).resolution_fingerprint,
decision.resolution_fingerprint);
assert.notEqual(buildDeferredCrossPeriodRepoResolution(input({
    source: target, target: source, sourcePeriod: targetPeriod, targetPeriod: sourcePeriod
})).resolution_fingerprint, decision.resolution_fingerprint);

const reverseDecision = buildDeferredCrossPeriodRepoResolution(input({
    source: target, target: source, sourcePeriod: targetPeriod, targetPeriod: sourcePeriod,
    proposedAccountingAfterValues: [...proposedAccountingAfterValues].reverse()
}));
assert.deepEqual(reverseDecision.period_projections.find((item) => item.side === 'SOURCE_PERIOD')
    .accounting_rows.map((row) => row.hmeromhnia), ['2026-05-01']);
assert.deepEqual(reverseDecision.period_projections.find((item) => item.side === 'TARGET_PERIOD')
    .accounting_rows.map((row) => row.hmeromhnia), ['2026-04-30']);

assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: frozenRows.slice(0, 6) }
})), (error) => error.code === 'DEFERRED_RESOLUTION_FULL_WEEK_REQUIRED');
const duplicateDateRows = frozenRows.map((row) => ({ ...row }));
duplicateDateRows[6].hmeromhnia = duplicateDateRows[5].hmeromhnia;
assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
    fullWeekContext: { daily_rows: duplicateDateRows }
})), (error) => error.code === 'DEFERRED_RESOLUTION_NATURAL_WEEK_REQUIRED');
for (const mismatch of [
    { deferredWeek: { ...deferredWeek, week_end: '2026-05-10' }, code: 'DEFERRED_RESOLUTION_WEEK_IDENTITY_MISMATCH' },
    { rows: frozenRows.map((row, index) => index === 2 ? { ...row, employee_id: 'employee-2' } : row),
        code: 'DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH' },
    { rows: frozenRows.map((row, index) => index === 2 ? { ...row, company_kod: 'company-b' } : row),
        code: 'DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH' },
    { rows: frozenRows.map((row, index) => index === 2 ? { ...row, ypokatasthma: '0002' } : row),
        code: 'DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH' }
]) {
    assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
        ...(mismatch.deferredWeek ? { deferredWeek: mismatch.deferredWeek } : {}),
        ...(mismatch.rows ? { fullWeekContext: { daily_rows: mismatch.rows } } : {})
    })), (error) => error.code === mismatch.code);
}
assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
    deferredWeek: { ...deferredWeek, deferred_week_id: 'forged' }
})), (error) => error.code === 'DEFERRED_WEEK_IDENTITY_MISMATCH');
assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
    sourcePeriod: { period_start: '2026-04-01', period_end: '2026-05-01' }
})), (error) => error.code === 'CROSS_PERIOD_RESOLUTION_PERIODS_OVERLAP');
assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({ hr: { ...hr, resolution_reason: '' } })),
    (error) => error.code === 'EXPLICIT_HR_RESOLUTION_REQUIRED');
assert.throws(() => buildDeferredCrossPeriodRepoResolution(input({
    proposedAccountingAfterValues: proposedAccountingAfterValues.map((row, index) => index === 0
        ? { ...row, kathgoria_ergasias_apologistika: { unsafe: true } } : row)
})), (error) => error.code === 'INVALID_DEFERRED_RESOLUTION_ACCOUNTING_FIELD');

const frozenBefore = JSON.stringify(frozenRows);
const aprilOverlay = applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end, decisions: [decision] });
const mayOverlay = applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: targetPeriod.period_start, periodEnd: targetPeriod.period_end, decisions: [decision] });
assert.equal(JSON.stringify(frozenRows), frozenBefore);
assert.notStrictEqual(aprilOverlay, frozenRows);
assert.equal(aprilOverlay.find((row) => row._id === 'row-3').kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.equal(mayOverlay.find((row) => row._id === 'row-4').kathgoria_ergasias_apologistika, 'ΑΝ');
assert.equal(mayOverlay.find((row) => row._id === 'row-4').kathgoria_adeias_apologistika, '');
assert.equal(mayOverlay.find((row) => row._id === 'row-4').ores_ergasias_apologistika,
    frozenRows[4].ores_ergasias_apologistika);
assert.deepEqual(mayOverlay.find((row) => row._id === 'row-4').compensation_breakdown_apologistika,
    frozenRows[4].compensation_breakdown_apologistika);
assert.equal(mayOverlay.find((row) => row._id === 'row-4').gross_amount, frozenRows[4].gross_amount);
assert.equal(OVERLAY_ALLOWED_FIELDS.some((field) => field.startsWith('ores_')), false);
assert.equal(OVERLAY_ALLOWED_FIELDS.includes('compensation_breakdown_apologistika'), false);
assert.equal(OVERLAY_ALLOWED_FIELDS.some((field) => /amount|poso|payroll|misth/i.test(field)), false);
assert.equal(OVERLAY_ALLOWED_FIELDS.includes('repo_apologistika'), false);

assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [decision, decision] }),
(error) => error.code === 'WTODAILY_OVERLAY_DECISION_AMBIGUITY');
assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [decision, { ...decision, stale: true }] }),
(error) => error.code === 'WTODAILY_OVERLAY_DECISION_AMBIGUITY');
assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [{ ...decision, conflict: true }] }),
(error) => error.code === 'WTODAILY_OVERLAY_DECISION_CONFLICT');
const duplicateProjectionDecision = JSON.parse(JSON.stringify(decision));
duplicateProjectionDecision.period_projections.push(
    JSON.parse(JSON.stringify(duplicateProjectionDecision.period_projections[0])));
assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [duplicateProjectionDecision] }),
(error) => error.code === 'WTODAILY_OVERLAY_PROJECTION_AMBIGUITY');

const collidingDecision = JSON.parse(JSON.stringify(decision));
collidingDecision.deferred_week_id = 'other-deferred-week';
collidingDecision.canonical_snapshot.identity.deferred_week_id = collidingDecision.deferred_week_id;
collidingDecision.proposal_identity = fingerprint(collidingDecision.canonical_snapshot.identity);
collidingDecision.resolution_fingerprint = fingerprint(collidingDecision.canonical_snapshot);
assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [decision, collidingDecision] }),
(error) => error.code === 'WTODAILY_OVERLAY_ROW_CONFLICT');

const revisedDecision = buildDeferredCrossPeriodRepoResolution(input({
    target: { row_id: 'row-5', hmeromhnia: '2026-05-02' },
    beforeValues: [beforeValues[0], { row_id: 'row-5', hmeromhnia: '2026-05-02',
        kathgoria_ergasias_apologistika: 'ΕΡΓ' }],
    proposedAccountingAfterValues: [proposedAccountingAfterValues[0], {
        row_id: 'row-5', hmeromhnia: '2026-05-02', apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΑΝ', adeia_apologistika: false,
        astheneia_apologistika: false, kathgoria_adeias_apologistika: '',
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' }]
}));
const firstRevision = { ...decision, _id: 'decision-1', resolution_revision: 1 };
const secondRevision = { ...revisedDecision, _id: 'decision-2', resolution_revision: 2,
    supersedes_decision_id: 'decision-1',
    supersedes_resolution_fingerprint: decision.resolution_fingerprint };
const mayFrozenForRevision = frozenRows.map((row) => row._id === 'row-5'
    ? { ...row, kathgoria_ergasias_apologistika: 'ΕΡΓ' } : row);
const revisedOverlay = applyWtoDailyAccountingOverlay({ frozenDailyResults: mayFrozenForRevision,
    periodStart: targetPeriod.period_start, periodEnd: targetPeriod.period_end,
    decisions: [firstRevision, secondRevision] });
assert.equal(revisedOverlay.find((row) => row._id === 'row-4').kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.equal(revisedOverlay.find((row) => row._id === 'row-5').kathgoria_ergasias_apologistika, 'ΑΝ');

const invalidProjectionDecision = JSON.parse(JSON.stringify(decision));
invalidProjectionDecision.period_projections[0].accounting_rows.push({
    row_id: 'row-4', hmeromhnia: '2026-05-01', kathgoria_ergasias_apologistika: 'ΑΝ'
});
const invalidProjection = invalidProjectionDecision.period_projections[0];
invalidProjection.projection_fingerprint = fingerprint({ period_start: invalidProjection.period_start,
    period_end: invalidProjection.period_end, side: invalidProjection.side,
    accounting_rows: invalidProjection.accounting_rows });
assert.throws(() => applyWtoDailyAccountingOverlay({ frozenDailyResults: frozenRows,
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    decisions: [invalidProjectionDecision] }),
(error) => error.code === 'WTODAILY_OVERLAY_ROW_OUTSIDE_PERIOD');

const requiredDeferredWeek = { ...deferredWeek, requirement_status: 'REQUIRED' };
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek], decisions: [],
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end }).status, REQUIRED);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek], decisions: [decision],
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end }).status, READY);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek], decisions: [decision],
    periodStart: targetPeriod.period_start, periodEnd: targetPeriod.period_end }).status, READY);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek], decisions: [decision, decision],
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end }).status, REQUIRED);
const missingAprilProjection = { ...decision,
    period_projections: decision.period_projections.filter((item) => item.side !== 'SOURCE_PERIOD') };
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek],
    decisions: [missingAprilProjection], periodStart: sourcePeriod.period_start,
    periodEnd: sourcePeriod.period_end }).status, REQUIRED);
const alteredProjection = JSON.parse(JSON.stringify(decision));
alteredProjection.period_projections[0].projection_fingerprint = '0'.repeat(64);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek],
    decisions: [alteredProjection], periodStart: sourcePeriod.period_start,
    periodEnd: sourcePeriod.period_end }).status, REQUIRED);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek],
    decisions: [duplicateProjectionDecision], periodStart: sourcePeriod.period_start,
    periodEnd: sourcePeriod.period_end }).status, REQUIRED);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek],
    decisions: [{ ...decision, resolution_fingerprint: '0'.repeat(64) }],
    periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end }).status, REQUIRED);
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [requiredDeferredWeek],
    decisions: [{ ...decision, stale: true }], periodStart: sourcePeriod.period_start,
    periodEnd: sourcePeriod.period_end }).status, REQUIRED);

const employees = [{ kodikos: '1', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ' }];
assert.doesNotThrow(() => buildWtoDailySubmissionProjection({ rows: mayOverlay,
    employees, branch: '0001', periodStart: targetPeriod.period_start, periodEnd: targetPeriod.period_end }));
assert.throws(() => buildWtoDailySubmissionProjection({ rows: [frozenRows[4]], employees,
    branch: '0001', periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end }),
(error) => error.code === 'WTODAILY_ROW_OUTSIDE_PERIOD');
assert.throws(() => buildWtoDailySubmissionProjection({ rows: [frozenRows[0]], employees,
    branch: '0001', periodStart: sourcePeriod.period_start, periodEnd: sourcePeriod.period_end,
    relatedProtocol: 'protocol-1' }),
(error) => error.code === 'UNSUPPORTED_WTODAILY_CORRECTIVE_SUBMISSION');

console.log('Deferred cross-period repo resolution pure foundation tests passed');
