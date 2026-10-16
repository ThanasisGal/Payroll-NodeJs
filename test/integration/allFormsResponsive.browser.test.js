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
    const employeeForm=main.querySelector('.employee-add-page,.employee-edit-page');
    const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
    const textBoxes=e=>{
        const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),rects=[];
        while(walker.nextNode())if(walker.currentNode.textContent.trim()){
            const range=document.createRange();range.selectNodeContents(walker.currentNode);
            rects.push(...range.getClientRects());
        }
        return rects;
    };
    const intersects=(a,b)=>a.x<a.right&&a.y<a.bottom&&b.x<b.right&&b.y<b.bottom&&a.x<b.right-1&&b.x<a.right-1&&a.y<b.bottom-1&&b.y<a.bottom-1;
    const queryWidth=e=>{
        let c=e.parentElement;
        while(c&&getComputedStyle(c).containerType==='normal')c=c.parentElement;
        if(!c)throw new Error('Missing action query container');
        const s=getComputedStyle(c);
        return parseFloat(s.width)-(s.boxSizing==='border-box'?['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((n,k)=>n+parseFloat(s[k]),0):0);
    };
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
    for(const heading of main.querySelectorAll('.card-header :is(h4,.headers-content)'))if(employeeForm&&visible(heading)){
        const font=parseFloat(getComputedStyle(heading).fontSize);
        if(font<1.2*rem-.01||font>1.4*rem+.01||heading.scrollWidth>heading.clientWidth+1)problems.push({kind:'card-header',font,text:heading.textContent.trim()});
    }
    for (const label of main.querySelectorAll('label[for]')) {
        if (!visible(label) || label.matches('.sr-only,.visually-hidden') || label.closest('table')) continue;
        const named=document.getElementById(label.htmlFor);
        const target = label.control || fields.find(e=>e.tomselect&&(e.tomselect.control===named||e.tomselect.control_input===named));
        if (!named || named.matches('input[type="hidden"]')) problems.push({kind:'label-target',id:label.htmlFor,text:label.textContent.trim()});
        if (!target || !visible(renderedField(target))) continue;
        const field=renderedField(target), l=box(label), f=box(field.closest('.employee-add-date-pair, .payroll-field-inputs, .payroll-field-inline')||field);
        if(!l.width || !f.width)continue;
        const checkbox=target.matches('[type="checkbox"],[type="radio"]');
        // Compare actual column edges, including flattened display:contents wrappers.
        let row=label.closest('.employee-fixed-left-fields,.employee-fixed-right-fields,.row.form-group,.employee-add-fixed-identity-row');
        if(row&&getComputedStyle(row).display==='contents')row=row.parentElement;
        const columns=row?[...row.children].flatMap(e=>getComputedStyle(e).display==='contents'?[...e.children]:[e]).filter(visible):[];
        const lc=columns.find(e=>e.contains(label)),fc=columns.find(e=>e.contains(field));
        const li=columns.indexOf(lc),fi=columns.indexOf(fc);
        const adjacentColumns=employeeForm&&lc&&fc&&li<fi&&columns.slice(li+1,fi).every(e=>!e.querySelector('label,input:not([type="hidden"]),select,textarea'));
        const columnGap=adjacentColumns?box(fc).x-box(lc).right:Infinity;
        const grid=row&&getComputedStyle(row).display==='grid';
        const labelEdge=grid&&lc&&getComputedStyle(lc).gridColumnStart==='1'?box(row).x+parseFloat(getComputedStyle(row).gridTemplateColumns):lc?box(lc).right:0;
        const fieldEdge=grid&&fc&&getComputedStyle(fc).gridColumnStart==='2'?box(row).right:fc?box(fc).right:0;
        const columnAligned=adjacentColumns&&columnGap>=-2
            &&l.x>=box(lc).x-2&&l.right<=labelEdge+2
            &&f.x>=box(fc).x-2&&f.right<=fieldEdge+2;
        const beside=Math.abs(l.y+l.height/2-f.y-f.height/2)<=Math.max(8,l.height/2)
            && (l.right<=f.x+2 || f.right<=l.x+2)
            && (Math.min(Math.abs(l.right-f.x),Math.abs(f.right-l.x))<=48||columnAligned);
        const above=l.bottom<=f.y+2 && f.y-l.bottom<=28 && l.x>=f.x-2 && l.x<f.right;
        const group=label.closest('.payroll-field-group');
        const contains=checkbox&&label.contains(target);
        const coherentHint=group&&group.contains(target)&&label.htmlFor&&[...group.querySelectorAll('label')].some(h=>h!==label&&h.htmlFor===label.htmlFor&&h.getBoundingClientRect().bottom<=f.y+2)
            &&l.bottom<=f.y+2&&l.x>=group.getBoundingClientRect().left-2&&l.x<group.getBoundingClientRect().right;
        if ((!beside&&!above&&!contains&&!coherentHint) || (group&&!group.contains(target))) problems.push({kind:'label',id:target.id,text:label.textContent.trim(),label:l,field:f,checkbox});
        if(label.scrollWidth>label.clientWidth+1||label.scrollHeight>label.clientHeight+1)problems.push({kind:'label-clipping',id:target.id,text:label.textContent.trim()});
        if(!contains&&textBoxes(label).some(r=>intersects(r,box(field))))problems.push({kind:'label-overlap',id:target.id,text:label.textContent.trim()});
        labels.push({id:target.id,group:!!group,beside,above,coherentHint:!!coherentHint,contains});
    }
    const fonts=[];
    for(const button of main.querySelectorAll('.istoriko-actions [data-action="review"]'))if(visible(button)){
        const b=box(button),c=box(button.closest('td')),s=getComputedStyle(button);
        if(b.x<c.x||b.right>c.right||button.scrollWidth>button.clientWidth+1||parseFloat(s.fontSize)<14.39||s.fontWeight!=='400')problems.push({kind:'history-review-action',button:b,cell:c,font:s.fontSize});
    }
    const controls=[...main.querySelectorAll('button,.btn,a.buttons-content')].filter(e=>visible(e)&&!e.matches(exceptions));
    for(const button of controls) {
        const b=box(button), s=getComputedStyle(button);
        const region=button.closest('.modal,.card,form') || main;
        const peer=fields.find(e=>region.contains(e)&&!e.matches('[type="checkbox"],[type="radio"],[type="file"]'));
        const peerFont=peer?getComputedStyle(renderedField(peer)).fontSize:null;
        fonts.push({id:button.id,text:button.textContent.trim(),font:s.fontSize,weight:s.fontWeight,peerFont});
        const employeeFooter=employeeForm&&button.closest('.companies-management-footer');
        const maxFont=button.closest('#employmentReviewWorkspace')?16.81:16.1;
        const minFont=employeeFooter?14:14.39;
        if(parseFloat(s.fontSize)<minFont||parseFloat(s.fontSize)>maxFont)problems.push({kind:'button-readability',...fonts.at(-1)});
        if(employeeFooter){
            const expected=Math.min(rem,Math.max(.875*rem,.72*rem+.0025*queryWidth(button)));
            if(Math.abs(parseFloat(s.fontSize)-expected)>.05)problems.push({kind:'footer-font',expected,...fonts.at(-1)});
        }
        if(!employeeFooter&&peerFont&&Math.abs(parseFloat(peerFont)-parseFloat(s.fontSize))>.1)problems.push({kind:'font',...fonts.at(-1)});
        if(s.fontWeight!=='400')problems.push({kind:'weight',...fonts.at(-1)});
        if(employeeFooter&&(b.height<34||b.height>42))problems.push({kind:'footer-height',...fonts.at(-1),height:b.height});
        if(button.scrollWidth>button.clientWidth+1||button.scrollHeight>button.clientHeight+1||textBoxes(button).some(r=>r.x<b.x-1||r.right>b.right+1||r.y<b.y-1||r.bottom>b.bottom+1))problems.push({kind:'caption',id:button.id,text:button.textContent.trim(),box:b,scroll:button.scrollWidth,client:button.clientWidth});
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
        if(field.closest('.employee-fund-fields')){
            const cell=field.closest('.edit-employee-tom-field'),trash=cell?.querySelector('button[data-tom-target]');
            const items=[...field.querySelectorAll('.item')];
            const b=box(field);
            if(b.width<=0||items.some(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1||textBoxes(e).some(r=>r.x<b.x-1||r.right>b.right+1||r.y<b.y-1||r.bottom>b.bottom+1)))problems.push({kind:'fund-value-clipping',id:field.id,box:b});
            if(trash&&visible(trash)){
                const t=box(trash),c=box(cell);
                if(intersects(t,b)||t.right>c.right+1||Math.abs(t.y+t.height/2-b.y-b.height/2)>1)problems.push({kind:'fund-trash',id:field.id,box:b,trash:t});
            }
        }
        if(field.closest('.payroll-tax-row')&&field.getBoundingClientRect().width<120)problems.push({kind:'tax-value-width',id:field.id,width:field.getBoundingClientRect().width});
        if(field.closest('table,.table-responsive,.maintenance-table-scroll,.payroll-entry-table'))continue;
        const b=box(field);
        if(b.x<main.getBoundingClientRect().x-2||b.right>innerWidth+1)problems.push({kind:'field-width',id:field.id||field.closest('.ts-wrapper')?.previousElementSibling?.id,box:b});
    }
    for(const reset of main.querySelectorAll('.ts-wrapper > .ts-fill-reset-btn:not([hidden])')){
        if(!visible(reset))continue;
        const wrapper=reset.closest('.ts-wrapper'),r=box(reset),w=box(wrapper),c=box(wrapper.parentElement);
        const external=employeeForm&&reset.closest('.company-details-page .card-body');
        const geometryOk=external?r.x>=w.right&&Math.abs(r.x-w.right-.25*rem)<=1&&r.right<=c.right+1&&Math.abs(r.y+r.height/2-w.y-w.height/2)<=1:r.x>=w.x-1&&r.right<=w.right+1&&r.y>=w.y-1&&r.bottom<=w.bottom+1;
        const painted=paintedBox(reset);
        const hit=painted.x<painted.right&&painted.y<painted.bottom?document.elementFromPoint((painted.x+painted.right)/2,(painted.y+painted.bottom)/2):null;
        const centerVisible=r.x+r.width/2>=painted.x&&r.x+r.width/2<=painted.right&&r.y+r.height/2>=painted.y&&r.y+r.height/2<=painted.bottom;
        let covered=centerVisible&&hit&&!reset.contains(hit);
        if(!centerVisible){
            // Offscreen actions must become reachable through their existing scroll containers.
            const positions=[];
            for(let e=reset.parentElement;e;e=e.parentElement)positions.push([e,e.scrollLeft,e.scrollTop]);
            reset.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
            const b=box(reset),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
            covered=!target||!reset.contains(target);
            for(const [e,left,top]of positions)e.scrollTo({left,top,behavior:'instant'});
        }
        const collision=fields.map(renderedField).some(f=>f!==wrapper.querySelector('.ts-control')&&!wrapper.contains(f)&&intersects(paintedBox(f),painted));
        if(!geometryOk||covered||collision||r.x<main.getBoundingClientRect().x-1||r.right>innerWidth+1||!(reset.getAttribute('aria-label')||reset.title)||reset.disabled)problems.push({kind:'tom-reset',id:reset.closest('.ts-wrapper').previousElementSibling?.id,box:r,wrapper:w});
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
