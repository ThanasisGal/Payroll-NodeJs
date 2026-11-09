'use strict';

// Pure composition inside the existing correction boundary. No model writes or
// separate transactions: all periods form one desired state for the same writer.
const crypto=require('node:crypto');
const C=require('../../utils/ergazomenoi/employmentProfileContract');
const {effectiveStart,buildCompleteProfileSnapshot}=require('../../utils/ergazomenoi/employmentProfileHistory');
const {semanticHistoryRows,REDUNDANT_STATUS_FIELD,WITHDRAWN_ERRONEOUS}=require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const {CORRECTION_FIELD_REGISTRY,publicRegistryDescriptor,normalizeConfirmedFieldValue,normalizedCatalog,validateWorkTermRelationships}=require('./employeeHistoryCorrectionFieldRegistryService');
const {additionalProfileFields,normalizeAdditionalValue,planMissingHistoryPeriods}=require('./employeeHistoryMissingPeriodCorrectionService');
const {canonicalizeEmployeeHistory,CANONICAL_STATUSES}=require('./employeeHistoryCanonicalizationService');
const {resolveContractDescription}=require('./employeeContractDescriptionService');
const START='hmeromhnia_isxyos_oron_ergasias_apo',END='hmeromhnia_isxyos_oron_ergasias_eos',HIRE='hmeromhnia_proslhpshs',DEPARTURE='hmeromhnia_apoxorhshs';
const day=value=>C.calendarDate(value)?.toISOString().slice(0,10) || '';
const fields=catalogs=>[...CORRECTION_FIELD_REGISTRY.map(entry=>publicRegistryDescriptor(entry.id,catalogs)),...additionalProfileFields];
const key=row=>'PERIOD_'+crypto.createHash('sha256').update(String(row._id)).digest('hex').slice(0,16).toUpperCase();
const raw=value=>value instanceof Date ? day(value) : value;
const same=(a,b)=>JSON.stringify(a instanceof Date ? day(a) : a)===JSON.stringify(b instanceof Date ? day(b) : b);
const identity=field=>CORRECTION_FIELD_REGISTRY.find(entry=>entry.id===field)?.fields[0] || field;
const actionField={id:'ROW_ACTION',label:'Εγγραφή περιόδου',inputType:'CATALOG_CHOICE',catalogValues:[
    {value:'KEEP',label:'Διατήρηση της εγγραφής'},{value:'REMOVE',label:'Η εγγραφή είναι λανθασμένη — αφαίρεση ή ασφαλής απόσυρση'}]};
