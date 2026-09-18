'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(
    path.join(__dirname, '../../routes/usersRoute.js'),
    'utf8'
);
const controllerSource = fs.readFileSync(
    path.join(__dirname, 'employeeRehireController.js'),
    'utf8'
);

assert.match(
    routeSource,
    /const employeeRehireController = require\('\.\.\/controllers\/ergazomenoi\/employeeRehireController\.js'\);/
);

assert.match(
    routeSource,
    /'\/api\/ergazomenoi\/rehire\/:ergazomenoiId',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'update'\),\s*employeeRehireController\.postEmployeeRehire/
);

assert.match(
    controllerSource,
    /requireScopedEmployeeForUpdate\(\{[\s\S]*?model: ErgazomenoiModel,[\s\S]*?objectId: mongoose\.Types\.ObjectId/
);

assert.match(
    controllerSource,
    /scope:\s*\{[\s\S]*?team: req\.session\.userTeam,[\s\S]*?company_kod: req\.session\.companyInUse,[\s\S]*?kodikos: scoped\.employeeCode/
);

assert.match(
    controllerSource,
    /employeeId: String\(scoped\.employee\._id\)/
);

assert.match(
    controllerSource,
    /writeEmployeeRehire\(\{/
);

assert.doesNotMatch(
    controllerSource,
    /team:\s*req\.body|company_kod:\s*req\.body|kodikos:\s*req\.body/
);

assert.doesNotMatch(
    controllerSource,
    /findOneAndUpdate|updateMany|deleteMany|insertMany/
);

console.log('PASS employee rehire API scope and authorization contract');
