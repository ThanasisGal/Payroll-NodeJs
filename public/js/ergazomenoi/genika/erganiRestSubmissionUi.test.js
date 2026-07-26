'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.resolve(__dirname, 'erganiRestSubmissionUi.js');

function loadUi({ fetchImpl, swalImpl, events = [], loaderElements = [] } = {}) {
    delete require.cache[modulePath];

    global.location = { origin: 'https://payroll.test' };
    global.document = {
        querySelector: () => ({ content: 'csrf-test' }),
        querySelectorAll: () => loaderElements,
        getElementById: () => null
    };
    global.hideLoader = () => events.push('loader-close');
    global.AppLoader = { hide: () => events.push('app-loader-close') };
    global.open = () => {};
    global.fetch =
        fetchImpl ||
        (async () => ({
            status: 500,
            json: async () => ({ success: false, pdfDeferred: true })
        }));
    global.Swal = {
        isVisible: () => false,
        close: () => events.push('swal-close'),
        showLoading: () => events.push('swal-loading'),
        fire: async (options) => {
            events.push(options.html?.includes('<iframe') ? 'pdf-modal' : 'result-modal');
            if (options.didOpen) options.didOpen();
            return swalImpl ? swalImpl(options) : { isConfirmed: false };
        }
    };

    return require(modulePath);
}

test('normalizes all supported REST codes through one contract', () => {
    const ui = loadUi();
    for (const submissionCode of [
        'WebE3N',
        'WTOWeek',
        'WebMA',
        'WebE5N',
        'WebE6NMP',
        'WebE6NXP',
        'WebE7N'
    ]) {
        assert.equal(ui.normalizeResult({ success: true, submissionCode }).submissionCode, submissionCode);
    }
});

test('accepts only the submitted-PDF same-origin application route', () => {
    const ui = loadUi();
    const validPath =
        '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011';
    assert.equal(
        ui.getSafeSameOriginPdfUrl(validPath),
        validPath
    );
    assert.equal(ui.getSafeSameOriginPdfUrl('https://evil.test/file.pdf'), '');
    assert.equal(ui.getSafeSameOriginPdfUrl('/unrelated/file.pdf'), '');
    assert.equal(ui.getSafeSameOriginPdfUrl(`${validPath}/retry`), '');
    assert.equal(ui.getSafeSameOriginPdfUrl(`${validPath}/extra`), '');
    assert.equal(ui.getSafeSameOriginPdfUrl(`${validPath}?download=1`), '');
    assert.equal(ui.getSafeSameOriginPdfUrl(`${validPath}#page=1`), '');
    assert.equal(ui.getSafeSameOriginPdfUrl('/ergazomenoi/ergazomenoi/ergani/pdf/not-an-id'), '');
    assert.equal(
        ui.getSafeSameOriginPdfUrl(
            '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011/../../other'
        ),
        ''
    );
});

test('closeLoaders uses canonical APIs without persistent DOM mutations', () => {
    const events = [];
    const addedClasses = [];
    const loader = {
        classList: {
            add: (...classes) => addedClasses.push(...classes),
            remove: () => {}
        },
        style: {},
        setAttribute: () => {
            throw new Error('closeLoaders must not write loader attributes');
        }
    };
    const ui = loadUi({ events, loaderElements: [loader] });

    ui.closeLoaders();

    assert.ok(events.includes('loader-close'));
    assert.ok(events.includes('app-loader-close'));
    assert.equal(addedClasses.includes('is-hidden'), false);
    assert.equal(loader.style.display, undefined);
    assert.equal(loader.style.visibility, undefined);
    assert.equal(loader.style.opacity, undefined);
});

test('direct PDF result closes loader before rendering iframe', async () => {
    const events = [];
    const ui = loadUi({ events });
    await ui.presentSubmissionResult({
        success: true,
        submissionCode: 'WebE3N',
        pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
    });
    assert.ok(events.includes('pdf-modal'));
    assert.ok(events.indexOf('loader-close') < events.indexOf('pdf-modal'));
    assert.ok(events.indexOf('app-loader-close') < events.indexOf('pdf-modal'));
});

