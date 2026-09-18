'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = fs.readFileSync(
    path.join(__dirname, 'erganhController.js'),
    'utf8'
);

function section(source, from, to) {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0, `missing start: ${from}`);
    assert.ok(end > start, `missing end: ${to}`);
    return source.slice(start, end);
}

assert.match(
    controller,
    /preloadEmployeeEmploymentCycleContexts[\s\S]*?employeeEmploymentCycleContextLoaderService/
);

const loader = section(
    controller,
    'async function applyEmploymentDepartureScopeToFilters({',
    '\nasync function '
);

assert.match(loader, /ErgazomenoiModel\.find\(employeeFilter\)/);
assert.match(loader, /preloadEmployeeEmploymentCycleContexts\(\{/);
assert.match(loader, /company_kod: companyId/);
assert.match(loader, /historyModel: IstorikoProslhpseonAllagonModel/);
assert.match(
    loader,
    /buildPostDepartureExclusionDescriptors\(lifecycleEmployees\)/
);
assert.match(loader, /return \{ employees: lifecycleEmployees, descriptors \};/);
assert.doesNotMatch(
    loader,
    /\.(?:create|insertMany|update|updateOne|updateMany|save|delete|deleteOne|deleteMany|remove)\s*\(/
);

const exclusion = section(
    controller,
    'function applyPostDepartureExclusionsToFilter(',
    '\nasync function applyEmploymentDepartureScopeToFilters'
);
assert.match(exclusion, /\$gt: descriptor\.departureEnd/);
assert.match(exclusion, /\$lt: descriptor\.nextHireStart/);

const scopeCalls = controller.match(
    /departure_date: employee\.hmeromhnia_apoxorhshs,\s*employee/g
) || [];
assert.equal(scopeCalls.length, 5);

console.log(
    'PASS rehire lifecycle read integration: history preload, gap filter, cycle-aware weekly scope'
);
