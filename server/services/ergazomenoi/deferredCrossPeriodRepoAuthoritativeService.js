'use strict';
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ErgazomenoiModel, ErgazomenoiErganhModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const FrozenSnapshot = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const WorkflowState = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const { ATOMIC_REPO_TRANSFER_ROW_FIELDS, ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS,
    ATOMIC_REPO_TRANSFER_HISTORY_FIELDS, getWeeklyRepoProfileInfo } = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { analyzeDeferredCrossPeriodRepoTransfer, resolveRepoTransferContractVersion } = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const { buildWeeklyRepoTransferSinglePairProposal, PROPOSAL_STATUS } = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const { flowError } = require('./deferredCrossPeriodRepoHrFlowService');
const { employeeKey: borrowedProfileEmployeeKey, resolveEffectiveEmploymentProfileForReviewDate,
    preloadBorrowedEmploymentProfileContexts } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { preloadEffectiveHolidayContextProvider } = require('./apasxoliseisEffectiveHolidayContextProviderService');

const REQUIREMENT_STATUS = Object.freeze({ NOT_REQUIRED: 'NOT_REQUIRED', REQUIRED: 'REQUIRED',
    RESOLVED: 'RESOLVED', NO_VALID_REST_DAY: 'NO_VALID_REST_DAY',
    ERGANI_CORRECTION_REQUIRED: 'ERGANI_CORRECTION_REQUIRED' });
const ACCOUNTING_FIELDS = Object.freeze(['apologistiko_biblio', 'kathgoria_ergasias_apologistika', 'adeia_apologistika',
    'astheneia_apologistika', 'kathgoria_adeias_apologistika', 'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika', 'apo_ora_03_apologistika', 'eos_ora_03_apologistika']);
