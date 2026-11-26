'use strict';
// Real Chromium/Swal presentation with synthetic in-memory rows only.
// No application server, database, persistence or submission endpoints.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { root, locals } = require('../fixtures/responsiveForms');
const source = fs.readFileSync(path.join(root, 'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const between = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
};
const fn = name => {
    const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
    assert.ok(match, name);
    const rest = source.slice(match.index), next = rest.slice(1).search(/\n(?:async )?function /);
    return next < 0 ? rest : rest.slice(0, next + 1);
};
const strip = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const fieldId = '#weeklyHrBulkLeaveCategory', menuId = '#weekly-hr-bulk-leave-options';
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],
    [1280,800],[1280,720],[900,600],[390,700]];
const artifactDir = process.env.PAYROLL_BULK_LEAVE_TEST_ARTIFACT_DIR;

async function mount(page) {
    const [review, sidebar] = await Promise.all([
        ejs.renderFile(path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), locals),
        ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), locals)
    ]);
    await page.setContent(`<!doctype html><html lang="el"><meta name="viewport" content="width=device-width,initial-scale=1"><body>
        <div class="container-fluid"><div class="row">${strip(sidebar)}<main class="col-md-9 ms-sm-auto col-lg-10 px-md-4">${strip(review)}
        <button id="synthetic-bulk-trigger" type="button">Μαζικός χαρακτηρισμός</button></main></div></div></body></html>`);
    for (const file of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css',
        'public/css/main.css', 'public/css/ergazomenoi/employmentReviewDayLeaveDropdown.css'])
        await page.addStyleTag({ path: path.join(root, file) });
    await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
    const asset = review.match(/<script src="([^"]*employeeHistoryProposalDropdowns[^"]*)"/)[1];
    assert.equal(asset, '/static/js/ergazomenoi/genika/employeeHistoryProposalDropdowns.js');
    await page.addScriptTag({ path: path.join(root, 'public', asset.slice('/static/'.length)) });
    await page.addScriptTag({ content: `
        const weeklyHrStage1DaySelected=new Set(), weeklyHrStage1DayDrafts=new Map();
        const weeklyHrStage1RowsById=new Map(), weeklyHrStage1Payloads=new Map();
        let weeklyHrLeaveCategories=[],weeklyHrStage1BulkLeaveDropdown=null;
        const csrfToken='synthetic',stage1DateKey=value=>String(value).slice(0,10);
        const isEmploymentReviewDateOwned=()=>true,stage1RelevantDates=p=>p.rows.map(r=>r.hmeromhnia);
        const stage1ClassificationForRow=row=>row.classification;
        const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        window.categoryReads=[];window.changeEvents=[];window.inputEvents=[];window.renders=0;
        const rerenderWeeklyHrStage1Rows=()=>window.renders++;
        window.fetch=async(url,options={})=>{
            if(url!='/api/dropdown/ergazomenoi/kathgoria_adeias'||options.method&&options.method!=='GET')throw Error('Unexpected endpoint');
            window.categoryReads.push(url);
            return {json:async()=>({items:[...Array.from({length:18},(_,n)=>({value:String(n+1).padStart(4,'0'),
                label:String(n+1).padStart(4,'0')+' - '+(n===2?'Μεγάλη συνθετική περιγραφή άδειας με αναδίπλωση '.repeat(5)+'ΜΑΚΡΟΣΚΕΛΗΣ'.repeat(12):'Συνθετική άδεια '+(n+1))})),
                {value:'POSSIBLE_LEAVE',label:'ΠΙΘΑΝΗ ΑΔΕΙΑ'}]})};
        };
        ${between('const employmentReviewSwalCommonClasses', '\nfunction mergeEmploymentReviewSwalClasses')}
        ${fn('mergeEmploymentReviewSwalClasses')}
        ${fn('employmentReviewSwal')}
        ${fn('isHrSelectableLeaveCategoryOption')}
        ${fn('stage1LeaveCategoryOptions')}
        ${fn('formatStage1LeaveCategoryLabel')}
        ${fn('loadWeeklyHrLeaveCategories')}
        ${fn('setStage1DayDraft')}
        ${fn('classifySelectedStage1Days')}
        const rows=[{_id:'synthetic-1',hmeromhnia:'2026-11-02',classification:'ABSENCE'},
            {_id:'synthetic-2',hmeromhnia:'2026-11-03',classification:'ABSENCE'},
            {_id:'synthetic-unselected',hmeromhnia:'2026-11-04',classification:'ABSENCE'}];
        for(const row of rows)weeklyHrStage1RowsById.set(row._id,row);
        weeklyHrStage1Payloads.set('synthetic',{rows});
        window.startBulk=(classification='LEAVE')=>{
            weeklyHrStage1DaySelected.clear();weeklyHrStage1DaySelected.add('synthetic-1');weeklyHrStage1DaySelected.add('synthetic-2');
            window.pending=classifySelectedStage1Days(classification);
        };
        window.state=()=>({drafts:[...weeklyHrStage1DayDrafts],selected:[...weeklyHrStage1DaySelected],renders:window.renders});
        document.getElementById('synthetic-bulk-trigger').addEventListener('click',()=>startBulk());
        document.addEventListener('change',event=>{if(event.target.id==='weeklyHrBulkLeaveCategory')window.changeEvents.push(event.target.value);});
        document.addEventListener('input',event=>{if(event.target.id==='weeklyHrBulkLeaveCategory')window.inputEvents.push(event.target.value);});
        window.ready=loadWeeklyHrLeaveCategories();
    ` });
    await page.evaluate(() => window.ready);
}
async function open(page, classification) {
    if (await page.locator('.swal2-container').count()) {
        await page.evaluate(()=>Swal.close());await settle(page);
    }
    if (classification) await page.evaluate(value => window.startBulk(value), classification);
    else await page.locator('#synthetic-bulk-trigger').click();
    await page.waitForFunction(() => document.getElementById('weeklyHrBulkLeaveCategory')?.getAttribute('aria-controls') === 'weekly-hr-bulk-leave-options');
    await page.locator('.swal2-popup').waitFor({ state: 'visible' });
}
async function settle(page) {
    await page.evaluate(() => window.pending);
    await page.locator('.swal2-container').waitFor({ state: 'detached' });
}
async function measure(page) {
    return page.locator(menuId).evaluate(menu => {
        const box=menu.getBoundingClientRect(),field=document.getElementById('weeklyHrBulkLeaveCategory').getBoundingClientRect();
        const popup=document.querySelector('.swal2-popup').getBoundingClientRect(),items=[...menu.children];
        return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,direction:menu.dataset.direction,
            expectedDirection:innerHeight-field.bottom-8>=Math.min(menu.scrollHeight+2,Number(menu.dataset.rowHeight)*8+2)
                ||innerHeight-field.bottom-8>=field.top-8?'down':'up',
            visible:items.filter(item=>{const r=item.getBoundingClientRect();return r.bottom>box.top+1&&r.top<box.bottom-1;}).length,
            overflow:menu.scrollHeight>menu.clientHeight,horizontal:menu.scrollWidth>menu.clientWidth,
            wraps:items[3].getBoundingClientRect().height>Number(menu.dataset.rowHeight),textFits:items.every(i=>i.scrollWidth<=i.clientWidth),
            foreground:menu.contains(document.elementFromPoint(box.x+20,box.y+Math.min(20,box.height/2))),
            outsidePopup:box.bottom>popup.bottom||box.top<popup.top,popover:menu.matches(':popover-open')};
    });
}

