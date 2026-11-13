'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'downloadScheduleButton.js'), 'utf8');
const reference = '6c5fa2ab-bb50-4d22-93f3-d6b889d977b2';

for (const code of ['EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT', 'EMPLOYEE_WORK_WRITE_NOT_APPLIED',
    'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED', 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED']) {
    test(`${code} retains its support reference and exact record storage outcome`, async () => {
        const h = await uiHarness({ status: 409, payload: { success: false,
            error: { code, correlationId: reference, storageState: 'uncertain' } } });
        await h.click();
        const notice = h.dialogs.at(-1);
        assert.equal(notice.icon, 'error');
        assert.ok(notice.text.endsWith(`${code} / ${reference}`));
        if (code.endsWith('COMMIT_UNCONFIRMED')) {
            assert.match(notice.text, /Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές/);
            assert.doesNotMatch(notice.text, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        } else assert.match(notice.text, /Δεν αποθηκεύτηκε καμία αλλαγή στις εγγραφές ωραρίων/);
        assert.match(notice.text, /1\.[\s\S]*2\./);
        assert.equal(h.window.location.href, '/unchanged');
    });
}

async function uiHarness({ status = 500, payload, rawBody, contentType = 'application/json',
    networkFailure = false, confirmed = true, pending, keepNoticeOpen = false } = {}) {
    let ready, click, closeNotice;
    const requests = [], dialogs = [];
    const loader = { style: { display: 'none' } };
    const fields = Object.fromEntries(Object.entries({ team: 'TEST', company_kod: 'synthetic-company',
        ypokatasthmaHidden: '0', apo_hmeromhnia: '2026-10-01', eos_hmeromhnia: '2026-10-31',
        ypokatasthmata: '0000', downloadScheduleButton: '' }).map(([id, value]) => [id, {
        value, disabled: false, addEventListener: (_event, handler) => { if (id === 'downloadScheduleButton') click = handler; }
    }]));
    const window = { location: { href: '/unchanged' } };
    vm.runInNewContext(source, {
        window, document: { cookie: 'psifl.x-csrf-token=synthetic-csrf',
            addEventListener: (_event, handler) => { ready = handler; },
            getElementById: id => fields[id], querySelectorAll: () => [],
            querySelector: () => loader },
        ErganiFormsSwal: { fire: async options => {
            dialogs.push(options);
            if (options.showCancelButton) return { isConfirmed: confirmed };
            if (keepNoticeOpen) await new Promise(resolve => { closeNotice = resolve; });
            return { isConfirmed: true };
        } },
        Swal: { getCancelButton: () => ({ focus() {} }) },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (pending) await pending;
            if (networkFailure) throw Error('synthetic-secret-marker');
            return new Response(rawBody === undefined ? JSON.stringify(payload) : rawBody,
                { status, headers: { 'Content-Type': contentType, 'X-Correlation-ID': reference } });
        }
    });
    await ready();
    return { requests, dialogs, loader, window, button: fields.downloadScheduleButton,
        click: () => click({ preventDefault() {} }), closeNotice: () => closeNotice() };
}

for (const status of [400, 401, 403, 409, 500]) {
    test(`HTTP ${status} is shown as a persistent error with no retry or redirect`, async () => {
        const h = await uiHarness({ status, payload: { success: false,
            error: { code: 'SCHEDULE_CONFLICT', correlationId: reference, storageState: 'not_started' },
            message: '<img src=x onerror=secret>synthetic-secret-marker', stack: 'synthetic-secret-marker' } });
        await h.click();
        const notice = h.dialogs.at(-1);
        assert.equal(notice.icon, 'error');
        assert.match(notice.text, new RegExp(`Κατάσταση HTTP: ${status}`));
        assert.match(notice.text, /SCHEDULE_CONFLICT/);
        assert.ok(notice.text.endsWith(reference));
        assert.match(notice.text, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.equal(notice.html, undefined);
        assert.equal(notice.timer, undefined);
        assert.equal(notice.willClose, undefined);
        assert.equal(JSON.stringify(notice).includes('synthetic-secret-marker'), false);
        assert.equal(h.window.location.href, '/unchanged');
        assert.equal(h.requests.length, 1);
        assert.equal(h.button.disabled, false);
        assert.equal(h.loader.style.display, 'none');
    });
}

for (const [name, options, expected] of [
    ['network failure', { networkFailure: true }, 'SCHEDULE_NETWORK_FAILED'],
    ['invalid JSON', { status: 200, rawBody: '{invalid' }, 'SCHEDULE_RESPONSE_INVALID'],
    ['HTML after redirect', { status: 200, rawBody: '<html>synthetic-secret-marker</html>', contentType: 'text/html' }, 'SCHEDULE_RESPONSE_INVALID'],
    ['HTTP failure with HTML', { status: 403, rawBody: '<html>synthetic-secret-marker</html>', contentType: 'text/html' }, 'SCHEDULE_FORBIDDEN'],
    ['HTTP failure with invalid JSON', { status: 409, rawBody: '{invalid' }, 'SCHEDULE_CONFLICT'],
    ['HTTP 200 application failure', { status: 200, payload: { success: false } }, 'SCHEDULE_REJECTED'],
    ['inconsistent success and error', { status: 200, payload: { success: true, error: 'failure' } }, 'SCHEDULE_REJECTED'],
    ['missing success flag', { status: 200, payload: {} }, 'SCHEDULE_RESPONSE_INVALID'],
    ['truthy success flag', { status: 200, payload: { success: 'true' } }, 'SCHEDULE_RESPONSE_INVALID'],
    ['null JSON', { status: 200, payload: null }, 'SCHEDULE_RESPONSE_INVALID'],
    ['untrusted error code', { status: 500, payload: { success: false,
        error: { code: 'synthetic-secret-marker', correlationId: '<unsafe-reference>' } } }, 'SCHEDULE_INTERNAL_ERROR']
]) {
    test(`${name} cannot be presented as success`, async () => {
        const h = await uiHarness(options);
        await h.click();
        assert.equal(h.dialogs.at(-1).icon, 'error');
        assert.match(h.dialogs.at(-1).text, new RegExp(expected));
        assert.match(h.dialogs.at(-1).text, /1\.[\s\S]*2\./);
        assert.match(h.dialogs.at(-1).text, /Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές/);
        assert.equal(JSON.stringify(h.dialogs).includes('synthetic-secret-marker'), false);
        assert.equal(h.requests.length, 1);
        assert.equal(h.window.location.href, '/unchanged');
    });
}

test('cancelling the original confirmation performs no request', async () => {
    const h = await uiHarness({ confirmed: false });
    await h.click();
    assert.equal(h.dialogs[0].confirmButtonText, 'Λήψη');
    assert.equal(h.requests.length, 0);
    assert.equal(h.button.disabled, false);
});

test('double clicks cannot repeat a pending download; a later attempt requires confirmation', async () => {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const h = await uiHarness({ pending, status: 500, payload: { success: false } });
    const first = h.click();
    await h.click();
    resolve();
    await first;
    assert.equal(h.requests.length, 1);
    assert.equal(h.dialogs.filter(dialog => dialog.showCancelButton).length, 1);
    await h.click();
    assert.equal(h.requests.length, 2);
    assert.equal(h.dialogs.filter(dialog => dialog.showCancelButton).length, 2);
});

test('success requires explicit success and user acknowledgement before returning to the form', async () => {
    const h = await uiHarness({ status: 200, payload: { success: true,
        redirectUrl: 'https://untrusted.invalid/' }, keepNoticeOpen: true });
    const done = h.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.dialogs.at(-1).icon, 'success');
    assert.equal(h.window.location.href, '/unchanged');
    h.closeNotice();
    await done;
    assert.equal(h.window.location.href, '/ergazomenoi/programmata/lhpshOrarionApoErganh');
    assert.equal(h.requests.length, 1);
    assert.equal(JSON.parse(h.requests[0].options.body).selectedPararthma, '0');
});
