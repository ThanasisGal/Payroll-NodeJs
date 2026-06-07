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

function onlyDate(value) {
    return (
        String(value || '')
            .trim()
            .split(/\s+/)[0] || ''
    );
}

function isPdfBuffer(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString() === '%PDF-'
    );
}

function buildSubmittedDocumentUrl({ submissionCode, protocol, submittedDate }) {
    const dateOnly = onlyDate(submittedDate);

    if (!submissionCode) throw new Error('Λείπει submissionCode για λήψη PDF ΕΡΓΑΝΗ.');
    if (!protocol) throw new Error('Λείπει protocol για λήψη PDF ΕΡΓΑΝΗ.');
    if (!dateOnly) throw new Error('Λείπει submittedDate για λήψη PDF ΕΡΓΑΝΗ.');

    return (
        `${getUiBaseUrl()}/Home/GetSubmittedDocument/${encodeURIComponent(submissionCode)}` +
        `?protocol=${encodeURIComponent(protocol)}` +
        `&submittedDate=${encodeURIComponent(dateOnly)}`
    );
}

async function fillFirstVisible(page, selectors, value) {
    for (const selector of selectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0) {
            try {
                await loc.waitFor({ state: 'visible', timeout: 3000 });
                await loc.fill(value);
                return selector;
            } catch {
                // δοκιμάζουμε τον επόμενο selector
            }
        }
    }

    throw new Error(`Δεν βρέθηκε visible input για selectors: ${selectors.join(', ')}`);
}

async function clickFirstVisible(page, selectors) {
    for (const selector of selectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0) {
            try {
                await loc.waitFor({ state: 'visible', timeout: 3000 });
                await loc.click();
                return selector;
            } catch {
                // δοκιμάζουμε τον επόμενο selector
            }
        }
    }

    throw new Error(`Δεν βρέθηκε visible κουμπί για selectors: ${selectors.join(', ')}`);
}

async function tryCheckLoginType(page, usertype) {
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
                    await checkbox.check({ timeout: 2000 }).catch(async () => {
                        await checkbox.click({ timeout: 2000 });
                    });
                    return;
                }
            }

            await label.click({ timeout: 2000 });
            return;
        } catch {
            // δεν μας νοιάζει αν δεν βρεθεί, συνεχίζουμε
        }
    }
}

async function loginToErganiServicesUi(page, creds) {
    const loginUrl = `${getUiBaseUrl()}/Login/Index`;

    await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await fillFirstVisible(
        page,
        [
            'input[name="Username"]',
            'input#Username',
            'input[name="username"]',
            'input#username',
            'input[placeholder="Username"]',
            'input[type="text"]'
        ],
        creds.username
    );

    await fillFirstVisible(
        page,
        [
            'input[name="Password"]',
            'input#Password',
            'input[name="password"]',
            'input#password',
            'input[placeholder="Password"]',
            'input[type="password"]'
        ],
        creds.password
    );

    await tryCheckLoginType(page, creds.userType || creds.usertype || '01');

    await Promise.allSettled([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        clickFirstVisible(page, [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Log in")',
            'button:has-text("Login")',
            'button:has-text("Σύνδεση")',
            'input[value="Log in"]',
            'input[value="Login"]',
            'input[value="Σύνδεση"]'
        ])
    ]);

    await page.waitForTimeout(1000);
}

async function saveDebugHtml(page, prefix = 'ergani-submitted-document-html') {
    try {
        const debugDir = path.join(process.cwd(), 'tmp', 'ergani-debug');
        await fs.ensureDir(debugDir);

        const filename = `${prefix}-${Date.now()}.html`;
        const filepath = path.join(debugDir, filename);

        await fs.writeFile(filepath, await page.content(), 'utf8');
        return filepath;
    } catch {
        return null;
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
    headless = true
}) {
    if (!creds?.username || !creds?.password) {
        throw new Error('Λείπουν credentials για Playwright λήψη PDF ΕΡΓΑΝΗ.');
    }

    const pdfUrl = buildSubmittedDocumentUrl({
        submissionCode,
        protocol,
        submittedDate
    });

    const browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
        acceptDownloads: true,
        ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    try {
        await loginToErganiServicesUi(page, creds);

        // ---------------------------------------------------------------------
        // Κύρια ροή: το endpoint ξεκινά download, άρα πιάνουμε download event.
        // ---------------------------------------------------------------------
        try {
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

            await page
                .goto(pdfUrl, {
                    waitUntil: 'commit',
                    timeout: 60000
                })
                .catch((err) => {
                    const message = String(err?.message || err);
                    if (!message.includes('Download is starting')) {
                        throw err;
                    }
                    // Αυτό είναι αναμενόμενο όταν το response είναι attachment/download.
                });

            const download = await downloadPromise;
            const buffer = await readPdfFromPlaywrightDownload(download);

            if (isPdfBuffer(buffer)) {
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

            return {
                success: false,
                buffer: null,
                contentType: null,
                rawContentType: null,
                sizeBytes: 0,
                url: pdfUrl,
                error: 'Το αρχείο που κατέβηκε από το ΕΡΓΑΝΗ δεν είναι έγκυρο PDF.'
            };
        } catch (downloadErr) {
            // -----------------------------------------------------------------
            // Fallback: σε κάποια περιβάλλοντα μπορεί να εμφανίζεται inline PDF.
            // -----------------------------------------------------------------
            const response = await page.goto(pdfUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            if (!response) {
                const debugHtmlPath = await saveDebugHtml(page);
                throw new Error(
                    `Δεν υπήρξε response από το GetSubmittedDocument. ` +
                        `Download error: ${downloadErr.message || downloadErr}. ` +
                        `Debug HTML: ${debugHtmlPath || 'N/A'}`
                );
            }

            const contentType = response.headers()['content-type'] || '';
            const buffer = await response.body();

            if (isPdfBuffer(buffer)) {
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

            const debugHtmlPath = await saveDebugHtml(page);

            return {
                success: false,
                buffer: null,
                contentType: null,
                rawContentType: contentType,
                sizeBytes: 0,
                url: pdfUrl,
                error:
                    `Το GetSubmittedDocument δεν επέστρεψε PDF. ` +
                    `Download error: ${downloadErr.message || downloadErr}. ` +
                    `HTTP=${response.status()} Content-Type=${contentType || 'unknown'} ` +
                    `Debug HTML: ${debugHtmlPath || 'N/A'}`
            };
        }
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

module.exports = {
    downloadSubmittedErganiPdfWithPlaywright,
    buildSubmittedDocumentUrl,
    isPdfBuffer
};
