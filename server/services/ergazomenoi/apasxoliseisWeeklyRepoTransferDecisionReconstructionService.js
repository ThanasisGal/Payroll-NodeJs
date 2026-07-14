const crypto = require('crypto');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ErgazomenoiModel, IstorikoProslhpseonAllagonModel, ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const {
    buildWeeklyRepoTransferSinglePairGroupProjection,
    PROJECTION_STATUS
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
const { PROPOSAL_VERSION, CHOICE_CODE } = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    buildCompanyWideUniqueEmployeeByKodikos,
    isEmployeeCompatibleWithBranch
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const {
    ATOMIC_REPO_TRANSFER_ROW_FIELDS,
    ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS,
    ATOMIC_REPO_TRANSFER_HISTORY_FIELDS,
    buildNoCardsDisplayContext,
    getWeeklyRepoProfileInfo
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const SNAPSHOT_VERSION = 'weekly-repo-transfer-decision-snapshot:v1';
const ROW_FIELDS = Object.freeze(ATOMIC_REPO_TRANSFER_ROW_FIELDS.split(/\s+/).filter(Boolean));

function conflict(message) { const error = new Error(message); error.statusCode = 409; return error; }
function dateKey(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }
function weekBounds(value) {
    const key = dateKey(value); if (!key) return null;
    const start = new Date(`${key}T00:00:00.000Z`); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function normalize(value) {
    if (value === undefined) return null;
    if (value === null || ['string','boolean'].includes(typeof value)) return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value?.toHexString === 'function') return value.toHexString();
    if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
    return String(value);
}
function canonicalSerialize(value) { return JSON.stringify(normalize(value)); }
function fingerprintSnapshot(snapshot) {
    const comparable = { ...snapshot };
    delete comparable.reconstructed_at;
    return crypto.createHash('sha256').update(canonicalSerialize(comparable)).digest('hex');
}
function pickRow(row) { return Object.fromEntries(ROW_FIELDS.map((field) => [field, normalize(row?.[field])])); }

async function defaultContextLoader({
    scope,
    sourceId,
    targetId,
    models = {},
    holidayContextBuilder = buildNoCardsDisplayContext
}) {
    const prodhlomenaModel = models.prodhlomenaModel || ProdhlomenaOrariaModel;
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel === undefined
        ? IstorikoProslhpseonAllagonModel
        : models.historyModel;
    const auditModel = models.auditModel || ProdhlomenaOrariaAuditModel;
    const ids = [new mongoose.Types.ObjectId(sourceId), new mongoose.Types.ObjectId(targetId)];
    const candidates = await prodhlomenaModel.find({
        team: scope.team, company_kod: scope.company_kod, _id: mongoose.trusted({ $in: ids })
    }).select(ROW_FIELDS.join(' ')).lean();
    if (candidates.length !== 2) throw conflict('Η πρόταση δεν είναι πλέον διαθέσιμη. Ανανεώστε τον έλεγχο.');
    const [first, second] = candidates;
    if (String(first.ypokatasthma) !== String(second.ypokatasthma) || String(first.kodikos) !== String(second.kodikos)) throw conflict('Τα στοιχεία της πρότασης έχουν αλλάξει. Ανανεώστε τον έλεγχο.');
    const week = weekBounds(first.hmeromhnia);
    if (!week || dateKey(second.hmeromhnia) < week.start || dateKey(second.hmeromhnia) > week.end) throw conflict('Τα στοιχεία της πρότασης έχουν αλλάξει. Ανανεώστε τον έλεγχο.');
    const weekRows = await prodhlomenaModel.find({
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: first.ypokatasthma,
        kodikos: first.kodikos,
        hmeromhnia: mongoose.trusted({ $gte: new Date(`${week.start}T00:00:00.000Z`), $lte: new Date(`${week.end}T23:59:59.999Z`) })
    }).select(ROW_FIELDS.join(' ')).sort({ hmeromhnia: 1 }).lean();
    const employeeCandidates = await employeeModel.find({
        team: scope.team,
        company_kod: scope.company_kod,
        kodikos: first.kodikos
    }).select(ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS).lean();
    const employee = buildCompanyWideUniqueEmployeeByKodikos(employeeCandidates).get(String(first.kodikos));
    if (!employee || !isEmployeeCompatibleWithBranch(employee, first.ypokatasthma)) {
        throw conflict('Τα στοιχεία του εργαζομένου έχουν αλλάξει. Ανανεώστε τον έλεγχο.');
    }
    const periodStart = new Date(`${week.start}T00:00:00.000Z`);
    const periodEnd = new Date(`${week.end}T23:59:59.999Z`);
    const [audits, history, holidayContext] = await Promise.all([
        auditModel.find({ team: scope.team, company_kod: scope.company_kod, prodhlomena_oraria_id: mongoose.trusted({ $in: weekRows.map((row) => row._id) }) }).select('_id prodhlomena_oraria_id changedAt').lean(),
        historyModel
            ? historyModel.find({ team: scope.team, company_kod: scope.company_kod, kodikos: first.kodikos }).select(ATOMIC_REPO_TRANSFER_HISTORY_FIELDS).sort({ hmeromhnia_isxyos_oron_ergasias_apo: 1, hmeromhnia_allaghs_orarioy_apo: 1, createdAt: 1 }).lean()
            : [],
        holidayContextBuilder({
            team: scope.team,
            companyId: scope.company_kod,
            companyKodikos: scope.company_kodikos,
            etos: scope.year,
            periodStart,
            periodEnd,
            companiesModel: models.companiesModel,
            argiesModel: models.argiesModel
        })
    ]);
    if (!holidayContext?.argiesByDateKey || !(holidayContext.argiesByDateKey instanceof Map)) {
        throw conflict('Δεν ήταν δυνατή η επίλυση του πλαισίου αργιών.');
    }
    const weeklyProfileInfo = getWeeklyRepoProfileInfo({
        week: {
            naturalWeekStart: periodStart,
            naturalWeekEnd: periodEnd,
            weekStart: periodStart,
            weekEnd: periodEnd,
            isFullWeek: true
        },
        istorikoRows: history,
        ergazomenos: employee
    });
    const effectiveProfile = weeklyProfileInfo.effectiveProfile || {};
    const employmentProfile = {
        typos_apasxolhshs: effectiveProfile.typos_apasxolhshs || '',
        mhniaia_repo: weeklyProfileInfo.expectedWeeklyRepo,
        mo_oron_hmerhsias_ergasias: Number(effectiveProfile.mo_oron_hmerhsias_ergasias || 0),
        external_break_minutes: employee.dialleima_entos_ektos_orarioy === true
            ? 0
            : Math.max(Number.parseInt(employee.dialleima_se_lepta || 0, 10) || 0, 0),
        profile_source: effectiveProfile.source || '',
        profile_istoriko_id: effectiveProfile.istorikoId ? String(effectiveProfile.istorikoId) : null,
        profile_effective_date: weeklyProfileInfo.effectiveProfileDate,
        profile_changed_inside_week: weeklyProfileInfo.profileChangedInsideWeek === true
    };
    return {
        candidates, weekRows, employee, employmentProfile, weeklyProfileInfo,
        history, audits, week,
        companyFlags: holidayContext.companyFlags,
        companyKodikos: holidayContext.company_kodikos,
        holidayByDateKey: holidayContext.argiesByDateKey
    };
}

function buildCanonicalSnapshot({ scope, context, group }) {
    const source = group.items[0]; const target = group.items[1];
    const rowById = new Map(context.weekRows.map((row) => [String(row._id), row]));
    const auditsById = new Map(); context.audits.forEach((audit) => { const id = String(audit.prodhlomena_oraria_id); auditsById.set(id, (auditsById.get(id) || 0) + 1); });
    const itemSnapshot = (item) => ({
        role: item.role, prodhlomena_oraria_id: item.prodhlomena_oraria_id, hmeromhnia: item.hmeromhnia,
        current_values: pickRow(rowById.get(String(item.prodhlomena_oraria_id))), proposed_values: normalize(item.proposed_values),
        lock_state: rowById.get(String(item.prodhlomena_oraria_id))?.is_locked === true,
        audit_count: auditsById.get(String(item.prodhlomena_oraria_id)) || 0
    });
    return {
        snapshot_version: SNAPSHOT_VERSION, proposal_id: group.group_id, group_id: group.group_id,
        canonical_group_key: group.group_key, group_type: group.group_type, scenario_code: group.scenario_code,
        proposal_version: group.pair_contract.proposal_version, choice_code: group.pair_contract.choice_code,
        primary_policy_code: group.policy_code, secondary_policy_code: group.secondary_policy_code,
        policy_versions: normalize(group.pair_contract.policy_versions || {}), team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: String(context.candidates[0].ypokatasthma), employee_id: String(context.employee._id),
        employee_kodikos: String(context.candidates[0].kodikos), week_start: context.week.start, week_end: context.week.end,
        employment_profile: normalize({
            employee_id: context.employee._id,
            employee_updated_at: context.employee.updatedAt,
            ...context.employmentProfile,
            history: (context.history || []).map((entry) => ({
                id: entry._id,
                effective_from: entry.hmeromhnia_isxyos_oron_ergasias_apo || entry.hmeromhnia_allaghs_orarioy_apo || entry.hmeromhnia_allaghs_symbashs,
                effective_to: entry.hmeromhnia_isxyos_oron_ergasias_eos || entry.hmeromhnia_allaghs_orarioy_eos,
                typos_apasxolhshs: entry.typos_apasxolhshs || entry.kathestos_apasxolhshs,
                mhniaia_repo: entry.mhniaia_repo,
                mo_oron_hmerhsias_ergasias: entry.mo_oron_hmerhsias_ergasias,
                updated_at: entry.updatedAt,
                created_at: entry.createdAt
            }))
        }),
        holiday_context: normalize({
            company_flags: context.companyFlags,
            company_kodikos: context.companyKodikos,
            source: context.holidayByDateKey.get(source.hmeromhnia) || null,
            target: context.holidayByDateKey.get(target.hmeromhnia) || null
        }),
        source: itemSnapshot(source), target: itemSnapshot(target), reconstructed_at: new Date().toISOString()
    };
}

async function reconstructWeeklyRepoTransferDecision({ scope, command, contextLoader = defaultContextLoader, projectionBuilder = buildWeeklyRepoTransferSinglePairGroupProjection }) {
    const context = await contextLoader({ scope, sourceId: command.expected_source_id, targetId: command.expected_target_id });
    if (!Array.isArray(context.candidates) || context.candidates.length !== 2) throw conflict('Η πρόταση δεν είναι πλέον διαθέσιμη. Ανανεώστε τον έλεγχο.');
    const candidateScopes = new Set(context.candidates.map((row) => [String(row.team), String(row.company_kod), String(row.ypokatasthma), String(row.kodikos)].join('|')));
    if (candidateScopes.size !== 1 || context.candidates.some((row) => String(row.team) !== String(scope.team) || String(row.company_kod) !== String(scope.company_kod) || !String(row.ypokatasthma || '').trim() || !String(row.kodikos || '').trim())) throw conflict('Τα στοιχεία της πρότασης δεν ανήκουν στην ενεργή εταιρεία και το επιλεγμένο υποκατάστημα.');
    const auditCounts = new Map(); context.audits.forEach((audit) => { const id = String(audit.prodhlomena_oraria_id); auditCounts.set(id, (auditCounts.get(id) || 0) + 1); });
    const projection = projectionBuilder({ weekRows: context.weekRows, employmentProfile: context.employmentProfile || context.employee, holidayByDateKey: context.holidayByDateKey || new Map(), existingAuditCountByRowKey: auditCounts });
    if (projection.projection_status !== PROJECTION_STATUS.READY || projection.groups?.length !== 1) throw conflict('Η πρόταση δεν είναι πλέον διαθέσιμη. Ανανεώστε τον έλεγχο.');
    const group = projection.groups[0]; const items = group.items || [];
    if (items.length !== 2 || items[0]?.role !== 'SOURCE_BECOMES_WORK' || items[1]?.role !== 'TARGET_BECOMES_REPO') throw conflict('Η συνδεδεμένη πρόταση δεν είναι έγκυρη. Ανανεώστε τον έλεγχο.');
    if (group.group_id !== command.proposal_id || items[0].prodhlomena_oraria_id !== command.expected_source_id || items[1].prodhlomena_oraria_id !== command.expected_target_id || group.pair_contract.proposal_version !== command.expected_proposal_version || group.pair_contract.choice_code !== command.expected_choice_code) throw conflict('Τα στοιχεία της πρότασης έχουν αλλάξει. Ανανεώστε τον έλεγχο.');
    if (items.some((item) => item.flags?.approval_supported !== false || item.flags?.runtime_apply_supported !== false)) throw conflict('Η πρόταση δεν είναι διαθέσιμη για καταγραφή.');
    const snapshot = buildCanonicalSnapshot({ scope, context, group });
    return { snapshot, fingerprint: fingerprintSnapshot(snapshot), group, context };
}

module.exports = { SNAPSHOT_VERSION, ROW_FIELDS, canonicalSerialize, fingerprintSnapshot, buildCanonicalSnapshot, reconstructWeeklyRepoTransferDecision, defaultContextLoader };
