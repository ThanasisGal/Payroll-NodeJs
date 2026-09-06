'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');
const { ArgiesModel } = require('../../models/stathera_arxeia');
const { normalizeScope, getPeriodControl, stateToken, MODES } = require('./apasxoliseisPeriodControlService');
const { calculateHistoricalFingerprints } = require('./apasxoliseisHistoricalPeriodReconstructionService');
const { startOfWeekMondayUtc, endOfWeekSundayUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { isDateWithinEmploymentPeriod } = require('./apasxoliseisEmploymentPeriodScopeService');
const { selectRelevantProfileHistory, groupWeeklyCanonicalDecisions, buildWeeklyCanonicalDecisionSnapshotInput, weeklyCanonicalDecisionGroupKey } = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const { preloadBorrowedEmploymentProfileContexts, employeeKey } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { preloadEffectiveHolidayContextProvider } = require('./apasxoliseisEffectiveHolidayContextProviderService');
const { loadAppliedRepoTransferProtectionContext, EXECUTION_PROTECTION_FIELDS } = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionContextService');
const { resolveWeeklyCanonicalDecisionAnalysis } = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const { getWeeklyRepoProfileInfo } = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { APPLICABILITY } = require('./apasxoliseisWeeklyCanonicalDecisionService');
const { buildWeeklyRepoPostCheckWritePlan } = require('./apasxoliseisWeeklyPostCheckWritePlanService');
const { buildWeeklyIllegalOvertimeUpdate, CALCULATION_SOURCE_VERSION } = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
const { buildTargetedCanonicalPostCheckCorrectionPlan } = require('./apasxoliseisTargetedCanonicalPostCheckCorrectionService');

const FINGERPRINT_VERSION = 'targeted-canonical-postcheck-context:v1';
const words = (value) => value.trim().split(/\s+/);
const IDENTITY_FIELDS = words('_id team company_kod ypokatasthma kodikos hmeromhnia');
const EMPLOYEE_FIELDS = words(`_id team company_kod ypokatasthma kodikos eponymo onoma
    hmeromhnia_proslhpshs hmeromhnia_apoxorhshs hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas
    mo_oron_hmerhsias_ergasias kathestos_apasxolhshs typos_apasxolhshs typos_ebdomadas
    typos_ergazomenon eidikh_kathgoria_ergazomenoy eidikh_periptosh pososto_prosayxhshs_6hs_hmeras
    nomimoOromisthio pragmatikoOromisthio afora_daneismo_ergazomenoy typos_ergodoth_daneismoy
    hmnia_enarxhs_daneismoy hmnia_lhxhs_daneismoy afm_daneizomenoy_ergodoth kodikos_ergazomenoy_alloy_ergodoth`);
const HISTORY_FIELDS = words(`_id team company_kod kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs
    hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos hmeromhnia_isxyos_oron_ergasias_apo
    hmeromhnia_isxyos_oron_ergasias_eos hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas
    mo_oron_hmerhsias_ergasias kathestos_apasxolhshs typos_apasxolhshs typos_ebdomadas
    pososto_prosayxhshs_6hs_hmeras nomimoOromisthio pragmatikoOromisthio employment_profile_source
    afora_allagh_oron_ergasias createdAt`);
const NORMAL_HISTORY_FIELDS = HISTORY_FIELDS.filter((key) => !['team', 'company_kod'].includes(key));
const WEEKLY_FIELDS = words(`_id team company_kod ypokatasthma kodikos hmeromhnia
    kathgoria_ergasias kathgoria_ergasias_apologistika repo repo_apologistika ores_ergasias
    ores_ergasias_apologistika cards_ores_ergasias ores_apoysias adeia adeia_apologistika
    kathgoria_adeias kathgoria_adeias_apologistika argia argia_apologistika astheneia
    astheneia_apologistika apologistiko_biblio is_locked ores_nyxtas_apologistika
    ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika
    ores_paranomhs_yperorias_apologistika ores_paranomhs_yperorias_nyxtas_apologistika
    ores_paranomhs_yperorias_argion_apologistika ores_paranomhs_yperorias_argion_nyxtas_apologistika`)
    .concat(['01', '02', '03'].flatMap((n) => [`cards_apo_ora_${n}`, `cards_eos_ora_${n}`,
        `apo_ora_${n}_apologistika`, `eos_ora_${n}_apologistika`]));
const TARGET_INPUT_FIELDS = [...WEEKLY_FIELDS, ...words(`apousia_apologistika explicit_hourly_leave_hours
    hr_declared_leave orphan_card_resolution ores_apoysias_apologistika
    ores_pragmatikhs_ergasias_apologistika ores_adeias_pistomenes_apologistika
    ores_argias_pistomenes_apologistika compensation_breakdown_apologistika`),
...['01', '02', '03'].flatMap((n) => [`apo_ora_${n}`, `eos_ora_${n}`]),
...['yperergasias', 'nominhs_yperorias'].flatMap((kind) => ['', '_nyxtas', '_argion', '_argion_nyxtas']
    .map((suffix) => `ores_${kind}${suffix}_apologistika`))];
const POLICY_FIELDS = words(`_id team company_kod policy_code rate_percent mandatory_floor_rate_percent
    effective_from effective_to version justification legal_basis_type legal_basis_reference status`);
const DECISION_FIELDS = words(`_id team company_kod ypokatasthma employee_kodikos employee_id week_start week_end
    scope_key snapshot_version snapshot_fingerprint canonical_snapshot canonical_status canonical_reasons
    decision_type decision_payload decision_payload_fingerprint decision_status decision_schema_version
    policy_version source_version reuse_scope reuse_status reuse_fingerprint reuse_match_criteria
    reusable_decision_payload reuse_effective_from reuse_effective_to created_at`);
const HOLIDAY_FIELDS = words('_id hmeromhnia ypoxreotikh_argia leitoyrgia_etaireias perigrafh perigrafh_argias');
const COMPANY_FIELDS = words('_id team kod afm apasxolhsh_kata_tis_argies leitoyrgia_stis_mh_ypoxreotikes_argies');
const fail = (code) => { throw Object.assign(new Error(code), { code, statusCode: 409 }); };
const pick = (value, fields) => Object.fromEntries(fields.filter((key) => Object.hasOwn(value, key))
    .map((key) => [key, value[key]]));

// Only schema-declared identities and dates accept equivalent string representations.
// Mixed payloads and free text are opaque, including hex/date-looking strings.
const typedFields = (ids = '', dates = '') => Object.fromEntries([
    ...words(ids).filter(Boolean).map((key) => [key, 'objectId']),
    ...words(dates).filter(Boolean).map((key) => [key, 'date'])]);
const ROW_TYPES = typedFields('_id', 'hmeromhnia');
const EMPLOYEE_TYPES = typedFields('_id', 'hmeromhnia_proslhpshs hmeromhnia_apoxorhshs hmnia_enarxhs_daneismoy hmnia_lhxhs_daneismoy');
const HISTORY_TYPES = typedFields('_id', `hmeromhnia_allaghs_symbashs hmeromhnia_allaghs_orarioy_apo
    hmeromhnia_allaghs_orarioy_eos hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos createdAt`);
const POLICY_TYPES = typedFields('_id', 'effective_from effective_to');
const DECISION_TYPES = typedFields('_id employee_id', 'week_start week_end reuse_effective_from reuse_effective_to created_at');
const PROFILE_TYPES = { ...EMPLOYEE_TYPES, ...HISTORY_TYPES,
    ...typedFields('istorikoId profile_employee_id profile_history_id', 'review_date'),
    loan_interval: typedFields('', 'from to') };
// Provider read records have explicit, disjoint model schemas. Their union only
// applies inside projected provider facts, never inside mixed decision payloads.
const PROVIDER_FACT_TYPES = { ...EMPLOYEE_TYPES, ...HISTORY_TYPES, ...ROW_TYPES };
const READ_TYPES = { facts: { '*': PROVIDER_FACT_TYPES } };
const CONTEXT_TYPES = {
    semantics: {},
    scope: { target: ROW_TYPES, periodScope: typedFields('', 'period_start period_end'),
        ...typedFields('', 'naturalStart naturalEnd calculationStart calculationEnd') },
    weeklyRows: { '*': ROW_TYPES }, targetCompensationInputs: ROW_TYPES,
    employeeProfileFacts: EMPLOYEE_TYPES, employmentHistoryFacts: { '*': HISTORY_TYPES },
    borrowedProfileFacts: { reads: { '*': READ_TYPES } }, companyPolicyRules: { '*': POLICY_TYPES },
    holidayAndNoCardFacts: { reads: { '*': READ_TYPES }, resolutions: { '*': {
        date: 'date', effectiveProfile: PROFILE_TYPES, holidays: { '*': { 0: 'date' } } } } },
    postCheckArgiesDateSet: { dates: { '*': 'date' }, eligibility: { '*': EMPLOYEE_TYPES }, rows: { '*': ROW_TYPES } },
    canonicalDecisions: { '*': DECISION_TYPES }, appliedRepoProtectionFacts: { '*': {
        ...typedFields('_id decision_id employee_id source_prodhlomena_oraria_id target_prodhlomena_oraria_id created_by_user_id',
            'week_start week_end applied_at created_at'),
        authorization_metadata: typedFields('', 'original_approval_timestamp') } }
};
// Tags keep missing, undefined, null, BSON identities, dates and opaque strings distinct.
function normalize(value, schema = null, ancestors = new Set()) {
    if (value === undefined) return ['undefined'];
    if (value === null) return ['null'];
    if (typeof value === 'boolean') return ['boolean', value];
    if (typeof value === 'number' && Number.isFinite(value)) return ['number', Object.is(value, -0) ? '-0' : value];
    if (value instanceof mongoose.Types.ObjectId && Object.getPrototypeOf(value) === mongoose.Types.ObjectId.prototype) {
        return ['objectId', value.toHexString()];
    }
    if (value instanceof Date && Object.getPrototypeOf(value) === Date.prototype && Number.isFinite(value.getTime())) {
        return ['date', value.toISOString()];
    }
    if (typeof value === 'string') {
        if (schema === 'objectId') {
            if (!/^[a-f\d]{24}$/i.test(value)) fail('CONTEXT_INVALID_OBJECTID');
            return ['objectId', value.toLowerCase()];
        }
        if (schema === 'date') {
            if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)) fail('CONTEXT_INVALID_DATE');
            const date = new Date(value);
            if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) fail('CONTEXT_INVALID_DATE');
            return ['date', date.toISOString()];
        }
        return ['string', value];
    }
    if (!value || typeof value !== 'object' || ancestors.has(value) ||
        ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(value))) fail('CONTEXT_UNSUPPORTED_TYPE');
    ancestors.add(value);
    const keys = Reflect.ownKeys(value).filter((key) => !(Array.isArray(value) && key === 'length'));
    for (const key of keys) {
        const d = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value') ||
            (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key))) fail('CONTEXT_UNSUPPORTED_TYPE');
    }
    const result = Array.isArray(value)
        ? ['array', Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)
            ? normalize(value[index], schema?.[index] ?? schema?.['*'], ancestors) : ['missing'])]
        : ['object', keys.sort().map((key) => [key, normalize(value[key], schema?.[key], ancestors)])];
    ancestors.delete(value);
    return result;
}
const encode = (value, schema) => JSON.stringify(normalize(value, schema));
const digest = (value, schema) => crypto.createHash('sha256').update(encode(value, schema)).digest('hex');
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const factTypes = (fields) => fields === POLICY_FIELDS ? POLICY_TYPES : fields === DECISION_FIELDS ? DECISION_TYPES
    : fields === EXECUTION_PROTECTION_FIELDS ? CONTEXT_TYPES.appliedRepoProtectionFacts['*'] : PROVIDER_FACT_TYPES;
