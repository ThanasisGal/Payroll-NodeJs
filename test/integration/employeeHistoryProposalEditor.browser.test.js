'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const ejs = require('ejs');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { startUnifiedPreviewHarness } = require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const F = require('../fixtures/employee0002HistoryProposalFixture');
const labels = require('../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { PROPOSAL_GROUPS } = require('../../server/services/ergazomenoi/employeeHistoryProposalComparisonService');
const output = '/tmp/payroll-history-proposal-editor-20261115';

async function actionLayout(page) {
    await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--proposal-actions-height')) -
        document.querySelector('.proposal-actions').getBoundingClientRect().height) < 1);
    return page.evaluate(() => {
        const rect = node => { const { x, y, width, height, bottom } = node.getBoundingClientRect(); return { x, y, width, height, bottom }; };
        const bar = document.querySelector('.proposal-actions');
        return { bar: rect(bar), buttons: [...bar.querySelectorAll('.btn')].map(node => ({ ...rect(node),
            reachable: node.contains(document.elementFromPoint(node.getBoundingClientRect().x + node.clientWidth / 2, node.getBoundingClientRect().y + node.clientHeight / 2)) })),
            fixed: getComputedStyle(bar).position, viewport: innerHeight };
    });
}

test('Chromium: σταθερές ενέργειες, ασφαλής χώρος και ανεξάρτητες κυλίσεις σε κάθε διάσταση', { timeout: 60000 }, async () => {
    forbidRealSettlementMongo(mock);
    const h = await startUnifiedPreviewHarness({ data: F.employee0002HistoryProposalFixture(), catalogs: F.catalogs });
    const before = A.stringify(h.state), browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(), page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === h.origin) return route.continue();
        external.push(route.request().url()); return route.abort();
    });
    try {
        const response = await page.goto(`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal-editor`);
        assert.doesNotMatch(await response.text(), /proposal-provenance|proposal-attention|Προέλευση και εκκρεμότητες/);
        assert.equal(await page.locator('#historyProposalEditor table').count(), 1);
        const folder = await fs.mkdtemp('/tmp/payroll-history-fixed-actions-');
        for (const [width, height] of [[1440, 900], [900, 700], [480, 700], [900, 450]]) for (const sidebar of [false, true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(sidebar => {
                const main = document.querySelector('.proposal-page');
                main.style.width = sidebar ? 'calc(100% - 160px)' : '';
                main.style.marginLeft = sidebar ? '160px' : '';
            }, sidebar);
            for (const message of ['', 'Το XLSX αποθηκεύτηκε. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή.',
                'Η αποθήκευση σταμάτησε. Οι συμπληρώσεις διατηρούνται. Δεν αποθηκεύτηκε αρχείο ή αλλαγή στην εφαρμογή.\n' +
                '1. Διατηρήστε την καρτέλα ανοικτή.\n2. Ελέγξτε τη σύνδεση και επαναλάβετε.\n'.repeat(8) + 'Κωδικός αναφοράς: ΣΥΝΘΕΤΙΚΟ.']) {
                await page.locator('#proposalSaveStatus').evaluate((node, text) => { node.textContent = text; node.scrollTop = 0; }, message);
                const initial = await actionLayout(page);
                assert.equal(initial.fixed, 'fixed'); assert.equal(initial.buttons.length, 2);
                assert.ok(Math.abs(initial.bar.bottom - height) < 1);
                assert.ok(initial.bar.height < height * .45);
                for (const fraction of [0, .5, 1]) {
                    const scroll = await page.evaluate(fraction => {
                        const max = document.documentElement.scrollHeight - innerHeight, target = max * fraction;
                        window.scrollTo({ top: target, behavior: 'instant' }); return { max, target, actual: scrollY };
                    }, fraction);
                    assert.ok(scroll.max > 0); assert.ok(Math.abs(scroll.actual - scroll.target) <= 1);
                    const current = await actionLayout(page);
                    assert.deepEqual(current.bar, initial.bar);
                    assert.deepEqual(current.buttons, initial.buttons);
                    assert.ok(current.buttons.every(button => button.reachable && button.y >= current.bar.y && button.bottom <= height));
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                const table = page.locator('#historyProposalEditor .proposal-table-scroll');
                const outerScroll = await page.evaluate(() => scrollY);
                const end = await table.evaluate(node => {
                    node.scrollTop = node.scrollHeight; node.scrollLeft = node.scrollWidth;
                    const table = node.getBoundingClientRect(), last = node.querySelector('tbody tr:last-child').getBoundingClientRect();
                    return { top: table.top, bottom: table.bottom, lastBottom: last.bottom, scrollTop: node.scrollTop,
                        scrollLeft: node.scrollLeft, horizontal: node.scrollWidth > node.clientWidth };
                });
                assert.ok(end.scrollTop > 0); assert.ok(!end.horizontal || end.scrollLeft > 0);
                assert.equal(await page.evaluate(() => scrollY), outerScroll);
                assert.ok(end.top >= 0); assert.ok(end.bottom < initial.bar.y);
                assert.ok(end.lastBottom <= end.bottom);
                const lastField = page.locator('[data-edit-index]').last();
                await lastField.focus();
                const fieldRect = await lastField.boundingBox();
                assert.ok(fieldRect.y >= 0 && fieldRect.y + fieldRect.height < (await actionLayout(page)).bar.y);
                if (message) {
                    const saveStatus = page.locator('#proposalSaveStatus');
                    assert.equal(await saveStatus.isVisible(), true); await saveStatus.focus();
                    assert.equal(await saveStatus.evaluate(node => document.activeElement === node), true);
                    if (message.includes('ΣΥΝΘΕΤΙΚΟ')) {
                        assert.equal(await saveStatus.evaluate(node => node.scrollHeight > node.clientHeight), true);
                        await saveStatus.evaluate(node => { node.scrollTop = node.scrollHeight; });
                        assert.equal(await saveStatus.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 1), true);
                    }
                }
            }
            await page.screenshot({ path: path.join(folder, `${width}x${height}${sidebar ? '-sidebar' : ''}.png`) });
        }
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log(`Συνθετικές εικόνες σταθερής μπάρας: ${folder}`);
    } finally { await browser.close(); await h.close(); mock.restoreAll(); }
});

