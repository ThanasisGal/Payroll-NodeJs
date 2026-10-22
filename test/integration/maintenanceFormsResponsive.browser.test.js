'use strict';
// Actual templates and local assets only. No application, database or write handler.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const dropdownSource = fs.readFileSync(path.join(root,'public/js/dropdown-item.js'),'utf8').replace(/^export /gm,'');
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[1100,700],[800,700]];
// Presentation fixtures omit startup; represent the ready form, as in the
// employee-specific geometry fixture. Live loading/inert behavior has separate coverage.
const strip = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('data-employee-form-state="loading"', 'data-employee-form-state="ready"')
    .replace(/(class="tadded-container employee-maintenance-form maintenance-responsive-form") inert/g, '$1')
    .replace(/src="https:\/\/cdn.webpayrollsolutions.com[^"]+"/g,
        `src="data:image/png;base64,${fs.readFileSync(path.join(root,'public/img/wps1.png')).toString('base64')}"`);

const employee = { _id:'synthetic', kodikos:'0001', team:'TEST', company_kod:'TEST', eponymo:'ΔΟΚΙΜΑΣΤΙΚΟΣ', onoma:'ΕΡΓΑΖΟΜΕΝΟΣ', afm:'199999999', amka:'12345678901', oristikh_enhmerosh:false, hmeromhnia_proslhpshs:'2026-10-01' };
const user = { _id:'synthetic', id:'synthetic', firstName:'ΔΟΚΙΜΑΣΤΙΚΟΣ', lastName:'ΧΡΗΣΤΗΣ', privileges:'U', situation:'A', updatedAt:'2026-10-01', team:'TEST', email:'test@example.invalid' };
const company = { _id:'synthetic', kod:'0001', eponymia:'ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ', afm:'199999999' };
const contract = { _id:'synthetic', kodikos:'0001', perigrafh:'Δοκιμαστική σύμβαση εργασίας' };
const locals = {
    ergazomenoiData:employee, rec:employee, companyData:{apasxolhsh_kata_tis_argies:true},
    originalEmploymentHistoryId:'', originalEmploymentHistoryRevision:'', employeeStateToken:'',
    employeeHistoryStateToken:'', employeeHistoryAccessMode:'ADMIN_FULL', problematicHistoryIds:[],
    istorikoData:[], orariaData:[], perifereies:[], genikesParametroi:[], sessionYearInUse:2026,
    companyInUse:'TEST', userTeam:'TEST', NODE_ENV:'development', nonce:'', csrfToken:'', userRole:'A',
    userPrivileges:{admin:true,create:true,edit:true,delete:true,privileges:{admin:true,read:true,create:true,edit:true,delete:true}}, CONFIG:{EGGRAFES:20}, script:()=>'', mode:'edit', context:'ergazomenoi', users:user,
    userRoleOptions:[{value:'U',label:'Χρήστης'},{value:'S',label:'Supervisor'}], normalizedUserRole:'U',
    getUserRoleLabel:require('../../server/constants/userRoles').getUserRoleLabel, managedTeam:'TEST', canManageAllTeams:false, company, symbaseis:contract, aa_kodikos:2,
    sTerm:'Δοκιμή', entries:20, basePer:20, current:1, pages:1, perx:1, showInactive:false, messages:{}, isAdminOrSupervisorRole:()=>true
};
const forms = [
    ['employee','views/ergazomenoi/ergazomenoi/edit.ejs',{}],
    ['user-add','views/users/add.ejs',{}], ['user-edit','views/users/edit.ejs',{}],
    ['user-delete','views/users/delete.ejs',{}], ['user-view','views/users/view.ejs',{}], ['user-list','views/index.ejs',{users:[user]}], ['user-search','views/search.ejs',{user:[user]}],
    ['user-privileges','views/users/dikaiomataXrhston.ejs',{}],
    ['company-add','views/companies/genikastoixeia/add.ejs',{mode:'add',context:'company',rec:company}],
    ['company-edit','views/companies/genikastoixeia/edit.ejs',{context:'company',rec:company}],
    ['company-list','views/companies/genikastoixeia/companies.ejs',{company:[company]}], ['company-search','views/companies/genikastoixeia/search.ejs',{companyFilteredRecs:[company]}],
    ['contract-add','views/symbaseis/symbaseis/add.ejs',{}],
    ['contract-edit','views/symbaseis/symbaseis/edit.ejs',{}],
    ['contract-list','views/symbaseis/symbaseis/symbaseis.ejs',{symbaseis:[contract]}], ['contract-search','views/symbaseis/symbaseis/search.ejs',{symbaseisFilteredRecs:[contract]}]
];