test('deferred result calls scoped retry endpoint with CSRF and credentials', async () => {
    let request;
    const ui = loadUi({
        fetchImpl: async (url, options) => {
            request = { url, options };
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
                })
            };
        }
    });

    await ui.presentSubmissionResult({
        success: true,
        pdfDeferred: true,
        erganhLogId: '507f1f77bcf86cd799439011'
    });

    assert.equal(
        request.url,
        '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011/retry'
    );
    assert.equal(request.options.credentials, 'include');
    assert.equal(request.options.skipLoader, true);
    assert.equal(request.options.headers['CSRF-Token'], 'csrf-test');
});

test('global fetch wrapper preserves the skipLoader opt-out contract', () => {
    const layout = fs.readFileSync(
        path.resolve(__dirname, '../../../../views/layouts/main.ejs'),
        'utf8'
    );
    assert.match(
        layout,
        /if \(init && init\.skipLoader\) return _fetch\(input, init\)/
    );
});

test('successful retry renders iframe', async () => {
    const events = [];
    const ui = loadUi({
        events,
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
            })
        })
    });
    await ui.presentSubmissionResult({
        success: true,
        pdfDeferred: true,
        erganhLogId: '507f1f77bcf86cd799439011'
    });
    assert.ok(events.includes('pdf-modal'));
});

test('failed retry keeps submission successful and does not render empty iframe', async () => {
    const events = [];
    const ui = loadUi({
        events,
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: false,
                pdfDeferred: true,
                message: 'Το PDF δεν είναι ακόμη διαθέσιμο.'
            })
        })
    });
    const result = await ui.presentSubmissionResult({
        success: true,
        submissionCode: 'WebE5N',
        pdfDeferred: true,
        erganhLogId: '507f1f77bcf86cd799439011'
    });
    assert.equal(result.success, true);
    assert.equal(result.pdfDeferred, true);
    assert.equal(events.includes('pdf-modal'), false);
});

test('network retry error keeps submission successful and offers manual retry', async () => {
    const events = [];
    const ui = loadUi({
        events,
        fetchImpl: async () => {
            throw new TypeError('Failed to fetch');
        }
    });

    const result = await ui.presentSubmissionResult({
        success: true,
        submissionCode: 'WebE3N',
        pdfDeferred: true,
        erganhLogId: '507f1f77bcf86cd799439011'
    });

    assert.equal(result.success, true);
    assert.equal(result.pdfDeferred, true);
    assert.equal(events.includes('pdf-modal'), false);
    assert.ok(events.includes('result-modal'));
});

test('presentation failure cannot turn a successful submission into failure', async () => {
    const ui = loadUi({
        swalImpl: () => {
            throw new Error('render failed');
        }
    });

    const result = await ui.presentSubmissionResultSafely({
        success: true,
        submissionCode: 'WebE7N',
        pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
    });

    assert.equal(result.success, true);
    assert.equal(result.submissionCode, 'WebE7N');
});

test('HTTP error cannot be overridden by payload success', async () => {
    const ui = loadUi({
        fetchImpl: async () => ({
            ok: false,
            status: 503,
            json: async () => ({ success: true, pdfUrl: '/should-not-be-used' })
        })
    });

    const result = await ui.retrySubmittedPdf('507f1f77bcf86cd799439011');
    assert.equal(result.success, false);
    assert.equal(result.pdfDeferred, true);
    assert.equal(result.pdfUrl, '');
    assert.equal(result.errorCategory, 'PDF_RETRY_HTTP_ERROR');
});

test('unsafe external PDF URL never renders an iframe', async () => {
    const events = [];
    const ui = loadUi({ events });
    await ui.presentSubmissionResult({
        success: true,
        pdfUrl: 'https://evil.test/submitted.pdf'
    });
    assert.equal(events.includes('pdf-modal'), false);
});

