const assert = require('node:assert/strict');
const test = require('node:test');

const erganhController = require('./erganhController');
const {
    downloadOrariaToBuffer,
    runErganhScheduleCriticalStep,
    sanitizeErganhPathname,
    selectErganhScheduleBranch,
    selectors
} = erganhController.__scheduleDownloadTestHooks;

function createLogger() {
    const entries = [];
    return {
        entries,
        error(tag, details) {
            entries.push({ tag, details });
        }
    };
}

function createFakePage({
    loginFormPresent = false,
    searchFormPresent = true,
    selectorCount = 1,
    optionValues = ['0001'],
    selectOptionError = null,
    loginClickError = null
} = {}) {
    return {
        url: () =>
            'https://eservices.yeka.gr/Mitroa/ErgazomenosWorkingSearch.aspx?token=secret',
        goto: async () => {},
        fill: async () => {},
        click: async (selector) => {
            if (selector.includes('SiteLogin_Login') && loginClickError) throw loginClickError;
        },
        waitForLoadState: async () => {},
        waitForTimeout: async () => {},
        waitForSelector: async (selector) => {
            if (selector === selectors.branch && selectorCount === 0) {
                const error = new Error('selector timeout');
                error.name = 'TimeoutError';
                throw error;
            }
        },
        selectOption: async () => {
            if (selectOptionError) throw selectOptionError;
            return [optionValues[0]];
        },
        locator(selector) {
            return {
                count: async () => {
                    if (selector === selectors.loginForm) return loginFormPresent ? 1 : 0;
                    if (selector === selectors.searchForm) return searchFormPresent ? 1 : 0;
                    if (selector === selectors.branch) return selectorCount;
                    if (selector === `${selectors.branch} option`) return optionValues.length;
                    return 0;
                },
                evaluate: async (_callback, requestedValue) =>
                    optionValues.includes(requestedValue)
            };
        },
        keyboard: { type: async () => {} }
    };
}

function createBrowserHarness(page) {
    let closeCount = 0;
    const context = {
        newPage: async () => page,
        unroute: async () => {},
        route: async () => {}
    };
    return {
        launchBrowser: async () => ({
            newContext: async () => context,
            close: async () => {
                closeCount += 1;
            }
        }),
        getCloseCount: () => closeCount
    };
}

async function runUntilExpectedFailure(page, logger) {
    const browser = createBrowserHarness(page);
    await assert.rejects(
        downloadOrariaToBuffer(
            'diagnostic-user-must-not-be-logged',
            'diagnostic-password-must-not-be-logged',
            '01/08/2026',
            '31/08/2026',
            '0001',
            { launchBrowser: browser.launchBrowser, logger }
        )
    );
    assert.equal(browser.getCloseCount(), 1);
}

test('completes authenticated navigation and selects an existing branch', async () => {
    const page = createFakePage();
    let navigationCompleted = false;
    await runErganhScheduleCriticalStep(
        page,
        'search-navigation',
        async () => {
            navigationCompleted = true;
        },
        createLogger()
    );
    await selectErganhScheduleBranch(page, '0001', createLogger());
    assert.equal(navigationCompleted, true);
});

test('fails fast when login or navigation did not reach the search state', async () => {
    const logger = createLogger();
    const page = createFakePage({ loginFormPresent: true, searchFormPresent: false });
    await runUntilExpectedFailure(page, logger);
    assert.equal(logger.entries.at(-1).details.errorCode, 'ERGANI_LOGIN_OR_NAVIGATION_FAILED');
});

test('does not swallow a critical login click failure', async () => {
    const logger = createLogger();
    const loginError = new Error('login click failed');
    loginError.name = 'TimeoutError';
    const page = createFakePage({ loginClickError: loginError });
    await runUntilExpectedFailure(page, logger);
    assert.equal(logger.entries.at(-1).details.errorCode, 'ERGANI_LOGIN_OR_NAVIGATION_FAILED');
    assert.equal(logger.entries.at(-1).details.playwrightErrorName, 'TimeoutError');
});

test('distinguishes a missing branch selector and closes the browser', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(createFakePage({ selectorCount: 0 }), logger);
    assert.equal(logger.entries.at(-1).details.errorCode, 'ERGANI_BRANCH_SELECTOR_MISSING');
});

test('distinguishes a missing requested option and closes the browser', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(createFakePage({ optionValues: ['0002'] }), logger);
    assert.equal(logger.entries.at(-1).details.errorCode, 'ERGANI_BRANCH_OPTION_MISSING');
    assert.equal(logger.entries.at(-1).details.optionCount, 1);
});

test('wraps selectOption failure with a stable code and closes the browser', async () => {
    const logger = createLogger();
    const selectionError = new Error('private Playwright details');
    selectionError.name = 'TimeoutError';
    await runUntilExpectedFailure(createFakePage({ selectOptionError: selectionError }), logger);
    assert.equal(logger.entries.at(-1).details.errorCode, 'ERGANI_BRANCH_SELECTION_FAILED');
    assert.equal(logger.entries.at(-1).details.playwrightErrorName, 'TimeoutError');
});

test('diagnostics contain a sanitized pathname and no sensitive page content', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(createFakePage({ optionValues: ['0002'] }), logger);

    assert.equal(
        logger.entries.at(-1).details.pathname,
        '/Mitroa/ErgazomenosWorkingSearch.aspx'
    );
    assert.equal(
        sanitizeErganhPathname('https://example.test/search?q=secret#fragment'),
        '/search'
    );

    const diagnostics = JSON.stringify(logger.entries);
    assert.doesNotMatch(diagnostics, /diagnostic-user-must-not-be-logged/);
    assert.doesNotMatch(diagnostics, /diagnostic-password-must-not-be-logged/);
    assert.doesNotMatch(diagnostics, /token=secret/);
    assert.doesNotMatch(diagnostics, /private Playwright details/);
    assert.doesNotMatch(diagnostics, /option label|<html/i);
});
