'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { presentPendingHistory } = require('./employeePendingHistoryPresentationService');
const { FORMS } = require('./employeePendingHistorySectionAuthorizationService');

const pending = { id: 'synthetic-pending', missingFields: [
    { field: 'pragmatikosMisthos', label: 'Πραγματικός Μισθός', group: 'Αποδοχές', reason: 'Δεν καταγράφηκε.' },
    { field: 'krathsh_01', label: 'ΚΠΚ', group: 'Ασφάλιση', reason: 'Δεν καταγράφηκε.' },
    { field: 'ores_ergasias_ebdomadas', label: 'Ώρες εβδομάδας', group: 'Όροι', reason: 'Δεν καταγράφηκε.' }
] };
function model(perms) {
    const queries = [];
    return { queries, findOne({ userId,form }) {
        assert.equal(userId,'synthetic-actor'); queries.push(form);
        return { select() { return this; }, async lean() { return { privileges: perms[form] || {} }; } };
    } };
}
test('unauthorized user sees generic financial sections, never precise financial field labels',async()=>{
    const p = model({ Ergazomenoi: { update:true } });
    const v = await presentPendingHistory({pending,actorUserId:'synthetic-actor',privilegeModel:p});
    assert.equal(v.canViewApodoxes,false); assert.equal(v.canViewKrathseis,false);
    const text = JSON.stringify(v);
    assert.doesNotMatch(text,/Πραγματικός Μισθός|krathsh_01|ΚΠΚ/);
    assert.match(text,/Αποδοχές/); assert.match(text,/Κρατήσεις/);
    assert.match(text,/Ώρες εβδομάδας/);
    assert.ok(p.queries.includes(FORMS.APODOCHES) && p.queries.includes(FORMS.KRATHSEIS));
});
test('explicit read-only right permits displaying pay, but grants no editing privilege',async()=>{
    const p = model({ Ergazomenoi: { update: true }, [FORMS.APODOCHES]: { read:true } });
    const v = await presentPendingHistory({pending,actorUserId:'synthetic-actor',privilegeModel:p});
    assert.equal(v.canViewApodoxes,true); assert.equal(v.canViewKrathseis,false);
    assert.match(JSON.stringify(v),/Πραγματικός Μισθός/);
    assert.doesNotMatch(JSON.stringify(v),/ΚΠΚ/);
});
test('authorized independent second actor may see both sections regardless of pending originator',async()=>{
    const p = model({Ergazomenoi:{update:true},[FORMS.APODOCHES]:{update:true},[FORMS.KRATHSEIS]:{read:true}});
    const v = await presentPendingHistory({pending:{...pending,actorUserId:'first-actor'},actorUserId:'synthetic-actor',privilegeModel:p});
    assert.equal(v.canViewApodoxes,true); assert.equal(v.canViewKrathseis,true);
    assert.equal(v.missingFields.length,3);
});
test('Ergazomenoi admin may view pending without additional financial form rights',async()=>{
    const p = model({Ergazomenoi:{admin:true}});
    const v = await presentPendingHistory({pending,actorUserId:'synthetic-actor',privilegeModel:p});
    assert.equal(v.canViewApodoxes,true); assert.equal(v.canViewKrathseis,true);
    assert.deepEqual(p.queries,['Ergazomenoi']);
});
test('missing actor or permission model fails closed without leaking detailed fields',async()=>{
    for(const args of [{pending}, {pending,actorUserId:'synthetic-actor'}]) {
        const v=await presentPendingHistory(args);
        assert.equal(v.canViewApodoxes,false); assert.equal(v.canViewKrathseis,false);
        assert.doesNotMatch(JSON.stringify(v),/Πραγματικός Μισθός|ΚΠΚ/);
    }
});
