'use strict';
const { createHash } = require('node:crypto');
const { Types } = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { resolveEmployeeHistoryMultipleSafeChoice } = require('./employeeHistoryMultipleSafeResolutionPlannerService');
const { verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const VERSION = 'employee-history-period-split-preview:v1';
const STRATEGIES = new Set(['SPLIT_PAIR', 'SPLIT_PAIR_INPUT', 'INSERT_INTERMEDIATE', 'INSERT_INTERMEDIATE_INPUT']);
const START = 'hmeromhnia_isxyos_oron_ergasias_apo', END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const day = value => value == null ? null : new Date(value).toISOString().slice(0, 10);
function splitCapability(input) {
    const capability = classifyEmployeeHistoryResolutionCapability(input);
    const unique = capability.uniquePlan;
    if (unique?.status === 'APPLICABLE' && unique.planKind === 'CORRECTED_SAME_DATE_REFERENCED_PROFILE' &&
        !Object.keys(unique.currentPatch).length) return { ...unique, uniqueCorrection: true };
    const plan = capability.multiplePlan;
    if (plan?.status === 'APPLICABLE') return plan;
    // Resolve only the actual current cycle; all other cycles remain in the
    // final candidate and are independently verified, never used as donors.
    const hire = day(input.currentEmployee?.hmeromhnia_proslhpshs);
    if (!hire) return null;
    const currentRows = input.completeHistoryRows.filter(row => day(row.hmeromhnia_proslhpshs) === hire);
    if (!currentRows.length || currentRows.length === input.completeHistoryRows.length) return null;
    const currentPlan = classifyEmployeeHistoryResolutionCapability({ ...input, completeHistoryRows: currentRows }).multiplePlan;
    return currentPlan?.status === 'APPLICABLE' ? currentPlan : null;
}
function hasEmployeeHistoryPeriodSplitChoices(input) {
    const plan = splitCapability(input);
    if (plan?.uniqueCorrection) return true;
    return Boolean(plan && plan.businessOptions.some(option => STRATEGIES.has(plan.internalPlans[option.id]?.strategy) &&
        !plan.internalPlans[option.id]?.synchronizeCurrentStart));
}
function buildEmployeeHistoryPeriodSplitProposal(input, businessDecision) {
    const plannerResult = splitCapability(input);
    if (!plannerResult) return null;
    const uniqueCorrection = plannerResult.uniqueCorrection === true;
    if (uniqueCorrection && businessDecision !== undefined) return null;
    const candidates = uniqueCorrection ? [] : plannerResult.businessOptions.filter(option => STRATEGIES.has(plannerResult.internalPlans[option.id]?.strategy));
    let decision = businessDecision, automatic = false;
    if (uniqueCorrection) automatic = true;
    else if (decision === undefined) {
        // A schedule date alone is informational. Automatic selection requires
        // the already-recorded contract-change event on the corresponding row.
        const proved = candidates.filter(option => {
            const internal = plannerResult.internalPlans[option.id];
            const row = input.completeHistoryRows.find(row => String(row._id) === (internal.secondId || internal.intermediateId));
            return internal.effectiveDate && day(row?.hmeromhnia_allaghs_symbashs) === internal.effectiveDate;
        });
        if (proved.length !== 1) return null;
        decision = { choiceId: proved[0].id };
        automatic = true;
    }
    if (!uniqueCorrection && (!decision || typeof decision !== 'object' || Array.isArray(decision))) return null;
    let execution = plannerResult;
    if (!uniqueCorrection) {
        const option = candidates.find(option => option.id === decision.choiceId);
        if (!option) return null;
        if (![ ['choiceId'], ['answers', 'choiceId'] ].some(keys => A.equal(Object.keys(decision).sort(), keys))) S.fail('INVALID_REQUEST');
        execution = resolveEmployeeHistoryMultipleSafeChoice({ ...input, plannerResult,
            choiceId: decision.choiceId, ...(Object.hasOwn(decision, 'answers') ? { answers: decision.answers } : {}) });
    }
    // This slice never changes Employee, lifecycle events, or physically deletes rows.
    if (Object.keys(execution.currentPatch).length || execution.physicalDeleteIds.length || execution.insertedRows.length) return null;
    if (uniqueCorrection) {
        const types = require('./employeeHistoryAutomaticReconstructionContract').PROFILE_FIELD_TYPES;
        const financialFields = require('./employeeHistoryBusinessFactResolutionPlannerService').PAY_FIELDS.filter(field => types[field] === 'Number');
        if (execution.desiredHistoryRows.filter(row => !isInactiveHistoryRow(row)).some(row =>
            financialFields.some(field => typeof row[field] !== 'number' || !Number.isFinite(row[field])))) return null;
    }
    const originals = new Map(input.completeHistoryRows.map(row => [String(row._id), row]));
    const replacements = new Map();
    for (const historyId of execution.changedHistoryIds) {
        const original = originals.get(historyId);
        const desired = execution.desiredHistoryRows.find(row => String(row._id) === historyId);
        if (!original || !desired || isInactiveHistoryRow(original)) return null;
        if (uniqueCorrection && isInactiveHistoryRow(desired)) {
            const { employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = desired;
            if (!A.equal(payload, original)) return null;
            continue;
        }
        if (isInactiveHistoryRow(desired)) return null;
        const allowed = new Set([START, END]);
        if (Object.keys(original).concat(Object.keys(desired)).some(field =>
            !allowed.has(field) && !A.equal(original[field], desired[field]) &&
            !(uniqueCorrection && require('./employeeHistoryAutomaticReconstructionContract').PROFILE_FIELDS.includes(field) &&
                A.equal(desired[field], input.currentEmployee[field]) && input.completeHistoryRows.some(row => A.equal(row[field], desired[field]))))) return null;
        // Deterministic detached identities: stable previews, never allocated in storage.
        const seed = A.stringify({ version: VERSION, scope: input.scope, originalId: historyId, desired, decision });
        const newId = new Types.ObjectId(createHash('sha256').update(seed).digest('hex').slice(0, 24));
        if (originals.has(String(newId))) S.fail('INVALID_REQUEST');
        replacements.set(historyId, newId);
    }
    const active = execution.desiredHistoryRows.map(row => {
        if (replacements.has(String(row._id))) return { ...S.clone(row), _id: replacements.get(String(row._id)) };
        const survivor = replacements.get(String(row.employment_history_canonical_survivor_id));
        return survivor ? { ...S.clone(row), employment_history_canonical_survivor_id: survivor } : S.clone(row);
    });
    const retained = [...replacements].map(([historyId, survivor]) => ({ ...S.clone(originals.get(historyId)),
        employment_history_canonical_status: 'REDUNDANT_REFERENCED', employment_history_canonical_survivor_id: survivor }));
    const proposedRows = [...active, ...retained];
    const verification = verifyEmployeeHistoryAutomaticSettlement({ ...input, proposedRows,
        requiredHistoryRows: input.completeHistoryRows });
    if (verification.status !== 'CLEAN') return null;
    const proposal = { version: VERSION, mode: 'PREVIEW_ONLY', executionEnabled: false, status: 'CLEAN',
        requiresInsertContractExtension: replacements.size > 0, businessDecision: S.clone(decision), automatic,
        optionSetFingerprint: plannerResult.optionSetFingerprint || plannerResult.planFingerprint, proposedRows, verification,
        ...(uniqueCorrection ? { resolutionKind: 'CORRECTED_DUPLICATE' } : {}),
        periods: [...new Map(active.filter(row => !isInactiveHistoryRow(row) && (!uniqueCorrection || !row.hmeromhnia_apoxorhshs)).map(row => ({
            from: day(row[START]), to: day(row[END]), days: row.hmeres_ergasias_ebdomadas,
            hours: row.ores_ergasias_ebdomadas, ...(uniqueCorrection ? { pay: row.synolo_symbashs } : {}) })).map(period => [A.stringify(period), period])).values()]
            .sort((a, b) => a.from.localeCompare(b.from)) };
    proposal.proposalFingerprint = A.hash({ proposal, currentEmployee: input.currentEmployee,
        historyBefore: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary,
        scope: input.scope, actorUserId: input.actorUserId });
    return proposal;
}
function projectEmployeeHistoryPeriodSplitProposal(proposal) {
    const greek = value => value ? value.split('-').reverse().join('/') : 'χωρίς λήξη';
    return { state: 'split', previewOnly: true, executionEnabled: false, questions: [], assumptions: [],
        actions: proposal.periods.map(period => `${greek(period.from)}–${greek(period.to)}: ${period.days} ημέρες / ${period.hours} ώρες την εβδομάδα.${period.pay === undefined ? '' : ` Καταγεγραμμένες αποδοχές: ${new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(period.pay)} €.`}`),
        choices: [proposal.resolutionKind === 'CORRECTED_DUPLICATE'
            ? 'Διορθώνεται τεκμηριωμένη διπλή εγγραφή με τα ήδη καταγεγραμμένα στοιχεία και ποσά. Δεν δημιουργείται νέα οικονομική τιμή.'
            : proposal.automatic ? 'Χρησιμοποιήθηκε η τεκμηριωμένη ημερομηνία πραγματικής αλλαγής.' : 'Χρησιμοποιήθηκε η επιβεβαιωμένη επιχειρησιακή επιλογή.'] };
}
module.exports = { buildEmployeeHistoryPeriodSplitProposal, projectEmployeeHistoryPeriodSplitProposal,
    hasEmployeeHistoryPeriodSplitChoices, PERIOD_SPLIT_VERSION: VERSION };
