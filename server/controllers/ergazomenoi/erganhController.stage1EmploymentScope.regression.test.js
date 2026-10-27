'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dates = require('../../utils/date/mondaySundayWeek');
const period = require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
const { distinctHireDates } = require('../../services/ergazomenoi/employeeEmploymentCycleContextLoaderService');
const { buildWeeklyHrLifecycleProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrWorkflowProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService');
const { deriveStage1PeriodSlice } = require('../../services/ergazomenoi/apasxoliseisStage1PeriodSliceService');
const { buildWeeklyRepoTransferAtomicInputForPreparedWeek } = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const { resolveDailyActualWorkFacts } = require('../../services/ergazomenoi/apasxoliseisDailyActualWorkFactsService');
const source = fs.readFileSync(require.resolve('./erganhController'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const compile = (body, dependencies) => Function(...Object.keys(dependencies), body)(...Object.values(dependencies));
const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0',
    pososto_prosayxhshs_6hs_hmeras: 40 };
const ownershipPeriod = { period_start: '2026-09-01', period_end: '2026-09-30' };
const scope = { employee_id: 'synthetic-employee', employee_kodikos: '0099',
    ypokatasthma: '0000', week_start: '2026-09-28', week_end: '2026-10-04' };
const employee = { _id: scope.employee_id, kodikos: '0099',
    hmeromhnia_proslhpshs: '2026-07-07', hmeromhnia_apoxorhshs: '2026-09-28' };
const weekKey = '0099|2026-09-28';
function leaveRows() {
    return [28, 29, 30].map(day => ({ _id: `synthetic-${day}`, kodikos: '0099',
        ypokatasthma: '0000', hmeromhnia: `2026-09-${day}`,
        kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: '',
        apo_ora_01: '13:00', eos_ora_01: '21:00', ores_ergasias: 8,
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        ores_ergasias_apologistika: 8, adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ', repo: false, repo_apologistika: false,
        effective_weekly_workdays: 5, effective_typos_apasxolhshs: '0',
        effective_sixth_day_rate: 40 }));
}
function query(value) {
    return { select() { return this; }, sort() { return this; }, lean: async () => value };
}
function request() {
    return { query: {}, body: { scopes: [scope], ypokatasthma: '0000' },
        session: { userTeam: 'synthetic', companyInUse: 'synthetic-company' } };
}
const common = { ...dates, ...period, buildWeeklyHrLifecycleProjection,
    mongoose: { trusted: value => value } };

function exportLifecycle(rows, lifecycleEmployee = employee) {
    const loop = source.match(/    for \(const \[key, \w+\] of reviewWeekRows\)/)?.[0];
    assert.ok(loop, 'Export lifecycle loop exists');
    const body = section(loop,
        '    projection.rows.__workflowStates = workflowStates;');
    assert.ok(body.length > 100, 'Execute the actual export lifecycle loop');
    return compile(`const lifecycleByWeek = new Map(); ${body}; return lifecycleByWeek;`, {
        ...common, req: request(), reviewWeekRows: new Map([[weekKey, rows]]),
        lifecycleByKodikos: new Map([['0099', lifecycleEmployee]]), ergByKodikos: new Map(),
        workflowStateByWeek: new Map(), stage3AuditDatesByEmployeeWeek: new Map(),
        ownershipPeriod, companySettings: {}, companyPolicyRules: [], tolerateIncompleteLifecycle: true
    });
}
async function preparedLifecycle(rows, lifecycleEmployee = employee) {
    const body = section('async function buildPreparedReviewLifecycleContext(',
        'async function getReviewRowsForExport(');
    const readModel = { find: () => query([]) };
    const build = compile(`${body}; return buildPreparedReviewLifecycleContext;`, {
        ...common, ApasxoliseisWeeklyHrWorkflowStateModel: readModel,
        ApasxoliseisWeeklyHrWorkflowAuditModel: readModel,
        ApasxoliseisCompanyPolicyRuleModel: readModel,
        CompaniesModel: { findOne: () => query({}) },
        stage3AuditDecisionDatesByEmployeeWeek: () => new Map(),
        weeklyHrStage2LifecycleProfileFromRow: () => profile
    });
    return (await build({ req: request(), policyContextRows: rows, ownershipPeriod,
        lifecycleByKodikos: new Map([['0099', lifecycleEmployee]]), employeeByCode: new Map(),
        periodStart: ownershipPeriod.period_start, periodEnd: ownershipPeriod.period_end })).lifecycleByWeek;
}
async function bulkPayload(rows, lifecycle) {
    rows.__preparedPolicyContextRows = period.restrictWeeklyReviewRowsToEmploymentDates(
        rows, lifecycle.get(weekKey)?.employment_date_scope);
    rows.__lifecycleByWeek = lifecycle;
    const body = section('    static getWeeklyHrWorkflowStage1Bulk =',
        '    static exportProdhlomenaOrariaReviewAuditDossierPdf =')
        .replace('    static getWeeklyHrWorkflowStage1Bulk =', 'const read =');
    const read = compile(`${body}; return read;`, {
        ...common, buildWeeklyHrWorkflowProjection,
        activeEmploymentReviewPeriodScope: async () => ownershipPeriod,
        // These employment-scope fixtures exercise an open period without a frozen snapshot.
        loadStoredFinalizedReview: async () => ({
            scope: ownershipPeriod, state: { stored_status: 'OPEN' }, projection: null
        }),
        getReviewRowsForExport: async () => rows,
        ProdhlomenaOrariaAuditModel: { find: () => query([]) },
        stage3AuditDecisionDatesByEmployeeWeek: () => new Map(),
        validateApplySession() {}, getWeeklyRepoTransferApplyRuntimeState: async () => ({ enabled: false }),
        getWeeklyHrWorkflowIndexState: async () => ({ ready: true }),
        buildWeeklyRepoTransferAtomicInputForPreparedWeek,
        resolveStage3DailyActualWorkFacts: resolveDailyActualWorkFacts,
        resolveAuthoritativeHolidayClassification: () => ({ eligible: false }),
        stage1HolidayEligibilityContext: () => ({}), normalizeReviewEmploymentType: String,
        reviewErrorResponse: error => { throw error; }
    });
    let result;
    await read(request(), { json(value) { result = value; }, status() { return this; } });
    assert.equal(result.success, true);
    assert.equal(result.payloads.length, 1);
    return result.payloads[0];
}

test('28 September is the only required day of the 28 September–4 October departure week', async () => {
    const rows = leaveRows();
    Object.assign(rows[0], { hmeromhnia: new Date('2026-09-28T00:00:00.000Z'),
        adeia_apologistika: false, kathgoria_adeias_apologistika: '',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        cards_apo_ora_01: '13:00', cards_eos_ora_01: '21:00', cards_ores_ergasias: 8 });
    rows.push(...[1, 2, 3, 4].map(day => ({ ...leaveRows()[0],
        _id: `synthetic-excluded-october-${day}`, hmeromhnia: `2026-10-0${day}`,
        cards_apo_ora_01: '13:00', cards_ores_ergasias: -1 })));
    const before = structuredClone(rows);
    for (const lifecycle of [exportLifecycle(rows), await preparedLifecycle(rows)]) {
        const payload = await bulkPayload(rows.slice(), lifecycle);
        assert.deepEqual(payload.rows.map(row => dates.dateKeyUtc(row.hmeromhnia)), ['2026-09-28']);
        assert.deepEqual(payload.lifecycle_projection.employment_date_scope.employment_owned_dates, ['2026-09-28']);
        assert.deepEqual(payload.lifecycle_projection.employment_date_scope.authoritative_date_set, ['2026-09-28']);
        // The natural week crosses September, but its employment-owned dates do not.
        assert.equal(payload.lifecycle_projection.stages.stage1.period_slice, null);
        assert.throws(() => deriveStage1PeriodSlice({ weekRows: payload.rows,
            week_start: scope.week_start, week_end: scope.week_end, ...ownershipPeriod,
            employment_date_scope: payload.lifecycle_projection.employment_date_scope }),
        { code: 'STAGE1_PERIOD_SLICE_NOT_CROSS_BOUNDARY' });
        assert.deepEqual(payload.workflow.blocking_reasons, []);
        assert.deepEqual(payload.workflow.blocking_details, []);
        assert.equal(payload.lifecycle_projection.stages.stage1.business_status, 'COMPLETED');
        assert.deepEqual(payload.lifecycle_projection.stages.stage1.diagnostics, []);
        assert.equal(payload.stage1_daily_presentation[0].actual_work_hours, 8);
        assert.equal(payload.stage1_daily_presentation[0].card_hours, 8);
        for (const stage of Object.values(payload.lifecycle_projection.stages)) {
            assert.equal(stage.business_status, 'COMPLETED');
            assert.deepEqual(stage.blockers, []);
        }
    }
    assert.deepEqual(rows, before);
});

test('departure-week completeness evidence distinguishes a missing day from duplicate 28 September rows', async () => {
    const employmentDateScope = period.deriveEmploymentOwnedDateScope({
        natural_week_start: scope.week_start, natural_week_end: scope.week_end,
        ...ownershipPeriod, hire_date: employee.hmeromhnia_proslhpshs,
        departure_date: employee.hmeromhnia_apoxorhshs });
    for (const [input, missing, duplicates, actualCount] of [
        [leaveRows().slice(1), ['2026-09-28'], [], 0],
        [[...leaveRows(), { ...leaveRows()[0], _id: 'synthetic-duplicate-28',
            hmeromhnia: new Date('2026-09-28T00:00:00.000Z') }], [], ['2026-09-28'], 2]
    ]) {
        const before = structuredClone(input);
        const weekRows = period.restrictWeeklyReviewRowsToEmploymentDates(input, employmentDateScope);
        const projection = buildWeeklyHrWorkflowProjection({ weekRows, effectiveProfile: profile,
            scope, period_scope: employmentDateScope, employment_date_scope: employmentDateScope,
            expected_date_keys: employmentDateScope.employment_owned_dates });
        const diagnostic = projection.workflow.blocking_details.find(item => item.code === 'INCOMPLETE_NATURAL_WEEK');
        assert.ok(diagnostic);
        assert.deepEqual(diagnostic.evidence, { missing_dates: missing, duplicate_dates: duplicates,
            unexpected_dates: [], invalid_date_count: 0, required_count: 1, actual_count: actualCount });
        assert.throws(() => deriveStage1PeriodSlice({ weekRows,
            week_start: scope.week_start, week_end: scope.week_end, ...ownershipPeriod,
            employment_date_scope: employmentDateScope }), { code: 'INCOMPLETE_NATURAL_WEEK' });
        const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows,
            effectiveProfile: profile, scope, employmentDateScope });
        assert.equal(lifecycle.stages.stage1.business_status, 'BLOCKED');
        assert.deepEqual(lifecycle.stages.stage1.diagnostics.find(item =>
            item.code === 'INCOMPLETE_NATURAL_WEEK').evidence, diagnostic.evidence);
        if (duplicates.length) {
            const payload = await bulkPayload(input.slice(), exportLifecycle(input));
            assert.deepEqual(payload.workflow.blocking_details.find(item =>
                item.code === 'INCOMPLETE_NATURAL_WEEK').evidence, diagnostic.evidence);
        }
        assert.deepEqual(input, before);
    }
});

