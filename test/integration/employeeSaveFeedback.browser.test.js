'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Reuse the isolated UI harness: complete production Save handler, local
// assets and intercepted HTTP only. No app.js, controller or database starts.
const root = path.resolve(__dirname, '../..');
const harnessFile = path.join(root, 'public/js/ergazomenoi/genika/putFieldValues.historyGuidance.browser.test.js');
const harnessSource = fs.readFileSync(harnessFile, 'utf8');
const harness = new Module(harnessFile, module);
harness.filename = harnessFile;
harness.paths = Module._nodeModulePaths(path.dirname(harnessFile));
harness._compile(harnessSource.slice(0, harnessSource.indexOf('for (const [label, options]')) +
    '\nmodule.exports = { withPage, save };', harnessFile);
const { withPage, save } = harness.exports;
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
const loaderScript = [...layout.replace(/<%[\s\S]*?%>/g, '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .find(match => match[1].includes('window.showLoader = function'))[1];
const loaderMarkup = layout.slice(layout.indexOf('<div id="appLoader"'),
    layout.indexOf('<!--', layout.indexOf('<div id="appLoader"')));
const ready = { success: true, preflight: true, status: 'READY', decision: 'UPDATE_HISTORY',
    historyConfirmation: 'synthetic-confirmation' };
const success = { success: true, pendingResolved: true, employeeUpdated: true, historyUpdated: true,
    message: 'Ενημερώθηκαν τα στοιχεία και το Ιστορικό.' };
const missing = { ...ready, status: 'MISSING_REQUIRED_HISTORY_FIELDS', decision: 'DEFER_HISTORY',
    missingFields: [{ group: 'Αποδοχές', label: 'Πραγματικές αποδοχές',
        reason: 'Συμπληρώστε τις αποδοχές της νέας περιόδου.' }] };
const reply = payload => ({ status: 200, payload });
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
async function prepare(page) {
    await page.evaluate(markup => {
        document.body.insertAdjacentHTML('beforeend', markup);
    }, loaderMarkup);
    await page.addScriptTag({ content: loaderScript });
    await page.evaluate(() => {
        window.loaderEvents = [];
        const show = window.showLoader, hide = window.hideLoader;
        window.showLoader = (...args) => { window.loaderEvents.push(['show', args[1]]); show(...args); };
        window.hideLoader = () => { window.loaderEvents.push(['hide']); hide(); };
    });
}
async function loader(page, text) {
    await page.locator('#appLoader.is-visible').waitFor();
    assert.equal(await page.locator('#appLoaderStep').textContent(), text);
}
async function dialog(page, title) {
    await page.waitForFunction(title => Swal.getTitle()?.textContent === title, title);
    assert.equal(await page.locator('#appLoader.is-visible').count(), 0);
    assert.equal(await page.locator('.swal2-popup.employee-history-deferral-popup').count(), 1);
}

test('preflight and final Save loaders cover HTTP wait and block double clicks', async () => {
    const preflight = deferred(), commit = deferred();
    await withPage({ saveHandler: body => body.historyPreflight ? preflight.promise : commit.promise },
        async ({ page, requests }) => {
            await prepare(page);
            await save(page);
            await loader(page, 'Έλεγχος πριν από την αποθήκευση');
            await page.evaluate(() => document.getElementById('save').click());
            assert.equal(requests.length, 1);
            preflight.resolve(reply(ready));
            await dialog(page, 'Προεπισκόπηση αποθήκευσης');
            assert.equal(requests.length, 1);
            await page.locator('.swal2-confirm').click();
            await loader(page, 'Αποθήκευση εργαζομένου και Ιστορικού');
            await page.waitForFunction(() => window.loaderEvents.length === 3);
            await page.evaluate(() => document.getElementById('save').click());
            commit.resolve(reply(success));
            await dialog(page, 'Το Ιστορικό ενημερώθηκε');
            assert.equal(requests.length, 2);
            assert.equal(requests[0].body.historyPreflight, true);
            assert.equal(requests[1].body.historyPreflight, false);
            assert.equal(requests[1].body.historyConfirmation, ready.historyConfirmation);
            await page.locator('.swal2-confirm').click();
            await page.waitForFunction(() => window.saveFinished);
            assert.deepEqual(await page.evaluate(() => window.loaderEvents), [
                ['show', 'Έλεγχος πριν από την αποθήκευση'], ['hide'],
                ['show', 'Αποθήκευση εργαζομένου και Ιστορικού'], ['hide']
            ]);
        });
});

for (const malformed of [false, true]) test(`loader waits for the response body (${malformed ? 'invalid JSON' : 'success'})`, async () => {
    await withPage({}, async ({ page, requests }) => {
        await prepare(page);
        await page.evaluate(() => {
            const fetch = window.fetch;
            window.bodyControllers = {};
            window.fetch = async (url, options) => {
                if (!String(url).includes('/api/ergazomenoi/update/')) return fetch(url, options);
                const phase = JSON.parse(options.body).historyPreflight ? 'preflight' : 'save';
                return new Response(new ReadableStream({
                    start(controller) { window.bodyControllers[phase] = controller; }
                }), { headers: { 'Content-Type': 'application/json' } });
            };
            window.finishBody = (phase, body) => {
                window.bodyControllers[phase].enqueue(new TextEncoder().encode(body));
                window.bodyControllers[phase].close();
            };
        });
        await save(page);
        await page.waitForFunction(() => !!window.bodyControllers.preflight);
        await loader(page, 'Έλεγχος πριν από την αποθήκευση');
        await page.evaluate(body => window.finishBody('preflight', body), JSON.stringify(ready));
        await dialog(page, 'Προεπισκόπηση αποθήκευσης');
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => !!window.bodyControllers.save);
        await loader(page, 'Αποθήκευση εργαζομένου και Ιστορικού');
        await page.evaluate(body => window.finishBody('save', body), malformed ? '{invalid' : JSON.stringify(success));
        await dialog(page, malformed ? 'Αποτυχία αποθήκευσης' : 'Το Ιστορικό ενημερώθηκε');
        assert.equal(requests.length, 0);
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
    });
});

for (const stage of ['preview', 'missing']) test(`cancelling ${stage} leaves no loader or write`, async () => {
    await withPage({ payload: stage === 'missing' ? missing : ready }, async ({ page, requests }) => {
        await prepare(page); await save(page);
        await dialog(page, stage === 'missing' ? 'Λείπουν στοιχεία του Ιστορικού' : 'Προεπισκόπηση αποθήκευσης');
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 1);
        assert.equal(await page.locator('#appLoader.is-visible').count(), 0);
    });
});