const sortFacts = (rows, fields) => rows.map((row) => pick(row, fields)).sort((a, b) =>
    compareText(encode([a.hmeromhnia, a.kodikos, a._id, a], { 0: 'date', 2: 'objectId', 3: factTypes(fields) }), encode([b.hmeromhnia, b.kodikos, b._id, b], { 0: 'date', 2: 'objectId', 3: factTypes(fields) })));
function validateTarget(target) {
    normalize(target);
    if (!target || Object.keys(target).sort().join() !== [...IDENTITY_FIELDS].sort().join()) fail('TARGET_IDENTITY_INVALID');
    for (const key of ['team', 'company_kod', 'ypokatasthma', 'kodikos']) {
        if (typeof target[key] !== 'string' || !target[key] || target[key] !== target[key].trim()) fail('TARGET_IDENTITY_INVALID');
    }
    if (!/^[a-f\d]{24}$/i.test(String(target._id)) || !/^[a-f\d]{24}$/i.test(target.company_kod) ||
        !/^\d{4}$/.test(target.ypokatasthma)) fail('TARGET_IDENTITY_INVALID');
    const value = target.hmeromhnia;
    if (!(value instanceof Date) && (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}(?:T00:00:00\.000Z)?$/.test(value))) fail('TARGET_IDENTITY_INVALID');
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(11) !== '00:00:00.000Z' ||
        (typeof value === 'string' && date.toISOString().slice(0, 10) !== value.slice(0, 10))) fail('TARGET_IDENTITY_INVALID');
    return { ...target, _id: String(target._id).toLowerCase(), company_kod: target.company_kod, hmeromhnia: date.toISOString() };
}
function targetScope(target, supplied) {
    const date = new Date(target.hmeromhnia);
    const scope = normalizeScope(supplied || { team: target.team, company_kod: target.company_kod,
        ypokatasthma: target.ypokatasthma, period_start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
        period_end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)) });
    if (['team', 'company_kod', 'ypokatasthma'].some((key) => scope[key] !== target[key]) ||
        date < scope.period_start || date > scope.period_end) fail('TARGET_SCOPE_INVALID');
    return scope;
}
function defaultModels() {
    return { rowModel: ProdhlomenaOrariaModel, employeeModel: ErgazomenoiModel,
        historyModel: IstorikoProslhpseonAllagonModel, companiesModel: CompaniesModel, argiesModel: ArgiesModel,
        policyModel: require('../../models/apasxoliseisCompanyPolicyRule'),
        decisionModel: require('../../models/apasxoliseisWeeklyCanonicalDecision'),
        executionModel: require('../../models/apasxoliseisWeeklyRepoTransferExecution'),
        periodModel: require('../../models/apasxoliseisPeriodControl') };
}

