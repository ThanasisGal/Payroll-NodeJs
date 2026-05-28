// ./server/utils/efka/loadFromApd.js
const { chromium } = require('playwright');
const { createSession } = require('./efkaSessionStore');

let __sharedBrowser = null;
let __sharedBrowserLaunching = null;

let __efkaLock = Promise.resolve();

function withEfkaLock(fn) {
    const run = __efkaLock.then(fn, fn);
    __efkaLock = run.catch(() => {});
    return run;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const DEBUG = String(process.env.EFKA_DEBUG || '').toLowerCase() === 'true';

const URL_1 = 'https://www.e-efka.gov.gr/el/ilektronikes-ypiresies-%CE%BF';
const URL_2 = 'https://www.e-efka.gov.gr/el/ergodotes/ilektronikes-ypiresies-gia-ergodotes';
const URL_3 = 'https://www.e-efka.gov.gr/el/ergodotes/elektronike-ypobole-apd';
const URL_4 = 'https://services.e-efka.gov.gr/ssp.efka.apd/secure/submissions.xhtml';

function log(...a) {
    console.log('[EFKA]', ...a);
}

function err(...a) {
    console.error('[EFKA][ERROR]', ...a);
}

async function getSharedBrowser({ slowMo, headless }) {
    if (__sharedBrowser) return __sharedBrowser;

    if (!__sharedBrowserLaunching) {
        __sharedBrowserLaunching = (async () => {
            const launchOptions = {
                headless,
                slowMo,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--ignore-certificate-errors',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            };

            if (!headless) {
                launchOptions.channel = 'chrome';
                launchOptions.args.unshift('--start-maximized');
            }

            const b = await chromium.launch(launchOptions);

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

async function loadFromApd(opts = {}) {
    return withEfkaLock(async () => {
        const defaultHeadless =
            String(process.env.EFKA_HEADLESS || '').toLowerCase() === 'false'
                ? false
                : NODE_ENV === 'production';

        const headless = typeof opts.headless === 'boolean' ? opts.headless : defaultHeadless;

        const envSlowMo = Number(process.env.EFKA_SLOWMO || 0);

        const slowMo =
            NODE_ENV === 'production'
                ? 0
                : typeof opts.slowMo === 'number'
                  ? opts.slowMo
                  : DEBUG
                    ? envSlowMo || 150
                    : envSlowMo;

        const keepSession =
            typeof opts.keepSession === 'boolean'
                ? opts.keepSession
                : NODE_ENV === 'production'
                  ? true
                  : String(process.env.EFKA_KEEP_OPEN || '').toLowerCase() === 'true';

        const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : 10 * 60 * 1000;

        let browser;
        let context;
        let page;
        let apdPage;

        try {
            log('Launching...', { NODE_ENV, headless, slowMo, keepSession });

            browser = await getSharedBrowser({ slowMo, headless });

            context = await browser.newContext({
                viewport: headless ? { width: 1280, height: 800 } : null,
                locale: 'el-GR',
                timezoneId: 'Europe/Athens',
                ignoreHTTPSErrors: true,
                userAgent:
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            });

            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false
                });

                window.chrome = {
                    runtime: {}
                };

                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });

                Object.defineProperty(navigator, 'languages', {
                    get: () => ['el-GR', 'el', 'en-US', 'en']
                });
            });

            page = await context.newPage();

            await page.goto(URL_1, { waitUntil: 'load', timeout: 90000 });
            await page.waitForTimeout(1500);

            await page.goto(URL_2, { waitUntil: 'load', timeout: 90000 });
            await page.waitForTimeout(1500);

            await page.goto(URL_3, { waitUntil: 'load', timeout: 90000 });
            await page.waitForTimeout(2000);

            await page.goto(URL_4, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            apdPage = page;

            await apdPage.waitForLoadState('domcontentloaded', { timeout: 90000 }).catch(() => {});

            const title = await apdPage.title().catch(() => '');
            const url = apdPage.url();

            log('APD login/submissions opened:', { url, title });

            if (/blocked/i.test(title)) {
                throw new Error(`Ο ΕΦΚΑ μπλόκαρε τη σελίδα ΑΠΔ. URL=${url}, title=${title}`);
            }

            if (keepSession) {
                const sessionId = createSession({ browser, context, page, apdPage }, { ttlMs });

                return {
                    success: true,
                    sessionId,
                    url: apdPage.url()
                };
            }

            return {
                success: true,
                sessionId: null,
                url: apdPage.url()
            };
        } catch (e) {
            err('loadFromApd failed:', e?.message || e);

            return {
                success: false,
                error: e?.message || String(e)
            };
        } finally {
            if (!keepSession) {
                try {
                    if (page && !page.isClosed()) await page.close();
                } catch {}

                try {
                    if (context) await context.close();
                } catch {}
            }
        }
    });
}

module.exports = { loadFromApd };
