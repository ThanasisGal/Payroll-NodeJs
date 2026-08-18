'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const StateModel = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { normalizeEmploymentType } = require('./apasxoliseisReviewEmploymentProfileService');
const { stableStringify, buildStage3InputFingerprint,
    positiveClassification } = require('./apasxoliseisStage3FingerprintService');
const { writeCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService'
);
const { findStage1PeriodSlice, periodSliceKey } = require(
    './apasxoliseisStage1PeriodSliceService'
);

const ACTION = 'STAGE3_DAILY_RESOLVED';
const WORKFLOW_VERSION = 'weekly-hr-workflow:v1';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function text(value, max = Infinity) { return String(value ?? '').trim().slice(0, max); }
function classification(value) {
    const result = text(value).toUpperCase();
    if (!['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'].includes(result)) {
        fail('INVALID_STAGE3_CLASSIFICATION', 'Μη έγκυρος τελικός χαρακτηρισμός Stage 3.');
    }
    return result;
}
function normalizeActor(actor = {}) {
    const role = assertCriticalEmploymentDecisionRole({ userRole: actor.role });
    const userId = text(actor.user_id || actor.userId, 50);
    const userName = text(actor.user_name || actor.userName, 150);
    if (!mongoose.isValidObjectId(userId) || !userName) {
        fail('INVALID_STAGE3_ACTOR', 'Μη έγκυρα στοιχεία χρήστη.');
    }
    return { user_id: new mongoose.Types.ObjectId(userId), user_name: userName, role };
}
function stage3CommandIdentity({ context, fingerprint, finalClassification, actor, reason }) {
    const material = { action: ACTION,
        scope: { team: text(context.scope.team), company_kod: text(context.scope.company_kod),
            ypokatasthma: text(context.scope.ypokatasthma),
            employee_id: String(context.scope.employee_id),
            employee_kodikos: text(context.scope.employee_kodikos) },
        week_start: dateKeyUtc(context.scope.week_start), week_end: dateKeyUtc(context.scope.week_end),
        date: dateKeyUtc(context.row.hmeromhnia), row_id: String(context.row._id),
        input_fingerprint: fingerprint, final_classification: finalClassification,
        actor: { id: String(actor.user_id), name: actor.user_name, role: actor.role }, reason };
    return crypto.createHash('sha256').update(stableStringify(material)).digest('hex');
}
function completionFingerprint(context = {}) {
    return crypto.createHash('sha256').update(stableStringify({
        contract: 'weekly-hr-stage3-completion:v1',
        employee_id: String(context.scope.employee_id),
        week_start: dateKeyUtc(context.scope.week_start),
        week_end: dateKeyUtc(context.scope.week_end),
        stage1_fingerprint: text(context.upstream?.stage1_current_fingerprint ||
            context.upstream?.stage1_fingerprint),
        stage2_fingerprint: text(context.upstream?.stage2_fingerprint),
        remaining_dates: [...new Set(context.remaining_dates || [])].sort()
    })).digest('hex');
}
function assertDecisionAllowed(context, finalClassification) {
    if (!context?.isResidual) fail('STAGE3_DATE_NOT_RESIDUAL',
        'Η ημέρα δεν αποτελεί πλέον εκκρεμότητα του Stage 3.', 409);
    if (context.actualFacts?.countsAsActualWorkDay === true) fail('STAGE3_ACTUAL_WORK_PRESENT',
        'Υπάρχει πραγματική εργασία και η ημέρα δεν μπορεί να επιλυθεί ως πιθανή άδεια.', 409);
    const employmentType = normalizeEmploymentType(
        context.dailyProfile?.kathestos_apasxolhshs ??
        context.dailyProfile?.typos_apasxolhshs
    );
    if (!employmentType) fail('STAGE3_DAILY_REGIME_UNKNOWN',
        'Δεν προσδιορίστηκε με ασφάλεια το ημερήσιο καθεστώς απασχόλησης.', 409);
    if (finalClassification === 'NON_WORK' && employmentType === '0') {
        fail('STAGE3_NON_WORK_NOT_ALLOWED_FOR_FULL_TIME',
            'Η ΜΗ ΕΡΓΑΣΙΑ δεν επιτρέπεται σε ημέρα πλήρους απασχόλησης.', 409);
    }
    return employmentType;
}
function sessionEnvelope(value) {
    return value?.session ? value : { session: value, period_control_version: 0,
        period_write_fence_version: 0 };
}

