'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const guided = require('./employeeHistoryGuidedResolution');
const P = require('../../../../server/services/ergazomenoi/employeeHistoryCorrectionPolicyService');
const { fixture, scope, historyId } = require('../../../../test/fixtures/employeeProfileTransactionStore');
const ROOT=path.resolve(__dirname,'../../../..');
const req=(intent='REVIEW',facts={})=>({intent,targetHistoryId:historyId('employee',1),facts,confirmation:null});
function data(request=req(),f=fixture()) {
    const plan=P.planHistoryCorrection({scope,currentEmployee:f.employee,historyRows:f.history,
        request,accessMode:'ADMIN_FULL',catalogs:{},insertId:historyId('employee',9)});
    return {resolutionRequired:true,resolution:plan.public};
}
const response=(value,status=200)=>({status,clone(){return {json:async()=>structuredClone(value)};}});
function document() {
    return {createElement(tagName){return {tagName,textContent:'',value:'',checked:false,disabled:false,
        className:'',children:[],attributes:{},listeners:{},appendChild(child){this.children.push(child);},
        replaceChildren(...children){this.children=children;},setAttribute(key,value){this.attributes[key]=value;},
        addEventListener(name,listener){this.listeners[name]=listener;},dispatch(name){return this.listeners[name]?.();}};}};
}
const all=node=>[node,...node.children.flatMap(all)];
const text=node=>all(node).map(n=>n.textContent).join('\n');
function normalized(value){const result=guided.normalizeResolutionResponse(value);assert.ok(result);return result;}

for(const status of [200,409]) test(`safe correction envelopes remain recognized with HTTP ${status}`,async()=>{
    for(const request of [req(),req('REMOVE_ROW')]) {
        const value=data(request);
        assert.deepEqual(await guided.readResolutionFromResponse(response(value,status)),normalized(value));
    }
});

for(const [name,request] of [['choice',req()],['preview',req('REMOVE_ROW')]]) {
    test(`simple Greek ${name}: no forbidden technical terms or first-person plural`,()=>{
        const value=normalized(data(request)),content=guided.buildSafeContent(document(),value);
        const wording=text(content.element);
        assert.match(wording,/Τι συμβαίνει/);assert.match(wording,/Γιατί χρειάζεται προσοχή/);
        assert.doesNotMatch(wording,/generic|guided|lifecycle|anchor|canonical|fingerprint|transaction|persisted|mutation|planner|stale|reference fence|server-side|Mongo|\bV1\b/i);
        assert.doesNotMatch(wording,/προτείνουμε|βρήκαμε|χρειαζόμαστε|ελέγξαμε|θεωρούμε|να μας πείτε/i);
        assert.doesNotMatch(wording,/507f|historyId|survivor|deleteId|"patch"/i);
    });
}

test('ambiguous real-world choice has no recommendation and no selected radio',()=>{
    const value=normalized(data()),content=guided.buildSafeContent(document(),value);
    assert.equal(value.recommendation,null);assert.doesNotMatch(text(content.element),/Πρόταση της εφαρμογής/);
    assert.match(text(content.element),/Η εφαρμογή δεν μπορεί να γνωρίζει με ασφάλεια τι συνέβη/);
    assert.ok(all(content.element).filter(node=>node.type==='radio').every(node=>node.checked===false));
    assert.equal(content.selected(),null);
});

test('recommendation section appears only with a proved recommendation',()=>{
    const f=fixture(),duplicate={...f.history[1],_id:historyId('employee',7),createdAt:new Date('2026-01-01')};
    f.history.push(duplicate);
    const request={...req('REMOVE_ROW'),targetHistoryId:duplicate._id};
    const value=normalized(data(request,f));assert.ok(value.recommendation);
    assert.match(text(guided.buildSafeContent(document(),value).element),/Πρόταση της εφαρμογής/);
});

