'use strict';
// One offline Chromium, serial viewport checks. No app/server/database startup.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const ejs=require('ejs');
const {chromium}=require('playwright');
const R=require('../../server/utils/ergazomenoi/historicalProfileComparison');
const root=path.resolve(__dirname,'../..');
test('Chromium: κρυφή κεντρική αντιστοίχιση, ασφαλής απόδοση και μηδενικά αιτήματα χωρίς μεταβολή',async()=>{
    const employee={_id:'650000000000000000000031',kodikos:'0031',eponymo:'ΣΥΝΘΕΤΙΚΟΣ',onoma:'ΕΛΕΓΧΟΣ',
        afm:'123456789',amka:'12345678901',oristikh_enhmerosh:true,hmeromhnia_proslhpshs:'2026-10-01',
        hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,
        mo_oron_hmerhsias_ergasias:8,apasxolhsh_basei_symbashs:'5',pragmatikosMisthos:1400,
        stoixeio_symbashs_02:'<img src=x onerror="window.unexpectedScript=true">'};
    const comparison=R.clientBaseline(employee);
    const html=(await ejs.renderFile(path.join(root,'views/ergazomenoi/ergazomenoi/edit.ejs'),{
        ergazomenoiData:employee,rec:employee,companyData:{apasxolhsh_kata_tis_argies:true},
        employeeHistoryComparison:comparison,originalEmploymentHistoryId:'',originalEmploymentHistoryRevision:'',
        employeeStateToken:'',employeeHistoryStateToken:'',employeeHistoryAccessMode:'ADMIN_FULL',problematicHistoryIds:[],
        istorikoData:[],orariaData:[],perifereies:[],genikesParametroi:[],sessionYearInUse:2026,
        companyInUse:'TEST',userTeam:'TEST',NODE_ENV:'development',nonce:'',csrfToken:'synthetic',userRole:'A',
        CONFIG:{EGGRAFES:20},script:()=>'',mode:'edit',context:'ergazomenoi'
    })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});
    try {
        const page=await browser.newPage({locale:'el-GR'}),requests=[];
        await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
        await page.setContent('<!doctype html><html><meta charset="utf-8"><body><div style="display:flex">'+
            '<aside id="syntheticSidebar" style="width:240px;flex:none"></aside><main style="flex:1;min-width:0">'+html+'</main></div></body></html>');
        await page.addStyleTag({path:path.join(root,'public/css/bootstrap.min.css')});
        await page.addStyleTag({path:path.join(root,'public/css/main.css')});
        await page.addScriptTag({path:path.join(root,'public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi.js')});
        for (const width of [1600,1280,800]) for (const open of [true,false]) {
            await page.setViewportSize({width,height:900});
            await page.locator('#syntheticSidebar').evaluate((node,visible)=>{node.style.display=visible ? 'block' : 'none';},open);
            const state=await page.evaluate(async()=>{
                const node=document.getElementById('employeeApprovedHistoryAtomicBaseline');
                const parsed=JSON.parse(node.dataset.profileBaseline);
                let calls=0;
                const result=await window.employeeApprovedHistoryAtomicSaveUi.tryHandle({baselineNode:node,
                    formData:{hmeres_ergasias_ebdomadas:'5',typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:'40',
                        mo_oron_hmerhsias_ergasias:'8',pragmatikosMisthos:'1400',arithmos:'12'},
                    fetcher:()=>{calls++;throw Error('Unexpected request');},swal:{fire:()=>{calls++;throw Error('Unexpected dialog');}}});
                const main=document.querySelector('main').getBoundingClientRect(),rect=node.getBoundingClientRect();
                return {count:parsed.fields.length,value:parsed.fields.find(entry=>entry.field === 'stoixeio_symbashs_02').value,
                    hidden:rect.width === 0 && rect.height === 0,calls,result,script:window.unexpectedScript === true,
                    mainWidth:main.width,viewport:innerWidth};
            });
            assert.equal(state.count,91);
            assert.equal(state.value,employee.stoixeio_symbashs_02);
            assert.equal(state.script,false);
            assert.equal(state.hidden,true);
            assert.equal(state.calls,0);
            assert.deepEqual(state.result,{handled:false});
            assert.ok(state.mainWidth > 0 && state.mainWidth <= state.viewport);
        }
        assert.equal(requests.length,0);
    } finally {await browser.close();}
});
