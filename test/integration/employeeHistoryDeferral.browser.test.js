'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
// Reuse the offline harness executing the entire production Save function.
// Every URL is fulfilled locally by Playwright; no dev server is started.
const filename = path.join(__dirname, '../../public/js/ergazomenoi/genika/putFieldValues.historyGuidance.browser.test.js');
const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
const source = fs.readFileSync(filename, 'utf8');
m._compile(source.slice(0, source.indexOf('for (const [label, options]')) + '\nmodule.exports={withPage,save};', filename);
const { withPage, save } = m.exports;
const preview = { success: true, preflight: true, status: 'MISSING_REQUIRED_HISTORY_FIELDS', decision: 'DEFER_HISTORY',
    historyConfirmation: 'synthetic-server-confirmation', missingFields: [
        { field: 'krathsh_01', label: 'ΚΠΚ <img src=x onerror="window.xss=1">', group: 'Ασφάλιση', reason: 'Δεν έχει καταγραφεί.' },
        { field: 'ores_ergasias_ebdomadas', label: 'Ώρες εβδομάδας', group: 'Όροι απασχόλησης', reason: 'Δεν έχουν καταγραφεί.' }] };
const committed = { success: true, employeeUpdated: true, historyUpdated: false, historyDeferred: true,
    historyAccessMode: 'READ_ONLY', historyStatus: 'PENDING_EMPLOYEE_RECONCILIATION', externalActionsAllowed: true,
    idempotencyKey: 'synthetic-server-action-identity', message: 'Ο εργαζόμενος αποθηκεύτηκε. Το Ιστορικό παραμένει σε εκκρεμότητα.',
    data: { _id: 'synthetic-employee', kodikos: '0031' }, contractPdf: { skipped: true }, pdfResults: [] };

test('Chromium: μετάβαση στο ΠΡΙΝ/ΜΕΤΑ χωρίς απώλεια φόρμας ή δεύτερο αίτημα αποθήκευσης', {timeout:60000}, async()=>{
    const url='/api/ergazomenoi/650000000000000000000031/history-proposal-editor?selection=UPDATE:650000000000000000000004';
    await withPage({payload:{preflight:true,success:false,saved:false,status:'HISTORY_CORRECTION_EDITION_REQUIRED',
        correctionEditionUrl:url,message:'Ζητήσατε διόρθωση εγκεκριμένης εγγραφής. Διατηρείται η αρχική έκδοση. Δεν αποθηκεύτηκε καμία αλλαγή.\n' +
            '1. Ανοίξτε την επιλεγμένη εγγραφή.\n2. Καταχωρίστε τις διορθώσεις και ελέγξτε την προεπισκόπηση.\n3. Εγκρίνετε και περιμένετε την επαλήθευση.\nΚωδικός αναφοράς: HISTORY_CORRECTION_EDITION_REQUIRED.'}},async({page,requests})=>{
        await save(page);
        await page.waitForFunction(()=>Swal.getTitle()?.textContent === 'Η αποθήκευση χρειάζεται έλεγχο');
        const link=page.locator('.employee-history-deferral-popup a');
        assert.equal(await link.getAttribute('href'),url);
        assert.equal(await link.getAttribute('target'),'_blank');
        assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
        const root=path.resolve(__dirname,'../..');
        const sidebar=(await require('ejs').renderFile(path.join(root,'views/partials/sidebar.ejs'),{
            userRole:'A',isAdminOrSupervisorRole:()=>true,companyInUse:'SYNTHETIC',
            userTeam:'TEST',NODE_ENV:'development',nonce:'',userId:'',script:()=>''
        })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<img\b[^>]*>/gi,'');
        await page.evaluate(html=>{document.body.insertAdjacentHTML('afterbegin',html);},sidebar);
        for (const [width,height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[390,640]])
            for (const open of [true,false]) {
                await page.setViewportSize({width,height});
                await page.evaluate(open=>document.getElementById('sidebarMenu').classList.toggle('d-none',!open),open);
                const bounds=await page.locator('.employee-history-deferral-popup').evaluate(popup=>
                    [popup,...popup.querySelectorAll('a,.swal2-actions,.swal2-confirm')].map(node=>{
                        const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};
                    }));
                assert.ok(bounds.every(r=>r.left>=-1 && r.top>=-1 && r.right<=width+1 && r.bottom<=height+1),
                    `${width}×${height}, μενού ${open}: ${JSON.stringify(bounds)}`);
            }
        const {origin}=require('../fixtures/employeeMaintenanceBrowserAssets');
        await page.context().route(origin+url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>ΠΡΙΝ/ΜΕΤΑ</title>'}));
        const opened=page.waitForEvent('popup'); await link.click(); const popup=await opened;
        await popup.waitForLoadState(); assert.equal(popup.url(),origin+url);
        assert.equal(await popup.evaluate(()=>window.opener),null); await popup.close();
        await page.locator('.swal2-confirm').click(); await page.waitForFunction(()=>window.saveFinished);
        assert.equal(requests.length,1); assert.equal(requests[0].body.historyPreflight,true);
        assert.equal(await page.locator('#email').inputValue(),'entered@example.test');
        assert.equal(await page.evaluate(()=>window.swalCalls.some(call=>call.icon === 'success')),false);
    });
});

