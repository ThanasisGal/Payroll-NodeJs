'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const S = require('../../server/utils/ergazomenoi/employeeSaveState');
const { finalizedEmployeeFilter } = require('../../server/utils/ergazomenoi/finalizedEmployeeFilter');
const Models = require('../../server/models/ergazomenoi');
const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H, ProdhlomenaOrariaModel: P } = Models;
const U = require('../../server/models/userModel');
const { UserPrivilegesModel: V } = require('../../server/models/privileges');
const uri = process.env.PAYROLL_DRAFT_TEST_MONGO_URI;

// Never loads .env, and cannot connect to a business database. Each run uses new
// identities in a disposable local replica set; no delete/drop/cleanup commands.
test('draft lifecycle against real isolated MongoDB transactions', { skip: !uri }, async t => {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:27139\/payroll_draft_test_[a-z0-9_]+\?replicaSet=payrollDraftTest$/);
    await mongoose.connect(uri, { autoIndex: false });
    t.after(() => mongoose.disconnect());
    for (const model of [E,H,P,U,V]) await model.init();
    const actor = new mongoose.Types.ObjectId();
    await U.collection.insertOne({ _id: actor, team: 'TEST', situation: 'A', privileges: 'HR' });
    await V.create({ userId: String(actor), form: 'Ergazomenoi', privileges: { create: true, read: true, update: true } });
    const company = String(new mongoose.Types.ObjectId());
    await require('../../server/models/companies').CompaniesModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(company), team: 'TEST' });
    let counter = 0;
    const args = () => ({ scope: { team: 'TEST', company_kod: company, kodikos: String(++counter).padStart(4,'0') }, actorUserId: String(actor) });
    const employee = a => ({ team: a.scope.team, company_kod: company, kodikos: a.scope.kodikos,
        eponymo: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ', afm: String(100000000+counter),
        amka: '12345678901', energos: true, hmeromhnia_proslhpshs: '2026-10-02', pragmatikosMisthos: 1234 });
    async function create() { const a=args(); const d=await W.writeEmployeeDraft({ ...a, newEmployee: employee(a) });
        return { ...a, employeeId: String(d.employee._id), expectedEmployeeStateToken: d.employeeStateToken, d }; }
    const final = (a, extra={}) => W.writeEmployeeMaintenance({ ...a, expectedTemporary: true,
        maintenance: { employeeChanges: {}, submittedEmployeeFields: [], historyChanges: {} }, ...extra });
    const snapshot = async () => {
        const out={};for(const c of await mongoose.connection.db.listCollections().toArray())
            out[c.name]=await mongoose.connection.db.collection(c.name).countDocuments();return out;
    };
    let a;
    await t.test('creation writes only Employee, with no History, schedule, audit or submission',async()=>{
        const before=await snapshot();a=await create();const after=await snapshot();
        for(const name of new Set([...Object.keys(before),...Object.keys(after)]))assert.equal((after[name]||0)-(before[name]||0),name==='Ergazomenoi'?1:0,name);
        assert.equal(a.d.employee.oristikh_enhmerosh,false);assert.equal(await H.countDocuments(a.scope),0);
        assert.equal((await E.find(a.scope)).length,1);assert.equal((await E.find(finalizedEmployeeFilter(a.scope))).length,0);
    });
    await t.test('concurrent new hires cannot reserve the same business code twice',async()=>{
        const b=args(),first=employee(b),second={...first,afm:'299999999'};
        const r=await Promise.allSettled([first,second].map(newEmployee=>W.writeEmployeeDraft({...b,newEmployee})));
        assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
        assert.equal(await E.countDocuments(b.scope),1);assert.equal(await H.countDocuments(b.scope),0);
    });
    await t.test('repeat saves, change hire 02 -> 04 and reopen retain fields without other writes',async()=>{
        const before=await snapshot();const r=await W.writeEmployeeDraft({...a,employeeChanges:{hmeromhnia_proslhpshs:'2026-10-04',email:'test@example.invalid'}});
        const reopened=await E.findById(a.employeeId).lean();assert.equal(reopened.hmeromhnia_proslhpshs.toISOString().slice(0,10),'2026-10-04');
        assert.equal(reopened.email,'test@example.invalid');assert.deepEqual(await snapshot(),before);
        a.expectedEmployeeStateToken=r.employeeStateToken;
        const r2=await W.writeEmployeeDraft({...a,employeeChanges:{email:'saved@example.invalid'}});a.expectedEmployeeStateToken=r2.employeeStateToken;
        assert.equal(await H.countDocuments(a.scope),0);
    });
    await t.test('first finalization writes exact hire snapshot and preserves previously saved pay',async()=>{
        const r=await final(a);assert.equal(r.firstFinalization,true);assert.equal(r.employee.oristikh_enhmerosh,true);
        const rows=await H.find(a.scope).lean();assert.equal(rows.length,1);assert.equal(rows[0].afora_proslhpsh,true);
        assert.equal(rows[0].hmeromhnia_proslhpshs.toISOString().slice(0,10),'2026-10-04');assert.equal(rows[0].pragmatikosMisthos,1234);
        assert.equal(rows[0].hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0,10),'2026-10-04');
        assert.equal((await E.find(finalizedEmployeeFilter(a.scope))).length,1);
    });
    await t.test('stale draft and second finalization reject without replacing saved data',async()=>{
        const before=await E.findById(a.employeeId).lean();
        await assert.rejects(W.writeEmployeeDraft({...a,employeeChanges:{email:'stale@example.invalid'}}),{code:'EMPLOYEE_SAVE_ALREADY_FINAL'});
        await assert.rejects(final(a),{code:'EMPLOYEE_SAVE_STATE_STALE'});
        assert.deepEqual(await E.findById(a.employeeId).lean(),before);
    });
    await t.test('forged or cleared hire date on finalized and legacy employees rejects',async()=>{
        const current=await E.findById(a.employeeId).lean();for(const hire of ['2026-10-05',null,''])
            await assert.rejects(W.writeEmployeeMaintenance({...a,expectedEmployeeStateToken:S.employeeStateToken(current),expectedTemporary:false,
                maintenance:{employeeChanges:{hmeromhnia_proslhpshs:hire},historyChanges:{}}}),{code:'EMPLOYEE_SAVE_HIRE_LOCKED'});
        const b=args();await E.collection.insertOne({...employee(b),hmeromhnia_proslhpshs:new Date('2026-10-02')});
        const legacy=await E.findOne(b.scope).lean();assert.equal(S.isTemporaryEmployee(legacy),false);
        assert.equal((await E.find(finalizedEmployeeFilter(b.scope))).length,1);
        await assert.rejects(W.writeEmployeeDraft({...b,employeeId:String(legacy._id),expectedEmployeeStateToken:S.employeeStateToken(legacy)}),{code:'EMPLOYEE_SAVE_ALREADY_FINAL'});
    });
    await t.test('failure after employee/history mutation rolls everything back',async()=>{
        const b=await create(),before=await E.findById(b.employeeId).lean();
        const schedules={find:()=>({session(){return this;},lean:async()=>[]}),create:async()=>{throw Error('injected schedule failure');}};
        await assert.rejects(final(b,{draftSchedule:[{hmeromhnia:'2026-10-02'}],scheduleModel:schedules}),/injected schedule failure/);
        assert.deepEqual(await E.findById(b.employeeId).lean(),before);assert.equal(await H.countDocuments(b.scope),0);assert.equal(await P.countDocuments(b.scope),0);
    });
    await t.test('two simultaneous finalizations: one commit and one stale rejection',async()=>{
        const b=await create();const r=await Promise.allSettled([final(b),final(b)]);
        assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(await H.countDocuments(b.scope),1);
        assert.ok(r.find(x=>x.status==='rejected').reason.code.startsWith('EMPLOYEE_SAVE_'));
    });
    await t.test('simultaneous temporary save and finalization: exactly one owns the snapshot',async()=>{
        const b=await create();const r=await Promise.allSettled([W.writeEmployeeDraft({...b,employeeChanges:{email:'winner@example.invalid'}}),final(b)]);
        assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
        const current=await E.findById(b.employeeId).lean();assert.equal(await H.countDocuments(b.scope),current.oristikh_enhmerosh===false?0:1);
    });
    await t.test('two temporary edits cannot silently overwrite newer fields',async()=>{
        const b=await create();const r=await Promise.allSettled(['one','two'].map(x=>W.writeEmployeeDraft({...b,employeeChanges:{email:x+'@example.invalid'}})));
        assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'EMPLOYEE_SAVE_STATE_STALE');
    });
    await t.test('U and HR have the same Employee capability, and cross-team/no-update fail closed',async()=>{
        const b=await create();for(const role of ['U','HR']){await U.collection.updateOne({_id:actor},{$set:{privileges:role}});
            const current=await E.findById(b.employeeId).lean();await W.writeEmployeeDraft({...b,expectedEmployeeStateToken:S.employeeStateToken(current),employeeChanges:{email:role+'@example.invalid'}});}
        await U.collection.updateOne({_id:actor},{$set:{team:'OTHER'}});
        const before=await E.findById(b.employeeId).lean();await assert.rejects(final({...b,expectedEmployeeStateToken:S.employeeStateToken(before)}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});
        assert.deepEqual(await E.findById(b.employeeId).lean(),before);await U.collection.updateOne({_id:actor},{$set:{team:'TEST'}});
        await V.updateOne({userId:String(actor)},{$set:{'privileges.update':false}});
        await assert.rejects(W.writeEmployeeDraft({...b,expectedEmployeeStateToken:S.employeeStateToken(before)}),{code:'EMPLOYEE_HISTORY_MANAGEMENT_FORBIDDEN'});
        await V.updateOne({userId:String(actor)},{$set:{'privileges.update':true}});
    });
    await t.test('operational guard rejects drafts, mixed identities and other companies before any action',async()=>{
        const guard=require('../../server/middlewares/requireFinalizedEmployee'),b=await create();
        const run=async(body,companyId=company)=>{
            let action=false,status=200,data;
            await guard({body,session:{userTeam:'TEST',companyInUse:companyId}},
                {status(value){status=value;return this;},json(value){data=value;}},()=>{action=true;});
            return {action,status,data};
        };
        assert.equal((await run({employeeId:b.employeeId})).status,409);
        assert.equal((await run({employeeId:b.employeeId,formData:{kodikosHidden:a.scope.kodikos}})).action,false);
        assert.equal((await run({employeeId:a.employeeId,formData:{kodikosHidden:b.scope.kodikos}})).action,false);
        assert.equal((await run({employeeId:a.employeeId},String(new mongoose.Types.ObjectId()))).status,404);
        assert.equal((await run({employeeId:a.employeeId,formData:{kodikosHidden:a.scope.kodikos}})).action,true);
        assert.equal(await H.countDocuments(b.scope),0);
    });
    await t.test('manual History and rehire cannot initialize a draft',async()=>{
        const b=await create(),before=await E.findById(b.employeeId).lean();
        await assert.rejects(W.writeEmployeeRehire({...b,rehireDate:'2026-10-10'}),{code:'EMPLOYEE_SAVE_DRAFT_REQUIRED'});
        await assert.rejects(W.writeEmployeeEmploymentHistoryOperations({...b,operations:[]}),{code:'EMPLOYEE_SAVE_DRAFT_REQUIRED'});
        assert.deepEqual(await E.findById(b.employeeId).lean(),before);assert.equal(await H.countDocuments(b.scope),0);
    });
});
