'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { root } = require('../fixtures/responsiveForms');
const { SHARD_COUNT, SECTION_TIMEOUT, SHARD_TIMEOUT, inspectInventory, buildPlan, progressReport } = require('../helpers/formControlsShards');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const { dropdownBounds, settleTomDropdown, captureDropdownFailure, queryForVisibleOption } = require('../helpers/tomSelectBrowser');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const dir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
const shardValue = process.env.PAYROLL_FORM_CONTROLS_SHARD;
if (shardValue !== undefined && (!/^\d$/.test(shardValue) || Number(shardValue) >= SHARD_COUNT)) {
    throw new Error(`Invalid PAYROLL_FORM_CONTROLS_SHARD: ${JSON.stringify(shardValue)}; expected 0..${SHARD_COUNT - 1}`);
}
// Functional coverage includes approved and pending pages alike; visual approval never filters it.
const functionalPages = inventory.templates.filter(f=>f.kind==='page'&&(!process.env.PAYROLL_FORM_FILTER||new RegExp(process.env.PAYROLL_FORM_FILTER).test(f.template)));
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720]];

// Same explicit 38-page approval scope as allFormsResponsive.browser.test.js.
const approvedVisualTemplates = new Set([
    'views/ergazomenoi/ergazomenoi/ergazomenoi.ejs',
    'views/ergazomenoi/ergazomenoi/search.ejs',
    'views/ergazomenoi/ergazomenoi/add.ejs',
    'views/ergazomenoi/ergazomenoi/edit.ejs',
    'views/index.ejs',
    'views/users/add.ejs',
    'views/users/edit.ejs',
    'views/users/dikaiomataXrhston.ejs',
    'views/admin/disconnectUsers.ejs',
    'views/users/view.ejs',
    'views/users/delete.ejs',
    'views/search.ejs',
    'views/admin/activeSessions.ejs',
    'views/admin/usageReport.ejs',
    'views/companies/genikastoixeia/companies.ejs',
    'views/companies/genikastoixeia/search.ejs',
    'views/companies/genikastoixeia/add.ejs',
    'views/companies/genikastoixeia/edit.ejs',
    'views/companies/ypokatasthmata/ypokatasthmata.ejs',
    'views/companies/ypokatasthmata/search.ejs',
    'views/companies/ypokatasthmata/add.ejs',
    'views/companies/ypokatasthmata/edit.ejs',
    'views/companies/nomimoi_ekprosopoi/nomimoi_ekprosopoi.ejs',
    'views/companies/nomimoi_ekprosopoi/search.ejs',
    'views/companies/nomimoi_ekprosopoi/add.ejs',
    'views/companies/nomimoi_ekprosopoi/edit.ejs',
    'views/companies/passwords/passwords.ejs',
    'views/companies/passwords/search.ejs',
    'views/companies/passwords/add.ejs',
    'views/companies/passwords/edit.ejs',
    'views/companies/antistoixiseis/antistoixiseis.ejs',
    'views/companies/antistoixiseis/search.ejs',
    'views/companies/antistoixiseis/add.ejs',
    'views/companies/antistoixiseis/edit.ejs',
    'views/companies/trapezes/trapezes.ejs',
    'views/companies/trapezes/search.ejs',
    'views/companies/trapezes/add.ejs',
    'views/companies/trapezes/edit.ejs',
]);

// Capture the current layout without Playwright waiting for visibility on pending pages.
function currentReachability(e) {
    const visible=!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    if(visible)e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const r=e.getBoundingClientRect(),hit=visible?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;
    return {id:e.id,text:e.textContent.trim(),visible,box:r.toJSON(),
        reachable:!!hit&&(hit===e||e.contains(hit)||((e.disabled||e.readOnly||e.matches('.disabled-link,.disabled'))&&hit.contains(e)))};
}