test('an incomplete full employment week retains its independent Stage-2 preparation diagnostic', async () => {
    const ongoingEmployee = { ...employee, hmeromhnia_apoxorhshs: null };
    const rows = [...leaveRows(), ...[1, 2, 3, 4].map(day => ({ ...leaveRows()[0],
        _id: `synthetic-active-october-${day}`, hmeromhnia: `2026-10-0${day}` }))]
        .filter(row => row.hmeromhnia !== '2026-09-29');
    for (const lifecycle of [exportLifecycle(rows, ongoingEmployee),
        await preparedLifecycle(rows, ongoingEmployee)]) {
        assert.equal(lifecycle.get(weekKey).employment_date_scope.is_full_natural_week, true);
        const payload = await bulkPayload(rows.slice(), lifecycle);
        assert.ok(payload.lifecycle_projection.stages.stage1.blockers.includes('INCOMPLETE_NATURAL_WEEK'));
        assert.deepEqual(payload.lifecycle_projection.stages.stage1.diagnostics.find(item =>
            item.code === 'INCOMPLETE_NATURAL_WEEK').evidence.missing_dates, ['2026-09-29']);
        assert.ok(payload.lifecycle_projection.stages.stage2.blockers.includes('INCOMPLETE_EMPLOYEE_WEEK'));
    }
});

