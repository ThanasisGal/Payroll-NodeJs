'use strict';

const crypto = require('crypto');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { employeeIsEligibleForProdhlomenaOraria } =
    require('./erganiImportedEmployeeScopeService');
const { dateKey } = require('./wtoLeaveEntitlementService');

const LEGAL_OVERTIME_FIELDS = Object.freeze([
    'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika'
]);
const LEGAL_OVERWORK_FIELDS = Object.freeze([
    'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika'
]);
const MAX_AUTOMATIC_OVERTIME_MINUTES = 180;
const CANONICAL_INTERVAL_MISSING_MESSAGE =
    'Δεν υπάρχει έγκυρο απολογιστικό διάστημα νόμιμης υπερωρίας.\n' +
    'Εκτελέστε ξανά τον Υπολογισμό / Έλεγχο Απασχολήσεων για τη συγκεκριμένη ημέρα.';
const CAP_WARNING = 'Η απολογιστική νόμιμη υπερωρία της ημέρας υπερβαίνει τις 3 ώρες. ' +
    'Στην αυτόματη υποβολή θα συμπεριληθούν έως 3 ώρες. ' +
    'Ο επιπλέον χρόνος δεν περιλαμβάνεται στην αυτόματη υποβολή και ' +
    'απαιτεί χειροκίνητο έλεγχο/ενέργεια στο ΕΡΓΑΝΗ, εφόσον χρειάζεται.';

function clean(value) { return String(value ?? '').trim(); }
function numericHours(value) {
    if (value === null || value === undefined || clean(value) === '') return 0;
    const number = Number(clean(value).replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : 0;
}
function sumHours(row, fields) {
    return fields.reduce((sum, field) => sum + numericHours(row?.[field]), 0);
}
function hoursToMinutes(hours) { return Math.round(numericHours(hours) * 60); }
function totalFieldMinutes(row, fields) { return hoursToMinutes(sumHours(row, fields)); }
function normalizeMinutes(value) { return ((value % 1440) + 1440) % 1440; }
function minutesToTime(value) {
    if (!Number.isSafeInteger(value)) return null;
    const normalized = normalizeMinutes(value);
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}
function timeToMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clean(value));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
function formatDate(value) {
    const [year, month, day] = dateKey(value).split('-');
    return `${day}/${month}/${year}`;
}
function payloadDateKey(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(value));
    return match ? `${match[3]}-${match[2]}-${match[1]}` : clean(value);
}
function issue(kind, code, message, row = {}, details = {}) {
    return Object.freeze({ kind, code, message, source_record_id: clean(row._id),
        employee_code: clean(row.kodikos), date: row.hmeromhnia ? dateKey(row.hmeromhnia) : '',
        ...details });
}
function blocker(code, message, row, details) { return issue('BLOCKER', code, message, row, details); }
function warning(code, message, row, details) { return issue('WARNING', code, message, row, details); }

function validateIdentity(employee, row) {
    const afm = clean(employee?.afm);
    const eponymo = clean(employee?.eponymo);
    const onoma = clean(employee?.onoma);
    if (!/^\d{9}$/.test(afm)) return blocker('WTOOVA_INVALID_AFM',
        'Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.', row);
    if (!eponymo || eponymo.length > 50) return blocker('WTOOVA_INVALID_SURNAME',
        'Το επώνυμο πρέπει να έχει 1 έως 50 χαρακτήρες.', row);
    if (!onoma || onoma.length > 30) return blocker('WTOOVA_INVALID_NAME',
        'Το όνομα πρέπει να έχει 1 έως 30 χαρακτήρες.', row);
    return null;
}

