'use strict';

const { isDeepStrictEqual } = require('node:util');
const { resolvePayrollBreakIntervals } = require(
    '../../utils/ergazomenoi/resolvePayrollBreakIntervals'
);
const {
    CARD_PAIR_STATE,
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');
const {
    buildApologistikaIntervals,
    normalizeTimeValue,
    timeToMinutes
} = require('./apasxoliseisScenarioFactsService');
const {
    POLICY_VERSION,
    RESOLUTION_KIND,
    canonicalApprovedPairSet,
    isApprovedZeroLengthResolution
} = require('./apasxoliseisZeroLengthCardResolutionContract');

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}

function pairNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 3 ? number : null;
}

function normalizedInterval(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some((field) =>
            !['pairNumber', 'start', 'end'].includes(field))) {
        fail('ZERO_LENGTH_INTERVAL_FIELDS_NOT_ALLOWED',
            'Το διάστημα περιέχει μη επιτρεπτά πεδία.');
    }
    const pair = pairNumber(value.pairNumber);
    const rawStart = String(value.start ?? '').trim();
    const rawEnd = String(value.end ?? '').trim();
    const strictClock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const start = strictClock.test(rawStart) ? normalizeTimeValue(rawStart) : null;
    const end = strictClock.test(rawEnd) ? normalizeTimeValue(rawEnd) : null;
    if (!pair || !start || !end) fail('ZERO_LENGTH_INTERVAL_INCOMPLETE',
        'Απαιτείται πλήρες έγκυρο διάστημα Από–Έως για κάθε ζεύγος.');
    if (timeToMinutes(start) === timeToMinutes(end)) fail('ZERO_LENGTH_REPLACEMENT_NOT_WORK',
        'Το απολογιστικό διάστημα πρέπει να έχει θετική διάρκεια.');
    return Object.freeze({ pairNumber: pair, start, end });
}

function intervalMinutes(interval) {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    return { start, end: end <= start ? end + 1440 : end };
}