test('search, export and bulk Stage 1 exclude post-departure leave without changing it', async () => {
    const rows = leaveRows(); const before = structuredClone(rows);
    for (const lifecycle of [exportLifecycle(rows), await preparedLifecycle(rows)]) {
        const stage1 = lifecycle.get(weekKey).stages.stage1;
        assert.equal(stage1.business_status, 'COMPLETED');
        assert.deepEqual(stage1.blockers, []);
        for (const stage of Object.values(lifecycle.get(weekKey).stages)) {
            assert.equal(stage.business_status, 'COMPLETED');
            assert.deepEqual(stage.blockers, []);
            assert.equal(stage.pending_count, 0);
        }
        const payload = await bulkPayload(rows.slice(), lifecycle);
        assert.deepEqual(payload.rows.map(row => row.hmeromhnia), ['2026-09-28']);
        assert.equal(payload.lifecycle_projection.stages.stage1.business_status, 'COMPLETED');
        assert.deepEqual(payload.workflow.blocking_reasons, []);
        assert.equal(payload.stage1_daily_presentation[0].actual_work_hours, 0);
        assert.equal(payload.stage1_daily_presentation[0].card_hours, 0);
        assert.equal(payload.stage1_daily_presentation[0].current_apologistiko_classification, 'ΑΔΕΙΑ');
        assert.equal(payload.lifecycle_projection.stages.stage2.business_status, 'COMPLETED');
        assert.deepEqual(payload.lifecycle_projection.stages.stage2.blockers, []);
    }
    assert.deepEqual(rows, before);
});

