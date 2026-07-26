const assert = require('assert');
const fs = require('fs');
const path = require('path');

function source(file) {
    return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

const companies = source('companiesController.js');
const branches = source('ypokatasthmataController.js');
const passwords = source('passwordsController.js');
const mappings = source('antistoixiseisController.js');

assert.match(
    companies,
    /static postCompanyForm[\s\S]*?const sessionUserTeam = req\.companyAccessScope\.effectiveTeam;[\s\S]*?const sessionUserId = req\.companyAccessScope\.userId;/
);
assert.match(
    companies,
    /static postCompanyUpdate[\s\S]*?const companyId = req\.companyAccessScope\.companyId;[\s\S]*?findOneAndUpdate\(\s*\{ _id: companyId, team: req\.companyAccessScope\.companyTeamFilter \}/
);
assert.doesNotMatch(
    companies,
    /static postCompanyUpdate[\s\S]{0,250}const companyId = req\.params\.companyId/
);

assert.match(branches, /const scope = req\.companyAccessScope;/);
assert.match(branches, /team: scope\.effectiveTeam,/);
assert.match(branches, /companykod_object: scope\.companyId,/);
assert.match(branches, /companykod: scope\.companyKod,/);

assert.match(passwords, /const scope = req\.companyAccessScope;/);
assert.match(passwords, /team: scope\.effectiveTeam,/);
assert.match(passwords, /companykod_object: scope\.companyId,/);
assert.doesNotMatch(passwords, /team: formData\.companyTeam/);
assert.doesNotMatch(passwords, /companykod_object: formData\.companyId/);

assert.match(mappings, /const antistoixishId = req\.companyAccessScope\.resourceId;/);
assert.match(mappings, /\{ _id: antistoixishId, companyId, team \}/);

console.log('PASS company write controllers consume canonical authorization scope');
