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

// ============================================================================
// ✅ ΑΛΛΑΓΗ Α — Πίνακες αντιστοίχισης κωδικών ΕΡΓΑΝΗ
// ============================================================================

const ERGANH_PROCESS_CODES = {
    205: 'Δήλωση Απασχόλησης την Έκτη Ημέρα',
    173: 'E14: ΔΗΛΩΣΗ ΕΡΓΟΔΟΤΗ ΧΟΡΗΓΗΣΗΣ ΓΟΝΙΚΗΣ ΑΔΕΙΑΣ (Ν.4808/2021)',
    64: 'ΑΝΑΓΓΕΛΙΑ ΑΠΑΣΧΟΛΟΥΜΕΝΟΥ ΠΡΟΣΩΠΙΚΟΥ ΣΕ ΟΙΚΟΔΟΜΟΤΕΧΝΙΚΑ ΕΡΓΑ',
    65: 'ΑΠΟΓΡΑΦΙΚΗ ΑΝΑΓΓΕΛΙΑ ΑΠΑΣΧΟΛΟΥΜΕΝΟΥ ΠΡΟΣΩΠΙΚΟΥ ΣΕ ΟΙΚΟΔΟΜΟΤΕΧΝΙΚΑ ΕΡΓΑ',
    184: 'Δήλωση έναρξης/λήξης εργασίας εργαζόμενων',
    206: 'Δήλωση Εξαίρεσης από την Υποχρέωση Προαναγγελίας',
    34: 'E11 ΓΝΩΣΤΟΠΟΙΗΣΗ ΣΤΟΙΧΕΙΩΝ ΕΤΗΣΙΑΣ ΚΑΝΟΝΙΚΗΣ ΑΔΕΙΑΣ',
    57: 'E3.5: ΕΝΙΑΙΟ ΕΝΤΥΠΟ ΑΝΑΓΓΕΛΙΑΣ/ΜΕΤΑΒΟΛΩΝ ΠΡΑΚΤΙΚΗΣ ΑΣΚΗΣΗΣ ΣΠΟΥΔΑΣΤΩΝ/ΦΟΙΤΗΤΩΝ',
    // ── Οργάνωση Χρόνου Εργασίας (WTO) ──
    195: 'Οργάνωση Χρόνου Εργασίας - Άδειες',
    196: 'Οργάνωση Χρόνου Εργασίας - Άδειες ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ',
    182: 'Οργάνωση Χρόνου Εργασίας - Σταθερό Εβδομαδιαίο',
    183: 'Οργάνωση Χρόνου Εργασίας - Μεταβαλλόμενο/Τροποποιούμενο ανά Ημέρα',
    207: 'Οργάνωση Χρόνου Εργασίας - Μεταβαλλόμενο/Τροποποιούμενο ανά Ημέρα - Απολογιστικό',
    192: 'Οργάνωση Χρόνου Εργασίας - Μεταβαλλόμενο/Τροποποιούμενο ανά Ημέρα - Οδηγοί',
    232: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες',
    233: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Απολογιστικό',
    234: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Οδηγοί',
    // ── Ψηφιακή Αναγγελία ΕΝΑΡΞΗΣ Εργασίας ──
    213: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΕΝΑΡΞΗΣ ΕΡΓΑΣΙΑΣ - Πρόσληψη (E3N)',
    214: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΕΝΑΡΞΗΣ ΕΡΓΑΣΙΑΣ - Μεταβίβαση από Επιχείρηση',
    215: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΕΝΑΡΞΗΣ ΕΡΓΑΣΙΑΣ - Δανεισμός από επιχείρηση/Τοποθέτηση από ΕΠΑ',
    216: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΕΝΑΡΞΗΣ ΕΡΓΑΣΙΑΣ - Πρόσληψη για Δανεισμό (αφορά μόνο ΕΠΑ)',
    // ── Ψηφιακή Αναγγελία ΛΗΞΗΣ Εργασίας ──
    217: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση',
    218: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Δήλωση Όχλησης για δυνατότητα Οικειοθελούς Αποχώρησης',
    219: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση μετά από Όχληση',
    220: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης Χωρίς Προειδοποίηση',
    221: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης με Προειδοποίηση',
    222: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Λύση Σύμβασης Ορισμένου Χρόνου (E7N)',
    223: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Εθελούσια Έξοδος',
    224: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Οικειοθελή Αποχώρηση',
    225: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Καταγγελία Χωρίς Προειδοποίηση',
    226: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Λήξη λόγω Θανάτου',
    227: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Αυτοδίκαιη Λύση Δοκιμαστικής Περιόδου',
    228: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Μεταβίβαση σε Επιχείρηση',
    229: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Λήξη Δανεισμού από επιχείρηση/Τοποθέτησης από ΕΠΑ',
    236: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΛΗΞΗΣ ΕΡΓΑΣΙΑΣ - Οικειοθελής αποχώρηση λόγω 15ετίας / ορίου ηλικίας',
    // ── Μεταβολές ──
    230: 'ΨΗΦΙΑΚΗ ΔΗΛΩΣΗ ΜΕΤΑΒΟΛΗΣ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ',
    231: 'ΨΗΦΙΑΚΗ ΔΗΛΩΣΗ ΜΕΤΑΒΟΛΗΣ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ - Δανειζόμενου Προσωπικού'
};