test('Presentation initialization preserves every original control, form owner, value, disabled state and FormData', {skip:!vendor,timeout:300000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    for(const form of functionalPages){
        await loadForm(page,form.template,{vendor,baseline:true});
        await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,250));
            window.__references=[...document.querySelectorAll('input,select,textarea')];
            window.__snapshot=window.__references.map(e=>({id:e.id,name:e.name,value:e.value,checked:e.checked,disabled:e.disabled,form:e.form}));
            window.__formData=[...document.forms].map(f=>JSON.stringify([...new FormData(f)].map(([k,v])=>[k,v instanceof File?[v.name,v.size,v.type]:v])));
            window.__changes=0;document.querySelector('main').addEventListener('change',()=>window.__changes++);
        });
        await page.addScriptTag({path:path.join(root,'public/js/common/formLayout.js')});
        const issues=await page.evaluate(async()=>{
            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const issues=[];
            const now=[...document.querySelectorAll('input,select,textarea')];
            if(now.length!==window.__references.length)issues.push('control-count');
            now.forEach((e,i)=>{
                const previous=window.__snapshot[i];
                if(e!==window.__references[i])issues.push('node/order:'+e.id);
                for(const key of ['id','name','value','checked','disabled','form'])if(e[key]!==previous[key])issues.push(key+':'+e.id);
            });
            const data=[...document.forms].map(f=>JSON.stringify([...new FormData(f)].map(([k,v])=>[k,v instanceof File?[v.name,v.size,v.type]:v])));
            if(JSON.stringify(data)!==JSON.stringify(window.__formData))issues.push('FormData');
            if(window.__changes)issues.push('unsolicited-change');
            return issues;
        });
        assert.deepEqual(issues,[],form.template);
    }
});

