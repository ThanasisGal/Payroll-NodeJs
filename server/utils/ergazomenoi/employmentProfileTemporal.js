'use strict';
const C = require('./employmentProfileContract');
const ANCHOR = 'employment_profile_pre_v1';
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const STANDARD_FIELDS = ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs', 'typos_apasxolhshs',
    'typos_ebdomadas', 'apasxolhsh_basei_symbashs', 'pososto_prosayxhshs_6hs_hmeras',
    'nomimoOromisthio', 'pragmatikoOromisthio', 'eidikh_kathgoria_ergazomenoy',
    'eidikh_periptosh', 'typos_ergazomenon'];
const ANCHOR_FIELDS = [...STANDARD_FIELDS, ...C.BREAK_FIELDS, 'synexes_diakekomeno',
    'typos_orarioy', 'evelikth_proselefsh', 'symbatikes_ores_ergasias'];
const PROFILE_FIELDS = [...new Set([...ANCHOR_FIELDS, ...C.FACT_FIELDS])];
const HISTORY_SELECT = [...new Set(['_id', 'team', 'company_kod', 'kodikos', 'aa_eggrafhs',
    START, END, 'hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'employment_profile_source', 'afora_allagh_oron_ergasias', 'afora_allagh_dialleimatos',
    'hmeromhnia_isxyos_dialleimatos_apo', 'createdAt', ...PROFILE_FIELDS])].join(' ');
function profileSelect(extra = '') {
    return [...new Set(`${HISTORY_SELECT} ${ANCHOR} ${extra}`.split(/\s+/).filter(Boolean))].join(' ');
}
function day(value) {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
const complete = row => C.readEmploymentProfile(row || {}).recorded;
const start = row => day(row?.[START] || row?.hmeromhnia_allaghs_orarioy_apo);
function end(row = {}) {
    return complete(row) ? day(row[END]) : day(row[END]) || day(row.hmeromhnia_allaghs_orarioy_eos);
}
function anchor(employee = {}) {
    const value = employee[ANCHOR];
    return value?.source === 'PRE_V1_CURRENT_OBSERVATION' && day(value.before) && value.facts
        ? value : null;
}
function versioned(employee = {}, rows = []) {
    return Boolean(anchor(employee) || employee[C.SCHEMA_VERSION] === 1 || (Array.isArray(rows) ? rows : []).some(row => row?.[C.SCHEMA_VERSION] === 1));
}
function capture(employee, rows, from) {
    if (!employee || versioned(employee, rows)) return null;
    const facts = Object.fromEntries(ANCHOR_FIELDS.filter(field => Object.hasOwn(employee, field) &&
        employee[field] !== undefined).map(field => [field, employee[field]]));
    return { source: 'PRE_V1_CURRENT_OBSERVATION', before: day(from), facts };
}
// No historical effective-start date is invented for an observed compatibility baseline.
// Missing V1 provenance/facts fail closed. Pure legacy fallback retains its old semantics.
function fallback(date, employee = {}, rows = []) {
    if (!versioned(employee, rows)) return { facts: employee, source: 'LEGACY_EMPLOYEE_FALLBACK' };
    const target = day(date), baseline = anchor(employee);
    if (target && baseline && target < day(baseline.before)) {
        return { facts: baseline.facts, source: 'PRE_V1_COMPATIBILITY_ANCHOR' };
    }
    const from = start(employee), until = end(employee);
    const later = (Array.isArray(rows) ? rows : []).some(row => row?.[C.SCHEMA_VERSION] === 1 && start(row) > target);
    if (target && complete(employee) && from && target >= from && (!until || target <= until) && !later) {
        return { facts: employee, source: 'CURRENT_PROFILE' };
    }
    return { facts: {}, source: 'UNRECORDED_PROFILE' };
}
function legacyBreakQuery(until, trusted) {
    return { afora_allagh_dialleimatos: true, hmeromhnia_isxyos_dialleimatos_apo: trusted({ $lte: until }) };
}
module.exports = { legacyBreakQuery, ANCHOR, START, END, STANDARD_FIELDS, ANCHOR_FIELDS, PROFILE_FIELDS,
    HISTORY_SELECT, profileSelect, day, complete, start, end, anchor, versioned, capture, fallback };
