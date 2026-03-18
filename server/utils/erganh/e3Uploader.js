// e3Uploader.js
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { chromium } = require('playwright');
const sessionManager = require('./sessionManager');

const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'true';
const HEADLESS = !DEBUG;

const LOGIN_URL = 'https://eservices.yeka.gr/login.aspx';
const UPLOAD_URL = 'https://eservices.yeka.gr/Anaggelies/AnaggeliesXML.aspx';

const TIMEOUTS = {
    short: 5000,
    medium: 12000,
    long: 20000,
    nav: 25000,
    modalAppear: 20000,

    modalSettle: 5000, // ✅ NEW: wait 5s for modal body to populate
    modalClose: 5000
};

// Login inputs (fallbacks)
const SEL_LOGIN_USERNAME_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName',
    'input[type="text"][name*="UserName"]',
    'input[type="text"][id*="UserName"]',
    'input[type="text"][name*="Username"]',
    'input[type="text"][id*="Username"]'
].join(', ');

const SEL_LOGIN_PASSWORD_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password',
    'input[type="password"][name*="Password"]',
    'input[type="password"][id*="Password"]'
].join(', ');

const SEL_LOGIN_SUBMIT_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Login',
    'input[type="submit"][value="Είσοδος"]',
    'button:has-text("Είσοδος")',
    'button[type="submit"]',
    'input[type="submit"]'
].join(', ');

// Upload page selectors
const SEL_UPLOAD_PROCESS_SELECT_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_SKYpobolesList',
    'select[id*="SKYpobolesList"]',
    'select[id*="poboles"]',
    'select[name*="SKYpobolesList"]',
    'select[name*="poboles"]',
    'select'
].join(', ');

const SEL_UPLOAD_FILE_INPUT_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_XMLFileUploader',
    'input[type="file"][id*="XMLFileUploader"]',
    'input[type="file"][name*="XMLFileUploader"]',
    'input[type="file"][id*="XML"]',
    'input[type="file"][name*="XML"]',
    'input[type="file"]'
].join(', ');

const SEL_UPLOAD_SUBMIT_ANY = [
    '#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_UploadFileButton',
    'input[type="submit"][id*="UploadFileButton"]',
    'input[type="button"][id*="UploadFileButton"]',
    'button[id*="UploadFileButton"]',
    'button:has-text("Ενημέρωση")',
    'input[type="submit"][value="Ενημέρωση"]',
    'input[type="button"][value="Ενημέρωση"]'
].join(', ');

// Modal OK
const SEL_MODAL_OK_ANY = [
    '.swal2-confirm',
    'button:has-text("OK")',
    'button:has-text("ΟΚ")',
    'button:has-text("Ok")',
    'button:has-text("ok")',
    'button:has-text("Οκ")',
    'button:has-text("οκ")',
    'input[type="button"][value="OK"]',
    'input[type="submit"][value="OK"]',
    'input[type="button"][value="ΟΚ"]',
    'input[type="submit"][value="ΟΚ"]'
].join(', ');

function log(...a) {
    console.log('[ERGANH]', ...a);
}
function warn(...a) {
    console.warn('[ERGANH][WARN]', ...a);
}
function dbg(...a) {
    if (DEBUG) console.log('[ERGANH][DEBUG]', ...a);
}

function cleanText(s) {
    return String(s || '')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeForExactCompare(s) {
    return (
        String(s || '')
            .replace(/\r/g, '')
            .replace(/[’‘]/g, "'")
            .replace(/[“”]/g, '"')
            // ✅ collapse ALL whitespace (spaces, tabs, newlines) to single spaces
            .replace(/\s+/g, ' ')
            .trim()
    );
}

const SUCCESS_MODAL_TEXT_EXACT = normalizeForExactCompare(
    [
        'Ειδοποίηση',
        'Το αρχείο διαβάστηκε με επιτυχία. Οι Αναγγελίες βρίσκονται πλέον',
        "καταχωρημένες σε κατάσταση υποβολής 'Προσωρινή' και μπορείτε να τις",
        'βρείτε στην Αναζήτηση Αναγγελιών για να τις υποβάλετε εξατομικευμένα.'
    ].join('\n')
);

async function ensureScreensDir() {
    await fs.ensureDir(path.join(process.cwd(), 'screenshots'));
}

async function snap(page, label) {
    try {
        await ensureScreensDir();
        const p = path.join(process.cwd(), 'screenshots', `${Date.now()}-${label}.png`);
        await page.screenshot({ path: p, fullPage: true });
        warn('[SCREENSHOT]', p);
        return p;
    } catch {
        return null;
    }
}

async function firstVisible(page, selector) {
    const loc = page.locator(selector);
    const c = await loc.count().catch(() => 0);
    for (let i = 0; i < c; i++) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) return el;
    }
    return null;
}

