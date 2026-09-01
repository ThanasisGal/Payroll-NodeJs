const mongoose = require('mongoose');
const { CompaniesModel } = require('../../models/companies');
const { ArgiesModel } = require('../../models/stathera_arxeia');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');
const {
    dateKeyUtc,
    addDaysUtc,
    endOfWeekSundayUtc
} = require('../../utils/date/mondaySundayWeek');

const ATOMIC_REPO_TRANSFER_ROW_FIELDS =
    '_id team company_kod ypokatasthma kodikos hmeromhnia ' +
    'kathgoria_ergasias apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
    'ores_ergasias repo adeia kathgoria_adeias ores_apoysias astheneia ' +
    'cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 cards_ores_ergasias ' +
    'apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika ' +
    'kathgoria_ergasias_apologistika apologistiko_biblio repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika ' +
    'argia argia_apologistika kyriakes_apologistika is_locked ' +
    'ores_ergasias_apologistika ores_pragmatikhs_ergasias_apologistika ores_adeias_pistomenes_apologistika ores_argias_pistomenes_apologistika compensation_breakdown_apologistika ' +
    'ores_nyxtas_apologistika ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika ' +
    'ores_yperergasias_apologistika ores_yperergasias_nyxtas_apologistika ores_yperergasias_argion_apologistika ores_yperergasias_argion_nyxtas_apologistika ' +
    'ores_nominhs_yperorias_apologistika ores_nominhs_yperorias_nyxtas_apologistika ores_nominhs_yperorias_argion_apologistika ores_nominhs_yperorias_argion_nyxtas_apologistika ' +
    'ores_paranomhs_yperorias_apologistika ores_paranomhs_yperorias_nyxtas_apologistika ores_paranomhs_yperorias_argion_apologistika ores_paranomhs_yperorias_argion_nyxtas_apologistika ' +
    'ores_prostheths_ergasias_apologistika ores_apoysias_apologistika';

const ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS =
    '_id company_kod kodikos eponymo onoma ypokatasthma energos archived updatedAt ' +
    'hmeromhnia_proslhpshs hmeromhnia_apoxorhshs ' +
    'kathestos_apasxolhshs plhrhs_apasxolhsh apasxolhsh_basei_symbashs ' +
    'pososto_prosayxhshs_6hs_hmeras hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias ' +
    'nomimoOromisthio pragmatikoOromisthio ' +
    'typos_ergazomenon eidikh_kathgoria_ergazomenoy eidikh_periptosh ' +
    'dialleima_entos_ektos_orarioy dialleima_se_lepta evelikth_proselefsh ' +
    'afora_daneismo_ergazomenoy typos_ergodoth_daneismoy ' +
    'hmnia_enarxhs_daneismoy hmnia_lhxhs_daneismoy ' +
    'afm_daneizomenoy_ergodoth kodikos_ergazomenoy_alloy_ergodoth';

const ATOMIC_REPO_TRANSFER_HISTORY_FIELDS =
    '_id kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs ' +
    'hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
    'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
    'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias ' +
    'kathestos_apasxolhshs typos_apasxolhshs typos_ebdomadas pososto_prosayxhshs_6hs_hmeras ' +
    'nomimoOromisthio pragmatikoOromisthio ' +
    'employment_profile_source afora_allagh_oron_ergasias createdAt updatedAt';

