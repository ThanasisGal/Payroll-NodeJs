const fs = require('fs-extra');
const path = require('path');
const { chromium } = require('playwright');

const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'false';

function log(...a)  { console.log('[ERGANH]', ...a); }
function warn(...a) { console.warn('[ERGANH][WARN]', ...a); }
function err(...a)  { console.error('[ERGANH][ERROR]', ...a); }
function dbg(...a)  { if (DEBUG) console.log('[ERGANH][DEBUG]', ...a); }

const LOGIN_URL = 'https://eservices.yeka.gr/login.aspx';

const SEL_LOGIN_USERNAME   = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName';
const SEL_LOGIN_PASSWORD   = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password';
const SEL_LOGIN_SUBMIT     = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Login';
const SEL_LOGIN_USE_ERGANI = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UsePararthmaBox';
const SEL_AFTER_LOGIN_ANCHOR = 'a.menu-dropdown:has-text("ΒΟΗΘΗΤΙΚΑ")';

const SEL_COOKIE_CLOSE = 'button:has-text("Κλείσιμο"), a:has-text("Κλείσιμο")';

const SEL_UPLOAD_PROCESS_SELECT = '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_SKYpobolesList';
const SEL_UPLOAD_FILE_INPUT     = '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_XMLFileUploader';
const SEL_UPLOAD_SUBMIT_BTN     = '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_UploadFileButton';

// ---------------------------------------------------------------------
// Adaptive timeout manager (starts moderate, grows if the site is slow)
// ---------------------------------------------------------------------
class AdaptiveTimeouts {
  constructor() {
    this.base = {
      short: 15000,
      medium: 30000,
      long: 60000
    };
    this.mult = 1.0; // grows when we detect slowness
  }
  short()  { return Math.round(this.base.short  * this.mult); }
  medium() { return Math.round(this.base.medium * this.mult); }
  long()   { return Math.round(this.base.long   * this.mult); }

  // If we hit timeout or detect slowness, increase multiplier slightly
  bump(reason = 'slow') {
    const before = this.mult;
    this.mult = Math.min(2.5, this.mult + 0.25);
    warn(`[TIMEOUTS] bump (${reason}) ${before} -> ${this.mult}`);
  }
}

