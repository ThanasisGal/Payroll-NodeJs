const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'usersRoute.js'), 'utf8');

const expectedChains = [
    [
        'POST /companies/genikastoixeia/add',
        /router\.post\(\s*'\/companies\/genikastoixeia\/add',\s*requireUserPrivilegeAction\('Companies', 'create'\),\s*authorizeCompanyCreate,\s*companiesController\.postCompanyForm/s
    ],
    [
        'POST /companies/ypokatasthmata/add',
        /router\.post\(\s*'\/companies\/ypokatasthmata\/add',\s*requireUserPrivilegeAction\('Ypokatasthmata', 'create'\),\s*validateYpokatasthmaCreate,\s*authorizeCompanyChildCreate,\s*ypokatasthmataController\.postYpokatasthmataForm/s
    ],
    [
        'POST /companies/passwords/add',
        /router\.post\(\s*'\/companies\/passwords\/add',\s*requireUserPrivilegeAction\('Passwords', 'create'\),\s*validatePasswordCreate,\s*authorizeCompanyChildCreate,\s*passwordsController\.postPasswordsForm/s
    ],
    [
        'POST /api/companies/update/:companyId',
        /router\.post\(\s*'\/api\/companies\/update\/:companyId',\s*requireUserPrivilegeAction\('Companies', 'update'\),\s*authorizeCompanyUpdate,\s*companiesController\.postCompanyUpdate/s
    ],
    [
        'POST /api/companies/antistoixiseis/update/:antistoixishId',
        /router\.post\(\s*'\/api\/companies\/antistoixiseis\/update\/:antistoixishId',\s*requireUserPrivilegeAction\('Antistoixiseis', 'update'\),\s*authorizeAntistoixishUpdate,\s*antistoixiseisController\.postAntistoixiseisUpdate/s
    ]
];

for (const [route, pattern] of expectedChains) {
    assert.match(source, pattern, `${route}: missing action privilege or scope validation middleware`);
}

assert.ok(!source.includes("router.post('/companies/passwords/add', passwordsController"));
assert.ok(!source.includes("router.post('/api/companies/update/:companyId', companiesController"));

console.log('PASS company write routes retain action authorization and scope middleware');