function buildWtoOvertimeCanonicalDataset({ sourceRows = [], employees = [] } = {}) {
    const employeeByCode = new Map(employees.map((employee) => [clean(employee.kodikos), employee]));
    const rows = [];
    const blockers = [];
    const warnings = [];
    const employeeDateKeys = new Set();
    const afmDateKeys = new Set();
    const sortedSources = [...sourceRows].sort((left, right) =>
        `${dateKey(left.hmeromhnia)}|${clean(left.kodikos)}`.localeCompare(
            `${dateKey(right.hmeromhnia)}|${clean(right.kodikos)}`));

    for (const source of sortedSources) {
        const legalOvertimeMinutes = totalFieldMinutes(source, LEGAL_OVERTIME_FIELDS);
        if (legalOvertimeMinutes <= 0) continue;
        const employee = employeeByCode.get(clean(source.kodikos));
        if (!employee) {
            blockers.push(blocker('WTOOVA_CURRENT_EMPLOYEE_NOT_FOUND',
                'Δεν βρέθηκε σημερινή εγγραφή εργαζομένου για τη νόμιμη υπερωρία.', source));
            continue;
        }
        if (!employeeIsEligibleForProdhlomenaOraria(employee)) continue;
        const identityBlocker = validateIdentity(employee, source);
        if (identityBlocker) { blockers.push(identityBlocker); continue; }
        const employeeDateKey = `${clean(employee.kodikos)}|${dateKey(source.hmeromhnia)}`;
        const afmDateKey = `${clean(employee.afm)}|${dateKey(source.hmeromhnia)}`;
        if (employeeDateKeys.has(employeeDateKey) || afmDateKeys.has(afmDateKey)) {
            blockers.push(blocker('WTOOVA_DUPLICATE_EMPLOYEE_DATE',
                'Βρέθηκαν πολλαπλές canonical εγγραφές για τον ίδιο εργαζόμενο και ημερομηνία.', source));
            continue;
        }
        employeeDateKeys.add(employeeDateKey);
        afmDateKeys.add(afmDateKey);
        const canonicalFrom = clean(source.apo_ora_yperories);
        const canonicalTo = clean(source.eos_ora_yperories);
        const canonicalFromMinutes = timeToMinutes(canonicalFrom);
        if (canonicalFromMinutes === null || timeToMinutes(canonicalTo) === null) {
            blockers.push(blocker('WTOOVA_CANONICAL_OVERTIME_INTERVAL_MISSING',
                CANONICAL_INTERVAL_MISSING_MESSAGE, source));
            continue;
        }

        const legalOverworkMinutes = totalFieldMinutes(source, LEGAL_OVERWORK_FIELDS);
        const submittedOvertimeMinutes = Math.min(legalOvertimeMinutes,
            MAX_AUTOMATIC_OVERTIME_MINUTES);
        const excessMinutes = legalOvertimeMinutes - submittedOvertimeMinutes;
        const fTo = excessMinutes > 0
            ? minutesToTime(canonicalFromMinutes + MAX_AUTOMATIC_OVERTIME_MINUTES)
            : canonicalTo;
        const rowWarnings = [];
        if (excessMinutes > 0) {
            const capWarning = warning('WTOOVA_LEGAL_OVERTIME_CAP', CAP_WARNING, source,
                { canonical_minutes: legalOvertimeMinutes,
                    submitted_minutes: submittedOvertimeMinutes, excess_minutes: excessMinutes });
            warnings.push(capWarning);
            rowWarnings.push(capWarning);
        }
        rows.push(Object.freeze({
            source_record_id: clean(source._id), employee_code: clean(employee.kodikos),
            afm: clean(employee.afm), eponymo: clean(employee.eponymo), onoma: clean(employee.onoma),
            date: dateKey(source.hmeromhnia), legal_overwork_minutes: legalOverworkMinutes,
            legal_overtime_minutes: legalOvertimeMinutes,
            submitted_overtime_minutes: submittedOvertimeMinutes, excess_minutes: excessMinutes,
            f_type: 'ΥΠ', f_from: canonicalFrom, f_to: fTo,
            warnings: Object.freeze(rowWarnings)
        }));
    }
    return Object.freeze({ rows: Object.freeze(rows), blockers: Object.freeze(blockers),
        warnings: Object.freeze(warnings) });
}

function buildWtoOvertimePayload({ canonicalRows, branch }) {
    if (!Array.isArray(canonicalRows) || canonicalRows.length === 0) return null;
    const normalizedBranch = clean(branch);
    if (!/^\d{1,5}$/.test(normalizedBranch)) throw new Error('WTOOVA_INVALID_BRANCH');
    const sorted = [...canonicalRows].sort((left, right) =>
        `${left.date}|${left.afm}`.localeCompare(`${right.date}|${right.afm}`));
    return { WTOS: { WTO: [{
        f_aa_pararthmatos: normalizedBranch,
        f_rel_protocol: '', f_rel_date: '', f_comments: '',
        f_from_date: formatDate(sorted[0].date),
        f_to_date: formatDate(sorted[sorted.length - 1].date),
        Ergazomenoi: { ErgazomenoiWTO: sorted.map((row) => ({
            f_afm: row.afm, f_eponymo: row.eponymo, f_onoma: row.onoma,
            f_date: formatDate(row.date), ErgazomenosAnalytics: {
                ErgazomenosWTOAnalytics: [{
                    f_type: row.f_type, f_from: row.f_from, f_to: row.f_to
                }]
            }
        })) }
    }] } };
}

