const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const frontend = fs.readFileSync(path.join(
    __dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'
), 'utf8');
const view = fs.readFileSync(path.join(
    __dirname,
    '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'
), 'utf8');

assert.match(routes, /policies\/approvals\/:approvalId\/revoke/);
assert.match(routes, /revokeProdhlomenaOrariaPolicyPreviewApproval/);
assert.match(controller, /revokePolicyPreviewApprovalRecord\(\{/);
assert.match(controller, /approvalId: req\.params\.approvalId/);
assert.match(controller, /reason: req\.body\?\.reason/);
assert.match(controller, /code: error\.code \|\| undefined/);
assert.match(frontend, /policy-preview-revoke-btn/);
assert.match(frontend, /Υποχρεωτική αιτιολογία/);
assert.match(frontend, /policies\/approvals\/\$\{encodeURIComponent\(approvalId\)\}\/revoke/);
assert.match(frontend, /userCanManageReusablePolicyApproval\(\)/);
assert.match(frontend, /'APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL'/);
assert.doesNotMatch(frontend, /silentRevoke|replaceReusableApproval/);

const roleExpression = view.match(
    /const canManageReusablePolicyApproval = (\[[^;]+includes\(normalizedUserRole\));/
)?.[1];
assert.ok(roleExpression, 'missing reusable-policy role contract');
const canManageRole = new Function('normalizedUserRole', `return ${roleExpression};`);
['A', 'S', 'HR'].forEach((role) => assert.strictEqual(canManageRole(role), true, role));
['U', '', 'ADMIN', 'SUPERVISOR'].forEach((role) =>
    assert.strictEqual(canManageRole(role), false, role));

console.log('reusable approval revoke route/UI contract tests passed');
