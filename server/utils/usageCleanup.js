const UsageLogModel = require('../models/usageLog');
const logger = require('./logger');

async function cleanupOrphanedSessions() {
    try {
        const now = new Date();

        // ✅ Βρες logs που:
        // 1. Δεν έχουν κλείσει (logoutAt: null)
        // 2. Το session τους έχει ήδη λήξει (sessionExpires < now)
        const orphaned = await UsageLogModel.find({
            logoutAt: null,
            sessionExpires: { $lt: now }
        });

        if (orphaned.length === 0) return;

        for (const log of orphaned) {
            // ✅ Χρησιμοποίησε lastSeen αν υπάρχει (πιο ακριβές)
            // αλλιώς χρησιμοποίησε sessionExpires
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
