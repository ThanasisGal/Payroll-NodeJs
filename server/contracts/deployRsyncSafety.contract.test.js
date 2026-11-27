'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const exclusions = path.join(root, 'rsync-excludes.txt');
const helper = path.join(root, 'scripts/deployment/rsyncSafety.js');
const protectedRoots = ['node_modules', 'uploads', 'logs', 'tmp', 'temp',
    'public/json', 'public/pdf', 'public/xlsx', 'public/xml', 'public/txt-cache',
    'backup', 'Backup', 'backups', 'Backups', '.payroll-env-backups',
    '.ssh', '.aws', 'secrets', '.secrets', 'screenshots', '.cache',
    '.git', '.github', '.vscode', '.idea', '.env', '.env.production',
    '.env.production.old', 'config/runtime.env', 'keys/private.pem',
    'keys/signing.key', 'config/credentials.json', 'config/service-account-test.json',
    'tblProsop.xlsx', 'saved.bak', 'mongo.dump', 'runtime.log', 'runtime.pid', 'runtime.sock'];

function fixture(t) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-rsync-safety-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    for (const dir of ['source', 'target', 'dev', 'external']) fs.mkdirSync(path.join(temp, dir));
    fs.writeFileSync(path.join(temp, 'dev', 'dependency.js'), 'SYNTHETIC DEV DEPENDENCY');
    fs.writeFileSync(path.join(temp, 'external', 'sentinel'), 'SYNTHETIC OUTSIDE DATA');
    return { temp, source: path.join(temp, 'source'), target: path.join(temp, 'target') };
}
function write(base, name, text) {
    const file = path.join(base, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}
function entry(base, name, kind, temp, label) {
    const file = path.join(base, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (kind === 'directory') write(base, name + '/nested/keep.bin', label);
    if (kind === 'file') fs.writeFileSync(file, label);
    if (kind === 'symlink') fs.symlinkSync(path.join(temp, label === 'DEV' ? 'dev' : 'external'), file);
    if (kind === 'broken') fs.symlinkSync(path.join(temp, 'missing-' + label), file);
}
function snapshot(file) {
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    const value = { inode: stat.ino, mode: stat.mode, uid: stat.uid, gid: stat.gid,
        mtime: stat.mtimeMs, ctime: stat.ctimeMs };
    if (stat.isSymbolicLink()) value.link = fs.readlinkSync(file);
    else if (stat.isDirectory()) value.children = Object.fromEntries(fs.readdirSync(file).sort()
        .map(name => [name, snapshot(path.join(file, name))]));
    else value.bytes = fs.readFileSync(file).toString('hex');
    return value;
}
function rsync(source, target, extra = []) {
    return spawnSync('rsync', ['-az', '--delete', '--info=progress2', '--exclude-from=' + exclusions,
        ...extra, source + '/', target + '/'], { encoding: 'utf8' });
}

test('real rsync reproducer: a DEV node_modules symlink must not delete existing target dependencies', t => {
    const f = fixture(t);
    fs.symlinkSync(path.join(f.temp, 'dev'), path.join(f.source, 'node_modules'));
    write(f.target, 'node_modules/package/existing.js', 'SYNTHETIC INSTALLED DEPENDENCY');
    write(f.source, 'app.js', 'NEW APPLICATION');
    const before = snapshot(path.join(f.target, 'node_modules'));
    const r = rsync(f.source, f.target, ['--itemize-changes']);
    t.diagnostic('real rsync exit=' + r.status + '\n' + r.stdout + r.stderr);
    assert.deepEqual(snapshot(path.join(f.target, 'node_modules')), before);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(f.target, 'app.js'), 'utf8'), 'NEW APPLICATION');
});

