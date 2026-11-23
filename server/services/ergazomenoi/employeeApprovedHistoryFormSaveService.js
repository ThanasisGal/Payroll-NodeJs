'use strict';

// Adapt the existing atomic History planner to the normal, signed Employee
// Save. The caller owns the transaction; documents/ERGANI remain after commit.
const D = require('./employeeHistoryDeferralService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const Profile = require('../../utils/ergazomenoi/employmentProfileContract');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { normalizeEmployeeMaintenanceIntent } = require('../../utils/ergazomenoi/employeeMaintenanceIntent');

function selectedExternalWork(request) {
    return D.selectedActions(request.externalIntent).length > 0 || request.externalIntent?.create_contract === true ||
        Object.entries(request.maintenance?.submittedFormValues || {}).some(([field,value]) =>
            field.endsWith('_base64') && Boolean(value));
}
function actionReceipt(request, proposed, actorUserId, requestId) {
    return { key:requestId, actorUserId:String(actorUserId),
        profileFingerprint:D.digest(D.businessState(proposed)), intent:D.storedRequest(request).externalIntent,
        parameters:D.externalParameters(request,proposed), documents:{status:'PREPARING',results:[]},
        actions:D.selectedActions(request.externalIntent).map(type => ({type,status:'SELECTED'})) };
}
function profilePatch(request, employeePatch = {}, current = {}) {
    const maintenance = request.maintenance || {};
    const owned = new Set(maintenance.submittedEmployeeFields || Object.keys(maintenance.employeeChanges || {}));
    const values = { ...(maintenance.submittedHistoryChanges || {}),
        ...Object.fromEntries(Object.entries(maintenance.employeeChanges || {})
            .filter(([field,value]) => owned.has(field) && value !== undefined)), ...(request.input || {}) };
    const intent = normalizeEmployeeMaintenanceIntent(request,current);
    const changed = new Set([intent.input,intent.maintenance.employeeChanges,intent.maintenance.historyChanges]
        .flatMap(part => Object.keys(part || {})));
    const facts = Profile.normalizeEmploymentProfileSubmission(request.input || {},values);
    for (const field of Profile.FACT_FIELDS) if (Object.hasOwn(values,field)) values[field] = facts[field];
    for (const field of [Profile.SCHEMA_VERSION,Profile.TYPE_VERSION]) {
        if (Object.hasOwn(employeePatch,field)) values[field] = employeePatch[field];
        else delete values[field];
    }
    for (const field of C.PROFILE_FIELDS) {
        if (!Object.hasOwn(values,field)) continue;
        if (Object.hasOwn(employeePatch,field)) values[field] = employeePatch[field];
        else if (!changed.has(field) && Object.hasOwn(current,field)) values[field] = current[field];
    }
    // This is evidence for a NEW proposed snapshot only, never a patch to an
    // approved predecessor. Ignore omitted controller defaults/version stamps.
    return Object.fromEntries(C.PROFILE_FIELDS.filter(field => Object.hasOwn(values,field) &&
        values[field] !== undefined)
        .map(field => [field, IstorikoProslhpseonAllagonModel.schema.path(field)?.cast(values[field]) ?? values[field]]));
}
function nextRevision(current) {
    return new Date(Math.max(Date.now(),new Date(current.updatedAt || 0).getTime()+1));
}
function isIndependentPendingRequest(request, current) {
    const intent = normalizeEmployeeMaintenanceIntent(request,current);
    const fields = new Set([...D.PROFILE_FIELDS,...Object.keys(IstorikoProslhpseonAllagonModel.schema.paths)]);
    return ![intent.input,intent.maintenance.employeeChanges,intent.maintenance.historyChanges,
        intent.maintenance.submittedHistoryChanges].some(values => Object.keys(values || {}).some(field => fields.has(field)));
}
function assertNoSecondHistoryChange(request, current) {
    if (!isIndependentPendingRequest(request,current))
        throw D.failure('SECOND_CHANGE','Η αρχική ιστορική μεταβολή παραμένει σε εκκρεμότητα. Συμπληρώστε την πριν από δεύτερη ιστορική μεταβολή.');
}

async function writeApprovedHistoryFormSave({ request, snapshot, session, actorUserId, dependencies,
    read, validateEmployee, binding, serviceFactory }) {
    const { scope,employeeId } = request;
    if (request.reconstruction || request.rehireIntent || request.operations?.length ||
        request.departureDate || request.requestedDepartureDate)
        throw D.failure('UNSUPPORTED_LIFECYCLE','Η αλλαγή εργασιακής σχέσης χρειάζεται την υπάρχουσα ειδική διαδικασία της.');
    const pending = snapshot.current[D.FIELD];
    const external = selectedExternalWork(request);
    // Once deferred, ordinary independent edits and selected external work use
    // their own signed receipt. They never replace the original pending change.
    if (pending && !request.pendingResolution && !request.change) {
        assertNoSecondHistoryChange(request,snapshot.current);
        const candidate = await validateEmployee(snapshot);
        if (!Object.keys(candidate.patch).length && !external) return { employee:snapshot.current,
            employeeUpdated:false,historyUpdated:false,historyChangedRows:0,
            historyStatus:'PENDING_EMPLOYEE_RECONCILIATION',historyAccessMode:'READ_ONLY' };
        const bound = binding(snapshot), decision = 'SAVE_PENDING_CONTACT';
        if (request.historyPreflight) return {preflight:true,success:true,status:'READY_FOR_PENDING_CONTACT_SAVE',
            decision,historyConfirmation:D.issueConfirmation(bound,decision),pendingHistory:D.publicPending(pending)};
        if (request.historyDecision !== decision) throw D.failure('CONFIRMATION_REQUIRED','Επιβεβαιώστε την ίδια αποθήκευση εργαζομένου.');
        const requestId = D.verifyConfirmation(request.historyConfirmation,bound,decision);
        await require('./employeeEmploymentProfileWriter').acquireEmployeeMutationFence({
            filter:scope,employeeId,employeeModel:dependencies.employeeModel,session });
        const fresh = await read(session);
        if (binding(fresh) !== bound) throw D.failure('STALE','Τα στοιχεία άλλαξαν πριν από την αποθήκευση.');
        assertNoSecondHistoryChange(request,fresh.current);
        const checked = await validateEmployee(fresh);
        const proposed = { ...fresh.current,...checked.patch };
        const patch = { ...checked.patch,updatedAt:nextRevision(fresh.current),
            ...(external ? {[D.ACTIONS]:[...(fresh.current[D.ACTIONS] || []),actionReceipt(request,proposed,actorUserId,requestId)]} : {}) };
        const saved = await dependencies.employeeModel.updateOne({...scope,_id:employeeId},{$set:patch},{session,runValidators:true});
        if (saved.matchedCount !== 1) throw D.failure('STALE','Δεν επιβεβαιώθηκε η εγγραφή του εργαζομένου.');
        const final = await read(session);
        if (!A.equal(A.ordered(final.history),A.ordered(fresh.history)) || !A.equal(final.current[D.FIELD],pending) ||
            Object.entries(patch).some(([field,value]) => field !== 'updatedAt' && !A.equal(final.current[field],value)))
            throw D.failure('STALE','Δεν επιβεβαιώθηκε η διατήρηση του αρχικού Ιστορικού.');
        return D.pendingResponse(final.current,final.history,{externalActionsAllowed:external,
            idempotencyKey:external ? requestId : null});
    }
    if (pending && request.change) throw D.failure('SECOND_CHANGE','Υπάρχει ήδη η αρχική ιστορική μεταβολή σε εκκρεμότητα.');
    if (pending) await require('./employeePendingHistorySectionAuthorizationService').assertPendingHistorySectionAuthorization({
        actorUserId,pending,privilegeModel:dependencies.privilegeModel,session });
    const replay = pending ? D.replayRequest({pending,
        request:normalizeEmployeeMaintenanceIntent(request,snapshot.current),
        current:snapshot.current,history:snapshot.history}) : null;
    const evidence = replay?.replay || request;
    const change = evidence.change;
    const req = {session:{userId:String(actorUserId),userTeam:scope.team,companyInUse:scope.company_kod},
        params:{id:employeeId},sessionID:request.confirmationSession};
    const service = serviceFactory({ ...dependencies,
        auditReady:() => dependencies.auditCollectionChecker({connection:dependencies.connection}) });
    const prepare = async state => {
        const independent = await validateEmployee(state);
        const formProfile = profilePatch(evidence,independent.patch,state.current);
        if (replay) Object.assign(formProfile,profilePatch(request,independent.patch,state.current));
        const prepared = await service.prepareEmployeeSave(req,change,session,{
            employeePatch:independent.patch,profilePatch:formProfile,
            ...(replay ? {baselineEmployee:{...replay.before,[D.FIELD]:null}} : {}) });
        if (pending) D.assertReplayPlan(pending,{targetHistoryId:prepared.plan.targetId,
            physicalPlan:{finalRows:prepared.plan.physicalAfter}});
        const catalogs = await dependencies.correctionCatalogLoader({session});
        const {registryEntry} = require('./employeeHistoryCorrectionFieldRegistryService');
        const {PARENT_FIELDS,parentKeyForCatalog} = require('./employeeContractDescriptionService');
        const target = prepared.plan.nextRow || prepared.plan.projectedAfter.find(row => String(row._id) === prepared.plan.targetId);
        for (const id of ['KPK','CONTRACT_TYPE','CONTRACT_CATEGORY','SPECIALTY']) {
            const entry = registryEntry(id), value = target?.[entry.fields[0]];
            const parentField = PARENT_FIELDS[entry.catalog], parent = parentKeyForCatalog(entry.catalog,target);
            if (value != null && value !== '' && !(catalogs[entry.catalog] || []).some(item =>
                String(item.code) === String(value) && (!parentField || !parent || String(item[parentField]) === parent)))
                throw D.failure('INVALID_CATALOG','Ο ασφαλιστικός κωδικός ή τα στοιχεία σύμβασης δεν αντιστοιχούν στους ισχύοντες καταλόγους.');
        }
        const proposed = {...state.current,...prepared.plan.employeePatch};
        for (const [field,value] of Object.entries(change.correctedTerms || {})) {
            const submitted = formProfile[field] ?? proposed[field];
            if (!A.equal(submitted,value)) throw D.failure('UNSAFE','Οι ημέρες και οι ώρες της φόρμας διαφέρουν από την επιλεγμένη μεταβολή.');
        }
        // The planner synchronizes this code with the selected days. Validate
        // the actual form intent before accepting that synchronization.
        const contract = String(independent.patch.apasxolhsh_basei_symbashs ?? state.current.apasxolhsh_basei_symbashs ?? '');
        if (contract && contract !== String(change.correctedTerms.hmeres_ergasias_ebdomadas))
            throw D.failure('UNSAFE','Οι ημέρες δεν συμφωνούν με την Απασχόληση Βάσει Σύμβασης.');
        return {...prepared,proposed};
    };
    let prepared;
    try { prepared = await prepare(snapshot); }
    catch (error) {
        if (!request.historyPreflight || !String(error.code || '').startsWith('EMPLOYEE_APPROVED_ATOMIC_')) throw error;
        return {preflight:true,success:false,status:'UNSAFE_HISTORY_CHANGE',reason:error.code,missingFields:[],
            message:'Η νέα ιστορική μεταβολή δεν επιβεβαιώθηκε και η αποθήκευση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n' +
                '1. Ελέγξτε την ημερομηνία και τα στοιχεία της νέας μεταβολής.\n2. Επαναφορτώστε τον εργαζόμενο πριν δοκιμάσετε ξανά.\nΚωδικός αναφοράς: '+error.code+'.'};
    }
    const missing = prepared.plan.missingFields;
    if (pending && missing.length) throw D.failure('STILL_MISSING','Συμπληρώστε τα πραγματικά υποχρεωτικά στοιχεία της αρχικής μεταβολής.');
    const decision = missing.length ? 'DEFER_HISTORY' : pending ? 'RESOLVE_PENDING' : 'COMBINED_SAVE';
    const bound = A.hash({source:binding(snapshot),plan:prepared.plan.sourceFingerprint});
    if (request.historyPreflight) return {preflight:true,success:true,
        status:missing.length ? 'MISSING_REQUIRED_HISTORY_FIELDS' : 'READY_FOR_COMBINED_SAVE',
        decision,missingFields:missing,historyConfirmation:D.issueConfirmation(bound,decision),pendingHistory:D.publicPending(pending)};
    if (request.historyDecision !== decision) throw D.failure('CONFIRMATION_REQUIRED','Επιβεβαιώστε την ίδια επιλογή αποθήκευσης.');
    const requestId = D.verifyConfirmation(request.historyConfirmation,bound,decision);
    if (missing.length) {
        await require('./employeeEmploymentProfileWriter').acquireEmployeeMutationFence({
            filter:scope,employeeId,employeeModel:dependencies.employeeModel,session });
        const fresh = await read(session);
        prepared = await prepare(fresh);
        if (A.hash({source:binding(fresh),plan:prepared.plan.sourceFingerprint}) !== bound)
            throw D.failure('STALE','Τα στοιχεία ή η πρόταση άλλαξαν πριν από την αποθήκευση.');
        const descriptor = D.descriptor({request,current:fresh.current,proposed:prepared.proposed,history:fresh.history,
            composed:{targetHistoryId:prepared.plan.targetId,physicalPlan:{rowsToUpdate:[]}},
            missing,actorUserId,requestId});
        descriptor.eventType = change.kind;
        const patch = {...prepared.plan.employeePatch,[D.FIELD]:descriptor,
            [D.ACTIONS]:[...(fresh.current[D.ACTIONS] || []),actionReceipt(request,prepared.proposed,actorUserId,requestId)],
            updatedAt:nextRevision(fresh.current)};
        const document = ErgazomenoiModel.hydrate(fresh.current);
        document.set(patch); await document.validate();
        const saved = await dependencies.employeeModel.updateOne({...scope,_id:employeeId},{$set:patch},{session,runValidators:true});
        if (saved.matchedCount !== 1) throw D.failure('STALE','Δεν επιβεβαιώθηκε η εγγραφή του εργαζομένου.');
        const final = await read(session);
        if (!A.equal(A.ordered(final.history),A.ordered(fresh.history)) || !A.equal(final.current[D.FIELD],descriptor) ||
            Object.entries(patch).some(([field,value]) => field !== 'updatedAt' && !A.equal(final.current[field],value)))
            throw D.failure('STALE','Δεν επιβεβαιώθηκε η διατήρηση του Ιστορικού και της εκκρεμότητας.');
        return D.pendingResponse(final.current,final.history);
    }
    if (pending) prepared.plan.employeePatch[D.FIELD] = null;
    if (external) prepared.plan.employeePatch[D.ACTIONS] = [...(snapshot.current[D.ACTIONS] || []),
        actionReceipt(request,prepared.proposed,actorUserId,requestId)];
    const result = await prepared.commit();
    return {...result,...(pending && !external ? {pendingResolved:true} : {}),
        externalActionsAllowed:external,idempotencyKey:external ? requestId : null};
}

module.exports = { writeApprovedHistoryFormSave, isIndependentPendingRequest };
