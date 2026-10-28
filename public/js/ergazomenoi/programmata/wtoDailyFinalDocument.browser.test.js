'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('Chromium: official PDF preview/download, byte validation, responsive dialog and URL cleanup', async () => {
    const { PDFDocument } = require('pdf-lib');
    const fixture = await PDFDocument.create(); fixture.addPage(); fixture.addPage();
    const base64 = Buffer.from(await fixture.save()).toString('base64');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ acceptDownloads: true }); let external = 0;
        await page.route('**/*', route => { external++; return route.abort(); });
        await page.setContent('<html><head></head><body><aside id="sidebar"></aside><main id="content"><input id="apo_hmeromhnia" value="2026-09-01"><input id="eos_hmeromhnia" value="2026-09-30"><input id="ypokatasthma_stathera_advanced" value="0000"><div id="finalWtoSubmittedDocumentMetadata"><span id="finalWtoSubmittedProtocol"></span><span id="finalWtoSubmittedDate"></span><span id="finalWtoSubmittedStatus"></span></div></main></body></html>');
        await page.addStyleTag({ content: read('public/css/bootstrap.min.css') + read('public/css/main.css') + fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.css'), 'utf8') });
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/erganiFormsSwal.js') });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.js') });
        await page.evaluate(base64 => {
            window.calls = []; window.revoked = [];
            const revoke = URL.revokeObjectURL.bind(URL);
            URL.revokeObjectURL = url => { window.revoked.push(url); revoke(url); };
            window.fetch = async (url, options) => {
                window.calls.push({url, method: options.method});
                if (url.includes('/pdf?')) return new Response(Uint8Array.from(atob(base64), char => char.charCodeAt(0)), { headers: { 'Content-Type': 'application/pdf' } });
                return Response.json({ success: true, found: true, status: 'SUCCESS', protocol: 'SYNTHETIC-PROTOCOL', pdfReadOnly: true });
            };
            window.flow = FinalWtoSubmittedDocumentPage.openSubmittedDocument();
        }, base64);
        await page.getByRole('button', { name: 'Ανάκτηση επίσημου PDF' }).click();
        await page.getByRole('link', { name: 'Λήψη επίσημου PDF' }).waitFor();
        const pdfUrl = await page.locator('iframe[title="Επίσημο PDF ΕΡΓΑΝΗ"]').getAttribute('src');
        assert.match(pdfUrl, /^blob:/);
        const open = page.getByRole('link', { name: 'Άνοιγμα PDF σε νέα καρτέλα' });
        assert.equal(await open.getAttribute('rel'), 'noopener noreferrer');
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[390,640]]) {
            for (const sidebar of [false, true]) {
                await page.setViewportSize({width, height});
                await page.evaluate(open => { document.querySelector('#sidebar').hidden = !open; document.querySelector('#content').style.marginLeft = open ? '260px' : '0'; }, sidebar);
                const bounds = await page.locator('.swal2-popup').evaluate(el => { const b = el.getBoundingClientRect(); return {left:b.left,right:b.right,top:b.top,bottom:b.bottom}; });
                assert.ok(bounds.left >= -1 && bounds.right <= width + 1 && bounds.top >= -1 && bounds.bottom <= height + 1, JSON.stringify({width,height,bounds}));
                await page.getByRole('button', { name: 'Κλείσιμο' }).scrollIntoViewIfNeeded();
                assert.equal(await page.getByRole('button', { name: 'Κλείσιμο' }).isVisible(), true);
            }
        }
        const downloading = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Λήψη επίσημου PDF' }).click();
        const download = await downloading;
        assert.equal(download.suggestedFilename(), 'WTODailyA.pdf');
        const downloaded = fs.readFileSync(await download.path());
        assert.equal(downloaded.toString('base64'), base64);
        assert.equal((await PDFDocument.load(downloaded)).getPageCount(), 2);
        await page.getByRole('button', { name: 'Κλείσιμο' }).click(); await page.evaluate(() => window.flow);
        assert.deepEqual(await page.evaluate(() => window.revoked), [pdfUrl]);
        assert.deepEqual(await page.evaluate(() => window.calls.map(call => call.method)), ['GET', 'GET']);
        assert.equal(await page.locator('#finalWtoSubmittedStatus').textContent(), 'Υποβλήθηκε στο ΕΡΓΑΝΗ');
        assert.equal(external, 0);
        // Even an application/pdf header cannot make HTML into an official PDF.
        await page.evaluate(() => {
            window.fetch = async url => url.includes('/pdf?') ? new Response('<html>invalid</html>', {headers:{'Content-Type':'application/pdf'}}) :
                Response.json({success:true,found:true,status:'SUCCESS',protocol:'SYNTHETIC-PROTOCOL',pdfReadOnly:true});
            window.flow = FinalWtoSubmittedDocumentPage.openSubmittedDocument();
        });
        await page.getByRole('button', { name: 'Ανάκτηση επίσημου PDF' }).click();
        await page.getByText('Το επίσημο PDF δεν ανακτήθηκε', {exact:true}).waitFor();
        assert.equal(await page.locator('iframe').count(), 0);
        assert.match(await page.locator('.swal2-html-container').innerText(), /FINAL_WTODAILY_PDF_INVALID_RESPONSE/);
        await page.getByRole('button', {name:'Κλείσιμο'}).click(); await page.evaluate(() => window.flow);
    } finally { await browser.close(); }
});
test('Chromium: finalized plus submitted status, exact protocol, no second send, read-only edition/history, responsive layout', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage(); let external = 0;
        await page.route('**/*', route => { external++; return route.abort(); });
        const source = read('public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js');
        const render = source.slice(source.indexOf('function syncEmploymentPeriodActionsVisibility'), source.indexOf('async function runHistoricalReconstruction'));
        const ids = [...new Set([...render.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]))];
        await page.setContent('<html><head></head><body><aside id="sidebar"></aside><main id="content">' + ids.map(id => `<div id="${id}"></div>`).join('') + '</main></body></html>');
        await page.addStyleTag({ content: read('public/css/bootstrap.min.css') + read('public/css/main.css') + fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.css'), 'utf8') });
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: 'let currentEmploymentPeriodControl; const employmentPeriodModeLabels={FINALIZED:"Οριστικοποιημένη περίοδος"}, employmentSubmissionTimelinessLabels={LATE:"Εκπρόθεσμη"}; function formatPolicyPreviewDate(x){return x||"";} function userCanReviewEdit(){return true;}' + render });
        const state = { status: 'FINALIZED', effective_mode: 'FINALIZED', submission_status: 'SUCCESS',
            submission_protocol: 'SYNTHETIC-PROTOCOL', submission_timeliness: 'LATE', allowed_actions: { submit_final_wtodailya: false } };
        await page.evaluate(state => renderEmploymentPeriodControl(state), state);
        assert.equal(await page.locator('#employmentPeriodControlStatus').innerText(), 'Οριστικοποιημένη περίοδος');
        assert.equal(await page.locator('#employmentPeriodSubmission').innerText(), 'Υποβλήθηκε στο ΕΡΓΑΝΗ');
        assert.equal(await page.locator('#employmentPeriodProtocol').innerText(), state.submission_protocol);
        assert.equal(await page.locator('#submitFinalWTODayilyABtn').evaluate(el => el.classList.contains('d-none')), true);
        await page.evaluate(state => renderEmploymentPeriodControl({ ...state, submission_status: '', submission_protocol: '',
            submission_timeliness: 'NOT_SUBMITTED', allowed_actions: { submit_final_wtodailya: true } }), state);
        assert.equal(await page.locator('#submitFinalWTODayilyABtn').evaluate(el => el.classList.contains('d-none')), false);
        const wrapper = source.slice(source.indexOf('const employmentReviewSwalCommonClasses'), source.indexOf('function userCanReviewEdit'));
        await page.addScriptTag({ content: wrapper });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/wtoDailySubmissionRevisionUi.js') });
        await page.evaluate(() => {
            window.calls = [];
            window.fetch = async url => { window.calls.push(url); if (!url.endsWith('/current')) throw new Error('No send allowed');
                return { ok: true, json: async () => ({ success: true, revision: { payload: { synthetic: true } },
                    transmission: { status: 'SUCCESS', result: { protocol: 'SYNTHETIC-PROTOCOL' } }, retry_allowed: false,
                    attempts: [{ status: 'REJECTED' }, { status: 'SUCCESS', protocol: 'SYNTHETIC-PROTOCOL' }] }) }; };
            const scope = { ypokatasthma: '0000' }; window.flow = WtoDailySubmissionRevisionUi.open({ scope, getScope: () => scope,
                showDialog: employmentReviewSwal });
        });
        await page.getByText('Καταγεγραμμένη επιτυχής υποβολή', { exact: true }).waitFor();
        assert.equal(await page.locator('.wto-revision-json').count(), 2);
        assert.match(await page.locator('.wto-revision-content').textContent(), /REJECTED/);
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[390,640]]) for (const sidebar of [false, true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(open => { document.querySelector('#sidebar').hidden = !open; document.querySelector('#content').style.marginLeft = open ? '260px' : '0'; }, sidebar);
            const bounds = await page.locator('.wto-revision-swal').evaluate(el => { const b=el.getBoundingClientRect(); return { left:b.left,right:b.right,bottom:b.bottom,top:b.top }; });
            assert.ok(bounds.left >= -1 && bounds.right <= width+1 && bounds.top >= -1 && bounds.bottom <= height+1);
        }
        assert.equal(await page.evaluate(() => window.calls.length), 1); assert.equal(external, 0);
    } finally { await browser.close(); }
});
test('Chromium: unavailable official PDF retains success/protocol and uses only GET; cancellation never requests retrieval', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage(); await page.route('**/*', route => route.abort());
        await page.setContent('<html><body><input id="apo_hmeromhnia" value="2026-09-01"><input id="eos_hmeromhnia" value="2026-09-30"><input id="ypokatasthma_stathera_advanced" value="0000"><div id="finalWtoSubmittedDocumentMetadata"><span id="finalWtoSubmittedProtocol"></span><span id="finalWtoSubmittedDate"></span><span id="finalWtoSubmittedStatus"></span></div></body></html>');
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: 'window.ErganiFormsSwal={fire: options=>Swal.fire(options)};' });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.js') });
        await page.evaluate(() => { window.calls=[]; window.fetch=async(url,options)=> { window.calls.push({url,method:options.method});
            if (url.includes('/pdf?')) return { ok:false, headers:{get:()=> 'application/json'},json:async()=>({message:'Το επίσημο PDF δεν είναι διαθέσιμο. Η υποβολή παραμένει επιτυχής με πρωτόκολλο SYNTHETIC-PROTOCOL.'}) };
            return {ok:true,json:async()=>({success:true,found:true,status:'SUCCESS',protocol:'SYNTHETIC-PROTOCOL',pdfSaved:false,pdfReadOnly:true})}; };
            window.flow=FinalWtoSubmittedDocumentPage.openSubmittedDocument(); });
        await page.getByRole('button',{name:'Ανάκτηση επίσημου PDF'}).click();
        await page.getByText('Η υποβολή είναι επιτυχής — το PDF δεν είναι διαθέσιμο',{exact:true}).waitFor();
        assert.equal(await page.locator('#finalWtoSubmittedStatus').textContent(), 'Υποβλήθηκε στο ΕΡΓΑΝΗ');
        assert.equal(await page.locator('#finalWtoSubmittedProtocol').textContent(), 'SYNTHETIC-PROTOCOL');
        assert.deepEqual(await page.evaluate(()=>window.calls.map(x=>x.method)), ['GET','GET']);
        await page.getByRole('button',{name:'Κλείσιμο'}).click(); await page.evaluate(()=>window.flow);
        await page.evaluate(()=>{window.flow=FinalWtoSubmittedDocumentPage.openSubmittedDocument();});
        await page.getByRole('button',{name:'Κλείσιμο'}).click(); await page.evaluate(()=>window.flow);
        assert.equal(await page.evaluate(()=>window.calls.length),3);
    } finally {await browser.close();}
});
