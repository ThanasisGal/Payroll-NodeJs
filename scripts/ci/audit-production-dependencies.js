const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXCEPTIONS_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    '.github',
    'security',
    'npm-audit-exceptions.json'
);
const EXACT_ALLOWED_EXCEPTION = Object.freeze({
    package: 'brace-expansion',
    advisoryId: 'GHSA-mh99-v99m-4gvg',
    severity: 'high'
});
const SEVERITIES = new Set(['info', 'low', 'moderate', 'high', 'critical']);

function contractError(message) {
    return Object.assign(new Error(message), { code: 'AUDIT_GATE_CONTRACT_ERROR' });
}

function parseJson(text, label) {
    try {
        return JSON.parse(text);
    } catch {
        throw contractError(`${label} is not valid JSON`);
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateExceptionConfig(config, now = new Date()) {
    if (!isPlainObject(config) || Object.keys(config).some((key) => key !== 'exceptions')) {
        throw contractError('Exception file must contain only an exceptions array');
    }
    if (!Array.isArray(config.exceptions)) {
        throw contractError('Exception file is missing the exceptions array');
    }

    const seen = new Set();
    return config.exceptions.map((exception, index) => {
        if (!isPlainObject(exception)) throw contractError(`Exception ${index} must be an object`);
        const allowedKeys = [
            'package',
            'advisoryId',
            'severity',
            'reason',
            'trackingIssue',
            'expiresOn'
        ];
        if (Object.keys(exception).some((key) => !allowedKeys.includes(key))) {
            throw contractError(`Exception ${index} contains an unknown field`);
        }
        for (const key of allowedKeys) {
            if (typeof exception[key] !== 'string' || !exception[key].trim()) {
                throw contractError(`Exception ${index} has an invalid ${key}`);
            }
            if (exception[key].includes('*')) {
                throw contractError(`Exception ${index} contains a wildcard`);
            }
        }
        if (!/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(exception.advisoryId)) {
            throw contractError(`Exception ${index} has a malformed advisoryId`);
        }
        if (!SEVERITIES.has(exception.severity)) {
            throw contractError(`Exception ${index} has an invalid severity`);
        }
        if (
            exception.package !== EXACT_ALLOWED_EXCEPTION.package ||
            exception.advisoryId !== EXACT_ALLOWED_EXCEPTION.advisoryId ||
            exception.severity !== EXACT_ALLOWED_EXCEPTION.severity
        ) {
            throw contractError('Only the exact approved brace-expansion advisory may be excepted');
        }
        if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(exception.trackingIssue)) {
            throw contractError(`Exception ${index} is missing a valid tracking issue`);
        }
        if (!validateDateOnly(exception.expiresOn)) {
            throw contractError(`Exception ${index} has an invalid expiresOn date`);
        }
        const expiryEnd = new Date(`${exception.expiresOn}T23:59:59.999Z`);
        if (now.getTime() > expiryEnd.getTime()) {
            throw contractError(`Exception ${index} expired on ${exception.expiresOn}`);
        }
        const identity = `${exception.package}|${exception.advisoryId}|${exception.severity}`;
        if (seen.has(identity)) throw contractError(`Duplicate exception: ${identity}`);
        seen.add(identity);
        return { ...exception };
    });
}

function validateAuditSchema(audit) {
    if (!isPlainObject(audit) || !isPlainObject(audit.metadata)) {
        throw contractError('Audit output is missing metadata');
    }
    if (!isPlainObject(audit.metadata.vulnerabilities) || !isPlainObject(audit.vulnerabilities)) {
        throw contractError('Audit output does not match the npm audit schema');
    }
    for (const severity of SEVERITIES) {
        if (!Number.isInteger(audit.metadata.vulnerabilities[severity])) {
            throw contractError(`Audit metadata is missing the ${severity} count`);
        }
    }
}

function advisoryIdFromUrl(url) {
    if (typeof url !== 'string') return '';
    return url.match(/\/advisories\/(GHSA-[a-z0-9-]+)$/i)?.[1] || '';
}

function extractHighCriticalFindings(audit) {
    validateAuditSchema(audit);
    for (const [packageKey, vulnerability] of Object.entries(audit.vulnerabilities)) {
        if (!isPlainObject(vulnerability) || !Array.isArray(vulnerability.via)) {
            throw contractError(`Malformed vulnerability entry for ${packageKey}`);
        }
        if (typeof vulnerability.name !== 'string' || vulnerability.name !== packageKey) {
            throw contractError(`Vulnerability package mismatch for ${packageKey}`);
        }
        if (!SEVERITIES.has(vulnerability.severity)) {
            throw contractError(`Invalid vulnerability severity for ${packageKey}`);
        }
        if (!Array.isArray(vulnerability.nodes)) {
            throw contractError(`Vulnerability nodes are missing for ${packageKey}`);
        }
    }

    const resolveAdvisories = (packageKey, visiting = new Set()) => {
        if (visiting.has(packageKey)) {
            throw contractError(`Cyclic audit dependency reference at ${packageKey}`);
        }
        const vulnerability = audit.vulnerabilities[packageKey];
        if (!vulnerability) {
            throw contractError(`Audit dependency reference is missing: ${packageKey}`);
        }
        const nextVisiting = new Set(visiting);
        nextVisiting.add(packageKey);
        const direct = vulnerability.via.filter(
            (via) => isPlainObject(via) && ['high', 'critical'].includes(via.severity)
        );
        const referenced = vulnerability.via
            .filter((via) => typeof via === 'string')
            .flatMap((dependency) => resolveAdvisories(dependency, nextVisiting));
        const resolved = direct.map((via) => {
            const advisoryId = advisoryIdFromUrl(via.url);
            if (
                typeof via.name !== 'string' ||
                via.name !== packageKey ||
                !advisoryId ||
                !['high', 'critical'].includes(via.severity)
            ) {
                throw contractError(`Malformed high/critical advisory for ${packageKey}`);
            }
            return {
                package: packageKey,
                advisoryId,
                severity: via.severity,
                nodes: [...vulnerability.nodes]
            };
        }).concat(referenced);
        if (['high', 'critical'].includes(vulnerability.severity) && resolved.length === 0) {
            throw contractError(`High/critical vulnerability ${packageKey} has no resolvable advisory`);
        }
        return resolved;
    };

    const unique = new Map();
    for (const [packageKey, vulnerability] of Object.entries(audit.vulnerabilities)) {
        if (!['high', 'critical'].includes(vulnerability.severity)) continue;
        for (const finding of resolveAdvisories(packageKey)) {
            const identity = `${finding.package}|${finding.advisoryId}|${finding.severity}`;
            const existing = unique.get(identity);
            if (existing) {
                existing.nodes = [...new Set([...existing.nodes, ...finding.nodes])];
            } else {
                unique.set(identity, finding);
            }
        }
    }
    return [...unique.values()];
}

function evaluateAudit(audit, config, now = new Date()) {
    const exceptions = validateExceptionConfig(config, now);
    const findings = extractHighCriticalFindings(audit);
    const allowed = [];
    const blocked = [];
    const matchedExceptions = new Set();

    for (const finding of findings) {
        const matchIndex = exceptions.findIndex(
            (exception) =>
                exception.package === finding.package &&
                exception.advisoryId === finding.advisoryId &&
                exception.severity === finding.severity
        );
        if (matchIndex === -1) {
            blocked.push(finding);
        } else {
            allowed.push(finding);
            matchedExceptions.add(matchIndex);
        }
    }
    exceptions.forEach((exception, index) => {
        if (!matchedExceptions.has(index)) {
            throw contractError(`Stale exception: ${exception.package} ${exception.advisoryId}`);
        }
    });
    return { findings, exceptions, allowed, blocked, passed: blocked.length === 0 };
}

function printSummary(result) {
    console.log(`Production audit gate: ${result.passed ? 'PASS' : 'FAIL'}`);
    console.log(`High/critical advisories: ${result.findings.length}`);
    console.log(`Allowed advisories: ${result.allowed.length}`);
    console.log(`Blocked advisories: ${result.blocked.length}`);
    result.allowed.forEach((finding) => {
        const exception = result.exceptions.find(
            (candidate) =>
                candidate.package === finding.package &&
                candidate.advisoryId === finding.advisoryId &&
                candidate.severity === finding.severity
        );
        console.log(
            `ALLOWED ${finding.package} ${finding.advisoryId} ${finding.severity} ` +
            `expires=${exception.expiresOn} tracking=${exception.trackingIssue}`
        );
    });
    result.blocked.forEach((finding) => {
        console.error(`BLOCKED ${finding.package} ${finding.advisoryId} ${finding.severity}`);
    });
}

function runAuditCommand() {
    const command = spawnSync(
        'npm',
        ['audit', '--omit=dev', '--audit-level=high', '--json'],
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    if (command.error || command.signal || ![0, 1].includes(command.status)) {
        throw contractError(
            `npm audit failed operationally (status=${command.status}, signal=${command.signal || 'none'})`
        );
    }
    return parseJson(command.stdout, 'npm audit output');
}

function acquireAuditReport(runAttempt = runAuditCommand) {
    let firstFailure;
    try {
        const audit = runAttempt();
        validateAuditSchema(audit);
        return audit;
    } catch (error) {
        firstFailure = error;
    }

    try {
        const audit = runAttempt();
        validateAuditSchema(audit);
        return audit;
    } catch (error) {
        const reason = String(error?.message || firstFailure?.message || 'unknown error')
            .replace(/\s+/g, ' ')
            .slice(0, 200);
        throw contractError(
            `Production dependency audit unavailable after 2 attempts: ${reason}`
        );
    }
}

function main() {
    try {
        const config = parseJson(fs.readFileSync(EXCEPTIONS_PATH, 'utf8'), 'Exception file');
        const result = evaluateAudit(acquireAuditReport(), config, new Date());
        printSummary(result);
        if (!result.passed) process.exitCode = 1;
    } catch (error) {
        console.error(`Production audit gate: FAIL\n${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = {
    EXACT_ALLOWED_EXCEPTION,
    parseJson,
    validateExceptionConfig,
    validateAuditSchema,
    extractHighCriticalFindings,
    evaluateAudit,
    runAuditCommand,
    acquireAuditReport
};
