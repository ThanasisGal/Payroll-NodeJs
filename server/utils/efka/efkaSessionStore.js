// ./server/utils/efka/efkaSessionStore.js
const crypto = require('crypto');

const sessions = new Map(); // sessionId -> { browser, context, page, apdPage, expiresAt, timer }

function newId() {
  return crypto.randomBytes(16).toString('hex');
}

function createSession({ browser, context, page, apdPage }, { ttlMs = 10 * 60 * 1000 } = {}) {
  const sessionId = newId();
  const expiresAt = Date.now() + ttlMs;

  const timer = setTimeout(() => {
    closeSession(sessionId).catch(() => {});
  }, ttlMs);

  sessions.set(sessionId, { browser, context, page, apdPage, expiresAt, timer });
  return sessionId;
}

function getSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;

  // expired
  if (Date.now() > s.expiresAt) {
    closeSession(sessionId).catch(() => {});
    return null;
  }

  return s;
}

async function closeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return false;

  clearTimeout(s.timer);
  sessions.delete(sessionId);

  // κλείσιμο με σωστή σειρά
  try { if (s.apdPage && !s.apdPage.isClosed()) await s.apdPage.close(); } catch {}
  try { if (s.page && !s.page.isClosed()) await s.page.close(); } catch {}
  try { if (s.context) await s.context.close(); } catch {}
  try { if (s.browser) await s.browser.close(); } catch {}

  return true;
}

module.exports = { createSession, getSession, closeSession };