function resolveZeroLengthCardResolution({ row = {}, command = {}, effectiveEmployee = {},
    breakConfiguration = null, actor = '', now = new Date() } = {}) {
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
        Object.keys(command).some((field) => ![
            'approve', 'revise_approved', 'intervals', 'transmission_failure_confirmed'
        ].includes(field))) fail('ZERO_LENGTH_RESOLUTION_FIELDS_NOT_ALLOWED',
        'Η εντολή επίλυσης περιέχει μη επιτρεπτά πεδία.');
    if (command.approve !== true) fail('ZERO_LENGTH_EXPLICIT_APPROVAL_REQUIRED',
        'Απαιτείται ρητή έγκριση της πραγματικής απασχόλησης.');
    if (command.transmission_failure_confirmed !== true) fail(
        'ZERO_LENGTH_TRANSMISSION_FAILURE_CONFIRMATION_REQUIRED',
        'Απαιτείται ρητή επιβεβαίωση αποτυχίας διαβίβασης της ψηφιακής κάρτας.');
    const revisingApproved = command.revise_approved === true;
    if (revisingApproved && !isApprovedZeroLengthResolution(row)) fail(
        'ZERO_LENGTH_APPROVED_REVISION_NOT_ALLOWED',
        'Η εγγραφή δεν περιέχει έγκυρη εγκεκριμένη επίλυση προς διόρθωση.', 409);
    const verification = resolveCardPairVerification(row);
    const zeroPairs = verification.unresolvedPairs.filter(
        (item) => item.state === CARD_PAIR_STATE.ZERO_LENGTH
    );
    if (!zeroPairs.length) fail('ZERO_LENGTH_CARD_EVIDENCE_NOT_FOUND',
        'Δεν βρέθηκε μηδενικό διάστημα κάρτας προς επίλυση.', 409);
    if (!Array.isArray(command.intervals) || !command.intervals.length) fail(
        'ZERO_LENGTH_INTERVALS_REQUIRED',
        'Δηλώστε το πραγματικό διάστημα απασχόλησης.');
    const intervals = command.intervals.map(normalizedInterval);
    const expected = zeroPairs.map((item) => Number(item.pairNumber)).sort();
    if (revisingApproved && !isDeepStrictEqual(
        canonicalApprovedPairSet(row.zero_length_card_resolution), expected
    )) fail('ZERO_LENGTH_APPROVED_PAIR_SET_MISMATCH',
        'Τα αρχικά μηδενικά χτυπήματα δεν συμφωνούν πλέον με την εγκεκριμένη επίλυση.', 409);
    const supplied = intervals.map((item) => item.pairNumber).sort();
    if (new Set(supplied).size !== supplied.length ||
        !isDeepStrictEqual(supplied, expected)) fail('ZERO_LENGTH_PAIR_SET_MISMATCH',
        'Τα ζεύγη επίλυσης δεν συμφωνούν με τα τρέχοντα μηδενικά διαστήματα.', 409);
    const existingIntervals = revisingApproved
        ? row.zero_length_card_resolution.approved_intervals.map(normalizedInterval)
            .sort((left, right) => left.pairNumber - right.pairNumber)
        : [];
    const sortedIntervals = [...intervals]
        .sort((left, right) => left.pairNumber - right.pairNumber);
    if (revisingApproved && isDeepStrictEqual(existingIntervals, sortedIntervals)) fail(
        'ZERO_LENGTH_REVISION_NO_CHANGE',
        'Η διορθωμένη επίλυση πρέπει να διαφέρει από την ήδη εγκεκριμένη.', 409);

    const approvedUpdates = {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apologistiko_biblio: true,
        repo_apologistika: false,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        astheneia_apologistika: false,
        apousia_apologistika: false
    };
    intervals.forEach((item) => {
        const pair = String(item.pairNumber).padStart(2, '0');
        approvedUpdates[`apo_ora_${pair}_apologistika`] = item.start;
        approvedUpdates[`eos_ora_${pair}_apologistika`] = item.end;
    });
    const proposedRow = { ...row, ...approvedUpdates };
    const workIntervals = buildApologistikaIntervals(proposedRow)
        .filter((item) => item.isComplete && !item.isZeroLength)
        .map(intervalMinutes);
    if (!workIntervals.length) fail('ZERO_LENGTH_POSITIVE_WORK_REQUIRED',
        'Δεν προκύπτει θετική πραγματική απασχόληση.');
    const breakContext = breakConfiguration
        ? { ...effectiveEmployee,
            dialleima_entos_ektos_orarioy: breakConfiguration.break_inside_schedule,
            dialleima_se_lepta: breakConfiguration.break_minutes }
        : effectiveEmployee;
    const netMinutes = resolvePayrollBreakIntervals({ row: proposedRow,
        effectiveEmployee: breakContext, workIntervals }).netMinutes;
    if (!(netMinutes > 0)) fail('ZERO_LENGTH_POSITIVE_WORK_REQUIRED',
        'Δεν προκύπτει θετική πραγματική απασχόληση.');
    approvedUpdates.ores_ergasias_apologistika = netMinutes / 60;
    approvedUpdates.ores_pragmatikhs_ergasias_apologistika = netMinutes / 60;
    const approvalMetadata = {
        status: 'HR_APPROVED',
        policy_version: POLICY_VERSION,
        resolution_kind: RESOLUTION_KIND,
        affected_pairs: expected,
        approved_intervals: intervals,
        raw_cards_preserved: true,
        apologistiko_biblio: true,
        transmission_failure_confirmed: true,
        approved_by: revisingApproved
            ? String(row.zero_length_card_resolution.approved_by || '')
            : String(actor || ''),
        approved_at: revisingApproved
            ? row.zero_length_card_resolution.approved_at || null
            : now
    };
    const metadata = revisingApproved ? {
        ...approvalMetadata,
        revision_number:
            Math.max(0, Number(row.zero_length_card_resolution.revision_number) || 0) + 1,
        revised_by: String(actor || ''),
        revised_at: now
    } : approvalMetadata;
    return Object.freeze({ approvedUpdates: Object.freeze(approvedUpdates),
        metadata: Object.freeze(metadata), intervals: Object.freeze(intervals),
        netWorkMinutes: netMinutes, revisingApproved });
}

