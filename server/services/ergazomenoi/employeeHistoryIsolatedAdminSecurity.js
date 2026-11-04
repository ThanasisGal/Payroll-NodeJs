'use strict';
const crypto = require('node:crypto');
const cookie = require('cookie');
const signature = require('cookie-signature');
function deny(reason) { throw Object.assign(Error(reason), { reason, statusCode: 403 }); }
function constantEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function validateAddress(origin) {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
        !parsed.port || [5000, 5025].includes(Number(parsed.port)) || parsed.origin !== origin ||
        parsed.username || parsed.password) deny('ISOLATED_LOOPBACK_ORIGIN_REQUIRED');
    return parsed;
}
function validateRequestBoundary(req, origin) {
    const expected = validateAddress(origin);
    if (req.headers.host !== expected.host || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
        deny('HOST_REJECTED');
    if (req.headers.origin !== undefined && req.headers.origin !== origin) deny('ORIGIN_REJECTED');
    if (req.method === 'POST') {
        if (req.headers.origin !== origin) deny('ORIGIN_REQUIRED');
        const cookies = cookie.parse(req.headers.cookie || '');
        const token = cookies['psifl.x-csrf-token'];
        if (!/^[a-f0-9]{64}$/.test(token || '') || !constantEqual(token, req.headers['x-csrf-token']))
            deny('CSRF_REJECTED');
    }
}
async function authenticateExistingSession({ req, db, secret, caseBinding, timeoutMinutes = 60 }) {
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) deny('SESSION_TIMEOUT_INVALID');
    const cookies = cookie.parse(req.headers.cookie || ''), signed = cookies['connect.sid'];
    if (!signed?.startsWith('s:')) deny('SIGNED_SESSION_REQUIRED');
    const sid = signature.unsign(signed.slice(2), secret);
    if (!sid) deny('SESSION_SIGNATURE_REJECTED');
    const now = new Date();
    const row = await db.collection('sessions').findOne({ _id: sid, expires: { $gt: now } },
        { projection: { session: 1, expires: 1 }, readConcern: { level: 'majority' }, maxTimeMS: 5000 });
    let session;
    try { session = JSON.parse(row?.session); } catch { deny('SESSION_NOT_AVAILABLE'); }
    const activity = Number(session.lastActivity), cookieExpiry = new Date(session.cookie?.expires);
    if (!row || !Number.isFinite(activity) || activity > Date.now() + 10000 ||
        Date.now() - activity >= timeoutMinutes * 60000 || !Number.isFinite(cookieExpiry.getTime()) || cookieExpiry <= now)
        deny('SESSION_EXPIRED');
    if (session.userId !== caseBinding.actorUserId || session.userTeam !== caseBinding.scope.team ||
        session.companyInUse !== caseBinding.scope.company_kod || session.userRole !== 'A' || session.userStatus !== 'A')
        deny('SESSION_CASE_MISMATCH');
    return { sid, session, expiresAt: new Date(Math.min(new Date(row.expires), cookieExpiry)) };
}
module.exports = { deny, constantEqual, validateAddress, validateRequestBoundary, authenticateExistingSession };
