'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const version = '11.26.25';
const cdnUrl = `https://cdn.webpayrollsolutions.com/assets/own/vendor/sweetalert2-${version}.min.js`;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('SweetAlert dependency, lock and installed library use the exact runtime version', () => {
    const manifest = JSON.parse(read('package.json'));
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(manifest.dependencies.sweetalert2, version);
    assert.equal(lock.packages[''].dependencies.sweetalert2, version);
    assert.equal(lock.packages['node_modules/sweetalert2'].version, version);
    assert.equal(lock.packages['node_modules/sweetalert2'].resolved,
        `https://registry.npmjs.org/sweetalert2/-/sweetalert2-${version}.tgz`);
    assert.equal(require('sweetalert2/package.json').version, version);
    assert.equal(require('sweetalert2').version, version);
});

test('main layout loads exactly one immutable versioned SweetAlert asset', () => {
    const layout = read('views/layouts/main.ejs');
    const sources = [...layout.matchAll(/<script\b[^>]*\bsrc="([^"]*sweetalert2[^"]*)"[^>]*>/g)]
        .map(match => match[1]);
    assert.deepEqual(sources, [cdnUrl]);
});

test('offline browser builds match the version and the verified CDN upload bytes', () => {
    const dist = 'node_modules/sweetalert2/dist/';
    for (const file of ['sweetalert2.all.js', 'sweetalert2.all.min.js']) {
        assert.ok(read(dist + file).startsWith(`/*!\n* sweetalert2 v${version}\n`), file);
    }
    // Live CDN verification is an explicit upgrade smoke, never an ordinary CI request.
    const sha = crypto.createHash('sha256').update(read(dist + 'sweetalert2.all.min.js')).digest('hex');
    assert.equal(sha, '4e86f0e22e4771b5b8aac24c613c661806a678b1afa284d03cf6ad03d3e21a0a');
});