async function isOnLoginForm(page) {
    const u = await page
        .locator(SEL_LOGIN_USERNAME_ANY)
        .count()
        .catch(() => 0);
    const p = await page
        .locator(SEL_LOGIN_PASSWORD_ANY)
        .count()
        .catch(() => 0);
    return !!(u && p);
}

async function isOnUploadPage(page) {
    const dd = await page
        .locator(SEL_UPLOAD_PROCESS_SELECT_ANY)
        .count()
        .catch(() => 0);
    const fi = await page
        .locator(SEL_UPLOAD_FILE_INPUT_ANY)
        .count()
        .catch(() => 0);
    return !!(dd && fi);
}

function classifyModalText(text) {
    const normalized = normalizeForExactCompare(text);
    return { ok: normalized === SUCCESS_MODAL_TEXT_EXACT };
}

async function waitForOptionsOnSelect(selectLocator, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const optCount = await selectLocator
                .locator('option')
                .count()
                .catch(() => 0);
            if (optCount >= 2) return true;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
    }
    return false;
}

async function doLogin(page, creds) {
    const username = creds?.username;
    const password = creds?.password;
    if (!username || !password) throw new Error('Missing ERGANH credentials');

    log('Goto login...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav });

    const user = await firstVisible(page, SEL_LOGIN_USERNAME_ANY);
    const pass = await firstVisible(page, SEL_LOGIN_PASSWORD_ANY);
    const submit = await firstVisible(page, SEL_LOGIN_SUBMIT_ANY);

    if (!user || !pass || !submit) {
        const shot = await snap(page, 'login-missing-fields');
        throw new Error(`Login fields not found. Screenshot: ${shot || 'N/A'}`);
    }

    await user.fill(username).catch(() => {});
    await pass.fill(password).catch(() => {});

    for (let i = 0; i < 3; i++) {
        const uVal = await user.inputValue().catch(() => '');
        const pVal = await pass.inputValue().catch(() => '');
        if (uVal && pVal) break;
        await user.fill(username).catch(() => {});
        await pass.fill(password).catch(() => {});
        await page.waitForTimeout(150).catch(() => {});
    }

    log('Submit login...');
    await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav }).catch(() => {}),
        submit.click({ timeout: TIMEOUTS.medium })
    ]);

    await page.waitForTimeout(400).catch(() => {});
}

async function ensureOnUploadPage(page, creds) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.goto(UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav });
        await page.waitForTimeout(200).catch(() => {});

        if (await isOnLoginForm(page)) {
            log('Redirected to login, logging in...');
            await doLogin(page, creds);
            continue;
        }

        const dd = page.locator(SEL_UPLOAD_PROCESS_SELECT_ANY).first();
        const fi = page.locator(SEL_UPLOAD_FILE_INPUT_ANY).first();

        await dd.waitFor({ state: 'visible', timeout: TIMEOUTS.long }).catch(() => {});
        await fi.waitFor({ state: 'visible', timeout: TIMEOUTS.long }).catch(() => {});

        if (await isOnUploadPage(page)) {
            await waitForOptionsOnSelect(dd, TIMEOUTS.long);
            log('On upload page (ready).');
            return;
        }

        await page.waitForTimeout(700).catch(() => {});
        if (await isOnUploadPage(page)) {
            await waitForOptionsOnSelect(dd, TIMEOUTS.long);
            log('On upload page (after short wait).');
            return;
        }
    }

    const shot = await snap(page, 'upload-page-not-reachable');
    throw new Error(`Login/Upload page not reachable. Screenshot: ${shot || 'N/A'}`);
}

// ✅ fallback text when no modal: try to find likely error snippets on the page
async function captureFallbackPageErrorText(page) {
    try {
        const t = cleanText(
            await page.evaluate(() => {
                const keywords = [
                    'Σφάλμα',
                    'Σφάλματα',
                    'Η υποβολή απέτυχε',
                    'Απέτυχε',
                    'Για το ΑΦΜ',
                    'Για τον ΑΦΜ',
                    'Ημερομηνία',
                    'δεν συμφων'
                ];

                const bodyText = document.body?.innerText || '';
                const lines = bodyText
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);

                const hits = [];
                for (const line of lines) {
                    if (keywords.some((k) => line.includes(k))) hits.push(line);
                    if (hits.length >= 12) break;
                }
                return hits.join('\n');
            })
        );

        return t;
    } catch {
        return '';
    }
}

/**
 * Robust modal capture:
 * - Waits for ANY dialog/swal2 or keyword presence
 * - ✅ NEW: waits extra 5s for modal content to fully populate
 * - Extracts text from dialog while filtering noise ("x", "Επιλογή", "OK")
 */
