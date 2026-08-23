'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dropdown = require('./ergazomenoi');

assert.deepEqual(dropdown.options.searchFields.slice(0, 3), ['kodikos', 'eponymo', 'onoma']);
assert.equal(dropdown.options.strictPreselectScope, true);
assert.match(dropdown.options.select, /kodikos/);
assert.match(dropdown.options.select, /eponymo/);
assert.match(dropdown.options.select, /onoma/);
assert.deepEqual(dropdown.options.extraQueryBuilder({ team: 'THA', company: 'company',
    ypokatasthma: '1', energoi: 'true' }), {
    team: 'THA', company_kod: 'company', ypokatasthma: { $in: ['1', '0001'] },
    energos: true, archived: false
});
const item = dropdown.options.mapItem({ kodikos: '0001', eponymo: 'Καραστερίου',
    onoma: 'Αγγελική', ypokatasthma: '0001' });
assert.equal(item.value, '0001');
assert.equal(item.eponymo, 'Καραστερίου'.toUpperCase());
assert.equal(item.onoma, 'Αγγελική'.toUpperCase());

const routes = fs.readFileSync(path.join(__dirname, '../../routes/dropdownRoutes.js'), 'utf8');
assert.match(routes, /company:\s*String\(req\.session\.companyInUse/);
assert.match(routes, /team:\s*req\.session\.userTeam/);
const helper = fs.readFileSync(path.join(__dirname, '../../utils/createDropdownApi.js'), 'utf8');
assert.match(helper, /strictPreselectScope[\s\S]*return res\.json\(\{ items: \[\] \}\)/);

console.log('employment review employee dropdown scope and search: PASS');
