'use strict';

const crypto = require('node:crypto');
const {resolveContractDescription}=require('./employeeContractDescriptionService');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot, effectiveStart } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { PROFILE_FIELD_TYPES } = require('./employeeHistoryAutomaticReconstructionContract');
const { CORRECTION_FIELD_REGISTRY, publicRegistryDescriptor, normalizeConfirmedFieldValue,
    normalizedCatalog, validateWorkTermRelationships } = require('./employeeHistoryCorrectionFieldRegistryService');

const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const HIRE = 'hmeromhnia_proslhpshs';
const day = value => C.calendarDate(value)?.toISOString().slice(0,10) || '';
const greek = value => day(value).split('-').reverse().join('/');
const remainingLabels = {
    kathestos_apasxolhshs:'Καθεστώς απασχόλησης',typos_apasxolhshs:'Τύπος απασχόλησης',
    typos_ebdomadas:'Εργάσιμη εβδομάδα',pososto_prosayxhshs_6hs_hmeras:'Προσαύξηση έκτης ημέρας',
    dialleima_se_lepta: 'Διάλειμμα σε λεπτά', dialleima_entos_ektos_orarioy: 'Διάλειμμα εντός ωραρίου',
    synexes_diakekomeno: 'Σπαστό ωράριο', typos_orarioy: 'Είδος ωραρίου',
    evelikth_proselefsh: 'Ευέλικτη προσέλευση σε λεπτά', symbatikes_ores_ergasias: 'Συμβατικές ώρες',
    [C.ENABLED]: 'Εγκεκριμένη ρύθμιση εργασίας', [C.TYPE]: 'Είδος εγκεκριμένης ρύθμισης',
    [C.FROM]: 'Έναρξη εγκεκριμένης ρύθμισης', [C.UNTIL]: 'Λήξη εγκεκριμένης ρύθμισης',
    [C.START]: 'Έναρξη διακοπής ρύθμισης', [C.END]: 'Λήξη διακοπής ρύθμισης',
    [C.DAYS]: 'Ημέρες εφαρμογής ρύθμισης', [C.CATEGORY]: 'Κατηγορία άδειας',
    hmeromhnia_lhxhs_symbashs:'Λήξη σύμβασης',
    eidikh_kathgoria_ergazomenoy: 'Ειδική κατηγορία εργαζομένου', misthologiko_klimakio: 'Μισθολογικό κλιμάκιο',
    synolo_symbashs_basei_oron_ergasias: 'Αποδοχές βάσει όρων εργασίας',
    nomimoHmeromisthio: 'Νόμιμο ημερομίσθιο', nomimoOromisthio: 'Νόμιμο ωρομίσθιο',
    pragmatikoHmeromisthio: 'Πραγματικό ημερομίσθιο', pragmatikoOromisthio: 'Πραγματικό ωρομίσθιο'
};
for (let n=1;n<=3;n++) for (const [suffix,label] of [['apo','Έναρξη'],['eos','Λήξη']])
    remainingLabels[`dialleima_${suffix}_ora_0${n}`] = `${label} διαλείμματος ${n}`;
for (let n=1;n<=15;n++) for (const [prefix,label] of [['stoixeio_symbashs_','Στοιχείο σύμβασης'],['poso_symbashs_','Ποσό σύμβασης'],['poso_symbashs_basei_oron_ergasias_','Ποσό βάσει όρων']])
    remainingLabels[`${prefix}${String(n).padStart(2,'0')}`] = `${label} ${n}`;
for (let n=2;n<=7;n++) remainingLabels[`krathsh_0${n}`] = `Ασφαλιστική κράτηση ${n}`;
const display = value => value == null || value === '' ? 'Δεν υπάρχει καταχώριση' :
    typeof value === 'boolean' ? value ? 'Ναι' : 'Όχι' : value instanceof Date ? greek(value) : String(value);

