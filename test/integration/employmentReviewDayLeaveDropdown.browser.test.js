'use strict';
// Presentation-only Chromium checks. Real rendering/events, synthetic categories
// in memory, no application server, MongoDB, save or submission endpoints.
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
    const from = source.indexOf(`function ${name}(`);
    assert.ok(from >= 0, name);
    const rest = source.slice(from);
    const next = rest.slice(1).search(/\n(?:async )?function /);
    return next < 0 ? rest : rest.slice(0, next + 1);
};
const strip = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');
const selectId = '#weeklyHrStage1DrawerLeaveCategory', menuId = '#weekly-hr-day-leave-options';
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],
    [1280,800],[1280,720],[900,600],[390,700]];

async function mount(page) {
    const [review, sidebar] = await Promise.all([
        ejs.renderFile(path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), locals),
        ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), locals)
    ]);
    await page.setContent(`<!doctype html><html lang="el"><meta name="viewport" content="width=device-width,initial-scale=1"><body>
        <div class="container-fluid"><div class="row">${strip(sidebar)}<main class="col-md-9 ms-sm-auto col-lg-10 px-md-4">${strip(review)}</main></div></div></body></html>`);
    for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css',
        'public/css/ergazomenoi/employmentReviewDayLeaveDropdown.css'])
        await page.addStyleTag({ path: path.join(root, file) });
    await page.addScriptTag({ path: path.join(root, 'public/js/bootstrap.bundle.min.js') });
    await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/employeeHistoryProposalDropdowns.js') });
    await page.addScriptTag({ content: `
        const weeklyHrStage1RowsById=new Map(), weeklyHrStage1Payloads=new Map(), weeklyHrStage1DayDrafts=new Map();
        let weeklyHrStage1EditorRowId=null,weeklyHrLeaveCategories=[];
        const csrfToken='synthetic', stage1DateKey=value=>String(value).slice(0,10), formatStage1DateKey=value=>String(value);
        const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const stage1ClassificationForRow=row=>row.classification||'UNCLASSIFIED';
        const stage1ClassificationLabel=value=>({LEAVE:'Άδεια',SICKNESS:'Ασθένεια',ABSENCE:'Απουσία',UNCLASSIFIED:'Χωρίς χαρακτηρισμό'}[value]);
        const isEmploymentReviewDateOwned=()=>true,stage1RelevantDates=p=>p.rows.map(r=>r.hmeromhnia);
        const stage1PayloadsForDisplay=()=>[...weeklyHrStage1Payloads.values()];
        const stage1ApplyDisplayFilters=rows=>rows.map(payload=>({payload})),compareWeeklyHrStage1Payloads=()=>0;
        const renderStage1DayFacts=()=>'<div class="weekly-hr-stage1-day-facts">Συνθετική παρουσία · 08:00–16:00</div>';
        const rerenderWeeklyHrStage1Rows=()=>{};
        window.categoryReads=[];window.changeEvents=[];window.inputEvents=0;
        window.fetch=async(url,options={})=>{
            if(url!='/api/dropdown/ergazomenoi/kathgoria_adeias'||options.method&&options.method!=='GET')throw Error('Unexpected endpoint');
            window.categoryReads.push(url);
            return {json:async()=>({items:Array.from({length:18},(_,n)=>({value:String(n+1).padStart(4,'0'),
                label:String(n+1).padStart(4,'0')+' - '+(n===2?'Μεγάλη συνθετική περιγραφή άδειας με πλήρη αναδίπλωση '.repeat(5)+'ΜΑΚΡΟΣΚΕΛΗΣ'.repeat(12):'Συνθετική κατηγορία άδειας '+(n+1))}))})};
        };
        ${fn('isHrSelectableLeaveCategoryOption')}
        ${fn('stage1LeaveCategoryOptions')}
        ${fn('formatStage1LeaveCategoryLabel')}
        ${between('async function loadWeeklyHrLeaveCategories()', 'function isWeeklyHrStage1Selectable')}
        ${fn('stage1RowForDate')}
        ${fn('stage1DayTileState')}
        ${fn('stage1PayloadForRowId')}
        ${fn('weeklyHrStage1PendingRowIds')}
        ${between('function renderWeeklyHrStage1DayEditorPanel', 'function renderWeeklyHrStage1Card')}
        ${fn('setStage1DayDraft')}
        document.addEventListener('change',event=>{
            if(event.target.id==='weeklyHrStage1DrawerLeaveCategory')window.changeEvents.push({value:event.target.value,rowId:event.target.dataset.rowId});
            ${between("    const classification = event.target.closest('.weekly-hr-stage1-day-classification');", "    const checkbox = event.target.closest('.weekly-hr-stage1-select');")}
        });
        document.addEventListener('input',event=>{if(event.target.id==='weeklyHrStage1DrawerLeaveCategory')window.inputEvents++;});
        document.addEventListener('click',event=>{
            ${between("    const editorNavigation = event.target.closest('.weekly-hr-stage1-editor-nav');", "    const orphanButton = event.target.closest('.weekly-hr-open-orphan');")}
        });
        const rows=[{_id:'synthetic-1',hmeromhnia:'2026-11-02',classification:'LEAVE',kathgoria_adeias_apologistika:'0001'},
            {_id:'synthetic-2',hmeromhnia:'2026-11-03',classification:'LEAVE',kathgoria_adeias_apologistika:'0002'}];
        for(const row of rows)weeklyHrStage1RowsById.set(row._id,row);
        weeklyHrStage1Payloads.set('synthetic',{scope:{employee_kodikos:'0099',week_start:'2026-11-02',week_end:'2026-11-08'},
            employee_name:'ΣΥΝΘΕΤΙΚΟΣ ΕΛΕΓΧΟΣ',rows});
        window.ready=loadWeeklyHrLeaveCategories().then(()=>openWeeklyHrStage1DayEditor('synthetic-1'));
    ` });
    await page.evaluate(() => window.ready);
    await page.waitForFunction(() => document.getElementById('weeklyHrStage1DayEditor').classList.contains('show'));
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
}

