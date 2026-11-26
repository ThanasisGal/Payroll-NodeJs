'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const { createRemoteProgram, writePrivateReport } = require('../../scripts/deployment/productionCandidateReadiness');

function evaluate({ flag = 'false', reject = false, missingDependency = false } = {}) {
    const env = { NODE_ENV: 'production', ALLOW_REPO_TRANSFER_APPLY: flag,
        ALLOW_PRODUCTION_REPO_TRANSFER_APPLY: 'false',
        PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED: 'false', PAYROLL_USAGE_CLEANUP_ENABLED: 'false' };
    const logs = [];
    const source = {
        'scripts/checkEmployeeHistoryRepairAudit.js': 'module.exports.runCheck=async()=>({ready:true});',
        'scripts/checkEmployeeHistoryReadiness.js': missingDependency
            ? "require('../server/missing');"
            : reject ? "module.exports.runReadiness=async()=>{throw Object.assign(new Error('EMPLOYEE_HISTORY_POPULATION_NOT_READY'),{summary:{DEPLOYMENT_BLOCKER_COUNT:1}})};"
                : "module.exports.runReadiness=async()=>({DEPLOYMENT_BLOCKER_COUNT:0,candidate:'EXACT_CANDIDATE'});"
    };
    const sandbox = {
        module, console: { log: value => logs.push(JSON.parse(value)) },
        process: { execPath: '/opt/node-v24.12.0/bin/node', version: 'v24.12.0',
            versions: { modules: '137' }, env: {}, cwd: () => '/home/ubuntu/Payroll-NodeJs' },
        require(name) {
            if (name === 'node:fs') return {
                existsSync: () => true, realpathSync: () => '/opt/node-v24.12.0/bin/node',
                readFileSync: name => name.endsWith('/environ')
                    ? 'ALLOW_REPO_TRANSFER_APPLY=false\0ALLOW_PRODUCTION_REPO_TRANSFER_APPLY=false\0'
                    : Buffer.from('CONFIGURATION')
            };
            if (name === 'dotenv') return { parse: () => env };
            if (name === 'mongoose/package.json') return { version: 'test-driver' };
            if (name === 'node:child_process') return { execFileSync: () => JSON.stringify([
                { name: 'payroll', pid: 42, pm2_env: { ...env, status: 'online' } }
            ]) };
            return require(name);
        }
    };
    const context = vm.createContext(sandbox);
    return vm.runInContext(createRemoteProgram({ head: 'a'.repeat(40), sources: source }), context)
        .then(() => ({ logs, exitCode: sandbox.process.exitCode }));
}

test('candidate DB gate executes bundled source and never installed candidate files', async () => {
    const r = await evaluate();
    assert.equal(r.logs[0].ready, true);
    assert.equal(r.logs[0].population.candidate, 'EXACT_CANDIDATE');
});
test('candidate DB blocker prevents success and preserves its complete report', async () => {
    const r = await evaluate({ reject: true });
    assert.equal(r.exitCode, 1);
    assert.equal(r.logs[0].ready, false);
    assert.equal(r.logs[0].population.DEPLOYMENT_BLOCKER_COUNT, 1);
});
test('enabled apply flag stops before candidate checks', async () => {
    const r = await evaluate({ flag: 'true' });
    assert.equal(r.logs[0].code, 'REMOTE_APPLY_FLAGS_GUARD_FAILED');
});
test('unbundled dependency fails closed instead of falling back to installed source', async () => {
    const r = await evaluate({ missingDependency: true });
    assert.equal(r.logs[0].code, 'CANDIDATE_DEPENDENCY_NOT_BUNDLED');
});

test('reports require a private directory outside Git and cannot overwrite files', t => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'private-readiness-'));
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    fs.chmodSync(parent, 0o700);
    const file = path.join(parent, 'report.json');
    writePrivateReport(file, { ready: false }, root);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.throws(() => writePrivateReport(file, {}, root), /EEXIST/);
    assert.throws(() => writePrivateReport(path.join(root, 'private.json'), {}, root), /OUTSIDE_GIT/);
});

test('both workflows evaluate candidate DB readiness before their first production mutation', () => {
    const app = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'deploy-css-linux.sh'), 'utf8');
    const candidate = app.indexOf('\ncandidate_production_readiness_guard\n');
    for (const command of ['aws s3 sync', 'sudo fallocate', '\nrsync -az', 'pm2 reload payroll'])
        assert.ok(candidate > 0 && candidate < app.indexOf(command), command);
    assert.ok(app.indexOf('\n    exact_head_main_ci_guard\n') > app.indexOf('\nimmutable_git_preflight\n'));
    const cssDeploy = css.slice(css.indexOf('run_deploy_workflow()'));
    assert.ok(cssDeploy.indexOf('productionCandidateReadiness.js') < cssDeploy.indexOf('\n    promote_css_through_staging\n'));
    assert.ok(cssDeploy.indexOf('immutable_git_pre_mutation_guard') < cssDeploy.indexOf('productionCandidateReadiness.js'));
    assert.match(app, /PROJECT_DIR="\$\{DEPLOY_PROJECT_DIR:-\$HOME\/Projects\/Payroll-NodeJs\}"/);
    assert.doesNotMatch(app, /(?:sudo )?(?:chmod|chown) -R/);
    assert.ok(app.indexOf('scripts/checkEmployeeHistoryReadiness.js') > app.indexOf('# REMOTE DEPLOYMENT'));
});

test('failure of the real shell candidate guard stops execution before a mutation', t => {
    const source = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
    const body = source.match(/^candidate_production_readiness_guard\(\) \{[\s\S]*?^\}/m)[0];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-shell-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.writeFileSync(path.join(temp, 'node'), '#!/bin/sh\nexit 42\n', { mode: 0o755 });
    const r = spawnSync('bash', ['-c', 'set -euo pipefail\n' + body +
        '\nPROJECT_DIR=/synthetic\nINITIAL_HEAD=synthetic\nEC2_USER_HOST=synthetic\nEC2_KEY=synthetic\n' +
        'candidate_production_readiness_guard\nprintf MUTATION_REACHED'], {
        env: { ...process.env, PATH: temp + ':' + process.env.PATH }, encoding: 'utf8'
    });
    assert.equal(r.status, 42);
    assert.doesNotMatch(r.stdout, /MUTATION_REACHED/);
});
