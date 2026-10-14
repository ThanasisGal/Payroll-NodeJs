'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[1100,700],[800,700]];
const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;

function measure() {
    const main = document.querySelector('main');
    const visible = e => !!e?.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const box = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const renderedField = e => e.tomselect?.control || e;
    const paintedBox = e => {
        const r=box(e);
        for(let p=e.parentElement;p;p=p.parentElement){
            const s=getComputedStyle(p), b=box(p);
            if(/auto|scroll|hidden|clip/.test(s.overflowY)){r.y=Math.max(r.y,b.y);r.bottom=Math.min(r.bottom,b.bottom);}
            if(/auto|scroll|hidden|clip/.test(s.overflowX)){r.x=Math.max(r.x,b.x);r.right=Math.min(r.right,b.right);}
        }
        return r;
    };
    const exceptions = '.btn-close,.btn-toTop,.accordion-button,.nav-link,.navbar-toggler,.clear-btn,.clear-row,.ts-fill-reset-btn,.ts-overflow-indicator,.edit-apodoxes-tom-trash,.edit-employee-tom-trash,.ts-popup-row > button,.ts-wrapper .clear-button,.ts-wrapper .remove,#gotoProgrammaDypa,.review-guidance-info,.weekly-hr-stage1-open-editor,.weekly-hr-stage1-readonly-tile,.weekly-hr-stage1-bulk-action-menu .dropdown-item,.istoriko-btn,.btn-small';
    const fields = [...main.querySelectorAll('input:not([type="hidden"]),select,textarea')]
        .filter(e=>!e.closest('.ts-control,.ts-dropdown') && visible(renderedField(e)));
    const labels=[], problems=[];
    const controlFonts=[...new Set(fields.filter(e=>!e.matches('[type="checkbox"],[type="radio"]')).map(e=>getComputedStyle(renderedField(e)).fontSize))];
    for(const font of controlFonts)if(parseFloat(font)<14.39)problems.push({kind:'readability',font});
    const navigation=[...document.querySelectorAll('header.payroll-navigation .form-control')].map(e=>{
        const s=getComputedStyle(e);return {id:e.id,font:s.fontSize,weight:s.fontWeight,clipped:e.scrollWidth>e.clientWidth+1};
    });
    for(const field of navigation)if(parseFloat(field.font)<13.59||field.clipped)problems.push({kind:'navigation',...field});
    for (const label of main.querySelectorAll('label[for]')) {
        if (!visible(label) || label.matches('.sr-only,.visually-hidden') || label.closest('table')) continue;
        const named=document.getElementById(label.htmlFor);
        const target = label.control || fields.find(e=>e.tomselect&&(e.tomselect.control===named||e.tomselect.control_input===named));
        if (!named || named.matches('input[type="hidden"]')) problems.push({kind:'label-target',id:label.htmlFor,text:label.textContent.trim()});
        if (!target || !visible(renderedField(target))) continue;
        const field=renderedField(target), l=box(label), f=box(field.closest('.payroll-field-inputs, .payroll-field-inline')||field);
        if(!l.width || !f.width)continue;
        const checkbox=target.matches('[type="checkbox"],[type="radio"]');
        const beside=Math.abs(l.y+l.height/2-f.y-f.height/2)<=Math.max(8,l.height/2)
            && (l.right<=f.x+2 || f.right<=l.x+2) && Math.min(Math.abs(l.right-f.x),Math.abs(f.right-l.x))<=48;
        const above=l.bottom<=f.y+2 && f.y-l.bottom<=28 && l.x>=f.x-2 && l.x<f.right;
        const group=label.closest('.payroll-field-group');
        const contains=checkbox&&label.contains(target);
        const coherentHint=group&&group.contains(target)&&label.htmlFor&&[...group.querySelectorAll('label')].some(h=>h!==label&&h.htmlFor===label.htmlFor&&h.getBoundingClientRect().bottom<=f.y+2)
            &&l.bottom<=f.y+2&&l.x>=group.getBoundingClientRect().left-2&&l.x<group.getBoundingClientRect().right;
        if ((!beside&&!above&&!contains&&!coherentHint) || (group&&!group.contains(target))) problems.push({kind:'label',id:target.id,text:label.textContent.trim(),label:l,field:f,checkbox});
        labels.push({id:target.id,group:!!group,beside,above,coherentHint:!!coherentHint,contains});
    }
    const fonts=[];
    const controls=[...main.querySelectorAll('button,.btn,a.buttons-content')].filter(e=>visible(e)&&!e.matches(exceptions));
    for(const button of controls) {
        const b=box(button), s=getComputedStyle(button);
        const region=button.closest('.modal,.card,form') || main;
        const peer=fields.find(e=>region.contains(e)&&!e.matches('[type="checkbox"],[type="radio"],[type="file"]'));
        const peerFont=peer?getComputedStyle(renderedField(peer)).fontSize:null;
        fonts.push({id:button.id,text:button.textContent.trim(),font:s.fontSize,weight:s.fontWeight,peerFont});
        const maxFont=button.closest('#employmentReviewWorkspace')?16.81:16.1;
        if(parseFloat(s.fontSize)<14.39||parseFloat(s.fontSize)>maxFont)problems.push({kind:'button-readability',...fonts.at(-1)});
        if(peerFont&&Math.abs(parseFloat(peerFont)-parseFloat(s.fontSize))>.1)problems.push({kind:'font',...fonts.at(-1)});
        if(s.fontWeight!=='400')problems.push({kind:'weight',...fonts.at(-1)});
        if(button.scrollWidth>button.clientWidth+1)problems.push({kind:'caption',id:button.id,text:button.textContent.trim(),box:b,scroll:button.scrollWidth,client:button.clientWidth});
        if(!button.closest('table,.table-responsive,.maintenance-table-scroll,.payroll-entry-table')&&(b.x<main.getBoundingClientRect().x-2||b.right>innerWidth+1))problems.push({kind:'button-width',id:button.id,text:button.textContent.trim(),box:b});
        for(const field of fields.map(renderedField)){
            if(button.contains(field)||field.contains(button))continue;
            // The transparent native file picker intentionally covers its visible helper button.
            if(field.matches('input[type="file"]')&&field.closest('.file-input-wrapper')===button.closest('.file-input-wrapper'))continue;
            const f=paintedBox(field), pb=paintedBox(button);
            if(f.x<f.right&&f.y<f.bottom&&pb.x<pb.right&&pb.y<pb.bottom&&pb.x<f.right-1&&f.x<pb.right-1&&pb.y<f.bottom-1&&f.y<pb.bottom-1)problems.push({kind:'overlap',button:button.id||button.textContent.trim(),field:field.id||field.closest('.ts-wrapper')?.previousElementSibling?.id});
        }
    }
    for(const field of fields.map(renderedField)){
        if(field.closest('.employee-fund-fields')&&field.getBoundingClientRect().width<160)problems.push({kind:'fund-control-width',width:field.getBoundingClientRect().width});
        if(field.closest('.payroll-tax-row')&&field.getBoundingClientRect().width<120)problems.push({kind:'tax-value-width',id:field.id,width:field.getBoundingClientRect().width});
        if(field.closest('table,.table-responsive,.maintenance-table-scroll,.payroll-entry-table'))continue;
        const b=box(field);
        if(b.x<main.getBoundingClientRect().x-2||b.right>innerWidth+1)problems.push({kind:'field-width',id:field.id||field.closest('.ts-wrapper')?.previousElementSibling?.id,box:b});
    }
    for(const reset of main.querySelectorAll('.ts-wrapper > .ts-fill-reset-btn:not([hidden])')){
        if(!visible(reset))continue;
        const r=box(reset),w=box(reset.closest('.ts-wrapper'));
        if(r.x<w.x-1||r.right>w.right+1||r.y<w.y-1||r.bottom>w.bottom+1)problems.push({kind:'tom-reset',id:reset.closest('.ts-wrapper').previousElementSibling?.id,box:r,wrapper:w});
    }
    const tabs=[...main.querySelectorAll('.menu_Links li')].filter(visible).map(box);
    for(const heading of main.querySelectorAll('.employee-retention-heading > .col-1 label'))if(visible(heading)&&heading.getBoundingClientRect().height>parseFloat(getComputedStyle(heading).lineHeight)+17)problems.push({kind:'retention-heading-wrap'});
    if(tabs.length&&Math.max(...tabs.map(b=>b.y))-Math.min(...tabs.map(b=>b.y))>1)problems.push({kind:'tabs-wrap'});
    return {problems,labels,fonts,controlFonts,navigation,fields:fields.length,groups:main.querySelectorAll('.payroll-field-group').length};
}