test('missing-fields Continue retains the separate final approval and its loader', async () => {
    await withPage({ replies: [reply(missing), reply(success)] }, async ({ page, requests }) => {
        await prepare(page); await save(page);
        await dialog(page, 'Λείπουν στοιχεία του Ιστορικού');
        await page.locator('.swal2-confirm').click();
        await dialog(page, 'Προεπισκόπηση αποθήκευσης');
        assert.equal(requests.length, 1);
        await page.locator('.swal2-confirm').click();
        await dialog(page, 'Το Ιστορικό ενημερώθηκε');
        assert.equal(requests.length, 2);
        assert.equal(requests[1].body.historyDecision, 'DEFER_HISTORY');
    });
});

for (const phase of ['preflight', 'save']) test(`${phase} network exception removes its loader before failure`, async () => {
    await withPage({}, async ({ page, requests }) => {
        await prepare(page);
        let calls = 0;
        await page.route('**/api/ergazomenoi/update/synthetic-employee', route => {
            calls++;
            if (phase === 'save' && calls === 1)
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ready) });
            return route.abort('failed');
        });
        await save(page);
        if (phase === 'save') {
            await dialog(page, 'Προεπισκόπηση αποθήκευσης');
            await page.locator('.swal2-confirm').click();
        }
        await dialog(page, 'Αποτυχία αποθήκευσης');
        assert.equal(calls, phase === 'save' ? 2 : 1);
        assert.equal(requests.length, 0); // Every Save request was intercepted above.
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => window.saveFinished);
    });
});

test('preflight rejection and inline completion release the loader on early returns', async () => {
    for (const payload of [{ ...ready, success: false, status: 'UNSAFE_HISTORY_CHANGE' },
        { success: true, historyAccessMode: 'READ_ONLY', employeeUpdated: false, historyUpdated: false }]) {
        await withPage({ payload }, async ({ page }) => {
            await prepare(page); await save(page);
            if (payload.preflight) {
                await dialog(page, 'Η αποθήκευση χρειάζεται έλεγχο');
                await page.locator('.swal2-confirm').click();
            }
            await page.waitForFunction(() => window.saveFinished);
            assert.equal(await page.locator('#appLoader.is-visible').count(), 0);
        });
    }
});