async function captureModalTextAndClose(page) {
    // 1) Wait for a VISIBLE OK button (this is modal-specific and won't match <option>)
    const okBtn = await (async () => {
        const loc = page.locator(SEL_MODAL_OK_ANY);
        const start = Date.now();
        while (Date.now() - start < TIMEOUTS.modalAppear) {
            const c = await loc.count().catch(() => 0);
            for (let i = 0; i < c; i++) {
                const el = loc.nth(i);
                if (await el.isVisible().catch(() => false)) return el;
            }
            await page.waitForTimeout(150).catch(() => {});
        }
        return null;
    })();

    if (!okBtn) return { text: '' };

    // 2) Find the container that actually holds the dialog text.
    // We climb ancestors until we find a "big" text block (heuristic).
    let container = okBtn.locator('xpath=ancestor::div[1]').first();

    for (let level = 1; level <= 14; level++) {
        const anc = okBtn.locator(`xpath=ancestor::div[${level}]`).first();
        const ancText = await anc.innerText().catch(() => '');
        const t = cleanText(ancText);

        // Heuristic: modal text in your screenshot is definitely > 40 chars
        // and contains either "Ειδοποίηση" or "Σφάλματα" or "xsd" or "Για το ΑΦΜ"
        const low = t.toLowerCase();
        const looksLikeModal =
            t.length > 40 &&
            (t.includes('Ειδοποίηση') ||
                t.includes('Σφάλματα') ||
                low.includes('xsd') ||
                t.includes('Για το ΑΦΜ') ||
                t.includes('Για τον ΑΦΜ') ||
                low.includes('pattern constraint'));

        if (looksLikeModal) {
            container = anc;
            break;
        }
    }

    // 3) Read text, and clean obvious noise
    let text = cleanText(await container.innerText().catch(() => ''));

    // remove isolated noise lines
    text = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .filter(
            (l) => !['x', 'X', 'OK', 'Ok', 'ok', 'ΟΚ', 'Οκ', 'οκ', 'Επιλογή', 'επιλογή'].includes(l)
        )
        .join('\n');

    // 4) Click OK fast (closing modal in <= ~1s)
    await okBtn.click({ timeout: 1000, force: true }).catch(() => {});
    await page.waitForTimeout(150).catch(() => {});

    return { text };
}

async function uploadXml(page, xmlPath, creds, options = {}) {
    // ✅ DEBUG: Log received parameters
    log('[uploadXml] Parameters:', {
        xmlPath: xmlPath ? path.basename(xmlPath) : 'MISSING',
        hasCreds: !!(creds?.username && creds?.password),
        options: options || 'UNDEFINED'
    });

    await ensureOnUploadPage(page, creds);

    if (!xmlPath) throw new Error('Missing xmlPath');
    if (!(await fs.pathExists(xmlPath))) throw new Error(`File not found: ${xmlPath}`);

    const dropdown = page.locator(SEL_UPLOAD_PROCESS_SELECT_ANY).first();
    const fileInput = page.locator(SEL_UPLOAD_FILE_INPUT_ANY).first();
    const submitBtn = page.locator(SEL_UPLOAD_SUBMIT_ANY).first();
    const submissionCheckbox = page
        .locator('#ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_SubmitBox')
        .first();

    if (!(await dropdown.count().catch(() => 0))) {
        const shot = await snap(page, 'process-dropdown-not-found');
        throw new Error(`Process dropdown not found. Screenshot: ${shot || 'N/A'}`);
    }
    if (!(await fileInput.count().catch(() => 0))) {
        const shot = await snap(page, 'fileInput-not-found');
        throw new Error(`File input not found. Screenshot: ${shot || 'N/A'}`);
    }
    if (!(await submitBtn.count().catch(() => 0))) {
        const shot = await snap(page, 'submit-not-found');
        throw new Error(`Submit button not found. Screenshot: ${shot || 'N/A'}`);
    }

    await dropdown.waitFor({ state: 'visible', timeout: TIMEOUTS.long });
    await waitForOptionsOnSelect(dropdown, TIMEOUTS.long);

    let selected = false;
    try {
        await dropdown.selectOption({ value: '213' });
        selected = true;
    } catch {}
    if (!selected) {
        try {
            await dropdown.selectOption('213');
            selected = true;
        } catch {}
    }
    if (!selected) {
        const shot = await snap(page, 'process-select-failed');
        throw new Error(`Could not select process 213. Screenshot: ${shot || 'N/A'}`);
    }

    await page.waitForTimeout(250).catch(() => {});
    await fileInput.waitFor({ state: 'visible', timeout: TIMEOUTS.long });

    const dialogPromise = page
        .waitForEvent('dialog', { timeout: TIMEOUTS.short })
        .then(async (d) => {
            dbg('Dialog:', d.message());
            await d.accept();
        })
        .catch(() => {});

    await fileInput.setInputFiles(xmlPath);
    await dialogPromise;

    // =====================================================================
    // ✅ CHECK/UNCHECK SUBMISSION CHECKBOX BASED ON OPTIONS
    // =====================================================================
    const isPermanent = options?.isPermanent === true;
    log(`   Submission mode: ${isPermanent ? 'Οριστική' : 'Προσωρινή'}`);

    if (await submissionCheckbox.count().catch(() => 0)) {
        try {
            const isChecked = await submissionCheckbox.isChecked().catch(() => false);

            if (isPermanent && !isChecked) {
                log('✅ Checking "ΥΠΟΒΟΛΗ ΜΕΤΑ ΤΗΝ ΚΑΤΑΧΩΡΗΣΗ" (Οριστική mode)');
                await submissionCheckbox.check({ timeout: TIMEOUTS.short });
                await page.waitForTimeout(300);
            } else if (!isPermanent && isChecked) {
                log('⏸️  Unchecking "ΥΠΟΒΟΛΗ ΜΕΤΑ ΤΗΝ ΚΑΤΑΧΩΡΗΣΗ" (Προσωρινή mode)');
                await submissionCheckbox.uncheck({ timeout: TIMEOUTS.short });
                await page.waitForTimeout(300);
            } else {
                log(
                    `ℹ️  Checkbox already in correct state: ${isChecked ? 'checked' : 'unchecked'}`
                );
            }
        } catch (checkboxError) {
            warn('Failed to toggle submission checkbox:', checkboxError.message);
            // Non-fatal - continue with upload
        }
    } else {
        warn('Submission checkbox not found on page (may not exist for this ERGANH version)');
    }

    await page.waitForTimeout(150).catch(() => {});
    await submitBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.long });

    const modalPromise = captureModalTextAndClose(page);

    await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav }).catch(() => {}),
        submitBtn.click({ timeout: TIMEOUTS.medium })
    ]);

    const { text: modalText } = await modalPromise;

    if (!modalText) {
        const pageErr = await captureFallbackPageErrorText(page);
        if (pageErr) return pageErr;
    }

    return modalText || '';
}

