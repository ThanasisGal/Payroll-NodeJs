// ./server/utils/efka/continueApd.js
'use strict';

const { getSession, closeSession } = require('./efkaSessionStore');

function log(...a) { console.log('[EFKA]', ...a); }
function err(...a) { console.error('[EFKA][ERROR]', ...a); }

const pad2 = (n) => String(n).padStart(2, '0');

function prevMonthMY(d = new Date()) {
	const year = d.getFullYear();
	const month = d.getMonth() + 1; // 1..12
	const m = month - 1;
	if (m >= 1) return { month: m, year };
	return { month: 12, year: year - 1 };
}

function fmtMY(my) {
	return `${pad2(my.month)}/${my.year}`;
}

function normalizeText(s) {
	return String(s ?? '')
		.replace(/\u00a0/g, ' ')
		.replace(/[\t\r\n]+/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}
function ensureDigits(s) {
	const d = String(s ?? '').replace(/\D+/g, '');
	return d.length ? d : '';
}

// helpers για "m/yyyy" & σύγκριση
function parseMY(s) {
	const m = String(s).trim().match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
	if (!m) return null;
	return { month: Number(m[1]), year: Number(m[2]) };
}
function cmpMY(a, b) {
	if (!a || !b) return 0;
	if (a.year !== b.year) return a.year > b.year ? 1 : -1;
	if (a.month !== b.month) return a.month > b.month ? 1 : -1;
	return 0;
}

async function safeCount(locator) {
	try { return await locator.count(); } catch { return 0; }
}

async function maybeWaitDom(page, timeoutMs) {
	try { await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }); } catch {}
}

async function waitVisible(locator, timeoutMs) {
	await locator.waitFor({ state: 'visible', timeout: timeoutMs });
}

async function clickSoftNav(page, locator, timeoutMs) {
	await waitVisible(locator, timeoutMs);
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {}),
		locator.click(),
	]);
	await maybeWaitDom(page, timeoutMs);
}

/**
 * PrimeFaces: περίμενε να αδειάσει η AJAX queue.
 */
async function waitPrimefacesIdle(page, timeoutMs) {
	await page.waitForFunction(() => {
		try {
			// eslint-disable-next-line no-undef
			if (window.PrimeFaces && PrimeFaces.ajax && PrimeFaces.ajax.Queue && typeof PrimeFaces.ajax.Queue.isEmpty === 'function') {
				return PrimeFaces.ajax.Queue.isEmpty();
			}
		} catch {}
		return true;
	}, { timeout: timeoutMs }).catch(() => {});
}

/**
 * ✅ ΣΤΑΘΕΡΟ click στο "Ναι" PrimeFaces ConfirmDialog.
 * Προσπαθεί πρώτα με widgetVar (PF('<name>')), αλλιώς fallback σε DOM search.
 */
