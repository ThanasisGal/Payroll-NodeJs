'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');

const handler = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaOrphanQualityCheck'),
    controller.indexOf('static getApasxoliseisPolicyCatalog')
);
assert.match(handler, /team:\s*req\.session\.userTeam/);
assert.match(handler, /company_kod:\s*req\.session\.companyInUse/);
assert.match(handler, /ypokatasthma:\s*branch\.padStart\(4, '0'\)/);
assert.match(handler, /\$gte:\s*start,\s*\$lte:\s*end/);
assert.match(handler, /if \(employeeCode\) filter\.kodikos = employeeCode/);
assert.match(handler, /\.select\('kodikos hmeromhnia cards_apo_ora_01/);
assert.match(handler, /countOrphanHitsByEmployee\(rows\)/);
assert.doesNotMatch(handler, /updateOne|bulkWrite|create\(|save\(/);
assert.match(routes, /review\/orphan-quality-check[\s\S]*requireEmploymentReviewAccess/);

const successfulLoad = frontend.slice(
    frontend.indexOf('const payload = await response.json();', frontend.indexOf('async function loadResults')),
    frontend.indexOf('const correctiveSummary', frontend.indexOf('async function loadResults'))
);
assert.match(successfulLoad, /if \(!payload\.success\)[\s\S]*return;/);
assert.match(successfulLoad, /EmploymentReviewOrphanQualityCheck\?\.run/);

console.log('orphan quality check controller contracts passed');
