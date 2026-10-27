'use strict';

// Pure validation. Every start belongs to the row's calendar date; only a
// strictly earlier end crosses midnight. Slot order never moves a start to
// another date (doing so could hide a genuine overlap). No source is changed.
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const clean = value => String(value ?? '').trim();
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

function dateLabel(value) {
    const raw = value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString().slice(0, 10) : clean(value);
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return /^\d{2}\/\d{2}\/\d{4}$/.test(raw) ? raw : '(χωρίς δηλωμένη ημερομηνία)';
}

function accountingIntervalsFromRow(row = {}) {
    return [1, 2, 3].map(pairNumber => {
        const pair = String(pairNumber).padStart(2, '0');
        return { pairNumber, start: row[`apo_ora_${pair}_apologistika`],
            end: row[`eos_ora_${pair}_apologistika`] };
    });
}

function inspectAccountingIntervals({ intervals, date } = {}) {
    const issues = []; const contacts = []; const spans = []; const pairs = new Set();
    const label = dateLabel(date);
    const issue = (code, pairNumbers, explanation, extra = {}) => issues.push({
        code, date: label, pairNumbers, message: `Ημερομηνία ${label}: ${explanation}`, ...extra
    });
    if (!Array.isArray(intervals) || intervals.length > 3) {
        issue('ACCOUNTING_INTERVAL_LIMIT', [], 'απαιτούνται έως τρία ημερήσια διαστήματα.');
        return { valid: false, issues, contacts };
    }
    intervals.forEach((interval, index) => {
        if (!interval || typeof interval !== 'object' || Array.isArray(interval)) {
            issue('ACCOUNTING_INTERVAL_INVALID_PAIR', [index + 1], `το διάστημα ${index + 1} δεν περιέχει πλήρη στοιχεία.`);
            return;
        }
        const pair = interval?.pairNumber ?? index + 1;
        if (!Number.isInteger(pair) || pair < 1 || pair > 3 || pairs.has(pair)) {
            issue('ACCOUNTING_INTERVAL_INVALID_PAIR', [], 'οι αριθμοί διαστημάτων πρέπει να είναι διαφορετικοί, από 1 έως 3.');
            return;
        }
        pairs.add(pair);
        const start = clean(interval?.start); const end = clean(interval?.end);
        if (!start && !end) return;
        if (!CLOCK.test(start) || !CLOCK.test(end)) {
            issue('ACCOUNTING_INTERVAL_INVALID_TIME', [pair], `το διάστημα ${pair} χρειάζεται πλήρεις έγκυρες ώρες Από–Έως.`);
            return;
        }
        if (start === end) {
            issue('ACCOUNTING_INTERVAL_ZERO_LENGTH', [pair], `το διάστημα ${pair} (${start}–${end}) έχει μηδενική διάρκεια.`);
            return;
        }
        const from = minutes(start); const to = minutes(end);
        spans.push({ pair, start, end, from, to: to < from ? to + 1440 : to });
    });
    for (let left = 0; left < spans.length; left += 1) {
        for (let right = left + 1; right < spans.length; right += 1) {
            const a = spans[left]; const b = spans[right];
            const common = Math.min(a.to, b.to) - Math.max(a.from, b.from);
            if (common > 0) issue('ACCOUNTING_INTERVALS_OVERLAP', [a.pair, b.pair],
                `τα διαστήματα ${a.pair} (${a.start}–${a.end}) και ${b.pair} (${b.start}–${b.end}) επικαλύπτονται για ${common} λεπτά.`,
                { overlapMinutes: common });
            // Touching is informational, not a guessed ERGANI rejection rule.
            // The repository WTO_v1.xsd constrains clock syntax only; it does
            // not establish external acceptance of equal interval boundaries.
            else if (common === 0) contacts.push({ code: 'ACCOUNTING_INTERVALS_TOUCH',
                date: label, pairNumbers: [a.pair, b.pair], overlapMinutes: 0,
                message: `Ημερομηνία ${label}: τα διαστήματα ${a.pair} και ${b.pair} εφάπτονται χωρίς κοινή διάρκεια.` });
        }
    }
    return { valid: issues.length === 0, issues, contacts };
}