function dateKey(value) { return new Date(value).toISOString().slice(0, 10); }
function monthPeriod(value) { const date = new Date(`${dateKey(value)}T00:00:00Z`); return {
    period_start: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`,
    period_end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) }; }
function parseDeferredWeekId(value) { let parts; try { parts = JSON.parse(String(value || '')); } catch { parts = null; }
    if (!Array.isArray(parts) || parts.length !== 8 || !mongoose.isValidObjectId(parts[3])) throw flowError('DEFERRED_WEEK_IDENTITY_MISMATCH', 'Το deferred_week_id δεν είναι έγκυρη Phase-1 ταυτότητα.', 400);
    return { team: String(parts[0]), company_kod: String(parts[1]), ypokatasthma: String(parts[2]).padStart(4, '0'), employee_id: String(parts[3]),
        week_start: String(parts[4]), week_end: String(parts[5]), source_period_start: String(parts[6]), source_period_end: String(parts[7]), deferred_week_id: String(value) }; }
function accountingProjection(row = {}) { return Object.fromEntries(ACCOUNTING_FIELDS.filter((field) => row[field] !== undefined).map((field) => [field, row[field]])); }
function declaredProjection(row = {}) { return { category: row.kathgoria_ergasias || '', hours: row.ores_ergasias || 0,
    intervals: [1, 2, 3].map((n) => ({ from: row[`apo_ora_0${n}`] || '', to: row[`eos_ora_0${n}`] || '' })).filter((item) => item.from || item.to) }; }
function cardsProjection(row = {}) { return { hours: row.cards_ores_ergasias || 0,
    intervals: [1, 2, 3].map((n) => ({ from: row[`cards_apo_ora_0${n}`] || '', to: row[`cards_eos_ora_0${n}`] || '' })).filter((item) => item.from || item.to) }; }
function selectionCandidates(analysis = {}) { const semantic = analysis.semantic_proposal || {}; return {
    source_candidates: semantic.selectable_source_candidates || (analysis.source ? [analysis.source] : []),
    target_candidates: semantic.selectable_target_candidates || (analysis.target ? [analysis.target] : []) }; }
function assessAnalysis(analysis) {
    const candidates = selectionCandidates(analysis);
    const crossPairs = candidates.source_candidates.flatMap((source) => candidates.target_candidates
        .filter((target) => String(source.hmeromhnia || '').slice(0, 7) !== String(target.hmeromhnia || '').slice(0, 7))
        .map((target) => ({ source, target })));
    const sourceCandidates = [...new Map(crossPairs.map((pair) => [pair.source.prodhlomena_oraria_id, pair.source])).values()];
    const targetCandidates = [...new Map(crossPairs.map((pair) => [pair.target.prodhlomena_oraria_id, pair.target])).values()];
    const hasSource = candidates.source_candidates.length > 0 || Boolean(analysis.source);
    const noValidTargetReason = (analysis.reasons || []).some((reason) =>
        String(reason).startsWith('NO_TARGET') || String(reason).startsWith('TARGET_') ||
        reason === 'SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN' ||
        reason === 'ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION');
    const noValidTarget = candidates.target_candidates.length === 0 && noValidTargetReason &&
        (hasSource || (analysis.reasons || []).includes('SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN'));
    return { requirement_status: crossPairs.length ? REQUIREMENT_STATUS.REQUIRED :
        noValidTarget ? REQUIREMENT_STATUS.NO_VALID_REST_DAY : REQUIREMENT_STATUS.NOT_REQUIRED,
        reasons: analysis.reasons || [], source_candidates: sourceCandidates, target_candidates: targetCandidates };
}

async function loadAuthoritativeWeekContext({ deferredWeek, models = {} }) {
    const rowModel = models.rowModel || ProdhlomenaOrariaModel; const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel || IstorikoProslhpseonAllagonModel; const frozenModel = models.frozenModel || FrozenSnapshot;
    const workflowModel = models.workflowModel || WorkflowState;
    const storedWorkflow = await workflowModel.findOne({ team: deferredWeek.team, company_kod: deferredWeek.company_kod, ypokatasthma: deferredWeek.ypokatasthma,
        employee_id: new mongoose.Types.ObjectId(deferredWeek.employee_id), week_start: new Date(`${deferredWeek.week_start}T00:00:00Z`),
        week_end: new Date(`${deferredWeek.week_end}T00:00:00Z`) }).select('employee_id employee_kodikos week_start week_end').lean();
    const frozen = await frozenModel.findOne({ team: deferredWeek.team, company_kod: deferredWeek.company_kod, ypokatasthma: deferredWeek.ypokatasthma,
        period_start: new Date(`${deferredWeek.source_period_start}T00:00:00Z`), period_end: new Date(`${deferredWeek.source_period_end}T00:00:00Z`) })
        .select('frozen_snapshot_fingerprint frozen_snapshot.employees frozen_snapshot.daily_results').lean();
    const frozenRow = (frozen?.frozen_snapshot?.daily_results || []).find((item) =>
        String(item.effective_profile_employee_id || '') === deferredWeek.employee_id);
    const workflow = storedWorkflow || (frozenRow ? { employee_id: new mongoose.Types.ObjectId(deferredWeek.employee_id),
        employee_kodikos: String(frozenRow.kodikos || ''), week_start: new Date(`${deferredWeek.week_start}T00:00:00Z`),
        week_end: new Date(`${deferredWeek.week_end}T00:00:00Z`) } : null);
    if (!workflow) throw flowError('DEFERRED_WEEK_IDENTITY_MISMATCH',
        'Δεν βρέθηκε authoritative frozen ταυτότητα για την οριακή εβδομάδα.');
    const current = await employeeModel.findOne({ _id: workflow.employee_id, team: deferredWeek.team, company_kod: deferredWeek.company_kod })
        .select(ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS).lean();
    const frozenEmployee = (frozen?.frozen_snapshot?.employees || []).find((item) => String(item.kodikos) === String(workflow.employee_kodikos));
    const employee = frozenEmployee ? { ...(current || {}), ...frozenEmployee, _id: workflow.employee_id,
        kodikos: workflow.employee_kodikos, ypokatasthma: deferredWeek.ypokatasthma } : current;
    if (!employee) throw flowError('DEFERRED_RESOLUTION_FROZEN_EMPLOYEE_IDENTITY_MISSING', 'Δεν υπάρχει frozen ή τρέχουσα authoritative ταυτότητα εργαζομένου.');
    const [weekRows, history] = await Promise.all([rowModel.find({ team: deferredWeek.team, company_kod: deferredWeek.company_kod,
        ypokatasthma: deferredWeek.ypokatasthma, kodikos: workflow.employee_kodikos, hmeromhnia: mongoose.trusted({
            $gte: new Date(`${deferredWeek.week_start}T00:00:00Z`), $lte: new Date(`${deferredWeek.week_end}T23:59:59.999Z`) }) })
        .select(ATOMIC_REPO_TRANSFER_ROW_FIELDS).sort({ hmeromhnia: 1 }).lean(), historyModel.find({ team: deferredWeek.team,
            company_kod: deferredWeek.company_kod, kodikos: workflow.employee_kodikos }).select(ATOMIC_REPO_TRANSFER_HISTORY_FIELDS)
        .sort({ hmeromhnia_isxyos_oron_ergasias_apo: 1, hmeromhnia_allaghs_orarioy_apo: 1 }).lean()]);
    const rows = weekRows.map((row) => ({ ...row, row_id: String(row._id), employee_id: String(workflow.employee_id), employee_kodikos: workflow.employee_kodikos }));
    const borrowedContexts = models.borrowedContexts || await preloadBorrowedEmploymentProfileContexts({ team: deferredWeek.team,
        employees: [employee], models: { employeeModel, historyModel, companiesModel: models.companiesModel } });
    const borrowedContext = borrowedContexts.get(borrowedProfileEmployeeKey(employee)) || null;
    const resolveProfileForDate = (reviewDate) => resolveEffectiveEmploymentProfileForReviewDate({
        reviewDate, normalEmployee: employee, normalHistory: history, borrowedContext });
    const weeklyProfile = getWeeklyRepoProfileInfo({ week: { weekStart: new Date(`${deferredWeek.week_start}T00:00:00Z`),
        weekEnd: new Date(`${deferredWeek.week_end}T00:00:00Z`), naturalWeekEnd: new Date(`${deferredWeek.week_end}T00:00:00Z`) }, istorikoRows: history, ergazomenos: employee });
    const holidayProvider = models.holidayProvider || await preloadEffectiveHolidayContextProvider({ team: deferredWeek.team,
        employees: [employee], etos: deferredWeek.week_start.slice(0, 4),
        periodStart: new Date(`${deferredWeek.week_start}T00:00:00Z`), periodEnd: new Date(`${deferredWeek.week_end}T23:59:59.999Z`),
        normalHistoryByEmployeeKey: new Map([[borrowedProfileEmployeeKey(employee), history]]),
        borrowedProfileContexts: borrowedContexts, models });
    const holidayByDateKey = new Map();
    for (const row of rows) { const resolution = holidayProvider.resolveForEmployeeDate({ employee,
        reviewDate: row.hmeromhnia, normalHistory: history });
        if (resolution.blocked) throw flowError('DEFERRED_RESOLUTION_HOLIDAY_CONTEXT_BLOCKED', resolution.resolution_reason || 'Δεν επιλύθηκε η εταιρεία αργιών.');
        const holiday = resolution.holidayContext.argiesByDateKey.get(dateKey(row.hmeromhnia));
        if (holiday) holidayByDateKey.set(dateKey(row.hmeromhnia), holiday); }
    return { workflow, frozen, employee, history, rows, holidayByDateKey,
        employmentProfile: { ...weeklyProfile.effectiveProfile, ...getWeeklyRepoProfileInfo({ week: {
            weekStart: new Date(`${deferredWeek.week_start}T00:00:00Z`), weekEnd: new Date(`${deferredWeek.week_end}T00:00:00Z`),
            naturalWeekEnd: new Date(`${deferredWeek.week_end}T00:00:00Z`) }, istorikoRows: history,
        ergazomenos: employee, resolveProfileForDate }).effectiveProfile } };
}
async function assessDeferredCrossPeriodRequirement({ deferredWeekId, session, models = {} }) {
    const deferredWeek = parseDeferredWeekId(deferredWeekId);
    if (deferredWeek.team !== String(session.userTeam) || deferredWeek.company_kod !== String(session.companyInUse)) throw flowError(
        'DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH', 'Η deferred εβδομάδα δεν ανήκει στην ενεργή εταιρεία.', 403);
    const context = await loadAuthoritativeWeekContext({ deferredWeek, models });
    const dates = new Set(context.rows.map((row) => dateKey(row.hmeromhnia)));
    if (context.rows.length !== 7 || dates.size !== 7) throw flowError('DEFERRED_RESOLUTION_FULL_WEEK_REQUIRED',
        'Δεν είναι ακόμη διαθέσιμο πλήρες authoritative επταήμερο.');
    const analysis = analyzeDeferredCrossPeriodRepoTransfer({ weekRows: context.rows,
        employmentProfile: context.employmentProfile, holidayByDateKey: context.holidayByDateKey });
    const assessed = assessAnalysis(analysis);
    if (assessed.requirement_status === REQUIREMENT_STATUS.REQUIRED) {
        const submissionModel = models.submissionModel || ErgazomenoiErganhModel;
        const priorSubmission = await submissionModel.findOne({ team: deferredWeek.team,
            companykod_object: deferredWeek.company_kod, ypokatasthma_kodikos: deferredWeek.ypokatasthma,
            employment_period_start: new Date(`${deferredWeek.source_period_start}T00:00:00Z`),
            employment_period_end: new Date(`${deferredWeek.source_period_end}T00:00:00Z`),
            submission_code: 'WTODailyA', submission_status: 'SUCCESS', is_final: true,
            document_status: 'ACTIVE' }).lean();
        if (priorSubmission) assessed.requirement_status = REQUIREMENT_STATUS.ERGANI_CORRECTION_REQUIRED;
    }
    return { deferredWeek, context, analysis, ...assessed };
}

function preparedProfileFromRow(row = {}) {
    return {
        hmeres_ergasias_ebdomadas: row.effective_weekly_workdays,
        ores_ergasias_ebdomadas: row.effective_weekly_hours,
        mo_oron_hmerhsias_ergasias: row.effective_daily_hours,
        kathestos_apasxolhshs: row.effective_kathestos_apasxolhshs,
        typos_apasxolhshs: row.effective_typos_apasxolhshs,
        typos_ebdomadas: row.effective_typos_ebdomadas,
        pososto_prosayxhshs_6hs_hmeras: row.effective_sixth_day_rate,
        eidikh_kathgoria_ergazomenoy: row.effective_special_category,
        eidikh_periptosh: row.effective_special_case
    };
}

function assessDeferredCrossPeriodRequirementsBulk({ deferredWeekIds, session,
    preparedRows, submittedSourcePeriods = new Set() }) {
    const rows = Array.isArray(preparedRows) ? preparedRows : [];
    const parsed = [...new Set(deferredWeekIds || [])].map(parseDeferredWeekId);
    const rowsByEmployee = new Map();
    for (const row of rows) {
        const employeeId = String(row.effective_profile_employee_id || row.employee_id || '');
        const employeeCode = String(row.kodikos || row.employee_kodikos || '');
        for (const identity of [employeeId, employeeCode].filter(Boolean)) {
            if (!rowsByEmployee.has(identity)) rowsByEmployee.set(identity, []);
            rowsByEmployee.get(identity).push(row);
        }
    }
    return parsed.map((deferredWeek) => {
        if (deferredWeek.team !== String(session.userTeam) ||
            deferredWeek.company_kod !== String(session.companyInUse)) {
            throw flowError('DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH',
                'Η deferred εβδομάδα δεν ανήκει στην ενεργή εταιρεία.', 403);
        }
        const candidates = rowsByEmployee.get(deferredWeek.employee_id) || [];
        const weekRows = candidates.filter((row) => {
            const key = dateKey(row.hmeromhnia);
            return key >= deferredWeek.week_start && key <= deferredWeek.week_end &&
                String(row.ypokatasthma || '').padStart(4, '0') === deferredWeek.ypokatasthma;
        }).sort((left, right) => dateKey(left.hmeromhnia).localeCompare(dateKey(right.hmeromhnia)));
        const dates = new Set(weekRows.map((row) => dateKey(row.hmeromhnia)));
        if (weekRows.length !== 7 || dates.size !== 7) throw flowError(
            'DEFERRED_RESOLUTION_FULL_WEEK_REQUIRED',
            'Δεν είναι ακόμη διαθέσιμο πλήρες authoritative επταήμερο.');
        const holidayByDateKey = new Map(weekRows.filter((row) =>
            row.holiday_is_mandatory === true || row.holiday_is_optional === true ||
            row.argia === true || row.argia_apologistika === true
        ).map((row) => [dateKey(row.hmeromhnia), {
            description: row.holiday_description || '',
            isMandatoryHoliday: row.holiday_is_mandatory === true,
            isOptionalHoliday: row.holiday_is_optional === true,
            companyOperatesOnHoliday: row.holiday_company_operates === true,
            blocksRepoTransfer: row.holiday_blocks_repo_transfer === true
        }]));
        const analysis = analyzeDeferredCrossPeriodRepoTransfer({ weekRows,
            employmentProfile: preparedProfileFromRow(weekRows.at(-1)), holidayByDateKey });
        const assessed = assessAnalysis(analysis);
        const sourcePeriodKey = `${deferredWeek.source_period_start}|${deferredWeek.source_period_end}`;
        if (assessed.requirement_status === REQUIREMENT_STATUS.REQUIRED &&
            submittedSourcePeriods.has(sourcePeriodKey)) {
            assessed.requirement_status = REQUIREMENT_STATUS.ERGANI_CORRECTION_REQUIRED;
        }
        return { deferredWeek, analysis, ...assessed };
    });
}
async function reconstructAuthoritativeDeferredCrossPeriod({ command, session, resolutionPeriod, models = {} }) {
    const assessed = await assessDeferredCrossPeriodRequirement({ deferredWeekId: command.deferred_week_id, session, models });
    if (assessed.requirement_status !== REQUIREMENT_STATUS.REQUIRED) throw flowError('DEFERRED_CROSS_PERIOD_REPO_RESOLUTION_NOT_REQUIRED', 'Η ολοκληρωμένη εβδομάδα δεν απαιτεί απόφαση μεταφοράς ρεπό.');
    const proposal = buildWeeklyRepoTransferSinglePairProposal({ weekRows: assessed.context.rows, employmentProfile: assessed.context.employmentProfile,
        holidayByDateKey: assessed.context.holidayByDateKey,
        contractVersion: resolveRepoTransferContractVersion(assessed.context.employmentProfile) }, { analyzer: analyzeDeferredCrossPeriodRepoTransfer,
        selectedSourceRowId: command.source_row_id, selectedTargetRowId: command.target_row_id });
    if (proposal.proposal_status !== PROPOSAL_STATUS.READY || proposal.items?.length !== 2) throw flowError('DEFERRED_CROSS_PERIOD_CANDIDATE_SELECTION_REQUIRED', 'Επιλέξτε έγκυρο source και target από τους authoritative υποψηφίους.');
    const sourceItem = proposal.items.find((item) => item.role === 'SOURCE_BECOMES_WORK'); const targetItem = proposal.items.find((item) => item.role === 'TARGET_BECOMES_REPO');
    const submissionModel = models.submissionModel || ErgazomenoiErganhModel;
    const priorSubmission = await submissionModel.findOne({ team: assessed.deferredWeek.team, companykod_object: assessed.deferredWeek.company_kod,
        ypokatasthma_kodikos: assessed.deferredWeek.ypokatasthma, employment_period_start: new Date(`${assessed.deferredWeek.source_period_start}T00:00:00Z`),
        employment_period_end: new Date(`${assessed.deferredWeek.source_period_end}T00:00:00Z`), submission_code: 'WTODailyA', submission_status: 'SUCCESS', is_final: true, document_status: 'ACTIVE' }).lean();
    if (priorSubmission) throw flowError('DEFERRED_BOUNDARY_PREVIOUS_WTODAILY_ALREADY_SUBMITTED', 'Η προηγούμενη τελική WTODailyA έχει ήδη υποβληθεί και δεν υποστηρίζεται διορθωτική υποβολή.');
    return { deferredWeek: assessed.deferredWeek, fullWeekContext: assessed.context.rows,
        source: { row_id: sourceItem.prodhlomena_oraria_id, hmeromhnia: sourceItem.hmeromhnia }, target: { row_id: targetItem.prodhlomena_oraria_id, hmeromhnia: targetItem.hmeromhnia },
        sourcePeriod: monthPeriod(sourceItem.hmeromhnia), targetPeriod: monthPeriod(targetItem.hmeromhnia), resolutionPeriod,
        beforeValues: assessed.context.rows, proposedAccountingAfterValues: proposal.items.map((item) => ({ row_id: item.prodhlomena_oraria_id, hmeromhnia: item.hmeromhnia, ...item.proposed_values })),
        frozenSnapshotFingerprint: assessed.context.frozen?.frozen_snapshot_fingerprint || '' };
}
module.exports = { REQUIREMENT_STATUS, parseDeferredWeekId, monthPeriod, accountingProjection, declaredProjection, cardsProjection,
    selectionCandidates, assessAnalysis, loadAuthoritativeWeekContext, assessDeferredCrossPeriodRequirement,
    assessDeferredCrossPeriodRequirementsBulk, reconstructAuthoritativeDeferredCrossPeriod };
