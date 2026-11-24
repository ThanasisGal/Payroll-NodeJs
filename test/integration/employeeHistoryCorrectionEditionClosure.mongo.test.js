'use strict';
// Own a fresh mongod/replica set; use the existing approval engine and fixtures.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {startApprovedProposalMongo,seedApprovedProposal,approvedProposalBody} = require('../fixtures/employeeHistoryApprovedProposalMongo');
const {seedLegacyStructure,seedLegacyFrozen,rawState} = require('../fixtures/employeeHistoryLegacyStructure');
const {createEmployeeHistoryApprovedProposalService:create} = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const {proposalHistoryState} = require('../../server/services/ergazomenoi/employeeHistoryProposalReadService');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const R = require('../../server/utils/ergazomenoi/historicalProfileComparison');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approval = (proposal,preview) => ({proposal,approval:{token:preview.approval.token,confirmed:true}});
const proxy = (target,overrides) => new Proxy(target,{get:(object,key)=>key in overrides ? overrides[key] : Reflect.get(object,key)});
const business = row => Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'employee_profile_mutation_sequence'));

test('Τελικό κλείσιμο διορθωτικών εκδόσεων: εγκεκριμένη πηγή, αλυσίδα και παγωμένες αναφορές',
    {skip:!binary,timeout:120000},async t => {
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    assert.equal(require('mongoose').connection.readyState,0);
    async function submit(f,values) {
        const service = create(f.dependencies), proposal = await approvedProposalBody(f,{values});
        const before = await rawState(f), preview = await service.preview(f.req,proposal);
        assert.deepEqual(await rawState(f),before,'η προεπισκόπηση είναι αμιγώς αναγνωστική');
        const result = await service.apply(f.req,approval(proposal,preview));
        assert.equal(result.selectedCaseStatus,'APPROVED_RESOLVED');
        assert.equal(result.verification.persisted,true);
        return {service,proposal,preview,result,audit:await db.auditModel.findById(result.auditId).lean()};
    }
    await t.test('Προηγούμενο PHYSICAL_UPDATE: δεύτερη διόρθωση ως έκδοση για όλους τους τύπους, χωρίς νέα χαρτογράφηση',async()=>{
        const f = await seedApprovedProposal(db), first = await submit(f,{nomimosMisthos:'1456.78'});
        assert.equal(first.audit.diagnostics.rowApproval.mode,'PHYSICAL_UPDATE');
        const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(),f.catalogs,{selection:`UPDATE:${f.history[0]._id}`});
        const editable = new Set(baseline.editableCells.filter(entry=>entry.role === 'ANSWER').map(entry=>entry.canonicalField));
        assert.equal(R.writableFields.length,91);
        assert.deepEqual(R.writableFields.filter(field=>!editable.has(field)),[]);
        const flag = baseline.editableCells.find(entry=>entry.canonicalField === 'dialleima_entos_ektos_orarioy');
        const falseChoice = String(E.editorChoices(flag,f.catalogs).findIndex(choice=>choice.id === false));
        assert.notEqual(falseChoice,'-1');
        const before = await rawState(f);
        const changed = await submit(f,{pragmatikosMisthos:'0',dialleima_entos_ektos_orarioy:falseChoice,
            hmeres_efarmoghs_egkekrimenhs_rythmishs:[],hmnia_enarxhs_egkekrimenhs_rythmishs:'2026-01-05',
            dialleima_apo_ora_01:'12:00',dialleima_eos_ora_01:'12:15',krathsh_02:'0012'});
        assert.equal(changed.preview.physicalWrites.history.mode,'CORRECTION_EDITION');
        assert.deepEqual(changed.preview.physicalWrites.history.fields,[]);
        assert.equal(changed.audit.diagnostics.rowApproval.previousApprovalId,first.result.approvalId);
        const after = await rawState(f);
        for (const key of ['history','controls','frozen']) assert.deepEqual(after[key],before[key],key);
        assert.deepEqual(after.audit.find(raw=>raw.equals(before.audit[0])),before.audit[0]);
        const content = changed.audit.diagnostics.rowApproval.approvedContent;
        assert.equal(content.nomimosMisthos,1456.78,'διατήρηση της προηγούμενης εγκεκριμένης τιμής');
        assert.equal(content.pragmatikosMisthos,0); assert.equal(content.dialleima_entos_ektos_orarioy,false);
        assert.deepEqual(content.hmeres_efarmoghs_egkekrimenhs_rythmishs,[]);
        assert.equal(content.hmnia_enarxhs_egkekrimenhs_rythmishs.toISOString().slice(0,10),'2026-01-05');
        assert.equal(content.krathsh_02,'0012'); assert.equal(content.dialleima_apo_ora_01,'12:00');
        const projected = proposalHistoryState(await f.input());
        assert.equal(projected.historyRows.find(row=>String(row._id) === String(f.history[0]._id)).pragmatikosMisthos,0);
        const count = await db.auditModel.countDocuments({'employeeScope.employee_id':f.employee._id});
        const repeated = await changed.service.apply(f.req,approval(changed.proposal,changed.preview));
        assert.equal(repeated.alreadyApplied,true);
        assert.equal(await db.auditModel.countDocuments({'employeeScope.employee_id':f.employee._id}),count);
    });
    await t.test('0004, 6→5: προηγούμενο APPROVAL_ONLY, οριστικοποίηση και δεύτερη διορθωτική έκδοση κρατούν ακριβή BSON',async()=>{
        const f = await seedLegacyStructure(db);
        await db.historyModel.collection.updateOne({_id:f.history[0]._id},{$set:{aa_eggrafhs:'0004',
            hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',mo_oron_hmerhsias_ergasias:40/6}});
        await seedLegacyFrozen(f,{finalized:true});
        const first = await submit(f,{}), before = await rawState(f);
        assert.equal(first.audit.diagnostics.rowApproval.mode,'APPROVAL_ONLY');
        const changed = await submit(f,{hmeres_ergasias_ebdomadas:'5',typos_ebdomadas:'0',mo_oron_hmerhsias_ergasias:'8'});
        assert.equal(changed.audit.diagnostics.rowApproval.mode,'CORRECTION_EDITION');
        assert.equal(changed.audit.diagnostics.rowApproval.previousApprovalId,first.result.approvalId);
        const next = await submit(f,{dialleima_se_lepta:'0',poso_symbashs_02:'123.45'});
        assert.equal(next.audit.diagnostics.rowApproval.previousApprovalId,changed.result.approvalId);
        const content = next.audit.diagnostics.rowApproval.approvedContent;
        assert.equal(content.aa_eggrafhs,'0004'); assert.equal(content.hmeres_ergasias_ebdomadas,5);
        assert.equal(content.typos_ebdomadas,'5HMERH'); assert.equal(content.mo_oron_hmerhsias_ergasias,8);
        assert.equal(content.dialleima_se_lepta,0); assert.equal(content.poso_symbashs_02,123.45);
        const after = await rawState(f);
        for (const key of ['history','controls','frozen']) assert.deepEqual(after[key],before[key],key);
        assert.ok(after.audit.some(raw=>raw.equals(before.audit[0])));
        assert.deepEqual(business(await db.employeeModel.collection.findOne({_id:f.employee._id})),
            business(require('mongoose').mongo.BSON.deserialize(before.current)));
    });
    await t.test('Νεότερη έγκριση ακυρώνει παλιά προεπισκόπηση χωρίς να αλλοιώσει καμία έκδοση',async()=>{
        const f = await seedApprovedProposal(db); await submit(f,{});
        const service = create(f.dependencies), proposal = await approvedProposalBody(f,{values:{nomimosMisthos:'1500'}});
        const preview = await service.preview(f.req,proposal);
        await submit(f,{pragmatikosMisthos:'1600'});
        const before = await rawState(f);
        await assert.rejects(service.apply(f.req,approval(proposal,preview)),error=>error.reason === 'STALE');
        assert.deepEqual(await rawState(f),before);
    });
    await t.test('Αποτυχία ανεξάρτητης επαλήθευσης: προηγούμενη έγκυρη έκδοση μέχρι τον έλεγχο αποτελέσματος',async()=>{
        const f = await seedApprovedProposal(db), first = await submit(f,{});
        const auditModel = proxy(db.auditModel,{collection:proxy(db.auditModel.collection,{async updateOne(filter,update,options) {
            if (update.$set?.['diagnostics.rowApproval.status'] === 'APPROVED_RESOLVED') throw Error('SYNTHETIC_VERIFICATION_FAILURE');
            return db.auditModel.collection.updateOne(filter,update,options);
        }})});
        const service = create({...f.dependencies,auditModel}), proposal = await approvedProposalBody(f,{values:{nomimosMisthos:'1800'}});
        const preview = await service.preview(f.req,proposal), before = await rawState(f);
        await assert.rejects(service.apply(f.req,approval(proposal,preview)),error=>error.reason === 'COMMITTED_VERIFICATION_REQUIRED' && error.saved === true);
        const pending = await f.input();
        assert.equal(proposalHistoryState(pending).decisions[0].diagnostics.approvalId,first.result.approvalId);
        assert.deepEqual((await rawState(f)).history,before.history);
        const verified = await create(f.dependencies).reconcile(f.req,{proposal,token:preview.approval.token});
        assert.equal(verified.verification.persisted,true);
        assert.equal(proposalHistoryState(await f.input()).historyRows[0].nomimosMisthos,1800);
    });
});
