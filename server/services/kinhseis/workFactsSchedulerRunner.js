const {
    runDuePayrollPrecalcJobs
} = require('./workFactsSchedulerService');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_INITIAL_DELAY_MS = 60 * 1000;
const DEFAULT_LIMIT = 5;
const MIN_INTERVAL_MS = 60 * 1000;
const REQUESTED_BY = 'payroll-precalc-scheduler';

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
}

function normalizeIntervalMs(value) {
    return Math.max(Math.trunc(normalizeNumber(value, DEFAULT_INTERVAL_MS)), MIN_INTERVAL_MS);
}

function normalizeInitialDelayMs(value) {
    return Math.max(Math.trunc(normalizeNumber(value, DEFAULT_INITIAL_DELAY_MS)), 0);
}

function normalizeLimit(value) {
    const limit = Math.trunc(normalizeNumber(value, DEFAULT_LIMIT));

    if (limit < 1) return 1;
    if (limit > 50) return 50;

    return limit;
}

function parsePayrollPrecalcSchedulerTargets(value) {
    const rawValue = String(value ?? '').trim();

    if (!rawValue) return [];

    return rawValue
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((targets, entry) => {
            const parts = entry.split(':').map((part) => part.trim());

            if (parts.length !== 3) {
                console.warn(`Skipping invalid PAYROLL_PRECALC_SCHEDULER_TARGETS entry: ${entry}`);
                return targets;
            }

            const [team, company_kod, ypokatasthma] = parts;

            if (!team || !company_kod || !ypokatasthma) {
                console.warn(`Skipping invalid PAYROLL_PRECALC_SCHEDULER_TARGETS entry: ${entry}`);
                return targets;
            }

            targets.push({
                team,
                company_kod,
                ypokatasthma
            });

            return targets;
        }, []);
}

function resolveEnabled(options) {
    if (hasOwn(options, 'enabled')) {
        return options.enabled === true;
    }

    return process.env.PAYROLL_PRECALC_SCHEDULER_ENABLED === 'true';
}

function resolveNumberOption(options, key, envKey, fallback) {
    if (hasOwn(options, key)) {
        return options[key];
    }

    if (process.env[envKey] !== undefined) {
        return process.env[envKey];
    }

    return fallback;
}

function startPayrollPrecalcScheduler(options = {}) {
    const enabled = resolveEnabled(options);

    if (enabled !== true) {
        console.log('Payroll precalc scheduler disabled.');
        return {
            enabled: false,
            started: false,
            reason: 'disabled'
        };
    }

    const targets = parsePayrollPrecalcSchedulerTargets(process.env.PAYROLL_PRECALC_SCHEDULER_TARGETS);

    if (targets.length < 1) {
        console.log('Payroll precalc scheduler disabled: missing valid PAYROLL_PRECALC_SCHEDULER_TARGETS.');
        return {
            enabled: true,
            started: false,
            reason: 'missing-valid-targets'
        };
    }

    const intervalMs = normalizeIntervalMs(resolveNumberOption(
        options,
        'intervalMs',
        'PAYROLL_PRECALC_SCHEDULER_INTERVAL_MS',
        DEFAULT_INTERVAL_MS
    ));
    const initialDelayMs = normalizeInitialDelayMs(resolveNumberOption(
        options,
        'initialDelayMs',
        'PAYROLL_PRECALC_SCHEDULER_INITIAL_DELAY_MS',
        DEFAULT_INITIAL_DELAY_MS
    ));
    const limit = normalizeLimit(resolveNumberOption(
        options,
        'limit',
        'PAYROLL_PRECALC_SCHEDULER_LIMIT',
        DEFAULT_LIMIT
    ));
    let isRunning = false;
    let stopped = false;
    let initialTimer = null;
    let intervalTimer = null;

    async function runOnce() {
        if (stopped) {
            return { skipped: true, reason: 'stopped' };
        }

        if (isRunning) {
            return { skipped: true, reason: 'already-running' };
        }

        isRunning = true;
        try {
            return await runDuePayrollPrecalcJobs({
                limit,
                requestedBy: REQUESTED_BY,
                allowedTargets: targets
            });
        } catch (error) {
            console.error('Payroll precalc scheduler run failed:', error);
            return {
                failed: true,
                errorMessage: error.message || 'Payroll precalc scheduler run failed.'
            };
        } finally {
            isRunning = false;
        }
    }

    function stop() {
        stopped = true;

        if (initialTimer) {
            clearTimeout(initialTimer);
            initialTimer = null;
        }

        if (intervalTimer) {
            clearInterval(intervalTimer);
            intervalTimer = null;
        }
    }

    initialTimer = setTimeout(() => {
        runOnce();
    }, initialDelayMs);
    intervalTimer = setInterval(() => {
        runOnce();
    }, intervalMs);

    console.log(`Payroll precalc scheduler enabled with ${targets.length} allowed target(s).`);

    return {
        enabled: true,
        started: true,
        intervalMs,
        initialDelayMs,
        limit,
        allowedTargets: targets,
        stop,
        runOnce
    };
}

module.exports = {
    parsePayrollPrecalcSchedulerTargets,
    startPayrollPrecalcScheduler
};