test('preview renders every business event and exactly the server before/after',()=>{
    const value=normalized(data(req('REMOVE_ROW'))),content=guided.buildSafeContent(document(),value);
    const rendered=text(content.element);
    assert.match(rendered,/Τι θα αλλάξει/);assert.match(rendered,/Τι δεν θα αλλάξει/);
    assert.ok(rendered.indexOf('ΠΡΙΝ')<rendered.indexOf('ΜΕΤΑ'));
    for(const row of [...value.preview.before,...value.preview.after]) {
        assert.ok(rendered.includes(`${row.date}  ${row.event}`));assert.ok(rendered.includes(row.period));
    }
    assert.equal(content.selected(),null);
    const checkbox=all(content.element).find(node=>node.type==='checkbox');
    checkbox.checked=true;checkbox.dispatch('change');assert.deepEqual(content.selected(),{confirmed:true});
});

for(const tamper of [v=>v.plan={deleteIds:[]},v=>v.preview.before[0].historyId='secret',
    v=>v.preview.before[0].details.push('Mongo 507f1f77bcf86cd799439101'),v=>v.fingerprint='bad',
    v=>v.phase='UNKNOWN',v=>v.choices[0].id='PHYSICAL_DELETE',v=>v.recommendation='Automatic repair']) {
    test(`malformed public correction rejects ${tamper.toString()}`,async()=>{
        const value=data();tamper(value.resolution);assert.equal(guided.normalizeResolutionResponse(value),null);
        assert.equal(P.sanitizePublicCorrection(value.resolution),null);
        assert.equal(await guided.readResolutionFromResponse(response(value,200)),null);
    });
}

for(const phase of ['CHOICE','PREVIEW','BLOCKED']) {
    test(`Cancel in ${phase} performs zero retry/action`,async()=>{
        const value=data(phase==='CHOICE'?req():req('REMOVE_ROW'));value.resolution.phase=phase;
        let retries=0;
        const result=await guided.handleInitialResponse({response:response(value),originalPayload:{correction:req()},
            documentRef:document(),retryRequest:async()=>{retries++;},swal:{close(){},
                async fire(options){options.didOpen();return {isConfirmed:false};}}});
        assert.equal(result.cancelled,true);assert.equal(retries,0);
    });
}

test('confirmation performs exactly one action; repeated preConfirm cannot save twice',async()=>{
    const value=data(req('REMOVE_ROW')),sent=[];
    const original={employeeId:'synthetic',updates:[],expectedStateToken:'b'.repeat(64),correction:req('REMOVE_ROW')};
    const success={status:200};
    const result=await guided.handleInitialResponse({response:response(value),originalPayload:original,
        documentRef:document(),retryRequest:async body=>{sent.push(body);return success;},swal:{close(){},
            async fire(options){const checkbox=all(options.html).find(n=>n.type==='checkbox');
                checkbox.checked=true;checkbox.dispatch('change');
                const value=await options.preConfirm();assert.equal(await options.preConfirm(),false);
                return {isConfirmed:true,value};}}});
    assert.equal(sent.length,1);assert.equal(result.response,success);
    assert.deepEqual(sent[0].correction.confirmation,{fingerprint:value.resolution.fingerprint,confirmed:true});
    assert.deepEqual(sent[0].updates,[]);
    assert.equal(original.correction.confirmation,null);
});

