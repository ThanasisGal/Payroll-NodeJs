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

test('Chromium new tab, typed editing and validated download preserve every completion; stale data stays visible', { timeout: 60000 }, async () => {
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
        await editor.getByLabel('Αιτιολογία μεταβολών (προαιρετική)', { exact: true }).fill(evidence);
        await editor.getByLabel('Έγκριση μεταβολών', { exact: true }).selectOption({ label: 'Ναι' });
        await editor.evaluate(() => { window.pickerCalls = 0; window.showSaveFilePicker = () => { window.pickerCalls++; throw Error('unexpected destination'); }; });
        const downloading = editor.waitForEvent('download');
        await editor.locator('#saveProposalXlsx').click();
        const completedDownload = await downloading;
        await editor.waitForFunction(() => document.getElementById('proposalSaveStatus').textContent.startsWith('Το ελεγμένο XLSX'));
        assert.equal(await editor.evaluate(() => window.pickerCalls), 0);
        const picked = await fs.readFile(await completedDownload.path());
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
            assert.equal(sheet.getSheetValues().some(row => row?.[3] === 'Αιτιολογία μεταβολών (προαιρετική)' && row[4] === evidence), true);
            assert.equal(sheet.getSheetValues().some(row => row?.[3] === 'Έγκριση μεταβολών' && row[4] === 'Ναι'), true);
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
        assert.match(await employment.locator('xpath=ancestor::td[1]').textContent(),/καταγεγραμμένο καθεστώς/);
        const category=editor.getByLabel(labels.eidikh_kathgoria_ergazomenoy,{exact:true});
        assert.equal(await category.locator('option:checked').textContent(),'0004 - Συνθετική ειδική κατηγορία');
        await category.selectOption('0');
        await editor.locator('#proposalSelection').selectOption(`UPDATE:${data.completeHistoryRows.at(-1)._id}`);
        assert.equal(await editor.locator('#proposalSelectionWarning').isVisible(),true);
        assert.equal(await editor.locator('#proposalSelection').inputValue(),selection);
        await editor.locator('#keepProposalEdits').click(); assert.equal(await changedDate.inputValue(),'2026-02-03');
        for(const [width,height] of [[1440,900],[1000,800],[480,700],[900,450]]){
            await editor.setViewportSize({width,height});
            assert.equal(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.equal(await editor.locator('#saveProposalXlsx').isVisible(),true);
            assert.ok(await editor.locator('#historyProposalEditor .proposal-table-scroll').first().evaluate(node=>node.scrollWidth>node.clientWidth||node.clientWidth>=900));
        }
        const downloading = editor.waitForEvent('download');
        const responsePromise=editor.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/history-proposal.xlsx'));
        await editor.locator('#saveProposalXlsx').click(); const response=await responsePromise;
        assert.equal(response.status(),200);
        const completedDownload=await downloading;
        await editor.waitForFunction(()=>document.getElementById('proposalSaveStatus').textContent.startsWith('Το ελεγμένο XLSX'));
        const name=completedDownload.suggestedFilename();
        assert.equal(name,await editor.locator('#historyProposalEditor').getAttribute('data-filename'));
        assert.equal(name,decodeURIComponent(response.headers()['content-disposition'].match(/filename\*=UTF-8''([^;]+)/i)[1]));
        assert.match(name,/^THA_0003_0002_0000_ΙΣΤ0001_UPDATE_Διόρθωση_Εγγραφής_2026-02-02\.xlsx$/);
        const buffer=await fs.readFile(await completedDownload.path()),book=new ExcelJS.Workbook(); await book.xlsx.load(buffer);
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

test('Chromium: κοινές λίστες, ιστορικές τιμές, πληκτρολόγιο, όρια οθόνης, προεπισκόπηση και XLSX', { timeout: 60000 }, async () => {
    forbidRealSettlementMongo(mock);
    const data = F.employee0002HistoryProposalFixture(), catalogs = structuredClone(F.catalogs);
    catalogs.deductions = Array.from({ length: 14 }, (_, index) => ({ kodikos: String(index + 1).padStart(4, '0'),
        perigrafh: index === 2 ? 'Μεγάλη συνθετική περιγραφή κράτησης με αναδίπλωση για πλήρη ανάγνωση χωρίς οριζόντια αποκοπή '.repeat(3) : `Συνθετική κράτηση ${index + 1}` }));
    catalogs.leaveCategories = [{ kodikos: '001', perigrafh: 'Συνθετική άδεια' }];
    catalogs.KPK_EFKA.push(...Array.from({ length: 12 }, (_, index) => ({ code: `02${String(index).padStart(2, '0')}`, label: `Συνθετικό ΚΠΚ ${index}` })));
    for (const row of [data.currentEmployee, ...data.completeHistoryRows]) Object.assign(row, {
        eidikothta_symbashs: '01', krathsh_02: '0001', krathsh_03: 'HISTORICAL_UNKNOWN', krathsh_04: '', krathsh_05: '0002',
        krathsh_06: null, krathsh_07: '0001', typos_egkekrimenhs_rythmishs: 'OTHER_APPROVED_ARRANGEMENT',
        kathgoria_adeias_egkekrimenhs_rythmishs: '001'
    });
    const h = await startUnifiedPreviewHarness({ data, catalogs }), before = A.stringify(h.state);
    const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === h.origin) return route.continue();
        external.push(route.request().url()); return route.abort();
    });
    let proposal;
    await page.route('**/history-proposal-apply-preview', async route => {
        proposal = route.request().postDataJSON();
        await route.fulfill({ json: { success: true, saved: false, previewOnly: true, rows: [], operation: 'UPDATE',
            employeeCode: '0002', period: { from: '2026-02-02' }, declaration: 'Ναι', evidence: '', approval: { token: 'synthetic-preview' } } });
    });
    const field = id => page.locator(`select[data-field-id="${id}"]`), panel = page.locator('#proposal-dropdown-options');
    try {
        await page.goto(`${h.origin}/api/ergazomenoi/${data.currentEmployee._id}/history-proposal-editor?selection=UPDATE:${data.completeHistoryRows[0]._id}`);
        for (let i = 2; i <= 7; i++) {
            const control = field(`krathsh_0${i}`);
            assert.equal(await control.count(), 1); assert.equal(await control.locator('option[value=""]').count(), 1);
        }
        assert.equal(await page.locator('.proposal-before input,.proposal-before select,.proposal-before textarea').count(), 0);
        assert.equal(await field('krathsh_02').locator('option:checked').textContent(), '0001 - Συνθετική κράτηση 1');
        assert.match(await field('krathsh_02').locator('xpath=ancestor::tr[1]').locator('.proposal-before').textContent(), /0001 - Συνθετική κράτηση 1/);
        assert.equal(await field('krathsh_03').locator('option:checked').textContent(), 'HISTORICAL_UNKNOWN');
        assert.equal(await field('krathsh_04').inputValue(), ''); assert.equal(await field('krathsh_06').inputValue(), '');
        const type = field('typos_egkekrimenhs_rythmishs');
        const disabled = type.locator('option[data-code="OTHER_APPROVED_ARRANGEMENT"]');
        assert.equal(await disabled.isDisabled(), true); assert.equal(await disabled.evaluate(node => node.selected), true);
        assert.equal(await field('kathgoria_adeias_egkekrimenhs_rythmishs').locator('xpath=ancestor::tr[1]').locator('.proposal-before').textContent(), '001 - Συνθετική άδεια');
        const multiple = page.locator('select[multiple]');
        const multipleBefore = await multiple.evaluateAll(nodes => nodes.map(node => ({ options: node.innerHTML, value: [...node.selectedOptions].map(option => option.value) })));
        assert.equal(await multiple.locator('xpath=parent::*[contains(@class,"proposal-dropdown")]').count(), 0);
        await field('krathsh_02').click(); assert.equal(await panel.isVisible(), true);
        await field('krathsh_02').press('Home'); await field('krathsh_02').press('ArrowDown'); await field('krathsh_02').press('ArrowDown'); await field('krathsh_02').press('Enter');
        assert.equal(await field('krathsh_02').locator('option:checked').getAttribute('data-raw-value'), '"0002"');
        assert.equal(await field('krathsh_02').evaluate(node => document.activeElement === node), true);
        await type.click();
        const unavailable = panel.locator('[aria-disabled="true"]'); await unavailable.click({ force: true });
        assert.equal(await type.locator('option:checked').getAttribute('data-raw-value'), '"OTHER_APPROVED_ARRANGEMENT"');
        await type.press('Home'); await type.press('End'); await type.press('Enter');
        assert.equal(await type.locator('option:checked').getAttribute('data-raw-value'), '"APPROVED_TIME_SHIFT_INTERRUPTION"');
        await type.evaluate(node => { node.value = '2'; node.dispatchEvent(new Event('change', { bubbles: true })); }); // restore the recorded value
        for (const [width, height] of [[1920,1080],[1280,720],[900,700],[480,700],[900,450]]) for (const sidebar of [false,true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(sidebar => {
                const main = document.querySelector('.proposal-page'); main.style.width = sidebar ? 'calc(100% - 160px)' : '';
                main.style.marginLeft = sidebar ? '160px' : '';
            }, sidebar);
            for (const id of ['krathsh_01','krathsh_02']) {
                const control = field(id); await control.scrollIntoViewIfNeeded();
                for (const direction of ['down','up']) {
                    await control.locator('..').evaluate((node, direction) => {
                        node.style.position = 'fixed'; node.style.width = '210px'; node.style.right = '8px';
                        node.style.top = direction === 'down' ? '8px' : `${innerHeight - 55}px`; node.style.zIndex = '3';
                    }, direction);
                    await control.click(); assert.equal(await panel.getAttribute('data-direction'), direction);
                    const geometry = await panel.evaluate(node => {
                        const rect = node.getBoundingClientRect();
                        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, height: rect.height,
                            row: Number(node.dataset.rowHeight), scroll: node.scrollHeight > node.clientHeight,
                            horizontal: node.scrollWidth > node.clientWidth,
                            visible: node.contains(document.elementFromPoint(rect.x + 10, rect.y + 10)) };
                    });
                    assert.ok(geometry.x >= 0 && geometry.y >= 0 && geometry.right <= width && geometry.bottom <= height);
                    assert.ok(geometry.height <= geometry.row * 8 + 2.1); assert.equal(geometry.scroll, true);
                    assert.equal(geometry.horizontal, false); assert.equal(geometry.visible, true);
                    if (width === 1280 && !sidebar && id === 'krathsh_02' && direction === 'down')
                        await page.screenshot({ path: '/tmp/payroll-proposal-dropdown-open.png' });
                    await panel.evaluate(node => { node.scrollTop = node.scrollHeight; });
                    await control.press('Escape'); assert.equal(await panel.isVisible(), false);
                    assert.equal(await control.evaluate(node => document.activeElement === node), true);
                }
                await control.locator('..').evaluate(node => node.removeAttribute('style'));
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        await field('krathsh_02').click(); await page.locator('h1').click(); assert.equal(await panel.isVisible(), false);
        await field('krathsh_02').click(); await field('krathsh_02').press('Tab'); assert.equal(await panel.isVisible(), false);
        await field('krathsh_07').selectOption('');
        await page.locator('select[data-field-id="DECLARATION"]').selectOption({ label: 'Ναι' });
        const valuesBefore = await page.locator('[data-edit-index]').evaluateAll(nodes => nodes.map(node => [node.dataset.fieldId, node.value]));
        await page.locator('#previewProposalApply').click(); await page.waitForFunction(() => !document.getElementById('proposalApplyPreview').hidden);
        assert.deepEqual(await page.locator('[data-edit-index]').evaluateAll(nodes => nodes.map(node => [node.dataset.fieldId, node.value])), valuesBefore);
        const edits = await page.locator('[data-edit-index]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.fieldId, Number(node.dataset.editIndex)])));
        assert.equal(proposal.completion.changes.find(item => item.index === edits.krathsh_02).value, '0002');
        assert.equal(proposal.completion.changes.find(item => item.index === edits.typos_egkekrimenhs_rythmishs).value, 'OTHER_APPROVED_ARRANGEMENT');
        assert.deepEqual(await multiple.evaluateAll(nodes => nodes.map(node => ({ options: node.innerHTML, value: [...node.selectedOptions].map(option => option.value) }))), multipleBefore);
        const downloaded = page.waitForEvent('download'); await page.locator('#saveProposalXlsx').click();
        const download = await downloaded, buffer = await fs.readFile(await download.path());
        const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
        const metadata = book.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row => row?.[1] === 'comparisonField').map(row => JSON.parse(row[2]));
        const value = id => book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(metadata.find(entry => entry.canonicalField === id).cell).value;
        assert.equal(value('krathsh_02'), '0002'); assert.equal(value('krathsh_03'), 'HISTORICAL_UNKNOWN');
        assert.equal(value('typos_egkekrimenhs_rythmishs'), 'OTHER_APPROVED_ARRANGEMENT');
        const importing = page.waitForResponse(response => response.url().endsWith('/history-proposal-import-preview'));
        await page.locator('#proposalImportFile').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
        const imported = await (await importing).json(); assert.equal(imported.success, true, JSON.stringify(imported));
        if (await page.locator('#proposalSelectionWarning').isVisible()) await page.locator('#confirmProposalSwitch').click();
        await page.waitForFunction(() => document.getElementById('proposalImportStatus').textContent.includes('ολοκληρώθηκε επιτυχώς'));
        assert.equal(await field('krathsh_03').locator('option:checked').textContent(), 'HISTORICAL_UNKNOWN');
        assert.equal(await type.locator('option:checked').getAttribute('data-raw-value'), '"OTHER_APPROVED_ARRANGEMENT"');
        assert.equal(await field('krathsh_02').locator('option:checked').getAttribute('data-raw-value'), '"0002"');
        const folder = await fs.mkdtemp('/tmp/payroll-proposal-dropdowns-');
        await page.screenshot({ path: path.join(folder, 'dropdowns.png'), fullPage: true });
        console.log(`Συνθετική εικόνα dropdowns: ${folder}`);
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
    } finally { await browser.close(); await h.close(); mock.restoreAll(); }
});
