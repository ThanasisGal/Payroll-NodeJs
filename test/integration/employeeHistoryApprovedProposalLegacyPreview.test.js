'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { chromium } = require('playwright');
const { startApprovedProposalMongo, seedApprovedProposal, startApprovedProposalHttp } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

// Synthetic counterpart of the reported route, never an employee export.
async function legacyCase(db) {
    const f = await seedApprovedProposal(db, { employeeCode: '0002' });
    for (const [index,row] of f.history.entries()) {
        const from = ['2026-02-02','2026-04-01','2026-06-01'][index];
        await db.historyModel.collection.updateOne({ _id: row._id }, { $set: {
            [C.HIRE]: new Date('2026-02-02'), [C.START]: new Date(from), [C.CHANGE]: new Date(from),
            [C.END]: index < 2 ? new Date(['2026-03-31','2026-05-31'][index]) : null,
            hmeromhnia_isxyos_dialleimatos_apo: new Date(from),
            ...(index === 0 ? { employment_profile_schema_version: null, hmeres_ergasias_ebdomadas: 0,
                ores_ergasias_ebdomadas: 0, mo_oron_hmerhsias_ergasias: 0 } : {})
        }, ...(index < 2 ? { $unset: { eidikothta_symbashs: 1, ...(index === 1 ? { nomimosMisthos: 1 } : {}) } } : {}) });
    }
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: {
        [C.HIRE]: new Date('2026-02-02'), [C.START]: new Date('2026-06-01'), [C.CHANGE]: new Date('2026-06-01'),
        hmeromhnia_isxyos_dialleimatos_apo: new Date('2026-06-01') } });
    await db.companyModel.collection.updateOne({ _id: new Types.ObjectId(f.scope.company_kod) }, { $set: { kod: '0003' } });
    const input = f.input;
    f.input = async () => ({ ...await input(), companyBusinessCode: '0003' });
    f.dependencies.isEnabled = () => false;
    return f;
}
async function workbook(f, values = {}) {
    const selection = `UPDATE:${f.history[0]._id}`;
    const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection });
    assert.ok(baseline.workbook);
    const model = E.editorModel(baseline, f.catalogs), controls = new Map(model.rows.filter(row => row.control).map(row => [row.control.index,row.control]));
    const desired = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        eidikothta_symbashs: '01', EVIDENCE: '', DECLARATION: 'Όχι', ...values };
    const completion = { caseId: baseline.caseSelection.selectedCase.id, snapshotFingerprint: baseline.snapshotFingerprint,
        context: E.editorContext(f.req, baseline.snapshotFingerprint, baseline.caseSelection.selectedCase.id),
        changes: baseline.editableCells.map((entry,index) => {
            const control = controls.get(index), key = entry.canonicalField || entry.fieldId;
            let value = control.value === '-1' || control.value == null ? '' : control.value;
            if (Object.hasOwn(desired,key)) value = control.options.length ?
                control.options.find(option => option.rawValue === desired[key]).value : desired[key];
            return { index,value };
        }) };
    E.applyLocalCompletion(baseline, completion, f.req, f.catalogs);
    return { selection, baseline, completion, buffer: await X.serializeEmployeeHistoryProposalWorkbook(baseline.workbook) };
}
async function post(h,f,suffix,body) {
    const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-${suffix}`, {
        method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':'synthetic-approved-csrf'},body:JSON.stringify(body) });
    return { status:response.status, body:await response.json() };
}
async function loaded(h,f,sample) {
    const data = new FormData();
    data.append('proposal',new Blob([sample.buffer]),'synthetic-legacy-0001.xlsx');
    const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-import-preview`, {
        method:'POST',headers:{'X-CSRF-Token':'synthetic-approved-csrf'},body:data });
    const imported = await response.json();assert.equal(imported.success,true,imported.message);
    const raw = new Map(imported.editorValues.values.map(item => [item.fieldId,item.value]));
    assert.equal(raw.get('DECLARATION'),'Όχι');assert.equal(raw.get('EVIDENCE'),'');
    assert.equal(raw.size,sample.baseline.editableCells.length);
    return { selection:sample.selection, completion:{...sample.completion,changes:sample.baseline.editableCells.map((entry,index)=>{
        const value=raw.get(entry.canonicalField||entry.fieldId),choices=E.editorChoices(entry,f.catalogs);
        return {index,value:value===null?'':choices.length?String(choices.findIndex(option=>option.id===value)):value};
    })} };
}
function change(sample,proposal,field,value) {
    const index=sample.baseline.editableCells.findIndex(entry=>entry.canonicalField===field);
    proposal.completion.changes.find(item=>item.index===index).value=value;
}