test('dynamic values are escaped before SweetAlert HTML', () => {
    const ui = loadUi();
    assert.equal(
        ui.escapeHtml('<img src=x onerror="alert(1)">'),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
});

test('PDF modal links protect new tabs without escaping plain SweetAlert titles', () => {
    const source = fs.readFileSync(modulePath, 'utf8');
    assert.match(source, /target="_blank" rel="noopener noreferrer"/);
    assert.match(source, /`ΕΡΓΑΝΗ - \$\{result\.submissionCode\}`/);
    assert.doesNotMatch(source, /`ΕΡΓΑΝΗ - \$\{escapeHtml\(result\.submissionCode\)\}`/);
});

test('invalid log id cannot trigger retry fetch', async () => {
    let called = false;
    const ui = loadUi({
        fetchImpl: async () => {
            called = true;
            throw new Error('must not run');
        }
    });
    const result = await ui.retrySubmittedPdf('../foreign-object');
    assert.equal(called, false);
    assert.equal(result.success, false);
});

test('add flow preserves independent E3N and WTOWeek results', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'getFieldValues.js'), 'utf8');
    assert.match(source, /const submissionResults = \[\]/);
    assert.match(source, /submissionResults\.push\(e3Result\)/);
    assert.match(source, /submissionResults\.push\(wtoResult\)/);
});

test('redirect remains after awaited submission result presentation', () => {
    const addSource = fs.readFileSync(path.resolve(__dirname, 'getFieldValues.js'), 'utf8');
    const updateSource = fs.readFileSync(path.resolve(__dirname, 'putFieldValues.js'), 'utf8');
    assert.match(
        addSource,
        /const uploadResults = await runRestUploadsAfterEmployeeSave\([\s\S]*window\.location\.href = data\.redirectUrl/
    );
    assert.match(
        updateSource,
        /const uploadResults = await runXmlUploads\(\)[\s\S]*window\.location\.href = data\.redirectUrl/
    );
});

test('submission exceptions are separated from presentation exceptions', () => {
    const addSource = fs.readFileSync(path.resolve(__dirname, 'getFieldValues.js'), 'utf8');
    const updateSource = fs.readFileSync(path.resolve(__dirname, 'putFieldValues.js'), 'utf8');
    const addFlow = addSource.slice(
        addSource.indexOf('async function runRestUploadsAfterEmployeeSave'),
        addSource.indexOf('async function showContractPdfModalAndWait')
    );
    const updateFlow = updateSource.slice(
        updateSource.indexOf('const runXmlUploads = async () =>'),
        updateSource.indexOf('const uploadResults = await runXmlUploads()')
    );

    for (const [source, submitCall] of [
        [addFlow, 'await submitE3NRestToErganh'],
        [addFlow, 'await submitWTOWeekRestToErganh'],
        [updateFlow, 'await submitE3NRestToErganh'],
        [updateFlow, 'await uploadMaToErganh'],
        [updateFlow, 'await uploadWtoToErganh']
    ]) {
        const submitIndex = source.indexOf(submitCall);
        const catchIndex = source.indexOf('} catch', submitIndex);
        const presentationIndex = source.indexOf(
            'await presentErganiRestSubmissionResult',
            submitIndex
        );
        assert.ok(submitIndex >= 0);
        assert.ok(catchIndex > submitIndex);
        assert.ok(presentationIndex > catchIndex);
    }
});

test('add and edit render the shared UI before one active orchestration script', () => {
    const addView = fs.readFileSync(
        path.resolve(__dirname, '../../../../views/ergazomenoi/ergazomenoi/add.ejs'),
        'utf8'
    );
    const editView = fs.readFileSync(
        path.resolve(__dirname, '../../../../views/ergazomenoi/ergazomenoi/edit.ejs'),
        'utf8'
    );
    const withoutHtmlComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '');
    const activeEdit = withoutHtmlComments(editView);

    assert.ok(
        addView.indexOf("script('ergazomenoi/genika/erganiRestSubmissionUi')") <
            addView.indexOf("script('ergazomenoi/genika/getFieldValues')")
    );
    assert.ok(
        activeEdit.indexOf("script('ergazomenoi/genika/erganiRestSubmissionUi')") <
            activeEdit.indexOf("script('ergazomenoi/genika/putFieldValues')")
    );
    assert.equal(
        (
            activeEdit.match(
                /<script[^>]+src="<%= script\('ergazomenoi\/genika\/putFieldValues'\) %>"/g
            ) || []
        ).length,
        1
    );
});