// Shared, lossless normalization of actual accounting intervals. Overlaps and
// invalid clocks stay unresolved; they are never shortened or unioned here.
function normalizeAccountingIntervals(intervals = []) {
    const diagnosis = inspectAccountingIntervals({ intervals });
    const original = intervals.map(item => ({ start: clean(item?.start), end: clean(item?.end) }))
        .filter(item => item.start || item.end);
    if (!diagnosis.valid) return { intervals: original, changed: false, diagnosis };
    const spans = original.map(item => ({ ...item, from: minutes(item.start),
        to: minutes(item.end) + (minutes(item.end) < minutes(item.start) ? 1440 : 0) }))
        .sort((a, b) => a.from - b.from);
    const merged = [];
    for (const span of spans) {
        const previous = merged[merged.length - 1];
        if (previous && previous.to === span.from && span.to - previous.from < 1440) {
            previous.to = span.to; previous.end = span.end;
        } else merged.push({ ...span });
    }
    // Do not reorder separate shifts or approved pair identities unnecessarily.
    if (merged.length === spans.length) return { intervals: original, changed: false, diagnosis };
    return { intervals: merged.map(({ start, end }) => ({ start, end })), changed: true, diagnosis };
}
function normalizedAccountingRowUpdate(row = {}) {
    const normalized = normalizeAccountingIntervals(accountingIntervalsFromRow(row));
    if (!normalized.changed) return {};
    return Object.fromEntries(['01', '02', '03'].flatMap((pair, index) => [
        [`apo_ora_${pair}_apologistika`, normalized.intervals[index]?.start || ''],
        [`eos_ora_${pair}_apologistika`, normalized.intervals[index]?.end || '']
    ]));
}

function validationError(issue, operation) {
    const submission = operation === 'submit';
    return Object.assign(new Error(
        `${submission ? 'Η τελική υποβολή σταμάτησε.' : 'Η έγκριση της απασχόλησης σταμάτησε.'} ${issue.message} ` +
        '1. Ελέγξτε τα αναφερόμενα διαστήματα και επιβεβαιώστε τις πραγματικές ώρες εργασίας. ' +
        '2. Ζητήστε από τον αρμόδιο υπεύθυνο ελεγχόμενη διόρθωση, με διατήρηση των αρχικών εγκρίσεων αν η περίοδος έχει οριστικοποιηθεί. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την ενέργεια.' +
        (submission ? ' Δεν στάλθηκε υποβολή στο ΕΡΓΑΝΗ.' : '') +
        ` Κωδικός αναφοράς: ${issue.code}.`),
    { code: issue.code, statusCode: 409, details: issue });
}

function assertAccountingIntervals(options = {}) {
    const diagnosis = inspectAccountingIntervals(options);
    if (!diagnosis.valid) throw validationError(diagnosis.issues[0], options.operation);
    return diagnosis;
}

function assertWtoDailyPayloadIntervals(payload) {
    const invalid = date => validationError({ code: 'WTODAILY_INVALID_INTERVAL_PAYLOAD',
        date: dateLabel(date), pairNumbers: [],
        message: `Ημερομηνία ${dateLabel(date)}: λείπουν πλήρη στοιχεία των διαστημάτων προς υποβολή.` }, 'submit');
    const documents = payload?.WTOS?.WTO;
    if (!Array.isArray(documents) || !documents.length) throw invalid();
    const contacts = [];
    for (const document of documents) {
        const employees = document?.Ergazomenoi?.ErgazomenoiWTO;
        if (!Array.isArray(employees) || !employees.length) throw invalid();
        const groups = new Map();
        for (const employee of employees) {
            const analytics = employee?.ErgazomenosAnalytics?.ErgazomenosWTOAnalytics;
            if (!Array.isArray(analytics) || !analytics.length) throw invalid(employee?.f_date);
            // Group repeated employee/day entries too. Identity stays local and
            // is deliberately absent from diagnostics and error messages.
            const key = JSON.stringify([employee.f_afm, employee.f_date]);
            if (!groups.has(key)) groups.set(key, { date: employee.f_date, intervals: [] });
            const group = groups.get(key);
            for (const item of analytics) {
                if (!['ΕΡΓ', 'ΤΗΛ', 'ΑΝ', 'ΜΕ'].includes(item?.f_type)) throw invalid(employee.f_date);
                if (item.f_type === 'ΑΝ' || item.f_type === 'ΜΕ') continue;
                if (!clean(item.f_from) || !clean(item.f_to)) throw invalid(employee.f_date);
                group.intervals.push({ start: item.f_from, end: item.f_to });
            }
        }
        for (const group of groups.values()) contacts.push(...assertAccountingIntervals({
            ...group, operation: 'submit' }).contacts);
    }
    return { valid: true, contacts };
}

module.exports = { normalizeAccountingIntervals, normalizedAccountingRowUpdate, accountingIntervalsFromRow, inspectAccountingIntervals,
    assertAccountingIntervals, assertWtoDailyPayloadIntervals };