test('Παλαιό 0001 UPDATE: πραγματικός HTTP controller, φορτωμένα XLSX ΜΕΤΑ και ασφαλής αναγνωστική προεπισκόπηση',
    {skip:!binary,timeout:90000},async t=>{
    const db=await startApprovedProposalMongo(binary);t.after(db.close);
    console.log(`Απομονωμένη βάση δοκιμής: ${db.folder}`);
    for(const scenario of ['valid','missing','rounded-hours','invalid-date','outside-cycle','range-dates','global-obstacle','overlap','profile-intervals','profile-duration'])
        await t.test(scenario,async()=>{
            const f=await legacyCase(db),service=create(f.dependencies),h=await startApprovedProposalHttp(f,service);
            try{
                if(scenario==='global-obstacle')await db.periodControlModel.collection.updateOne({company_kod:f.scope.company_kod},{$set:{period_end:new Date('2026-02-28')}});
                const sample=await workbook(f,scenario==='rounded-hours'?{
                    hmeres_ergasias_ebdomadas:6,mo_oron_hmerhsias_ergasias:6.67,typos_ebdomadas:'6HMERH'}:{});
                const proposal=await loaded(h,f,sample);
                if(scenario==='missing'){
                    change(sample,proposal,C.START,'');change(sample,proposal,'pragmatikosMisthos','0');
                    change(sample,proposal,'evelikth_proselefsh','');
                }
                if(scenario==='invalid-date'){
                    change(sample,proposal,C.START,'2026-02-30');change(sample,proposal,'nomimosMisthos','-1');
                }
                if(scenario==='outside-cycle')change(sample,proposal,C.CHANGE,'2026-01-01');
                if(scenario==='range-dates'){change(sample,proposal,C.CHANGE,'2026-04-01');change(sample,proposal,C.CONTRACT_END,'2026-03-15');}
                if(scenario==='overlap')change(sample,proposal,C.END,'2026-04-10');
                if(scenario==='profile-duration')change(sample,proposal,'dialleima_se_lepta','45');
                if(scenario==='profile-intervals')change(sample,proposal,'dialleima_apo_ora_01','12:00');
                const before=await f.snapshot(),commands=[];
                const monitor=event=>commands.push(event.commandName);db.connection.getClient().on('commandStarted',monitor);
                const result=await post(h,f,'apply-preview',proposal);db.connection.getClient().off('commandStarted',monitor);
                assert.equal(result.body.saved,false);assert.equal(result.body.executionEnabled,false);
                assert.equal(commands.some(name=>['insert','update','delete','findAndModify'].includes(name)),false);
                assert.equal(await f.snapshot(),before);
                if(scenario==='valid'){
                    assert.equal(result.status,200,result.body.message);assert.equal(result.body.success,true);
                    assert.equal(result.body.approved,false);assert.equal(result.body.historyStatus,'REVIEW_REQUIRED');
                    assert.equal(result.body.historySequence,'0001');assert.deepEqual(result.body.period,{from:'2026-02-02',to:'2026-03-31'});
                    assert.ok(result.body.rows.some(row=>row.fieldId==='eidikothta_symbashs'));
                }else{
                    assert.equal(result.body.success,false);assert.ok(result.body.problems.length,result.body.message);
                    assert.equal(result.body.proposalCase.historySequence,'0001');assert.equal(result.body.proposalCase.operation,'UPDATE');
                    assert.ok(result.body.problems.every(item=>item.code&&item.cause&&item.action));
                    assert.doesNotMatch(JSON.stringify(result.body),new RegExp(String(f.history[0]._id)));
                    if(scenario==='missing')for(const field of [C.START,'pragmatikosMisthos','evelikth_proselefsh'])
                        assert.ok(result.body.problems.some(item=>item.fieldId===field),field);
                    if(scenario==='rounded-hours'){
                        const problem=result.body.problems.find(item=>item.check==='WEEKLY_HOURS_PRODUCT_MISMATCH');
                        assert.deepEqual(problem.fields,C.CRITICAL_NUMBERS);assert.equal(problem.kind,'CHECK');
                        assert.match(problem.cause,/6 ημέρες × 6,67 ώρες = 40,02 ώρες/);
                        assert.match(problem.cause,/40 εβδομαδιαίες/);
                    }
                    if(scenario==='invalid-date'){
                        assert.ok(result.body.problems.some(item=>item.fieldId===C.START&&item.code==='INVALID_TEMPORAL_DATE'));
                        assert.ok(result.body.problems.some(item=>item.fieldId==='nomimosMisthos'&&item.code==='INVALID_NUMERIC_PROFILE_FACT'));
                    }
                    if(scenario==='outside-cycle'){
                        const problem=result.body.problems.find(item=>item.fieldId===C.CHANGE);
                        assert.equal(problem.check,'DATE_OUTSIDE_EMPLOYMENT_CYCLE');assert.match(problem.cause,/2026-01-01.*2026-02-02/);
                    }
                    if(scenario==='range-dates'){
                        const problem=result.body.problems.find(item=>item.check==='DATE_RANGE_REVERSED');
                        assert.deepEqual(problem.fields,[C.CHANGE,C.CONTRACT_END]);assert.match(problem.cause,/2026-04-01.*2026-03-15/);
                    }
                    if(scenario==='global-obstacle'){
                        assert.match(result.body.code,/PROTECTION_UNKNOWN$/);
                        assert.ok(result.body.problems.some(item=>item.kind==='CHECK'&&item.code==='PROTECTION_UNKNOWN'));
                        assert.match(result.body.message,/0001.*2026-02-02.*2026-03-31/);
                    }
                    if(scenario==='overlap')assert.match(result.body.code,/COVERAGE$/);
                    if(scenario==='profile-duration')change(sample,proposal,'dialleima_se_lepta','45');
                if(scenario==='profile-intervals')assert.ok(result.body.problems.some(item=>item.check==='INTERVAL_PAIR_REQUIRED'));
                }
                const apply=await post(h,f,'apply',{proposal,approval:{token:result.body.approval?.token||'invalid',confirmed:true}});
                assert.equal(apply.status,403);assert.match(apply.body.code,/DISABLED$/);assert.equal(await f.snapshot(),before);
            }finally{await h.close();}
        });

    await t.test('Chromium: ίδια πραγματική διαδρομή XLSX → controller → ακριβής σχέση ωρών → επιτυχής προεπισκόπηση με Όχι',async()=>{
        const f=await legacyCase(db),h=await startApprovedProposalHttp(f,create(f.dependencies));
        const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
        const external=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
        await context.route('**/*',route=>{
            if(new URL(route.request().url()).origin===h.origin)return route.continue();external.push(route.request().url());return route.abort();
        });
        try{
            const sample=await workbook(f,{hmeres_ergasias_ebdomadas:6,mo_oron_hmerhsias_ergasias:6.67,typos_ebdomadas:'6HMERH'}),before=await f.snapshot();
            await page.goto(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=${sample.selection}`);
            const imported=page.waitForResponse(response=>response.url().endsWith('/history-proposal-import-preview'));
            await page.locator('#proposalImportFile').setInputFiles({name:'synthetic-0001.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:sample.buffer});
            assert.equal((await (await imported).json()).success,true);
            await page.waitForFunction(()=>document.getElementById('chooseProposalFile').disabled===false);
            assert.equal(await page.locator('[data-field-id="DECLARATION"] option:checked').textContent(),'Όχι');
            assert.equal(await page.locator('[data-field-id="EVIDENCE"]').inputValue(),'');
            const preview=async()=>{
                const response=page.waitForResponse(response=>response.url().endsWith('/history-proposal-apply-preview'));
                await page.locator('#previewProposalApply').click();const body=await (await response).json();
                await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');return body;
            };
            const failed=await preview();assert.equal(failed.success,false);
            assert.match(await page.locator('#proposalApplyIssues').textContent(),/6 ημέρες × 6,67 ώρες = 40,02 ώρες/);
            assert.equal(await page.locator('#proposalApplyIssues tbody tr').count(),1);
            assert.equal(await page.locator('#proposalApplyIssues th').first().textContent(),'Πεδίο ή έλεγχος');
            for(const [width,height] of [[1440,900],[480,700],[900,450]]){
                await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            }
            // Explicit synthetic corrections for this test only, never inferred
            // or filled by the application in the user's historical proposal.
            await page.locator('[data-field-id="hmeres_ergasias_ebdomadas"]').fill('5');
            await page.locator('[data-field-id="mo_oron_hmerhsias_ergasias"]').fill('8');
            await page.locator('[data-field-id="typos_ebdomadas"]').selectOption({label:'Πενθήμερο'});
            const valid=await preview();assert.equal(valid.success,true,valid.message);assert.equal(valid.approved,false);
            assert.equal(await page.locator('#approveProposalApply').isDisabled(),true);
            assert.equal(await page.locator('#proposalApplyIssues').isVisible(),false);
            assert.equal(await f.snapshot(),before);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        }finally{await browser.close();await h.close();}
    });
});