test('shared compact styles fit history choice, date, preview, missing, success and failure in Chromium', async () => {
    await withPage({}, async ({ page }) => {
        await prepare(page);
        for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 },
            { width: 640, height: 480 }, { width: 375, height: 667 }]) {
            await page.setViewportSize(viewport);
            for (const sidebar of [false, true]) {
                await page.evaluate(open => {
                    document.body.style.paddingLeft = open ? '160px' : '0';
                }, sidebar);
                for (const kind of ['choice', 'date', 'preview', 'missing', 'success', 'error']) {
                    await page.evaluate(kind => {
                        const options = { icon: kind === 'success' ? 'success' : kind === 'error' ? 'error' : 'question',
                            title: 'Έλεγχος εμφάνισης αποθήκευσης εργαζομένου',
                            text: 'Ελέγξτε τα στοιχεία πριν συνεχίσετε. '.repeat(kind === 'missing' ? 80 : 2),
                            showCancelButton: !['success', 'error'].includes(kind),
                            showConfirmButton: kind !== 'success', confirmButtonText: 'Έγκριση και αποθήκευση',
                            cancelButtonText: 'Επιστροφή για διόρθωση',
                            ...(kind === 'date' ? { input: 'date' } : {}),
                            ...(kind === 'choice' ? { input: 'radio', inputOptions: {
                                NEW_CHANGE: 'Πραγματική νέα μεταβολή με νέα ημερομηνία ισχύος',
                                CORRECT_SAVED_ERROR: 'Διόρθωση λάθους στην ίδια ιστορική περίοδο' } } : {}) };
                        Swal.fire(withEmployeeSaveDialogStyles(options));
                    }, kind);
                    await page.locator('.swal2-popup').waitFor();
                    await page.locator('.swal2-popup').evaluate(async popup => {
                        await Promise.all(popup.getAnimations().map(animation => animation.finished.catch(() => {})));
                    });
                    const box = await page.locator('.swal2-popup').evaluate(popup => {
                        const rect = popup.getBoundingClientRect(), title = popup.querySelector('.swal2-title');
                        const content = popup.querySelector('.swal2-html-container');
                        const icon = popup.querySelector('.swal2-icon').getBoundingClientRect();
                        const confirm = popup.querySelector('.swal2-confirm').getBoundingClientRect();
                        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
                            scrollWidth: popup.scrollWidth, clientWidth: popup.clientWidth,
                            title: parseFloat(getComputedStyle(title).fontSize),
                            content: parseFloat(getComputedStyle(content).fontSize), icon: icon.width,
                            confirmBottom: confirm.bottom };
                    });
                    assert.ok(box.x >= 0 && box.y >= 0 && box.right <= viewport.width + 1 &&
                        box.bottom <= viewport.height + 1 && box.confirmBottom <= viewport.height + 1,
                    JSON.stringify({ viewport, sidebar, kind, box }));
                    assert.ok(box.scrollWidth <= box.clientWidth + 1, JSON.stringify({ viewport, sidebar, kind, box }));
                    assert.ok(box.icon <= 56 && box.title <= 18 && box.content >= 13.6 && box.content <= 16,
                        JSON.stringify({ viewport, sidebar, kind, box }));
                    assert.equal(await page.locator('.swal2-confirm').isVisible(), kind !== 'success');
                    assert.equal(await page.locator('.swal2-cancel').isVisible(), !['success', 'error'].includes(kind));
                    if (!sidebar && ((viewport.width === 375 && kind === 'missing') ||
                        (viewport.width === 1440 && kind === 'choice'))) {
                        await page.locator('.swal2-popup').evaluate(async popup => {
                            await Promise.all(popup.getAnimations({ subtree: true })
                                .map(animation => animation.finished.catch(() => {})));
                        });
                        await page.screenshot({ path: `/tmp/payroll-save-${viewport.width}-${kind}.png` });
                    }
                    await page.evaluate(() => Swal.close());
                    await page.locator('.swal2-container').waitFor({ state: 'detached' });
                }
            }
        }
        // A PDF/ERGANI dialog keeps its explicit options and class list.
        assert.equal(await page.evaluate(async () => {
            const feedback = createEmployeeSaveFeedback(Swal, window);
            feedback.show(false);
            feedback.swal.fire({ title: 'Υφιστάμενη προεπισκόπηση PDF',
                customClass: { popup: 'custom-swal-popup pdf-preview' }, showConfirmButton: false });
            return !Swal.getPopup().classList.contains('employee-history-deferral-popup') &&
                !document.getElementById('appLoader').classList.contains('is-visible');
        }), true);
    });
});
