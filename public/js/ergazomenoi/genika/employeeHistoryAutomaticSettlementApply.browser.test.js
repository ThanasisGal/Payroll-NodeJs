'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startSettlementHarness } = require('../../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { forbidRealSettlementMongo } = require('../../../../test/fixtures/forbidRealSettlementMongo');
const { settlementDecisionFixture } = require('../../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { periodSplitFixture } = require('../../../../test/fixtures/employeeHistoryPeriodSplitFixture');
const { correctedPayFixture, datedPayChangeFixture, departureFactsFixture } = require('../../../../test/fixtures/employeeHistorySpecialDecisionFixture');
const screenshots = '/tmp/payroll-phase3b-visual';
const modal = '#employeeSettlementPreviewModal', body = '#employeeSettlementPreviewBody';
const approve = '#employeeSettlementPreviewApprove', trigger = '#employeeHistoryReconstructionPreviewBtn';
let browser;
before(async () => {
    forbidRealSettlementMongo(mock);
    fs.mkdirSync(screenshots, { recursive: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); mock.restoreAll(); });
async function withPage(options, work) {
    const h = await startSettlementHarness(options);
    const page = await browser.newPage({ viewport: { width: options.width || 1280, height: options.height || 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, h.origin, 'only the isolated loopback server is accessible');
        return route.continue();
    });
    try {
        await page.goto(h.origin);
        if (options.sidebar) await page.evaluate(() => document.body.classList.add('sidebar-open'));
        await work({ page, ...h });
        assert.deepEqual(errors, []);
    } finally { await page.close(); await h.close(); }
}
async function open(page) {
    await page.click(trigger);
    await page.locator(`${body} .employee-settlement-message`).waitFor();
    await page.waitForTimeout(200);
}
async function close(page) {
    await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.modal-backdrop').count(), 0);
}
async function apply(page) {
    await page.click(approve);
    await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent === 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
}
for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768], [1280, 720], [390, 640]]) {
    for (const sidebar of [false, true]) test(`Chromium HTTP ${width}×${height}, sidebar=${sidebar}: approved transaction, audit report and Continue`, async () => {
        await withPage({ width, height, sidebar }, async ({ page, db, requests }) => {
            const initial = db.state();
            await open(page);
            assert.equal(db.state().audits.length, 0);
            await apply(page);
            assert.equal(await page.locator(body).innerText(), 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
            assert.equal(await page.locator(`${modal} .modal-body > p`).isVisible(), false);
            assert.equal(db.state().audits.length, 1);
            assert.deepEqual(db.state().references, initial.references);
            assert.equal(requests.length, 1);
            assert.deepEqual(Object.keys(requests[0]), ['approval']);
            const geometry = await page.locator(modal).evaluate(element => {
                const content = element.querySelector('.modal-content').getBoundingClientRect();
                const footer = element.querySelector('.modal-footer').getBoundingClientRect();
                return { fits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
                    footerFits: footer.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth,
                    font: parseFloat(getComputedStyle(element.querySelector('.modal-body')).fontSize) };
            });
            assert.equal(geometry.fits, true, JSON.stringify(geometry));
            assert.equal(geometry.footerFits, true);
            assert.equal(geometry.overflow, false);
            assert.ok(geometry.font >= 15.2);
            await page.screenshot({ path: `${screenshots}/success-${width}-${height}-sidebar-${sidebar}.png` });
            await page.click('#employeeSettlementPreviewDetails');
            const report = await page.locator('#employeeSettlementPreviewReport').innerText();
            assert.match(report, /Καταγεγραμμένες ενέργειες/);
            assert.match(report, /διατηρήθηκε.*ιστορικές αναφορές/);
            assert.doesNotMatch(report, /Δεν αποθηκεύτηκε καμία αλλαγή/);
            await page.screenshot({ path: `${screenshots}/audit-${width}-${height}-sidebar-${sidebar}.png` });
            await page.click('#employeeSettlementPreviewBack');
            await page.click('#employeeSettlementPreviewContinue');
            await page.waitForTimeout(350);
            assert.equal(await page.locator('.modal-backdrop').count(), 0);
            assert.equal(await page.locator(trigger).evaluate(node => node === document.activeElement), true);
            await open(page);
            assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
            assert.equal(await page.locator(approve).isVisible(), false);
            await close(page);
        });
    });
}
for (const fault of ['COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE']) test(`Chromium ${fault}: neutral outcome, Close/reopen retains exact approval, retry commits once`, async () => {
    await withPage({}, async ({ page, db, requests }) => {
        await open(page);
        db.failAt(fault);
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Επανάληψη με την ίδια έγκριση');
        assert.match(await page.locator(body).innerText(), /Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές/);
        assert.doesNotMatch(await page.locator(body).innerText(), /επιτυχώς|Δεν αποθηκεύτηκε/);
        await page.screenshot({ path: `${screenshots}/uncertain-${fault}.png` });
        const first = requests[0];
        await close(page);
        await open(page);
        assert.equal(await page.locator(approve).innerText(), 'Επανάληψη με την ίδια έγκριση');
        await apply(page);
        assert.deepEqual(requests[1], first);
        assert.equal(db.state().audits.length, 1);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
        assert.equal(await page.locator('#employeeSettlementPreviewDetails').isVisible(), true);
        await close(page);
    });
});
test('Chromium lost HTTP response preserves approval and safely recognizes the committed action', async () => {
    await withPage({}, async ({ page, db, requests }) => {
        await open(page);
        await page.route('**/history-automatic-settlement-apply', async route => {
            await route.fetch();
            await route.abort('connectionfailed');
            await page.unroute('**/history-automatic-settlement-apply');
        });
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Επανάληψη με την ίδια έγκριση');
        assert.equal(db.state().audits.length, 1);
        await apply(page);
        assert.deepEqual(requests[0], requests[1]);
        assert.equal(db.state().audits.length, 1);
        await close(page);
    });
});
test('Chromium denial after an uncertain commit does not turn the earlier outcome into failure or discard approval', async () => {
    await withPage({}, async ({ page, db, permission, requests }) => {
        await open(page);
        db.failAt('COMMIT_ACK_LOST');
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Επανάληψη με την ίδια έγκριση');
        permission.update = false;
        await page.click(approve);
        await page.waitForFunction(() => !document.querySelector('#employeeSettlementPreviewApprove').disabled);
        assert.match(await page.locator(body).innerText(), /Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές/);
        assert.doesNotMatch(await page.locator(body).innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        permission.update = true;
        await apply(page);
        assert.deepEqual(requests[0], requests[1]);
        assert.deepEqual(requests[1], requests[2]);
        assert.equal(db.state().audits.length, 1);
        await close(page);
    });
});
test('Chromium stale approval shows actionable rejection and leaves independent actions available', async () => {
    await withPage({}, async ({ page, db }) => {
        await open(page);
        db.changeEmployee({ parathrhseis: 'μεταγενέστερη συνθετική αλλαγή' });
        const changed = db.state();
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('ΙΣΤ-ΑΥΤ-3Β'));
        assert.match(await page.locator(body).innerText(), /Δεν αποθηκεύτηκε.*1\..*2\./s);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.deepEqual(db.state(), changed);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
    });
});
test('Chromium unknown/incomplete History keeps administrator message, Close and independent work with zero writes', async () => {
    await withPage({ enriched: false }, async ({ page, db }) => {
        const initial = db.state();
        await open(page);
        assert.match(await page.locator(body).innerText(), /1\..*διαχειριστή.*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
        assert.deepEqual(db.state(), initial);
    });
});
for (const [width, height, sidebar] of [[1920, 1080, false], [1280, 720, true], [390, 640, false]]) {
    test(`Chromium business choice ${width}×${height}: one question resolves the period, explicit approval and existing Continue`, async () => {
        await withPage({ width, height, sidebar, fixture: settlementDecisionFixture() }, async ({ page, db, requests }) => {
            await open(page);
            assert.equal(await page.locator(`${body} fieldset`).count(), 1);
            assert.equal(await page.locator(`${body} input:checked`).count(), 0);
            await page.locator(`${body} input[value=KEEP_TWO_DAY_PROFILE]`).check();
            await page.click(approve);
            await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
            assert.equal(db.state().audits.length, 0);
            assert.equal(await page.locator(`${body} input`).count(), 0, 'documented assumptions do not become questions');
            assert.equal(await page.locator('#employeeSettlementPreviewChangeChoice').isVisible(), true);
            await page.screenshot({ path: `${screenshots}/phase3g-approved-choice-${width}.png` });
            await apply(page);
            assert.equal(db.state().audits.length, 1);
            assert.deepEqual(requests[0].businessDecision, { choiceId: 'KEEP_TWO_DAY_PROFILE' });
            await page.click('#employeeSettlementPreviewDetails');
            assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /2 ημέρες \/ 14 ώρες.*Καταγεγραμμένες ενέργειες/s);
            const geometry = await page.locator(modal).evaluate(element => {
                const rect = element.querySelector('.modal-content').getBoundingClientRect();
                return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
                    scrolls: element.querySelector('.modal-body').scrollHeight > element.querySelector('.modal-body').clientHeight };
            });
            assert.equal(geometry.fits, true);
            if (width === 390) assert.equal(geometry.scrolls, true);
            await page.screenshot({ path: `${screenshots}/phase3g-recorded-choice-${width}.png` });
            await page.click('#employeeSettlementPreviewContinue');
            await page.waitForTimeout(350);
            await open(page);
            assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
            assert.equal(await page.locator(approve).isVisible(), false);
            await close(page);
        });
    });
}
test('Chromium change choice returns to the single question and requires a fresh approval', async () => {
    await withPage({ fixture: settlementDecisionFixture() }, async ({ page, db, requests }) => {
        await open(page);
        await page.locator(`${body} input[value=KEEP_TWO_DAY_PROFILE]`).check();
        await page.click(approve);
        await page.locator('#employeeSettlementPreviewChangeChoice').waitFor();
        await page.click('#employeeSettlementPreviewChangeChoice');
        await page.locator(`${body} input[value=KEEP_FOUR_DAY_PROFILE]`).waitFor();
        assert.equal(await page.locator(approve).isDisabled(), true);
        await page.locator(`${body} input[value=KEEP_FOUR_DAY_PROFILE]`).check();
        await page.click(approve);
        await page.locator('#employeeSettlementPreviewChangeChoice').waitFor();
        await apply(page);
        assert.deepEqual(requests[0].businessDecision, { choiceId: 'KEEP_FOUR_DAY_PROFILE' });
        assert.equal(db.state().audits.length, 1);
        await close(page);
    });
});
test('Chromium verified split requires approval and cancellation allows independent work', async () => {
    await withPage({ fixture: settlementDecisionFixture() }, async ({ page, db }) => {
        const initial = db.state();
        await open(page);
        await page.locator(`${body} input[value=SPLIT_AT_2026_06_29]`).check();
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
        assert.equal(await page.locator(approve).isEnabled(), true);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
        assert.deepEqual(db.state(), initial);
    });
});
for (const [width, height, sidebar] of [[1920, 1080, false], [1280, 720, true], [390, 640, false]]) {
    test(`Chromium automatic period split ${width}×${height}: documented date, no questions or writes, clear before/after`, async () => {
        await withPage({ width, height, sidebar, fixture: periodSplitFixture({ yearly: true, priorCycle: true }) }, async ({ page, db, requests }) => {
            const before = db.state();
            await open(page);
            assert.equal(await page.locator(`${body} input`).count(), 0);
            assert.equal(await page.locator(approve).isEnabled(), true);
            await page.click('#employeeSettlementPreviewDetails');
            const report = await page.locator('#employeeSettlementPreviewReport').innerText();
            assert.match(report, /01\/01\/2026–30\/06\/2026: 2 ημέρες \/ 14 ώρες/);
            assert.match(report, /01\/07\/2026–31\/12\/2026: 4 ημέρες \/ 30 ώρες/);
            assert.match(report, /01\/01\/2025–31\/01\/2025/);
            assert.match(report, /τεκμηριωμένη ημερομηνία/);
            const geometry = await page.locator(modal).evaluate(element => {
                const content = element.querySelector('.modal-content').getBoundingClientRect();
                return { fits: content.left >= 0 && content.right <= innerWidth && content.bottom <= innerHeight,
                    footerFits: element.querySelector('.modal-footer').getBoundingClientRect().bottom <= innerHeight };
            });
            assert.deepEqual(geometry, { fits: true, footerFits: true });
            await page.screenshot({ path: `${screenshots}/phase3d-automatic-split-${width}.png` });
            await close(page);
            assert.equal(await page.locator('.modal-backdrop').count(), 0);
            assert.deepEqual(db.state(), before);
            assert.deepEqual(requests, []);
        });
    });
}
test('Chromium one factual date choice produces three successive periods without enabling insertion', async () => {
    await withPage({ fixture: periodSplitFixture({ automatic: false, intermediate: true }) }, async ({ page, db, requests }) => {
        const before = db.state();
        await open(page);
        assert.equal(await page.locator(`${body} fieldset`).count(), 1);
        await page.locator(`${body} input[value=INTERMEDIATE_PROFILE_OTHER_DATE]`).check();
        const date = page.locator(`${body} input[type=date]:visible`);
        await date.fill('2026-06-01');
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /01\/06\/2026–08\/06\/2026: 2 ημέρες \/ 16 ώρες/);
        await page.screenshot({ path: `${screenshots}/phase3d-alternate-split.png` });
        await close(page);
        assert.deepEqual(db.state(), before);
        assert.deepEqual(requests, []);
    });
});
for (const [width, height, sidebar] of [[1920, 1080, false], [1280, 720, true], [390, 640, false]]) {
    test(`Chromium transactional annual split ${width}×${height}: one approval, real insert audit, Continue and clean reopen`, async () => {
        await withPage({ width, height, sidebar, fixture: periodSplitFixture({ yearly: true, priorCycle: true }) }, async ({ page, db, requests }) => {
            const before = db.state();
            await open(page);
            await apply(page);
            assert.equal(await page.locator(body).innerText(), 'Το Ιστορικό τακτοποιήθηκε επιτυχώς');
            assert.equal(db.state().audits.length, 1);
            assert.equal(db.state().history.length, before.history.length + 2);
            assert.deepEqual(db.state().references, before.references);
            assert.equal(requests.length, 1);
            await page.click('#employeeSettlementPreviewDetails');
            const report = await page.locator('#employeeSettlementPreviewReport').innerText();
            assert.match(report, /Δημιουργήθηκε η εγγραφή 0006: 01\/01\/2026–30\/06\/2026/);
            assert.match(report, /Δημιουργήθηκε η εγγραφή 0007: 01\/07\/2026–31\/12\/2026/);
            const geometry = await page.locator(modal).evaluate(element => {
                const rect = element.querySelector('.modal-content').getBoundingClientRect();
                return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
            });
            assert.equal(geometry, true);
            await page.screenshot({ path: `${screenshots}/phase3st-stored-split-${width}.png` });
            await page.click('#employeeSettlementPreviewContinue');
            await page.waitForTimeout(350);
            await open(page);
            assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
            assert.equal(await page.locator(approve).isVisible(), false);
            await close(page);
        });
    });
}
test('Chromium uncertain split commit retains the exact approval and inserted identities on retry', async () => {
    await withPage({ fixture: periodSplitFixture({ yearly: true }) }, async ({ page, db, requests }) => {
        await open(page);
        db.failAt('COMMIT_ACK_LOST');
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Επανάληψη με την ίδια έγκριση');
        const committed = db.state();
        assert.equal(committed.audits.length, 1);
        await apply(page);
        assert.deepEqual(requests[0], requests[1]);
        assert.deepEqual(db.state(), committed);
        assert.equal(db.events.filter(event => event.type === 'syntheticInsert').length, 2);
        await close(page);
    });
});
for (const width of [1280, 390]) test(`Chromium corrected historical pay ${width}px: documented automatic correction, one audit and protected results`, async () => {
    await withPage({ width, height: width === 390 ? 640 : 800, fixture: correctedPayFixture() }, async ({ page, db }) => {
        const before = db.state();
        await open(page);
        assert.equal(await page.locator(`${body} input`).count(), 0);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /διπλή εγγραφή.*1\.100,00/s);
        await page.click('#employeeSettlementPreviewBack');
        await apply(page);
        assert.equal(db.state().audits.length, 1);
        assert.equal(db.state().history.length, before.history.length + 1);
        assert.deepEqual(db.state().references, before.references);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /0004.*1\.100,00/s);
        await page.screenshot({ path: `${screenshots}/phase3z-pay-correction-${width}.png` });
        await page.click('#employeeSettlementPreviewContinue');
        await page.waitForTimeout(350);
        await open(page);
        assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
        await close(page);
    });
});
test('Chromium genuine dated pay changes retain both amounts and ask no questions about approved assumptions', async () => {
    await withPage({ fixture: datedPayChangeFixture() }, async ({ page, db }) => {
        await open(page);
        assert.equal(await page.locator(`${body} input`).count(), 0);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /διαφορετικοί όροι σε διαφορετικές ημερομηνίες/);
        await page.click('#employeeSettlementPreviewBack');
        await apply(page);
        assert.ok(db.state().history.some(row => row.synolo_symbashs === 1000));
        assert.ok(db.state().history.some(row => row.synolo_symbashs === 1100));
        assert.equal(db.state().audits.length, 1);
        await close(page);
    });
});
for (const pay of [false, true]) test(`Chromium unsupported ${pay ? 'departure/pay' : 'departure'} preserves administrator guidance and independent work`, async () => {
    await withPage({ fixture: departureFactsFixture(pay) }, async ({ page, db, requests }) => {
        const before = db.state();
        await open(page);
        assert.match(await page.locator(body).innerText(), /1\..*διαχειριστή.*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
        assert.equal(await page.locator(`${body} input`).count(), 0);
        assert.equal(await page.locator(approve).isVisible(), false);
        await close(page);
        await page.click('#independentAction');
        assert.equal(await page.evaluate(() => window.independentContinued), true);
        assert.deepEqual(db.state(), before);
        assert.deepEqual(requests, []);
    });
});
