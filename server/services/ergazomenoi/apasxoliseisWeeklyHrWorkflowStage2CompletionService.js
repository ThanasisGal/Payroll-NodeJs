'use strict';

const crypto = require('crypto');
const StateModel = require('../../models/apasxoliseisWeeklyHrWorkflowState');
const AuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { assertCriticalEmploymentDecisionRole } = require(
    './apasxoliseisCriticalActionAuthorizationService'
);
const { stableStringify } = require('./apasxoliseisStage3FingerprintService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { normalizeEmploymentType } = require('./apasxoliseisReviewEmploymentProfileService');
const { writeCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService'
);

const ACTION = 'STAGE2_COMPLETED';
const WORKFLOW_VERSION = 'weekly-hr-workflow:v1';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,99}$/;
const CLASSIFICATIONS = new Set(['REST_REPO', 'NON_WORK']);

function fail(code, message, statusCode = 400) {
    throw Object.assign(new Error(message), { code, statusCode });
}
function text(value, max = Infinity) { return String(value ?? '').trim().slice(0, max); }
function stage2Items(context = {}) {
    return context.lifecycle?.stages?.stage3?.stage2_automatic_resolution_items || [];
}
function normalizeItems(context = {}) {
    const rows = new Map((context.rows || []).map((row) => [dateKeyUtc(row.hmeromhnia), row]));
    const stage3Pending = new Set(context.lifecycle?.stages?.stage3?.pending_dates || []);
    return stage2Items(context).map((item) => {
        const date = dateKeyUtc(item.date);
        const classification = text(item.classification).toUpperCase();
        const row = rows.get(date);
        if (!date || !row || !CLASSIFICATIONS.has(classification)) {
            fail('STAGE2_UNSAFE_RESOLUTION_ITEM',
                'Το Stage 2 επέστρεψε μη ασφαλές automatic resolution.', 409);
        }
        if (stage3Pending.has(date)) fail('STAGE2_DATE_MOVED_TO_STAGE3',
            'Η ημέρα αποτελεί πλέον εκκρεμότητα του Stage 3.', 409);
        const dailyProfile = context.effectiveProfilesByDate?.[date];
        const employmentType = normalizeEmploymentType(
            dailyProfile?.kathestos_apasxolhshs ?? dailyProfile?.typos_apasxolhshs
        );
        if ((classification === 'REST_REPO' && employmentType !== '0') ||
            (classification === 'NON_WORK' && !['1', '2'].includes(employmentType))) {
            fail('STAGE2_DAILY_PROFILE_CHANGED',
                'Το ημερομηνιακά ισχύον καθεστώς απασχόλησης άλλαξε.', 409);
        }
        const facts = resolveDailyActualWorkFacts(row);
        if (facts.countsAsActualWorkDay === true || Number(facts.cardHours || 0) > 0 ||
            (facts.completeCardPairNumbers || []).length ||
            (facts.unresolvedCardPairNumbers || []).length || (facts.reasons || []).length) {
            fail('STAGE2_ACTUAL_WORK_OR_CARD_EVIDENCE',
                'Υπάρχει πραγματική εργασία ή μη ασφαλές στοιχείο κάρτας.', 409);
        }
        const current = { apologistiko_biblio: row.apologistiko_biblio ?? false,
            repo_apologistika: row.repo_apologistika ?? false,
            kathgoria_ergasias_apologistika:
                text(row.kathgoria_ergasias_apologistika),
            kathgoria_adeias_apologistika:
                text(row.kathgoria_adeias_apologistika),
            adeia_apologistika: row.adeia_apologistika ?? false,
            astheneia_apologistika: row.astheneia_apologistika ?? false,
            apousia_apologistika: row.apousia_apologistika ?? null,
            ores_ergasias_apologistika: Number(row.ores_ergasias_apologistika || 0) };
        const expected = { apologistiko_biblio: false, repo_apologistika: false,
            kathgoria_ergasias_apologistika: '',
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
            adeia_apologistika: false, astheneia_apologistika: false,
            apousia_apologistika: null, ores_ergasias_apologistika: 0 };
        if (stableStringify(current) !== stableStringify(expected)) {
            fail('STAGE2_CANONICAL_ROW_CHANGED',
                'Η canonical ημερήσια εγγραφή έχει ήδη αλλάξει.', 409);
        }
        return { date, classification, row, employmentType,
            profileSignature: stableStringify(dailyProfile || {}) };
    }).sort((left, right) => left.date.localeCompare(right.date));
}
function fingerprint(context, items) {
    return crypto.createHash('sha256').update(stableStringify({
        contract: 'weekly-hr-stage2-materialization:v1',
        scope: { employee_id: String(context.scope.employee_id),
            week_start: dateKeyUtc(context.scope.week_start),
            week_end: dateKeyUtc(context.scope.week_end) },
        stage1_fingerprint: text(context.upstream?.stage1_current_fingerprint),
        items: items.map((item) => ({ date: item.date,
            classification: item.classification, row_id: String(item.row._id),
            employment_type: item.employmentType,
            date_effective_profile: item.profileSignature }))
    })).digest('hex');
}
function normalizeActor(actor = {}) {
    const role = assertCriticalEmploymentDecisionRole({ userRole: actor.role });
    const userId = text(actor.user_id || actor.userId);
    const userName = text(actor.user_name || actor.userName, 150);
    if (!userId || !userName) fail('INVALID_STAGE2_ACTOR', 'Μη έγκυρα στοιχεία χρήστη.');
    return { user_id: userId, user_name: userName, role };
}
function querySession(query, session) {
    return session && query?.session ? query.session(session) : query;
}