async function runControlUnit(t,unit,shardId) {
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({locale:'el-GR'});await page.route('**/*',r=>r.abort());
    const results=[],problems=[],visualProblems=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(dir)fs.mkdirSync(dir,{recursive:true});
    const report=progressReport(t,shardId,unit,dir);
    for(const form of functionalPages.filter(f=>f.template===unit.template)){
        await loadForm(page,form.template,{vendor,populated:false});
        await viewport(page,1280,720,true);
        const approved=approvedVisualTemplates.has(form.template);
        const visualProblem=problem=>visualProblems.push({template:form.template,visualApproval:approved?'approved':'pending',...problem});
        const sections=await page.locator('main .sections > section').count();
        assert.equal(Math.max(1,sections),unit.sections,'Rendered section count changed');
        for(let section=unit.section;section<=unit.section;section++){
            const result={template:form.template,visualApproval:approved?'approved':'pending',section,native:[],tom:[],reach:[],actions:[]};
            await page.evaluate(async index=>{
                document.querySelectorAll('main .menu_Links li')[index]?.click();
                document.querySelectorAll('main .sections > section').forEach((s,i)=>{s.classList.toggle('visible',i===index);s.style.display=i===index?'block':'none';});
                document.querySelectorAll('main .accordion-collapse').forEach(e=>{if(!e.closest('#employmentReviewWorkspace'))e.classList.add('show');});
                document.querySelector('main').addEventListener('change',e=>{e.target.dataset.testChanges=String(Number(e.target.dataset.testChanges||0)+1);});
                window.dispatchEvent(new Event('resize'));
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                document.getAnimations().forEach(a=>{if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
            },section);
            await settleLayout(page);
            const fields=await page.locator('main input:not([type="hidden"]):visible,main textarea:visible').elementHandles();
            for(const field of [fields[0],fields.at(-1)].filter(Boolean)){
                report.at('field-reach',await field.getAttribute('id'));
                if(approved)await field.scrollIntoViewIfNeeded();
                result.reach.push(await field.evaluate(currentReachability));
            }
            for(const select of await page.locator('main select:not(.tomselected):visible').elementHandles()){
                const state=await select.evaluate(e=>({id:e.id,disabled:e.disabled,multiple:e.multiple,options:e.options.length}));
                report.at('native',state.id);
                if(!state.disabled&&state.options){
                    if(approved){await select.scrollIntoViewIfNeeded();await select.focus();}
                    else await select.evaluate(e=>{e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});e.focus({preventScroll:true});});
                    state.focused=await select.evaluate(e=>document.activeElement===e);
                    if(state.focused){
                        if(!state.multiple){await page.keyboard.press('Alt+ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
                        else {await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');}
                    }else{
                        visualProblem({section,kind:'native-focus',id:state.id,...await select.evaluate(currentReachability)});
                        // Exercise value/change behavior even when pending layout prevents keyboard focus.
                        await select.evaluate(e=>{e.selectedIndex=Math.min(e.selectedIndex+1,e.options.length-1);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
                    }
                }
                result.native.push(state);
            }
            for(const select of await page.locator('main select.tomselected').all()){
                const state=await select.evaluate(e=>({id:e.id,visible:!!e.tomselect?.control.getClientRects().length,disabled:e.tomselect?.isDisabled}));
                if(!state.visible)continue;
                report.at('tom-open',state.id);
                if(!state.disabled){
                    try{
                        await select.evaluate(e=>e.tomselect.control_input.setAttribute('data-fixture-search',e.id));
                        const control=page.locator('input[data-fixture-search="'+state.id+'"]');
                        await select.evaluate(e=>e.tomselect.wrapper.scrollIntoView({block:'center',behavior:'instant'}));
                        await select.evaluate(e=>{e.tomselect.open();e.tomselect.control_input.focus();});
                        const catalog=await select.evaluate(e=>window.__fixtureCatalogs[new URL(e.dataset.api,location.origin).pathname]);
                        const expected=catalog.items.slice(0,catalog.pageSize).map(o=>String(o.value));
                        if(approved){await control.fill('x');await control.fill('');}
                        else await control.evaluate(e=>{for(const value of ['x','']){e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
                        await settleTomDropdown(select);
                        assert.equal(await select.evaluate(e=>e.tomselect.isOpen),true,state.id+' opens');
                        const displayed=await select.evaluate(e=>[...e.tomselect.dropdown.querySelectorAll('.option')].map(n=>n.dataset.value));
                        assert.deepEqual(displayed,expected,state.id+' API catalog');
                        state.catalog=await select.evaluate(dropdownBounds);
                        state.catalogKind=catalog.kind;
                        state.requiresScroll=catalog.kind==='dynamic'&&catalog.items.length>=20;
                        if(!state.catalog.valid||(state.requiresScroll&&!state.catalog.scrollable))
                            await captureDropdownFailure(page,select,{template:form.template,section,phase:'catalog'});
                        if(catalog.items.length>catalog.pageSize){
                            report.at('tom-pagination',state.id);
                            await select.evaluate(e=>{const c=e.tomselect.dropdown.querySelector('.ts-dropdown-content');c.scrollTop=c.scrollHeight;c.dispatchEvent(new Event('scroll'));});
                            await page.waitForFunction(({id,count})=>document.getElementById(id).tomselect.dropdown.querySelectorAll('.option').length===count,{id:state.id,count:catalog.items.length},{timeout:3000});
                            await settleTomDropdown(select);
                            state.pagination=true;
                        }
                        report.at('tom-search',state.id);
                        const target=catalog.items.at(-1),query=queryForVisibleOption(target);
                        if(approved)await control.fill(query);
                        else await control.evaluate((e,q)=>{
                            if(e.disabled||e.readOnly)throw new Error('Enabled Tom Select has a disabled or readonly search input');
                            e.value=q;e.dispatchEvent(new Event('input',{bubbles:true}));
                        },query);
                        await settleTomDropdown(select);
                        assert.equal(await select.evaluate(e=>e.tomselect.isOpen),true,state.id+' remains open for search');
                        const filtered=await select.evaluate(e=>[...e.tomselect.dropdown.querySelectorAll('.option')].map(n=>n.dataset.value));
                        assert.deepEqual(filtered,[String(target.value)],state.id+' filtered option');
                        state.search=true;
                        state.bounds=await select.evaluate(dropdownBounds);
                        if(!state.bounds.valid)await captureDropdownFailure(page,select,{template:form.template,section,phase:'search'});
                        report.at('tom-selection',state.id);
                        const option=select.locator('xpath=following-sibling::*').locator('.option[data-value="'+target.value+'"]');
                        if(approved)await option.click();
                        else await select.evaluate((e,value)=>e.tomselect.dropdown.querySelector('.option[data-value="'+value+'"]').click(),target.value);
                        assert.ok(await select.evaluate((e,value)=>e.tomselect.items.includes(value),String(target.value)),state.id+' selection');
                        state.change=await select.evaluate(e=>Number(e.dataset.testChanges||0)>0);
                        await select.evaluate(e=>e.tomselect.close());
                        const reset=await select.evaluate(e=>{const b=e.tomselect.wrapper.querySelector('.ts-fill-reset-btn:not([hidden])')||document.querySelector('[data-tom-target="'+e.id+'"]:not([hidden])');if(!b)return false;b.setAttribute('data-fixture-reset',e.id);return true;});
                        if(reset){
                            report.at('tom-clear',state.id);
                            const resetButton=page.locator('button[data-fixture-reset="'+state.id+'"]');
                            if(approved)await resetButton.click();
                            else{
                                const reach=await resetButton.evaluate(currentReachability);
                                if(!reach.reachable)visualProblem({section,kind:'tom-reset-reach',...reach});
                                await resetButton.evaluate(e=>e.click());
                            }
                            await page.waitForFunction(id=>{const t=document.getElementById(id).tomselect;return !t.items.length&&!t.isDisabled;},state.id,{timeout:3000});
                            state.clear=await select.evaluate(e=>!e.tomselect.items.length&&!e.tomselect.isDisabled);
                            report.at('tom-reload',state.id);
                            await select.evaluate(e=>e.tomselect.open());
                            if(approved){await control.fill('x');await control.fill('');}
                            else await control.evaluate(e=>{for(const value of ['x','']){e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
                            await settleTomDropdown(select);
                            assert.equal(await select.evaluate(e=>e.tomselect.isOpen),true,state.id+' reopens after clear');
                            assert.deepEqual(await select.evaluate(e=>[...e.tomselect.dropdown.querySelectorAll('.option')].map(n=>n.dataset.value)),expected,state.id+' catalog retained after clear');
                            state.reloaded=true;
                            state.reloadBounds=await select.evaluate(dropdownBounds);
                            if(!state.reloadBounds.valid)await captureDropdownFailure(page,select,{template:form.template,section,phase:'reload'});
                            await select.evaluate(e=>e.tomselect.close());
                        }
                    }catch(e){state.error=e.message.split('\n')[0];report.fail(state.error,state.id);state.diagnostics=await captureDropdownFailure(page,select,{template:form.template,section,phase:'interaction',error:state.error});await select.evaluate(e=>e.tomselect.close());}
                }
                result.tom.push(state);
            }
            for(const action of await page.locator('main .card-footer :is(button,a.btn):visible').elementHandles()){
                report.at('action',await action.getAttribute('id')||await action.textContent());
                if(approved)await action.scrollIntoViewIfNeeded();
                await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
                const disabled=await action.evaluate(e=>e.disabled||e.matches('.disabled-link,.disabled'));
                if(approved&&!disabled)await action.click({trial:true,timeout:3000});
                result.actions.push(await action.evaluate(currentReachability));
            }
            if(dir)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+section+'-last-1280x720.png'),animations:'disabled'});
            report.at('table-scroll');
            result.tables=await page.evaluate(()=>[...document.querySelectorAll('main .card-body,main .payroll-table-scroll,main .maintenance-table-scroll,main .table-responsive,main .istoriko-table-wrapper')]
                .filter(e=>e.getClientRects().length&&e.clientHeight>1&&/auto|scroll/.test(getComputedStyle(e).overflowX)&&e.scrollWidth>e.clientWidth+1)
                .map(e=>{e.scrollLeft=e.scrollWidth;return {className:e.className,lastColumn:e.scrollLeft+e.clientWidth>=e.scrollWidth-1};}));
            if(result.tables.some(e=>!e.lastColumn))visualProblem({section,kind:'last-column'});
            if(dir&&result.tables.length)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+section+'-last-column-1280x720.png'),animations:'disabled'});
            await page.evaluate(()=>document.querySelectorAll('main .card-body,main .payroll-table-scroll,main .maintenance-table-scroll,main .table-responsive,main .istoriko-table-wrapper').forEach(e=>e.scrollLeft=0));
            results.push(result);
            for(const s of result.reach.concat(result.actions))if(!s.reachable)visualProblem({section,kind:'reach',field:s.id||s.text,...s});
            for(const s of result.tom){
                // Search, change and clear failures remain mandatory on every page.
                if(s.error||s.clear===false||(!s.disabled&&(!s.search||!s.change)))problems.push({template:form.template,section,kind:'tom',...s});
                if(!s.disabled&&s.requiresScroll&&!s.catalog?.scrollable)problems.push({template:form.template,section,kind:'tom-scroll',...s});
                // Geometry follows the established approved/pending visual policy.
                if(!s.disabled&&(!s.bounds?.valid||!s.catalog?.valid||(s.reloadBounds&&!s.reloadBounds.valid))){
                    visualProblem({section,kind:'tom-layout',...s});
                }
            }
        }
        // Preserve the original state: modal actions ran after the final section.
        for(const modal of unit.modalOwner?await page.locator('main .modal').all():[]){
            const id=await modal.getAttribute('id');if(!id)continue;report.at('modal',id);
            await modal.evaluate(e=>{e.classList.remove('fade');bootstrap.Modal.getOrCreateInstance(e,{backdrop:false}).show();});
            for(const action of await modal.locator('.modal-footer button:visible').elementHandles()){
                report.at('action',await action.getAttribute('id')||await action.textContent());
                if(approved)await action.scrollIntoViewIfNeeded();
                const reach=await action.evaluate(currentReachability);
                if(!reach.reachable)visualProblem({kind:'modal',id,...reach});
            }
            if(dir)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+id+'.png')});
            await modal.evaluate(e=>bootstrap.Modal.getInstance(e).hide());
        }
        console.log('Interactions:',form.template,'visual approval:',approved?'approved':'pending');
    }
    const approvedVisualProblems=visualProblems.filter(p=>p.visualApproval==='approved');
    const pendingVisualProblems=visualProblems.filter(p=>p.visualApproval==='pending');
    if(dir)fs.writeFileSync(path.join(dir,unit.key.replace(/[^\w.-]/g,'_')+'-controls.json'),JSON.stringify({results,problems:problems.concat(visualProblems),functionalProblems:problems,approvedVisualProblems,pendingVisualProblems,errors},null,2));
    for(const template of [...new Set(results.filter(r=>r.visualApproval==='pending').map(r=>r.template))]){
        const findings=pendingVisualProblems.filter(p=>p.template===template);
        t.diagnostic(`${template}: visual approval pending; ${findings.length} diagnostic findings; not visually approved`);
        if(!dir)for(const finding of findings)t.diagnostic(JSON.stringify(finding));
    }
    assert.deepEqual(errors,[]);assert.equal(problems.length,0,JSON.stringify(problems.slice(0,10),null,2));
    assert.equal(approvedVisualProblems.length,0,JSON.stringify(approvedVisualProblems.slice(0,10),null,2));
    report.complete();
}

for(const shardId of shardValue===undefined?[]:[Number(shardValue)]){
    test(`Functional controls shard ${shardId}`,{timeout:SHARD_TIMEOUT},async t=>{
        assert.ok(vendor,'Tom Select vendor fixtures are required');
        if(process.env.GITHUB_ACTIONS)assert.equal(process.env.PAYROLL_FORM_FILTER,undefined,'CI shards must cover the complete inventory');
        const plan=buildPlan(await inspectInventory()),shard=plan[shardId];
        if(dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'shard-plan.json'),JSON.stringify(plan,null,2));}
        const selected=shard.units.filter(u=>functionalPages.some(f=>f.template===u.template));
        const started=Date.now(),completed=[];
        for(const unit of selected)await t.test(unit.key,{timeout:SECTION_TIMEOUT},async child=>{
            await runControlUnit(child,unit,shardId);completed.push(unit.key);
        });
        assert.deepEqual(completed.sort(),selected.map(u=>u.key).sort(),'Every assigned section must actually finish its original interactions');
        const summary={shard:shardId,completed,expected:selected.map(u=>u.key),durationMs:Date.now()-started,estimatedMs:shard.estimatedMs};
        if(dir)fs.writeFileSync(path.join(dir,'shard-completed.json'),JSON.stringify(summary,null,2));
        t.diagnostic(JSON.stringify(summary));
    });
}