for (const proceed of [false,true]) test(`Chromium, πραγματική πλήρης Αποθήκευση 5→6: ελλιπές Ιστορικό + ${proceed ? 'Συνέχεια + ΕΡΓΑΝΗ' : 'Επιστροφή'}`,
    {timeout:60000}, async()=>{
    await withPage({departure:'',fieldValues:{hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',
        ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67,apasxolhsh_basei_symbashs:'6',
        apasxolhsh_basei_symbashs_stathera:'6',arithmos:'12'}},async({page})=>{
        const {origin,asset}=require('../fixtures/employeeMaintenanceBrowserAssets');
        const root=path.resolve(__dirname,'../..'), id='650000000000000000000031', requests=[];
        let releaseCommit;
        const commitGate=new Promise(resolve=>{releaseCommit=resolve;});
        await page.route(`${origin}/api/ergazomenoi/**`,async route=>{
            const request=route.request(), body=request.postDataJSON();
            requests.push({url:request.url(),body});
            if(request.url().endsWith('/history-approved-maintenance-context'))
                return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,contextOnly:true,
                    currentTerms:{hmeres_ergasias_ebdomadas:5,typos_ebdomadas:'5HMERH',ores_ergasias_ebdomadas:40,
                        mo_oron_hmerhsias_ergasias:8},currentContract:'5',pendingHistory:false})});
            assert.equal(request.url(),`${origin}/api/ergazomenoi/update/${id}`);
            const count=requests.filter(item=>item.url.includes('/update/')).length;
            await page.evaluate(value=>{window.__saveRequests=value;},count);
            if(count===1) return route.fulfill({contentType:'application/json',body:JSON.stringify(preview)});
            assert.equal(count,2,'no duplicate Employee save');
            await commitGate;
            await page.evaluate(()=>{window.__employeeCommitted=true;});
            return route.fulfill({contentType:'application/json',body:JSON.stringify({...committed,data:{_id:id}})});
        });
        await page.addScriptTag(asset(root,'public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi.js'));
        await page.evaluate(id=>{
            document.getElementById('ergazomenoiId').value=id;
            const baseline=document.createElement('div');baseline.id='employeeApprovedHistoryAtomicBaseline';
            Object.assign(baseline.dataset,{atomicDays:'5',atomicWeek:'5HMERH',atomicContract:'5',atomicHours:'40',atomicDaily:'8'});
            document.body.append(baseline);
            for(const name of ['hmeres_ergasias_ebdomadas','ores_ergasias_ebdomadas','mo_oron_hmerhsias_ergasias'])
                document.getElementById(name).type='number';
            window.__uploads=[];
            window.uploadMaToErganh=async(...args)=>{
                if(window.__employeeCommitted!==true || window.__saveRequests!==2 ||
                    window.employeeHistoryExternalActionKey!=='synthetic-server-action-identity')
                    throw Error('ERGANI started before confirmed Employee save');
                window.__uploads.push(args);return {success:true};
            };
            window.showGenericRestProgressSwal=()=>{};
            window.presentErganiRestSubmissionResult=async()=>{};
            const fire=Swal.fire.bind(Swal);
            Swal.fire=async options=>{
                if(options.title==='Είδος ιστορικής ενέργειας') return {isConfirmed:true,value:'NEW_CHANGE'};
                if(options.title==='Ημερομηνία ισχύος της πραγματικής μεταβολής') return {isConfirmed:true,value:'2026-12-01'};
                const result=await fire(options);
                return result.isConfirmed && options.preConfirm ? {...result,value:{...result.value,
                    create_contract:false,isPermanent:true,erganiUploadMethod:'rest',
                    e3_metaboles_ergasiakhs_sxeshs:true}} : result;
            };
        },id);
        await save(page);
        await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Λείπουν στοιχεία του Ιστορικού').catch(async error=>{
            throw new Error(JSON.stringify({requests,state:await page.evaluate(()=>({title:Swal.getTitle()?.textContent,
                text:Swal.getHtmlContainer()?.textContent,calls:window.swalCalls.map(item=>item.title),finished:window.saveFinished}))}),{cause:error});
        });
        assert.equal(requests.length,2,'context and ordinary full-form preflight only');
        assert.equal(requests[1].body.formData.arithmos,'12');
        assert.equal(requests[1].body.formData.hmeres_ergasias_ebdomadas,6);
        assert.equal(requests[1].body.formData.apasxolhsh_basei_symbashs,'6');
        assert.equal(requests[1].body.change.effectiveFrom,'2026-12-01');
        assert.equal(requests[1].body.filesToUpdate.e3_metaboles_ergasiakhs_sxeshs,true);
        assert.deepEqual(await page.evaluate(()=>window.__uploads),[]);
        await page.locator(proceed ? '.swal2-confirm' : '.swal2-cancel').click();
        if(proceed) {
            await page.waitForFunction(()=>Swal.getTitle()?.textContent==='Προεπισκόπηση αποθήκευσης');
            assert.equal(requests.length,2,'η Συνέχεια περιμένει χωριστή τελική έγκριση');
            assert.deepEqual(await page.evaluate(()=>window.__uploads),[]);
            await page.locator('.swal2-confirm').filter({hasText:'Έγκριση και αποθήκευση'}).click();
            await page.waitForFunction(()=>window.__saveRequests===2);
            assert.deepEqual(await page.evaluate(()=>window.__uploads),[],'no ERGANI while commit is pending');
            assert.equal(requests[2].body.historyDecision,'DEFER_HISTORY');
            assert.deepEqual(requests[2].body.change,requests[1].body.change);
            assert.deepEqual(requests[2].body.filesToUpdate,requests[1].body.filesToUpdate);
            await page.evaluate(()=>document.getElementById('save').click());
            assert.equal(requests.length,3,'a second click cannot start another Save while commit is pending');
            releaseCommit();
            await page.waitForFunction(()=>window.__uploads.length===1);
            await page.waitForFunction(()=>window.saveFinished);
            assert.equal(requests.length,3);
            const uploads=await page.evaluate(()=>window.__uploads);
            assert.equal(uploads.length,1);
            assert.equal(uploads[0][4],'rest');assert.equal(uploads[0][5],'2026-12-01');
        } else {
            await page.waitForFunction(()=>window.saveFinished);
            assert.equal(requests.length,2);
            assert.deepEqual(await page.evaluate(()=>window.__uploads),[]);
        }
    });
});

