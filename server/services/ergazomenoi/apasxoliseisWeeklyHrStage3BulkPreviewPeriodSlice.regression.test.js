'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require(
    './apasxoliseisStage1PeriodSliceService');
const { buildWeeklyHrLifecycleProjection } = require(
    './apasxoliseisWeeklyHrLifecycleProjectionService');

const ids = Array.from({ length: 7 }, () => new mongoose.Types.ObjectId());
const deterministicRows = ids.map((id, index) => ({ _id: id, team: 'THA',
    company_kod: 'company', ypokatasthma: '0000', kodikos: '0011',
    hmeromhnia: new Date(Date.UTC(2026, 3, 27 + index)),
    kathgoria_ergasias: index === 6 ? 'ΑΝ' : 'ΕΡΓ',
    ores_ergasias: index === 6 ? 0 : 8,
    cards_ores_ergasias: index >= 1 && index <= 3 ? 8 : 0,
    cards_apo_ora_01: index >= 1 && index <= 3 ? '08:00' : '',
    cards_eos_ora_01: index >= 1 && index <= 3 ? '16:00' : '',
    apo_ora_01: index === 6 ? '' : '08:00',
    eos_ora_01: index === 6 ? '' : '16:00',
    kathgoria_adeias_apologistika: [4, 5].includes(index) ? 'POSSIBLE_LEAVE' : '',
    repo: index === 6, repo_apologistika: index === 6,
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: false }));
const dates = deterministicRows.map((row) => row.hmeromhnia.toISOString().slice(0, 10));
const periodScope = { period_start: new Date('2026-05-01T00:00:00.000Z'),
    period_end: new Date('2026-05-31T00:00:00.000Z') };
const employmentDateScope = { employment_owned_dates: dates,
    authoritative_date_set: dates.filter((date) => date >= '2026-05-01'),
    context_only_dates: dates.filter((date) => date < '2026-05-01'),
    is_full_natural_week: true };
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: new mongoose.Types.ObjectId(), employee_kodikos: '0011',
    week_start: '2026-04-27', week_end: '2026-05-03' };
const profile = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0' };
const profiles = Object.fromEntries(dates.map((date) => [date, profile]));
const deterministicSlice = deriveStage1PeriodSlice({ weekRows: deterministicRows,
    week_start: scope.week_start,
    week_end: scope.week_end, period_start: periodScope.period_start,
    period_end: periodScope.period_end, employment_date_scope: employmentDateScope });
const deterministicFingerprints = buildStage1PeriodSliceFingerprints({
    weekRows: deterministicRows, slice: deterministicSlice });
const sourceRowsBeforeProjection = JSON.stringify(deterministicRows);
const deterministicLifecycle = buildWeeklyHrLifecycleProjection({
    weekRows: deterministicRows, effectiveProfile: profile,
    effectiveProfilesByDate: profiles,
    persistedStage1State: { status: 'OPEN', version: 1,
        period_slices: [{ ...deterministicSlice, status: 'COMPLETED', version: 1,
            context_fingerprint: deterministicFingerprints.context_fingerprint,
            completion_fingerprint: deterministicFingerprints.completion_fingerprint,
            effective_fingerprint: deterministicFingerprints.completion_fingerprint }] },
    scope, periodScope, employmentDateScope });
assert.deepEqual(deterministicLifecycle.stages.stage3.pending_dates, []);
assert.deepEqual(deterministicLifecycle.stages.stage3.stage2_automatic_resolution_items
    .filter((item) => ['2026-05-01', '2026-05-02'].includes(item.date))
    .map((item) => [item.date, item.classification, item.reason]), [
    ['2026-05-01', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION'],
    ['2026-05-02', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION']
]);
assert.equal(deterministicRows.some((row) => row.apousia_apologistika === true), false);
assert.deepEqual(deterministicLifecycle.employment_date_scope.context_only_dates,
    ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']);
assert.deepEqual(deterministicLifecycle.employment_date_scope.authoritative_date_set,
    ['2026-05-01', '2026-05-02', '2026-05-03']);
assert.equal(deterministicLifecycle.stages.stage1.attestation_scope, 'PERIOD_SLICE');
assert.equal(JSON.stringify(deterministicRows), sourceRowsBeforeProjection);
console.log('Stage-3 period-slice deterministic FULL_TIME REST_REPO regression passed');