async function clickPrimefacesConfirmYes(apdPage, timeoutMs, widgetVar = 'backConfirmation') {
	await apdPage.waitForFunction((w) => {
		try {
			// eslint-disable-next-line no-undef
			const dlg = window.PF ? window.PF(w) : null;
			if (!dlg || !dlg.jq) return false;
			return dlg.jq.is(':visible');
		} catch {
			return false;
		}
	}, widgetVar, { timeout: timeoutMs });

	const clicked = await apdPage.evaluate((w) => {
		try {
			// eslint-disable-next-line no-undef
			const dlg = window.PF ? window.PF(w) : null;
			if (!dlg || !dlg.jq) return false;

			const root = dlg.jq[0];
			if (!root) return false;

			const buttons = Array.from(root.querySelectorAll('button'));
			const yes = buttons.find(b => (b.textContent || '').replace(/\s+/g, ' ').trim() === 'Ναι')
				|| buttons.find(b => (b.textContent || '').includes('Ναι'));

			if (!yes) return false;

			yes.scrollIntoView({ block: 'center', inline: 'center' });
			yes.click();
			return true;
		} catch {
			return false;
		}
	}, widgetVar);

	if (clicked) {
		await apdPage.waitForFunction((w) => {
			try {
				// eslint-disable-next-line no-undef
				const dlg = window.PF ? window.PF(w) : null;
				if (!dlg || !dlg.jq) return true;
				return !dlg.jq.is(':visible');
			} catch {
				return true;
			}
		}, widgetVar, { timeout: timeoutMs }).catch(() => {});
		return true;
	}

	const fallbackClicked = await apdPage.evaluate(() => {
		const visibles = Array.from(document.querySelectorAll('.ui-confirm-dialog.ui-dialog'))
			.filter(d => {
				const style = window.getComputedStyle(d);
				return style && style.display !== 'none' && style.visibility !== 'hidden' && d.offsetParent !== null;
			});

		for (const d of visibles) {
			const btn = Array.from(d.querySelectorAll('button'))
				.find(b => (b.textContent || '').replace(/\s+/g, ' ').trim() === 'Ναι'
					|| (b.textContent || '').includes('Ναι'));
			if (btn) { btn.click(); return true; }
		}
		return false;
	});

	if (!fallbackClicked) throw new Error('Δεν κατάφερα να κάνω click στο "Ναι" του ConfirmDialog.');
	return true;
}

/**
 * Dialog2 flow (δημιουργία περιόδου / συμπληρωματική) — ΧΩΡΙΣ navigation.
 */
