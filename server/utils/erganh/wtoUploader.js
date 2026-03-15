// server/utils/erganh/wtoUploader.js
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { chromium } = require('playwright');
const sessionManager = require('./sessionManager');

const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'true';
const HEADLESS = !DEBUG;

const LOGIN_URL = 'https://eservices.yeka.gr/login.aspx';
const UPLOAD_URL = 'https://eservices.yeka.gr/Anaggelies/AnaggeliesXML.aspx'; // ✅ SAME AS E3 (WTO uses same page)

const TIMEOUTS = {
    short: 5000,
    medium: 12000,
    long: 20000,
    nav: 25000,
    modalAppear: 20000,
    modalSettle: 5000,
    modalClose: 5000
};

// Login inputs (same as E3)
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

// Upload page selectors (same as E3)
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
    console.log('[WTO-ERGANH]', ...a);
}
function warn(...a) {
    console.warn('[WTO-ERGANH][WARN]', ...a);
}
function dbg(...a) {
    if (DEBUG) console.log('[WTO-ERGANH][DEBUG]', ...a);
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
    return String(s || '')
        .replace(/\r/g, '')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

// ✅ WTO Success modal text (same pattern as E3)
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
        const p = path.join(process.cwd(), 'screenshots', `${Date.now()}-wto-${label}.png`);
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

async function captureModalTextAndClose(page) {
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

    let container = okBtn.locator('xpath=ancestor::div[1]').first();

    for (let level = 1; level <= 14; level++) {
        const anc = okBtn.locator(`xpath=ancestor::div[${level}]`).first();
        const ancText = await anc.innerText().catch(() => '');
        const t = cleanText(ancText);

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

    let text = cleanText(await container.innerText().catch(() => ''));

    text = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .filter(
            (l) => !['x', 'X', 'OK', 'Ok', 'ok', 'ΟΚ', 'Οκ', 'οκ', 'Επιλογή', 'επιλογή'].includes(l)
        )
        .join('\n');

    await okBtn.click({ timeout: 1000, force: true }).catch(() => {});
    await page.waitForTimeout(150).catch(() => {});

    return { text };
}

async function uploadXml(page, xmlPath, creds) {
    await ensureOnUploadPage(page, creds);

    if (!xmlPath) throw new Error('Missing xmlPath');
    if (!(await fs.pathExists(xmlPath))) throw new Error(`File not found: ${xmlPath}`);

    const dropdown = page.locator(SEL_UPLOAD_PROCESS_SELECT_ANY).first();
    const fileInput = page.locator(SEL_UPLOAD_FILE_INPUT_ANY).first();
    const submitBtn = page.locator(SEL_UPLOAD_SUBMIT_ANY).first();

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

    // ✅ WTO PROCESS CODE
    let selected = false;
    const WTO_PROCESS_CODE = '182';

    try {
        await dropdown.selectOption({ value: WTO_PROCESS_CODE });
        selected = true;
    } catch {}
    if (!selected) {
        try {
            await dropdown.selectOption(WTO_PROCESS_CODE);
            selected = true;
        } catch {}
    }
    if (!selected) {
        const shot = await snap(page, 'wto-process-select-failed');
        throw new Error(
            `Could not select WTO process ${WTO_PROCESS_CODE}. Screenshot: ${shot || 'N/A'}`
        );
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

async function runOnce(companyId, xmlPath, userId, creds) {
    let session = null;
    let page = null;

    try {
        log('Getting or creating session (WTO will reuse E3 session)...', { companyId });

        // ✅ Get shared session (reuses E3 browser session!)
        session = await sessionManager.getOrCreateSession(companyId, creds);
        page = session.page;

        const modalText = cleanText(await uploadXml(page, xmlPath, creds));

        log('[WTO MODAL TEXT]', JSON.stringify(modalText));
        log('[WTO MODAL OK?]', normalizeForExactCompare(modalText) === SUCCESS_MODAL_TEXT_EXACT);

        if (!modalText) {
            const fallback = `Δεν ελήφθη απάντηση από το ΕΡΓΑΝΗ μέσα σε ${Math.round(
                TIMEOUTS.modalAppear / 1000
            )} δευτερόλεπτα.\n\nΗ υποβολή WTO απέτυχε ή δεν εμφανίστηκε modal.`;
            const shot = await snap(page, 'no-modal');
            return {
                success: false,
                protocol: null,
                userMessage: 'Η υποβολή WTO απέτυχε.',
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
                userMessage: 'Επιτυχής Αποθήκευση WTO (Προσωρινή)',
                errorDetails: modalText,
                messages: [],
                screenshot: null
            };
        }

        return {
            success: false,
            protocol: null,
            userMessage: 'Η υποβολή WTO απέτυχε.',
            errorDetails: modalText,
            error: modalText,
            messages: [],
            screenshot: null
        };
    } catch (e) {
        const msg = String(e?.message || e);
        warn('WTO Run failed:', msg);
        const shot = page && !page.isClosed() ? await snap(page, 'final-fail') : null;
        return {
            success: false,
            protocol: null,
            userMessage: 'Αποτυχία επικοινωνίας με το ΕΡΓΑΝΗ (WTO). Δοκιμάστε ξανά.',
            errorDetails: msg,
            error: msg,
            messages: [],
            screenshot: shot
        };
    } finally {
        log('WTO upload completed (session will be closed by caller)');
    }
}

const inflightByCompany = new Map();

async function uploadWtoToErganh(companyId, xmlPath, userId = null, creds = null) {
    const key = `wto_${String(companyId ?? 'default')}`;
    if (inflightByCompany.has(key)) {
        warn('WTO Upload already inflight for company:', key);
        return await inflightByCompany.get(key);
    }

    const p = (async () => {
        try {
            return await runOnce(companyId, xmlPath, userId, creds);
        } finally {
            inflightByCompany.delete(key);

            // ✅ CLOSE SESSION HERE (after WTO upload completes)
            // This is the LAST upload, so we clean up the shared session
            log('WTO upload finished, closing shared session...');
            await sessionManager.closeSession(companyId).catch((e) => {
                warn('Failed to close session:', e.message);
            });
        }
    })();

    inflightByCompany.set(key, p);
    return await p;
}

module.exports = { uploadWtoToErganh };
