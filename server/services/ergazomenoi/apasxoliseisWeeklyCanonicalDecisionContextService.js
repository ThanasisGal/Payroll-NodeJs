'use strict';

const mongoose = require('mongoose');
const Models = require('../../models/ergazomenoi');
const DecisionModel = require('../../models/apasxoliseisWeeklyCanonicalDecision');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const {
    startOfWeekMondayUtc,
    endOfWeekSundayUtc,
    dateKeyUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    getWeeklyRepoProfileInfo
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    buildWeeklyCanonicalDecisionSnapshotInput
} = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const {
    APPLICABILITY,
    buildCanonicalWeeklyDecisionSnapshot,
    selectedProfileFingerprint,
    validateDecisionCommand
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const {
    resolveWeeklyCanonicalDecisionAnalysis,
    resolveSelectedProfile
} = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const {
    buildAppliedRepoTransferProtectionContext
} = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionService');
const {
    employeeKey: borrowedProfileEmployeeKey,
    resolveEffectiveEmploymentProfileForReviewDate,
    preloadBorrowedEmploymentProfileContexts
} = require('./apasxoliseisBorrowedEmploymentProfileResolverService');

const MAX_HISTORY_RECORDS = 100;
const MAX_DECISION_HISTORY = 100;
const CANONICAL_EMPLOYEE_PROFILE_FIELDS = [
    '_id', 'kodikos', 'ypokatasthma',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs',
    'typos_apasxolhshs', 'typos_ebdomadas', 'pososto_prosayxhshs_6hs_hmeras',
    'nomimoOromisthio', 'pragmatikoOromisthio', 'employment_profile_source',
    'eidikh_kathgoria_ergazomenoy', 'eidikh_periptosh',
    'dialleima_se_lepta', 'dialleima_entos_ektos_orarioy',
    'afora_daneismo_ergazomenoy', 'typos_ergodoth_daneismoy',
    'hmnia_enarxhs_daneismoy', 'hmnia_lhxhs_daneismoy',
    'afm_daneizomenoy_ergodoth', 'kodikos_ergazomenoy_alloy_ergodoth'
].join(' ');
const HISTORY_SELECT_FIELDS = [
    'kodikos', 'aa_eggrafhs', 'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs',
    'typos_apasxolhshs', 'typos_ebdomadas', 'pososto_prosayxhshs_6hs_hmeras',
    'nomimoOromisthio', 'pragmatikoOromisthio', 'employment_profile_source',
    'afora_allagh_oron_ergasias', 'afora_allagh_dialleimatos',
    'hmeromhnia_isxyos_dialleimatos_apo',
    'dialleima_se_lepta', 'dialleima_entos_ektos_orarioy', 'createdAt'
].join(' ');
const ALLOWED_COMMAND_FIELDS = new Set([
    'ypokatasthma', 'employee_kodikos', 'week_start', 'request_id',
    'decision_type', 'decision_payload', 'notes', 'reuse_scope',
    'reuse_effective_from', 'reuse_effective_to'
]);

function fail(message, statusCode = 400, code = 'INVALID_CANONICAL_DECISION_CONTEXT') {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

function text(value, max = 150) {
    return String(value ?? '').trim().slice(0, max);
}

function normalizeBranch(value) {
    const branch = text(value, 20);
    if (!branch || !/^[A-Za-z0-9_-]{1,20}$/.test(branch)) {
        throw fail('Μη έγκυρο υποκατάστημα.');
    }
    return branch.padStart(4, '0');
}

function naturalWeek(value) {
    const key = text(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw fail('Μη έγκυρη έναρξη εβδομάδας.');
    const start = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.getUTCDay() !== 1) {
        throw fail('Η εβδομάδα πρέπει να ξεκινά Δευτέρα.');
    }
    const end = endOfWeekSundayUtc(start);
    return { start, end, week_start: dateKeyUtc(start), week_end: dateKeyUtc(end) };
}

function queryLean(query) {
    return query && typeof query.lean === 'function' ? query.lean() : query;
}

async function sortedLean(query, sort, limit, select) {
    let cursor = query;
    if (select && cursor && typeof cursor.select === 'function') cursor = cursor.select(select);
    if (cursor && typeof cursor.sort === 'function') cursor = cursor.sort(sort);
    if (limit && cursor && typeof cursor.limit === 'function') cursor = cursor.limit(limit);
    return queryLean(cursor);
}

function historyId(row) {
    return text(row?._id ?? row?.istorikoId ?? row?.id, 100);
}

function effectiveHistoryDate(row = {}) {
    return row.hmeromhnia_isxyos_oron_ergasias_apo ||
        row.hmeromhnia_allaghs_orarioy_apo || row.hmeromhnia_allaghs_symbashs || null;
}

function buildProfileCandidates(employee = {}, histories = []) {
    const candidates = [];
    for (const history of histories) {
        const id = historyId(history);
        const effectiveDate = effectiveHistoryDate(history);
        if (!id || !effectiveDate) continue;
        const profile = { ...getOrarioTermsForDate(effectiveDate, [history], employee),
            profile_changed_inside_week: false };
        candidates.push({
            reference: { kind: 'HISTORY', id },
            selected_profile_fingerprint: selectedProfileFingerprint(profile),
            effective_date: dateKeyUtc(effectiveDate),
            source: profile.employment_profile_source || profile.source || 'ISTORIKO'
        });
    }
    const currentId = historyId(employee) || text(employee.kodikos, 100);
    if (currentId) {
        const profile = { ...getOrarioTermsForDate(new Date(0), [], employee),
            profile_changed_inside_week: false };
        candidates.push({
            reference: { kind: 'CURRENT_EMPLOYEE', id: currentId },
            selected_profile_fingerprint: selectedProfileFingerprint(profile),
            effective_date: null,
            source: 'CURRENT_EMPLOYEE'
        });
    }
    return candidates.slice(0, MAX_HISTORY_RECORDS);
}

function buildAppliedProtectionContext(executions = [], scope = {}, rows = []) {
    if (!executions.length) return { entriesByRowId: {}, diagnostics: [], hasConflicts: false };
    return buildAppliedRepoTransferProtectionContext({
        executions,
        scope: { team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma },
        loadedRowIds: rows.map((row) => text(row._id, 100)).filter(Boolean)
    });
}

function safeDecisionProjection(record) {
    if (!record) return null;
    return {
        id: text(record._id, 100),
        decision_type: record.decision_type,
        decision_payload: record.decision_payload,
        decision_status: record.decision_status,
        canonical_reasons: record.canonical_reasons || [],
        notes: record.notes || '',
        actor: {
            id: text(record.created_by_user_id, 100),
            name: record.created_by_user_name || '',
            role: record.created_by_user_role || ''
        },
        created_at: record.created_at,
        snapshot_fingerprint: record.snapshot_fingerprint,
        reuse_scope: record.reuse_scope || 'ONE_TIME',
        reuse_status: record.reuse_status || 'NOT_APPLICABLE',
        reuse_effective_from: record.reuse_effective_from || null,
        reuse_effective_to: record.reuse_effective_to || null
    };
}

function supportedActions(reasons = [], context = {}) {
    const values = new Set(reasons);
    return {
        profile: values.has('PROFILE_CHANGED_INSIDE_WEEK'),
        card_documentary: values.has('CARD_VERIFICATION_PENDING') ||
            values.has('ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'),
        repo_identities: values.has('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC') &&
            context.appliedExecutions.length === 0 &&
            (context.currentRepoCandidateDates || []).length >= 2,
        repo_identities_unavailable: values.has('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC') &&
            (context.currentRepoCandidateDates || []).length < 2,
        classification_by_date: values.has('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC')
    };
}

async function loadWeeklyCanonicalDecisionContext({
    session = {}, ypokatasthma, employee_kodikos, week_start,
    models = {}
} = {}) {
    const team = text(session.userTeam, 100);
    const company = text(session.companyInUse, 100);
    if (!team || !company) throw fail('Δεν υπάρχει ενεργή εταιρεία για τον έλεγχο.', 403, 'SCOPE_MISMATCH');
    const branch = normalizeBranch(ypokatasthma);
    const employeeCode = text(employee_kodikos, 100);
    if (!employeeCode) throw fail('Λείπει ο κωδικός εργαζομένου.');
    const week = naturalWeek(week_start);
    const Employee = models.employeeModel || Models.ErgazomenoiModel;
    const Row = models.rowModel || Models.ProdhlomenaOrariaModel;
    const History = models.historyModel === undefined
        ? Models.IstorikoProslhpseonAllagonModel : models.historyModel;
    const Execution = models.executionModel || ExecutionModel;
    const Decision = models.decisionModel || DecisionModel;
    const employee = await queryLean(Employee.findOne({
        team, company_kod: company, ypokatasthma: branch, kodikos: employeeCode
    }));
    if (!employee) throw fail('Ο εργαζόμενος δεν βρέθηκε στην ενεργή εταιρεία και το επιλεγμένο υποκατάστημα.', 403, 'SCOPE_MISMATCH');
    const rows = await sortedLean(Row.find({
        team, company_kod: company, ypokatasthma: branch, kodikos: employeeCode,
        hmeromhnia: mongoose.trusted({ $gte: week.start, $lte: week.end })
    }), { hmeromhnia: 1 });
    const histories = History ? await sortedLean(History.find({
        team, company_kod: company, kodikos: employeeCode,
        $or: mongoose.trusted([
            {
                hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({ $lte: week.end }),
                $or: mongoose.trusted([
                    { hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({ $gte: week.start }) },
                    { hmeromhnia_isxyos_oron_ergasias_eos: null }
                ])
            },
            {
                hmeromhnia_isxyos_oron_ergasias_apo: null,
                hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $lte: week.end }),
                $or: mongoose.trusted([
                    { hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({ $gte: week.start }) },
                    { hmeromhnia_allaghs_orarioy_eos: null }
                ])
            },
            {
                hmeromhnia_isxyos_oron_ergasias_apo: null,
                hmeromhnia_allaghs_orarioy_apo: null,
                hmeromhnia_allaghs_symbashs: mongoose.trusted({ $lte: week.end })
            }
        ])
    }), {
        kodikos: 1, hmeromhnia_isxyos_oron_ergasias_apo: 1,
        hmeromhnia_allaghs_orarioy_apo: 1, hmeromhnia_allaghs_symbashs: 1, createdAt: 1
    }, null, HISTORY_SELECT_FIELDS) : [];
    const executionQuery = {
        team, company_kod: company, ypokatasthma: branch,
        employee_kodikos: employeeCode, week_start: week.start, week_end: week.end,
        execution_status: 'APPLIED'
    };
    const decisionQuery = { team, company_kod: company, ypokatasthma: branch,
        decision_status: 'RECORDED', $or: mongoose.trusted([
            { employee_kodikos: employeeCode, week_start: week.start, week_end: week.end },
            { reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
                reuse_effective_from: mongoose.trusted({ $lte: week.end }),
                $or: mongoose.trusted([
                    { reuse_effective_to: mongoose.trusted({ $gte: week.start }) },
                    { reuse_effective_to: null }
                ]) }
        ]) };
    const [appliedExecutions, decisionRecords] = await Promise.all([
        sortedLean(Execution.find(executionQuery), { applied_at: -1 }, 20),
        sortedLean(Decision.find(decisionQuery), { created_at: -1 }, MAX_DECISION_HISTORY)
    ]);
    const borrowedContexts = await preloadBorrowedEmploymentProfileContexts({
        team, employees: [employee], models: {
            companiesModel: models.companiesModel,
            employeeModel: Employee,
            historyModel: History
        }
    });
    const borrowedContext = borrowedContexts.get(borrowedProfileEmployeeKey(employee)) || null;
    const resolveProfileForDate = (reviewDate) =>
        resolveEffectiveEmploymentProfileForReviewDate({ reviewDate,
            normalEmployee: employee, normalHistory: histories, borrowedContext });
    const weekContext = { naturalWeekStart: week.start, naturalWeekEnd: week.end,
        weekStart: week.start, weekEnd: week.end, isFullWeek: rows.length === 7 };
    const weeklyProfileInfo = getWeeklyRepoProfileInfo({
        week: weekContext, istorikoRows: histories, ergazomenos: employee,
        resolveProfileForDate
    });
    const effectiveProfile = weeklyProfileInfo.effectiveProfile || {};
    const automaticAnalysis = analyzeWeeklySixthSeventhDay({
        weekRows: rows, effectiveProfile, hourlyRate: effectiveProfile.pragmatikoOromisthio
    });
    const appliedProtectionContext = buildAppliedProtectionContext(appliedExecutions,
        { team, company_kod: company, ypokatasthma: branch }, rows);
    let snapshotInput = null;
    let snapshot = null;
    let resolution = {
        analysis: automaticAnalysis,
        applicability: APPLICABILITY.NOT_FOUND,
        decision: null
    };
    if (automaticAnalysis.status === 'NEEDS_HR_DECISION') {
        snapshotInput = buildWeeklyCanonicalDecisionSnapshotInput({
            team, company_kod: company, employee, week: weekContext, weekRows: rows,
            effectiveProfile, profileHistory: histories, automaticAnalysis,
            appliedProtectionContext
        });
        snapshot = buildCanonicalWeeklyDecisionSnapshot(snapshotInput);
        resolution = resolveWeeklyCanonicalDecisionAnalysis({
            automaticAnalysis, snapshotInput, decisionRecords, weekRows: rows,
            effectiveProfile, employee, profileHistory: histories
        });
    }
    const context = {
        scope: { team, company_kod: company, ypokatasthma: branch,
            employee_kodikos: employeeCode, employee_id: text(employee._id, 100),
            week_start: week.week_start, week_end: week.week_end },
        employee, rows, histories, appliedExecutions, decisionRecords,
        week: weekContext, weeklyProfileInfo, effectiveProfile, automaticAnalysis,
        appliedProtectionContext, snapshotInput, snapshot, resolution
    };
    context.profileCandidates = buildProfileCandidates(employee, histories);
    context.currentRepoCandidateDates = snapshotInput?.current_repo_identities || [];
    context.supportedActions = supportedActions(automaticAnalysis.reasons, context);
    return context;
}

