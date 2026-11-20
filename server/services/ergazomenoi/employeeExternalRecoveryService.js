'use strict';
const mongoose = require('mongoose');
const D = require('./employeeHistoryDeferralService');
const Evidence = require('./employeeExternalRecoveryEvidence');
const SaveState = require('../../utils/ergazomenoi/employeeSaveState');
const { ErgazomenoiModel, ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const TYPES = ['E3N', 'E5N', 'E6N', 'E7N', 'MA', 'WTO'];
const PREFIX = 'EMPLOYEE_EXTERNAL_RECOVERY_';
function failure(reason, statusCode = 409) {
    const code = PREFIX + reason;
    const detail = reason === 'FORBIDDEN' ? 'Δεν επιβεβαιώθηκε πρόσβαση στη συγκεκριμένη αποθηκευμένη ενέργεια.' :
        reason === 'STALE' ? 'Τα στοιχεία ή η κατάσταση της υποβολής άλλαξαν μετά τον τελευταίο έλεγχο.' :
        reason === 'INVALID_REQUEST' ? 'Το αίτημα ελέγχου περιλαμβάνει μη αποδεκτά στοιχεία.' :
        'Δεν επιβεβαιώθηκε η καταγραφή του ελέγχου. Η κατάστασή του μπορεί να έχει αποθηκευτεί.';
    return Object.assign(new Error(`Ο έλεγχος της υποβολής σταμάτησε. ${detail} ` +
        (reason === 'CHECK_UNCERTAIN' ? '' : 'Δεν αποθηκεύτηκε αλλαγή από αυτόν τον έλεγχο. ') +
        'Δεν έγινε νέα αποστολή ούτε αλλαγή στο Ιστορικό.\n' +
        '1. Ανοίξτε ξανά τον εργαζόμενο και ελέγξτε την κατάσταση της υποβολής.\n' +
        '2. Ελέγξτε το πρωτόκολλο στο ΕΡΓΑΝΗ και επικοινωνήστε με την τεχνική υποστήριξη.\n' +
        `Κωδικός αναφοράς: ${code}.`), { code, statusCode });
}
const token = (current, record, action) => D.digest({ version: 'employee-external-recovery:v1',
    employee: SaveState.employeeStateToken(current), recordKey: record.key,
    actor: record.actorUserId, parameters: record.parameters, profileFingerprint: record.profileFingerprint, action });
function publicState(current, record, action) {
    return { key: record.key, type: action.type, status: action.status,
        expectedStateToken: token(current, record, action), attemptId: action.attempt?.id || null,
        identity: action.attempt?.identity || null, retryAllowed: false, historyUpdated: false,
        capabilities: { providerOutcomeSearch: 'BLOCKED', nonDispatchVerification: 'BLOCKED', uncertainRetry: 'BLOCKED' } };
}
async function run({ scope, employeeId, actorUserId, key, type, recover = false, expectedStateToken,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel, submissionModel = ErgazomenoiErganhModel,
    capabilityProbe, userModel, privilegeModel } = {}) {
    const W = require('./employeeEmploymentProfileWriter');
    if (!TYPES.includes(type) || typeof key !== 'string' || !key || key.length > 128 ||
        recover && (typeof expectedStateToken !== 'string' || !/^[a-f0-9]{64}$/.test(expectedStateToken)))
        throw failure('INVALID_REQUEST', 400);
    return W.inProfileTransaction(connection, capabilityProbe || W.transactionCapability, async session => {
        const current = await employeeModel.findOne({ ...scope, _id: employeeId })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        await authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current, session, userModel, privilegeModel });
        if (recover) await W.acquireEmployeeMutationFence({ filter: scope, employeeId, employeeModel, session });
        const ledger = structuredClone(current[D.ACTIONS] || []);
        const record = ledger.find(item => item.key === key && item.actorUserId === String(actorUserId));
        const action = record?.actions?.find(item => item.type === type);
        if (!action) throw failure('FORBIDDEN', 403);
        if (!recover) return { success: true, externalStatus: 'INSPECTED', ...publicState(current, record, action) };
        if (token(current, record, action) !== expectedStateToken || !['RUNNING', 'UNKNOWN'].includes(action.status))
            throw failure('STALE');
        // Read provider logs inside the same transaction as the auditable result.
        // Legacy attempts without durable correlation cannot be inferred by date.
        const logs = action.attempt?.id ? await submissionModel.find({ team: scope.team,
            companykod_object: scope.company_kod, ergazomenos_object: employeeId,
            request_id: action.attempt.id }).session(session).lean() : [];
        const result = Evidence.verify(action.attempt, logs);
        const beforeStatus = action.status;
        if (result.verified) {
            action.status = 'SUCCEEDED'; action.completedAt = new Date();
            action.result = { success: true, protocol: result.receipt.protocol,
                submissionId: result.receipt.id, submitDate: result.receipt.submitDate,
                recovered: true, evidence: result.evidence };
        }
        (action.recoveryAudit ||= []).push({ id: require('node:crypto').randomUUID(), at: new Date(),
            actorUserId: String(actorUserId), beforeStatus, afterStatus: action.status,
            expectedStateToken, attemptId: action.attempt?.id || null,
            identityDigest: action.attempt?.identityDigest || null, outcome: result.verified ? 'SUCCEEDED' : 'BLOCKED',
            reason: result.reason, evidence: result.evidence || null, retryAllowed: false });
        const saved = await employeeModel.updateOne({ ...scope, _id: employeeId },
            { $set: { [D.ACTIONS]: ledger } }, { session, timestamps: false, runValidators: true });
        if (saved.matchedCount !== 1) throw failure('STALE');
        return { success: result.verified, externalStatus: result.verified ? 'RECOVERED' : 'BLOCKED',
            reason: result.reason, ...publicState({ ...current, [D.ACTIONS]: ledger }, record, action),
            message: result.verified ?
                'Η υποβολή επιβεβαιώθηκε από την καταγεγραμμένη απάντηση του ΕΡΓΑΝΗ. Αποθηκεύτηκε η επιβεβαίωση και η καταγραφή του ελέγχου. Δεν έγινε νέα αποστολή ούτε αλλαγή στο Ιστορικό.' :
                'Δεν επιβεβαιώθηκε με ασφάλεια το αποτέλεσμα της υποβολής. Η επανάληψη αποκλείστηκε για να μη δημιουργηθεί διπλή υποβολή. ' +
                'Αποθηκεύτηκε μόνο η καταγραφή του ελέγχου. Ο εργαζόμενος παραμένει αποθηκευμένος και το Ιστορικό αμετάβλητο.\n' +
                '1. Ελέγξτε την υποβολή και το πρωτόκολλο στο ΕΡΓΑΝΗ.\n' +
                '2. Ζητήστε από την τεχνική υποστήριξη επαλήθευση της συγκεκριμένης προσπάθειας πριν από οποιαδήποτε νέα υποβολή.\n' +
                `Κωδικός αναφοράς: ${PREFIX}${result.reason}.` };
    });
}
function handler(recover, dependencies = {}) {
    return async (req, res) => {
        try {
            const body = req.body || {};
            if (!mongoose.isValidObjectId(req.params?.employeeId)) throw failure('INVALID_REQUEST', 400);
            if (Object.keys(body).some(key => !recover || key !== 'expectedStateToken')) throw failure('INVALID_REQUEST', 400);
            const scope = { team: req.session?.userTeam, company_kod: req.session?.companyInUse };
            const employeeModel = dependencies.employeeModel || ErgazomenoiModel;
            const current = await employeeModel.findOne({ ...scope, _id: req.params.employeeId }).lean();
            if (!current) throw failure('FORBIDDEN', 403);
            const result = await run({ ...dependencies, scope: { ...scope, kodikos: current.kodikos },
                employeeId: String(current._id), actorUserId: req.session?.userId,
                key: req.params.key, type: req.params.type, recover, expectedStateToken: body.expectedStateToken });
            return res.status(result.externalStatus === 'BLOCKED' ? 409 : 200).json(result);
        } catch (error) {
            if (error.code === 'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN') error = failure('FORBIDDEN', 403);
            if (!String(error.code).startsWith(PREFIX)) error = failure('CHECK_UNCERTAIN', 503);
            return res.status(error.statusCode || 409).json({ success: false, externalStatus: 'BLOCKED',
                retryAllowed: false, historyUpdated: false, reason: error.code, message: error.message });
        }
    };
}
module.exports = { run, handler };
