const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read('server/controllers/ergazomenoi/erganhController.js');
const browser = read(
    'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'
);

assert.match(controller, /buildRestPeriodPolicyPreviewRows/);
assert.match(controller, /restContextRows/);
assert.match(controller, /presentationRowIds/);
assert.match(
    controller,
    /rows: \[\.\.\.basePreviewRows, \.\.\.restPreviewRows\],[\s\S]{0,200}rules: reusableDecisionRules/
);
assert.doesNotMatch(
    controller,
    /buildRestPeriodPolicyPreviewRows\([\s\S]{0,800}(?:updateOne|updateMany|bulkWrite|save)\s*\(/
);

assert.match(browser, /SPLIT_SHIFT_MINIMUM_REST/);
assert.match(browser, /INTERDAY_MINIMUM_REST/);
assert.match(browser, /renderRestPeriodPolicyPreviewGroupItems/);
assert.match(browser, /formatPolicyPreviewRestMinutes/);
assert.match(browser, /!previewId \|\| previewId === sourceId/);

console.log('rest-period policy preview integration contract passed');
