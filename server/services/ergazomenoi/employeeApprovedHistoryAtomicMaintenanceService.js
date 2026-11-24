'use strict';

// PR406 / Stage 5D. Server-only, opt-in atomic maintenance transaction.
// No browser/client is allowed to supply scope, History, approvals, references or
// physical write plans. All evidence is reloaded under one MongoDB transaction.
// Legacy immutable boundaries are explicitly NOT rewritten by this service.
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const Row = require('./employeeHistoryRowApprovalService');
const B = require('./employeeApprovedHistoryImmutableBoundaryService');
const { proposalHistoryState } = require('./employeeHistoryProposalReadService');
const { prepareApprovedHistoryAtomicProposal } = require('./employeeApprovedHistoryAtomicProposalService');
const { inspectEmployeeHistorySave, inspectEmployeeHistoryProposedRowSave } = require('./employeeHistorySaveValidationService');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { claimUnchangedHistoryReferences } = require('./employeeHistoryReferenceWriteFenceService');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const { hash, equal, ordered } = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const VERSION = 'employee-approved-atomic-maintenance:v1';
const FLAG = 'PAYROLL_PR406_APPROVED_ATOMIC_MAINTENANCE_ENABLED';
const OPERATION = 'EMPLOYEE_APPROVED_HISTORY_ATOMIC_MAINTENANCE';
const TERMS = ['hmeres_ergasias_ebdomadas', 'typos_ebdomadas',
    'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias'];