test('Χωρίς εξαγωγή: απουσιάζουν η μπάρα και τα κουμπιά από το αποδιδόμενο HTML', async () => {
    const html = await ejs.renderFile(path.resolve(__dirname, '../../views/ergazomenoi/ergazomenoi/historyProposalEditor.ejs'), {
        model: { exportAvailable: false, title: 'Συνθετική μη διαθέσιμη πρόταση', message: 'Δεν υπάρχει διαθέσιμη πρόταση.' },
        csrfToken: '', selectionUrl: '/synthetic/history-proposal-editor', snapshotFingerprint: ''
    });
    assert.doesNotMatch(html, /class="proposal-actions"|id="saveProposalXlsx"|Λήψη αρχικής πρότασης XLSX|proposal-provenance|proposal-attention/);
});

test('Chromium new tab, typed editing, picker and fallback preserve every completion; stale data stays visible', { timeout: 60000 }, async () => {
    forbidRealSettlementMongo(mock);
    const h = await startUnifiedPreviewHarness({ data: F.employee0002HistoryProposalFixture(), catalogs: F.catalogs });
    const before = A.stringify(h.state), browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        await fs.mkdir(output, { recursive: true });
        const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
        const external = [], errors = [];
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin === h.origin) return route.continue();
            external.push(route.request().url()); return route.abort();
        });
        const page = await context.newPage(); await page.goto(h.origin);
        const opened = page.waitForEvent('popup'); await page.locator('#employeeHistoryExportXlsxBtn').click();
        const editor = await opened; editor.on('pageerror', error => errors.push(error.message)); await editor.waitForLoadState();
        assert.match(editor.url(), /history-proposal-editor$/);
        assert.equal(await editor.locator('.proposal-before').first().textContent(), '02/02/2026');
        assert.doesNotMatch(await editor.locator('.proposal-table').textContent(), /GMT|Eastern European/);
        assert.equal(await editor.locator('.proposal-after').first().evaluate(node => getComputedStyle(node).whiteSpace), 'normal');
        assert.deepEqual(await editor.locator('.proposal-group th').allTextContents(), PROPOSAL_GROUPS);
        assert.equal(await editor.locator('.proposal-before input,.proposal-before select,.proposal-before textarea').count(), 0);
        assert.equal(await editor.locator('#historyProposalEditor input,#historyProposalEditor select,#historyProposalEditor textarea').count(), await editor.locator('[data-edit-index]').count());
        for (const [width, height] of [[1440, 900], [900, 700], [480, 700], [900, 450]]) {
            await editor.setViewportSize({ width, height });
            assert.equal(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.ok(await editor.locator('#saveProposalXlsx').isVisible());
            assert.ok(await editor.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node => node.scrollHeight > node.clientHeight));
            if (width === 480) await editor.screenshot({ path: path.join(output, 'editor-480.png'), fullPage: true });
        }
        await editor.setViewportSize({ width: 1440, height: 900 });
        await editor.getByLabel(labels.nomimosMisthos, { exact: true }).fill('1234.56');
        await editor.getByLabel(labels.hmnia_enarxhs_egkekrimenhs_rythmishs, { exact: true }).fill('2026-02-09');
        await editor.getByLabel(labels.typos_orarioy, { exact: true }).selectOption({ label: 'Μεταβαλλόμενο' });
        await editor.getByLabel(labels.hmeres_efarmoghs_egkekrimenhs_rythmishs, { exact: true }).selectOption(['1', '3']);
        const evidence = '=Συνθετικό έγγραφο Α1 — έλεγχος συμπληρώσεων χωρίς εγγραφή στην εφαρμογή.';
        await editor.getByLabel('Τεκμήριο για την εξεταζόμενη περίοδο', { exact: true }).fill(evidence);
        await editor.getByLabel('Επιβεβαίωση προτεινόμενων στοιχείων', { exact: true }).selectOption({ label: 'Δηλώνω τεκμηριωμένα στοιχεία' });
        await editor.evaluate(() => {
            window.showSaveFilePicker = async options => {
                window.pickerActivated = navigator.userActivation.isActive; window.pickerName = options.suggestedName;
                return { createWritable: async () => ({ write: async blob => window.savedBytes = Array.from(new Uint8Array(await blob.arrayBuffer())), close: async () => {} }) };
            };
        });
        await editor.locator('#saveProposalXlsx').click();
        await editor.waitForFunction(() => document.getElementById('proposalSaveStatus').textContent.startsWith('Το XLSX αποθηκεύτηκε'));
        assert.equal(await editor.evaluate(() => window.pickerActivated), true);
        const picked = Buffer.from(await editor.evaluate(() => window.savedBytes));
        await fs.writeFile(path.join(output, 'synthetic-completed.xlsx'), picked);
        const verify = async buffer => {
            const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
            const mappings = book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row => row?.[1] === 'comparisonField').map(row => JSON.parse(row[2]));
            const sheet = book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ');
            const value = field => sheet.getCell(mappings.find(entry => entry.canonicalField === field).cell).value;
            assert.equal(value('nomimosMisthos'), 1234.56);
            assert.equal(value('hmnia_enarxhs_egkekrimenhs_rythmishs').toISOString(), '2026-02-09T00:00:00.000Z');
            assert.equal(sheet.getCell(mappings.find(entry => entry.canonicalField === 'hmnia_enarxhs_egkekrimenhs_rythmishs').cell).numFmt, 'dd/mm/yyyy');
            assert.equal(value('typos_orarioy'), 'Μεταβαλλόμενο'); assert.equal(value('hmeres_efarmoghs_egkekrimenhs_rythmishs'), 'Δευτέρα, Τετάρτη');
            assert.equal(sheet.getSheetValues().some(row => row?.[3] === 'Τεκμήριο για την εξεταζόμενη περίοδο' && row[4] === evidence), true);
            assert.equal(sheet.getSheetValues().some(row => row?.[3] === 'Επιβεβαίωση προτεινόμενων στοιχείων' && row[4] === 'Δηλώνω τεκμηριωμένα στοιχεία'), true);
            assert.equal(sheet.sheetProtection.sheet, true);
            assert.equal(book.getWorksheet('Ταυτοποίηση').state, 'veryHidden');
            assert.equal(book.getWorksheet('Ταυτοποίηση').getSheetValues().some(row => row?.[1] === 'proposalStatus' && row[2] === 'REVIEW_REQUIRED'), true);
            return book.getWorksheet('Ταυτοποίηση').getSheetValues().find(row => row?.[1] === 'snapshotFingerprint')[2];
        };
        const fingerprint = await verify(picked);
        for (const failure of ['unsupported', 'write-failed']) {
            await editor.evaluate(failure => {
                window.showSaveFilePicker = failure === 'unsupported' ? undefined : async () => ({ createWritable: async () => { throw Error('synthetic write denied'); } });
            }, failure);
            const downloaded = editor.waitForEvent('download'); await editor.locator('#saveProposalXlsx').click();
            const download = await downloaded, file = path.join(output, `synthetic-${failure}.xlsx`); await download.saveAs(file);
            assert.equal(await verify(await fs.readFile(file)), fingerprint);
        }
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
        h.state.currentEmployee.updatedAt = '2026-11-15';
        await editor.locator('#saveProposalXlsx').click();
        await editor.waitForFunction(() => document.getElementById('proposalSaveStatus').textContent.includes('EMPLOYEE_HISTORY_XLSX_STALE'));
        assert.equal(await editor.getByLabel(labels.nomimosMisthos, { exact: true }).inputValue(), '1234.56');
        await editor.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node => node.scrollTop = 0);
        await editor.screenshot({ path: path.join(output, 'editor-1440.png'), fullPage: true });
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log(`Συνθετικά αρχεία και εικόνες: ${output}`);
    } finally { await browser.close(); await h.close(); mock.restoreAll(); }
});