async function resolveWeeklyHrStage3Day({
    initialContext, expected_input_fingerprint, expected_stage3_version, final_classification,
    leave_category = '', reason_or_notes, request_id, actor: rawActor,
    loadFreshContext, loadPostWriteContext, transactionRunner,
    writeDaily = writeCanonicalDailyClassification,
    stateModel = StateModel, auditModel = AuditModel, now = () => new Date()
} = {}) {
    if (!initialContext?.scope || !initialContext?.row) fail('INVALID_STAGE3_SCOPE',
        'Μη έγκυρο ημερήσιο πλαίσιο Stage 3.');
    if (typeof loadFreshContext !== 'function' || typeof loadPostWriteContext !== 'function' ||
        typeof transactionRunner !== 'function') fail('STAGE3_SAFE_COMMAND_UNAVAILABLE',
        'Δεν είναι διαθέσιμη η ασφαλής εντολή Stage 3.', 503);
    const finalClassification = classification(final_classification);
    const actor = normalizeActor(rawActor);
    const reason = text(reason_or_notes, 2001);
    if (!reason || reason.length > 2000) fail('STAGE3_REASON_REQUIRED',
        'Η αιτιολογία είναι υποχρεωτική και έως 2000 χαρακτήρες.');
    const requestId = text(request_id, 101);
    if (!REQUEST_ID_PATTERN.test(requestId)) fail('INVALID_REQUEST_ID', 'Μη έγκυρο request_id.');
    assertDecisionAllowed(initialContext, finalClassification);
    const initialFingerprint = buildStage3InputFingerprint(initialContext).fingerprint;
    if (text(expected_input_fingerprint) !== initialFingerprint) fail('STAGE3_INPUT_CHANGED',
        'Τα δεδομένα της ημέρας άλλαξαν. Επαναλάβετε τον έλεγχο.', 409);
    const expectedStage3Version = Number(expected_stage3_version);
    if (!Number.isInteger(expectedStage3Version) || expectedStage3Version < 0 ||
        expectedStage3Version !== Number(initialContext.upstream?.stage3_version || 0)) {
        fail('STAGE3_VERSION_CONFLICT',
            'Η έκδοση του Stage 3 άλλαξε πριν από την αποθήκευση.', 409);
    }
    const identity = stage3CommandIdentity({ context: initialContext,
        fingerprint: initialFingerprint, finalClassification, actor, reason });

    return transactionRunner(async (transactionValue) => {
        const envelope = sessionEnvelope(transactionValue);
        const { session } = envelope;
        const requestFilter = { team: initialContext.scope.team,
            company_kod: initialContext.scope.company_kod, request_id: requestId };
        const priorQuery = auditModel.findOne(requestFilter);
        const prior = await (session && priorQuery?.session ? priorQuery.session(session) : priorQuery).lean();
        if (prior) {
            if (prior.command_identity !== identity) fail('STAGE3_REQUEST_ID_CONFLICT',
                'Το request_id έχει ήδη χρησιμοποιηθεί για διαφορετική εντολή.', 409);
            return { resolved: true, idempotent: true,
                stage3_status: prior.after_stage.status,
                completion_fingerprint: prior.new_completion_fingerprint || '' };
        }
        const fresh = await loadFreshContext({ session });
        assertDecisionAllowed(fresh, finalClassification);
        const freshFingerprint = buildStage3InputFingerprint(fresh).fingerprint;
        if (freshFingerprint !== initialFingerprint) fail('STAGE3_INPUT_CHANGED',
            'Τα authoritative δεδομένα άλλαξαν πριν από την αποθήκευση.', 409);
        if (Number(fresh.upstream?.stage3_version || 0) !== expectedStage3Version) {
            fail('STAGE3_VERSION_CONFLICT',
                'Η έκδοση του Stage 3 άλλαξε πριν από την αποθήκευση.', 409);
        }

        const stateFilter = { team: fresh.scope.team, company_kod: fresh.scope.company_kod,
            ypokatasthma: fresh.scope.ypokatasthma, employee_id: fresh.scope.employee_id,
            week_start: fresh.scope.week_start, week_end: fresh.scope.week_end };
        const stateQuery = stateModel.findOne(stateFilter);
        const current = await (session && stateQuery?.session ? stateQuery.session(session) : stateQuery).lean();
        const sliceAttestation = fresh.upstream?.stage1_attestation_scope === 'PERIOD_SLICE';
        const currentSlice = sliceAttestation ? findStage1PeriodSlice(current?.stage1,
            fresh.upstream?.stage1_period_start, fresh.upstream?.stage1_period_end) : null;
        if (!current || (sliceAttestation ? currentSlice?.status !== 'COMPLETED'
            : current.stage1?.status !== 'COMPLETED')) fail('STAGE3_UPSTREAM_NOT_COMPLETED',
            'Το Στάδιο 1 δεν είναι ολοκληρωμένο για το εφαρμοστέο πλαίσιο.', 409);
        const previousStage1Effective = text(sliceAttestation
            ? currentSlice.effective_fingerprint || currentSlice.completion_fingerprint
            : current.stage1.effective_fingerprint || current.stage1.completion_fingerprint);
        const currentAuthoritativeStage1Fingerprint = text(
            fresh.upstream?.stage1_current_fingerprint || fresh.upstream?.stage1_fingerprint
        );
        if (!previousStage1Effective ||
            previousStage1Effective !== currentAuthoritativeStage1Fingerprint) {
            fail('STAGE3_UPSTREAM_STAGE1_STALE',
                'Τα δεδομένα του Stage 1 έχουν αλλάξει και απαιτείται νέα εξέταση.', 409);
        }
        const previousStage = current.stage3 || { status: 'OPEN', completion_fingerprint: '', version: 0 };
        if (Number(previousStage.version || 0) !== expectedStage3Version) {
            fail('STAGE3_VERSION_CONFLICT',
                'Η έκδοση του Stage 3 άλλαξε πριν από την αποθήκευση.', 409);
        }
        const written = await writeDaily({ row: { ...fresh.row, team: fresh.scope.team,
            company_kod: fresh.scope.company_kod }, classification: finalClassification,
            leave_category, reason, actor_name: actor.user_name, session });
        if (written.unchanged) fail('STAGE3_DECISION_ALREADY_APPLIED',
            'Ο χαρακτηρισμός υπάρχει ήδη και δεν αποτελεί νέα επίλυση Stage 3.', 409);
        const post = await loadPostWriteContext({ session, written });
        if ((post.remaining_dates || []).includes(dateKeyUtc(fresh.row.hmeromhnia))) {
            fail('STAGE3_RESOLUTION_DID_NOT_CLEAR_RESIDUAL',
                'Η ημερήσια απόφαση δεν επίλυσε την εκκρεμότητα Stage 3.', 409);
        }
        const completed = (post.remaining_dates || []).length === 0;
        const completedFingerprint = completed ? completionFingerprint(post) : '';
        const performedAt = now();
        const nextVersion = Number(previousStage.version || 0) + 1;
        const nextStage = { status: completed ? 'COMPLETED' : 'OPEN',
            completion_fingerprint: completedFingerprint,
            completed_at: completed ? performedAt : null,
            completed_by_user_id: completed ? actor.user_id : null,
            completed_by_user_name: completed ? actor.user_name : '',
            completed_by_user_role: completed ? actor.role : '',
            reason_or_notes: completed ? reason : '', version: nextVersion,
            depends_on_stage2_fingerprint: text(post.upstream?.stage2_fingerprint) };
        const previousStage1Version = Number(sliceAttestation
            ? currentSlice.version || 0 : current.stage1.version || 0);
        const newStage1Effective = text(post.upstream?.stage1_current_fingerprint ||
            post.upstream?.stage1_fingerprint);
        if (!newStage1Effective) fail('STAGE3_POST_WRITE_FINGERPRINT_MISSING',
            'Δεν υπολογίστηκε το νέο authoritative Stage-1 fingerprint.', 409);
        let rebasedStage1;
        if (sliceAttestation) {
            const nextSlice = { ...currentSlice,
                completion_fingerprint: text(currentSlice.completion_fingerprint),
                effective_fingerprint: newStage1Effective,
                version: previousStage1Version + 1 };
            rebasedStage1 = { ...current.stage1,
                period_slices: (current.stage1.period_slices || []).map((item) =>
                    periodSliceKey(item) === periodSliceKey(currentSlice) ? nextSlice : item),
                version: Number(current.stage1.version || 1) + 1 };
        } else {
            rebasedStage1 = { ...current.stage1,
                completion_fingerprint: text(current.stage1.completion_fingerprint),
                effective_fingerprint: newStage1Effective,
                version: previousStage1Version + 1 };
        }
        const stage3VersionFilter = current.stage3
            ? { 'stage3.version': expectedStage3Version }
            : { 'stage3.version': { $exists: false } };
        const finalFilter = { ...stateFilter,
            'stage1.version': Number(current.stage1.version || 0),
            ...stage3VersionFilter
        };
        const update = await stateModel.collection.updateOne(finalFilter,
            { $set: { stage1: rebasedStage1, stage3: nextStage } }, { session });
        if (Number(update?.matchedCount ?? update?.n ?? 0) !== 1) {
            fail('STAGE3_VERSION_CONFLICT',
                'Η έκδοση του Stage 3 άλλαξε πριν από την αποθήκευση.', 409);
        }
        const beforeStage = { status: previousStage.status || 'OPEN',
            completion_fingerprint: text(previousStage.completion_fingerprint),
            version: Number(previousStage.version || 0) };
        const afterStage = { status: nextStage.status,
            completion_fingerprint: completedFingerprint, version: nextVersion };
        const auditDocument = { ...fresh.scope, workflow_version: WORKFLOW_VERSION,
            stage: 'STAGE3', action: ACTION, stage_version: nextVersion,
            input_fingerprint: initialFingerprint,
            previous_completion_fingerprint: beforeStage.completion_fingerprint,
            new_completion_fingerprint: completedFingerprint,
            before_stage: beforeStage, after_stage: afterStage,
            performed_at: performedAt, performed_by_user_id: actor.user_id,
            performed_by_user_name: actor.user_name, performed_by_user_role: actor.role,
            reason_or_notes: reason, request_id: requestId, command_identity: identity,
            decision_date: fresh.row.hmeromhnia, prodhlomena_oraria_id: fresh.row._id,
            previous_residual_status: 'PENDING',
            previous_classification: positiveClassification(fresh.row) || 'UNCLASSIFIED',
            final_classification: finalClassification,
            period_control_version: Number(envelope.period_control_version || 0),
            period_write_fence_version: Number(envelope.period_write_fence_version || 0),
            previous_stage1_effective_fingerprint: previousStage1Effective,
            new_stage1_effective_fingerprint: newStage1Effective,
            previous_stage1_version: previousStage1Version,
            new_stage1_version: previousStage1Version + 1,
            ...(sliceAttestation ? { period_start: currentSlice.period_start,
                period_end: currentSlice.period_end } : {}) };
        try {
            await auditModel.create([auditDocument], { session });
        } catch (error) {
            if (error?.code === 11000) fail('STAGE3_REQUEST_RACE_CONFLICT',
                'Το request_id καταχωρίστηκε ταυτόχρονα. Επαναλάβετε την ανάγνωση.', 409);
            throw error;
        }
        return { resolved: true, idempotent: false, stage3_status: nextStage.status,
            stage3_version: nextVersion, completion_fingerprint: completedFingerprint,
            remaining_count: (post.remaining_dates || []).length };
    });
}

module.exports = { ACTION, WORKFLOW_VERSION, stage3CommandIdentity,
    completionFingerprint, assertDecisionAllowed, resolveWeeklyHrStage3Day };
