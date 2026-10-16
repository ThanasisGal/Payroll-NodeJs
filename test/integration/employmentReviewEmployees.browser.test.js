'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { fixture, browserApp } = require('../helpers/employmentReviewEmployeesApp');
const uri = process.env.PAYROLL_PERIOD_EMPLOYEES_TEST_MONGO_URI;
const vendorDir = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('real Chromium, real selection HTTP handler and isolated MongoDB', { skip: !uri || !vendorDir, timeout: 90000 }, async t => {
    for (const file of ['tom-select.complete.js','tom-select.css']) assert.ok(fs.existsSync(path.join(vendorDir,file)));
    const data = await fixture(uri);
    t.after(() => mongoose.disconnect());
    let releaseOld, markOld;
    let oldRequestStarted = new Promise(resolve => { markOld = resolve; });
    let delayOld = false;
    const server = browserApp({ ...data, vendorDir, beforeSelection: async (req,_res,next) => {
        if (delayOld && req.query.search === '0001') {
            delayOld = false;
            await new Promise(resolve => { releaseOld = resolve; markOld(); });
        }
        next();
    } }).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    t.after(()=>{ releaseOld?.(); return new Promise(resolve=>server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless:true });
    t.after(()=>browser.close());
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*', route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.setDefaultTimeout(10000);
    const capture = async name => {
        const dir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (dir) { fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true}); }
    };
    await page.goto(origin+'/review');
    await page.waitForFunction(()=>Boolean(document.getElementById('ypokatasthma').tomselect));
    await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    assert.equal(await page.locator('#ypokatasthma_stathera_advanced').inputValue(),'0000');
    async function openBranch() {
        const reset = page.locator('#ypokatasthma + .ts-wrapper .ts-single-reset-btn');
        if (await reset.isVisible()) await reset.click();
        await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    }
    const employeeControl = () => page.locator('#reviewEmployee + .ts-wrapper .ts-control');
    const employeeInput = () => page.locator('#reviewEmployee + .ts-wrapper .dropdown-input');
    const option = code => page.locator(`#reviewEmployee + .ts-wrapper .option[data-value="${code}"]`);
    async function openEmployee() {
        const reset = page.locator('#reviewEmployee + .ts-wrapper .ts-single-reset-btn');
        if (await reset.isVisible()) await reset.click();
        await employeeControl().click();
    }
    async function search(code) {
        await openEmployee();
        const response = page.waitForResponse(r=>r.url().includes('/review/employees?')&&new URL(r.url()).searchParams.get('search')===code);
        await employeeInput().fill(code);
        await response;
    }
    await search('0001');
    await option('0001').waitFor();
    await capture('period-employee-september-1440');
    await option('0001').click();
    assert.equal(await page.locator('#kodikos').inputValue(),'0001');
    assert.match(await employeeControl().innerText(),/0001.*ΣΥΝΘΕΤΙΚΟΣ/);

    await page.locator('#apo_hmeromhnia').fill('2026-11-01');
    await page.locator('#eos_hmeromhnia').fill('2026-11-30');
    assert.equal(await page.locator('#kodikos').inputValue(),'');
    await search('0001');
    await page.waitForFunction(()=>!document.getElementById('reviewEmployee').tomselect.options['0001']);
    assert.equal(await option('0001').count(),0);
    await page.locator('#apo_hmeromhnia').fill('2026-09-01');
    await page.locator('#eos_hmeromhnia').fill('2026-09-30');
    await search('0001');await option('0001').click();
    assert.equal(await page.locator('#kodikos').inputValue(),'0001');
    await openBranch();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0001"]').click();
    assert.equal(await page.locator('#kodikos').inputValue(),'');
    await search('0001');
    assert.equal(await option('0001').count(),0);
    await search('0007');await option('0007').click();
    assert.equal(await page.locator('#kodikos').inputValue(),'0007');

    // Force an already-sent request to finish even after cancellation. This is a
    // real HTTP response from the handler/DB, with controlled network ordering.
    await page.evaluate(()=>{
        const originalFetch=window.fetch;
        window.fetch=(input,options={})=>originalFetch(input,String(input).includes('/review/employees?')?{...options,signal:undefined}:options);
    });
    await openBranch();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    delayOld = true;
    await openEmployee();await employeeInput().fill('0001');
    await oldRequestStarted;
    await page.locator('#apo_hmeromhnia').fill('2026-11-01');
    await page.locator('#eos_hmeromhnia').fill('2026-11-30');
    await search('0001');
    const oldResponse = page.waitForResponse(r=>r.url().includes('/review/employees?')&&new URL(r.url()).searchParams.get('apo_hmeromhnia')==='2026-09-01');
    releaseOld();await oldResponse;
    await page.waitForTimeout(150);
    assert.equal(await option('0001').count(),0,'old period cannot replace new period results');
    assert.equal(await page.locator('#kodikos').inputValue(),'');

    await page.locator('#apo_hmeromhnia').fill('2026-09-01');
    await page.locator('#eos_hmeromhnia').fill('2026-09-30');
    await search('0001');await option('0001').click();
    // Same-instance search race: later search response must remain authoritative.
    oldRequestStarted = new Promise(resolve=>{markOld=resolve;});
    delayOld = true;
    await openEmployee();await employeeInput().fill('0001');
    // TomSelect caches loaded queries; clear its request cache to exercise transport.
    await page.evaluate(()=>{const tom=document.getElementById('reviewEmployee').tomselect;tom.loadedSearches={};tom._lastLoadTime=0;tom.load('0001');});
    await oldRequestStarted;
    await page.waitForTimeout(170);
    await employeeInput().fill('0009');
    await option('0009').waitFor();
    const stale = page.waitForResponse(r=>r.url().includes('/review/employees?')&&new URL(r.url()).searchParams.get('search')==='0001');
    releaseOld();await stale;await page.waitForTimeout(150);
    assert.ok(await option('0009').count());

    await page.locator('#eos_hmeromhnia').fill('2026-09-29');
    await page.locator('#eos_hmeromhnia').fill('2026-09-30');
    await search('0001');await option('0001').waitFor();
    for (const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        await openEmployee();
        await capture('period-employee-dropdown-'+width);
        const layout = await page.evaluate(()=>({ width:innerWidth, scroll:document.documentElement.scrollWidth,
            dropdown:(()=>{const r=document.querySelector('#reviewEmployee + .ts-wrapper .ts-dropdown').getBoundingClientRect();return {left:r.left,right:r.right};})() }));
        assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
        assert.ok(layout.dropdown.left>=-1&&layout.dropdown.right<=width+1,JSON.stringify(layout));
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-workflow-stage]').count(),4);
        for (const stage of [1,2,3,4]) {
            const header=page.locator(`#employmentReviewStage${stage}Heading button`);
            await header.click();
            await page.locator(`#employmentReviewStage${stage}Collapse.show`).waitFor();
        }
        await capture('period-employee-stages-'+width);
    }
    assert.deepEqual(errors,[]);
});
