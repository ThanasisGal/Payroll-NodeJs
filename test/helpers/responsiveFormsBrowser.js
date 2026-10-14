'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { root, dataFor, render } = require('../fixtures/responsiveForms');
const strip = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '').replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

async function addTypographyAssets(page, vendor) {
    const iconData=fs.readFileSync(path.join(vendor,'bootstrap-icons.woff2')).toString('base64');
    await page.addStyleTag({content:fs.readFileSync(path.join(vendor,'bootstrap-icons.css'),'utf8')
        .replace(/src:[\s\S]*?;/,`src:url(data:font/woff2;base64,${iconData}) format("woff2");`)});
    for(const weight of [400,600,700]){
        const data=fs.readFileSync(path.join(vendor,`RobotoMono-${weight}.ttf`)).toString('base64');
        await page.addStyleTag({content:`@font-face{font-family:'Roboto Mono';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${data}) format('truetype');}`});
    }
    await page.evaluate(()=>document.fonts.ready);
}

async function loadForm(page, file, { baselineCss, baseline = false, vendor, populated = true } = {}) {
    if (page.url() === 'about:blank') {
        await page.route('https://payroll.test/__fixture__', r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="el"></html>'}));
    }
    // A fresh document prevents registries and DOMContentLoaded handlers leaking between forms.
    await page.goto('https://payroll.test/__fixture__');
    const body = await render(file);
    let html = strip(await ejs.renderFile(path.join(root,'views/layouts/main.ejs'), { ...dataFor(file), body }));
    // All resources stay local. Preserve actual images where a matching local asset exists.
    html = html.replace(/(<img\b[^>]*\bsrc=")[^"]+("[^>]*>)/gi, (_, start, end) =>
        start+'data:image/png;base64,'+fs.readFileSync(path.join(root,'public/img/wps1.png')).toString('base64')+end);
    await page.setContent(html);
    await page.addStyleTag({ path:path.join(root,'public/css/bootstrap.min.css') });
    await addTypographyAssets(page, vendor);
    await page.addStyleTag({ path:path.join(vendor,'tom-select.css') });
    await page.addStyleTag(baselineCss ? {content:baselineCss} : {path:path.join(root,'public/css/main.css')});
    await page.addStyleTag({ path:path.join(root,'public/css/navTabs.css') });
    await page.evaluate(()=>document.fonts.ready);
    await page.addScriptTag({ path:path.join(root,'public/js/bootstrap.bundle.min.js') });
    await page.addScriptTag({ path:path.join(vendor,'tom-select.complete.js') });
    await page.evaluate(populated => {
        // Remote data is replaced in memory, including search and long catalogs.
        window.__fixtureSearches = [];
        window.fetch = async url => {
            const params = new URL(url,'https://payroll.test').searchParams;
            const query = params.get('search') || '';
            window.__fixtureSearches.push(query);
            const value = params.get('value');
            if(value)return {ok:true,json:async()=>({items:[{value,label:value+' — Δοκιμαστική επιλεγμένη τιμή'}],hasMore:false})};
            const items = Array.from({length:60},(_,i)=>({value:'TEST'+i,label:`Δοκιμαστική επιλογή ${i} με μακροσκελή ονομασία υποκαταστήματος`}));
            return {ok:true,json:async()=>({items:items.filter(o=>o.label.toLowerCase().includes(query.toLowerCase())),hasMore:false})};
        };
        document.querySelectorAll('main input:not([type="hidden"]),main textarea').forEach(e=>{
            if(e.value || e.matches('[type="checkbox"],[type="radio"],[type="file"],[type="button"],[type="submit"]'))return;
            e.value=e.type==='date'?'2026-10-14':e.type==='time'?'12:30':e.type==='month'?'2026-10'
                :e.type==='number'?'8':e.type==='email'?'test@example.invalid':e.type==='password'?'Synthetic9!'
                :/afm/i.test(e.id)?'199999999':/amka|ama_krathshs/i.test(e.id)?'12345678901':/kod|code/i.test(e.id)?'0001'
                :/kpk|^kad$|^epa$|typos_apodoxon|^eidikothta$/.test(e.id)?'0001'
                :/apo_ora|eos_ora|synolo_oron/.test(e.id)?'12:30'
                :/poso|apodox|misth|oromisth|synolo|foros|foroy|axia|ekptosh|eisfora|amoib/.test(e.id)?'1234.56'
                :/phone|thlefono|^tel$/i.test(e.id)?'2101234567':'Δοκιμαστικό περιεχόμενο';
            if(e.maxLength>0)e.value=e.value.slice(0,e.maxLength);
        });
        document.querySelectorAll('main select').forEach(e=>{
            if(e.options.length)return;
            if(e.matches('.tom-dropdown') && !populated)return;
            e.add(new Option('Δοκιμαστική επιλογή με μακροσκελή ονομασία','TEST0',true,true));
        });
        document.querySelectorAll('main form').forEach(f=>f.addEventListener('submit',e=>e.preventDefault()));
    },populated);
    const dropdownSource=fs.readFileSync(path.join(root,'public/js/dropdown-item.js'),'utf8').replace(/^export /gm,'');
    const initSource=fs.readFileSync(path.join(root,'public/js/common/initTomDropdown.js'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'');
    await page.addScriptTag({content:'(() => {'+dropdownSource+'\n'+initSource+'\ninitAllTomSelects();})();'});
    if (file === 'views/ergazomenoi/ergazomenoi/edit.ejs') {
        await page.addScriptTag({path:path.join(root,'public/js/ergazomenoi/genika/editKrathseisTomTrash.js')});
    }
    // Real presentation handlers; never load save, calculation or submission scripts.
    if (!baseline) await page.addScriptTag({path:path.join(root,'public/js/common/formLayout.js')});
    if (body.includes('sectionsVisible')) {
        await page.addScriptTag({path:path.join(root,'public/js/common/sectionsVisible.js')});
    }
    if (body.includes('fillLabelFromInput')) await page.addScriptTag({path:path.join(root,'public/js/ergazomenoi/genika/fillLabelFromInput.js')});
    await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
    return body;
}
async function viewport(page,width,height,open) {
    await page.setViewportSize({width,height});
    await page.evaluate(open=>{
        document.getElementById('sidebarMenu')?.classList.toggle('d-none',!open);
        const main=document.querySelector('main');
        main.style.setProperty('width',open?'':'100%','important');
        main.style.setProperty('margin-left',open?'':'0px','important');
        document.getAnimations().forEach(a=>{if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
    },open);
}
async function settleLayout(page) {
    await page.evaluate(async()=>{
        let previous='',stable=0;
        for(let frame=0;frame<30;frame++){
            await new Promise(r=>requestAnimationFrame(r));
            document.getAnimations().forEach(a=>{if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
            const geometry=JSON.stringify([...document.querySelectorAll('header,main,main .card,main .card-body')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,e.scrollTop];}));
            stable=geometry===previous?stable+1:0;previous=geometry;
            if(stable>=3)return;
        }
        throw new Error('Form geometry did not settle after resizing');
    });
}
module.exports={loadForm,viewport,strip,addTypographyAssets,settleLayout};
