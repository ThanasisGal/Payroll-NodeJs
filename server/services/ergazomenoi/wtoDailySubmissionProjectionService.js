'use strict';

const TYPE_RULES = Object.freeze({
    'ΕΡΓ': Object.freeze({ code: 'ΕΡΓ', requiresIntervals: true }),
    'ΑΝ': Object.freeze({ code: 'ΑΝ', requiresIntervals: false }),
    'ΜΕ': Object.freeze({ code: 'ΜΕ', requiresIntervals: false }),
    'ΤΗΛ': Object.freeze({ code: 'ΤΗΛ', requiresIntervals: true })
});

function projectionError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code; error.statusCode = 409; error.details = details;
    return error;
}
function clean(value) { return String(value ?? '').trim(); }
function dateKey(value, field = 'date') {
    const raw = value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString().slice(0, 10) : clean(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw projectionError('INVALID_WTODAILY_DATE', `Μη έγκυρο ${field}.`, { value });
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
        throw projectionError('INVALID_WTODAILY_DATE', `Μη έγκυρο ${field}.`, { value });
    }
    return raw;
}
function formatDate(value, field) {
    const [year, month, day] = dateKey(value, field).split('-');
    return `${day}/${month}/${year}`;
}
function payloadDateKey(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(value));
    if (!match) return clean(value);
    return `${match[3]}-${match[2]}-${match[1]}`;
}
function validateTime(value, row, intervalIndex, boundary) {
    const time = clean(value);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw projectionError('WTODAILY_CONTROL_INTERVAL_REQUIRED',
            'Η εργασία/τηλεργασία απαιτεί έγκυρο canonical διάστημα.', {
                employee_code: row.employee_code, date: row.date,
                source_record_id: row.source_record_id, category: row.category,
                interval_index: intervalIndex, boundary, value
            });
    }
    return time;
}
function rowDetails(row) {
    return { employee_code: clean(row?.employee_code), date: clean(row?.date),
        source_record_id: clean(row?.source_record_id), category: clean(row?.category) };
}
function validateCanonicalIdentity(row) {
    const details = rowDetails(row);
    const afm = clean(row.afm); const eponymo = clean(row.eponymo); const onoma = clean(row.onoma);
    if (!/^\d{9}$/.test(afm)) throw projectionError('INVALID_WTODAILY_AFM', 'Το canonical ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.', details);
    if (!eponymo || eponymo.length > 50) throw projectionError('INVALID_WTODAILY_SURNAME', 'Το canonical επώνυμο πρέπει να έχει 1 έως 50 χαρακτήρες.', details);
    if (!onoma || onoma.length > 30) throw projectionError('INVALID_WTODAILY_NAME', 'Το canonical όνομα πρέπει να έχει 1 έως 30 χαρακτήρες.', details);
    return { f_afm: afm, f_eponymo: eponymo, f_onoma: onoma };
}
function analyticsFromCanonicalRow(row) {
    const category = clean(row?.category);
    const rule = TYPE_RULES[category];
    if (!rule) throw projectionError('WTODAILY_CONTROL_CATEGORY_UNSUPPORTED',
        `Η Κατάσταση Ελέγχου έχει κατηγορία ${category || '(κενή)'} που δεν υποστηρίζει το WTODailyA.`, rowDetails(row));
    if (!rule.requiresIntervals) return [{ f_type: category, f_from: '', f_to: '' }];
    if (!Array.isArray(row.intervals) || !row.intervals.length) {
        throw projectionError('WTODAILY_CONTROL_INTERVAL_REQUIRED',
            'Η εργασία/τηλεργασία απαιτεί έγκυρο canonical διάστημα.', rowDetails(row));
    }
    return row.intervals.map((interval, index) => ({ f_type: category,
        f_from: validateTime(interval?.from, row, index + 1, 'from'),
        f_to: validateTime(interval?.to, row, index + 1, 'to') }));
}

function flattenCanonicalControlFacts(canonicalRows = []) {
    return sortedFacts(canonicalRows.flatMap((row) => analyticsFromCanonicalRow(row).map((item) => ({
        afm: clean(row.afm), date: dateKey(row.date), category: item.f_type,
        from: item.f_from, to: item.f_to
    }))));
}
function flattenWtoDailyPayloadFacts(payload) {
    const employees = payload?.WTOS?.WTO?.[0]?.Ergazomenoi?.ErgazomenoiWTO;
    if (!Array.isArray(employees)) throw projectionError('INVALID_WTODAILY_PAYLOAD', 'Μη έγκυρο WTODailyA payload.');
    return sortedFacts(employees.flatMap((employee) => {
        const items = employee?.ErgazomenosAnalytics?.ErgazomenosWTOAnalytics;
        if (!Array.isArray(items)) throw projectionError('INVALID_WTODAILY_PAYLOAD', 'Λείπουν WTODailyA analytics.');
        return items.map((item) => ({ afm: clean(employee.f_afm), date: payloadDateKey(employee.f_date),
            category: clean(item.f_type), from: clean(item.f_from), to: clean(item.f_to) }));
    }));
}
function factKey(fact) { return [fact.afm, fact.date, fact.category, fact.from, fact.to].join('|'); }
function sortedFacts(facts) { return facts.map((fact) => ({ ...fact })).sort((a, b) => factKey(a).localeCompare(factKey(b), 'el')); }
function multisetDiff(left, right) {
    const remaining = [...right];
    return left.filter((fact) => {
        const index = remaining.findIndex((candidate) => factKey(candidate) === factKey(fact));
        if (index < 0) return true;
        remaining.splice(index, 1); return false;
    });
}
function assertWtoDailyControlPayloadParity(canonicalRows, payload) {
    const controlFacts = flattenCanonicalControlFacts(canonicalRows);
    const payloadFacts = flattenWtoDailyPayloadFacts(payload);
    if (JSON.stringify(controlFacts) !== JSON.stringify(payloadFacts)) {
        throw projectionError('WTODAILY_CONTROL_PAYLOAD_PARITY_MISMATCH',
            'Η Κατάσταση Ελέγχου και το WTODailyA payload δεν συμφωνούν.', {
                control_only: multisetDiff(controlFacts, payloadFacts),
                payload_only: multisetDiff(payloadFacts, controlFacts), control_facts: controlFacts,
                payload_facts: payloadFacts
            });
    }
    return Object.freeze({ valid: true, facts: controlFacts });
}

