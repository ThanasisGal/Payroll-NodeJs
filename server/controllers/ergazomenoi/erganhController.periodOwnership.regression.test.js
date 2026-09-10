'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dates = require('../../utils/date/mondaySundayWeek');
const ownership = require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');
const { buildWeeklyHrLifecycleProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { resolveWeeklyHrWorkflow } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowResolverService');
const { buildWeeklyRepoDeviationPreview } = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoDeviationPreviewService');
const { buildWeeklyRepoPostCheckWritePlan } = require('../../services/ergazomenoi/apasxoliseisWeeklyPostCheckWritePlanService');
const { buildWeeklyIllegalOvertimeUpdate } = require('../../services/ergazomenoi/apasxoliseisWeeklyIllegalOvertimeCalculationService');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
function section(source, from, to) {
    const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}
const period = { period_start: '2026-04-01', period_end: '2026-04-30' };
const scope = { ...period, team: 'T', company_kod: '0004', ypokatasthma: '0000',
    employee_id: 'employee', employee_kodikos: '0001',
    week_start: '2026-04-27', week_end: '2026-05-03' };
const profile = { typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, pososto_prosayxhshs_6hs_hmeras: 40 };
const cleanRows = Array.from({ length: 7 }, (_, index) => ({ ...scope, _id: `row-${index}`,
    kodikos: '0001', hmeromhnia: dates.dateKeyUtc(dates.addDaysUtc(scope.week_start, index)),
    kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: index >= 5,
    kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ', repo_apologistika: index >= 5,
    ores_ergasias: index < 5 ? 8 : 0, cards_ores_ergasias: index < 5 ? 8 : 0,
    cards_apo_ora_01: index < 5 ? '08:00' : '', cards_eos_ora_01: index < 5 ? '16:00' : '' }));
const orphan = row => ({ ...row, cards_apo_ora_01: '15:14', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, orphan_card_resolution_preview: { orphanVisible: true } });
const aprilDates = cleanRows.slice(0, 4).map(row => row.hmeromhnia);
const mayDates = cleanRows.slice(4).map(row => row.hmeromhnia);
const query = value => ({ select() { return this; }, sort() { return this; },
    session() { return this; }, async lean() { return value; } });

async function loadContext(rows, activePeriod = period) {
    let readRange;
    const loader = vm.runInNewContext(`${section(controller, 'function normalizeNaturalWeek(',
        'async function loadFinalizedWeeklyHrPresentationSnapshot')}
        ${section(controller, 'async function loadWeeklyHrContext(', 'async function loadWeeklyHrStage3DecisionContext')}
        loadWeeklyHrContext;`, { ...dates, ...ownership,
        activeEmploymentReviewPeriodScope: async () => ({ ...scope, ...activePeriod }),
        mongoose: { isValidObjectId: () => true, trusted: value => value },
        ErgazomenoiModel: { findOne: () => query({ _id: scope.employee_id, kodikos: '0001' }) },
        ProdhlomenaOrariaModel: { find: filter => { readRange = filter.hmeromhnia; return query(rows); } },
        IstorikoProslhpseonAllagonModel: { find: () => query([]) },
        CANONICAL_EMPLOYEE_PROFILE_FIELDS: '', CANONICAL_HISTORY_SELECT_FIELDS: '', REVIEW_SELECT_FIELDS: '',
        preloadBorrowedEmploymentProfileContexts: async () => new Map(),
        borrowedProfileEmployeeKey: () => 'employee', resolveEffectiveEmploymentProfileForReviewDate: () => profile,
        getWeeklyRepoProfileInfo: () => ({ effectiveProfile: profile }),
        getDailyRepoProfileInfo: () => ({ profile }),
        weeklyHrApiError: code => Object.assign(Error(code), { code }) });
    const result = await loader({ req: { session: { userTeam: 'T', companyInUse: '0004' } },
        // Deliberately wrong client ownership: server must use the active period.
        input: { ...scope, period_start: scope.week_start, period_end: scope.week_end },
        allowDeferredPresentation: true });
    assert.equal(dates.dateKeyUtc(readRange.$gte), scope.week_start);
    assert.equal(dates.dateKeyUtc(readRange.$lte), scope.week_end);
    assert.equal(result.rows.length, 7);
    return result;
}

(async () => {
    for (const orphanIndex of [4, 2]) {
        const rows = cleanRows.map((row, index) => index === orphanIndex ? orphan(row) : row);
        const context = await loadContext(rows);
        assert.deepEqual([...context.employmentDateScope.authoritative_date_set], aprilDates);
        assert.deepEqual([...context.employmentDateScope.context_only_dates], mayDates);
        const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows: context.rows, scope,
            periodScope: context.periodScope, employmentDateScope: context.employmentDateScope,
            effectiveProfile: profile });
        const isAprilProblem = orphanIndex === 2;
        assert.equal(lifecycle.requires_hr_action, isAprilProblem);
        assert.equal(lifecycle.total_pending_count > 0, isAprilProblem);
        assert.equal(lifecycle.stages.stage1.business_status,
            isAprilProblem ? 'BLOCKED' : 'DEFERRED_TO_NEXT_PERIOD');
        assert.deepEqual(lifecycle.deferred_week.current_period_writable_dates, aprilDates);
        assert.equal(lifecycle.deferred_week.display_message, 'ΑΝΑΜΟΝΗ ΠΛΗΡΟΥΣ ΕΒΔΟΜΑΔΙΑΙΟΥ ΕΛΕΓΧΟΥ');
        const workflow = resolveWeeklyHrWorkflow({ weekRows: rows, effectiveProfile: profile,
            period_scope: period, scope, actionable_date_keys: cleanRows.map(row => row.hmeromhnia) });
        assert.equal(workflow.next_required_hr_stage, isAprilProblem ? 'BLOCKED' : 'DEFERRED_TO_NEXT_PERIOD');
        const preview = buildWeeklyRepoDeviationPreview({ rows, periodStart: scope.week_start,
            periodEnd: scope.week_end, periodScope: period, asOfDate: period.period_end,
            resolveWeeklyProfile: () => ({ effectiveProfile: profile }) });
        assert.equal(preview.deviations.length > 0, isAprilProblem);
        if (!isAprilProblem) assert.equal(preview.pendingWeeks[0].status, 'DEFERRED_TO_NEXT_PERIOD');

        const helpers = vm.runInNewContext(`${section(ui, 'function currentReviewOwnershipPeriod(', 'function weeklyHrStage1Key(')}
            ${section(ui, 'function weeklyHrOrphanRows(', 'function renderWeeklyHrOrphanItem(')}
            ${section(ui, 'function compareLifecyclePendingItems(', 'function stage2LifecycleClassificationLabel(')}
            ({ naturalWeekScopeForRow, weeklyHrOrphanRows, isCurrentPeriodReviewDate, derivePeriodLifecyclePresentation });`, {
            currentEmploymentPeriodControl: { scope: period }, currentReviewRows: rows,
            stage1DateKey: dates.dateKeyUtc });
        const payload = { scope, rows, employment_date_scope: context.employmentDateScope,
            lifecycle_projection: lifecycle };
        assert.equal(helpers.naturalWeekScopeForRow(rows[0], scope.week_start, scope.week_end).period_end, period.period_end);
        assert.equal(helpers.weeklyHrOrphanRows(payload).length, isAprilProblem ? 1 : 0);
        assert.equal(helpers.isCurrentPeriodReviewDate(rows[4], payload), false);
        assert.equal(helpers.isCurrentPeriodReviewDate(rows[2], payload), true);
        const summary = helpers.derivePeriodLifecyclePresentation([payload]);
        assert.equal(summary.requires_hr_action, isAprilProblem);
        assert.equal(summary.total_pending_count > 0, isAprilProblem);
        const modal = vm.runInNewContext(`${section(ui, 'function showDetailsModal(', 'function buildReviewExportParams(')}
            showDetailsModal;`, { isCurrentPeriodReviewDate: helpers.isCurrentPeriodReviewDate,
            employmentReviewSwal: message => message });
        assert.equal(modal(rows[4]).title, 'Πληροφοριακή ημέρα άλλης περιόδου');
        // Inspect the existing write planner without executing any operation.
        const plan = buildWeeklyRepoPostCheckWritePlan({ sessionTeam: scope.team,
            companyId: scope.company_kod, apoDate: new Date(period.period_start),
            eosDate: new Date(period.period_end), employees: [{ ...profile, kodikos: '0001' }],
            rows, weeklyContextRows: rows, resolveProfileForDate: () => profile,
            buildWeeklyIllegalOvertimeUpdate });
        const targets = plan.bulkOps.map(op => rows.find(row => row._id === op.updateOne.filter._id).hmeromhnia);
        assert.deepEqual(targets, aprilDates);
    }
    const may = await loadContext(cleanRows.map((row, index) => index === 2 ? orphan(row) : row),
        { period_start: '2026-05-01', period_end: '2026-05-31' });
    assert.deepEqual([...may.employmentDateScope.authoritative_date_set], mayDates);
    assert.deepEqual([...may.employmentDateScope.context_only_dates], aprilDates);
    const mayLifecycle = buildWeeklyHrLifecycleProjection({ weekRows: may.rows, scope,
        periodScope: may.periodScope, employmentDateScope: may.employmentDateScope, effectiveProfile: profile });
    assert.equal(mayLifecycle.requires_hr_action, false);
    assert.deepEqual(mayLifecycle.deferred_week.previous_period_writable_dates, []);
    const exportFlow = section(controller, 'async function getReviewRowsForExport(', '\nasync function ');
    assert.match(exportFlow, /ownershipPeriod = await activeEmploymentReviewPeriodDates\(req\)/);
    assert.match(exportFlow, /period_start: ownershipPeriod\.period_start/);
    assert.match(exportFlow, /period_end: ownershipPeriod\.period_end/);
    console.log('PASS actual period ownership: controller read context, lifecycle, preview, UI and reverse orphan cases');
})().catch(error => { console.error(error); process.exitCode = 1; });
