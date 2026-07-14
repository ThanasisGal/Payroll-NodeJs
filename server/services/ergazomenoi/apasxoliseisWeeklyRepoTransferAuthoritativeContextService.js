const mongoose = require('mongoose');
const { CompaniesModel } = require('../../models/companies');
const { ArgiesModel } = require('../../models/stathera_arxeia');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');

const ATOMIC_REPO_TRANSFER_ROW_FIELDS =
    '_id team company_kod ypokatasthma kodikos hmeromhnia ' +
    'kathgoria_ergasias apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
    'ores_ergasias repo adeia kathgoria_adeias astheneia ' +
    'cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 cards_ores_ergasias ' +
    'apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika ' +
    'kathgoria_ergasias_apologistika apologistiko_biblio repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika ' +
    'argia argia_apologistika kyriakes_apologistika is_locked ' +
    'ores_ergasias_apologistika ores_nyxtas_apologistika ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika ' +
    'ores_yperergasias_apologistika ores_yperergasias_nyxtas_apologistika ores_yperergasias_argion_apologistika ores_yperergasias_argion_nyxtas_apologistika ' +
    'ores_nominhs_yperorias_apologistika ores_nominhs_yperorias_nyxtas_apologistika ores_nominhs_yperorias_argion_apologistika ores_nominhs_yperorias_argion_nyxtas_apologistika ' +
    'ores_paranomhs_yperorias_apologistika ores_paranomhs_yperorias_nyxtas_apologistika ores_paranomhs_yperorias_argion_apologistika ores_paranomhs_yperorias_argion_nyxtas_apologistika ' +
    'ores_prostheths_ergasias_apologistika ores_apoysias_apologistika';

const ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS =
    '_id kodikos ypokatasthma energos archived updatedAt ' +
    'kathestos_apasxolhshs plhrhs_apasxolhsh apasxolhsh_basei_symbashs ' +
    'mhniaia_repo hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias ' +
    'typos_ergazomenon dialleima_entos_ektos_orarioy dialleima_se_lepta';

const ATOMIC_REPO_TRANSFER_HISTORY_FIELDS =
    '_id kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs ' +
    'hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
    'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
    'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias ' +
    'kathestos_apasxolhshs typos_apasxolhshs typos_ebdomadas mhniaia_repo ' +
    'employment_profile_source afora_allagh_oron_ergasias createdAt updatedAt';

function dateKeyUtc(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }
function addDaysUtc(date, days) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function clampDateStartUtc(value) { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
function endOfWeekSaturdayUtc(value) { const date = clampDateStartUtc(value); date.setUTCDate(date.getUTCDate() + (6 - date.getUTCDay())); date.setUTCHours(23, 59, 59, 999); return date; }
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
        const companyOperatesOnHoliday = isMandatoryHoliday
            ? companyFlags.apasxolhsh_kata_tis_argies === true
            : companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true;
        map.set(key, {
            ypoxreotikh_argia: isMandatoryHoliday, isHoliday: true,
            isMandatoryHoliday, isOptionalHoliday: !isMandatoryHoliday,
            description: String(argia.perigrafh || argia.perigrafh_argias || '').trim().slice(0, 200),
            companyOperatesOnHoliday,
            blocksRepoTransfer: isMandatoryHoliday || !companyOperatesOnHoliday
        });
    }
    return map;
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
    const argies = await argiesModel.find({ team: sessionTeam, company_kod: resolvedCompanyKodikos, etos: String(etos || ''), hmeromhnia: mongoose.trusted({ $gte: periodStart, $lte: periodEnd }) }).select('hmeromhnia ypoxreotikh_argia perigrafh perigrafh_argias').lean();
    const companyFlags = getCompanyHolidayFlags(company);
    return { companyFlags, company_kodikos: resolvedCompanyKodikos, argiesByDateKey: buildArgiesByDateKey(argies, companyFlags) };
}
function getEffectiveRepoProfileForDate(date, history = [], employee = {}) { return getOrarioTermsForDate(date, history, employee); }
function profileSignature(profile = {}) { return [profile.source || '', String(profile.istorikoId || ''), String(profile.mhniaia_repo ?? ''), String(profile.typos_apasxolhshs ?? ''), String(profile.hmeres_ergasias_ebdomadas ?? ''), String(profile.ores_ergasias_ebdomadas ?? '')].join('|'); }
function getProfileDateForDeviation(profile = {}, fallbackDate = null) {
    return normalizeDateOnly(profile.hmeromhnia_isxyos_oron_ergasias_apo) ||
        normalizeDateOnly(profile.hmeromhnia_allaghs_orarioy_apo) ||
        normalizeDateOnly(profile.hmeromhnia_allaghs_symbashs) ||
        normalizeDateOnly(fallbackDate);
}
function getWeeklyRepoProfileInfo({ week, istorikoRows = [], ergazomenos = {} }) {
    const saturday = week.naturalWeekEnd || endOfWeekSaturdayUtc(week.weekStart);
    const profiles = [];
    for (let day = clampDateStartUtc(week.weekStart); day <= week.weekEnd; day = addDaysUtc(day, 1)) profiles.push(getEffectiveRepoProfileForDate(day, istorikoRows, ergazomenos));
    const first = profiles[0] || getEffectiveRepoProfileForDate(week.weekStart, istorikoRows, ergazomenos);
    const saturdayProfile = getEffectiveRepoProfileForDate(saturday, istorikoRows, ergazomenos);
    const last = profiles[profiles.length - 1] || getEffectiveRepoProfileForDate(week.weekEnd, istorikoRows, ergazomenos);
    const effective = week.isFullWeek ? saturdayProfile : last;
    return {
        expectedWeeklyRepo: Number(effective.mhniaia_repo ?? 0) || 0,
        profileChangedInsideWeek: new Set(profiles.map(profileSignature)).size > 1 || profileSignature(first) !== profileSignature(saturdayProfile),
        effectiveProfile: effective,
        effectiveProfileDate: getProfileDateForDeviation(effective, saturday),
        previousProfile: first,
        previousProfileDate: getProfileDateForDeviation(first, week.weekStart)
    };
}

module.exports = {
    ATOMIC_REPO_TRANSFER_ROW_FIELDS, ATOMIC_REPO_TRANSFER_EMPLOYEE_FIELDS,
    ATOMIC_REPO_TRANSFER_HISTORY_FIELDS, getCompanyHolidayFlags, buildArgiesByDateKey,
    buildNoCardsDisplayContext, getEffectiveRepoProfileForDate,
    getProfileDateForDeviation, getWeeklyRepoProfileInfo
};
