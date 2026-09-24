'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Controller = require('./erganhController');
const { buildWeeklyHrLifecycleProjection } = require(
    '../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');

const { prepareWeeklyHrStage3LifecycleInputs } =
    Controller.__stage3DailyEmploymentProfileTestHooks;
const employeeId = new mongoose.Types.ObjectId();
const employee = { _id: employeeId, kodikos: '0012',
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8 };
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: employeeId, employee_kodikos: employee.kodikos,
    week_start: '2026-05-04', week_end: '2026-05-10' };
const rows = Array.from({ length: 7 }, (_, index) => {
    const day = new Date('2026-05-04T00:00:00.000Z');
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const possible = ['2026-05-06', '2026-05-08'].includes(date);
    return { _id: new mongoose.Types.ObjectId(), team: scope.team,
        company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma,
        kodikos: employee.kodikos, hmeromhnia: day,
        kathgoria_ergasias: index === 0 ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: index === 0 ? 'ΕΡΓ' : '',
        ores_ergasias: possible || index === 0 ? 8 : 0,
        apo_ora_01: possible || index === 0 ? '08:00' : '',
        eos_ora_01: possible || index === 0 ? '16:00' : '',
        cards_ores_ergasias: index === 0 ? 8 : 0,
        cards_apo_ora_01: index === 0 ? '08:00' : '',
        cards_eos_ora_01: index === 0 ? '16:00' : '',
        kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
        repo_apologistika: index === 1 || index === 3,
        adeia_apologistika: false, astheneia_apologistika: false,
        apousia_apologistika: false };
});
const phases = new Map([[employee.kodikos, { operationalPhases: [
    { apo: '2026-05-01', eos: '2026-05-06', detectedKathestosCode: '0' },
    { apo: '2026-05-07', eos: '2026-05-07', detectedKathestosCode: '2' },
    { apo: '2026-05-08', eos: '2026-05-31', detectedKathestosCode: '0' }
] }]]);
function prepared() {
    return prepareWeeklyHrStage3LifecycleInputs({
        weekly: { employee, rows: rows.map((row) => ({ ...row })), histories: [],
            resolveProfileForDate: (day) => ({ ...employee,
                kathestos_apasxolhshs: String(day).slice(0, 10) === '2026-05-07'
                    ? '2' : '0' }) },
        phaseContextByKodikos: phases });
}
function project(input, persistedStage1State = null) {
    return buildWeeklyHrLifecycleProjection({ weekRows: input.preparedRows,
        effectiveProfile: input.effectiveProfile,
        effectiveProfilesByDate: input.preparedProfilesByDate,
        persistedStage1State, scope });
}
const sourceRowsBeforeProjection = JSON.stringify(rows);
const searchInputs = prepared();
const initial = project(searchInputs);
const stage1Fingerprint = initial.stages.stage1.current_completion_fingerprint;
const stage1State = { status: 'COMPLETED', version: 1,
    completion_fingerprint: stage1Fingerprint,
    effective_fingerprint: stage1Fingerprint };
const searchLifecycle = project(searchInputs, stage1State);
assert.deepEqual(searchLifecycle.stages.stage3.pending_dates, []);
assert.deepEqual(searchLifecycle.stages.stage3.stage2_automatic_resolution_items
    .filter((item) => ['2026-05-06', '2026-05-08'].includes(item.date))
    .map((item) => [item.date, item.classification, item.reason]), [
    ['2026-05-06', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION'],
    ['2026-05-08', 'REST_REPO', 'DETERMINISTIC_STAGE2_REPO_RESOLUTION']
]);
assert.equal(rows.some((row) => row.apousia_apologistika === true), false);
assert.equal(JSON.stringify(rows), sourceRowsBeforeProjection);
console.log('fresh Search deterministic FULL_TIME REST_REPO regression passed');