async function ensureSupplementalPeriodViaDialog2(apdPage, timeoutMs) {
	const openDialogLink = apdPage.locator('a:has-text("Δημιουργία Περιόδου Υποβολής")').first();
	const dialog = apdPage.locator('#dialog2').first();

	const submissionRows = apdPage.locator('table tbody tr').filter({
		has: apdPage.locator('td:first-child a', { hasText: /^\s*\d+\s*$/ }),
	});

	const rowCount = await submissionRows.count().catch(() => 0);
	const hasRecords = rowCount > 0;

	if (!(await safeCount(openDialogLink)) && !(await safeCount(dialog)) && !hasRecords) return false;

	let periodFromStr = null;
	let periodToStr = null;

	if (hasRecords) {
		let targetRowIndex = -1;
		let targetFrom = null;
		let targetTo = null;

		for (let i = 0; i < rowCount; i++) {
			const row = submissionRows.nth(i);
			const statusText = normalizeText(
				await row.locator('td').nth(3).innerText().catch(() => '')
			);

			const statusExact = statusText.replace(/\s+/g, ' ').trim().toUpperCase();
			if (statusExact !== 'ΥΠΟΒΟΛΗ') continue;

			const periodText = normalizeText(
				await row.locator('td').nth(2).innerText().catch(() => '')
			);

			const parts = periodText.split(/-|–|—/).map(x => x.trim());
			if (parts.length !== 2) continue;

			const from = parseMY(parts[0]);
			const to = parseMY(parts[1]);
			if (!from || !to) continue;

			targetRowIndex = i;
			targetFrom = from;
			targetTo = to;
			break;
		}

		if (targetRowIndex === -1) {
			const pm = prevMonthMY(new Date());
			periodFromStr = fmtMY(pm);
			periodToStr = fmtMY(pm);
			log('Δεν βρέθηκε Κατάσταση=ΥΠΟΒΟΛΗ. Fallback σε προηγούμενο μήνα:', periodFromStr);
		} else {
			periodFromStr = fmtMY(targetFrom);
			periodToStr = fmtMY(targetTo);

			const targetRow = submissionRows.nth(targetRowIndex);
			const safeTd = targetRow.locator('td').filter({ hasNot: apdPage.locator('a') }).first();
			await safeTd.scrollIntoViewIfNeeded();
			await safeTd.click({ timeout: timeoutMs }).catch(async () => {
				await targetRow.click({ position: { x: 200, y: 10 }, timeout: timeoutMs });
			});
		}
	}

	if (await safeCount(openDialogLink)) {
		await openDialogLink.click();
	}

	if (!(await safeCount(dialog))) {
		await apdPage.waitForSelector('#dialog2', { timeout: timeoutMs }).catch(() => {});
	}

	if (!(await safeCount(dialog))) return true;

	await dialog.waitFor({ state: 'visible', timeout: timeoutMs });

	const fromInput = apdPage.locator('input#openPeriodForm\\:submissionPeriodDlg');
	const toInput = apdPage.locator('input#openPeriodForm\\:submissionPeriodDlgB');

	const statementValue = hasRecords ? '04' : '01';
	await apdPage.selectOption('select#openPeriodForm\\:statementTypeDlg', { value: statementValue });

	if (periodFromStr && periodToStr) {
		await waitVisible(fromInput, timeoutMs);
		await waitVisible(toInput, timeoutMs);
		await fromInput.fill(periodFromStr);
		await toInput.fill(periodToStr);
		await fromInput.press('Tab').catch(() => {});
		await toInput.press('Tab').catch(() => {});
	}

	const continueBtn = dialog.locator(
		'button:has-text("Συνέχεια"), a:has-text("Συνέχεια"), .ui-button:has-text("Συνέχεια")'
	).first();

	await waitVisible(continueBtn, timeoutMs);

	const beforeCount = await apdPage.locator('#submissionTable_data > tr').count().catch(() => 0);
	await continueBtn.click();

	const pendingMsg = dialog.locator(
		'.ui-messages-error, .ui-message-error, .ui-messages-warn, .ui-message-warn'
	).filter({ hasText: 'Υπάρχουν ΑΠΔ' }).first();

	await pendingMsg.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
	const isPendingVisible = await pendingMsg.isVisible().catch(() => false);

	if (isPendingVisible) {
		const txt = normalizeText(await pendingMsg.innerText().catch(() => ''));
		if (txt) err('Dialog warning:', txt);

		const closeBtn = dialog.locator(
			'button:has-text("Κλείσιμο"), a:has-text("Κλείσιμο"), .ui-button:has-text("Κλείσιμο")'
		).first();

		if (await safeCount(closeBtn)) {
			await closeBtn.click().catch(() => {});
		} else {
			await dialog.locator('.ui-dialog-titlebar-close, a[aria-label="Κλείσιμο"]').first().click().catch(() => {});
		}

		await dialog.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {});
	} else {
		await Promise.race([
			dialog.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {}),
			apdPage.waitForFunction(
				(prev) => {
					const tbody = document.querySelector('#submissionTable_data');
					if (!tbody) return false;
					return tbody.querySelectorAll('tr').length !== prev;
				},
				beforeCount,
				{ timeout: timeoutMs }
			).catch(() => {}),
		]);
	}

	const msgText = normalizeText(await apdPage.locator('#openPeriodForm\\:msgs2').innerText().catch(() => ''));
	if (msgText) err('PrimeFaces msgs2:', msgText);

	return true;
}

/**
 * Συνέχεια στο ίδιο APD tab/session.
 */