const XML_TYPE_TO_PROCESS_CODE = {
    e3n: '213',
    e3n_metavivasi: '214',
    e3n_daneismos_epa: '215',
    e3n_proslipsi_daneismos_epa: '216',
    ma_metaboles: '230',
    ma_metaboles_daneizomenos: '231',
    ma_217: '217',
    ma_218: '218',
    ma_219: '219',
    ma_220: '220',
    ma_221: '221',
    ma_222: '222',
    ma_223: '223',
    ma_224: '224',
    ma_225: '225',
    ma_226: '226',
    ma_227: '227',
    ma_228: '228',
    ma_229: '229',
    ma_236: '236',
    wto_stable: '182',
    wto_variable: '183',
    wto_variable_apologistiko: '207',
    wto_variable_odigos: '192',
    wto_adeies: '195',
    wto_adeies_orth: '196',
    wto_yperaories: '232',
    wto_yperaories_apologistiko: '233',
    wto_yperaories_odigos: '234'
};

// ============================================================================
// ✅ Reverse map: symbolic key name → αριθμός ΕΡΓΑΝΗ
// ============================================================================
const ERGANH_PROCESS_CODES_REVERSE = {
    e3_anaggelia_proslhpshs: '213',
    e3_anaggelia_proslhpshs_metavivasi: '214',
    e3_anaggelia_proslhpshs_daneismos_epa: '215',
    e3_anaggelia_proslhpshs_daneizomenoy_prosopikoy: '216',
    e3_metaboles_ergasiakhs_sxeshs: '230',
    e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy: '231',
    ma_217: '217',
    ma_218: '218',
    ma_219: '219',
    ma_220: '220',
    ma_221: '221',
    ma_222: '222',
    ma_223: '223',
    ma_224: '224',
    ma_225: '225',
    ma_226: '226',
    ma_227: '227',
    ma_228: '228',
    ma_229: '229',
    ma_236: '236',
    wto_pshfiakh_organosh_xronoy_ergasias: '182',
    wto_stable: '182',
    wto_variable: '183',
    wto_variable_apologistiko: '207',
    wto_variable_odigos: '192',
    wto_adeies: '195',
    wto_adeies_orth: '196',
    wto_yperaories: '232',
    wto_yperaories_apologistiko: '233',
    wto_yperaories_odigos: '234'
};

// ============================================================================
// ✅ resolveProcessCode — symbolic key OR αριθμός → αριθμός ΕΡΓΑΝΗ
// ============================================================================
function resolveProcessCode(code) {
    if (!code) return null;
    const s = String(code).trim();
    if (/^\d+$/.test(s)) {
        if (!ERGANH_PROCESS_CODES[s] && !ERGANH_PROCESS_CODES[Number(s)]) {
            console.warn(`[resolveProcessCode] ⚠️ Numeric code '${s}' not in ERGANH_PROCESS_CODES`);
        }
        return s;
    }
    const resolved = ERGANH_PROCESS_CODES_REVERSE[s];
    if (!resolved) {
        console.warn(
            `[resolveProcessCode] ⚠️ Unknown key: '${s}'. ` +
                `Valid keys: ${Object.keys(ERGANH_PROCESS_CODES_REVERSE).join(', ')}`
        );
        return null;
    }
    return resolved;
}

