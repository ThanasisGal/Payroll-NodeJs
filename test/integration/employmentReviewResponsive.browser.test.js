'use strict';
// Presentation-only verification: production EJS, CSS, JS and read-only workflow
// projections in the existing isolated adapter. No completion/apply/save commands.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createGuidanceFixture } = require('../helpers/employmentReviewGuidanceApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const sizes = [[1920,1080], [1680,1050], [1600,900], [1440,900], [1280,1024], [1280,800], [1280,720], [1100,700]];

test('responsive employment review in Chromium: seven resolutions, sidebar, smaller window and dialogs', {
    skip: !uri || !vendor, timeout: 300000
}, async t => {
    const data = await createGuidanceFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ screen: { width: 1920, height: 1080 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], failures = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });
    async function capture(name) {
        if (artifactDir) await page.screenshot({ path: path.join(artifactDir, `${name}.png`), animations: 'disabled' });
    }
    await page.goto(origin + '/review');
    await page.waitForFunction(() => Boolean(document.getElementById('ypokatasthma').tomselect?._preselectDone));
    await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    await page.waitForFunction(() => Boolean(document.getElementById('reviewEmployee').tomselect?._preselectDone));
    // Reproduce the production layout's Bootstrap main/sidebar columns. Closing
    // the sidebar frees the whole row; the form itself never receives a width.
    await page.evaluate(() => {
        const host = document.createElement('div');
        host.className = 'container-fluid container-scroll';
        host.innerHTML = '<div class="row"><aside id="sidebarMenu" class="col-md-3 col-lg-2"><div class="p-3">Μενού εφαρμογής</div></aside><main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent"></main></div>';
        const shell = document.querySelector('.employment-review-page-shell');
        document.body.appendChild(host);
        host.querySelector('main').appendChild(shell);
        document.documentElement.style.setProperty('--app-header-h', '0px');
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0001';
    });
    await page.evaluate(async () => { await loadResults(); await loadPreparedWeeklyHrStage1(); });
    // Regression found by CI: a large explanation must not intercept the next
    // navigation control after the table and outer workspace have scrolled.
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>document.getElementById('employmentReviewStage1Collapse').classList.add('show'));
    const guidance = page.locator('[data-guidance-stage="STAGE1"]');
    await guidance.locator('[data-guidance-move="first"]').click();
    await page.locator('#employmentReviewGuidancePopover').waitFor();
    await guidance.locator('[data-guidance-move="next"]').click();
    assert.match(await page.locator('#employmentReviewGuidancePopover').innerText(), /03\/09\/2026/);
    await capture('guidance-navigation-regression');
    await page.keyboard.press('Escape');
    await page.mouse.move(1,1);

    await page.evaluate(() => {
        // Deliberately constructed view states exercise the other stages without
        // rerunning algorithms, approving anything or modifying stored state.
        const payload = [...weeklyHrStage1Payloads.values()].find(p => p.scope.week_start === '2026-09-14') || [...weeklyHrStage1Payloads.values()][1];
        const item = {...payload.scope, date:'2026-09-15',row_id:String(payload.rows.find(r=>String(r.hmeromhnia).startsWith('2026-09-15'))._id),
            employment_label:'Πλήρης απασχόληση', allowed_classifications:['LEAVE','SICKNESS','ABSENCE'],
            presentation_facts:{weekly_rest_required_count:2,weekly_rest_recognized_count:1,weekly_rest_missing_count:1,weekly_rest_candidate_dates:['2026-09-15']}};
        renderWeeklyHrStage3({stages:{STAGE3:{pending_items:[item]}}});
        const group = {group_id:'responsive-only',status:'NEEDS_REVIEW',decision_grain:'ATOMIC_LINKED_SET',items:[
            {role:'SOURCE_BECOMES_WORK',employee_kodikos:'0001',date:'2026-09-16',proposed_values:{apo_ora_01_apologistika:'09:00',eos_ora_01_apologistika:'17:00',ores_ergasias_apologistika:8}},
            {role:'TARGET_BECOMES_REPO',employee_kodikos:'0001',date:'2026-09-19',proposed_values:{kathgoria_ergasias_apologistika:'ΑΝ',repo_apologistika:true}}]};
        document.getElementById('policyPreviewGroupsContainer').innerHTML = renderAtomicRepoTransferGroup(group);
        const daily = currentReviewRows.find(r=>String(r.hmeromhnia).startsWith('2026-09-15'));
        Object.assign(daily,{cards_apo_ora_01:'08:00',cards_eos_ora_01:'12:00',cards_apo_ora_02:'16:00',cards_eos_ora_02:'',
            apo_ora_01_apologistika:'08:00',eos_ora_01_apologistika:'12:00',apo_ora_02_apologistika:'16:00',eos_ora_02_apologistika:'18:00',apo_ora_03_apologistika:'19:00',eos_ora_03_apologistika:'21:00'});
        renderCurrentReviewRows();
        const employee = document.getElementById('reviewEmployee').tomselect;
        employee?.addOption({value:'0001',label:'0001 — ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ ΜΕ ΜΕΓΑΛΟ ΟΝΟΜΑ'});
        employee?.enable(); employee?.setValue('0001', true);
    });
    const before = await data.snapshot();
    const writes = [];
    mongoose.set('debug', (collection, method) => {
        if (/^(insert|update|delete|replace|findOneAnd)/.test(method)) writes.push({ collection, method });
    });
    t.after(() => mongoose.set('debug', false));
    for (const [width, height] of sizes) for (const sidebar of [true, false]) {
        const label = `${width}x${height}-${sidebar ? 'open' : 'closed'}`;
        const check = (ok, message) => { if (!ok) failures.push(`${label}: ${message}`); };
        await page.setViewportSize({ width, height });
        await page.evaluate(open => {
            document.getElementById('sidebarMenu').classList.toggle('d-none', !open);
            const main = document.querySelector('main');
            main.style.setProperty('width', open ? '' : '100%', 'important');
            main.style.setProperty('margin-left', open ? '' : '0px', 'important');
        }, sidebar);
        const stages = [];
        for (const stage of [1,2,3,4]) {
            await page.evaluate(stage => {
                closeEmploymentReviewGuidancePopover(false);
                for (const number of [1,2,3,4]) document.getElementById(`employmentReviewStage${number}Collapse`).classList.toggle('show', number === stage);
                document.querySelector('.review-card-body').scrollTop = 0;
                document.querySelector('.employment-review-scroll-container').scrollTop = 0;
                if (stage === 4) { const group = document.querySelector('#resultsTable .employee-group-row'); if (group?.getAttribute('aria-expanded') !== 'true') group?.click(); }
            }, stage);
            await page.evaluate(() => {
                // These are view-only scenarios for otherwise locked later
                // stages. Unlock their DOM presentation, never their commands.
                for (const id of ['policyPreviewGroupsContainer','weeklyHrStage3Container','employmentReviewStage4Summary','employmentReviewStage4PreviewNotice']) document.getElementById(id).hidden=false;
                document.querySelector('.results-table-wrapper').hidden=false;
            });
            await page.locator(`#employmentReviewStage${stage}Heading`).scrollIntoViewIfNeeded();
            await capture(`${label}-stage${stage}`);
            const contentTarget = page.locator(stage === 4 ? '.results-table-wrapper' : stage === 3 ? '.stage3-decisions-table-wrapper' : stage === 2 ? '#policyPreviewGroupsContainer' : '.weekly-hr-stage1-table-shell').first();
            if (await contentTarget.isVisible()) {
                await contentTarget.evaluate(n => {
                    const body = document.querySelector('.review-card-body');
                    const scroll = getComputedStyle(body).display === 'block' ? body : document.querySelector('.employment-review-scroll-container');
                    scroll.scrollTop += n.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
                    n.scrollTop = 0; n.scrollLeft = 0;
                });
                await capture(`${label}-stage${stage}-content`);
            }
            const metrics = await page.evaluate(() => {
                const shell = document.querySelector('.employment-review-page-shell');
                const tables = [...document.querySelectorAll('#employmentReviewWorkspace table')].filter(n => n.getBoundingClientRect().width > 0);
                const body = document.querySelector('.review-card-body'), scroll = document.querySelector('.employment-review-scroll-container');
                const font = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
                const visible = n => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0;
                const controls = [...document.querySelectorAll('#employmentReviewWorkspace .btn, #employmentReviewWorkspace button, #reviewFiltersEnterScope input:not([type=hidden])')].filter(visible);
                const tiny = [...document.querySelectorAll('#employmentReviewWorkspace *')].filter(n => visible(n) && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(n).fontSize) < 13.59)
                    .map(n => ({ tag: n.tagName, class: n.className, text: n.textContent.slice(0,80), font: getComputedStyle(n).fontSize }));
                const fields = [...document.querySelectorAll('#reviewFiltersEnterScope > div')].map(n=>({width:n.getBoundingClientRect().width, top:n.getBoundingClientRect().top}));
                return { contentWidth: shell.clientWidth, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    bodyHeight: body.clientHeight, scrollHeight: scroll.clientHeight, verticalScroller: getComputedStyle(body).overflowY === 'auto' ? 'body' : 'workspace',
                    fields, headers:tables.flatMap(n=>[...n.querySelectorAll(':scope > thead th')].map(th=>({text:th.textContent,overflow:th.scrollWidth-th.clientWidth}))), fonts: { text: font('#employmentReviewWorkspace'), field: font('#apo_hmeromhnia'), button: font('#searchBtn'), title: font('.employment-review-card h3') }, tiny,
                    tables: tables.map(n => ({ id: n.id || n.className, width:n.getBoundingClientRect().width, parentWidth:n.parentElement.clientWidth, overflow:getComputedStyle(n.parentElement).overflowX })),
                    controlsOutside: controls.filter(n => {const r=n.getBoundingClientRect();return !n.closest('table') && (r.left < shell.getBoundingClientRect().left - 1 || r.right > shell.getBoundingClientRect().right + 1);}).map(n=>n.id||n.textContent.trim()) };
            });
            check(metrics.pageOverflow <= 1, `page overflow ${metrics.pageOverflow}`);
            check(metrics.tiny.length === 0, `tiny text ${JSON.stringify(metrics.tiny.slice(0,8))}`);
            check(metrics.headers.every(h=>h.overflow<=1), `clipped headers ${JSON.stringify(metrics.headers.filter(h=>h.overflow>1))}`);
            check(metrics.controlsOutside.length === 0, `controls outside ${metrics.controlsOutside}`);
            for (const table of metrics.tables) check(table.width <= table.parentWidth + 1 || ['auto','scroll'].includes(table.overflow), `uncontained table ${table.id}`);
            if ([1,3,4].includes(stage)) {
                const tableRegion = page.locator(stage === 1 ? '.weekly-hr-stage1-table-shell' : stage === 3 ? '.stage3-decisions-table-wrapper' : '.results-table-wrapper').first();
                const horizontal = await tableRegion.evaluate(n => {
                    n.scrollLeft=n.scrollWidth;
                    return {left:n.scrollLeft,width:n.clientWidth,total:n.scrollWidth};
                });
                check(horizontal.total<=horizontal.width+1 || horizontal.left>0, 'table must really scroll horizontally');
                await capture(`${label}-stage${stage}-right`);
                await tableRegion.evaluate(n=>n.scrollLeft=0);
            }
            stages.push({ stage, ...metrics });
            if (stage === 3) {
                const action = page.locator('.weekly-hr-stage3-resolve').first();
                await action.scrollIntoViewIfNeeded();
                await page.mouse.move(1,1);
                await action.evaluate(n=>n.blur());
                await page.waitForFunction(() => {
                    const n=document.querySelector('.weekly-hr-stage3-resolve');
                    return !n.matches(':hover, :focus') && !n.getAnimations().length;
                });
                const normal = await action.evaluate(n=>getComputedStyle(n).backgroundColor);
                await action.hover();
                await page.waitForFunction(color=>getComputedStyle(document.querySelector('.weekly-hr-stage3-resolve')).backgroundColor!==color,normal);
                await page.mouse.move(1,1);
            }
        }
        await page.evaluate(() => {
            const row = currentReviewRows.find(row => String(row.hmeromhnia).startsWith('2026-09-15'));
            showDetailsModal(row);
            document.getElementById('auditHistoryContainer').innerHTML=renderAuditRow({changedAt:'2026-09-30T10:00:00Z',changedBy:'ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ',reason:'Παρουσίαση ιστορικού για οπτικό έλεγχο χωρίς αποθήκευση',oldValues:{apo_ora_01_apologistika:'09:00',eos_ora_01_apologistika:'13:00'},newValues:{apo_ora_01_apologistika:'09:00',eos_ora_01_apologistika:'17:00'}});
        });
        await page.locator('#detailsModal.show').waitFor();
        await page.waitForTimeout(180);
        await capture(`${label}-daily-editor`);
        const daily = await measureDialog('#detailsModal');
        check(daily.fits && daily.footerVisible && daily.bodyScrolls && daily.bodyOverflow <= 1 && daily.tiny.length === 0, `daily modal ${JSON.stringify(daily)}`);
        // Scroll all the way to the actual save/history controls without saving.
        await page.locator('#detailsModal .modal-body').evaluate(n => n.scrollTop = n.scrollHeight);
        await capture(`${label}-daily-editor-bottom`);
        await page.evaluate(() => {
            const row = {...currentReviewRows.find(r=>String(r.hmeromhnia).startsWith('2026-09-15')),
                orphan_card_resolution_preview:{orphanVisible:true,eligible:true,orphanType:'START_ONLY',
                    unresolvedPairs:[{pairNumber:2,orphanType:'START_ONLY',knownStart:'16:00',missingPunch:'END'}],
                    approvedWorkIntervals:[{pairNumber:1,start:'08:00',end:'12:00'},{pairNumber:2,start:'16:00',end:'18:00'},{pairNumber:3,start:'19:00',end:'21:00'}],proposal:{scheduleKind:'SPLIT',durationSource:'HR_MANUAL_FULL_DAY',durationHours:8,start:'08:00',end:'21:00',workIntervals:[{pairNumber:1,start:'08:00',end:'12:00'},{pairNumber:2,start:'16:00',end:'18:00'},{pairNumber:3,start:'19:00',end:'21:00'}]}}};
            document.getElementById('detailsContainer').innerHTML = renderOrphanCardResolutionSection(row);
            document.querySelector('#detailsModal .modal-body').scrollTop=0;
        });
        await capture(`${label}-orphan-preview`);
        const orphan = await measureDialog('#detailsModal');
        check(orphan.fits && orphan.footerVisible && orphan.bodyOverflow <= 1 && orphan.tiny.length === 0, `orphan modal ${JSON.stringify(orphan)}`);
        await closeModal('#detailsModal');
        await page.evaluate(() => {
            const row = [...weeklyHrStage1RowsById.values()].find(r=>String(r.hmeromhnia).startsWith('2026-09-15'));
            openWeeklyHrStage1DayEditor(String(row._id));
        });
        await page.locator('#weeklyHrStage1DayEditor.show').waitFor();
        await capture(`${label}-day-drawer`);
        const drawer = await page.locator('#weeklyHrStage1DayEditor').evaluate(n => {
            const r=n.getBoundingClientRect(), nav=n.querySelector('.weekly-hr-stage1-editor-navigation').getBoundingClientRect();
            return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,footerVisible:nav.bottom<=innerHeight};
        });
        check(drawer.fits && drawer.footerVisible, `day drawer ${JSON.stringify(drawer)}`);
        await page.locator('#weeklyHrStage1DayEditor [data-bs-dismiss=offcanvas]').click();
        await page.locator('#weeklyHrStage1DayEditor').waitFor({state:'hidden'});
        await page.evaluate(() => {
            // Render the enabled editor as a view-only fixture. Restore the
            // client projection immediately; no handlers or commands are run.
            const original = currentEmploymentPeriodControl;
            try {
                currentEmploymentPeriodControl = {...original, calculation:{authoritative_result:true},allowed_actions:{record_decision:true}};
                document.getElementById('canonicalDecisionContainer').innerHTML=renderCanonicalDecisionEditor({index_readiness:{ready:true},supported_actions:{repo_identities:true,classification_by_date:true},current_repo_candidate_dates:['2026-09-12','2026-09-13'],week_rows:[{date:'2026-09-15'}]});
            } finally { currentEmploymentPeriodControl = original; }
            bootstrap.Modal.getOrCreateInstance(document.getElementById('canonicalDecisionModal')).show();
        });
        await page.locator('#canonicalDecisionModal.show').waitFor();
        await page.locator('#canonicalDecisionType').waitFor();
        await capture(`${label}-weekly-hr`);
        const canonical = await measureDialog('#canonicalDecisionModal');
        check(canonical.fits && canonical.footerVisible && canonical.bodyOverflow <= 1 && canonical.tiny.length === 0, `weekly HR ${JSON.stringify(canonical)}`);
        await closeModal('#canonicalDecisionModal');
        await page.evaluate(() => bootstrap.Modal.getOrCreateInstance(document.getElementById('pdfPreviewModal')).show());
        await page.locator('#pdfPreviewModal.show').waitFor();
        await capture(`${label}-pdf-preview`);
        const pdf = await page.locator('#pdfPreviewModal').evaluate(n => {
            const frame=n.querySelector('iframe').getBoundingClientRect(), header=n.querySelector('.modal-header').getBoundingClientRect();
            return {fits:frame.bottom<=innerHeight+1&&frame.top>=header.bottom-1,downloadVisible:n.querySelector('#reviewPdfDownloadBtn').getBoundingClientRect().bottom<=innerHeight};
        });
        check(pdf.fits && pdf.downloadVisible, `PDF preview ${JSON.stringify(pdf)}`);
        await closeModal('#pdfPreviewModal');
        await page.evaluate(() => {
            const details = Array.from({length:20},(_,i)=>({employee:'ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ ΜΕ ΜΕΓΑΛΟ ΟΝΟΜΑ',employee_kodikos:'0001',week_start:'2026-09-07',week_end:'2026-09-13',date:`2026-09-${String(7+i%7).padStart(2,'0')}`,before:'ΠΙΘΑΝΗ ΑΔΕΙΑ',after:'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ',safety_reason:'Επεξήγηση της προτεινόμενης αλλαγής.'}));
            renderWeeklyHrStage2BulkPreviewModal({safe_bulk_count:20,safe_employee_count:1,safe_week_count:1,safe_day_change_count:20},{page:1,page_count:2,details});
            bootstrap.Modal.getOrCreateInstance(document.getElementById('weeklyHrStage2BulkPreviewModal')).show();
        });
        await page.locator('#weeklyHrStage2BulkPreviewModal.show').waitFor();
        await capture(`${label}-bulk-preview`);
        const bulk = await measureDialog('#weeklyHrStage2BulkPreviewModal');
        check(bulk.fits && bulk.footerVisible && bulk.bodyScrolls, `bulk modal ${JSON.stringify(bulk)}`);
        await closeModal('#weeklyHrStage2BulkPreviewModal');
        await page.evaluate(() => {
            employmentReviewSwal({ title:'Προεπισκόπηση απόφασης HR', html:weeklyHrStage3BulkPreviewHtml({classification:'ABSENCE',selected_count:25,employee_count:1,will_apply_count:25,items:Array.from({length:25},()=>({employee_id:'synthetic',employee_name:'ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ',employee_kodikos:'0001',decision_date:'2026-09-15',outcome:'APPLY'}))}), input:'textarea',inputLabel:'Αιτιολογία απόφασης',showCancelButton:true,confirmButtonText:'Επιβεβαίωση',cancelButtonText:'Ακύρωση',customClass:{popup:'employment-review-stage3-bulk-preview-popup'}});
        });
        await page.locator('.employment-review-swal-popup').waitFor();
        await capture(`${label}-hr-confirmation`);
        const swal = await page.locator('.employment-review-swal-popup').evaluate(n => {
            const r=n.getBoundingClientRect(), a=n.querySelector('.swal2-actions').getBoundingClientRect();
            return { fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,actionsVisible:a.bottom<=innerHeight,bodyFont:getComputedStyle(n.querySelector('.swal2-html-container')).fontSize };
        });
        check(swal.fits && swal.actionsVisible, `HR confirmation ${JSON.stringify(swal)}`);
        await page.evaluate(()=>Swal.close());
        measurements.push({label,stages,daily,orphan,drawer,canonical,pdf,bulk,swal});
    }
    async function closeModal(selector) {
        await page.locator(`${selector} [data-bs-dismiss=modal]`).first().click();
        await page.locator(selector).waitFor({state:'hidden'});
    }
    async function measureDialog(selector) {
        return page.locator(selector).evaluate(n=>{
            const c=n.querySelector('.modal-content').getBoundingClientRect(), body=n.querySelector('.modal-body'), footer=n.querySelector('.modal-footer').getBoundingClientRect();
            return {fits:c.left>=0&&c.right<=innerWidth+1&&c.top>=0&&c.bottom<=innerHeight+1,footerVisible:footer.bottom<=innerHeight&&footer.top>=0,tiny:[...body.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().width>0&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())&&parseFloat(getComputedStyle(n).fontSize)<13.59).map(n=>({class:n.className,text:n.textContent.slice(0,50),font:getComputedStyle(n).fontSize})),bodyScrolls:body.scrollHeight>body.clientHeight,bodyHeight:body.clientHeight,bodyOverflow:body.scrollWidth-body.clientWidth,overflowing:[...body.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().right>body.getBoundingClientRect().right+1).map(n=>({tag:n.tagName,class:n.className,id:n.id,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right})).slice(0,12)};
        });
    }
    if (artifactDir) fs.writeFileSync(path.join(artifactDir,'responsive-measurements.json'),JSON.stringify({measurements,failures,errors},null,2));
    assert.deepEqual(writes, [], 'viewing the form must not write data');
    assert.equal(await data.snapshot(), before, 'read-only layout inspection preserves all synthetic data');
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
});
