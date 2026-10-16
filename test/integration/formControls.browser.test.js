'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { root } = require('../fixtures/responsiveForms');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const dir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
// Functional coverage includes approved and pending pages alike; visual approval never filters it.
const functionalPages = inventory.templates.filter(f=>f.kind==='page'&&(!process.env.PAYROLL_FORM_FILTER||new RegExp(process.env.PAYROLL_FORM_FILTER).test(f.template)));
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720]];

function dropdownBounds(e) {
    const t=e.tomselect,d=t.dropdown.getBoundingClientRect(),c=t.control.getBoundingClientRect();
    let top=0,bottom=innerHeight,left=0,right=innerWidth;
    for(let p=t.wrapper.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}}
    const content=t.dropdown.querySelector('.ts-dropdown-content');
    const optionHeight=content.querySelector('.option')?.getBoundingClientRect().height||34;
    return{valid:d.top>=top-1&&d.bottom<=bottom+1&&d.left>=left-1&&d.right<=right+1&&content.clientHeight+1>=Math.min(34,optionHeight),width:d.width,height:d.height,controlHeight:c.height,scrollable:content.scrollHeight>content.clientHeight,options:content.querySelectorAll('.option').length};
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

test('Actual native/Tom selectors, field reachability and modal actions without saving', {skip:!vendor,timeout:600000},async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({locale:'el-GR'});await page.route('**/*',r=>r.abort());
    const results=[],problems=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(dir)fs.mkdirSync(dir,{recursive:true});
    for(const form of functionalPages){
        await loadForm(page,form.template,{vendor,populated:false});
        await viewport(page,1280,720,true);
        const sections=await page.locator('main .sections > section').count();
        for(let section=0;section<Math.max(1,sections);section++){
            const result={template:form.template,section,native:[],tom:[],reach:[],actions:[]};
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
            const fields=page.locator('main input:not([type="hidden"]):visible,main textarea:visible');
            for(const field of [fields.first(),fields.last()])if(await field.count()){
                await field.scrollIntoViewIfNeeded();
                result.reach.push(await field.evaluate(e=>{
                    const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                    return{id:e.id,reachable:!!hit&&(hit===e||e.contains(hit)||((e.disabled||e.readOnly)&&hit.contains(e)))};
                }));
            }
            for(const select of await page.locator('main select:not(.tomselected):visible').all()){
                const state=await select.evaluate(e=>({id:e.id,disabled:e.disabled,multiple:e.multiple,options:e.options.length}));
                if(!state.disabled&&state.options){
                    await select.scrollIntoViewIfNeeded();await select.focus();
                    if(!state.multiple){await page.keyboard.press('Alt+ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
                    else {await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');}
                    state.focused=await select.evaluate(e=>document.activeElement===e);
                }
                result.native.push(state);
            }
            for(const select of await page.locator('main select.tomselected').all()){
                const state=await select.evaluate(e=>({id:e.id,visible:!!e.tomselect?.control.getClientRects().length,disabled:e.tomselect?.isDisabled}));
                if(!state.visible)continue;
                if(!state.disabled){
                    try{
                        await select.evaluate(e=>e.tomselect.control_input.setAttribute('data-fixture-search',e.id));
                        const control=page.locator('input[data-fixture-search="'+state.id+'"]');
                        await select.evaluate(e=>e.tomselect.wrapper.scrollIntoView({block:'center'}));
                        await select.evaluate(e=>{e.tomselect.open();e.tomselect.control_input.focus();});
                        await control.fill('επιλογή');
                        await page.waitForFunction(id=>document.getElementById(id).tomselect.dropdown.querySelectorAll('.option').length>=40,state.id,{timeout:2500});
                        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
                        state.catalog=await select.evaluate(dropdownBounds);
                        if(dir&&result.tom.length===0)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+section+'-catalog-1280x720.png'),animations:'disabled'});
                        await page.waitForTimeout(180);
                        await control.fill('επιλογή 23');
                        await page.waitForFunction(id=>{const t=document.getElementById(id).tomselect,options=[...t.dropdown.querySelectorAll('.option')];return options.length>0&&options.every(e=>e.textContent.includes('23'))&&t.control_input.value.includes('23');},state.id,{timeout:2500});
                        state.search=true;
                        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
                        state.bounds=await select.evaluate(dropdownBounds);
                        await select.evaluate(e=>{const t=e.tomselect,option=[...t.dropdown.querySelectorAll('.option')].find(e=>e.textContent.includes('23'));option.click();});
                        state.change=await select.evaluate(e=>Number(e.dataset.testChanges||0)>0);
                        await select.evaluate(e=>e.tomselect.close());
                        const reset=await select.evaluate(e=>{const b=e.tomselect.wrapper.querySelector('.ts-fill-reset-btn:not([hidden])')||document.querySelector('[data-tom-target="'+e.id+'"]:not([hidden])');if(!b)return false;b.setAttribute('data-fixture-reset',e.id);return true;});
                        if(reset){
                            await page.locator('button[data-fixture-reset="'+state.id+'"]').click();
                            await page.waitForFunction(id=>{const t=document.getElementById(id).tomselect;return !t.items.length&&!t.isDisabled;},state.id,{timeout:3000});
                            state.clear=await select.evaluate(e=>!e.tomselect.items.length&&!e.tomselect.isDisabled);
                        }
                    }catch(e){state.error=e.message.split('\n')[0];await select.evaluate(e=>e.tomselect.close());}
                }
                result.tom.push(state);
            }
            for(const action of await page.locator('main .card-footer :is(button,a.btn):visible').all()){
                await action.scrollIntoViewIfNeeded();
                await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
                const disabled=await action.evaluate(e=>e.disabled||e.matches('.disabled-link,.disabled'));
                if(!disabled)await action.click({trial:true,timeout:3000});
                result.actions.push(await action.evaluate(e=>{
                    const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                    return{id:e.id,text:e.textContent.trim(),hit:hit?.tagName+'#'+hit?.id+'.'+hit?.className,box:r.toJSON(),reachable:!!hit&&(e.contains(hit)||((e.disabled||e.matches('.disabled-link,.disabled'))&&hit.contains(e)))};
                }));
            }
            if(dir)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+section+'-last-1280x720.png'),animations:'disabled'});
            result.tables=await page.evaluate(()=>[...document.querySelectorAll('main .card-body,main .payroll-table-scroll,main .maintenance-table-scroll,main .table-responsive,main .istoriko-table-wrapper')]
                .filter(e=>e.getClientRects().length&&e.clientHeight>1&&/auto|scroll/.test(getComputedStyle(e).overflowX)&&e.scrollWidth>e.clientWidth+1)
                .map(e=>{e.scrollLeft=e.scrollWidth;return {className:e.className,lastColumn:e.scrollLeft+e.clientWidth>=e.scrollWidth-1};}));
            if(result.tables.some(e=>!e.lastColumn))problems.push({template:form.template,section,kind:'last-column'});
            if(dir&&result.tables.length)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+section+'-last-column-1280x720.png'),animations:'disabled'});
            await page.evaluate(()=>document.querySelectorAll('main .card-body,main .payroll-table-scroll,main .maintenance-table-scroll,main .table-responsive,main .istoriko-table-wrapper').forEach(e=>e.scrollLeft=0));
            results.push(result);
            for(const s of result.reach.concat(result.actions))if(!s.reachable)problems.push({...result,kind:'reach',field:s.id||s.text});
            for(const s of result.tom)if(s.error||s.clear===false||(!s.disabled&&(!s.search||!s.change||!s.bounds?.valid||!s.catalog?.valid||!s.catalog?.scrollable)))problems.push({template:form.template,section,kind:'tom',...s});
        }
        for(const modal of await page.locator('main .modal').all()){
            const id=await modal.getAttribute('id');if(!id)continue;
            await modal.evaluate(e=>{e.classList.remove('fade');bootstrap.Modal.getOrCreateInstance(e,{backdrop:false}).show();});
            for(const action of await modal.locator('.modal-footer button:visible').all()){
                await action.scrollIntoViewIfNeeded();const reachable=await action.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;});
                if(!reachable)problems.push({template:form.template,kind:'modal',id});
            }
            if(dir)await page.screenshot({path:path.join(dir,form.template.replaceAll('/','-')+'-'+id+'.png')});
            await modal.evaluate(e=>bootstrap.Modal.getInstance(e).hide());
        }
        console.log('Interactions:',form.template);
    }
    if(dir)fs.writeFileSync(path.join(dir,'controls.json'),JSON.stringify({results,problems,errors},null,2));
    assert.deepEqual(errors,[]);assert.equal(problems.length,0,JSON.stringify(problems.slice(0,10),null,2));
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
        await page.locator('.hover-label').first().hover();
        const modal=page.locator('#hoverModal');await modal.waitFor({state:'visible'});
        const state=await modal.evaluate(e=>{const r=e.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,font:getComputedStyle(e.querySelector('.modal-item-value')).fontSize,scrolls:e.scrollHeight>e.clientHeight};});
        results.push({width,height,sidebar:open?'open':'closed',...state});
        if(dir&&[1280,1920].includes(width))await page.screenshot({path:path.join(dir,`employee-info-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
        await modal.hover();assert.equal(await modal.isVisible(),true);
        await page.mouse.move(1,1);
    }
    if(dir)fs.writeFileSync(path.join(dir,'hover-panels.json'),JSON.stringify(results,null,2));
    assert.deepEqual(results.filter(r=>!r.fits||parseFloat(r.font)<14.39),[]);
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
