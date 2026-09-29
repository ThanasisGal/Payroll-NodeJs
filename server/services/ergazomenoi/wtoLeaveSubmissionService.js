'use strict';

const crypto = require('crypto');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { validApprovedHourlyLeaveSegments } =
    require('../../utils/ergazomenoi/approvedHourlyLeaveSegments');
const { employeeIsEligibleForProdhlomenaOraria } =
    require('./erganiImportedEmployeeScopeService');
const { calculateAnnualLeaveEntitlement, dateKey } =
    require('./wtoLeaveEntitlementService');
const { resolveEmploymentTypeValue } =
    require('../../utils/ergazomenoi/getOrarioTermsForDate');

function clean(value) { return String(value ?? '').trim(); }
function formatDate(value) {
    const [year, month, day] = dateKey(value).split('-');
    return `${day}/${month}/${year}`;
}
function payloadDateKey(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(value));
    return match ? `${match[3]}-${match[2]}-${match[1]}` : clean(value);
}
function minutesToTime(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1439) return null;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function blocker(code, message, row = {}, details = {}) {
    return Object.freeze({ code, message, source_record_id: clean(row._id),
        employee_code: clean(row.kodikos), date: row.hmeromhnia ? dateKey(row.hmeromhnia) : '',
        ...details });
}
function employeeEligibleForWtoLeave(employee) {
    return Boolean(employee?.karta_ergasias === true &&
        employeeIsEligibleForProdhlomenaOraria(employee));
}
function candidateKind(row) {
    const type = String(row.kathgoria_adeias_apologistika ?? '');
    if (type === 'POSSIBLE_LEAVE') return Object.freeze({ kind: 'excluded' });
    const fullDay = row.adeia_apologistika === true;
    const hourly = row.egkekrimenh_oroadeia_apologistika === true;
    if (!fullDay && !hourly) return Object.freeze({ kind: 'excluded' });
    if (!type.trim()) return Object.freeze({ kind: 'blocked', code: 'WTOLEAVE_EMPTY_TYPE',
        message: 'Η επιβεβαιωμένη άδεια δεν έχει κατηγορία άδειας.' });
    if (type === 'ΑΔΚΑΝ' && hourly) return Object.freeze({ kind: 'blocked',
        code: 'WTOLEAVE_ADKAN_HOURLY_CONFLICT',
        message: 'Η ΑΔΚΑΝ δεν επιτρέπεται να δηλωθεί ως ωριαία άδεια.' });
    if (hourly) {
        const intervals = row.egkekrimena_diastimata_oroadeias_apologistika;
        if (!validApprovedHourlyLeaveSegments(intervals) || intervals.length === 0) {
            return Object.freeze({ kind: 'blocked', code: 'WTOLEAVE_INVALID_HOURLY_SEGMENTS',
                message: 'Η εγκεκριμένη ωριαία άδεια δεν έχει έγκυρα διαστήματα.' });
        }
        return Object.freeze({ kind: 'hourly', type, intervals });
    }
    return Object.freeze({ kind: 'full_day', type, intervals: [] });
}

function validateIdentity(employee, row) {
    const afm = clean(employee.afm);
    const eponymo = clean(employee.eponymo);
    const onoma = clean(employee.onoma);
    if (!/^\d{9}$/.test(afm)) return blocker('WTOLEAVE_INVALID_AFM',
        'Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.', row);
    if (!eponymo || eponymo.length > 50) return blocker('WTOLEAVE_INVALID_SURNAME',
        'Το επώνυμο πρέπει να έχει 1 έως 50 χαρακτήρες.', row);
    if (!onoma || onoma.length > 30) return blocker('WTOLEAVE_INVALID_NAME',
        'Το όνομα πρέπει να έχει 1 έως 30 χαρακτήρες.', row);
    return null;
}

