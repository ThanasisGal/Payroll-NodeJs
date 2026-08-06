const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function startUsageCleanupGuarded({
    enabledValue = process.env.PAYROLL_USAGE_CLEANUP_ENABLED,
    cleanup,
    setIntervalFn = setInterval,
    intervalMs = DEFAULT_INTERVAL_MS
} = {}) {
    if (enabledValue === 'false') {
        return { enabled: false, interval: null };
    }
    if (typeof cleanup !== 'function') {
        throw new TypeError('usage cleanup function is required');
    }

    cleanup();
    return {
        enabled: true,
        interval: setIntervalFn(cleanup, intervalMs)
    };
}

module.exports = {
    DEFAULT_INTERVAL_MS,
    startUsageCleanupGuarded
};
