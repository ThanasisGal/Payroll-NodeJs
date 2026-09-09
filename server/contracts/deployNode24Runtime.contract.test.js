'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = fs.readFileSync(path.resolve(__dirname, '../../deploy-ubuntu.sh'), 'utf8');
const remote = script.slice(script.indexOf('# REMOTE DEPLOYMENT')).split("bash <<'ENDSSH'\n")[1].split('\nENDSSH')[0];
const preflight = remote.slice(remote.indexOf('    NODE24_BIN='), remote.indexOf('    echo "[EC2] Configuring npm'));
const nativeGuard = remote.slice(remote.indexOf('    if ! "$NODE24_BIN/node"'), remote.indexOf('    export PATH="$DEPENDENCY_ORIGINAL_PATH"'));

function fixture(t, { version = 'v24.12.0', abi = '137', nativeExit = 0, missing = '' } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-node24-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (missing !== 'node') fs.writeFileSync(path.join(root, 'node'), `#!/bin/bash
case "$1" in
    --version) echo '${version}' ;;
    -p) echo '${abi}' ;;
    -e) exit ${nativeExit} ;;
    *) exit 99 ;;
esac
`, { mode: 0o755 });
    if (missing !== 'npm') fs.writeFileSync(path.join(root, 'npm'), '#!/bin/bash\nexit 98\n', { mode: 0o755 });
    return root;
}

function run(t, options = {}, postflight = false) {
    const root = fixture(t, options);
    // Execute only the actual guards against isolated executables; never SSH/npm/PM2.
    const source = preflight.replace('NODE24_BIN=/opt/node-v24.12.0/bin', `NODE24_BIN='${root}'`);
    return spawnSync('bash', ['-c', `set -euo pipefail\n${source}\necho INSTALL_REACHED\n${postflight ? nativeGuard : ''}\necho PM2_REACHED`], { encoding: 'utf8' });
}

test('remote install pins Node and npm, verifies version and ABI before any npm command', () => {
    assert.match(preflight, /NODE24_BIN=\/opt\/node-v24\.12\.0\/bin/);
    assert.match(preflight, /export PATH="\$NODE24_BIN:\$PATH"\s+hash -r/);
    assert.match(preflight, /command -v node/);
    assert.match(preflight, /command -v npm/);
    assert.match(preflight, /node --version.*v24\.12\.0/);
    assert.match(preflight, /process\.versions\.modules.*137/);
    assert.doesNotMatch(remote, /^\s*(?:if )?npm (?:ci|install|config|cache|list) /m);
    assert.equal((remote.match(/if "\$NODE24_BIN\/npm" (?:ci|install) --omit=dev/g) || []).length, 4);
    assert.ok(remote.includes('"$NODE24_BIN/npm" ci --omit=dev --prefer-offline --no-audit'));
    assert.ok(remote.includes('"$NODE24_BIN/npm" ci --omit=dev --no-audit'));
    assert.match(remote, /MAX_ATTEMPTS=3/);
    assert.match(remote, /sleep 10\s+ATTEMPT=\$\(\(ATTEMPT \+ 1\)\)/);
    const guardPosition = remote.indexOf(nativeGuard);
    assert.ok(guardPosition > remote.indexOf('if [ "$INSTALL_SUCCESS" = true ]'));
    assert.ok(guardPosition < remote.indexOf('pm2 flush'));
    assert.ok(guardPosition < remote.indexOf('pm2 reload payroll --update-env'));
    assert.match(nativeGuard, /"\$NODE24_BIN\/node" -e "require\('libxmljs2'\)"/);
    assert.ok(remote.indexOf('export PATH="$DEPENDENCY_ORIGINAL_PATH"') < remote.indexOf('pm2 flush'));
});

for (const options of [{ missing: 'node' }, { missing: 'npm' }, { version: 'v22.0.0' }, { abi: '127' }]) {
    test(`runtime mismatch blocks installation: ${JSON.stringify(options)}`, t => {
        const result = run(t, options);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /NODE24_RUNTIME_GUARD_FAILED/);
        assert.doesNotMatch(result.stdout, /INSTALL_REACHED|PM2_REACHED/);
    });
}

test('native ABI load failure prevents reaching PM2', t => {
    const result = run(t, { nativeExit: 1 }, true);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /INSTALL_REACHED/);
    assert.match(result.stderr, /LIBXMLJS2_NODE24_GUARD_FAILED/);
    assert.doesNotMatch(result.stdout, /PM2_REACHED/);
});

test('valid Node 24 runtime and native module pass both guards', t => {
    const result = run(t, {}, true);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /INSTALL_REACHED\s+PM2_REACHED/);
});
