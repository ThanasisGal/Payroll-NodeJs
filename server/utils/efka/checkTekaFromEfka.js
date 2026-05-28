// ./server/utils/efka/checkTekaFromEfka.js
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function log(...a) {
    console.log('[TEKA]', ...a);
}
function err(...a) {
    console.error('[TEKA][ERROR]', ...a);
}

// ✅ Cache: 1 browser instance ανά username
const browserCache = new Map();
// { username: { browser, context, expiresAt } }

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 λεπτά

async function getOrCreateContext(username, password, headless, timeoutMs) {
    const now = Date.now();
    const cached = browserCache.get(username);

    // ✅ Αν υπάρχει valid cached context, επαναχρησιμοποίησέ το
    if (cached && cached.expiresAt > now) {
        try {
            // Έλεγξε αν ο browser είναι ακόμα ζωντανός
            const testPage = await cached.context.newPage();
            await testPage.close();
            log('Reusing cached browser context for:', username);
            cached.expiresAt = now + SESSION_TTL_MS; // ανανέωσε TTL
            return { context: cached.context, isNew: false };
        } catch {
            log('Cached context dead — creating new one');
            browserCache.delete(username);
        }
    }

    // ✅ Δημιούργησε νέο browser + context
    log('Creating new browser context for:', username);

    const browser = await chromium.launch({
        headless,
        args: [
            '--ignore-certificate-errors',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'el-GR',
        timezoneId: 'Europe/Athens',
        ignoreHTTPSErrors: true
    });

    await context.route('**/*', (route) => {
        const rt = route.request().resourceType();
        const url = route.request().url();
        if (rt === 'image' || rt === 'font' || rt === 'media') return route.abort();
        if (
            url.includes('google-analytics') ||
            url.includes('googletagmanager') ||
            url.includes('doubleclick')
        )
            return route.abort();
        return route.continue();
    });

    // ✅ Αποθήκευσε στο cache
    browserCache.set(username, {
        browser,
        context,
        expiresAt: now + SESSION_TTL_MS
    });

    return { context, isNew: true };
}

async function checkTekaFromEfka(opts = {}) {
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const headless = typeof opts.headless === 'boolean' ? opts.headless : NODE_ENV === 'production';
    const timeoutMs = NODE_ENV === 'production' ? 60000 : 30000;

    let page = null;

    try {
        const { context, isNew } = await getOrCreateContext(
            opts.username,
            opts.password,
            headless,
            timeoutMs
        );

        page = await context.newPage();

        if (isNew) {
            // =====================================================================
            // ΝΕΟΣ BROWSER: Κάνε login (μόνο την 1η φορά)
            // =====================================================================
            log('Step 1: New context — navigating to eCheckTEKA login...');

            await page.goto('https://apps.e-efka.gov.gr/eCheckTEKA', {
                waitUntil: 'domcontentloaded',
                timeout: timeoutMs
            });
            await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
            log('Step 1: URL after goto:', page.url());

            // Login αν χρειαστεί
            const hasLogin = await page
                .locator('#j_username')
                .isVisible({ timeout: 5000 })
                .catch(() => false);

            if (hasLogin) {
                log('Step 2: Filling credentials...');
                await page.locator('#j_username').fill(String(opts.username || ''));
                await page.locator('#j_username').press('Tab');
                await page.waitForTimeout(200);
                await page.locator('#j_password').fill(String(opts.password || ''));

                const loginBtn = page
                    .locator(
                        ['button.login_btn', 'button[aria-label="Είσοδος"]', '#j_idt39'].join(', ')
                    )
                    .first();

                await loginBtn.waitFor({ state: 'visible', timeout: timeoutMs });
                await loginBtn.click();

                await page
                    .waitForURL((url) => !url.toString().includes('login.xhtml'), {
                        timeout: timeoutMs
                    })
                    .catch(() => {});

                await page
                    .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                    .catch(() => {});
                await page.waitForTimeout(1500);
                log('Step 2: Login completed. URL:', page.url());
            } else {
                log('Step 2: No login needed — already authenticated');
            }
        } else {
            // =====================================================================
            // CACHED CONTEXT: Πήγαινε κατευθείαν στο checkTEKA
            // =====================================================================
            log('Step 1: Cached context — navigating directly to checkTEKA...');
            await page.goto('https://apps.e-efka.gov.gr/eCheckTEKA/secure/checkTEKA.xhtml', {
                waitUntil: 'domcontentloaded',
                timeout: timeoutMs
            });
            await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});

            // Αν expired και ανακατευθύνθηκε στο login, κάνε ξανά login
            const needsLogin = await page
                .locator('#j_username')
                .isVisible({ timeout: 3000 })
                .catch(() => false);
            if (needsLogin) {
                log('Step 1: Session expired — re-logging in...');
                await page.locator('#j_username').fill(String(opts.username || ''));
                await page.locator('#j_username').press('Tab');
                await page.waitForTimeout(200);
                await page.locator('#j_password').fill(String(opts.password || ''));

                const loginBtn = page
                    .locator(
                        ['button.login_btn', 'button[aria-label="Είσοδος"]', '#j_idt39'].join(', ')
                    )
                    .first();

                await loginBtn.waitFor({ state: 'visible', timeout: timeoutMs });
                await loginBtn.click();

                await page
                    .waitForURL((url) => !url.toString().includes('login.xhtml'), {
                        timeout: timeoutMs
                    })
                    .catch(() => {});

                await page
                    .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                    .catch(() => {});
                await page.waitForTimeout(1500);
            }
        }

        // =====================================================================
        // ΒΗΜΑ 5: Βάλε το ΑΜΚΑ
        // =====================================================================
        log('Step 5: Filling AMKA...');

        await page
            .waitForLoadState('networkidle', { timeout: 10000 })
            .catch(() =>
                page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {})
            );

        await page.waitForTimeout(1000);

        const amkaInput = page.locator('#CheckTEKAForm\\:CheckTEKA-criteria-AMKA_ID');
        await amkaInput.waitFor({ state: 'visible', timeout: timeoutMs });
        await amkaInput.fill(String(opts.amka || ''));

        const amkaVal = await amkaInput.inputValue().catch(() => '');
        log('Step 5: AMKA filled:', amkaVal);

        await page.click('#CheckTEKAForm\\:j_idt143');
        await page.waitForSelector('#ActionForm\\:ActionButtonsDown', {
            state: 'visible',
            timeout: timeoutMs
        });
        log('Step 5: Action panel appeared.');

        // =====================================================================
        // ΒΗΜΑ 6: Κλικ "Υποβολή Ελέγχου"
        // =====================================================================
        log('Step 6: Clicking "Υποβολή Ελέγχου"...');

        await page.click('#ActionForm\\:j_idt180');
        await page.waitForSelector('#ActionForm\\:ActionMessages', {
            state: 'visible',
            timeout: timeoutMs
        });
        log('Step 6: Result messages appeared.');

        // =====================================================================
        // ΒΗΜΑ 7: Διάβασε αποτέλεσμα
        // =====================================================================
        log('Step 7: Reading result...');

        const messagesText = await page
            .locator('#ActionForm\\:ActionMessages')
            .innerText()
            .catch(() => '');

        log('Messages text:', messagesText);

        const denYpagetai = messagesText.includes('δεν υπάγεται στο ΤΕΚΑ');
        const ypagetai = messagesText.includes('υπάγεται στο ΤΕΚΑ');
        const tekaYpagogi = ypagetai && !denYpagetai;

        const tekaMessage = tekaYpagogi
            ? 'Ο συγκεκριμένος ασφαλισμένος υπάγεται στο ΤΕΚΑ'
            : denYpagetai
              ? 'Ο συγκεκριμένος ασφαλισμένος ΔΕΝ υπάγεται στο ΤΕΚΑ'
              : '';

        log('TEKA result:', { tekaYpagogi, tekaMessage });

        // ✅ Κλείσε μόνο το PAGE (όχι τον browser/context)
        await page.close().catch(() => {});

        return { success: true, tekaYpagogi, tekaMessage, fullText: messagesText.trim() };
    } catch (e) {
        err('checkTekaFromEfka failed:', e?.message || e);

        // ✅ Κλείσε μόνο το page στο catch
        if (page !== null) await page.close().catch(() => {});

        // ✅ Αν το error είναι σοβαρό, καθάρισε το cache για αυτόν τον user
        if (opts.username) browserCache.delete(opts.username);

        return {
            success: false,
            tekaYpagogi: false,
            tekaMessage: '',
            error: e?.message || String(e)
        };
    }
}

module.exports = { checkTekaFromEfka };
