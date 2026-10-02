'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const view = read('views/ergazomenoi/programmata/apologistikosPinakasYperorion.ejs');
const script = read('public/js/ergazomenoi/programmata/wtoOvertime.js');
const commonUi = read('public/js/ergazomenoi/genika/erganiRestSubmissionUi.js');
const routes = read('server/routes/usersRoute.js');
const deploy = read('deploy-ubuntu.sh');
const controller = read('server/controllers/ergazomenoi/wtoOvertimeController.js');
const submissionService = read('server/services/ergazomenoi/wtoOvertimeSubmissionService.js');

for (const id of ['wtoOvertimeBranch', 'wtoOvertimeFrom', 'wtoOvertimeTo',
    'wtoOvertimePreviewButton', 'wtoOvertimeSubmitButton', 'wtoOvertimeRows',
    'wtoOvertimeSummary', 'wtoOvertimeEmployeeCount', 'wtoOvertimeDayCount',
    'wtoOvertimeSubmittedTotal']) {
    assert.ok(view.includes(`id="${id}"`), id);
}
const summaryMarkup = view.match(/<div[^>]+id="wtoOvertimeSummary"[\s\S]*?<\/div>/)?.[0] || '';
const summaryLabels = [...summaryMarkup.matchAll(/<span>([^:<]+):/g)].map((match) => match[1].trim());
assert.deepStrictEqual(summaryLabels, [
    'Εργαζόμενοι', 'Ημέρες', 'Σύνολο Υποβαλλόμενων Υπερωριών'
]);
for (const removedLabel of ['Πραγματικό διάστημα', 'Εγγραφές', 'Αναλυτικές',
    'Νόμιμη υπερωρία', 'Canonical', 'Analytics', 'Ισοτιμία', 'Προειδοποιήσεις',
    'Εμπόδια', 'Επιπλέον χρόνος', 'Εκτός αυτόματης']) {
    assert.ok(!summaryMarkup.includes(removedLabel), `summary: ${removedLabel}`);
}
assert.match(summaryMarkup, /d-flex flex-nowrap/);
assert.match(view, /#wtoOvertimeSummary\s*\{[\s\S]*?white-space:\s*nowrap/);
assert.ok(!view.includes('id="wtoOvertimeWarnings"'));
assert.ok(!view.includes('id="wtoOvertimeBlockers"'));
assert.ok(!view.includes('id="wtoOvertimeJson"'));
assert.ok(!script.includes('JSON.stringify(data.payload'));

const tableHead = view.match(/<thead[\s\S]*?<\/thead>/)?.[0] || '';
const visibleHeaders = [...tableHead.matchAll(/<th>([^<]+)<\/th>/g)].map((match) => match[1]);
assert.deepStrictEqual(visibleHeaders, [
    'Κωδικός', 'ΑΦΜ', 'Εργαζόμενος', 'Ημερομηνία', 'Προς υποβολή',
    'Τύπος', 'Από', 'Έως', 'Κατάσταση'
]);
for (const removedHeader of ['Βασικό τέλος', 'Πηγή', 'Νόμιμη υπερεργασία',
    'Νόμιμη υπερωρία', 'Εκτός αυτόματης']) {
    assert.ok(!tableHead.includes(`<th>${removedHeader}</th>`), `header: ${removedHeader}`);
}
assert.match(script, /Number\(row\.excess_minutes\) > 0/);
assert.match(script, />ΠΡΟΣΟΧΗ<\/td>/);
assert.match(script, />ΕΤΟΙΜΟ<\/td>/);
assert.match(script, />ΑΠΑΙΤΕΙ ΕΛΕΓΧΟ<\/td>/);
assert.match(script, /data-wto-overtime-tooltip="\$\{escapeHtml\(item\.message \|\| ''\)\}"/);
assert.match(script, /<td class="wto-overtime-status-attention fw-semibold" tabindex="0"/);
assert.ok(!script.includes('<tr class="wto-overtime-status-attention'));
assert.match(view, /\.wto-overtime-status-attention\s*\{[\s\S]*?background-color:\s*#fff8db/);
assert.match(view, /\.wto-overtime-status-attention\s*\{[\s\S]*?cursor:\s*help/);

const exactTooltip = 'Η απολογιστική νόμιμη υπερωρία της ημέρας υπερβαίνει τις 3 ώρες. ' +
    'Στην αυτόματη υποβολή θα συμπεριληφθούν έως 3 ώρες. ' +
    'Ο επιπλέον χρόνος δεν περιλαμβάνεται στην αυτόματη υποβολή.';
assert.ok(script.includes(exactTooltip));
assert.doesNotMatch(script, /data-bs-toggle="tooltip"/);
assert.doesNotMatch(script, /bootstrap\.Tooltip|Popper|getOrCreateInstance|getInstance/);
assert.equal((view.match(/id="wtoOvertimeHelpTooltip"/g) || []).length, 1);
assert.match(view, /id="wtoOvertimeHelpTooltip" class="wto-overtime-help-tooltip" role="tooltip"/);
assert.match(view, /\.wto-overtime-help-tooltip\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?visibility:\s*hidden;[\s\S]*?opacity:\s*0;[\s\S]*?pointer-events:\s*none;[\s\S]*?top:\s*-9999px;[\s\S]*?left:\s*-9999px;[\s\S]*?z-index:\s*1080;/);
assert.match(view, /\.wto-overtime-help-tooltip\s*\{[\s\S]*?max-width:\s*28rem;[\s\S]*?white-space:\s*normal;[\s\S]*?background:\s*#fff8db;[\s\S]*?border:\s*1px solid #e5cf78;/);
const showTooltip = script.slice(script.indexOf('function showHelpTooltip'),
    script.indexOf('function renderSubmissionRow'));
assert.ok(showTooltip.indexOf('getBoundingClientRect()') < showTooltip.indexOf('const finalLeft'));
assert.ok(showTooltip.indexOf('const finalLeft') < showTooltip.indexOf('helpTooltip.style.top = `${Math.round(finalTop)}px`'));
assert.ok(showTooltip.indexOf('helpTooltip.style.top = `${Math.round(finalTop)}px`') <
    showTooltip.indexOf("helpTooltip.style.visibility = 'visible'"));
assert.ok(showTooltip.indexOf('helpTooltip.style.left = `${Math.round(finalLeft)}px`') <
    showTooltip.indexOf("helpTooltip.style.visibility = 'visible'"));
assert.match(showTooltip, /Math\.min\(maximumLeft, Math\.max\(viewportPadding/);
assert.match(showTooltip, /preferredTop >= viewportPadding \? preferredTop : bottomTop/);
assert.match(script, /rowsBody\.addEventListener\('mouseover'/);
assert.match(script, /rowsBody\.addEventListener\('mouseout'/);
assert.match(script, /rowsBody\.addEventListener\('focusin'/);
assert.match(script, /rowsBody\.addEventListener\('focusout'/);
assert.match(script, /window\.addEventListener\('scroll', hideHelpTooltip, true\)/);
assert.match(script, /window\.addEventListener\('resize', hideHelpTooltip\)/);
assert.match(script, /event\.key === 'Escape'/);
assert.match(script, /data-wto-overtime-tooltip="\$\{escapeHtml\(item\.message \|\| ''\)\}"/);
assert.ok(!/(?:onclick|onmouseover|onmouseenter|onfocus)\s*=/.test(`${view}\n${script}`));

assert.ok(script.includes('Η προεπισκόπηση είναι έτοιμη για υποβολή στο ΕΡΓΑΝΗ.'));
assert.ok(script.includes('Οι ημέρες που χρειάζονται προσοχή επισημαίνονται στη στήλη «Κατάσταση».'));
assert.ok(script.includes('Η προεπισκόπηση δεν μπορεί να υποβληθεί ακόμη.'));
assert.ok(script.includes('Ελέγξτε τις γραμμές με ένδειξη στη στήλη «Κατάσταση».'));
for (const technicalMessage of ['ακριβή ισοτιμία', 'canonical υποβολή',
    'canonical απολογιστικά δεδομένα', 'έχει εμπόδια']) {
    assert.ok(!script.includes(technicalMessage), technicalMessage);
}
assert.match(view, /id="wtoOvertimeSubmitButton" disabled/);
assert.match(view, /id="wtoOvertimeFrom"[\s\S]*?periodRec && periodRec\.apo/);
assert.match(view, /id="wtoOvertimeTo"[\s\S]*?periodRec && periodRec\.eos/);
assert.ok(view.indexOf("script('ergazomenoi/genika/erganiRestSubmissionUi')") <
    view.indexOf("script('ergazomenoi/programmata/wtoOvertime.js')"));
assert.ok(!view.includes('sendApologistikoYperorionButton'));
assert.ok(script.includes("'/api/ergazomenoi/programmata/wto-overtime/preview'"));
assert.ok(script.includes("'/api/ergazomenoi/programmata/wto-overtime/submit'"));
assert.ok(script.includes('presentSubmissionResultSafely'));
assert.ok(script.includes("pdfViewerVariant: 'compact-portrait'"));
assert.ok(script.includes('preview_fingerprint: validPreview.preview_fingerprint'));
assert.match(script, /\^\[a-f0-9\]\{64\}\$/);
assert.match(script, /validPreview\s*=\s*data\.submission_eligible[\s\S]*?data\.preview_fingerprint[\s\S]*?\? data : null/);
assert.ok(script.includes('error.code = data.code'));
assert.ok(script.includes("error.code === 'WTOOVA_PREVIEW_STALE'"));
assert.ok(script.includes("error.code === 'WTOOVA_INVALID_PREVIEW_FINGERPRINT'"));
assert.ok(script.includes("invalidatePreview('Τα δεδομένα άλλαξαν."));
assert.match(script, /function invalidatePreview[\s\S]*?validPreview = null;[\s\S]*?submitButton\.disabled = true/);
assert.match(script, /\[branch, from, to\]\.forEach\([\s\S]*?invalidatePreview\(\)/);
assert.ok(!script.includes('payload: validPreview'));
assert.ok(!script.includes('rows: validPreview'));
assert.ok(commonUi.includes('`${safePdfUrl}#view=FitH&navpanes=0`'));
assert.ok(commonUi.includes('href="${escapeHtml(safePdfUrl)}"'));
assert.ok(routes.includes('wtoOvertimeController.deprecatedLegacy'));
assert.ok(deploy.includes('"public/js/ergazomenoi/programmata/wtoOvertime.js"'));
assert.ok(!deploy.includes('"public/js/ergazomenoi/programmata/sendApologistikoYperorionButton.js"'));
assert.ok(!controller.includes('wtoOv_v1Generator'));
assert.ok(controller.includes("'preview_fingerprint'"));
assert.ok(controller.includes('WTOOVA_PREVIEW_STALE'));
assert.ok(controller.includes('claimRequestId(fingerprint)'));
assert.ok(!submissionService.includes('splitOvertimeRow'));
assert.ok(!submissionService.includes('resolveBaseEndTime'));
assert.ok(!submissionService.includes('apasxoliseisCardPairResolverService'));
assert.ok(submissionService.includes('source.apo_ora_yperories'));
assert.ok(submissionService.includes('source.eos_ora_yperories'));

console.log('PASS WTOOvA UI, common PDF viewer, clean download URL and deployment artifact contract');