function assertBoundedDecisionCommand(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Μη έγκυρο σώμα αιτήματος.');
    const unexpected = Object.keys(body).filter((key) => !ALLOWED_COMMAND_FIELDS.has(key));
    if (unexpected.length) throw fail('Το αίτημα περιέχει μη επιτρεπτά πεδία υπολογισμού.', 400,
        'CLIENT_CANONICAL_FIELDS_NOT_ALLOWED');
    const payload = body.decision_payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        JSON.stringify(payload).length > 10000) throw fail('Μη έγκυρα στοιχεία απόφασης.');
    const unsafeKey = (value, depth = 0) => {
        if (depth > 8 || !value || typeof value !== 'object') return depth > 8;
        if (Array.isArray(value)) return value.length > 20 || value.some((item) => unsafeKey(item, depth + 1));
        return Object.keys(value).some((key) =>
            ['__proto__', 'prototype', 'constructor'].includes(key) || unsafeKey(value[key], depth + 1));
    };
    if (unsafeKey(payload)) {
        throw fail('Τα στοιχεία της απόφασης δεν είναι ασφαλή.');
    }
    if (Object.keys(payload.classification_by_date || {}).length > 7 ||
        (Array.isArray(payload.current_repo_identities) && payload.current_repo_identities.length > 2)) {
        throw fail('Τα στοιχεία της απόφασης υπερβαίνουν τα όρια της εβδομάδας.');
    }
    return {
        request_id: text(body.request_id, 100),
        decision_type: text(body.decision_type, 100),
        decision_payload: payload,
        notes: text(body.notes, 2000),
        reuse_scope: text(body.reuse_scope, 30),
        reuse_effective_from: text(body.reuse_effective_from, 10),
        reuse_effective_to: text(body.reuse_effective_to, 10)
    };
}