// ---------------------------------------------------------------------
async function safeScreenshot(page, name) {
  try {
    const dir = path.join(process.cwd(), 'screenshots', 'erganh');
    await fs.ensureDir(dir);
    const file = path.join(dir, `${Date.now()}_${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
    return null;
  }
}

function isClosedTargetError(e) {
  const m = String(e?.message || '');
  return m.includes('Target page, context or browser has been closed') ||
         m.includes('browser has been closed') ||
         m.includes('has been closed');
}

async function closeCookieBannerIfAny(page) {
  try {
    const btn = page.locator(SEL_COOKIE_CLOSE).first();
    if (await btn.count()) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
      }
    }
  } catch {}
}

async function isLoginPage(page) {
  try {
    const hasUser = await page.locator(SEL_LOGIN_USERNAME).count();
    const hasPass = await page.locator(SEL_LOGIN_PASSWORD).count();
    const hasBtn  = await page.locator(SEL_LOGIN_SUBMIT).count();
    return !!(hasUser && hasPass && hasBtn);
  } catch { return false; }
}

// Wait until either selector A or selector B appears (or timeout)
async function waitForEither(page, selectorA, selectorB, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      if (await page.locator(selectorA).count()) return 'A';
      if (await page.locator(selectorB).count()) return 'B';
    } catch {}
    await page.waitForTimeout(250);
  }
  throw new Error(`waitForEither timeout: ${selectorA} OR ${selectorB}`);
}

// Detect “stuck” states (blank page or spinner too long)
async function autoRecoverIfStuck(page, timeouts) {
  try {
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const looksBlank = !bodyText || bodyText.trim().length < 5;

    if (looksBlank) {
      warn('[RECOVER] Page looks blank -> reload');
      timeouts.bump('blank');
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // if url is weird or about:blank
    if (!url || url === 'about:blank') {
      warn('[RECOVER] URL is about:blank -> goto login');
      timeouts.bump('about:blank');
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}
}

// ---------------------------------------------------------------------
// Login that retries only if truly not logged in
// ---------------------------------------------------------------------
async function loginToErganh(page, creds, timeouts) {
  const username = creds?.username;
  const password = creds?.password;
  if (!username || !password) throw new Error('Missing ERGANH credentials');

  log('Opening login page...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  await closeCookieBannerIfAny(page);

  // Wait for either: login form OR already logged in anchor (if session reused)
  const state = await waitForEither(page, SEL_LOGIN_USERNAME, SEL_AFTER_LOGIN_ANCHOR, timeouts.long())
    .catch(e => { timeouts.bump('login-wait'); throw e; });

  if (state === 'A') {
    // We are on login form
    await page.waitForSelector(SEL_LOGIN_USERNAME, { timeout: timeouts.medium() })
      .catch(e => { timeouts.bump('username'); throw e; });

    try {
      const cb = page.locator(SEL_LOGIN_USE_ERGANI);
      if (await cb.count()) {
        if (!(await cb.isChecked())) await cb.check();
      }
    } catch {}

    await page.fill(SEL_LOGIN_USERNAME, username);
    await page.fill(SEL_LOGIN_PASSWORD, password);

    log('Submitting login...');
    await page.click(SEL_LOGIN_SUBMIT);

    // After submit: wait for either success anchor OR still login form (failure)
    const after = await waitForEither(page, SEL_AFTER_LOGIN_ANCHOR, SEL_LOGIN_USERNAME, timeouts.long())
      .catch(e => { timeouts.bump('post-login'); throw e; });

    if (after === 'B') {
      // Still on login form -> credentials wrong or session rejected
      await safeScreenshot(page, 'login_failed');
      throw new Error('Login failed (still on login form after submit)');
    }
  }

  // We have anchor now
  await closeCookieBannerIfAny(page);
  await safeScreenshot(page, 'after_login');
  log('Login completed (anchor found).');
}

async function ensureLoggedIn(page, creds, timeouts) {
  if (await isLoginPage(page)) {
    warn('Detected login page -> re-login...');
    await loginToErganh(page, creds, timeouts);
  }
}

// ---------------------------------------------------------------------
// Navigation (no repeated ensure between clicks to avoid flicker loops)
// ---------------------------------------------------------------------
async function navigateToUploadPage(page, creds, timeouts) {
  await ensureLoggedIn(page, creds, timeouts);

  log('Navigating: ΒΟΗΘΗΤΙΚΑ → Ομαδικές Υποβολές → Εισαγωγή Από Αρχείο');

  const voithitika = page.locator('a.menu-dropdown:has-text("ΒΟΗΘΗΤΙΚΑ")').first();
  await voithitika.waitFor({ timeout: timeouts.medium() })
    .catch(e => { timeouts.bump('voithitika'); throw e; });
  await voithitika.click();

  await page.waitForTimeout(200);
  await autoRecoverIfStuck(page, timeouts);

  const omadikes = page.locator('a.menu-dropdown:has-text("Ομαδικές Υποβολές")').first();
  await omadikes.waitFor({ timeout: timeouts.medium() })
    .catch(e => { timeouts.bump('omadikes'); throw e; });
  await omadikes.click();

  await page.waitForTimeout(200);
  await autoRecoverIfStuck(page, timeouts);

  const eisagogi = page.locator('a[href*="AnaggeliesXML.aspx"]:has-text("Εισαγωγή Από Αρχείο")').first();
  await eisagogi.waitFor({ timeout: timeouts.medium() })
    .catch(e => { timeouts.bump('eisagogi'); throw e; });
  await eisagogi.click();

  await page.waitForLoadState('domcontentloaded', { timeout: timeouts.long() }).catch(() => {});
  await page.waitForSelector(SEL_UPLOAD_PROCESS_SELECT, { timeout: timeouts.long() })
    .catch(e => { timeouts.bump('upload-page'); throw e; });

  await safeScreenshot(page, 'after_navigation');
}

// ---------------------------------------------------------------------
// Modal "Ειδοποίηση" capture (bulletproof: title ancestor containing OK)
// ---------------------------------------------------------------------
async function captureEidopoiisiModal(page, timeouts) {
  try {
    const titleLoc = page.locator('text=Ειδοποίηση').first();
    await titleLoc.waitFor({ timeout: timeouts.long() }).catch(() => null);
    if (!(await titleLoc.count())) return null;

    const box = titleLoc.locator(
      'xpath=ancestor::div[.//button[contains(normalize-space(.),"OK")]]'
    ).first();

    let text = '';
    if (await box.count()) {
      text = (await box.innerText().catch(() => '')).trim();
    } else {
      text = (await page.locator('body').innerText().catch(() => '')).trim();
    }

    const okBtn = (await box.count())
      ? box.locator('button:has-text("OK")').first()
      : page.locator('button:has-text("OK")').first();

    if (await okBtn.count()) await okBtn.click().catch(() => {});
    else await page.keyboard.press('Enter').catch(() => {});

    text = text.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
    text = text.replace(/\n?OK\s*$/i, '').trim();

    return text || null;
  } catch {
    return null;
  }
}

function extractProtocolFromText(text) {
  if (!text) return null;
  const patterns = [
    /Αρ(?:ιθ)?\.?\s*Πρωτ(?:οκ)?[όο]λλ[οό]?\s*[:\-]?\s*([0-9A-Za-z\/\-\._]+)/i,
    /Πρωτόκολλ[οό]\s*[:\-]?\s*([0-9A-Za-z\/\-\._]+)/i,
    /Protocol\s*[:\-]?\s*([0-9A-Za-z\/\-\._]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function looksLikeErrorText(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes('σφάλμα') || t.includes('λάθος') || t.includes('αποτυχ') ||
         t.includes('μη έγκυρ') || t.includes('δεν επιτρέπ') || t.includes('δεν βρέθηκε') ||
         t.includes('error') || t.includes('invalid');
}

async function collectResultInfo(page, timeouts) {
  const messages = [];

  const modalText = await captureEidopoiisiModal(page, timeouts);
  if (modalText) {
    log('Captured modal message:', modalText);
    messages.push(modalText);
  }

  let bodyText = '';
  try {
    bodyText = await page.locator('body').innerText({ timeout: timeouts.medium() });
  } catch {}

  const uniq = Array.from(new Set(messages.map(m => m.trim()).filter(Boolean)));
  const combined = (uniq.join('\n') + '\n' + (bodyText || '')).slice(0, 30000);

  const protocol = extractProtocolFromText(combined);
  const isSuccess = !!protocol;
  const isError = looksLikeErrorText(combined) || uniq.some(m => m.includes('Ειδοποίηση'));

  return { protocol: protocol || null, messages: uniq, isError, isSuccess };
}

// ---------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------
async function uploadXml(page, xmlPath, creds, timeouts) {
  await ensureLoggedIn(page, creds, timeouts);

  if (!xmlPath) throw new Error('Missing xmlPath');
  if (!(await fs.pathExists(xmlPath))) throw new Error(`File not found: ${xmlPath}`);

  log('Starting XML upload...');

  const dropdown = page.locator(SEL_UPLOAD_PROCESS_SELECT).first();
  await dropdown.waitFor({ timeout: timeouts.long() })
    .catch(e => { timeouts.bump('dropdown'); throw e; });

  await dropdown.selectOption('213');
  await page.waitForTimeout(250);

  if (DEBUG) { console.log('[PAUSE] After selecting option 213'); await page.pause(); }

  const fileInput = page.locator(SEL_UPLOAD_FILE_INPUT).first();
  await fileInput.waitFor({ timeout: timeouts.long() })
    .catch(e => { timeouts.bump('fileInput'); throw e; });

  const dialogPromise = page.waitForEvent('dialog', { timeout: 15000 })
    .then(async dialog => { dbg('Dialog:', dialog.message()); await dialog.accept(); })
    .catch(() => {});

  await fileInput.setInputFiles(xmlPath);
  await dialogPromise;

  await page.waitForTimeout(350);
  await safeScreenshot(page, 'after_file_select');

  if (DEBUG) { console.log('[PAUSE] After file selection'); await page.pause(); }

  const submitBtn = page.locator(SEL_UPLOAD_SUBMIT_BTN).first();
  await submitBtn.waitFor({ timeout: timeouts.long() })
    .catch(e => { timeouts.bump('submitBtn'); throw e; });

  await submitBtn.click();

  await page.waitForLoadState('networkidle', { timeout: timeouts.long() }).catch(() => {});
  await page.waitForTimeout(600);

  await safeScreenshot(page, 'after_submit');

  if (DEBUG) { console.log('[PAUSE] After clicking Ενημέρωση'); await page.pause(); }

  return await collectResultInfo(page, timeouts);
}

// ---------------------------------------------------------------------
// MAIN export (self-healing + adaptive timeouts)
// ---------------------------------------------------------------------
async function uploadE3ToErganh(companyId, xmlPath, userId = null, creds = null) {
  const timeouts = new AdaptiveTimeouts();

  let browser = null;
  let context = null;
  let page = null;

  const headless = !DEBUG;
  const slowMo = DEBUG ? 250 : 0;

  const launchFresh = async () => {
    try { if (page && !page.isClosed()) await page.close(); } catch {}
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}

    log('Launching browser...', { headless });

    browser = await chromium.launch({
      headless,
      slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
  };

  try {
    await launchFresh();

    // One run is usually enough; if the browser closes -> relaunch & retry once
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log(`Attempt ${attempt}/2`);
        await loginToErganh(page, creds, timeouts);
        await navigateToUploadPage(page, creds, timeouts);
        const result = await uploadXml(page, xmlPath, creds, timeouts);

        if (result.isSuccess) {
          const shot = await safeScreenshot(page, 'final_success');
          return { success: true, protocol: result.protocol, screenshot: shot, messages: result.messages || [] };
        }

        const shot = await safeScreenshot(page, 'final_error');
        return {
          success: false,
          protocol: result.protocol || null,
          screenshot: shot,
          error: (result.messages && result.messages.length) ? result.messages.join(' | ') : 'Upload failed',
          messages: result.messages || []
        };

      } catch (e) {
        warn('Attempt failed:', e?.message || e);

        if (attempt >= 2) {
          const shot = page ? await safeScreenshot(page, 'final_exception') : null;
          return { success: false, protocol: null, screenshot: shot, error: e?.message || String(e), messages: [] };
        }

        // adaptive bump if looks like timeout/stuck
        timeouts.bump('retry');

        if (isClosedTargetError(e)) {
          warn('Browser/page closed -> relaunch');
          await launchFresh();
        } else {
          // soft reset to login
          await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
    }

    const shot = page ? await safeScreenshot(page, 'final_fallback') : null;
    return { success: false, protocol: null, screenshot: shot, error: 'Unknown failure', messages: [] };

  } finally {
    try { if (page && !page.isClosed()) await page.close(); } catch {}
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}
  }
}

module.exports = { uploadE3ToErganh };