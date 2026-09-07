'use strict';

const C = require('./employmentProfileContract');
const T = require('./employmentProfileTemporal');
const Terms = require('./getOrarioTermsForDate');

const IDENTITY_FIELDS = ['hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_apoxorhshs'];
const USER_FACT_FIELDS = C.FACT_FIELDS.filter(field => ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field));
const TRANSITION_FIELDS = [...new Set([...T.STANDARD_FIELDS, ...USER_FACT_FIELDS, ...IDENTITY_FIELDS])];
const NEW_CURRENT_FIELDS = [...C.ARRANGEMENT_FIELDS, ...C.BREAK_PAIRS.flat(), C.SCHEMA_VERSION, T.ANCHOR];
const numeric = new Set(['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias',
    'pososto_prosayxhshs_6hs_hmeras', 'nomimoOromisthio', 'pragmatikoOromisthio',
    'dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias']);
const booleans = new Set([C.ENABLED, 'dialleima_entos_ektos_orarioy', 'synexes_diakekomeno', 'typos_orarioy']);
const empty = value => value == null || value === '';
const number = value => empty(value) ? 0 : Number(String(value).replace(',', '.').trim());

// Compare the legacy reader's facts, not a new-contract snapshot. In particular,
// a blank number serialized as zero provides no evidence of an explicit change.
// No version/anchor input can opt a legacy employee into V1.
function semanticValue(record, field) {
    const value = record[field];
    if (IDENTITY_FIELDS.includes(field) || [C.FROM, C.UNTIL].includes(field)) {
        const date = field === T.START ? value || record.hmeromhnia_allaghs_orarioy_apo : value;
        return C.calendarDate(date, field)?.getTime() ?? null;
    }
    if (booleans.has(field)) {
        if (empty(value) || value === false || value === 'false') return false;
        if (value === true || value === 'true') return true;
        C.invalid(field, 'expected boolean');
    }
    if (field === C.DAYS) {
        if (empty(value)) return [];
        if (!Array.isArray(value) || value.some(day => !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 7)) {
            C.invalid(field, 'expected weekdays 1..7');
        }
        return [...new Set(value.map(Number))].sort();
    }
    if (['kathestos_apasxolhshs', 'typos_apasxolhshs'].includes(field)) {
        // The history mapping derives both aliases from the effective employee type.
        return Terms.resolveEmploymentTypeValue({ kathestos_apasxolhshs: empty(value)
            ? Terms.resolveEmploymentTypeValue(record) : value });
    }
    if (['hmeres_ergasias_ebdomadas', 'typos_ebdomadas'].includes(field)) {
        return Terms.normalizeWeeklyWorkdaysValue(value) ?? (empty(value)
            ? Terms.resolveEffectiveWeeklyWorkdays(record) ?? 0 : number(value));
    }
    if (field === 'apasxolhsh_basei_symbashs') return Terms.normalizeWeeklyWorkdaysValue(value) ?? String(value ?? '').trim();
    if (numeric.has(field)) {
        if (field === 'mo_oron_hmerhsias_ergasias' && !number(value)) {
            const days = Terms.resolveEffectiveWeeklyWorkdays(record);
            return days ? Number((number(record.ores_ergasias_ebdomadas) / days).toFixed(4)) : 0;
        }
        return number(value);
    }
    return empty(value) ? null : String(value).trim() || null;
}

function semanticEmploymentProfileChanged(current, { employeeChanges = {}, historyChanges = {}, identity = {} } = {}, input = {}) {
    // History's derived aliases are relevant, but omitted values must not erase
    // actual stored facts. Explicit profile input has final precedence.
    const submitted = Object.fromEntries(Object.entries({ ...historyChanges, ...employeeChanges, ...identity, ...input })
        .filter(([, value]) => value !== undefined));
    const proposed = { ...current, ...submitted };
    return TRANSITION_FIELDS.some(field => Object.hasOwn(submitted, field) &&
        JSON.stringify(semanticValue(current, field)) !== JSON.stringify(semanticValue(proposed, field)));
}

module.exports = { IDENTITY_FIELDS, TRANSITION_FIELDS, NEW_CURRENT_FIELDS, semanticEmploymentProfileChanged };
