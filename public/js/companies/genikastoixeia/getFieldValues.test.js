'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
    getCompanyAddCsrfToken,
    isCompanyAddCsrfFailure,
    companyAddErrorMessage,
    safeCompanyAddResponseText
} = require('./getFieldValues');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const addSource = fs.readFileSync(path.join(__dirname, 'getFieldValues.js'), 'utf8');
const csrfPatchSource = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'common', 'csrfFetchPatch.js'),
    'utf8'
);
const layoutSource = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
const addViewSource = fs.readFileSync(
    path.join(root, 'views/companies/genikastoixeia/add.ejs'), 'utf8'
);
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const routesSource = fs.readFileSync(path.join(root, 'server/routes/usersRoute.js'), 'utf8');

function response(status, body, contentType = 'application/json') {
    const bodyText = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    return {
        status,
        ok: status >= 200 && status < 300,
        redirected: false,
        url: '',
        headers: {
            get(name) {
                return String(name).toLowerCase() === 'content-type' ? contentType : null;
            }
        },
        async json() { return typeof body === 'string' ? JSON.parse(body) : body; },
        async text() { return bodyText; },
        clone() { return response(status, body, contentType); }
    };
}

function createPage({ token = 'page-token', companyTeam = 'BLG', originalFetch }) {
    let domReady;
    let submit;
    const swalCalls = [];
    const meta = {
        content: token,
        getAttribute(name) { return name === 'content' ? this.content : null; },
        setAttribute(name, value) { if (name === 'content') this.content = value; }
    };
    const csrfInput = { value: token };
    const fields = [
        { tagName: 'INPUT', type: 'text', name: 'eponymia', value: 'ΔΟΚΙΜΗ ΑΕ', files: [] },
        { tagName: 'INPUT', type: 'text', name: 'afm', value: '123456789', files: [] },
        { tagName: 'INPUT', type: 'text', name: 'companyTeam', value: companyTeam, files: [] },
        { tagName: 'SELECT', name: 'selectedUsers', multiple: true,
            selectedOptions: [{ value: '507f1f77bcf86cd799439011' }] }
    ];
    const section = { querySelectorAll: () => fields };
    const button = { addEventListener(type, handler) { if (type === 'click') submit = handler; } };
    const document = {
        addEventListener(type, handler) { if (type === 'DOMContentLoaded') domReady = handler; },
        querySelector(selector) {
            if (selector === 'meta[name="csrf-token"]') return meta;
            if (selector === 'input[name="_csrf"]') return csrfInput;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.card-body') return [section];
            if (selector === '.submitButton') return [button];
            return [];
        }
    };
    const context = {
        console,
        document,
        Headers,
        URL,
        fetch: originalFetch,
        Swal: {
            fire(options) {
                swalCalls.push(options);
                return Promise.resolve({});
            }
        },
        location: { origin: 'http://localhost', href: '' }
    };
    context.window = context;
    context.window.fetch = originalFetch;
    vm.createContext(context);
    // The page body script is parsed before the layout's common scripts. Its handler runs later.
    vm.runInContext(addSource, context, { filename: 'getFieldValues.js' });
    vm.runInContext(csrfPatchSource, context, { filename: 'csrfFetchPatch.js' });
    context.window.getCSRFToken = () => meta.content || csrfInput.value || null;
    domReady();
    return {
        meta,
        csrfInput,
        swalCalls,
        location: context.location,
        async submit() {
            await submit({ preventDefault() {}, stopPropagation() {} });
        }
    };
}

