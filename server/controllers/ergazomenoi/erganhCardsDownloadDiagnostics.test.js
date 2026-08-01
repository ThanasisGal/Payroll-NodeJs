const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('./erganhController');
const {
    codes,
    downloadKartesXlsxToBuffer,
    downloadPrepareStoreAndPersistCards,
    logErganhCardsDiagnostic,
    prepareKartesXlsx,
    saveKartesPayloadToMongo,
    selectErganhCardsBranch,
    validateKartesXlsxBuffer,
    selectors
} = controller.__cardsDownloadTestHooks;

function option(record) {
    const group = record.optgroupDisabled ? { disabled: true } : null;
    return {
        value: String(record.value),
        textContent: record.text || '',
        disabled: record.disabled === true,
        closest: (name) => (name === 'optgroup' ? group : null)
    };
}

function branchPage(config = {}) {
    let options = (config.options || []).map(option);
    let selected = null;
    let reads = 0;
    const calls = [];
    const select = {
        get options() { return options; },
        get selectedOptions() { return selected ? [selected] : []; }
    };
    return {
        calls,
        url: async () => 'https://eservices.yeka.gr/WTO/Workcard/DailyWorkTimesSearch.aspx?secret=x',
        waitForSelector: async () => {
            if (config.selectorMissing) throw new Error('raw selector');
        },
        waitForFunction: async (fn, arg) => {
            const previous = global.document;
            global.document = { querySelector: () => select };
            try {
                if (!fn(arg) && config.asyncOptions) {
                    options = config.asyncOptions.map(option);
                    if (!fn(arg)) throw new Error('raw wait');
                }
            } finally { global.document = previous; }
        },
        selectOption: async (selector, value) => {
            calls.push({ selector, value });
            selected = options.find((item) => item.value === (config.selectedValue || value)) || null;
            if (config.afterOptions) options = config.afterOptions.map(option);
            return config.returnedValues || [value];
        },
        locator(selector) {
            return {
                count: async () => {
                    if (selector === selectors.loginForm) return 0;
                    if (selector === selectors.searchForm) return 1;
                    if (selector === selectors.branch) return config.selectorCount ?? 1;
                    if (selector === `${selectors.branch} option`) return options.length;
                    return 0;
                },
                evaluate: async (fn) => {
                    if (selector === selectors.branch) {
                        reads += 1;
                        if (reads === 2 && config.beforeOptions) options = config.beforeOptions.map(option);
                        return fn(select);
                    }
                    return null;
                }
            };
        }
    };
}

test('cards maps requested 0000 to the real raw value 0', async () => {
    const page = branchPage({ options: [{ value: '0', text: '0 - Κεντρικό' }] });
    await selectErganhCardsBranch(page, '0000', { error() {} });
    assert.deepEqual(page.calls, [{ selector: selectors.branch, value: '0' }]);
});

test('cards keeps exact, normalized numeric, then label priority', async () => {
    for (const [options, expected] of [
        [[{ value: '1', text: 'normalized' }, { value: '0001', text: 'exact' }], '0001'],
        [[{ value: '1', text: 'normalized' }, { value: 'label', text: '0001 label' }], '1'],
        [[{ value: 'label', text: '0001 label' }], 'label']
    ]) {
        const page = branchPage({ options });
        await selectErganhCardsBranch(page, '0001', { error() {} });
        assert.equal(page.calls[0].value, expected);
    }
});

test('cards rejects missing, duplicate, disabled and disabled-optgroup options', async () => {
    for (const [options, expected] of [
        [[], codes.optionMissing],
        [[{ value: '0' }, { value: '00' }], codes.selectionFailed],
        [[{ value: '0', disabled: true }], codes.optionMissing],
        [[{ value: 'x', text: '0000 branch', optgroupDisabled: true }], codes.optionMissing]
    ]) {
        await assert.rejects(
            selectErganhCardsBranch(branchPage({ options }), '0000', { error() {} }),
            (error) => error?.code === expected
        );
    }
});

test('cards re-resolves the full collection before and after selection', async () => {
    const before = branchPage({
        options: [{ value: 'fallback', text: '0000 branch' }],
        beforeOptions: [{ value: 'fallback', text: '0000 branch' }, { value: '0' }]
    });
    await selectErganhCardsBranch(before, '0000', { error() {} });
    assert.equal(before.calls[0].value, '0');

    const after = branchPage({
        options: [{ value: 'fallback', text: '0000 branch' }],
        afterOptions: [{ value: 'fallback', text: '0000 branch' }, { value: '0' }]
    });
    await assert.rejects(
        selectErganhCardsBranch(after, '0000', { error() {} }),
        (error) => error?.code === codes.selectionFailed
    );
});