test('independent errors on the departure day remain blocked in search, export and bulk', async () => {
    for (const [change, reason] of [
        [{ cards_apo_ora_01: '13:00', cards_eos_ora_01: '14:00', cards_ores_ergasias: 1 },
            'FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION'],
        [{ cards_apo_ora_01: '13:00' }, 'UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'],
        [{ ores_ergasias: -1 }, 'INVALID_DECLARED_HOURS']
    ]) {
        const rows = leaveRows(); Object.assign(rows[0], change);
        for (const lifecycle of [exportLifecycle(rows), await preparedLifecycle(rows)]) {
            const payload = await bulkPayload(rows.slice(), lifecycle);
            const stage1 = payload.lifecycle_projection.stages.stage1;
            assert.equal(stage1.business_status, 'BLOCKED');
            assert.ok(stage1.blockers.includes(reason));
            assert.deepEqual(stage1.diagnostics.find(item => item.code === reason).dates, ['2026-09-28']);
        }
    }
});

test('employment filtering retains invalid dates, duplicate days and missing required days', () => {
    const employmentDateScope = period.deriveEmploymentOwnedDateScope({
        natural_week_start: scope.week_start, natural_week_end: scope.week_end,
        ...ownershipPeriod, departure_date: employee.hmeromhnia_apoxorhshs });
    const rows = leaveRows();
    for (const input of [[], [rows[0], rows[0]], [{ ...rows[0], hmeromhnia: 'invalid' }]]) {
        const result = buildWeeklyHrLifecycleProjection({
            weekRows: period.restrictWeeklyReviewRowsToEmploymentDates(input, employmentDateScope),
            effectiveProfile: profile, employmentDateScope });
        assert.ok(result.stages.stage1.blockers.includes('INCOMPLETE_NATURAL_WEEK'));
    }
});