function buildWtoLeaveCanonicalDataset({ sourceRows = [], employees = [],
    actualWorkRows = [] } = {}) {
    const employeeByCode = new Map(employees.map((employee) => [clean(employee.kodikos), employee]));
    const actualByCode = new Map();
    for (const row of actualWorkRows) {
        const code = clean(row.kodikos);
        if (!actualByCode.has(code)) actualByCode.set(code, []);
        actualByCode.get(code).push(row);
    }
    const rows = [];
    const blockers = [];
    const employeeDateKeys = new Set();
    const afmDateKeys = new Set();
    for (const source of [...sourceRows].sort((left, right) =>
        `${dateKey(left.hmeromhnia)}|${clean(left.kodikos)}`.localeCompare(
            `${dateKey(right.hmeromhnia)}|${clean(right.kodikos)}`))) {
        const selection = candidateKind(source);
        if (selection.kind === 'excluded') continue;
        const employee = employeeByCode.get(clean(source.kodikos));
        if (!employee) {
            blockers.push(blocker('WTOLEAVE_CURRENT_EMPLOYEE_NOT_FOUND',
                'Δεν βρέθηκε σημερινή εγγραφή εργαζομένου για την άδεια.', source));
            continue;
        }
        if (!employeeEligibleForWtoLeave(employee)) continue;
        if (selection.kind === 'blocked') {
            blockers.push(blocker(selection.code, selection.message, source));
            continue;
        }
        const identityBlocker = validateIdentity(employee, source);
        if (identityBlocker) { blockers.push(identityBlocker); continue; }
        if (selection.type.length > 10) {
            blockers.push(blocker('WTOLEAVE_INVALID_TYPE_LENGTH',
                'Η κατηγορία άδειας πρέπει να έχει 1 έως 10 χαρακτήρες.', source));
            continue;
        }
        const employeeDateKey = `${clean(employee.kodikos)}|${dateKey(source.hmeromhnia)}`;
        if (employeeDateKeys.has(employeeDateKey)) {
            blockers.push(blocker('WTOLEAVE_DUPLICATE_EMPLOYEE_DATE',
                'Βρέθηκαν πολλαπλές εγγραφές άδειας για τον ίδιο εργαζόμενο και ημερομηνία.', source));
            continue;
        }
        employeeDateKeys.add(employeeDateKey);
        const afmDateKey = `${clean(employee.afm)}|${dateKey(source.hmeromhnia)}`;
        if (afmDateKeys.has(afmDateKey)) {
            blockers.push(blocker('WTOLEAVE_DUPLICATE_AFM_DATE',
                'Το ίδιο ΑΦΜ εμφανίζεται περισσότερες από μία φορές στην ίδια ημερομηνία.', source));
            continue;
        }
        afmDateKeys.add(afmDateKey);
        const intervals = [];
        if (selection.kind === 'hourly') {
            let intervalInvalid = false;
            for (const segment of selection.intervals) {
                const from = minutesToTime(segment.apo_lepto);
                const to = minutesToTime(segment.eos_lepto);
                if (!from || !to) { intervalInvalid = true; break; }
                intervals.push(Object.freeze({ from, to, apo_lepto: segment.apo_lepto,
                    eos_lepto: segment.eos_lepto }));
            }
            if (intervalInvalid) {
                blockers.push(blocker('WTOLEAVE_INTERVAL_OUTSIDE_CLOCK_DAY',
                    'Τα διαστήματα WTOLeave πρέπει να βρίσκονται εντός 00:00–23:59.', source));
                continue;
            }
        }
        let entitlementDebug = null;
        let requiredDays = '';
        let referenceYear = '';
        if (selection.type === 'ΑΔΚΑΝ') {
            try {
                const employmentType = resolveEmploymentTypeValue(employee);
                entitlementDebug = calculateAnnualLeaveEntitlement({
                    hireDate: employee.hmeromhnia_proslhpshs,
                    referenceDate: source.hmeromhnia,
                    weeklyDays: employee.hmeres_ergasias_ebdomadas,
                    employmentType,
                    previousLeaveServiceYears: employee.proyphresia_adeias_se_eth,
                    actualWorkRows: actualByCode.get(clean(employee.kodikos)) || []
                });
                referenceYear = dateKey(source.hmeromhnia).slice(0, 4);
                requiredDays = String(entitlementDebug.entitledDaysRounded).padStart(3, '0');
                if (!/^\d{3}$/.test(requiredDays)) throw new Error('entitlement outside schema');
            } catch (error) {
                blockers.push(blocker(error.code || 'WTOLEAVE_ENTITLEMENT_FAILED',
                    error.message || 'Απέτυχε ο υπολογισμός δικαιούμενων ημερών.', source));
                continue;
            }
        }
        rows.push(Object.freeze({
            source_record_id: clean(source._id), employee_code: clean(employee.kodikos),
            afm: clean(employee.afm), eponymo: clean(employee.eponymo), onoma: clean(employee.onoma),
            date: dateKey(source.hmeromhnia), leave_type: selection.type,
            full_day: selection.kind === 'full_day', intervals,
            reference_year: referenceYear, required_days: requiredDays,
            entitlement_debug: entitlementDebug
        }));
    }
    return Object.freeze({ rows, blockers });
}

function analyticsFromRow(row) {
    if (row.full_day) return [{ f_type: row.leave_type, f_from: '', f_to: '',
        f_year: row.reference_year, f_req_days: row.required_days }];
    return row.intervals.map((interval) => ({ f_type: row.leave_type,
        f_from: interval.from, f_to: interval.to,
        f_year: row.reference_year, f_req_days: row.required_days }));
}

