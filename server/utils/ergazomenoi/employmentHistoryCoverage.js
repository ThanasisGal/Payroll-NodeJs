'use strict';

const C = require('./employmentProfileContract');
const T = require('./employmentProfileTemporal');
const { semanticHistoryRows } = require('./employmentHistoryCanonicalStatus');
const { effectiveEnd } = require('./employmentProfileHistory');
const DAY = 86400000;
const key = value => T.day(value)?.toISOString().slice(0, 10) || null;
const stamp = value => T.day(value)?.getTime();
const profile = row => row?.[C.SCHEMA_VERSION] === 1 || Boolean(row?.[T.START]);
const identity = row => String(row?._id || '');
// A hire anchor can also carry its explicitly recorded initial terms. The
// change-event flag alone does not erase that period; technical non-terms rows
// and inactive artifacts still cannot supply coverage.
const coverageProfile = row => profile(row) && T.start(row) &&
    (row.afora_allagh_oron_ergasias !== false ||
        row.afora_proslhpsh === true && T.day(row[T.START]));

// Required coverage is a separate concept from employment status. Contract end
// never becomes departure, and terms validity / schedule-generation end never
// proves continuation of the relationship. An as-of date is not such proof either.
const CONTRACT_END = 'hmeromhnia_lhxhs_symbashs';
const present = value => value !== undefined && value !== null && value !== '';
function recordedDay(value) {
    try { return C.calendarDate(value)?.getTime() ?? null; } catch { return null; }
}
function requiredCoverageForCycle({ hire, current = null, members = [], evidence = members }) {
    const baseline = current && T.anchor(current);
    const from = Math.max(stamp(hire), baseline ? stamp(baseline.before) : stamp(hire));
    const rows = [...members, ...semanticHistoryRows(evidence), ...(current ? [current] : [])];
    const departure = key(current?.hmeromhnia_apoxorhshs) ||
        members.map(row => key(row.hmeromhnia_apoxorhshs)).filter(Boolean).sort()[0] || null;
    const fail = (reason, date = hire) => ({ hire, from, until: Infinity, departure,
        contractEnd: null, issue: { reason, from: date, to: date } });
    const observations = [];
    for (const row of rows) {
        if (!present(row[CONTRACT_END])) continue;
        const end = recordedDay(row[CONTRACT_END]);
        if (end === null) return fail('INVALID_RECORDED_CONTRACT_END');
        const event = T.day(row[T.START]) || T.day(row.hmeromhnia_allaghs_symbashs) || T.day(hire);
        if (end < stamp(hire)) return fail('CONTRACT_END_BEFORE_HIRE', key(end));
        const recordedAt = new Date(row.updatedAt || row.createdAt || 0).getTime();
        observations.push({ end, event: event.getTime(), recordedAt: Number.isFinite(recordedAt) ? recordedAt : 0,
            sequence: Number(row.aa_eggrafhs) || 0 });
    }
    let contractEnd = null;
    if (observations.length) {
        const latestEvent = Math.max(...observations.map(item => item.event));
        const dated = observations.filter(item => item.event === latestEvent);
        const latestRecordedAt = Math.max(...dated.map(item => item.recordedAt));
        const recorded = dated.filter(item => item.recordedAt === latestRecordedAt);
        const latestSequence = Math.max(...recorded.map(item => item.sequence));
        const latest = [...new Set(recorded.filter(item => item.sequence === latestSequence).map(item => item.end))];
        if (latest.length !== 1) return fail('CONFLICTING_RECORDED_CONTRACT_END');
        contractEnd = latest[0];
        // A later recorded expiry is a documented extension. Merely extending
        // a profile's validity or reaching today's date is not an extension.
        for (const row of rows) {
            for (const field of [T.START, 'hmeromhnia_allaghs_symbashs',
                'hmeromhnia_apoxorhshs']) {
                const event = T.day(row[field]);
                if (event && event.getTime() > contractEnd) {
                    return fail('CONTRACT_CONTINUATION_NOT_EVIDENCED', key(event));
                }
            }
        }
    }
    const legacyTermsEnd = current && effectiveEnd(current)?.getTime();
    const until = Math.min(departure ? stamp(departure) : (legacyTermsEnd || Infinity),
        contractEnd ?? Infinity);
    return { hire, from, until, departure, contractEnd, baseline };
}

