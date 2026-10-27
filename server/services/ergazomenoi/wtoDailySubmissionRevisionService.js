'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { normalizeScope } = require('./apasxoliseisPeriodControlService');
const { filterEligibleApologistikosSource, buildCanonicalApologistikosRows, buildReportFromCanonical } = require('./apologistikosPinakasControlReportService');
const { buildWtoDailySubmissionProjection, buildWTODayilyAPayload, dateKey } = require('./wtoDailySubmissionProjectionService');
const { assertAccountingIntervals, assertWtoDailyPayloadIntervals, accountingIntervalsFromRow, inspectAccountingIntervals, normalizedAccountingRowUpdate } = require('./accountingIntervalValidationService');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
const copy = value => JSON.parse(JSON.stringify(canonicalize(value)));
const TIME_FIELDS = ['01', '02', '03'].flatMap(pair => [`apo_ora_${pair}_apologistika`, `eos_ora_${pair}_apologistika`]);
const pickTimes = row => Object.fromEntries(TIME_FIELDS.map(field => [field, row[field] || '']));

function fail(code, explanation, statusCode = 409) {
    throw Object.assign(new Error(`${explanation} Η ενέργεια σταμάτησε για να προστατευθούν τα αρχικά αποτελέσματα. ` +
        '1. Ελέγξτε εταιρεία, παράρτημα, ημερομηνία και τις προτεινόμενες ώρες. ' +
        '2. Δημιουργήστε και ελέγξτε ξανά ολόκληρη την προεπισκόπηση πριν από ρητή έγκριση. ' +
        `Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την ενέργεια. Δεν στάλθηκε υποβολή στο ΕΡΓΑΝΗ. Κωδικός αναφοράς: ${code}.`),
    { code, statusCode });
}

function authorize(session, inputScope) {
    try { assertCriticalEmploymentDecisionRole(session); }
    catch { fail('WTODAILY_REVISION_NOT_AUTHORIZED', 'Δεν έχετε δικαίωμα έγκρισης διορθωτικής έκδοσης.', 403); }
    const scope = normalizeScope(inputScope);
    if (!mongoose.isValidObjectId(session?.userId) || scope.team !== String(session.userTeam || '') ||
        scope.company_kod !== String(session.companyInUse || '')) {
        fail('WTODAILY_REVISION_SCOPE_FORBIDDEN', 'Η διορθωτική έκδοση δεν ανήκει στο ενεργό εταιρικό περιβάλλον.', 403);
    }
    return scope;
}

function normalizeCommand(command = {}) {
    const allowed = ['ypokatasthma', 'reason', 'correction', 'corrections', 'approve', 'reviewed_entire_preview',
        'expected_preview_fingerprint', 'request_id'];
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
        Object.keys(command).some(key => !allowed.includes(key)) || command.correction && command.corrections) {
        fail('WTODAILY_REVISION_COMMAND_INVALID', 'Το αίτημα περιέχει μη επιτρεπτές αλλαγές.');
    }
    const reason = String(command.reason || '').trim();
    const corrections = command.corrections ?? (command.correction ? [command.correction] : []);
    if (!reason || reason.length > 2000 || !Array.isArray(corrections) || corrections.length > 500) {
        fail('WTODAILY_REVISION_COMMAND_INVALID', 'Απαιτούνται αιτιολογία και ημερήσιες διορθώσεις της ίδιας περιόδου.');
    }
    const seen = new Set();
    for (const correction of corrections) {
        if (!correction || typeof correction !== 'object' || Array.isArray(correction) ||
            Object.keys(correction).some(key => !['row_id', 'date', 'intervals', 'keep_pair', 'confirmed_actual_hours'].includes(key)) ||
            typeof correction.row_id !== 'string' || !correction.row_id.trim() || seen.has(correction.row_id) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(correction.date || '') ||
            !Array.isArray(correction.intervals) || correction.intervals.length < 1 || correction.intervals.length > 3 ||
            correction.keep_pair !== undefined && ![1, 2, 3].includes(correction.keep_pair)) {
            fail('WTODAILY_REVISION_COMMAND_INVALID', 'Κάθε ημερήσια διόρθωση χρειάζεται μοναδική εγγραφή, ημερομηνία και πλήρεις ώρες.');
        }
        seen.add(correction.row_id);
        for (const interval of correction.intervals) if (!interval || typeof interval !== 'object' ||
            Object.keys(interval).some(key => !['start', 'end'].includes(key)) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.start || '') ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.end || '')) {
            fail('WTODAILY_REVISION_COMMAND_INVALID', 'Οι ώρες της προτεινόμενης διόρθωσης δεν είναι πλήρεις ή έγκυρες.');
        }
        assertAccountingIntervals({ intervals: correction.intervals, date: correction.date, operation: 'save' });
    }
    return { reason, corrections: copy(corrections) };
}

