'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const controller = require('./erganhController');
const {
    buildEmploymentDailyCalculationUpdate
} = require('../../services/ergazomenoi/apasxoliseisEmploymentDailyCalculationAdapterService');
const {
    resolvePersistedApprovedOrphanResolution
} = require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService');
const {
    buildWeeklyRepoPostCheckWritePlan
} = require('../../services/ergazomenoi/apasxoliseisWeeklyPostCheckWritePlanService');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const normalCalculationStart = source.indexOf('static calcApasxolhseisPeriodoy = async');
const normalCalculationEnd = source.indexOf('static previewOrphanCardResolution',
    normalCalculationStart);
const normalCalculation = source.slice(normalCalculationStart,
    normalCalculationEnd > normalCalculationStart ? normalCalculationEnd : undefined);

assert.match(normalCalculation, /cards_apo_ora_03 cards_eos_ora_03 orphan_card_resolution/,
    'the reconstruction calculation row projection must load persisted orphan approval');

const persistedMetadata = {
    status: 'HR_APPROVED', policy_version: 'orphan-card-continuous:v1',
    orphan_type: 'START_ONLY', approved_start: '14:51', approved_end: '23:21',
    approved_hours: 8, apologistiko_book_update: false, reuse_scope: 'ONE_TIME',
    reusable_decision_rule: null, rest_risk_acknowledged: false,
    rest_conflicts: [], raw_cards_preserved: true,
    approved_by: 'ΘΑΝΑΣΗΣ', approved_at: new Date('2026-08-14T14:40:45.630Z')
};
const row = {
    _id: '6a7c515e6aeaefb3c8764b54', kodikos: '0004',
    hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
    kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '14:51', eos_ora_01: '23:21',
    ores_ergasias: 8, cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
    cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '',
    cards_eos_ora_03: '', cards_ores_ergasias: 0,
    orphan_card_resolution: persistedMetadata
};
const effectiveEmployee = {
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30
};
const approvedResolution = resolvePersistedApprovedOrphanResolution({
    row, contextRows: [row], effectiveEmployee
});
const plan = buildEmploymentDailyCalculationUpdate({
    row, effectiveEmployee, argiesDateSet: new Set(), weeklyState: null,
    operations: controller.__orphanDailyCalculationTestHooks
        .AUTHORITATIVE_DAILY_CALCULATION_OPERATIONS,
    orphanApprovedResolution: approvedResolution
});

assert.equal(plan.unresolved, false);
assert.equal(plan.sanitizedUpdate.apo_ora_01_apologistika, '14:51');
assert.equal(plan.sanitizedUpdate.eos_ora_01_apologistika, '23:21');
assert.equal(plan.sanitizedUpdate.ores_ergasias_apologistika, 8);
assert.equal(plan.sanitizedUpdate.ores_pragmatikhs_ergasias_apologistika, 8);
assert.deepEqual(plan.sanitizedUpdate.orphan_card_resolution, persistedMetadata);

const postCalculationRow = { ...row, ...plan.sanitizedUpdate };
const weekRows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date('2026-06-08T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    if (index === 6) return postCalculationRow;
    const repo = index === 5;
    return {
        _id: `week-row-${index}`, team: 'THA', company_kod: 'company',
        ypokatasthma: '0000', kodikos: '0004', hmeromhnia: date,
        kathgoria_ergasias: repo ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: repo ? 'ΑΝ' : 'ΕΡΓ',
        repo, repo_apologistika: repo, ores_ergasias: repo ? 0 : 8,
        ores_ergasias_apologistika: repo ? 0 : 8,
        ores_pragmatikhs_ergasias_apologistika: repo ? 0 : 8,
        cards_ores_ergasias: repo ? 0 : 8,
        cards_apo_ora_01: repo ? '' : '09:00', cards_eos_ora_01: repo ? '' : '17:00',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        adeia: false, adeia_apologistika: false, argia: false,
        argia_apologistika: false, astheneia: false, astheneia_apologistika: false,
        ores_apoysias: 0, ores_nyxtas_apologistika: 0,
        ores_argion_prosayxhsh_apologistika: 0,
        ores_argion_ergasia_apologistika: 0
    };
});
const postCheckPlan = buildWeeklyRepoPostCheckWritePlan({
    sessionTeam: 'THA', companyId: 'company',
    apoDate: new Date('2026-06-08T00:00:00.000Z'),
    eosDate: new Date('2026-06-14T23:59:59.999Z'),
    employees: [{ kodikos: '0004', ypokatasthma: '0000', eponymo: 'TEST', onoma: 'TEST',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0', typos_ergazomenon: 'Μ',
        nomimoOromisthio: 8, pragmatikoOromisthio: 8 }],
    rows: weekRows, istorikoRowsByKodikos: new Map(), companyPolicyRules: [],
    postCheckArgiesDateSet: new Set(), noCardsDisplayContext: {},
    appliedProtectionContext: { entriesByRowId: {} },
    appliedProtectionReasonsByWeek: new Map(),
    sameRunDailyCalculatedRowIds: new Set([String(row._id)]),
    fullNaturalWeekContext: true, buildWeeklyIllegalOvertimeUpdate: () => ({})
});
const finalOperation = postCheckPlan.bulkOps.find((operation) =>
    String(operation.updateOne.filter._id) === String(row._id));
assert.ok(finalOperation, 'the final post-check write for 0004/2026-06-14 must exist');
const finalPersistedRow = { ...postCalculationRow, ...finalOperation.updateOne.update.$set };
assert.equal(finalPersistedRow.apo_ora_01_apologistika, '14:51');
assert.equal(finalPersistedRow.eos_ora_01_apologistika, '23:21');
assert.equal(finalPersistedRow.ores_ergasias_apologistika, 8);
assert.equal(finalPersistedRow.ores_pragmatikhs_ergasias_apologistika, 8);
assert.deepEqual(finalPersistedRow.orphan_card_resolution, persistedMetadata);

console.log('fresh calculation persisted approved orphan wiring contract: PASS');
