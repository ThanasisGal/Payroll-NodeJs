'use strict';

const { CARD_PAIR_STATE, resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { isApprovedOrphanResolution } = require('./apasxoliseisOrphanCardResolutionService');

const REASON_CODE = 'PERIOD_HAS_UNRESOLVED_DATA_QUALITY_ISSUES';

function issueForRow(row = {}) {
    const unresolved = resolveCardPairVerification(row).unresolvedPairs;
    const orphan = unresolved.find((pair) =>
        [CARD_PAIR_STATE.START_ONLY, CARD_PAIR_STATE.END_ONLY].includes(pair.state));
    if (orphan && !isApprovedOrphanResolution(row)) return Object.freeze({
        issue_code: 'ORPHAN_CARD_PUNCH', pair_number: orphan.pairNumber,
        finding: orphan.state === CARD_PAIR_STATE.START_ONLY
            ? `Είσοδος ${orphan.rawStart} χωρίς αντίστοιχη έξοδο.`
            : `Έξοδος ${orphan.rawEnd} χωρίς αντίστοιχη είσοδο.`
    });
    const invalid = unresolved.find((pair) => pair.state === CARD_PAIR_STATE.INVALID_TIME);
    if (invalid) return Object.freeze({ issue_code: 'INVALID_CARD_EVIDENCE',
        pair_number: invalid.pairNumber, finding: 'Μη έγκυρη τιμή κάρτας εργασίας.' });
    const zeroLength = unresolved.find((pair) => pair.state === CARD_PAIR_STATE.ZERO_LENGTH);
    if (zeroLength) return Object.freeze({ issue_code: 'ZERO_LENGTH_CARD_EVIDENCE',
        pair_number: zeroLength.pairNumber,
        finding: `Ίδια ώρα εισόδου και εξόδου (${zeroLength.rawStart}).` });
    return null;
}

function buildPeriodDataQualityReadiness({ rows = [] } = {}) {
    const unresolvedCases = rows.map((row) => ({ row, issue: issueForRow(row) }))
        .filter((item) => item.issue).map(({ row, issue }) => Object.freeze({
            employee_kodikos: String(row.kodikos || '').trim(),
            employee_name: String(row.employeeName || `${row.eponymo || ''} ${row.onoma || ''}`).trim(),
            date: new Date(row.hmeromhnia).toISOString().slice(0, 10),
            prodhlomena_oraria_id: String(row._id || row.id || ''), ...issue
        }));
    return Object.freeze({ ready: unresolvedCases.length === 0,
        reason_code: unresolvedCases.length ? REASON_CODE : null,
        unresolved_count: unresolvedCases.length,
        unresolved_cases: Object.freeze(unresolvedCases) });
}

function assertPeriodDataQualityReady(readiness, action = '') {
    if (readiness?.ready !== false) return readiness;
    const count = Number(readiness.unresolved_count || 0);
    const prefix = action === 'HISTORICAL_RECONSTRUCTION'
        ? 'Η περίοδος δεν μπορεί να ανακατασκευαστεί ή να επανεκτιμηθεί.'
        : action === 'FINALIZE' ? 'Η περίοδος δεν μπορεί να οριστικοποιηθεί.'
            : action === 'LOCK' ? 'Η περίοδος δεν μπορεί να κλειδωθεί.'
                : 'Η ενέργεια δεν μπορεί να εκτελεστεί.';
    const error = new Error(`${prefix} ${count === 1 ? 'Υπάρχει 1 εκκρεμότητα' : `Υπάρχουν ${count} εκκρεμότητες`} ποιότητας δεδομένων.`);
    error.code = REASON_CODE; error.statusCode = 409; error.period_data_quality_readiness = readiness;
    throw error;
}

module.exports = { REASON_CODE, issueForRow, buildPeriodDataQualityReadiness,
    assertPeriodDataQualityReady };
