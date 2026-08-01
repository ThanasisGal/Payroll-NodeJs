'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const excludeFile = path.join(repositoryRoot, 'rsync-excludes.txt');
const guardScript = path.join(repositoryRoot, 'scripts/deployment/test-js-artifact-guard.sh');
const deployScript = fs.readFileSync(path.join(repositoryRoot, 'deploy-ubuntu.sh'), 'utf8');

function writeFixture(root, relativePath, contents = relativePath) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function createApplicationFixture(root) {
    writeFixture(root, 'app.js');
    writeFixture(root, 'package.json', '{}');
    fs.mkdirSync(path.join(root, 'server'), { recursive: true });
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
}

function runGuard(action, root) {
    return spawnSync('bash', [guardScript, action, root], { encoding: 'utf8' });
}

function fixtureRoot(t, label) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-Ελληνικά-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}

test('canonical rsync exclude removes every application-owned test basename at any depth', (t) => {
    const fixture = fixtureRoot(t, 'test-js-rsync');
    const source = path.join(fixture, 'source tree');
    const destination = path.join(fixture, 'destination tree');
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });

    [
        'server/a.test.js',
        'server/nested/b.test.js',
        'public/js/c.test.js',
        'client/deep/d.test.js',
        'scripts/e.test.js',
        'future/feature/f.test.js',
        'root.test.js',
        'server/runtime.js',
        'public/js/runtime.js',
        'test-data.json',
        'node_modules/example/package.test.js'
    ].forEach((file) => writeFixture(source, file));

    const result = spawnSync('rsync', [
        '-a',
        '--exclude-from', excludeFile,
        `${source}/`,
        `${destination}/`
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    for (const file of [
        'server/a.test.js', 'server/nested/b.test.js', 'public/js/c.test.js',
        'client/deep/d.test.js', 'scripts/e.test.js', 'future/feature/f.test.js',
        'root.test.js', 'node_modules/example/package.test.js'
    ]) {
        assert.equal(fs.existsSync(path.join(destination, file)), false, file);
    }
    for (const file of ['server/runtime.js', 'public/js/runtime.js', 'test-data.json']) {
        assert.equal(fs.existsSync(path.join(destination, file)), true, file);
    }
    assert.match(fs.readFileSync(excludeFile, 'utf8'), /^\*\.test\.js$/m);
    assert.match(fs.readFileSync(excludeFile, 'utf8'), /^node_modules\/$/m);
});

test('canonical deploy requires the exclude and runs cleanup plus postflight after rsync', () => {
    assert.match(deployScript, /exclude_file_has_exact_line '\*\.test\.js'/);
    assert.equal(deployScript.includes('--delete-excluded'), false);
    assert.equal(
        (deployScript.match(/bash "\$GUARD" cleanup "\$APP_ROOT"/g) || []).length,
        1
    );
    assert.equal(
        (deployScript.match(/bash "\$GUARD" verify "\$APP_ROOT"/g) || []).length,
        1
    );
    const rsyncPosition = deployScript.indexOf('rsync -az --delete --info=progress2');
    const cleanupPosition = deployScript.indexOf('bash "$GUARD" cleanup "$APP_ROOT"');
    const verifyPosition = deployScript.indexOf('bash "$GUARD" verify "$APP_ROOT"');
    const reloadPosition = deployScript.indexOf('pm2 reload payroll --update-env');
    assert.ok(rsyncPosition >= 0 && rsyncPosition < cleanupPosition);
    assert.ok(cleanupPosition < verifyPosition);
    assert.ok(verifyPosition < reloadPosition);
});

test('safe cleanup removes only regular application tests without following symlinks or node_modules', (t) => {
    const fixture = fixtureRoot(t, 'test-js-cleanup');
    const root = path.join(fixture, 'application root');
    const outside = path.join(fixture, 'outside');
    createApplicationFixture(root);
    fs.mkdirSync(outside, { recursive: true });

    writeFixture(root, 'server/a.test.js');
    writeFixture(root, 'client/deep/d.test.js');
    writeFixture(root, 'server/runtime.js');
    writeFixture(root, 'node_modules/example/package.test.js');
    writeFixture(outside, 'outside.test.js');
    fs.symlinkSync(outside, path.join(root, 'server', 'linked-directory'));
    fs.symlinkSync(path.join(outside, 'outside.test.js'), path.join(root, 'public', 'linked.test.js'));

    const result = runGuard('cleanup', root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Application test files found: 2/);
    assert.equal(fs.existsSync(path.join(root, 'server/a.test.js')), false);
    assert.equal(fs.existsSync(path.join(root, 'client/deep/d.test.js')), false);
    assert.equal(fs.existsSync(path.join(root, 'server/runtime.js')), true);
    assert.equal(fs.existsSync(path.join(root, 'node_modules/example/package.test.js')), true);
    assert.equal(fs.existsSync(path.join(outside, 'outside.test.js')), true);
    assert.equal(fs.lstatSync(path.join(root, 'public/linked.test.js')).isSymbolicLink(), true);
});

test('guard fails closed for empty, relative, symlinked, or unexpected roots', (t) => {
    const fixture = fixtureRoot(t, 'test-js-root');
    const unexpected = path.join(fixture, 'unexpected');
    const valid = path.join(fixture, 'valid');
    const linked = path.join(fixture, 'linked');
    fs.mkdirSync(unexpected);
    createApplicationFixture(valid);
    fs.symlinkSync(valid, linked);

    for (const root of ['', 'relative/path', '/', unexpected, linked]) {
        const result = runGuard('verify', root);
        assert.notEqual(result.status, 0, root);
        assert.match(result.stderr, /TEST JS DEPLOYMENT GUARD FAILED/);
    }
});

test('postflight fails with application tests and passes at zero count', (t) => {
    const fixture = fixtureRoot(t, 'test-js-postflight');
    const root = path.join(fixture, 'app');
    createApplicationFixture(root);
    writeFixture(root, 'server/remains.test.js');

    const failed = runGuard('verify', root);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /Application test files found: 1/);
    assert.match(failed.stderr, /application test files remain/);
    assert.equal(failed.stdout.includes('remains.test.js'), false);

    fs.rmSync(path.join(root, 'server/remains.test.js'));
    const passed = runGuard('verify', root);
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout, /Application test-file verification complete: 0 found/);
});