// Same persisted fingerprint projection as the original snapshot builder.
function baselineFingerprint(snapshot) {
    // The v3 builder always emits this empty default. Mongoose's historical
    // minimize setting omits it on storage. Restore only this documented empty
    // shape for hash verification; any removed nonempty protection still fails.
    const context = snapshot?.weekly_calculation_context;
    const projection = context && !Object.hasOwn(context, 'applied_transfer_protection')
        ? { ...snapshot, weekly_calculation_context: { ...context, applied_transfer_protection: {} } } : snapshot;
    return hash({ ...projection, applied_repo_transfers: (snapshot.applied_repo_transfers || []).map(row => {
        const projected = { ...row };
        for (const field of ['created_by_user_id', 'created_by_user_name', 'created_by_user_role', 'applied_at', 'created_at']) delete projected[field];
        return projected;
    }) });
}

function buildRevisionPreview({ scope, control, document, command, session }) {
    const normalized = normalizeCommand(command); const source = document?.frozen_snapshot;
    if (control?.status !== 'FINALIZED' || !source || String(control.frozen_snapshot_id) !== String(document._id) ||
        !Number.isInteger(control.version) || !Number.isInteger(control.write_fence_version) || control.active_calculation_id ||
        control.frozen_snapshot_fingerprint !== document.frozen_snapshot_fingerprint ||
        source.snapshot_schema_version !== 'employment-period-frozen:v3' ||
        !Array.isArray(source.daily_results) || baselineFingerprint(source) !== document.frozen_snapshot_fingerprint) {
        fail('WTODAILY_REVISION_BASELINE_INVALID', 'Δεν επιβεβαιώθηκε το αρχικό οριστικοποιημένο αποτέλεσμα.');
    }
    for (const field of ['team', 'company_kod', 'ypokatasthma']) if (String(source.scope?.[field]) !== String(scope[field]) ||
        String(document[field]) !== String(scope[field])) fail('WTODAILY_REVISION_SCOPE_FORBIDDEN', 'Το παγωμένο αποτέλεσμα ανήκει σε διαφορετικό εταιρικό περιβάλλον.', 403);
    for (const field of ['period_start', 'period_end']) if (dateKey(source.scope?.[field]) !== dateKey(scope[field]) ||
        dateKey(document[field]) !== dateKey(scope[field])) fail('WTODAILY_REVISION_BASELINE_INVALID', 'Το παγωμένο αποτέλεσμα ανήκει σε διαφορετική περίοδο.');
    const originalsById = new Map(source.daily_results.map(row => [String(row._id || ''), row]));
    if (originalsById.has('') || originalsById.size !== source.daily_results.length) {
        fail('WTODAILY_REVISION_BASELINE_INVALID', 'Το αρχικό αποτέλεσμα δεν περιέχει μοναδικές ημερήσιες εγγραφές.');
    }
    const draft = copy(source);
    for (const row of draft.daily_results) if (String(row.ypokatasthma).padStart(4, '0') !== scope.ypokatasthma ||
        row.team != null && String(row.team) !== scope.team ||
        row.company_kod != null && String(row.company_kod) !== scope.company_kod ||
        dateKey(row.hmeromhnia) < dateKey(scope.period_start) || dateKey(row.hmeromhnia) > dateKey(scope.period_end)) {
        fail('WTODAILY_REVISION_BASELINE_INVALID', 'Το παγωμένο αποτέλεσμα περιέχει εγγραφή εκτός της επιλεγμένης περιόδου ή παραρτήματος.');
    }
    const originalRows = buildCanonicalApologistikosRows({ ...filterEligibleApologistikosSource({ rows: source.daily_results,
        employees: source.employees, requireFrozenEligibility: true }), normalizeAdjacent: false });
    const eligibleIds = new Set(originalRows.filter(row => ['ΕΡΓ', 'ΤΗΛ'].includes(row.category)).map(row => row.source_record_id));
    const applied = new Map();
    for (const correction of normalized.corrections) {
        const matches = draft.daily_results.filter(row => String(row._id) === correction.row_id && dateKey(row.hmeromhnia) === correction.date);
        if (matches.length !== 1) fail('WTODAILY_REVISION_ROW_NOT_FOUND', 'Δεν εντοπίστηκε μία μοναδική ημερήσια εγγραφή για τη διόρθωση.');
        if (!eligibleIds.has(correction.row_id)) fail('WTODAILY_REVISION_ROW_NOT_SUBMITTABLE', 'Η επιλεγμένη ημέρα δεν περιλαμβάνει εργασία προς υποβολή.');
        const row = matches[0];
        const original = accountingIntervalsFromRow(row).filter(item => item.start || item.end);
        const diagnosis = inspectAccountingIntervals({ intervals: original, date: correction.date });
        if (diagnosis.issues.some(issue => issue.code === 'ACCOUNTING_INTERVALS_OVERLAP') && correction.confirmed_actual_hours !== true) {
            fail('WTODAILY_REVISION_ACTUAL_HOURS_CONFIRMATION_REQUIRED', 'Υπάρχουν αντικρουόμενες ώρες. Απαιτείται συγκεκριμένη επιβεβαίωση των τελικών πραγματικών ωρών.');
        }
        if (correction.keep_pair !== undefined) {
            const selected = original.find(item => item.pairNumber === correction.keep_pair);
            if (!selected || correction.intervals.length !== 1 ||
                selected.start !== correction.intervals[0].start || selected.end !== correction.intervals[0].end) {
                fail('WTODAILY_REVISION_SELECTION_MISMATCH', 'Οι προτεινόμενες ώρες διαφέρουν από το ζεύγος που επιλέξατε να διατηρήσετε.');
            }
            const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
            const span = item => { const start = minute(item.start); const end = minute(item.end); return [start, end + (end < start ? 1440 : 0)]; };
            const chosen = span(selected);
            if (original.some(item => { const other = span(item); return !(chosen[0] <= other[0] && chosen[1] >= other[1] || other[0] <= chosen[0] && other[1] >= chosen[1]); })) {
                fail('WTODAILY_REVISION_PARTIAL_OVERLAP_REVIEW_REQUIRED', 'Η μερική επικάλυψη χρειάζεται αναλυτικό έλεγχο των πραγματικών ωρών, πριν διαγραφεί κάποιο ζεύγος.');
            }
        }
        ['01', '02', '03'].forEach((pair, index) => {
            row[`apo_ora_${pair}_apologistika`] = correction.intervals[index]?.start || '';
            row[`eos_ora_${pair}_apologistika`] = correction.intervals[index]?.end || '';
        });
        applied.set(correction.row_id, correction);
    }
    const corrections = []; const unresolved = [];
    for (const row of draft.daily_results) {
        const id = String(row._id);
        if (!eligibleIds.has(id)) continue;
        Object.assign(row, normalizedAccountingRowUpdate(row));
        const original = originalsById.get(id);
        const before = pickTimes(original); const after = pickTimes(row);
        const diagnosis = inspectAccountingIntervals({ intervals: accountingIntervalsFromRow(row), date: row.hmeromhnia });
        if (!diagnosis.valid) unresolved.push({ row_id: id, employee_code: row.kodikos, date: dateKey(row.hmeromhnia),
            before, options: accountingIntervalsFromRow(original).filter(item => item.start || item.end), issues: diagnosis.issues });
        if (hash(before) === hash(after)) continue;
        const intervals = accountingIntervalsFromRow(row).filter(item => item.start || item.end).map(({ start, end }) => ({ start, end }));
        corrections.push({ row_id: id, employee_code: row.kodikos, date: dateKey(row.hmeromhnia), before, after,
            automatic: !applied.has(id), keep_pair: applied.get(id)?.keep_pair,
            confirmed_actual_hours: applied.get(id)?.confirmed_actual_hours === true,
            confirmed_intervals: intervals, confirmed_work_minutes: intervals.reduce((sum, item) => {
                const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
                const start = minute(item.start); const end = minute(item.end);
                return sum + end - start + (end < start ? 1440 : 0);
            }, 0) });
    }
    const canonicalRows = buildCanonicalApologistikosRows({ ...filterEligibleApologistikosSource({ rows: draft.daily_results,
        employees: draft.employees, requireFrozenEligibility: true }), normalizeAdjacent: false });
    const ready = unresolved.length === 0 && corrections.length > 0;
    const payload = ready ? buildWTODayilyAPayload(buildWtoDailySubmissionProjection({ canonicalRows, branch: scope.ypokatasthma,
        periodStart: scope.period_start, periodEnd: scope.period_end, comments: 'Διορθωτική έκδοση αποκλειστικά για υποβολή' })) : null;
    const diagnosis = payload ? assertWtoDailyPayloadIntervals(payload) : { contacts: [] };
    const revision = { baseline_snapshot_id: String(document._id), baseline_fingerprint: document.frozen_snapshot_fingerprint,
        baseline_content_fingerprint: hash(source), control_version: control.version,
        correction: corrections.find(item => !item.automatic) || corrections[0] || null,
        corrections, unresolved, ready_to_create: ready,
        before_report: buildReportFromCanonical({ canonicalRows: originalRows }),
        control_report: buildReportFromCanonical({ canonicalRows }),
        reason: normalized.reason, payload, contacts: diagnosis.contacts };
    return { ...revision, preview_fingerprint: hash({ scope, actor: String(session.userId), ...revision }),
        submission_enabled: false, payroll_recalculated: false,
        required_before_submission: ['VERIFY_PREVIOUS_ERGANI_ATTEMPT',
            'VERIFY_DEFERRED_BOUNDARY_READINESS', 'REVIEW_ENTIRE_PAYLOAD', 'SEPARATE_EXPLICIT_SUBMISSION_COMMAND'] };
}