// Only exposes read operations. All legacy provider reads share this queue and
// exactly this session; findOne is cardinality-checked rather than first-wins.
function readModels(models, session, capture) {
    let pending = Promise.resolve();
    return Object.fromEntries(Object.entries(models).map(([name, model]) => [name,
        Object.fromEntries(['find', 'findOne'].map((method) => [method, (filter) => {
            let query = model.find(filter);
            if (session) query = query.session(session);
            const adapter = {
                select(fields) { query = query.select(fields); return adapter; },
                sort(fields) { query = query.sort(fields); return adapter; },
                session(supplied) { if (supplied !== session) fail('CONTEXT_SESSION_MISMATCH'); return adapter; },
                lean() {
                    const result = pending.then(async () => {
                        const rows = await query.lean();
                        if (!Array.isArray(rows)) fail('CONTEXT_INVALID_QUERY_RESULT');
                        rows.forEach((row) => normalize(row));
                        if (method === 'findOne' && rows.length > 1) fail('CONTEXT_AMBIGUOUS_FACTS');
                        capture(name, rows);
                        return method === 'findOne' ? rows[0] || null : rows;
                    });
                    pending = result.then(() => undefined, () => undefined);
                    return result;
                }
            };
            return adapter;
        }]))]));
}
function assertUnique(rows, key, code) {
    const keys = rows.map(key);
    if (new Set(keys).size !== keys.length) fail(code);
}

