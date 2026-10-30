'use strict';

// Pure composition of the established planners. This version is deliberately
// outside every writer/approval contract. It never opens a connection or session.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { createHash } = require('node:crypto');
const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { canonicalizeEmployeeHistory, calculateCanonicalDiff } = require('./employeeHistoryCanonicalizationService');
const { planEmployeeHistoryAutomaticReconstruction, planEmployeeHistoryAutomaticSettlement,
    verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { planEvidencedMissingHistoryPeriods } = require('./employeeHistoryMissingPeriodCorrectionService');
const { planEmployeeLegacyOpenCycleCleanup } = require('./employeeLegacyOpenCycleCleanupService');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { partitionHistoryUpdateReferences } = require('./employeeHistoryReferenceSemanticsService');
const { resolveEmployeeHistoryMultipleSafeChoice } = require('./employeeHistoryMultipleSafeResolutionPlannerService');
const { planEmployeeHistoryUnrecordedBusinessFacts, resolveEmployeeHistoryBusinessFacts } =
    require('./employeeHistoryBusinessFactResolutionPlannerService');
const { resolveEmployeeHistoryUserConfirmedCorrection } = require('./employeeHistoryUserConfirmedCorrectionPlannerService');
const { planEmployeeHistoryUniqueSafeRepair } = require('./employeeHistoryUniqueSafeRepairPlannerService');
const VERSION = 'employee-history-settlement-coordinator:preview:v1';
const id = row => String(row._id);
const day = value => calendarDate(value)?.toISOString().slice(0,10) || null;
const present = value => value !== undefined && value !== null && value !== '';
const canonicalize = input => canonicalizeEmployeeHistory({ ...input, strictProfileEvidence: true });
const ALLOWED_ASSUMPTIONS = new Set(['EXISTING_INITIAL_START_AFTER_HIRE', 'HISTORICAL_NON_EMPTY_VALUE_CHANGE',
    'CURRENT_EMPLOYEE_PROFILE_FALLBACK', 'LEGACY_ZERO_PLACEHOLDER_REPLACED', 'EXISTING_PERIOD_END_REBUILT',
    'UNDATED_ROW_ATTACHED_TO_UNIQUE_COMPATIBLE_PERIOD']);
const snapshot = input => A.hash({ version: VERSION, scope: input.scope, current: input.currentEmployee,
    rows: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary });
function invalidDecision() {
    return Object.assign(new Error('Η επιχειρησιακή επιλογή χρειάζεται νέο έλεγχο.'),
        { code: 'EMPLOYEE_HISTORY_SETTLEMENT_DECISION_INVALID', statusCode: 409 });
}
function expectedPlanningFailure(error) {
    return [400,409].includes(error?.statusCode) && typeof error.code==='string';
}
function referenceIssue(input) {
    if (!input.protectedReferenceSummary || typeof input.protectedReferenceSummary !== 'object' ||
        Array.isArray(input.protectedReferenceSummary)) return 'REFERENCE_STATE_NOT_LOADED';
    for (const row of input.completeHistoryRows) {
        const references = input.protectedReferenceSummary?.[id(row)];
        if (!Object.hasOwn(input.protectedReferenceSummary,id(row)) || !Array.isArray(references)) return 'REFERENCE_STATE_NOT_LOADED';
        if (references.some(reference => !reference || reference.historyId != null && String(reference.historyId) !== id(row))) {
            return 'INVALID_REFERENCE_EVIDENCE';
        }
        try { if (partitionHistoryUpdateReferences(references).liveDereference.length) return 'LIVE_REFERENCE_BLOCKS_REPAIR'; }
        catch { return 'REFERENCE_SEMANTICS_UNKNOWN'; }
    }
    return null;
}
function lifecycleIssue(input, rows, current, confirmedFacts) {
    const before = input.completeHistoryRows.filter(row => !isInactiveHistoryRow(row));
    const after = rows.filter(row => !isInactiveHistoryRow(row));
    const hires = new Set([input.currentEmployee, ...before].map(row => day(row[C.HIRE])).filter(Boolean));
    if (after.some(row => !hires.has(day(row[C.HIRE])))) return 'UNRECORDED_HIRE_WOULD_BE_CREATED';
    for (const hire of hires) if (!after.some(row => day(row[C.HIRE]) === hire)) return 'RECORDED_CYCLE_WOULD_BE_REMOVED';
    if (!confirmedFacts) {
        const departures = new Set([input.currentEmployee, ...before].filter(row => day(row[C.DEPARTURE]))
            .map(row => `${day(row[C.HIRE])}|${day(row[C.DEPARTURE])}`));
        const resulting = new Set([current, ...after].filter(row => day(row[C.DEPARTURE]))
            .map(row => `${day(row[C.HIRE])}|${day(row[C.DEPARTURE])}`));
        if (!A.equal([...departures].sort(), [...resulting].sort())) return 'RECORDED_DEPARTURE_WOULD_CHANGE';
    }
    for (const row of before) {
        const change = day(row[C.CHANGE]);
        if (change && change > day(row[C.HIRE]) && change === day(row[C.START]) &&
            !after.some(candidate => day(candidate[C.HIRE]) === day(row[C.HIRE]) &&
                day(candidate[C.CHANGE]) === change) && !confirmedFacts) return 'RECORDED_CHANGE_WOULD_BE_REMOVED';
    }
    return null;
}

function preserveUnrecordedNumericFacts(input, rows, numericEvidence = [], assumptions = []) {
    return rows.map(row=>{
        if (isInactiveHistoryRow(row)) return clone(row);
        const result=clone(row),original=input.completeHistoryRows.find(before=>id(before)===id(row));
        for (const [field,type] of Object.entries(C.PROFILE_FIELD_TYPES)) {
            if (type!=='Number' || result[field]!==0 || original?.[field]===0) continue;
            const recorded=input.completeHistoryRows.some(source=>!isInactiveHistoryRow(source) &&
                day(source[C.HIRE])===day(row[C.HIRE]) && day(source[C.START]) &&
                day(source[C.START])<=day(row[C.START]) && source[field]===0);
            const current=input.currentEmployee;
            const currentFrom=day(current[C.START])||day(current[C.CHANGE]);
            const applicableCurrent=day(current[C.HIRE])===day(row[C.HIRE]) && currentFrom &&
                currentFrom<=day(row[C.START]) && current[field]===0;
            const confirmed=numericEvidence.some(fact=>fact.field===field && fact.value===0 &&
                fact.hire===day(row[C.HIRE]) && fact.from===day(row[C.START]));
            const evidencedInitialContinuity=assumptions.some(assumption=>
                assumption.code==='EARLIEST_HISTORICAL_TERMS_CONTINUE_BACK_TO_HIRE' &&
                assumption.from===day(row[C.START]) && input.completeHistoryRows.some(source=>
                    !isInactiveHistoryRow(source) && id(source)===assumption.sourceHistoryId &&
                    day(source[C.HIRE])===day(row[C.HIRE]) && source[field]===0));
            if (recorded || applicableCurrent || confirmed || evidencedInitialContinuity) continue;
            if (original && Object.hasOwn(original,field)) result[field]=clone(original[field]);
            else delete result[field];
        }
        return result;
    });
}

// Protect every referenced ORIGINAL payload, including a survivor that needs
// corrected dates. A detached replacement uses the same canonical metadata as
// the established split planner. No frozen result or reference is rewritten.
function preserveProtectedOriginals(input, desiredRows, replacementByDeletedId = {}) {
    const rows = clone(desiredRows), byId = new Map(rows.map(row => [id(row), row]));
    const remapped = new Map();
    for (const original of input.completeHistoryRows) {
        const target = byId.get(id(original));
        if (isInactiveHistoryRow(original)) {
            if (!target || !A.equal(original, target)) return { reason: 'INACTIVE_ORIGINAL_WOULD_CHANGE' };
            continue;
        }
        if (!input.protectedReferenceSummary[id(original)].length) continue;
        if (!target) {
            const survivor = replacementByDeletedId[id(original)];
            if (!survivor || !byId.has(String(survivor))) return { reason: 'PROTECTED_SURVIVOR_NOT_ESTABLISHED' };
            const retained = { ...clone(original), employment_history_canonical_status: 'REDUNDANT_REFERENCED',
                employment_history_canonical_survivor_id: survivor };
            rows.push(retained); byId.set(id(original), retained);
        } else if (isInactiveHistoryRow(target)) {
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = target;
            if (employment_history_canonical_status !== 'REDUNDANT_REFERENCED' || !A.equal(payload, original)) {
                return { reason: 'PROTECTED_PAYLOAD_WOULD_CHANGE' };
            }
        } else if (!A.equal(original, target)) {
            const detachedId = createHash('sha256').update(A.stringify({ version: VERSION, scope: input.scope, original: id(original), target })).digest('hex').slice(0,24);
            if (byId.has(detachedId)) return { reason: 'PREVIEW_IDENTITY_COLLISION' };
            const replacement = { ...clone(target), _id: detachedId };
            rows.push(replacement); byId.set(detachedId, replacement);
            byId.set(id(original), { ...clone(original), employment_history_canonical_status: 'REDUNDANT_REFERENCED',
                employment_history_canonical_survivor_id: detachedId });
            remapped.set(id(original), detachedId);
        }
    }
    const result = rows.map(row => byId.get(id(row)));
    const plannedRetirements=new Map(result.filter(row=>row.employment_history_canonical_status==='REDUNDANT_REFERENCED')
        .map(row=>[id(row),row.employment_history_canonical_survivor_id]));
    for (const row of result) {
        let survivor = String(row.employment_history_canonical_survivor_id || '');
        const visited = new Set();
        while (survivor && (remapped.has(survivor) || replacementByDeletedId[survivor] || plannedRetirements.has(survivor))) {
            if (visited.has(survivor)) return {reason:'CYCLIC_CANONICAL_REFERENCE'};
            visited.add(survivor);
            survivor=String(remapped.get(survivor)||replacementByDeletedId[survivor]||plannedRetirements.get(survivor));
        }
        if (survivor && survivor!==String(row.employment_history_canonical_survivor_id)) row.employment_history_canonical_survivor_id=survivor;
    }
    // Existing inactive payloads are immutable, including their survivor link.
    if (input.completeHistoryRows.filter(isInactiveHistoryRow).some(original =>
        !A.equal(original, result.find(row => id(row) === id(original))))) return { reason: 'INACTIVE_REFERENCE_WOULD_CHANGE' };
    return { rows: result };
}
function verifyCandidate(input, candidate) {
    const currentPatch = candidate.currentPatch || {}, current = { ...input.currentEmployee, ...currentPatch };
    const recordedRows=preserveUnrecordedNumericFacts(input,candidate.rows,candidate.numericEvidence,candidate.assumptions);
    const normalized = candidateFromCanonical({ ...input, currentEmployee: current }, recordedRows);
    const desired = normalized?.rows || recordedRows;
    const replacements = { ...candidate.replacements, ...normalized?.replacements };
    const preserved = preserveProtectedOriginals(input, desired, replacements);
    if (preserved.reason) return { reason: preserved.reason };
    const issue = lifecycleIssue(input, preserved.rows, current, candidate.confirmedFacts);
    if (issue) return { reason: issue };
    const verification = verifyEmployeeHistoryAutomaticSettlement({ scope: input.scope, currentEmployee: current,
        proposedRows: preserved.rows, requiredHistoryRows: input.completeHistoryRows });
    const strict = canonicalize({ scope: input.scope, currentEmployee: current, historyRows: preserved.rows });
    if (verification.status !== 'CLEAN' || strict.status !== 'CLEAN' || !strict.idempotent || strict.cleanupRequired) {
        return { reason: verification.issues[0] || strict.diagnostics?.reason || 'FINAL_STATE_NOT_CLEAN', verification };
    }
    const diff = calculateCanonicalDiff(input.completeHistoryRows, preserved.rows);
    const newRows = preserved.rows.filter(row => !input.completeHistoryRows.some(before => id(before) === id(row)));
    const noOp = !diff.rowsToUpdate.length && !diff.rowsToDelete.length && !newRows.length && !Object.keys(currentPatch).length;
    return { version: VERSION, mode: 'PREVIEW_ONLY', executionEnabled: false, status: 'CLEAN',
        outcome: noOp ? 'CLEAN' : 'AUTOMATIC', noOp, currentPatch, proposedRows: preserved.rows,
        fieldChanges: diff.rowsToUpdate, insertedRows: newRows, removedHistoryIds: diff.rowsToDelete.map(item => item.historyId),
        assumptions: clone(candidate.assumptions || []), verification,
        numericEvidence:clone(candidate.numericEvidence||[]),
        sources: candidate.sources || [], requiresWriterContractExtension: !noOp,
        snapshotFingerprint: snapshot(input), proposalFingerprint: A.hash({ version:VERSION, snapshot: snapshot(input),
            rows: A.ordered(preserved.rows), currentPatch, assumptions:candidate.assumptions||[],
            numericEvidence:candidate.numericEvidence||[], sources:candidate.sources||[], verification }) };
}
function candidateFromCanonical(input, rows, assumptions = []) {
    const result = canonicalize({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: rows });
    if (!['CLEAN', 'AUTO_REPAIRABLE'].includes(result.status)) return null;
    // Current synchronization may not silently replace historical terms.
    if (result.canonicalRows.some(row => {
        const original = rows.find(source => id(source) === id(row));
        return !original || C.PROFILE_FIELDS.some(field => !A.equal(original[field], row[field]));
    })) return null;
    if (result.rowsToDelete.some(deletion => {
        const original = rows.find(row => id(row) === deletion.historyId);
        const survivor = result.canonicalRows.find(row => id(row) === deletion.survivingHistoryId);
        return !original || !survivor || C.PROFILE_FIELDS.some(field => present(original[field]) &&
            !A.equal(original[field], survivor[field]));
    })) return null;
    return { rows: [...result.canonicalRows, ...rows.filter(isInactiveHistoryRow)],
        replacements: result.replacementByDeletedId, assumptions, sources: ['CANONICALIZATION'] };
}
function semanticKey(plan) {
    return A.hash({ currentPatch: plan.currentPatch, periods: plan.proposedRows.filter(row => !isInactiveHistoryRow(row))
        .map(row => Object.fromEntries([C.HIRE, C.START, C.END, C.DEPARTURE, C.CHANGE, ...C.PROFILE_FIELDS]
            .filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])))
        .map(A.stringify).sort() });
}

