'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const F = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const { COOKIE } = require('../../server/middlewares/simpleCsrfToken');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test('Chromium και απομονωμένη MongoDB: CSRF, διατήρηση ΜΕΤΑ και κανένας πρόωρος τοπικός προορισμός', { skip: !binary, timeout: 120000 }, async t => {
    const db = await F.startApprovedProposalMongo(binary); t.after(db.close);
    const f = await F.seedApprovedProposal(db), h = await F.startApprovedProposalHttp(f, create(f.dependencies), { csrf: true }); t.after(h.close);
    const before = await f.snapshot(), browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const writes = [], monitor = event => { if (['insert', 'update', 'delete', 'findAndModify'].includes(event.commandName)) writes.push(event.commandName); };
    db.connection.getClient().on('commandStarted', monitor);
    t.after(() => db.connection.getClient().off('commandStarted', monitor));
    const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage(), second = await context.newPage();
    const editorUrl = `${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=UPDATE:${f.history[0]._id}`;
    const suffix = name => `/api/ergazomenoi/${f.employee._id}/history-proposal-${name}`;
    const errors = [], external = [], downloads = []; page.on('pageerror', error => errors.push(error.message)); page.on('download', item => downloads.push(item));
    await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === h.origin) return route.continue(); external.push(route.request().url()); return route.abort();
    });
    await page.goto(editorUrl);
    // Exercise the global wrapper as well as the standalone editor. It must
    // defer all History recovery to the session/snapshot-aware boundary.
    await page.addScriptTag({ url: `${h.origin}/static/js/common/csrfFetchPatch.js` });
    await page.evaluate(() => { window.pickerCalls = 0; window.showSaveFilePicker = () => { window.pickerCalls++; throw Error('A destination must not be created'); }; });
    const salary = page.locator('[data-field-id="nomimosMisthos"]'), evidence = page.locator('[data-field-id="EVIDENCE"]');
    await salary.fill('1456.78'); await evidence.fill('Τοπικά ΜΕΤΑ μετά από συνθετική πολύωρη παραμονή');
    const values = () => page.locator('[data-edit-index]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.fieldId,
        value: node.multiple ? [...node.selectedOptions].map(option => option.value) : node.value, edited: node.dataset.edited, importedNull: node.dataset.importedNull })));
    const local = await values(), count = name => h.counts[name === '.xlsx' ? suffix('').replace(/-$/, '.xlsx') : suffix(name)] || 0;
    const rotate = async () => { await context.clearCookies({ name: COOKIE }); await second.goto(editorUrl); };
    const idle = () => page.waitForFunction(() => document.querySelector('.proposal-page').getAttribute('aria-busy') === 'false');
    const save = async () => { await page.locator('#saveProposalXlsx').click(); await idle(); };
    const checkPreserved = async () => { assert.deepEqual(await values(), local); assert.equal(await f.snapshot(), before); assert.equal(await page.evaluate(() => window.pickerCalls), 0); };

    await t.test('Το αναγνωστικό endpoint επαναχρησιμοποιεί cookie και δεν ακυρώνει άλλες καρτέλες', async () => {
        const cookies = await context.cookies(h.origin), old = cookies.find(cookie => cookie.name === COOKIE).value;
        const response = await context.request.get(`${h.origin}/csrf-token`);
        assert.equal(response.headers()['cache-control'], 'no-store'); assert.equal(response.headers()['set-cookie'], undefined);
        assert.equal((await response.json()).csrfToken, old);
        assert.equal(await page.locator('meta[name="csrf-token"]').getAttribute('content'), old);
    });
    await t.test('Δεύτερη καρτέλα ανανεώνει cookie μετά από προσομοιωμένη παραμονή 13 ωρών: μία ασφαλής επανάληψη προεπισκόπησης', async () => {
        await page.clock.install(); await page.clock.fastForward(13 * 60 * 60 * 1000);
        const old = await page.locator('meta[name="csrf-token"]').getAttribute('content'); await rotate();
        const fresh = (await context.cookies(h.origin)).find(cookie => cookie.name === COOKIE).value; assert.notEqual(fresh, old);
        const requests = count('apply-preview'); await page.locator('#previewProposalApply').click(); await idle();
        assert.equal(count('apply-preview') - requests, 2);
        assert.equal(await page.locator('meta[name="csrf-token"]').getAttribute('content'), fresh);
        assert.equal(await page.locator('#proposalApplyIssues').isVisible(), false); await checkPreserved();
        await page.clock.resume();
    });
    let validBuffer;
    await t.test('Έγκυρο XLSX μετά από ανάκτηση, έλεγχος ονόματος και όλων των συμπληρώσεων', async () => {
        await rotate(); const downloading = page.waitForEvent('download'); await save(); const download = await downloading;
        assert.equal(download.suggestedFilename(), await page.locator('#historyProposalEditor').getAttribute('data-filename'));
        const file = await download.path(); validBuffer = await fs.readFile(file); assert.ok(validBuffer.length > 0);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(validBuffer);
        const completions = book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row => row?.[1] === 'localCompletion').map(row => JSON.parse(row[2]));
        assert.equal(completions.find(row => row.canonicalField === 'nomimosMisthos').value, 1456.78);
        assert.equal(completions.find(row => row.canonicalField === 'EVIDENCE').value, local.find(row => row.id === 'EVIDENCE').value);
        assert.match(await page.locator('#proposalSaveStatus').textContent(), /Ελέγξτε ότι ολοκληρώθηκε/); await checkPreserved();
    });
    await t.test('Η αναγνωστική εισαγωγή ανακτά CSRF μία φορά και η ακύρωση αντικατάστασης διατηρεί όλα τα ΜΕΤΑ', async () => {
        await rotate(); const n = count('import-preview');
        await page.locator('#proposalImportFile').setInputFiles({ name: 'synthetic-recovered.xlsx', mimeType: mime, buffer: validBuffer });
        await page.locator('#proposalSelectionWarning').waitFor({ state: 'visible' });
        await page.locator('#keepProposalEdits').click(); await idle();
        assert.equal(count('import-preview') - n, 2); await checkPreserved();
    });
    for (const scenario of ['403-rights', '403-csrf-twice', '409', '422', '500', 'network', 'empty', 'html', 'truncated', 'wrong-parts', 'empty-parts', 'wrong-name', 'wrong-type', 'redirect'])
        await t.test(`Αποτυχία ${scenario}: καμία λήψη, επιλογή προορισμού ή απώλεια ΜΕΤΑ`, async () => {
            let posts = 0;
            const handler = async route => {
                if (route.request().method() !== 'POST') return route.continue(); posts++;
                if (scenario === 'network') return route.abort('failed');
                const name = await page.locator('#historyProposalEditor').getAttribute('data-filename');
                let status = 200, body = validBuffer, type = mime;
                if (/^(403|409|422|500)/.test(scenario)) { status = Number(scenario.slice(0, 3)); type = 'application/json';
                    body = JSON.stringify(scenario === '403-csrf-twice' ? { code: 'CSRF_TOKEN_INVALID', error: 'CSRF validation failed', message: 'Invalid or missing CSRF token' } : { code: 'SYNTHETIC_REJECTED', message: 'Συνθετική απόρριψη' }); }
                if (scenario === 'empty') body = Buffer.alloc(0);
                if (scenario === 'html') body = Buffer.from('<html>not an XLSX</html>');
                if (scenario === 'truncated') body = validBuffer.subarray(0, validBuffer.length - 40);
                if (scenario === 'wrong-parts') { const zip = new (require('jszip'))(); zip.file('plain.txt', 'synthetic'); body = await zip.generateAsync({ type: 'nodebuffer' }); }
                if (scenario === 'empty-parts') { const zip = new (require('jszip'))(); for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']) zip.file(name, ''); body = await zip.generateAsync({ type: 'nodebuffer' }); }
                if (scenario === 'wrong-type') type = 'text/html';
                if (scenario === 'redirect') return route.fulfill({ status: 302, headers: { location: '/login' } });
                return route.fulfill({ status, body, headers: { 'content-type': type,
                    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(scenario === 'wrong-name' ? 'other.xlsx' : name)}` } });
            };
            // Match the actual XLSX pathname independently of query encoding.
            await page.route('**/history-proposal.xlsx?*', handler);
            const n = downloads.length; await save();
            assert.equal(downloads.length, n); assert.equal(posts, scenario === '403-csrf-twice' ? 2 : 1);
            assert.doesNotMatch(await page.locator('#proposalSaveStatus').textContent(), /παραδόθηκε.*λήψη/);
            await checkPreserved(); await page.unroute('**/history-proposal.xlsx?*', handler);
        });
    await t.test('Πραγματική εφαρμογή με παλιό CSRF: απορρίπτεται μία φορά χωρίς αυτόματη εγγραφή', async () => {
        await page.locator('[data-field-id="DECLARATION"]').selectOption('1');
        await page.locator('#previewProposalApply').click(); await idle();
        await rotate(); const n = count('apply'); await page.locator('#approveProposalApply').click(); await idle();
        assert.equal(count('apply') - n, 1); assert.equal(await f.snapshot(), before);
        assert.match(await page.locator('#proposalApplyStatus').textContent(), /CSRF_TOKEN_INVALID/);
    });
    for (const scenario of ['session', 'company', 'user', 'snapshot']) await t.test(`Αλλαγή ${scenario}: ασφαλής απόρριψη και διατήρηση τιμών`, async () => {
        const savedSession = { ...f.req.session }, oldId = f.req.sessionID, oldInput = f.input;
        const previous = await values(), n = count('.xlsx'), files = downloads.length;
        if (scenario === 'session') f.req.sessionID += '-different';
        if (scenario === 'company') f.req.session.companyInUse = '630000000000000000000002';
        if (scenario === 'user') f.req.session.userId = '630000000000000000000003';
        if (scenario === 'snapshot') f.input = async () => { const input = await oldInput(); input.currentEmployee.syntheticRevision = 2; return input; };
        try {
            await save(); assert.equal(count('.xlsx'), n); assert.equal(downloads.length, files);
            assert.deepEqual(await values(), previous); assert.equal(await f.snapshot(), before);
            assert.match(await page.locator('#proposalSaveStatus').textContent(), /διατηρούνται|διατηρήστε/i);
        } finally { f.req.session = savedSession; f.req.sessionID = oldId; f.input = oldInput; }
    });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(await f.snapshot(), before); assert.deepEqual(writes, []);
});
