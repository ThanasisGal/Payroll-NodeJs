'use strict';

const { planEmployeeHistoryAutomaticSettlement, verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { classifyEmployeeHistoryResolutionCapability } = require('./employeeHistoryResolutionCapabilityService');
const { calculateCanonicalDiff } = require('./employeeHistoryCanonicalizationService');
const { partitionHistoryUpdateReferences } = require('./employeeHistoryReferenceSemanticsService');
const { formatValue } = require('./employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');

// Adapt only an independently verified, identity-preserving proposal. This is
// presentation data; it must never become an execution/approval capability.
function verifiedUniquePlan(input, unique) {
    if (unique?.status !== 'APPLICABLE' || !Array.isArray(unique.physicalDeleteIds) ||
        !Array.isArray(unique.insertedRows) || !Array.isArray(unique.desiredHistoryRows) ||
        !unique.currentPatch || Array.isArray(unique.currentPatch) ||
        unique.physicalDeleteIds.length || unique.insertedRows.length ||
        Object.keys(unique.currentPatch).some(field => field !== 'hmeromhnia_isxyos_oron_ergasias_eos')) return null;
    for (const row of input.completeHistoryRows) {
        const references = input.protectedReferenceSummary?.[String(row._id)];
        if (!Array.isArray(references) || references.some(reference => !reference ||
            reference.historyId != null && String(reference.historyId) !== String(row._id))) return null;
        try { if (partitionHistoryUpdateReferences(references).liveDereference.length) return null; }
        catch { return null; }
    }
    const currentEmployee = { ...input.currentEmployee, ...unique.currentPatch };
    const verification = verifyEmployeeHistoryAutomaticSettlement({ ...input, currentEmployee,
        proposedRows: unique.desiredHistoryRows, requiredHistoryRows: input.completeHistoryRows });
    if (verification.status !== 'CLEAN') return null;
    const diff = calculateCanonicalDiff(input.completeHistoryRows, unique.desiredHistoryRows);
    if (diff.rowsToDelete.length || diff.rowsToInsert.length || diff.rowsToUpdate.some(change =>
        Object.keys(change.patch).some(field => !labels[field] &&
            !['employment_history_canonical_status', 'employment_history_canonical_survivor_id'].includes(field)))) return null;
    return { status: 'CLEAN', verification, noOp: false, fieldChanges: diff.rowsToUpdate,
        currentPatch: unique.currentPatch,
        redundantRows: diff.rowsToUpdate.filter(change => change.patch.employment_history_canonical_status === 'REDUNDANT_REFERENCED'),
        assumptions: [{ businessRationale: 'Η υπάρχουσα μοναδική ασφαλής πρόταση επαληθεύτηκε ανεξάρτητα για ολόκληρο το Ιστορικό.' }] };
}

// Presentation only: no physical plans, identities or approval capabilities leave this boundary.
function buildEmployeeHistorySettlementPreview(input, catalogs = {}, { simpleDecisionsOnly = false, unified = false } = {}) {
    // Application requests use the coordinator. The old projection remains for
    // the already-issued isolated synthetic writer/approval contract only.
    if (unified) return buildUnifiedEmployeeHistorySettlementPreview(input, catalogs);
    let plan = planEmployeeHistoryAutomaticSettlement(input);
    const result = { state: 'unknown', previewOnly: true, questions: [], assumptions: [], actions: [] };
    let capability;
    if (plan.status !== 'CLEAN' && input.businessDecision === undefined) {
        capability = classifyEmployeeHistoryResolutionCapability(input);
        if (capability.uniquePlan?.status === 'APPLICABLE') {
            const verified = verifiedUniquePlan(input, capability.uniquePlan);
            if (!verified) return { ...result, reviewRequired: true };
            plan = verified;
            result.executionEnabled = false;
        }
    }
    if (plan.status === 'CLEAN' && plan.verification?.status === 'CLEAN') {
        result.state = plan.noOp ? 'clean' : 'automatic';
        result.assumptions = [...new Set(plan.assumptions.map(item => item.businessRationale))];
        const rows = new Map(input.completeHistoryRows.map(row => [String(row._id), row]));
        for (const change of plan.fieldChanges) {
            const row = rows.get(change.historyId);
            for (const [field, value] of Object.entries(change.patch)) {
                if (!labels[field]) continue;
                result.actions.push(`Εγγραφή ${row?.aa_eggrafhs || 'χωρίς αρίθμηση'} — ${labels[field]}: ${formatValue(field, row?.[field], catalogs, row)} → ${formatValue(field, value, catalogs, row)}`);
            }
        }
        for (const [field, value] of Object.entries(plan.currentPatch || {})) {
            result.actions.push(`Ισχύοντα στοιχεία — ${labels[field]}: ${formatValue(field, input.currentEmployee[field], catalogs, input.currentEmployee)} → ${formatValue(field, value, catalogs, input.currentEmployee)}`);
        }
        if (plan.redundantRows.length) result.actions.push(`Συνδυασμός ${plan.redundantRows.length} πλεοναζουσών εγγραφών. Οι εγγραφές με συνδεδεμένα στοιχεία διατηρούνται για την προστασία τους.`);
        return result;
    }
    // Ask only established factual questions. Approved assumptions never become questions.
    if (input.businessDecision !== undefined) return result;
    if (plan.reason !== 'RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION') return result;
    capability ||= classifyEmployeeHistoryResolutionCapability(input);
    if (capability.multiplePlan?.status === 'APPLICABLE') {
        if (simpleDecisionsOnly && capability.multiplePlan.shapeKind !== 'SAME_PERIOD_PROFILE_ALTERNATIVES') return result;
        result.questions = [{ id: 'businessChoice', type: 'SINGLE_CHOICE',
            label: 'Τι ίσχυε πραγματικά στην αμφίβολη περίοδο;', required: true,
            options: capability.multiplePlan.businessOptions.map(({ id, label, description, inputs }) =>
                ({ id, label, description, ...(inputs ? { inputs: inputs.map(({ id, type, label, required, min, max }) =>
                    ({ id, type, label, required, min, max })) } : {}) })) }];
    } else if (!simpleDecisionsOnly && capability.businessFactPlan?.status === 'APPLICABLE') {
        result.questions = capability.businessFactPlan.factQuestions.map(({ id, type, label, required, min, max, condition, options }) =>
            ({ id, type, label, required, ...(min ? { min } : {}), ...(max ? { max } : {}),
                ...(condition ? { condition: { questionId: condition.questionId, equals: condition.equals } } : {}),
                ...(options ? { options: options.map(({ id, label }) => ({ id, label })) } : {}) }));
    }
    if (result.questions.length) result.state = 'decision';
    return result;
}

function buildUnifiedEmployeeHistorySettlementPreview(input, catalogs = {}) {
    const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
    const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
    const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
    const plan = coordinateEmployeeHistorySettlement(input, { catalogs });
    const financialFields = require('./employeeHistoryBusinessFactResolutionPlannerService').PAY_FIELDS;
    const termValue = (field, value, row) => {
        if (typeof value !== 'number') return formatValue(field,value,catalogs,row);
        const money=financialFields.includes(field) && field!=='misthologiko_klimakio';
        return new Intl.NumberFormat('el-GR',{minimumFractionDigits:money?2:0,maximumFractionDigits:20}).format(value)+(money?' €':'');
    };
    const result = { state: 'unknown', previewOnly: true, executionEnabled: false,
        questions: [], assumptions: [], actions: [] };
    if (plan.status === 'CLEAN') {
        result.state = plan.noOp ? 'clean' : 'automatic';
        result.assumptions = [...new Set(plan.assumptions.map(item => item.businessRationale).filter(Boolean))];
        result.choices = plan.choices || [];
        if (!plan.noOp) result.limitation = 'Το Ιστορικό μπορεί να τακτοποιηθεί αυτόματα με την ενιαία πρόταση που έχει επαληθευτεί μόνο για προεπισκόπηση. Η αποθήκευσή της δεν υποστηρίζεται ακόμη από την ενεργή διαδικασία. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ελέγξτε την «Προβολή διορθώσεων».\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» για τις ανεξάρτητες εργασίες.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-ΠΡΟΕΠ-01.';
        const originals = new Map(input.completeHistoryRows.map(row => [String(row._id), row]));
        for (const change of plan.fieldChanges) for (const [field, value] of Object.entries(change.patch)) {
            if (!labels[field]) continue;
            const row = originals.get(change.historyId);
            result.actions.push(`Εγγραφή ${row?.aa_eggrafhs || 'χωρίς αρίθμηση'} — ${labels[field]}: ${formatValue(field, row?.[field], catalogs, row)} → ${formatValue(field, value, catalogs, row)}`);
        }
        const greek = value => calendarDate(value)?.toISOString().slice(0,10).split('-').reverse().join('/') || 'χωρίς λήξη';
        for (const row of plan.noOp ? [] : plan.proposedRows.filter(row => !isInactiveHistoryRow(row) && row.hmeromhnia_isxyos_oron_ergasias_apo)) {
            const pay = typeof row.synolo_symbashs === 'number' ? ` Καταγεγραμμένες αποδοχές: ${termValue('synolo_symbashs',row.synolo_symbashs,row)}.` : '';
            const kind=plan.insertedRows.some(inserted=>String(inserted._id)===String(row._id))?'Προτεινόμενη περίοδος':'Τελική ενεργή περίοδος';
            result.actions.push(`${kind} ${greek(row.hmeromhnia_isxyos_oron_ergasias_apo)}–${greek(row.hmeromhnia_isxyos_oron_ergasias_eos)}: ${row.hmeres_ergasias_ebdomadas} ημέρες / ${row.ores_ergasias_ebdomadas} ώρες την εβδομάδα.${pay}`);
        }
        const retired = plan.proposedRows.filter(row => isInactiveHistoryRow(row) && !isInactiveHistoryRow(originals.get(String(row._id)) || {}));
        const redundantCount = retired.length + plan.removedHistoryIds.length;
        if (redundantCount) result.actions.push(`Συνδυασμός ${redundantCount} πλεοναζουσών εγγραφών. Οι προστατευμένες παλιές εγγραφές διατηρούν το αρχικό τους περιεχόμενο και τις συνδέσεις τους.`);
        for (const [field, value] of Object.entries(plan.currentPatch)) if (labels[field]) result.actions.push(`Ισχύοντα στοιχεία — ${labels[field]}: ${formatValue(field, input.currentEmployee[field], catalogs, input.currentEmployee)} → ${formatValue(field, value, catalogs, input.currentEmployee)}`);
        return result;
    }
    if (plan.status === 'BUSINESS_DECISION_REQUIRED') {
        result.state = 'decision';
        result.decisionContext = { snapshotFingerprint: plan.snapshotFingerprint,
            baseSelections: input.businessDecision?.selections || {}, groups: [] };
        for (const decision of plan.decisions) {
            const group = { id: decision.id, kind: decision.kind, questionIds: [],
                ...(decision.precedingSelection ? {priorSelection:decision.precedingSelection,answerKey:decision.answerKey} : {}) };
            if (decision.kind === 'MULTIPLE_GROUPS') {
                group.choiceId=decision.options[0].id;
                for (const period of decision.plan.businessGroups) {
                    const questionId=`${decision.id}__${period.id}`;
                    group.questionIds.push(questionId);
                    result.questions.push({id:questionId,type:'SINGLE_CHOICE',required:true,
                        label:`Ποιοι όροι ίσχυαν από ${period.from.split('-').reverse().join('/')}${period.to ? ` έως ${period.to.split('-').reverse().join('/')}` : ' και μετά'};`,
                        options:period.options.map(({id,label,recordedTerms})=>({id,label,
                            description:Object.entries(recordedTerms).filter(([field])=>labels[field])
                                .map(([field,value])=>`${labels[field]}: ${termValue(field,value,recordedTerms)}`).join(' · ')}))});
                }
            } else if (decision.kind === 'MULTIPLE') {
                const questionId = `${decision.id}__businessChoice`;
                group.questionIds.push(questionId);
                result.questions.push({ id: questionId, type: 'SINGLE_CHOICE', required: true,
                    label: 'Τι ίσχυε πραγματικά στην αμφίβολη περίοδο;',
                    options: decision.options.map(({ id, label, description, inputs, recordedTerms, recordedPeriods }) => ({ id, label,
                        description: recordedPeriods ? recordedPeriods.map(period => `${period.from.split('-').reverse().join('/')}–${period.to ? period.to.split('-').reverse().join('/') : 'χωρίς λήξη'}: ` +
                            Object.entries(period.terms).filter(([field])=>labels[field]).map(([field,value])=>`${labels[field]}: ${termValue(field,value,period.terms)}`).join(' · ')).join('\n') :
                            recordedTerms ? Object.entries(recordedTerms).filter(([field]) => labels[field])
                            .map(([field,value]) => `${labels[field]}: ${termValue(field, value, recordedTerms)}`).join(' · ') : description,
                        ...(inputs ? { inputs: inputs.map(({id,type,label,required,min,max}) => ({id,type,label,required,min,max})) } : {}) })) });
            } else if (decision.kind === 'FACTS') {
                for (const question of decision.plan.factQuestions) {
                    const {id,type,label,required,min,max,step,condition,options} = question;
                    const questionId = `${decision.id}__${id}`;
                    group.questionIds.push(questionId);
                    result.questions.push({ id: questionId, type, label, required,
                        ...(min !== undefined ? {min} : {}), ...(max !== undefined ? {max} : {}), ...(step !== undefined ? {step} : {}),
                        ...(condition ? {condition:{questionId:`${decision.id}__${condition.questionId}`,equals:condition.equals}} : {}),
                        ...(options ? {options:options.map(({id,label})=>({id,label}))} : {}) });
                }
            } else {
                const R = require('./employeeHistoryResolutionAnalysisService');
                const analysis = R.buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan: decision.plan,
                    sourceStateFingerprint: plan.snapshotFingerprint });
                const { fingerprint, ...resolution } = R.buildUserConfirmedCorrectionPublicResolution({ analysis, fingerprint: analysis.fingerprint });
                resolution.explanation = 'Δηλώστε τι ίσχυε πραγματικά στις περιόδους που εμφανίζονται. Οι απαντήσεις χρησιμοποιούνται μόνο για νέα προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή.';
                const questionId = `${decision.id}__confirmedFacts`;
                group.questionIds.push(questionId);
                result.questions.push({id:questionId,type:'HISTORY_FACTS',label:'Επιβεβαιώστε τι ίσχυε πραγματικά στις περιόδους που εμφανίζονται.',required:true,resolution});
            }
            result.decisionContext.groups.push(group);
        }
        return result;
    }
    const reasons = {
        REFERENCE_STATE_NOT_LOADED: 'Δεν επιβεβαιώθηκαν οι συνδέσεις του Ιστορικού με τα παλιά αποτελέσματα.',
        INVALID_REFERENCE_EVIDENCE: 'Οι συνδέσεις του Ιστορικού με τα παλιά αποτελέσματα δεν συμφωνούν.',
        REFERENCE_SEMANTICS_UNKNOWN: 'Υπάρχει παλιά σύνδεση της οποίας η ασφαλής διατήρηση δεν μπορεί να επιβεβαιωθεί.',
        EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE: 'Υπάρχει παλιά εργασιακή σχέση χωρίς τεκμηριωμένη αποχώρηση πριν από την επαναπρόσληψη.',
        EMPLOYMENT_CYCLE_OVERLAP: 'Οι καταγεγραμμένες ημερομηνίες δείχνουν δύο εργασιακές σχέσεις που επικαλύπτονται.',
        AMBIGUOUS_LIFECYCLE_EVENTS: 'Υπάρχουν διαφορετικές ημερομηνίες αποχώρησης για την ίδια εργασιακή σχέση και δεν έχει τεκμηριωθεί ποια ίσχυε.',
        CONFLICTING_PROFILE_EVENTS: 'Υπάρχουν διαφορετικοί όροι για την ίδια περίοδο, χωρίς αρκετά στοιχεία για να επιλεγεί ή να συνδυαστεί με ασφάλεια κάποια εκδοχή.',
        NUMERIC_PROFILE_FACT_UNRECORDED: 'Λείπουν πραγματικά στοιχεία ωρών ή ευέλικτης προσέλευσης και δεν επαρκούν τα υπόλοιπα ιστορικά στοιχεία για ασφαλή συμπλήρωση.',
        INVALID_NUMERIC_PROFILE_FACT: 'Καταγεγραμμένες ώρες ή ποσά περιέχουν μη έγκυρες αριθμητικές τιμές.',
        HISTORY_COVERAGE_MISSING: 'Μέρος της εργασιακής σχέσης δεν καλύπτεται από τεκμηριωμένους όρους και δεν υπάρχει ασφαλής πηγή συμπλήρωσης.',
        INVALID_RECORDED_CONTRACT_END: 'Η καταγεγραμμένη ημερομηνία λήξης σύμβασης δεν είναι έγκυρη.',
        CONTRACT_END_BEFORE_HIRE: 'Η λήξη σύμβασης προηγείται της πραγματικής πρόσληψης.',
        CONFLICTING_RECORDED_CONTRACT_END: 'Υπάρχουν διαφορετικές λήξεις σύμβασης για την ίδια μεταβολή.',
        CONTRACT_CONTINUATION_NOT_EVIDENCED: 'Υπάρχουν μεταγενέστερα γεγονότα μετά τη λήξη σύμβασης, χωρίς τεκμηριωμένη παράταση.',
        CONTRACT_EXTENSION_NOT_EVIDENCED: 'Η κάλυψη της περιόδου χρειάζεται παράταση σύμβασης που δεν είναι καταγεγραμμένη.',
        NO_RECORDED_EMPLOYMENT: 'Δεν υπάρχει τεκμηριωμένη πρόσληψη για να θεμελιωθεί ιστορική περίοδος.',
        INACTIVE_REFERENCE_WOULD_CHANGE: 'Η πρόταση θα άλλαζε ήδη διατηρημένη παλιά σύνδεση.',
        INVALID_OR_CONFLICTING_INPUT: 'Δεν επιβεβαιώθηκε ότι τα διαθέσιμα στοιχεία περιγράφουν ένα έγκυρο ενιαίο Ιστορικό.',
        INCOMPATIBLE_VERIFIED_CANDIDATES: 'Επαληθεύτηκαν διαφορετικές προτάσεις, χωρίς να προκύπτει μία μοναδική ασφαλής επιλογή.',
        MISSING_PERIOD_TERMS_NOT_EVIDENCED: 'Δεν τεκμηριώθηκαν οι όροι εργασίας που χρειάζονται για τη συμπλήρωση ακάλυπτης περιόδου.',
        MISSING_PERIOD_TERMS_AMBIGUOUS: 'Οι διαθέσιμοι όροι για τη συμπλήρωση ακάλυπτης περιόδου διαφέρουν μεταξύ τους.',
        CONTRARY_MISSING_PERIOD_EVIDENCE: 'Υπάρχουν καταγεγραμμένα στοιχεία που δεν επιτρέπουν τη μεταφορά των ίδιων όρων στην ακάλυπτη περίοδο.',
        UNRECORDED_HIRE_WOULD_BE_CREATED: 'Η πρόταση θα δημιουργούσε πρόσληψη που δεν είναι καταγεγραμμένη.',
        RECORDED_CYCLE_WOULD_BE_REMOVED: 'Η πρόταση θα αφαιρούσε καταγεγραμμένη εργασιακή σχέση.',
        RECORDED_DEPARTURE_WOULD_CHANGE: 'Η πρόταση θα άλλαζε καταγεγραμμένη αποχώρηση χωρίς επιβεβαιωμένα πραγματικά στοιχεία.',
        RECORDED_CHANGE_WOULD_BE_REMOVED: 'Η πρόταση θα αφαιρούσε καταγεγραμμένη μεταβολή όρων χωρίς επιβεβαιωμένα πραγματικά στοιχεία.',
        INACTIVE_ORIGINAL_WOULD_CHANGE: 'Η πρόταση θα άλλαζε παλιά εγγραφή που πρέπει να διατηρηθεί αμετάβλητη.',
        PROTECTED_PAYLOAD_WOULD_CHANGE: 'Η πρόταση θα άλλαζε στοιχεία προστατευμένης εγγραφής που συνδέεται με παλιότερα αποτελέσματα.',
        PROTECTED_SURVIVOR_NOT_ESTABLISHED: 'Δεν επιβεβαιώθηκε πώς θα διατηρηθούν οι συνδέσεις προστατευμένης ιστορικής εγγραφής.',
        LIVE_REFERENCE_BLOCKS_REPAIR: 'Υπάρχει ενεργή σύνδεση με ιστορική εγγραφή που δεν επιτρέπει την προτεινόμενη διόρθωση.',
        PAST_CYCLE_CANNOT_CHANGE_CURRENT_EMPLOYEE: 'Η διόρθωση παλιάς εργασιακής σχέσης θα επηρέαζε τα ισχύοντα στοιχεία του εργαζομένου.',
        PREVIEW_IDENTITY_COLLISION: 'Δεν επιβεβαιώθηκε ότι οι προτεινόμενες νέες εγγραφές παραμένουν διακριτές από τις υπάρχουσες.',
        CYCLIC_CANONICAL_REFERENCE: 'Οι συνδέσεις διατήρησης παλιών εγγραφών σχηματίζουν κύκλο και δεν επιβεβαιώνεται ασφαλές τελικό αποτέλεσμα.',
        INVALID_PROPOSED_WORK_TERMS: 'Οι όροι εργασίας της ελεγχόμενης πρότασης δεν πέρασαν την τελική επαλήθευση.',
        INVALID_PROPOSED_STATE: 'Η συνολική πρόταση δεν πέρασε την τελική επαλήθευση των εγγραφών της.',
        INVALID_TEMPORAL_DATE: 'Στην τελική επαλήθευση εντοπίστηκε ημερομηνία που δεν αναγνωρίζεται ως έγκυρη.',
        NO_ACTIVE_PROFILE: 'Η ελεγχόμενη πρόταση δεν περιλαμβάνει επαληθευμένη ενεργή περίοδο όρων εργασίας.',
        NO_ACTIVE_HISTORY: 'Η ελεγχόμενη πρόταση δεν περιλαμβάνει ενεργό Ιστορικό.',
        FINAL_STATE_NOT_CLEAN: 'Η συνολική τελική κατάσταση της πρότασης δεν πέρασε όλους τους ελέγχους ασφάλειας.',
        CANONICAL_STATE_NOT_CLEAN: 'Η τελική διάταξη των ιστορικών περιόδων δεν πέρασε την επαλήθευση.',
        RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION: 'Η διαθέσιμη πρόταση χρειάζεται επιβεβαίωση πραγματικών γεγονότων και δεν προέκυψε ασφαλής ολοκληρωμένη λύση.'
    };
    result.explanation = require('./employeeHistorySettlementExplanationService')
        .buildSettlementExplanation({ plan, completeHistoryRows: input.completeHistoryRows, descriptions: reasons });
    result.message = `Ο έλεγχος του Ιστορικού σταμάτησε. ${result.explanation.finding} Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Πατήστε «Γιατί σταμάτησε ο έλεγχος;» για την αιτιολόγηση και τα διαθέσιμα στοιχεία.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» για τις ανεξάρτητες εργασίες.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Α.`;
    return result;
}
module.exports = { buildEmployeeHistorySettlementPreview, buildUnifiedEmployeeHistorySettlementPreview };
