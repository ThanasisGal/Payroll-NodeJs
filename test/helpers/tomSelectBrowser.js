'use strict';
const fs = require('node:fs');
const path = require('node:path');

function queryForVisibleOption(option) {
    const code=String(option.kodikos||option.value);
    // Tom Select searches label; some APIs (periodoi) intentionally omit codes.
    return String(option.label).includes(code)?code:option.perigrafh||option.label.split(' — ')[0];
}

function dropdownBounds(e) {
    const t=e.tomselect,content=t.dropdown.querySelector('.ts-dropdown-content');
    const rect=x=>x.getBoundingClientRect().toJSON(),control=rect(t.control),dropdown=rect(t.dropdown);
    const css=x=>{const s=getComputedStyle(x);return {height:s.height,maxHeight:s.maxHeight,
        overflowX:s.overflowX,overflowY:s.overflowY,available:s.getPropertyValue('--ts-available-space'),
        menuWidth:s.getPropertyValue('--ts-menu-width'),menuLeft:s.getPropertyValue('--ts-menu-left'),
        controlHeight:s.getPropertyValue('--ts-control-h')};};
    const limits={top:0,bottom:innerHeight,left:0,right:innerWidth},ancestors=[];
    for(let p=t.dropdown.parentElement;p;p=p.parentElement){
        const s=getComputedStyle(p),r=rect(p),clipY=/auto|scroll|hidden|clip/.test(s.overflowY),clipX=/auto|scroll|hidden|clip/.test(s.overflowX);
        if(clipY||clipX){
            const bounds={top:r.top+p.clientTop,bottom:r.top+p.clientTop+p.clientHeight,left:r.left+p.clientLeft,right:r.left+p.clientLeft+p.clientWidth};
            ancestors.push({id:p.id,tag:p.tagName,className:p.className,rect:r,bounds,css:css(p)});
            if(clipY){limits.top=Math.max(limits.top,bounds.top);limits.bottom=Math.min(limits.bottom,bounds.bottom);}
            if(clipX){limits.left=Math.max(limits.left,bounds.left);limits.right=Math.min(limits.right,bounds.right);}
        }
    }
    const reasons=[];
    if(!t.isOpen||!dropdown.width||!dropdown.height)reasons.push('dropdown-not-open');
    if(dropdown.top<limits.top-1)reasons.push('clipped-top');
    if(dropdown.bottom>limits.bottom+1)reasons.push('clipped-bottom');
    if(dropdown.left<limits.left-1)reasons.push('clipped-left');
    if(dropdown.right>limits.right+1)reasons.push('clipped-right');
    const options=[...content.querySelectorAll('.option')];
    const optionHeight=options[0]?.getBoundingClientRect().height||34;
    if(options.length&&content.clientHeight+1<Math.min(34,optionHeight))reasons.push('no-readable-option-row');
    const placement=t.dropdown.classList.contains('place-above')?'place-above':t.dropdown.classList.contains('place-below')?'place-below':null;
    if(!placement)reasons.push('placement-not-resolved');
    return {id:e.id,nextPage:t.nextPage,loading:t.loading,loadingNext:!!t._loadingNext,search:t.control_input.value,lastQuery:t.lastQuery,loadedSearches:t.loadedSearches,fixtureSearches:window.__fixtureSearches,valid:!reasons.length,reasons,options:options.length,placement,
        spaceAbove:Math.max(0,control.top-limits.top),spaceBelow:Math.max(0,limits.bottom-control.bottom),
        control,dropdown,viewport:{width:innerWidth,height:innerHeight},limits,ancestors,
        css:{dropdown:css(t.dropdown),content:css(content)},classes:t.dropdown.className,
        width:dropdown.width,height:dropdown.height,controlHeight:control.height,
        scrollable:content.scrollHeight>content.clientHeight,scroll:{top:content.scrollTop,height:content.scrollHeight,client:content.clientHeight}};
}

async function settleTomDropdown(select) {
    await select.evaluate(async e=>{
        await document.fonts.ready;
        let previous='',stable=0;
        // This is a bounded stability observation, never a retry of the visual assertion.
        for(let frame=0;frame<180;frame++){
            await new Promise(resolve=>requestAnimationFrame(resolve));
            const t=e.tomselect,c=t.dropdown.querySelector('.ts-dropdown-content');
            const ready=!t.loading&&!t.refreshTimeout&&!t._loadingNext&&!t._preselecting&&!t._suspendItemAddFlow
                &&!window.__fixtureDropdownDebounces.size;
            const nodes=[t.control,t.dropdown,c];
            for(let p=t.wrapper.parentElement;p;p=p.parentElement)nodes.push(p);
            const geometry=JSON.stringify([t.dropdown.className,t.dropdown.getAttribute('style'),
                ...nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return [r.x,r.y,r.width,r.height,n.scrollTop,n.scrollHeight,n.clientHeight,s.maxHeight,s.overflowY];}),
                [...c.querySelectorAll('.option')].map(n=>n.dataset.value)]);
            stable=ready&&geometry===previous?stable+1:0;previous=geometry;
            if(stable>=4)return;
        }
        throw new Error('Tom Select load/debounce/geometry did not reach a stable final state: '+e.id);
    });
}

async function captureDropdownFailure(page,select,context) {
    const diagnostics={...context,...await select.evaluate(dropdownBounds)};
    const dir=process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    if(dir){
        fs.mkdirSync(dir,{recursive:true});
        const name=('tom-failure-'+[context.template,context.section,context.scenario,diagnostics.id,context.phase].filter(v=>v!==undefined).join('-')).replace(/[^\w.-]/g,'_');
        fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(diagnostics,null,2));
        // Capture now, before closing, scrolling or opening the next control.
        await page.screenshot({path:path.join(dir,name+'.png')});
    }
    return diagnostics;
}
module.exports={dropdownBounds,settleTomDropdown,captureDropdownFailure,queryForVisibleOption};
