'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.join(__dirname,'../../public/js/ergazomenoi/genika/putFieldValues.historyGuidance.browser.test.js');
const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
const source=fs.readFileSync(filename,'utf8');m._compile(source.slice(0,source.indexOf('for (const [label, options]'))+'\nmodule.exports={withPage,save};',filename);
const {withPage,save}=m.exports;
test('legacy Save shows one inline result, retains entered values and does not start dependent actions',async()=>{
 await withPage({payload:{success:true,employeeUpdated:true,historyUpdated:false,ambiguousHistoryPreserved:true,historyAccessMode:'READ_ONLY',historyStatus:'LEGACY_REVIEW_REQUIRED',data:{_id:'synthetic-employee'}}},async({page,requests})=>{
  await save(page);await page.locator('#employeeLegacyHistorySaveStatus').waitFor();await page.waitForFunction(()=>window.saveFinished);
  assert.equal(requests.length,1);assert.equal(await page.locator('#email').inputValue(),'entered@example.test');
  assert.match(await page.locator('#employeeLegacyHistorySaveStatus').innerText(),/Ιστορικό.*δεν άλλαξε/);
  assert.equal(await page.locator('.employee-ambiguous-history-notice').count(),0);
 });
});
test('rejected strict final Save retains the entered form',async()=>{
 await withPage({status:409,payload:{success:false,reason:'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN',message:'Η περίοδος 01/04–30/04 δεν έχει ΚΠΚ. Δεν αποθηκεύτηκε καμία αλλαγή. 1. Συμπληρώστε ΚΠΚ. 2. Ελέγξτε την περίοδο. Κωδικός αναφοράς: EMPLOYEE_SAVE_HISTORY_NOT_CLEAN.'}},async({page,requests})=>{
  await save(page);await page.waitForFunction(()=>window.saveFinished);assert.equal(requests.length,1);
  assert.equal(await page.locator('#email').inputValue(),'entered@example.test');
 });
});
