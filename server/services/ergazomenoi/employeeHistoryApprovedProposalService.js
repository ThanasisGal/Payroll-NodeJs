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
const Certification = require('./employeeHistoryProfileCertificationService');
const Completion = require('./employeeHistoryApprovedCompletionService');
const References = require('./employeeHistoryApprovedReferenceInvariantService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { assertImportProtection } = require('./employeeHistoryProposalImportProtectionService');
const { inspectEmployeeHistoryProposedRowSave } = require('./employeeHistorySaveValidationService');
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
    async function prepare(req, proposal, input, session = null, certify = false) {
        P.request(proposal);
        let baseline;
        const catalogs = await d.loadCatalogs({ session });
        try { baseline = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection: proposal.selection }); }
        catch { throw P.failure('STALE'); }
        const selected = baseline.caseSelection.selectedCase;
        if (!baseline.workbook || !selected || !['UPDATE', 'INSERT'].includes(selected.operation)) throw P.failure('CASE');
        if (certify && selected.operation !== 'UPDATE') throw P.failure('CASE');
        const original = input.completeHistoryRows.find(row => String(row._id) === selected.targetHistoryId);
        const invalid = (issues, reason = 'INCOMPLETE', statusCode = 422) => {
            const error = P.failure(reason, statusCode);
            error.problems = require('./employeeHistoryApprovedProposalDiagnostics').incompleteProblems({ issues });
            return error;
        };
        try {
            authorizeCase(input, selected);
            let completions;
            try { completions = E.prepareLocalCompletion(baseline, proposal.completion, req, catalogs); }
            catch (error) {
                if (error.validationIssues?.length) throw invalid(error.validationIssues, 'VALUE');
                throw P.failure(error.statusCode === 409 ? 'STALE' : 'VALUE', [403, 409].includes(error.statusCode) ? error.statusCode : 422);
            }
            const evidence = completions.find(item => item.entry.role === 'EVIDENCE')?.raw ?? '';
            const declaration = completions.find(item => item.entry.role === 'DECLARATION')?.raw ?? 'Όχι';
            if (typeof evidence !== 'string' || evidence.length > 4000 || !['Ναι', 'Όχι'].includes(declaration)) throw P.failure('VALUE', 422);
            const answers = new Map(completions.filter(item => item.entry.role === 'ANSWER').map(item => [item.entry, item]));
            if (selected.operation === 'INSERT') {
                const missing = baseline.editableCells.filter(entry => entry.role === 'ANSWER' && !answers.has(entry));
                if (missing.length) throw invalid(missing.map(entry => ({ reason: 'REQUIRED_PROFILE_FIELD',
                    field: entry.canonicalField, check: 'ANSWER_NOT_PROVIDED' })));
            }
            if (original && isInactiveHistoryRow(original)) throw P.failure('CASE');
            for (const entry of answers.keys()) if (!allowed.has(entry.canonicalField)) throw P.failure('LIFECYCLE', 422);
            let candidate = I.buildProposalCandidate(input, baseline, answers);
            const patch = {};
            for (const [entry, answer] of answers) {
                const field = entry.canonicalField, path = d.historyModel.schema.path(field);
                if (!path) throw P.failure('VALUE', 422);
                // Mongoose's array path.cast(null) can produce [null]. A blank
                // answer is never a list containing an unknown weekday.
                const value = answer.raw === null ? null : path.cast(answer.raw);
                if (selected.operation === 'UPDATE' && field === Profile.DAYS &&
                    Certification.inactiveEmptyDays(original, { ...original, ...candidate, [field]: value })) continue;
                if (selected.operation === 'INSERT' || !I.sameValue(field, original[field], value) ||
                    Object.hasOwn(original, field) && !A.equal(original[field], value)) patch[field] = value;
            }
            if (selected.operation === 'UPDATE') candidate = { ...original, ...patch };
            else {
                Object.assign(candidate, patch, { [C.HIRE]: Profile.calendarDate(selected.period.hire),
                    [C.START]: Profile.calendarDate(selected.period.from), [C.END]: Profile.calendarDate(selected.period.to),
                    afora_proslhpsh: false, afora_allagh_oron_ergasias: true });
            }
            if (selected.operation === 'UPDATE' && !Object.keys(patch).length) throw P.failure('NO_CHANGES', 422);
            const blockers = [], addBlocker = error => blockers.push(error);
            // Validate the target's facts with the SAME strict row checks as the
            // full verifier. Never canonicalize an isolated row as an entire history.
            const inspected = inspectEmployeeHistoryProposedRowSave(Certification.validationView(candidate, original));
            if (inspected.issues.length) {
                const onlyDates = inspected.issues.every(issue => ['PERIOD_START_BEFORE_HIRE', 'PERIOD_END_BEFORE_START',
                    'INVALID_CALENDAR_DATE', 'REQUIRED_DATE'].includes(issue.check));
                addBlocker(invalid(inspected.issues, onlyDates ? 'DATES' : 'INCOMPLETE'));
            }
            // Cycles, overlaps and new coverage gaps are checked against the complete
            // persisted history. Unrelated legacy fact omissions need no cleanup.
            let checked;
            try { checked = I.validateCandidate(input, baseline, new Map([...answers].filter(([entry]) =>
                !(entry.canonicalField === Profile.DAYS && Certification.inactiveEmptyDays(original, candidate)))
                .map(([entry, answer]) => [entry, { ...answer, raw: candidate[entry.canonicalField] ?? answer.raw }]))); }
            catch (error) {
                const issueReason = error.validationIssues?.[0]?.reason;
                const reason = error.importReason === 'COVERAGE_GAP' && issueReason && issueReason !== 'HISTORY_COVERAGE_MISSING' ?
                    issueReason : error.importReason || error.code || 'VALUE';
                addBlocker(invalid(error.validationIssues || [{ reason, check: 'HISTORY_CONTEXT' }], reason, error.statusCode || 422));
            }
            // Validate complete business facts without applying defaults/normalizers.
            let normalized = null;
            try { normalized = Profile.normalizeEmploymentProfileSubmission(Certification.validationView(candidate, original), Certification.validationView(candidate, original)); }
            catch (error) { if (!inspected.issues.length) throw error; }
            if (normalized) {
                const missing = Certification.fields.filter(field => !I.sameValue(field, candidate[field], normalized[field]) &&
                    !(field === Profile.DAYS && Certification.inactiveEmptyDays(original, candidate)));
                if (missing.length) addBlocker(invalid(missing.map(field => ({ reason: 'PROFILE_VALUE_NOT_RECORDED', field })), 'VALUE'));
            }
            let certification = null;
            const profileDiagnosis = original ? Certification.diagnosis(original, candidate, patch) : null;
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
                const breakChanged = [...Profile.BREAK_FIELDS, 'hmeromhnia_isxyos_dialleimatos_apo'].some(field => Object.hasOwn(patch, field));
                const anchor = Profile.calendarDate(candidate.hmeromhnia_isxyos_dialleimatos_apo);
                const recordedBreakAnchor = original.afora_allagh_dialleimatos === true && anchor &&
                    I.sameValue('hmeromhnia_isxyos_dialleimatos_apo', original.hmeromhnia_isxyos_dialleimatos_apo, anchor);
                const needsBreakCertification = breakChanged && !recordedBreakAnchor && original.afora_allagh_dialleimatos === true;
                const needsCertification = needsBreakCertification || arrangementChanged && (!Certification.validRecordedProfile(original) ||
                    normalized && !A.equal(candidate[Profile.TYPE_VERSION], normalized[Profile.TYPE_VERSION]));
                if (needsCertification) {
                    const planned = normalized ? Certification.planCertification(original, candidate, answers) : { missing: [], certificate: null };
                    if (!certify || !planned.certificate || planned.missing.length || !evidence.trim()) {
                        const error = P.failure('PROFILE_CERTIFICATION_REQUIRED', 422);
                        error.profileDiagnosis = profileDiagnosis;
                        error.certificationAvailable = input.access.mode === ACCESS_MODES.ADMIN_FULL;
                        error.problems = require('./employeeHistoryApprovedProposalDiagnostics').incompleteProblems({ issues: [
                            { reason: 'PROFILE_CERTIFICATION_REQUIRED', check: 'SELECTED_PROFILE_CERTIFICATION' },
                            ...planned.missing.map(field => ({ reason: 'CERTIFICATION_EXPLICIT_VALUE_REQUIRED', field })),
                            ...(!evidence.trim() ? [{ reason: 'CERTIFICATION_EVIDENCE_REQUIRED', check: 'CERTIFICATION_EVIDENCE_REQUIRED' }] : [])] });
                        addBlocker(error);
                    } else if (input.access.mode !== ACCESS_MODES.ADMIN_FULL) addBlocker(P.failure('CERTIFICATION_RIGHTS', 403));
                    else {
                        certification = planned.certificate;
                        if (needsBreakCertification && original.afora_allagh_dialleimatos === true && anchor &&
                            I.sameValue(C.START, anchor, candidate[C.START]) &&
                            [...answers.keys()].some(entry => entry.canonicalField === 'hmeromhnia_isxyos_dialleimatos_apo'))
                            certification.breakScope = { fieldId: 'hmeromhnia_isxyos_dialleimatos_apo',
                                before: original.hmeromhnia_isxyos_dialleimatos_apo ?? null, after: anchor,
                                evidence, source: 'EXPLICIT_SELECTED_BREAK_CERTIFICATION' };
                        Object.assign(patch, planned.patch); candidate = { ...original, ...patch };
                    }
                } else if (certify) throw P.failure('CERTIFICATION_NOT_REQUIRED', 422);
                if (breakChanged && (!anchor || !recordedBreakAnchor && !certification?.breakScope)) addBlocker(P.failure('BREAK_SCOPE', 422));
            }
            let referenceEvidence = null;
            for (const id of selected.operation === 'UPDATE' ? [selected.targetHistoryId] : selected.sourceHistoryIds)
                if (!Array.isArray(input.protectedReferenceSummary[id])) addBlocker(P.failure('PROTECTION_UNKNOWN'));
            try {
                referenceEvidence = await References.inspectApprovedReferences({ connection: d.connection, scope: input.scope, session,
                    historyRows: input.completeHistoryRows.filter(row => (selected.operation === 'UPDATE' ? [selected.targetHistoryId] : selected.sourceHistoryIds).includes(String(row._id))) });
            } catch (error) { if (!error.reason) throw error; addBlocker(error); }
            const branch = original?.ypokatasthma ?? input.currentEmployee.ypokatasthma;
            let protection;
            if (typeof branch !== 'string' || !branch.trim()) addBlocker(P.failure('PROTECTION_UNKNOWN'));
            else try {
                // A failed overlap/cycle check does not conceal independently
                // known reference/period protection. This computes only the
                // bounded union of the actual BEFORE/AFTER dates, never a result.
                const affected = Completion.affectedPeriod(input, candidate, original, selected.operation);
                protection = await protectionFor(input, branch, affected, session);
                if (checked) checked.affected = affected;
            }
            catch (error) {
                if (error.importReason === 'DATES') addBlocker(P.failure('PROTECTION_UNKNOWN'));
                else { if (!error.reason) throw error; addBlocker(error); }
            }
            if (blockers.length) {
                const error = blockers[0];
                error.blockedChecks = [...new Set(blockers.map(item => item.reason))];
                error.problems = [...new Map(blockers.flatMap(item => item.problems || require('./employeeHistoryApprovedProposalDiagnostics')
                    .incompleteProblems({ issues: [{ reason: item.reason, check: 'HISTORY_CONTEXT' }] }))
                    .map(problem => [`${problem.code}:${problem.fieldId}:${problem.check}`, problem])).values()];
                const certificationBlocker = blockers.find(item => item.reason === 'PROFILE_CERTIFICATION_REQUIRED');
                if (certificationBlocker) {
                    error.profileDiagnosis = certificationBlocker.profileDiagnosis;
                    error.certificationAvailable = certificationBlocker.certificationAvailable;
                }
                throw error;
            }
            const contents = { operation: selected.operation, caseId: selected.id, targetHistoryId: selected.targetHistoryId,
                period: checked.period, affected: checked.affected, branch, patch, candidate, evidence, declaration, certification, referenceEvidence };
            const fingerprint = A.hash({ version: P.VERSION, snapshot: baseline.snapshotFingerprint, contents,
                protection: { controls: A.ordered(protection.controls), snapshots: A.ordered(protection.snapshots) } });
            return { ...contents, protection, fingerprint, snapshot: baseline.snapshotFingerprint,
                rows: Object.entries(selected.operation === 'UPDATE' ? patch : candidate).filter(([field]) => allowed.has(field) || field === C.HIRE)
                    .map(([field, after]) => ({ fieldId: field, field: labels[field] || field,
                        before: selected.operation === 'UPDATE' ? original[field] ?? null : null, after })) };
        } catch (error) {
            if (!error.problems?.length && error.reason) error.problems = require('./employeeHistoryApprovedProposalDiagnostics')
                .incompleteProblems({ issues: [{ reason: error.reason, check: 'HISTORY_CONTEXT' }] });
            error.proposalCase = { operation: selected.operation, historySequence: original?.aa_eggrafhs || null,
                period: { from: selected.period.from, to: selected.period.to } };
            throw error;
        }
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
        let references, protection;
        try {
            references = await References.inspectApprovedReferences({ connection: d.connection, scope: input.scope, session,
                historyRows: input.completeHistoryRows.filter(row => audit.diagnostics.referenceHistoryIds.includes(String(row._id))) });
            protection = await protectionFor(input, audit.diagnostics.branch, audit.diagnostics.affectedPeriod, session);
        } catch (cause) {
            const error = P.failure(cause.reason ? 'COMMITTED_STATE_CHANGED' : 'COMMITTED_VERIFICATION_REQUIRED', cause.reason ? 409 : 503);
            error.saved = true; throw error;
        }
        if (!References.sameReferenceEvidence(audit.diagnostics.referenceEvidence, references) ||
            !A.equal({ controls: A.ordered(protection.controls), snapshots: A.ordered(protection.snapshots) },
                { controls: A.ordered(audit.diagnostics.periodProtection.controls), snapshots: A.ordered(audit.diagnostics.periodProtection.snapshots) })) {
            const error = P.failure('COMMITTED_STATE_CHANGED'); error.saved = true; throw error;
        }
        return { success: true, saved: true, applied: false, alreadyApplied: true, outcome: 'COMMITTED',
            ...Completion.verifyCompletion(input, audit), approvalId: payload.approvalId, auditId: String(audit._id),
            operation: audit.diagnostics.operation, targetHistoryId: audit.diagnostics.targetHistoryId };
    }
    async function preview(req, proposal, certify = false) {
        try {
            // A consistent snapshot, with no claims, writes or session-store
            // mutation. A preview must never combine different stored versions.
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                const input = await read(req, session), prepared = await prepare(req, proposal, input, session, certify);
                const payload = { version: P.VERSION, purpose: 'APPLY', certificationHash: prepared.certification ? A.hash(prepared.certification) : null, approvalId: crypto.randomBytes(32).toString('hex'),
                    expiresAt: d.now() + 15 * 60 * 1000, binding: binding(req, input),
                    fingerprint: prepared.fingerprint, requestHash: A.hash(proposal), approved: prepared.declaration === 'Ναι',
                    executionEnabled: isEnabled() && prepared.declaration === 'Ναι' };
                return { success: true, saved: false, previewOnly: true, executionEnabled: payload.executionEnabled, approved: payload.approved,
                    operation: prepared.operation, caseId: prepared.caseId, targetHistoryId: prepared.targetHistoryId,
                    employeeCode: input.scope.kodikos, historySequence: input.completeHistoryRows.find(row => String(row._id) === prepared.targetHistoryId)?.aa_eggrafhs || null,
                    period: prepared.period, rows: prepared.rows, evidence: prepared.evidence, declaration: prepared.declaration,
                    certification: prepared.certification,
                    beforePeriodEvidence: prepared.affected.beforeEvidence || null,
                    protectedReferences: Object.values(prepared.referenceEvidence).filter(Array.isArray).flat()
                        .map(reference => ({ collection: reference.collection, documentId: reference.documentId, bsonSha256: reference.bsonSha256 })),
                    physicalWrites: { history: { operation: prepared.operation, targetHistoryId: prepared.targetHistoryId,
                        fields: Object.keys(prepared.patch), revisionField: 'updatedAt' },
                        employee: { fields: ['employee_profile_mutation_sequence'] }, audit: { rows: 1 },
                        referencePayloadsModified: false, finalizedResultsModified: false },
                    certificationApproval: prepared.certification ? { token: P.sign({ ...payload, purpose: 'PROFILE_CERTIFICATION' }, signingSecret) } : null,
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
        if (!(P.exactKeys(body, ['proposal', 'approval']) || P.exactKeys(body, ['proposal', 'approval', 'certification'])) ||
            !P.exactKeys(body.approval, ['token', 'confirmed']) || body.approval.confirmed !== true)
            throw P.failure('APPROVAL', 400);
        P.request(body.proposal);
        const payload = P.verify(body.approval.token, signingSecret);
        if (payload.purpose !== 'APPLY') throw P.failure('APPROVAL');
        let certificationApproval = null;
        if (payload.certificationHash) {
            if (!P.exactKeys(body.certification, ['token', 'confirmed']) || body.certification.confirmed !== true)
                throw P.failure('PROFILE_CERTIFICATION_REQUIRED', 422);
            certificationApproval = P.verify(body.certification.token, signingSecret);
            if (!A.equal(certificationApproval, { ...payload, purpose: 'PROFILE_CERTIFICATION' })) throw P.failure('APPROVAL');
        } else if (body.certification) throw P.failure('APPROVAL');
        if (payload.approved !== true) throw P.failure('APPROVAL_REQUIRED', 422);
        if (payload.executionEnabled !== true) throw P.failure('DISABLED', 403);
        try {
            const committed = await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
                const completed = await receipt(input, payload, session); if (completed) return completed;
                if (payload.expiresAt < d.now()) throw P.failure('EXPIRED');
                const prepared = await prepare(req, body.proposal, input, session, Boolean(certificationApproval));
                if (prepared.declaration !== 'Ναι') throw P.failure('APPROVAL_REQUIRED', 422);
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
                await References.claimApprovedReferences(d.connection, prepared.referenceEvidence, session, payload.approvalId);
                const current = await d.employeeModel.findOne({ ...input.scope, _id: input.employeeId })
                    .select('+employee_profile_mutation_sequence').session(session).lean();
                const expectedCurrent = { ...input.currentEmployee,
                    employee_profile_mutation_sequence: (input.currentEmployee.employee_profile_mutation_sequence || 0) + 1 };
                if (!A.equal(current, expectedCurrent)) throw P.failure('STALE');
                const proof = P.sealExecution({ ...prepared, scope: input.scope, current, originalCurrent: input.currentEmployee,
                    before: input.completeHistoryRows, payload, certificationApproval, isEnabled, actorUserId: input.actorUserId });
                const result = await W.executeEmployeeHistoryApprovedProposalPlan({ proof, employeeId: input.employeeId, session,
                    employeeModel: d.employeeModel, historyModel: d.historyModel, auditModel: d.auditModel });
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                return result;
            }, null, P.transactionOptions);
            // A new majority/snapshot read AFTER transaction commit. The writer's
            // in-transaction reread alone is not a persisted completion result.
            let verified;
            try { verified = await reconcile(req, { proposal: body.proposal, token: body.approval.token }); }
            catch (error) {
                if (error.saved === true) throw error;
                const failure = P.failure('COMMITTED_VERIFICATION_REQUIRED', 503); failure.saved = true; throw failure;
            }
            return { ...verified, applied: committed.applied, alreadyApplied: committed.alreadyApplied };
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
        if (payload.purpose !== 'APPLY') throw P.failure('APPROVAL');
        return W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
            const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
            const completed = await receipt(input, payload, session);
            if (!completed) throw P.failure('COMMIT_UNCERTAIN', 503);
            return { ...completed, reconciledReadOnly: true };
        }, null, P.transactionOptions);
    }
    return { preview, certificationPreview: (req, proposal) => preview(req, proposal, true), apply, reconcile, isEnabled };
}
module.exports = { createEmployeeHistoryApprovedProposalService };
