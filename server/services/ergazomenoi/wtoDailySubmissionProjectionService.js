'use strict';

const TYPE_RULES = Object.freeze({
    'ΕΡΓ': Object.freeze({ code: 'ΕΡΓ', requiresIntervals: true }),
    'ΑΝ': Object.freeze({ code: 'ΑΝ', requiresIntervals: false }),
    'ΜΕ': Object.freeze({ code: 'ΜΕ', requiresIntervals: false }),
    'ΤΗΛ': Object.freeze({ code: 'ΤΗΛ', requiresIntervals: true })
});

function projectionError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function clean(value) { return String(value ?? '').trim(); }

function dateKey(value, field = 'date') {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : clean(value).slice(0, 10);
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

function validateTime(value, label) {
    const time = clean(value);
    if (!time || time === '--:--') return '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw projectionError('INVALID_WTODAILY_TIME', `Μη έγκυρη ώρα ${label}.`, { value });
    }
    return time;
}

function resolveType(row) {
    const source = clean(row.kathgoria_ergasias_apologistika).toUpperCase();
    const rule = TYPE_RULES[source];
    if (!rule && (row.adeia_apologistika === true || row.astheneia_apologistika === true)) {
        return null;
    }
    if (!rule) throw projectionError('UNSUPPORTED_WTODAILY_TYPE', `Μη υποστηριζόμενος WTODayilyA τύπος: ${source || '(κενό)'}.`, { value: source });
    return rule;
}

function identityFor(row, employeeByCode) {
    const employee = employeeByCode.get(clean(row.kodikos));
    if (!employee) throw projectionError('MISSING_WTODAILY_EMPLOYEE_IDENTITY', 'Λείπει frozen ταυτότητα εργαζομένου.', { kodikos: row.kodikos });
    const afm = clean(employee.afm);
    const eponymo = clean(employee.eponymo).toUpperCase();
    const onoma = clean(employee.onoma).toUpperCase();
    if (!/^\d{9}$/.test(afm)) throw projectionError('INVALID_WTODAILY_AFM', 'Το frozen ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.', { kodikos: row.kodikos });
    if (!eponymo || eponymo.length > 50) throw projectionError('INVALID_WTODAILY_SURNAME', 'Το frozen επώνυμο πρέπει να έχει 1 έως 50 χαρακτήρες.', { kodikos: row.kodikos });
    if (!onoma || onoma.length > 30) throw projectionError('INVALID_WTODAILY_NAME', 'Το frozen όνομα πρέπει να έχει 1 έως 30 χαρακτήρες.', { kodikos: row.kodikos });
    return { f_afm: afm, f_eponymo: eponymo, f_onoma: onoma };
}

function readIntervalPairs(row, { fromPrefix, toPrefix, fieldSuffix = '', incompleteCode, label }) {
    const analytics = [];
    for (let index = 1; index <= 3; index += 1) {
        const suffix = String(index).padStart(2, '0');
        const from = validateTime(row[`${fromPrefix}${suffix}${fieldSuffix}`], `${label} από ${index}`);
        const to = validateTime(row[`${toPrefix}${suffix}${fieldSuffix}`], `${label} έως ${index}`);
        if (Boolean(from) !== Boolean(to)) throw projectionError(incompleteCode,
            `Το ${label} διάστημα ${index} πρέπει να έχει ώρα από και έως.`, { index });
        if (from) analytics.push({ f_from: from, f_to: to });
    }
    return analytics;
}

function resolveWtoDailyAnalytics(row, typeRule) {
    const type = typeRule?.code;
    if (type === 'ΑΝ' || type === 'ΜΕ') {
        return Object.freeze({ analytics: [{ f_type: type, f_from: '', f_to: '' }], source: 'BLANK_NON_WORK' });
    }
    const apologistika = readIntervalPairs(row, {
        fromPrefix: 'apo_ora_', toPrefix: 'eos_ora_',
        fieldSuffix: '_apologistika',
        incompleteCode: 'INCOMPLETE_WTODAILY_APOLOGISTIKO_INTERVAL',
        label: 'απολογιστικό'
    }).map((item) => ({ f_type: type, ...item }));
    if (apologistika.length) return Object.freeze({ analytics: apologistika, source: 'APOLOGISTIKA_INTERVALS' });
    if (type === 'ΤΗΛ') throw projectionError('WTODAILY_TELEWORK_INTERVAL_REQUIRED',
        'Η τηλεργασία απαιτεί frozen απολογιστικό διάστημα.');
    const cards = readIntervalPairs(row, {
        fromPrefix: 'cards_apo_ora_', toPrefix: 'cards_eos_ora_',
        incompleteCode: 'INCOMPLETE_WTODAILY_CARD_INTERVAL',
        label: 'frozen card'
    }).map((item) => ({ f_type: type, ...item }));
    if (cards.length) return Object.freeze({ analytics: cards, source: 'FROZEN_CARD_INTERVALS' });
    throw projectionError('WTODAILY_WORK_INTERVAL_REQUIRED', 'Η εργασία απαιτεί frozen απολογιστικό ή card διάστημα.');
}

function selectWtoDailySourceRows(rows) {
    return Array.isArray(rows) ? rows.filter((row) => row?.apologistiko_biblio === true) : [];
}

