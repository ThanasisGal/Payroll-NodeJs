'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');

function collectCandidateModules(root, head) {
    const sources = {}, pending = ['scripts/checkEmployeeHistoryRepairAudit.js', 'scripts/checkEmployeeHistoryReadiness.js'];
    while (pending.length) {
        const name = pending.pop();
        if (Object.hasOwn(sources, name)) continue;
        if (name.startsWith('../') || path.posix.isAbsolute(name)) throw new Error('CANDIDATE_SOURCE_OUTSIDE_REPOSITORY');
        const text = execFileSync('git', ['show', head + ':' + name], { cwd: root, encoding: 'utf8' });
        sources[name] = text;
        for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
            if (!match[1].startsWith('.')) continue;
            let target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
            if (!target.endsWith('.js')) target += '.js';
            pending.push(target);
        }
    }
    return { head, sources };
}

// Executed by pinned Node.js over SSH stdin. No candidate files, configuration,
// dependencies, setup or migrations are written to the production machine.
async function remoteCandidateReadiness(bundle) {
    const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
    const { execFileSync } = require('node:child_process');
    const root = process.cwd(), cache = {};
    function load(name) {
        if (cache[name]) return cache[name].exports;
        if (!Object.hasOwn(bundle.sources, name)) throw new Error('CANDIDATE_DEPENDENCY_NOT_BUNDLED');
        const filename = path.join(root, name), entry = new Module(filename, module);
        cache[name] = entry;
        entry.filename = filename;
        entry.paths = Module._nodeModulePaths(path.dirname(filename));
        const external = Module.createRequire(filename);
        entry.require = specifier => {
            if (!specifier.startsWith('.')) return external(specifier);
            let target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
            if (!target.endsWith('.js')) target += '.js';
            return load(target);
        };
        entry._compile(bundle.sources[name], filename);
        entry.loaded = true;
        return entry.exports;
    }
    if (process.execPath !== '/opt/node-v24.12.0/bin/node' ||
        process.version !== 'v24.12.0' || process.versions.modules !== '137' ||
        !fs.existsSync('/opt/node-v24.12.0/bin/npm')) throw new Error('NODE24_RUNTIME_GUARD_FAILED');
    try { fs.accessSync('/opt/node-v24.12.0/bin/npm', fs.constants.X_OK); }
    catch { throw new Error('NODE24_RUNTIME_GUARD_FAILED'); }
    const configured = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
    const env = { ...process.env, ...configured };
    const flagNames = ['ALLOW_REPO_TRANSFER_APPLY', 'ALLOW_PRODUCTION_REPO_TRANSFER_APPLY'];
    const disabled = value => String(value ?? '').trim().toLowerCase() === 'false';
    if (flagNames.some(name => !disabled(env[name]))) throw new Error('REMOTE_APPLY_FLAGS_GUARD_FAILED');
    if (env.NODE_ENV !== 'production' ||
        env.PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED !== 'false' ||
        env.PAYROLL_USAGE_CLEANUP_ENABLED !== 'false') throw new Error('PRODUCTION_DATABASE_PROTECTIONS_NOT_READY');
    if (!fs.existsSync(path.join(require('node:os').homedir(), '.pm2/rpc.sock')))
        throw new Error('PM2_DAEMON_NOT_RUNNING');
    const processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    const active = processes.filter(item => item.name === 'payroll');
    if (!active.length || active.some(item => item.pm2_env.status !== 'online'))
        throw new Error('PM2_PAYROLL_NOT_ONLINE');
    for (const item of active) {
        const pm2env = { ...item.pm2_env.env, ...item.pm2_env };
        const live = Object.fromEntries(fs.readFileSync('/proc/' + item.pid + '/environ', 'utf8')
            .split('\0').filter(value => value.includes('=')).map(value => {
                const split = value.indexOf('='); return [value.slice(0, split), value.slice(split + 1)];
            }));
        if (flagNames.some(name => !disabled(pm2env[name]) || !disabled(live[name])))
            throw new Error('REMOTE_PROCESS_APPLY_FLAGS_GUARD_FAILED');
        // dotenv does not override inherited process values. Check the real
        // startup environment as well as the configuration used by this probe.
        for (const inherited of [pm2env, live]) {
            for (const name of ['PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED', 'PAYROLL_USAGE_CLEANUP_ENABLED'])
                if (!disabled(inherited[name] ?? configured[name]))
                    throw new Error('ACTIVE_DATABASE_PROTECTIONS_NOT_READY');
            const activeUri = inherited.MONGODB_URL || configured.MONGODB_URL;
            if (load('scripts/setupEmployeeHistoryRepairAudit.js').mongoTarget(activeUri).identity !==
                load('scripts/setupEmployeeHistoryRepairAudit.js').mongoTarget(env.MONGODB_URL).identity)
                throw new Error('ACTIVE_DATABASE_TARGET_MISMATCH');
        }
        if (fs.realpathSync('/proc/' + item.pid + '/exe') !== process.execPath)
            throw new Error('PM2_NODE24_RUNTIME_GUARD_FAILED');
    }
    const audit = await load('scripts/checkEmployeeHistoryRepairAudit.js').runCheck({ env, output: () => {} });
    const population = await load('scripts/checkEmployeeHistoryReadiness.js').runReadiness({
        env, argv: ['--expected-database=' + String(env.EMPLOYEE_HISTORY_EXPECTED_DATABASE || ''),
            '--acknowledge-production-read-only'], output: () => {}, humanOutput: () => {}
    });
    return { head: bundle.head, ready: true, audit, population,
        candidateModules: Object.keys(bundle.sources).length,
        databaseDriverVersion: require('mongoose/package.json').version };
}

