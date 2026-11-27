'use strict';

// Read-only deployment checks. No dependency loading, link following or writes.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Keep runtime protection mandatory even if the exclusions file is weakened.
const REQUIRED_PATTERNS = [
    '.env', '.env.production', '.env.*', '.env-*', '*.env', '*.env.*',
    '*.pem', '*.key', '*.p12', '*.pfx', '*.jks', '*.keystore', 'id_rsa*', 'id_ed25519*',
    '.ssh', '.aws', 'credentials', 'credentials.*', 'service-account*.json', 'secrets', '.secrets',
    'uploads', 'logs', 'tmp', 'temp', 'public/json', 'public/pdf', 'public/xlsx',
    'public/xml', 'public/txt-cache', 'tblProsop.xlsx', '*.log', '*.pid', '*.sock',
    '[Bb]ackup', '[Bb]ackups', '*backup*.tar*', '*backup*.gz', '*.bak', '*.dump',
    '.env*backup*', '.payroll*backup*', 'screenshots', '.cache',
    '.git', '.github', '.vscode', '.idea', 'node_modules', '*.test.js'
];

function fail(code, detail) {
    throw Object.assign(new Error(code + ': ' + detail), { code });
}

function loadPolicy(file) {
    const patterns = fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter(line => line && !line.startsWith('#'));
    const rules = patterns.map(pattern => {
        // Deliberately support only this file's simple, bilateral exclude grammar.
        // Directory-only, clear-list and one-sided rules must never weaken it.
        const plain = pattern.replaceAll('[Bb]', 'B');
        if (!/^[A-Za-z0-9_.*?/-]+$/.test(plain) || pattern.startsWith('/') ||
            pattern.startsWith('-') || pattern.endsWith('/') || pattern.includes('**') ||
            pattern.split('/').some(part => !part || part === '..' || part === '.'))
            fail('DEPLOY_EXCLUSION_POLICY', 'unsupported exclusion ' + pattern);
        const expression = pattern.split('[Bb]').map(part => part
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replaceAll('*', '[^/]*').replaceAll('?', '[^/]')).join('[Bb]');
        return { pattern, fullPath: pattern.includes('/'), regex: new RegExp('^' + expression + '$') };
    });
    for (const required of REQUIRED_PATTERNS)
        if (!patterns.includes(required)) fail('DEPLOY_EXCLUSION_POLICY', 'missing exclusion ' + required);
    return rules;
}

function isProtected(relative, policy) {
    const parts = relative.split('/');
    for (let count = 1; count <= parts.length; count++) {
        const prefix = parts.slice(0, count).join('/');
        if (policy.some(rule => rule.regex.test(rule.fullPath ? prefix : parts[count - 1]))) return true;
    }
    return false;
}

function assertSourceTree(projectDir, policy) {
    const absolute = path.resolve(projectDir);
    if (fs.realpathSync(absolute) !== absolute || !fs.lstatSync(absolute).isDirectory())
        fail('DEPLOY_SOURCE_ROOT', 'source root must be a canonical directory');
    const visit = relative => {
        for (const name of fs.readdirSync(path.join(absolute, relative))) {
            const child = relative ? relative + '/' + name : name;
            if (isProtected(child, policy)) continue;
            const stat = fs.lstatSync(path.join(absolute, child));
            if (stat.isSymbolicLink()) fail('DEPLOY_SOURCE_SYMLINK', child);
            if (stat.isDirectory()) visit(child);
        }
    };
    visit('');
}