function buildWtoDailySubmissionProjection({ rows, employees, branch, periodStart, periodEnd, comments = '', relatedProtocol = '', relatedDate = '' } = {}) {
    const normalizedBranch = clean(branch);
    if (!/^\d{1,5}$/.test(normalizedBranch)) throw projectionError('INVALID_WTODAILY_BRANCH', 'Το παράρτημα πρέπει να έχει 1 έως 5 ψηφία.');
    const normalizedComments = clean(comments);
    if (normalizedComments.length > 200) throw projectionError('INVALID_WTODAILY_COMMENTS', 'Τα σχόλια δεν μπορούν να υπερβαίνουν τους 200 χαρακτήρες.');
    const protocol = clean(relatedProtocol);
    if (protocol.length > 50) throw projectionError('INVALID_WTODAILY_RELATED_PROTOCOL', 'Το σχετικό πρωτόκολλο δεν μπορεί να υπερβαίνει τους 50 χαρακτήρες.');
    const relDate = clean(relatedDate);
    if (relDate) formatDate(relDate, 'related date');
    if (protocol || relDate) throw projectionError('UNSUPPORTED_WTODAILY_CORRECTIVE_SUBMISSION', 'Η συσχέτιση διορθωτικής WTODayilyA υποβολής δεν υποστηρίζεται ακόμη.');
    const startKey = dateKey(periodStart, 'period start');
    const endKey = dateKey(periodEnd, 'period end');
    if (startKey > endKey) throw projectionError('INVALID_WTODAILY_PERIOD', 'Μη έγκυρη frozen περίοδος.');
    if (!Array.isArray(rows) || !rows.length) throw projectionError('EMPTY_WTODAILY_SNAPSHOT', 'Το frozen snapshot δεν περιέχει ημερήσια αποτελέσματα.');
    const submitRows = selectWtoDailySourceRows(rows);
    if (!submitRows.length) throw projectionError('WTODAILY_NO_SUBMITTABLE_ROWS', 'Δεν υπάρχουν frozen εγγραφές του Απολογιστικού Πίνακα προς υποβολή.');
    const employeeByCode = new Map((employees || []).map((employee) => [clean(employee.kodikos), employee]));
    const grouped = new Map();
    for (const row of submitRows) {
        const rowDate = dateKey(row.hmeromhnia, 'employee date');
        if (rowDate < startKey || rowDate > endKey) throw projectionError('WTODAILY_ROW_OUTSIDE_PERIOD', 'Η frozen εγγραφή βρίσκεται εκτός περιόδου.', { date: rowDate });
        const rule = resolveType(row);
        if (!rule) continue;
        const identity = identityFor(row, employeeByCode);
        const key = `${identity.f_afm}|${rowDate}`;
        const resolvedAnalytics = resolveWtoDailyAnalytics(row, rule);
        const candidate = { ...identity, f_date: formatDate(rowDate),
            analytics: resolvedAnalytics.analytics, analytic_sources: [resolvedAnalytics.source] };
        if (!grouped.has(key)) grouped.set(key, candidate);
        else {
            const current = grouped.get(key);
            if (current.f_eponymo !== candidate.f_eponymo || current.f_onoma !== candidate.f_onoma) {
                throw projectionError('WTODAILY_IDENTITY_CONFLICT', 'Ασυνεπής frozen ταυτότητα για ίδιο ΑΦΜ και ημερομηνία.');
            }
            current.analytics.push(...candidate.analytics);
            current.analytic_sources.push(...candidate.analytic_sources);
        }
    }
    const employeeDays = [...grouped.values()].map((employee) => ({ ...employee,
        analytics: [...new Map(employee.analytics.map((item) => [`${item.f_type}|${item.f_from}|${item.f_to}`, item])).values()]
            .sort((a, b) => `${a.f_from}|${a.f_to}|${a.f_type}`.localeCompare(`${b.f_from}|${b.f_to}|${b.f_type}`, 'el'))
    })).sort((a, b) => `${a.f_date.split('/').reverse().join('-')}|${a.f_afm}`.localeCompare(`${b.f_date.split('/').reverse().join('-')}|${b.f_afm}`));
    if (!employeeDays.length) throw projectionError('WTODAILY_NO_SUBMITTABLE_ROWS', 'Δεν υπάρχουν WTO-relevant frozen εγγραφές προς υποβολή.');
    return Object.freeze({ f_aa_pararthmatos: normalizedBranch, f_rel_protocol: '', f_rel_date: '',
        f_comments: normalizedComments, f_from_date: formatDate(startKey), f_to_date: formatDate(endKey), employees: employeeDays });
}

function buildWTODayilyAPayload(projection) {
    if (!projection || !Array.isArray(projection.employees)) throw projectionError('INVALID_WTODAILY_PROJECTION', 'Μη έγκυρη WTO projection.');
    return { WTOS: { WTO: [{
        f_aa_pararthmatos: projection.f_aa_pararthmatos,
        f_rel_protocol: projection.f_rel_protocol,
        f_rel_date: projection.f_rel_date,
        f_comments: projection.f_comments,
        f_from_date: projection.f_from_date,
        f_to_date: projection.f_to_date,
        Ergazomenoi: { ErgazomenoiWTO: projection.employees.map((employee) => ({
            f_afm: employee.f_afm, f_eponymo: employee.f_eponymo, f_onoma: employee.f_onoma,
            f_date: employee.f_date,
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: employee.analytics.map((item) => ({
                f_type: item.f_type, f_from: item.f_from, f_to: item.f_to
            })) }
        })) }
    }] } };
}

module.exports = { TYPE_RULES, projectionError, dateKey, formatDate, selectWtoDailySourceRows,
    resolveWtoDailyAnalytics,
    buildWtoDailySubmissionProjection, buildWTODayilyAPayload };