async function completeWeeklyHrWorkflowStage2({ initialContext, actor: rawActor,
    reason_or_notes, request_id, transactionRunner, loadFreshContext, loadPostWriteContext,
    writeDaily = writeCanonicalDailyClassification, stateModel = StateModel,
    auditModel = AuditModel, now = () => new Date() } = {}) {
    if (!initialContext?.scope || typeof transactionRunner !== 'function' ||
        typeof loadFreshContext !== 'function' || typeof loadPostWriteContext !== 'function') {
        fail('STAGE2_SAFE_COMMAND_UNAVAILABLE', 'Δεν είναι διαθέσιμη ασφαλής ολοκλήρωση Stage 2.', 503);
    }
    const actor = normalizeActor(rawActor);
    const reason = text(reason_or_notes, 2001);
    const requestId = text(request_id, 101);
    if (!reason || reason.length > 2000) fail('STAGE2_REASON_REQUIRED',
        'Η αιτιολογία είναι υποχρεωτική και έως 2000 χαρακτήρες.');
    if (!REQUEST_ID_PATTERN.test(requestId)) fail('INVALID_REQUEST_ID', 'Μη έγκυρο request_id.');
    const initialItems = normalizeItems(initialContext);
    if (!initialItems.length) return { completed: false, idempotent: true,
        materialized_count: 0 };
    const initialFingerprint = fingerprint(initialContext, initialItems);
    const identity = crypto.createHash('sha256').update(stableStringify({
        action: ACTION, request_id: requestId, fingerprint: initialFingerprint,
        actor: String(actor.user_id) })).digest('hex');

    return transactionRunner(async (transactionValue) => {
        const session = transactionValue?.session || transactionValue;
        if (!session) fail('STAGE2_TRANSACTION_REQUIRED', 'Απαιτείται ενεργή συναλλαγή.', 503);
        const prior = await querySession(auditModel.findOne({ team: initialContext.scope.team,
            company_kod: initialContext.scope.company_kod, request_id: requestId }), session).lean();
        if (prior) {
            if (prior.command_identity !== identity) fail('STAGE2_REQUEST_ID_CONFLICT',
                'Το request_id έχει ήδη χρησιμοποιηθεί για διαφορετική εντολή.', 409);
            return { completed: true, idempotent: true,
                materialized_count: prior.stage2_resolution_items?.length || 0 };
        }
        const fresh = await loadFreshContext({ session });
        const items = normalizeItems(fresh);
        if (fingerprint(fresh, items) !== initialFingerprint) fail('STAGE2_INPUT_CHANGED',
            'Τα authoritative δεδομένα του Stage 2 άλλαξαν.', 409);
        const filter = { team: fresh.scope.team, company_kod: fresh.scope.company_kod,
            ypokatasthma: fresh.scope.ypokatasthma, employee_id: fresh.scope.employee_id,
            week_start: fresh.scope.week_start, week_end: fresh.scope.week_end };
        const current = await querySession(stateModel.findOne(filter), session).lean();
        if (!current?.stage1 || current.stage1.status !== 'COMPLETED' ||
            text(current.stage1.effective_fingerprint || current.stage1.completion_fingerprint) !==
                text(fresh.upstream?.stage1_current_fingerprint)) {
            fail('STAGE2_UPSTREAM_STAGE1_STALE', 'Το Stage 1 δεν είναι authoritative.', 409);
        }
        const previous = current.stage2 || { status: 'OPEN', completion_fingerprint: '', version: 0 };
        for (const item of items) await writeDaily({ row: { ...item.row,
            team: fresh.scope.team, company_kod: fresh.scope.company_kod },
        classification: item.classification, reason, actor_name: actor.user_name, session });
        const post = await loadPostWriteContext({ session });
        if (stage2Items(post).length) fail('STAGE2_MATERIALIZATION_INCOMPLETE',
            'Η canonical materialization δεν έκλεισε όλες τις Stage-2 επιλύσεις.', 409);
        const postStage1Fingerprint = text(post.upstream?.stage1_current_fingerprint);
        if (!postStage1Fingerprint) fail('STAGE2_POST_WRITE_FINGERPRINT_MISSING',
            'Δεν υπολογίστηκε το post-write fingerprint.', 409);
        const performedAt = now();
        const nextVersion = Number(previous.version || 0) + 1;
        const nextStage = { status: 'COMPLETED', completion_fingerprint: initialFingerprint,
            depends_on_stage1_fingerprint: postStage1Fingerprint,
            completed_at: performedAt, completed_by_user_id: actor.user_id,
            completed_by_user_name: actor.user_name, completed_by_user_role: actor.role,
            reason_or_notes: reason, version: nextVersion };
        const rebasedStage1 = { ...current.stage1, effective_fingerprint: postStage1Fingerprint,
            version: Number(current.stage1.version || 0) + 1 };
        const stage2Filter = current.stage2 ? { 'stage2.version': Number(previous.version || 0) }
            : { 'stage2.version': { $exists: false } };
        const update = await stateModel.collection.updateOne({ ...filter,
            'stage1.version': Number(current.stage1.version || 0), ...stage2Filter },
        { $set: { stage1: rebasedStage1, stage2: nextStage } }, { session });
        if (Number(update?.matchedCount ?? update?.n ?? 0) !== 1) fail('STAGE2_VERSION_CONFLICT',
            'Το weekly state άλλαξε πριν από την ολοκλήρωση.', 409);
        await auditModel.create([{ ...fresh.scope, workflow_version: WORKFLOW_VERSION,
            stage: 'STAGE2', action: ACTION, stage_version: nextVersion,
            input_fingerprint: initialFingerprint,
            previous_completion_fingerprint: text(previous.completion_fingerprint),
            new_completion_fingerprint: initialFingerprint,
            before_stage: { status: previous.status || 'OPEN',
                completion_fingerprint: text(previous.completion_fingerprint),
                version: Number(previous.version || 0) },
            after_stage: { status: 'COMPLETED', completion_fingerprint: initialFingerprint,
                version: nextVersion }, performed_at: performedAt,
            performed_by_user_id: actor.user_id, performed_by_user_name: actor.user_name,
            performed_by_user_role: actor.role, reason_or_notes: reason,
            request_id: requestId,
            command_identity: identity,
            stage2_resolution_items: items.map((item) => ({
                prodhlomena_oraria_id: item.row._id,
                decision_date: new Date(`${item.date}T00:00:00.000Z`),
                classification: item.classification })) }], { session });
        return { completed: true, idempotent: false,
            materialized_count: items.length, completion_fingerprint: initialFingerprint };
    });
}

module.exports = { ACTION, normalizeItems, fingerprint, completeWeeklyHrWorkflowStage2 };