// Coverage is required inside a recorded employment cycle, not between hires,
// after departure or before an explicitly captured pre-V1 compatibility baseline.
function employeeHistoryCoverageGaps({ currentEmployee = null, historyRows = [],
    requiredHistoryRows = historyRows } = {}) {
    const active = semanticHistoryRows(historyRows);
    const currentHire = key(currentEmployee?.hmeromhnia_proslhpshs);
    const hires = new Set([...historyRows,...requiredHistoryRows]
        .map(row => key(row.hmeromhnia_proslhpshs)).filter(Boolean));
    if (currentHire) hires.add(currentHire);
    const gaps = [];
    for (const hire of [...hires].sort()) {
        const members = active.filter(row => key(row.hmeromhnia_proslhpshs) === hire);
        const evidence = requiredHistoryRows.filter(row => key(row.hmeromhnia_proslhpshs) === hire);
        const current = hire === currentHire ? currentEmployee : null;
        // An inactive artifact alone cannot assert that a past employment cycle
        // really existed; require surviving lifecycle evidence or the master.
        if (!current && !members.length) continue;
        const profiles = members.filter(coverageProfile)
            .sort((a,b) => T.start(a) - T.start(b));
        const requirement = requiredCoverageForCycle({ hire, current, members, evidence });
        if (requirement.issue) {
            gaps.push({ hire, ...requirement.issue, beforeHistoryId: null, afterHistoryId: null });
            continue;
        }
        const requiresProfiles = Boolean(current && profile(current) || evidence.some(profile));
        if (!requiresProfiles) {
            if (current && !members.length) gaps.push({ hire, from: hire,
                to: key(current.hmeromhnia_apoxorhshs), beforeHistoryId: null, afterHistoryId: null });
            continue;
        }
        const { from, until } = requirement;
        if (from > until) continue;
        let cursor = from, previous = null;
        const addGap = (start, end, next) => gaps.push({ hire,
            from: new Date(start).toISOString().slice(0,10),
            to: Number.isFinite(end) ? new Date(end).toISOString().slice(0,10) : null,
            beforeHistoryId: previous ? identity(previous) : null,
            afterHistoryId: next ? identity(next) : null });
        for (const row of profiles) {
            const start = T.start(row).getTime(), end = effectiveEnd(row)?.getTime() ?? Infinity;
            if (end < start) { addGap(Math.max(cursor,from),until,null); cursor=Infinity; break; }
            if (end < cursor || start > until) continue;
            if (start > cursor) addGap(cursor,Math.min(until,start-DAY),row);
            cursor = Math.max(cursor,Number.isFinite(end) ? end+DAY : Infinity);
            previous = row;
            if (cursor > until) break;
        }
        if (cursor <= until && Number.isFinite(cursor)) addGap(cursor,until,null);
    }
    return gaps;
}

function historyCoverageError(gaps = []) {
    const first = gaps[0];
    const interval = first ? ` από ${first.from}${first.to ? ` έως ${first.to}` : ' και μετά'}` : '';
    const error = new Error('EMPLOYEE_HISTORY_COVERAGE_REQUIRED');
    error.code = 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'; error.statusCode = 409;
    error.details = { coverageGaps: gaps };
    const reason = first?.reason ? 'Η καταγεγραμμένη λήξη σύμβασης δεν συμφωνεί με τα διαθέσιμα στοιχεία. ' : '';
    error.publicMessage = `${reason}Ο χρονικός υπολογισμός σταμάτησε επειδή δεν υπάρχουν επαληθευμένοι ιστορικοί όροι εργασίας${interval}. Δεν αποθηκεύτηκε νέο αποτέλεσμα για αυτή την ημερομηνία από αυτόν τον έλεγχο. 1. Ανοίξτε το Ιστορικό του εργαζομένου. 2. Επιβεβαιώστε τις πραγματικές ημερομηνίες και τους όρους της περιόδου. 3. Επαναλάβετε τον υπολογισμό. Κωδικός αναφοράς: ΙΣΤ-ΚΑΛΥΨΗ-01.`;
    error.message = error.publicMessage;
    return error;
}

// Opt-in guard for calculations that need verified historical terms. Ordinary
// temporal compatibility/fallback callers are deliberately unchanged.
function assertVerifiedHistoryCoverageForDate(date, historyRows = [], employee = {}) {
    const active = semanticHistoryRows(historyRows);
    const requiresProfiles = profile(employee) || historyRows.some(profile);
    if (!requiresProfiles) return;
    const target = T.day(date);
    if (!target) throw historyCoverageError();
    const baseline = T.anchor(employee);
    const currentHire = key(employee.hmeromhnia_proslhpshs);
    if (!currentHire && baseline && target < T.day(baseline.before)) return;
    const hires = [...new Set([currentHire, ...active.map(row => key(row.hmeromhnia_proslhpshs))]
        .filter(hire => hire && stamp(hire) <= target.getTime()))].sort();
    const hire = hires.at(-1);
    if (!hire && currentHire) return;
    if (hire) {
        const members = active.filter(row => key(row.hmeromhnia_proslhpshs) === hire);
        const requirement = requiredCoverageForCycle({ hire, members,
            current: hire === currentHire ? employee : null });
        if (requirement.issue) throw historyCoverageError([requirement.issue]);
        if ((requirement.departure && target > T.day(requirement.departure)) ||
            target.getTime() < requirement.from) return;
        // A calculation beyond expiry needs evidence even if open validity
        // would otherwise match. Do not borrow stale terms to hide real work.
        if (requirement.contractEnd !== null && target.getTime() > requirement.contractEnd) {
            throw historyCoverageError([{ from: key(target), to: key(target),
                reason: 'CONTRACT_CONTINUATION_NOT_EVIDENCED' }]);
        }
    }
    const matches = active.filter(row => (!hire || key(row.hmeromhnia_proslhpshs) === hire) && coverageProfile(row) &&
        T.start(row) <= target && (!effectiveEnd(row) || target <= effectiveEnd(row)));
    if (matches.length !== 1) throw historyCoverageError([{from:key(target),to:key(target)}]);
}

module.exports = { requiredCoverageForCycle, employeeHistoryCoverageGaps, assertVerifiedHistoryCoverageForDate, historyCoverageError };
