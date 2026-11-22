'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname,'../../public/js/common/initTomDropdown.js');
const original = fs.readFileSync(file,'utf8');
const source = original.replace(/^import \{[^\n]+\} from ['"][^'"\n]+['"];?/m,'')
    .replace(/\bexport (?=function|const|let|class)/g,'');

function harness({employee=true,loading=true,count=4,existing=[],failOnConstructor=0}={}) {
    const elements = Array.from({length:count},(_,i)=>({id:'employee_'+i,
        dataset:{api:'/api/dropdown/test',preselect:''},disabled:false,options:{},
        tomselect:existing.includes(i)?{fromChain:true}:null}));
    const byId = new Map(elements.map(e=>[e.id,e]));
    let writes=0, styleCalls=0, staleStyleCalls=0, constructors=0, listeners={};
    const style = function(el) { styleCalls++; if(writes>0) staleStyleCalls++; return {
        getPropertyValue(name) { if(name==='direction')return 'ltr'; return 'synthetic'; }
    }; };
    const win={__tomInstances:{}, getComputedStyle:style,
        EmployeeFormReadiness:{loading:()=>loading}};
    const doc={body:{dataset:{mode:'edit'}},
        querySelector(selector) {
            if(selector.startsWith('.employee-add-page'))return employee?{}:null;
            if(selector.startsWith('#'))return byId.get(selector.slice(1));
            return null;
        },
        getElementById(id) {return byId.get(id)||null;},
        querySelectorAll(selector) {return selector==='select.tom-dropdown'?elements:[];},
        addEventListener(name,fn) {listeners[name]=fn;}
    };
    for(const i of existing) win.__tomInstances['#employee_'+i]=elements[i].tomselect;
    const mock = ({selector})=> {
        constructors++;
        const el=byId.get(selector.slice(1));
        const style=win.getComputedStyle(el,null);
        assert.equal(style.getPropertyValue('direction'),'ltr');
        if(failOnConstructor && constructors===failOnConstructor) throw new Error('synthetic constructor failure');
        writes++;
        const instance={options:{},getValue(){return '';},on(){},
            wrapper:{classList:{add(){},remove(){}}},disable() {}};
        el.tomselect=instance;
        return instance;
    };
    const sanitized=source.replace(/^\/\/.*$/gm,match=>match);
    const factory=new vm.Script(`(function(initTomDropdown){${sanitized}\nreturn {initAllTomSelects,reinitTomDropdowns};})`,{filename:file});
    const api=factory.runInNewContext({window:win,document:doc,console})(mock);
    return {api,win,doc,elements,style,calls:()=>styleCalls,stale:()=>staleStyleCalls,
        constructors:()=>constructors,run:()=>listeners.DOMContentLoaded()};
}

test('employee startup batches direction reads before DOM writes',()=>{
    const h=harness();h.run();
    assert.equal(h.constructors(),4);
    assert.equal(h.calls(),4);
    assert.equal(h.stale(),0);
    assert.equal(h.win.getComputedStyle,h.style);
    assert(h.elements.every(e=>Boolean(e.tomselect)));
});
test('ordinary forms preserve synchronous uncached initialization',()=>{
    const h=harness({employee:false});h.run();
    assert.equal(h.constructors(),4);
    assert.equal(h.calls(),4);
    assert.equal(h.stale(),3);
    assert.equal(h.win.getComputedStyle,h.style);
});
test('not-loading Employee forms preserve native path',()=>{
    const h=harness({employee:true,loading:false});h.run();
    assert.equal(h.calls(),4);assert.equal(h.stale(),3);
});
test('existing dependent chain controls are not recreated',()=>{
    const h=harness({existing:[0,2]});h.run();
    assert.equal(h.constructors(),2);
    assert.equal(h.calls(),2);
    assert.equal(h.stale(),0);
    assert(h.elements[0].tomselect.fromChain);
    assert(h.elements[2].tomselect.fromChain);
});
test('later reinit stays native and does not use startup cache',()=>{
    const h=harness();
    const scope={querySelectorAll:()=>h.elements.slice(0,2)};
    h.api.reinitTomDropdowns(scope);
    assert.equal(h.constructors(),2);
    assert.equal(h.calls(),2);
    assert.equal(h.stale(),1);
    assert.equal(h.win.getComputedStyle,h.style);
});
test('constructor exception restores native getComputedStyle and cache',()=>{
    const h=harness({failOnConstructor:2});
    assert.throws(()=>h.run(),/synthetic constructor failure/);
    assert.equal(h.win.getComputedStyle,h.style);
    // The failed constructor does not leave a global style override in place.
    assert.equal(h.win.getComputedStyle(h.elements[0]).getPropertyValue('direction'),'ltr');
});
test('cache applies only once during a synchronous initial bulk pass',()=>{
    const h=harness();h.run();
    h.api.initAllTomSelects();
    assert.equal(h.constructors(),4);
    assert.equal(h.win.getComputedStyle,h.style);
});
test('no fields is a no-op, no global state leaked',()=>{
    const h=harness({count:0});h.run();
    assert.equal(h.constructors(),0);assert.equal(h.calls(),0);
    assert.equal(h.win.getComputedStyle,h.style);
});
test('never modifies form readiness or protected data pathways',()=>{
    assert.doesNotMatch(source,/fetch\(|Mongo|writeEmployee|historyModel|database/i);
    assert.match(source,/window\.getComputedStyle = nativeGetComputedStyle/);
    assert.match(source,/employeeInitialDirections = previous/);
});