test('στοχευμένο Chromium: UPDATE, έγκυρες επιλογές, διατήρηση συμπληρώσεων και ίδιο περιγραφικό όνομα XLSX', {timeout:60000}, async()=>{
    forbidRealSettlementMongo(mock);
    const data=F.employee0002HistoryProposalFixture();
    Object.assign(data.completeHistoryRows[0],{typos_apasxolhshs:'5',kathestos_apasxolhshs:'1',eidikh_kathgoria_ergazomenoy:'0004'});
    const h=await startUnifiedPreviewHarness({data,catalogs:F.catalogs}), before=A.stringify(h.state);
    const browser=await chromium.launch({headless:true}), context=await browser.newContext({acceptDownloads:true});
    const errors=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===h.origin?route.continue():route.abort());
    const editor=await context.newPage(); editor.on('pageerror',error=>errors.push(error.message));
    try {
        const selection=`UPDATE:${data.completeHistoryRows[0]._id}`;
        await editor.goto(`${h.origin}/api/ergazomenoi/${data.currentEmployee._id}/history-proposal-editor?selection=${encodeURIComponent(selection)}`);
        const changedDate=editor.getByLabel(labels.hmeromhnia_allaghs_symbashs,{exact:true});
        assert.equal(await changedDate.inputValue(),'2026-02-02'); await changedDate.fill('2026-02-03');
        const employment=editor.getByLabel(labels.typos_apasxolhshs,{exact:true});
        assert.deepEqual(await employment.locator('option[data-code]').evaluateAll(options=>options.map(option=>option.dataset.code)),['0','1','2']);
        assert.equal(await employment.inputValue(),''); await employment.selectOption('1');
        assert.match(await employment.locator('..').textContent(),/καταγεγραμμένο καθεστώς/);
        const category=editor.getByLabel(labels.eidikh_kathgoria_ergazomenoy,{exact:true});
        assert.equal(await category.locator('option:checked').textContent(),'0004 - Συνθετική ειδική κατηγορία');
        await category.selectOption('0');
        await editor.locator('#proposalSelection').selectOption(`UPDATE:${data.completeHistoryRows.at(-1)._id}`);
        assert.equal(await editor.locator('dialog').isVisible(),true);
        assert.equal(await editor.locator('#proposalSelection').inputValue(),selection);
        await editor.locator('#keepProposalEdits').click(); assert.equal(await changedDate.inputValue(),'2026-02-03');
        for(const [width,height] of [[1440,900],[1000,800],[480,700],[900,450]]){
            await editor.setViewportSize({width,height});
            assert.equal(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await editor.locator('#saveProposalXlsx').isVisible(),true);
            assert.ok(await editor.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node=>node.scrollWidth>node.clientWidth||node.clientWidth>=900));
        }
        await editor.evaluate(()=>{window.showSaveFilePicker=async options=>{
            window.selectedFilename=options.suggestedName;
            return {createWritable:async()=>({write:async blob=>window.proposalBytes=Array.from(new Uint8Array(await blob.arrayBuffer())),close:async()=>{}})};
        };});
        const responsePromise=editor.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/history-proposal.xlsx'));
        await editor.locator('#saveProposalXlsx').click(); const response=await responsePromise;
        assert.equal(response.status(),200);
        await editor.waitForFunction(()=>document.getElementById('proposalSaveStatus').textContent.startsWith('Το XLSX αποθηκεύτηκε'));
        const name=await editor.evaluate(()=>window.selectedFilename);
        assert.equal(name,await editor.locator('#historyProposalEditor').getAttribute('data-filename'));
        assert.equal(name,decodeURIComponent(response.headers()['content-disposition'].match(/filename\*=UTF-8''([^;]+)/i)[1]));
        assert.match(name,/^THA_0003_0002_0000_ΙΣΤ0001_UPDATE_Διόρθωση_Εγγραφής_2026-02-02\.xlsx$/);
        const buffer=Buffer.from(await editor.evaluate(()=>window.proposalBytes)),book=new ExcelJS.Workbook(); await book.xlsx.load(buffer);
        const metadata=book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row=>row?.[1]==='comparisonField').map(row=>JSON.parse(row[2]));
        const value=field=>book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(metadata.find(entry=>entry.canonicalField===field).cell).value;
        assert.equal(value('typos_apasxolhshs'),'1'); assert.equal(value('eidikh_kathgoria_ergazomenoy'),'0001 - Συνθετική βασική κατηγορία');
        const completions=book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row=>row?.[1]==='localCompletion').map(row=>JSON.parse(row[2]));
        assert.equal(completions.find(entry=>entry.canonicalField==='eidikh_kathgoria_ergazomenoy').value,'0001');
        assert.equal(value('hmeromhnia_allaghs_symbashs').toISOString(),'2026-02-03T00:00:00.000Z');
        const artifacts='/tmp/payroll-history-proposal-improvements-20261115'; await fs.mkdir(artifacts,{recursive:true});
        await fs.writeFile(path.join(artifacts,name),buffer); await editor.screenshot({path:path.join(artifacts,'update-editor.png'),fullPage:true});
        assert.equal(A.stringify(h.state),before); assert.equal(h.counts.applyRequests,0); assert.deepEqual(errors,[]);
        console.log(`Συνθετικό δείγμα: ${path.join(artifacts,name)}`);
    } finally {await browser.close(); await h.close(); mock.restoreAll();}
});
