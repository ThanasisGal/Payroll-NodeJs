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
const strip = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
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

test('Four maintenance areas: typography, tabs, collision bounds and scroll reachability', {timeout:180000,skip:!vendor}, async t => {
    const browser = await chromium.launch({headless:true}); t.after(()=>browser.close());
    const page = await browser.newPage({locale:'el-GR'});
    const requests=[], errors=[], results=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{if(r.request().url()==='https://cdn.webpayrollsolutions.com/assets/img/wps1.png')return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/img/wps1.png'))});if(r.request().url()==='https://payroll.test/__fixture__')return r.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'});requests.push(r.request().url());return r.abort();});
    await page.goto('https://payroll.test/__fixture__');
    const sidebar = strip(await ejs.renderFile(path.join(root,'views/partials/sidebar.ejs'),{...locals,userId:''}))
        .replace(/<img\b[^>]*>/g,'');
    const rendered=[];
    for (const [name,file,extra] of forms) rendered.push([name,strip(await ejs.renderFile(path.join(root,file),{...locals,...extra}))]);
    for (const [name,html] of rendered) {
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
                const result=await page.evaluate(()=>{
                    const scope=document.querySelector('.maintenance-responsive-form');
                    const visible=e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden' && !e.matches('select.tomselected,.sr-only,.visually-hidden');
                    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
                    const intersects=(a,b)=>a.left<b.right-.5&&b.left<a.right-.5&&a.top<b.bottom-.5&&b.top<a.bottom-.5;
                    const buttons=[...scope.querySelectorAll('button,.btn,a.buttons-content')].filter(e=>visible(e)&&!e.matches('.btn-close,.btn-toTop,.accordion-button,.istoriko-btn,.clear-btn,#gotoProgrammaDypa,.clear-row,.ts-fill-reset-btn,.edit-apodoxes-tom-trash,.edit-employee-tom-trash,.btn-small'));
                    const collisions=[], clipped=[];
                    const measurements=buttons.map(e=>{
                        const r=box(e),s=getComputedStyle(e),row=e.closest('.row.form-group');
                        if(row) for(const target of row.querySelectorAll('label,input:not([type="hidden"]),select,.ts-control,button,.btn')) {
                            if(target===e||e.contains(target)||!visible(target)||target.contains(e))continue;
                            if(intersects(r,box(target)))collisions.push([e.id||e.textContent.trim(),target.id||target.textContent.trim()]);
                        }
                        if(e.scrollWidth>e.clientWidth+1||r.right>innerWidth+1||r.left<0)clipped.push({id:e.id||e.textContent.trim(),width:r.width,scroll:e.scrollWidth,client:e.clientWidth,parent:box(e.parentElement),column:box(e.closest('.row > div')||e.parentElement)});
                        return {text:e.textContent.trim(),...r,font:parseFloat(s.fontSize),weight:s.fontWeight,radius:s.borderRadius,nowrap:s.whiteSpace};
                    });
                    const inputs=[...scope.querySelectorAll('.form-control:not([type="hidden"]),.form-select')].filter(visible);
                    const tabs=[...scope.querySelectorAll('.menu_Links li')].filter(visible).map(box);
                    const scroll=[...scope.querySelectorAll('.card-body')].filter(visible).map(e=>{
                        const start=e.scrollTop;e.scrollTop=e.scrollHeight;const reached=e.scrollTop+e.clientHeight>=e.scrollHeight-1;e.scrollTop=start;
                        return {overflow:getComputedStyle(e).overflowY,reached,scroll:e.scrollHeight,client:e.clientHeight};
                    });
                    return {buttons:measurements,inputs:inputs.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),...box(e)})),collisions,clipped,tabs,scroll,viewportOverflow:document.documentElement.scrollWidth>innerWidth+1};
                });
                assert.deepEqual(result.collisions,[],`${label}: collisions`);
                assert.deepEqual(result.clipped,[],`${label}: clipped captions`);
                assert.equal(result.viewportOverflow,false,`${label}: page overflow`);
                for(const b of result.buttons){
                    assert.ok(b.font>=14.4,`${label}: font ${b.font}`);assert.equal(b.weight,'400',`${label}: ${b.text} weight`);
                    if(result.inputs.length)assert.ok(Math.abs(b.font-result.inputs[0].font)<.05,`${label}: field/action font mismatch ${JSON.stringify(b)} input ${result.inputs[0].font}`);
                    assert.equal(b.nowrap,'nowrap');
                }
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
    }
    if(process.env.PAYROLL_VISUAL_ARTIFACT_DIR)fs.writeFileSync(path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,'maintenance-four-areas.json'),JSON.stringify(results,null,2));
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    console.log(`Verified ${results.length} form/section/viewport/sidebar combinations with actual templates.`);
});