async function measure(page) {
    return page.locator(menuId).evaluate(menu => {
        const box = menu.getBoundingClientRect(), field = document.getElementById('weeklyHrStage1DrawerLeaveCategory').getBoundingClientRect();
        const items = [...menu.children], visible = items.filter(item => {
            const r = item.getBoundingClientRect(); return r.bottom > box.top + 1 && r.top < box.bottom - 1;
        });
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height,
            viewport: [innerWidth, innerHeight], direction: menu.dataset.direction,
            expectedDirection: innerHeight-field.bottom-8 >= Math.min(menu.scrollHeight+2,Number(menu.dataset.rowHeight)*8+2)
                || innerHeight-field.bottom-8 >= field.top-8 ? 'down' : 'up',
            visible: visible.length, overflow: menu.scrollHeight > menu.clientHeight,
            horizontal: menu.scrollWidth > menu.clientWidth,
            wraps: items[3].getBoundingClientRect().height > Number(menu.dataset.rowHeight),
            textFits: items.every(item => item.scrollWidth <= item.clientWidth),
            foreground: menu.contains(document.elementFromPoint(box.x+20,box.y+Math.min(20,box.height/2))) };
    });
}

test('Chromium: only the day-characterization leave category reuses the bounded dropdown', { timeout: 90000 }, async t => {
    const browser = await chromium.launch({ headless: true });t.after(() => browser.close());
    const context = await browser.newContext({ viewport:{width:1440,height:900} });
    await context.route('**/*',route=>route.abort());
    const page = await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(5000);await mount(page);
    if(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR)fs.mkdirSync(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR,{recursive:true});
    const baseline = await page.locator(selectId).evaluate(node=>[...node.options].map(o=>({value:o.value,text:o.textContent})));
    assert.equal(baseline.length,19);assert.match(baseline[1].text,/^0001 - /);
    assert.equal(await page.locator('.proposal-dropdown').count(),1);
    assert.equal(await page.locator('#weeklyHrStage1DrawerClassification').evaluate(n=>n.parentElement.classList.contains('proposal-dropdown')),false);
    assert.equal(await page.locator('#proposal-dropdown-options').count(),0);
    for(const [width,height] of sizes)for(const sidebar of [false,true])await t.test(`${width}x${height}, sidebar ${sidebar?'open':'closed'}`,async()=>{
        await page.setViewportSize({width,height});
        await page.evaluate(open=>{
            document.getElementById('sidebarMenu').classList.toggle('d-none',!open);
            const main=document.querySelector('main');main.style.width=open?'':'100%';main.style.marginLeft=open?'':'0';
        },sidebar);
        await page.locator(selectId).click();
        const m=await measure(page);
        assert.ok(m.x>=7&&m.y>=7&&m.right<=width-7&&m.bottom<=height-7,JSON.stringify(m));
        assert.ok(m.visible<=8&&m.overflow&&!m.horizontal&&m.wraps&&m.textFits&&m.foreground,JSON.stringify(m));
        assert.equal(m.direction,m.expectedDirection,JSON.stringify(m));
        if(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR&&sidebar&&((width===1920)||(width===1280&&height===720)||width===390))
            await page.screenshot({path:path.join(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR,`day-leave-${width}x${height}.png`)});
        await page.locator(selectId).press('Escape');
        assert.equal(await page.locator(menuId).isVisible(),false);
        assert.equal(await page.locator('#weeklyHrStage1DayEditor').evaluate(n=>n.classList.contains('show')),true);
    });
    await t.test('up/down direction, modal clipping, scrolling and outside click',async()=>{
        await page.setViewportSize({width:900,height:1080});
        await page.locator(selectId).click();assert.equal((await measure(page)).direction,'down');
        await page.locator(selectId).press('Escape');
        await page.setViewportSize({width:900,height:600});
        await page.evaluate(()=>{
            const body=document.querySelector('#weeklyHrStage1DayEditor .offcanvas-body');
            Object.assign(body.lastElementChild.style,{position:'absolute',bottom:'80px',left:'16px',right:'16px'});
            body.style.overflow='hidden';
        });
        await page.locator(selectId).click();
        const m=await measure(page);assert.equal(m.direction,'up',JSON.stringify(m));assert.equal(m.foreground,true);
        const before=await page.locator(menuId).evaluate(n=>n.scrollTop);
        await page.locator(menuId).hover();await page.mouse.wheel(0,250);
        await page.waitForFunction(before=>document.getElementById('weekly-hr-day-leave-options').scrollTop>before,before);
        await page.locator('#weeklyHrStage1DayEditor .offcanvas-title').click();assert.equal(await page.locator(menuId).isVisible(),false);
        await page.evaluate(()=>{
            const body=document.querySelector('#weeklyHrStage1DayEditor .offcanvas-body');body.removeAttribute('style');body.lastElementChild.removeAttribute('style');
        });
    });
    await t.test('same values/order, one change event, draft marker, navigation and keyboard',async()=>{
        await page.setViewportSize({width:1280,height:800});
        const field=page.locator(selectId);
        await field.press('ArrowDown');await field.press('Home');
        await field.press('ArrowDown');await field.press('ArrowDown');await field.press('ArrowDown');await field.press('Enter');
        assert.equal(await field.inputValue(),'0003');
        assert.equal(await field.evaluate(n=>document.activeElement===n),true);
        assert.deepEqual(await page.evaluate(()=>window.changeEvents),[{value:'0003',rowId:'synthetic-1'}]);
        assert.equal(await page.evaluate(()=>window.inputEvents),1);
        assert.match(await page.locator('#weeklyHrStage1DayEditor').innerText(),/Μη αποθηκευμένη αλλαγή/);
        assert.equal(await field.evaluate(node=>node.parentElement.querySelector('.proposal-dropdown-label').textContent),baseline[3].text);
        assert.equal(await field.evaluate(n=>n.parentElement.scrollWidth<=n.parentElement.clientWidth),true);
        if(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR,'day-leave-selected-wrapped.png')});
        await page.locator('.weekly-hr-stage1-editor-next').click();assert.equal(await field.inputValue(),'0002');
        await page.locator('.weekly-hr-stage1-editor-prev').click();assert.equal(await field.inputValue(),'0003');
        assert.deepEqual(await field.evaluate(node=>[...node.options].map(o=>({value:o.value,text:o.textContent}))),baseline);
        assert.equal(await page.locator(menuId).count(),1);assert.equal(await page.locator('.proposal-dropdown').count(),1);
        await field.press('End');await field.press('Enter');assert.equal(await field.inputValue(),'0018');
        await field.press('ArrowDown');await field.press('Escape');assert.equal(await page.locator(menuId).isVisible(),false);
        await field.press('ArrowDown');await field.press('Tab');assert.equal(await page.locator(menuId).isVisible(),false);
    });
    await t.test('hide/reopen and classification rerender never leave orphan menus',async()=>{
        await page.locator(selectId).click();
        await page.evaluate(()=>bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('weeklyHrStage1DayEditor')).hide());
        await page.waitForFunction(()=>!document.getElementById('weeklyHrStage1DayEditor').classList.contains('show'));
        assert.equal(await page.locator(menuId).isVisible(),false);
        await page.evaluate(()=>openWeeklyHrStage1DayEditor('synthetic-1'));
        await page.waitForFunction(()=>document.getElementById('weeklyHrStage1DayEditor').classList.contains('show'));
        await page.locator('#weeklyHrStage1DrawerClassification').selectOption('ABSENCE');
        assert.equal(await page.locator(selectId).isVisible(),false);
        await page.locator('#weeklyHrStage1DrawerClassification').selectOption('SICKNESS');
        await page.locator(selectId).click();assert.equal(await page.locator(menuId).isVisible(),true);
        if(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR){
            fs.mkdirSync(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR,{recursive:true});
            await page.screenshot({path:path.join(process.env.PAYROLL_DAY_LEAVE_TEST_ARTIFACT_DIR,'day-leave-dropdown.png')});
        }
        await page.locator(selectId).press('Escape');await page.locator(selectId).press('Escape');
        await page.waitForFunction(()=>!document.getElementById('weeklyHrStage1DayEditor').classList.contains('show'));
    });
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.categoryReads),['/api/dropdown/ergazomenoi/kathgoria_adeias']);
});
