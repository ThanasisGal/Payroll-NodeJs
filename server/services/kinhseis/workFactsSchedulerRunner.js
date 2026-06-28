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
        return {
            enabled: false,
            started: false,
            reason: 'disabled'
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
                requestedBy: REQUESTED_BY
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

    console.log(
        `Payroll precalc scheduler enabled: intervalMs=${intervalMs}, ` +
        `initialDelayMs=${initialDelayMs}, limit=${limit}`
    );

    return {
        enabled: true,
        started: true,
        intervalMs,
        initialDelayMs,
        limit,
        stop,
        runOnce
    };
}

module.exports = {
    startPayrollPrecalcScheduler
};