test('Chromium: bulk day characterization uses the existing bounded leave dropdown', {timeout:90000}, async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',route=>route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
    await mount(page);if(artifactDir)fs.mkdirSync(artifactDir,{recursive:true});
    await open(page);
    const field=page.locator(fieldId),menu=page.locator(menuId);
    const run=(name,body)=>!process.env.PAYROLL_BULK_LEAVE_TEST_FILTER||new RegExp(process.env.PAYROLL_BULK_LEAVE_TEST_FILTER).test(name)
        ?t.test(name,body):Promise.resolve();
    const baseline=await field.evaluate(n=>[...n.options].map(o=>({value:o.value,text:o.textContent})));
    assert.equal(baseline.length,19);assert.equal(baseline[0].text,'Επιλέξτε κατηγορία');assert.equal(await field.inputValue(),'');
    assert.deepEqual(baseline.slice(1).map(o=>o.value),Array.from({length:18},(_,n)=>String(n+1).padStart(4,'0')));
    assert.equal(await page.locator('.proposal-dropdown').count(),1);
    assert.equal(await page.locator('#weekly-hr-day-leave-options, #proposal-dropdown-options').count(),0);
    for(const [width,height] of sizes)for(const sidebar of [false,true])await run(`${width}x${height}, sidebar ${sidebar?'open':'closed'}`,async()=>{
        await page.setViewportSize({width,height});
        await page.evaluate(value=>{
            document.getElementById('sidebarMenu').classList.toggle('d-none',!value);
            const main=document.querySelector('main');main.style.width=value?'':'100%';main.style.marginLeft=value?'':'0';
        },sidebar);
        await field.click();const m=await measure(page);
        assert.ok(m.x>=7&&m.y>=7&&m.right<=width-7&&m.bottom<=height-7,JSON.stringify(m));
        assert.ok(m.visible<=8&&m.overflow&&!m.horizontal&&m.wraps&&m.textFits&&m.foreground&&m.popover,JSON.stringify(m));
        assert.equal(m.direction,m.expectedDirection,JSON.stringify(m));
        for(const button of ['.swal2-confirm','.swal2-cancel']){
            const r=await page.locator(button).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);
        }
        if(artifactDir&&sidebar&&(width===1920||(width===1280&&height===720)||width===390))
            await page.screenshot({path:path.join(artifactDir,`bulk-leave-${width}x${height}.png`)});
        await field.press('Escape');assert.equal(await menu.isVisible(),false);assert.equal(await field.isVisible(),true);
        assert.equal(await field.evaluate(n=>document.activeElement===n),true);
    });
    await run('opens above/below, escapes Swal clipping, scrolls and closes outside',async()=>{
        await page.setViewportSize({width:900,height:1080});
        for(const [align,direction] of [['start','down'],['end','up']]){
            await page.locator('.swal2-popup').evaluate((n,value)=>n.style.alignSelf=value,align);
            await field.click();const m=await measure(page);assert.equal(m.direction,direction);assert.ok(m.outsidePopup&&m.foreground);
            await field.press('Escape');
        }
        await page.locator('.swal2-html-container').evaluate(n=>n.style.setProperty('overflow','hidden','important'));
        await field.click();assert.equal((await measure(page)).foreground,true);
        await menu.hover();await page.mouse.wheel(0,250);
        await page.waitForFunction(()=>document.getElementById('weekly-hr-bulk-leave-options').scrollTop>0);
        await page.locator('.swal2-popup').click({position:{x:2,y:2}});assert.equal(await menu.isVisible(),false);
        await page.locator('.swal2-popup').evaluate(n=>n.style.removeProperty('align-self'));
        await page.locator('.swal2-html-container').evaluate(n=>n.style.removeProperty('overflow'));
    });
    await run('keyboard, one input/change, wrapped selected label, focus and unchanged options',async()=>{
        await page.setViewportSize({width:390,height:700});
        await field.press('ArrowDown');await field.press('Home');
        for(let n=0;n<3;n++)await field.press('ArrowDown');await field.press('Enter');
        assert.equal(await field.inputValue(),'0003');assert.equal(await menu.isVisible(),false);
        assert.equal(await field.evaluate(n=>document.activeElement===n),true);
        assert.deepEqual(await page.evaluate(()=>window.changeEvents),['0003']);assert.deepEqual(await page.evaluate(()=>window.inputEvents),['0003']);
        assert.equal(await field.evaluate(n=>n.parentElement.querySelector('.proposal-dropdown-label').textContent),baseline[3].text);
        assert.equal(await field.evaluate(n=>n.parentElement.scrollWidth<=n.parentElement.clientWidth),true);
        assert.deepEqual(await field.evaluate(n=>[...n.options].map(o=>({value:o.value,text:o.textContent}))),baseline);
        if(artifactDir)await page.screenshot({path:path.join(artifactDir,'bulk-leave-wrapped-selection.png')});
        await field.press('End');await field.press('Enter');assert.equal(await field.inputValue(),'0018');
        await field.press('ArrowUp');await field.press('Home');await field.press('0');await field.press('0');await field.press('0');await field.press('2');
        await field.press('Enter');assert.equal(await field.inputValue(),'0002');
        await field.press('Space');await field.press('Tab');assert.equal(await menu.isVisible(),false);
        assert.equal(await page.evaluate(()=>document.querySelector('.swal2-popup').contains(document.activeElement)),true);
        await page.keyboard.press('Shift+Tab');assert.equal(await field.evaluate(n=>document.activeElement===n),true);
        assert.equal(await page.locator('.swal2-confirm').innerText(),'Εφαρμογή');assert.equal(await page.locator('.swal2-cancel').innerText(),'Ακύρωση');
        await page.locator('.swal2-confirm').click();await settle(page);
        assert.deepEqual(await page.evaluate(()=>window.state()),{drafts:['synthetic-1','synthetic-2'].map(id=>[id,
            {classification:'LEAVE',kathgoria_adeias_apologistika:'0002'}]),selected:[],renders:1});
        assert.equal(await menu.isVisible(),false);
    });
    await run('reopen default, empty confirmation, cancellation and two-stage Escape',async()=>{
        await open(page);assert.equal(await field.inputValue(),'');assert.equal(await menu.count(),1);
        await field.click();assert.equal(await page.getByRole('listbox').count(),1);await field.press('Escape');
        const before=await page.evaluate(()=>window.state());
        await page.locator('.swal2-confirm').click();assert.equal(await field.isVisible(),true);
        await field.click();await field.press('Escape');assert.equal(await field.isVisible(),true);
        await field.press('Escape');await settle(page);assert.deepEqual(await page.evaluate(()=>window.state()),before);
        await open(page);await field.click();await field.press('Tab');await page.locator('.swal2-cancel').click();await settle(page);
        assert.deepEqual(await page.evaluate(()=>window.state()),before);assert.equal(await menu.isVisible(),false);
        await page.waitForFunction(()=>document.activeElement.id==='synthetic-bulk-trigger');
    });
    await run('pointer selection, sickness mapping, programmatic close and replacement leave no orphan',async()=>{
        await page.setViewportSize({width:1440,height:900});await open(page,'SICKNESS');
        await field.click();await menu.locator('[data-value="0004"]').click();assert.equal(await field.inputValue(),'0004');
        await page.locator('.swal2-confirm').click();await settle(page);
        assert.deepEqual((await page.evaluate(()=>window.state())).drafts,['synthetic-1','synthetic-2'].map(id=>[id,
            {classification:'SICKNESS',kathgoria_adeias_apologistika:'0004'}]));
        await open(page);await field.click();await page.evaluate(()=>Swal.close());await settle(page);assert.equal(await menu.isVisible(),false);
        await open(page);await field.click();await page.evaluate(()=>{Swal.fire({title:'Συνθετικό επόμενο παράθυρο'});});
        assert.equal(await menu.isVisible(),false);await page.evaluate(()=>Swal.close());
        await page.locator('.swal2-container').waitFor({state:'detached'});
        await open(page);assert.equal(await menu.count(),1);assert.equal(await page.locator('.proposal-dropdown').count(),1);
        await page.locator('.swal2-cancel').click();await settle(page);
    });
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.categoryReads),['/api/dropdown/ergazomenoi/kathgoria_adeias']);
});