const TIMEOUTS = {
    short: 5000,
    medium: 12000,
    long: 20000,
    nav: 25000,
    modalAppear: 20000,
    modalSettle: 5000,
    modalClose: 5000
};

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
    return String(s || '')
        .replace(/\r/g, '')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
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

// ============================================================================
// ✅ FIX: classifyModalText — exact match + partial match για native dialogs
// ============================================================================
function classifyModalText(text) {
    const normalized = normalizeForExactCompare(text);
    // Exact match (DOM modal)
    if (normalized === SUCCESS_MODAL_TEXT_EXACT) return { ok: true };
    // Partial match (native dialog — συντομότερο κείμενο)
    if (
        normalized.includes('διαβάστηκε με επιτυχία') ||
        normalized.includes('Αναγγελίες βρίσκονται πλέον') ||
        normalized.includes("κατάσταση υποβολής 'Προσωρινή'") ||
        normalized.includes('επιτυχώς')
    ) {
        return { ok: true };
    }
    return { ok: false };
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

async function uploadXml(page, xmlPath, creds, options = {}) {
    // ============================================================================
    // ✅ Βήμα 1: Resolve processCode
    // ============================================================================
    const rawProcessCode = options?.processCode ? String(options.processCode) : null;
    let processCode = rawProcessCode ? resolveProcessCode(rawProcessCode) : null;

    if (!processCode && options?.xmlType) {
        processCode = XML_TYPE_TO_PROCESS_CODE[options.xmlType] || null;
        if (!processCode) {
            throw new Error(
                `[e3Uploader] Άγνωστο xmlType: "${options.xmlType}". ` +
                    `Έγκυρες τιμές: ${Object.keys(XML_TYPE_TO_PROCESS_CODE).join(', ')}`
            );
        }
    }

    if (!processCode) {
        throw new Error(
            '[e3Uploader] Απαιτείται options.processCode ή options.xmlType. ' +
                `Έγκυρα xmlTypes: ${Object.keys(XML_TYPE_TO_PROCESS_CODE).join(', ')}`
        );
    }

    const processLabel =
        ERGANH_PROCESS_CODES[processCode] ||
        ERGANH_PROCESS_CODES[Number(processCode)] ||
        '(άγνωστη διαδικασία)';

    log('[uploadXml] Parameters:', {
        xmlPath: xmlPath ? path.basename(xmlPath) : 'MISSING',
        hasCreds: !!(creds?.username && creds?.password),
        xmlType: options?.xmlType || 'NOT SET',
        rawProcessCode,
        processCode,
        processLabel,
        isPermanent: options?.isPermanent ?? false
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

    log(`   Επιλογή διαδικασίας: [${processCode}] ${processLabel}`);

    let selected = false;
    try {
        await dropdown.selectOption({ value: processCode });
        selected = true;
    } catch {}
    if (!selected) {
        try {
            await dropdown.selectOption(processCode);
            selected = true;
        } catch {}
    }
    if (!selected) {
        const shot = await snap(page, 'process-select-failed');
        throw new Error(
            `Αδυναμία επιλογής διαδικασίας [${processCode}] "${processLabel}". ` +
                `Screenshot: ${shot || 'N/A'}`
        );
    }

    await page.waitForTimeout(250).catch(() => {});
    await fileInput.waitFor({ state: 'visible', timeout: TIMEOUTS.long });

    // ============================================================================
    // ✅ FIX: Άκουσε για native dialog ΠΡΙΝ το setInputFiles
    //         (το ΕΡΓΑΝΗ εμφανίζει confirmation dialog κατά το upload)
    // ============================================================================
    const fileDialogPromise = page
        .waitForEvent('dialog', { timeout: TIMEOUTS.short })
        .then(async (d) => {
            dbg('Dialog:', d.message());
            await d.accept();
        })
        .catch(() => {});

    await fileInput.setInputFiles(xmlPath);
    await fileDialogPromise;

    // ============================================================================
    // Checkbox Προσωρινή / Οριστική
    // ============================================================================
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
                log('⏸  Unchecking "ΥΠΟΒΟΛΗ ΜΕΤΑ ΤΗΝ ΚΑΤΑΧΩΡΗΣΗ" (Προσωρινή mode)');
                await submissionCheckbox.uncheck({ timeout: TIMEOUTS.short });
                await page.waitForTimeout(300);
            } else {
                log(
                    `ℹ️  Checkbox already in correct state: ${isChecked ? 'checked' : 'unchecked'}`
                );
            }
        } catch (checkboxError) {
            warn('Failed to toggle submission checkbox:', checkboxError.message);
        }
    } else {
        warn('Submission checkbox not found on page (may not exist for this ERGANH version)');
    }

    await page.waitForTimeout(150).catch(() => {});
    await submitBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.long });

    // ============================================================================
    // ✅ FIX: Άκουσε για native dialog ΜΕΤΑ το submit
    //         το ΕΡΓΑΝΗ μπορεί να εμφανίσει το αποτέλεσμα ως native alert
    // ============================================================================
    let nativeDialogText = null;
    const submitDialogPromise = page
        .waitForEvent('dialog', { timeout: TIMEOUTS.modalAppear })
        .then(async (d) => {
            nativeDialogText = d.message();
            dbg('Submit result dialog:', nativeDialogText);
            await d.accept();
            return nativeDialogText;
        })
        .catch(() => null);

    // Ξεκίνα DOM modal listener παράλληλα
    const modalPromise = captureModalTextAndClose(page);

    await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav }).catch(() => {}),
        submitBtn.click({ timeout: TIMEOUTS.medium })
    ]);

    // Περίμενε και τα δύο
    await submitDialogPromise;
    const { text: modalText } = await modalPromise;

    // ✅ Χρησιμοποίησε native dialog αν δεν υπάρχει DOM modal
    const finalText = modalText || nativeDialogText || '';

    log('📄 Result text:', finalText || '(empty)');

    if (!finalText) {
        const debugShot = await snap(page, 'after-submit-no-modal');
        log('⚠️ No modal/dialog captured. Screenshot:', debugShot);

        // Fallback: inline success check
        const inlineSuccess = await page
            .evaluate(() => {
                const keywords = [
                    'διαβάστηκε με επιτυχία',
                    'Αναγγελίες βρίσκονται πλέον',
                    'Προσωρινή',
                    'επιτυχώς',
                    'υποβλήθηκε'
                ];
                const bodyText = document.body?.innerText || '';
                return keywords.some((k) => bodyText.includes(k)) ? bodyText : '';
            })
            .catch(() => '');

        if (inlineSuccess) {
            log('✅ Inline success message detected');
            return [
                'Ειδοποίηση',
                'Το αρχείο διαβάστηκε με επιτυχία. Οι Αναγγελίες βρίσκονται πλέον',
                "καταχωρημένες σε κατάσταση υποβολής 'Προσωρινή' και μπορείτε να τις",
                'βρείτε στην Αναζήτηση Αναγγελιών για να τις υποβάλετε εξατομικευμένα.'
            ].join('\n');
        }

        const pageErr = await captureFallbackPageErrorText(page);
        if (pageErr) {
            log('📄 Fallback page error:', pageErr);
            return pageErr;
        }

        // Τελευταία επιλογή: full body για diagnosis
        const fullBody = await page
            .evaluate(() => document.body?.innerText?.substring(0, 500) || '')
            .catch(() => '');
        log('📄 Page body (first 500 chars):', fullBody);
    }

    return finalText;
}

// ------------------------------ MAIN EXPORT ---------------------------------
async function runOnce(companyId, xmlPath, userId, creds, options = {}) {
    let session = null;
    let page = null;

    try {
        log('Getting or creating session...', { companyId });
        log('Options received:', options);

        session = await sessionManager.getOrCreateSession(companyId, creds);
        page = session.page;

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
        log('Upload completed (session kept open for next use)');
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
            return await runOnce(companyId, xmlPath, userId, creds, options);
        } finally {
            inflightByCompany.delete(key);
        }
    })();

    inflightByCompany.set(key, p);
    return await p;
}

module.exports = {
    uploadE3ToErganh,
    ERGANH_PROCESS_CODES,
    XML_TYPE_TO_PROCESS_CODE,
    ERGANH_PROCESS_CODES_REVERSE,
    resolveProcessCode
};
