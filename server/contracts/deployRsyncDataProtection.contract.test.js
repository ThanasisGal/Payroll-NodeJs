'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const exclusions = path.resolve(__dirname, '../../rsync-excludes.txt');

test('real rsync --delete protects EC2 data and never sends DEV documents or secrets', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-rsync-data-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, 'source'), target = path.join(root, 'target');
    fs.mkdirSync(source); fs.mkdirSync(target);
    const write = (base, file, text) => {
        fs.mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
        fs.writeFileSync(path.join(base, file), text);
    };
    const protectedPaths = [
        '.env', '.env.production', '.env.backup-before-release', '.env.production.old',
        'config/runtime.env', 'config/runtime.env.backup', '.aws/credentials',
        'config/credentials.json', '.ssh/id_ed25519', 'keys/private.pem', 'keys/signing.key',
        'config/service-account-production.json', 'uploads/pdfs/real.pdf',
        'uploads/s3-mock/xlsx/payroll.xlsx', 'uploads/xmls/submission.xml',
        'logs/pm2-out.log', 'tmp/output.pdf', 'tmp/output.xlsx', 'tmp/output.xml',
        'public/pdf/generated.pdf', 'public/xlsx/generated.xlsx', 'public/xml/generated.xml',
        'public/json/runtime.json', 'public/txt-cache/extracted.txt', 'tblProsop.xlsx',
        'backups/mongo/archive.gz', 'backup/application.zip', '.payroll-env-backups/.env.original'
    ];
    for (const file of protectedPaths) {
        write(source, file, 'DEV MUST NOT TRANSFER');
        write(target, file, 'PRODUCTION MUST SURVIVE');
        write(target, path.join(path.dirname(file), 'production-only', path.basename(file)), 'PRODUCTION ONLY');
    }
    const applicationPaths = ['app.js', 'server/runtime.js', 'views/form.ejs',
        'public/js/app.js', 'public/min.js/app.js', 'public/css/main.css',
        'server/templates/pdf/static.pdf', 'public/templates/form.pdf',
        'server/schemas/ergani.xml', 'server/templates/xlsx/static.xlsx', 'public/fonts/font.woff2'];
    for (const file of applicationPaths) write(source, file, 'APPLICATION');
    write(target, 'server/removed.js', 'OBSOLETE APPLICATION');
    const result = spawnSync('rsync', ['-a', '--delete', '--exclude-from=' + exclusions,
        source + '/', target + '/'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const file of protectedPaths) {
        assert.equal(fs.readFileSync(path.join(target, file), 'utf8'), 'PRODUCTION MUST SURVIVE', file);
        assert.equal(fs.readFileSync(path.join(target, path.join(path.dirname(file), 'production-only', path.basename(file))), 'utf8'), 'PRODUCTION ONLY', file);
    }
    for (const file of applicationPaths)
        assert.equal(fs.readFileSync(path.join(target, file), 'utf8'), 'APPLICATION', file);
    assert.equal(fs.existsSync(path.join(target, 'server/removed.js')), false);
    // A second empty receiver proves that protection also hides DEV data.
    const empty = path.join(root, 'empty'); fs.mkdirSync(empty);
    const second = spawnSync('rsync', ['-a', '--delete', '--exclude-from=' + exclusions,
        source + '/', empty + '/'], { encoding: 'utf8' });
    assert.equal(second.status, 0, second.stderr);
    for (const file of protectedPaths) assert.equal(fs.existsSync(path.join(empty, file)), false, file);
});
