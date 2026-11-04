'use strict';
// Standalone Admin. Preview is read-only; completion requires independent
// startup activation, a fresh explicit approval and an exact write capability.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const Security = require('../server/services/ergazomenoi/employeeHistoryIsolatedAdminSecurity');
const { createRecoveryApprovalStore } = require('../server/services/ergazomenoi/employeeHistoryRecoveryApprovalStore');
function failure(res, reason, status = 403, uncertain = false) {
    return res.status(status).json({ outcome: 'BLOCKED', reason,
        message: 'Ο έλεγχος αποκατάστασης σταμάτησε επειδή δεν επιβεβαιώθηκαν η πρόσβαση ή τα στοιχεία της συγκεκριμένης προσπάθειας. ' +
            (uncertain ? 'Παραμένει άγνωστο αν αποθηκεύτηκε η ολοκλήρωση. Δεν επιτρέπεται νέα εφαρμογή. ' : 'Δεν αποθηκεύτηκε καμία αλλαγή στη βάση δεδομένων από αυτό το αίτημα. ') + '\n1. Ελέγξτε ότι η υπάρχουσα σύνδεση είναι ενεργή στη σωστή εταιρεία.' +
            '\n2. Ζητήστε από τον διαχειριστή έλεγχο της απομονωμένης διαδικασίας πριν συνεχίσετε.' +
            '\nΚωδικός αναφοράς: ΙΣΤ-ΑΠΟΜ-01.' });
}
function installReadOnlyCommandGuard(mongoose) {
    return require('../server/services/ergazomenoi/employeeHistoryRecoveryWriteGuard').installRecoveryWriteGuard(mongoose).restore;
}

