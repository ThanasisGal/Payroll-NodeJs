'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, 'putFieldValues.js'),
    'utf8'
);

assert.match(source, /const isRehireDraftMode = rehireQuery\.get\('rehire'\) === '1'/);
assert.match(source, /setRehireField\('hmeromhnia_proslhpshs', rehireDraftDate\)/);
assert.match(source, /setRehireField\('hmeromhnia_allaghs_symbashs', rehireDraftDate\)/);
assert.match(source, /setRehireField\('hmeromhnia_allaghs_orarioy_apo', rehireDraftDate\)/);
assert.match(source, /addUtcDays\(rehireDraftDate, 6\)/);
assert.match(source, /setRehireField\('hmeromhnia_lhxhs_symbashs', ''\)/);
assert.match(source, /setRehireField\('hmeromhnia_apoxorhshs', ''\)/);
assert.match(source, /setRehireField\('istorikoId', ''\)/);
assert.match(source, /activeCheckbox\.checked = true/);
assert.match(source, /Δεν έχει γίνει ακόμη καμία καταχώριση/);
assert.match(source, /toast: true/);
assert.match(source, /position: 'top-end'/);
assert.match(source, /timerProgressBar: true/);
assert.match(source, /width: '21rem'/);
assert.match(source, /showCloseButton: true/);
assert.match(source, /timer: 5500/);
assert.match(source, /htmlContainer\.style\.whiteSpace = 'normal'/);
assert.match(source, /htmlContainer\.style\.overflowWrap = 'anywhere'/);
assert.doesNotMatch(source, /rehire-draft-notice/);
assert.match(source, /if \(isRehireDraftMode\) \{/);

assert.match(source, /rehireIntent: true/);
assert.match(source, /rehireDate:/);
assert.match(source, /title: 'Καταχώριση επαναπρόσληψης'/);
assert.match(source, /confirmButtonText: 'Καταχώριση'/);
assert.match(source, /const hasMetaboles =\s*isRehireDraftMode \? false/);
assert.match(source, /scheduleEndField\.dispatchEvent/);
assert.doesNotMatch(source, /Η τελική καταχώριση είναι προσωρινά απενεργοποιημένη/);

console.log('PASS employee rehire review-form final-submit contract');
