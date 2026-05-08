const mongoose = require('mongoose');
const UsageLogModel = require('../models/usageLog');
const logger = require('./logger');

async function cleanupOrphanedSessions() {
    try {
        const now = new Date();

        const orphaned = await UsageLogModel.find({
            logoutAt: null,
            sessionExpires: mongoose.trusted({ $lt: now })
        });

        if (orphaned.length === 0) return;

        for (const log of orphaned) {
            const logoutAt = log.lastSeen || log.sessionExpires;
            const durationMs = logoutAt - log.loginAt;

            await UsageLogModel.findByIdAndUpdate(log._id, {
                logoutAt,
                durationMs: durationMs > 0 ? durationMs : 0,
                closedBy: 'session_expired'
            });
        }

        logger.info(`🧹 Cleanup: έκλεισαν ${orphaned.length} orphaned sessions`);
    } catch (error) {
        logger.error('❌ UsageCleanup error:', error);
    }
}

module.exports = { cleanupOrphanedSessions };
