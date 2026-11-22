'use strict';
// This test runs with the existing local EJS dependency, not in a browser and
// without any database connection. It renders only the two authorization gates.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ejs=require('ejs');
const ROOT=path.join(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

test('real EFKA include is NOT rendered in unauthorized pending HTML',()=>{
    const source=read('views/ergazomenoi/ergazomenoi/edit.ejs');
    const marker="include('./partials/edit/cardBodies/section1/accordion/efka')";
    const point=source.indexOf(marker);
    assert.ok(point>0);
    const begin=source.lastIndexOf('<% if (canSeePendingWithholdings) { %>',point);
    const end=source.indexOf('<% } %>',point)+7;
    assert.ok(begin>=0 && end>point);
    const html=ejs.render(source.slice(begin,end),{canSeePendingWithholdings:false});
    assert.match(html,/απαιτούν εξουσιοδοτημένο χρήστη/);
    assert.doesNotMatch(html,/kpk_efka|foreas_kyrias_asfalishs|prosthetes_asfalistikes_apodoxes/);
});

test('insurance-class hidden field and checkbox are NOT rendered for unauthorized pending role',()=>{
    const source=read('views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs');
    const point=source.indexOf('id="asfalish_me_tekmarta"');
    assert.ok(point>0);
    const begin=source.lastIndexOf('<% if (canSeePendingWithholdings) { %>',point);
    const end=source.indexOf('<% } %>',point)+7;
    assert.ok(begin>=0 && end>point);
    const html=ejs.render(source.slice(begin,end),{
        canSeePendingWithholdings:false,
        safe(){throw Error('INSURANCE_SECRET_WAS_EVALUATED')}
    });
    assert.match(html,/Ασφαλιστικά στοιχεία/);
    assert.doesNotMatch(html,/asfalish_me_tekmarta|asfalistikh_klash_stathera|asfalistikh_klash/);
});

test('editing employment hours remains available as an independent field',()=>{
    const source=read('views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs');
    assert.match(source,/name="hmeres_ergasias_ebdomadas"/);
    const start=source.indexOf('<% if (canSeePendingWithholdings) { %>');
    const finish=source.indexOf('id="asfalistikh_klash"',start);
    assert.ok(source.indexOf('name="hmeres_ergasias_ebdomadas"')<start);
    assert.ok(finish>start);
});
