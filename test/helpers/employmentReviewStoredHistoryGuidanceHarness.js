'use strict';
// In-memory adapters only. Execute the actual Search controller and stored
// projection; never load app.js, environment configuration or a database.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const dates = require('../../server/utils/date/mondaySundayWeek');
const read = require('../../server/services/ergazomenoi/apasxoliseisStoredReviewReadService');
const borrowed = require('../../server/services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService');
const temporal = require('../../server/utils/ergazomenoi/employmentProfileTemporal');
const source = fs.readFileSync(require.resolve('../../server/controllers/ergazomenoi/erganhController'), 'utf8');
function section(from, to) {
    const a = source.indexOf(from), b = source.indexOf(to, a + from.length);
    assert.ok(a >= 0 && b > a, from);
    return source.slice(a, b);
}
const bind = (body, deps) => Function(...Object.keys(deps), body)(...Object.values(deps));
function query(value) {
    return { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; },
        async lean() { return structuredClone(value); } };
}
function configureSearch(deps) {
    const empty = { find: () => query([]), findOne: () => query(null) };
    Object.assign(deps,
        require('../../server/controllers/ergazomenoi/erganhController').__stage3DailyEmploymentProfileTestHooks,
        require('../../server/services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService'),
        require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkContextScopeService'),
        require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService'), {
        isFullTimeWorkTerms: require('../../server/services/ergazomenoi/apasxoliseisReviewEmploymentProfileService').resolveFullTimeFromWorkTerms,
        ApasxoliseisWeeklyHrWorkflowAuditModel: empty, ApasxoliseisCompanyPolicyRuleModel: empty,
        buildWeeklyRepoDeviationPreview: () => ({ deviations: [], pendingWeeks: [] }),
        groupWeeklyReusableCases: () => [], listActiveReusablePolicyDecisionRecords: async () => [],
        attachOrphanResolutionPreviews: ({ rows }) => rows, attachSixthDayPresentationToRows: rows => rows,
        buildFullMonthBoundaryContextPreflight: () => null, stage2BulkRequestScope: () => ({}),
        loadWeeklyHrStage2BulkSearchPresentation: async () => null,
        assessDeferredCrossPeriodRequirementsBulk: () => [],
        appendStage4BlockedDeviationRows: ({ deviations }) => deviations
    });
    deps.weeklyHrStage2LifecycleProfileFromRow = bind(section('function weeklyHrStage2LifecycleProfileFromRow(',
        'function resolveWeeklyHrSearchDailyProfile(') + '; return weeklyHrStage2LifecycleProfileFromRow;', deps);
    deps.stage3AuditDecisionDatesByEmployeeWeek = bind(section('function stage3AuditDecisionDatesByEmployeeWeek(',
        'async function buildPreparedReviewLifecycleContext(') + '; return stage3AuditDecisionDatesByEmployeeWeek;', deps);
    deps.buildPreparedReviewLifecycleContext = bind(section('async function buildPreparedReviewLifecycleContext(',
        'async function loadStoredFinalizedReview(') + '; return buildPreparedReviewLifecycleContext;', deps);
    return deps;
}
async function storedHistorySearchResponse() {
    const fixture = require('../../server/services/ergazomenoi/fixtures/employee0015HistoryFixture').fixture();
    const employee = { ...fixture.currentEmployee, ypokatasthma: '0000' };
    const scope = { ...fixture.scope, ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30' };
    const rows = Array.from({ length: 7 }, (_, i) => ({ ...fixture.scope, _id: 'synthetic-day-' + i,
        employee_id: employee._id, ypokatasthma: '0000', hmeromhnia: '2026-09-' + String(i + 7).padStart(2, '0'),
        kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
        cards_apo_ora_01: i < 5 ? '08:00' : '', cards_eos_ora_01: i < 5 ? '16:00' : '',
        ores_ergasias_apologistika: i < 5 ? 8 : 0, cards_ores_ergasias: i < 5 ? 8 : 0 }));
    const before = JSON.stringify({ fixture, employee, rows });
    const empty = { find: () => query([]), findOne: () => query(null) };
    const deps = { ...dates, ...read,
        ...require('../../server/services/ergazomenoi/erganiResultFreshnessService'),
        console, mongoose: { trusted: value => value }, temporalProfile: temporal,
        isDateWithinEmploymentPeriod: require('../../server/services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService').isDateWithinEmploymentPeriod,
        finalizedEmployeeFilter: value => value,
        activeEmploymentReviewPeriodDates: async () => scope, activeEmploymentReviewPeriodScope: async () => scope,
        loadStoredFinalizedReview: async () => ({ scope, state: { stored_status: 'OPEN' }, projection: null }),
        applyEmploymentDepartureScopeToFilters: async () => ({ employees: [employee] }),
        ProdhlomenaOrariaModel: { find: () => query(rows), countDocuments: async () => rows.length },
        ErgazomenoiModel: { find: () => query([employee]) }, CompaniesModel: { findOne: () => query({}) },
        IstorikoProslhpseonAllagonModel: { find: () => query(fixture.completeHistoryRows) },
        ProdhlomenaOrariaDeviationsModel: empty, ProdhlomenaOrariaAuditModel: empty,
        ApasxoliseisWeeklyCanonicalDecisionModel: empty, ApasxoliseisWeeklyRepoTransferExecutionModel: empty,
        ApasxoliseisWeeklyHrWorkflowStateModel: empty,
        preloadBorrowedEmploymentProfileContexts: async () => new Map(), borrowedProfileEmployeeKey: borrowed.employeeKey,
        resolveEffectiveEmploymentProfileForReviewDate: borrowed.resolveEffectiveEmploymentProfileForReviewDate,
        buildPreparedPhaseHistoryMaps: () => ({}), buildReviewPhaseContextByKodikos: async () => new Map(),
        buildNoCardsDisplayContext: async () => ({}), groupWeeklyCanonicalDecisions: () => new Map(),
        resolveBreakConfigurationForDate: () => ({}), getReviewPhaseCodeForRow: () => '',
        prepareWeeklyHrStage2LifecycleRow: ({ row }) => row, classifyLeaveProvenance: () => '', LEAVE_PROVENANCE: {},
        CANONICAL_EMPLOYEE_PROFILE_FIELDS: '', CANONICAL_HISTORY_SELECT_FIELDS: '',
        detectSuspiciousShortCardInterval: () => null, resolveReviewNoCardsDisplayStatus: () => '',
        buildReviewHolidayResponseFields: () => ({}), clampDateStartUtc: value => new Date(value),
        clampDateEndUtc: value => new Date(value), asDateOnlyUtc: value => new Date(value) };
    deps.resolveWeeklyHrSearchDailyProfile = bind(section('function resolveWeeklyHrSearchDailyProfile(',
        'function findReviewOperationalPhaseForDate') + '; return resolveWeeklyHrSearchDailyProfile;', {
        getDailyRepoProfileInfo: require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService').getDailyRepoProfileInfo });
    deps.loadStoredDraftReview = bind(section('async function loadStoredDraftReview(',
        'function storedStage1Payload(') + '; return loadStoredDraftReview;', deps);
    configureSearch(deps);
    const body = section('static getProdhlomenaOrariaForReview =', 'static getProdhlomenaOrariaOrphanQualityCheck');
    const handler = bind('return (' + body.slice(body.indexOf('=') + 1).trim().replace(/;$/, '') + ');', deps);
    let payload, status = 200;
    await handler({ session: { userTeam: scope.team, companyInUse: scope.company_kod }, query: {
        apo_hmeromhnia: scope.period_start, eos_hmeromhnia: scope.period_end, ypokatasthma: '0000', kodikos: '0015' } },
    { status(value) { status = value; return this; }, json(value) { payload = value; } });
    assert.equal(status, 200, JSON.stringify(payload));
    assert.notEqual(payload.source, 'STORED_DRAFT');
    payload.stage1Payloads = payload.canonicalLifecycleProjections.map(entry => ({ ...entry,
        success: true, rows: payload.rows,
        ...require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService')
            .buildWeeklyHrWorkflowProjection({ weekRows: payload.rows, indexState: { ready: true },
                effectiveProfilesByDate: Object.fromEntries(payload.rows.map(row => [
                    dates.dateKeyUtc(row.hmeromhnia), deps.weeklyHrStage2LifecycleProfileFromRow(row)])) }),
        read_warnings: payload.read_warnings }));
    assert.equal(payload.stage1Payloads.length, 1);
    assert.equal(payload.stage1Payloads[0].lifecycle_projection.stages.stage1.business_status, 'OPEN');
    assert.equal(JSON.stringify({ fixture, employee, rows }), before);
    return JSON.parse(JSON.stringify(payload));
}
module.exports = { storedHistorySearchResponse, configureSearch };
