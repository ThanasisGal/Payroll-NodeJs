'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { buildWeeklyHrLifecycleProjection } = require(
    './apasxoliseisWeeklyHrLifecycleProjectionService');

const employeeId = new mongoose.Types.ObjectId();
const ids = Array.from({ length: 7 }, () => new mongoose.Types.ObjectId());
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: employeeId, employee_kodikos: '0003',
    week_start: new Date('2026-05-25Z'), week_end: new Date('2026-05-31Z') };
const profile = { hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '0',
    typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH' };
const deterministicRows = ids.map((id, index) => ({ _id: id, team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0003',
    hmeromhnia: new Date(Date.UTC(2026, 4, 25 + index)),
    updatedAt: new Date('2026-09-10Z'),
    kathgoria_ergasias: index === 0 ? 'ΑΝ' : 'ΕΡΓ',
    kathgoria_ergasias_apologistika: index === 0 ? 'ΑΝ' : '',
    ores_ergasias: index === 0 ? 0 : 8,
    repo_apologistika: index === 0,
    cards_ores_ergasias: index >= 4 ? 9 : 0,
    ores_ergasias_apologistika: index >= 4 ? 9 : 0,
    kathgoria_adeias_apologistika: index >= 1 && index <= 3
        ? 'POSSIBLE_LEAVE' : '',
    apousia_apologistika: false, adeia_apologistika: false,
    astheneia_apologistika: false }));
const deterministicFingerprint = buildStage1Fingerprint(deterministicRows).fingerprint;
const deterministicProfiles = Object.fromEntries(deterministicRows.map((row) =>
    [row.hmeromhnia.toISOString().slice(0, 10), profile]));
const sourceRowsBeforeProjection = JSON.stringify(deterministicRows);
const deterministicLifecycle = buildWeeklyHrLifecycleProjection({ weekRows: deterministicRows,
    effectiveProfile: profile, effectiveProfilesByDate: deterministicProfiles,
    persistedStage1State: { status: 'COMPLETED', version: 1,
        completion_fingerprint: deterministicFingerprint,
        effective_fingerprint: deterministicFingerprint }, scope });
assert.deepEqual(deterministicLifecycle.stages.stage3.pending_dates, []);
assert.deepEqual(deterministicLifecycle.stages.stage3.stage2_automatic_resolution_items
    .filter((item) => ['2026-05-26', '2026-05-27', '2026-05-28'].includes(item.date))
    .map((item) => [item.date, item.classification, item.reason]), [
    ['2026-05-26', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION'],
    ['2026-05-27', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION'],
    ['2026-05-28', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION']
]);
assert.equal(deterministicRows.some((row) => row.apousia_apologistika === true), false);
assert.equal(JSON.stringify(deterministicRows), sourceRowsBeforeProjection);
console.log('Stage-3 bulk fixture deterministic FULL_TIME REST_REPO regression passed');