test('Correction 3 Chromium: Return is read only, safe missing-field Swal fits available width/height', { timeout: 60000 }, async () => {
    await withPage({ payload: preview }, async ({ page, requests }) => {
        await save(page); await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Λείπουν στοιχεία του Ιστορικού');
        assert.equal(requests.length, 1); assert.equal(requests[0].body.historyPreflight, true);
        assert.equal(await page.locator('.swal2-confirm').textContent(), 'Συνέχεια');
        assert.equal(await page.locator('.swal2-cancel').textContent(), 'Επιστροφή για διόρθωση');
        assert.equal(await page.locator('.swal2-html-container img').count(), 0);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        for (const [width,height] of [[1920,1080], [1280,720], [800,600], [480,640]]) {
            await page.setViewportSize({ width,height });
            const geometry = await page.locator('.swal2-popup.employee-history-deferral-popup').evaluate(popup => {
                const bounds = element => {
                    const r = element.getBoundingClientRect();
                    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                        width: r.width, height: r.height };
                };
                const actions = popup.querySelector('.swal2-actions');
                return { popup: bounds(popup), actions: bounds(actions),
                    buttons: [...actions.querySelectorAll('button')].filter(button =>
                        getComputedStyle(button).display !== 'none').map(bounds),
                    content: bounds(popup.querySelector('.swal2-html-container')) };
            });
            const inside = rect => rect.left >= -1 && rect.top >= -1 &&
                rect.right <= width + 1 && rect.bottom <= height + 1;
            assert.ok(inside(geometry.popup) && inside(geometry.actions) &&
                geometry.buttons.every(inside),
                `Responsive Swal ${width}x${height}: ${JSON.stringify(geometry)}`);
        }
        await page.locator('.swal2-cancel').click(); await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 1); assert.equal(await page.locator('#email').inputValue(), 'entered@example.test');
    });
});
test('Correction 3 Chromium: Continue reaches existing success continuation while unrelated READ_ONLY remains stopped', { timeout: 60000 }, async () => {
    await withPage({ replies: [{ status: 200, payload: preview }, { status: 200, payload: committed }] }, async ({ page, requests }) => {
        await save(page); await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Λείπουν στοιχεία του Ιστορικού');
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Προεπισκόπηση αποθήκευσης');
        assert.equal(requests.length, 1);
        await page.locator('.swal2-confirm').filter({ hasText: 'Έγκριση και αποθήκευση' }).click();
        await page.locator('#employeeDeferredHistorySaveStatus').waitFor();
        assert.equal(requests.length, 2); assert.equal(requests[1].body.historyDecision, 'DEFER_HISTORY');
        assert.deepEqual(requests[1].body.filesToUpdate, requests[0].body.filesToUpdate);
        assert.equal(await page.locator('#employeeLegacyHistorySaveStatus').count(), 0);
        assert.equal(await page.evaluate(() => window.employeeHistoryExternalActionKey), committed.idempotencyKey);
        await page.waitForFunction(() => window.guidedCounts.successContinuation > 0 || window.saveFinished);
    });
});

