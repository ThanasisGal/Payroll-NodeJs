'use strict';
// This contract is used only by the selected approved UPDATE. No legacy reader,
// calculation, schema default or general History classification is changed.
const Profile = require('../../utils/ergazomenoi/employmentProfileContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const metadata = Object.freeze([Profile.SCHEMA_VERSION, Profile.TYPE_VERSION]);
const fields = Object.freeze(Profile.FACT_FIELDS.filter(field => !metadata.includes(field)));
const empty = value => value === undefined || value === null || value === '';
const emptyDays = value => value == null || Array.isArray(value) && value.length === 0;
function inactiveEmptyDays(before, after) {
    return before?.[Profile.ENABLED] === false && after?.[Profile.ENABLED] === false &&
        emptyDays(before[Profile.DAYS]) && emptyDays(after[Profile.DAYS]) &&
        [Profile.TYPE, Profile.FROM, Profile.UNTIL, Profile.START, Profile.END, Profile.CATEGORY]
            .every(field => empty(before[field]) && empty(after[field]));
}
function validationView(row, original) {
    return inactiveEmptyDays(original, row) ? { ...row, [Profile.DAYS]: [] } : row;
}
function validRecordedProfile(row) {
    if (!Profile.readEmploymentProfile(row).recorded) return false;
    try {
        const normalized = Profile.normalizeEmploymentProfileSubmission(row, row);
        return Profile.FACT_FIELDS.every(field => A.equal(row[field], normalized[field]));
    } catch { return false; }
}
function diagnosis(original, candidate, patch) {
    const read = Profile.readEmploymentProfile(original);
    return { recorded: read.recorded, validRecorded: validRecordedProfile(original), schemaVersion: original[Profile.SCHEMA_VERSION] ?? null,
        expectedSchemaVersion: Profile.EMPLOYMENT_PROFILE_SCHEMA_VERSION,
        typeVersion: original[Profile.TYPE_VERSION] ?? null, unrecordedFields: read.unrecordedFields,
        arrangementChanges: Profile.ARRANGEMENT_FIELDS.filter(field => Object.hasOwn(patch, field)).map(field => ({
            fieldId: field, field: labels[field] || field, beforeRecorded: Object.hasOwn(original, field) && original[field] !== undefined,
            before: original[field] ?? null, after: candidate[field] ?? null })) };
}
function planCertification(original, candidate, answers) {
    const explicit = new Map([...answers].map(([entry, answer]) => [entry.canonicalField, answer.raw]));
    const missing = fields.filter(field => !explicit.has(field) ||
        ['dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias', Profile.ENABLED,
            'dialleima_entos_ektos_orarioy', 'synexes_diakekomeno', 'typos_orarioy', Profile.DAYS].includes(field) && explicit.get(field) === null);
    if (missing.length) return { missing, certificate: null, patch: null };
    // Nulls in optional date/time/text fields are explicit statements in this
    // separate review, never defaults copied from readEmploymentProfile().
    const facts = Object.fromEntries(fields.map(field => [field, candidate[field] ?? explicit.get(field)]));
    const normalized = Profile.normalizeEmploymentProfileSubmission(facts, facts);
    const mismatched = fields.filter(field => !A.equal(facts[field], normalized[field]));
    if (mismatched.length) return { missing: mismatched, certificate: null, patch: null };
    const certified = { ...facts, ...Object.fromEntries(metadata.map(field => [field, normalized[field]])) };
    const rows = [...fields, ...metadata].map(field => ({ fieldId: field,
        field: labels[field] || (field === Profile.SCHEMA_VERSION ? 'Έκδοση πιστοποιημένου προφίλ' : 'Έκδοση τύπου εγκεκριμένης ρύθμισης'),
        beforeRecorded: Object.hasOwn(original, field) && original[field] !== undefined,
        before: original[field] ?? null, after: certified[field] }));
    return { missing: [], certificate: { version: 'selected-profile-certification:v1', rows },
        patch: Object.fromEntries(Object.entries(certified).filter(([field, value]) =>
            !Object.hasOwn(original, field) || !A.equal(original[field], value))) };
}
function assertCertificate(original, candidate, patch, certificate) {
    if (!certificate || certificate.version !== 'selected-profile-certification:v1' ||
        !Array.isArray(certificate.rows) || certificate.rows.length !== Profile.FACT_FIELDS.length) return false;
    const normalized = Profile.normalizeEmploymentProfileSubmission(candidate, candidate);
    if (certificate.breakScope && (original.afora_allagh_dialleimatos !== true ||
        certificate.breakScope.source !== 'EXPLICIT_SELECTED_BREAK_CERTIFICATION' ||
        certificate.breakScope.fieldId !== 'hmeromhnia_isxyos_dialleimatos_apo' || !certificate.breakScope.evidence?.trim() ||
        !A.equal(certificate.breakScope.before, original.hmeromhnia_isxyos_dialleimatos_apo ?? null) ||
        !A.equal(certificate.breakScope.after, candidate.hmeromhnia_isxyos_dialleimatos_apo) ||
        !A.equal(certificate.breakScope.after, candidate.hmeromhnia_isxyos_oron_ergasias_apo))) return false;
    return Profile.readEmploymentProfile(candidate).recorded &&
        [...fields, ...metadata].every((field, index) => {
            const row = certificate.rows[index];
            return row.fieldId === field && A.equal(row.before, original[field] ?? null) &&
                row.beforeRecorded === (Object.hasOwn(original, field) && original[field] !== undefined) &&
                A.equal(row.after, candidate[field]) && A.equal(candidate[field], normalized[field]);
        }) && Object.keys(patch).every(field => !metadata.includes(field) || A.equal(patch[field], normalized[field]));
}
module.exports = { metadata, fields, inactiveEmptyDays, validationView, validRecordedProfile, diagnosis, planCertification, assertCertificate };
