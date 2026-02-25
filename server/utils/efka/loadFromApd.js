// ./server/utils/efka/loadFromApd.js
const { chromium } = require('playwright');
const { createSession } = require('./efkaSessionStore');

const START_URL = 'https://www.e-efka.gov.gr/el/ilektronikes-ypiresies-%CE%BF';
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEBUG = String(process.env.EFKA_DEBUG || '').toLowerCase() === 'true';

function log(...a)  { console.log('[EFKA]', ...a); }
function err(...a)  { console.error('[EFKA][ERROR]', ...a); }

async function loadFromApd(opts = {}) {
  const defaultHeadless = (NODE_ENV === 'production');
  const headless = (typeof opts.headless === 'boolean') ? opts.headless : defaultHeadless;

  const envSlowMo = Number(process.env.EFKA_SLOWMO || 0);
  const slowMo = (NODE_ENV === 'production') ? 0 : (typeof opts.slowMo === 'number' ? opts.slowMo : (DEBUG ? (envSlowMo || 150) : envSlowMo));

  const keepSession = (typeof opts.keepSession === 'boolean')
    ? opts.keepSession
    : (NODE_ENV === 'production' ? true : (String(process.env.EFKA_KEEP_OPEN || '').toLowerCase() === 'true'));

  const ttlMs = (typeof opts.ttlMs === 'number') ? opts.ttlMs : 10 * 60 * 1000;

  let browser, context, page;

  try {
    log('Launching...', { NODE_ENV, headless, slowMo, keepSession });

    browser = await chromium.launch({
      headless: false,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'el-GR',
      timezoneId: 'Europe/Athens',
    });

    page = await context.newPage();

    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: 'Ηλεκτρονικές Υπηρεσίες για Εργοδότες' }).click();
    await page.waitForLoadState('domcontentloaded');

	await page.locator('a[href="/el/ergodotes/elektronike-ypobole-apd"]').click();
    await page.waitForLoadState('domcontentloaded');

	const APD_SUBMISSIONS_URL =
	'https://services.e-efka.gov.gr/ssp.efka.apd/secure/submissions.xhtml';

	const [apdPage] = await Promise.all([
		context.waitForEvent('page'),
		page.locator(`a[href="${APD_SUBMISSIONS_URL}"]`).click(),
	]);
    await apdPage.waitForLoadState('domcontentloaded');

    // ✅ εδώ κρατάμε session
    if (keepSession) {
      const sessionId = createSession({ browser, context, page, apdPage }, { ttlMs });
      return { success: true, sessionId, url: apdPage.url() };
    }

    // αλλιώς απλό mode
    return { success: true, sessionId: null, url: apdPage.url() };

  } catch (e) {
    err('loadFromApd failed:', e?.message || e);
    return { success: false, error: e?.message || String(e) };

  } finally {
    // Αν κρατάμε session, ΜΗΝ κλείνεις τίποτα εδώ.
    // Αν δεν κρατάμε session, κλείσε κανονικά.
    if (!keepSession) {
      try { if (page && !page.isClosed()) await page.close(); } catch {}
      try { if (context) await context.close(); } catch {}
      try { if (browser) await browser.close(); } catch {}
    }
  }
}

module.exports = { loadFromApd };



// // ./server/utils/efka/loadFromApd.js
// 'use strict';

// const { chromium } = require('playwright');
// const { createSession } = require('./efkaSessionStore');

// const NODE_ENV = process.env.NODE_ENV || 'development';
// const DEBUG = String(process.env.EFKA_DEBUG || '').toLowerCase() === 'true';

// function log(...a) { console.log('[EFKA]', ...a); }
// function err(...a) { console.error('[EFKA][ERROR]', ...a); }

// function isTruthy(v) {
//   return ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
// }

// async function clickIfExists(page, selector, timeoutMs = 2000) {
//   const loc = page.locator(selector).first();
//   try {
//     if (await loc.count()) {
//       await loc.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {});
//       if (await loc.isVisible().catch(() => false)) {
//         await loc.click({ timeout: timeoutMs }).catch(() => {});
//         return true;
//       }
//     }
//   } catch {}
//   return false;
// }

