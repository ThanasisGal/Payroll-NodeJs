'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const acorn=require('acorn');
const SaveState=require('../../utils/ergazomenoi/employeeSaveState');
const source=fs.readFileSync(require.resolve('./ergazomenoiController'),'utf8');
const names=new Set(['buildEmployeeDraftSchedules','validateOrarioDateRangeFields','valueOrEmpty',
    'parseHoursOrEmpty','hasIncompleteWorkTimeForTemporarySave','normalizeTemporaryOrarioValue',
    'minutesFromHHMM','calcHoursFromTimePairs','firstPositiveHours','toNumberOrNull']);
const declarations=acorn.parse(source,{ecmaVersion:'latest'}).body.filter(node=>node.type==='FunctionDeclaration'&&names.has(node.id.name));
assert.equal(declarations.length,names.size);
const build=vm.runInNewContext(declarations.map(node=>source.slice(node.start,node.end)).join('\n')+'\nbuildEmployeeDraftSchedules;',{SaveState});
const scope={team:'TEST',company_kod:'TEST',kodikos:'0001'};
const form=()=>({hmeromhnia_allaghs_orarioy_apo:'2026-10-04',hmeromhnia_allaghs_orarioy_eos:'2026-10-04',
    kathgoria_ergasias_01:'ΕΡΓ',apo_ora_01_01:'08:00',eos_ora_01_01:'16:00',night_hours_day_01:'2',
    holiday_hours_day_01:'3',overtimeNomimh_hours_day_01:'1',night_holiday_overtimeParanomh_hours_day_01:'0.5'});
test('draft Maintenance retains the existing night, holiday and overtime schedule mapping',()=>{
    const row=build(form(),scope,'edit')[0];
    assert.equal(row.ores_ergasias,'8.0000');assert.equal(row.ores_nyxtas,'2.0000');assert.equal(row.ores_argion,'3.0000');
    assert.equal(row.ores_nominhs_yperorias,'1.0000');assert.equal(row.ores_paranomhs_yperorias_argion_nyxtas,'0.5000');
    assert.equal(row.hmeromhnia.toISOString().slice(0,10),'2026-10-04');assert.equal(row.company_kod,scope.company_kod);
});
test('ordinary Add retains its existing total-hours-only mapping',()=>{
    const row=build(form(),scope)[0];assert.equal(row.ores_ergasias,'8.0000');assert.equal(row.ores_nyxtas,undefined);
});
test('non-working categories retain cleared time and metric values',()=>{
    const row=build({...form(),kathgoria_ergasias_01:'ΑΝ'},scope,'edit')[0];
    assert.equal(row.apo_ora_01,'');assert.equal(row.ores_nyxtas,'');
});
test('omission preserves saved draft schedules; partial, reversed and excessive ranges reject',()=>{
    assert.equal(build({},scope),undefined);
    for(const fields of [{hmeromhnia_allaghs_orarioy_apo:'2026-10-04'},
        {hmeromhnia_allaghs_orarioy_apo:'2026-10-05',hmeromhnia_allaghs_orarioy_eos:'2026-10-04'},
        {hmeromhnia_allaghs_orarioy_apo:'2026-01-01',hmeromhnia_allaghs_orarioy_eos:'2028-01-01'}])
        assert.throws(()=>build(fields,scope),{code:'EMPLOYEE_SAVE_INVALID_DATA'});
});

test('HR search keeps the active-or-draft condition when it adds its own search alternatives',()=>{
    const node=acorn.parse(source,{ecmaVersion:'latest'}).body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='buildErgazomenoiActiveInactiveFilter');
    const active=vm.runInNewContext(source.slice(node.start,node.end)+'\nbuildErgazomenoiActiveInactiveFilter;');
    const query={...active(false),$or:[{onoma:'ΔΟΚΙΜΗ'}]};
    assert.equal(query.archived.$ne,true);
    assert.equal(query.$or[0].onoma,'ΔΟΚΙΜΗ');
    assert.equal(query.$and[0].$or[0].energos,true);
    assert.equal(query.$and[0].$or[1].oristikh_enhmerosh,false);
    assert.equal(active(true).$and,undefined);
});