function completeSelectedPreview(input, { currentEmployee, desiredHistoryRows }) {
    const alreadyComplete = candidateFromCanonical({...input,currentEmployee},desiredHistoryRows);
    if (alreadyComplete) {
        const retained = desiredHistoryRows.filter(row=>!alreadyComplete.rows.some(target=>id(target)===id(row)))
            .map(row=>({...row,employment_history_canonical_status:'REDUNDANT_REFERENCED',
                employment_history_canonical_survivor_id:alreadyComplete.replacements[id(row)]}));
        return {desiredHistoryRows:[...alreadyComplete.rows,...retained],assumptions:[]};
    }
    const semanticRows = desiredHistoryRows.filter(row => !isInactiveHistoryRow(row));
    const technical = semanticRows.filter(row => !day(row[C.START]) && row.afora_allagh_oron_ergasias === false && row.afora_proslhpsh !== true);
    const reconstruction = planEmployeeHistoryAutomaticReconstruction({ scope: input.scope, currentEmployee,
        completeHistoryRows: semanticRows.filter(row => !technical.includes(row)), requireRecordedNumericFacts: true,
        preserveUnrecordedNumbers: true, preserveRecordedBoundaries: true });
    if (reconstruction.warnings.some(item => item.code !== 'NUMERIC_PROFILE_FACT_UNRECORDED') || reconstruction.assumptions.some(item => !ALLOWED_ASSUMPTIONS.has(item.code)) ||
        ['BLOCKED','NO_HISTORY','NO_ACTIVE_HISTORY'].includes(reconstruction.status)) throw invalidDecision();
    let rows = [...reconstruction.proposedRows, ...technical, ...desiredHistoryRows.filter(isInactiveHistoryRow)];
    const missing = planEvidencedMissingHistoryPeriods({ scope: input.scope, currentEmployee, historyRows: rows });
    const assumptions = reconstruction.assumptions.map(item => ({...item,
        businessRationale: 'Οι ανεξάρτητες χρονικές διορθώσεις συνδυάστηκαν με την πραγματική επιχειρησιακή επιλογή και επανελέγχθηκαν μαζί.'}));
    if (missing.status === 'APPLICABLE') { rows = missing.desiredHistoryRows; assumptions.push(...missing.assumptions); }
    const canonical = candidateFromCanonical({ ...input, currentEmployee }, rows);
    if (!canonical) throw invalidDecision();
    // Retire redundant identities here; keep the established resolver's no
    // arbitrary-physical-delete boundary intact during composition.
    const retained = rows.filter(row => !canonical.rows.some(target => id(target) === id(row))).map(row => ({...row,
        employment_history_canonical_status:'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id:canonical.replacements[id(row)]}));
    return { desiredHistoryRows:[...canonical.rows,...retained], assumptions };
}

function finishBusinessSelection(input, execution, selected, attempts, assumptions = []) {
    const recordedRows=preserveUnrecordedNumericFacts(input,execution.desiredHistoryRows,execution.confirmedNumericFacts,assumptions);
    const selectedInput = { ...input, currentEmployee:{...input.currentEmployee,...execution.currentPatch},
        completeHistoryRows:recordedRows, protectedReferenceSummary:{...input.protectedReferenceSummary,
            ...Object.fromEntries(execution.desiredHistoryRows.filter(row=>!input.completeHistoryRows.some(before=>id(before)===id(row))).map(row=>[id(row),[]]))} };
    const numeric = planEmployeeHistoryUnrecordedBusinessFacts(selectedInput);
    let rows = recordedRows, currentPatch = execution.currentPatch, numericEvidence=execution.confirmedNumericFacts||[];
    if (selected.facts !== undefined) {
        if (numeric.status !== 'APPLICABLE') throw invalidDecision();
        const resolved = resolveEmployeeHistoryBusinessFacts({...selectedInput,plannerResult:numeric,answers:selected.facts});
        rows = resolved.desiredHistoryRows;
        currentPatch = {...currentPatch,...resolved.currentPatch};
        numericEvidence=[...numericEvidence,...resolved.confirmedNumericFacts||[]];
    }
    const proposal = verifyCandidate(input,{rows,currentPatch,numericEvidence,confirmedFacts:true,
        sources:['CONFIRMED_BUSINESS_SELECTION'],assumptions});
    if (proposal.status === 'CLEAN') return {proposal,attempts};
    if (selected.facts === undefined && numeric.status === 'APPLICABLE' && proposal.verification?.issues.length &&
        proposal.verification.issues.every(issue=>issue==='NUMERIC_PROFILE_FACT_UNRECORDED')) {
        return {attempts,decision:{kind:'FACTS',input:selectedInput,plan:numeric,
            precedingSelection:clone(selected),answerKey:'facts',assumptions}};
    }
    throw invalidDecision();
}

function cycleProposal(input, catalogs, selected) {
    const attempts = [], accepted = [], pendingContexts = [];
    const consider = (name, candidate) => {
        if (!candidate) return;
        const result = verifyCandidate(input, candidate);
        attempts.push({ solver: name, reason: result.reason || 'VERIFIED' });
        if (result.status === 'CLEAN') accepted.push(result);
    };
    consider('EXISTING_STATE', { rows: input.completeHistoryRows, sources: ['EXISTING_STATE'] });
    if (accepted[0]?.noOp && selected === undefined) return { proposal: accepted[0], attempts };

    // Inactive artifacts and purely technical schedules cannot donate profile
    // facts or become real work-term events in reconstruction.
    const classification = canonicalize({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: input.completeHistoryRows });
    const technicalIds = new Set((classification.classifications || []).filter(item =>
        item.eventTypes?.length === 1 && item.eventTypes[0] === 'LEGACY_TECHNICAL').map(item => item.historyId));
    const excluded = input.completeHistoryRows.filter(row => isInactiveHistoryRow(row) || technicalIds.has(id(row)));
    const evidenceRows = input.completeHistoryRows.filter(row => !excluded.includes(row));
    const reconstruction = planEmployeeHistoryAutomaticReconstruction({ ...input, completeHistoryRows: evidenceRows,
        requireRecordedNumericFacts: true, preserveUnrecordedNumbers: true, preserveRecordedBoundaries: true });
    const supported = reconstruction.assumptions.every(item => ALLOWED_ASSUMPTIONS.has(item.code)) &&
        !['BLOCKED', 'NO_ACTIVE_HISTORY'].includes(reconstruction.status);
    let normalized = input;
    if (supported) {
        const rows = [...reconstruction.proposedRows, ...excluded];
        const assumptions = reconstruction.assumptions.map(item => ({ ...item,
            businessRationale: item.code === 'HISTORICAL_NON_EMPTY_VALUE_CHANGE'
                ? 'Οι διαφορετικοί καταγεγραμμένοι όροι διατηρούνται στις πραγματικές ημερομηνίες αλλαγής.'
                : 'Η συνέχεια και οι όροι προκύπτουν από συμβατά καταγεγραμμένα στοιχεία της ίδιας εργασιακής σχέσης.' }));
        if (!reconstruction.warnings.length) consider('RECONSTRUCTION_AND_CANONICALIZATION', candidateFromCanonical(input, rows, assumptions));
        // Coverage is measured on the entire candidate, including real changes.
        const missing = planEvidencedMissingHistoryPeriods({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: rows });
        if (missing.status === 'APPLICABLE') {
            const candidateRows = missing.desiredHistoryRows;
            consider('MISSING_PERIODS', candidateFromCanonical(input, candidateRows, [...assumptions, ...missing.assumptions]));
            normalized = { ...input, completeHistoryRows: candidateRows,
                protectedReferenceSummary: { ...input.protectedReferenceSummary,
                    ...Object.fromEntries(candidateRows.filter(row => !input.completeHistoryRows.some(before => id(before) === id(row))).map(row => [id(row), []])) } };
        } else normalized = { ...input, completeHistoryRows: rows };
        pendingContexts.push({ input: normalized, assumptions });
    }
    // Collect the existing automatic planner even when another solver failed.
    // Admit it only when its numerical facts agree with the strict reconstruction.
    const automatic = planEmployeeHistoryAutomaticSettlement(input);
    const noDefault = !reconstruction.rowDiffs.some(item => item.sourceType === 'DEFAULT_VALUE');
    if (automatic.status === 'CLEAN' && supported && noDefault && automatic.proposedActiveRows.every(row => {
        const reconstructed = reconstruction.proposedRows.find(source => id(source) === id(row));
        return reconstructed && C.PROFILE_FIELDS.every(field => A.equal(reconstructed[field], row[field]));
    })) consider('AUTOMATIC_SETTLEMENT', { rows: automatic.proposedRows, assumptions: automatic.assumptions,
        replacements: Object.fromEntries(automatic.redundantRows.map(item => [item.historyId, item.survivingHistoryId])), sources: ['AUTOMATIC_SETTLEMENT'] });
    attempts.push({ solver: 'AUTOMATIC_SETTLEMENT', reason: automatic.reason });

    const capability = classifyEmployeeHistoryResolutionCapability({ ...input, catalogs, collectAllPlans: true,
        allowGeneralProfileAlternatives: true, canonicalizer: canonicalize });
    const establishedUnique = planEmployeeHistoryUniqueSafeRepair(input);
    for (const [name, plan] of [['UNIQUE_SAFE_REPAIR', capability.uniquePlan],['ESTABLISHED_UNIQUE_SAFE_REPAIR',establishedUnique]]) {
        if (plan?.status === 'APPLICABLE') {
            const assumptions=[{ businessRationale: 'Η υπάρχουσα μοναδική ασφαλής πρόταση τεκμηριώνεται από τα καταγεγραμμένα γεγονότα και επαληθεύεται για ολόκληρο το Ιστορικό.' }];
            consider(name, { rows: plan.desiredHistoryRows, currentPatch: plan.currentPatch, sources: [name], assumptions });
            const proposedCurrent={...input.currentEmployee,...plan.currentPatch};
            try {
                const completed=completeSelectedPreview(input,{currentEmployee:proposedCurrent,desiredHistoryRows:plan.desiredHistoryRows});
                pendingContexts.push({input:{...input,currentEmployee:proposedCurrent,completeHistoryRows:completed.desiredHistoryRows},
                    currentPatch:plan.currentPatch,assumptions});
            } catch (error) {
                if (!expectedPlanningFailure(error)) throw error;
                attempts.push({solver:name,reason:error.code});
            }
        }
        attempts.push({ solver: name, reason: plan?.reason || 'NOT_APPLICABLE' });
    }
    const split = require('./employeeHistoryPeriodSplitPreviewService').buildEmployeeHistoryPeriodSplitProposal(input);
    if (split) consider('RECORDED_PERIOD_SPLIT', { rows: split.proposedRows, sources: ['RECORDED_PERIOD_SPLIT'],
        assumptions: [{ businessRationale: 'Η πραγματική διάσπαση προκύπτει από ήδη καταγεγραμμένη ημερομηνία μεταβολής σύμβασης.' }] });
    const legacy = planEmployeeLegacyOpenCycleCleanup(input);
    attempts.push({ solver: 'LEGACY_OPEN_CYCLE_CLEANUP', reason: legacy.policyRemovedHistoryIds.length
        ? 'UNPROVEN_CYCLE_REMOVAL_REJECTED' : legacy.reason });
    if (legacy.status === 'APPLYABLE' && !legacy.policyRemovedHistoryIds.length && !legacy.insertedFoundationRows.length &&
        ['CLEAN','AUTO_REPAIRABLE'].includes(classification.status)) {
        // That policy's legacy canonical preferences do not prove which of two
        // conflicting business profiles is real. Reuse only the strict candidate.
        consider('LEGACY_OPEN_CYCLE_CLEANUP', candidateFromCanonical(input,input.completeHistoryRows));
    }
    const multiple = capability.multiplePlan;
    if (multiple?.status === 'APPLICABLE') for (const option of multiple.businessOptions) {
        const internal = multiple.internalPlans[option.id];
        const source = input.completeHistoryRows.find(row => id(row) === internal.secondId);
        if (internal.strategy !== 'SPLIT_PAIR' || !internal.effectiveDate ||
            day(source?.[C.CHANGE]) !== internal.effectiveDate) continue;
        try {
            const execution = resolveEmployeeHistoryMultipleSafeChoice({ ...input, plannerResult: multiple, choiceId: option.id,
                completePreview: selectedState => completeSelectedPreview(input, selectedState) });
            consider('RECORDED_BUSINESS_CHANGE', { rows: execution.desiredHistoryRows, currentPatch: execution.currentPatch,
                sources: ['RECORDED_BUSINESS_CHANGE'], assumptions: [{ businessRationale: 'Η πραγματική μεταβολή προκύπτει από την ήδη καταγεγραμμένη ημερομηνία αλλαγής σύμβασης.' }] });
        } catch (error) {
            if (!expectedPlanningFailure(error)) throw error;
            attempts.push({ solver: 'RECORDED_BUSINESS_CHANGE', reason: error.code });
        }
    }
    const unique = new Map(accepted.map(plan => [semanticKey(plan), plan]));
    if (selected === undefined && unique.size === 1) return { proposal: [...unique.values()][0], attempts };

    if (multiple?.status === 'APPLICABLE') {
        const resolve = decision => resolveEmployeeHistoryMultipleSafeChoice({ ...input, plannerResult: multiple,
            choiceId: decision.choiceId, ...(decision.answers ? { answers: decision.answers } : {}),
            completePreview: selectedState => completeSelectedPreview(input, selectedState) });
        const options = multiple.businessGroups ? multiple.businessOptions : multiple.businessOptions.filter(option => {
            if (option.inputs?.length) return true; // entered dates are revalidated by the resolver
            try {
                const execution = resolve({ choiceId: option.id });
                const completed = finishBusinessSelection(input, execution, {choiceId:option.id}, []);
                return Boolean(completed.proposal || completed.decision);
            } catch (error) {
                if (!expectedPlanningFailure(error)) throw error;
                return false;
            }
        });
        if (selected !== undefined) {
            if (!selected || Object.keys(selected).some(key => !['choiceId', 'answers', 'facts'].includes(key)) ||
                !options.some(option => option.id === selected.choiceId)) throw invalidDecision();
            const execution = resolve(selected);
            const completed = finishBusinessSelection(input, execution, selected, attempts,
                [...execution.previewAssumptions || [], { businessRationale: 'Χρησιμοποιήθηκε η επιβεβαιωμένη επιλογή για τα πραγματικά γεγονότα της περιόδου.' }]);
            return {...completed,choices:options.filter(option => option.id === selected.choiceId).map(option => option.label)};
        }
        if (options.length) return { attempts, decision: { kind: multiple.businessGroups ? 'MULTIPLE_GROUPS' : 'MULTIPLE', input, plan: multiple, options } };
    }
    const factContexts = [{ input, assumptions: [], plan: capability.businessFactPlan }, ...pendingContexts.map(context => ({ ...context,
        plan: planEmployeeHistoryUnrecordedBusinessFacts(context.input) }))];
    for (const context of factContexts) if (context.plan?.status === 'APPLICABLE') {
        if (selected !== undefined) {
            if (!selected || !Object.hasOwn(selected,'answers') || Object.keys(selected).some(key=>!['answers','facts'].includes(key))) throw invalidDecision();
            const execution = resolveEmployeeHistoryBusinessFacts({ ...context.input, plannerResult: context.plan,
                answers: selected.answers, canonicalizer: canonicalize });
            execution.currentPatch={...context.currentPatch,...execution.currentPatch};
            return {...finishBusinessSelection(input,execution,selected,attempts,context.assumptions),
                choices:['Επιβεβαιώθηκαν τα πραγματικά στοιχεία της περιόδου.']};
        }
        return { attempts, decision: { kind: 'FACTS', ...context } };
    }
    if (capability.userCorrectionPlan?.status === 'APPLICABLE') {
        if (selected !== undefined) {
            if (!selected || !Object.hasOwn(selected,'confirmation') || Object.keys(selected).some(key=>!['confirmation','facts'].includes(key))) throw invalidDecision();
            const execution = resolveEmployeeHistoryUserConfirmedCorrection({ ...input,
                plannerResult: capability.userCorrectionPlan, confirmation: selected.confirmation, canonicalizer: canonicalize });
            return finishBusinessSelection(input,execution,selected,attempts,
                [{businessRationale:'Οι επιβεβαιωμένοι πραγματικοί όροι και οι ημερομηνίες επαληθεύτηκαν μαζί για ολόκληρη την εργασιακή σχέση.'}]);
        }
        return { attempts, decision: { kind: 'USER_CORRECTION', input, plan: capability.userCorrectionPlan } };
    }
    if (selected !== undefined) throw invalidDecision();
    return { attempts, reason: unique.size > 1 ? 'INCOMPATIBLE_VERIFIED_CANDIDATES' :
        reconstruction.warnings[0]?.code || classification.diagnostics?.reason || attempts.find(item => item.reason !== 'VERIFIED')?.reason || 'NO_SAFE_COMPLETE_PLAN' };
}

function coordinateEmployeeHistorySettlement(input = {}, { catalogs = {}, businessDecision = input.businessDecision } = {}) {
    // Answers belong to this coordinator, not to another solver's envelope.
    const { businessDecision: ignoredDecision, ...evidenceInput } = input;
    input = evidenceInput;
    const base = { version: VERSION, mode: 'PREVIEW_ONLY', executionEnabled: false, status: 'ADMIN_REQUIRED',
        outcome: 'ADMIN_REQUIRED', proposedRows: [], questions: [], attempts: [], assumptions: [], choices: [] };
    if (!input.scope || !input.currentEmployee || !Array.isArray(input.completeHistoryRows) ||
        input.completeHistoryRows.length > 1000 || !C.SCOPE_FIELDS.every(field => typeof input.scope[field] === 'string' &&
            input.scope[field] && input.currentEmployee[field] === input.scope[field] && input.completeHistoryRows.every(row => row && row[field] === input.scope[field])) ||
        input.completeHistoryRows.some(row => !row._id) || new Set(input.completeHistoryRows.map(id)).size !== input.completeHistoryRows.length) {
        return { ...base, reason: 'INVALID_OR_CONFLICTING_INPUT' };
    }
    const referenceFailure = referenceIssue(input);
    if (referenceFailure) return { ...base, reason: referenceFailure };
    const fingerprint = snapshot(input);
    // New multi-cycle/fact decisions bind the full typed snapshot. Legacy
    // recorded choices remain supported by their established resolver contract.
    let selections = null;
    if (businessDecision !== undefined && businessDecision !== null) {
        if (Object.hasOwn(businessDecision, 'selections')) {
            if (!A.equal(Object.keys(businessDecision).sort(), ['selections', 'snapshotFingerprint']) ||
                businessDecision.snapshotFingerprint !== fingerprint || !businessDecision.selections ||
                typeof businessDecision.selections !== 'object' || Array.isArray(businessDecision.selections)) throw invalidDecision();
            selections = businessDecision.selections;
        } else selections = { cycle_1: businessDecision };
    }
    let cycles;
    try { cycles = buildEmploymentCycles({ currentEmployee: input.currentEmployee, history: input.completeHistoryRows }); }
    catch (error) {
        // Lifecycle fact resolvers must still be consulted after cycle failure.
        if (!expectedPlanningFailure(error)) throw error;
        if (selections && Object.keys(selections).some(key => key !== 'cycle_1')) throw invalidDecision();
        const result = cycleProposal(input, catalogs, selections?.cycle_1);
        if (result.proposal) return { ...result.proposal, attempts: result.attempts, choices: result.choices || [] };
        if (result.decision) return { ...base, status: 'BUSINESS_DECISION_REQUIRED', outcome: 'BUSINESS_DECISION_REQUIRED',
            snapshotFingerprint: fingerprint, decisions: [{ id: 'cycle_1', ...result.decision }], attempts: result.attempts };
        return { ...base, reason: error.code || result.reason, attempts: result.attempts };
    }
    if (!cycles.length) return { ...base, reason: 'NO_RECORDED_EMPLOYMENT' };
    const proposals = [], decisions = [], attempts = [], choices = [];
    for (const [index, cycle] of cycles.entries()) {
        const cycleId = `cycle_${index + 1}`;
        const members = input.completeHistoryRows.filter(row => day(row[C.HIRE]) === cycle.hire_date);
        // Unclassified rows cannot be silently lost during per-cycle composition.
        if (index === 0) members.push(...input.completeHistoryRows.filter(row => !day(row[C.HIRE])));
        const currentEmployee = cycle.is_current_cycle ? input.currentEmployee : { ...input.scope,
            _id: input.currentEmployee._id, [C.HIRE]: calendarDate(cycle.hire_date),
            [C.DEPARTURE]: calendarDate(cycle.departure_date) };
        const result = cycleProposal({ ...input, currentEmployee, completeHistoryRows: members }, catalogs, selections?.[cycleId]);
        attempts.push(...result.attempts.map(item => ({ ...item, cycle: cycleId })));
        if (result.proposal) {
            if (!cycle.is_current_cycle && Object.keys(result.proposal.currentPatch).length) {
                return {...base,reason:'PAST_CYCLE_CANNOT_CHANGE_CURRENT_EMPLOYEE',attempts};
            }
            proposals.push(result.proposal); choices.push(...result.choices || []);
        }
        else if (result.decision) decisions.push({ id: cycleId, ...result.decision });
        else return { ...base, reason: result.reason, attempts };
    }
    if (selections && Object.keys(selections).some(key => !cycles.some((cycle, index) => key === `cycle_${index + 1}`))) throw invalidDecision();
    if (decisions.length) return { ...base, status: 'BUSINESS_DECISION_REQUIRED', outcome: 'BUSINESS_DECISION_REQUIRED',
        snapshotFingerprint: fingerprint, decisions, attempts };
    const currentPatch = proposals.find(plan => Object.keys(plan.currentPatch).length)?.currentPatch || {};
    const assigned = new Set(proposals.flatMap(plan => plan.proposedRows).map(id));
    const unassignedInactive = input.completeHistoryRows.filter(row => isInactiveHistoryRow(row) && !assigned.has(id(row)));
    const combined = verifyCandidate(input, { rows: [...proposals.flatMap(plan => plan.proposedRows), ...unassignedInactive], currentPatch,
        numericEvidence:proposals.flatMap(plan=>plan.numericEvidence),
        confirmedFacts: Boolean(selections), assumptions: proposals.flatMap(plan => plan.assumptions), sources: [...new Set(proposals.flatMap(plan => plan.sources))] });
    return combined.status === 'CLEAN' ? { ...combined, attempts, choices } : { ...base, reason: combined.reason, attempts };
}

module.exports = { VERSION, coordinateEmployeeHistorySettlement, invalidDecision };