function validateCommandForCurrentContext({ session, body, context }) {
    if (!context.snapshotInput) throw fail('Η εβδομάδα δεν βρίσκεται σε κατάσταση που απαιτεί απόφαση.', 409,
        'CANONICAL_WEEK_NOT_BLOCKED');
    const command = assertBoundedDecisionCommand(body);
    const validated = validateDecisionCommand({ session, command, currentInput: context.snapshotInput });
    if (validated.command.decision_type === 'PROFILE_CHANGED_INSIDE_WEEK' &&
        validated.command.decision_payload.profile_outcome === 'USE_PROFILE') {
        const selected = resolveSelectedProfile({ payload: validated.command.decision_payload,
            employee: context.employee, profileHistory: context.histories });
        if (!selected.ok) throw fail('Το επιλεγμένο προφίλ εργασίας έχει αλλάξει ή δεν υπάρχει.', 409,
            selected.reason);
    }
    if (['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', 'CLASSIFICATION_BY_DATE']
        .includes(validated.command.decision_type)) {
        const record = {
            ...validated.snapshotResult.scope,
            snapshot_fingerprint: validated.snapshotResult.fingerprint,
            decision_status: 'RECORDED',
            decision_type: validated.command.decision_type,
            decision_payload: validated.command.decision_payload,
            decision_payload_fingerprint: validated.payloadFingerprint,
            created_at: new Date()
        };
        const testResolution = resolveWeeklyCanonicalDecisionAnalysis({
            automaticAnalysis: context.automaticAnalysis,
            snapshotInput: context.snapshotInput,
            decisionRecords: [record],
            weekRows: context.rows,
            effectiveProfile: context.effectiveProfile,
            employee: context.employee,
            profileHistory: context.histories
        });
        const invalidReason = (testResolution.analysis?.reasons || []).find((reason) =>
            /^CANONICAL_DECISION_.*(?:INVALID|CONFLICT)$/.test(reason));
        if (invalidReason) throw fail('Η απόφαση δεν είναι συμβατή με την τρέχουσα εβδομάδα.', 409,
            invalidReason);
    }
    return command;
}

