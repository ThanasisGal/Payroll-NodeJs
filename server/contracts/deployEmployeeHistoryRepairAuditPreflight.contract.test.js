'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const deploy = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
const packageJson = require('../../package.json');

test('application deployment checks audit storage after install and before PM2 activation', () => {
    const check = '"$NODE24_BIN/node" scripts/checkEmployeeHistoryRepairAudit.js';
    const checkPosition = deploy.indexOf(check);
    const installPosition = deploy.indexOf('if [ "$INSTALL_SUCCESS" = true ]');
    const reloadPosition = deploy.indexOf('pm2 reload payroll --update-env');
    assert.ok(checkPosition > installPosition);
    assert.ok(checkPosition < reloadPosition);
    assert.match(deploy, /EMPLOYEE_HISTORY_REPAIR_AUDIT_PREFLIGHT_FAILED/);
    assert.equal(packageJson.scripts['check:employee-history-repair-audit'],
        'node scripts/checkEmployeeHistoryRepairAudit.js');
    assert.equal(packageJson.scripts['setup:employee-history-repair-audit'],
        'node scripts/setupEmployeeHistoryRepairAudit.js');
});
