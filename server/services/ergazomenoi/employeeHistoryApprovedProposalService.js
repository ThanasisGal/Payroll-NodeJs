'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const P = require('./employeeHistoryApprovedProposalContract');
const E = require('./employeeHistoryProposalEditorService');
const X = require('./employeeHistoryProposalXlsxService');
const I = require('./employeeHistoryProposalImportService');
const W = require('./employeeEmploymentProfileWriter');
const Profile = require('../../utils/ergazomenoi/employmentProfileContract');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { assertImportProtection } = require('./employeeHistoryProposalImportProtectionService');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const { actorAccess } = require('./employeeHistoryAutomaticReconstructionApplyService');
const { assertEmployeeHistoryOperationsAuthorized, ACCESS_MODES } = require('./employeeHistoryAuthorizationService');
const { identifyEmployeeHistoryProblemScope } = require('./employeeHistoryProblemScopeService');
const { normalizeRequiredUserTeam } = require('../userTeamScopeService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const allowed = new Set(P.permittedFields);
const ephemeralSecret = crypto.randomBytes(32).toString('hex');
const nativeClaimField = '__employee_history_approved_proposal_claim';

function defaults() {
    return {
        connection: mongoose.connection,
        employeeModel: require('../../models/ergazomenoi').ErgazomenoiModel,
        historyModel: require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel,
        auditModel: require('../../models/employeeHistoryRepairAudit'),
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        companyModel: require('../../models/companies').CompaniesModel,
        periodControlModel: require('../../models/apasxoliseisPeriodControl'),
        frozenModel: require('../../models/apasxoliseisPeriodFrozenSnapshot'),
        loadCatalogs: require('./employeeHistoryCorrectionCatalogService').loadEmployeeHistoryCorrectionCatalogs,
        referenceChecker: require('./employeeHistoryReferenceAuditService').findHistoryIdReferences,
        loadSchedules: require('./employeeHistoryMissingPeriodCorrectionService').loadPredeclaredGapScheduleRows,
        auditStorage: require('./employeeHistoryRepairAuditSetupService').getEmployeeHistoryRepairAuditStorageState,
        capabilityProbe: W.transactionCapability,
        isEnabled: () => P.enabled(),
        approvalSecret: process.env.SESSION_SECRET || process.env.SECRET || null,
        now: () => Date.now()
    };
}

// DI belongs to isolated tests, never to HTTP bodies or environment URI fallbacks.
function createEmployeeHistoryApprovedProposalService(overrides = {}) {
    const d = { ...defaults(), ...overrides };
    const secret = typeof d.approvalSecret === 'string' && d.approvalSecret.length >= 16 ? d.approvalSecret : null;
    const isEnabled = () => d.isEnabled() === true && Boolean(secret);
    const signingSecret = secret || ephemeralSecret; // OFF previews never grant a write capability.

    async function read(req, session = null) {
        const actorUserId = req.session?.userId, employeeId = req.params?.id, company = req.session?.companyInUse;
        if (!actorUserId) throw P.failure('AUTHENTICATION', 401);
        if (![actorUserId, employeeId, company].every(value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) ||
            typeof req.sessionID !== 'string' || !req.sessionID) throw P.failure('SCOPE', 403);
        let team;
        try { team = normalizeRequiredUserTeam(req.session.userTeam); } catch { throw P.failure('SCOPE', 403); }
        const current = await d.employeeModel.findOne({ _id: employeeId, team, company_kod: company })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        if (!current || String(current._id) !== employeeId || typeof current.kodikos !== 'string') throw P.failure('SCOPE', 403);
        const scope = { team, company_kod: company, kodikos: current.kodikos };
        await authorizeEmployeeMaintenance({ actorUserId, employeeId, scope, current, session,
            userModel: d.userModel, privilegeModel: d.privilegeModel });
        if (require('../../utils/ergazomenoi/employeeSaveState').isTemporaryEmployee(current)) throw P.failure('DRAFT');
        const access = await actorAccess({ actorUserId, scope, session, userModel: d.userModel });
        const companyRecord = await d.companyModel.findOne({ _id: company, team }).session(session).lean();
        if (!companyRecord) throw P.failure('SCOPE', 403);
        const query = d.historyModel.find(scope); query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        const history = await query.select('+history_reference_fence').session(session).lean();
        const references = {};
        for (const row of history) references[String(row._id)] = await d.referenceChecker({
            connection: d.connection, historyIds: [String(row._id)], session });
        const predeclaredScheduleRows = await d.loadSchedules({ scope, currentEmployee: current, historyRows: history,
            connection: d.connection, session });
        return { actorUserId, employeeId, access, scope, currentEmployee: current, completeHistoryRows: history,
            protectedReferenceSummary: references, companyBusinessCode: companyRecord.kod,
            predeclaredScheduleRows: predeclaredScheduleRows || [] };
    }
    function authorizeCase(input, selected) {
        assertEmployeeHistoryOperationsAuthorized({ accessMode: input.access.mode,
            operations: [{ state: selected.operation === 'INSERT' ? 'inserted' : 'modified',
                historyId: selected.targetHistoryId, anchorHistoryId: selected.sourceHistoryIds[0] }],
            originalHistoryRows: input.completeHistoryRows,
            problemScope: input.access.mode === ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE ? identifyEmployeeHistoryProblemScope(input) : null });
    }
    async function protectionFor(input, branch, period, session) {
        const filter = { team: input.scope.team, company_kod: input.scope.company_kod, ypokatasthma: branch,
            period_start: mongoose.trusted({ $lte: new Date(period.to || '9999-12-31') }),
            period_end: mongoose.trusted({ $gte: new Date(period.from) }) };
        const controls = await d.periodControlModel.find(filter).limit(1001).session(session).lean();
        const snapshots = await d.frozenModel.find(filter).limit(1001).session(session).lean();
        const protection = { controls, snapshots };
        if (controls.length > 1000 || snapshots.length > 1000) throw P.failure('PROTECTION_UNKNOWN');
        try { assertImportProtection(protection, { scope: input.scope, branch, period }); }
        catch (error) { throw P.failure(error.importReason || 'PROTECTION_UNKNOWN'); }
        // Without a bounded, fully covered set of existing period controls there
        // is no shared lock against a concurrent period lock/finalization. Do not
        // create period state, infer an expiry or pretend a range read is a lock.
        if (!period.to) throw P.failure('PROTECTION_UNKNOWN');
        let cursor = new Date(period.from).getTime(), end = new Date(period.to).getTime();
        for (const row of controls.slice().sort((a, b) => new Date(a.period_start) - new Date(b.period_start))) {
            const from = new Date(row.period_start).getTime(), to = new Date(row.period_end).getTime();
            if (row.active_calculation_id) throw P.failure('PERIOD_BUSY');
            if (from <= cursor && to >= cursor) cursor = to + 86400000;
        }
        if (cursor <= end) throw P.failure('PROTECTION_UNKNOWN');
        return protection;
    }
    async function prepare(req, proposal, input, session = null) {
        P.request(proposal);
        let baseline;
        const catalogs = await d.loadCatalogs({ session });
        try { baseline = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection: proposal.selection }); }
        catch { throw P.failure('STALE'); }
        const selected = baseline.caseSelection.selectedCase;
        if (!baseline.workbook || !selected || !['UPDATE', 'INSERT'].includes(selected.operation)) throw P.failure('CASE');
        authorizeCase(input, selected);
        let completions;
        try { completions = E.prepareLocalCompletion(baseline, proposal.completion, req, catalogs); }
        catch (error) { throw P.failure(error.statusCode === 409 ? 'STALE' : 'VALUE', [403, 409].includes(error.statusCode) ? error.statusCode : 422); }
        const evidence = completions.find(item => item.entry.role === 'EVIDENCE')?.raw;
        const declaration = completions.find(item => item.entry.role === 'DECLARATION')?.raw;
        if (typeof evidence !== 'string' || !evidence.trim() || declaration !== 'Δηλώνω τεκμηριωμένα στοιχεία') throw P.failure('EVIDENCE', 422);
        const answers = new Map(completions.filter(item => item.entry.role === 'ANSWER').map(item => [item.entry, item]));
        if (selected.operation === 'INSERT' && baseline.editableCells.some(entry => entry.role === 'ANSWER' && !answers.has(entry))) throw P.failure('INCOMPLETE', 422);
        const original = input.completeHistoryRows.find(row => String(row._id) === selected.targetHistoryId);
        if (original && isInactiveHistoryRow(original)) throw P.failure('CASE');
        for (const entry of answers.keys()) if (!allowed.has(entry.canonicalField)) throw P.failure('LIFECYCLE', 422);
        let checked;
        try { checked = I.validateCandidate(input, baseline, answers); }
        catch (error) { throw P.failure(error.importReason || 'VALUE', error.statusCode || 422); }
        const candidate = { ...checked.candidate }, patch = {};
        for (const [entry, answer] of answers) {
            const field = entry.canonicalField, path = d.historyModel.schema.path(field);
            if (!path) throw P.failure('VALUE', 422);
            const value = path.cast(answer.raw);
            if (selected.operation === 'INSERT' || !I.sameValue(field, original[field], value) ||
                Object.hasOwn(original, field) && !A.equal(original[field], value)) patch[field] = value;
        }
        if (selected.operation === 'UPDATE') Object.assign(candidate, original, patch);
        else {
            Object.assign(candidate, patch, { [C.HIRE]: Profile.calendarDate(selected.period.hire),
                [C.START]: Profile.calendarDate(selected.period.from), [C.END]: Profile.calendarDate(selected.period.to),
                afora_proslhpsh: false, afora_allagh_oron_ergasias: true });
        }
        if (selected.operation === 'UPDATE' && !Object.keys(patch).length) throw P.failure('NO_CHANGES', 422);
        const targetId = original?._id || '000000000000000000000001';
        const inspected = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee,
            historyRows: [{ ...candidate, _id: targetId }] });
        const localErrors = new Set(['REQUIRED_PROFILE_FIELD', 'INVALID_NUMERIC_PROFILE_FACT', 'INVALID_TEMPORAL_DATE',
            'INVALID_PROPOSED_WORK_TERMS', 'NUMERIC_PROFILE_FACT_UNRECORDED', 'INVALID_EMPLOYMENT_PROFILE']);
        if (inspected.issues.some(issue => localErrors.has(issue.reason))) throw P.failure('INCOMPLETE', 422);
        // Validate complete business facts without applying defaults/normalizers.
        const normalized = Profile.normalizeEmploymentProfileSubmission(candidate, candidate);
        for (const field of Profile.FACT_FIELDS.filter(field => ![Profile.SCHEMA_VERSION, Profile.TYPE_VERSION].includes(field)))
            if (!I.sameValue(field, candidate[field], normalized[field])) throw P.failure('VALUE', 422);
        if (selected.operation === 'INSERT') {
            const breakDate = 'hmeromhnia_isxyos_dialleimatos_apo';
            // A complete inserted period uses the established snapshot metadata.
            // Only these structural fields are taken from the foundation builder;
            // no absent business value/default is copied into the candidate.
            if (candidate[breakDate] && Profile.calendarDate(candidate[breakDate]).getTime() !== Profile.calendarDate(selected.period.from).getTime())
                throw P.failure('BREAK_SCOPE', 422);
            const snapshot = require('../../utils/ergazomenoi/employmentProfileHistory').buildCompleteProfileSnapshot({
                input: candidate, current: candidate, effectiveFrom: selected.period.from });
            for (const field of [Profile.SCHEMA_VERSION, Profile.TYPE_VERSION, 'afora_allagh_dialleimatos', breakDate]) candidate[field] = snapshot[field];
        } else {
            const arrangementChanged = Profile.ARRANGEMENT_FIELDS.some(field => Object.hasOwn(patch, field));
            if (arrangementChanged && (!Profile.readEmploymentProfile(original).recorded ||
                !A.equal(candidate[Profile.TYPE_VERSION], normalized[Profile.TYPE_VERSION]))) throw P.failure('PROFILE_CERTIFICATION_REQUIRED', 422);
            const breakChanged = [...Profile.BREAK_FIELDS, 'hmeromhnia_isxyos_dialleimatos_apo'].some(field => Object.hasOwn(patch, field));
            const anchor = Profile.calendarDate(candidate.hmeromhnia_isxyos_dialleimatos_apo);
            if (breakChanged && (original.afora_allagh_dialleimatos !== true || !anchor ||
                !Profile.readEmploymentProfile(original).recorded && anchor.getUTCDate() !== 1)) throw P.failure('BREAK_SCOPE', 422);
        }
        for (const id of selected.operation === 'UPDATE' ? [selected.targetHistoryId] : selected.sourceHistoryIds)
            if (!Array.isArray(input.protectedReferenceSummary[id]) || input.protectedReferenceSummary[id].length) throw P.failure('REFERENCE');
        const branch = original?.ypokatasthma ?? input.currentEmployee.ypokatasthma;
        if (typeof branch !== 'string' || !branch.trim()) throw P.failure('PROTECTION_UNKNOWN');
        const protection = await protectionFor(input, branch, checked.affected, session);
        const contents = { operation: selected.operation, caseId: selected.id, targetHistoryId: selected.targetHistoryId,
            period: checked.period, affected: checked.affected, branch, patch, candidate, evidence, declaration };
        const fingerprint = A.hash({ version: P.VERSION, snapshot: baseline.snapshotFingerprint, contents,
            protection: { controls: A.ordered(protection.controls), snapshots: A.ordered(protection.snapshots) } });
        return { ...contents, protection, fingerprint, snapshot: baseline.snapshotFingerprint,
            rows: Object.entries(selected.operation === 'UPDATE' ? patch : candidate).filter(([field]) => allowed.has(field) || field === C.HIRE)
                .map(([field, after]) => ({ fieldId: field, field: labels[field] || field,
                    before: selected.operation === 'UPDATE' ? original[field] ?? null : null, after })) };
    }
    const binding = (req, input) => ({ actorUserId: input.actorUserId, employeeId: input.employeeId, scope: input.scope,
        session: crypto.createHmac('sha256', signingSecret).update(req.sessionID).digest('hex') });
    function checkBinding(req, proposal, input, payload) {
        if (!A.equal(payload.binding, binding(req, input)) || payload.requestHash !== A.hash(proposal)) throw P.failure('APPROVAL');
    }
    async function claim(collection, id, session) {
        const identity = { _id: id, [nativeClaimField]: { $exists: false } };
        const result = await collection.updateOne(identity, { $set: { [nativeClaimField]: true } }, { session });
        if (result.matchedCount !== 1) throw P.failure('STALE');
        if ((await collection.updateOne({ _id: id, [nativeClaimField]: true }, { $unset: { [nativeClaimField]: 1 } }, { session })).matchedCount !== 1)
            throw P.failure('STALE');
    }
    async function receipt(input, payload, session) {
        const audit = await d.auditModel.findById(payload.approvalId.slice(0, 24)).session(session).lean();
        if (!audit) return null;
        if (audit.mutationSource !== P.OPERATION || audit.diagnostics?.approvalId !== payload.approvalId ||
            !A.equal(audit.diagnostics.binding, payload.binding) || audit.diagnostics.fingerprint !== payload.fingerprint ||
            audit.diagnostics.requestHash !== payload.requestHash || !A.equal(audit.employeeScope, { ...input.scope, employee_id: input.currentEmployee._id }))
            throw P.failure('APPROVAL');
        if (!A.equal(A.ordered(input.completeHistoryRows), A.ordered(audit.historyAfter)) ||
            !A.equal(input.currentEmployee, audit.diagnostics.currentAfter)) {
            const error = P.failure('COMMITTED_STATE_CHANGED'); error.saved = true; throw error;
        }
        return { success: true, saved: true, applied: false, alreadyApplied: true, outcome: 'COMMITTED',
            historyStatus: 'REVIEW_REQUIRED', approvalId: payload.approvalId, auditId: String(audit._id),
            operation: audit.diagnostics.operation, targetHistoryId: audit.diagnostics.targetHistoryId };
    }
    async function preview(req, proposal) {
        try {
            // A consistent snapshot, with no claims, writes or session-store
            // mutation. A preview must never combine different stored versions.
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                const input = await read(req, session), prepared = await prepare(req, proposal, input, session);
                const payload = { version: P.VERSION, approvalId: crypto.randomBytes(32).toString('hex'),
                    expiresAt: d.now() + 15 * 60 * 1000, binding: binding(req, input),
                    fingerprint: prepared.fingerprint, requestHash: A.hash(proposal), executionEnabled: isEnabled() };
                return { success: true, saved: false, previewOnly: true, executionEnabled: isEnabled(),
                    operation: prepared.operation, caseId: prepared.caseId, targetHistoryId: prepared.targetHistoryId,
                    employeeCode: input.scope.kodikos, historySequence: input.completeHistoryRows.find(row => String(row._id) === prepared.targetHistoryId)?.aa_eggrafhs || null,
                    period: prepared.period, rows: prepared.rows, evidence: prepared.evidence,
                    approval: { token: P.sign(payload, signingSecret), approvalId: payload.approvalId }, historyStatus: 'REVIEW_REQUIRED' };
            }, null, P.transactionOptions);
        } catch (error) {
            if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') throw P.failure('TRANSACTIONS_UNAVAILABLE', 503);
            throw error;
        }
    }
    async function apply(req, body) {
        // This check precedes all reads, session creation, fences and audit writes.
        if (!isEnabled()) throw P.failure('DISABLED', 403);
        if (!P.exactKeys(body, ['proposal', 'approval']) || !P.exactKeys(body.approval, ['token', 'confirmed']) || body.approval.confirmed !== true)
            throw P.failure('APPROVAL', 400);
        P.request(body.proposal);
        const payload = P.verify(body.approval.token, signingSecret);
        if (payload.executionEnabled !== true) throw P.failure('DISABLED', 403);
        try {
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
                const completed = await receipt(input, payload, session); if (completed) return completed;
                if (payload.expiresAt < d.now()) throw P.failure('EXPIRED');
                const prepared = await prepare(req, body.proposal, input, session);
                if (prepared.fingerprint !== payload.fingerprint) throw P.failure('STALE');
                if (!(await d.auditStorage({ connection: d.connection })).ready) throw P.failure('AUDIT_UNAVAILABLE', 503);
                await claim(d.userModel.collection, new mongoose.Types.ObjectId(input.actorUserId), session);
                const permission = await d.privilegeModel.findOne({ userId: input.actorUserId, form: 'Ergazomenoi' }).session(session).lean();
                if (!permission) throw P.failure('RIGHTS', 403);
                await claim(d.privilegeModel.collection, permission._id, session);
                await claim(d.companyModel.collection, new mongoose.Types.ObjectId(input.scope.company_kod), session);
                for (const control of prepared.protection.controls) await claim(d.periodControlModel.collection, control._id, session);
                await W.acquireEmployeeMutationFence({ filter: input.scope, employeeId: input.employeeId,
                    employeeModel: d.employeeModel, session, notFoundCode: P.OPERATION + '_STALE' });
                await require('./employeeHistoryReferenceWriteFenceService').claimUnchangedHistoryReferences({
                    historyRows: input.completeHistoryRows, scope: input.scope, historyModel: d.historyModel, session });
                const current = await d.employeeModel.findOne({ ...input.scope, _id: input.employeeId })
                    .select('+employee_profile_mutation_sequence').session(session).lean();
                const expectedCurrent = { ...input.currentEmployee,
                    employee_profile_mutation_sequence: (input.currentEmployee.employee_profile_mutation_sequence || 0) + 1 };
                if (!A.equal(current, expectedCurrent)) throw P.failure('STALE');
                const proof = P.sealExecution({ ...prepared, scope: input.scope, current, originalCurrent: input.currentEmployee,
                    before: input.completeHistoryRows, payload, isEnabled, actorUserId: input.actorUserId });
                const result = await W.executeEmployeeHistoryApprovedProposalPlan({ proof, employeeId: input.employeeId, session,
                    employeeModel: d.employeeModel, historyModel: d.historyModel, auditModel: d.auditModel });
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                return result;
            }, null, P.transactionOptions);
        } catch (error) {
            if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') throw P.failure('TRANSACTIONS_UNAVAILABLE', 503);
            if (error.hasErrorLabel?.('UnknownTransactionCommitResult') || error.errorLabels?.includes('UnknownTransactionCommitResult')) throw P.failure('COMMIT_UNCERTAIN', 503);
            if (error.hasErrorLabel?.('TransientTransactionError') || error.code === 112 || error.code === 11000) throw P.failure('STALE');
            throw error;
        }
    }
    async function reconcile(req, body) {
        if (!P.exactKeys(body, ['proposal', 'token'])) throw P.failure('REQUEST', 400);
        P.request(body.proposal);
        const payload = P.verify(body.token, signingSecret);
        return W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
            const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
            const completed = await receipt(input, payload, session);
            if (!completed) throw P.failure('COMMIT_UNCERTAIN', 503);
            return { ...completed, reconciledReadOnly: true };
        }, null, P.transactionOptions);
    }
    return { preview, apply, reconcile, isEnabled };
}
module.exports = { createEmployeeHistoryApprovedProposalService };
