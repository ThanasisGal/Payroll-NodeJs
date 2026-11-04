'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 real period finalization and NORMAL Settlement', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-finalize', serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect()); target.assertMongoConnection(mongoose.connection);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const M = require('../../server/models/ergazomenoi'), C = require('../../server/models/companies'),
        A = require('../../server/models/stathera_arxeia');
    const Decision = require('../../server/models/apasxoliseisWeeklyRepoTransferDecision');
    const Period = require('../../server/models/apasxoliseisPeriodControl');
    for (const model of [M.ErgazomenoiModel, M.IstorikoProslhpseonAllagonModel, M.ProdhlomenaOrariaModel,
        M.ProdhlomenaOrariaAuditModel, C.CompaniesModel, C.YpokatasthmataModel, A.ArgiesModel, A.PeriodsModel,
        Decision, Period, require('../../server/models/employeeHistoryRepairAudit'), require('../../server/models/userModel'),
        require('../../server/models/privileges').UserPrivilegesModel]) await model.createCollection();
    // Install the model's real uniqueness constraints only in the guarded test
    // database. Never substitute partial indexes or disable a production guard.
    await Decision.createIndexes();
    const Frozen = require('../../server/models/apasxoliseisPeriodFrozenSnapshot');
    const Corrective = require('../../server/models/apasxoliseisPeriodCorrectiveCase');
    const Posting = require('../../server/models/apasxoliseisCorrectivePayrollPosting');
    const Balance = require('../../server/models/apasxoliseisCorrectivePayrollBalance');
    const { ApasxolhseisModel: Payroll, ApasxolhseisPeriodFactsModel: Facts } = require('../../server/models/kinhseis');
    const Audit = require('../../server/models/apasxoliseisPeriodLifecycleAudit');
    const Index = require('../../server/services/ergazomenoi/apasxoliseisPeriodLifecycleIndexGuardService');
    // Preserve earlier groups' documents in their original collections while
    // installing the real indexes on this guarded disposable database.
    const preserved = [];
    for (const model of [Frozen, Corrective, Posting, Balance, Payroll]) {
        await model.createCollection();
        const before = await model.collection.find({}).sort({ _id: 1 }).toArray();
        for (const [key, options] of model.schema.indexes()) if (Index.REQUIRED_INDEXES.some(item => item.name === options.name))
            await model.collection.createIndex(key, options);
        assert.deepEqual(await model.collection.find({}).sort({ _id: 1 }).toArray(), before);
        preserved.push({ collection: model.collection.name, documents: before.length });
    }
    await Audit.createCollection();
    const verified = [];
    for (const model of [Frozen, Corrective, Posting, Balance, Payroll]) for (const [key, options] of model.schema.indexes()) {
        if (!Index.REQUIRED_INDEXES.some(item => item.name === options.name)) continue;
        const actual = (await model.collection.indexes()).find(item => item.name === options.name);
        assert.deepEqual(actual.key, key); assert.equal(actual.unique, true);
        assert.deepEqual(actual.partialFilterExpression, options.partialFilterExpression); verified.push(options.name);
    }
    assert.equal(verified.length, 8); assert.equal((await Index.assertPeriodLifecycleIndexesReady()).ready, true);
    require('node:fs').writeFileSync('/tmp/payroll-gate2-finalize-indexes-20261103.json', JSON.stringify({ preserved, verified }, null, 2));
    const Controller = require('../../server/controllers/ergazomenoi/erganhController');
    const load = Controller.__periodFinalizationTestHooks.loadEmploymentPeriodFrozenSnapshotInput;
    const Lifecycle = require('../../server/services/ergazomenoi/apasxoliseisPeriodLifecycleService');
    const Builder = require('../../server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
    const Historical = require('../../server/services/ergazomenoi/apasxoliseisHistoricalPeriodReconstructionService');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const commands = [], conflicts = [], client = mongoose.connection.getClient();
    client.on('commandStarted', e => commands.push(e));
    client.on('commandFailed', e => { if (e.failure?.code === 112) conflicts.push(e); });
    const bounded = async p => { let timer; try { return await Promise.race([p, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('FINALIZE_BARRIER_TIMEOUT')), 10000);
    })]); } finally { clearTimeout(timer); } };
    function pauseSession() {
        const connection = mongoose.connection, original = connection.startSession;
        let reached, release, used = false;
        const ready = new Promise(resolve => { reached = resolve; });
        const wait = new Promise(resolve => { release = resolve; });
        connection.startSession = async function (...args) { const session = await original.apply(this, args);
            if (!used) { used = true; reached(); await wait; } return session; };
        return { reached: ready, close() { release(); connection.startSession = original; } };
    }
    const business = row => { const { history_reference_fence, updatedAt, employment_history_canonical_status,
        employment_history_canonical_survivor_id, ...value } = row; return value; };
    async function setup(referenceCopies = 2, month = 10) {
        const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
        const fixture = month === 5 ? require('../fixtures/employeeHistoryCoordinatedSettlementFixture').typedFixture(F.input([
            F.period(1,{to:'2026-03-31'}),F.period(2,{from:'2026-04-01',to:'2026-08-31'}),
            F.period(3,{from:'2026-09-01',to:'2027-12-31'})])) : acceptanceBWithInitialGap();
        for (const row of [fixture.currentEmployee, ...fixture.completeHistoryRows]) row.dialleima_se_lepta = 0;
        fixture.currentEmployee.ypokatasthma = '0001';
        const db = await createMongoSettlementStore({ fixture, enriched: false, executionMode: 'NORMAL',
            settlementReferenceEvidence: true, referenceCopies: 0 });
        // Finalization snapshots identify employees inside the payload, not by
        // a root kodikos. Assert the actual company-scoped frozen documents.
        const originalState = db.state;
        db.state = async () => ({ ...await originalState(), references: await Frozen.collection.find({
            team: db.scope.team, company_kod: db.scope.company_kod }).sort({ _id: 1 }).toArray() });
        const companyCode = 'GATE2-' + db.employeeId, periodCode = 'GATE2-' + db.employeeId;
        await C.CompaniesModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(db.scope.company_kod) },
            { $set: { kod: companyCode, apasxolhsh_kata_tis_argies: false, leitoyrgia_stis_mh_ypoxreotikes_argies: false } });
        await C.YpokatasthmataModel.collection.insertOne({ team: db.scope.team, companykod_object: db.scope.company_kod, kodikos: '0001' });
        await A.PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: periodCode,
            apo: new Date(Date.UTC(2026,month,1)), eos: new Date(Date.UTC(2026,month+1,0)) });
        const periodScope = { team: db.scope.team, company_kod: db.scope.company_kod, ypokatasthma: '0001',
            period_start: new Date(Date.UTC(2026,month,1)), period_end: new Date(Date.UTC(2026,month+1,0)) };
        await Period.create({ ...periodScope, deadline: new Date('2026-12-31'), status: 'LOCKED',
            successful_calculation_version: 1, last_successful_calculation_at: new Date('2026-11-03T10:00:00Z') });
        const state = await db.state();
        for (const [i, history] of state.history.entries()) for (let copy=0;copy<referenceCopies;copy++) {
            await Frozen.create({ ...periodScope, ypokatasthma:'0009', period_start:new Date('2026-10-01'),period_end:new Date('2026-10-31'),
                snapshot_schema_version:'employment-period-frozen:v3',source_calculation_version:'employment-calculation:v2',
                frozen_snapshot_fingerprint:'a'.repeat(64),frozen_snapshot:{employees:[state.employee],daily_results:[{kodikos:db.scope.kodikos,effective_profile_istoriko_id:String(history._id)}]},
                finalized_at:new Date('2026-11-01'),finalized_by_user_id:db.actorUserId,finalized_by_user_name:'Isolated HR',finalized_by_user_role:'A',
                finalize_reason:'Isolated previous valid reference',request_id:'prior-'+db.employeeId+'-'+i+'-'+copy,
                baseline_origin:'NORMAL',historical_reconstruction_version:i*100+copy,created_at:new Date('2026-11-01') });
        }
        assert.equal((await db.state()).references.length, state.history.length * referenceCopies);
        const rows = Array.from({ length: 7 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), ...db.scope,
            ypokatasthma:'0001',hmeromhnia:new Date(Date.UTC(2026,month,2+i)),kathgoria_ergasias:'ΕΡΓ',
            kathgoria_ergasias_apologistika:'ΕΡΓ',ores_ergasias:8,apo_ora_01:'09:00',eos_ora_01:'17:00',
            cards_ores_ergasias:8,cards_apo_ora_01:'09:00',cards_eos_ora_01:'17:00',
            ores_ergasias_apologistika:8,ores_pragmatikhs_ergasias_apologistika:8,is_locked:true,apologistiko_biblio:true }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        await Payroll.collection.insertOne({ _id:new mongoose.Types.ObjectId(),...db.scope,ypokatasthma:'0001',xrhsh:'2026',periodos:periodCode,typos_apodoxon:'01',aa_misthodosias:'01',synolo_apodoxon:1450,plhroteo:1200 });
        const session={userTeam:db.scope.team,companyInUse:db.scope.company_kod,userId:db.actorUserId,userRole:'A',userStatus:'A',userName:'Gate 2 isolated HR',yearInUse:'2026',periodInUse:periodCode,companyKodikos:companyCode};
        const req={session,body:{ypokatasthma:'0001',reason:'Απομονωμένη οριστικοποίηση',request_id:'gate2-finalize-'+db.employeeId}};
        const snapshotInput=await load(req,periodScope); const built=Builder.buildEmploymentPeriodFrozenSnapshot({...snapshotInput,scope:periodScope});
        assert.equal(built.snapshot.daily_results.length,7);assert.equal(built.snapshot.weekly_calculation_context.profile_history.length,3);
        async function invoke(patch={}) {const res={statusCode:200,status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};
            await Controller.finalizeEmploymentReviewPeriod({...req,body:{...req.body,...patch}},res);return res;}
        async function settle(){const input=await db.approvalInput(),fingerprint=S.buildEmployeeHistorySettlementApprovalFingerprint({...input,proposal:U.buildCoordinatedSettlementProposal(input)});
            return()=>W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({syntheticStore:db.handle,scope:db.scope,employeeId:db.employeeId,actorUserId:db.actorUserId,coordinated:true,approval:{confirmed:true,fingerprint}});}
        return{db,periodScope,rows,session,req,snapshotInput,built,invoke,settle,
            snapshots:()=>Frozen.find({...periodScope}).lean(),audits:()=>Audit.find({...periodScope,event_type:'FINALIZE'}).lean()};
    }
    await t.test('eight actual schema indexes and full real controller finalization',async()=>{
        const c=await setup(),before=await c.db.state(),result=await c.invoke();assert.equal(result.statusCode,201,JSON.stringify(result.body));
        assert.equal((await c.snapshots()).length,1);assert.equal((await c.audits()).length,1);assert.equal((await Period.findOne(c.periodScope).lean()).status,'FINALIZED');
        const after=await c.db.state();assert.deepEqual(after.employee,before.employee);assert.deepEqual(after.history.map(business),before.history.map(business));
    });
    await t.test('regression: actual daily change after building snapshot cannot finalize stale data',async()=>{
        const c=await setup(),barrier=pauseSession(),pending=c.invoke();
        try{await bounded(barrier.reached);await M.ProdhlomenaOrariaModel.collection.updateOne({_id:c.rows[0]._id},{$set:{ores_ergasias_apologistika:7}});}finally{barrier.close();}
        const result=await pending;assert.equal(result.statusCode,409,JSON.stringify(result.body));assert.equal((await c.snapshots()).length,0);assert.equal((await c.audits()).length,0);
    });

    async function unchanged(c,before){assert.equal((await c.snapshots()).length,0);assert.equal((await c.audits()).length,0);
        assert.deepEqual((await c.db.state()).employee,before.employee);assert.deepEqual((await c.db.state()).history,before.history);}
    for(const [patch,code] of [[{status:'OPEN'},'PERIOD_FINALIZE_REQUIRES_LOCKED'],[{active_calculation_id:'running'},'PERIOD_CONTROL_CALCULATION_IN_PROGRESS'],
        [{frozen_snapshot_id:new mongoose.Types.ObjectId()},'PERIOD_ALREADY_FINALIZED']])await t.test('period guard '+code,async()=>{
        const c=await setup(),before=await c.db.state();await Period.collection.updateOne(c.periodScope,{$set:patch});
        const result=await c.invoke();assert.equal(result.statusCode,409);assert.equal(result.body.code,code);await unchanged(c,before);
    });
    await t.test('same request replays once; different request for finalized period is rejected',async()=>{
        const c=await setup();assert.equal((await c.invoke()).statusCode,201);assert.equal((await c.invoke()).statusCode,200);
        assert.equal((await c.invoke({request_id:c.req.body.request_id+'-different'})).statusCode,409);
        assert.equal((await c.snapshots()).length,1);assert.equal((await c.audits()).length,1);
    });
    await t.test('regression: reused finalize request with different reason must conflict',async()=>{
        const c=await setup();assert.equal((await c.invoke()).statusCode,201);
        const result=await c.invoke({reason:'Άλλη εντολή οριστικοποίησης'});assert.equal(result.statusCode,409,JSON.stringify(result.body));
    });
    await t.test('same historical reconstruction version cannot create second snapshot',async()=>{
        const c=await setup();const old=await Frozen.findOne({company_kod:c.db.scope.company_kod}).lean();
        await Frozen.collection.insertOne({...old,_id:new mongoose.Types.ObjectId(),...c.periodScope,historical_reconstruction_version:0,request_id:'conflicting-'+c.db.employeeId});
        const result=await c.invoke();assert.equal(result.statusCode,409);assert.equal(result.body.code,'PERIOD_FROZEN_SNAPSHOT_VERSION_CONFLICT');assert.equal((await c.audits()).length,0);
    });
    function pauseRead(model,matches){const original=model.findOne;let used=false,reached,release;
        const ready=new Promise(r=>{reached=r;}),wait=new Promise(r=>{release=r;});model.findOne=function(...args){const query=original.apply(this,args);
            if(!used&&matches(args[0])){used=true;const lean=query.lean.bind(query);query.lean=async(...options)=>{const value=await lean(...options);reached();await wait;return value;};}return query;};
        return{reached:ready,close(){release();model.findOne=original;}};}
    for(const change of ['daily','payroll','history'])await t.test('snapshot race '+change+' produces real conflict and fresh callback retry',async()=>{
        const c=await setup(),start=conflicts.length,commandStart=commands.length,barrier=pauseRead(Period,f=>f.company_kod===c.db.scope.company_kod),pending=c.invoke();
        try{await bounded(barrier.reached);
            if(change==='daily')await M.ProdhlomenaOrariaModel.collection.updateOne({_id:c.rows[0]._id},{$set:{ores_ergasias_apologistika:7}});
            if(change==='payroll')await Payroll.collection.updateOne(c.db.scope,{$set:{synolo_apodoxon:1500}});
            if(change==='history'){const state=await c.db.state();await M.IstorikoProslhpseonAllagonModel.collection.updateOne({_id:state.history.at(-1)._id},{$set:{pragmatikoOromisthio:99}});}
        }finally{barrier.close();}
        const result=await pending;assert.equal(result.statusCode,409,JSON.stringify(result.body));assert.ok(conflicts.length>start);
        assert.ok(commands.slice(commandStart).filter(e=>e.commandName==='find'&&e.command.find===M.ProdhlomenaOrariaModel.collection.name&&e.command.autocommit===false).length>=4);
        assert.equal((await c.snapshots()).length,0);assert.equal((await c.audits()).length,0);
    });
    for(const copies of [1,2,8])await t.test('finalization first versus Settlement with '+copies+' references per History',async()=>{
        const c=await setup(copies),run=await c.settle(),before=await c.db.state(),barrier=c.db.pauseNextEmployeeRead(),start=conflicts.length;
        const settlement=assert.rejects(run(),e=>e.code===S.PREFIX+'STALE');
        try{await bounded(barrier.reached);const result=await bounded(c.invoke());assert.equal(result.statusCode,201,JSON.stringify(result.body));}finally{barrier.resume();}
        await settlement;assert.ok(conflicts.length>start);assert.ok(c.db.transactionCallbacks()>=2);
        const after=await c.db.state();assert.equal(after.audits.length,0);assert.deepEqual(after.employee,before.employee);assert.deepEqual(after.history.map(business),before.history.map(business));
        assert.deepEqual(after.references.filter(r=>r.ypokatasthma==='0009'),before.references);
        for(const row of after.history)assert.equal(row.history_reference_fence,1);
    });
    await t.test('Settlement first forces real finalization retry and rejects old snapshot',async()=>{
        const c=await setup(8),run=await c.settle(),before=await c.db.state(),barrier=c.db.pauseNextReferenceClaim();let listener;
        const conflict=new Promise(resolve=>{listener=e=>{if(e.failure?.code===112)resolve();};});client.on('commandFailed',listener);
        const settlement=run();let pending;try{await bounded(barrier.reached);pending=c.invoke();await bounded(conflict);}finally{barrier.resume();client.off('commandFailed',listener);}
        assert.equal((await settlement).applied,true);const result=await pending;assert.equal(result.statusCode,409,JSON.stringify(result.body));
        assert.equal((await c.snapshots()).length,0);assert.equal((await c.audits()).length,0);
        const after=await c.db.state();assert.equal(after.audits.length,1);assert.equal(after.employee.employee_profile_mutation_sequence,(before.employee.employee_profile_mutation_sequence||0)+1);
        assert.deepEqual(after.references,before.references);
    });
    for(const stage of ['snapshot','period','audit'])await t.test('rollback after real '+stage+' write is complete',async()=>{
        const c=await setup(),before=await c.db.state(),controlBefore=await Period.findOne(c.periodScope).lean();
        let restore;
        if(stage==='snapshot'||stage==='audit'){const model=stage==='snapshot'?Frozen:Audit,original=model.create;
            model.create=async function(...args){await original.apply(this,args);throw Error('ISOLATED_AFTER_REAL_'+stage);};restore=()=>{model.create=original;};}
        else{const original=Period.findOneAndUpdate;Period.findOneAndUpdate=function(...args){const q=original.apply(this,args),exec=q.exec.bind(q);
            q.exec=async(...options)=>{await exec(...options);throw Error('ISOLATED_AFTER_REAL_PERIOD');};return q;};restore=()=>{Period.findOneAndUpdate=original;};}
        let result;try{result=await c.invoke();}finally{restore();}assert.equal(result.statusCode,500);await unchanged(c,before);
        assert.deepEqual(await Period.findOne(c.periodScope).lean(),controlBefore);assert.deepEqual(await c.db.state(),before);
    });
    for(const stale of [false,true])await t.test('real historical reconstruction current='+!stale,async()=>{
        const c=await setup(2,5),fingerprints=await Historical.calculateHistoricalFingerprints({scope:c.periodScope});
        await Period.collection.updateOne(c.periodScope,{$set:{historical_reconstruction_status:'COMPLETED',historical_reconstruction_version:2,
            historical_source_fingerprint:fingerprints.source_fingerprint,historical_dependency_fingerprint:fingerprints.dependency_fingerprint,
            historical_holiday_dependency_fingerprint:fingerprints.holiday_dependency_fingerprint,historical_result_fingerprint:fingerprints.result_fingerprint,
            deadline:require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService').calculatePeriodDeadline(c.periodScope.period_end)}});
        if(stale)await A.ArgiesModel.collection.insertOne({team:c.db.scope.team,company_kod:c.session.companyKodikos,etos:'2026',hmeromhnia:c.rows[1].hmeromhnia,ypoxreotikh_argia:true,perigrafh:'Changed real historical holiday dependency'});
        const result=await c.invoke();assert.equal(result.statusCode,stale?409:201,JSON.stringify(result.body));
        if(stale)assert.equal(result.body.code,'HISTORICAL_RECONSTRUCTION_STALE_CANNOT_FINALIZE');
        else{const saved=(await c.snapshots())[0];assert.equal(saved.baseline_origin,'HISTORICAL_RECONSTRUCTION_AFTER_DEADLINE');assert.equal(saved.historical_reconstruction_version,2);}
    });
    for(const mode of ['unknown-commit','lost-ack'])await t.test('uncertain finalize '+mode+' never duplicates snapshot or audit',async()=>{
        const c=await setup(),before=await c.db.state(),admin=mongoose.connection.db.admin(),original=mongoose.connection.startSession;
        let uncertainty=0,lost=0;const observer=e=>{if(e.commandName==='commitTransaction'&&e.reply?.writeConcernError?.code===64)uncertainty++;};client.on('commandSucceeded',observer);
        if(mode==='lost-ack')mongoose.connection.startSession=async function(...args){const session=await original.apply(this,args),withTransaction=session.withTransaction.bind(session);
            session.withTransaction=async(...options)=>{await withTransaction(...options);lost++;throw Error('ISOLATED_COMMIT_ACK_LOST');};return session;};
        let result;try{if(mode==='unknown-commit')await admin.command({configureFailPoint:'failCommand',mode:{times:1},data:{failCommands:['commitTransaction'],appName:'payroll-gate2-finalize',writeConcernError:{code:64,errmsg:'isolated finalize uncertainty'},errorLabels:['UnknownTransactionCommitResult']}});
            result=await c.invoke();}finally{mongoose.connection.startSession=original;client.off('commandSucceeded',observer);if(mode==='unknown-commit')await admin.command({configureFailPoint:'failCommand',mode:'off'});}
        assert.equal(mode==='unknown-commit'?uncertainty:lost,1);assert.ok([200,201,500].includes(result.statusCode));
        assert.equal((await c.invoke()).statusCode,200);assert.equal((await c.snapshots()).length,1);assert.equal((await c.audits()).length,1);
        assert.equal((await c.db.state()).audits.length,0);assert.deepEqual((await c.db.state()).employee,before.employee);
    });

    await t.test('snapshot reference fence period transition and FINALIZE audit share one real transaction',async()=>{
        const c=await setup(),start=commands.length;assert.equal((await c.invoke()).statusCode,201);
        const events=commands.slice(start),key=e=>JSON.stringify(e.command.lsid)+':'+String(e.command.txnNumber);
        const frozen=events.find(e=>e.commandName==='insert'&&e.command.insert===Frozen.collection.name&&e.command.autocommit===false);
        const audit=events.find(e=>e.commandName==='insert'&&e.command.insert===Audit.collection.name&&e.command.autocommit===false);
        const control=events.find(e=>e.commandName==='findAndModify'&&e.command.findAndModify===Period.collection.name);
        const fence=events.find(e=>e.commandName==='update'&&e.command.update===M.IstorikoProslhpseonAllagonModel.collection.name&&e.command.updates.some(u=>u.u.$inc?.history_reference_fence===1));
        assert.ok(frozen&&audit&&control&&fence);assert.equal(new Set([frozen,audit,control,fence].map(key)).size,1);
        assert.ok(events.some(e=>e.commandName==='commitTransaction'&&key(e)===key(frozen)));
    });
    for(const sameRequest of [true,false])await t.test('concurrent real finalizations same request='+sameRequest,async()=>{
        const c=await setup(),results=await Promise.all([c.invoke(),c.invoke(sameRequest?{}:{request_id:c.req.body.request_id+'-other'})]);
        assert.deepEqual(results.map(r=>r.statusCode).sort(),sameRequest?[200,201]:[201,409]);
        assert.equal((await c.snapshots()).length,1);assert.equal((await c.audits()).length,1);
    });
    await t.test('same request cannot acknowledge a different active period',async()=>{
        const c=await setup();assert.equal((await c.invoke()).statusCode,201);
        const code='OTHER-'+c.db.employeeId;await A.PeriodsModel.collection.insertOne({xrhsh:'2026',kodikos:code,apo:new Date('2026-12-01'),eos:new Date('2026-12-31')});
        c.req.session.periodInUse=code;const result=await c.invoke();assert.equal(result.statusCode,409);assert.equal(result.body.code,'PERIOD_FINALIZE_REQUEST_CONFLICT');
        assert.equal((await c.snapshots()).length,1);assert.equal((await c.audits()).length,1);
    });
    await t.test('multiple employees finalize once with all six distinct History references fenced',async()=>{
        const c=await setup(),state=await c.db.state(),scope={...c.db.scope,kodikos:c.db.scope.kodikos+'-other'};
        const employee={...state.employee,...scope,_id:new mongoose.Types.ObjectId()},ids=new Map(state.history.map(row=>[String(row._id),new mongoose.Types.ObjectId()]));
        await M.ErgazomenoiModel.collection.insertOne(employee);
        await M.IstorikoProslhpseonAllagonModel.collection.insertMany(state.history.map(row=>({...row,...scope,_id:ids.get(String(row._id))})));
        const rows=c.rows.map(row=>({...row,...scope,_id:new mongoose.Types.ObjectId()}));await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const beforeRows=await M.ProdhlomenaOrariaModel.collection.find({team:scope.team,company_kod:scope.company_kod}).sort({_id:1}).toArray();
        const beforeHistory=await M.IstorikoProslhpseonAllagonModel.collection.find({team:scope.team,company_kod:scope.company_kod}).sort({_id:1}).toArray();
        const result=await c.invoke();assert.equal(result.statusCode,201,JSON.stringify(result.body));const snapshot=(await c.snapshots())[0];
        assert.equal(snapshot.frozen_snapshot.employees.length,2);assert.equal(snapshot.frozen_snapshot.daily_results.length,14);assert.equal(snapshot.frozen_snapshot.weekly_calculation_context.profile_history.length,6);
        const targets=require('../../server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService').employeeHistoryReferenceTargets(Frozen.collection.name,[snapshot]);assert.equal(targets.length,6);
        const history=await M.IstorikoProslhpseonAllagonModel.collection.find({team:scope.team,company_kod:scope.company_kod}).sort({_id:1}).toArray();
        for(const row of history)assert.equal(row.history_reference_fence,1);assert.deepEqual(history.map(business),beforeHistory.map(business));
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find({team:scope.team,company_kod:scope.company_kod}).sort({_id:1}).toArray(),beforeRows);
        assert.equal((await c.audits()).length,1);assert.deepEqual((await c.db.state()).employee,state.employee);
    });
    await t.test('nonrepresentative frozen BSON change with same id is preserved; old Settlement approval is rejected',async()=>{
        const c=await setup(8),run=await c.settle(),state=await c.db.state(),old=state.references[7],barrier=pauseSession(),pending=c.invoke();let changed;
        try{await bounded(barrier.reached);await Frozen.collection.updateOne({_id:old._id},{$set:{'frozen_snapshot.amount':999}});
            changed=await Frozen.collection.findOne({_id:old._id});}finally{barrier.close();}
        assert.equal((await pending).statusCode,201);assert.deepEqual(await Frozen.collection.findOne({_id:old._id}),changed);
        await assert.rejects(run,e=>e.code===S.PREFIX+'STALE');assert.equal((await c.db.state()).audits.length,0);
    });
    await t.test('new payroll result inserted before transaction invalidates prepared snapshot',async()=>{
        const c=await setup(),barrier=pauseSession(),pending=c.invoke();
        try{await bounded(barrier.reached);await Payroll.collection.insertOne({...c.db.scope,ypokatasthma:'0001',xrhsh:'2026',periodos:c.session.periodInUse,typos_apodoxon:'02',aa_misthodosias:'01',synolo_apodoxon:100});}finally{barrier.close();}
        const result=await pending;assert.equal(result.statusCode,409);assert.equal(result.body.code,'PERIOD_FINALIZE_SNAPSHOT_STALE');assert.equal((await c.snapshots()).length,0);
    });
    await t.test('independent employee and period finalization progresses while Settlement holds another employee',async()=>{
        const c=await setup(),other=await setup(),run=await c.settle(),barrier=c.db.pauseNextReferenceClaim(),settlement=run();
        try{await bounded(barrier.reached);const result=await bounded(other.invoke());assert.equal(result.statusCode,201,JSON.stringify(result.body));}finally{barrier.resume();}
        assert.equal((await settlement).applied,true);assert.equal((await other.snapshots()).length,1);assert.equal((await other.db.state()).audits.length,0);
    });
});