function createRemoteProgram(bundle) {
    return '(' + remoteCandidateReadiness.toString() + ')(' + JSON.stringify(bundle) + ')' +
        '.then(result => console.log(JSON.stringify(result))).catch(error => {' +
        'console.log(JSON.stringify({ready:false,code:/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:"CANDIDATE_READINESS_FAILED",population:error.summary||null}));process.exitCode=1;});';
}

function writePrivateReport(filename, result, root) {
    const parent = fs.realpathSync(path.dirname(path.resolve(filename)));
    const repository = fs.realpathSync(root);
    if (parent === repository || parent.startsWith(repository + path.sep) ||
        (fs.statSync(parent).mode & 0o077) !== 0)
        throw new Error('READINESS_REPORT_REQUIRES_PRIVATE_DIRECTORY_OUTSIDE_GIT');
    fs.writeFileSync(path.join(parent, path.basename(filename)), JSON.stringify(result, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 });
}

function main(argv = process.argv.slice(2)) {
    const { values } = parseArgs({ args: argv, options: {
        'project-dir': { type: 'string', default: process.cwd() },
        'expected-head': { type: 'string' }, 'ssh-host': { type: 'string', default: 'ubuntu@18.199.180.229' },
        'ssh-key': { type: 'string', default: path.join(require('node:os').homedir(), '.ssh/Payroll_NodeJS_Server_Frankfurt.pem') }, report: { type: 'string' }
    } });
    const root = fs.realpathSync(values['project-dir']);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (!/^[a-f0-9]{40}$/.test(values['expected-head'] || '') || head !== values['expected-head'] ||
        execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim())
        throw new Error('CANDIDATE_GIT_STATE_CHANGED');
    if (!values['ssh-host'] || !values['ssh-key']) throw new Error('CANDIDATE_SSH_CONFIGURATION_REQUIRED');
    const bundle = collectCandidateModules(root, head);
    const remote = spawnSync('ssh', ['-i', values['ssh-key'], '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', values['ssh-host'],
        'cd /home/ubuntu/Payroll-NodeJs && timeout 300s /opt/node-v24.12.0/bin/node -'], {
        input: createRemoteProgram(bundle), encoding: 'utf8', timeout: 330000, maxBuffer: 16 * 1024 * 1024
    });
    let result;
    try { result = JSON.parse(remote.stdout); }
    catch { throw new Error('CANDIDATE_SSH_READINESS_FAILED'); }
    if (values.report) writePrivateReport(values.report, result, root);
    console.log(JSON.stringify({ head, ready: result.ready, code: result.code,
        totalEmployees: result.population?.totalEmployees,
        totalHistoryRows: result.population?.totalHistoryRows,
        deploymentBlockers: result.population?.DEPLOYMENT_BLOCKER_COUNT,
        pendingHistoryIssues: result.population?.LEGACY_HISTORY_PENDING_COUNT }));
    if (remote.status !== 0 || result.ready !== true) throw new Error(result.code || 'CANDIDATE_READINESS_FAILED');
    return result;
}
if (require.main === module) {
    try { main(); } catch (error) {
        console.error(/^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'CANDIDATE_READINESS_FAILED');
        process.exitCode = 1;
    }
}
module.exports = { collectCandidateModules, remoteCandidateReadiness, createRemoteProgram, writePrivateReport, main };