function buildWtoLeavePayload({ canonicalRows, branch }) {
    if (!Array.isArray(canonicalRows) || canonicalRows.length === 0) return null;
    const normalizedBranch = clean(branch);
    if (!/^\d{1,5}$/.test(normalizedBranch)) throw new Error('WTOLEAVE_INVALID_BRANCH');
    const sorted = [...canonicalRows].sort((left, right) =>
        `${left.date}|${left.afm}`.localeCompare(`${right.date}|${right.afm}`));
    const actualFrom = sorted[0].date;
    const actualTo = sorted[sorted.length - 1].date;
    return { WTOS: { WTO: [{
        f_aa_pararthmatos: normalizedBranch,
        f_rel_protocol: '', f_rel_date: '', f_comments: '',
        f_from_date: formatDate(actualFrom), f_to_date: formatDate(actualTo),
        Ergazomenoi: { ErgazomenoiWTO: sorted.map((row) => ({
            f_afm: row.afm, f_eponymo: row.eponymo, f_onoma: row.onoma,
            f_date: formatDate(row.date), ErgazomenosAnalytics: {
                ErgazomenosWTOAnalytics: analyticsFromRow(row)
            }
        })) }
    }] } };
}

function factKey(fact) {
    return [fact.afm, fact.eponymo, fact.onoma, fact.date, fact.type, fact.from,
        fact.to, fact.year, fact.required_days].join('|');
}
function sortedFacts(facts) {
    return facts.map((fact) => ({ ...fact })).sort((a, b) => factKey(a).localeCompare(factKey(b), 'el'));
}
function flattenCanonicalFacts(rows) {
    return sortedFacts(rows.flatMap((row) => analyticsFromRow(row).map((analytics) => ({
        afm: row.afm, eponymo: row.eponymo, onoma: row.onoma, date: row.date,
        type: analytics.f_type, from: analytics.f_from, to: analytics.f_to,
        year: analytics.f_year, required_days: analytics.f_req_days
    }))));
}
function flattenPayloadFacts(payload) {
    const wto = payload?.WTOS?.WTO?.[0];
    const employees = wto?.Ergazomenoi?.ErgazomenoiWTO;
    if (!Array.isArray(employees)) return [];
    return sortedFacts(employees.flatMap((employee) =>
        (employee?.ErgazomenosAnalytics?.ErgazomenosWTOAnalytics || []).map((analytics) => ({
            afm: clean(employee.f_afm), eponymo: clean(employee.f_eponymo), onoma: clean(employee.f_onoma),
            date: payloadDateKey(employee.f_date), type: String(analytics.f_type ?? ''),
            from: clean(analytics.f_from), to: clean(analytics.f_to), year: clean(analytics.f_year),
            required_days: clean(analytics.f_req_days)
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
        if (!Array.isArray(analytics) || analytics.length === 0) { errors.push('INVALID_ANALYTICS'); continue; }
        for (const item of analytics) {
            const rawType = String(item.f_type ?? '');
            if (!rawType.trim() || rawType.length > 10) errors.push('INVALID_TYPE');
            if (clean(item.f_from) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(item.f_from))) errors.push('INVALID_FROM');
            if (clean(item.f_to) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(item.f_to))) errors.push('INVALID_TO');
            if (clean(item.f_year) && !/^\d{4}$/.test(clean(item.f_year))) errors.push('INVALID_YEAR');
            if (clean(item.f_req_days) && !/^\d{3}$/.test(clean(item.f_req_days))) errors.push('INVALID_REQUIRED_DAYS');
        }
    }
    return [...new Set(errors)];
}
function validateWtoLeaveParity(canonicalRows, payload) {
    const canonicalFacts = flattenCanonicalFacts(canonicalRows || []);
    const payloadFacts = flattenPayloadFacts(payload);
    const outer = payload?.WTOS?.WTO?.[0];
    const expectedDates = (canonicalRows || []).map((row) => row.date).sort();
    const expectedFrom = expectedDates.length ? formatDate(expectedDates[0]) : '';
    const expectedTo = expectedDates.length ? formatDate(expectedDates[expectedDates.length - 1]) : '';
    const schemaErrors = validatePayloadSchema(payload);
    const exact = canonicalFacts.length > 0 && schemaErrors.length === 0 &&
        clean(outer?.f_from_date) === expectedFrom && clean(outer?.f_to_date) === expectedTo &&
        JSON.stringify(canonicalFacts) === JSON.stringify(payloadFacts);
    return Object.freeze({ exact, valid: exact, canonical_facts: canonicalFacts,
        payload_facts: payloadFacts, schema_errors: schemaErrors,
        expected_from_date: expectedFrom, expected_to_date: expectedTo });
}
function buildWtoLeavePayloadFingerprint({ team, company, branch, payload }) {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize({
        team, company, branch, submission_code: 'WTOLeave', payload
    }))).digest('hex');
}

module.exports = {
    employeeEligibleForWtoLeave,
    candidateKind,
    minutesToTime,
    buildWtoLeaveCanonicalDataset,
    buildWtoLeavePayload,
    flattenCanonicalFacts,
    flattenPayloadFacts,
    validatePayloadSchema,
    validateWtoLeaveParity,
    buildWtoLeavePayloadFingerprint,
    analyticsFromRow,
    formatDate
};