(async () => {
    assert.ok(layoutSource.includes('<meta name="csrf-token" content="<%= csrfToken %>" />'));
    assert.ok(layoutSource.includes("script('common/csrfFetchPatch')"));
    assert.ok(layoutSource.includes('window.getCSRFToken = function ()'));
    const addForms = addViewSource.match(/action="\/companies\/genikastoixeia\/add"/g) || [];
    const csrfFields = addViewSource.match(/include\('\.\.\/\.\.\/partials\/_csrfField'\)/g) || [];
    assert.ok(addForms.length > 0);
    assert.strictEqual(csrfFields.length, addForms.length);
    assert.match(routesSource,
        /router\.post\(\s*'\/companies\/genikastoixeia\/add',\s*requireUserPrivilegeAction\('Companies', 'create'\),\s*authorizeCompanyCreate,\s*companiesController\.postCompanyForm/s);
    const csrfMiddlewareSource = appSource.slice(
        appSource.indexOf('function validateSimpleCsrfToken'),
        appSource.indexOf("app.get('/csrf-token'")
    );
    assert.ok(csrfMiddlewareSource.includes("req.body?._csrf"));
    assert.ok(csrfMiddlewareSource.includes("req.headers['csrf-token']"));
    assert.ok(csrfMiddlewareSource.includes("error: 'CSRF validation failed'"));
    assert.ok(!csrfMiddlewareSource.includes('/companies/genikastoixeia/add'));

    const previousWindow = global.window;
    const previousDocument = global.document;
    try {
        global.window = { getCSRFToken: () => 'global-token' };
        global.document = { querySelector: () => null };
        assert.strictEqual(getCompanyAddCsrfToken(), 'global-token');
        global.window = { getCSRFToken: () => '' };
        global.document = { querySelector(selector) {
            if (selector === 'meta[name="csrf-token"]') {
                return { getAttribute: () => 'meta-token' };
            }
            return null;
        } };
        assert.strictEqual(getCompanyAddCsrfToken(), 'meta-token');
        global.document = { querySelector(selector) {
            return selector === 'input[name="_csrf"]' ? { value: 'input-token' } : null;
        } };
        assert.strictEqual(getCompanyAddCsrfToken(), 'input-token');
    } finally {
        global.window = previousWindow;
        global.document = previousDocument;
    }

    assert.strictEqual(isCompanyAddCsrfFailure(403, {
        error: 'CSRF validation failed', message: 'Invalid or missing CSRF token'
    }), true);
    assert.strictEqual(isCompanyAddCsrfFailure(403, {
        success: false, message: 'Δεν βρέθηκε πόρος'
    }), false);
    assert.strictEqual(companyAddErrorMessage(403, null,
        'Δεν έχετε δικαίωμα πρόσβασης'),
    'Δεν έχετε δικαίωμα πρόσβασης');
    assert.strictEqual(companyAddErrorMessage(403, {
        success: false, message: 'Δεν βρέθηκε πόρος'
    }), 'Δεν βρέθηκε πόρος');
    assert.strictEqual(safeCompanyAddResponseText('<pre>Error: private stack</pre>'), '');

    const successCalls = [];
    const successPage = createPage({
        token: 'valid-token',
        originalFetch: async (url, options) => {
            successCalls.push({ url, options });
            return response(200, { success: true, redirectUrl: '/companies/genikastoixeia' });
        }
    });
    await successPage.submit();
    assert.strictEqual(successCalls.length, 1);
    assert.strictEqual(successCalls[0].url, '/companies/genikastoixeia/add');
    assert.strictEqual(successCalls[0].options.headers.get('csrf-token'), 'valid-token');
    assert.strictEqual(successCalls[0].options.headers.get('x-csrf-token'), 'valid-token');
    assert.strictEqual(successCalls[0].options.credentials, 'include');
    assert.strictEqual(JSON.parse(successCalls[0].options.body).companyTeam, 'BLG');
    assert.strictEqual(successPage.swalCalls.at(-1).icon, 'success');
    assert.strictEqual(successPage.location.href, '/companies/genikastoixeia');

    const csrfCalls = [];
    const csrfPage = createPage({
        originalFetch: async (url, options) => {
            csrfCalls.push({ url, options });
            if (url === '/csrf-token') return response(500, { csrfToken: '' });
            return response(403, { error: 'CSRF validation failed',
                message: 'Invalid or missing CSRF token' });
        }
    });
    await csrfPage.submit();
    assert.strictEqual(csrfCalls.length, 2);
    assert.strictEqual(csrfCalls[1].url, '/csrf-token');
    assert.match(csrfPage.swalCalls.at(-1).text, /συνεδρία.*CSRF token/i);

    for (const scenario of [
        { body: 'Δεν έχετε δικαίωμα πρόσβασης', contentType: 'text/html; charset=utf-8' },
        { body: { success: false, message: 'Δεν βρέθηκε πόρος' }, contentType: 'application/json' }
    ]) {
        const calls = [];
        const page = createPage({
            originalFetch: async (url, options) => {
                calls.push({ url, options });
                return response(403, scenario.body, scenario.contentType);
            }
        });
        await page.submit();
        assert.strictEqual(calls.length, 1, 'non-CSRF 403 must not fetch a new token');
        const expected = typeof scenario.body === 'string' ? scenario.body : scenario.body.message;
        assert.strictEqual(page.swalCalls.at(-1).text, expected);
        assert.doesNotMatch(page.swalCalls.at(-1).text, /CSRF/i);
    }

    const retryCalls = [];
    const retryPage = createPage({
        token: 'stale-token',
        originalFetch: async (url, options) => {
            retryCalls.push({ url, options });
            if (url === '/csrf-token') return response(200, { csrfToken: 'fresh-token' });
            if (retryCalls.filter((call) => call.url !== '/csrf-token').length === 1) {
                return response(403, { error: 'CSRF validation failed',
                    message: 'Invalid or missing CSRF token' });
            }
            return response(200, { success: true });
        }
    });
    await retryPage.submit();
    assert.strictEqual(retryCalls.length, 3);
    assert.strictEqual(retryCalls[1].url, '/csrf-token');
    assert.strictEqual(retryCalls[2].options.headers.get('csrf-token'), 'fresh-token');
    assert.strictEqual(JSON.parse(retryCalls[2].options.body)._csrf, 'fresh-token');
    assert.strictEqual(retryPage.meta.content, 'fresh-token');
    assert.strictEqual(retryPage.csrfInput.value, 'fresh-token');
    assert.strictEqual(retryPage.swalCalls.at(-1).icon, 'success');

    const missingCalls = [];
    const missingPage = createPage({
        token: '',
        originalFetch: async (url, options) => {
            missingCalls.push({ url, options });
            if (url === '/csrf-token') return response(200, { csrfToken: 'obtained-token' });
            if (missingCalls.filter((call) => call.url !== '/csrf-token').length === 1) {
                assert.ok(!options.headers.get('csrf-token'));
                return response(403, { error: 'CSRF validation failed',
                    message: 'Invalid or missing CSRF token' });
            }
            return response(200, { success: true });
        }
    });
    await missingPage.submit();
    assert.strictEqual(missingCalls.length, 3);
    assert.strictEqual(missingCalls[2].options.headers.get('csrf-token'), 'obtained-token');
    assert.strictEqual(missingPage.swalCalls.at(-1).icon, 'success');

    const missingTeamCalls = [];
    const missingTeamPage = createPage({
        companyTeam: '',
        originalFetch: async (url, options) => {
            missingTeamCalls.push({ url, options });
            return response(200, { success: true });
        }
    });
    await missingTeamPage.submit();
    assert.strictEqual(missingTeamCalls.length, 0);
    assert.match(missingTeamPage.swalCalls.at(-1).html, /Ομάδα Εργασίας/);

    console.log('PASS company add team validation, CSRF retry and accurate 403 response handling');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