test('before hire and a rehire gap are excluded in search, export, bulk and all lifecycle stages', async () => {
    const rehire = { ...employee, hmeromhnia_proslhpshs: '2026-10-02', hmeromhnia_apoxorhshs: null,
        employment_history: [{ ...employee }] };
    const cases = [
        { employee: { ...employee, hmeromhnia_proslhpshs: '2026-09-29', hmeromhnia_apoxorhshs: '2026-09-30' },
            owned: ['2026-09-29', '2026-09-30'] },
        { employee: rehire, owned: ['2026-09-28','2026-10-02','2026-10-03','2026-10-04'] }
    ];
    const rows = [...leaveRows(), ...[1, 2, 3, 4].map(day => ({ ...leaveRows()[0],
        _id: `synthetic-october-${day}`, hmeromhnia: `2026-10-0${day}` }))];
    const before = structuredClone(rows);
    for (const item of cases) {
        const scopeDates = period.deriveEmploymentOwnedDateScope({
            natural_week_start: scope.week_start, natural_week_end: scope.week_end,
            ...ownershipPeriod, employee: item.employee,
            hire_date: item.employee.hmeromhnia_proslhpshs, departure_date: item.employee.hmeromhnia_apoxorhshs });
        assert.deepEqual(scopeDates.employment_owned_dates, item.owned);
        for (const row of rows) {
            if (item.owned.includes(row.hmeromhnia)) {
                period.assertEmploymentReviewDateOwned(row.hmeromhnia, [item.employee]);
            } else {
                assert.throws(() => period.assertEmploymentReviewDateOwned(row.hmeromhnia, [item.employee]),
                    { code: 'EMPLOYMENT_REVIEW_DATE_OUTSIDE_EMPLOYMENT', statusCode: 409 });
            }
        }
        for (const lifecycle of [exportLifecycle(rows, item.employee), await preparedLifecycle(rows, item.employee)]) {
            const result = lifecycle.get(weekKey);
            assert.deepEqual(result.employment_date_scope.employment_owned_dates, item.owned);
            assert.deepEqual(result.stages.stage1.blockers, []);
            const payload = await bulkPayload(rows.slice(), lifecycle);
            assert.deepEqual(payload.rows.map(row => row.hmeromhnia), item.owned);
            assert.deepEqual(payload.lifecycle_projection.stages.stage2.blockers, []);
            assert.deepEqual(payload.lifecycle_projection.stages.stage3.pending_dates, []);
        }
    }
    assert.deepEqual(rows, before);
});

test('single-week commands load actual employment cycles and retain both valid sides of a rehire gap', async () => {
    const history = [{ ...employee, hmeromhnia_apoxorhshs: '2026-09-15' }];
    const current = { ...employee, hmeromhnia_proslhpshs: '2026-09-18', hmeromhnia_apoxorhshs: null };
    const rows = Array.from({ length: 7 }, (_, index) => ({ ...leaveRows()[0],
        _id: `synthetic-${14 + index}`, hmeromhnia: `2026-09-${14 + index}` }));
    const before = structuredClone({ current, history, rows });
    const body = section('async function loadWeeklyHrContext(', 'function prepareWeeklyHrStage3LifecycleInputs(');
    const read = compile(`${body}; return loadWeeklyHrContext;`, {
        ...common, distinctHireDates, mongoose: { isValidObjectId: () => true, trusted: value => value },
        normalizeNaturalWeek: () => ({ startKey: '2026-09-14', endKey: '2026-09-20',
            start: new Date('2026-09-14'), end: new Date('2026-09-20') }),
        activeEmploymentReviewPeriodScope: async () => ownershipPeriod,
        CompaniesModel: { findOne: () => query({}) },
        ErgazomenoiModel: { findOne: () => query(current) }, finalizedEmployeeFilter: value => value,
        ProdhlomenaOrariaModel: { find: () => query(rows) },
        IstorikoProslhpseonAllagonModel: { find: () => query(history) },
        CANONICAL_EMPLOYEE_PROFILE_FIELDS: '', CANONICAL_HISTORY_SELECT_FIELDS: '', REVIEW_SELECT_FIELDS: '',
        preloadBorrowedEmploymentProfileContexts: async () => new Map(), borrowedProfileEmployeeKey: () => '',
        getWeeklyRepoProfileInfo: () => ({ effectiveProfile: profile }),
        getDailyRepoProfileInfo: () => ({ profile }),
        weeklyHrApiError: (code, statusCode, message) => Object.assign(new Error(message), { code, statusCode })
    });
    const result = await read({ req: request(), input: { ...scope, week_start: '2026-09-14', week_end: '2026-09-20' } });
    assert.deepEqual(result.employmentDateScope.employment_owned_dates,
        ['2026-09-14','2026-09-15','2026-09-18','2026-09-19','2026-09-20']);
    assert.deepEqual(result.rows.map(row => row.hmeromhnia), result.employmentDateScope.employment_owned_dates);
    assert.deepEqual({ current, history, rows }, before);
});

