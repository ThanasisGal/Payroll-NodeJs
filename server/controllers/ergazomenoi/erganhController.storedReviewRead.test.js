'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dates = require('../../utils/date/mondaySundayWeek');
const read = require('../../services/ergazomenoi/apasxoliseisStoredReviewReadService');
const source = fs.readFileSync(require.resolve('./erganhController'), 'utf8');
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
function bind(code, dependencies) { return Function(...Object.keys(dependencies), code)(...Object.values(dependencies)); }
function handler(name, next, dependencies) {
    const code = section('static ' + name + ' =', 'static ' + next);
    return bind('return (' + code.slice(code.indexOf('=') + 1).trim().replace(/;$/, '') + ');', dependencies);
}
function query(value) { return { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, async lean() { return value; } }; }
function response() { return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
function harness({ version = 3, company = 'company-A', branch = '0000', missing = false, noId = false } = {}) {
    const scope = { team: 'synthetic', company_kod: company, ypokatasthma: branch,
        period_start: '2026-09-01', period_end: '2026-09-30' };
    const snapshot = { snapshot_schema_version: 'employment-period-frozen:v' + version,
        employees: [{ _id: 'local-employee', kodikos: '001' }],
        daily_results: [{ _id: 'saved-row', kodikos: '001', ypokatasthma: branch,
            hmeromhnia: '2026-09-02', ores_ergasias_apologistika: 6.37,
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '17:00', is_locked: true }],
        canonical_decisions: [{ _id: 'decision' }], applied_repo_transfers: [{ _id: 'transfer' }],
        old_submissions: [{ protocol: 'saved-protocol' }] };
    const persisted = { snapshot, decisions: snapshot.canonical_decisions, transfers: snapshot.applied_repo_transfers,
        submissions: snapshot.old_submissions, schedules: snapshot.daily_results };
    const before = JSON.stringify(persisted);
    const reads = [];
    let writes = 0;
    const document = { frozen_snapshot: snapshot, frozen_snapshot_fingerprint: 'frozen-fingerprint' };
    const model = (name, value) => new Proxy({}, { get(_target, operation) {
        if (['find', 'findOne'].includes(operation)) return filter => {
            reads.push({ name, filter });
            assert.equal(filter.team, scope.team); assert.equal(filter.company_kod, scope.company_kod);
            assert.equal(filter.ypokatasthma, scope.ypokatasthma);
            if (name === 'snapshot') {
                assert.equal(filter._id, 'snapshot-id');
                assert.equal(filter.frozen_snapshot_fingerprint, 'frozen-fingerprint');
            }
            return query(value);
        };
        return () => { writes += 1; throw new Error('Unexpected persistence: ' + name + '.' + operation); };
    } });
    const dependencies = { ...dates, ...read,
        mongoose: { trusted: value => value }, console: { error() {} },
        activeEmploymentReviewPeriodScope: async (_req, selectedBranch) => {
            assert.equal(String(selectedBranch).padStart(4, '0'), branch); return scope;
        },
        activeEmploymentReviewPeriodDates: async () => scope,
        getPeriodControl: async () => ({ stored_status: 'FINALIZED', frozen_snapshot_id: noId ? null : 'snapshot-id',
            frozen_snapshot_fingerprint: 'frozen-fingerprint' }),
        ApasxoliseisPeriodFrozenSnapshotModel: model('snapshot', missing ? null : document),
        ApasxoliseisPeriodCorrectiveCaseModel: model('corrective', null),
        ApasxoliseisCorrectivePayrollPostingModel: model('postings', []) };
    dependencies.loadStoredFinalizedReview = bind(section('async function loadStoredFinalizedReview(',
        'async function loadStoredDraftReview(') + '; return loadStoredFinalizedReview;', dependencies);
    dependencies.storedStage1Payload = bind(section('function storedStage1Payload(',
        'async function getReviewRowsForExport(') + '; return storedStage1Payload;', dependencies);
    const request = () => ({ session: { userTeam: scope.team, companyInUse: company }, query: {
        apo_hmeromhnia: scope.period_start, eos_hmeromhnia: scope.period_end, ypokatasthma: branch,
        employee_kodikos: '001', employee_id: 'local-employee', week_start: '2026-08-31', week_end: '2026-09-06' } });
    return { dependencies, request, scope, snapshot, reads,
        verify() { assert.equal(writes, 0); assert.equal(JSON.stringify(persisted), before); } };
}

for (const version of [1, 2, 3]) test(`controller v${version}: Search, exports, individual and bulk Stage 1, four stages; no live fallback or writes`, async () => {
    for (const company of ['company-A', 'company-B']) for (const branch of ['0000', '0001']) {
        const h = harness({ version, company, branch });
        const search = handler('getProdhlomenaOrariaForReview', 'getProdhlomenaOrariaOrphanQualityCheck', h.dependencies);
        const res = response(); await search(h.request(), res);
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        assert.equal(res.body.source, 'FROZEN_FINALIZED');
        assert.equal(res.body.rows[0].ores_ergasias_apologistika, 6.37);
        assert.equal(Object.keys(res.body.canonicalLifecycleProjections[0].lifecycle_projection.stages).length, 4);
        const exportRows = bind(section('async function getReviewRowsForExport(',
            'async function buildEmploymentReviewReportForRequest') + '; return getReviewRowsForExport;', h.dependencies);
        assert.equal((await exportRows(h.request()))[0].ores_ergasias_apologistika, 6.37);
        const single = handler('getWeeklyHrWorkflowStage1', 'getWeeklyHrWorkflowStage1Bulk', h.dependencies);
        const singleRes = response(); await single(h.request(), singleRes);
        assert.equal(singleRes.statusCode, 200, JSON.stringify(singleRes.body));
        assert.equal(singleRes.body.rows[0].cards_eos_ora_01, '17:00');
        const bulk = handler('getWeeklyHrWorkflowStage1Bulk', 'exportProdhlomenaOrariaReviewAuditDossierPdf', h.dependencies);
        const req = h.request(); req.body = { ypokatasthma: branch, scopes: [req.query] };
        const bulkRes = response(); await bulk(req, bulkRes);
        assert.equal(bulkRes.statusCode, 200, JSON.stringify(bulkRes.body));
        assert.equal(bulkRes.body.payloads.length, 1);
        h.verify();
    }
});

for (const options of [{ missing: true }, { noId: true }]) test('missing finalized source cannot fall through to current data: ' + JSON.stringify(options), async () => {
    const h = harness(options); const res = response();
    await handler('getProdhlomenaOrariaForReview', 'getProdhlomenaOrariaOrphanQualityCheck', h.dependencies)(h.request(), res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'FINALIZED_SNAPSHOT_MISSING'); h.verify();
});

test('period bounds and employee identities are enforced before frozen results are returned', async () => {
    const h = harness(); const req = h.request(); req.query.eos_hmeromhnia = '2026-10-01';
    await assert.rejects(h.dependencies.loadStoredFinalizedReview(req), { code: 'PERIOD_CONTROL_SCOPE_MISMATCH' });
    const projection = await h.dependencies.loadStoredFinalizedReview(h.request());
    assert.throws(() => h.dependencies.storedStage1Payload(projection.projection,
        { ...h.request().query, employee_id: 'other-employee' }), { code: 'FINALIZED_WEEK_NOT_FOUND' });
    h.verify();
});

test('actual draft Search returns both saved employees when one profile is missing, without writes', async () => {
    const h = harness();
    const employees = [{ _id: 'local-employee', kodikos: '001', hmeromhnia_proslhpshs: '2026-01-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01' },
    { _id: 'second', kodikos: '002', hmeres_ergasias_ebdomadas: 5 }];
    const rows = [h.snapshot.daily_results[0], { ...h.snapshot.daily_results[0], _id: 'second-row', kodikos: '002' }];
    const deps = { ...h.dependencies, console,
        getPeriodControl: async () => ({ stored_status: 'OPEN' }),
        mongoose: { trusted: value => value }, temporalProfile: { profileSelect: value => value, legacyBreakQuery: () => ({}) },
        finalizedEmployeeFilter: value => value,
        applyEmploymentDepartureScopeToFilters: async () => ({ employees }),
        ProdhlomenaOrariaModel: { find: () => query(rows), countDocuments: async () => rows.length },
        ErgazomenoiModel: { find: () => query(employees) },
        CompaniesModel: { findOne: () => query({}) },
        IstorikoProslhpseonAllagonModel: { find: () => query([]) },
        ProdhlomenaOrariaDeviationsModel: { find: () => query([]) },
        ProdhlomenaOrariaAuditModel: { find: () => query([]) },
        ApasxoliseisWeeklyCanonicalDecisionModel: { find: () => query([]) },
        ApasxoliseisWeeklyRepoTransferExecutionModel: { find: () => query([]) },
        ApasxoliseisWeeklyHrWorkflowStateModel: { find: () => query([]) },
        preloadBorrowedEmploymentProfileContexts: async () => new Map(),
        borrowedProfileEmployeeKey: value => value._id,
        resolveEffectiveEmploymentProfileForReviewDate: require('../../services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService').resolveEffectiveEmploymentProfileForReviewDate,
        buildPreparedPhaseHistoryMaps: () => ({}), buildReviewPhaseContextByKodikos: async () => new Map(),
        buildNoCardsDisplayContext: async () => ({}), groupWeeklyCanonicalDecisions: () => new Map(),
        resolveBreakConfigurationForDate: () => ({}), getReviewPhaseCodeForRow: () => '',
        prepareWeeklyHrStage2LifecycleRow: ({ row }) => row,
        classifyLeaveProvenance: () => '', LEAVE_PROVENANCE: {}, CANONICAL_EMPLOYEE_PROFILE_FIELDS: '', CANONICAL_HISTORY_SELECT_FIELDS: '',
        detectSuspiciousShortCardInterval: () => null, resolveReviewNoCardsDisplayStatus: () => '', buildReviewHolidayResponseFields: () => ({}),
        clampDateStartUtc: value => new Date(value), clampDateEndUtc: value => new Date(value), asDateOnlyUtc: value => new Date(value) };
    deps.resolveWeeklyHrSearchDailyProfile = bind(section('function resolveWeeklyHrSearchDailyProfile(',
        'function findReviewOperationalPhaseForDate') + '; return resolveWeeklyHrSearchDailyProfile;', {
        getDailyRepoProfileInfo: require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService').getDailyRepoProfileInfo });
    deps.loadStoredFinalizedReview = bind(section('async function loadStoredFinalizedReview(',
        'async function loadStoredDraftReview(') + '; return loadStoredFinalizedReview;', deps);
    deps.loadStoredDraftReview = bind(section('async function loadStoredDraftReview(',
        'function storedStage1Payload(') + '; return loadStoredDraftReview;', deps);
    const before = JSON.stringify(rows); const res = response();
    await handler('getProdhlomenaOrariaForReview', 'getProdhlomenaOrariaOrphanQualityCheck', deps)(h.request(), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.rows.length, 2);
    assert.equal(res.body.read_warnings.length, 1);
    assert.equal(res.body.rows[0].ores_ergasias_apologistika, 6.37);
    assert.equal(JSON.stringify(rows), before); h.verify();
});