// Approval labels describe the agreed scope, never an automatic passing result.
// Every form remains mandatory, including pending employee and contract coverage.
const suites = [
    ['Approved users', forms.filter(([name]) => name.startsWith('user-'))],
    ['Approved companies: general details', forms.filter(([name]) => name.startsWith('company-'))],
    ['Pending employees', forms.filter(([name]) => name === 'employee')],
    ['Other maintenance coverage: contracts', forms.filter(([name]) => name.startsWith('contract-'))]
];
assert.deepEqual(suites.flatMap(([, entries]) => entries.map(([name]) => name)).sort(),
    forms.map(([name]) => name).sort(), 'Every original form must occur in exactly one mandatory suite');

for (const [suiteName, suiteForms] of suites) {
test(`${suiteName}: typography, tabs, collision bounds and scroll reachability`, {timeout:180000}, async t => {
    assert.ok(vendor, 'PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR must provide the local Tom Select assets');
    const browser = await chromium.launch({headless:true}); t.after(()=>browser.close());
    // Awaited subtests report failures without preventing the other forms from running.
    for (const [name,file,extra] of suiteForms) await t.test(name, async t => {
    const page = await browser.newPage({locale:'el-GR'});
    t.after(()=>page.close());
    const requests=[], errors=[], results=[];
    t.after(()=>{
        if(process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,{recursive:true});
            fs.writeFileSync(path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,`maintenance-${name}.json`),
                JSON.stringify({suite:suiteName,form:name,completedCombinations:results},null,2));
        }
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{if(r.request().url()==='https://cdn.webpayrollsolutions.com/assets/img/wps1.png')return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/img/wps1.png'))});if(r.request().url()==='https://payroll.test/__fixture__')return r.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'});requests.push(r.request().url());return r.abort();});
    await page.goto('https://payroll.test/__fixture__');
    const sidebar = strip(await ejs.renderFile(path.join(root,'views/partials/sidebar.ejs'),{...locals,userId:''}))
        .replace(/<img\b[^>]*>/g,'');
    const html=strip(await ejs.renderFile(path.join(root,file),{...locals,...extra}));
        await page.setContent(`<!doctype html><html lang="el"><meta charset="utf-8"><body><div class="container-fluid container-scroll"><div class="row">${sidebar}<main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent payroll-form-layout">${html}</main></div></div></body></html>`);
        await page.addStyleTag({path:path.join(vendor,'tom-select.css')});
        for (const asset of ['public/css/bootstrap.min.css','public/css/main.css']) await page.addStyleTag({path:path.join(root,asset)});
        await page.addScriptTag({path:path.join(root,'public/js/bootstrap.bundle.min.js')});
        await page.addScriptTag({path:path.join(vendor,'tom-select.complete.js')});
        await page.addScriptTag({content:'(() => {'+dropdownSource+'})();'});
        await page.evaluate(()=>{
            window.fetch=async()=>({ok:true,json:async()=>({items:[{value:'TEST',label:'Δοκιμαστική επιλογή'}],hasMore:false})});
            document.querySelectorAll('select.tom-dropdown').forEach(e=>window.initTomDropdown({selector:'#'+CSS.escape(e.id),url:'https://synthetic.invalid/options'}));
        });
        if(name==='company-add')await page.addScriptTag({path:path.join(root,'public/js/companies/genikastoixeia/addFixedDetailsLayout.js')});
        await page.evaluate(()=>document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>e.preventDefault())));
        await page.addScriptTag({ path: path.join(root, 'public/js/common/formLayout.js') });
        for (const [width,height] of sizes) for (const open of [true,false]) {
            await page.setViewportSize({width,height});
            await page.evaluate(open=>{
                document.getElementById('sidebarMenu').classList.toggle('d-none',!open);
                const main=document.querySelector('main'); main.style.setProperty('width',open?'':'100%','important');main.style.setProperty('margin-left',open?'':'0px','important');
            },open);
            const sections = await page.locator('.sections > section').count();
            for (let section=0;section<Math.max(1,sections);section++) {
                await page.evaluate(async section=>{
                    document.querySelectorAll('.sections > section').forEach((e,i)=>{e.style.display=i===section?'block':'none';e.classList.toggle('visible',i===section);});
                    window.dispatchEvent(new Event('resize'));
                    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                },section);
                await page.evaluate(()=>document.getAnimations().forEach(a=>{if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();}));
                const label=`${name}/${section}/${width}x${height}/${open?'open':'closed'}`;
                const result=await page.evaluate(scopeSelector=>{
                    const scope=document.querySelector(scopeSelector);
                    if(!scope)throw new Error(`Missing form scope: ${scopeSelector}`);
                    // Companies intentionally use a separate compact footer scale.
                    // Compute its contract from rem and the actual query container,
                    // independently of the CSS variable being checked.
                    const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
                    const companyFont=(e,footer)=>{
                        let container=e.parentElement;
                        while(container && getComputedStyle(container).containerType==='normal')container=container.parentElement;
                        if(!container)throw new Error('Missing company font query container');
                        const style=getComputedStyle(container);
                        const contentWidth=parseFloat(style.width)-(style.boxSizing==='border-box'
                            ? ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((sum,key)=>sum+parseFloat(style[key]),0):0);
                        const footerMinimum=scope.matches('.employee-add-page,.employee-edit-page') ? .875 : .85;
                        return Math.min(rem,Math.max((footer ? footerMinimum : .9)*rem,(footer ? .72 : .78)*rem+.0025*contentWidth));
                    };
                    const visible=e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden' && !e.matches('select.tomselected,.sr-only,.visually-hidden');
                    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
                    const intersects=(a,b)=>a.left<b.right-.5&&b.left<a.right-.5&&a.top<b.bottom-.5&&b.top<a.bottom-.5;
                    const buttons=[...scope.querySelectorAll('button,.btn,a.buttons-content')].filter(e=>visible(e)&&!e.matches('.btn-close,.btn-toTop,.accordion-button,.istoriko-btn,.clear-btn,#gotoProgrammaDypa,.clear-row,.ts-fill-reset-btn,.edit-apodoxes-tom-trash,.edit-employee-tom-trash,.btn-small'));
                    const collisions=[], clipped=[];
                    const measurements=buttons.map(e=>{
                        const r=box(e),s=getComputedStyle(e),row=e.closest('.row.form-group');
                        const wrappedPdf=e.matches('.employee-edit-page .employee-fixed-left-fields .pdf-button-wrapper > :is(a.buttons-content,.pdf-upload-btn), :is(.employee-add-page,.employee-edit-page) :is(#customButton_oysiodeis_oroi,#customButton_allodapoi,#customButton_arxeio_symbashs)');
                        const textRects=[],walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
                        while(walker.nextNode())if(walker.currentNode.textContent.trim()){
                            const range=document.createRange();range.selectNodeContents(walker.currentNode);
                            textRects.push(...range.getClientRects());
                        }
                        const captionContained=textRects.every(t=>t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1);
                        if(row) for(const target of row.querySelectorAll('label,input:not([type="hidden"]),select,.ts-control,button,.btn')) {
                            if(target===e||e.contains(target)||!visible(target)||target.contains(e))continue;
                            if(intersects(r,box(target)))collisions.push([e.id||e.textContent.trim(),target.id||target.textContent.trim()]);
                        }
                        // Off-screen content is allowed only in the approved local company scrollers.
                        // Every action there must also pass the full visibility/hit check after scrolling below.
                        const scroller=e.closest('.company-details-page .company-diafora-scroll-container,.companies-management-page .companies-management-footer');
                        const localScroll=scroller && ['auto','scroll'].includes(getComputedStyle(scroller).overflowX)
                            && scroller.scrollWidth>scroller.clientWidth+1;
                        const column=e.matches('#select-all,#clear-image') && e.closest('.company-diafora-scroll-container')?box(e.parentElement):null;
                        if(e.scrollWidth>e.clientWidth+1||(!localScroll && (r.right>innerWidth+1||r.left<0))
                            ||(column && (r.left<column.left-1||r.right>column.right+1)))clipped.push({id:e.id||e.textContent.trim(),width:r.width,scroll:e.scrollWidth,client:e.clientWidth,parent:box(e.parentElement),column:box(e.closest('.row > div')||e.parentElement)});
                        return {id:e.id,wrappedPdf,captionContained,text:e.textContent.trim(),...r,companyFooter:!!e.closest('.companies-management-footer'),employeeFooter:!!e.closest(':is(.employee-add-page,.employee-edit-page) .companies-management-footer'),expectedCompanyFont:scope.matches('.companies-management-page')?companyFont(e,!!e.closest('.companies-management-footer')):null,font:parseFloat(s.fontSize),weight:s.fontWeight,radius:s.borderRadius,nowrap:s.whiteSpace};
                    });
                    const inputs=[...scope.querySelectorAll('.form-control:not([type="hidden"]),.form-select')].filter(visible);
                    const tabs=[...scope.querySelectorAll('.menu_Links li')].filter(visible).map(box);
                    const scroll=[...scope.querySelectorAll('.card-body')].filter(visible).map(e=>{
                        const start=e.scrollTop;e.scrollTop=e.scrollHeight;const reached=e.scrollTop+e.clientHeight>=e.scrollHeight-1;e.scrollTop=start;
                        return {overflow:getComputedStyle(e).overflowY,reached,scroll:e.scrollHeight,client:e.clientHeight};
                    });
                    return {buttons:measurements,inputs:inputs.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),expectedCompanyFont:scope.matches('.companies-management-page')?companyFont(e,false):null,...box(e)})),collisions,clipped,tabs,scroll,viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,companyFooterFonts:[...scope.querySelectorAll('.companies-management-footer :is(.btn,.page-link,.small)')].filter(visible).map(e=>({font:parseFloat(getComputedStyle(e).fontSize),expected:companyFont(e,true)})),rem};
                },name==='user-delete'?'.user-delete-confirmation':'.maintenance-responsive-form');
                if(name==='user-delete')assert.equal(result.buttons.length,2,`${label}: both confirmation actions must be measured`);
                assert.deepEqual(result.collisions,[],`${label}: collisions`);
                assert.deepEqual(result.clipped,[],`${label}: clipped captions`);
                assert.equal(result.viewportOverflow,false,`${label}: page overflow`);
                for(const b of result.buttons){
                    if(b.expectedCompanyFont!==null)assert.ok(Math.abs(b.font-b.expectedCompanyFont)<.05,`${label}: company action scale ${b.font} expected ${b.expectedCompanyFont}`);
                    assert.ok(b.font>=(b.employeeFooter ? 14 : b.companyFooter ? .85*result.rem : 14.4),`${label}: font ${b.font}`);assert.equal(b.weight,'400',`${label}: ${b.text} weight`);
                    if(result.inputs.length && !b.companyFooter)assert.ok(Math.abs(b.font-result.inputs[0].font)<.05,`${label}: field/action font mismatch ${JSON.stringify(b)} input ${result.inputs[0].font}`);
                    assert.equal(b.nowrap,b.wrappedPdf?'normal':'nowrap',`${label}: ${b.text} white-space ${JSON.stringify(b)}`);
                    if(b.wrappedPdf){
                        assert.ok(b.captionContained,`${label}: PDF caption clipped ${JSON.stringify(b)}`);
                        const action=page.locator('#'+b.id);
                        await action.scrollIntoViewIfNeeded();
                        assert.ok(await action.evaluate(e=>{
                            // Bootstrap deliberately excludes disabled buttons from hit testing.
                            // Probe the enabled fixture state, then restore it without clicking.
                            const disabled=e.disabled;
                            try {
                                e.disabled=false;
                                const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                                return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&!!hit&&e.contains(hit);
                            } finally { e.disabled=disabled; }
                        }),`${label}: PDF action inaccessible ${b.id}`);
                    }
                }
                for(const input of result.inputs)if(input.expectedCompanyFont!==null)assert.ok(Math.abs(input.font-input.expectedCompanyFont)<.05,`${label}: company field scale ${input.font} expected ${input.expectedCompanyFont}`);
                for(const footer of result.companyFooterFonts)assert.ok(Math.abs(footer.font-footer.expected)<.05,`${label}: company footer scale ${footer.font} expected ${footer.expected}`);
                const localActions=await page.evaluate(async()=>{
                    const checks=[];
                    for(const scroller of document.querySelectorAll('.company-details-page .company-diafora-scroll-container,.companies-management-page .companies-management-footer')) {
                        if(!scroller.getClientRects().length)continue;
                        for(const action of scroller.querySelectorAll('button,.btn,.page-link')) {
                            if(!action.getClientRects().length || getComputedStyle(action).visibility==='hidden')continue;
                            const positions=[];
                            for(let node=action.parentElement;node;node=node.parentElement)positions.push([node,node.scrollLeft,node.scrollTop]);
                            action.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
                            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                            const r=action.getBoundingClientRect(),s=scroller.getBoundingClientRect();
                            const left=s.left+scroller.clientLeft,top=s.top+scroller.clientTop;
                            const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                            // Disabled links and the current-page span remain visible, passive indicators.
                            const passive=action.disabled||action.matches('.disabled-link,.disabled,[aria-disabled="true"]')
                                ||action.closest('.page-item.disabled')||(action.matches('span.page-link')&&action.closest('[aria-current="page"]'));
                            checks.push({action:action.id||action.textContent.trim()||action.getAttribute('aria-label')||action.innerHTML,
                                localOverflow:['auto','scroll'].includes(getComputedStyle(scroller).overflowX),
                                contained:r.left>=left-1&&r.right<=left+scroller.clientWidth+1&&r.top>=top-1&&r.bottom<=top+scroller.clientHeight+1,
                                inViewport:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,
                                reachable:!!hit&&(action.contains(hit)||(passive&&hit.contains(action)))});
                            for(const [node,x,y] of positions){node.scrollLeft=x;node.scrollTop=y;}
                        }
                    }
                    return checks;
                });
                for(const check of localActions)assert.ok(check.localOverflow&&check.contained&&check.inViewport&&check.reachable,`${label}: local action inaccessible ${JSON.stringify(check)}`);
                if(result.tabs.length)assert.ok(Math.max(...result.tabs.map(r=>r.top))-Math.min(...result.tabs.map(r=>r.top))<1,`${label}: tabs wrap`);
                assert.ok(result.scroll.every(s=>s.reached),`${label}: last field inaccessible`);
                // Keyboard scrolling must reach the end without a save action.
                const body=page.locator('.card-body:visible').first();
                if(await body.count()) {
                    await body.evaluate(e=>{e.tabIndex=0;e.scrollTop=0;});await body.focus();await page.keyboard.press('Control+End');
                }
                if(process.env.PAYROLL_VISUAL_ARTIFACT_DIR && [0,sections-1].includes(section)) {
                    fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,{recursive:true});
                    await page.screenshot({path:path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,`${name}-${section}-${width}x${height}-${open?'open':'closed'}.png`),animations:'disabled'});
                }
                if(width===1280 && height===720 || width===800) {
                    const fields=page.locator('.card-body:visible input.form-control:not([type="hidden"]):visible,.card-body:visible input.date-control:visible,.card-body:visible textarea:visible');
                    for(const field of [fields.first(),fields.last()]) if(await field.count()) {
                        await field.scrollIntoViewIfNeeded();
                        assert.ok(await field.evaluate(e=>{const r=e.getBoundingClientRect(),b=e.closest('.card-body').getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;}),`${label}: field clipped vertically ${await field.evaluate(e=>({id:e.id,box:JSON.stringify(e.getBoundingClientRect()),body:JSON.stringify(e.closest('.card-body').getBoundingClientRect())})) .then(JSON.stringify)}`);
                    }
                    const select=page.locator('.ts-wrapper:visible').first();
                    if(await select.count()) {
                        await select.scrollIntoViewIfNeeded();
                        const dropdown=await select.evaluate(async e=>{
                            const tom=e.querySelector('select')?.tomselect || e.previousElementSibling?.tomselect;
                            if(!tom||tom.isDisabled)return null;
                            tom.addOption({value:'TEST',label:'Δοκιμαστική επιλογή'});tom.refreshOptions(false);tom.open();
                            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                            const d=tom.dropdown.getBoundingClientRect(),body=e.closest('.card-body'),b=body?.getBoundingClientRect();
                            const result={top:d.top,bottom:d.bottom,left:d.left,right:d.right,bodyTop:b?.top??0,bodyBottom:b?.bottom??innerHeight};tom.close();return result;
                        });
                        if(dropdown)assert.ok(dropdown.top>=dropdown.bodyTop-1&&dropdown.bottom<=dropdown.bodyBottom+1&&dropdown.right<=width+1,`${label}: clipped dropdown ${JSON.stringify(dropdown)}`);
                    }
                    for(const action of await page.locator('.card-footer:visible :is(button,a.btn):not(.btn-toTop)').all()) {
                        await action.scrollIntoViewIfNeeded();
                        assert.ok(await action.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight+1&&!!hit&&(e.contains(hit)||((e.disabled||e.matches('.disabled-link,.disabled,[aria-disabled="true"]'))&&hit.contains(e))); }),`${label}: inaccessible footer action`);
                    }
                }
                const table=page.locator('.maintenance-table-scroll:visible');
                if(await table.count())assert.ok(await table.evaluate(e=>{e.scrollLeft=e.scrollWidth;const last=e.querySelector('#myTableHeader th:last-child').getBoundingClientRect(),r=e.getBoundingClientRect();return last.right<=r.right+1&&last.left>=r.left-1;}),`${label}: table last column inaccessible`);
                assert.ok(await page.locator('.menu_Links li').evaluateAll(tabs=>tabs.every(e=>{
                    e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
                    const r=e.getBoundingClientRect(),p=e.closest('ul').getBoundingClientRect();
                    return r.left>=p.left-1&&r.right<=p.right+1;
                })),`${label}: tab unreachable`);
                results.push({label,...result});
            }
            if(name==='user-edit') {
                await page.evaluate(()=>{const e=document.getElementById('deleteModal');e.classList.remove('fade');bootstrap.Modal.getOrCreateInstance(e).show();});
                const modal=page.locator('#deleteModal');await modal.waitFor({state:'visible'});
                assert.ok(await modal.locator('.modal-footer button').first().isVisible());
                await page.evaluate(()=>bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide());
                await modal.waitFor({state:'hidden'});
            }
        }
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    console.log(`${suiteName}/${name}: verified ${results.length} form/section/viewport/sidebar combinations with actual templates.`);
    });
});
}