const CONTRACT = 'apasxolhsh_basei_symbashs';
function blocked(reason, code = 409) {
    return Object.assign(new Error(`EMPLOYEE_APPROVED_ATOMIC_${reason}`),
        { code: `EMPLOYEE_APPROVED_ATOMIC_${reason}`, statusCode: code });
}
const id = x => String(x?._id || '');
const day = x => {
    if (!x) return null;
    const d = new Date(x);
    return Number.isFinite(+d) ? d.toISOString().slice(0, 10) : null;
};
function yesterday(x) {
    const d = new Date(x + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function sourceFingerprint(input) {
    return hash({ version: VERSION, scope: input.scope, employee: input.currentEmployee,
        physical: ordered(input.completeHistoryRows), approvals: input.approvedHistoryDecisions,
        references: input.protectedReferenceSummary, atomicBoundaries: input.atomicBoundaryAudits || [] });
}
function proofIssues(inspection) {
    return new Set((inspection.issues || []).map(issue =>
        [issue.reason || '', issue.historyId || '', issue.field || ''].join('|')));
}
function assertAtomicPeriodProtection(protection) {
    if (!protection || protection.uncertain ||
        !Array.isArray(protection.controls) || !Array.isArray(protection.snapshots) ||
        protection.snapshots.length || protection.controls.some(row =>
            row.status !== 'OPEN' || row.active_calculation_id))
        throw blocked('FROZEN_OR_UNKNOWN_PERIOD');
}
function atomicPlanFingerprint(input, protection, options) {
    const fingerprintInput = options.allowMissing ? { ...input, currentEmployee: Object.fromEntries(
        Object.entries(input.currentEmployee).filter(([field]) => field !== 'employee_profile_mutation_sequence')) } : input;
    return hash({ snapshot: sourceFingerprint(fingerprintInput), protection: protection?.wire,
        ...(options.allowMissing ? { employeePatch: options.employeePatch, profilePatch: options.profilePatch } : {}) });
}
function proveNoNewHistoryProblem({ input, projectedBefore, projectedAfter, currentAfter, targetId, newRow,
    allowMissing = false }) {
    // The legacy baseline may have independently APPROVED gaps/blank facts. A
    // new action must not re-open them, but may not call the whole result CLEAN
    // merely by suppressing validation failures.
    const before = inspectEmployeeHistorySave({ scope:input.scope,
        currentEmployee:input.currentEmployee, historyRows:projectedBefore,
        approvedHistoryInput:input, includeIssueDetails:true });
    const oldGaps = new Set(employeeHistoryCoverageGaps({
        currentEmployee:input.currentEmployee, historyRows:projectedBefore })
        .map(gap => [gap.hire,gap.from,gap.to,gap.reason].join('|')));
    for (const gap of employeeHistoryCoverageGaps({
        currentEmployee:currentAfter,historyRows:projectedAfter }))
        if(!oldGaps.has([gap.hire,gap.from,gap.to,gap.reason].join('|')))
            throw blocked('NEW_HISTORY_COVERAGE_GAP');
    const target = newRow || projectedAfter.find(row => id(row) === targetId);
    if (!target) throw blocked('PROPOSED_TARGET_MISSING');
    if (newRow) {
        const start = day(newRow[C.START]), hire = day(newRow[C.HIRE]);
        if (!start || !hire || projectedAfter.some(row => row !== newRow && row !== target &&
            day(row[C.HIRE]) === hire && day(row[C.START]) &&
            day(row[C.START]) <= start && (!day(row[C.END]) || day(row[C.END]) >= start)))
            throw blocked('NEW_PERIOD_OVERLAP');
    }
    const proposed = inspectEmployeeHistoryProposedRowSave(target);
    if (allowMissing && proposed.issues.length) {
        const { missing, unsafe } = require('./employeeHistoryDeferralService').missingIssues(proposed, [target]);
        if (unsafe.length || !missing.length) {
            const error = blocked('NEW_TERMS_INVALID');
            error.historyIssues = proposed.issues;
            throw error;
        }
        return { missingFields: missing.map(item => ({ ...item,
            historyId: newRow ? null : targetId, periodFrom: day(target[C.START]), periodUntil: day(target[C.END]) })) };
    }
    if (proposed.issues.length) throw blocked('NEW_TERMS_INCOMPLETE');
    const after = inspectEmployeeHistorySave({ scope:input.scope,
        currentEmployee:currentAfter, historyRows:projectedAfter,
        approvedHistoryInput:input, includeIssueDetails:true });
    const allowed = proofIssues(before);
    for (const issue of proofIssues(after)) if (!allowed.has(issue)) {
        const error = blocked('NEW_HISTORY_ISSUE_' + issue.split('|')[0]);
        error.historyIssues = after.issues;
        throw error;
    }
    const canonicalBefore = canonicalizeEmployeeHistory({ scope:input.scope,
        currentEmployee:input.currentEmployee, historyRows:projectedBefore, strictProfileEvidence:true });
    const canonicalAfter = canonicalizeEmployeeHistory({ scope:input.scope,
        currentEmployee:currentAfter, historyRows:projectedAfter, strictProfileEvidence:true });
    if (canonicalAfter.status === 'TRUE_AMBIGUITY' &&
        (canonicalBefore.status !== 'TRUE_AMBIGUITY' ||
         canonicalBefore.diagnostics?.reason !== canonicalAfter.diagnostics?.reason))
        throw blocked('NEW_CANONICAL_AMBIGUITY');
    if (!canonicalBefore.cleanupRequired && canonicalAfter.cleanupRequired &&
        canonicalBefore.status === 'CLEAN') throw blocked('NEW_CANONICAL_CLEANUP');
    buildEmploymentCycles({ currentEmployee:currentAfter, history:projectedAfter });
    return after.status === 'CLEAN' && canonicalAfter.status === 'CLEAN' &&
        !canonicalAfter.cleanupRequired ? 'CLEAN' : 'LEGACY_COMPATIBLE';
}
function decide(input, request, periodProtection, options = {}) {
    const proposal = prepareApprovedHistoryAtomicProposal(input, request);
    if (!['ATOMIC_NEW_VERSION_PREPARED_READ_ONLY',
        'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY'].includes(proposal.status))
        throw blocked(proposal.status);
    const verified = proposalHistoryState(input);
    const target = verified.historyRows.find(row => id(row) ===
        (request.kind === 'NEW_CHANGE' ? proposal.historyInsertDraft &&
            require('./employeeApprovedHistoryChangeIntentService')
                .planApprovedHistoryChangeIntent(input, request).fromHistoryId : proposal.targetHistoryId));
    const original = input.completeHistoryRows.find(row => id(row) === id(target));
    if (!target || !original) throw blocked('TARGET_STALE');
    const targetId = id(original);
    if (!Object.hasOwn(input.protectedReferenceSummary, targetId) ||
        !Array.isArray(input.protectedReferenceSummary[targetId])) throw blocked('REFERENCES_NOT_VERIFIED');
    // Both real-period controls and frozen references must be positively known.
    const assertPeriodProtection = () => assertAtomicPeriodProtection(periodProtection);
    if (!options.allowMissing) assertPeriodProtection();
    if (request.kind !== 'NEW_CHANGE' && input.protectedReferenceSummary[targetId].length)
        throw blocked('IMMUTABLE_TARGET_REQUIRES_CORRECTION_EDITION');
    // A NEW_CHANGE never updates the previous physical row OR its approval.
    // A same-period correction must still reject rewriting an approved target.
    const targetApproval=verified.decisions.find(audit =>
        String(audit.diagnostics.targetHistoryId) === targetId);
    if (request.kind !== 'NEW_CHANGE' && targetApproval)
        throw blocked('APPROVED_TARGET_CANNOT_BE_REWRITTEN');
    const approvedEdition = targetApproval ? {
        approvalAuditId:String(targetApproval._id),
        approvedContentHash:targetApproval.diagnostics.rowApproval.approvedContentHash,
        editionFingerprint:B.fingerprint(target)
    } : null;
    if(approvedEdition && (!approvedEdition.approvedContentHash ||
        approvedEdition.editionFingerprint !==
            B.fingerprint(targetApproval.diagnostics.rowApproval.approvedContent)))
        throw blocked('APPROVED_TARGET_PROVENANCE_STALE');
    if (input.currentEmployee.employee_pending_history) throw blocked('PENDING_HISTORY_FIRST');
    // The UI stores contractual 5/6-day workweek independently of the newer
    // typos_ebdomadas fact. Only an explicitly recorded matching code may be
    // updated; missing/contradictory legacy facts are never silently 'fixed'.
    const storedContract = String(input.currentEmployee[CONTRACT] ?? '').trim();
    if (storedContract && (!['5','6'].includes(storedContract) ||
        storedContract !== String(input.currentEmployee.hmeres_ergasias_ebdomadas)))
        throw blocked('STORED_CONTRACT_WEEK_CONFLICT');
    const contractPatch = storedContract
        ? { [CONTRACT]:String(request.correctedTerms.hmeres_ergasias_ebdomadas) } : {};
    const previousRevision = new Date(original.updatedAt || 0).getTime();
    const updated = new Date(Math.max(Date.now(),
        Number.isFinite(previousRevision) ? previousRevision + 1 : Date.now()));
    let targetPatch = null, virtualClose = null, employeePatch, nextRow = null;
    if (request.kind === 'NEW_CHANGE') {
        // Stage5C guarantees old PHYSICAL History rows remain unchanged.
        // The previous period ends only in the VERIFIED logical projection
        // after an immutable audit is persisted in this transaction.
        if (day(target[C.END]) !== null || !day(target[C.START]) ||
            day(target[C.START]) >= request.effectiveFrom) throw blocked('LAST_PERIOD_NOT_OPEN');
        const close = yesterday(request.effectiveFrom);
        if (close < day(target[C.START])) throw blocked('INVALID_BOUNDARY');
        virtualClose = { [C.END]: new Date(close + 'T00:00:00.000Z') };
        employeePatch = { ...proposal.currentEmployeePatch, ...contractPatch,
            [C.START]: new Date(request.effectiveFrom + 'T00:00:00.000Z'),
            [C.CHANGE]: new Date(request.effectiveFrom + 'T00:00:00.000Z') };
        nextRow = { ...proposal.historyInsertDraft,
            createdAt: updated, updatedAt: updated };
    } else {
        if (proposal.mode !== 'AUDITED_EXISTING_ROW_CORRECTION' ||
            !verified.atomicSuccessors?.includes(targetId))
            throw blocked('IMMUTABLE_CORRECTION_EDITION_REQUIRED');
        // A typo may correct only the newest row created by this atomic flow.
        // A pre-existing physical legacy row is never modified by this writer.
        if (request.effectiveFrom !== day(target[C.START])) throw blocked('CORRECTION_DATE_CHANGED');
        // CONTRACT belongs to Employee only; History records days/week type.
        // Mongoose strips it from History writes, breaking exact reread parity.
        targetPatch = { ...proposal.verifiedHistoryCorrection, updatedAt: updated };
        employeePatch = { ...proposal.currentEmployeePatch, ...contractPatch };
    }
    employeePatch = { ...(options.employeePatch || {}), ...employeePatch };
    if (nextRow) nextRow = { ...nextRow, ...(options.profilePatch || {}),
        ...request.correctedTerms };
    if (targetPatch) targetPatch = { ...(options.profilePatch || {}), ...targetPatch };
    const currentAfter = { ...input.currentEmployee, ...employeePatch };
    const physicalAfter = input.completeHistoryRows.map(row => id(row) === targetId && targetPatch
        ? { ...row, ...targetPatch } : row);
    const projectedAfter = verified.historyRows.map(row => id(row) === targetId
        ? { ...row, ...(virtualClose || targetPatch) } : row);
    if (nextRow) projectedAfter.push({ ...nextRow,
        _id: '507f1f77bcf86cd79943f00', aa_eggrafhs: '9999' });
    const historicalStatus = proveNoNewHistoryProblem({ input,
        projectedBefore:verified.historyRows, projectedAfter,
        currentAfter, targetId, newRow:nextRow && projectedAfter.at(-1), allowMissing: options.allowMissing === true });
    const missingFields = historicalStatus?.missingFields || [];
    if (!missingFields.length && !options.inspectOnly) assertPeriodProtection();
    return { version: VERSION, kind: request.kind, targetId, employeePatch, targetPatch, virtualClose,
        nextRow, sourceFingerprint: atomicPlanFingerprint(input, periodProtection, options),
        protectionProof:periodProtection, targetBefore: original,
        targetBusinessBefore:target, approvedEdition,
        oldPhysicalIds: input.completeHistoryRows.map(id),
        inspected: true, historicalStatus: missingFields.length ? 'PENDING_EMPLOYEE_RECONCILIATION' : historicalStatus,
        ...(options.allowMissing ? { missingFields } : {}), originalApprovedCount: verified.decisions.length,
        physicalAfter, projectedAfter };
}
function createApprovedHistoryAtomicMaintenanceService(overrides = {}) {
    const d = {
        connection: mongoose.connection,
        employeeModel: require('../../models/ergazomenoi').ErgazomenoiModel,
        historyModel: require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel,
        auditModel: require('../../models/employeeHistoryRepairAudit'),
        userModel: require('../../models/userModel'),
        privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        periodControlModel: require('../../models/apasxoliseisPeriodControl'),
        frozenModel: require('../../models/apasxoliseisPeriodFrozenSnapshot'),
        referenceChecker: require('./employeeHistoryReferenceAuditService').findHistoryIdReferences,
        periodProtection: require('./employeeHistoryLegacyProtectionService').readLegacyProtection,
        claimPeriodProtection: require('./employeeHistoryLegacyProtectionService').claimLegacyProtection,
        claimCompanyPeriod: require('./employeeHistoryPeriodSerializationService').claimCompanyPeriodSerialization,
        capabilityProbe: W.transactionCapability,
        decisionsLoader: Row.loadDecisions,
        atomicAuditsLoader: async ({ scope, currentEmployee }, model, session) =>
            model.find({ 'employeeScope.team':scope.team,
                'employeeScope.company_kod':scope.company_kod,
                'employeeScope.kodikos':scope.kodikos,
                'employeeScope.employee_id':currentEmployee._id,
                mutationSource:B.OPERATION,
                'diagnostics.version':VERSION,
                'diagnostics.operation':'NEW_CHANGE' })
                .sort({ repairedAt:-1, _id:-1 }).session(session).lean(),
        enabled: () => process.env[FLAG] === 'true',
        secret: process.env.SESSION_SECRET || process.env.SECRET || '',
        now: () => Date.now(),
        buildHistoryDocument: (model,row) => new model(row,null,{defaults:false}),
        auditReady: async () => require('./employeeHistoryRepairAuditSetupService')
            .employeeHistoryRepairAuditCollectionExists({ connection:d.connection }),
        ...overrides
    };
    const signingSecret = String(d.secret || '');
    const ready = () => d.enabled() === true && signingSecret.length >= 16;
    const groupedAuditReads = !Object.hasOwn(overrides, 'decisionsLoader') &&
        !Object.hasOwn(overrides, 'atomicAuditsLoader');
    async function state(req, session) {
        const actorUserId = req.session?.userId, employeeId = req.params?.id;
        let team;
        try { team = require('../userTeamScopeService').normalizeRequiredUserTeam(req.session?.userTeam); }
        catch { throw blocked('SCOPE',403); }
        const company_kod = req.session?.companyInUse;
        if (![actorUserId,employeeId,company_kod].every(v => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v)) ||
            typeof team !== 'string' || !team.trim() || !req.sessionID) throw blocked('SCOPE',403);
        const currentEmployee = await d.employeeModel.findOne({ _id: employeeId, team, company_kod })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        if (!currentEmployee) throw blocked('NOT_FOUND',404);
        const scope = { team, company_kod, kodikos: currentEmployee.kodikos };
        await authorizeEmployeeMaintenance({ actorUserId, employeeId, scope,
            current: currentEmployee, session, userModel:d.userModel, privilegeModel:d.privilegeModel });
        const query = d.historyModel.find(scope);
        query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        const completeHistoryRows = await query.select('+history_reference_fence').session(session).lean();
        let approvedHistoryDecisions, atomicBoundaryAudits;
        if (groupedAuditReads) {
            ({ approvedHistoryDecisions, atomicBoundaryAudits } = await require('./employeeHistoryMaintenanceApprovalService')
                .loadMaintenanceApprovalInput({ scope, currentEmployee }, d.auditModel, session));
        } else {
            approvedHistoryDecisions = await d.decisionsLoader({ scope, currentEmployee }, d.auditModel, session);
            atomicBoundaryAudits = await d.atomicAuditsLoader({ scope, currentEmployee }, d.auditModel, session);
        }
        let protectedReferenceSummary = {};
        const references = require('./employeeHistoryReferenceAuditService');
        if (d.referenceChecker === references.findHistoryIdReferences &&
            typeof references.findHistoryIdReferenceSummary === 'function') {
            protectedReferenceSummary = await references.findHistoryIdReferenceSummary({ connection:d.connection,
                historyIds:completeHistoryRows.map(id), session });
        } else {
            for (const row of completeHistoryRows)
                protectedReferenceSummary[id(row)] = await d.referenceChecker({ connection:d.connection,
                    historyIds:[id(row)], session });
        }
        return { scope, currentEmployee, completeHistoryRows, approvedHistoryDecisions, atomicBoundaryAudits, protectedReferenceSummary,
            actorUserId, employeeId };
    }
    async function prepare(input, request, session, options = {}) {
        let inspected, inspectionProof;
        if (options.allowMissing) {
            inspected = decide(input, request, null, { ...options, inspectOnly:true });
            if (inspected.missingFields.length) return inspected;
            inspectionProof = hash({ input, request, options });
        }
        // Determine the affected period from server-recorded History, NOT the
        // browser, then require independently loaded protection state.
        let auditTarget = inspected?.targetId;
        if (!inspected) {
            const initial = prepareApprovedHistoryAtomicProposal(input, request);
            if (!['ATOMIC_NEW_VERSION_PREPARED_READ_ONLY',
                'EXISTING_ERROR_CORRECTION_PREPARED_READ_ONLY'].includes(initial.status))
                throw blocked(initial.status);
            auditTarget = request.kind === 'NEW_CHANGE'
                ? require('./employeeApprovedHistoryChangeIntentService')
                    .planApprovedHistoryChangeIntent(input, request).fromHistoryId
                : initial.targetHistoryId;
        }
        const original = input.completeHistoryRows.find(row => id(row) === auditTarget);
        if (!original) throw blocked('TARGET_NOT_FOUND');
        const from = request.effectiveFrom;
        const period = { from, to:request.kind === 'NEW_CHANGE'
            ? null : day(original[C.END]) };
        const protection = await d.periodProtection({ input, period, session, dependencies: d,
            preserveOriginal: true });
        // Keep the completed pure inspection only while its FULL typed evidence
        // and request are unchanged. This is call-local, never a request cache.
        // Period protection is still freshly read and checked; commit retains
        // every fence, reauthorization, reread and final verification below.
        if (inspected && inspectionProof === hash({ input, request, options })) {
            if (!options.inspectOnly) assertAtomicPeriodProtection(protection);
            return { ...inspected, sourceFingerprint: atomicPlanFingerprint(input, protection, options),
                protectionProof: protection };
        }
        return decide(input, request, protection, options);
    }
    function signature(payload) {
        const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return encoded + '.' + crypto.createHmac('sha256', signingSecret).update(encoded).digest('base64url');
    }
    function verify(token) {
        if (typeof token !== 'string' || token.length > 4096) throw blocked('CONFIRMATION',400);
        const [data, sign, extra] = token.split('.');
        if (!data || !sign || extra) throw blocked('CONFIRMATION',400);
        const actual = crypto.createHmac('sha256', signingSecret).update(data).digest();
        let given;
        try { given = Buffer.from(sign,'base64url'); } catch { throw blocked('CONFIRMATION',400); }
        if (given.length !== actual.length || !crypto.timingSafeEqual(given,actual))
            throw blocked('CONFIRMATION',400);
        try { return JSON.parse(Buffer.from(data,'base64url').toString('utf8')); }
        catch { throw blocked('CONFIRMATION',400); }
    }
    const binding = (req,input,change,plan) => hash({ version: VERSION,
        actor: input.actorUserId, session: req.sessionID, employeeId: input.employeeId,
        scope: input.scope, source: plan.sourceFingerprint, request: change });
    async function preview(req, change) {
        if (!ready()) throw blocked('DISABLED',403);
        return W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
            const input = await state(req,session), plan = await prepare(input,change,session);
            const payload = { version:VERSION, expiresAt:d.now()+900000,
                binding:binding(req,input,change,plan), fingerprint:plan.sourceFingerprint };
            return { success:true, previewOnly:true, status:'READY_FOR_SIGNED_ATOMIC_COMMIT',
                kind:plan.kind, historyTargetId:plan.targetId,
                plannedOldRowUpdate: Boolean(plan.targetPatch), plannedNewRowInsert:Boolean(plan.nextRow),
                plannedVerifiedLogicalBoundary: Boolean(plan.virtualClose),
                approval:signature(payload) };
        }, null, {readConcern:{level:'snapshot'}, readPreference:'primary'});
    }
    async function apply(req,change,confirmation) {
        if (!ready()) throw blocked('DISABLED',403);
        const signed = verify(confirmation);
        if (signed.version !== VERSION || !Number.isSafeInteger(signed.expiresAt) || signed.expiresAt < d.now())
            throw blocked('EXPIRED_CONFIRMATION');
        return W.inProfileTransaction(d.connection,d.capabilityProbe,async session => {
            const input = await state(req,session);
            const plan = await prepare(input,change,session);
            if (signed.fingerprint !== plan.sourceFingerprint ||
                signed.binding !== binding(req,input,change,plan)) throw blocked('STALE_CONFIRMATION');
            return commit(req,change,input,plan,session);
        }, null, {readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});
    }
    async function commit(req,change,input,plan,session,employeeSave = false) {
            if (plan.missingFields?.length || !plan.protectionProof) throw blocked('NEW_TERMS_INCOMPLETE');
            await W.acquireEmployeeMutationFence({ filter:input.scope, employeeId:input.employeeId,
                employeeModel:d.employeeModel, session, notFoundCode:'EMPLOYEE_APPROVED_ATOMIC_STALE' });
            const afterFence = await state(req,session);
            const old = input.currentEmployee, current = afterFence.currentEmployee;
            const withoutFence = { ...current };
            if (Object.hasOwn(old,'employee_profile_mutation_sequence'))
                withoutFence.employee_profile_mutation_sequence = old.employee_profile_mutation_sequence;
            else delete withoutFence.employee_profile_mutation_sequence;
            if (!equal(withoutFence, old) ||
                !equal(ordered(afterFence.completeHistoryRows),ordered(input.completeHistoryRows)) ||
                !equal(afterFence.approvedHistoryDecisions,input.approvedHistoryDecisions) ||
                !equal(afterFence.atomicBoundaryAudits,input.atomicBoundaryAudits) ||
                !equal(afterFence.protectedReferenceSummary,input.protectedReferenceSummary))
                throw blocked('CONCURRENT_CHANGE');
            await claimUnchangedHistoryReferences({ historyRows: input.completeHistoryRows,
                scope:input.scope, historyModel:d.historyModel, session });
            // Claim the company period sequence before accepting absent
            // period controls: Mongo snapshot reads are not predicate locks.
            await d.claimCompanyPeriod({connection:d.connection,scope:input.scope,session});
            // Claim the *raw BSON* protection documents. The initial OPEN
            // observation alone is not a concurrency guarantee.
            await d.claimPeriodProtection({ protection:plan.protectionProof,
                connection:d.connection, session });
            if (!(await d.auditReady()))
                throw blocked('AUDIT_UNAVAILABLE',503);
            const before = input.completeHistoryRows.find(row => id(row) === plan.targetId);
            if (plan.targetPatch) {
                const patched = await d.historyModel.updateOne({ ...input.scope, _id:before._id },
                    { $set:plan.targetPatch }, { session, runValidators:true, timestamps:false });
                if (patched.matchedCount !== 1) throw blocked('TARGET_STALE');
            }
            // For a NEW_CHANGE there is intentionally no updateOne against
            // the previous History row, even when it is not referenced.
            let newId=null;
            if (plan.nextRow) {
                const seq = Math.max(0,...input.completeHistoryRows.map(row=>Number(row.aa_eggrafhs)||0))+1;
                if (!Number.isSafeInteger(seq)) throw blocked('SEQUENCE');
                const row = { ...plan.nextRow, _id:new mongoose.Types.ObjectId(),
                    aa_eggrafhs:String(seq).padStart(4,'0') };
                const document = d.buildHistoryDocument(d.historyModel,row);
                await document.validate?.();
                const inserted = await d.historyModel.create([document],{ session });
                if (inserted.length !== 1) throw blocked('INSERT_FAILED');
                newId=String(inserted[0]._id);
            }
            const written = await d.employeeModel.updateOne({ ...input.scope, _id:input.employeeId },
                { $set:plan.employeePatch }, { session, runValidators:true });
            if (written.matchedCount !== 1) throw blocked('EMPLOYEE_STALE');
            const persistedForAudit = await state(req,session);
            const committedSuccessor = plan.nextRow && persistedForAudit.completeHistoryRows
                .find(row => id(row) === newId);
            const immutableBoundary = plan.virtualClose && B.receipt({
                scope:input.scope, currentEmployee:current, prior:before,
                businessPrior:plan.targetBusinessBefore,
                approvedEdition:plan.approvedEdition,
                successor:committedSuccessor, effectiveFrom:change.effectiveFrom });
            const operation = { employeeScope:{...input.scope,employee_id:current._id}, repairedAt:new Date(d.now()),
                mutationSource:OPERATION, currentBefore:old,
                historyBefore:input.completeHistoryRows,
                historyAfter:persistedForAudit.completeHistoryRows,
                survivingHistoryIds:persistedForAudit.completeHistoryRows.map(id),
                deletedLegacyHistoryIds:[],
                diagnostics:{ version:VERSION, outcome:'COMMITTED', operation:plan.kind, actorUserId:String(input.actorUserId),
                    ...(immutableBoundary ? {boundary:immutableBoundary} : {}),
                    fromHistoryId:plan.targetId, insertedHistoryId:newId,
                    priorApprovalIds:input.approvedHistoryDecisions.map(a=>String(a._id)),
                    sourceFingerprint:plan.sourceFingerprint,
                    effectiveFrom:change.effectiveFrom,
                    changedFields:[...TERMS,CONTRACT].filter(field=>Object.hasOwn(plan.employeePatch,field)),
                    finalizedRecordsModified:false } };
            const audits = await d.auditModel.create([operation], { session });
            if (audits.length !== 1) throw blocked('AUDIT_WRITE_FAILED');
            const final = await state(req,session);
            const oldById=new Map(input.completeHistoryRows.map(row=>[id(row),row]));
            for (const row of final.completeHistoryRows) {
                if (!oldById.has(id(row))) {
                    if (!plan.nextRow || id(row)!==newId) throw blocked('UNPLANNED_INSERT');
                } else if (!equal(row, id(row)===plan.targetId && plan.targetPatch
                    ? { ...oldById.get(id(row)), ...plan.targetPatch }
                    : oldById.get(id(row)))) throw blocked('UNPLANNED_OLD_HISTORY_MUTATION');
            }
            if (final.completeHistoryRows.length !== input.completeHistoryRows.length+(plan.nextRow?1:0))
                throw blocked('FINAL_HISTORY_COUNT');
            for(const [field,value] of Object.entries(plan.employeePatch))
                if(!equal(final.currentEmployee[field],value)) throw blocked('FINAL_EMPLOYEE_FIELD');
            const effective = proposalHistoryState(final);
            if(effective.decisions.length !== plan.originalApprovedCount)
                throw blocked('PRIOR_APPROVAL_LOST');
            const status = proveNoNewHistoryProblem({input,
                projectedBefore:proposalHistoryState(input).historyRows,
                projectedAfter:effective.historyRows,
                currentAfter:final.currentEmployee, targetId:plan.targetId,
                newRow:plan.nextRow && effective.historyRows.find(row=>id(row)===newId)});
            return {success:true,employeeUpdated:true,historyUpdated:true,
                historyStatus:status,historyChangedRows:(plan.targetPatch?1:0)+(plan.nextRow?1:0),
                operation:plan.kind, insertedHistoryId:newId,auditId:String(audits[0]._id),
                ...(employeeSave ? {employee:final.currentEmployee} : {})};
    }
    // The normal Employee Save owns its transaction and signed confirmation.
    // Reuse the same authenticated snapshot, period/reference claims, physical
    // writer and immutable boundary as the standalone atomic endpoint.
    async function prepareEmployeeSave(req,change,session,options = {}) {
        if (!ready()) throw blocked('DISABLED',403);
        const input = await state(req,session);
        const baseline = options.baselineEmployee ? { ...input, currentEmployee:options.baselineEmployee } : input;
        const plan = await prepare(baseline,change,session,{ ...options,allowMissing:true });
        const model = require('../../models/ergazomenoi').ErgazomenoiModel;
        const document = model.hydrate(input.currentEmployee);
        document.set(plan.employeePatch);
        await document.validate();
        plan.employeePatch = Object.fromEntries(Object.keys(plan.employeePatch)
            .map(field => [field,document.get(field)]));
        return { input,plan, commit:() => commit(req,change,input,plan,session,true) };
    }
    // Stage5F: read-only, scoped, authenticated context.  Identifiers and
    // approved editions are derived under the same server-side scope as apply.
    // This endpoint never infers a CLEAN state or amends a physical row.
    async function context(req) {
        if (!ready()) throw blocked('DISABLED',403);
        return W.inProfileTransaction(d.connection,d.capabilityProbe,async session => {
            const input = await state(req,session);
            const effective = proposalHistoryState(input).historyRows;
            const hire = day(input.currentEmployee[C.HIRE]);
            const currentRows = effective.filter(row => day(row[C.HIRE]) === hire && day(row[C.START]))
                .sort((a,b) => day(b[C.START]).localeCompare(day(a[C.START])));
            const unique = currentRows.length > 0 &&
                (currentRows.length === 1 || day(currentRows[0][C.START]) !== day(currentRows[1][C.START]));
            const current = input.currentEmployee;
            return {success:true,contextOnly:true,pendingHistory:!!current.employee_pending_history,
                currentTerms:Object.fromEntries(TERMS.map(field => [field,current[field] ?? null])),
                currentContract:String(current[CONTRACT] ?? ''),
                effectiveFrom:unique ? day(currentRows[0][C.START]) : null,
                targetHistoryId:unique ? id(currentRows[0]) : null};
        },null,{readConcern:{level:'snapshot'},readPreference:'primary'});
    }
    return { preview,apply,context,prepareEmployeeSave, isEnabled:ready };
}
module.exports = { VERSION, FLAG, OPERATION, blocked, decide, proveNoNewHistoryProblem,
    createApprovedHistoryAtomicMaintenanceService };