async function startIsolatedAdmin(config) {
    if (!config || config.previewEnabled !== true) throw Error('ISOLATED_PREVIEW_DISABLED');
    if (config.settlementEnabled) throw Error('RELEASE_GATE_INCOMPLETE');
    if (config.completionEnabled !== undefined && typeof config.completionEnabled !== 'boolean') throw Error('INVALID_COMPLETION_ACTIVATION');
    const origin = Security.validateAddress(config.origin);
    if (!path.isAbsolute(config.environmentFile || '') || !path.isAbsolute(config.approvalDirectory || ''))
        throw Error('ABSOLUTE_PRIVATE_PATHS_REQUIRED');
    const env = require('dotenv').parse(fs.readFileSync(config.environmentFile));
    const secret = env.SESSION_SECRET || env.SECRET;
    if (typeof secret !== 'string' || secret.length < 16) throw Error('SESSION_SECRET_REQUIRED');
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
    const guard = require('../server/services/ergazomenoi/employeeHistoryRecoveryWriteGuard').installRecoveryWriteGuard(mongoose);
    const restore = guard.restore;
    let server;
    try {
        await mongoose.connect(env.MONGODB_URL, { autoIndex: false, autoCreate: false, retryWrites: false,
            readPreference: 'primary', serverSelectionTimeoutMS: 6000, socketTimeoutMS: 15000 });
        const db = mongoose.connection.db;
        if (db.databaseName !== 'payrollDB') {
            require('../test/fixtures/employeeHistorySettlementMongoTarget').assertMongoConnection(mongoose.connection);
        } else if (config.reservationId !== '02a16c87311b4b076dacc96b') throw Error('EXACT_CASE_REQUIRED');
        const audit = require('../server/models/employeeHistoryRepairAudit');
        const reservation = await audit.findById(config.reservationId).read('primary').readConcern('majority').lean();
        if (reservation?.mutationSource !== 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE_ATTEMPT') throw Error('RESERVATION_REQUIRED');
        const { employee_id, ...scope } = reservation.employeeScope, z = reservation.diagnostics;
        const company = await db.collection('Companies').findOne({ _id: new mongoose.Types.ObjectId(scope.company_kod), team: scope.team },
            { readConcern: { level: 'majority' }, maxTimeMS: 5000 });
        if (!company || scope.team !== 'THA' || (db.databaseName === 'payrollDB' && company.kod !== '0004')) throw Error('COMPANY_CASE_MISMATCH');
        const binding = Object.freeze({ reservationId: String(reservation._id), scope, employeeId: String(employee_id),
            actorUserId: z.actorUserId, legacyAttemptId: z.legacyAttemptId, fingerprint: z.fingerprint, executionId: z.executionId });
        const verifier = require('../server/services/ergazomenoi/employeeHistoryIndependentFenceVerifier');
        const verificationOptions = { uri: env.MONGODB_URL, binding, directory: config.approvalDirectory,
            secret, repositoryRoot: path.resolve(__dirname, '..'),
            expectedHistoryCount: db.databaseName === 'payrollDB' ? 3 : config.expectedHistoryCount,
            expectedProtectedCount: db.databaseName === 'payrollDB' ? 26 : config.expectedProtectedCount,
            expectedPreviousSequence: db.databaseName === 'payrollDB' ? 2 : config.expectedPreviousSequence };
        const store = createRecoveryApprovalStore({ directory: config.approvalDirectory,
            repositoryRoot: path.resolve(__dirname, '..'), sessionSecret: secret });
        const express = require('express'), app = express();
        app.disable('x-powered-by');
        app.use((req, res, next) => {
            res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
            try { Security.validateRequestBoundary(req, config.origin); next(); }
            catch (error) { failure(res, error.reason || 'REQUEST_REJECTED'); }
        });
        app.use(express.json({ limit: '2kb', strict: true }));
        const activation = require('../server/services/ergazomenoi/employeeHistoryLegacyFenceActivation');
        const F = require('../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
        async function authenticate(req) {
            const identity = await Security.authenticateExistingSession({ req, db, secret, caseBinding: binding,
                timeoutMinutes: Number(env.DIARKEIA_SESSION || 60) });
            const context = activation.contextFor(req);
            if (!context?.legacyRecoveryIsolated) throw Error('ISOLATED_ACTIVATION_REQUIRED');
            const d = context.deps;
            const current = await d.employeeModel.findOne({ ...scope, _id: binding.employeeId }).lean();
            await require('../server/services/ergazomenoi/employeeMaintenanceAuthorizationService').authorizeEmployeeMaintenance({
                actorUserId: identity.session.userId, employeeId: binding.employeeId, scope, current, session: null,
                userModel: d.userModel, privilegeModel: d.privilegeModel });
            const access = await require('../server/services/ergazomenoi/employeeHistoryAuthorizationService')
                .getEmployeeHistoryAccess(identity.session.userId, { userModel: d.userModel, scope });
            if (access.mode !== 'ADMIN_FULL') throw Error('ADMIN_REQUIRED');
            return { identity, context };
        }
        app.get('/', async (req, res) => {
            try {
                await authenticate(req);
                const csrf = require('cookie').parse(req.headers.cookie || '')['psifl.x-csrf-token'];
                if (!/^[a-f0-9]{64}$/.test(csrf || '')) throw Error('EXISTING_CSRF_COOKIE_REQUIRED');
                const nonce = crypto.randomBytes(24).toString('base64');
                res.set('Content-Security-Policy', "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
                const completionButton = config.completionEnabled === true ?
                    '<button id="complete" disabled>Ξεχωριστή έγκριση ολοκλήρωσης</button>' : '';
                const pageScript = `let reviewed=null;const preview=document.getElementById('preview'),complete=document.getElementById('complete'),output=document.getElementById('result');
                    async function request(route,body){const r=await fetch(route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':${JSON.stringify(csrf)}},body:JSON.stringify(body)});return r.json()}
                    preview.onclick=async()=>{preview.disabled=true;try{reviewed=await request('/recovery-preview',{});output.textContent=JSON.stringify(reviewed,null,2);if(complete)complete.disabled=reviewed.outcome!=='RECOVERABLE'}catch{output.textContent='Ο έλεγχος δεν επιβεβαιώθηκε. Δεν αποθηκεύτηκε αλλαγή στη βάση. 1. Ελέγξτε τη σύνδεση. 2. Ζητήστε αναγνωστικό έλεγχο. Κωδικός: ΙΣΤ-ΑΠΟΜ-02.'}};
                    if(complete)complete.onclick=async()=>{if(!reviewed||reviewed.outcome!=='RECOVERABLE')return;
                        if(!confirm('Νέα ξεχωριστή έγκριση: ολοκλήρωση μόνο της καταγραφής '+${JSON.stringify(binding.reservationId)}+' με την ίδια ταυτότητα εκτέλεσης. Δεν γίνεται νέα τακτοποίηση. Η έγκριση καταναλώνεται μία φορά. Συνέχεια;'))return;
                        complete.disabled=true;preview.disabled=true;try{const result=await request('/recovery-complete',{approvalTicket:reviewed.approvalTicket,reservationId:${JSON.stringify(binding.reservationId)},executionId:${JSON.stringify(binding.executionId)},approvalConfirmed:true});output.textContent=JSON.stringify(result,null,2)}catch{output.textContent='Το αποτέλεσμα ολοκλήρωσης παραμένει άγνωστο. Δεν επιτρέπεται νέα εφαρμογή. 1. Μην επαναλάβετε την ενέργεια. 2. Ζητήστε ανεξάρτητο αναγνωστικό έλεγχο. Κωδικός: ΙΣΤ-ΑΠΟΜ-03.'}reviewed=null};`;
                res.type('html').send('<!doctype html><html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                    '<title>Προεπισκόπηση αποκατάστασης</title><style>body{font:1rem system-ui;line-height:1.5;margin:0;padding:clamp(1rem,4vw,2rem)}main{max-width:48rem;margin:auto}button{font:inherit;min-height:44px;padding:.7rem;max-width:100%;white-space:normal}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>' +
                    '<main><h1>Προεπισκόπηση αποκατάστασης</h1><p>Η προεπισκόπηση είναι αναγνωστική. Η ολοκλήρωση, όταν ενεργοποιηθεί, απαιτεί νέα ξεχωριστή έγκριση και αφορά μόνο την υπάρχουσα καταγραφή.</p>' +
                    '<button id="preview">Έλεγχος αποκατάστασης</button>' + completionButton + '<pre id="result" role="status"></pre></main>' +
                    '<script nonce="' + nonce + '">' + pageScript + '</script></html>');
            } catch (error) { failure(res, error.reason || 'SESSION_OR_ADMIN_REJECTED'); }
        });
        app.post('/recovery-preview', async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length || Object.keys(req.query || {}).length) throw Error('REQUEST_BODY_REJECTED');
                const { identity, context } = await authenticate(req);
                const result = await F.previewLegacyFenceRecovery({ connection: mongoose.connection, context,
                    scope, employeeId: binding.employeeId, actorUserId: identity.session.userId,
                    legacyAttemptId: binding.legacyAttemptId, fingerprint: binding.fingerprint, reservationId: binding.reservationId });
                if (result.outcome === 'COMMITTED') { const verified = await verifier.verifyLegacyFenceIndependently(verificationOptions);
                    return verified.outcome === 'COMMITTED' ? res.json(verified) : failure(res, verified.reason, 409); }
                if (result.outcome !== 'RECOVERABLE') throw Error('RECOVERY_RESULT_REJECTED');
                await verifier.captureFenceVerificationEvidence(verificationOptions);
                if (config.completionEnabled !== true) {
                    // Re-open the sealed baseline and compare an independent fresh
                    // snapshot using the existing HMAC/BSON verifier. A recovery
                    // fingerprint is evidence only, never completion authorization.
                    await verifier.captureFenceVerificationEvidence(verificationOptions);
                    return res.json({ outcome: 'RECOVERABLE', fingerprintPreserved: true,
                        evidenceIntegrityVerified: true, requiresSeparateApproval: true, completionEnabled: false,
                        reservationId: binding.reservationId, sequence: result.sequence });
                }
                const ticket = store.save({ ...binding, fingerprint: result.recoveryFingerprint,
                    sessionId: identity.sid, expiresAt: identity.expiresAt });
                return res.json({ outcome: 'RECOVERABLE', approvalTicket: ticket, fingerprintPreserved: true,
                    requiresSeparateApproval: true, completionEnabled: config.completionEnabled === true, reservationId: binding.reservationId, sequence: result.sequence });
            } catch (error) { failure(res, error.reason || 'RECOVERY_PREVIEW_BLOCKED', 409); }
        });
        app.post('/recovery-complete', async (req, res) => {
            if (config.completionEnabled !== true) return failure(res, 'RECOVERY_COMPLETION_DISABLED', 423);
            let claimed = false;
            try {
                const body = req.body;
                if (!body || !require('../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract')
                    .equal(Object.keys(body).sort(), ['approvalConfirmed', 'approvalTicket', 'executionId', 'reservationId']) ||
                    body.approvalConfirmed !== true || body.reservationId !== binding.reservationId ||
                    body.executionId !== binding.executionId) throw Error('EXPLICIT_RECOVERY_APPROVAL_REQUIRED');
                const { identity, context } = await authenticate(req);
                const input = { connection: mongoose.connection, context, scope, employeeId: binding.employeeId,
                    actorUserId: identity.session.userId, legacyAttemptId: binding.legacyAttemptId,
                    fingerprint: binding.fingerprint, reservationId: binding.reservationId };
                const ticketInput = { id: body.approvalTicket, sessionId: identity.sid, reservationId: binding.reservationId,
                    actorUserId: identity.session.userId, scope };
                const ticket = store.readUnconsumed(ticketInput);
                if (ticket.executionId !== binding.executionId) throw Error('TICKET_EXECUTION_MISMATCH');
                const fresh = await F.previewLegacyFenceRecovery(input);
                if (fresh.outcome === 'COMMITTED') { const verified = await verifier.verifyLegacyFenceIndependently(verificationOptions);
                    return verified.outcome === 'COMMITTED' ? res.json({ ...verified, reconciledReadOnly: true }) : failure(res, verified.reason, 409); }
                const A = require('../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
                if (fresh.outcome !== 'RECOVERABLE' || !A.tokenMatches(ticket.fingerprint, fresh.recoveryFingerprint))
                    throw Error('APPROVAL_EVIDENCE_CHANGED');
                const plan = await require('../server/services/ergazomenoi/employeeHistoryRecoveryWriteGuard')
                    .buildRecoveryWritePlan({ connection: mongoose.connection, context, binding, auditId: fresh.auditId });
                await authenticate(req); // Re-read session/company after all preview/plan reads.
                store.consume(ticketInput); claimed = true;
                await guard.run(plan, () => F.completeLegacyFenceReservation({ ...input,
                    recoveryApproval: { confirmed: true, fingerprint: ticket.fingerprint } }));
                // Independent majority-backed read; never treat an HTTP return as
                // commit evidence and never call completion again after uncertainty.
                const verified = await verifier.verifyLegacyFenceIndependently(verificationOptions);
                if (verified.outcome !== 'COMMITTED') throw Object.assign(Error('COMMIT_NOT_INDEPENDENTLY_CONFIRMED'), { reason: verified.reason });
                return res.json({ ...verified, requiresNewSettlementPreview: true, autoSettlement: false });
            } catch (error) {
                return failure(res, error.reason || error.code || 'RECOVERY_COMPLETION_BLOCKED', 409, claimed);
            }
        });
        app.post('/recovery-verify', async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length) throw Error('REQUEST_BODY_REJECTED');
                await authenticate(req);
                const verified = await verifier.verifyLegacyFenceIndependently(verificationOptions);
                return verified.outcome === 'COMMITTED' ? res.json(verified) : failure(res, verified.reason, 409);
            } catch (error) { return failure(res, error.reason || 'INDEPENDENT_VERIFICATION_BLOCKED', 409); }
        });
        app.use((req, res) => failure(res, 'OPERATION_DISABLED', 423));
        app.use((error, req, res, next) => { failure(res, 'REQUEST_REJECTED', 400); });
        server = await new Promise((resolve, reject) => {
            const listener = app.listen(Number(origin.port), '127.0.0.1', () => resolve(listener));
            listener.once('error', reject);
        });
        if (!activation.initializeIsolatedPreview({ server, connection: mongoose.connection, caseBinding: binding, enabled: config.previewEnabled, completionEnabled: config.completionEnabled === true }))
            throw Error('ISOLATED_ACTIVATION_REJECTED');
        return { origin: config.origin, completionEnabled: config.completionEnabled === true, async close() {
            await new Promise(resolve => { server.close(resolve); server.closeIdleConnections?.(); server.closeAllConnections?.(); });
            await mongoose.disconnect(); restore();
        } };
    } catch (error) {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        await mongoose.disconnect(); restore(); throw error;
    }
}
if (require.main === module) {
    const configArg = process.argv.find(arg => arg.startsWith('--config='));
    if (!configArg) { process.stderr.write('Απαιτείται ιδιωτικό αρχείο ρυθμίσεων με --config=/απόλυτη/διαδρομή.json\n'); process.exitCode = 1; }
    else (async () => {
        const filename = configArg.slice('--config='.length), stat = fs.lstatSync(filename);
        if (!path.isAbsolute(filename) || !stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600)
            throw Error('PRIVATE_CONFIG_REQUIRED');
        const runtime = await startIsolatedAdmin(JSON.parse(fs.readFileSync(filename, 'utf8')));
        process.stdout.write('Απομονωμένο Admin: ' + runtime.origin +
            (runtime.completionEnabled ? ' — ολοκλήρωση μόνο με νέα χωριστή έγκριση\n' : ' — μόνο αναγνωστική προεπισκόπηση\n'));
        let closing = false;
        const stop = async () => { if (closing) return; closing = true; await runtime.close(); };
        process.once('SIGTERM', stop); process.once('SIGINT', stop);
    })().catch(() => { process.stderr.write('Η εκκίνηση σταμάτησε επειδή δεν επιβεβαιώθηκαν οι ρυθμίσεις ή η πρόσβαση. Δεν αποθηκεύτηκε αλλαγή στη βάση. 1. Ελέγξτε το ιδιωτικό αρχείο ρυθμίσεων. 2. Ζητήστε έλεγχο από τον διαχειριστή. Κωδικός: ΙΣΤ-ΑΠΟΜ-START.\n'); process.exitCode = 1; });
}
module.exports = { startIsolatedAdmin, installReadOnlyCommandGuard };