function clampDateStartUtc(value) { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
function normalizeDateOnly(value) { return value ? dateKeyUtc(value) : null; }

function getCompanyHolidayFlags(company = {}) {
    return {
        apasxolhsh_kata_tis_argies: company?.apasxolhsh_kata_tis_argies === true,
        leitoyrgia_stis_mh_ypoxreotikes_argies: company?.leitoyrgia_stis_mh_ypoxreotikes_argies === true
    };
}
function buildArgiesByDateKey(argies = [], companyFlags = {}) {
    const map = new Map();
    for (const argia of argies) {
        const key = dateKeyUtc(argia?.hmeromhnia); if (!key) continue;
        const isMandatoryHoliday = argia.ypoxreotikh_argia === true;
        const companyOperatesOnHoliday =
            typeof argia.leitoyrgia_etaireias === 'boolean'
                ? argia.leitoyrgia_etaireias
                : isMandatoryHoliday
                    ? companyFlags.apasxolhsh_kata_tis_argies === true
                    : companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true;
        const companyOperationSource = typeof argia.leitoyrgia_etaireias === 'boolean'
            ? 'ARGIES_LEITOYRGIA_ETAIREIAS'
            : isMandatoryHoliday
                ? 'COMPANY_APASXOLHSH_KATA_TIS_ARGIES'
                : 'COMPANY_LEITOYRGIA_STIS_MH_YPOXREOTIKES_ARGIES';
        map.set(key, {
            ypoxreotikh_argia: isMandatoryHoliday, isHoliday: true,
            isMandatoryHoliday, isOptionalHoliday: !isMandatoryHoliday,
            description: String(argia.perigrafh || argia.perigrafh_argias || '').trim().slice(0, 200),
            companyOperatesOnHoliday,
            companyOperationSource,
            blocksRepoTransfer: isMandatoryHoliday || !companyOperatesOnHoliday
        });
    }
    return map;
}
function isZeroHours(value) {
    const numeric = Number(value || 0);
    return !Number.isFinite(numeric) || Math.abs(numeric) < 0.000001;
}
function resolveNoCardsDisplayStatus(
    row = {},
    { argiesByDateKey = new Map(), companyFlags = {} } = {}
) {
    const cardFacts = buildApasxoliseisScenarioFacts(row).cards;
    if (
        String(row.kathgoria_ergasias || '').trim() !== 'ΕΡΓ' ||
        isZeroHours(row.ores_ergasias) ||
        !isZeroHours(row.cards_ores_ergasias) ||
        cardFacts.hasAnyCardEvidence
    ) {
        return '';
    }

    const argia = argiesByDateKey.get(dateKeyUtc(row.hmeromhnia));
    if (!argia) return 'ΑΔΕΙΑ';

    const companyOperatesOnHoliday =
        typeof argia.companyOperatesOnHoliday === 'boolean'
            ? argia.companyOperatesOnHoliday
            : argia.ypoxreotikh_argia === true
              ? companyFlags.apasxolhsh_kata_tis_argies === true
              : companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true;

    return companyOperatesOnHoliday ? 'ΑΔΕΙΑ' : 'ΑΡΓΙΑ';
}
function resolveCurrentApologistikaDisplayCategory(row = {}, context = {}) {
    const storedCategory = String(row.kathgoria_ergasias_apologistika || '').trim();
    return storedCategory || resolveNoCardsDisplayStatus(row, context);
}
async function buildNoCardsDisplayContext({ team, companyId, etos, periodStart, periodEnd, companiesModel = CompaniesModel, argiesModel = ArgiesModel }) {
    const sessionTeam = String(team || '').trim();
    const id = String(companyId || '').trim();
    if (!sessionTeam || !id) {
        const error = new Error('Δεν ήταν δυνατή η επίλυση του πλαισίου αργιών.');
        error.statusCode = 409;
        throw error;
    }
    const companyQuery = mongoose.Types.ObjectId.isValid(id)
        ? { _id: new mongoose.Types.ObjectId(id), team: sessionTeam }
        : { kod: id, team: sessionTeam };
    const company = id ? await companiesModel.findOne(companyQuery).select('team kod apasxolhsh_kata_tis_argies leitoyrgia_stis_mh_ypoxreotikes_argies').lean() : null;
    const resolvedCompanyKodikos = String(company?.kod || '').trim();
    if (!company || String(company.team || '').trim() !== sessionTeam || !resolvedCompanyKodikos) { const error = new Error('Δεν ήταν δυνατή η επίλυση του πλαισίου αργιών.'); error.statusCode = 409; throw error; }
    const startYear = new Date(periodStart).getUTCFullYear();
    const endYear = new Date(periodEnd).getUTCFullYear();
    const resolvedYears = Number.isSafeInteger(startYear) && Number.isSafeInteger(endYear)
        ? Array.from(
              { length: Math.max(endYear - startYear + 1, 0) },
              (_, index) => String(startYear + index)
          )
        : [String(etos || '')].filter(Boolean);
    const yearFilter = resolvedYears.length === 1
        ? resolvedYears[0]
        : mongoose.trusted({ $in: resolvedYears });
    const argies = await argiesModel.find({ team: sessionTeam, company_kod: resolvedCompanyKodikos, etos: yearFilter, hmeromhnia: mongoose.trusted({ $gte: periodStart, $lte: periodEnd }) }).select('hmeromhnia ypoxreotikh_argia leitoyrgia_etaireias perigrafh perigrafh_argias').lean();
    const companyFlags = getCompanyHolidayFlags(company);
    return { companyFlags, company_kodikos: resolvedCompanyKodikos, argiesByDateKey: buildArgiesByDateKey(argies, companyFlags) };
}
function getEffectiveRepoProfileForDate(date, history = [], employee = {}) { return getOrarioTermsForDate(date, history, employee); }
function getDailyRepoProfileInfo({ row = {}, istorikoRows = [], ergazomenos = {},
    resolveProfileForDate = null } = {}) {
    const resolved = typeof resolveProfileForDate === 'function'
        ? resolveProfileForDate(row.hmeromhnia)
        : getOrarioTermsForDate(row.hmeromhnia, istorikoRows, ergazomenos);
    const snapshot = String(row.kathestos_apasxolhshs_hmeras ?? '').trim();
    const employmentType = ['0', '1', '2'].includes(snapshot)
        ? snapshot
        : String(resolved.typos_apasxolhshs ?? resolved.kathestos_apasxolhshs ?? '').trim();
    const profile = { ...resolved, typos_apasxolhshs: employmentType,
        kathestos_apasxolhshs: employmentType,
        daily_employment_snapshot_source: ['0', '1', '2'].includes(snapshot)
            ? 'PRODHLomena_ORARIA' : 'ORARIO_TERMS_FOR_DATE' };
    return { profile, employmentType,
        expectedRepoCategory: employmentType === '0'
            ? 'ΑΝ'
            : (employmentType === '1' || employmentType === '2' ? 'ΜΕ' : null) };
}
function profileSignature(profile = {}) {
    return [
        String(profile.typos_apasxolhshs ?? ''),
        String(profile.hmeres_ergasias_ebdomadas ?? ''),
        String(profile.ores_ergasias_ebdomadas ?? ''),
        String(profile.mo_oron_hmerhsias_ergasias ?? ''),
        String(profile.pososto_prosayxhshs_6hs_hmeras ?? ''),
        String(profile.resolution_source ?? '')
    ].join('|');
}
function getProfileDateForDeviation(profile = {}, fallbackDate = null) {
    return normalizeDateOnly(profile.hmeromhnia_isxyos_oron_ergasias_apo) ||
        normalizeDateOnly(profile.hmeromhnia_allaghs_orarioy_apo) ||
        normalizeDateOnly(profile.hmeromhnia_allaghs_symbashs) ||
        normalizeDateOnly(fallbackDate);
}
function getWeeklyRepoProfileInfo({ week, istorikoRows = [], ergazomenos = {},
    resolveProfileForDate = null }) {
    const resolve = (date) => typeof resolveProfileForDate === 'function'
        ? resolveProfileForDate(date)
        : getEffectiveRepoProfileForDate(date, istorikoRows, ergazomenos);
    const sunday = week.naturalWeekEnd || endOfWeekSundayUtc(week.weekStart);
    const profiles = [];
    for (let day = clampDateStartUtc(week.weekStart); day <= week.weekEnd; day = addDaysUtc(day, 1)) profiles.push(resolve(day));
    const first = profiles[0] || resolve(week.weekStart);
    const sundayProfile = resolve(sunday);
    const last = profiles[profiles.length - 1] || resolve(week.weekEnd);
    const profileChangedInsideWeek =
        new Set(profiles.map(profileSignature)).size > 1 ||
        profileSignature(first) !== profileSignature(sundayProfile);
    const effective = {
        ...sundayProfile,
        profile_changed_inside_week: profileChangedInsideWeek
    };
    const blockedProfile = profiles.find((profile) => profile?.resolution_blocked === true);
    if (blockedProfile) {
        return {
            expectedWeeklyRepo: null,
            repoResolutionSource: null,
            repoResolutionReason: blockedProfile.resolution_reason,
            profileChangedInsideWeek,
            effectiveProfile: { ...blockedProfile, profile_changed_inside_week: profileChangedInsideWeek },
            effectiveProfileDate: getProfileDateForDeviation(blockedProfile, sunday),
            previousProfile: first,
            previousProfileDate: getProfileDateForDeviation(first, week.weekStart)
        };
    }
    const contractualWeeklyWorkdays = Number(effective.hmeres_ergasias_ebdomadas);
    const expectedWeeklyRepo = Number.isSafeInteger(contractualWeeklyWorkdays) &&
            contractualWeeklyWorkdays >= 1 &&
            contractualWeeklyWorkdays <= 6
          ? 7 - contractualWeeklyWorkdays
          : null;
    return {
        expectedWeeklyRepo,
        repoResolutionSource:
            expectedWeeklyRepo === null ? null : 'CONTRACTUAL_WEEKLY_WORKDAYS',
        repoResolutionReason: expectedWeeklyRepo === null
                ? 'INVALID_EFFECTIVE_WEEKLY_WORKDAYS'
                : null,
        profileChangedInsideWeek,
        effectiveProfile: effective,
        effectiveProfileDate: getProfileDateForDeviation(effective, sunday),
        previousProfile: first,
        previousProfileDate: getProfileDateForDeviation(first, week.weekStart)
    };
}

module.exports = {
    ATOMIC_REPO_TRANSFER_ROW_FIELDS, ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS,
    ATOMIC_REPO_TRANSFER_HISTORY_FIELDS, getCompanyHolidayFlags, buildArgiesByDateKey,
    buildNoCardsDisplayContext, resolveNoCardsDisplayStatus, getDailyRepoProfileInfo,
    resolveCurrentApologistikaDisplayCategory, getEffectiveRepoProfileForDate,
    getProfileDateForDeviation, getWeeklyRepoProfileInfo
};