test('daily review reads exclude before-hire and post-departure records before presentation and totals', async () => {
    const loaded = [...leaveRows(), { ...leaveRows()[0], hmeromhnia: '2026-07-06' },
        { ...leaveRows()[0], kodikos: 'missing-profile' }, { ...leaveRows()[0], hmeromhnia: 'invalid' }];
    const before = structuredClone(loaded);
    const start = source.indexOf('    const loadedReviewRows = await ProdhlomenaOrariaModel.find(reviewFilter)');
    const readBody = source.slice(start, source.indexOf(
        '    const companySettings = await loadSuspiciousShortCompanySettings(', start));
    const read = compile(`return async () => {
        ${readBody}
        return rows;
    };`, { ...period, dateKeyUtc: dates.dateKeyUtc, reviewFilter: {}, REVIEW_SELECT_FIELDS: '',
        ProdhlomenaOrariaModel: { find: () => query(loaded) },
        lifecycleEmployees: [{ ...employee, ypokatasthma: '0000' }] });
    assert.deepEqual((await read()).map(row => [row.kodikos, row.hmeromhnia]),
        [['0099','2026-09-28'], ['missing-profile','2026-09-28'], ['0099','invalid']]);
    assert.deepEqual(loaded, before);
});

test('October daily rest conflicts do not block September; current-period errors remain', () => {
    const rows = [...leaveRows(), ...[1, 2, 3, 4].map(day => ({ ...leaveRows()[0],
        _id: `synthetic-october-${day}`, hmeromhnia: `2026-10-0${day}` }))];
    Object.assign(rows[3], { adeia_apologistika: false, kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: true });
    const project = periodScope => buildWeeklyHrLifecycleProjection({ weekRows: rows,
        effectiveProfile: profile, periodScope, scope,
        employmentDateScope: period.deriveEmploymentOwnedDateScope({
            natural_week_start: scope.week_start, natural_week_end: scope.week_end, ...periodScope }) });
    assert.equal(project(ownershipPeriod).stages.stage1.business_status, 'DEFERRED_TO_NEXT_PERIOD');
    const october = project({ period_start: '2026-10-01', period_end: '2026-10-31' });
    assert.ok(october.stages.stage1.blockers.includes('CATEGORY_REPO_CONFLICT'));
    assert.deepEqual(october.stages.stage1.diagnostics.find(item =>
        item.code === 'CATEGORY_REPO_CONFLICT').dates, ['2026-10-01']);
    rows[0].cards_ores_ergasias = -1;
    const september = project(ownershipPeriod).stages.stage1;
    assert.equal(september.business_status, 'BLOCKED');
    assert.deepEqual(september.blockers, ['INVALID_CARD_HOURS']);
    assert.deepEqual(september.diagnostics[0].dates, ['2026-09-28']);
});
