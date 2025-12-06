// /static/js/symbaseis/stoixeiaSymbaseon/stoixeia_list.js

(() => {
	if (window.__stoixeiaListInit) return;
	window.__stoixeiaListInit = true;

	const ENDPOINT = '/api/symbaseis/stoixeiaSymbaseon';

	// ids dropdown / hidden
	const SYM_SELECT  = 'symbash';
	const SYM_HIDDEN  = 'symbash_stathera';

	const KAT_SELECT  = 'kathgoria_symbashs';
	const KAT_HIDDEN  = 'kathgoria_symbashs_stathera';

	const EID_SELECT  = 'eidikothta_symbashs';
	const EID_HIDDEN  = 'eidikothta_symbashs_stathera';

	// 12-ψήφιο (συμβασης+κατηγορίας+ειδικότητας)
	const COMBO12_ID  = 'kodikosSymbashs_Kathgorias_Eidikothtas';

	// πίνακας + pagination
	const TBODY_SEL   = '#myTable tbody';
	const PAG_UL_ID   = 'stoixeiaSymbaseon-pagination';

	// sessionStorage keys (single string, όχι arrays)
	const SS_SYM = 'wps:stoixeia:symbasi';
	const SS_KAT = 'wps:stoixeia:kathgoria';
	const SS_EID = 'wps:stoixeia:eidikothta';

	// πόσες εγγραφές ανά σελίδα
	const LIMIT = (() => {
		const n = parseInt(window.__CONFIG__?.EGGRAFES ?? '15', 10);
		return Number.isFinite(n) && n > 0 ? n : 15;
	})();

	// 🔴 GLOBAL state για το disabled status (προσβάσιμο από dropdown-item.js)
	const disabledState = {
		[KAT_SELECT]: true,
		[EID_SELECT]: true
	};

	// ✅ Εξαγορά το global state για το dropdown-item.js
	window.__trashButtonsDisabledState = disabledState;

	// ---- helpers γενικά -------------------------------------------------

	const $id   = (id) => document.getElementById(id);
	const tbody = () => document.querySelector(TBODY_SEL);
	const pagUl = () => document.getElementById(PAG_UL_ID);

	const csrfToken = () =>
		document.querySelector('meta[name="csrf-token"]')?.content || '';

	const to4 = (v) => {
		const s = String(v ?? '').trim();
		if (!s) return '';
		const d = s.replace(/\D/g, '');
		if (!d) return '';
		const n = parseInt(d, 10);
		return Number.isFinite(n) ? String(n).padStart(4, '0').slice(-4) : d.slice(-4).padStart(4, '0');
	};

	// TomSelect single value από <select id=...>
	const getTSVal = (id) => {
		const el = $id(id);
		if (!el) return '';
		if (el.tomselect && typeof el.tomselect.getValue === 'function') {
			const v = el.tomselect.getValue();
			if (Array.isArray(v)) return v[0] || '';
			return v || '';
		}
		return el.value || '';
	};

	// Θέσε single value σε TomSelect / native <select>
	const setTSVal = (id, value) => {
		const el = $id(id);
		if (!el) return;
		const v = to4(value || '');

		if (el.tomselect && typeof el.tomselect.setValue === 'function') {
			if (!v) {
				if (typeof el.tomselect.clear === 'function') {
					el.tomselect.clear(true);
				} else {
					el.tomselect.setValue('', true);
				}
			} else {
				el.tomselect.setValue(v, true);
			}
		} else {
			el.value = v;
		}
	};

	// ✅ ΑΠΛΗ ΛΥΣΗ: Hide/Show trash buttons
	const updateTrashButtonVisibility = (selectId, visible) => {
		// ✅ Ενημέρωσε το global state ΠΡΩΤΑ
		disabledState[selectId] = !visible;
		window.__trashButtonsDisabledState = disabledState;

		const el = $id(selectId);
		if (!el) return;

		const wrapper = el.closest('.ts-wrapper');
		if (!wrapper) return;

		// Ψάξε και τα δύο ενδεχόμενα trash buttons
		const trashBtns = [
		wrapper.querySelector('.ts-single-reset-btn'),  // 🗑️
		wrapper.querySelector('.ts-fill-reset-btn')     // ➕/➖
		].filter(Boolean);

		// ✅ Κρύψτα ή δείξτα τα ΑΜΕΣΩΣ
		trashBtns.forEach(btn => {
		btn.hidden = !visible;
		});
	};
	
	// ✅ ΔΙΟΡΘΩΜΕΝΟΣ HELPER: Hide/Show dropdown
	const setDisabled = (id, disabled) => {
		const el = $id(id);
		if (!el) return;

		if (el.tomselect && typeof el.tomselect !== 'undefined') {
			if (disabled) {
				if (typeof el.tomselect.disable === 'function') {
					el.tomselect.disable();
				}
					el.classList.add('ts-disabled');
			} else {
				if (typeof el.tomselect.enable === 'function') {
					el.tomselect.enable();
				}
					el.classList.remove('ts-disabled');
			}
		} else {
			el.disabled = disabled;
		}

		// ✅ ΝΕΟ: Κρύψτα/δείξτα τα trash buttons
		updateTrashButtonVisibility(id, !disabled);
	};

	// session helpers (απλό string)
	const saveSym = (v) => { try { v ? sessionStorage.setItem(SS_SYM, v) : sessionStorage.removeItem(SS_SYM); } catch {} };
	const saveKat = (v) => { try { v ? sessionStorage.setItem(SS_KAT, v) : sessionStorage.removeItem(SS_KAT); } catch {} };
	const saveEid = (v) => { try { v ? sessionStorage.setItem(SS_EID, v) : sessionStorage.removeItem(SS_EID); } catch {} };

	const getSym  = () => { try { return sessionStorage.getItem(SS_SYM) || ''; } catch { return ''; } };
	const getKat  = () => { try { return sessionStorage.getItem(SS_KAT) || ''; } catch { return ''; } };
	const getEid  = () => { try { return sessionStorage.getItem(SS_EID) || ''; } catch { return ''; } };

	const clearSS = () => { try {
		sessionStorage.removeItem(SS_SYM);
		sessionStorage.removeItem(SS_KAT);
		sessionStorage.removeItem(SS_EID);
	} catch {} };

	// ---- table helpers --------------------------------------------------

	const clearTable = () => { const tb = tbody(); if (tb) tb.innerHTML = ''; };

	const rowMsg = (text, cls = 'text-center text-muted') => {
		const tb = tbody(); if (!tb) return;
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		td.colSpan = 2;
		td.className = cls;
		td.textContent = text;
		tr.appendChild(td);
		tb.appendChild(tr);
	};

	function renderRows(items) {
		clearTable();
		if (!items || !items.length) {
			rowMsg('Δεν βρέθηκαν στοιχεία σύμβασης.');
			return;
		}
		const tb = tbody(); if (!tb) return;

		items.forEach((r) => {
			const tr = document.createElement('tr');
			tr.dataset.id = r.id ?? r._id ?? '';

			const td1 = document.createElement('td');
			td1.className = 'col-1 code-cell';
			const sp = document.createElement('span');
			sp.className = 'margin-left-1rem';
			sp.textContent = to4(r.kodikos);
			td1.appendChild(sp);
			tr.appendChild(td1);

			const td2 = document.createElement('td');
			td2.className = 'col-11';
			td2.textContent = r.perigrafh ?? '';
			tr.appendChild(td2);

			tb.appendChild(tr);
		});
	}

	// ---- pagination -----------------------------------------------------

	const state = { page: 1, pages: 1 };

	function renderPagination(current, pages) {
		const ul = pagUl(); if (!ul) return;

		state.page  = current || 1;
		state.pages = Math.max(1, pages || 1);

		ul.innerHTML = '';
		if (state.pages <= 1) return;

		const makeLi = (p, label, disabled, active) => {
		const li = document.createElement('li');
		li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
		const a = document.createElement('a');
		a.className = 'page-link font-size-vw-0_5';
		a.href = '#';
		a.dataset.page = String(p);
		a.textContent = label;
		li.appendChild(a);
		return li;
		};

		const disabledLeft  = state.page === 1;
		const disabledRight = state.page === state.pages;

		ul.appendChild(makeLi(1, '««', disabledLeft, false));
		ul.appendChild(makeLi(Math.max(1, state.page - 1), '«', disabledLeft, false));

		let start = Math.max(1, state.page - 1);
		let end   = Math.min(state.pages, state.page + 1);

		if (start > 1) {
			ul.appendChild(makeLi(1, '1', false, state.page === 1));
			if (start > 2) {
				const liDots = document.createElement('li');
				liDots.className = 'page-item disabled';
				const aDots = document.createElement('a');
				aDots.className = 'page-link font-size-vw-0_5';
				aDots.textContent = '...';
				liDots.appendChild(aDots);
				ul.appendChild(liDots);
			}
		}

		for (let p = start; p <= end; p++) {
			ul.appendChild(makeLi(p, String(p), false, p === state.page));
		}

		if (end < state.pages) {
			if (end < state.pages - 1) {
				const liDots = document.createElement('li');
				liDots.className = 'page-item disabled';
				const aDots = document.createElement('a');
				aDots.className = 'page-link font-size-vw-0_5';
				aDots.textContent = '...';
				liDots.appendChild(aDots);
				ul.appendChild(liDots);
			}
			ul.appendChild(makeLi(state.pages, String(state.pages), false, state.page === state.pages));
		}

		ul.appendChild(makeLi(Math.min(state.pages, state.page + 1), '»', disabledRight, false));
		ul.appendChild(makeLi(state.pages, '»»', disabledRight, false));
	}

	document.addEventListener('click', (e) => {
		const a = e.target.closest?.(`#${PAG_UL_ID} a[data-page]`);
		if (!a) return;
		e.preventDefault();

		const p = parseInt(a.dataset.page || '1', 10);
		if (!p || p === state.page) return;

		const combo = ($id(COMBO12_ID)?.value || '').trim();
		if (!combo) return;

		loadFor(combo, p);
	}, true);

	document.addEventListener('click', (e) => {
		const back = e.target.closest('#back-btn,[data-clear-symbash]');
		if (!back) return;
		clearSS();
	}, true);

	// ---- fetch ----------------------------------------------------------

	async function fetchPageForCombo(combo12, page = 1) {
		const params = new URLSearchParams();
		params.set('afora_thn_symbash_kathgoria_eidikothta', combo12);
		params.set('page', String(page));
		params.set('limit', String(LIMIT));

		const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
			headers: {
				'Accept': 'application/json',
				'X-Requested-With': 'XMLHttpRequest',
				...(csrfToken() ? { 'X-CSRF-Token': csrfToken() } : {})
			},
			credentials: 'same-origin'
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	async function loadFor(combo12, page = 1) {
		if (!combo12) return;
		try {
			clearTable();
			rowMsg('Φόρτωση στοιχείων σύμβασης...');

			const data = await fetchPageForCombo(combo12, page);
			const items = data?.items || [];
			const curPage = Number(data?.page || 1);
			const totalPages = Number(data?.pages || 1) || 1;

			if (!items.length) {
				clearTable();
				rowMsg('Δεν βρέθηκαν στοιχεία σύμβασης.');
				renderPagination(1, 1);
				return;
			}

			renderRows(items);
			renderPagination(curPage, totalPages);
		} catch (err) {
			console.error('stoixeia_list loadFor error', err);
			clearTable();
			rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
			renderPagination(1, 1);
		}
	}

	// ---- κοινό διάβασμα / φόρτωμα --------------------------------------

	function currentCodes() {
		const sym = to4(getTSVal(SYM_SELECT) || getSym() || ($id(SYM_HIDDEN)?.value || ''));
		const kat = to4(getTSVal(KAT_SELECT) || getKat() || ($id(KAT_HIDDEN)?.value || ''));
		const eid = to4(getTSVal(EID_SELECT) || getEid() || ($id(EID_HIDDEN)?.value || ''));

		return { sym, kat, eid };
	}

	function tryLoad() {
		const { sym, kat, eid } = currentCodes();

		if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = sym;
		if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = kat;
		if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = eid;

		saveSym(sym);
		saveKat(kat);
		saveEid(eid);

		if (!sym || !kat || !eid) {
			const comboEl = $id(COMBO12_ID);
			if (comboEl) comboEl.value = '';
			clearTable();
			renderPagination(1, 1);
			return;
		}

		const combo = `${sym}${kat}${eid}`;
		const comboEl = $id(COMBO12_ID);
		if (comboEl) comboEl.value = combo;

		loadFor(combo, 1);
	}

	// ---- change handlers για τα 3 TS -----------------------------------

	document.addEventListener('change', (e) => {
		const t = e.target;
		if (!t) return;

		// 1) Σύμβαση
		if (t.id === SYM_SELECT || t.closest?.(`#${SYM_SELECT}`)) {
			const v = to4(getTSVal(SYM_SELECT));

			if (!v) {
				saveSym('');
				saveKat('');
				saveEid('');

				if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = '';
				if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = '';
				if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = '';

				setTSVal(KAT_SELECT, '');
				setTSVal(EID_SELECT, '');

				setDisabled(KAT_SELECT, true);
				setDisabled(EID_SELECT, true);

				const comboEl = $id(COMBO12_ID);
				if (comboEl) comboEl.value = '';

				clearTable();
				renderPagination(1, 1);
				return;
			}

			saveSym(v);
			if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = v;

			saveKat('');
			saveEid('');
			if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = '';
			if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = '';

			setTSVal(KAT_SELECT, '');
			setTSVal(EID_SELECT, '');

			setDisabled(KAT_SELECT, false);
			setDisabled(EID_SELECT, true);

			const comboEl = $id(COMBO12_ID);
			if (comboEl) comboEl.value = '';

			clearTable();
			renderPagination(1, 1);
			return;
		}

		// 2) Κατηγορία
		if (t.id === KAT_SELECT || t.closest?.(`#${KAT_SELECT}`)) {
			const v = to4(getTSVal(KAT_SELECT));

			if (!v) {
				saveKat('');
				saveEid('');

				if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = '';
				if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = '';

				setTSVal(EID_SELECT, '');

				setDisabled(EID_SELECT, true);

				const comboEl = $id(COMBO12_ID);
				if (comboEl) comboEl.value = '';

				clearTable();
				renderPagination(1, 1);
				return;
			}

			saveKat(v);
			if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = v;

			saveEid('');
			if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = '';
			setTSVal(EID_SELECT, '');

			setDisabled(EID_SELECT, false);

			tryLoad();
			return;
		}

		// 3) Ειδικότητα
		if (t.id === EID_SELECT || t.closest?.(`#${EID_SELECT}`)) {
			const v = to4(getTSVal(EID_SELECT));

			if (!v) {
				saveEid('');
				if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = '';

				const comboEl = $id(COMBO12_ID);
				if (comboEl) comboEl.value = '';

				clearTable();
				renderPagination(1, 1);
				return;
			}

			saveEid(v);
			if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = v;

			tryLoad();
			return;
		}
	}, true);

	// ---- Περιμένουμε το TomSelect να ολοκληρωθεί ---- 

	function waitForTomSelect() {
		return new Promise((resolve) => {
			const checkTS = () => {
				const symEl = $id(SYM_SELECT);
				const katEl = $id(KAT_SELECT);
				const eidEl = $id(EID_SELECT);

				if (symEl?.tomselect && katEl?.tomselect && eidEl?.tomselect) {
					resolve();
				} else {
					setTimeout(checkTS, 100);
				}
			};
			checkTS();
		});
	}

	// ---- init (URL -> session -> hidden) --------------------------------

	async function init() {
		await waitForTomSelect();

		let symUrl = '', katUrl = '', eidUrl = '';
		try {
			const u = new URL(window.location.href);
			symUrl = to4(u.searchParams.get('symbash')     || '');
			katUrl = to4(u.searchParams.get('kathgoria')   || '');
			eidUrl = to4(u.searchParams.get('eidikothta') || '');
		} catch {}

		const symSS = to4(getSym());
		const katSS = to4(getKat());
		const eidSS = to4(getEid());

		const symH = to4($id(SYM_HIDDEN)?.value || '');
		const katH = to4($id(KAT_HIDDEN)?.value || '');
		const eidH = to4($id(EID_HIDDEN)?.value || '');

		const sym = symUrl || symSS || symH || '';
		const kat = katUrl || katSS || katH || '';
		const eid = eidUrl || eidSS || eidH || '';

		if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = sym;
		if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = kat;
		if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = eid;

		saveSym(sym);
		saveKat(kat);
		saveEid(eid);

		setDisabled(KAT_SELECT, !sym);
		setDisabled(EID_SELECT, true);

		if (sym && kat && eid) {
			const combo = `${sym}${kat}${eid}`;
			const comboEl = $id(COMBO12_ID);
			if (comboEl) comboEl.value = combo;
			loadFor(combo, 1);
		} else {
			const comboEl = $id(COMBO12_ID);
			if (comboEl) comboEl.value = '';
			clearTable();
			renderPagination(1, 1);
		}
	}

	async function refreshTSLabels() {
		await waitForTomSelect();

		const sym = to4(getSym() || ($id(SYM_HIDDEN)?.value || ''));
		const kat = to4(getKat() || ($id(KAT_HIDDEN)?.value || ''));
		const eid = to4(getEid() || ($id(EID_HIDDEN)?.value || ''));

		setTSVal(SYM_SELECT, sym);
		setTSVal(KAT_SELECT, kat);
		setTSVal(EID_SELECT, eid);

		setDisabled(KAT_SELECT, !sym);
		setDisabled(EID_SELECT, true);
	}

	const runInit = async () => { 
		await init(); 
		await refreshTSLabels(); 
	};

	if (document.readyState === 'complete') {
		runInit();
	} else {
		window.addEventListener('load', runInit, { once: true });
	}

	window.addEventListener('pageshow', async (e) => {
		if (e.persisted) await refreshTSLabels();
	});
})();