function buildWtoDailySubmissionProjection({ canonicalRows, branch, periodStart, periodEnd,
    comments = '', relatedProtocol = '', relatedDate = '' } = {}) {
    const normalizedBranch = clean(branch);
    if (!/^\d{1,5}$/.test(normalizedBranch)) throw projectionError('INVALID_WTODAILY_BRANCH', 'Το παράρτημα πρέπει να έχει 1 έως 5 ψηφία.');
    const normalizedComments = clean(comments);
    if (normalizedComments.length > 200) throw projectionError('INVALID_WTODAILY_COMMENTS', 'Τα σχόλια δεν μπορούν να υπερβαίνουν τους 200 χαρακτήρες.');
    const protocol = clean(relatedProtocol); const relDate = clean(relatedDate);
    if (protocol.length > 50) throw projectionError('INVALID_WTODAILY_RELATED_PROTOCOL', 'Το σχετικό πρωτόκολλο δεν μπορεί να υπερβαίνει τους 50 χαρακτήρες.');
    if (relDate) formatDate(relDate, 'related date');
    if (protocol || relDate) throw projectionError('UNSUPPORTED_WTODAILY_CORRECTIVE_SUBMISSION', 'Η συσχέτιση διορθωτικής WTODailyA υποβολής δεν υποστηρίζεται ακόμη.');
    const startKey = dateKey(periodStart, 'period start'); const endKey = dateKey(periodEnd, 'period end');
    if (startKey > endKey) throw projectionError('INVALID_WTODAILY_PERIOD', 'Μη έγκυρη frozen περίοδος.');
    if (!Array.isArray(canonicalRows) || !canonicalRows.length) {
        throw projectionError('WTODAILY_NO_SUBMITTABLE_ROWS', 'Δεν υπάρχουν canonical εγγραφές του Απολογιστικού Πίνακα προς υποβολή.');
    }
    const grouped = new Map();
    for (const row of canonicalRows) {
        const rowDate = dateKey(row.date, 'employee date');
        if (rowDate < startKey || rowDate > endKey) throw projectionError('WTODAILY_ROW_OUTSIDE_PERIOD', 'Η canonical εγγραφή βρίσκεται εκτός περιόδου.', rowDetails(row));
        const identity = validateCanonicalIdentity(row); const rowAnalytics = analyticsFromCanonicalRow(row);
        const key = `${identity.f_afm}|${rowDate}`;
        if (!grouped.has(key)) grouped.set(key, { ...identity, f_date: formatDate(rowDate), analytics: [] });
        const current = grouped.get(key);
        if (current.f_eponymo !== identity.f_eponymo || current.f_onoma !== identity.f_onoma) {
            throw projectionError('WTODAILY_IDENTITY_CONFLICT', 'Ασυνεπής canonical ταυτότητα για ίδιο ΑΦΜ και ημερομηνία.', rowDetails(row));
        }
        current.analytics.push(...rowAnalytics);
    }
    const employees = [...grouped.values()].sort((a, b) =>
        `${payloadDateKey(a.f_date)}|${a.f_afm}`.localeCompare(`${payloadDateKey(b.f_date)}|${b.f_afm}`));
    return Object.freeze({ f_aa_pararthmatos: normalizedBranch, f_rel_protocol: '', f_rel_date: '',
        f_comments: normalizedComments, f_from_date: formatDate(startKey), f_to_date: formatDate(endKey),
        employees, canonicalRows });
}

function buildWTODayilyAPayload(projection) {
    if (!projection || !Array.isArray(projection.employees)) throw projectionError('INVALID_WTODAILY_PROJECTION', 'Μη έγκυρη WTO projection.');
    const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: projection.f_aa_pararthmatos,
        f_rel_protocol: projection.f_rel_protocol, f_rel_date: projection.f_rel_date,
        f_comments: projection.f_comments, f_from_date: projection.f_from_date,
        f_to_date: projection.f_to_date, Ergazomenoi: { ErgazomenoiWTO: projection.employees.map((employee) => ({
            f_afm: employee.f_afm, f_eponymo: employee.f_eponymo, f_onoma: employee.f_onoma,
            f_date: employee.f_date, ErgazomenosAnalytics: {
                ErgazomenosWTOAnalytics: employee.analytics.map((item) => ({
                    f_type: item.f_type, f_from: item.f_from, f_to: item.f_to
                }))
            }
        })) } }] } };
    assertWtoDailyControlPayloadParity(projection.canonicalRows, payload);
    return payload;
}

module.exports = { TYPE_RULES, projectionError, dateKey, formatDate, analyticsFromCanonicalRow,
    flattenCanonicalControlFacts, flattenWtoDailyPayloadFacts, assertWtoDailyControlPayloadParity,
    buildWtoDailySubmissionProjection, buildWTODayilyAPayload };
