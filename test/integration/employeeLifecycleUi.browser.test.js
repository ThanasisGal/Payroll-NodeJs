'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const {loadForm,settleLayout} = require('../helpers/responsiveFormsBrowser');
const root = path.resolve(__dirname,'../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
test('real EJS lifecycle controls, all termination combinations and independent save locks', {timeout:60000}, async t => {
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());
 await loadForm(page,'views/ergazomenoi/ergazomenoi/edit.ejs',{vendor});
 await page.addScriptTag({path:path.join(root,'node_modules/sweetalert2/dist/sweetalert2.all.js')});
 // Synthetic initial state, before the actual handlers initialize.
 await page.evaluate(()=>{
  document.getElementById('hmeromhnia_apoxorhshs').value='';
  document.getElementById('hmeromhnia_lhxhs_symbashs').value='';
  document.getElementById('energos').checked=true;
  window.EmployeeFormReadiness={FORM_READY:true,FORM_VISIBLE:true};
 });
 for(const file of ['employeeAddPresentation','clearableInputs','logos_peratoshs'])
  await page.addScriptTag({path:path.join(root,`public/js/ergazomenoi/genika/${file}.js`)});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 for(const [width,height] of [[1280,900],[1366,900],[1600,900],[1920,900],[1280,720]]) {
  await page.setViewportSize({width,height});await settleLayout(page);
  assert.equal(await page.locator('#sidebarMenu').isVisible(),true);
  await page.evaluate(()=>{
   const input=document.getElementById('hmeromhnia_apoxorhshs');
   input.value='2026-10-23';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#energos').isDisabled(),true);
  assert.equal(await page.locator('#energos').isChecked(),false);
  assert.equal(await page.locator('#logos_peratoshs_section').evaluate(e=>e.style.display!=='none'),true);
  for(const [reason,notes] of [['',''],['1',''],['','Συνθετική'],['1','Συνθετική']]) {
   await page.evaluate(({reason,notes})=>{
    const select=document.getElementById('logos_peratoshs');
    select.tomselect.addOption({value:'1',label:'Συνθετική αιτία'});
    select.tomselect.setValue(reason);
    const input=document.getElementById('parathrhseis_peratoshs');input.value=notes;
    input.dispatchEvent(new Event('input',{bubbles:true}));
   },{reason,notes});
   assert.equal(await page.locator('.submitButton').first().isDisabled(),!(reason&&notes));
  }
  await page.locator('#parathrhseis_peratoshs').locator('..').locator('.clear-btn').evaluate(e=>e.click());
  assert.equal(await page.locator('.submitButton').first().isDisabled(),true);
  await page.locator('#parathrhseis_peratoshs').evaluate(e=>{e.value='Συνθετική';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>{document.querySelector('.submitButton').disabled=true;});
  await page.locator('#parathrhseis_peratoshs').evaluate(e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#parathrhseis_peratoshs').evaluate(e=>{e.value='Συνθετική';e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('.submitButton').first().isDisabled(),true);
  await page.evaluate(()=>{document.querySelector('.submitButton').disabled=false;});
  assert.equal(await page.locator('.submitButton').first().isEnabled(),true);
  // Actual clear button emits input; keep the accordion as rendered, click in DOM.
  await page.locator('#hmeromhnia_apoxorhshs').locator('..').locator('.clear-btn').evaluate(e=>e.click());
  assert.equal(await page.locator('#hmeromhnia_apoxorhshs').inputValue(),'');
  assert.equal(await page.locator('#energos').isEnabled(),true);
  assert.equal(await page.locator('#energos').isChecked(),false);
  await page.locator('#energos').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await page.locator('#label-energos').textContent(),'ΕΝΕΡΓΟΣ');
  // Keyboard deletion on the real date control after opening its accordion.
  await page.locator('#hmeromhnia_apoxorhshs').evaluate(e=>{e.closest('.accordion-collapse')?.classList.add('show');e.value='2026-10-23';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#hmeromhnia_apoxorhshs').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Backspace');
  assert.equal(await page.locator('#hmeromhnia_apoxorhshs').inputValue(),'');
  assert.equal(await page.locator('#energos').isEnabled(),true);
  assert.equal(await page.locator('#energos').isChecked(),false);
  console.log('LIFECYCLE_UI',width,height,'passed');
 }
 await page.evaluate(()=>{const e=document.getElementById('hmeromhnia_apoxorhshs');e.value='2026-10-23';e.dispatchEvent(new Event('input',{bubbles:true}));window.__validation=window.validateEmployeeTermination();});
 await page.locator('.swal2-confirm').click();
 assert.equal(await page.evaluate(()=>window.__validation),false);
 assert.deepEqual(errors,[]);
});