function projectCurrentContext(context, indexReadiness) {
    const resolution = context.resolution;
    return {
        success: true,
        scope: context.scope,
        employee: { kodikos: context.employee.kodikos,
            eponymo: context.employee.eponymo || '', onoma: context.employee.onoma || '' },
        canonical: { status: context.automaticAnalysis.status,
            reasons: context.automaticAnalysis.reasons || [] },
        snapshot_fingerprint: context.snapshot?.fingerprint || null,
        applicability: resolution.applicability,
        applicable_decision: safeDecisionProjection(resolution.decision),
        resolved_analysis: {
            status: resolution.analysis?.status,
            reasons: resolution.analysis?.reasons || [],
            sixthDay: resolution.analysis?.sixthDay || null,
            seventhDay: resolution.analysis?.seventhDay || null
        },
        supported_actions: context.supportedActions,
        reusable_actions: {
            CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC: { eligible: true, reason: '' },
            CLASSIFICATION_BY_DATE: { eligible: true, reason: '' },
            CARD_VERIFICATION_PENDING: { eligible: false,
                reason: 'Η τεκμηρίωση ή διόρθωση κάρτας αφορά μόνο τη συγκεκριμένη εβδομάδα.' },
            PROFILE_CHANGED_INSIDE_WEEK: { eligible: false,
                reason: 'Η επιλογή ιστορικού προφίλ αφορά μόνο τον συγκεκριμένο εργαζόμενο.' }
        },
        profile_candidates: context.profileCandidates,
        current_repo_candidate_dates: context.currentRepoCandidateDates,
        week_rows: context.rows.map((row) => ({ id: text(row._id, 100),
            date: dateKeyUtc(row.hmeromhnia), worked: Number(row.ores_ergasias_apologistika ||
                row.cards_ores_ergasias || 0) > 0 })),
        applied_atomic_repo_transfer: context.appliedExecutions.length
            ? { applied: true, execution_ids: context.appliedExecutions.map((row) => text(row._id, 100)) }
            : null,
        index_readiness: indexReadiness
    };
}

module.exports = {
    MAX_HISTORY_RECORDS,
    MAX_DECISION_HISTORY,
    CANONICAL_EMPLOYEE_PROFILE_FIELDS,
    HISTORY_SELECT_FIELDS,
    ALLOWED_COMMAND_FIELDS,
    normalizeBranch,
    naturalWeek,
    buildProfileCandidates,
    buildAppliedProtectionContext,
    safeDecisionProjection,
    supportedActions,
    loadWeeklyCanonicalDecisionContext,
    assertBoundedDecisionCommand,
    validateCommandForCurrentContext,
    projectCurrentContext
};
