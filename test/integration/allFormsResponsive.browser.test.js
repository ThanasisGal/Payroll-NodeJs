'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720]]
    .filter(([w,h])=>!process.env.PAYROLL_VIEWPORT_FILTER||new RegExp(process.env.PAYROLL_VIEWPORT_FILTER).test(`${w}x${h}`));
const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;

// Explicit user-approved visual scope. A passing measurement never grants visual approval.
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
// Existing dedicated coverage in maintenanceFormsResponsive.browser.test.js is retained.
// These four pages have automated coverage; user visual approval remains pending.
const previouslyCheckedContracts = [
    'views/symbaseis/symbaseis/add.ejs',
    'views/symbaseis/symbaseis/edit.ejs',
    'views/symbaseis/symbaseis/symbaseis.ejs',
    'views/symbaseis/symbaseis/search.ejs'
];
const inventoryPages = inventory.templates.filter(f=>f.kind==='page');
const visualReviewScope = {
    approved: inventoryPages.filter(f=>approvedVisualTemplates.has(f.template)).map(f=>f.template),
    pending: inventoryPages.filter(f=>!approvedVisualTemplates.has(f.template)).map(f=>f.template),
    previouslyCheckedContracts
};

test('Explicit visual approval covers 38 inventory pages; all other pages remain pending', ()=>{
    assert.equal(approvedVisualTemplates.size,38);
    assert.equal(visualReviewScope.approved.length,38,'Every approved EJS must exist in the page inventory');
    for(const template of previouslyCheckedContracts){
        assert.ok(visualReviewScope.pending.includes(template),template);
    }
    assert.ok(visualReviewScope.pending.includes('views/kinhseis/apasxolhseis.ejs'));
});


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
    const clipBox = (e,rect) => {
        const r={...rect};
        r.x=Math.max(0,r.x);r.right=Math.min(innerWidth,r.right);
        r.y=Math.max(0,r.y);r.bottom=Math.min(innerHeight,r.bottom);
        for(let p=e.parentElement;p;p=p.parentElement){
            const s=getComputedStyle(p), outer=box(p);
            const b={x:outer.x+p.clientLeft,y:outer.y+p.clientTop,
                right:outer.x+p.clientLeft+p.clientWidth,bottom:outer.y+p.clientTop+p.clientHeight};
            if(/auto|scroll|hidden|clip/.test(s.overflowY)){r.y=Math.max(r.y,b.y);r.bottom=Math.min(r.bottom,b.bottom);}
            if(/auto|scroll|hidden|clip/.test(s.overflowX)){r.x=Math.max(r.x,b.x);r.right=Math.min(r.right,b.right);}
        }
        return r;
    };
    const paintedBox=e=>clipBox(e,box(e));
    const whileScrolled=(e,check)=>{
        const positions=[];
        for(let p=e.parentElement;p;p=p.parentElement)positions.push([p,p.scrollLeft,p.scrollTop]);
        try{
            e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
            // Page-wide horizontal scrolling is not a substitute for a local scroll container.
            const root=document.scrollingElement;
            for(const [p,left,top]of positions){
                const style=getComputedStyle(p);
                if(p===root||!/auto|scroll/.test(style.overflowX))p.scrollLeft=left;
                if(p!==root&&!/auto|scroll/.test(style.overflowY))p.scrollTop=top;
            }
            return check();
        }finally{
            for(const [p,left,top]of positions)p.scrollTo({left,top,behavior:'instant'});
        }
    };
    // Accept horizontal overflow only when the existing scrolling can reveal the whole control.
    const horizontalBoundsOk=e=>whileScrolled(e,()=>{
        const b=box(e),painted=paintedBox(e),m=box(main);
        return b.width>0&&b.x>=Math.max(0,m.x)-2&&b.right<=Math.min(innerWidth,m.right)+1
            &&painted.x<=b.x+1&&painted.right>=b.right-1;
    });
    const labelOverlaps=(label,field)=>whileScrolled(field,()=>
        textBoxes(label).some(r=>intersects(clipBox(label,{x:r.x,y:r.y,right:r.right,bottom:r.bottom}),paintedBox(field))));
    const exceptions = '.btn-close,.btn-toTop,.accordion-button,.nav-link,.navbar-toggler,.clear-btn,.clear-row,.ts-fill-reset-btn,.ts-overflow-indicator,.edit-apodoxes-tom-trash,.edit-employee-tom-trash,.ts-popup-row > button,.ts-wrapper .clear-button,.ts-wrapper .remove,#gotoProgrammaDypa,.review-guidance-info,.weekly-hr-stage1-open-editor,.weekly-hr-stage1-readonly-tile,.weekly-hr-stage1-bulk-action-menu .dropdown-item,.istoriko-btn,.btn-small';
    const fields = [...main.querySelectorAll('input:not([type="hidden"]),select,textarea')]
        .filter(e=>!e.closest('.ts-control,.ts-dropdown') && visible(renderedField(e)));
    const labels=[], problems=[];
    const controlFonts=[...new Set(fields.filter(e=>!e.matches('[type="checkbox"],[type="radio"]')).map(e=>getComputedStyle(renderedField(e)).fontSize))];
    for(const font of controlFonts)if(parseFloat(font)<14.39)problems.push({kind:'readability',font});
    const navigation=[...document.querySelectorAll('header.payroll-navigation .form-control')].map(e=>{
        const s=getComputedStyle(e);return {id:e.id,font:s.fontSize,weight:s.fontWeight,clipped:e.scrollWidth>e.clientWidth+1};
    });
    const navigationFont=Math.min(.95*rem,Math.max((employeeForm ? .85 : .8)*rem,.0078*innerWidth));
    for(const field of navigation)if(Math.abs(parseFloat(field.font)-navigationFont)>.05||field.clipped)problems.push({kind:'navigation',expected:navigationFont,...field});
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
        let row=label.closest('.employee-fixed-left-fields,.employee-fixed-right-fields,.row,.employee-add-fixed-identity-row');
        if(row&&getComputedStyle(row).display==='contents')row=row.parentElement;
        const columns=row?[...row.children].flatMap(e=>getComputedStyle(e).display==='contents'?[...e.children]:[e]).filter(visible):[];
        const lc=columns.find(e=>e.contains(label)),fc=columns.find(e=>e.contains(field));
        const li=columns.indexOf(lc),fi=columns.indexOf(fc);
        const adjacentColumns=lc&&fc&&li<fi&&columns.slice(li+1,fi).every(e=>!e.querySelector('label,input:not([type="hidden"]),select,textarea'));
        const columnGap=adjacentColumns?box(fc).x-box(lc).right:Infinity;
        const grid=row&&getComputedStyle(row).display==='grid';
        const labelEdge=grid&&lc&&getComputedStyle(lc).gridColumnStart==='1'?box(row).x+parseFloat(getComputedStyle(row).gridTemplateColumns):lc?box(lc).right:0;
        const fieldEdge=grid&&fc&&getComputedStyle(fc).gridColumnStart==='2'?box(row).right:fc?box(fc).right:0;
        const columnAligned=adjacentColumns&&columnGap>=-2
            &&l.x>=box(lc).x-2&&l.right<=labelEdge+2
            &&f.x>=box(fc).x-2&&f.right<=fieldEdge+2;
        // A shared column/row determines spacing; the distance between text and input does not.
        let shared=label.parentElement;
        while(shared&&shared!==main&&!shared.contains(field))shared=shared.parentElement;
        const sharedFields=shared&&shared!==main?fields.map(renderedField).filter(e=>shared.contains(e)):[];
        const sameColumn=shared&&shared!==main&&(shared.matches('[class*="col-"],.form-group,.form-check,.input-group,.payroll-field-group')
            ||(sharedFields.length===1&&sharedFields[0]===field));
        const beside=Math.abs(l.y+l.height/2-f.y-f.height/2)<=Math.max(8,l.height/2)
            && (l.right<=f.x+2 || f.right<=l.x+2)
            && (columnAligned||sameColumn);
        const above=l.bottom<=f.y+2 && l.x<f.right && l.right>f.x
            &&(columnAligned||sameColumn||(adjacentColumns&&box(fc).y>=box(lc).bottom-2
                &&l.x>=box(lc).x-2&&l.right<=box(lc).right+2
                &&f.x>=box(fc).x-2&&f.right<=box(fc).right+2));
        const group=label.closest('.payroll-field-group');
        const contains=checkbox&&label.contains(target);
        const coherentHint=group&&group.contains(target)&&label.htmlFor&&[...group.querySelectorAll('label')].some(h=>h!==label&&h.htmlFor===label.htmlFor&&h.getBoundingClientRect().bottom<=f.y+2)
            &&l.bottom<=f.y+2&&l.x>=group.getBoundingClientRect().left-2&&l.x<group.getBoundingClientRect().right;
        if ((!beside&&!above&&!contains&&!coherentHint) || (group&&!group.contains(target))) problems.push({kind:'label',id:target.id,text:label.textContent.trim(),label:l,field:f,checkbox});
        if(label.scrollWidth>label.clientWidth+1||label.scrollHeight>label.clientHeight+1)problems.push({kind:'label-clipping',id:target.id,text:label.textContent.trim()});
        if(!contains&&labelOverlaps(label,field))problems.push({kind:'label-overlap',id:target.id,text:label.textContent.trim()});
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
        const footer=button.closest('.companies-management-page .companies-management-footer');
        const employeeFooter=footer&&employeeForm;
        const maxFont=button.closest('#employmentReviewWorkspace')?16.81:16.1;
        const minFont=footer?(employeeFooter ? .875 : .85)*rem-.05:14.39;
        if(parseFloat(s.fontSize)<minFont||parseFloat(s.fontSize)>maxFont)problems.push({kind:'button-readability',...fonts.at(-1)});
        if(footer){
            const expected=Math.min(rem,Math.max((employeeFooter ? .875 : .85)*rem,.72*rem+.0025*queryWidth(button)));
            if(Math.abs(parseFloat(s.fontSize)-expected)>.05)problems.push({kind:'footer-font',expected,...fonts.at(-1)});
        }
        if(!footer&&peerFont&&Math.abs(parseFloat(peerFont)-parseFloat(s.fontSize))>.1)problems.push({kind:'font',...fonts.at(-1)});
        if(s.fontWeight!=='400')problems.push({kind:'weight',...fonts.at(-1)});
        if(employeeFooter&&(b.height<34||b.height>42))problems.push({kind:'footer-height',...fonts.at(-1),height:b.height});
        if(button.scrollWidth>button.clientWidth+1||button.scrollHeight>button.clientHeight+1||textBoxes(button).some(r=>r.x<b.x-1||r.right>b.right+1||r.y<b.y-1||r.bottom>b.bottom+1))problems.push({kind:'caption',id:button.id,text:button.textContent.trim(),box:b,scroll:button.scrollWidth,client:button.clientWidth});
        if(!button.closest('table,.table-responsive,.maintenance-table-scroll,.payroll-entry-table')&&!horizontalBoundsOk(button))problems.push({kind:'button-width',id:button.id,text:button.textContent.trim(),box:b});
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
        if(!horizontalBoundsOk(field))problems.push({kind:'field-width',id:field.id||field.closest('.ts-wrapper')?.previousElementSibling?.id,box:b});
    }
    for(const reset of main.querySelectorAll('.ts-wrapper > .ts-fill-reset-btn:not([hidden])')){
        if(!visible(reset))continue;
        const wrapper=reset.closest('.ts-wrapper'),r=box(reset),w=box(wrapper),c=box(wrapper.parentElement);
        const companyExternal=reset.closest('.company-details-page .card-body');
        const userExternal=reset.closest('.user-privileges-layout .user-privileges-user-field');
        const external=companyExternal||userExternal;
        const gap=(companyExternal ? .25 : .375)*rem;
        const geometryOk=external?r.x>=w.right&&Math.abs(r.x-w.right-gap)<=1&&r.right<=c.right+1&&Math.abs(r.y+r.height/2-w.y-w.height/2)<=1:r.x>=w.x-1&&r.right<=w.right+1&&r.y>=w.y-1&&r.bottom<=w.bottom+1;
        const accessibility=whileScrolled(reset,()=>{
            const r=box(reset),painted=paintedBox(reset),x=r.x+r.width/2,y=r.y+r.height/2;
            const centerVisible=x>=painted.x&&x<=painted.right&&y>=painted.y&&y<=painted.bottom;
            const hit=centerVisible?document.elementFromPoint(x,y):null;
            const covered=!hit||!reset.contains(hit);
            const collision=fields.map(renderedField).some(f=>!wrapper.contains(f)&&intersects(paintedBox(f),painted));
            return {covered,collision};
        });
        const boundsOk=horizontalBoundsOk(reset);
        if(!geometryOk||accessibility.covered||accessibility.collision||!boundsOk||!(reset.getAttribute('aria-label')||reset.title)||reset.disabled)problems.push({kind:'tom-reset',id:reset.closest('.ts-wrapper').previousElementSibling?.id,box:r,wrapper:w,external:!!external,geometryOk,...accessibility,boundsOk});
    }
    const tabs=[...main.querySelectorAll('.menu_Links li')].filter(visible).map(box);
    for(const heading of main.querySelectorAll('.employee-retention-heading > .col-1 label'))if(visible(heading)&&heading.getBoundingClientRect().height>parseFloat(getComputedStyle(heading).lineHeight)+17)problems.push({kind:'retention-heading-wrap'});
    if(tabs.length&&Math.max(...tabs.map(b=>b.y))-Math.min(...tabs.map(b=>b.y))>1)problems.push({kind:'tabs-wrap'});
    return {problems,labels,fonts,controlFonts,navigation,fields:fields.length,groups:main.querySelectorAll('.payroll-field-group').length};
}