// async function loadFromApd(opts = {}) {
//   // ✅ headless policy:
//   // - Αν είσαι σε Docker και δεν έχεις X server -> ΠΑΝΤΑ headless
//   // - Αλλιώς: production headless, dev headed (εκτός αν το κάνεις override)
//   const isDocker = isTruthy(process.env.DOCKER);
//   const defaultHeadless = isDocker || (NODE_ENV === 'production');
//   const headless = (typeof opts.headless === 'boolean') ? opts.headless : defaultHeadless;

//   const envSlowMo = Number(process.env.EFKA_SLOWMO || 0);
//   const slowMo = (NODE_ENV === 'production')
//     ? 0
//     : (typeof opts.slowMo === 'number' ? opts.slowMo : (DEBUG ? (envSlowMo || 150) : envSlowMo));

//   const keepSession = (typeof opts.keepSession === 'boolean')
//     ? opts.keepSession
//     : (NODE_ENV === 'production' ? true : isTruthy(process.env.EFKA_KEEP_OPEN));

//   const ttlMs = (typeof opts.ttlMs === 'number') ? opts.ttlMs : 10 * 60 * 1000;

//   let browser, context, page;

//   // ✅ Πήγαινε κατευθείαν εκεί που θέλεις (χωρίς fragile clicks στην αρχική)
//   const DIRECT_APD_LANDING_URL = 'https://www.e-efka.gov.gr/el/ergodotes/elektronike-ypobole-apd';
//   const APD_SUBMISSIONS_URL = 'https://services.e-efka.gov.gr/ssp.efka.apd/secure/submissions.xhtml';

//   try {
//     log('ENV CHECK:', {
//       NODE_ENV,
//       DOCKER: String(process.env.DOCKER || ''),
//       DISPLAY: String(process.env.DISPLAY || ''),
//       isDocker,
//       headless,
//     });

//     log('Launching...', { NODE_ENV, headless, slowMo, keepSession });

//     browser = await chromium.launch({
//       headless,
//       slowMo,
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-gpu',
//       ],
//     });

//     context = await browser.newContext({
//       viewport: { width: 1920, height: 1080 },
//       locale: 'el-GR',
//       timezoneId: 'Europe/Athens',
//     });

//     page = await context.newPage();

//     // 1) Direct landing (σταθερό)
//     await page.goto(DIRECT_APD_LANDING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

//     // (Optional) κλείσε cookie/consent αν υπάρχει
//     // βάλε μερικά “γνωστά” selectors που εμφανίζονται συχνά
//     await clickIfExists(page, 'button:has-text("Αποδοχή")', 1500);
//     await clickIfExists(page, 'button:has-text("Συμφωνώ")', 1500);
//     await clickIfExists(page, 'button:has-text("Accept")', 1500);

//     // 2) Άνοιγμα submissions:
//     // Προσπαθούμε πρώτα click σε link που ανοίγει νέα σελίδα.
//     // Αν δεν υπάρχει/δεν ανοίξει, πάμε κατευθείαν με goto (και αφήνουμε redirect να κάνει τη δουλειά).
//     let apdPage = null;

//     const link = page.locator(`a[href="${APD_SUBMISSIONS_URL}"]`).first();
//     if (await link.count().catch(() => 0)) {
//       const [newPage] = await Promise.all([
//         context.waitForEvent('page', { timeout: 20000 }).catch(() => null),
//         link.click().catch(() => {}),
//       ]);
//       apdPage = newPage;
//     }

//     if (!apdPage) {
//       apdPage = await context.newPage();
//       await apdPage.goto(APD_SUBMISSIONS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     }

//     await apdPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});

//     // ✅ εδώ κρατάμε session
//     if (keepSession) {
//       const sessionId = createSession({ browser, context, page, apdPage }, { ttlMs });
//       return { success: true, sessionId, url: apdPage.url() };
//     }

//     return { success: true, sessionId: null, url: apdPage.url() };

//   } catch (e) {
//     err('loadFromApd failed:', e?.message || e);

//     // (πολύ χρήσιμο) screenshot για να δεις τι φόρτωσε πραγματικά
//     try {
//       if (page && !page.isClosed()) await page.screenshot({ path: 'efka_load_failed.png', fullPage: true });
//     } catch {}

//     return { success: false, error: e?.message || String(e) };

//   } finally {
//     if (!keepSession) {
//       try { if (page && !page.isClosed()) await page.close(); } catch {}
//       try { if (context) await context.close(); } catch {}
//       try { if (browser) await browser.close(); } catch {}
//     }
//   }
// }

// module.exports = { loadFromApd };