// ------------------------------ MAIN EXPORT ---------------------------------
async function runOnce(companyId, xmlPath, userId, creds, options = {}) {
    let session = null;
    let page = null;

    try {
        log('Getting or creating session...', { companyId });
        // ✅ Log options for debugging
        log('Options received:', options);

        session = await sessionManager.getOrCreateSession(companyId, creds);
        page = session.page;

        // ✅ Pass options (isPermanent) to uploadXml
        const modalText = cleanText(await uploadXml(page, xmlPath, creds, options));

        if (!modalText) {
            const fallback = `Δεν ελήφθη απάντηση από το ΕΡΓΑΝΗ μέσα σε ${Math.round(
                TIMEOUTS.modalAppear / 1000
            )} δευτερόλεπτα.\n\nΗ υποβολή απέτυχε ή δεν εμφανίστηκε modal.`;
            const shot = await snap(page, 'no-modal');
            return {
                success: false,
                protocol: null,
                userMessage: 'Η υποβολή απέτυχε.',
                errorDetails: fallback,
                error: fallback,
                messages: [],
                screenshot: shot
            };
        }

        const verdict = classifyModalText(modalText);

        if (verdict.ok) {
            return {
                success: true,
                protocol: null,
                userMessage: 'Επιτυχής Αποθήκευση (Προσωρινή)',
                errorDetails: modalText,
                messages: [],
                screenshot: null
            };
        }

        return {
            success: false,
            protocol: null,
            userMessage: 'Η υποβολή απέτυχε.',
            errorDetails: modalText,
            error: modalText,
            messages: [],
            screenshot: null
        };
    } catch (e) {
        const msg = String(e?.message || e);
        warn('Run failed:', msg);
        const shot = page && !page.isClosed() ? await snap(page, 'final-fail') : null;
        return {
            success: false,
            protocol: null,
            userMessage: 'Αποτυχία επικοινωνίας με το ΕΡΓΑΝΗ. Δοκιμάστε ξανά.',
            errorDetails: msg,
            error: msg,
            messages: [],
            screenshot: shot
        };
    } finally {
        log('E3 upload completed (session kept open for WTO)');
    }
}

const inflightByCompany = new Map();

async function uploadE3ToErganh(companyId, xmlPath, userId = null, creds = null, options = {}) {
    const key = String(companyId ?? 'default');
    if (inflightByCompany.has(key)) {
        warn('Upload already inflight for company:', key);
        return await inflightByCompany.get(key);
    }

    const p = (async () => {
        try {
            // ✅ Pass options (isPermanent) to runOnce
            return await runOnce(companyId, xmlPath, userId, creds, options);
        } finally {
            inflightByCompany.delete(key);
        }
    })();

    inflightByCompany.set(key, p);
    return await p;
}

module.exports = { uploadE3ToErganh };
