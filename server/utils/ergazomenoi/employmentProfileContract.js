'use strict';

// Facts only. Neither identifier grants leave credit or changes payroll calculations.
// Server-owned versions distinguish complete snapshots from unrecorded legacy facts.
const EMPLOYMENT_PROFILE_SCHEMA_VERSION = 1;
const ARRANGEMENT_TYPE_VERSION = '1';
const ARRANGEMENT_TYPES = Object.freeze({
    APPROVED_LEAVE_INTERRUPTION: Object.freeze({ requiresInterruption: true }),
    APPROVED_TIME_SHIFT_INTERRUPTION: Object.freeze({ requiresInterruption: true }),
    OTHER_APPROVED_ARRANGEMENT: Object.freeze({ requiresInterruption: false })
});
const ENABLED = 'afora_egkekrimenh_rythmish_ergasias';
const TYPE = 'typos_egkekrimenhs_rythmishs';
const FROM = 'hmnia_enarxhs_egkekrimenhs_rythmishs';
const UNTIL = 'hmnia_lhxhs_egkekrimenhs_rythmishs';
const START = 'diakoph_apo_ora_egkekrimenhs_rythmishs';
const END = 'diakoph_eos_ora_egkekrimenhs_rythmishs';
const DAYS = 'hmeres_efarmoghs_egkekrimenhs_rythmishs';
const CATEGORY = 'kathgoria_adeias_egkekrimenhs_rythmishs';
const TYPE_VERSION = 'ekdosh_typoy_egkekrimenhs_rythmishs';
const SCHEMA_VERSION = 'employment_profile_schema_version';
const ARRANGEMENT_FIELDS = Object.freeze([ENABLED, TYPE, FROM, UNTIL, START, END, DAYS, CATEGORY, TYPE_VERSION]);
const BREAK_PAIRS = Object.freeze([1, 2, 3].map((n) => Object.freeze([
    `dialleima_apo_ora_0${n}`, `dialleima_eos_ora_0${n}`
])));
const BREAK_FIELDS = Object.freeze(['dialleima_se_lepta', 'dialleima_entos_ektos_orarioy', ...BREAK_PAIRS.flat()]);
const FACT_FIELDS = Object.freeze([...ARRANGEMENT_FIELDS, ...BREAK_FIELDS,
    'synexes_diakekomeno', 'typos_orarioy', 'evelikth_proselefsh', 'symbatikes_ores_ergasias', SCHEMA_VERSION]);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const empty = (value) => value === undefined || value === null || value === '';
