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
    buildCanonicalSnapshot,
    fingerprintSnapshot
} = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { validateApplySession } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { getWeeklyRepoTransferApplyRuntimeState } = require('./apasxoliseisWeeklyRepoTransferApplyRuntimeGuardService');
const { getWeeklyRepoTransferApplyIndexState } = require('./apasxoliseisWeeklyRepoTransferApplyIndexGuardService');
const {
    startOfWeekMondayUtc,
    dateKeyUtc
} = require('../../utils/date/mondaySundayWeek');

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
function presentation(record, currentFingerprint) {
    return {
        id: String(record._id || ''),
        decision_code: record.decision_code,
        decision_status: record.decision_status,
        notes: record.notes || '',
        created_by_user_name: record.created_by_user_name || '',
        created_at: record.created_at || null,
        is_current: Boolean(currentFingerprint && record.snapshot_fingerprint === currentFingerprint)
    };
}
function executionPresentation(execution) {
    return execution ? {
        id: String(execution._id || ''),
        decision_id: String(execution.decision_id || ''),
        execution_status: execution.execution_status,
        applied_at: execution.applied_at || null,
        created_by_user_name: execution.created_by_user_name || ''
    } : null;
}
function appliedHistoryPresentation(decision, execution, employee = null) {
    if (!decision || !execution || execution.execution_status !== 'APPLIED') return null;
    const snapshot = decision.canonical_snapshot || {};
    const source = snapshot.source || {};
    const target = snapshot.target || {};
    const after = execution.after_snapshot || {};
    return {
        decision_id: String(decision._id || ''),
        execution_id: String(execution._id || ''),
        proposal_id: String(decision.proposal_id || ''),
        employee_id: String(decision.employee_id || snapshot.employee_id || ''),
        employee_kodikos: text(decision.employee_kodikos || snapshot.employee_kodikos, 50),
        employee_name: [
            text(employee?.eponymo, 100),
            text(employee?.onoma, 100)
        ].filter(Boolean).join(' '),
        week_start: decision.week_start || snapshot.week_start || null,
        week_end: decision.week_end || snapshot.week_end || null,
        source: {
            prodhlomena_oraria_id: String(
                decision.source_prodhlomena_oraria_id ||
                source.prodhlomena_oraria_id ||
                ''
            ),
            hmeromhnia: source.hmeromhnia || null,
            result: text(
                after.source?.kathgoria_ergasias_apologistika ||
                source.proposed_values?.kathgoria_ergasias_apologistika,
                20
            )
        },
        target: {
            prodhlomena_oraria_id: String(
                decision.target_prodhlomena_oraria_id ||
                target.prodhlomena_oraria_id ||
                ''
            ),
            hmeromhnia: target.hmeromhnia || null,
            result: text(
                after.target?.kathgoria_ergasias_apologistika ||
                target.proposed_values?.kathgoria_ergasias_apologistika,
                20
            ),
            repo_apologistika:
                after.target?.repo_apologistika === true ||
                target.proposed_values?.repo_apologistika === true
        },
        applied_at: execution.applied_at || null,
        applied_by_user_name: text(execution.created_by_user_name, 200)
    };
}
function applyCapability({ applyState, runtimeEnabled, indexReady, context = null }) {
    const canApply = applyState === 'READY_TO_APPLY';
    return {
        apply_state: applyState,
        can_apply: canApply,
        apply_allowed: canApply,
        apply_readiness: {
            status: canApply ? 'READY' : 'BLOCKED',
            reason: canApply ? null : applyState
        },
        runtime_enabled: runtimeEnabled === true,
        index_ready: indexReady === true,
        apply_context: context
    };
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
    const rowFilter = {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        hmeromhnia: mongoose.trusted({ $gte: readContextStart, $lte: readContextEnd })
    };
    const rows = await prodhlomenaModel.find(rowFilter)
        .select(ATOMIC_REPO_TRANSFER_ROW_FIELDS)
        .sort({ kodikos: 1, hmeromhnia: 1, _id: 1 })
        .lean();
    const employeeCodes = [...new Set(rows.map((row) => text(row.kodikos)).filter(Boolean))];
    const rowIds = rows.map((row) => row._id).filter(Boolean);
    const [employees, histories, audits, holidayContext] = await Promise.all([
        employeeCodes.length
            ? employeeModel.find({ team: scope.team, company_kod: scope.company_kod, kodikos: mongoose.trusted({ $in: employeeCodes }) }).select(ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS).lean()
            : [],
        employeeCodes.length && historyModel
            ? historyModel.find({ team: scope.team, company_kod: scope.company_kod, kodikos: mongoose.trusted({ $in: employeeCodes }) }).select(ATOMIC_REPO_TRANSFER_HISTORY_FIELDS).sort({ kodikos: 1, hmeromhnia_isxyos_oron_ergasias_apo: 1, createdAt: 1 }).lean()
            : [],
        rowIds.length
            ? auditModel.find({ team: scope.team, company_kod: scope.company_kod, prodhlomena_oraria_id: mongoose.trusted({ $in: rowIds }) }).select('_id prodhlomena_oraria_id changedAt').lean()
            : [],
        holidayContextBuilder({
            team: scope.team,
            companyId: scope.company_kod,
            companyKodikos: text(session.companyKodikos, 50),
            etos: scope.etos,
            periodStart: readContextStart,
            periodEnd: readContextEnd,
            companiesModel: models.companiesModel,
            argiesModel: models.argiesModel
        })
    ]);
    const employeeByCode = buildCompanyWideUniqueEmployeeByKodikos(employees);
    const historyByCode = new Map();
    histories.forEach((history) => {
        const code = text(history.kodikos);
        if (!historyByCode.has(code)) historyByCode.set(code, []);
        historyByCode.get(code).push(history);
    });
    const auditsByRowId = new Map();
    audits.forEach((audit) => {
        const id = String(audit.prodhlomena_oraria_id || '');
        if (!auditsByRowId.has(id)) auditsByRowId.set(id, []);
        auditsByRowId.get(id).push(audit);
    });
    const auditCounts = new Map([...auditsByRowId].map(([id, values]) => [id, values.length]));
    const weeklyContexts = new Map();
    const inputs = buildWeeklyRepoTransferAtomicInputs({
        rows,
        periodStart: normalized.start.date,
        periodEnd: normalized.end.date,
        asOfDate: session.appDate,
        holidayByDateKey: holidayContext.argiesByDateKey,
        existingAuditCountByRowKey: auditCounts,
        resolveEmploymentProfile: ({ ypokatasthma, employee_kodikos, week_start, week_end }) => {
            const employee = employeeByCode.get(employee_kodikos);
            if (!employee || !isEmployeeCompatibleWithBranch(employee, ypokatasthma)) return null;
            const weekStart = new Date(`${week_start}T00:00:00.000Z`);
            const weekEnd = new Date(`${week_end}T23:59:59.999Z`);
            const profileInfo = getWeeklyRepoProfileInfo({
                week: { naturalWeekStart: weekStart, naturalWeekEnd: weekEnd, weekStart, weekEnd, isFullWeek: true },
                istorikoRows: historyByCode.get(employee_kodikos) || [],
                ergazomenos: employee
            });
            const effective = profileInfo.effectiveProfile || {};
            const profile = {
                typos_apasxolhshs: effective.typos_apasxolhshs || '',
                mhniaia_repo: effective.mhniaia_repo,
                raw_mhniaia_repo: effective.raw_mhniaia_repo,
                pososto_prosayxhshs_6hs_hmeras:
                    effective.pososto_prosayxhshs_6hs_hmeras,
                hmeres_ergasias_ebdomadas: effective.hmeres_ergasias_ebdomadas,
                mo_oron_hmerhsias_ergasias: Number(effective.mo_oron_hmerhsias_ergasias || 0),
                external_break_minutes: employee.dialleima_entos_ektos_orarioy === true ? 0 : Math.max(Number.parseInt(employee.dialleima_se_lepta || 0, 10) || 0, 0),
                eidikh_kathgoria_ergazomenoy:
                    employee.eidikh_kathgoria_ergazomenoy || '',
                eidikh_periptosh: employee.eidikh_periptosh || '',
                profile_source: effective.source || '',
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
    const current = projection.groups.map((group) => {
        const sourceId = String(group.items[0].prodhlomena_oraria_id);
        const weekRows = inputs.weeklyInputs.find((input) => input.weekRows.some((row) => String(row._id) === sourceId))?.weekRows || [];
        const employeeCode = text(group.items[0].employee_kodikos);
        const weekStart = group.group_key.match(/week=([^:|]+)/)?.[1] || '';
        const contextInfo = weeklyContexts.get(`${employeeCode}|${weekStart}`);
        if (!contextInfo || weekRows.length === 0) {
            throw requestError('Δεν ήταν δυνατή η ανακατασκευή της τρέχουσας πρότασης.', 409);
        }
        const context = {
            candidates: [weekRows.find((row) => String(row._id) === sourceId), weekRows.find((row) => String(row._id) === String(group.items[1].prodhlomena_oraria_id))],
            weekRows,
            employee: contextInfo.employee,
            employmentProfile: contextInfo.profile,
            weeklyProfileInfo: contextInfo.profileInfo,
            history: historyByCode.get(employeeCode) || [],
            audits: weekRows.flatMap((row) => auditsByRowId.get(String(row._id)) || []),
            week: { start: group.group_key.match(/week=([^:|]+)/)?.[1], end: group.group_key.match(/week=[^:|]+:([^|]+)/)?.[1] },
            companyFlags: holidayContext.companyFlags,
            companyKodikos: holidayContext.company_kodikos,
            holidayByDateKey: holidayContext.argiesByDateKey
        };
        const snapshot = canonicalSnapshotBuilder({ scope, context, group });
        return { group, fingerprint: snapshotFingerprintBuilder(snapshot) };
    });
    const decisionFilter = {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        decision_status: 'RECORDED',
        week_start: mongoose.trusted({ $lte: normalized.end.date }),
        week_end: mongoose.trusted({ $gte: normalized.start.date })
    };
    const employeeCode = text(filters.kodikos, 50);
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
              'source_prodhlomena_oraria_id target_prodhlomena_oraria_id after_snapshot'
          ).lean()
        : [];
    const executionByDecisionId = new Map(executions.map((execution) => [String(execution.decision_id), execution]));
    const executedDecisionIds = new Set(executionByDecisionId.keys());
    const decisionsByProposalId = new Map();
    decisions.forEach((decision) => {
        const proposalId = String(decision.proposal_id || '');
        if (!decisionsByProposalId.has(proposalId)) decisionsByProposalId.set(proposalId, []);
        decisionsByProposalId.get(proposalId).push(decision);
    });
    let authorized = true;
    try { validateApplySession(session); } catch { authorized = false; }
    let runtimeState = { enabled: false };
    let indexState = { ready: false };
    try { runtimeState = await runtimeStateLoader(); } catch { runtimeState = { enabled: false }; }
    if (runtimeState.enabled) {
        try { indexState = await indexStateLoader(); } catch { indexState = { ready: false }; }
    }
    const currentProposalIds = new Set(current.map(({ group }) => String(group.group_id || '')));
    const currentRecords = current.map(({ group, fingerprint }) => {
            const proposalDecisions = decisionsByProposalId.get(String(group.group_id || '')) || [];
            const history = proposalDecisions.map((decision) => presentation(decision, fingerprint));
            const rawCurrent = proposalDecisions.find((decision) => decision.snapshot_fingerprint === fingerprint) || null;
            const executedDecision = proposalDecisions.find((decision) => executedDecisionIds.has(String(decision._id))) || null;
            const execution = executedDecision ? executionByDecisionId.get(String(executedDecision._id)) || null : null;
            let apply_state = 'NOT_APPROVED';
            if (execution) apply_state = 'ALREADY_APPLIED';
            else if (rawCurrent?.decision_code === 'APPROVE_PROPOSAL' && rawCurrent?.decision_status === 'RECORDED') {
                if (!authorized) apply_state = 'NOT_AUTHORIZED';
                else if (!runtimeState.enabled) apply_state = 'RUNTIME_DISABLED';
                else if (!indexState.ready) apply_state = 'INDEXES_NOT_READY';
                else apply_state = 'READY_TO_APPLY';
            } else if (!rawCurrent && proposalDecisions.some((decision) => decision.decision_code === 'APPROVE_PROPOSAL')) {
                apply_state = 'STALE_DECISION';
            }
            const applyContext = rawCurrent ? {
                team: text(rawCurrent.team || scope.team, 50),
                company_kodikos: text(session.companyKodikos, 50),
                ypokatasthma: text(rawCurrent.ypokatasthma || normalized.ypokatasthma, 20),
                week_start: rawCurrent.week_start || null,
                week_end: rawCurrent.week_end || null
            } : null;
            return {
                proposal_id: group.group_id,
                current_decision: history.find((decision) => decision.is_current) || null,
                current_execution: executionPresentation(execution),
                applied_history: appliedHistoryPresentation(
                    executedDecision,
                    execution,
                    employeeByCode.get(text(executedDecision?.employee_kodikos))
                ),
                ...applyCapability({
                    applyState: apply_state,
                    runtimeEnabled: runtimeState.enabled,
                    indexReady: indexState.ready,
                    context: applyContext
                }),
                history,
                history_count: history.length
            };
        });
    const appliedOnlyRecords = [...decisionsByProposalId.entries()]
        .filter(([proposalId, proposalDecisions]) => !currentProposalIds.has(proposalId) && proposalDecisions.some((decision) => executedDecisionIds.has(String(decision._id))))
        .map(([proposalId, proposalDecisions]) => {
            const executedDecision = proposalDecisions.find((decision) => executedDecisionIds.has(String(decision._id)));
            const execution = executionByDecisionId.get(String(executedDecision._id));
            const history = proposalDecisions.map((decision) => presentation(decision, null));
            return {
                proposal_id: proposalId,
                current_decision: null,
                current_execution: executionPresentation(execution),
                applied_history: appliedHistoryPresentation(
                    executedDecision,
                    execution,
                    employeeByCode.get(text(executedDecision?.employee_kodikos))
                ),
                ...applyCapability({
                    applyState: 'ALREADY_APPLIED',
                    runtimeEnabled: runtimeState.enabled,
                    indexReady: indexState.ready
                }),
                history,
                history_count: history.length
            };
        })
        .sort((left, right) => new Date(right.current_execution.applied_at || 0) - new Date(left.current_execution.applied_at || 0));
    return {
        records: [...currentRecords, ...appliedOnlyRecords],
        current_groups_count: current.length,
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