test('Dynamic Tom catalogs: 0/1/2/20/70 entries, real scrolling, search, selection and clear', {skip:!vendor,timeout:120000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();page.setDefaultTimeout(3000);await page.route('**/*',r=>r.abort());
    for(const count of [0,1,2,20,70]){
        await loadForm(page,'views/ergazomenoi/ergazomenoi/add.ejs',{vendor,populated:false,catalogSize:count});
        await viewport(page,1280,720,true);
        await page.evaluate(()=>document.querySelectorAll('main .accordion-collapse').forEach(e=>e.classList.add('show')));
        // The presentation harness omits cascading startup. Supply the real required city parent.
        await page.evaluate(()=>{document.getElementById('dhmos_stathera').value='0001';document.getElementById('polh').tomselect.enable();});
        for(const id of ['ypokatasthma','doy','polh']){
            const select=page.locator('#'+id);
            try{
                await select.evaluate(e=>{e.tomselect.wrapper.scrollIntoView({block:'center',behavior:'instant'});e.tomselect.open();e.tomselect.control_input.setAttribute('data-matrix-search',e.id);});
                const input=page.locator('[data-matrix-search="'+id+'"]');
                await input.fill('x');await input.fill('');await settleTomDropdown(select);
                let bounds=await select.evaluate(dropdownBounds);
                assert.equal(bounds.options,Math.min(50,count),id+' initial count '+count);
                assert.equal(bounds.valid,true,JSON.stringify(bounds));
                if(!count){
                    assert.equal(await select.evaluate(e=>!!e.tomselect.dropdown.querySelector('.no-results')),true,id+' empty state');
                }else{
                    if(count>=20){
                        assert.equal(bounds.scrollable,true,id+' scrollable');
                        await select.evaluate(e=>{const c=e.tomselect.dropdown.querySelector('.ts-dropdown-content');c.scrollTop=c.scrollHeight;c.dispatchEvent(new Event('scroll'));});
                        await settleTomDropdown(select);
                        assert.equal(await select.evaluate(e=>e.tomselect.dropdown.querySelectorAll('.option').length),count,id+' all paginated options');
                        const last=page.locator('.ts-dropdown:visible .option').last();
                        await last.scrollIntoViewIfNeeded();
                        assert.equal(await last.evaluate(e=>{const r=e.getBoundingClientRect(),c=e.closest('.ts-dropdown-content').getBoundingClientRect();return r.top>=c.top-1&&r.bottom<=c.bottom+1;}),true,id+' last option reachable');
                    }
                    const value=String(count).padStart(4,'0');await input.fill(value);await settleTomDropdown(select);
                    assert.deepEqual(await select.evaluate(e=>[...e.tomselect.dropdown.querySelectorAll('.option')].map(n=>n.dataset.value)),[value],id+' search');
                    bounds=await select.evaluate(dropdownBounds);assert.equal(bounds.valid,true,JSON.stringify(bounds));
                    await page.locator('.ts-dropdown:visible .option[data-value="'+value+'"]').click();
                    assert.equal(await select.evaluate(e=>e.tomselect.getValue()),value);
                    await select.evaluate(e=>e.tomselect.wrapper.querySelector('.ts-fill-reset-btn').setAttribute('data-matrix-reset',e.id));
                    await page.locator('[data-matrix-reset="'+id+'"]').click();
                    assert.equal(await select.evaluate(e=>!e.tomselect.items.length&&!e.tomselect.isDisabled),true,id+' clear');
                }
                await select.evaluate(e=>e.tomselect.close());
            }catch(error){await captureDropdownFailure(page,select,{template:'employee-add',scenario:count,phase:'matrix',error:error.message});throw error;}
        }
    }
});

