const mongoose = require('mongoose');
const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const {
    ProdhlomenaOrariaModel,
    ErgazomenoiModel,
    IstorikoProslhpseonAllagonModel,
    ProdhlomenaOrariaAuditModel
} = require('../../models/ergazomenoi');
const { validateSessionScope } = require('./apasxoliseisPolicyPreviewApprovalService');
const {
    buildWeeklyRepoTransferAtomicInputs,
    buildWeeklyRepoTransferAtomicPageProjection,
    buildCompanyWideUniqueEmployeeByKodikos,
    isEmployeeCompatibleWithBranch,
    getAtomicPeriodRangeDiagnostic
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const {
    ATOMIC_REPO_TRANSFER_ROW_FIELDS,
    ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS,
    ATOMIC_REPO_TRANSFER_HISTORY_FIELDS,
    buildNoCardsDisplayContext,
    getWeeklyRepoProfileInfo
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const {
    buildCanonicalSnapshot, fingerprintSnapshot
} = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const {
    resolveWeeklyRepoTransferDecisionFromPreparedWeek,
    buildAppliedOnlyWeeklyRepoTransferDecisionRecords,
    appliedHistoryPresentation
} = require('./apasxoliseisWeeklyRepoTransferPreparedStage2ResolverService');
const { validateApplySession } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { getWeeklyRepoTransferApplyRuntimeState } = require('./apasxoliseisWeeklyRepoTransferApplyRuntimeGuardService');
const { getWeeklyRepoTransferApplyIndexState } = require('./apasxoliseisWeeklyRepoTransferApplyIndexGuardService');
const {
    startOfWeekMondayUtc,
    dateKeyUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    employeeKey: borrowedProfileEmployeeKey,
    resolveEffectiveEmploymentProfileForReviewDate,
    preloadBorrowedEmploymentProfileContexts
} = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const {
    preloadEffectiveHolidayContextProvider
} = require('./apasxoliseisEffectiveHolidayContextProviderService');

function requestError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
function text(value, max = 100) { return String(value ?? '').trim().slice(0, max); }
function parseDate(value, label, endOfDay = false) {
    const key = text(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw requestError(`Μη έγκυρη τιμή για ${label}.`);
    const date = new Date(`${key}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw requestError(`Μη έγκυρη τιμή για ${label}.`);
    return { key, date };
}
function validateBatchFilters(filters = {}) {
    const ypokatasthma = text(filters.ypokatasthma, 20);
    if (!ypokatasthma || ypokatasthma.toUpperCase() === 'ALL' || ypokatasthma.includes(',')) throw requestError('Επιλέξτε συγκεκριμένο υποκατάστημα.');
    const start = parseDate(filters.apo_hmeromhnia, 'apo_hmeromhnia');
    const end = parseDate(filters.eos_hmeromhnia, 'eos_hmeromhnia', true);
    const rangeReason = getAtomicPeriodRangeDiagnostic({ periodStart: start.date, periodEnd: end.date });
    if (rangeReason) throw requestError('Το επιλεγμένο εύρος ημερομηνιών δεν υποστηρίζεται.');
    return { ypokatasthma, start, end };
}
async function loadWeeklyRepoTransferDecisionBatch({
    session,
    filters,
    models = {},
    holidayContextBuilder = buildNoCardsDisplayContext,
    canonicalSnapshotBuilder = buildCanonicalSnapshot,
    snapshotFingerprintBuilder = fingerprintSnapshot,
    runtimeStateLoader = getWeeklyRepoTransferApplyRuntimeState,
    indexStateLoader = getWeeklyRepoTransferApplyIndexState
}) {
    const scope = validateSessionScope(session);
    const normalized = validateBatchFilters(filters);
    const readContextStart = startOfWeekMondayUtc(normalized.start.date);
    const readContextEnd = normalized.end.date;
    const prodhlomenaModel = models.prodhlomenaModel || ProdhlomenaOrariaModel;
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel === undefined ? IstorikoProslhpseonAllagonModel : models.historyModel;
    const auditModel = models.auditModel || ProdhlomenaOrariaAuditModel;
    const decisionModel = models.decisionModel || DecisionModel;
    const executionModel = models.executionModel || ExecutionModel;
    const employeeCode = text(filters.kodikos, 50);
    const rowFilter = {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        hmeromhnia: mongoose.trusted({ $gte: readContextStart, $lte: readContextEnd }),
        ...(employeeCode ? { kodikos: employeeCode } : {})
    };
    const rows = await prodhlomenaModel.find(rowFilter)
        .select(ATOMIC_REPO_TRANSFER_ROW_FIELDS)
        .sort({ kodikos: 1, hmeromhnia: 1, _id: 1 })
        .lean();
    const employeeCodes = [...new Set(rows.map((row) => text(row.kodikos)).filter(Boolean))];
    const rowIds = rows.map((row) => row._id).filter(Boolean);
    const [employees, histories, audits] = await Promise.all([
        employeeCodes.length
            ? employeeModel.find({ team: scope.team, company_kod: scope.company_kod, kodikos: mongoose.trusted({ $in: employeeCodes }) }).select(ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS).lean()
            : [],
        employeeCodes.length && historyModel
            ? historyModel.find({ team: scope.team, company_kod: scope.company_kod, kodikos: mongoose.trusted({ $in: employeeCodes }) }).select(ATOMIC_REPO_TRANSFER_HISTORY_FIELDS).sort({ kodikos: 1, hmeromhnia_isxyos_oron_ergasias_apo: 1, createdAt: 1 }).lean()
            : [],
        rowIds.length
            ? auditModel.find({ team: scope.team, company_kod: scope.company_kod, prodhlomena_oraria_id: mongoose.trusted({ $in: rowIds }) }).select('_id prodhlomena_oraria_id changedAt').lean()
            : []
    ]);
    const employeeByCode = buildCompanyWideUniqueEmployeeByKodikos(employees);
    const historyByCode = new Map();
    histories.forEach((history) => {
        const code = text(history.kodikos);
        if (!historyByCode.has(code)) historyByCode.set(code, []);
        historyByCode.get(code).push(history);
    });
    const borrowedContexts = await preloadBorrowedEmploymentProfileContexts({
        team: scope.team, employees, models: {
            companiesModel: models.companiesModel,
            employeeModel,
            historyModel
        }
    });
    const historyByEmployeeKey = new Map(employees.map((employee) => [
        borrowedProfileEmployeeKey(employee), historyByCode.get(text(employee.kodikos)) || []
    ]));
    const holidayProvider = await preloadEffectiveHolidayContextProvider({
        team: scope.team,
        employees,
        etos: scope.etos,
        periodStart: readContextStart,
        periodEnd: readContextEnd,
        normalHistoryByEmployeeKey: historyByEmployeeKey,
        borrowedProfileContexts: borrowedContexts,
        models,
        loadHolidayContext: holidayContextBuilder
    });
    const resolveHoliday = (employee, reviewDate) => {
        const resolution = holidayProvider.resolveForEmployeeDate({ employee, reviewDate,
            normalHistory: historyByCode.get(text(employee?.kodikos)) || [] });
        if (resolution.blocked === true) throw requestError(
            resolution.resolution_reason || 'Δεν επιλύθηκε η εταιρεία αργιών.', 409);
        return resolution;
    };
    const auditsByRowId = new Map();
    audits.forEach((audit) => {
        const id = String(audit.prodhlomena_oraria_id || '');
        if (!auditsByRowId.has(id)) auditsByRowId.set(id, []);
        auditsByRowId.get(id).push(audit);
    });
    const auditCounts = new Map([...auditsByRowId].map(([id, values]) => [id, values.length]));
    const weeklyContexts = new Map();
    const weeklyHolidayContexts = new Map();
    const inputs = buildWeeklyRepoTransferAtomicInputs({
        rows,
        periodStart: normalized.start.date,
        periodEnd: normalized.end.date,
        asOfDate: session.appDate,
        resolveHolidayByDateKey: ({ employee_kodikos, weekRows }) => {
            const employee = employeeByCode.get(employee_kodikos);
            const effectiveMap = new Map();
            const effectiveContextsByCompany = new Map();
            for (const row of weekRows) {
                const date = dateKeyUtc(row.hmeromhnia);
                const resolution = resolveHoliday(employee, row.hmeromhnia);
                const resolvedContext = resolution.holidayContext;
                effectiveContextsByCompany.set(resolution.effective_company_id, resolvedContext);
                const holiday = resolvedContext.argiesByDateKey.get(date);
                if (holiday) effectiveMap.set(date, { ...holiday,
                    effective_company_id: resolution.effective_company_id,
                    effective_company_kodikos: resolvedContext.company_kodikos || '' });
            }
            weeklyHolidayContexts.set(`${employee_kodikos}|${dateKeyUtc(
                weekRows[0]?.hmeromhnia)}`, effectiveContextsByCompany.size === 1
                ? [...effectiveContextsByCompany.values()][0]
                : null);
            return effectiveMap;
        },
        existingAuditCountByRowKey: auditCounts,
        resolveEmploymentProfile: ({ ypokatasthma, employee_kodikos, week_start, week_end }) => {
            const employee = employeeByCode.get(employee_kodikos);
            if (!employee || !isEmployeeCompatibleWithBranch(employee, ypokatasthma)) return null;
            const weekStart = new Date(`${week_start}T00:00:00.000Z`);
            const weekEnd = new Date(`${week_end}T23:59:59.999Z`);
            const profileInfo = getWeeklyRepoProfileInfo({
                week: { naturalWeekStart: weekStart, naturalWeekEnd: weekEnd, weekStart, weekEnd, isFullWeek: true },
                istorikoRows: historyByCode.get(employee_kodikos) || [],
                ergazomenos: employee,
                resolveProfileForDate: (reviewDate) =>
                    resolveEffectiveEmploymentProfileForReviewDate({ reviewDate,
                        normalEmployee: employee,
                        normalHistory: historyByCode.get(employee_kodikos) || [],
                        borrowedContext: borrowedContexts.get(
                            borrowedProfileEmployeeKey(employee)) || null })
            });
            const effective = profileInfo.effectiveProfile || {};
            const profile = {
                typos_apasxolhshs: effective.typos_apasxolhshs || '',
                pososto_prosayxhshs_6hs_hmeras:
                    effective.pososto_prosayxhshs_6hs_hmeras,
                hmeres_ergasias_ebdomadas: effective.hmeres_ergasias_ebdomadas,
                mo_oron_hmerhsias_ergasias: Number(effective.mo_oron_hmerhsias_ergasias || 0),
                external_break_minutes: employee.dialleima_entos_ektos_orarioy === true ? 0 : Math.max(Number.parseInt(employee.dialleima_se_lepta || 0, 10) || 0, 0),
                eidikh_kathgoria_ergazomenoy:
                    employee.eidikh_kathgoria_ergazomenoy || '',
                eidikh_periptosh: employee.eidikh_periptosh || '',
                profile_source: effective.resolution_source || effective.source || '',
                resolution_blocked: effective.resolution_blocked === true,
                resolution_reason: effective.resolution_reason || '',
                profile_istoriko_id: effective.istorikoId ? String(effective.istorikoId) : null,
                profile_effective_date: profileInfo.effectiveProfileDate,
                profile_changed_inside_week: profileInfo.profileChangedInsideWeek === true
            };
            weeklyContexts.set(`${employee_kodikos}|${week_start}`, { employee, profileInfo, profile });
            return profile;
        }
    });
    const projection = buildWeeklyRepoTransferAtomicPageProjection(inputs, {
        presentationStart: normalized.start.date,
        presentationEnd: normalized.end.date
    });
    const decisionFilter = {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        decision_status: 'RECORDED',
        week_start: mongoose.trusted({ $lte: normalized.end.date }),
        week_end: mongoose.trusted({ $gte: normalized.start.date })
    };
    if (employeeCode) decisionFilter.employee_kodikos = employeeCode;
    const decisions = await decisionModel.find(decisionFilter)
        .select('-canonical_group_key -command_identity -request_id')
        .sort({ created_at: -1 })
        .lean();
    const periodDecisionIds = decisions.map((decision) => decision._id).filter(Boolean);
    const executions = periodDecisionIds.length
        ? await executionModel.find({
              team: scope.team,
              company_kod: scope.company_kod,
              decision_id: mongoose.trusted({ $in: periodDecisionIds })
          }).select(
              '_id decision_id proposal_id execution_status applied_at created_by_user_name ' +
              'source_prodhlomena_oraria_id target_prodhlomena_oraria_id after_snapshot authorization_metadata'
          ).lean()
        : [];
    let authorized = true;
    try { validateApplySession(session); } catch { authorized = false; }
    let runtimeState = { enabled: false };
    let indexState = { ready: false };
    try { runtimeState = await runtimeStateLoader(); } catch { runtimeState = { enabled: false }; }
    if (runtimeState.enabled) {
        try { indexState = await indexStateLoader(); } catch { indexState = { ready: false }; }
    }
    const applyProtection = { authorized, runtimeEnabled: runtimeState.enabled,
        indexReady: indexState.ready };
    const resolvedPreparedWeeks = inputs.weeklyInputs.map((weeklyInput) => {
        const employeeCode = text(weeklyInput.diagnosticContext?.employee_kodikos ||
            weeklyInput.weekRows?.[0]?.kodikos);
        const weekStart = dateKeyUtc(weeklyInput.diagnosticContext?.week_start ||
            weeklyInput.weekRows?.[0]?.hmeromhnia);
        const contextInfo = weeklyContexts.get(`${employeeCode}|${weekStart}`) || {};
        const effectiveHolidayContext = weeklyHolidayContexts.get(
            `${employeeCode}|${weekStart}`) || {};
        return resolveWeeklyRepoTransferDecisionFromPreparedWeek({ weeklyInput,
            scope: { ...scope, company_kodikos: session.companyKodikos,
                ypokatasthma: normalized.ypokatasthma },
            canonicalDecisionContext: { employee: contextInfo.employee,
                weeklyProfileInfo: contextInfo.profileInfo,
                history: historyByCode.get(employeeCode) || [],
                audits: weeklyInput.weekRows.flatMap((row) =>
                    auditsByRowId.get(String(row._id)) || []),
                companyFlags: effectiveHolidayContext.companyFlags || {},
                companyKodikos: effectiveHolidayContext.company_kodikos || '' },
            decisions, executions, applyProtection,
            presentationStart: normalized.start.date, presentationEnd: normalized.end.date,
            canonicalSnapshotBuilder, snapshotFingerprintBuilder });
    });
    const currentRecords = resolvedPreparedWeeks.map((resolved) => resolved.record).filter(Boolean);
    const currentProposalIds = new Set(currentRecords.map((record) =>
        String(record.proposal_id || '')));
    const appliedOnlyRecords = buildAppliedOnlyWeeklyRepoTransferDecisionRecords({ decisions,
        executions, currentProposalIds, employeeByCode, applyProtection });
    return {
        records: [...currentRecords, ...appliedOnlyRecords],
        current_groups_count: currentRecords.length,
        applied_only_count: appliedOnlyRecords.length,
        projection_status: projection.projection_status,
        reason_counts: projection.reason_counts,
        warning_counts: projection.warning_counts,
        requested_period: {
            start: normalized.start.key,
            end: normalized.end.key
        },
        read_context: {
            start: dateKeyUtc(readContextStart),
            end: dateKeyUtc(readContextEnd)
        }
    };
}

module.exports = {
    validateBatchFilters,
    appliedHistoryPresentation,
    loadWeeklyRepoTransferDecisionBatch
};
