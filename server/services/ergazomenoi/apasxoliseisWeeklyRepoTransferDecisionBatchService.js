const mongoose = require('mongoose');
const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
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
        decision_code: record.decision_code,
        notes: record.notes || '',
        created_by_user_name: record.created_by_user_name || '',
        created_at: record.created_at || null,
        is_current: record.snapshot_fingerprint === currentFingerprint
    };
}

async function loadWeeklyRepoTransferDecisionBatch({
    session,
    filters,
    models = {},
    holidayContextBuilder = buildNoCardsDisplayContext,
    canonicalSnapshotBuilder = buildCanonicalSnapshot,
    snapshotFingerprintBuilder = fingerprintSnapshot
}) {
    const scope = validateSessionScope(session);
    const normalized = validateBatchFilters(filters);
    const prodhlomenaModel = models.prodhlomenaModel || ProdhlomenaOrariaModel;
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel === undefined ? IstorikoProslhpseonAllagonModel : models.historyModel;
    const auditModel = models.auditModel || ProdhlomenaOrariaAuditModel;
    const decisionModel = models.decisionModel || DecisionModel;
    const rowFilter = {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        hmeromhnia: mongoose.trusted({ $gte: normalized.start.date, $lte: normalized.end.date })
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
            periodStart: normalized.start.date,
            periodEnd: normalized.end.date,
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
                mhniaia_repo: profileInfo.expectedWeeklyRepo,
                mo_oron_hmerhsias_ergasias: Number(effective.mo_oron_hmerhsias_ergasias || 0),
                external_break_minutes: employee.dialleima_entos_ektos_orarioy === true ? 0 : Math.max(Number.parseInt(employee.dialleima_se_lepta || 0, 10) || 0, 0),
                profile_source: effective.source || '',
                profile_istoriko_id: effective.istorikoId ? String(effective.istorikoId) : null,
                profile_effective_date: profileInfo.effectiveProfileDate,
                profile_changed_inside_week: profileInfo.profileChangedInsideWeek === true
            };
            weeklyContexts.set(`${employee_kodikos}|${week_start}`, { employee, profileInfo, profile });
            return profile;
        }
    });
    const projection = buildWeeklyRepoTransferAtomicPageProjection(inputs);
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
    const proposalIds = current.map((entry) => entry.group.group_id);
    const decisions = proposalIds.length
        ? await decisionModel.find({
              team: scope.team,
              company_kod: scope.company_kod,
              ypokatasthma: normalized.ypokatasthma,
              proposal_id: mongoose.trusted({ $in: proposalIds }),
              decision_status: 'RECORDED'
          }).select('-canonical_snapshot -canonical_group_key -command_identity -request_id').sort({ created_at: -1 }).lean()
        : [];
    return {
        records: current.map(({ group, fingerprint }) => {
            const history = decisions
                .filter((decision) => decision.proposal_id === group.group_id)
                .map((decision) => presentation(decision, fingerprint));
            return {
                proposal_id: group.group_id,
                current_decision: history.find((decision) => decision.is_current) || null,
                history,
                history_count: history.length
            };
        }),
        current_groups_count: current.length,
        projection_status: projection.projection_status,
        reason_counts: projection.reason_counts,
        warning_counts: projection.warning_counts
    };
}

module.exports = {
    validateBatchFilters,
    loadWeeklyRepoTransferDecisionBatch
};
