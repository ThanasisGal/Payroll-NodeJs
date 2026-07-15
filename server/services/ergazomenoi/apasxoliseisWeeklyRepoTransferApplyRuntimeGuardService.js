function getWeeklyRepoTransferApplyRuntimeState(env = process.env) {
    const generallyEnabled = env.ALLOW_REPO_TRANSFER_APPLY === 'true';
    const production = env.NODE_ENV === 'production';
    const productionEnabled = env.ALLOW_PRODUCTION_REPO_TRANSFER_APPLY === 'true';
    const enabled = generallyEnabled && (!production || productionEnabled);
    return Object.freeze({ enabled, code: enabled ? null : 'APPLY_RUNTIME_DISABLED' });
}

module.exports = { getWeeklyRepoTransferApplyRuntimeState };