test('Actual EJS inventory: field relationships and controls across all requested widths', {skip:!vendor,timeout:600000}, async t => {
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({locale:'el-GR'});
    const errors=[],requests=[],results=[],renderErrors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
    if(artifactDir)fs.mkdirSync(artifactDir,{recursive:true});
    const selected=inventory.templates.filter(t=>t.kind==='page'&&(!process.env.PAYROLL_FORM_FILTER||new RegExp(process.env.PAYROLL_FORM_FILTER).test(t.template)));
    for(const form of selected){
        try{await loadForm(page,form.template,{vendor});}catch(e){renderErrors.push({template:form.template,error:e.message});continue;}
        const sections=await page.locator('main .sections > section').count();
        for(const [width,height]of sizes)for(const open of [true,false]){
            await viewport(page,width,height,open);
            for(let section=0;section<Math.max(1,sections);section++){
                if(sections)await page.evaluate(index=>{
                    document.querySelectorAll('main .menu_Links li')[index]?.click();
                    document.querySelectorAll('main .sections > section').forEach((s,i)=>{s.classList.toggle('visible',i===index);s.style.display=i===index?'block':'none';});
                    document.querySelectorAll('main .menu_Links li').forEach((s,i)=>s.classList.toggle('active',i===index));
                },section);
                await page.evaluate(()=>{document.querySelectorAll('main .accordion-collapse').forEach(e=>{if(!e.closest('#employmentReviewWorkspace'))e.classList.add('show');});window.dispatchEvent(new Event('resize'));});
                await settleLayout(page);
                const result={template:form.template,section,width,height,sidebar:open?'open':'closed',...await page.evaluate(measure)};
                results.push(result);
                if(artifactDir&&((width===1280&&height===720&&open)||(width===800&&open)||(width===1920&&!open))){
                    await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('main .card-body').forEach(e=>e.scrollTop=0);});
                    const name=form.template.replace(/^views\//,'').replace(/\.ejs$/,'').replaceAll('/','-');
                    await page.screenshot({path:path.join(artifactDir,`${name}-${section}-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
                }
            }
        }
        console.log(`${form.template}: ${Math.max(1,sections)*sizes.length*2} combinations`);
    }
    const problems=results.flatMap(r=>r.problems.map(p=>({template:r.template,section:r.section,width:r.width,height:r.height,sidebar:r.sidebar,...p})));
    if(artifactDir){
        fs.writeFileSync(path.join(artifactDir,'results.json'),JSON.stringify(results,null,2));
        fs.writeFileSync(path.join(artifactDir,'problems.json'),JSON.stringify({renderErrors,errors,problems,blockedRequests:[...new Set(requests)]},null,2));
    }
    assert.deepEqual(renderErrors,[],'Every selected actual EJS page must render');
    assert.deepEqual(errors,[],'Presentation scripts must run without errors');
    assert.equal(problems.length,0,JSON.stringify(problems.slice(0,15),null,2)+`\nTotal: ${problems.length}`);
});