function invalid(field, reason) {
    const error = new Error(`${field}: ${reason}`);
    error.code = 'INVALID_EMPLOYMENT_PROFILE'; error.field = field; error.statusCode = 400;
    throw error;
}
function calendarDate(value, field = 'date') {
    if (empty(value)) return null;
    const raw = value instanceof Date ? (Number.isNaN(value.getTime()) ? '' : value.toISOString()) : value;
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(raw)) {
        invalid(field, 'expected calendar date YYYY-MM-DD');
    }
    const day = raw.slice(0, 10);
    const date = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) invalid(field, 'invalid date');
    return date;
}
function text(value, field) {
    if (empty(value)) return null;
    if (typeof value !== 'string') invalid(field, 'expected string');
    return value.trim() || null;
}
function boolean(value, field) {
    if (empty(value)) return false;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    invalid(field, 'expected boolean');
}
function number(value, field) {
    if (empty(value)) return 0;
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') invalid(field, 'expected number');
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) invalid(field, 'expected non-negative number');
    return result;
}
function interval(start, end, field) {
    if (start === null && end === null) return null;
    if (!start || !end) invalid(field, 'both ends of the pair are required');
    if (![start, end].every((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v))) invalid(field, 'expected HH:mm');
    const minute = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    const a = minute(start); const b = minute(end);
    const duration = (b - a + 1440) % 1440;
    if (!duration) invalid(field, 'duration must be positive');
    return { start: a, end: b, duration,
        segments: b > a ? [[a, b]] : [[a, 1440], [0, b]] };
}
function defaults() {
    return { [ENABLED]: false, [TYPE]: null, [FROM]: null, [UNTIL]: null,
        [START]: null, [END]: null, [DAYS]: [], [CATEGORY]: null, [TYPE_VERSION]: null,
        [SCHEMA_VERSION]: null, dialleima_se_lepta: 0, dialleima_entos_ektos_orarioy: false,
        ...Object.fromEntries(BREAK_PAIRS.flat().map((field) => [field, null])),
        synexes_diakekomeno: false, typos_orarioy: false, evelikth_proselefsh: 0, symbatikes_ores_ergasias: 0 };
}
// No validation, coercion or clamping on reads: preserve stored legacy values (including >30).
function readEmploymentProfile(source = {}) {
    const facts = defaults();
    for (const field of FACT_FIELDS) if (has(source, field) && source[field] !== undefined) {
        facts[field] = Array.isArray(source[field]) ? [...source[field]] : source[field];
    }
    const unrecordedFields = FACT_FIELDS.filter((field) => !has(source, field) || source[field] === undefined);
    return { facts, recorded: source[SCHEMA_VERSION] === EMPLOYMENT_PROFILE_SCHEMA_VERSION && unrecordedFields.length === 0,
        unrecordedFields };
}
// Add/Edit validates even omitted durations; historical snapshot inheritance may
// retain an unchanged legacy value. Both paths use the same category policy.
function normalizeEmploymentBreakSubmission(input = {}, current = {}, { allowLegacyDuration = true } = {}) {
    const category = input.eidikh_kathgoria_ergazomenoy !== undefined
        ? input.eidikh_kathgoria_ergazomenoy : current.eidikh_kathgoria_ergazomenoy;
    const alwaysInside = ['0004', '0005'].includes(String(category ?? '').trim());
    const max = alwaysInside ? 45 : 30;
    const value = field => input[field] !== undefined ? input[field] : current[field];
    const minutes = number(value('dialleima_se_lepta') ?? 0, 'dialleima_se_lepta');
    const inside = boolean(value('dialleima_entos_ektos_orarioy') ?? false, 'dialleima_entos_ektos_orarioy');
    const preservedLegacyDuration = allowLegacyDuration && input.dialleima_se_lepta === undefined &&
        category === current.eidikh_kathgoria_ergazomenoy &&
        Number(current.dialleima_se_lepta) === minutes && Number.isInteger(minutes) && minutes > max;
    if (!preservedLegacyDuration && (!Number.isInteger(minutes) || (minutes !== 0 && (minutes < 15 || minutes > max)))) {
        invalid('dialleima_se_lepta', `expected 0 or 15..${max} minutes`);
    }
    return { dialleima_se_lepta: minutes, dialleima_entos_ektos_orarioy: alwaysInside || inside };
}
function normalizeEmploymentProfileSubmission(input = {}, current = {}) {
    const facts = readEmploymentProfile(current).facts;
    for (const field of FACT_FIELDS) if (has(input, field) && input[field] !== undefined) facts[field] = input[field];
    facts[ENABLED] = boolean(facts[ENABLED], ENABLED);
    for (const field of [TYPE, START, END, CATEGORY, ...BREAK_PAIRS.flat()]) facts[field] = text(facts[field], field);
    for (const field of [FROM, UNTIL]) facts[field] = calendarDate(facts[field], field);
    if (!Array.isArray(facts[DAYS]) || facts[DAYS].some((n) =>
        !((typeof n === 'number' && Number.isInteger(n)) || (typeof n === 'string' && /^[1-7]$/.test(n))) ||
        Number(n) < 1 || Number(n) > 7)) invalid(DAYS, 'expected integers 1..7');
    // [] means every scheduled working day; 1 = Monday, 7 = Sunday.
    facts[DAYS] = [...new Set(facts[DAYS].map(Number))].sort((a, b) => a - b);
    if (facts[TYPE] && !has(ARRANGEMENT_TYPES, facts[TYPE])) invalid(TYPE, 'unknown arrangement type');
    if (facts[ENABLED] && !facts[TYPE]) invalid(TYPE, 'required when enabled');
    if (facts[ENABLED] && !facts[FROM]) invalid(FROM, 'required when enabled');
    if (facts[UNTIL] && (!facts[FROM] || facts[UNTIL] < facts[FROM])) invalid(UNTIL, 'end precedes start');
    const interruption = interval(facts[START], facts[END], START);
    if (facts[ENABLED] && ARRANGEMENT_TYPES[facts[TYPE]].requiresInterruption && !interruption) invalid(START, 'interruption required');
    for (const field of ['synexes_diakekomeno', 'typos_orarioy']) facts[field] = boolean(facts[field], field);
    for (const field of ['evelikth_proselefsh', 'symbatikes_ores_ergasias']) facts[field] = number(facts[field], field);
    Object.assign(facts, normalizeEmploymentBreakSubmission(input, current));
    const minutes = facts.dialleima_se_lepta;
    const breaks = BREAK_PAIRS.map(([a, b]) => interval(facts[a], facts[b], a)).filter(Boolean);
    const segments = breaks.flatMap((pair) => pair.segments).sort((a, b) => a[0] - b[0]);
    if (segments.some((segment, i) => i > 0 && segment[0] < segments[i - 1][1])) invalid('dialleima', 'overlapping intervals');
    if (breaks.length && breaks.reduce((sum, pair) => sum + pair.duration, 0) !== minutes) invalid('dialleima_se_lepta', 'interval sum must equal configured duration');
    // Never trust versions supplied by HR. Version stamps describe this server's contract.
    facts[TYPE_VERSION] = facts[TYPE] ? ARRANGEMENT_TYPE_VERSION : null;
    facts[SCHEMA_VERSION] = EMPLOYMENT_PROFILE_SCHEMA_VERSION;
    return facts;
}
module.exports = { EMPLOYMENT_PROFILE_SCHEMA_VERSION, ARRANGEMENT_TYPE_VERSION, ARRANGEMENT_TYPES,
    ENABLED, TYPE, FROM, UNTIL, START, END, DAYS, CATEGORY, TYPE_VERSION, SCHEMA_VERSION,
    ARRANGEMENT_FIELDS, BREAK_FIELDS, BREAK_PAIRS, FACT_FIELDS, calendarDate, invalid,
    readEmploymentProfile, normalizeEmploymentBreakSubmission, normalizeEmploymentProfileSubmission };
