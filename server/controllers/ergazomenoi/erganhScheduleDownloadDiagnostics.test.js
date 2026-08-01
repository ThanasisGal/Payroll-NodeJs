const assert = require('node:assert/strict');
const test = require('node:test');

const erganhController = require('./erganhController');
const {
    downloadOrariaToBuffer,
    getErganhScheduleState,
    logErganhScheduleDiagnostic,
    runErganhScheduleCriticalStep,
    selectErganhScheduleBranch,
    selectors
} = erganhController.__scheduleDownloadTestHooks;

function createLogger({ throws = false } = {}) {
    const entries = [];
    return {
        entries,
        error(tag, details) {
            if (throws) throw new Error('logger-secret-message');
            entries.push({ tag, details });
        }
    };
}

function createFakePage({
    loginFormPresent = false,
    searchFormPresent = true,
    selectorCount = 1,
    optionValues = ['0001'],
    urlError = false,
    locatorError = false,
    countError = false,
    hiddenBranch = false,
    optionEvaluateError = false,
    selectOptionError = false,
    selectedValues,
    loginClickError = false,
    disconnectOnLoginFailure = false,
    disconnectOnBranchWait = false,
    postBranchError = false
} = {}) {
    let disconnected = false;
    const selectOptionCalls = [];
    const page = {
        selectOptionCalls,
        url() {
            if (urlError || disconnected) throw new Error('raw-url-secret');
            return 'https://eservices.yeka.gr/Mitroa/ErgazomenosWorkingSearch.aspx?token=secret';
        },
        goto: async () => {},
        fill: async () => {},
        click: async (selector) => {
            if (selector.includes('SiteLogin_Login') && loginClickError) {
                if (disconnectOnLoginFailure) disconnected = true;
                const error = new Error('raw-login-secret');
                error.name = 'TimeoutError';
                throw error;
            }
            if (postBranchError && selector.includes('DateFromEdit')) {
                throw new Error('EXPECTED_POST_BRANCH_STOP');
            }
        },
        waitForTimeout: async () => {},
        waitForSelector: async (selector, options = {}) => {
            if (selector !== selectors.branch) return;
            if (disconnectOnBranchWait) {
                disconnected = true;
                throw new Error('raw-disconnected-secret');
            }
            if (selectorCount === 0 || (hiddenBranch && options.state === 'visible')) {
                const error = new Error('raw-selector-secret');
                error.name = 'TimeoutError';
                throw error;
            }
        },
        selectOption: async (selector, value) => {
            selectOptionCalls.push({ selector, value });
            if (selectOptionError) {
                const error = new Error('raw-select-secret');
                error.name = 'TimeoutError';
                throw error;
            }
            return selectedValues === undefined ? [value] : selectedValues;
        },
        locator(selector) {
            if (locatorError || disconnected) throw new Error('raw-locator-secret');
            return {
                count: async () => {
                    if (countError) throw new Error('raw-count-secret');
                    if (selector === selectors.loginForm) return loginFormPresent ? 1 : 0;
                    if (selector === selectors.searchForm) return searchFormPresent ? 1 : 0;
                    if (selector === selectors.branch) return selectorCount;
                    if (selector === `${selectors.branch} option`) return optionValues.length;
                    return 0;
                },
                evaluate: async (_callback, requestedValue) => {
                    if (optionEvaluateError) throw new Error('raw-evaluate-secret');
                    return optionValues.includes(requestedValue);
                }
            };
        },
        keyboard: { type: async () => {} }
    };
    return page;
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

async function runUntilExpectedFailure(page, logger, expectedCode) {
    const browser = createBrowserHarness(page);
    await assert.rejects(
        downloadOrariaToBuffer(
            'diagnostic-user-must-not-be-logged',
            'diagnostic-password-must-not-be-logged',
            '01/08/2026',
            '31/08/2026',
            '0001',
            { launchBrowser: browser.launchBrowser, logger }
        ),
        (error) => error?.code === expectedCode
    );
    assert.equal(browser.getCloseCount(), 1);
    return browser;
}

test('diagnostic state is available only when every independent read succeeds', async () => {
    const available = await getErganhScheduleState(createFakePage());
    assert.equal(available.diagnosticStateAvailable, true);
    assert.equal(available.selectorCount, 1);

    const urlUnavailable = await getErganhScheduleState(createFakePage({ urlError: true }));
    assert.equal(urlUnavailable.diagnosticStateAvailable, false);
    assert.equal(urlUnavailable.url, '');
    assert.equal(urlUnavailable.selectorCount, 1);

    for (const page of [
        createFakePage({ locatorError: true }),
        createFakePage({ countError: true })
    ]) {
        const domUnavailable = await getErganhScheduleState(page);
        assert.equal(domUnavailable.diagnosticStateAvailable, false);
        assert.equal(domUnavailable.selectorCount, -1);
        assert.equal(domUnavailable.optionCount, -1);
        assert.equal(domUnavailable.loginFormPresent, false);
        assert.equal(domUnavailable.searchFormPresent, false);
    }
});

test('critical login failure keeps its stable code when the page disconnects', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(
        createFakePage({ loginClickError: true, disconnectOnLoginFailure: true }),
        logger,
        'ERGANI_LOGIN_OR_NAVIGATION_FAILED'
    );
    assert.equal(logger.entries.at(-1).details.diagnosticStateAvailable, false);
    assert.equal(logger.entries.at(-1).details.selectorCount, -1);
});

