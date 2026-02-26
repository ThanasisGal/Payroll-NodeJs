// // ./server/utils/efka/loadFromApd.js
// const { chromium } = require('playwright');
// const { createSession } = require('./efkaSessionStore');

// let __sharedBrowser = null;
// let __sharedBrowserLaunching = null;

// // simple mutex: one EFKA run at a time (avoids browser close/race)
// let __efkaLock = Promise.resolve();
// function withEfkaLock(fn) {
//   const run = __efkaLock.then(fn, fn);
//   __efkaLock = run.catch(() => {});
//   return run;
// }

// async function getSharedBrowser({ slowMo }) {
//   if (__sharedBrowser) return __sharedBrowser;

//   if (!__sharedBrowserLaunching) {
//     __sharedBrowserLaunching = (async () => {
//       const b = await chromium.launch({
//         headless: false,
//         slowMo,
//         args: [
//           '--no-sandbox',
//           '--disable-setuid-sandbox',
//           '--disable-dev-shm-usage',
//           '--disable-gpu',
//         ],
//       });

//       // If browser disconnects/crashes, allow relaunch next time
//       b.on('disconnected', () => {
//         __sharedBrowser = null;
//         __sharedBrowserLaunching = null;
//       });

//       __sharedBrowser = b;
//       return b;
//     })().finally(() => {
//       __sharedBrowserLaunching = null;
//     });
//   }

//   return __sharedBrowserLaunching;
// }

// const START_URL = 'https://www.e-efka.gov.gr/el/ilektronikes-ypiresies-%CE%BF';
// const NODE_ENV = process.env.NODE_ENV || 'development';
// const DEBUG = String(process.env.EFKA_DEBUG || '').toLowerCase() === 'true';

// function log(...a)  { console.log('[EFKA]', ...a); }
// function err(...a)  { console.error('[EFKA][ERROR]', ...a); }

// async function loadFromApd(opts = {}) {
//     return withEfkaLock(async () => {

//         const defaultHeadless = (NODE_ENV === 'production');
//         const headless = (typeof opts.headless === 'boolean') ? opts.headless : defaultHeadless;

//         const envSlowMo = Number(process.env.EFKA_SLOWMO || 0);
//         const slowMo = (NODE_ENV === 'production') ? 0 : (typeof opts.slowMo === 'number' ? opts.slowMo : (DEBUG ? (envSlowMo || 150) : envSlowMo));

//         const keepSession = (typeof opts.keepSession === 'boolean')
//             ? opts.keepSession
//             : (NODE_ENV === 'production' ? true : (String(process.env.EFKA_KEEP_OPEN || '').toLowerCase() === 'true'));

//         const ttlMs = (typeof opts.ttlMs === 'number') ? opts.ttlMs : 10 * 60 * 1000;

//         let browser, context, page;

//         try {
//             log('Launching...', { NODE_ENV, headless, slowMo, keepSession });

//             browser = await getSharedBrowser({ slowMo });

//             context = await browser.newContext({
//                 viewport: { width: 1280, height: 800 },
//                 locale: 'el-GR',
//                 timezoneId: 'Europe/Athens',
//             });

//             // PERF: block heavy resources (images/fonts/media) — huge win on EC2
//             await context.route('**/*', (route) => {
//                 const rt = route.request().resourceType();
//                 if (rt === 'image' || rt === 'font' || rt === 'media') return route.abort();
//                 return route.continue();
//             });

//             page = await context.newPage();

//             await page.goto(START_URL, { waitUntil: 'domcontentloaded' });

//             await page.getByRole('link', { name: 'Ηλεκτρονικές Υπηρεσίες για Εργοδότες' }).click();
//             await page.waitForLoadState('domcontentloaded');

//             await page.locator('a[href="/el/ergodotes/elektronike-ypobole-apd"]').click();
//             await page.waitForLoadState('domcontentloaded');

//             const APD_SUBMISSIONS_URL = 'https://services.e-efka.gov.gr/ssp.efka.apd/secure/submissions.xhtml';

//             const [apdPage] = await Promise.all([
//                 context.waitForEvent('page'),
//                 page.locator(`a[href="${APD_SUBMISSIONS_URL}"]`).click(),
//             ]);
//             await apdPage.waitForLoadState('domcontentloaded');

//             // ✅ εδώ κρατάμε session
//             if (keepSession) {
//                 const sessionId = createSession({ browser, context, page, apdPage }, { ttlMs });
//                 return { success: true, sessionId, url: apdPage.url() };
//             }

//             // αλλιώς απλό mode
//             return { success: true, sessionId: null, url: apdPage.url() };

//         } catch (e) {
//             err('loadFromApd failed:', e?.message || e);
//             return { success: false, error: e?.message || String(e) };