for (const sourceKind of ['symlink', 'directory', 'broken', 'file', 'absent']) {
    test('real rsync preserves every protected entry and its complete contents; source=' + sourceKind, t => {
        const f = fixture(t);
        for (const targetKind of ['directory', 'file', 'symlink', 'broken']) {
            const source = path.join(f.source, targetKind), target = path.join(f.target, targetKind);
            fs.mkdirSync(source); fs.mkdirSync(target);
            for (const name of protectedRoots) {
                entry(source, name, sourceKind, f.temp, 'DEV');
                entry(target, name, targetKind, f.temp, 'PROTECTED');
            }
            write(source, 'server/current.js', 'CURRENT APPLICATION');
            write(target, 'server/obsolete.js', 'OBSOLETE APPLICATION');
            const before = protectedRoots.map(name => snapshot(path.join(target, name)));
            const devBefore = snapshot(source), externalBefore = snapshot(path.join(f.temp, 'external'));
            const r = rsync(source, target);
            assert.equal(r.status, 0, r.stderr);
            assert.deepEqual(protectedRoots.map(name => snapshot(path.join(target, name))), before, targetKind);
            assert.deepEqual(snapshot(source), devBefore, 'DEV must remain untouched');
            assert.deepEqual(snapshot(path.join(f.temp, 'external')), externalBefore);
            assert.equal(fs.readFileSync(path.join(target, 'server/current.js'), 'utf8'), 'CURRENT APPLICATION');
            assert.equal(fs.existsSync(path.join(target, 'server/obsolete.js')), false);
            const empty = path.join(f.temp, 'empty-' + targetKind); fs.mkdirSync(empty);
            const hidden = rsync(source, empty);
            assert.equal(hidden.status, 0, hidden.stderr);
            for (const name of protectedRoots) assert.equal(snapshot(path.join(empty, name)), null, name);
        }
    });
}

test('source guard allows excluded symlinks without following or modifying them and rejects every publishable symlink', t => {
    const { assertSourceTree, loadPolicy } = require(helper);
    const f = fixture(t), policy = loadPolicy(exclusions);
    for (const name of ['node_modules', 'uploads', 'logs', 'tmp', 'backups'])
        entry(f.source, name, 'symlink', f.temp, 'DEV');
    entry(f.source, 'public/pdf', 'broken', f.temp, 'DEV');
    const before = snapshot(f.source), devBefore = snapshot(path.join(f.temp, 'dev'));
    assert.doesNotThrow(() => assertSourceTree(f.source, policy));
    assert.deepEqual(snapshot(f.source), before);
    assert.deepEqual(snapshot(path.join(f.temp, 'dev')), devBefore);
    for (const link of [path.join(f.temp, 'external'), path.join(f.temp, 'missing'), 'app.js']) {
        write(f.source, 'app.js', 'APPLICATION');
        fs.symlinkSync(link, path.join(f.source, 'unsafe'));
        assert.throws(() => assertSourceTree(f.source, policy), /DEPLOY_SOURCE_SYMLINK/);
        fs.unlinkSync(path.join(f.source, 'unsafe'));
    }
});

test('dry-run uses real transfer arguments, verifies the plan, and leaves both trees untouched', t => {
    const { runDryRun } = require(helper);
    const f = fixture(t);
    entry(f.source, 'node_modules', 'symlink', f.temp, 'DEV');
    write(f.target, 'node_modules/package/keep.js', 'INSTALLED');
    write(f.source, 'server/current.js', 'NEW');
    write(f.source, 'public/templates/ΣΥΝΘΕΤΙΚΗ ΦΟΡΜΑ.docx', 'SYNTHETIC TEMPLATE');
    write(f.target, 'server/obsolete.js', 'OLD');
    const sourceBefore = snapshot(f.source), targetBefore = snapshot(f.target);
    const args = ['-az', '--delete', '--info=progress2', '--exclude-from=' + exclusions, f.source + '/', f.target + '/'];
    const plan = runDryRun(f.source, exclusions, args);
    assert.match(plan, /server\/current.js/);
    assert.match(plan, /\*deleting.*server\/obsolete.js/);
    assert.deepEqual(snapshot(f.source), sourceBefore);
    assert.deepEqual(snapshot(f.target), targetBefore);
    assert.equal(rsync(f.source, f.target).status, 0);
    assert.equal(fs.readFileSync(path.join(f.target, 'node_modules/package/keep.js'), 'utf8'), 'INSTALLED');
});