function periodConflict(row,catalogs,answer,firstInCycle=false,allowLater=false) {
    const profile=Boolean(effectiveStart(row));
    const descriptors=[actionField,...(firstInCycle ? [{id:'HIRE_DATE',label:'Πρόσληψη του συγκεκριμένου κύκλου',inputType:'DATE',...(!allowLater ? {max:day(row[HIRE])} : {})}] : []),...(row[DEPARTURE] ? [{id:'DEPARTURE_DATE',label:'Αποχώρηση του συγκεκριμένου κύκλου',inputType:'DATE',nullable:true}] : []),...(profile ? [{id:'PERIOD_START',label:'Έναρξη περιόδου',inputType:'DATE'},
        {id:'PERIOD_END',label:'Λήξη περιόδου',inputType:'DATE',nullable:true},...fields(catalogs)] : [])];
    const before=[{fieldId:'ROW_ACTION',value:'KEEP'},...(firstInCycle ? [{fieldId:'HIRE_DATE',value:day(row[HIRE])}] : []),...(row[DEPARTURE] ? [{fieldId:'DEPARTURE_DATE',value:day(row[DEPARTURE])}] : []),...(profile ? [{fieldId:'PERIOD_START',value:day(effectiveStart(row))},
        {fieldId:'PERIOD_END',value:row[END] ? day(row[END]) : null},
        ...fields(catalogs).filter(field=>row[identity(field.id)]!==undefined).map(field=>({fieldId:field.id,value:raw(row[identity(field.id)])}))] : [])];
    const hire=day(row[HIRE]);
    return {conflictId:key(row),kind:'PROFILE',required:true,
        period:{from:day(effectiveStart(row) || row[HIRE]),to:row[END] ? day(row[END]) : null,label:`Κύκλος πρόσληψης ${hire} · περίοδος ${day(effectiveStart(row) || row[HIRE])}`},
        issue:'Ελέγχονται μαζί όλες οι περίοδοι και οι μεταξύ τους εξαρτήσεις.',decisionRequired:'1. Επιβεβαίωσε τα πραγματικά στοιχεία αυτής της περιόδου.'+(firstInCycle && !allowLater ? ' Μεταγενέστερη πρόσληψη δεν διατίθεται σε αυτή την έκδοση. Διατήρησε την πρόσληψη ή δήλωσε προγενέστερη ημερομηνία. Μπορείς να διορθώσεις όρους, περιόδους, αποχώρηση και λανθασμένες εγγραφές.' : ''),
        intents:[{id:'ENTER_DIFFERENT_VALUE',label:'Ελέγχω αυτή την περίοδο',description:'Οι απαντήσεις διατηρούνται μέχρι τη συνολική προεπισκόπηση. Δεν αποθηκεύεται ακόμη καμία αλλαγή.',
            valueControl:{type:'PROFILE_FIELDS',required:true,fields:descriptors,beforeValues:before,
                ...(answer ? {initialValues:answer.values} : {}),baselineValues:[{value:'PROFILE_CANDIDATE_1',label:`Καταγεγραμμένη περίοδος του κύκλου ${hire}`,summary:[]}]}}]};
}
function planUnifiedHistoryCorrection({scope,currentEmployee,historyRows,decisions,catalogs,insertId,referencesById={},hireDependencies=null}) {
    if(currentEmployee.employment_profile_pre_v1) return {blocked:'Υπάρχουν παλαιότεροι όροι που δεν έχουν ακόμη συμφωνηθεί. 1. Έλεγξε τα καταγεγραμμένα στοιχεία του Ιστορικού. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    const missingCatalog=CORRECTION_FIELD_REGISTRY.find(entry=>entry.catalog && !normalizedCatalog(catalogs[entry.catalog]).length);
    if(missingCatalog) return {blocked:`Δεν φορτώθηκαν οι επιλογές για «${missingCatalog.label}». 1. Άνοιξε ξανά τον εργαζόμενο. 2. Αν το πρόβλημα παραμένει, ζήτησε έλεγχο των καταλόγων από διαχειριστή. Δεν αποθηκεύτηκε καμία αλλαγή.`};
    const active=semanticHistoryRows(historyRows).sort((a,b)=>day(a[HIRE]).localeCompare(day(b[HIRE])) || day(effectiveStart(a) || a[HIRE]).localeCompare(day(effectiveStart(b) || b[HIRE])));
    if(active.length>30) return {blocked:'Το Ιστορικό έχει περισσότερες περιόδους από όσες μπορούν να ελεγχθούν μαζί. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    const answers=new Map((decisions || []).map(answer=>[answer.conflictId,answer]));
    if(answers.size!==(decisions || []).length) return {blocked:'Υπάρχουν διπλές απαντήσεις για την ίδια περίοδο. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    const firstByHire=new Map();for(const row of active)if(!firstByHire.has(day(row[HIRE])))firstByHire.set(day(row[HIRE]),String(row._id));
    const conflicts=active.map(row=>periodConflict(row,catalogs,answers.get(key(row)),firstByHire.get(day(row[HIRE]))===String(row._id),hireDependencies?.allowLater===true));
    const initial=canonicalizeEmployeeHistory({scope,currentEmployee,historyRows});
    const introduction=`Ελέγχονται ${new Set(active.map(row=>day(row[HIRE]))).size} εργασιακοί κύκλοι. `+
        (initial.status===CANONICAL_STATUSES.TRUE_AMBIGUITY ? 'Υπάρχουν ασυμφωνίες στις περιόδους. ' : '')+
        `Βρέθηκαν ${initial.diagnostics?.coverageGaps?.length || 0} ακάλυπτα διαστήματα και ${initial.rowsToDelete?.length || 0} πιθανές επαναλαμβανόμενες εγγραφές. 1. Έλεγξε μία περίοδο κάθε φορά. Δεν αποθηκεύτηκε καμία αλλαγή.`;
    const retry=explanation=>({conflicts,explanation});
    let desired=historyRows.map(row=>({...row})),currentAfter={...currentEmployee};
    const affected=new Set(),departures=[];
    const hireCorrections=[];
    for(const [oldHire,firstId] of firstByHire) {
        const answer=answers.get(key(active.find(row=>String(row._id)===firstId)));
        if(!answer || answer.values.ROW_ACTION==='REMOVE' || !Object.hasOwn(answer.values,'HIRE_DATE'))continue;
        let newHire;try {newHire=day(answer.values.HIRE_DATE);}catch {return retry('1. Συμπλήρωσε έγκυρη πραγματική ημερομηνία πρόσληψης. Δεν αποθηκεύτηκε καμία αλλαγή.');}
        if(!newHire)return retry('Η πρόσληψη δεν μπορεί να είναι κενή. Δεν αποθηκεύτηκε καμία αλλαγή.');
        if(newHire===oldHire)continue;
        if(!hireDependencies?.checked)return retry('Δεν ολοκληρώθηκε ο έλεγχος των σχετικών καταχωρίσεων. 1. Άνοιξε ξανά τον εργαζόμενο και επανάλαβε τον έλεγχο. Δεν αποθηκεύτηκε καμία αλλαγή.');
        if(newHire>oldHire && hireDependencies.allowLater!==true)return retry('Η μεταφορά της πρόσληψης σε μεταγενέστερη ημερομηνία δεν διατίθεται σε αυτή την έκδοση, επειδή δεν μπορεί να αποκλειστεί εργασία πριν από τη νέα πρόσληψη. 1. Διατήρησε την καταγεγραμμένη πρόσληψη. 2. Συνέχισε με διόρθωση όρων, περιόδων, αποχώρησης ή λανθασμένων εγγραφών. Δεν αποθηκεύτηκε καμία αλλαγή.');
        if(hireDependencies.blockers?.length || historyRows.some(row=>day(row[HIRE])===oldHire &&
            ((referencesById[String(row._id)] || []).length || !active.some(item=>String(item._id)===String(row._id)))))
            return retry('Βρέθηκαν καταχωρίσεις απασχόλησης, υποβολών ή παλαιότερων αποτελεσμάτων και δεν μπορεί να αποκλειστεί σύνδεσή τους με τον κύκλο. 1. Έλεγξε τις καταχωρίσεις στον Έλεγχο Απασχολήσεων και στο Ιστορικό ΕΡΓΑΝΗ. Δεν αποθηκεύτηκε καμία αλλαγή.');
        if(firstByHire.has(newHire))return retry('Η νέα πρόσληψη ταυτίζεται με άλλον εργασιακό κύκλο. 1. Έλεγξε την πραγματική ημερομηνία. Δεν αποθηκεύτηκε καμία αλλαγή.');
        hireCorrections.push({oldHire,newHire});
        desired=desired.map(row=>day(row[HIRE])===oldHire ? {...row,[HIRE]:C.calendarDate(newHire)} : row);
        if(day(currentAfter[HIRE])===oldHire)currentAfter[HIRE]=C.calendarDate(newHire);
        historyRows.filter(row=>day(row[HIRE])===oldHire).forEach(row=>affected.add(String(row._id)));
    }
    for(const row of active) {
        const answer=answers.get(key(row));if(!answer) continue;
        if(answer.intent!=='ENTER_DIFFERENT_VALUE' || answer.value!=='PROFILE_CANDIDATE_1') return {blocked:'Η απάντηση δεν αντιστοιχεί στην περίοδο. Δεν αποθηκεύτηκε καμία αλλαγή.'};
        const values=answer.values,profile=Boolean(effectiveStart(row));
        const allowed=new Set(['ROW_ACTION',...(firstByHire.get(day(row[HIRE]))===String(row._id) ? ['HIRE_DATE'] : []),...(row[DEPARTURE] ? ['DEPARTURE_DATE'] : []),...(profile ? ['PERIOD_START','PERIOD_END',...fields(catalogs).map(f=>f.id)] : [])]);
        if(Object.keys(values).some(field=>!allowed.has(field))) return {blocked:'Η απάντηση περιέχει στοιχεία που δεν επιτρέπεται να αλλάξουν. Δεν αποθηκεύτηκε καμία αλλαγή.'};
        if(values.ROW_ACTION==='REMOVE') {
            if((referencesById[String(row._id)] || []).length) desired=desired.map(item=>String(item._id)===String(row._id) ? {...item,[REDUNDANT_STATUS_FIELD]:WITHDRAWN_ERRONEOUS,employment_history_canonical_survivor_id:null} : item);
            else desired=desired.filter(item=>String(item._id)!==String(row._id));
            affected.add(String(row._id));continue;
        }
        if(values.ROW_ACTION!=='KEEP') return retry('1. Επίλεξε αν η εγγραφή πρέπει να διατηρηθεί. Δεν αποθηκεύτηκε καμία αλλαγή.');
        if(row[DEPARTURE] && Object.hasOwn(values,'DEPARTURE_DATE') && !same(day(row[DEPARTURE]),values.DEPARTURE_DATE))
            departures.push({row,value:values.DEPARTURE_DATE,periodEnd:values.PERIOD_END});
        if(!profile) continue;
        if([...allowed].some(field=>!Object.hasOwn(values,field))) return retry('Λείπουν πραγματικά στοιχεία της περιόδου. 1. Συμπλήρωσε όλα τα πεδία ΜΕΤΑ. Δεν αποθηκεύτηκε καμία αλλαγή.');
        const input={};let snapshot,start,end;
        try {
            start=C.calendarDate(values.PERIOD_START);end=C.calendarDate(values.PERIOD_END);
            const hire=hireCorrections.find(item=>item.oldHire===day(row[HIRE]))?.newHire || day(row[HIRE]);
            if(!start || start<C.calendarDate(hire) || end && end<start) throw Error('dates');
            for(const entry of CORRECTION_FIELD_REGISTRY) input[entry.fields[0]]=normalizeConfirmedFieldValue(entry.id,values[entry.id],{allowedValues:entry.catalog ? normalizedCatalog(catalogs[entry.catalog]) : []});
            for(const field of additionalProfileFields) input[field.id]=normalizeAdditionalValue(field,values[field.id]);
            for(const [catalog,field] of [['CONTRACT_CATEGORY','kathgoria_symbashs'],['CONTRACT_SPECIALTY','eidikothta_symbashs']])
                if(!resolveContractDescription(catalogs,catalog,input[field],input)) throw Error('catalog');
            snapshot=buildCompleteProfileSnapshot({current:row,input,effectiveFrom:start});validateWorkTermRelationships(snapshot);
        } catch {return retry('Οι ημερομηνίες ή οι όροι της περιόδου δεν συμφωνούν. 1. Έλεγξε τα πεδία ΜΕΤΑ. Δεν αποθηκεύτηκε καμία αλλαγή.');}
        // A complete validator may derive aliases (e.g. week type). Retaining
        // a recorded value is not permission to rewrite that field or another
        // cycle merely because a normalized snapshot derives a different alias.
        const patch={[START]:start,[END]:end};
        for(const field of fields(catalogs))if(!same(raw(row[identity(field.id)]),values[field.id]))
            patch[identity(field.id)]=snapshot[identity(field.id)];
        if(Object.entries(patch).some(([field,value])=>!same(row[field],value))) {
            patch[C.SCHEMA_VERSION]=snapshot[C.SCHEMA_VERSION];patch[C.TYPE_VERSION]=snapshot[C.TYPE_VERSION];
        }
        const changes=Object.fromEntries(Object.entries(patch).filter(([field,value])=>!same(row[field],value)));
        if(!Object.keys(changes).length) continue;
        desired=desired.map(item=>String(item._id)===String(row._id) ? {...item,...changes} : item);affected.add(String(row._id));
        const latest=!active.some(other=>day(other[HIRE])===day(row[HIRE]) && effectiveStart(other)>effectiveStart(row));
        if(latest && day(row[HIRE])===day(currentEmployee[HIRE]) && day(effectiveStart(row))===day(effectiveStart(currentEmployee))) Object.assign(currentAfter,changes);
    }
    for(const departure of departures) {
        const terminal=active.filter(row=>day(row[HIRE])===day(departure.row[HIRE]) && effectiveStart(row)).at(-1);
        const terminalAnswer=terminal && answers.get(key(terminal));
        if(!terminalAnswer || !Object.hasOwn(terminalAnswer.values,'PERIOD_END'))return retry('1. Επιβεβαίωσε και τη λήξη της τελευταίας περιόδου του κύκλου. Δεν αποθηκεύτηκε καμία αλλαγή.');
        const confirmedEnd=terminalAnswer.values.PERIOD_END;
        if(departure.value !== null && !same(terminal[END] ? day(terminal[END]) : null,confirmedEnd) && confirmedEnd!==departure.value)
            return retry('Η λήξη της περιόδου που δήλωσες διαφέρει από τη νέα αποχώρηση. 1. Επιβεβαίωσε τα σωστά όρια ΜΕΤΑ. Δεν αποθηκεύτηκε καμία αλλαγή.');
        let proposal;
        try {proposal=require('./employeeHistoryCorrectionPolicyService').planHistoryCorrection({scope,currentEmployee:currentAfter,historyRows:desired,
            request:{intent:departure.value === null ? 'CANCEL_DEPARTURE' : 'CORRECT_DEPARTURE',targetHistoryId:String(departure.row._id),
                facts:departure.value === null ? {periodEnd:confirmedEnd} : {departureDate:departure.value},confirmation:null},
            accessMode:'ADMIN_FULL',catalogs,insertId,targetReferences:referencesById[String(departure.row._id)] || []});}
        catch {return retry('Η ημερομηνία αποχώρησης δεν είναι έγκυρη. 1. Έλεγξε την αποχώρηση και τα όρια της περιόδου. Δεν αποθηκεύτηκε καμία αλλαγή.');}
        if(!proposal.desiredRows) return retry(proposal.public?.explanation || 'Η αποχώρηση δεν συμφωνεί με τις περιόδους. Δεν αποθηκεύτηκε καμία αλλαγή.');
        desired=proposal.desiredRows;Object.assign(currentAfter,proposal.currentPatch);proposal.affectedIds.forEach(id=>affected.add(id));
    }
    // Discover dependent gaps after all confirmed edits, never by saving a stage.
    const gaps=planMissingHistoryPeriods({scope,currentEmployee:currentAfter,historyRows:desired,catalogs,insertId});
    const gapConflicts=(gaps.conflicts || []).map(conflict=>({...conflict,conflictId:'GAP_'+crypto.createHash('sha256').update(JSON.stringify(conflict.period)).digest('hex').slice(0,16).toUpperCase()}));
    for(const conflict of gapConflicts) {
        const answer=answers.get(conflict.conflictId);if(answer) {
            conflict.intents[0].valueControl.initialValues=answer.values;
            conflict.intents[0].valueControl.initialSource=answer.value;
        }
        conflicts.push(conflict);
    }
    if(!conflicts.length) return {blocked:'Δεν βρέθηκαν περίοδοι για αυτή τη διαδικασία. 1. Έλεγξε την πρώτη ιστορική περίοδο. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    if(conflicts.length>30) return {blocked:'Οι εξαρτώμενες περίοδοι υπερβαίνουν το όριο του συνολικού ελέγχου. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    const known=new Set(conflicts.map(c=>c.conflictId));
    if((decisions || []).some(answer=>!known.has(answer.conflictId))) return {conflicts,explanation:introduction};
    if(conflicts.some(conflict=>!answers.has(conflict.conflictId))) return {conflicts,explanation:introduction};
    if(gapConflicts.length) {
        const gapPlan=planMissingHistoryPeriods({scope,currentEmployee:currentAfter,historyRows:desired,catalogs,insertId,
            decisions:gapConflicts.map((conflict,index)=>({...answers.get(conflict.conflictId),conflictId:`MISSING_PERIOD_${index+1}`}))});
        // Missing/contradictory business facts belong to this worksheet. Keep
        // every answer editable instead of converting a correctable gap into a
        // terminal technical rejection.
        if(gapPlan.blocked) return retry(gapPlan.blocked);
        desired=gapPlan.desiredRows;gapPlan.affectedIds.forEach(id=>affected.add(id));
    }
    const canonical=canonicalizeEmployeeHistory({scope,currentEmployee:currentAfter,historyRows:desired});
    if(canonical.status!==CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired || !canonical.idempotent)
        return {conflicts,needsMoreFacts:true,explanation:'Οι περίοδοι εξακολουθούν να έχουν κενό ή επικάλυψη. 1. Έλεγξε μαζί τις ημερομηνίες ΜΕΤΑ. Δεν αποθηκεύτηκε καμία αλλαγή.'};
    return {desiredRows:desired,currentPatch:Object.fromEntries(Object.entries(currentAfter).filter(([field,value])=>!same(currentEmployee[field],value))),affectedIds:[...affected],
        ...(hireCorrections.length ? {controlledHireCorrection:{corrections:hireCorrections,evidence:hireDependencies}} : {})};
}

// Conservative, read-only dependency inventory. Company-wide period snapshots
// and payroll records may contain nested employee data, so they are never
// treated as absent merely because no direct employee code is indexed.
async function checkUnifiedHireDependencies({connection,scope,session}) {
    if(typeof connection?.collection!=='function')throw Error('Dependency connection unavailable');
    const {SUPPORTED_COLLECTIONS}=require('./employeeHistoryReferenceDefinitionsService');
    const names=[...new Set([...SUPPORTED_COLLECTIONS,'Prodhlomena_Oraria','Prodhlomena_Oraria_Audit','Oraria_Apo_Erganh','Oraria_Apo_Kartes',
        'Ergazomenoi_Erganh','Apasxolhseis','Apasxolhseis_Period_Facts','Apasxoliseis_Weekly_Repo_Transfer_Executions',
        'Apasxoliseis_Period_Corrective_Cases','Apasxoliseis_Corrective_Payroll_Postings','Apasxoliseis_Corrective_Payroll_Balances'])];
    const blockers=[];
    for(const collection of names)if(await connection.collection(collection).findOne({team:scope.team,company_kod:scope.company_kod},{session,projection:{_id:1}}))blockers.push(collection);
    // Schedule/card imports now share the Employee mutation fence. Direct
    // maintenance, borrowed-company copies, daily review/calculation and payroll
    // writers still do not all participate. Keep later hire fail-closed until
    // every competing writer is coordinated; empty reads are not proof.
    return {checked:true,blockers,allowLater:false};
}
function assertUnifiedHireCorrection({currentBefore,historyBefore,currentAfter,historyAfter,proof}) {
    const fail=()=>{const error=Error('EMPLOYEE_HISTORY_HIRE_CORRECTION_UNSAFE');error.code=error.message;throw error;};
    if(!proof?.corrections?.length || !proof.evidence?.checked || proof.evidence.blockers?.length)fail();
    const map=new Map(proof.corrections.map(item=>[item.oldHire,item.newHire]));
    if(proof.corrections.some(item=>item.newHire>item.oldHire && proof.evidence.allowLater!==true))fail();
    if(map.size!==proof.corrections.length || new Set(map.values()).size!==map.size)fail();
    const final=new Map(historyAfter.map(row=>[String(row._id),row]));
    for(const row of historyBefore){const target=final.get(String(row._id));
        if(map.has(day(row[HIRE])) && (!target || day(target[HIRE])!==map.get(day(row[HIRE]))))fail();
        if(target && !map.has(day(row[HIRE])) && day(target[HIRE])!==day(row[HIRE]))fail();}
    if(day(currentAfter[HIRE])!==(map.get(day(currentBefore[HIRE])) || day(currentBefore[HIRE])))fail();
    const {buildEmploymentCycles}=require('./employeeEmploymentCycleResolverService');buildEmploymentCycles({currentEmployee:currentAfter,history:semanticHistoryRows(historyAfter)});
}
// Preview-only worksheet for a recorded initial schedule plus competing work
// periods. Reuse the guided field registry, profile validation and independent
// whole-history verifier. Physical rows are never proposed for mutation here.
function planPredeclaredHistoryReview({scope,currentEmployee,historyRows,scheduleEvidence,catalogs={},businessDecision,snapshotFingerprint,predeclaredScheduleRows}) {
    const A=require('./employeeHistoryAutomaticReconstructionApplyContract');
    const {clone}=require('./employeeHistoryAutomaticSettlementPreparationContract');
    const bySequence=new Map(historyRows.map(row=>[row.aa_eggrafhs,row]));
    const [hire,four,two,three,long,last]=['0001','0002','0003','0004','0005','0006'].map(number=>bySequence.get(number));
    if(historyRows.length!==6 || semanticHistoryRows(historyRows).length!==6 || ![hire,four,two,three,long,last].every(Boolean) || scheduleEvidence.length!==1 ||
        historyRows.some(row=>day(row[HIRE])!==day(currentEmployee[HIRE])) || hire[START] ||
        !day(currentEmployee[DEPARTURE]) || currentEmployee.logos_peratosis!=='6' ||
        day(four[START])!==day(two[START]) || day(three.hmeromhnia_allaghs_symbashs)!==day(three[START]) ||
        day(last.hmeromhnia_allaghs_symbashs)!==day(last[START]) || day(long[START])!==day(last[START]) ||
        !A.equal(require('./employeeHistoryAutomaticReconstructionContract').PROFILE_FIELDS.map(field=>long[field]),
            require('./employeeHistoryAutomaticReconstructionContract').PROFILE_FIELDS.map(field=>last[field])) ||
        CORRECTION_FIELD_REGISTRY.some(entry=>entry.catalog && !normalizedCatalog(catalogs[entry.catalog]).length)) return null;
    const schedule=scheduleEvidence[0], minimum=day(four[START]), maximum=day(four[END]);
    const after=value=>{const date=C.calendarDate(value);date.setUTCDate(date.getUTCDate()+1);return day(date);};
    const before=value=>{const date=C.calendarDate(value);date.setUTCDate(date.getUTCDate()-1);return day(date);};
    if(![[four,4,32],[two,2,16],[three,3,24],[last,5,40]].every(([row,days,hours])=>row.hmeres_ergasias_ebdomadas===days && row.ores_ergasias_ebdomadas===hours) ||
        schedule.hmeres_ergasias_ebdomadas!==1 || schedule.ores_ergasias_ebdomadas!==8 ||
        day(long.hmeromhnia_lhxhs_symbashs)!==day(last.hmeromhnia_lhxhs_symbashs) ||
        day(last.hmeromhnia_lhxhs_symbashs)!==day(currentEmployee.hmeromhnia_lhxhs_symbashs) ||
        day(hire.hmeromhnia_lhxhs_symbashs)!==day(currentEmployee.hmeromhnia_lhxhs_symbashs) ||
        after(schedule.to)!==minimum || schedule.from!==day(currentEmployee[HIRE]) || after(maximum)!==day(three[START]) ||
        after(day(three[END]))!==day(last[START]) || day(last[END])!==day(currentEmployee[DEPARTURE])) return null;
    const fingerprint=A.hash({snapshotFingerprint,predeclaredScheduleRows,catalogs});
    const extraIds=['kathestos_apasxolhshs','typos_apasxolhshs','typos_ebdomadas','dialleima_se_lepta',
        'dialleima_entos_ektos_orarioy','synexes_diakekomeno','typos_orarioy','evelikth_proselefsh',
        'symbatikes_ores_ergasias',C.ENABLED];
    const required=CORRECTION_FIELD_REGISTRY.filter(entry=>!['WORK_DAYS','WEEKLY_HOURS','DAILY_HOURS'].includes(entry.id));
    const initialFields=[...required.map(entry=>publicRegistryDescriptor(entry.id,catalogs)),
        ...additionalProfileFields.filter(field=>extraIds.includes(field.id)).map(field=>({...field,optional:false,nullable:false})),
        {id:'INITIAL_EVIDENCE',label:'Έγγραφο και στοιχεία που τεκμηριώνουν τους αρχικούς όρους',inputType:'TEXT'}];
    const boundaryFields=[{id:'VALID_FROM',label:'Πραγματική έναρξη της 0003 (2 ημέρες / 16 ώρες)',inputType:'DATE',min:minimum,max:maximum},
        {id:'VALID_UNTIL',label:'Πραγματική λήξη της 0003',inputType:'DATE',min:minimum,max:maximum},
        {id:'PERIOD_EVIDENCE',label:'Έγγραφο και στοιχεία που τεκμηριώνουν τις ημερομηνίες της 0003',inputType:'TEXT'}];
    const descriptors=[['RECORDED_PERIOD',boundaryFields,minimum,maximum,'Δηλώστε την πραγματική ισχύ της 0003. Οι όροι 4 ημερών / 32 ωρών της 0002 διατηρούνται μόνο στο υπόλοιπο καταγεγραμμένο διάστημα.'],
        ['INITIAL_TERMS',initialFields,schedule.from,schedule.to,'Συμπληρώστε μόνο τους ελλείποντες αρχικούς όρους. Το προδηλωμένο ωράριο είναι ήδη τεκμηριωμένο και δεν αντιγράφονται μεταγενέστεροι όροι.']];
    const selection=businessDecision?.selections?.predeclared_review;
    const confirmation=selection?.confirmation;
    const answerList=confirmation?.decisions;
    const worksheet={version:1,kind:'USER_CONFIRMED_HISTORY_CORRECTION',title:'Συγκεντρωτική επιβεβαίωση ιστορικών στοιχείων',
        explanation:'Όλες οι απαντήσεις ελέγχονται μαζί μόνο για προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή.',
        responsibilityText:'Επιβεβαιώνω ότι οι ημερομηνίες και οι αρχικοί όροι προκύπτουν από τα έγγραφα που αναφέρω.',fingerprint,
        conflicts:descriptors.map(([conflictId,fields,from,to,issue])=>({conflictId,kind:'PROFILE',required:true,
            period:{from,to,label:`${from}–${to}`},issue,decisionRequired:'Συμπληρώστε τα πραγματικά στοιχεία και την τεκμηρίωσή τους.',
            intents:[{id:'ENTER_DIFFERENT_VALUE',label:'Δηλώνω τεκμηριωμένα πραγματικά στοιχεία',description:issue,
                valueControl:{type:'PROFILE_FIELDS',required:true,beforeValues:[],fields,
                    baselineValues:[{value:'CONFIRMED_FACTS',label:'Ρητά τεκμηριωμένα στοιχεία — χωρίς αντιγραφή άλλης περιόδου',summary:[]}],
                    ...(Array.isArray(answerList) && answerList.find(answer=>answer?.conflictId===conflictId) ? {
                        initialValues:answerList.find(answer=>answer?.conflictId===conflictId).values,initialSource:'CONFIRMED_FACTS'} : {})}}]}))};
    const pending=message=>({worksheet,fingerprint,previewValidated:false,validationMessage:message});
    const invalid=message=>{throw Object.assign(new Error('INVALID_DOCUMENTED_HISTORY_FACT'),{reviewMessage:message});};
    if(businessDecision==null) return pending();
    const exact=(object,keys)=>object && !Array.isArray(object) && A.equal(Object.keys(object).sort(),[...keys].sort());
    if(!exact(businessDecision,['snapshotFingerprint','selections']) || businessDecision.snapshotFingerprint!==fingerprint ||
        !exact(businessDecision.selections,['predeclared_review']) || !exact(selection,['confirmation']) ||
        !exact(confirmation,['responsibilityAccepted','decisions']) || confirmation.responsibilityAccepted!==true ||
        !Array.isArray(answerList) || answerList.length!==2 || answerList.some(answer=>!answer || typeof answer!=='object') || new Set(answerList.map(answer=>answer.conflictId)).size!==2)
        return pending('Οι απαντήσεις δεν αντιστοιχούν στην τρέχουσα προεπισκόπηση. Ανοίξτε ξανά τον έλεγχο και συμπληρώστε όλα τα στοιχεία.');
    try {
        for(const [conflictId,fields] of descriptors) {
            const answer=answerList.find(item=>item.conflictId===conflictId);
            if(!exact(answer,['conflictId','intent','value','values']) || answer.intent!=='ENTER_DIFFERENT_VALUE' ||
                answer.value!=='CONFIRMED_FACTS' || !exact(answer.values,fields.map(field=>field.id))) invalid('Λείπουν στοιχεία ή περιέχονται μη επιτρεπτές επιλογές.');
        }
        const boundary=answerList.find(answer=>answer.conflictId==='RECORDED_PERIOD').values;
        const values=answerList.find(answer=>answer.conflictId==='INITIAL_TERMS').values;
        for(const text of [boundary.PERIOD_EVIDENCE,values.INITIAL_EVIDENCE])
            if(typeof text!=='string' || text.trim().length<10 || text.length>1000) invalid('Χρειάζεται συγκεκριμένη αναφορά εγγράφου και των στοιχείων που επιβεβαιώνει.');
        const from=day(boundary.VALID_FROM),until=day(boundary.VALID_UNTIL);
        if(from!==boundary.VALID_FROM || until!==boundary.VALID_UNTIL || from<minimum || until>maximum || from>until ||
            from===minimum && until===maximum) invalid('Οι ημερομηνίες της 0003 συγκρούονται με την 0002 ή την τεκμηριωμένη αλλαγή της 0004. Ελέγξτε τα πραγματικά διαστήματα.');
        const input={hmeres_ergasias_ebdomadas:schedule.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas:schedule.ores_ergasias_ebdomadas,mo_oron_hmerhsias_ergasias:schedule.mo_oron_hmerhsias_ergasias};
        for(const entry of required) input[entry.fields[0]]=normalizeConfirmedFieldValue(entry.id,values[entry.id],
            {allowedValues:entry.catalog?normalizedCatalog(catalogs[entry.catalog]):[]});
        for(const field of additionalProfileFields.filter(field=>extraIds.includes(field.id))) input[field.id]=normalizeAdditionalValue(field,values[field.id]);
        for(const [catalog,field] of [['CONTRACT_CATEGORY','kathgoria_symbashs'],['CONTRACT_SPECIALTY','eidikothta_symbashs']])
            if(!resolveContractDescription(catalogs,catalog,input[field],input)) invalid('Η σύμβαση, η κατηγορία και η ειδικότητα δεν συμφωνούν.');
        const complete=buildCompleteProfileSnapshot({current:{},input,effectiveFrom:schedule.from});
        // Defaults from a validator are not historical evidence. Keep only the
        // facts explicitly supplied or independently proved by the schedule.
        const initial={...scope,...Object.fromEntries(Object.keys(input).map(field=>[field,complete[field]])),
            [HIRE]:currentEmployee[HIRE],[START]:C.calendarDate(schedule.from),[END]:C.calendarDate(schedule.to),
            hmeromhnia_lhxhs_symbashs:hire.hmeromhnia_lhxhs_symbashs,afora_proslhpsh:true,afora_allagh_oron_ergasias:true};
        validateWorkTermRelationships(initial);
        const logical=[initial];
        if(from>minimum)logical.push({...four,[END]:C.calendarDate(before(from))});
        logical.push({...two,[START]:C.calendarDate(from),[END]:C.calendarDate(until)});
        if(until<maximum)logical.push({...four,[START]:C.calendarDate(after(until))});
        logical.push(clone(three),clone(last));
        const logicalRows=logical.map((row,index)=>({...row,_id:crypto.createHash('sha256').update(`${fingerprint}:${index}`).digest('hex').slice(0,24),aa_eggrafhs:String(index+1).padStart(4,'0')}));
        const verification=require('./employeeHistoryAutomaticReconstructionPlannerService').verifyEmployeeHistoryAutomaticSettlement({
            scope,currentEmployee,proposedRows:logicalRows,requiredHistoryRows:historyRows,strictProfileEvidence:true});
        if(verification.status!=='CLEAN') invalid('Οι συνολικές περίοδοι ή οι αρχικοί όροι δεν πέρασαν τον ενιαίο έλεγχο κάλυψης. Ελέγξτε όλα τα απαιτούμενα στοιχεία.');
        return {worksheet,fingerprint,previewValidated:true,logicalRows,verification,
            physicalHistoryRows:clone(historyRows),evidence:{period:boundary.PERIOD_EVIDENCE.trim(),initial:values.INITIAL_EVIDENCE.trim()}};
    } catch(error) { return pending(error.reviewMessage || 'Κάποιος αρχικός όρος ή ημερομηνία δεν έχει έγκυρη τιμή. Ελέγξτε τα πεδία και την τεκμηρίωση.'); }
}
module.exports={planUnifiedHistoryCorrection,checkUnifiedHireDependencies,assertUnifiedHireCorrection,planPredeclaredHistoryReview};