function replayView(metadata = {}) {
    const value = { ...metadata };
    delete value.approved_at;
    return value;
}

async function persistZeroLengthCardResolutionWrite({ oldRecord, semanticUpdates,
    changedBy, reason, reviseApproved = false, now = new Date(), schemaPaths, rowModel,
    auditModel, session } = {}) {
    const {
        buildReviewCompareAndSetFilter,
        buildAuditDiff
    } = require('./apasxoliseisOrphanResolutionPersistenceService');
    const finalMetadata = reviseApproved
        ? { ...semanticUpdates.zero_length_card_resolution, revised_at: now }
        : { ...semanticUpdates.zero_length_card_resolution, approved_at: now };
    const invariantUpdates = { ...semanticUpdates, apologistiko_biblio: true,
        zero_length_card_resolution: finalMetadata };
    if (reviseApproved) {
        const previousRevision = Math.max(0,
            Number(oldRecord.zero_length_card_resolution?.revision_number) || 0);
        if (oldRecord.is_locked !== true || !isApprovedZeroLengthResolution(oldRecord) ||
            !isApprovedZeroLengthResolution({ zero_length_card_resolution: finalMetadata }) ||
            Number(finalMetadata.revision_number) !== previousRevision + 1) fail(
            'ZERO_LENGTH_APPROVED_REVISION_NOT_ALLOWED',
            'Η κλειδωμένη εγκεκριμένη επίλυση δεν μπορεί να διορθωθεί με ασφάλεια.', 409);
    }
    const same = Object.entries(invariantUpdates).every(([field, value]) =>
        field === 'zero_length_card_resolution'
            ? isDeepStrictEqual(replayView(oldRecord[field]), replayView(value))
            : isDeepStrictEqual(oldRecord[field], value));
    if (same) return { idempotent: true, updated: false };
    if (!reviseApproved && oldRecord.is_locked === true) fail('EMPLOYMENT_REVIEW_RECORD_LOCKED',
        'Η εγγραφή είναι κλειδωμένη και η ζητούμενη επίλυση δεν είναι ισοδύναμη.', 409);
    const finalUpdates = { ...invariantUpdates, is_locked: true,
        locked_by: changedBy, locked_at: now };
    const { oldValues, newValues } = buildAuditDiff(oldRecord, finalUpdates);
    const result = await rowModel.updateOne(
        buildReviewCompareAndSetFilter({ oldRecord, schemaPaths }),
        { $set: finalUpdates }, { session }
    );
    if (Number(result?.matchedCount ?? result?.n ?? 0) !== 1) fail(
        'EMPLOYMENT_REVIEW_STALE_WRITE',
        'Η εγγραφή άλλαξε. Ανανεώστε τα αποτελέσματα.', 409);
    await auditModel.create([{ team: oldRecord.team, company_kod: oldRecord.company_kod,
        prodhlomena_oraria_id: oldRecord._id, kodikos: oldRecord.kodikos,
        ypokatasthma: oldRecord.ypokatasthma, hmeromhnia: oldRecord.hmeromhnia,
        changedBy, reason, oldValues, newValues }], { session });
    return { idempotent: false, updated: true, oldValues, newValues, finalUpdates };
}

module.exports = { POLICY_VERSION, RESOLUTION_KIND, resolveZeroLengthCardResolution,
    isApprovedZeroLengthResolution, persistZeroLengthCardResolutionWrite };
