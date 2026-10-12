'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dates = require('../../utils/date/mondaySundayWeek');
const period = require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
const { buildWeeklyHrLifecycleProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrWorkflowProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService');
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

function exportLifecycle(rows) {
    const loop = source.match(/    for \(const \[key, \w+\] of reviewWeekRows\)/)?.[0];
    assert.ok(loop, 'Export lifecycle loop exists');
    const body = section(loop,
        '    projection.rows.__workflowStates = workflowStates;');
    assert.ok(body.length > 100, 'Execute the actual export lifecycle loop');
    return compile(`const lifecycleByWeek = new Map(); ${body}; return lifecycleByWeek;`, {
        ...common, req: request(), reviewWeekRows: new Map([[weekKey, rows]]),
        lifecycleByKodikos: new Map([['0099', employee]]), ergByKodikos: new Map(),
        workflowStateByWeek: new Map(), stage3AuditDatesByEmployeeWeek: new Map(),
        ownershipPeriod, companySettings: {}, companyPolicyRules: [], tolerateIncompleteLifecycle: true
    });
}
async function preparedLifecycle(rows) {
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
        lifecycleByKodikos: new Map([['0099', employee]]), employeeByCode: new Map(),
        periodStart: ownershipPeriod.period_start, periodEnd: ownershipPeriod.period_end })).lifecycleByWeek;
}
async function bulkPayload(rows, lifecycle) {
    rows.__preparedPolicyContextRows = rows.slice();
    rows.__lifecycleByWeek = lifecycle;
    const body = section('    static getWeeklyHrWorkflowStage1Bulk =',
        '    static exportProdhlomenaOrariaReviewAuditDossierPdf =')
        .replace('    static getWeeklyHrWorkflowStage1Bulk =', 'const read =');
    const read = compile(`${body}; return read;`, {
        ...common, buildWeeklyHrWorkflowProjection,
        activeEmploymentReviewPeriodScope: async () => ownershipPeriod,
        getReviewRowsForExport: async () => rows,
        ProdhlomenaOrariaAuditModel: { find: () => query([]) },
        stage3AuditDecisionDatesByEmployeeWeek: () => new Map(),
        validateApplySession() {}, getWeeklyRepoTransferApplyRuntimeState: async () => ({ enabled: false }),
        getWeeklyHrWorkflowIndexState: async () => ({ ready: true }),
        // A separate Stage-2 failure must not suppress the Stage-1 payload.
        buildWeeklyRepoTransferAtomicInputForPreparedWeek: () => ({
            reason: 'INCOMPLETE_EMPLOYEE_WEEK', diagnostic: { reason: 'INCOMPLETE_EMPLOYEE_WEEK' } }),
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

test('search, export and bulk Stage 1 exclude post-departure leave without changing it', async () => {
    const rows = leaveRows(); const before = structuredClone(rows);
    for (const lifecycle of [exportLifecycle(rows), await preparedLifecycle(rows)]) {
        const stage1 = lifecycle.get(weekKey).stages.stage1;
        assert.equal(stage1.business_status, 'COMPLETED');
        assert.deepEqual(stage1.blockers, []);
        const payload = await bulkPayload(rows.slice(), lifecycle);
        assert.deepEqual(payload.rows.map(row => row.hmeromhnia), ['2026-09-28']);
        assert.equal(payload.lifecycle_projection.stages.stage1.business_status, 'COMPLETED');
        assert.deepEqual(payload.workflow.blocking_reasons, []);
        assert.equal(payload.stage1_daily_presentation[0].actual_work_hours, 0);
        assert.equal(payload.stage1_daily_presentation[0].card_hours, 0);
        assert.equal(payload.stage1_daily_presentation[0].current_apologistiko_classification, 'ΑΔΕΙΑ');
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
