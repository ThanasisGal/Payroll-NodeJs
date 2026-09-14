'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const appCss = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const swalCss = fs.readFileSync(path.join(root,
    'node_modules/sweetalert2/dist/sweetalert2.min.css'), 'utf8');
const swalJs = fs.readFileSync(path.join(root,
    'node_modules/sweetalert2/dist/sweetalert2.all.min.js'), 'utf8');

const previewHtml = `<div class="text-start stage3-decision-preview">
    <div class="stage3-decision-preview-identity"><strong>ΣΠΥΡΙΔΩΝΟΣ ΑΡΕΤΗ</strong><br>
        <span>Κωδικός: 0007</span><br><span>01/05/2026</span></div>
    <div class="stage3-decision-preview-section"><strong>Τι διαπιστώθηκε</strong>
        <div class="stage3-decision-explanation">${Array.from({ length: 80 }, (_, index) =>
            `<div class="stage3-decision-explanation-line">Πληροφορία ελέγχου ${index + 1} με πλήρη ανθρώπινη επεξήγηση.</div>`).join('')}</div></div>
    <div class="stage3-decision-preview-section"><strong>Τι θα αλλάξει</strong>
        <div class="stage3-decision-before-after"><div><span>Πριν</span><strong>Χωρίς οριστικό χαρακτηρισμό</strong></div>
        <div class="stage3-decision-arrow">→</div><div><span>Μετά</span><strong>Άδεια</strong></div></div>
        <div class="small mt-2"><strong>Κατηγορία άδειας:</strong> Κανονική άδεια</div></div></div>`;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const [width, height] of [[1366, 768], [1024, 700]]) {
            const page = await browser.newPage({ viewport: { width, height } });
            await page.setContent(`<!doctype html><html><head><style>${swalCss}</style>
                <style>${appCss}</style></head><body></body></html>`);
            await page.addScriptTag({ content: swalJs });
            await page.evaluate((html) => {
                Swal.fire({ icon: 'info', title: 'Προεπισκόπηση απόφασης', html,
                    input: 'textarea', inputLabel: 'Αιτιολογία',
                    inputValue: 'Τελική εξέταση πιθανής άδειας στο Στάδιο 3.',
                    inputAttributes: { rows: '3' }, showCancelButton: true,
                    confirmButtonText: 'Εφαρμογή χαρακτηρισμού', cancelButtonText: 'Επιστροφή',
                    customClass: {
                        popup: 'custom-swal-popup employment-review-swal-popup employment-review-stage3-preview-popup',
                        htmlContainer: 'custom-html-container employment-review-swal-html-container',
                        confirmButton: 'class-success custom-confirm-button custom-swal-button',
                        cancelButton: 'class-normal custom-cancel-button custom-swal-button'
                    }
                });
            }, previewHtml);
            await page.waitForSelector('.employment-review-stage3-preview-popup');
            const geometry = await page.evaluate(() => {
                const popup = document.querySelector('.employment-review-stage3-preview-popup');
                const html = popup.querySelector('.swal2-html-container');
                const actions = popup.querySelector('.swal2-actions');
                const textarea = popup.querySelector('.swal2-textarea');
                const popupRect = popup.getBoundingClientRect();
                const actionsRect = actions.getBoundingClientRect();
                return {
                    popupTop: popupRect.top, popupBottom: popupRect.bottom,
                    popupWidth: popupRect.width, viewportHeight: innerHeight,
                    actionsTop: actionsRect.top, actionsBottom: actionsRect.bottom,
                    htmlScrolls: html.scrollHeight > html.clientHeight,
                    htmlClientHeight: html.clientHeight,
                    htmlScrollHeight: html.scrollHeight,
                    htmlOverflowY: getComputedStyle(html).overflowY,
                    previewHeight: html.firstElementChild.getBoundingClientRect().height,
                    horizontalOverflow: popup.scrollWidth > popup.clientWidth,
                    textareaHeight: textarea.getBoundingClientRect().height,
                    text: popup.innerText
                };
            });
            assert.ok(geometry.popupTop >= 0, `${width}x${height}: popup πάνω από viewport`);
            assert.ok(geometry.popupBottom <= geometry.viewportHeight,
                `${width}x${height}: popup κάτω από viewport`);
            assert.ok(geometry.actionsTop >= geometry.popupTop, JSON.stringify(geometry));
            assert.ok(geometry.actionsBottom <= geometry.popupBottom, JSON.stringify(geometry));
            assert.strictEqual(geometry.htmlScrolls, true, JSON.stringify(geometry));
            assert.strictEqual(geometry.horizontalOverflow, false);
            assert.ok(geometry.textareaHeight >= 60 && geometry.textareaHeight <= 130);
            ['Προεπισκόπηση απόφασης', 'ΣΠΥΡΙΔΩΝΟΣ ΑΡΕΤΗ', 'Κωδικός: 0007',
                'Τι διαπιστώθηκε', 'Τι θα αλλάξει', 'Πριν', 'Μετά',
                'Κατηγορία άδειας:', 'Αιτιολογία', 'Εφαρμογή χαρακτηρισμού', 'Επιστροφή']
                .forEach((text) => assert.match(geometry.text, new RegExp(text)));
            await page.close();
        }
        console.log('employment review Stage 3 preview modal layout tests passed');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
