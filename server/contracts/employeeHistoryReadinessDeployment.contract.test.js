'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const packageJson = require('../../package.json');
const { identifyReadOnlyTarget } = require('../../scripts/checkEmployeeHistoryReadiness');
const { validateRepairRequest } = require('../../scripts/repairEmployeeHistoryCanonical');

const root = path.resolve(__dirname, '../..');

test('deployment requires audit storage and population readiness before PM2 reload', () => {
    const deploy = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
    const audit = deploy.indexOf('scripts/checkEmployeeHistoryRepairAudit.js');
    const readiness = deploy.indexOf('scripts/checkEmployeeHistoryReadiness.js');
    const reload = deploy.indexOf('pm2 reload payroll --update-env');
    assert.ok(audit >= 0 && readiness > audit && reload > readiness);
    assert.match(deploy, /EMPLOYEE_HISTORY_POPULATION_READINESS_FAILED/);
    assert.equal(packageJson.scripts['check:employee-history-readiness'],
        'node scripts/checkEmployeeHistoryReadiness.js');
});

test('readiness target requires exact database and explicit production acknowledgement', () => {
    const env = { MONGODB_URL: 'mongodb://user:secret@dev.invalid/payroll_dev' };
    const production = 'mongodb://user:secret@prod.invalid/payroll_prod';
    assert.throws(() => identifyReadOnlyTarget({ argv: [], env,
        knownProductionUri: production, knownDevelopmentUri: env.MONGODB_URL }),
    /EXPECTED_DATABASE_MISMATCH/);
    const dev = identifyReadOnlyTarget({ argv: ['--expected-database=payroll_dev'], env,
        knownProductionUri: production, knownDevelopmentUri: env.MONGODB_URL });
    assert.deepEqual(dev, { uri: env.MONGODB_URL, database: 'payroll_dev',
        environment: 'DEVELOPMENT' });
    const prodEnv = { MONGODB_URL: production };
    assert.throws(() => identifyReadOnlyTarget({ argv: ['--expected-database=payroll_prod'],
        env: prodEnv, knownProductionUri: production, knownDevelopmentUri: env.MONGODB_URL }),
    /ACKNOWLEDGEMENT_REQUIRED/);
    assert.equal(identifyReadOnlyTarget({ argv: ['--expected-database=payroll_prod',
        '--acknowledge-production-read-only'], env: prodEnv,
        knownProductionUri: production,
        knownDevelopmentUri: env.MONGODB_URL }).environment, 'PRODUCTION');
    assert.throws(() => identifyReadOnlyTarget({ argv: ['--expected-database=payroll_dev'],
        env: { ...env, NODE_ENV: 'production' }, knownProductionUri: production,
        knownDevelopmentUri: env.MONGODB_URL }), /CONFIGURATION_CONFLICT/);
});

test('legacy repair mode is explicit and production apply needs a second confirmation', () => {
    const env = { MONGODB_URL: 'mongodb://user:secret@prod.invalid/payroll_prod' };
    const production = env.MONGODB_URL;
    assert.throws(() => validateRepairRequest({ argv: [], env,
        knownProductionUri: production }), /ακριβώς μία/);
    assert.throws(() => validateRepairRequest({ argv: ['--apply',
        '--expected-database=payroll_prod'], env, knownProductionUri: production }),
    /confirm-production-history-repair/);
    assert.equal(validateRepairRequest({ argv: ['--apply',
        '--expected-database=payroll_prod', '--confirm-production-history-repair'],
    env, knownProductionUri: production }).apply, true);
});
