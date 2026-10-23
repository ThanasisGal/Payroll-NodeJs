'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const filename=path.join(__dirname,'putFieldValues.historyGuidance.browser.test.js');
const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);
const source=fs.readFileSync(filename,'utf8');
m._compile(source.slice(0,source.indexOf('for (const [label, options]'))+'\nmodule.exports={withPage,save};',filename);
const {withPage,save}=m.exports;
const payload={success:true,employeeUpdated:true,historyUpdated:false,ambiguousHistoryPreserved:true,
 data:{_id:'synthetic-employee'},maXmlData:{success:true,relativePath:'synthetic.xml',processCode:'217'}};
for(const [choice,method,fail] of [['close','xml',false],['escape','rest',false],['cancel','xml',false],
 ['continue','none',false],['continue','xml',false],['continue','rest',false],['continue','rest',true]]) {
 test(`saved ambiguous history: ${choice}/${method}/failure=${fail}`,{timeout:20000},async()=>{
  await withPage({payload:{...payload,maXmlData:method==='xml'?payload.maXmlData:null},departure:'2026-10-23'},async({page,requests})=>{
   await page.evaluate(({method,fail})=>{
    window.__uploads=[];
    window.uploadMaToErganh=async(...args)=>{
     window.__uploads.push(args);
     if(fail)throw Error('synthetic uncertain submission failure');
     return {success:true};
    };
    window.showGenericRestProgressSwal=()=>{};
    window.presentErganiRestSubmissionResult=async()=>{};
    const fire=Swal.fire;
    Swal.fire=async options=>{
     const result=await fire(options);
     if(result.isConfirmed&&options.preConfirm) return {...result,value:{...result.value,
      ma_217:method!=='none',ma_222:false,ma_220:false,ma_221:false,
      e3_anaggelia_proslhpshs:false,wto_pshfiakh_organosh_xronoy_ergasias:false,
      isPermanent:method==='rest',erganiUploadMethod:method==='rest'?'rest':'xml',create_contract:false}};
     return result;
    };
   },{method,fail});
   if(choice==='cancel') {
    await page.locator('#save').click();await page.locator('.swal2-cancel').click();
    await page.waitForFunction(()=>window.saveFinished);
    assert.equal(requests.length,0);return;
   }
   await save(page);
   await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Η αποθήκευση ολοκληρώθηκε');
   assert.equal(requests.length,1);
   if(choice==='close')await page.locator('.swal2-confirm').click();
   else if(choice==='escape')await page.keyboard.press('Escape');
   else {
    await page.locator('.swal2-deny').click();
    // A duplicate click while the continuation is pending must not save again.
    await page.evaluate(()=>document.getElementById('save').click());
    if(method==='xml') {
     await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Επιτυχής καταχώριση!');
     await page.locator('.swal2-confirm').filter({hasText:'Εντάξει'}).click();
     await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Επιτυχής προσωρινή καταχώριση XML');
     await page.locator('.swal2-confirm').filter({hasText:'Εντάξει'}).click();
    }
   }
   if(choice==='close')await page.waitForURL('**/ergazomenoi/ergazomenoi');
   else await page.waitForFunction(()=>window.saveFinished);
   assert.equal(requests.length,1);
   const uploads=await page.evaluate(()=>window.__uploads||[]);
   assert.equal(uploads.length,choice==='continue'&&method!=='none'?1:0);
   if(uploads.length)assert.equal(uploads[0][4],method);
   if(fail)assert.equal(await page.evaluate(()=>window.guidedCounts.redirect),0);
  });
 });
}
