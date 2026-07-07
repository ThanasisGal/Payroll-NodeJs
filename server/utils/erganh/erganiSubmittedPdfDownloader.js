'use strict';

const path = require('path');
const fs = require('fs-extra');
const { chromium } = require('playwright');

const UI_BASE_URLS = {
    trial: 'https://trialv2eservices.yeka.gr/WebServicesAPIui',
    production: 'https://eservices.yeka.gr/WebServicesAPIui'
};

function getErganiEnv() {
    return String(process.env.ERGANI_ENV || 'trial')
        .trim()
        .toLowerCase();
}

function getUiBaseUrl() {
    const env = getErganiEnv();
    return UI_BASE_URLS[env] || UI_BASE_URLS.trial;
}

function safeJsonParse(text) {
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

function onlyDate(value) {
    return (
        String(value || '')
            .trim()
            .split(/\s+/)[0] || ''
    );
}

function formatDateDdMmYyyy(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return [
        String(d.getDate()).padStart(2, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        d.getFullYear()
    ].join('/');
}

function formatDateDdMmYyyyHhMm(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return `${formatDateDdMmYyyy(d)} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
    ).padStart(2, '0')}`;
}

function buildSubmittedDateCandidates(submittedDate) {
    const candidates = [];
    const add = (value) => {
        const normalized = String(value || '').trim();
        if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    };

    if (submittedDate instanceof Date) {
        add(formatDateDdMmYyyy(submittedDate));
        add(formatDateDdMmYyyyHhMm(submittedDate));
        return candidates;
    }

    const raw = String(submittedDate || '').trim();
    add(onlyDate(raw));
    add(raw);

    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(raw)) {
        add(`${raw}:00`);
    }

    return candidates;
}

function isPdfBuffer(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString() === '%PDF-'
    );
}

function base64ToPdfBuffer(value) {
    if (typeof value !== 'string') return null;
    let s = value.trim();
    if (!s) return null;

    const dataUriPrefix = 'data:application/pdf;base64,';
    if (s.toLowerCase().startsWith(dataUriPrefix)) {
        s = s.slice(dataUriPrefix.length);
    }

    if (!s.startsWith('JVBERi0')) return null;

    try {
        const buffer = Buffer.from(s, 'base64');
        return isPdfBuffer(buffer) ? buffer : null;
    } catch {
        return null;
    }
}

