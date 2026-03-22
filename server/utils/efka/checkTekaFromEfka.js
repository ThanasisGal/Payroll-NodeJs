// ./server/utils/efka/checkTekaFromEfka.js
'use strict';

const { chromium } = require('playwright');

function log(...a) {
    console.log('[TEKA]', ...a);
}
function err(...a) {
    console.error('[TEKA][ERROR]', ...a);
}

/**
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.password
 * @param {string} opts.amka
 * @param {boolean} [opts.headless]
 * @returns {Promise<{ success: boolean, tekaYpagogi: boolean, tekaMessage: string, fullText?: string, error?: string }>}
 */
async function checkTekaFromEfka(opts = {}) {
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const headless = typeof opts.headless === 'boolean' ? opts.headless : NODE_ENV === 'production';
    const timeoutMs = 30000;

    /** @type {import('playwright').Browser | null} */
    let browser = null;
    /** @type {import('playwright').BrowserContext | null} */
    let context = null;
    /** @type {import('playwright').Page | null} */
    let page = null;

    async function cleanup() {
        if (page !== null && !page.isClosed()) await page.close().catch(() => {});
        if (context !== null) await context.close().catch(() => {});
        if (browser !== null) await browser.close().catch(() => {});
        log('Browser closed.');
    }

    try {
        log('Launching browser for TEKA check...', { headless });

        browser = await chromium.launch({
            headless,
            args: [
                '--ignore-certificate-errors',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            locale: 'el-GR',
            timezoneId: 'Europe/Athens',
            ignoreHTTPSErrors: true
        });

        // Block heavy resources
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

        page = await context.newPage();

        // =====================================================================
        // ΒΗΜΑ 1α: Πλοήγηση στην αρχική σελίδα e-ΕΦΚΑ
        // =====================================================================
        log('Step 1a: Navigating to e-efka.gov.gr...');
        await page.goto('https://www.e-efka.gov.gr/el/ilektronikes-ypiresies-%CE%BF', {
            waitUntil: 'domcontentloaded',
            timeout: timeoutMs
        });
        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        log('Step 1a: Loaded. URL:', page.url());

        // =====================================================================
        // ΒΗΜΑ 1β: Κλικ στο "Ηλεκτρονικές Υπηρεσίες για Εργοδότες"
        // =====================================================================
        log('Step 1b: Clicking "Ηλεκτρονικές Υπηρεσίες για Εργοδότες"...');

        const ergodotesLink = page
            .locator('a[href="/el/ergodotes/ilektronikes-ypiresies-gia-ergodotes"]')
            .first();
        await ergodotesLink.waitFor({ state: 'visible', timeout: timeoutMs });
        await ergodotesLink.click();
        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        await page.waitForTimeout(1000);
        log('Step 1b: Loaded. URL:', page.url());

        // =====================================================================
        // ΒΗΜΑ 1γ: Κλικ στο "Ηλεκτρονική Υπηρεσία Επιβεβαίωσης Υπαγωγής ΤΕΚΑ"
        // =====================================================================
        log('Step 1c: Clicking "Επιβεβαίωση Υπαγωγής ΤΕΚΑ"...');

        const tekaServiceLink = page
            .locator(
                'a[href="/el/elektronikes-yperesies/elektronike-yperesia-epibebaioses-ypagoges-teka"]'
            )
            .first();
        await tekaServiceLink.waitFor({ state: 'visible', timeout: timeoutMs });
        await tekaServiceLink.click();
        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        await page.waitForTimeout(1000);
        log('Step 1c: Loaded. URL:', page.url());

        // =====================================================================
        // ΒΗΜΑ 1δ: Κλικ στο "Είσοδος στην υπηρεσία" → ανοίγει νέα καρτέλα
        // =====================================================================
        log('Step 1d: Clicking "Είσοδος στην υπηρεσία"...');

        const eisodosLink = page.locator('a[href="https://apps.e-efka.gov.gr/eCheckTEKA"]').first();
        await eisodosLink.waitFor({ state: 'visible', timeout: timeoutMs });

        // ✅ Περίμενε νέα καρτέλα — ανοίγει με target="_blank"
        const loginPagePromise = context
            .waitForEvent('page', { timeout: timeoutMs })
            .catch(() => null);

        await eisodosLink.click();
        const loginTab = await loginPagePromise;

        // ✅ Αν άνοιξε νέα καρτέλα, χρησιμοποίησέ την για το login
        if (loginTab) {
            await loginTab
                .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                .catch(() => {});
            await loginTab.waitForTimeout(1000);
            log('Step 1d: New tab opened. URL:', loginTab.url());
            // ✅ Αντικατέστησε το page με το loginTab για τα επόμενα βήματα
            page = loginTab;
        } else {
            // Αν δεν άνοιξε νέα καρτέλα, περίμενε navigation στην ίδια
            await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
            log('Step 1d: Same tab navigation. URL:', page.url());
        }

        // =====================================================================
        // ΒΗΜΑ 2: Συμπλήρωση username/password
        // =====================================================================
        log('Step 2: Filling credentials...');

        // const usernameField = page.locator('#j_username');
        // await usernameField.waitFor({ state: 'visible', timeout: timeoutMs });
        // await usernameField.click({ clickCount: 3 });
        // await usernameField.press('Control+a');
        // await usernameField.press('Delete');
        // await page.waitForTimeout(300);
        // await usernameField.fill('');
        // await usernameField.pressSequentially(String(opts.username || ''), { delay: 80 });

        // log('Step 2: Username filled:', opts.username);

        // await usernameField.press('Tab');
        // await page.waitForTimeout(300);

        // const passwordField = page.locator('#j_password');
        // await passwordField.waitFor({ state: 'visible', timeout: timeoutMs });
        // await passwordField.click({ clickCount: 3 });
        // await passwordField.press('Control+a');
        // await passwordField.press('Delete');
        // await page.waitForTimeout(300);
        // await passwordField.fill('');
        // await passwordField.pressSequentially(String(opts.password || ''), { delay: 80 });

        // log('Step 2: Password filled.');

        // const usernameVal = await usernameField.inputValue().catch(() => '');
        // const passwordVal = await passwordField.inputValue().catch(() => '');
        // log(
        //     'Step 2: Verification — username length:',
        //     usernameVal.length,
        //     '| password length:',
        //     passwordVal.length
        // );

        const usernameField = page.locator('#j_username');
        await usernameField.waitFor({ state: 'visible', timeout: timeoutMs });

        // ✅ fill() — άμεσο, χωρίς delay, χωρίς deprecated type()
        await usernameField.fill(String(opts.username || ''));

        log('Step 2: Username filled:', opts.username);

        await usernameField.press('Tab');
        await page.waitForTimeout(200);

        const passwordField = page.locator('#j_password');
        await passwordField.waitFor({ state: 'visible', timeout: timeoutMs });

        // ✅ fill() — άμεσο
        await passwordField.fill(String(opts.password || ''));

        log('Step 2: Password filled.');

        const usernameVal = await usernameField.inputValue().catch(() => '');
        const passwordVal = await passwordField.inputValue().catch(() => '');
        log(
            'Step 2: Verification — username length:',
            usernameVal.length,
            '| password length:',
            passwordVal.length
        );

        // =====================================================================
        // ΒΗΜΑ 3: Κλικ "Είσοδος"
        // =====================================================================
        log('Step 3: Clicking login button...');

        const loginBtn = page
            .locator(
                [
                    'button.login_btn',
                    'button[aria-label="Είσοδος"]',
                    'button.ui-button-text-only span.ui-button-text:has-text("Είσοδος")',
                    '#j_idt39'
                ].join(', ')
            )
            .first();

        await loginBtn.waitFor({ state: 'visible', timeout: timeoutMs });
        log('Step 3: Login button found, clicking...');

        await loginBtn.click();

        await page
            .waitForURL((url) => !url.toString().includes('login.xhtml'), { timeout: timeoutMs })
            .catch(() => {
                log('Step 3: waitForURL timeout — checking current URL...');
            });

        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        await page.waitForTimeout(2000);

        log('Step 3: Login completed. URL:', page.url());

        // =====================================================================
        // ΒΗΜΑ 4: Εντόπισε τη σελίδα checkTEKA.xhtml
        // =====================================================================
        log('Step 4: Finding TEKA check page...');

        /** @type {import('playwright').Page} */
        let activePage = page;

        // ✅ Έλεγξε αν η τρέχουσα σελίδα είναι ήδη το checkTEKA
        const currentUrl = page.url();
        log('Step 4: Current URL after login:', currentUrl);

        if (currentUrl.includes('checkTEKA') || currentUrl.includes('eCheckTEKA')) {
            // ✅ Ήδη στη σελίδα ΤΕΚΑ — δεν χρειάζεται κλικ
            log('Step 4: Already on TEKA page ✅');
            activePage = page;
        } else {
            // ✅ Ψάξε για link ΤΕΚΑ στο dashboard
            log('Step 4: Looking for TEKA link on dashboard...');

            const tekaLink = page
                .locator('a[href="https://apps.e-efka.gov.gr/eCheckTEKA"]')
                .first();

            const tekaLinkVisible = await tekaLink.isVisible({ timeout: 5000 }).catch(() => false);

            if (tekaLinkVisible) {
                const newPagePromise = context
                    .waitForEvent('page', { timeout: timeoutMs })
                    .catch(() => null);

                await tekaLink.click();
                const tekaPage = await newPagePromise;

                if (tekaPage) {
                    await tekaPage
                        .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                        .catch(() => {});
                    await tekaPage.waitForTimeout(1000);
                    activePage = tekaPage;
                    log('Step 4: TEKA opened in new tab ✅');
                } else {
                    await page
                        .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                        .catch(() => {});
                    activePage = page;
                    log('Step 4: TEKA opened in same tab ✅');
                }
            } else {
                log('Step 4: No TEKA link found — assuming current page is TEKA');
                activePage = page;
            }
        }

        log('Step 4: Active TEKA page URL:', activePage.url());

        // =====================================================================
        // ΒΗΜΑ 5: Βάλε το ΑΜΚΑ
        // =====================================================================
        log('Step 5: Filling AMKA...');

        // ✅ Περίμενε να φορτώσει πλήρως η σελίδα ΤΕΚΑ
        await activePage
            .waitForLoadState('networkidle', { timeout: 10000 })
            .catch(() =>
                activePage
                    .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
                    .catch(() => {})
            );

        await activePage.waitForTimeout(1500);

        const amkaInput = activePage.locator('#CheckTEKAForm\\:CheckTEKA-criteria-AMKA_ID');
        await amkaInput.waitFor({ state: 'visible', timeout: timeoutMs });

        // // ✅ Καθάρισε και γράψε το ΑΜΚΑ
        // await amkaInput.click({ clickCount: 3 });
        // await amkaInput.press('Control+a');
        // await amkaInput.press('Delete');
        // await activePage.waitForTimeout(200);
        // await amkaInput.fill('');
        // await amkaInput.pressSequentially(String(opts.amka || ''), { delay: 60 });

        // const amkaVal = await amkaInput.inputValue().catch(() => '');

        await amkaInput.fill(String(opts.amka || ''));

        const amkaVal = await amkaInput.inputValue().catch(() => '');

        log('Step 5: AMKA filled:', amkaVal);

        // ✅ Κλικ "Έλεγχος Ένταξης στο ΤΕΚΑ"
        await activePage.click('#CheckTEKAForm\\:j_idt143');
        await activePage.waitForSelector('#ActionForm\\:ActionButtonsDown', {
            state: 'visible',
            timeout: timeoutMs
        });

        log('Step 5: Action panel appeared.');

        // =====================================================================
        // ΒΗΜΑ 6: Κλικ στο "Υποβολή Ελέγχου"
        // =====================================================================
        log('Step 6: Clicking "Υποβολή Ελέγχου"...');

        await activePage.click('#ActionForm\\:j_idt180');
        await activePage.waitForSelector('#ActionForm\\:ActionMessages', {
            state: 'visible',
            timeout: timeoutMs
        });

        log('Step 6: Result messages appeared.');

        // =====================================================================
        // ΒΗΜΑ 7: Διάβασε το αποτέλεσμα
        // =====================================================================
        log('Step 7: Reading result...');

        const messagesText = await activePage
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

        log('TEKA result:', { tekaYpagogi, tekaMessage, denYpagetai });

        await cleanup();

        return {
            success: true,
            tekaYpagogi,
            tekaMessage,
            fullText: messagesText.trim()
        };
    } catch (e) {
        err('checkTekaFromEfka failed:', e?.message || e);
        await cleanup();
        return {
            success: false,
            tekaYpagogi: false,
            tekaMessage: '',
            error: e?.message || String(e)
        };
    }
}

module.exports = { checkTekaFromEfka };