// Derive editable terms from the complete profile contract. Dates owned by the
// inserted period are generated below, never borrowed or accepted as overrides.
const registeredFields = new Set(CORRECTION_FIELD_REGISTRY.flatMap(entry => entry.fields));
const additionalProfileFields = Object.entries({...PROFILE_FIELD_TYPES,
    hmeromhnia_lhxhs_symbashs:'Date'})
    .filter(([field]) => !registeredFields.has(field) && field !== 'hmeromhnia_isxyos_dialleimatos_apo')
    .map(([field,type]) => ({id:field,label:remainingLabels[field],optional:true,
        nullable:!(C.FACT_FIELDS.includes(field) && ['Number','Boolean','Array'].includes(type)),
        inputType:({Number:'DECIMAL',Boolean:'BOOLEAN',Date:'DATE',Array:'DAYS',String:'TEXT'})[type],
        ...(type === 'Number' ? {min:0} : {})}));
if (additionalProfileFields.some(field => !field.label)) throw new Error('Missing complete profile field label');

function normalizeAdditionalValue(field, value) {
    if (value === null) {
        if (C.FACT_FIELDS.includes(field.id) && ['DECIMAL','BOOLEAN','DAYS'].includes(field.inputType))
            throw new Error('Explicit value required');
        return null;
    }
    if (field.inputType === 'DECIMAL') {
        if (!['number','string'].includes(typeof value) || String(value).trim() === '' ||
            !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Invalid number');
        return Number(value);
    }
    if (field.inputType === 'BOOLEAN') {
        if (typeof value !== 'boolean') throw new Error('Invalid boolean');
        return value;
    }
    if (field.inputType === 'DAYS') {
        if (!Array.isArray(value) || value.some(n => !Number.isInteger(n) || n < 1 || n > 7)) throw new Error('Invalid days');
        return [...new Set(value)].sort();
    }
    if (typeof value !== 'string' || value.length > 1000) throw new Error('Invalid text');
    return field.inputType === 'DATE' ? C.calendarDate(value) : value.trim() || null;
}

// Each source is explicitly confirmed, never silently inherited. All registered
// business values must be supplied anew; remaining stored facts are shown in full.
function planMissingHistoryPeriods({ scope, currentEmployee, historyRows, decisions, catalogs, insertId }) {
    const rows = historyRows.map(row => ({...row}));
    const active = semanticHistoryRows(rows);
    const key = index => crypto.createHash('sha256').update(`${insertId}:${index}`).digest('hex').slice(0,24);
    if (!rows.length && C.readEmploymentProfile(currentEmployee).recorded && effectiveStart(currentEmployee)) {
        rows.push({...buildCompleteProfileSnapshot({current:currentEmployee,effectiveFrom:effectiveStart(currentEmployee)}),
            ...scope,_id:key(0),afora_proslhpsh:day(effectiveStart(currentEmployee)) === day(currentEmployee[HIRE]),
            [END]:currentEmployee[END] ?? null});
    }
    const gaps = employeeHistoryCoverageGaps({currentEmployee,historyRows:rows});
    if (!gaps.length || gaps.length > 30) return {blocked:'Δεν εντοπίστηκε ελλείπουσα περίοδος που να μπορεί να συμπληρωθεί με αυτή την επιλογή.'};
    const sources = [...active, currentEmployee];
    const rules = gaps.map((gap,index) => ({gap,conflictId:`MISSING_PERIOD_${index+1}`,
        candidates:sources.filter(row => day(row[HIRE]) === gap.hire)}));
    if (rules.some(rule => !rule.candidates.length)) return {blocked:'Δεν βρέθηκε η εργασιακή σχέση της περιόδου. 1. Πάτησε «Ακύρωση». 2. Ζήτησε έλεγχο της πρόσληψης από διαχειριστή. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    const missingCatalog=CORRECTION_FIELD_REGISTRY.find(entry=>entry.catalog && !normalizedCatalog(catalogs[entry.catalog]).length);
    if(missingCatalog) return {blocked:`Δεν φορτώθηκαν οι διαθέσιμες επιλογές για «${missingCatalog.label}». 1. Πάτησε «Ακύρωση». 2. Άνοιξε ξανά τον εργαζόμενο. 3. Αν παραμένει το πρόβλημα, ζήτησε έλεγχο των καταλόγων από διαχειριστή.`};
    if (!decisions) return {conflicts:rules.map(({gap,conflictId,candidates}) => ({
        conflictId,kind:'PROFILE',required:true,
        period:{from:gap.from,to:gap.to,label:`${greek(gap.from)} – ${gap.to ? greek(gap.to) : 'χωρίς λήξη'}`},
        issue:'Λείπουν οι πραγματικοί όροι αυτής της περιόδου.',
        decisionRequired:'Συμπλήρωσε τους όρους και επιβεβαίωσε μόνο τα υπόλοιπα στοιχεία που γνωρίζεις.',
        intents:[{id:'ENTER_DIFFERENT_VALUE',label:'Συμπληρώνω τους όρους και επιβεβαιώνω ότι όλα τα υπόλοιπα στοιχεία που εμφανίζονται ίσχυαν τότε',
            description:'1. Συμπλήρωσε τους βασικούς όρους. Στα «Υπόλοιπα στοιχεία» άλλαξε όσα διέφεραν. Επιβεβαίωσε τα υπόλοιπα μόνο αν ίσχυαν τότε.',
            valueControl:{type:'PROFILE_FIELDS',required:true,
                beforeValues:[],
                fields:[...CORRECTION_FIELD_REGISTRY.map(entry=>publicRegistryDescriptor(entry.id,catalogs)),...additionalProfileFields],
                baselineValues:candidates.map((row,i)=>({value:`PROFILE_CANDIDATE_${i+1}`,
                    label:`Διαθέσιμα στοιχεία από ${greek(effectiveStart(row) || row[HIRE])}`,
                    summary:Object.entries(remainingLabels).filter(([field])=>Object.hasOwn(row,field))
                        .map(([field,label])=>({fieldId:field,label,value:{value:display(row[field]),label:display(row[field])}}))}))}}]
    }))};
    if (decisions.length !== rules.length) return {blocked:'Χρειάζεται απάντηση για κάθε ελλείπουσα περίοδο. Επέστρεψε στις ερωτήσεις και συμπλήρωσε όλα τα στοιχεία.'};
    for (const [index,rule] of rules.entries()) {
        const decision=decisions[index];
        if (decision.conflictId !== rule.conflictId || decision.intent !== 'ENTER_DIFFERENT_VALUE' ||
            !/^PROFILE_CANDIDATE_[1-9]\d*$/.test(decision.value || '')) return {blocked:'Οι απαντήσεις δεν αντιστοιχούν στις ελλείπουσες περιόδους. Άνοιξε ξανά τη διόρθωση.'};
        const source=rule.candidates[Number(decision.value.split('_').at(-1))-1];
        const values=decision.values;
        const allowedFields = new Set([...CORRECTION_FIELD_REGISTRY.map(entry=>entry.id),...additionalProfileFields.map(field=>field.id)]);
        if (!source || !values || Object.keys(values).some(field=>!allowedFields.has(field)) ||
            CORRECTION_FIELD_REGISTRY.some(entry=>!Object.hasOwn(values,entry.id))) return {blocked:'Λείπουν πραγματικοί όροι εργασίας. Συμπλήρωσε όλα τα ζητούμενα στοιχεία της περιόδου.'};
        const unknown=additionalProfileFields.find(field=>!Object.hasOwn(source,field.id) && !Object.hasOwn(values,field.id));
        if (unknown) return {blocked:`Δεν υπάρχει καταγεγραμμένη τιμή για «${unknown.label}». 1. Άνοιξε τα «Υπόλοιπα στοιχεία». 2. Δήλωσε την πραγματική τιμή ή επιβεβαίωσε ότι δεν υπήρχε. Δεν αποθηκεύτηκε καμία αλλαγή.`};
        const input={};
        try { for (const entry of CORRECTION_FIELD_REGISTRY) input[entry.fields[0]]=normalizeConfirmedFieldValue(entry.id,values[entry.id],
            {allowedValues:entry.catalog ? normalizedCatalog(catalogs[entry.catalog]) : []});
        } catch (error) { return {blocked:`Το στοιχείο «${CORRECTION_FIELD_REGISTRY.find(entry=>entry.id === error.fieldId)?.label || 'Όροι εργασίας'}» δεν έχει έγκυρη τιμή. Επέστρεψε στην περίοδο και συμπλήρωσέ το από τα πραγματικά στοιχεία.`}; }
        for (const field of additionalProfileFields) if (Object.hasOwn(values,field.id)) {
            try { input[field.id] = normalizeAdditionalValue(field,values[field.id]); }
            catch { return {blocked:`Το στοιχείο «${field.label}» δεν έχει έγκυρη τιμή. 1. Επέστρεψε στην περίοδο. 2. Συμπλήρωσε την πραγματική τιμή. Δεν αποθηκεύτηκε καμία αλλαγή.`}; }
        }
        for(const [catalog,field] of [['CONTRACT_CATEGORY','kathgoria_symbashs'],['CONTRACT_SPECIALTY','eidikothta_symbashs']]) {
            if(!resolveContractDescription(catalogs,catalog,input[field],input))
                return {blocked:'Η κατηγορία ή η ειδικότητα δεν ανήκει στη σύμβαση που επέλεξες. Επέστρεψε στην περίοδο και διάλεξε τον σωστό συνδυασμό.'};
        }
        const from=C.calendarDate(rule.gap.from);
        let snapshot;
        try { snapshot=buildCompleteProfileSnapshot({current:source,input,effectiveFrom:from}); }
        catch (error) { return {blocked:`Οι όροι για «${remainingLabels[error.field] || 'Στοιχεία απασχόλησης'}» δεν συμφωνούν. 1. Επέστρεψε στην περίοδο. 2. Έλεγξε τα διαστήματα και τις ρυθμίσεις που δήλωσες. Δεν αποθηκεύτηκε καμία αλλαγή.`}; }
        const inserted={...snapshot,...scope,
            _id:key(index+1),[HIRE]:C.calendarDate(rule.gap.hire),[END]:C.calendarDate(rule.gap.to),
            hmeromhnia_apoxorhshs:null,afora_proslhpsh:rule.gap.from === rule.gap.hire};
        // Unrelated event/schedule boundaries belong to the source period.
        for (const field of [ 'hmeromhnia_allaghs_symbashs','hmeromhnia_allaghs_orarioy_apo','hmeromhnia_allaghs_orarioy_eos']) inserted[field]=null;
        try { validateWorkTermRelationships(inserted); } catch { return {blocked:'Οι ημέρες και οι ώρες εργασίας δεν συμφωνούν. Έλεγξε τις εβδομαδιαίες ώρες και τον μέσο όρο ημερήσιας εργασίας.'}; }
        rows.push(inserted);
    }
    rows.sort((a,b)=>day(a[HIRE]).localeCompare(day(b[HIRE])) || day(effectiveStart(a)).localeCompare(day(effectiveStart(b))));
    return {desiredRows:rows.map((row,index)=>({...row,aa_eggrafhs:String(index+1).padStart(4,'0')})),
        affectedIds:rows.filter(row=>!historyRows.some(original=>String(original._id)===String(row._id))).map(row=>String(row._id))};
}
// Detached, evidence-only candidate for the central preview. Reuse the coverage
// definition used by manual missing-period correction, without its normalizer's
// defaults, schema certification, renumbering or persistence behavior.
function planEvidencedMissingHistoryPeriods({ scope, currentEmployee, historyRows }) {
    const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
    const { PROFILE_FIELDS, CRITICAL_NUMBERS, CHANGE, CONTRACT_END } = require('./employeeHistoryAutomaticReconstructionContract');
    const { stringify } = require('./employeeHistoryAutomaticReconstructionApplyContract');
    const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');
    const cycles = buildEmploymentCycles({ currentEmployee, history: historyRows });
    const gaps = employeeHistoryCoverageGaps({ currentEmployee, historyRows });
    if (!gaps.length || gaps.length > 30) return { status: 'NOT_APPLICABLE', reason: 'NO_BOUNDED_MISSING_PERIOD_PLAN' };
    const invalid = gaps.find(gap => gap.reason);
    if (invalid) return { status: 'BLOCKED', reason: invalid.reason, coverageGaps: gaps };
    const blocked = reason => ({ status: 'BLOCKED', reason, coverageGaps: gaps });
    const active = semanticHistoryRows(historyRows);
    const rows = clone(historyRows), assumptions = [];
    for (const gap of gaps) {
        const cycle = cycles.find(item => item.hire_date === gap.hire);
        if (!cycle || gap.from < cycle.hire_date || cycle.departure_date && (!gap.to || gap.to > cycle.departure_date)) {
            return blocked('GAP_OUTSIDE_RECORDED_EMPLOYMENT');
        }
        const previous = active.find(row => String(row._id) === gap.beforeHistoryId);
        const next = active.find(row => String(row._id) === gap.afterHistoryId);
        const currentFrom = day(currentEmployee[START]) || day(currentEmployee[CHANGE]);
        const source = previous || next || (day(currentEmployee[HIRE]) === gap.hire &&
            currentFrom === gap.hire ? currentEmployee : null);
        if (!source || day(source[HIRE]) !== gap.hire ||
            !CRITICAL_NUMBERS.every(field => typeof source[field] === 'number' && source[field] > 0 && Number.isFinite(source[field]))) {
            return blocked('MISSING_PERIOD_TERMS_NOT_EVIDENCED');
        }
        const sameBoundary = active.filter(row => day(row[HIRE]) === gap.hire &&
            day(row[START]) === day(source[START]));
        if (sameBoundary.some(row => PROFILE_FIELDS.some(field => row[field] != null && row[field] !== '' &&
            source[field] != null && source[field] !== '' && JSON.stringify(row[field]) !== JSON.stringify(source[field])))) {
            return blocked('MISSING_PERIOD_TERMS_AMBIGUOUS');
        }
        if (day(source[CONTRACT_END]) && (!gap.to || gap.to > day(source[CONTRACT_END]))) {
            return blocked('CONTRACT_EXTENSION_NOT_EVIDENCED');
        }
        // A hire record with different actual terms defeats backward continuity.
        const contrary = active.some(row => day(row[HIRE]) === gap.hire &&
            (day(row[START]) || day(row[CHANGE]) || gap.hire) <= gap.from &&
            PROFILE_FIELDS.some(field => row[field] != null && row[field] !== '' &&
                source[field] != null && source[field] !== '' &&
                JSON.stringify(row[field]) !== JSON.stringify(source[field])));
        if (contrary) return blocked('CONTRARY_MISSING_PERIOD_EVIDENCE');
        const terms = Object.fromEntries([...PROFILE_FIELDS, CONTRACT_END].filter(field =>
            Object.hasOwn(source, field)).map(field => [field, clone(source[field])]));
        const inserted = { ...scope, ...terms,
            _id: crypto.createHash('sha256').update(stringify({ kind: 'EVIDENCED_MISSING_PERIOD', scope, gap, terms })).digest('hex').slice(0,24),
            [HIRE]: C.calendarDate(gap.hire), [START]: C.calendarDate(gap.from), [END]: C.calendarDate(gap.to),
            afora_proslhpsh: gap.from === gap.hire, afora_allagh_oron_ergasias: true };
        if (cycle.departure_date && gap.to === cycle.departure_date) inserted.hmeromhnia_apoxorhshs = C.calendarDate(cycle.departure_date);
        if (rows.some(row => String(row._id) === inserted._id)) return blocked('PREVIEW_IDENTITY_COLLISION');
        rows.push(inserted);
        assumptions.push({ code: previous ? 'RECORDED_TERMS_CONTINUE_WITHIN_EMPLOYMENT' :
            next ? 'EARLIEST_HISTORICAL_TERMS_CONTINUE_BACK_TO_HIRE' : 'CURRENT_TERMS_RECORDED_AT_HIRE',
        from: gap.from, to: gap.to, sourceHistoryId: String(source._id),
        businessRationale: previous ? 'Οι προηγούμενοι καταγεγραμμένοι όροι συνεχίζονται μέσα στην ίδια εργασιακή σχέση μέχρι την επόμενη τεκμηριωμένη μεταβολή.' :
            next ? 'Οι πρώτοι διαθέσιμοι ιστορικοί όροι χρησιμοποιούνται από την τεκμηριωμένη πρόσληψη, χωρίς αντίθετα παλιότερα στοιχεία. Οι επόμενες πραγματικές μεταβολές διατηρούνται.' :
                'Τα ισχύοντα στοιχεία έχουν καταγεγραμμένη έναρξη κατά την πρόσληψη και θεμελιώνουν την ελλείπουσα αρχική περίοδο.' });
    }
    return { status: 'APPLICABLE', desiredHistoryRows: rows, assumptions };
}
module.exports={planMissingHistoryPeriods,planEvidencedMissingHistoryPeriods,additionalProfileFields,normalizeAdditionalValue};
