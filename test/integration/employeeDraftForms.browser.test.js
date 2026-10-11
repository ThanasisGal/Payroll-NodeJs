'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mongoose=require('mongoose');
const {chromium}=require('playwright');
const {browserApp}=require('../helpers/employeeDraftBrowserApp');
const {ErgazomenoiModel:E,IstorikoProslhpseonAllagonModel:H,ProdhlomenaOrariaModel:P}=require('../../server/models/ergazomenoi');
const U=require('../../server/models/userModel');
const {UserPrivilegesModel:V}=require('../../server/models/privileges');
const {CompaniesModel:C}=require('../../server/models/companies');
const uri=process.env.PAYROLL_DRAFT_TEST_MONGO_URI;
const origin='http://127.0.0.1:5001';
const root=path.resolve(__dirname,'../..');
const required=[...fs.readFileSync(path.join(root,'public/js/ergazomenoi/genika/putFieldValues.js'),'utf8').matchAll(/addError\(\s*'([^']+)'/g)].map(x=>x[1]);
async function complete(page,hire){
    await page.evaluate(({required,hire})=>{
        for(const name of required)for(const input of document.querySelectorAll(`[name="${name}"]`)){
            if(input.type==='checkbox'||input.type==='radio')continue;
            if(input.tagName==='SELECT') {if(!input.value){const option=new Option('Δοκιμή','1',true,true);input.add(option);}}
            else if(!input.value)input.value=input.type==='date'?'2026-10-02':input.type==='time'?'08:00':'1';
        }
        const values={eponymoHidden:'ΔΟΚΙΜΑΣΤΙΚΟΣ',onomaHidden:'ΕΡΓΑΖΟΜΕΝΟΣ',afm_ergazomenoyHidden:'199999999',amka_ergazomenoyHidden:'12345678901',email:'browser@example.invalid',
            hmeromhnia_proslhpshs:hire,hmeromhnia_allaghs_symbashs:hire,hmeromhnia_isxyos_oron_ergasias_apo:hire,
            hmeromhnia_allaghs_orarioy_apo:hire,hmeromhnia_allaghs_orarioy_eos:hire,hmeromhnia_apoxorhshs:'',
            hmeromhnia_lhxhs_symbashs:'',hmeromhnia_gennhshs:'1990-01-01',ores_ergasias_ebdomadas:'40',hmeres_ergasias_ebdomadas:'5',
            pragmatikosMisthos:'1234',pragmatikoOromisthio:'7.4',mo_oron_hmerhsias_ergasias:'8',symbatikes_ores_ergasias:'40',
            dialleima_se_lepta:'0',pososto_prosayxhshs_6hs_hmeras:'40',hmeromhnia_metabolhs:hire};
        for(const [name,value]of Object.entries(values))for(const el of document.querySelectorAll(`[name="${name}"]`))el.value=value;
    },{required,hire});
}
async function temporary(page){
    const navigation=page.waitForNavigation({waitUntil:'domcontentloaded'});
    const response=page.waitForResponse(r=>r.request().method()==='POST'&&/ergazomenoi\/(?:ergazomenoi\/add|update\/)/.test(r.url()));
    await page.locator('[data-save-mode="temporary"]:visible').first().click();
    const data=await(await response).json();assert.equal(data.success,true,JSON.stringify(data));
    await navigation;assert.equal(page.url(),origin+data.redirectUrl);return data;
}
test('real Add and Maintenance forms on loopback, with disposable MongoDB', {skip:!uri,timeout:120000},async t=>{
    assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:27139\/payroll_draft_test_[a-z0-9_]+\?replicaSet=payrollDraftTest$/);
    await mongoose.connect(uri,{autoIndex:false});t.after(()=>mongoose.disconnect());
    const actor=new mongoose.Types.ObjectId(),company=new mongoose.Types.ObjectId();
    await U.collection.insertOne({_id:actor,team:'TEST',situation:'A',privileges:'HR'});
    await V.create({userId:String(actor),form:'Ergazomenoi',privileges:{create:true,read:true,update:true}});
    await C.collection.insertOne({_id:company,team:'TEST',kod:'TEST',eponymia:'ΑΣΦΑΛΗΣ ΔΟΚΙΜΗ',users:[actor]});
    const app=browserApp({session:{userId:String(actor),userTeam:'TEST',companyInUse:String(company),yearInUse:2026}});
    const server=await new Promise((resolve,reject)=>{const s=app.listen(5001,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const capture=async name=>{if(process.env.PAYROLL_VISUAL_ARTIFACT_DIR){fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,name+'.png')});}};
    await page.goto(origin+'/ergazomenoi/ergazomenoi/add');await complete(page,'2026-10-02');
    assert.ok(await page.locator('[data-save-mode="temporary"]:visible').count());await capture('draft-add-desktop');
    const d=await temporary(page);const scope={team:'TEST',company_kod:String(company),kodikos:d.data.kodikos};
    assert.equal(await H.countDocuments(scope),0);assert.equal(await P.countDocuments(scope),0);
    const denied=await context.request.post(origin+'/test/operational',{data:{employeeId:d.data._id}});
    assert.equal(denied.status(),409);assert.equal((await denied.json()).reason,'EMPLOYEE_SAVE_DRAFT_REQUIRED');
    assert.equal(await page.locator('#hmeromhnia_proslhpshs').evaluate(e=>e.readOnly),false);
    await page.locator('#hmeromhnia_proslhpshs').fill('2026-10-04');
    await page.locator('#hmeromhnia_proslhpshs').press('Tab');
    await page.waitForFunction(()=>document.querySelector('[name="hmeromhnia_isxyos_oron_ergasias_apo"]').value==='2026-10-04');
    await complete(page,'2026-10-04');await temporary(page);await page.reload();
    assert.equal(await page.locator('#hmeromhnia_proslhpshs').inputValue(),'2026-10-04');
    await U.collection.updateOne({_id:actor},{$set:{privileges:'U'}});
    await page.reload();await temporary(page);assert.equal(await H.countDocuments(scope),0);
    for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000});
        const indicator=page.locator('.employee-draft-indicator');await indicator.scrollIntoViewIfNeeded();
        assert.equal(await indicator.innerText(),'Προσωρινά Αποθηκευμένος');
        const box=await indicator.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {left:r.left,right:r.right,color:s.color,weight:s.fontWeight,width:e.clientWidth,scroll:e.scrollWidth};});
        assert.equal(box.color,'rgb(176, 42, 55)');assert.equal(box.weight,'700');assert.ok(box.scroll<=box.width+1,JSON.stringify(box));
        assert.ok(box.left>=0&&box.right<=width+1,JSON.stringify(box));await capture('draft-maintenance-'+width);
        await page.mouse.move(0,0);await page.waitForTimeout(200);
        const button=page.locator('[data-save-mode="temporary"]:visible').first();const style=await button.evaluate(e=>{const s=getComputedStyle(e);return {whiteSpace:s.whiteSpace,radius:s.borderRadius,align:s.alignItems,bg:s.backgroundColor};});
        assert.equal(style.whiteSpace,'nowrap');assert.equal(style.align,'center');assert.equal(style.radius,'6px');assert.equal(style.bg,'rgb(251, 236, 193)');
    }
    await page.setViewportSize({width:1440,height:1000});await complete(page,'2026-10-04');
    await page.locator('[data-save-mode="final"]:visible').first().click();
    await page.locator('.swal2-popup').waitFor();await capture('draft-final-confirmation');
    if (/Ελλιπές Εβδομαδιαίο Ωράριο/.test(await page.locator('.swal2-popup').innerText())) {
        await page.locator('.swal2-confirm').click();
        await page.waitForTimeout(200);
    }
    const text=await page.locator('.swal2-popup').innerText();
    assert.match(text,/ΕΝΗΜΕΡΩΣΗ ΕΡΓΑΝΗ|Ενημέρωση ΕΡΓΑΝΗ/);
    await page.locator('.swal2-popup input[type="checkbox"]').evaluateAll(inputs=>inputs.forEach(input=>{input.checked=false;}));
    const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/ergazomenoi/update/'));
    await page.locator('.swal2-confirm').click();const result=await(await response).json();assert.equal(result.success,true,JSON.stringify(result));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.employee-draft-indicator').count(),0);
    assert.equal(await page.locator('[data-save-mode="temporary"]').count(),0);
    assert.equal(await page.locator('#hmeromhnia_proslhpshs').evaluate(e=>e.readOnly),true);
    const saved=await E.findById(d.data._id).lean();assert.equal(saved.oristikh_enhmerosh,true);
    const history=await H.find(scope).lean();assert.equal(history.length,1);assert.equal(history[0].afora_proslhpsh,true);assert.equal(history[0].hmeromhnia_proslhpshs.toISOString().slice(0,10),'2026-10-04');
    await page.goto(origin+d.redirectUrl);
    assert.equal(await page.locator('[data-save-mode="temporary"]').count(),0);
    assert.equal(await page.locator('#hmeromhnia_proslhpshs').evaluate(e=>e.readOnly),true);
    await page.locator('[data-bs-target="#panelsStayOpen-collapseTwo"]').click();
    await page.locator('#hmeromhnia_proslhpshs').scrollIntoViewIfNeeded();
    await capture('draft-finalized-desktop');assert.deepEqual(errors,[]);
});