async function continueApd(sessionId, opts = {}) {
	const TOTAL_STEPS = 9;

	const emitProgress = (step, percent, message) => {
		if (typeof opts.onProgress === 'function') {
			try {
				opts.onProgress({ step, totalSteps: TOTAL_STEPS, percent, message });
			} catch {}
		}
	};

	const t0 = Date.now();
	const mark = (msg) => log(`${msg} (+${((Date.now() - t0) / 1000).toFixed(1)}s)`);

	const s = getSession(sessionId);
	if (!s || !s.apdPage) return { success: false, error: 'Invalid/expired sessionId' };

	const apdPage = s.apdPage;
	const isDocker = String(process.env.DOCKER || '').toLowerCase() === 'true';
	const timeoutMs = typeof opts.timeoutMs === 'number'
		? opts.timeoutMs
		: (isDocker ? 60000 : 15000);

	const waitForSelector = typeof opts.waitForSelector === 'string' ? opts.waitForSelector : null;
	const closeAfter = !!opts.closeAfter;

	try {
		if (apdPage.isClosed()) {
			await closeSession(sessionId).catch(() => {});
			return { success: false, error: 'Session page closed' };
		}

		emitProgress(1, 5, 'Σύνδεση στο περιβάλλον ΕΦΚΑ...');
		await maybeWaitDom(apdPage, timeoutMs);
		if (waitForSelector) await apdPage.waitForSelector(waitForSelector, { timeout: timeoutMs });

		// "Είσοδος Εργοδότη" (conditional)
		const socialBtn = apdPage.locator('#social-taxisnet-employer');
		if (await safeCount(socialBtn)) {
			await clickSoftNav(apdPage, socialBtn, timeoutMs);
		}

		// Login (conditional)
		const userField = apdPage.locator('#j_username');
		const passField = apdPage.locator('#j_password');
		const loginBtn = apdPage.locator('#btn-login-submit');

		if (
			opts?.username &&
			opts?.password &&
			(await safeCount(userField)) &&
			(await safeCount(passField)) &&
			(await safeCount(loginBtn))
		) {
			await waitVisible(userField, timeoutMs);
			await waitVisible(passField, timeoutMs);

			await apdPage.fill('#j_username', String(opts.username));
			await apdPage.fill('#j_password', String(opts.password));

			await clickSoftNav(apdPage, loginBtn, timeoutMs);
		}

		emitProgress(2, 20, 'Είσοδος ολοκληρώθηκε');

		// Consent (conditional)
		const consentBtn = apdPage.locator('#btn-submit');
		if (await safeCount(consentBtn)) {
			const continueRadio = apdPage.locator('input[type="radio"][name="scope.read"][value="true"]');
			if (await safeCount(continueRadio)) {
				await continueRadio.check().catch(() => {});
			}
			await clickSoftNav(apdPage, consentBtn, timeoutMs);
		}

		// Role + AME (conditional)
		mark('ΒΗΜΑ: role/AME (αν υπάρχει)');
		const roleSelect = apdPage.locator('select#role[name="role"]');
		if (await safeCount(roleSelect)) {
			await waitVisible(roleSelect, timeoutMs);

			await apdPage.selectOption('select#role', { value: 'legacy-external-employer' });

			const ameInput = apdPage.locator('input#ame[name="ame"]');
			await waitVisible(ameInput, timeoutMs);

			if (!opts?.ame) throw new Error('Missing AME (opts.ame)');
			await ameInput.fill(String(opts.ame));

			const submitRole = apdPage.locator('#submit-role-attribute');
			await clickSoftNav(apdPage, submitRole, timeoutMs);
		}

		emitProgress(3, 35, 'Φόρτωση περιόδων υποβολής');

		// Αν είμαστε ήδη σε apdCommon (υπάρχει input#ama) παραλείπουμε submissions flow
		const amaInput = apdPage.locator('input#ama');
		if (!(await safeCount(amaInput))) {
			mark('dialog2 (χωρίς navigation)');

			const hasSubmissionTable = (await safeCount(apdPage.locator('#submissionTable_data'))) > 0;
			if (hasSubmissionTable) {
				const fillCount = await apdPage.locator('#submissionTable_data a:has-text("Συμπλήρωση")').count().catch(() => 0);
				if (fillCount === 0) {
					await ensureSupplementalPeriodViaDialog2(apdPage, timeoutMs);
				}
			} else {
				await ensureSupplementalPeriodViaDialog2(apdPage, timeoutMs);
			}
		}

		// Περιμένουμε είτε να εμφανιστεί ο πίνακας υποβολών, είτε να έχουμε ήδη πάει στο apdCommon (input#ama)
		await Promise.race([
			apdPage.waitForSelector('#submissionTable_data', { timeout: timeoutMs, state: 'attached' }),
			apdPage.waitForSelector('input#ama', { timeout: timeoutMs, state: 'visible' }),
		]);

		// Αν είμαστε ήδη στο apdCommon, δεν χρειάζεται να πατήσουμε "Συμπλήρωση"
		const hasAmaAlready = (await apdPage.locator('input#ama').count().catch(() => 0)) > 0;
		if (!hasAmaAlready) {
			await apdPage.waitForSelector('#submissionTable_data', { timeout: timeoutMs, state: 'visible' }).catch(() => {});

			const tableRows = apdPage.locator('#submissionTable_data > tr');
			const n = await tableRows.count();
			if (!n) throw new Error('Δεν υπάρχουν γραμμές στο submissionTable_data.');

			const candidateIdxs = [];
			for (let i = 0; i < n; i++) {
				const statusText = normalizeText(await tableRows.nth(i).locator('td').nth(3).innerText().catch(() => ''));
				if (/ΣΕ\s+ΚΑΤΑΧΩΡΗΣΗ\s+ΣΤΟΙΧΕΙΩΝ/i.test(statusText)) candidateIdxs.push(i);
			}
			const scanIdxs = candidateIdxs.length ? candidateIdxs : [...Array(n).keys()];

			let bestIdx = scanIdxs[0] ?? 0;
			let bestFrom = null;
			let bestTo = null;

			emitProgress(4, 50, 'Άνοιγμα περιόδου υποβολής');

			for (const i of scanIdxs) {
				const row = tableRows.nth(i);
				const periodText = normalizeText(await row.locator('td').nth(2).innerText().catch(() => ''));
				const parts = periodText.split(/-|–|—/).map(x => x.trim());
				if (parts.length !== 2) continue;

				const from = parseMY(parts[0]);
				const to = parseMY(parts[1]);
				if (!from || !to) continue;

				if (bestFrom === null || cmpMY(to, bestTo) > 0 || (cmpMY(to, bestTo) === 0 && cmpMY(from, bestFrom) > 0)) {
					bestIdx = i;
					bestFrom = from;
					bestTo = to;
				}
			}

			const bestRow = tableRows.nth(bestIdx);
			const fillLink = bestRow.locator('td').nth(4).locator('a:has-text("Συμπλήρωση")').first();
			await waitVisible(fillLink, timeoutMs);
			await fillLink.click();

			await apdPage.waitForSelector('input#ama', { timeout: timeoutMs });
		}

		// apdCommon -> άνοιγμα amaLOV
		mark('apdCommon -> άνοιγμα amaLOV');

		const amaRowButton = apdPage
			.locator('input#ama')
			.locator('xpath=ancestor::td[1]//button[contains(@class,"ui-button") and .//span[contains(@class,"ui-icon-search")]]')
			.first();

		const amaBtnById = apdPage.locator('button#j_idt153'); // fallback
		const amaSearchBtn = (await safeCount(amaRowButton)) ? amaRowButton : amaBtnById;

		await waitVisible(amaSearchBtn, timeoutMs);
		await amaSearchBtn.click();
		await apdPage.waitForSelector('form#amaLOVForm', { timeout: timeoutMs });

		emitProgress(5, 65, 'Άνοιγμα αναζήτησης εργαζόμενου');

		// amaLOV -> αναζήτηση με ΑΜΚΑ
		mark('amaLOV: αναζήτηση με ΑΜΚΑ');

		const amka = ensureDigits(opts?.amka);
		if (!amka) throw new Error('Missing/invalid opts.amka');

		const amaTimeout = Math.max(25000, Math.min(timeoutMs, 60000));
		const amkaFilterSel = '#amaLOVForm\\:amkaFilter';
		const tbodySel = '#amaLOVForm\\:j_idt413_data';

		const amkaFilter = apdPage.locator(amkaFilterSel);
		await amkaFilter.waitFor({ state: 'visible', timeout: amaTimeout });

		const criteriaSel = apdPage.locator('select#amaLOVForm\\:criteriaSelector_input');
		if (await safeCount(criteriaSel)) {
			const curVal = await criteriaSel.inputValue().catch(() => null);
			if (curVal !== '1') {
				await apdPage.selectOption('select#amaLOVForm\\:criteriaSelector_input', { value: '1' }).catch(() => {});
				await amkaFilter.waitFor({ state: 'visible', timeout: amaTimeout });
			}
		}

		// ✅ πιο “σίγουρο” input + events
		await amkaFilter.click({ timeout: amaTimeout }).catch(() => {});
		await amkaFilter.fill(amka);
		await amkaFilter.dispatchEvent('input').catch(() => {});
		await amkaFilter.dispatchEvent('change').catch(() => {});
		await amkaFilter.press('Enter').catch(() => {});
		await amkaFilter.press('Tab').catch(() => {});

		await apdPage.waitForSelector(tbodySel, { timeout: amaTimeout });

		emitProgress(6, 75, 'Αναζήτηση εργαζόμενου στον ΕΦΚΑ');

		// Click search
		const searchBtn = apdPage.locator('#amaLOVForm\\:j_idt410');
		await searchBtn.waitFor({ state: 'visible', timeout: amaTimeout });
		await searchBtn.scrollIntoViewIfNeeded();

		await searchBtn.click({ force: true });

		// ✅ περίμενε να τελειώσει το PrimeFaces ajax
		await waitPrimefacesIdle(apdPage, amaTimeout);

		// ✅ περίμενε είτε αποτέλεσμα είτε empty message
		const rowsLocator = apdPage.locator(`${tbodySel} > tr`);
		await rowsLocator.first().waitFor({ state: 'attached', timeout: amaTimeout });

		const emptyRow = apdPage.locator(`${tbodySel} > tr.ui-datatable-empty-message`).first();
		const hasEmpty = await emptyRow.count().then(c => c > 0).catch(() => false);

		emitProgress(7, 88, 'Ανάκτηση στοιχείων');

		if (hasEmpty) {
			const emptyText = normalizeText(await emptyRow.innerText().catch(() => 'Δεν βρέθηκαν αποτελέσματα.'));
			throw new Error(`0 αποτελέσματα στο amaLOV για ΑΜΚΑ ${amka}. ${emptyText}`);
		}

		// κανονικές γραμμές (όχι empty message)
		const resultRows = apdPage.locator(`${tbodySel} > tr:not(.ui-datatable-empty-message)`);
		const resCount = await resultRows.count().catch(() => 0);

		if (resCount < 1) {
			// fallback: μήπως υπάρχει empty row χωρίς class;
			const raw = normalizeText(await rowsLocator.first().innerText().catch(() => ''));
			throw new Error(`0 αποτελέσματα στο amaLOV για ΑΜΚΑ ${amka}. ${raw || 'Δεν βρέθηκε εγγραφή.'}`);
		}
		if (resCount > 1) err('Προσοχή: Βρέθηκαν >1 εγγραφές στο amaLOV grid. Θα ληφθεί η 1η.');

		const row = resultRows.first();
		await row.waitFor({ state: 'visible', timeout: amaTimeout });

		const tds = row.locator('td');

		const amaText       = normalizeText(await tds.nth(0).innerText().catch(() => ''));
		const amkaText      = normalizeText(await tds.nth(1).innerText().catch(() => ''));
		const afmText       = normalizeText(await tds.nth(2).innerText().catch(() => ''));
		const eponymoText   = normalizeText(await tds.nth(3).innerText().catch(() => ''));
		const onomaText     = normalizeText(await tds.nth(4).innerText().catch(() => ''));
		const patronymoText = normalizeText(await tds.nth(5).innerText().catch(() => ''));
		const mhtronymoText = normalizeText(await tds.nth(6).innerText().catch(() => ''));
		const paliosNeosTxt = normalizeText(await tds.nth(8).innerText().catch(() => ''));

		const palios = /ΠΑΛΙΟΣ/i.test(paliosNeosTxt);
		const palios_neos = !palios;

		await row.click().catch(() => {});

		const selectBtn = apdPage.locator('#amaLOVForm button:has-text("Επιλογή")').first();
		await selectBtn.waitFor({ state: 'visible', timeout: timeoutMs });
		await selectBtn.click();

		await apdPage.locator('.ui-dialog:has(#amaLOVForm)').waitFor({ state: 'hidden', timeout: timeoutMs });

		// Επιστροφή
		await apdPage.waitForSelector('#topBar', { timeout: timeoutMs });

		const found = await apdPage.evaluate(() => {
			const topBar = document.querySelector('#topBar');
			if (!topBar) return false;

			const btn =
				topBar.querySelector('button[title="Επιστροφή"]') ||
				Array.from(topBar.querySelectorAll('button')).find(b => (b.textContent || '').includes('Επιστροφή'));

			if (!btn) return false;
			btn.click();
			return true;
		});

		if (!found) throw new Error('Δεν βρέθηκε κουμπί "Επιστροφή" μέσα στο #topBar');

		emitProgress(8, 95, 'Επεξεργασία δεδομένων');

		// ConfirmDialog -> click "Ναι"
		await clickPrimefacesConfirmYes(apdPage, timeoutMs, 'backConfirmation');

		// πίσω στο submissions.xhtml
		await apdPage.waitForSelector('#submissionTable_data', { timeout: timeoutMs });

		// select 1η γραμμή
		const firstRow = apdPage.locator('#submissionTable_data > tr').first();
		await firstRow.waitFor({ state: 'visible', timeout: timeoutMs });

		const statusCell = firstRow.locator('td:nth-child(4)');
		await statusCell.scrollIntoViewIfNeeded();
		await statusCell.click({ force: true });

		await firstRow.click({ force: true }).catch(() => {});

		// Ακύρωση Περιόδου Υποβολής
		const cancelLink = apdPage.locator('#cancelPeriodLink, a:has-text("Ακύρωση Περιόδου Υποβολής")').first();
		await cancelLink.waitFor({ state: 'visible', timeout: timeoutMs });
		await cancelLink.click({ force: true });

		// Modal -> "Ναι"
		const cancelConfirm = apdPage
			.locator('.ui-confirm-dialog.ui-dialog')
			.filter({ hasText: 'Είστε βέβαιοι ότι θέλετε να ακυρώσετε την επιλεγμένη υποβολή' })
			.first();

		await cancelConfirm.waitFor({ state: 'visible', timeout: timeoutMs });

		const cancelYesBtn = cancelConfirm.locator('button:has-text("Ναι")').first();
		await cancelYesBtn.waitFor({ state: 'visible', timeout: timeoutMs });
		await cancelYesBtn.click({ force: true });

		emitProgress(9, 100, 'Ολοκληρώθηκε');

		await cancelConfirm.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {});

		const url = apdPage.url();
		const title = await apdPage.title().catch(() => null);

		log('continueApd ok:', { sessionId, url, title });

		return {
			success: true,
			url,
			title,
			person: {
				ama1: amaText,
				amka: amkaText,
				afm: afmText,
				eponymo: eponymoText,
				onoma: onomaText,
				patronymo: patronymoText,
				mhtronymo: mhtronymoText,
				palios_neos,
				paliosNeosLabel: paliosNeosTxt,
			},
		};
	} catch (e) {
		if (typeof opts.onProgress === 'function') {
			try {
				opts.onProgress({ step: 0, totalSteps: TOTAL_STEPS, percent: 0, message: `Σφάλμα: ${e?.message || e}` });
			} catch {}
		}

		err('continueApd failed:', e?.message || e);
		return { success: false, error: e?.message || String(e) };
	} finally {
		if (closeAfter) {
			await closeSession(sessionId).catch(() => {});
		}
	}
}

module.exports = { continueApd };