test('plan validator rejects protected transfers, replacements, deletions, escaped paths and malformed records', () => {
    const { assertDryRunPlan, loadPolicy } = require(helper);
    const policy = loadPolicy(exclusions);
    for (const change of ['>f+++++++++', 'cL+++++++++', '*deleting  ', '.d..t......']) {
        for (const name of protectedRoots)
            assert.throws(() => assertDryRunPlan('PAYROLL_RSYNC|' + change + '|' + name + '\n', policy), /DEPLOY_PROTECTED_CHANGE/);
    }
    for (const name of ['uploads/keep.pdf', 'nested/node_modules/a.js', 'public/pdf/keep.pdf', 'public/\\#160df/keep.pdf', '../app.js', '/app.js', 'public'])
        assert.throws(() => assertDryRunPlan('PAYROLL_RSYNC|>f+++++++++|' + name + '\n', policy), /DEPLOY_/);
    for (const plan of ['PAYROLL_RSYNC|invalid|app.js\n', 'PAYROLL_RSYNC|>f+++++++++\n', '>f+++++++++ app.js\n'])
        assert.throws(() => assertDryRunPlan(plan, policy), /DEPLOY_RSYNC_PLAN/);
    assert.doesNotThrow(() => assertDryRunPlan('PAYROLL_RSYNC|*deleting  |server/obsolete.js\nPAYROLL_RSYNC|>f+++++++++|app.js\n', policy));
});

test('legacy directory-only exclusion deletes dependencies even when real rsync ends with code 23', t => {
    const f = fixture(t);
    entry(f.source, 'node_modules', 'symlink', f.temp, 'DEV');
    write(f.source, 'unreadable.js', 'SYNTHETIC TRANSFER ERROR');
    fs.chmodSync(path.join(f.source, 'unreadable.js'), 0o000);
    const legacy = path.join(f.temp, 'legacy-excludes');
    fs.writeFileSync(legacy, 'node_modules/\n');
    for (const fixed of [false, true]) {
        const target = path.join(f.target, fixed ? 'fixed' : 'legacy'); fs.mkdirSync(target);
        write(target, 'node_modules/package/keep.js', 'INSTALLED DEPENDENCY');
        const before = snapshot(path.join(target, 'node_modules'));
        const r = spawnSync('rsync', ['-az', '--delete', '--itemize-changes',
            '--exclude-from=' + (fixed ? exclusions : legacy), f.source + '/', target + '/'], { encoding: 'utf8' });
        assert.equal(r.status, 23, r.stderr);
        if (fixed) assert.deepEqual(snapshot(path.join(target, 'node_modules')), before);
        else {
            assert.match(r.stdout, /\*deleting\s+node_modules\/package\/keep.js/);
            assert.notDeepEqual(snapshot(path.join(target, 'node_modules')), before);
        }
        t.diagnostic((fixed ? 'GREEN' : 'RED') + ' real rsync exit=' + r.status + '; protected dependencies ' + (fixed ? 'intact' : 'deleted'));
    }
});

test('missing or weakened exclusions fail closed before rsync or mutations', t => {
    const { loadPolicy } = require(helper);
    const f = fixture(t), file = path.join(f.temp, 'excludes');
    assert.throws(() => loadPolicy(file), /ENOENT/);
    const canonical = fs.readFileSync(exclusions, 'utf8');
    for (const modified of [canonical.replace(/^node_modules$/m, 'node_modules/'),
        canonical.replace(/^uploads$/m, ''), canonical + '\n!\n', canonical + '\n+ uploads\n']) {
        fs.writeFileSync(file, modified);
        assert.throws(() => loadPolicy(file), /DEPLOY_EXCLUSION_POLICY/);
    }
});

