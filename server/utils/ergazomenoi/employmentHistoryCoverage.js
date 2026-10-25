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
        const requiresProfiles = Boolean(current && profile(current) || evidence.some(profile));
        if (!requiresProfiles) {
            if (current && !members.length) gaps.push({ hire, from: hire,
                to: key(current.hmeromhnia_apoxorhshs), beforeHistoryId: null, afterHistoryId: null });
            continue;
        }
        const baseline = current && T.anchor(current);
        const from = Math.max(stamp(hire), baseline ? stamp(baseline.before) : stamp(hire));
        const departure = key(current?.hmeromhnia_apoxorhshs) ||
            members.map(row => key(row.hmeromhnia_apoxorhshs)).filter(Boolean).sort()[0];
        const until = departure ? stamp(departure) : current && effectiveEnd(current)
            ? effectiveEnd(current).getTime() : Infinity;
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
    error.publicMessage = `Ο χρονικός υπολογισμός σταμάτησε επειδή δεν υπάρχουν επαληθευμένοι ιστορικοί όροι εργασίας${interval}. Δεν αποθηκεύτηκε νέο αποτέλεσμα για αυτή την ημερομηνία από αυτόν τον έλεγχο. 1. Ανοίξτε το Ιστορικό του εργαζομένου. 2. Επιβεβαιώστε τις πραγματικές ημερομηνίες και τους όρους της περιόδου. 3. Επαναλάβετε τον υπολογισμό. Κωδικός αναφοράς: ΙΣΤ-ΚΑΛΥΨΗ-01.`;
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
    const hire = T.day(employee.hmeromhnia_proslhpshs) || T.start(employee);
    const departure = T.day(employee.hmeromhnia_apoxorhshs);
    const baseline = T.anchor(employee);
    const earlierEvidence = active.filter(row => {
        const rowHire = T.day(row.hmeromhnia_proslhpshs);
        return rowHire && rowHire <= target && (!hire || rowHire < hire);
    });
    if (hire && target < hire) {
        if (!earlierEvidence.length) return;
        const latestHire = Math.max(...earlierEvidence.map(row => stamp(row.hmeromhnia_proslhpshs)));
        const earlierCycle = earlierEvidence.filter(row => stamp(row.hmeromhnia_proslhpshs) === latestHire);
        const earlierDeparture = earlierCycle.map(row => T.day(row.hmeromhnia_apoxorhshs)).find(Boolean);
        if (earlierDeparture && target > earlierDeparture) return;
    } else if ((departure && target > departure) ||
        (baseline && target < T.day(baseline.before))) return;
    const matches = active.filter(row => coverageProfile(row) &&
        T.start(row) <= target && (!effectiveEnd(row) || target <= effectiveEnd(row)));
    if (matches.length !== 1) throw historyCoverageError([{from:key(target),to:key(target)}]);
}

module.exports = { employeeHistoryCoverageGaps, assertVerifiedHistoryCoverageForDate, historyCoverageError };
