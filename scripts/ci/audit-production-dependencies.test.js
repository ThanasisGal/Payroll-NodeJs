const assert = require('assert');
const {
    parseJson,
    validateExceptionConfig,
    evaluateAudit
} = require('./audit-production-dependencies');

const NOW = new Date('2026-07-25T12:00:00.000Z');
const ISSUE = 'https://github.com/ThanasisGal/Payroll-NodeJs/issues/34';

function exception(overrides = {}) {
    return {
        package: 'brace-expansion',
        advisoryId: 'GHSA-mh99-v99m-4gvg',
        severity: 'high',
        reason: 'No patched compatible release exists.',
        trackingIssue: ISSUE,
        expiresOn: '2026-10-23',
        ...overrides
    };
}

function config(exceptions = [exception()]) {
    return { exceptions };
}

function audit(findings = []) {
    const vulnerabilities = {};
    for (const finding of findings) {
        const current = vulnerabilities[finding.package] || {
            name: finding.package,
            severity: finding.severity,
            isDirect: false,
            via: [],
            effects: [],
            range: '<fixture>',
            nodes: []
        };
        current.severity = finding.severity === 'critical' ? 'critical' : current.severity;
        current.via.push({
            source: finding.source || 1,
            name: finding.package,
            dependency: finding.package,
            title: 'Fixture advisory',
            url: `https://github.com/advisories/${finding.advisoryId}`,
            severity: finding.severity,
            range: '<fixture>'
        });
        current.nodes.push(...(finding.nodes || [`node_modules/${finding.package}`]));
        vulnerabilities[finding.package] = current;
    }
    const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
    for (const finding of findings) counts[finding.severity] += 1;
    counts.total = findings.length;
    return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}

const exact = {
    package: 'brace-expansion',
    advisoryId: 'GHSA-mh99-v99m-4gvg',
    severity: 'high'
};

function mustFail(name, fn, pattern) {
    assert.throws(fn, pattern, name);
}

assert.strictEqual(evaluateAudit(audit([]), config([]), NOW).passed, true);
mustFail('stale production exception', () => evaluateAudit(audit([]), config(), NOW), /Stale exception/);

const exactResult = evaluateAudit(audit([exact]), config(), NOW);
assert.strictEqual(exactResult.passed, true);
assert.strictEqual(exactResult.allowed.length, 1);

mustFail(
    'different advisory for same package',
    () => evaluateAudit(audit([{ ...exact, advisoryId: 'GHSA-aaaa-bbbb-cccc' }]), config(), NOW),
    /Stale exception/
);
mustFail(
    'same advisory for different package',
    () => evaluateAudit(audit([{ ...exact, package: 'other-package' }]), config(), NOW),
    /Stale exception/
);
mustFail(
    'critical severity is never excepted',
    () => evaluateAudit(audit([{ ...exact, severity: 'critical' }]), config(), NOW),
    /Stale exception/
);
mustFail(
    'new high advisory',
    () => evaluateAudit(audit([{ package: 'new-package', advisoryId: 'GHSA-1111-2222-3333', severity: 'high' }]), config(), NOW),
    /Stale exception/
);
mustFail(
    'new critical advisory',
    () => evaluateAudit(audit([{ package: 'critical-package', advisoryId: 'GHSA-4444-5555-6666', severity: 'critical' }]), config(), NOW),
    /Stale exception/
);

mustFail(
    'expired exception',
    () => evaluateAudit(audit([exact]), config([exception({ expiresOn: '2026-07-24' })]), NOW),
    /expired/
);
mustFail(
    'missing tracking issue',
    () => validateExceptionConfig(config([exception({ trackingIssue: '' })]), NOW),
    /trackingIssue/
);
mustFail('malformed audit JSON', () => parseJson('{', 'Audit fixture'), /not valid JSON/);
mustFail('malformed exception JSON', () => parseJson('{', 'Exception fixture'), /not valid JSON/);
mustFail(
    'duplicate exception',
    () => validateExceptionConfig(config([exception(), exception()]), NOW),
    /Duplicate exception/
);

const multiPathResult = evaluateAudit(
    audit([{
        ...exact,
        nodes: [
            'node_modules/brace-expansion',
            'node_modules/filelist/node_modules/brace-expansion',
            'node_modules/readdir-glob/node_modules/brace-expansion'
        ]
    }]),
    config(),
    NOW
);
assert.strictEqual(multiPathResult.allowed.length, 1);
assert.strictEqual(multiPathResult.allowed[0].nodes.length, 3);

mustFail(
    'wildcard exception',
    () => validateExceptionConfig(config([exception({ package: '*' })]), NOW),
    /wildcard/
);
mustFail(
    'unapproved exception tuple',
    () => validateExceptionConfig(config([exception({ advisoryId: 'GHSA-aaaa-bbbb-cccc' })]), NOW),
    /exact approved/
);
mustFail(
    'high aggregate without direct advisory',
    () => evaluateAudit({
        auditReportVersion: 2,
        vulnerabilities: {
            parent: {
                name: 'parent',
                severity: 'high',
                via: ['child'],
                nodes: ['node_modules/parent']
            }
        },
        metadata: {
            vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 }
        }
    }, config([]), NOW),
    /missing: child/
);

console.log('PASS strict production dependency audit gate (exact, expiring, fail-closed exception)');
