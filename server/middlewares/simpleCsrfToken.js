'use strict';
const { randomBytes } = require('node:crypto');
const COOKIE = 'psifl.x-csrf-token';
const isCsrfError = error => Boolean(error && (error.code === 'EBADCSRFTOKEN' || /\bcsrf\b/i.test(error.message || '')));
// Shared by the application and isolated HTTP acceptance tests. Reading a token
// never rotates a valid cookie held by other tabs.
function createSimpleCsrfToken({ secure = false, domain, logger = { error() {} } } = {}) {
    function exposeToken(req, res, next) {
        try {
            const existing = req.cookies?.[COOKIE];
            if (typeof existing === 'string' && existing) res.locals.csrfToken = existing;
            else {
                res.locals.csrfToken = randomBytes(32).toString('hex');
                res.cookie(COOKIE, res.locals.csrfToken, { httpOnly: true, sameSite: 'lax', path: '/',
                    secure, maxAge: 12 * 60 * 60 * 1000, ...(domain ? { domain } : {}) });
            }
        } catch (error) { logger.error('Error generating CSRF token for views:', error); res.locals.csrfToken = ''; }
        next();
    }
    function validateToken(req) {
        const cookie = req.cookies?.[COOKIE];
        const submitted = req.body?._csrf || req.headers['csrf-token'] || req.headers['x-csrf-token'] || req.query?._csrf;
        return typeof cookie === 'string' && Boolean(cookie) && typeof submitted === 'string' && cookie === submitted;
    }
    function tokenEndpoint(req, res) {
        res.set('Cache-Control', 'no-store');
        return res.json({ csrfToken: res.locals.csrfToken || '' });
    }
    return { exposeToken, validateToken, tokenEndpoint, isCsrfError };
}
module.exports = { COOKIE, createSimpleCsrfToken, isCsrfError };