test('cards rejects a wrong selected DOM value', async () => {
    const page = branchPage({
        options: [{ value: '0' }, { value: '1' }],
        selectedValue: '1'
    });
    await assert.rejects(
        selectErganhCardsBranch(page, '0000', { error() {} }),
        (error) => error?.code === codes.selectionFailed
    );
});

test('cards diagnostics expose only allowlisted safe fields', () => {
    const entries = [];
    logErganhCardsDiagnostic({ error: (tag, details) => entries.push({ tag, details }) }, {
        stage: 'branch',
        url: 'https://host/path?token=secret',
        requestedBranch: '0000',
        html: '<option>secret</option>',
        message: 'raw playwright message',
        stack: 'secret stack',
        cause: 'secret cause'
    });
    const serialized = JSON.stringify(entries);
    assert.match(serialized, /"pathname":"\/path"/);
    for (const forbidden of ['token=secret', '<option>', 'raw playwright', 'secret stack', 'secret cause']) {
        assert.equal(serialized.includes(forbidden), false);
    }
});

test('cards frontend maps stable persistence codes without rendering raw server messages', () => {
    const frontend = fs.readFileSync(path.resolve(
        __dirname, '../../../public/js/ergazomenoi/programmata/downloadCardsButton.js'
    ), 'utf8');
    for (const code of [
        'ERGANI_CARDS_PROCESSING_FAILED',
        'ERGANI_CARDS_UPLOAD_FAILED',
        'ERGANI_CARDS_DATABASE_FAILED'
    ]) assert.ok(frontend.includes(code));
    assert.equal(/data\.message/.test(frontend), false);
});

async function sourceWorkbookBuffer() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Source');
    sheet.addRow(['Παράρτημα', 'ΑΦΜ', 'Επώνυμο', 'Όνομα', 'Ημερομηνία', 'Είσοδος', 'Έξοδος']);
    sheet.addRow(['0000', '123456789', 'TEST', 'USER', '01/06/2026', '08:00', '16:00']);
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

function orchestrationOptions() {
    return {
        username: 'user', password: 'password', selectedPararthma: '0000',
        apoHmeromhnia: '01/06/2026', eosHmeromhnia: '30/06/2026',
        s3Key: 'xlsx/team/company/Apasxolhseis_Apo_Kartes/JUNE.xlsx'
    };
}

test('full orchestration is download, source validation, pure processing, processed validation, storage, DB', async () => {
    const source = await sourceWorkbookBuffer();
    const calls = [];
    const result = await downloadPrepareStoreAndPersistCards(orchestrationOptions(), {
        download: async () => { calls.push('download'); return source; },
        validate: async (buffer) => { calls.push(buffer === source ? 'validate-source' : 'validate-processed'); return validateKartesXlsxBuffer(buffer); },
        prepare: async (buffer, date) => { calls.push('process'); return prepareKartesXlsx(buffer, date); },
        store: async () => { calls.push('storage'); },
        persist: async (payload) => { calls.push('db'); assert.equal(payload.length, 1); }
    });
    await validateKartesXlsxBuffer(result);
    assert.deepEqual(calls, ['download', 'validate-source', 'process', 'validate-processed', 'storage', 'db']);
});

test('invalid source and processing failures happen before storage or DB', async () => {
    for (const [dependencies, expectedCode] of [
        [{ download: async () => Buffer.from('not-xlsx'), validate: validateKartesXlsxBuffer }, codes.downloadInvalid],
        [{ download: sourceWorkbookBuffer, validate: validateKartesXlsxBuffer, prepare: async () => { throw new Error('processing'); } }, codes.processingFailed],
        [{ download: sourceWorkbookBuffer, validate: async (buffer) => {
            if (buffer.toString() === 'bad-processed') throw new Error('post validation');
            return validateKartesXlsxBuffer(buffer);
        }, prepare: async () => ({ processedBuffer: Buffer.from('bad-processed'), persistencePayload: [] }) }, codes.processingFailed]
    ]) {
        let storage = 0;
        let db = 0;
        await assert.rejects(downloadPrepareStoreAndPersistCards(orchestrationOptions(), {
            ...dependencies,
            store: async () => { storage += 1; },
            persist: async () => { db += 1; }
        }), (error) => error?.code === expectedCode);
        assert.equal(storage, 0);
        assert.equal(db, 0);
    }
});

test('storage failure prevents DB and returns stable upload code', async () => {
    const source = await sourceWorkbookBuffer();
    let storage = 0;
    let db = 0;
    await assert.rejects(downloadPrepareStoreAndPersistCards(orchestrationOptions(), {
        download: async () => source,
        validate: validateKartesXlsxBuffer,
        prepare: prepareKartesXlsx,
        store: async () => { storage += 1; throw new Error('raw storage'); },
        persist: async () => { db += 1; }
    }), (error) => error?.code === codes.uploadFailed);
    assert.equal(storage, 1);
    assert.equal(db, 0);
});