test('Employee Add Tom dropdowns settle above/below at scrollport edges in every supported viewport', {skip:!vendor,timeout:120000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    await loadForm(page,'views/ergazomenoi/ergazomenoi/add.ejs',{vendor,populated:false});
    await page.evaluate(()=>document.querySelectorAll('main .accordion-collapse').forEach(e=>e.classList.add('show')));
    const select=page.locator('#ypokatasthma');
    for(const [width,height]of sizes)for(const open of [true,false])for(const edge of ['top','bottom']){
        try{
            await viewport(page,width,height,open);await settleLayout(page);
            await select.evaluate(e=>{e.tomselect.wrapper.scrollIntoView({block:'center',behavior:'instant'});e.tomselect.open();e.tomselect.control_input.setAttribute('data-edge-search','branch');});
            const input=page.locator('[data-edge-search="branch"]');await input.fill('x');await input.fill('');await settleTomDropdown(select);
            await select.evaluate((e,edge)=>{
                const t=e.tomselect;let p=t.wrapper.parentElement;
                while(p&&!(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight))p=p.parentElement;
                if(!p)throw new Error('Missing real form scrollport');
                const r=t.control.getBoundingClientRect(),b=p.getBoundingClientRect();
                p.scrollTop+=edge==='top'?r.top-b.top-12:r.bottom-b.bottom+12;
                p.dispatchEvent(new Event('scroll'));
            },edge);
            await settleTomDropdown(select);
            const bounds=await select.evaluate(dropdownBounds);
            assert.equal(bounds.valid,true,JSON.stringify(bounds));
            assert.equal(bounds.placement,edge==='top'?'place-below':'place-above',JSON.stringify(bounds));
            assert.equal(bounds.scrollable,true);
            await select.evaluate(e=>e.tomselect.close());
        }catch(error){await captureDropdownFailure(page,select,{template:'employee-add',scenario:`${width}x${height}-${open}-${edge}`,phase:'edge',error:error.message});throw error;}
    }
});