function factKey(fact) {
    return [fact.afm, fact.eponymo, fact.onoma, fact.date, fact.type, fact.from, fact.to].join('|');
}
function sortedFacts(facts) {
    return facts.map((fact) => ({ ...fact })).sort((a, b) => factKey(a).localeCompare(factKey(b), 'el'));
}
function flattenCanonicalFacts(rows = []) {
    return sortedFacts(rows.map((row) => ({ afm: row.afm, eponymo: row.eponymo,
        onoma: row.onoma, date: row.date, type: row.f_type, from: row.f_from, to: row.f_to })));
}
function flattenPayloadFacts(payload) {
    const employees = payload?.WTOS?.WTO?.[0]?.Ergazomenoi?.ErgazomenoiWTO;
    if (!Array.isArray(employees)) return [];
    return sortedFacts(employees.flatMap((employee) =>
        (employee?.ErgazomenosAnalytics?.ErgazomenosWTOAnalytics || []).map((analytics) => ({
            afm: clean(employee.f_afm), eponymo: clean(employee.f_eponymo), onoma: clean(employee.f_onoma),
            date: payloadDateKey(employee.f_date), type: clean(analytics.f_type),
            from: clean(analytics.f_from), to: clean(analytics.f_to)
        }))));
}
function validatePayloadSchema(payload) {
    const errors = [];
    const wto = payload?.WTOS?.WTO;
    if (!Array.isArray(wto) || wto.length !== 1) return ['INVALID_WTO_ROOT'];
    const outer = wto[0];
    if (!/^\d{1,5}$/.test(clean(outer.f_aa_pararthmatos))) errors.push('INVALID_BRANCH');
    if (outer.f_rel_protocol !== '' || outer.f_rel_date !== '' || outer.f_comments !== '') {
        errors.push('INVALID_RELATION_FIELDS');
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(clean(outer.f_from_date)) ||
        !/^\d{2}\/\d{2}\/\d{4}$/.test(clean(outer.f_to_date))) errors.push('INVALID_OUTER_DATES');
    const employees = outer?.Ergazomenoi?.ErgazomenoiWTO;
    if (!Array.isArray(employees) || employees.length === 0) return [...errors, 'INVALID_EMPLOYEES'];
    for (const employee of employees) {
        if (!/^\d{9}$/.test(clean(employee.f_afm))) errors.push('INVALID_AFM');
        if (!clean(employee.f_eponymo) || clean(employee.f_eponymo).length > 50) errors.push('INVALID_SURNAME');
        if (!clean(employee.f_onoma) || clean(employee.f_onoma).length > 30) errors.push('INVALID_NAME');
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(clean(employee.f_date))) errors.push('INVALID_DATE');
        const analytics = employee?.ErgazomenosAnalytics?.ErgazomenosWTOAnalytics;
        if (!Array.isArray(analytics) || analytics.length !== 1) {
            errors.push('INVALID_ANALYTICS_COUNT'); continue;
        }
        const item = analytics[0];
        if (item.f_type !== 'ΥΠ') errors.push('INVALID_TYPE');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(item.f_from))) errors.push('INVALID_FROM');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(item.f_to))) errors.push('INVALID_TO');
    }
    return [...new Set(errors)];
}
function validateWtoOvertimeParity(canonicalRows, payload) {
    const canonicalFacts = flattenCanonicalFacts(canonicalRows);
    const payloadFacts = flattenPayloadFacts(payload);
    const outer = payload?.WTOS?.WTO?.[0];
    const dates = (canonicalRows || []).map((row) => row.date).sort();
    const expectedFrom = dates.length ? formatDate(dates[0]) : '';
    const expectedTo = dates.length ? formatDate(dates[dates.length - 1]) : '';
    const schemaErrors = validatePayloadSchema(payload);
    const exact = canonicalFacts.length > 0 && schemaErrors.length === 0 &&
        clean(outer?.f_from_date) === expectedFrom && clean(outer?.f_to_date) === expectedTo &&
        JSON.stringify(canonicalFacts) === JSON.stringify(payloadFacts);
    return Object.freeze({ exact, valid: exact, canonical_facts: canonicalFacts,
        payload_facts: payloadFacts, schema_errors: schemaErrors,
        expected_from_date: expectedFrom, expected_to_date: expectedTo });
}
function buildWtoOvertimePayloadFingerprint({ team, company, branch, payload }) {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize({
        team, company, branch, submission_code: 'WTOOvA', payload
    }))).digest('hex');
}

module.exports = {
    LEGAL_OVERTIME_FIELDS, LEGAL_OVERWORK_FIELDS, MAX_AUTOMATIC_OVERTIME_MINUTES,
    CAP_WARNING, CANONICAL_INTERVAL_MISSING_MESSAGE, hoursToMinutes, totalFieldMinutes,
    minutesToTime, timeToMinutes, buildWtoOvertimeCanonicalDataset, buildWtoOvertimePayload,
    flattenCanonicalFacts, flattenPayloadFacts, validatePayloadSchema,
    validateWtoOvertimeParity, buildWtoOvertimePayloadFingerprint, formatDate
};
