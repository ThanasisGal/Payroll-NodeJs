'use strict';
const mongoose = require('mongoose');
const D = require('./employeeHistoryDeferralService');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const Recovery = require('./employeeExternalRecoveryEvidence');

// A durable claim precedes dispatch. An uncertain result is never automatically
// retried: a failed acknowledgement cannot prove that ERGANI did not accept it.
async function updateAction({ scope, employeeId, actorUserId, key, type, outcome = null,
    documents = null, actionRequest = null, attemptId = null, providerRequest = null,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    userModel, privilegeModel, capabilityProbe } = {}) {
    const W = require('./employeeEmploymentProfileWriter');
    return W.inProfileTransaction(connection, capabilityProbe || W.transactionCapability, async session => {
        await W.acquireEmployeeMutationFence({ filter: scope, employeeId, employeeModel, session });
        const current = await employeeModel.findOne({ ...scope, _id: employeeId })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        await authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current, session, userModel, privilegeModel });
        const ledger = structuredClone(current[D.ACTIONS] || []);
        const record = ledger.find(item => item.key === key && item.actorUserId === String(actorUserId));
        const action = record?.actions.find(item => item.type === type);
        if (!record || !documents && !action) throw D.failure('ACTION_FORBIDDEN', 'Η υποβολή δεν αντιστοιχεί σε επιλεγμένη ενέργεια του αποθηκευμένου εργαζομένου.', 403);
        if (documents) {
            if (record.documents?.status !== 'PREPARING') throw D.failure('ACTION_STALE', 'Η παραγωγή των επιλεγμένων εγγράφων έχει ήδη καταγραφεί.');
            record.documents = { status: documents.some(item => item.success === false) ? 'PARTIAL_FAILURE' : 'COMPLETED',
                completedAt: new Date(), results: documents };
        } else if (providerRequest) {
            if (action.status !== 'RUNNING' || !attemptId || action.attempt?.id !== attemptId || action.attempt.request ||
                record.profileFingerprint !== D.digest(D.businessState(current)) ||
                action.attempt.identityDigest !== D.digest(Recovery.identity(record, current, type)))
                throw D.failure('ACTION_STALE', 'Δεν επιβεβαιώθηκε η ίδια ενεργή προσπάθεια πριν από την αποστολή.');
            if (providerRequest.environment !== action.attempt.identity.environment ||
                providerRequest.submissionCode !== Recovery.submissionCode(type, record.parameters) ||
                !/^[a-f0-9]{64}$/.test(providerRequest.payloadFingerprint))
                throw D.failure('ACTION_PROPOSAL_CHANGED', 'Η αποστολή διαφέρει από την αποθηκευμένη επιλογή.');
            action.attempt.request = { ...providerRequest, boundAt: new Date() };
        } else if (!outcome) {
            if (record.profileFingerprint !== D.digest(D.businessState(current)))
                throw D.failure('ACTION_STALE', 'Οι όροι του εργαζομένου άλλαξαν μετά την επιλογή της υποβολής.');
            if (!['SELECTED', 'FAILED_BEFORE_DISPATCH'].includes(action.status))
                throw D.failure('ACTION_RECONCILIATION_REQUIRED',
                    'Η συγκεκριμένη υποβολή εκτελέστηκε ήδη ή το αποτέλεσμά της χρειάζεται έλεγχο. Δεν έγινε δεύτερη υποβολή.');
            if (actionRequest) assertActionRequestMatches(record, type, actionRequest);
            // A second selection/key must not bypass a prior uncertain attempt.
            for (const prior of ledger.filter(item => item !== record)) {
                if (!prior.actions?.some(item => item.type === type && item.status !== 'SELECTED')) continue;
                const match = sameExternalEvent(prior, current, type, {
                    hmeromhnia_metabolhs: record.parameters?.mutationDate });
                if (match === null) throw D.failure('ACTION_IDENTITY_UNCERTAIN',
                    'Δεν έχει εξακριβωθεί η ημερομηνία προηγούμενης μεταβολής. Απαιτείται έλεγχος πριν από νέα υποβολή.');
                if (match) throw D.failure('ACTION_RECONCILIATION_REQUIRED',
                    'Υπάρχει ήδη καταγεγραμμένη προσπάθεια για την ίδια υποβολή. Δεν έγινε δεύτερη αποστολή.');
            }
            action.status = 'RUNNING'; action.startedAt = new Date();
            if (action.attempt) (action.previousAttempts ||= []).push(structuredClone(action.attempt));
            const identity = Recovery.identity(record, current, type);
            action.attempt = { id: require('node:crypto').randomUUID(), identity,
                identityDigest: D.digest(identity), createdAt: new Date() };
        } else {
            if (action.status !== 'RUNNING' || attemptId && action.attempt?.id !== attemptId)
                throw D.failure('ACTION_STALE', 'Η κατάσταση της συγκεκριμένης υποβολής άλλαξε.');
            action.status = outcome.success === true ? 'SUCCEEDED' :
                outcome.submissionAttempted === false && !action.attempt?.request ? 'FAILED_BEFORE_DISPATCH' : 'UNKNOWN';
            action.completedAt = new Date();
            action.result = { success: outcome.success === true, protocol: outcome.protocol || null,
                submissionId: outcome.erganhSubmissionId || null, httpStatus: outcome.httpStatus };
        }
        const saved = await employeeModel.updateOne({ ...scope, _id: employeeId }, { $set: { [D.ACTIONS]: ledger } },
            { session, timestamps: false, runValidators: true });
        if (saved.matchedCount !== 1) throw D.failure('ACTION_STALE', 'Δεν επιβεβαιώθηκε η καταγραφή της υποβολής.');
        return { type, key, status: documents ? record.documents.status : action.status,
            ...(action?.attempt ? { attemptId: action.attempt.id } : {}) };
    });
}

