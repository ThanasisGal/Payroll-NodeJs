// server/utils/erganh/sessionManager.js
'use strict';

const { chromium } = require('playwright');

const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'true';
const HEADLESS = !DEBUG;

const TIMEOUTS = {
    short: 5000,
    medium: 12000,
    long: 20000,
    nav: 25000
};

class ErganSessionManager {
    constructor() {
        this.activeSessions = new Map(); // companyId → { browser, context, page, createdAt }
        console.log('[SESSION-MGR] Initialized');
    }

    /**
     * ✅ Get existing session OR create new one
     * @param {String} companyId
     * @param {Object} creds - { username, password }
     * @returns {Promise<Object>} { browser, context, page }
     */
    async getOrCreateSession(companyId, creds) {
        const key = String(companyId);

        // ✅ Check if existing session is still alive
        if (this.activeSessions.has(key)) {
            const session = this.activeSessions.get(key);

            try {
                // Test if page is still usable
                if (session.page && !session.page.isClosed()) {
                    await session.page
                        .evaluate(() => true)
                        .catch(() => {
                            throw new Error('Page context lost');
                        });

                    console.log('[SESSION-MGR] ✅ Reusing existing session for company:', key);
                    return session;
                }
            } catch (e) {
                console.warn(
                    '[SESSION-MGR] ⚠️ Existing session invalid, creating new one:',
                    e.message
                );
                await this.closeSession(key).catch(() => {});
            }
        }

        // ✅ Create new session
        console.log('[SESSION-MGR] 🆕 Creating new session for company:', key);

        const browser = await chromium.launch({
            headless: HEADLESS,
            slowMo: DEBUG ? 120 : 0,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });

        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUTS.long);
        page.setDefaultNavigationTimeout(TIMEOUTS.nav);

        const session = {
            browser,
            context,
            page,
            createdAt: Date.now(),
            companyId: key
        };

        this.activeSessions.set(key, session);

        console.log('[SESSION-MGR] ✅ Session created for company:', key);
        return session;
    }

    /**
     * ✅ Close session for specific company
     * @param {String} companyId
     */
    async closeSession(companyId) {
        const key = String(companyId);

        if (!this.activeSessions.has(key)) {
            console.log('[SESSION-MGR] No session to close for company:', key);
            return;
        }

        console.log('[SESSION-MGR] 🔒 Closing session for company:', key);

        const session = this.activeSessions.get(key);

        try {
            if (session.page && !session.page.isClosed()) {
                await session.page.close();
            }
        } catch (e) {
            console.warn('[SESSION-MGR] Page close error:', e.message);
        }

        try {
            if (session.context) {
                await session.context.close();
            }
        } catch (e) {
            console.warn('[SESSION-MGR] Context close error:', e.message);
        }

        try {
            if (session.browser) {
                await session.browser.close();
            }
        } catch (e) {
            console.warn('[SESSION-MGR] Browser close error:', e.message);
        }

        this.activeSessions.delete(key);
        console.log('[SESSION-MGR] ✅ Session closed for company:', key);
    }

    /**
     * ✅ Close all active sessions (cleanup)
     */
    async closeAllSessions() {
        console.log('[SESSION-MGR] 🔒 Closing all sessions...');

        const keys = Array.from(this.activeSessions.keys());

        for (const key of keys) {
            await this.closeSession(key).catch((e) => {
                console.error('[SESSION-MGR] Error closing session:', key, e.message);
            });
        }

        console.log('[SESSION-MGR] ✅ All sessions closed');
    }

    /**
     * ✅ Get session count (for debugging)
     */
    getActiveSessionCount() {
        return this.activeSessions.size;
    }

    /**
     * ✅ Auto-cleanup old sessions (> 5 minutes idle)
     */
    async cleanupIdleSessions(maxIdleMs = 5 * 60 * 1000) {
        const now = Date.now();
        const keys = Array.from(this.activeSessions.keys());

        for (const key of keys) {
            const session = this.activeSessions.get(key);
            const idleTime = now - session.createdAt;

            if (idleTime > maxIdleMs) {
                console.log(
                    '[SESSION-MGR] ⏰ Auto-closing idle session:',
                    key,
                    `(${Math.round(idleTime / 1000)}s old)`
                );
                await this.closeSession(key).catch(() => {});
            }
        }
    }
}

// ✅ Singleton instance
const sessionManager = new ErganSessionManager();

// ✅ Auto-cleanup every 2 minutes
setInterval(
    () => {
        sessionManager.cleanupIdleSessions().catch((e) => {
            console.error('[SESSION-MGR] Auto-cleanup error:', e.message);
        });
    },
    2 * 60 * 1000
);

// ✅ Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('[SESSION-MGR] 🛑 SIGINT received, closing all sessions...');
    await sessionManager.closeAllSessions();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[SESSION-MGR] 🛑 SIGTERM received, closing all sessions...');
    await sessionManager.closeAllSessions();
    process.exit(0);
});

module.exports = sessionManager;