test('choice collects only needed historical facts and then requires a separate before/after confirmation',async()=>{
    const review=data(),preview=data(req('INSERT_EVENT',{effectiveDate:'2026-02-15',previousPeriodEnd:'2026-02-14',fieldId:'ACTUAL_PAY',value:1000}));
    const sent=[];let modals=0;
    const result=await guided.handleInitialResponse({response:response(review),originalPayload:{correction:req(),updates:[]},
        documentRef:document(),retryRequest:async body=>{sent.push(body);return sent.length===1?response(preview):{status:200};},
        swal:{close(){},async fire(options){
            modals++;
            if(modals===1){const radio=all(options.html).find(n=>n.type==='radio'&&n.value==='INSERT_EVENT');
                radio.checked=true;radio.dispatch('change');
                const dates=all(options.html).filter(n=>n.type==='date');dates[0].value='2026-02-15';dates[1].value='2026-02-14';
                const select=all(options.html).find(n=>n.tagName==='select');select.value='ACTUAL_PAY';select.dispatch('change');
                const number=all(options.html).find(n=>n.type==='number');assert.equal(number.disabled,false);number.value='1000';number.dispatch('change');
            }else{const checkbox=all(options.html).find(n=>n.type==='checkbox');checkbox.checked=true;checkbox.dispatch('change');}
            return {isConfirmed:true,value:await options.preConfirm()};
        }}});
    assert.equal(modals,2);assert.equal(sent.length,2);assert.equal(result.response.status,200);
    assert.deepEqual(sent[0].correction.facts,{effectiveDate:'2026-02-15',previousPeriodEnd:'2026-02-14',fieldId:'ACTUAL_PAY',value:1000});
    assert.equal(sent[0].correction.confirmation,null);assert.equal(sent[1].correction.confirmation.confirmed,true);
});

test('blocked correction has a safe exit and cannot trigger a forged confirmation',async()=>{
    const value=data(req('REMOVE_ROW'));value.resolution.phase='BLOCKED';let retries=0;
    await guided.handleInitialResponse({response:response(value),originalPayload:{correction:req()},
        documentRef:document(),retryRequest:async()=>{retries++;},swal:{close(){},async fire(options){
            assert.equal(options.showConfirmButton,false);assert.equal(options.cancelButtonText,'Ακύρωση');
            assert.equal(await options.preConfirm(),false);return {isConfirmed:false};}}});
    assert.equal(retries,0);
});

test('new review button compiles, is CSP-safe, accessible and disabled outside scope',()=>{
    const file=path.join(ROOT,'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
    const source=fs.readFileSync(file,'utf8');const render=ejs.compile(source,{filename:file});
    const f=fixture();const html=render({ergazomenoiData:f.employee,istorikoData:f.history,
        employeeHistoryAccessMode:'NONE',employeeHistoryStateToken:'a'.repeat(64)});
    const buttons=html.match(/<button[^>]*data-action="review"[^>]*>/g);assert.equal(buttons.length,3);
    for(const button of buttons){assert.match(button,/type="button"/);assert.match(button,/aria-label="Έλεγχος \/ Διόρθωση"/);
        assert.match(button,/disabled aria-disabled="true"/);assert.match(button,/employee-history-correction-action/);
        assert.doesNotMatch(button,/on\w+=|style=/i);}
    const client=fs.readFileSync(path.join(__dirname,'istorikoTable.js'),'utf8');
    assert.match(client,/table\.addEventListener\('click', async/);
    assert.match(client,/action === 'review'.*openHistoryCorrection/);
    const deletion=client.slice(client.indexOf("if (action === 'delete')"),client.indexOf("if (action === 'undo')"));
    assert.match(deletion,/openHistoryCorrection/);assert.doesNotMatch(deletion,/setRowState\(row, 'deleted'\)/);
});

test('new action styles use light normal/full hover and exclude disabled hover',()=>{
    const css=fs.readFileSync(path.join(ROOT,'public/css/main.css'),'utf8');
    for(const [type,light,full] of [['confirm','#fff3cd','#ffc107'],['cancel','#e9ecef','#6c757d']]) {
        assert.match(css,new RegExp(`\\.employee-history-correction-${type} \\{[^}]*background-color: ${light}`));
        assert.match(css,new RegExp(`\\.employee-history-correction-${type}:not\\(:disabled\\):hover \\{[^}]*background-color: ${full}`));
    }
    assert.match(css,/employee-history-correction-action:disabled \{[^}]*opacity: \.55;[^}]*cursor: not-allowed/);
    const source=fs.readFileSync(path.join(__dirname,'employeeHistoryGuidedResolution.js'),'utf8');
    assert.doesNotMatch(source,/onclick\s*=|style\s*=\s*["']/);
});
