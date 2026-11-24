'use strict';

// One registry, derived from the persisted History contract. No I/O, version
// allocation, approval, default filling or permission is conferred by a diff.
const Contract = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const Profile = require('./employmentProfileContract');
const { TRANSITION_FIELDS, semanticEmploymentProfilePatch } = require('./employmentProfileTransition');
const { equal } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');

const fields = Object.freeze(Contract.PROFILE_FIELDS.map(field => {
    const employeePath = ErgazomenoiModel.schema.path(field);
    const role = !employeePath ? 'HISTORY_EVENT_DATE' : field === 'misthologiko_klimakio' ? 'SERVER_DERIVED' : 'PROFILE';
    return Object.freeze({ field, type: Contract.PROFILE_FIELD_TYPES[field], role,
        writable: role === 'PROFILE', label: labels[field] || field, trim: employeePath?.options.trim === true,
        formAliases: Object.freeze([field, `${field}_stathera`, `${field}_edit`]),
        neutralDefault: employeePath?.defaultValue === false ? false : employeePath?.defaultValue === 0 ? 0 : null });
}));
const byField = new Map(fields.map(entry => [entry.field, entry]));
const writableFields = Object.freeze(fields.filter(entry => entry.writable).map(entry => entry.field));
const workTerms = Object.freeze(Contract.CRITICAL_NUMBERS.concat('typos_ebdomadas'));

function createHistoricalComparison(current = {}) {
    const cache = new Map();
    const compared = new Map();
    let document;
    const normalize = (field, value) => {
        const entry = byField.get(field);
        if (!entry || value === undefined) return value;
        let values = cache.get(field);
        if (!values) cache.set(field, values = new Map());
        if (values.has(value)) return values.get(value);
        const path = ErgazomenoiModel.schema.path(field) || IstorikoProslhpseonAllagonModel.schema.path(field);
        // Validate the calendar literal before Mongoose can roll e.g. February
        // 30 into March. This retains the existing profile date contract.
        if (entry.type === 'Date') Profile.calendarDate(value,field);
        document ||= ErgazomenoiModel.hydrate(current, null, { defaults: false });
        // applySetters performs the very same trimming and casting as document.set.
        // A cast failure must propagate; it must never look like an unchanged value.
        let normalized = path.applySetters(value, document);
        if (entry.type === 'Date') normalized = Profile.calendarDate(normalized, field);
        if (field === Profile.DAYS && normalized != null)
            normalized = [...new Set(Array.from(normalized, Number))].sort((a,b) => a-b);
        values.set(value, normalized);
        return normalized;
    };
    const same = (field, value) => {
        const entry = byField.get(field);
        if (!entry) return equal(current[field], value);
        const normalized = normalize(field, value);
        let values = compared.get(field);
        if (!values) compared.set(field, values = new Map());
        if (values.has(normalized)) return values.get(normalized);
        const result = current[field] == null && entry.neutralDefault !== null && normalized === entry.neutralDefault ||
            (TRANSITION_FIELDS.includes(field) ? !Object.hasOwn(semanticEmploymentProfilePatch(current,
                { employeeChanges: { [field]: normalized } }), field) : equal(normalize(field, current[field]), normalized));
        values.set(normalized,result);
        return result;
    };
    const difference = values => Object.fromEntries(Object.entries(values || {})
        .filter(([field,value]) => byField.has(field) && value !== undefined && !same(field,value))
        .map(([field,value]) => [field,normalize(field,value)]));
    return { normalize, same, difference };
}

function normalizeProfileValues(values, current = {}) {
    const comparison = createHistoricalComparison(current);
    return Object.fromEntries(Object.entries(values || {}).map(([field,value]) => [field,comparison.normalize(field,value)]));
}

function clientBaseline(current = {}) {
    const comparison = createHistoricalComparison(current);
    return { version: 1, fields: fields.filter(entry => entry.writable).map(entry => {
        const identity = {...entry,recorded:Object.hasOwn(current,entry.field) && current[entry.field] !== undefined};
        try { return {...identity,value:comparison.normalize(entry.field,current[entry.field]) ?? null}; }
        catch { return {...identity,value:String(current[entry.field] ?? ''),invalid:true}; }
    }) };
}

module.exports = { fields, byField, writableFields, workTerms,
    createHistoricalComparison, normalizeProfileValues, clientBaseline };