for (const decision of ['DEFER_HISTORY', 'DEFER_LEGACY'])
    test(`Chromium: Συνέχεια → ακύρωση τελικής έγκρισης (${decision}) χωρίς αίτημα εγγραφής`, { timeout: 60000 }, async () => {
    await withPage({ payload: { ...preview, decision } }, async ({ page, requests }) => {
        await save(page);
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Λείπουν στοιχεία του Ιστορικού');
        await page.locator('.swal2-confirm').filter({ hasText: 'Συνέχεια' }).click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Προεπισκόπηση αποθήκευσης');
        assert.equal(requests.length, 1);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => window.saveFinished);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].body.historyPreflight, true);
        assert.equal(await page.locator('#email').inputValue(), 'entered@example.test');
        assert.equal(await page.evaluate(() => window.swalCalls.some(call => call.icon === 'success')), false);
    });
});

for (const external of [false, true]) for (const approve of [false, true])
    test(`Chromium 29/11/2026: προεπισκόπηση → ${approve ? 'τελική έγκριση' : 'ακύρωση'}, ΕΡΓΑΝΗ ${external ? 'επιλεγμένο' : 'χωρίς επιλογή'}`,
    { timeout: 60000 }, async () => {
    await withPage({ departure: '', fieldValues: { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH',
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67,
        apasxolhsh_basei_symbashs: '6', apasxolhsh_basei_symbashs_stathera: '6' } }, async ({ page }) => {
        const { origin, asset } = require('../fixtures/employeeMaintenanceBrowserAssets');
        const root = path.resolve(__dirname, '../..'), id = '650000000000000000000002', requests = [];
        const ready = { success: true, preflight: true, status: 'READY_FOR_COMBINED_SAVE',
            decision: 'COMBINED_SAVE', missingFields: [], historyConfirmation: 'synthetic-ready-confirmation' };
        let writes = 0, releaseCommit;
        const commitGate = new Promise(resolve => { releaseCommit = resolve; });
        await page.route(`${origin}/api/ergazomenoi/**`, async route => {
            const request = route.request(), body = request.postDataJSON();
            requests.push({ url: request.url(), body });
            if (request.url().endsWith('/history-approved-maintenance-context'))
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, contextOnly: true,
                    currentTerms: { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
                        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 }, currentContract: '5', pendingHistory: false }) });
            assert.equal(request.url(), `${origin}/api/ergazomenoi/update/${id}`);
            if (body.historyPreflight === true)
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ready) });
            assert.equal(++writes, 1, 'ακριβώς ένα αίτημα πραγματικής αποθήκευσης');
            assert.equal(body.historyDecision, 'COMBINED_SAVE');
            assert.equal(body.historyConfirmation, ready.historyConfirmation);
            await page.evaluate(() => { window.__savePending = true; });
            await commitGate;
            await page.evaluate(() => { window.__employeeCommitted = true; });
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
                success: true, employeeUpdated: true, historyUpdated: true,
                externalActionsAllowed: true, idempotencyKey: 'synthetic-ready-action-identity',
                data: { _id: id }, contractPdf: { skipped: true }, pdfResults: []
            }) });
        });
        await page.addScriptTag(asset(root, 'public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi.js'));
        await page.evaluate(({ id, external }) => {
            document.getElementById('ergazomenoiId').value = id;
            const baseline = document.createElement('div'); baseline.id = 'employeeApprovedHistoryAtomicBaseline';
            Object.assign(baseline.dataset, { atomicDays: '5', atomicWeek: '5HMERH', atomicContract: '5', atomicHours: '40', atomicDaily: '8' });
            document.body.append(baseline);
            for (const name of ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias'])
                document.getElementById(name).type = 'number';
            window.__uploads = [];
            window.uploadMaToErganh = async (...args) => {
                if (window.__employeeCommitted !== true) throw Error('Υποβολή πριν από επιβεβαιωμένη αποθήκευση');
                window.__uploads.push(args); return { success: true };
            };
            window.showGenericRestProgressSwal = () => {};
            window.presentErganiRestSubmissionResult = async () => {};
            const fire = Swal.fire.bind(Swal);
            Swal.fire = async options => {
                const answer = await fire(options);
                return answer.isConfirmed && options.preConfirm ? { ...answer, value: { ...answer.value,
                    create_contract: false, isPermanent: true, erganiUploadMethod: 'rest',
                    e3_metaboles_ergasiakhs_sxeshs: external } } : answer;
            };
        }, { id, external });
        await save(page);
        await page.locator('.swal2-radio input[value="NEW_CHANGE"]').check();
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-input[type="date"]').fill('2026-11-29');
        await page.locator('.swal2-confirm').filter({ hasText: 'Προεπισκόπηση' }).click();
        await page.waitForFunction(() => Swal.getTitle()?.textContent === 'Προεπισκόπηση αποθήκευσης');
        assert.equal(requests.length, 2, 'μόνο ανάγνωση αρχικών στοιχείων και προεπισκόπηση');
        assert.equal(writes, 0);
        assert.equal(requests[1].body.historyPreflight, true);
        assert.equal(requests[1].body.change.effectiveFrom, '2026-11-29');
        assert.equal(requests[1].body.formData.apasxolhsh_basei_symbashs, '6');
        assert.match(await page.locator('.swal2-html-container').innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        assert.deepEqual(await page.evaluate(() => window.__uploads), []);
        if (!external && !approve) {
            const sidebar = (await require('ejs').renderFile(path.join(root, 'views/partials/sidebar.ejs'), {
                userRole: 'A', isAdminOrSupervisorRole: () => true, companyInUse: 'SYNTHETIC',
                userTeam: 'TEST', NODE_ENV: 'development', nonce: '', userId: '', script: () => ''
            })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<img\b[^>]*>/gi, '');
            await page.evaluate(html => {
                document.body.insertAdjacentHTML('afterbegin', html);
                const main = document.createElement('main');
                main.className = 'col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent payroll-form-layout';
                document.body.append(main);
                main.append(document.querySelector('.menu_Links'), document.querySelector('.sections'));
            }, sidebar);
            for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 720], [800, 600], [390, 640]])
                for (const open of [true, false]) {
                    await page.setViewportSize({ width, height });
                    await page.evaluate(open => {
                        document.getElementById('sidebarMenu').classList.toggle('d-none', !open);
                        const main = document.querySelector('main');
                        main.style.setProperty('width', open ? '' : '100%', 'important');
                        main.style.setProperty('margin-left', open ? '' : '0px', 'important');
                    }, open);
                    const bounds = await page.locator('.employee-history-deferral-popup').evaluate(popup =>
                        [popup, ...popup.querySelectorAll('.swal2-actions, .swal2-confirm, .swal2-cancel')].map(element => {
                            const rect = element.getBoundingClientRect();
                            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
                        }));
                    assert.ok(bounds.every(rect => rect.left >= -1 && rect.top >= -1 &&
                        rect.right <= width + 1 && rect.bottom <= height + 1), `${width}×${height}, μενού ${open}: ${JSON.stringify(bounds)}`);
                }
        }
        await page.locator(approve ? '.swal2-confirm' : '.swal2-cancel').click();
        if (approve) {
            await page.waitForFunction(() => window.__savePending === true);
            assert.deepEqual(await page.evaluate(() => window.__uploads), []);
            assert.deepEqual(requests[2].body, { ...requests[1].body, historyPreflight: false,
                historyDecision: ready.decision, historyConfirmation: ready.historyConfirmation });
            await page.evaluate(() => { Swal.clickConfirm(); Swal.clickConfirm(); document.getElementById('save').click(); });
            assert.equal(writes, 1);
            releaseCommit();
            await page.waitForFunction(() => window.saveFinished);
            assert.equal(writes, 1);
            assert.equal(requests.length, 3);
            const uploads = await page.evaluate(() => window.__uploads);
            assert.equal(uploads.length, external ? 1 : 0);
            if (external) assert.equal(uploads[0][5], '2026-11-29');
        } else {
            await page.waitForFunction(() => window.saveFinished);
            assert.equal(writes, 0);
            assert.equal(requests.length, 2);
            assert.deepEqual(await page.evaluate(() => window.__uploads), []);
        }
    });
});