function assertDryRunPlan(output, policy) {
    for (const line of output.split(/[\r\n]/)) {
        if (!line.trim()) continue;
        // --info=progress2 is also present in the actual transfer options.
        if (/^\s*[\d,]+\s+\d+%\s+[\d.]+[kMGT]?B\/s\s+\d+:\d+:\d+(?:\s+\(.*\))?\s*$/.test(line)) continue;
        const record = /^PAYROLL_RSYNC\|([^|]{11})\|(.+)$/.exec(line);
        if (!record || !/^(?:[<>ch.][fdLDS][A-Za-z.+? ]{9}|\*deleting  )$/.test(record[1]))
            fail('DEPLOY_RSYNC_PLAN', 'unrecognized dry-run output');
        // With LC_ALL=C, rsync encodes UTF-8 filenames as octal bytes. Decode
        // once before matching, so Greek application templates remain valid and
        // an escaped spelling cannot hide a protected path.
        const chunks = record[2].split(/(\\#[0-7]{3})/).filter(Boolean).map(part =>
            /^\\#[0-7]{3}$/.test(part) ? Buffer.from([parseInt(part.slice(2), 8)]) : Buffer.from(part));
        let name;
        try { name = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
        catch { fail('DEPLOY_RSYNC_PLAN', 'invalid filename encoding'); }
        if (name === './') continue;
        if (name.startsWith('./')) name = name.slice(2);
        name = name.replace(/\/$/, '');
        // Refuse ambiguous records rather than overlook a protected path.
        if (!name || /[\\\x00-\x1f\x7f]/.test(name) || name.startsWith('/') ||
            name.split('/').some(part => !part || part === '..' || part === '.'))
            fail('DEPLOY_RSYNC_PLAN', 'ambiguous itemized path');
        const changesProtectedParent = policy.some(rule => rule.fullPath && rule.pattern.startsWith(name + '/')) &&
            (record[1].startsWith('*deleting') || record[1][1] !== 'd');
        if (isProtected(name, policy) || changesProtectedParent)
            fail('DEPLOY_PROTECTED_CHANGE', record[1] + ' ' + name);
        if (record[1][1] === 'L') fail('DEPLOY_SOURCE_SYMLINK', name);
    }
}

function runDryRun(projectDir, exclusions, transferArgs) {
    const policy = loadPolicy(exclusions);
    assertSourceTree(projectDir, policy);
    // Insert diagnostic options without changing any transfer/filter/SSH option.
    const result = spawnSync('rsync', ['--dry-run', '--itemize-changes',
        '--out-format=PAYROLL_RSYNC|%i|%n', ...transferArgs], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' }
    });
    if (result.error || result.status !== 0 || result.signal)
        fail('DEPLOY_RSYNC_DRY_RUN_FAILED', 'rsync exit=' + result.status + ' ' + (result.error?.message || result.stderr || result.signal || ''));
    assertDryRunPlan(result.stdout, policy);
    return result.stdout;
}

function main(args) {
    const [action, projectDir, exclusions, separator, ...transferArgs] = args;
    if (action === 'source' && args.length === 3) assertSourceTree(projectDir, loadPolicy(exclusions));
    else if (action === 'plan' && separator === '--' && transferArgs.length)
        process.stdout.write(runDryRun(projectDir, exclusions, transferArgs));
    else fail('DEPLOY_SAFETY_USAGE', 'source PROJECT EXCLUDES | plan PROJECT EXCLUDES -- RSYNC_ARGUMENTS');
    console.log('DEPLOY_RSYNC_SAFETY_OK ' + action);
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) {
        console.error('Η εγκατάσταση σταμάτησε επειδή ο έλεγχος μεταφοράς δεν επιβεβαίωσε την ασφάλεια των αρχείων.\n' +
            '1. Ελέγξτε τις εξαιρέσεις και τους συμβολικούς συνδέσμους στον κατάλογο εγκατάστασης.\n' +
            '2. Διορθώστε το αναφερόμενο πρόβλημα και επαναλάβετε πρώτα τη δοκιμαστική μεταφορά.\n' +
            'Ο έλεγχος δεν αποθήκευσε αλλαγές και δεν ξεκίνησε μεταβολές στην παραγωγή.\n' +
            'Κωδικός αναφοράς: ' + error.message);
        process.exitCode = 1;
    }
}

module.exports = { loadPolicy, isProtected, assertSourceTree, assertDryRunPlan, runDryRun };