function models(options) {
    return { period: options.periodModel || require('../../models/apasxoliseisPeriodControl'),
        frozen: options.frozenModel || require('../../models/apasxoliseisPeriodFrozenSnapshot'),
        revision: options.revisionModel || require('../../models/wtoDailySubmissionRevision') };
}
async function readBaseline({ scope, storage, dbSession }) {
    const control = await storage.period.findOne(scope).session(dbSession || null).lean();
    if (control?.status !== 'FINALIZED' || !control.frozen_snapshot_id) fail('WTODAILY_REVISION_FINALIZED_REQUIRED', 'Η διορθωτική έκδοση απαιτεί ήδη οριστικοποιημένη περίοδο.');
    const document = await storage.frozen.findOne({ ...scope, _id: control.frozen_snapshot_id,
        frozen_snapshot_fingerprint: control.frozen_snapshot_fingerprint }).session(dbSession || null).lean();
    return { control, document };
}
async function previewSubmissionRevision(options) {
    const scope = authorize(options.session, options.scope); normalizeCommand(options.command);
    return buildRevisionPreview({ scope, ...await readBaseline({ scope, storage: models(options) }),
        command: options.command, session: options.session });
}
async function transaction(work) {
    const session = await mongoose.startSession();
    try { let result; await session.withTransaction(async () => { result = await work(session); },
        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); return result; }
    finally { await session.endSession(); }
}
async function createSubmissionRevision(options) {
    const scope = authorize(options.session, options.scope); const command = options.command || {};
    normalizeCommand(command);
    if (command.approve !== true || command.reviewed_entire_preview !== true ||
        !/^[a-f0-9]{64}$/.test(command.expected_preview_fingerprint || '') ||
        !String(command.request_id || '').trim() || String(command.request_id).length > 200) {
        fail('WTODAILY_REVISION_EXPLICIT_APPROVAL_REQUIRED', 'Απαιτούνται ρητή έγκριση, επιβεβαίωση ελέγχου ολόκληρης της προεπισκόπησης των συγκεκριμένων διορθωμένων ωρών.');
    }
    const storage = models(options);
    try { const indexes = await storage.revision.collection.indexes();
        if (!indexes.some(index => index.name === '_id_' && index.key?._id === 1)) throw new Error('missing collection');
    } catch { fail('WTODAILY_REVISION_STORAGE_NOT_READY', 'Η ασφαλής αποθήκευση διορθωτικών εκδόσεων δεν είναι διαθέσιμη.', 503); }
    try { return await (options.transactionRunner || transaction)(async dbSession => {
        const baseline = await readBaseline({ scope, storage, dbSession });
        const preview = buildRevisionPreview({ scope, ...baseline, command, session: options.session });
        if (preview.preview_fingerprint !== command.expected_preview_fingerprint) {
            fail('WTODAILY_REVISION_PREVIEW_STALE', 'Το αρχικό αποτέλεσμα ή η προτεινόμενη διόρθωση άλλαξε μετά την προεπισκόπηση.');
        }
        if (!preview.ready_to_create) fail('WTODAILY_REVISION_UNRESOLVED', 'Δεν έχουν επιβεβαιωθεί όλες οι αντικρουόμενες ώρες ή δεν προκύπτει διόρθωση.');
        const id = hash({ scope, baseline_snapshot_id: preview.baseline_snapshot_id });
        const existing = await storage.revision.findOne({ _id: id, ...scope }).session(dbSession).lean();
        if (existing) {
            if (existing.preview_fingerprint === preview.preview_fingerprint &&
                existing.approval.user_id === String(options.session.userId) && existing.request_id === command.request_id) {
                return { idempotent: true, revision: existing };
            }
            fail('WTODAILY_REVISION_ALREADY_EXISTS', 'Υπάρχει ήδη διορθωτική έκδοση για το συγκεκριμένο παγωμένο αποτέλεσμα.');
        }
        // Existing period metadata fence only. No original frozen field changes.
        const fenced = await storage.period.updateOne({ ...scope, status: 'FINALIZED', version: baseline.control.version,
            frozen_snapshot_id: baseline.control.frozen_snapshot_id, frozen_snapshot_fingerprint: preview.baseline_fingerprint,
            write_fence_version: baseline.control.write_fence_version }, { $inc: { write_fence_version: 1 } }, { session: dbSession });
        if (Number(fenced.matchedCount) !== 1) fail('WTODAILY_REVISION_CONCURRENT_CHANGE', 'Η κατάσταση της περιόδου άλλαξε ταυτόχρονα.');
        const now = options.now || new Date();
        const documents = await storage.revision.create([{ _id: id, ...scope,
            baseline_snapshot_id: preview.baseline_snapshot_id, baseline_fingerprint: preview.baseline_fingerprint,
            baseline_content_fingerprint: preview.baseline_content_fingerprint, preview_fingerprint: preview.preview_fingerprint,
            request_id: command.request_id, correction: preview.correction, corrections: preview.corrections,
            control_report: preview.control_report, reason: preview.reason,
            payload: preview.payload, contacts: preview.contacts, submission_enabled: false,
            required_before_submission: preview.required_before_submission,
            approval: { user_id: String(options.session.userId), user_name: String(options.session.userName || options.session.username || ''),
                role: options.session.userRole, approved_at: now, reviewed_entire_preview: true }, created_at: now }], { session: dbSession });
        return { idempotent: false, revision: documents[0] };
    }); } catch (error) {
        if (error?.code === 11000) fail('WTODAILY_REVISION_ALREADY_EXISTS', 'Δημιουργήθηκε ήδη διορθωτική έκδοση από άλλη ενέργεια.');
        throw error;
    }
}
module.exports = { baselineFingerprint, buildRevisionPreview, previewSubmissionRevision, createSubmissionRevision };