test('critical step keeps its stable code when diagnostics and logger both fail', async () => {
    const page = createFakePage({ locatorError: true });
    await assert.rejects(
        runErganhScheduleCriticalStep(
            page,
            'login-submit',
            async () => {
                throw new Error('raw-action-secret');
            },
            createLogger({ throws: true })
        ),
        (error) => error?.code === 'ERGANI_LOGIN_OR_NAVIGATION_FAILED'
    );
});

test('branch disconnection maps to selection failed and still closes browser', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(
        createFakePage({ disconnectOnBranchWait: true }),
        logger,
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
    assert.equal(logger.entries.at(-1).details.diagnosticStateAvailable, false);
});

test('missing, duplicate, and hidden branch selectors have distinct safe outcomes', async () => {
    await runUntilExpectedFailure(
        createFakePage({ selectorCount: 0 }),
        createLogger(),
        'ERGANI_BRANCH_SELECTOR_MISSING'
    );
    await runUntilExpectedFailure(
        createFakePage({ selectorCount: 2 }),
        createLogger(),
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
    await runUntilExpectedFailure(
        createFakePage({ hiddenBranch: true }),
        createLogger(),
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
});

test('preserves string branch 0000 and numeric branch 0', async () => {
    for (const [branch, expected] of [
        ['0000', '0000'],
        [0, '0']
    ]) {
        const page = createFakePage({ optionValues: [expected] });
        await selectErganhScheduleBranch(page, branch, createLogger());
        assert.equal(page.selectOptionCalls[0].value, expected);
    }
});

test('empty or undefined branch remains empty without coercing another value', async () => {
    for (const branch of ['', undefined]) {
        const page = createFakePage({ optionValues: [] });
        const logger = createLogger();
        await assert.rejects(
            selectErganhScheduleBranch(page, branch, logger),
            (error) => error?.code === 'ERGANI_BRANCH_OPTION_MISSING'
        );
        assert.equal(logger.entries.at(-1).details.requestedBranch, '');
    }
});

test('missing option is reported only after successful DOM evaluation', async () => {
    await runUntilExpectedFailure(
        createFakePage({ optionValues: ['0002'] }),
        createLogger(),
        'ERGANI_BRANCH_OPTION_MISSING'
    );
});

test('option evaluation failure maps to branch selection failed', async () => {
    await runUntilExpectedFailure(
        createFakePage({ optionEvaluateError: true }),
        createLogger(),
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
});

test('selectOption throw or unconfirmed returned value maps to selection failed', async () => {
    await runUntilExpectedFailure(
        createFakePage({ selectOptionError: true }),
        createLogger(),
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
    await runUntilExpectedFailure(
        createFakePage({ selectedValues: ['9999'] }),
        createLogger(),
        'ERGANI_BRANCH_SELECTION_FAILED'
    );
});

test('full flow reaches branch selection then stops before search/export and closes browser', async () => {
    const page = createFakePage({ postBranchError: true });
    const browser = createBrowserHarness(page);
    await assert.rejects(
        downloadOrariaToBuffer('user', 'password', '01/08/2026', '31/08/2026', '0001', {
            launchBrowser: browser.launchBrowser,
            logger: createLogger()
        }),
        /EXPECTED_POST_BRANCH_STOP/
    );
    assert.deepEqual(page.selectOptionCalls, [{ selector: selectors.branch, value: '0001' }]);
    assert.equal(browser.getCloseCount(), 1);
});

test('diagnostics are allowlisted, sanitized, and contain no raw failures or secrets', async () => {
    const logger = createLogger();
    await runUntilExpectedFailure(
        createFakePage({ optionEvaluateError: true }),
        logger,
        'ERGANI_BRANCH_SELECTION_FAILED'
    );

    const details = logger.entries.at(-1).details;
    assert.equal(details.pathname, '/Mitroa/ErgazomenosWorkingSearch.aspx');
    assert.deepEqual(Object.keys(details).sort(), [
        'diagnosticStateAvailable',
        'errorCode',
        'loginFormPresent',
        'optionCount',
        'pathname',
        'playwrightErrorName',
        'requestedBranch',
        'searchFormPresent',
        'selectorCount',
        'stage'
    ]);

    const diagnostics = JSON.stringify(logger.entries);
    for (const forbidden of [
        'diagnostic-user-must-not-be-logged',
        'diagnostic-password-must-not-be-logged',
        'token=secret',
        'raw-evaluate-secret',
        'logger-secret-message',
        '<html',
        'option label',
        'stack',
        'cause'
    ]) {
        assert.equal(diagnostics.includes(forbidden), false);
    }
});