function findPdfBufferInsideJson(value, depth = 0) {
    if (value === null || value === undefined || depth > 10) return null;

    if (typeof value === 'string') return base64ToPdfBuffer(value);
    if (Buffer.isBuffer(value)) return isPdfBuffer(value) ? value : null;

    if (Array.isArray(value)) {
        if (value.length > 5 && value.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) {
            const buffer = Buffer.from(value);
            if (isPdfBuffer(buffer)) return buffer;
        }

        for (const item of value) {
            const found = findPdfBufferInsideJson(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    if (typeof value === 'object') {
        const preferredKeys = [
            'fileContents',
            'FileContents',
            'fileContent',
            'FileContent',
            'pdf',
            'Pdf',
            'PDF',
            'file',
            'File',
            'document',
            'Document',
            'content',
            'Content',
            'data',
            'Data',
            'result',
            'Result'
        ];

        for (const key of preferredKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findPdfBufferInsideJson(value[key], depth + 1);
                if (found) return found;
            }
        }

        for (const item of Object.values(value)) {
            const found = findPdfBufferInsideJson(item, depth + 1);
            if (found) return found;
        }
    }

    return null;
}

function getJsonKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.keys(value).slice(0, 20);
}

function getPositiveTimeoutMs(value, fallback = 60000) {
    const timeoutMs = Number(value);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : fallback;
}

function makeTimeoutError(label, timeoutMs) {
    const err = new Error(`${label} timeout after ${timeoutMs}ms`);
    err.code = 'ERGANI_TIMEOUT';
    return err;
}

function getRemainingTimeoutMs(deadlineAt, label, totalTimeoutMs) {
    const remaining = Math.max(0, deadlineAt - Date.now());
    if (remaining <= 0) {
        throw makeTimeoutError(label, totalTimeoutMs);
    }
    return remaining;
}

function buildSubmittedDocumentUrl({ submissionCode, protocol, submittedDate }) {
    const submittedDateValue = String(submittedDate || '').trim();

    if (!submissionCode) throw new Error('Λείπει submissionCode για λήψη PDF ΕΡΓΑΝΗ.');
    if (!protocol) throw new Error('Λείπει protocol για λήψη PDF ΕΡΓΑΝΗ.');
    if (!submittedDateValue) throw new Error('Λείπει submittedDate για λήψη PDF ΕΡΓΑΝΗ.');

    return (
        `${getUiBaseUrl()}/Home/GetSubmittedDocument/${encodeURIComponent(submissionCode)}` +
        `?protocol=${encodeURIComponent(protocol)}` +
        `&submittedDate=${encodeURIComponent(submittedDateValue)}`
    );
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactKnownSecrets(text, secrets = {}) {
    let output = String(text || '');
    const knownSecrets = [
        { value: secrets.username, replacement: '[REDACTED_USERNAME]' },
        { value: secrets.password, replacement: '[REDACTED_PASSWORD]' }
    ];

    for (const secret of knownSecrets) {
        const rawValue = String(secret.value || '');
        if (!rawValue) continue;

        output = output.replace(new RegExp(escapeRegExp(rawValue), 'g'), secret.replacement);
    }

    return output;
}

function redactForLog(value, secrets = {}) {
    return redactKnownSecrets(value, secrets)
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
        .replace(/access[_-]?token["'\s:=]+[^"'&\s<]+/gi, 'accessToken=[REDACTED]')
        .replace(/refresh[_-]?token["'\s:=]+[^"'&\s<]+/gi, 'refreshToken=[REDACTED]')
        .replace(/password["'\s:=]+[^"'&\s<]+/gi, 'password=[REDACTED]')
        .replace(/username["'\s:=]+[^"'&\s<]+/gi, 'username=[REDACTED]');
}

function safeSnippet(value, maxLength = 300, secrets = {}) {
    return redactForLog(value, secrets)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function isErganiPdfDebugEnabled() {
    return String(process.env.ERGANI_PDF_DEBUG_LOGS || '').toLowerCase() === 'true';
}

function shouldSaveDebugArtifacts() {
    return String(process.env.ERGANI_DEBUG_SAVE_HTML || '').toLowerCase() === 'true';
}

function shouldSaveRawResponseDebug() {
    return String(process.env.ERGANI_DEBUG_PDF_RAW_RESPONSE || '').toLowerCase() === 'true';
}

async function getSafePageSnapshot(page, secrets = {}) {
    if (!page) {
        return {
            url: '',
            title: '',
            bodySnippet: '',
            loginError: ''
        };
    }

    const [url, title, bodyText, loginError] = await Promise.all([
        Promise.resolve(page.url()).catch(() => ''),
        page.title().catch(() => ''),
        page.locator('body').innerText({ timeout: 1000 }).catch(() => ''),
        page
            .locator(
                '.validation-summary-errors, .field-validation-error, .text-danger, .alert-danger, .alert, [role="alert"]'
            )
            .first()
            .innerText({ timeout: 1000 })
            .catch(() => '')
    ]);

    return {
        url: redactForLog(url, secrets),
        title: safeSnippet(title, 120, secrets),
        bodySnippet: safeSnippet(bodyText, 300, secrets),
        loginError: safeSnippet(loginError, 300, secrets)
    };
}

async function isLikelyLoginPage(page) {
    const currentUrl = String(page.url() || '');
    if (/\/login\b|\/login\//i.test(currentUrl)) return true;

    const loginInputCount = await page
        .locator(
            'input[name="Username"], input#Username, input[name="username"], input#username, input[type="password"]'
        )
        .count()
        .catch(() => 0);

    return loginInputCount > 0;
}

async function saveDebugArtifacts(page, prefix = 'pdf-retry') {
    if (!page || !shouldSaveDebugArtifacts()) {
        return {
            debugHtmlPath: null,
            debugScreenshotPath: null
        };
    }

    try {
        const debugDir = path.join(process.cwd(), 'tmp', 'ergani-debug');
        await fs.ensureDir(debugDir);

        const timestamp = Date.now();
        const htmlPath = path.join(debugDir, `${prefix}-${timestamp}.html`);
        const screenshotPath = path.join(debugDir, `${prefix}-${timestamp}.png`);

        await fs.writeFile(htmlPath, await page.content(), 'utf8').catch(() => {});
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

        return {
            debugHtmlPath: (await fs.pathExists(htmlPath)) ? htmlPath : null,
            debugScreenshotPath: (await fs.pathExists(screenshotPath)) ? screenshotPath : null
        };
    } catch {
        return {
            debugHtmlPath: null,
            debugScreenshotPath: null
        };
    }
}

async function saveRawResponseDebug(buffer) {
    if (!Buffer.isBuffer(buffer) || !shouldSaveRawResponseDebug()) return null;

    try {
        const debugDir = path.join(process.cwd(), 'tmp', 'ergani-debug');
        await fs.ensureDir(debugDir);

        const filepath = path.join(
            debugDir,
            `get-submitted-document-response-${Date.now()}.txt`
        );

        await fs.writeFile(filepath, buffer);
        return filepath;
    } catch {
        return null;
    }
}

function attachDebugPaths(error, artifacts = {}) {
    if (artifacts.debugHtmlPath) error.debugHtmlPath = artifacts.debugHtmlPath;
    if (artifacts.debugScreenshotPath) error.debugScreenshotPath = artifacts.debugScreenshotPath;
    return error;
}

function logPw(stage, details = {}) {
    console.log(`[ERGANI PDF PW] ${stage}`, details);
}

function debugLogPw(stage, details = {}) {
    if (!isErganiPdfDebugEnabled()) return;
    logPw(stage, details);
}

async function fillFirstVisible(page, selectors, value, deadlineAt, totalTimeoutMs) {
    for (const selector of selectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0) {
            try {
                await loc.waitFor({
                    state: 'visible',
                    timeout: Math.min(
                        3000,
                        getRemainingTimeoutMs(deadlineAt, 'Playwright PDF fetch', totalTimeoutMs)
                    )
                });
                await loc.fill(value, {
                    timeout: getRemainingTimeoutMs(
                        deadlineAt,
                        'Playwright PDF fetch',
                        totalTimeoutMs
                    )
                });
                return selector;
            } catch {
                // δοκιμάζουμε τον επόμενο selector
            }
        }
    }

    throw new Error(`Δεν βρέθηκε visible input για selectors: ${selectors.join(', ')}`);
}

async function clickFirstVisible(page, selectors, deadlineAt, totalTimeoutMs) {
    for (const selector of selectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0) {
            try {
                await loc.waitFor({
                    state: 'visible',
                    timeout: Math.min(
                        3000,
                        getRemainingTimeoutMs(deadlineAt, 'Playwright PDF fetch', totalTimeoutMs)
                    )
                });
                await loc.click({
                    timeout: getRemainingTimeoutMs(
                        deadlineAt,
                        'Playwright PDF fetch',
                        totalTimeoutMs
                    )
                });
                return selector;
            } catch {
                // δοκιμάζουμε τον επόμενο selector
            }
        }
    }

    throw new Error(`Δεν βρέθηκε visible κουμπί για selectors: ${selectors.join(', ')}`);
}

async function tryCheckLoginType(page, usertype, deadlineAt, totalTimeoutMs) {
    const type = String(usertype || '01').trim();

    // 01 = Εξωτερικός: συνήθως δεν χρειάζεται checkbox.
    if (type === '01') return;

    const labelsByUsertype = {
        '02': ['ΕΡΓΑΝΗ', 'κωδικούς "ΕΡΓΑΝΗ"', 'κωδικούς ΕΡΓΑΝΗ'],
        '03': ['Οικοδομοτεχνικά', 'ΕΦΚΑ']
    };

    const labels = labelsByUsertype[type] || [];

    for (const labelText of labels) {
        try {
            const label = page.getByText(labelText, { exact: false }).first();
            if ((await label.count()) === 0) continue;

            const forAttr = await label.getAttribute('for').catch(() => null);
            if (forAttr) {
                const checkbox = page.locator(`#${forAttr}`).first();
                if ((await checkbox.count()) > 0) {
                    await checkbox.check({
                        timeout: Math.min(
                            2000,
                            getRemainingTimeoutMs(
                                deadlineAt,
                                'Playwright PDF fetch',
                                totalTimeoutMs
                            )
                        )
                    }).catch(async () => {
                        await checkbox.click({
                            timeout: Math.min(
                                2000,
                                getRemainingTimeoutMs(
                                    deadlineAt,
                                    'Playwright PDF fetch',
                                    totalTimeoutMs
                                )
                            )
                        });
                    });
                    return;
                }
            }

            await label.click({
                timeout: Math.min(
                    2000,
                    getRemainingTimeoutMs(deadlineAt, 'Playwright PDF fetch', totalTimeoutMs)
                )
            });
            return;
        } catch {
            // δεν μας νοιάζει αν δεν βρεθεί, συνεχίζουμε
        }
    }
}

async function loginToErganiServicesUi(page, creds, deadlineAt, totalTimeoutMs) {
    const loginUrl = `${getUiBaseUrl()}/Login/Index`;
    const logSecrets = {
        username: creds.username,
        password: creds.password
    };

    await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: getRemainingTimeoutMs(deadlineAt, 'Playwright PDF login', totalTimeoutMs)
    });

    const loginSnapshot = await getSafePageSnapshot(page, logSecrets);
    debugLogPw('login-page-loaded', {
        url: loginSnapshot.url,
        title: loginSnapshot.title
    });

    const usernameSelector = await fillFirstVisible(
        page,
        [
            '#UserName',
            'input[name="UserName"]',
            'input[autocomplete="username"]',
            'input[placeholder="username"]',
            'input[name="Username"]',
            'input#Username',
            'input[name="username"]',
            'input#username',
            'input[placeholder="Username"]',
            'input[type="text"]'
        ],
        creds.username,
        deadlineAt,
        totalTimeoutMs
    );
    debugLogPw('username-filled', { selector: usernameSelector });

    const passwordSelector = await fillFirstVisible(
        page,
        [
            '#Password',
            'input[name="Password"]',
            'input#Password',
            'input[autocomplete="current-password"]',
            'input[type="password"]',
            'input[name="password"]',
            'input#password',
            'input[placeholder="Password"]'
        ],
        creds.password,
        deadlineAt,
        totalTimeoutMs
    );
    debugLogPw('password-filled', { selector: passwordSelector });

    await tryCheckLoginType(page, creds.userType || creds.usertype || '01', deadlineAt, totalTimeoutMs);

    const navigationPromise = page
        .waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: Math.min(
                15000,
                getRemainingTimeoutMs(deadlineAt, 'Playwright PDF login', totalTimeoutMs)
            )
        })
        .catch(() => null);

    try {
        const clickedSelector = await clickFirstVisible(
            page,
            [
                'button[onclick*="TryLogin"]',
                '#loginForm button[onclick*="TryLogin"]',
                '#loginForm button.el-btn--primary',
                'button.el-btn--primary:has-text("Είσοδος")',
                'button:has-text("Είσοδος")',
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Log in")',
                'button:has-text("Login")',
                'button:has-text("Σύνδεση")',
                'input[value="Log in"]',
                'input[value="Login"]',
                'input[value="Σύνδεση"]'
            ],
            deadlineAt,
            totalTimeoutMs
        );
        logPw('login-clicked', { selector: clickedSelector });
    } catch {
        const tryLoginCalled = await page.evaluate(() => {
            if (typeof window.TryLogin === 'function') {
                window.TryLogin();
                return true;
            }
            return false;
        });

        if (tryLoginCalled) {
            logPw('login-trylogin-function-fallback', {});
        } else {
            logPw('login-submit-button-not-found-enter-fallback', {
                passwordSelector
            });
            await page.locator(passwordSelector).first().focus({
                timeout: getRemainingTimeoutMs(deadlineAt, 'Playwright PDF login', totalTimeoutMs)
            });
            await page.keyboard.press('Enter');
        }
    }

    await navigationPromise;

    const remainingAfterLogin = getRemainingTimeoutMs(
        deadlineAt,
        'Playwright PDF login',
        totalTimeoutMs
    );
    await page.waitForTimeout(Math.min(1000, remainingAfterLogin));

    const afterLoginSnapshot = await getSafePageSnapshot(page, logSecrets);
    debugLogPw('login-after-click', {
        url: afterLoginSnapshot.url,
        title: afterLoginSnapshot.title,
        bodySnippet: afterLoginSnapshot.bodySnippet,
        loginError: afterLoginSnapshot.loginError || null
    });

    if (await isLikelyLoginPage(page)) {
        throw new Error(
            `ERGANI UI login did not complete. Current URL: ${afterLoginSnapshot.url}. ` +
                `Login error: ${afterLoginSnapshot.loginError || 'N/A'}`
        );
    }
}

async function readPdfFromPlaywrightDownload(download) {
    const tempDir = path.join(process.cwd(), 'tmp', 'ergani-downloads');
    await fs.ensureDir(tempDir);

    const suggested = download.suggestedFilename() || `ergani-submitted-${Date.now()}.pdf`;
    const tempPath = path.join(tempDir, `${Date.now()}-${suggested}`);

    await download.saveAs(tempPath);

    const buffer = await fs.readFile(tempPath);

    await fs.remove(tempPath).catch(() => {});

    return buffer;
}

/**
 * Κατεβάζει το PDF της οριστικής υποβολής ΕΡΓΑΝΗ μέσω Playwright.
 *
 * ΣΗΜΑΝΤΙΚΟ:
 * Το GetSubmittedDocument προκαλεί "download" event στον Chromium.
 * Άρα δεν πρέπει να το παίρνουμε μόνο με page.goto(). Πρέπει να περιμένουμε:
 *
 *   const downloadPromise = page.waitForEvent('download')
 *   await page.goto(pdfUrl)
 *   const download = await downloadPromise
 *
 * Αλλιώς παίρνουμε error:
 *   page.goto: Download is starting
 */
async function downloadSubmittedErganiPdfWithPlaywright({
    creds,
    submissionCode,
    protocol,
    submittedDate,
    headless = true,
    timeoutMs = 60000
}) {
    if (!creds?.username || !creds?.password) {
        throw new Error('Λείπουν credentials για Playwright λήψη PDF ΕΡΓΑΝΗ.');
    }

    const submittedDateCandidates = buildSubmittedDateCandidates(submittedDate);
    const initialPdfUrl = submittedDateCandidates[0]
        ? buildSubmittedDocumentUrl({
              submissionCode,
              protocol,
              submittedDate: submittedDateCandidates[0]
          })
        : '';
    const totalTimeoutMs = getPositiveTimeoutMs(timeoutMs, 60000);
    const deadlineAt = Date.now() + totalTimeoutMs;
    const logSecrets = {
        username: creds.username,
        password: creds.password
    };

    let browser = null;
    let context = null;
    let page = null;

    debugLogPw('start', {
        env: getErganiEnv(),
        uiBaseUrl: getUiBaseUrl(),
        submissionCode,
        protocol,
        submittedDate,
        pdfUrl: initialPdfUrl,
        timeoutMs: totalTimeoutMs,
        headless
    });
    debugLogPw('submitted-date-candidates', submittedDateCandidates);

    try {
        browser = await chromium.launch({
            headless,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
            timeout: getRemainingTimeoutMs(deadlineAt, 'Playwright PDF launch', totalTimeoutMs)
        });
        debugLogPw('browser-launched');

        context = await browser.newContext({
            acceptDownloads: true,
            ignoreHTTPSErrors: true
        });

        page = await context.newPage();
        page.setDefaultTimeout(
            getRemainingTimeoutMs(deadlineAt, 'Playwright PDF fetch', totalTimeoutMs)
        );
        page.setDefaultNavigationTimeout(
            getRemainingTimeoutMs(deadlineAt, 'Playwright PDF fetch', totalTimeoutMs)
        );

        await loginToErganiServicesUi(page, creds, deadlineAt, totalTimeoutMs);

        const candidateErrors = [];

        for (const submittedDateCandidate of submittedDateCandidates) {
            const pdfUrl = buildSubmittedDocumentUrl({
                submissionCode,
                protocol,
                submittedDate: submittedDateCandidate
            });

            debugLogPw('pdf-candidate-start', {
                submissionCode,
                protocol,
                submittedDateCandidate,
                pdfUrl
            });

            try {
                debugLogPw('before-pdf-goto', { pdfUrl });
                const remainingForDownload = getRemainingTimeoutMs(
                    deadlineAt,
                    'Playwright PDF download',
                    totalTimeoutMs
                );
                const downloadEventTimeoutMs = Math.min(15000, remainingForDownload);
                debugLogPw('download-wait-start', { timeoutMs: downloadEventTimeoutMs });

                const downloadPromise = page
                    .waitForEvent('download', {
                        timeout: downloadEventTimeoutMs
                    })
                    .catch((err) => err);

                await page
                    .goto(pdfUrl, {
                        waitUntil: 'commit',
                        timeout: Math.min(
                            15000,
                            getRemainingTimeoutMs(
                                deadlineAt,
                                'Playwright PDF download',
                                totalTimeoutMs
                            )
                        )
                    })
                    .catch((err) => {
                        const message = String(err?.message || err);
                        if (!message.includes('Download is starting')) {
                            throw err;
                        }
                        // Αυτό είναι αναμενόμενο όταν το response είναι attachment/download.
                    });

                const download = await downloadPromise;
                if (download instanceof Error) {
                    const snapshot = await getSafePageSnapshot(page, logSecrets);
                    debugLogPw('download-event-timeout', {
                        url: snapshot.url,
                        title: snapshot.title,
                        contentType: null,
                        bodySnippet: snapshot.bodySnippet
                    });
                    throw download;
                }

                const buffer = await readPdfFromPlaywrightDownload(download);
                const isPdf = isPdfBuffer(buffer);
                debugLogPw('download-event-success', {
                    suggestedFilename: download.suggestedFilename() || null,
                    bytes: buffer.length,
                    isPdf
                });

                debugLogPw('pdf-candidate-result', {
                    submittedDateCandidate,
                    success: isPdf,
                    status: null,
                    contentType: 'application/pdf',
                    isPdfBuffer: isPdf,
                    source: 'playwright-download-event',
                    error: isPdf ? null : 'download-not-pdf'
                });

                if (isPdf) {
                    logPw('final result', {
                        success: true,
                        source: 'playwright-download-event',
                        bytes: buffer.length,
                        error: null
                    });
                    return {
                        success: true,
                        buffer,
                        contentType: 'application/pdf',
                        rawContentType: 'application/pdf',
                        sizeBytes: buffer.length,
                        url: pdfUrl,
                        error: null,
                        source: 'playwright-download-event'
                    };
                }

                candidateErrors.push(`${submittedDateCandidate}: download-not-pdf`);
            } catch (downloadErr) {
                debugLogPw('fallback-goto-start', { pdfUrl });
                let response = null;

                try {
                    response = await page.goto(pdfUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: Math.min(
                            15000,
                            getRemainingTimeoutMs(
                                deadlineAt,
                                'Playwright PDF fallback',
                                totalTimeoutMs
                            )
                        )
                    });
                } catch (fallbackErr) {
                    const snapshot = await getSafePageSnapshot(page, logSecrets);
                    debugLogPw('fallback-goto-response', {
                        status: null,
                        contentType: null,
                        url: snapshot.url,
                        title: snapshot.title,
                        isPdfBuffer: false,
                        bodySnippet: snapshot.bodySnippet
                    });
                    debugLogPw('pdf-candidate-result', {
                        submittedDateCandidate,
                        success: false,
                        status: null,
                        contentType: null,
                        isPdfBuffer: false,
                        source: 'playwright-fallback-error',
                        error: fallbackErr.message || String(fallbackErr)
                    });
                    candidateErrors.push(
                        `${submittedDateCandidate}: fallback-error (${
                            fallbackErr.message || fallbackErr
                        })`
                    );
                    continue;
                }

                if (!response) {
                    const snapshot = await getSafePageSnapshot(page, logSecrets);
                    debugLogPw('fallback-goto-response', {
                        status: null,
                        contentType: null,
                        url: snapshot.url,
                        title: snapshot.title,
                        isPdfBuffer: false,
                        bodySnippet: snapshot.bodySnippet
                    });
                    debugLogPw('pdf-candidate-result', {
                        submittedDateCandidate,
                        success: false,
                        status: null,
                        contentType: null,
                        isPdfBuffer: false,
                        source: 'playwright-no-response',
                        error: downloadErr.message || String(downloadErr)
                    });
                    candidateErrors.push(
                        `${submittedDateCandidate}: no-response (${downloadErr.message || downloadErr})`
                    );
                    continue;
                }

                const contentType = response.headers()['content-type'] || '';
                const buffer = await response.body();
                const rawResponseDebugPath = await saveRawResponseDebug(buffer);
                if (rawResponseDebugPath) {
                    logPw('raw-response-debug-saved', {
                        submittedDateCandidate,
                        status: response.status(),
                        contentType,
                        bytes: buffer.length,
                        path: rawResponseDebugPath
                    });
                }
                const isPdf = isPdfBuffer(buffer);
                const responseText = isPdf ? '' : buffer.toString('utf8');
                const responseJson = isPdf ? null : safeJsonParse(responseText);
                const jsonKeys = getJsonKeys(responseJson);
                const snapshot = await getSafePageSnapshot(page, logSecrets);

                debugLogPw('fallback-goto-response', {
                    status: response.status(),
                    contentType,
                    url: snapshot.url,
                    title: snapshot.title,
                    isPdfBuffer: isPdf,
                    bodySnippet: isPdf ? '' : snapshot.bodySnippet
                });

                if (responseJson || /application\/json/i.test(contentType)) {
                    debugLogPw('json-response-detected', {
                        submittedDateCandidate,
                        status: response.status(),
                        contentType,
                        jsonKeys
                    });

                    const pdfFromJson = findPdfBufferInsideJson(responseJson);
                    if (pdfFromJson) {
                        debugLogPw('pdf-candidate-json-pdf', {
                            submittedDateCandidate,
                            status: response.status(),
                            contentType,
                            jsonKeys,
                            bytes: pdfFromJson.length
                        });
                        debugLogPw('pdf-candidate-result', {
                            submittedDateCandidate,
                            success: true,
                            status: response.status(),
                            contentType,
                            isPdfBuffer: true,
                            source: 'playwright-json-fileContents',
                            error: null
                        });
                        logPw('final result', {
                            success: true,
                            source: 'playwright-json-fileContents',
                            bytes: pdfFromJson.length,
                            error: null
                        });
                        return {
                            success: true,
                            buffer: pdfFromJson,
                            contentType: 'application/pdf',
                            rawContentType: contentType,
                            sizeBytes: pdfFromJson.length,
                            url: pdfUrl,
                            error: null,
                            source: 'playwright-json-fileContents'
                        };
                    }
                }

                if (/No objects found/i.test(snapshot.bodySnippet)) {
                    debugLogPw('pdf-candidate-no-objects', {
                        submittedDateCandidate,
                        status: response.status(),
                        contentType,
                        bodySnippet: snapshot.bodySnippet
                    });
                }

                debugLogPw('pdf-candidate-result', {
                    submittedDateCandidate,
                    success: isPdf,
                    status: response.status(),
                    contentType,
                    isPdfBuffer: isPdf,
                    source: 'playwright-response-body',
                    error: isPdf ? null : downloadErr.message || String(downloadErr)
                });

                if (isPdf) {
                    logPw('final result', {
                        success: true,
                        source: 'playwright-response-body',
                        bytes: buffer.length,
                        error: null
                    });
                    return {
                        success: true,
                        buffer,
                        contentType: 'application/pdf',
                        rawContentType: contentType,
                        sizeBytes: buffer.length,
                        url: pdfUrl,
                        error: null,
                        source: 'playwright-response-body'
                    };
                }

                candidateErrors.push(
                    `${submittedDateCandidate}: HTTP=${response.status()} contentType=${
                        contentType || 'unknown'
                    }${
                        isErganiPdfDebugEnabled()
                            ? ` body=${snapshot.bodySnippet || 'N/A'}`
                            : ''
                    }`
                );
            }
        }

        const artifacts = await saveDebugArtifacts(page, 'pdf-retry');
        const errorMessage =
            'Το GetSubmittedDocument δεν επέστρεψε PDF για κανένα submittedDate candidate. ' +
            `Δοκιμάστηκαν: ${submittedDateCandidates.join(', ')}. ` +
            candidateErrors.slice(0, 6).join(' | ');

        logPw('final result', {
            success: false,
            source: 'playwright-candidates-exhausted',
            bytes: 0,
            error: errorMessage,
            debugHtmlPath: artifacts.debugHtmlPath,
            debugScreenshotPath: artifacts.debugScreenshotPath
        });

        return {
            success: false,
            buffer: null,
            contentType: null,
            rawContentType: null,
            sizeBytes: 0,
            url: initialPdfUrl,
            error: errorMessage,
            source: 'playwright-candidates-exhausted',
            debugHtmlPath: artifacts.debugHtmlPath,
            debugScreenshotPath: artifacts.debugScreenshotPath
        };
    } catch (err) {
        const artifacts = await saveDebugArtifacts(page, 'pdf-retry');
        logPw('final result', {
            success: false,
            source: 'playwright-exception',
            bytes: 0,
            error: err.message || String(err),
            debugHtmlPath: err.debugHtmlPath || artifacts.debugHtmlPath,
            debugScreenshotPath: err.debugScreenshotPath || artifacts.debugScreenshotPath
        });
        throw attachDebugPaths(err, artifacts);
    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = {
    downloadSubmittedErganiPdfWithPlaywright,
    buildSubmittedDocumentUrl,
    isPdfBuffer
};