test('Actual EJS inventory: approved visual criteria and pending visual diagnostics', {skip:!vendor,timeout:600000}, async t => {
    assert.ok(sizes.length,'Viewport filter must select at least one size');
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({locale:'el-GR'});
    const errors=[],requests=[],results=[],renderErrors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
    if(artifactDir)fs.mkdirSync(artifactDir,{recursive:true});
    const selected=inventory.templates.filter(t=>t.kind==='page'&&(!process.env.PAYROLL_FORM_FILTER||new RegExp(process.env.PAYROLL_FORM_FILTER).test(t.template)));
    assert.ok(selected.length,'Form filter must select at least one inventory page');
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
                const result={template:form.template,visualApproval:approvedVisualTemplates.has(form.template)?'approved':'pending',section,width,height,sidebar:open?'open':'closed',...await page.evaluate(measure)};
                results.push(result);
                if(artifactDir&&((width===1280&&height===720&&open)||(width===1920&&!open))){
                    await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('main .card-body').forEach(e=>e.scrollTop=0);});
                    const name=form.template.replace(/^views\//,'').replace(/\.ejs$/,'').replaceAll('/','-');
                    await page.screenshot({path:path.join(artifactDir,`${name}-${section}-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
                }
            }
        }
        console.log(`${form.template}: ${Math.max(1,sections)*sizes.length*2} combinations; visual approval: ${approvedVisualTemplates.has(form.template)?'approved':'pending'}`);
    }
    const problems=results.flatMap(r=>r.problems.map(p=>({template:r.template,visualApproval:r.visualApproval,section:r.section,width:r.width,height:r.height,sidebar:r.sidebar,...p})));
    const approvedProblems=problems.filter(p=>p.visualApproval==='approved');
    const pendingProblems=problems.filter(p=>p.visualApproval==='pending');
    if(artifactDir){
        fs.writeFileSync(path.join(artifactDir,'visual-review-scope.json'),JSON.stringify(visualReviewScope,null,2));
        fs.writeFileSync(path.join(artifactDir,'results.json'),JSON.stringify(results,null,2));
        fs.writeFileSync(path.join(artifactDir,'problems.json'),JSON.stringify({renderErrors,errors,problems,approvedProblems,pendingProblems,blockedRequests:[...new Set(requests)]},null,2));
    }
    for(const form of selected.filter(f=>!approvedVisualTemplates.has(f.template))){
        const findings=pendingProblems.filter(p=>p.template===form.template);
        t.diagnostic(`${form.template}: visual approval pending; ${findings.length} diagnostic findings; not visually approved`);
        if(!artifactDir)for(const finding of findings)t.diagnostic(JSON.stringify(finding));
        await t.test(`Pending visual approval: ${form.template}`,{skip:'Diagnostic measurements do not constitute visual approval'},()=>{});
    }
    // Rendering and script failures remain mandatory for every selected page.
    assert.deepEqual(renderErrors,[],'Every selected actual EJS page must render');
    assert.deepEqual(errors,[],'Presentation scripts must run without errors');
    assert.equal(approvedProblems.length,0,JSON.stringify(approvedProblems.slice(0,15),null,2)+`\nApproved-page findings: ${approvedProblems.length}`);
});


// Synthetic geometry regression, independent of the application's supported viewport sizes.
test('Geometry checks distinguish scrollable content from clipped or oversized controls', async t=>{
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage({viewport:{width:800,height:700}});
    await page.setContent(`<style>
        body { margin:0; } main { width:800px; }
        .scroll { width:300px; height:80px; overflow:auto; position:relative; }
        .content { width:900px; height:60px; position:relative; }
        input,button { position:absolute; top:5px; width:80px; height:30px; }
        label { position:absolute; top:5px; height:30px; line-height:30px; white-space:nowrap; }
    </style><main>
        <div class="scroll"><div class="content">
            <input id="reachable" style="left:700px"><button id="reachable-button" style="left:800px">Action</button>
        </div></div>
        <div class="scroll"><div class="content">
            <label for="overlapping" style="left:700px">Overlapping text</label><input id="overlapping" style="left:720px">
        </div></div>
        <div class="scroll" style="overflow:hidden"><div class="content">
            <label for="clipped" style="left:700px">Clipped text</label><input id="clipped" style="left:720px">
            <button id="clipped-button" style="left:810px">Action</button>
        </div></div>
        <div class="scroll"><input id="oversized" style="width:400px"></div>
        <input id="page-overflow" style="left:850px">
        <div><label for="stacked" style="position:static;display:block">Label</label>
            <input id="stacked" style="position:static"></div>
    </main>`);
    const before=await page.evaluate(()=>[...document.querySelectorAll('.scroll')].map(e=>[e.scrollLeft,e.scrollTop]));
    const {problems}=await page.evaluate(measure);
    const ids=kind=>problems.filter(p=>p.kind===kind).map(p=>p.id).sort();
    assert.ok(!ids('label').includes('stacked'));
    assert.deepEqual(ids('label-overlap'),['overlapping']);
    assert.deepEqual(ids('field-width'),['clipped','oversized','page-overflow']);
    assert.deepEqual(ids('button-width'),['clipped-button']);
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.scroll')].map(e=>[e.scrollLeft,e.scrollTop])),before);
});
