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
    if (plan.reason === 'PREDECLARED_WORK_TIME_ONLY') {
        const greek=value=>value?.split('-').reverse().join('/') || 'χωρίς λήξη';
        result.reviewRequired=true;
        result.historyStatus='REVIEW_REQUIRED';
        result.actions=plan.scheduleEvidence.map(period=>`Προδηλωμένο ωράριο ${greek(period.from)}–${greek(period.to)}: ${period.hmeres_ergasias_ebdomadas} ${period.hmeres_ergasias_ebdomadas===1?'ημέρα':'ημέρες'} / ${period.ores_ergasias_ebdomadas} ώρες την εβδομάδα. Πρόκειται για δηλωμένο πρόγραμμα εργασίας, όχι για παρουσίες κάρτας. Δεν πιστοποιούνται αποδοχές, ασφάλιση ή άλλοι όροι σύμβασης.`);
        const overlap=plan.reviewRows.map(row=>`Α/Α ${row.sequence}: ${greek(row.from)}–${greek(row.to)}, ${row.days} ημέρες / ${row.hours} ώρες`).join(' · ');
        const pending=overlap ? `Χρειάζεται μία συνολική επιβεβαίωση: ποιο ακριβώς διάστημα ίσχυσε για καθεμία από τις διαφορετικές απασχολήσεις (${overlap}); Καμία από αυτές τις εγγραφές δεν θεωρείται λανθασμένη χωρίς τεκμηρίωση.` : 'Χρειάζονται οι υπόλοιποι πραγματικοί ιστορικοί όροι της αρχικής περιόδου.';
        result.message=`Ο έλεγχος του Ιστορικού σταμάτησε. Το προδηλωμένο ωράριο τεκμηριώνει μόνο τις ημέρες και ώρες της αρχικής περιόδου. ${pending} Η πραγματική λύση ${greek(plan.recordedDeparture)} και η συμφωνημένη λήξη σύμβασης ${greek(plan.recordedContractEnd)} διατηρούνται διακριτές. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Επιβεβαιώστε με τα αντίστοιχα έγγραφα τις ακριβείς περιόδους και τους ελλείποντες όρους της αρχικής περιόδου.\n2. Χρησιμοποιήστε τον συνολικό έλεγχο διόρθωσης του Ιστορικού και επαναλάβετε την Αυτόματη Τακτοποίηση.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΟΔ-01.`;
        result.explanation={reviewed:result.actions.join('\n'),finding:pending,locations:result.actions,
            example:'Υποθετικό παράδειγμα — δεν είναι στοιχεία του εργαζομένου σας: ένα δηλωμένο ωράριο οκτώ ωρών αποδεικνύει τον προγραμματισμένο χρόνο, αλλά δεν αποδεικνύει τις αποδοχές ή την ασφάλιση εκείνης της περιόδου.',
            safety:'Οι ιστορικές εγγραφές, τα συνδεδεμένα αποτελέσματα και οι έλεγχοι διατηρούνται. Δεν επιλέχθηκε αυθαίρετα ποια απασχόληση ίσχυσε.',
            checks:['Επιβεβαιώστε τις ακριβείς περιόδους και τους ελλείποντες ιστορικούς όρους.',
                'Ανοίξτε τον συνολικό έλεγχο διόρθωσης και επαναλάβετε την Αυτόματη Τακτοποίηση. Δεν αποθηκεύτηκε καμία αλλαγή.'],reference:'ΙΣΤ-ΠΡΟΔ-01'};
        if(plan.review) {
            const changes=[...new Set(input.completeHistoryRows.map(row=>row.hmeromhnia_allaghs_symbashs).filter(Boolean).map(value=>calendarDate(value).toISOString().slice(0,10)))];
            result.actions.push(`Καταγεγραμμένες αλλαγές σύμβασης: ${changes.map(greek).join(', ')}. Πραγματική συναινετική λύση: ${greek(plan.recordedDeparture)}. Συμβατική λήξη: ${greek(plan.recordedContractEnd)}.`);
            result.message=result.actions.join('\n')+'\n'+pending+'\n'+(plan.review.validationMessage || 'Συμπληρώστε συγκεντρωτικά τις ημερομηνίες της 0003 και τους ελλείποντες αρχικούς όρους με τεκμηρίωση.')+' Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ελέγξτε τα στοιχεία και τα έγγραφα.\n2. Πατήστε «Προεπισκόπηση επιλογών» μόνο όταν έχουν συμπληρωθεί όλα.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΟΔ-02.';
            result.state='decision';
            result.questions=[{id:'predeclared_review__confirmedFacts',type:'HISTORY_FACTS',required:true,
                label:'Συγκεντρωτική επιβεβαίωση πραγματικών ελλειπόντων στοιχείων',resolution:plan.review.worksheet}];
            result.decisionContext={snapshotFingerprint:plan.snapshotFingerprint,baseSelections:{},groups:[{
                id:'predeclared_review',kind:'USER_CORRECTION',questionIds:['predeclared_review__confirmedFacts']}]};
            if(plan.review.previewValidated) {
                result.state='split';result.questions=[];
                result.message='Η συνολική προεπισκόπηση επικυρώθηκε με τα τεκμηριωμένα στοιχεία σας. Το αποθηκευμένο Ιστορικό παραμένει σε REVIEW_REQUIRED μέχρι να υποστηριχθεί ελεγμένη ατομική εφαρμογή. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Πατήστε «Προβολή διορθώσεων».\n2. Κλείστε την προεπισκόπηση για να συνεχίσετε.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΟΔ-03.';
                result.actions.push(...plan.review.logicalRows.map(row=>`Προτεινόμενη περίοδος ${greek(calendarDate(row.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10))}–${greek(calendarDate(row.hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0,10))}: ${row.hmeres_ergasias_ebdomadas} ημέρες / ${row.ores_ergasias_ebdomadas} ώρες.`));
                result.actions.push('Και οι έξι φυσικές εγγραφές, οι προστατευμένες αναφορές, τα προηγούμενα αποτελέσματα και οι έλεγχοι παραμένουν αμετάβλητα.');
                result.choices=['Οι ημερομηνίες της 0003 και οι αρχικοί όροι δηλώθηκαν ρητά με τεκμηρίωση.'];
            }
        }
        return result;
    }
    const imported = require('../../utils/ergazomenoi/employeeImportProvenance').verifiedImport(input.currentEmployee);
    if (imported) result.actions.push(`Έναρξη παρακολούθησης: ${new Date(imported.trackingStartDate).toISOString().slice(0,10).split('-').reverse().join('/')}. Οι προγενέστεροι όροι δεν πιστοποιούνται από τη μεταφορά.`);
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
        REFERENCE_STATE_NOT_LOADED: 'Δεν ολοκληρώθηκε ο έλεγχος για το ποια παλιότερα αποτελέσματα χρησιμοποιούν τις εγγραφές του Ιστορικού.',
        INVALID_REFERENCE_EVIDENCE: 'Τα στοιχεία για το ποια παλιότερα αποτελέσματα χρησιμοποιούν τις εγγραφές δεν συμφωνούν μεταξύ τους.',
        REFERENCE_SEMANTICS_UNKNOWN: 'Υπάρχει σύνδεση εγγραφής με παλιότερα αποτελέσματα, αλλά δεν γνωρίζουμε αν μια αλλαγή θα τα επηρέαζε.',
        EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE: 'Βρέθηκε προηγούμενη πρόσληψη χωρίς καταγεγραμμένη αποχώρηση πριν από την επαναπρόσληψη.',
        EMPLOYMENT_CYCLE_OVERLAP: 'Δύο καταγεγραμμένες περίοδοι πρόσληψης και αποχώρησης περιλαμβάνουν κοινές ημέρες.',
        EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE: 'Η καταγεγραμμένη αποχώρηση είναι πριν από την πρόσληψη.',
        AMBIGUOUS_LIFECYCLE_EVENTS: 'Υπάρχουν διαφορετικές ημερομηνίες αποχώρησης για την ίδια πρόσληψη και δεν γνωρίζουμε ποια ισχύει.',
        CONFLICTING_PROFILE_EVENTS: 'Για την ίδια περίοδο υπάρχουν διαφορετικοί όροι εργασίας και δεν γνωρίζουμε ποιοι ίσχυαν.',
        NUMERIC_PROFILE_FACT_UNRECORDED: 'Λείπουν στοιχεία για τις ώρες εργασίας ή την ευέλικτη προσέλευση και δεν βρέθηκαν καταχωρίσεις που να τα επιβεβαιώνουν.',
        INVALID_NUMERIC_PROFILE_FACT: 'Κάποιες ώρες ή ποσά δεν έχουν αποδεκτή αριθμητική τιμή για τον υπολογισμό.',
        HISTORY_COVERAGE_MISSING: 'Ο έλεγχος δεν μπόρεσε να επιβεβαιώσει τους όρους εργασίας για ολόκληρη την περίοδο της πρόσληψης.',
        INVALID_RECORDED_CONTRACT_END: 'Η καταγεγραμμένη λήξη σύμβασης δεν αναγνωρίζεται ως ημερομηνία.',
        CONTRACT_END_BEFORE_HIRE: 'Η καταγεγραμμένη σύμβαση λήγει πριν από την πρόσληψη.',
        CONFLICTING_RECORDED_CONTRACT_END: 'Για την ίδια αλλαγή σύμβασης έχουν καταχωριστεί διαφορετικές ημερομηνίες λήξης.',
        CONTRACT_CONTINUATION_NOT_EVIDENCED: 'Υπάρχει καταχώριση μετά τη λήξη της σύμβασης, αλλά δεν βρέθηκε καταγεγραμμένη παράταση που να την εξηγεί.',
        CONTRACT_EXTENSION_NOT_EVIDENCED: 'Για να καλυφθεί η περίοδος που ελέγχθηκε θα χρειαζόταν παράταση σύμβασης, η οποία δεν είναι καταγεγραμμένη.',
        NO_RECORDED_EMPLOYMENT: 'Δεν βρέθηκε καταγεγραμμένη πρόσληψη για να προσδιοριστεί η αρχή της εργασίας.',
        INACTIVE_REFERENCE_WOULD_CHANGE: 'Η διόρθωση που εξετάστηκε θα άλλαζε μια παλιά σύνδεση εγγραφής με ήδη υπολογισμένα αποτελέσματα.',
        INVALID_OR_CONFLICTING_INPUT: 'Δεν μπορέσαμε να συνδυάσουμε όλα τα διαθέσιμα στοιχεία σε συνεχείς περιόδους εργασίας.',
        INCOMPATIBLE_VERIFIED_CANDIDATES: 'Βρέθηκαν διαφορετικοί τρόποι διόρθωσης που περνούν τους ελέγχους, αλλά δίνουν διαφορετικούς όρους ή περιόδους εργασίας.',
        MISSING_PERIOD_TERMS_NOT_EVIDENCED: 'Δεν βρέθηκαν καταγεγραμμένοι όροι εργασίας για το διάστημα που χρειάζεται συμπλήρωση.',
        MISSING_PERIOD_TERMS_AMBIGUOUS: 'Για το διάστημα που χρειάζεται συμπλήρωση υπάρχουν διαφορετικές εκδοχές όρων εργασίας.',
        CONTRARY_MISSING_PERIOD_EVIDENCE: 'Υπάρχουν καταχωρίσεις που δεν συμφωνούν με την αντιγραφή των ίδιων όρων εργασίας στο διάστημα που χρειάζεται συμπλήρωση.',
        UNRECORDED_HIRE_WOULD_BE_CREATED: 'Η διόρθωση που εξετάστηκε θα πρόσθετε πρόσληψη που δεν υπάρχει στα καταγεγραμμένα στοιχεία.',
        RECORDED_CYCLE_WOULD_BE_REMOVED: 'Η διόρθωση που εξετάστηκε θα αφαιρούσε μια καταγεγραμμένη πρόσληψη και την περίοδο εργασίας της.',
        RECORDED_DEPARTURE_WOULD_CHANGE: 'Η διόρθωση που εξετάστηκε θα άλλαζε καταγεγραμμένη αποχώρηση χωρίς επιβεβαίωση από τα πραγματικά στοιχεία.',
        RECORDED_CHANGE_WOULD_BE_REMOVED: 'Η διόρθωση που εξετάστηκε θα αφαιρούσε καταγεγραμμένη αλλαγή σύμβασης χωρίς να έχει επιβεβαιωθεί ότι είναι λάθος.',
        INACTIVE_ORIGINAL_WOULD_CHANGE: 'Η διόρθωση που εξετάστηκε θα άλλαζε παλιά εγγραφή που πρέπει να διατηρηθεί όπως καταχωρίστηκε.',
        PROTECTED_PAYLOAD_WOULD_CHANGE: 'Η διόρθωση που εξετάστηκε θα άλλαζε στοιχεία εγγραφής που χρησιμοποιείται σε παλιότερα αποτελέσματα.',
        PROTECTED_SURVIVOR_NOT_ESTABLISHED: 'Δεν επιβεβαιώθηκε πώς θα διατηρηθούν τα στοιχεία εγγραφής που χρησιμοποιείται σε παλιότερα αποτελέσματα.',
        LIVE_REFERENCE_BLOCKS_REPAIR: 'Υπάρχουν αποτελέσματα που εξακολουθούν να χρησιμοποιούν την ιστορική εγγραφή και δεν επιτρέπουν τη διόρθωση που εξετάστηκε.',
        PAST_CYCLE_CANNOT_CHANGE_CURRENT_EMPLOYEE: 'Η διόρθωση προηγούμενης πρόσληψης θα άλλαζε και τα σημερινά στοιχεία του εργαζομένου.',
        PREVIEW_IDENTITY_COLLISION: 'Δεν μπορέσαμε να ξεχωρίσουμε με βεβαιότητα μια νέα προτεινόμενη εγγραφή από μια υπάρχουσα.',
        CYCLIC_CANONICAL_REFERENCE: 'Οι παλιές εγγραφές παραπέμπουν η μία στην άλλη χωρίς να προκύπτει ποια στοιχεία χρησιμοποιήθηκαν στα αποτελέσματα.',
        INVALID_PROPOSED_WORK_TERMS: 'Οι ώρες, ημέρες ή άλλοι όροι εργασίας στη διόρθωση που εξετάστηκε δεν συμφωνούν μεταξύ τους ή έχουν ελλείψεις.',
        INVALID_PROPOSED_STATE: 'Δεν επιβεβαιώθηκε ότι οι εγγραφές της διόρθωσης περιγράφουν σωστά όλες τις περιόδους εργασίας.',
        INVALID_TEMPORAL_DATE: 'Στη διόρθωση που εξετάστηκε υπήρχε τιμή που δεν αναγνωρίζεται ως ημερομηνία.',
        NO_ACTIVE_PROFILE: 'Στη διόρθωση που εξετάστηκε δεν απέμενε περίοδος με όρους εργασίας που να μπορούν να χρησιμοποιηθούν.',
        NO_ACTIVE_HISTORY: 'Στη διόρθωση που εξετάστηκε δεν απέμενε εγγραφή που να περιγράφει την εργασία.',
        FINAL_STATE_NOT_CLEAN: 'Δεν επιβεβαιώθηκε ότι η συνολική διόρθωση διατηρεί σωστά όλες τις περιόδους και τα παλιότερα αποτελέσματα.',
        CANONICAL_STATE_NOT_CLEAN: 'Δεν επιβεβαιώθηκε ότι μετά τη διόρθωση οι περίοδοι εργασίας και οι όροι τους συμφωνούν μεταξύ τους.',
        RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION: 'Χρειάζεται επιβεβαίωση των πραγματικών ημερομηνιών ή όρων εργασίας πριν επιλεγεί διόρθωση.',
    };
    result.explanation = require('./employeeHistorySettlementExplanationService')
        .buildSettlementExplanation({ plan, completeHistoryRows: input.completeHistoryRows, currentEmployee: input.currentEmployee,
            protectedReferenceSummary: input.protectedReferenceSummary, descriptions: reasons });
    result.message = `Ο έλεγχος του Ιστορικού σταμάτησε. ${result.explanation.finding} Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Πατήστε «Γιατί σταμάτησε ο έλεγχος;» για την αιτιολόγηση και τα διαθέσιμα στοιχεία.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» για τις ανεξάρτητες εργασίες.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Α.`;
    return result;
}
module.exports = { buildEmployeeHistorySettlementPreview, buildUnifiedEmployeeHistorySettlementPreview };
