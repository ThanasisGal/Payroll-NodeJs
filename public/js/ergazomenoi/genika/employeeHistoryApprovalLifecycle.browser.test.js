'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startSettlementHarness } = require('../../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { forbidRealSettlementMongo } = require('../../../../test/fixtures/forbidRealSettlementMongo');
const { acceptanceBWithInitialGap } = require('../../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const { settlementDecisionFixture } = require('../../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const approve = '#employeeSettlementPreviewApprove', body = '#employeeSettlementPreviewBody';
function normalDecisionFixture() {
    const fixture = settlementDecisionFixture();
    fixture.scope = { ...fixture.scope, team: 'THA', company_kod: '700000000000000000000003' };
    Object.assign(fixture.currentEmployee, fixture.scope);
    fixture.completeHistoryRows.forEach(row => Object.assign(row, fixture.scope));
    return fixture;
}
let browser;
before(async () => { forbidRealSettlementMongo(mock); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); mock.restoreAll(); });
async function withPage(work, options = {}) {
    const h = await startSettlementHarness({ fixture: acceptanceBWithInitialGap(), enriched: false,
        realHttp: true, normal: true, fullForm: true, ...options });
    const page = await browser.newPage({ viewport: { width: options.width || 1280, height: options.height || 720 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { assert.equal(new URL(route.request().url()).origin, h.origin); return route.continue(); });
    try {
        await page.goto(h.origin);
        if (options.sidebar) await page.evaluate(() => document.body.classList.add('sidebar-open'));
        await work({ ...h, page }); assert.deepEqual(errors, []);
    }
    finally { await page.close(); await h.close(); }
}
async function open(page) {
    await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
    await page.click('#employeeHistoryReconstructionPreviewBtn');
    await page.locator(`${body} .employee-settlement-message`).waitFor();
}
async function close(page) {
    await page.locator('#employeeSettlementPreviewModal .modal-footer [data-bs-dismiss="modal"]').click();
    await page.locator('#employeeSettlementPreviewModal').waitFor({ state: 'hidden' });
}
async function blocked(page) {
    await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('άγνωστο'));
    assert.equal(await page.locator(approve).isDisabled(), true);
    const message = await page.locator(body).innerText();
    assert.match(message, /διαχειριστή/);
    assert.doesNotMatch(message, /Δεν αποθηκεύτηκε καμία αλλαγή|επιτυχώς|Επανάληψη με την ίδια έγκριση/);
}
for (const status of [503, 409]) test(`Gate 3 first NORMAL ${status} BLOCKED disables apply immediately and across modal reset`, async () => {
    await withPage(async ({ page, db, requests }) => {
        const before = db.state(); let posts = 0, previews = 0;
        page.on('request', req => { if (req.url().includes('history-reconstruction-preview')) previews++; });
        await page.route('**/history-automatic-settlement-apply', route => {
            posts++; return route.fulfill({ status, contentType: 'application/json',
                body: JSON.stringify({ success: false, outcome: 'BLOCKED', retryWithSameApproval: false }) });
        });
        await open(page); await page.click(approve); await blocked(page);
        await close(page); await open(page); await blocked(page);
        assert.equal(posts, 1); assert.equal(previews, 1); assert.equal(requests.length, 0);
        assert.deepEqual(db.state(), before);
    });
});
for (const fault of ['COMMIT_ACK_LOST', 'COMMIT_UNKNOWN_BEFORE']) test(`Gate 3 real HTTP NORMAL ${fault}: one POST and permanent diagnostic identity`, async () => {
    await withPage(async ({ page, db, requests }) => {
        await open(page); db.failAt(fault); await page.click(approve); await blocked(page);
        const after = db.state(), evidence = db.protocolState();
        await close(page); await open(page); await blocked(page);
        assert.equal(requests.length, 1); assert.equal(evidence.attempts.length, 1);
        assert.deepEqual(db.state(), after); assert.deepEqual(db.protocolState(), evidence);
    });
});
test('Gate 3 lost HTTP response after server commit never sends a second POST', async () => {
    await withPage(async ({ page, db, requests }) => {
        await page.route('**/history-automatic-settlement-apply', async route => { await route.fetch(); await route.abort('failed'); });
        await open(page); await page.click(approve); await blocked(page);
        await close(page); await open(page); await blocked(page);
        assert.equal(requests.length, 1); assert.equal(db.state().audits.length, 1);
    });
});
for (const field of ['istorikoEmployeeId', 'company_kod', 'team']) test(`Gate 3 changed ${field} discards delayed preview without writes`, async () => {
    await withPage(async ({ page, db, requests }) => {
        const before = db.state(); let release;
        const gate = new Promise(resolve => { release = resolve; });
        await page.route('**/history-reconstruction-preview?*', async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
        await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
        await page.click('#employeeHistoryReconstructionPreviewBtn');
        await page.evaluate(field => { const node = document.getElementById(field); node.value = '720000000000000000000002'; node.dispatchEvent(new Event('change', { bubbles: true })); }, field);
        release(); await page.waitForTimeout(250);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.deepEqual(db.state(), before); assert.equal(requests.length, 0);
    });
});
test('Gate 3 persisted fence sequence, stale server rejection, reload and new independent approval', async () => {
    await withPage(async ({ page, db, requests, preview }) => {
        await open(page);
        const old = await (await preview()).json();
        // Gate 1/2 already prove the Admin fence. Supply only its persisted sequence
        // postcondition here: no Recovery Completion or Admin operation is executed.
        const sequence = db.state().employees[0].employee_profile_mutation_sequence || 0;
        db.changeEmployee({ employee_profile_mutation_sequence: sequence + 1 });
        const fenced = db.state();
        const rejected = page.waitForResponse(response => response.url().endsWith('/history-automatic-settlement-apply'));
        await page.click(approve);
        assert.equal((await rejected).status(), 409);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').hidden);
        assert.deepEqual(db.state(), fenced);
        const fresh = await (await preview()).json();
        assert.notEqual(fresh.approvalFingerprint, old.approvalFingerprint);
        await page.reload(); await open(page);
        assert.equal(await page.locator(approve).innerText(), 'Έγκριση & Τακτοποίηση');
        assert.equal(requests.length, 1); assert.deepEqual(db.state(), fenced);
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('τακτοποιήθηκε επιτυχώς'));
        assert.equal(requests.length, 2); assert.equal(requests[1].approval.fingerprint, fresh.approvalFingerprint);
        assert.equal(db.state().audits.length, 1);
        await page.click('#employeeSettlementPreviewDetails');
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Καταγεγραμμένες ενέργειες/);
        await page.click('#employeeSettlementPreviewBack');
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(requests.length, 2);
    });
});
for (const mode of ['network', 'timedout', 'invalid-json', 'http-error']) test(`Gate 3 NORMAL ${mode} never offers another apply`, async () => {
    await withPage(async ({ page, db }) => {
        const before = db.state(); let posts = 0;
        await page.route('**/history-automatic-settlement-apply', route => {
            posts++;
            if (mode === 'network' || mode === 'timedout') return route.abort(mode === 'timedout' ? 'timedout' : 'failed');
            return route.fulfill({ status: mode === 'http-error' ? 503 : 200, contentType: 'application/json', body: 'lost response' });
        });
        await open(page); await page.click(approve); await blocked(page);
        await close(page); await open(page); await blocked(page);
        assert.equal(posts, 1); assert.deepEqual(db.state(), before);
    });
});
test('Gate 3 NORMAL stalled response expires without retrying the POST', async () => {
    await withPage(async ({ page, db }) => {
        await page.clock.install();
        let release; const gate = new Promise(resolve => { release = resolve; });
        let posts = 0;
        await page.route('**/history-automatic-settlement-apply', async route => { posts++; await gate; await route.abort('timedout').catch(() => {}); });
        try {
            await open(page); await page.clock.runFor(350);
            await page.click(approve); await page.clock.fastForward(31000);
            await blocked(page); assert.equal(posts, 1); assert.equal(db.state().audits.length, 0);
        } finally { release(); }
    });
});
for (const field of ['istorikoEmployeeId', 'company_kod', 'team']) test(`Gate 3 ${field} switch discards a delayed successful apply response`, async () => {
    await withPage(async ({ page, db, requests }) => {
        let release, received; const gate = new Promise(resolve => { release = resolve; });
        const reached = new Promise(resolve => { received = resolve; });
        await page.route('**/history-automatic-settlement-apply', async route => {
            const response = await route.fetch(); received(); await gate; await route.fulfill({ response });
        });
        await open(page); await page.click(approve); await reached;
        const after = db.state();
        await page.evaluate(field => { const node = document.getElementById(field); node.value = '720000000000000000000002'; node.dispatchEvent(new Event('change', { bubbles: true })); }, field);
        release(); await page.waitForTimeout(250);
        assert.doesNotMatch(await page.locator(body).innerText(), /τακτοποιήθηκε επιτυχώς/);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(requests.length, 1); assert.deepEqual(db.state(), after);
    });
});
test('Gate 3 NORMAL success without recorded corrections must not enable a second apply', async () => {
    await withPage(async ({ page }) => {
        await page.route('**/history-automatic-settlement-apply', route => route.fulfill({ contentType: 'application/json',
            body: JSON.stringify({ success: true, historyStatus: 'CLEAN' }) }));
        await open(page); await page.click(approve); await blocked(page);
    });
});
test('Gate 3 same actor in a different session cannot use the old browser approval', async () => {
    await withPage(async ({ page, db, requests, sessionIdentity }) => {
        await open(page); const before = db.state();
        sessionIdentity.id = 'isolated-browser-session-2';
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').hidden);
        assert.deepEqual(db.state(), before); assert.equal(requests.length, 1);
        assert.doesNotMatch(await page.locator(body).innerText(), /τακτοποιήθηκε επιτυχώς/);
    });
});
test('Gate 3 server rejects an old sequence and modal reopening still requires a full page reload', async () => {
    await withPage(async ({ page, db, requests }) => {
        let previews = 0;
        page.on('request', req => { if (req.url().includes('history-reconstruction-preview')) previews++; });
        await open(page); db.changeEmployee({ employee_profile_mutation_sequence: 1 });
        const before = db.state(); await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').hidden);
        await close(page); await open(page);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(previews, 1); assert.equal(requests.length, 1); assert.deepEqual(db.state(), before);
    });
});
test('Gate 3 reloading a page cannot offer NORMAL application while the server attempt is unresolved', async () => {
    await withPage(async ({ page, db, requests }) => {
        await open(page); db.failAt('COMMIT_UNKNOWN_BEFORE'); await page.click(approve); await blocked(page);
        const after = db.state(), evidence = db.protocolState();
        await page.reload(); await open(page); await blocked(page);
        assert.equal(requests.length, 1); assert.deepEqual(db.state(), after); assert.deepEqual(db.protocolState(), evidence);
    });
});
test('Gate 3 confirmed NORMAL success reopens as a read-only clean history with no second apply', async () => {
    await withPage(async ({ page, db, requests }) => {
        await open(page); await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('τακτοποιήθηκε επιτυχώς'));
        const after = db.state(); await close(page); await open(page);
        assert.match(await page.locator(body).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        assert.equal(requests.length, 1); assert.deepEqual(db.state(), after);
        assert.equal(db.events.filter(event => event.type === 'commit').length, 1);
    });
});
for (const changed of ['company', 'team', 'actor', 'fingerprint', 'missing-context']) test(`Gate 3 server browser binding rejects changed ${changed} without writes`, async () => {
    await withPage(async ({ preview, origin, initial, db, session }) => {
        const old = await (await preview()).json(), before = db.state();
        if (changed === 'company') session.companyInUse = '720000000000000000000002';
        if (changed === 'team') session.userTeam = 'OTHER';
        if (changed === 'actor') session.userId = '720000000000000000000003';
        const response = await fetch(`${origin}/api/ergazomenoi/${initial.employeeId}/history-automatic-settlement-apply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json',
                ...(changed === 'missing-context' ? {} : { 'X-Employee-Settlement-Context': old.browserApprovalContext }) },
            body: JSON.stringify({ approval: { confirmed: true, fingerprint: changed === 'fingerprint' ? 'x'.repeat(43) : old.approvalFingerprint } }) });
        assert.equal(response.status, 409); assert.deepEqual(db.state(), before);
        assert.equal(db.protocolState().attempts.length, 0);
    });
});
test('Gate 3 NORMAL business decision produces a new preview and requires a separate approval click', async () => {
    await withPage(async ({ page, db, requests }) => {
        const before = db.state(); await open(page);
        await page.locator(`${body} input[value="KEEP_FOUR_DAY_PROFILE"]`).check();
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
        assert.equal(requests.length, 0); assert.deepEqual(db.state(), before);
        await page.click(approve);
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('τακτοποιήθηκε επιτυχώς'));
        assert.equal(requests.length, 1); assert.equal(db.state().audits.length, 1);
        assert.equal(requests[0].businessDecision.selections.cycle_1.choiceId, 'KEEP_FOUR_DAY_PROFILE');
    }, { fixture: normalDecisionFixture(), enriched: true });
});
for (const [width, height] of [[1920, 1080], [1280, 720], [390, 640]]) for (const sidebar of [false, true])
test(`Gate 3 NORMAL blocked message fits Chromium ${width}x${height} sidebar=${sidebar}`, async () => {
    await withPage(async ({ page, db, requests }) => {
        await open(page); db.failAt('COMMIT_UNKNOWN_BEFORE'); await page.click(approve); await blocked(page);
        const geometry = await page.locator('#employeeSettlementPreviewModal').evaluate(node => {
            const content = node.querySelector('.modal-content').getBoundingClientRect();
            const footer = node.querySelector('.modal-footer').getBoundingClientRect();
            return { fits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
                footer: footer.bottom <= innerHeight, overflow: node.scrollWidth > node.clientWidth,
                font: parseFloat(getComputedStyle(node.querySelector('.modal-body')).fontSize) };
        });
        assert.equal(geometry.fits, true); assert.equal(geometry.footer, true);
        assert.equal(geometry.overflow, false); assert.ok(geometry.font >= 13.6);
        assert.equal(requests.length, 1); assert.equal(db.state().audits.length, 0);
    }, { width, height, sidebar });
});