test('database failure occurs only after one successful storage and returns stable code', async () => {
    const source = await sourceWorkbookBuffer();
    const calls = [];
    await assert.rejects(downloadPrepareStoreAndPersistCards(orchestrationOptions(), {
        download: async () => source,
        validate: validateKartesXlsxBuffer,
        prepare: prepareKartesXlsx,
        store: async () => { calls.push('storage'); },
        persist: async () => { calls.push('db'); throw new Error('raw mongo'); }
    }), (error) => error?.code === codes.databaseFailed);
    assert.deepEqual(calls, ['storage', 'db']);
});

test('retry persistence produces deterministic idempotent update filters without inserts', async () => {
    const source = await sourceWorkbookBuffer();
    const prepared = await prepareKartesXlsx(source, '01/06/2026');
    const writes = [];
    const dependencies = {
        ergazomenoiModel: { find: () => ({ lean: async () => [{ afm: '123456789', team: 'T', company_kod: 'C', kodikos: 'E' }] }) },
        prodhlomenaModel: { bulkWrite: async (ops) => { writes.push(ops); return { matchedCount: 1, modifiedCount: 1 }; } }
    };
    await saveKartesPayloadToMongo(prepared.persistencePayload, dependencies);
    await saveKartesPayloadToMongo(prepared.persistencePayload, dependencies);
    assert.deepEqual(writes[0], writes[1]);
    assert.equal(writes[0][0].updateOne.upsert, false);
    assert.deepEqual(Object.keys(writes[0][0].updateOne.filter).sort(), ['company_kod', 'hmeromhnia', 'kodikos', 'team', 'ypokatasthma']);
    assert.ok(writes[0][0].updateOne.update.$set);
});

test('failure before branch selection closes the cards browser exactly once', async () => {
    let closeCount = 0;
    const page = {
        goto: async () => { throw new Error('offline login failure'); },
        locator: () => ({ count: async () => 0 }),
        url: async () => 'https://host/login?secret=x'
    };
    await assert.rejects(downloadKartesXlsxToBuffer(
        'user', 'password', '0000', '01/06/2026', '30/06/2026', {
            logger: { error() {} },
            launchBrowser: async () => ({
                newContext: async () => ({ newPage: async () => page }),
                close: async () => { closeCount += 1; }
            })
        }
    ), (error) => error?.code === codes.loginOrNavigation);
    assert.equal(closeCount, 1);
});

test('cards browser closes exactly once when context creation fails', async () => {
    let closeCount = 0;
    await assert.rejects(downloadKartesXlsxToBuffer(
        'user', 'password', '0000', '01/06/2026', '30/06/2026', {
            logger: { error() {} },
            launchBrowser: async () => ({
                newContext: async () => { throw new Error('offline context failure'); },
                close: async () => { closeCount += 1; }
            })
        }
    ), (error) => error?.code === codes.downloadFailed);
    assert.equal(closeCount, 1);
});

function cardsDownloadFailureHarness(stage) {
    const page = branchPage({ options: [{ value: '0', text: '0 - Main' }] });
    const baseWaitForSelector = page.waitForSelector;
    const baseSelectOption = page.selectOption;
    page.goto = async () => { if (stage === 'login') throw new Error('login'); };
    page.fill = async () => {};
    page.waitForTimeout = async () => {};
    page.waitForLoadState = async () => {};
    page.keyboard = { type: async () => {} };
    page.click = async (selector) => {
        if (stage === 'date' && selector.includes('DateFromEdit')) throw new Error('date');
        if (stage === 'search' && selector === selectors.searchForm) throw new Error('search');
    };
    page.waitForSelector = async (selector, options) => {
        if (stage === 'export' && selector === 'img.ExcelExport') throw new Error('export');
        return baseWaitForSelector(selector, options);
    };
    page.selectOption = async (...args) => {
        if (stage === 'branch') throw new Error('branch');
        return baseSelectOption(...args);
    };
    page.evaluate = async () => { throw new Error('download'); };
    const context = { newPage: async () => page, unroute: async () => {}, route: async () => {} };
    let closeCount = 0;
    return {
        launchBrowser: async () => ({
            newContext: async () => context,
            close: async () => { closeCount += 1; }
        }),
        closeCount: () => closeCount
    };
}

test('cards closes browser exactly once for login, branch, date, search, export and download failures', async () => {
    for (const stage of ['login', 'branch', 'date', 'search', 'export', 'download']) {
        const harness = cardsDownloadFailureHarness(stage);
        await assert.rejects(downloadKartesXlsxToBuffer(
            'user', 'password', '0000', '01/06/2026', '30/06/2026', {
                logger: { error() {} }, launchBrowser: harness.launchBrowser
            }
        ));
        assert.equal(harness.closeCount(), 1, stage);
    }
});