//         } finally {
//             // Αν κρατάμε session, ΜΗΝ κλείνεις τίποτα εδώ.
//             // Αν δεν κρατάμε session, κλείσε κανονικά.
//             if (!keepSession) {
//                 try { if (page && !page.isClosed()) await page.close(); } catch {}
//                 try { if (context) await context.close(); } catch {}
//                 // try { if (browser) await browser.close(); } catch {}
//             }
//         }
//     });
// }

// module.exports = { loadFromApd };


// ./server/utils/efka/loadFromApd.js
const { chromium } = require('playwright');
const { createSession } = require('./efkaSessionStore');

let __sharedBrowser = null;
let __sharedBrowserLaunching = null;

// simple mutex: one EFKA run at a time (avoids races)
let __efkaLock = Promise.resolve();
function withEfkaLock(fn) {
  const run = __efkaLock.then(fn, fn);
  __efkaLock = run.catch(() => {});
  return run;
}

async function getSharedBrowser({ slowMo }) {
  if (__sharedBrowser) return __sharedBrowser;

  if (!__sharedBrowserLaunching) {
    __sharedBrowserLaunching = (async () => {
      const b = await chromium.launch({
        headless: false, // must be false (your requirement)
        slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      // If browser disconnects/crashes, allow relaunch next time
      b.on('disconnected', () => {
        __sharedBrowser = null;
        __sharedBrowserLaunching = null;
      });

      __sharedBrowser = b;
      return b;
    })().finally(() => {
      __sharedBrowserLaunching = null;
    });
  }

  return __sharedBrowserLaunching;
}

// PERF: direct URLs (avoid multi-click navigation)
const DIRECT_APD_LANDING_URL =
  'https://www.e-efka.gov.gr/el/ergodotes/elektronike-ypobole-apd';
const APD_SUBMISSIONS_URL =
  'https://services.e-efka.gov.gr/ssp.efka.apd/secure/submissions.xhtml';

const NODE_ENV = process.env.NODE_ENV || 'development';
const DEBUG = String(process.env.EFKA_DEBUG || '').toLowerCase() === 'true';

function log(...a) {
  console.log('[EFKA]', ...a);
}
function err(...a) {
  console.error('[EFKA][ERROR]', ...a);
}

async function loadFromApd(opts = {}) {
  return withEfkaLock(async () => {
    const defaultHeadless = (NODE_ENV === 'production');
    const headless =
      (typeof opts.headless === 'boolean') ? opts.headless : defaultHeadless;

    const envSlowMo = Number(process.env.EFKA_SLOWMO || 0);
    const slowMo = (NODE_ENV === 'production')
      ? 0
      : (typeof opts.slowMo === 'number'
        ? opts.slowMo
        : (DEBUG ? (envSlowMo || 150) : envSlowMo));

    const keepSession =
      (typeof opts.keepSession === 'boolean')
        ? opts.keepSession
        : (NODE_ENV === 'production'
          ? true
          : (String(process.env.EFKA_KEEP_OPEN || '').toLowerCase() === 'true'));

    const ttlMs = (typeof opts.ttlMs === 'number') ? opts.ttlMs : 10 * 60 * 1000;

    let browser, context, page;

    try {
      log('Launching...', { NODE_ENV, headless, slowMo, keepSession });

      // shared browser (big perf win on EC2)
      browser = await getSharedBrowser({ slowMo });

      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'el-GR',
        timezoneId: 'Europe/Athens',
      });

      // PERF: block heavy resources (images/fonts/media)
      await context.route('**/*', (route) => {
        const rt = route.request().resourceType();
        if (rt === 'image' || rt === 'font' || rt === 'media') return route.abort();
        return route.continue();
      });

      page = await context.newPage();

      // 1) Go directly to APD landing (faster than click navigation)
      await page.goto(DIRECT_APD_LANDING_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // 2) Open submissions (prefer clicking link if present, else direct goto)
      let apdPage = null;

      const link = page.locator(`a[href="${APD_SUBMISSIONS_URL}"]`).first();
      const linkCount = await link.count().catch(() => 0);

      if (linkCount > 0) {
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 20000 }).catch(() => null),
          link.click().catch(() => {}),
        ]);
        apdPage = newPage;
      }

      if (!apdPage) {
        apdPage = await context.newPage();
        await apdPage.goto(APD_SUBMISSIONS_URL, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
      }

      await apdPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});

      // ✅ keep session open (prod)
      if (keepSession) {
        const sessionId = createSession({ browser, context, page, apdPage }, { ttlMs });
        return { success: true, sessionId, url: apdPage.url() };
      }

      // simple mode
      return { success: true, sessionId: null, url: apdPage.url() };
    } catch (e) {
      err('loadFromApd failed:', e?.message || e);
      return { success: false, error: e?.message || String(e) };
    } finally {
      // If we keep session, do NOT close anything here.
      // If not keeping session, close page/context. Never close shared browser here.
      if (!keepSession) {
        try { if (page && !page.isClosed()) await page.close(); } catch {}
        try { if (context) await context.close(); } catch {}
      }
    }
  });
}

module.exports = { loadFromApd };