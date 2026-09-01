'use strict';

const assert = require('assert');
const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const test = require('node:test');
const { buildArgiesByDateKey } =
    require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { employeeKey, preloadBorrowedEmploymentProfileContexts } =
    require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { preloadEffectiveHolidayContextProvider } =
    require('./apasxoliseisEffectiveHolidayContextProviderService');
const { buildStage1EffectiveHolidayDailyCalculationUpdate } =
    require('./apasxoliseisEmploymentDailyCalculationAdapterService');
const { LEAVE_PROVENANCE, classifyLeaveProvenance } =
    require('./apasxoliseisLeaveProvenanceService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');

const COMPANY_0004 = '000000000000000000000004';
const COMPANY_0008 = '000000000000000000000008';
const DATE = '2026-02-23';

function lendingEmployee(overrides = {}) {
    return { _id: 'lending-0031', team: 'THA', company_kod: COMPANY_0004,
        kodikos: '0031', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0', afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-02-18T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: new Date('2026-02-25T00:00:00.000Z'),
        afm_daneizomenoy_ergodoth: '094259216',
        kodikos_ergazomenoy_alloy_ergodoth: '0031', ...overrides };
}
function borrowingEmployee(overrides = {}) {
    return { ...lendingEmployee(), _id: 'borrowing-0031', company_kod: COMPANY_0008,
        afora_daneismo_ergazomenoy: false, ...overrides };
}
function queryModel(rows, calls) {
    return { find(filter) { calls.push(filter); return { select() {
        return { lean: async () => rows.map((row) => ({ ...row })) };
    } }; } };
}
function models(calls) {
    return { companiesModel: queryModel([{ _id: COMPANY_0008, afm: '094259216' }],
        calls.companies), employeeModel: queryModel([borrowingEmployee()], calls.employees),
    historyModel: queryModel([], calls.histories) };
}
function holidayContext(companyId) {
    const operates = companyId === COMPANY_0004;
    const companyFlags = { apasxolhsh_kata_tis_argies: operates,
        leitoyrgia_stis_mh_ypoxreotikes_argies: operates };
    return Object.freeze({ company_kodikos: companyId.slice(-4), companyFlags,
        argiesByDateKey: buildArgiesByDateKey([{ hmeromhnia: new Date(`${DATE}T00:00:00Z`),
            ypoxreotikh_argia: false, leitoyrgia_etaireias: operates,
            perigrafh: 'ΚΑΘΑΡΑ ΔΕΥΤΕΡΑ' }], companyFlags) });
}
function row() {
    return { _id: 'row-23-02', hmeromhnia: new Date(`${DATE}T00:00:00Z`),
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, cards_ores_ergasias: 0,
        argia: false, argia_apologistika: false, repo_apologistika: false,
        adeia_apologistika: false, kathgoria_adeias_apologistika: '' };
}
const operations = {
    normalizeZeroLengthCardPairs: (value) => ({ ...value }),
    resolveCardPairVerification: () => ({ hasUnresolvedCardEvidence: false }),
    buildPartialVerifiedCardUpdate: () => ({ update: {} }),
    checkBrokenProgramVsBrokenCards: () => ({}), checkEarlyOrLateCard: () => ({}),
    checkContinuousVsBrokenCards: () => ({}), checkBrokenProgramVsContinuousCards: () => ({}),
    checkNoDeclaredScheduleCards: () => ({}), checkNightHours: () => ({}),
    checkSundayHolidayHours: () => ({}),
    checkRepoAdeiaAstheneiaApologistika: ({ rec }) => rec.argia_apologistika === true
        ? { repo_apologistika: false, adeia_apologistika: false,
            kathgoria_adeias_apologistika: '' }
        : { repo_apologistika: false, adeia_apologistika: false,
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    checkOresApoysias: () => ({}), calculateAdditionalAndOverworkForDay: () => ({}),
    sanitizeAppliedRepoTransferUpdate: ({ update }) =>
        ({ sanitizedUpdate: update, diagnostics: [] })
};

test('Stage 1 classifies borrowed 0031 on 23/02 as ΑΡΓΙΑ, never POSSIBLE_LEAVE', async () => {
    assert.strictEqual(ProdhlomenaOrariaModel.schema.path('argia_apologistika')?.instance,
        'Boolean');
    const local = lendingEmployee();
    const queryCalls = { companies: [], employees: [], histories: [] };
    const borrowedProfileContexts = await preloadBorrowedEmploymentProfileContexts({
        team: 'THA', employees: [local], models: models(queryCalls) });
    assert.strictEqual(borrowedProfileContexts.get(employeeKey(local)).borrowingCompanyId,
        COMPANY_0008);
    const readsAfterBorrowingPreload = Object.values(queryCalls)
        .reduce((sum, calls) => sum + calls.length, 0);
    let duplicateBorrowingPreloads = 0;
    const holidayLoads = [];
    const provider = await preloadEffectiveHolidayContextProvider({ team: 'THA',
        employees: [local], etos: '2026', periodStart: new Date(`${DATE}T00:00:00Z`),
        periodEnd: new Date(`${DATE}T23:59:59Z`), borrowedProfileContexts,
        models: models(queryCalls),
        preloadBorrowedContexts: async () => { duplicateBorrowingPreloads += 1; return new Map(); },
        loadHolidayContext: async ({ companyId }) => {
            holidayLoads.push(companyId); return holidayContext(companyId);
        } });
    const resolved = provider.resolveForEmployeeDate({ employee: local, reviewDate: DATE });
    const plan = buildStage1EffectiveHolidayDailyCalculationUpdate({ row: row(),
        effectiveEmployee: { ...local, ...resolved.effectiveProfile },
        holidayContext: resolved.holidayContext, weeklyState: {}, operations });
    const finalRow = { ...row(), ...plan.sanitizedUpdate };
    const workflow = resolveWeeklyHrWorkflow({ weekRows: [finalRow],
        effectiveProfile: resolved.effectiveProfile, expected_date_keys: [DATE] });

    assert.strictEqual(resolved.effective_company_id, COMPANY_0008);
    assert.deepStrictEqual(holidayLoads, [COMPANY_0008]);
    assert.strictEqual(plan.noCardsDisplayStatus, 'ΑΡΓΙΑ');
    assert.strictEqual(plan.sanitizedUpdate.argia_apologistika, true);
    assert.strictEqual(plan.sanitizedUpdate.kathgoria_adeias_apologistika, '');
    assert.strictEqual(resolveDailyActualWorkFacts(finalRow).category, 'ΑΡΓΙΑ');
    assert.strictEqual(classifyLeaveProvenance(finalRow), LEAVE_PROVENANCE.NONE);
    assert.deepStrictEqual(workflow.possible_leave_days, []);
    assert.deepStrictEqual(workflow.unclassified_stage2_candidates, []);
    assert.strictEqual(duplicateBorrowingPreloads, 0);
    assert.strictEqual(Object.values(queryCalls).reduce((sum, calls) => sum + calls.length, 0),
        readsAfterBorrowingPreload);
});

test('non-borrowed Stage 1 retains lending-company holiday operation semantics', async () => {
    const local = lendingEmployee({ afora_daneismo_ergazomenoy: false });
    const provider = await preloadEffectiveHolidayContextProvider({ team: 'THA',
        employees: [local], etos: '2026', periodStart: new Date(`${DATE}T00:00:00Z`),
        periodEnd: new Date(`${DATE}T23:59:59Z`), borrowedProfileContexts: new Map(),
        loadHolidayContext: async ({ companyId }) => holidayContext(companyId) });
    const resolved = provider.resolveForEmployeeDate({ employee: local, reviewDate: DATE });
    const plan = buildStage1EffectiveHolidayDailyCalculationUpdate({ row: row(),
        effectiveEmployee: resolved.effectiveProfile,
        holidayContext: resolved.holidayContext, weeklyState: {}, operations });
    assert.strictEqual(resolved.effective_company_id, COMPANY_0004);
    assert.strictEqual(plan.noCardsDisplayStatus, 'ΑΔΕΙΑ');
    assert.strictEqual(plan.sanitizedUpdate.argia_apologistika, false);
    assert.strictEqual(plan.sanitizedUpdate.kathgoria_adeias_apologistika, 'POSSIBLE_LEAVE');
});
