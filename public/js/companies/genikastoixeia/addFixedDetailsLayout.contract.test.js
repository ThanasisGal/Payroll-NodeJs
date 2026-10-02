'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const addView = fs.readFileSync(
    path.join(root, 'views/companies/genikastoixeia/add.ejs'),
    'utf8'
);
const fixedDetailsBody = fs.readFileSync(
    path.join(
        root,
        'views/companies/genikastoixeia/partials/add/cardBodies/statheraStoixeia.ejs'
    ),
    'utf8'
);
const layoutScript = fs.readFileSync(path.join(__dirname, 'addFixedDetailsLayout.js'), 'utf8');

const firstSectionStart = addView.indexOf('data-section="Σταθερά Στοιχεία"');
const secondSectionStart = addView.indexOf('data-section="Δραστηριότητες"');
const firstSection = addView.slice(firstSectionStart, secondSectionStart);
const remainingSections = addView.slice(secondSectionStart);

assert.ok(firstSectionStart >= 0);
assert.ok(secondSectionStart > firstSectionStart);
assert.strictEqual((addView.match(/id="companyAddFixedDetailsCard"/g) || []).length, 1);
assert.match(firstSection, /id="companyAddFixedDetailsCard"/);
assert.doesNotMatch(remainingSections, /companyAddFixedDetailsCard/);
assert.match(addView, /script\('companies\/genikastoixeia\/addFixedDetailsLayout'\)/);

assert.match(
    fixedDetailsBody,
    /class="card-body overflow-auto flex-grow-1 w-100 bg-white"[^>]*style="min-height: 0;"/
);

assert.match(layoutScript, /getElementById\('companyAddFixedDetailsCard'\)/);
assert.match(layoutScript, /document\.querySelector\('\.footer'\)/);
assert.match(layoutScript, /const cardTop = card\.getBoundingClientRect\(\)\.top/);
assert.match(layoutScript, /const availableHeight = footerTop - cardTop - footerClearance/);
assert.match(layoutScript, /card\.style\.height = `\$\{cardHeight\}px`/);
assert.match(layoutScript, /card\.style\.maxHeight = `\$\{cardHeight\}px`/);
assert.match(layoutScript, /window\.addEventListener\('resize'/);
assert.match(layoutScript, /window\.requestAnimationFrame/);
assert.doesNotMatch(layoutScript, /position\s*:\s*(?:fixed|sticky)/);
assert.doesNotMatch(firstSection, /height-vh-80/);

console.log('PASS New Company first-tab dynamic-height layout contract');