test('Employee document dialogs keep their full actions inside every viewport without uploading', {skip:!vendor,timeout:60000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    await loadForm(page,'views/ergazomenoi/ergazomenoi/edit.ejs',{vendor});
    const results=[];
    if(dir)fs.mkdirSync(dir,{recursive:true});
    for(const [width,height]of sizes)for(const open of [true,false]){
        await viewport(page,width,height,open);await settleLayout(page);
        for(const id of ['pdfUploadModal','pdfPreviewContractModal']){
            const modal=page.locator('#'+id);
            await modal.evaluate(e=>e.classList.remove('hidden'));await settleLayout(page);
            for(const button of await modal.locator('.pdf-modal-footer .btn').all()){
                if(!await button.isDisabled())await button.click({trial:true,timeout:2000});
            }
            const state=await modal.evaluate(e=>{
                const box=e.querySelector('.pdf-modal-content').getBoundingClientRect();
                return {id:e.id,fits:box.left>=0&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1,tiny:[...e.querySelectorAll('.pdf-modal-body p,.pdf-modal-body small')].filter(n=>n.getClientRects().length&&parseFloat(getComputedStyle(n).fontSize)<14.39).map(n=>n.textContent),actions:[...e.querySelectorAll('.pdf-modal-footer .btn')].map(b=>{
                    const r=b.getBoundingClientRect(),s=getComputedStyle(b);
                    return {text:b.textContent.trim(),fits:r.left>=box.left&&r.right<=box.right+1&&r.top>=box.top&&r.bottom<=box.bottom+1,caption:b.scrollWidth<=b.clientWidth+1,font:s.fontSize,weight:s.fontWeight};
                })};
            });
            results.push({width,height,sidebar:open?'open':'closed',...state});
            if(dir&&[1280,1920].includes(width))await page.screenshot({path:path.join(dir,`${id}-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
            await modal.evaluate(e=>e.classList.add('hidden'));
        }
    }
    if(dir)fs.writeFileSync(path.join(dir,'document-dialogs.json'),JSON.stringify(results,null,2));
    assert.deepEqual(results.filter(r=>!r.fits||r.tiny.length||r.actions.some(a=>!a.fits||!a.caption||a.weight!=='400'||parseFloat(a.font)<14.39)),[]);
});

test('Actual employee information hover panel fits the form and remains reachable', {skip:!vendor,timeout:60000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    await loadForm(page,'views/kinhseis/apasxolhseis.ejs',{vendor});
    await page.evaluate(()=>document.querySelectorAll('#hoverModal .modal-item-value').forEach((e,i)=>e.textContent=i<5?'Δοκιμαστική τιμή εργαζομένου':'1234.56'));
    const results=[];
    for(const [width,height]of sizes)for(const open of [true,false]){
        await viewport(page,width,height,open);await settleLayout(page);
        await page.locator('.hover-label').first().hover({timeout:2500});
        const modal=page.locator('#hoverModal');await modal.waitFor({state:'visible',timeout:2500});
        const state=await modal.evaluate(e=>{const r=e.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,font:getComputedStyle(e.querySelector('.modal-item-value')).fontSize,scrolls:e.scrollHeight>e.clientHeight};});
        results.push({width,height,sidebar:open?'open':'closed',...state});
        if(dir&&[1280,1920].includes(width))await page.screenshot({path:path.join(dir,`employee-info-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
        await modal.hover({timeout:2500});assert.equal(await modal.isVisible(),true);
        await page.mouse.move(1,1);
    }
    if(dir)fs.writeFileSync(path.join(dir,'hover-panels.json'),JSON.stringify(results,null,2));
    const visualProblems=results.filter(r=>!r.fits||parseFloat(r.font)<14.39);
    if(dir)fs.writeFileSync(path.join(dir,'hover-panel-visual-review.json'),JSON.stringify({template:'views/kinhseis/apasxolhseis.ejs',visualApproval:'pending',problems:visualProblems},null,2));
    t.diagnostic(`Employment hover panel: visual approval pending; ${visualProblems.length} diagnostic findings; not visually approved`);
    if(!dir)for(const finding of visualProblems)t.diagnostic(JSON.stringify(finding));
});

test('Actual controls retain readable sizes, focus/error/disabled states and native interactions', {skip:!vendor,timeout:60000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    await loadForm(page,'views/ergazomenoi/ergazomenoi/edit.ejs',{vendor});
    await viewport(page,1280,720,true);
    const states=await page.locator('#polh').evaluate(async e=>{
        const t=e.tomselect, native=document.querySelector('main select:not(.tomselected)'),input=document.querySelector('#eponymo'),button=document.querySelector('main .card-footer button');
        const style=x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect();return{font:s.fontSize,weight:s.fontWeight,height:r.height};};
        const sizes={input:style(input),native:style(native),tom:style(t.control),wrapper:style(t.wrapper),button:style(button)};
        let container=button.parentElement;
        while(container&&getComputedStyle(container).containerType==='normal')container=container.parentElement;
        const cs=getComputedStyle(container),rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
        const width=parseFloat(cs.width)-(cs.boxSizing==='border-box'?['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((n,k)=>n+parseFloat(cs[k]),0):0);
        sizes.button.expectedFont=Math.min(rem,Math.max(.875*rem,.72*rem+.0025*width));
        e.classList.add('is-invalid');t.focus();await new Promise(r=>setTimeout(r,50));
        const invalid=getComputedStyle(t.wrapper).borderTopColor,focus=getComputedStyle(t.wrapper).boxShadow;
        t.close();
        t.disable();t.open();const disabled=t.isDisabled&&!t.isOpen&&e.disabled;t.enable();
        const column=input.closest('[class*="col-"]');
        if(!column)throw new Error('Missing existing input column');
        const before={value:input.value,form:input.form,disabled:input.disabled,valid:input.checkValidity()};
        const original=column.getAttribute('style');
        column.style.display='none';await new Promise(r=>requestAnimationFrame(r));
        const hidden=!input.getClientRects().length;
        if(original===null)column.removeAttribute('style');else column.setAttribute('style',original);
        await new Promise(r=>requestAnimationFrame(r));
        input.focus();
        const restored=!!input.getClientRects().length&&input.value===before.value&&input.form===before.form
            &&input.disabled===before.disabled&&input.checkValidity()===before.valid&&document.activeElement===input;
        const required=input.required,value=input.value;
        input.required=true;input.value='';const validation=!input.checkValidity();
        input.value=value;input.required=required;
        return{sizes,invalid,focus,disabled,hidden,restored,validation};
    });
    for(const key of ['native','tom'])assert.equal(states.sizes[key].font,states.sizes.input.font,key);
    for(const key of ['input','native','wrapper'])assert.equal(states.sizes[key].height,36,key);
    assert.ok(Math.abs(parseFloat(states.sizes.button.font)-states.sizes.button.expectedFont)<.05);
    assert.ok(states.sizes.button.height>=34&&states.sizes.button.height<=42);
    assert.equal(states.sizes.tom.weight,'400');assert.equal(states.sizes.button.weight,'400');
    assert.equal(states.invalid,'rgb(220, 53, 69)');assert.notEqual(states.focus,'none');
    assert.ok(states.disabled&&states.hidden&&states.restored&&states.validation,JSON.stringify(states));
    // These smaller-viewport checks exercise native behavior, not responsive acceptance.
    await loadForm(page,'views/users/add.ejs',{vendor});await viewport(page,800,700,true);
    const radios=page.locator('main input[type="radio"]:enabled');
    await radios.last().check();assert.equal(await radios.last().isChecked(),true);
    await loadForm(page,'views/companies/genikastoixeia/edit.ejs',{vendor});await viewport(page,800,700,true);
    const checkbox=page.locator('main input[type="checkbox"]:visible:enabled').first();
    await checkbox.check();assert.equal(await checkbox.isChecked(),true);await checkbox.uncheck();assert.equal(await checkbox.isChecked(),false);
    await loadForm(page,'views/admin/uploadTemplates.ejs',{vendor});await viewport(page,800,700,true);
    await page.locator('#fileInput').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('presentation fixture')});
    assert.equal(await page.locator('#fileInput').evaluate(e=>e.files[0].name),'synthetic.txt');
});