test('real unsafe rsync plan and rsync exit 23 stop the production boundary before all mutation sentinels', t => {
    const f = fixture(t);
    const shell = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
    const body = shell.match(/^deployment_rsync_pre_mutation_guard\(\) \{[\s\S]*?^\}/m)?.[0];
    assert.ok(body, 'deployment must call the mandatory boundary function');
    write(f.source, 'app.js', 'APPLICATION');
    write(f.target, 'node_modules/package/keep.js', 'INSTALLED');
    const fakeBin = path.join(f.temp, 'bin'); fs.mkdirSync(fakeBin);
    const realRsync = spawnSync('which', ['rsync'], { encoding: 'utf8' }).stdout.trim();
    const before = snapshot(f.target);
    const runBoundary = options => spawnSync('bash', ['-c', 'set -euo pipefail\n' + body + '\n' +
        'PROJECT_DIR="$1"\nEXCLUDES_FILE="$2"\nEC2_USER_HOST=synthetic\nREMOTE_DIR=synthetic\n' +
        'RSYNC_OPTIONS=(--delete --info=progress2 "--exclude-from=$EXCLUDES_FILE")\n' +
        'deployment_rsync_pre_mutation_guard\n' +
        'printf "S3_MUTATION EC2_MUTATION PM2_RELOAD" > "$3"', 'boundary', f.source, exclusions,
        path.join(f.temp, 'mutation-sentinel')], {
        env: { ...process.env, PATH: fakeBin + ':' + process.env.PATH, ...options }, encoding: 'utf8'
    });
    // Keep the actual boundary/helper, replacing only its source-root lookup.
    fs.mkdirSync(path.join(f.source, 'scripts/deployment'), { recursive: true });
    fs.copyFileSync(helper, path.join(f.source, 'scripts/deployment/rsyncSafety.js'));
    fs.writeFileSync(path.join(fakeBin, 'rsync'), '#!/bin/bash\n' +
        'exec "$REAL_RSYNC" -az --delete --dry-run --itemize-changes --out-format="PAYROLL_RSYNC|%i|%n" "$SYNTHETIC_SOURCE/" "$SYNTHETIC_TARGET/"\n', { mode: 0o755 });
    const unsafe = runBoundary({ REAL_RSYNC: realRsync, SYNTHETIC_SOURCE: f.source, SYNTHETIC_TARGET: f.target });
    assert.notEqual(unsafe.status, 0);
    assert.match(unsafe.stderr, /DEPLOY_PROTECTED_CHANGE/);
    assert.equal(fs.existsSync(path.join(f.temp, 'mutation-sentinel')), false);
    assert.deepEqual(snapshot(f.target), before);
    fs.writeFileSync(path.join(fakeBin, 'rsync'), '#!/bin/sh\nexit 23\n', { mode: 0o755 });
    const failed = runBoundary({});
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /DEPLOY_RSYNC_DRY_RUN_FAILED/);
    assert.equal(fs.existsSync(path.join(f.temp, 'mutation-sentinel')), false);
    fs.symlinkSync(path.join(f.temp, 'external'), path.join(f.source, 'unsafe'));
    const link = runBoundary({});
    assert.notEqual(link.status, 0);
    assert.match(link.stderr, /DEPLOY_SOURCE_SYMLINK/);
    assert.equal(fs.existsSync(path.join(f.temp, 'mutation-sentinel')), false);
    assert.deepEqual(snapshot(f.target), before);
});

test('both source and dry-run guards precede production mutations and retain shared destructive transfer options', () => {
    const app = fs.readFileSync(path.join(root, 'deploy-ubuntu.sh'), 'utf8');
    const boundary = app.indexOf('\ndeployment_rsync_pre_mutation_guard\n');
    assert.ok(boundary > 0);
    for (const command of ['PRODUCTION_OPERATION_STARTED="true"', 'aws s3 sync', 'sudo fallocate', '\nrsync -az', 'pm2 reload payroll'])
        assert.ok(boundary < app.indexOf(command), command);
    assert.ok(app.indexOf('\ndeployment_source_symlink_guard\n') < app.indexOf('BUILD_STARTED="true"\nlog_info'));
    assert.match(app, /rsync -az "\$\{RSYNC_OPTIONS\[@\]\}"/);
    assert.match(app, /plan "\$PROJECT_DIR" "\$EXCLUDES_FILE" -- -az "\$\{RSYNC_OPTIONS\[@\]\}"/);
    assert.match(app, /RSYNC_OPTIONS=\([\s\S]*?--delete[\s\S]*?--exclude-from=/);
    assert.doesNotMatch(app, /Creating empty excludes file|touch "\$EXCLUDES_FILE"/);
    const css = fs.readFileSync(path.join(root, 'deploy-css-linux.sh'), 'utf8');
    const deploy = css.slice(css.indexOf('run_deploy_workflow()'));
    assert.ok(deploy.indexOf('rsyncSafety.js') > 0 && deploy.indexOf('rsyncSafety.js') < deploy.indexOf('\n    promote_css_through_staging\n'));
});