function guardDeferredExternalAction(type, dependencies = {}) {
    return async (req, res, next) => {
        let current = null;
        try {
            const id = req.body?.ergazomenosId || req.body?.employeeId || req.body?.id || req.body?.kodikos;
            const employeeModel = dependencies.employeeModel || ErgazomenoiModel;
            const filter = { team: req.session?.userTeam, company_kod: req.session?.companyInUse,
                ...(mongoose.isValidObjectId(id) ? { _id: id } : { kodikos: String(id || '') }) };
            current = await employeeModel.findOne(filter).lean();
            const processCode = String(req.body?.processCode || '').replace(/^ma_/, '');
            const actualType = type === 'MA_XML' ? ({ '217': 'E5N', '222': 'E7N', '220': 'E6N', '221': 'E6N' }[processCode] || 'MA') : type;
            const key = req.get?.('X-Employee-History-Action') || req.headers?.['x-employee-history-action'];
            if (!current) throw D.failure('ACTION_FORBIDDEN', 'Δεν βρέθηκε ο εργαζόμενος στην επιλεγμένη εταιρεία.', 403);
            const previous = (current[D.ACTIONS] || []).filter(record =>
                record.actions?.some(action => action.type === actualType));
            const uncertainIdentity = previous.some(record => record.key !== key &&
                record.actions.some(action => action.type === actualType && action.status !== 'SELECTED') &&
                sameExternalEvent(record, current, actualType, req.body || {}) === null);
            if (uncertainIdentity) throw D.failure('ACTION_IDENTITY_UNCERTAIN',
                'Δεν έχει εξακριβωθεί η ημερομηνία προηγούμενης μεταβολής. Απαιτείται έλεγχος πριν από νέα υποβολή.');
            if (!current[D.FIELD] && !key && !previous.some(record =>
                sameExternalEvent(record, current, actualType, req.body || {}) !== false)) return next();
            const options = { ...dependencies, scope: { team: current.team, company_kod: current.company_kod, kodikos: current.kodikos },
                employeeId: String(current._id), actorUserId: req.session?.userId, key, type: actualType,
                actionRequest: { body: req.body || {}, xml: isXmlActionRequest(req.path || req.originalUrl || '', actualType, req.body || {}) } };
            const claim = await updateAction(options);
            options.attemptId = claim.attemptId;
            // Server-owned context only; never sourced from request body/headers.
            // The uploader binds the exact payload before POST /Documents.
            req.employeeExternalAction = { attemptId: claim.attemptId,
                async bindRequest({ submissionCode, environment, payload }) {
                    const payloadFingerprint = D.digest(payload);
                    await updateAction({ ...options, providerRequest: { submissionCode, environment, payloadFingerprint } });
                    this.payloadFingerprint = payloadFingerprint;
                } };
            const send = res.json.bind(res);
            // Persist the external result before acknowledging it to the browser.
            // A crash, disconnect or failed persistence leaves RUNNING (blocked).
            res.json = body => {
                res.json = send;
                return updateAction({ ...options, outcome: { ...body, httpStatus: res.statusCode,
                    success: res.statusCode < 400 && body?.success === true } }).then(state =>
                    send({ ...body, deferredExternalAction: state }), () =>
                    res.status(503).json({ success: false, employeeUpdated: true, historyDeferred: Boolean(current[D.FIELD]),
                        message: 'Ο εργαζόμενος παραμένει αποθηκευμένος. Το αποτέλεσμα της υποβολής δεν επιβεβαιώθηκε. ' +
                            '1. Ελέγξτε το πρωτόκολλο στο ΕΡΓΑΝΗ. 2. Ζητήστε συμφιλίωση πριν από νέα προσπάθεια. Κωδικός αναφοράς: EXTERNAL_RESULT_UNCERTAIN.' }));
            };
            return next();
        } catch (error) {
            if (String(error?.code).startsWith('EMPLOYEE_HISTORY_DEFER_')) return res.status(error.statusCode || 409).json({
                success: false, employeeUpdated: Boolean(current), historyDeferred: Boolean(current?.[D.FIELD]),
                reason: error.code, externalStatus: 'BLOCKED',
                message: (current ? 'Ο εργαζόμενος παραμένει αποθηκευμένος. ' : '') + error.message });
            return res.status(503).json({ success: false,
                message: 'Η υποβολή δεν ξεκίνησε επειδή δεν επιβεβαιώθηκε η επιλεγμένη ενέργεια. Ο εργαζόμενος παραμένει αποθηκευμένος. ' +
                    '1. Ελέγξτε την προηγούμενη υποβολή. 2. Ζητήστε έλεγχο πριν επαναλάβετε. Κωδικός αναφοράς: EXTERNAL_ACTION_CHECK_FAILED.' });
        }
    };
}
// E6N XML uses the submit-e6n endpoint, not an /upload-* endpoint.
// The request method remains part of the state-bound selection; never infer
// XML from a client-supplied method on another route.
function isXmlActionRequest(route, type, body = {}) {
    const path = String(route || '').split('?')[0];
    return /\/upload-/.test(path) ||
        (type === 'E6N' && /\/submit-e6n-to-erganh\/?$/.test(path) &&
            body.erganiUploadMethod === 'xml');
}
function sameExternalEvent(record, current, type, body) {
    const parameters = record.parameters;
    if (!parameters) return null; // Unknown identification requires reconciliation.
    const C = require('../../utils/ergazomenoi/employmentProfileContract');
    const day = value => { try { return C.calendarDate(value)?.toISOString().slice(0,10) || null; } catch { return null; } };
    const originalHire = day(parameters.hire), currentHire = day(current.hmeromhnia_proslhpshs);
    if (!originalHire || !currentHire) return null;
    if (originalHire !== currentHire) return false;
    if (['E5N','E6N','E7N'].includes(type)) {
        const before = day(parameters.departure), after = day(current.hmeromhnia_apoxorhshs);
        return before && after ? before === after : null;
    }
    if (type === 'MA') {
        if (!parameters.mutationDate || !body.hmeromhnia_metabolhs) return null;
        try {
            const before = day(parameters.mutationDate), after = day(body.hmeromhnia_metabolhs);
            return before && after ? before === after : null;
        }
        catch { return null; }
    }
    if (type === 'WTO') {
        const before = day(parameters.scheduleFrom), after = day(current.hmeromhnia_allaghs_orarioy_apo);
        if (!before || !after) return null;
        if (before !== after) return false;
        const beforeUntil = day(parameters.scheduleUntil), afterUntil = day(current.hmeromhnia_allaghs_orarioy_eos);
        return beforeUntil && afterUntil ? beforeUntil === afterUntil : null;
    }
    return true;
}
function assertActionRequestMatches(record, type, { body, xml }) {
    const fail = () => { throw D.failure('ACTION_PROPOSAL_CHANGED', 'Η υποβολή διαφέρει από την επιλεγμένη ενέργεια του αποθηκευμένου εργαζομένου.'); };
    const parameters = record.parameters;
    if (!parameters) fail();
    const allowed = new Set(['ergazomenosId', 'employeeId', 'id', 'kodikos', 'ypokatasthma', 'processCode',
        'submissionCode', 'erganiUploadMethod', 'hmeromhnia_metabolhs', 's3Url', 'isPermanent']);
    if (Object.keys(body).some(field => !allowed.has(field))) fail();
    if (body.ypokatasthma != null && String(body.ypokatasthma) !== parameters.branch) fail();
    if (body.processCode != null && String(body.processCode).replace(/^ma_/, '') !== parameters.processCode) fail();
    if (type === 'E6N' && body.submissionCode != null && body.submissionCode !==
        (parameters.processCode === '221' ? 'WebE6NMP' : 'WebE6NXP')) fail();
    if (type === 'MA' && (body.hmeromhnia_metabolhs || null) !== parameters.mutationDate) fail();
    if (xml !== (parameters.method === 'xml') || body.erganiUploadMethod && body.erganiUploadMethod !== parameters.method) fail();
    if (xml && body.s3Url) {
        const artifact = record.documents?.results.find(item => item.type === (type === 'E3N' ? 'E3_XML' : type === 'WTO' ? 'WTO_XML' : 'MA_XML'));
        if (!artifact?.success || !artifact.locations?.includes(body.s3Url)) fail();
    }
}
module.exports = { updateAction, guardDeferredExternalAction, assertActionRequestMatches, isXmlActionRequest, sameExternalEvent };