async function loadAuthoritativeContext({ target: input, periodScope, session = null, models: injected } = {}) {
    const target = validateTarget(input);
    const scope = targetScope(target, periodScope);
    const models = injected || defaultModels();
    const holidayReads = [], borrowedReads = [];
    let loadingBorrowed = false;
    const m = readModels(models, session, (name, rows) => {
        if (['companiesModel', 'argiesModel'].includes(name)) {
            const facts = sortFacts(rows, name === 'companiesModel' ? COMPANY_FIELDS : HOLIDAY_FIELDS);
            holidayReads.push({ name, facts });
            if (name === 'argiesModel') assertUnique(rows, (row) => dateKeyUtc(row.hmeromhnia), 'HOLIDAY_AMBIGUOUS');
        }
        if (loadingBorrowed && ['companiesModel', 'employeeModel', 'historyModel'].includes(name)) {
            borrowedReads.push({ name, facts: sortFacts(rows, name === 'companiesModel' ? COMPANY_FIELDS
                : name === 'employeeModel' ? EMPLOYEE_FIELDS : HISTORY_FIELDS) });
        }
    });
    const naturalStart = startOfWeekMondayUtc(target.hmeromhnia);
    const naturalEnd = endOfWeekSundayUtc(target.hmeromhnia);
    const calculationStart = new Date(Math.max(naturalStart, scope.period_start));
    const periodEnd = new Date(scope.period_end); periodEnd.setUTCHours(23, 59, 59, 999);
    const calculationEnd = new Date(Math.min(naturalEnd, periodEnd));
    const business = { team: target.team, company_kod: target.company_kod, ypokatasthma: target.ypokatasthma };
    const stored = await m.rowModel.find({ ...business, kodikos: target.kodikos,
        hmeromhnia: new Date(target.hmeromhnia) }).lean();
    if (stored.length !== 1 || String(stored[0]._id) !== target._id) fail('TARGET_ROW_NOT_UNIQUE');
    const targetRow = stored[0];
    if (encode(validateTarget(pick(targetRow, IDENTITY_FIELDS))) !== encode(target)) fail('TARGET_IDENTITY_MISMATCH');
    // This projection reproduces the production employee eligibility set for
    // date-level holiday flags without loading other employees' payroll facts.
    const eligibleEmployees = await m.employeeModel.find({ ...business, $and: mongoose.trusted([
        { $or: mongoose.trusted([{ hmeromhnia_proslhpshs: null },
            { hmeromhnia_proslhpshs: mongoose.trusted({ $lte: periodEnd }) }]) },
        { $or: mongoose.trusted([{ hmeromhnia_apoxorhshs: null },
            { hmeromhnia_apoxorhshs: mongoose.trusted({ $gte: scope.period_start }) }]) }
    ]) }).select('_id kodikos hmeromhnia_proslhpshs hmeromhnia_apoxorhshs').lean();
    assertUnique(eligibleEmployees, (row) => String(row.kodikos), 'EMPLOYEE_IDENTITY_AMBIGUOUS');
    const employees = await m.employeeModel.find({ ...business, kodikos: target.kodikos }).select(EMPLOYEE_FIELDS.join(' ')).lean();
    if (employees.length !== 1 || !eligibleEmployees.some((row) => String(row._id) === String(employees[0]._id))) fail('EMPLOYEE_IDENTITY_AMBIGUOUS');
    const employee = employees[0];
    if (!isDateWithinEmploymentPeriod(target.hmeromhnia, employee)) fail('TARGET_OUTSIDE_EMPLOYMENT');
    const loadedRows = await m.rowModel.find({ ...business, kodikos: target.kodikos,
        hmeromhnia: mongoose.trusted({ $gte: naturalStart, $lte: naturalEnd }) }).select(WEEKLY_FIELDS.join(' ')).lean();
    assertUnique(loadedRows, (row) => `${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`, 'WEEKLY_ROW_AMBIGUOUS');
    const projectedTarget = loadedRows.find((row) => String(row._id) === target._id);
    if (!projectedTarget || encode(pick(targetRow, WEEKLY_FIELDS)) !== encode(pick(projectedTarget, WEEKLY_FIELDS))) fail('TARGET_CHANGED_DURING_READ');
    const weeklyRows = sortFacts(loadedRows.filter((row) => isDateWithinEmploymentPeriod(row.hmeromhnia, employee)), WEEKLY_FIELDS);
    const dateRows = await m.rowModel.find({ ...business,
        kodikos: mongoose.trusted({ $in: eligibleEmployees.map((row) => row.kodikos) }),
        hmeromhnia: mongoose.trusted({ $gte: naturalStart, $lte: naturalEnd })
    }).select('_id kodikos hmeromhnia argia argia_apologistika').lean();
    assertUnique(dateRows, (row) => `${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`, 'DATE_FACT_ROW_AMBIGUOUS');
    const eligibleByCode = new Map(eligibleEmployees.map((row) => [String(row.kodikos), row]));
    const dateFacts = dateRows.filter((row) => eligibleByCode.has(String(row.kodikos)) &&
        isDateWithinEmploymentPeriod(row.hmeromhnia, eligibleByCode.get(String(row.kodikos))));
    const ownDateFacts = dateFacts.filter((row) => String(row.kodikos) === target.kodikos);
    const flagFields = ['_id', 'kodikos', 'hmeromhnia', 'argia', 'argia_apologistika'];
    if (encode(sortFacts(ownDateFacts, flagFields)) !== encode(sortFacts(weeklyRows, flagFields))) {
        fail('DATE_FACTS_CHANGED_DURING_READ');
    }
    const postCheckArgiesDateSet = new Set(dateFacts.filter((row) => row.argia === true || row.argia_apologistika === true)
        .map((row) => dateKeyUtc(row.hmeromhnia)).sort());
    const histories = await m.historyModel.find({ team: target.team, company_kod: target.company_kod,
        kodikos: target.kodikos, $or: mongoose.trusted([
            { hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({ $lte: naturalEnd }),
                $or: mongoose.trusted([{ hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({ $gte: naturalStart }) },
                    { hmeromhnia_isxyos_oron_ergasias_eos: null }]) },
            { hmeromhnia_isxyos_oron_ergasias_apo: null,
                hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $lte: naturalEnd }),
                $or: mongoose.trusted([{ hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({ $gte: naturalStart }) },
                    { hmeromhnia_allaghs_orarioy_eos: null }]) },
            { hmeromhnia_isxyos_oron_ergasias_apo: null, hmeromhnia_allaghs_orarioy_apo: null,
                hmeromhnia_allaghs_symbashs: mongoose.trusted({ $lte: naturalEnd }) }
        ]) }).select(NORMAL_HISTORY_FIELDS.join(' ')).lean();
    const relevantHistory = selectRelevantProfileHistory(histories, { naturalWeekStart: naturalStart, naturalWeekEnd: naturalEnd });
    // Canonical decision snapshots include the history array verbatim. Preserve
    // production's ascending query sort and projection, including absent fields.
    const historySortFields = ['kodikos', 'hmeromhnia_isxyos_oron_ergasias_apo',
        'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_symbashs', 'createdAt'];
    const historySortKey = (row) => historySortFields.map((key) => row[key] == null ? null :
        key === 'kodikos' ? row[key] : new Date(row[key]).toISOString());
    assertUnique(relevantHistory, (row) => encode(historySortKey(row)), 'HISTORY_ORDER_AMBIGUOUS');
    const history = relevantHistory.map((row) => pick(row, NORMAL_HISTORY_FIELDS)).sort((a, b) => {
        const left = historySortKey(a), right = historySortKey(b);
        for (let i = 0; i < left.length; i++) {
            if (left[i] === right[i]) continue;
            if (left[i] === null) return -1;
            if (right[i] === null) return 1;
            return left[i] < right[i] ? -1 : 1;
        }
        return 0;
    });
    // Same effective-start ties would make production first-wins order-dependent.
    const { isEffectiveTermsRowForDate, getEffectiveTermsApo } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
    for (let day = new Date(naturalStart); day <= naturalEnd; day.setUTCDate(day.getUTCDate() + 1)) {
        assertUnique(history.filter((row) => isEffectiveTermsRowForDate(row, day)),
            (row) => getEffectiveTermsApo(row).toISOString(), 'HISTORY_AMBIGUOUS');
    }
    const rules = sortFacts(await m.policyModel.find({ team: target.team, company_kod: target.company_kod,
        status: 'ACTIVE', effective_from: mongoose.trusted({ $lte: periodEnd }),
        $or: mongoose.trusted([{ effective_to: mongoose.trusted({ $gte: scope.period_start }) }, { effective_to: null }])
    }).select(POLICY_FIELDS.join(' ')).lean(), POLICY_FIELDS);
    for (let day = new Date(calculationStart); day <= calculationEnd; day.setUTCDate(day.getUTCDate() + 1)) {
        assertUnique(rules.filter((rule) => new Date(rule.effective_from) <= day &&
            (!rule.effective_to || new Date(rule.effective_to) >= day)), (rule) => rule.policy_code, 'POLICY_AMBIGUOUS');
    }
    const decisions = sortFacts(await m.decisionModel.find({ ...business, decision_status: 'RECORDED',
        $or: mongoose.trusted([
            { employee_kodikos: target.kodikos, week_start: mongoose.trusted({ $lte: naturalEnd }), week_end: mongoose.trusted({ $gte: naturalStart }) },
            { reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE', reuse_effective_from: mongoose.trusted({ $lte: naturalEnd }),
                $or: mongoose.trusted([{ reuse_effective_to: mongoose.trusted({ $gte: naturalStart }) }, { reuse_effective_to: null }]) }
        ]) }).select(DECISION_FIELDS.join(' ')).lean(), DECISION_FIELDS);
    assertUnique(decisions, (row) => `${row.employee_kodikos}|${dateKeyUtc(row.week_start)}|${row.snapshot_fingerprint}`, 'DECISION_AMBIGUOUS');
    loadingBorrowed = true;
    const borrowedContexts = await preloadBorrowedEmploymentProfileContexts({ team: target.team, employees: [employee], models: m });
    loadingBorrowed = false;
    for (const context of borrowedContexts.values()) if (context.reason) fail(context.reason);
    const provider = await preloadEffectiveHolidayContextProvider({ team: target.team, employees: [employee],
        etos: String(naturalStart.getUTCFullYear()), periodStart: naturalStart, periodEnd: naturalEnd,
        normalHistoryByEmployeeKey: new Map([[employeeKey(employee), history]]), borrowedProfileContexts: borrowedContexts, models: m });
    const resolutions = [];
    for (let day = new Date(naturalStart); day <= naturalEnd; day.setUTCDate(day.getUTCDate() + 1)) {
        const resolution = provider.resolveForEmployeeDate({ employee, reviewDate: day, normalHistory: history });
        if (resolution.blocked) fail(resolution.resolution_reason);
        resolutions.push({ date: dateKeyUtc(day), effectiveProfile: resolution.effectiveProfile,
            companyFlags: resolution.holidayContext.companyFlags,
            company_kodikos: resolution.holidayContext.company_kodikos,
            holidays: [...resolution.holidayContext.argiesByDateKey.entries()].sort(([a], [b]) => a.localeCompare(b)) });
    }
    const protection = await loadAppliedRepoTransferProtectionContext({ scopes: [{ ...business,
        loadedRowIds: weeklyRows.map((row) => String(row._id)) }], executionModel: m.executionModel,
        includeExecutions: true, session });
    if (protection.hasConflicts) fail('APPLIED_PROTECTION_CONFLICT');
    const snapshot = {
        semantics: { version: FINGERPRINT_VERSION, mode: 'PERSISTED_POSTCHECK_ONLY',
            sameRunDailyCalculatedRowIds: [], stage1ProtectionReasons: [], illegalOvertimeSourceVersion: CALCULATION_SOURCE_VERSION },
        scope: { target, periodScope: scope, naturalStart, naturalEnd, calculationStart, calculationEnd },
        weeklyRows,
        targetCompensationInputs: pick(targetRow, TARGET_INPUT_FIELDS),
        employeeProfileFacts: pick(employee, EMPLOYEE_FIELDS),
        employmentHistoryFacts: history,
        borrowedProfileFacts: { state: borrowedContexts.size ? 'APPLICABLE' : 'NOT_APPLICABLE',
            reads: borrowedReads.sort((a, b) => compareText(encode(a, READ_TYPES), encode(b, READ_TYPES))) },
        companyPolicyRules: rules,
        holidayAndNoCardFacts: { reads: holidayReads.sort((a, b) => compareText(encode(a, READ_TYPES), encode(b, READ_TYPES))), resolutions },
        postCheckArgiesDateSet: { dates: [...postCheckArgiesDateSet],
            eligibility: sortFacts(eligibleEmployees, words('_id kodikos hmeromhnia_proslhpshs hmeromhnia_apoxorhshs')),
            rows: sortFacts(dateFacts, words('_id kodikos hmeromhnia argia argia_apologistika')) },
        canonicalDecisions: decisions,
        appliedRepoProtectionFacts: sortFacts(protection.executions || [], EXECUTION_PROTECTION_FIELDS)
    };
    normalize(snapshot, CONTEXT_TYPES);
    // Resolve against the full natural week even when the write builder is clipped
    // to a month. Compensation reasons are not an authoritative conflict gate.
    const week = { weekStart: naturalStart, weekEnd: naturalEnd, naturalWeekStart: naturalStart, naturalWeekEnd: naturalEnd };
    const groupedDecisions = groupWeeklyCanonicalDecisions(decisions);
    const decisionKey = weeklyCanonicalDecisionGroupKey({ ypokatasthma: target.ypokatasthma,
        employee_kodikos: target.kodikos, week_start: naturalStart, week_end: naturalEnd });
    const decisionRecords = [...(groupedDecisions.get(decisionKey) || []), ...(groupedDecisions.get('__REUSABLE__') || [])];
    if (decisionRecords.length) {
        const { effectiveProfile } = getWeeklyRepoProfileInfo({ week, istorikoRows: history, ergazomenos: employee,
            resolveProfileForDate: (reviewDate) => provider.resolveForEmployeeDate({ employee, reviewDate, normalHistory: history }).effectiveProfile });
        const automaticAnalysis = analyzeWeeklySixthSeventhDay({ weekRows: weeklyRows, effectiveProfile,
            hourlyRate: effectiveProfile.pragmatikoOromisthio, calculatedWorkHoursAuthoritative: true,
            allowDeclaredRepoIdentityOverride: true, canonicalRepoDayIdentitiesOverride: null });
        const snapshotInput = buildWeeklyCanonicalDecisionSnapshotInput({ team: target.team, company_kod: target.company_kod,
            employee, week, weekRows: weeklyRows, effectiveProfile, profileHistory: history, automaticAnalysis,
            appliedProtectionContext: protection, calculatedWorkHoursAuthoritative: true });
        const resolution = resolveWeeklyCanonicalDecisionAnalysis({ automaticAnalysis, snapshotInput, decisionRecords,
            weekRows: weeklyRows, effectiveProfile, employee, profileHistory: history });
        if (resolution.applicability === APPLICABILITY.CONFLICT) fail('TARGETED_CANONICAL_DECISION_CONFLICT');
    }
    return { target, periodScope: scope, targetRow, snapshot, models,
        builderInput: { sessionTeam: target.team, companyId: target.company_kod,
            apoDate: calculationStart, eosDate: calculationEnd, employees: [employee], rows: [targetRow], weeklyContextRows: weeklyRows,
            istorikoRowsByKodikos: new Map([[target.kodikos, history]]), companyPolicyRules: rules,
            postCheckArgiesDateSet, appliedProtectionContext: protection,
            appliedProtectionReasonsByWeek: new Map(), canonicalDecisionsByWeek: groupWeeklyCanonicalDecisions(decisions),
            sameRunDailyCalculatedRowIds: new Set(),
            resolveProfileForDate: (input) => provider.resolveForEmployeeDate(input).effectiveProfile,
            resolveHolidayContextForDate: (input) => provider.resolveForEmployeeDate(input).holidayContext,
            buildWeeklyIllegalOvertimeUpdate } };
}
function fingerprintContext(snapshot) { return digest(snapshot, CONTEXT_TYPES); }
function buildDiffDigest({ target, storedRow, minimalCanonicalDiff }) {
    return digest({ target: validateTarget(target), fields: Object.keys(minimalCanonicalDiff).sort().map((field) => ({ field,
        old: Object.hasOwn(storedRow, field) ? { present: true, value: storedRow[field] } : { present: false },
        new: { present: true, value: minimalCanonicalDiff[field] } })) }, { target: ROW_TYPES });
}
async function loadAndBuildTargetedCanonicalPostCheckDryRun(options) {
    const context = await loadAuthoritativeContext(options);
    const canonicalWritePlan = buildWeeklyRepoPostCheckWritePlan(context.builderInput);
    const contextFingerprint = fingerprintContext(context.snapshot);
    const { models, periodScope } = context;
    const state = await getPeriodControl({ scope: periodScope, periodControlModel: models.periodModel,
        historicalFingerprintResolver: (args) => calculateHistoricalFingerprints({ ...args,
            prodhlomenaModel: models.rowModel, models }) });
    if (![MODES.NORMAL, MODES.HISTORICAL_RECONSTRUCTED].includes(state.effective_mode)) fail('TARGET_PERIOD_NOT_WRITABLE');
    const period = await models.periodModel.findOne(periodScope).lean();
    if (!period || period.version !== state.version || period.status !== state.stored_status) fail('PERIOD_CHANGED_DURING_READ');
    const plan = buildTargetedCanonicalPostCheckCorrectionPlan({ target: context.target, storedRow: context.targetRow,
        canonicalWritePlan, periodScope, expectedPeriodToken: stateToken(state),
        expectedWriteFenceVersion: period.write_fence_version, expectedContextFingerprint: contextFingerprint });
    const summary = { target: plan.target, fingerprintVersion: FINGERPRINT_VERSION, contextFingerprint,
        periodToken: plan.expectedPeriodToken, writeFenceVersion: plan.expectedWriteFenceVersion,
        changedFieldCount: plan.changedFieldCount, changedFields: Object.keys(plan.minimalCanonicalDiff).sort(),
        minimalCanonicalDiff: plan.minimalCanonicalDiff,
        diffDigest: buildDiffDigest({ target: plan.target, storedRow: context.targetRow, minimalCanonicalDiff: plan.minimalCanonicalDiff }),
        canonicalSummary: canonicalWritePlan.compensationBreakdowns };
    return { summary, plan };
}
function createCurrentContextFingerprintResolver({ models } = {}) {
    return async function resolveCurrentContextFingerprint({ session, target, periodScope }) {
        if (!session) fail('CONTEXT_TRANSACTION_SESSION_REQUIRED');
        const context = await loadAuthoritativeContext({ session, target, periodScope, models });
        return fingerprintContext(context.snapshot);
    };
}
module.exports = { FINGERPRINT_VERSION, validateTarget, normalize, fingerprintContext, buildDiffDigest,
    loadAuthoritativeContext, loadAndBuildTargetedCanonicalPostCheckDryRun, createCurrentContextFingerprintResolver };
