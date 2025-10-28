// public/js/sybaseis/kathgories/symbaseis-kathgories.js
(() => {
	const ENDPOINT   = '/api/symbaseis/kathgories';
	const SELECT_ID  = 'symbash';
	const HIDDEN_ID  = 'symbash_stathera';
	const TBODY_SEL  = '#myTable tbody';
	const PAG_UL_ID  = 'kathgories-pagination';       // <ul id="kathgories-pagination">
	const CLEAR_SEL  = '[data-clear-target="#symbash"],[data-clear-symbash]';
	const LIMIT = (() => {
  		const n = parseInt(window.__CONFIG__?.EGRAFES ?? '15', 10);
  		return Number.isFinite(n) && n > 0 ? n : 15;
	})();

	const tbody    = () => document.querySelector(TBODY_SEL);
	const pagUl    = () => document.getElementById(PAG_UL_ID);
	const selectEl = () => document.getElementById(SELECT_ID);
	const hiddenEl = () => document.getElementById(HIDDEN_ID);
	const csrf     = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

	// ---------- helpers ----------
	const to4 = (v) => {
		const d = String(v ?? '').replace(/\D/g,'');
		if (!d) return '';
		const n = parseInt(d,10);
		return Number.isFinite(n) ? String(n).padStart(4,'0') : d.slice(-4).padStart(4,'0');
	};

	const clearTable = () => { const tb = tbody(); if (tb) tb.innerHTML = ''; };

	const rowMsg = (text, cls='text-center text-muted') => {
		const tb = tbody(); if (!tb) return;
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		td.colSpan = 2; td.className = cls; td.textContent = text;
		tr.appendChild(td); tb.appendChild(tr);
	};

	function renderRows(items){
		clearTable();
		if (!items?.length) return rowMsg('Δεν βρέθηκαν κατηγορίες.');
		const tb = tbody(); if (!tb) return;
		for (const r of items){
			const tr = document.createElement('tr');
			tr.dataset.id = r.id ?? r._id ?? '';

			const td1 = document.createElement('td'); td1.className = 'col-1 code-cell';
			const sp = document.createElement('span'); sp.className = 'margin-left-1rem'; sp.textContent = to4(r.kodikos);
			td1.appendChild(sp); tr.appendChild(td1);

			const td2 = document.createElement('td'); td2.className = 'col-11'; td2.textContent = r.perigrafh ?? '';
			tr.appendChild(td2);

			tb.appendChild(tr);
		}
	}

	// ---------- Pagination UI ----------
	const state = { pg: 1, pages: 1, total: 0 };

	function renderPagination(current, pages){
		const ul = pagUl(); if (!ul) return;
		state.pg = current; state.pages = Math.max(1, pages || 1);

		// κρύψε pagination αν είναι 1 σελίδα
		if (state.pages <= 1) { ul.innerHTML = ''; return; }

		const li = [];
		const disabledLeft = current === 1;
		const disabledRight = current === state.pages;

		// First / Prev
		li.push(`
			<li class="page-item ${disabledLeft ? 'disabled' : ''}">
				<a href="#" data-page="1" class="page-link"><i class="bi bi-chevron-bar-left font-size-vw-0_5"></i></a>
			</li>
			<li class="page-item ${disabledLeft ? 'disabled' : ''}">
				<a href="#" data-page="${Math.max(1, current-1)}" class="page-link"><i class="bi bi-chevron-left font-size-vw-0_5"></i></a>
			</li>
		`);

		// Εύρος γύρω από την τρέχουσα (όπως στο EJS snippet)
		let i = current > 2 ? current - 1 : 1;
		if (i !== 1) {
			li.push(`<li class="page-item disabled"><a href="#" class="page-link font-size-vw-0_5">...</a></li>`);
		}

		for (; i <= (current + 1) && i <= state.pages; i++) {
			if (i === current) {
				li.push(`
					<li class="page-item is-current" aria-current="page">
						<span class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${i}</span>
					</li>
				`);
			} else {
				li.push(`
					<li class="page-item fsvw-0_7">
						<a href="#" data-page="${i}" class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${i}</a>
					</li>
				`);
			}

			if (i === current + 1 && i < state.pages) {
				li.push(`
					<li class="page-item disabled">
						<a href="#" class="page-link font-size-vw-0_5">...</a>
					</li>
					<li class="page-item">
						<a href="#" data-page="${state.pages}" class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${state.pages}</a>
					</li>
				`);
			}
		}

		// Next / Last
		li.push(`
			<li class="page-item ${disabledRight ? 'disabled' : ''}">
				<a href="#" data-page="${Math.min(state.pages, current+1)}" class="page-link"><i class="bi bi-chevron-right font-size-vw-0_5"></i></a>
			</li>
			<li class="page-item ${disabledRight ? 'disabled' : ''}">
				<a href="#" data-page="${state.pages}" class="page-link"><i class="bi bi-chevron-bar-right font-size-vw-0_5"></i></a>
			</li>
		`);

		ul.innerHTML = li.join('');
	}

	// Παγίδευση κλικ στο pagination (χωρίς reload)
	document.addEventListener('click', (e) => {
		const a = e.target.closest(`#${PAG_UL_ID} a.page-link`);
		if (!a) return;
		const page = Number(a.dataset.page);
		if (!page || page === state.pg || a.parentElement.classList.contains('disabled')) return;
		e.preventDefault();
		const v = (hiddenEl()?.value || '').trim();
		if (!v) return;
		loadFor(v, page);
	});

	// ---------- Data fetch ----------
	async function loadFor(symbash, page = 1){
		if (!symbash){ clearTable(); renderPagination(1,1); return; }
		clearTable(); rowMsg('Φόρτωση...', 'text-center');

		try{
			const url = `${ENDPOINT}?symbash_stathera=${encodeURIComponent(symbash)}&page=${page}&limit=${LIMIT}`;
			const res = await fetch(url, {
				headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
				credentials: 'same-origin'
			});
			if (!res.ok) throw new Error('HTTP '+res.status);
			const json = await res.json();
			renderRows(json.items || []);
			renderPagination(Number(json.page || page), Number(json.pages || 1));
		} catch (e){
			clearTable(); rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
			renderPagination(1,1);
			console.error(e);
		}
	}

	// ---------- Tom Select / Select UI ----------
	function getSymUI(){
		const el = selectEl();
		const $  = window.jQuery;
		const isBS = !!($ && el && $(el).data && $(el).data('selectpicker'));
		const ts = el && el.tomselect ? el.tomselect : null;
		return { el, ts, $, isBS };
	}

	function reflectHiddenToSelect(silent = true){
		const v = (hiddenEl()?.value || '').trim();
		const { el, ts, $, isBS } = getSymUI();
		if (!el) return;

		if (ts) {
			if (v) {
				const nativeOpt = el.querySelector(`option[value="${CSS.escape(v)}"]`);
				if (nativeOpt && !ts.options[v]) {
					ts.addOption({ value: v, text: nativeOpt.textContent || v });
				}
				if (ts.getValue() !== v) ts.setValue(v, silent);
			} else {
				ts.clear(silent);
			}
			ts.refreshItems();
		} else if (isBS) {
			$(el).val(v || '').selectpicker('refresh');
		} else {
			el.value = v || '';
		}
	}

	function lockSymbash(){
		const { el, ts, $, isBS } = getSymUI();
		if (!el || el.dataset.locked === '1') return;
		if (ts && typeof ts.disable === 'function') ts.disable();
		else if (isBS) $(el).prop('disabled', true).selectpicker('refresh');
		else el.disabled = true;
		el.setAttribute('aria-disabled','true');
		el.dataset.locked = '1';
	}

	function unlockSymbash(){
		const { el, ts, $, isBS } = getSymUI();
		if (!el) return;
		if (ts && typeof ts.enable === 'function') ts.enable();
		else if (isBS) $(el).prop('disabled', false).selectpicker('refresh');
		else el.disabled = false;
		el.removeAttribute('aria-disabled');
		delete el.dataset.locked;
	}

	// ---------- Κεντρικός χειριστής επιλογής σύμβασης ----------
	let currentSym = null, busy = false;

	async function onChange(val){
		const v = (val || '').trim();
		if (v === currentSym || busy) return;
		currentSym = v;

		const h = hiddenEl(); if (h && h.value !== v) h.value = v;
		reflectHiddenToSelect(true);

		busy = true;
		try {
			if (!v) {
				clearTable(); renderPagination(1,1);
				unlockSymbash();
			} else {
				await loadFor(v, 1); // reset στη σελίδα 1 όταν αλλάζει σύμβαση
				lockSymbash();
			}
		} finally { busy = false; }
	}

	// 1) change στο SELECT
	document.addEventListener('change', (e) => {
		const t = e.target; if (!t) return;
		const isSel = (t.id === SELECT_ID) || (t.closest && t.closest('#'+SELECT_ID));
		if (!isSel) return;
		queueMicrotask(() => onChange(selectEl()?.value || hiddenEl()?.value || ''));
	}, true);

	// 2) Άκου και το HIDDEN
	['input','change'].forEach(ev => {
		document.addEventListener(ev, (e) => {
			if (e.target?.id === HIDDEN_ID) {
				reflectHiddenToSelect(true);
				onChange(e.target.value || '');
			}
		}, true);
	});

	// 3) Γρήγορη επιλογή από dropdown
	document.addEventListener('mousedown', (e) => {
		const opt = e.target.closest('.dropdown-item,[role="option"],.ts-dropdown .option,[data-value]');
		if (!opt) return;
		const raw = opt.getAttribute('data-value') || opt.textContent || '';
		const code = (raw.match(/^\s*(\d{4})/) || [])[1] || '';
		if (!code) return;
		onChange(code);
	}, true);

	// 4) Clear
	document.addEventListener('click', (e) => {
		const btn = e.target?.closest(CLEAR_SEL);
		if (!btn) return;

		unlockSymbash();

		const s = selectEl();
		const h = hiddenEl();

		if (s) {
			if (s.tomselect) { try { s.tomselect.clear(true); } catch {} }
			else { s.value=''; }
			s.dispatchEvent(new Event('change', { bubbles:true }));
		}
		if (h) {
			h.value='';
			h.dispatchEvent(new Event('input', { bubbles:true }));
		}

		currentSym = '';
		clearTable();
		renderPagination(1,1);
	});

	// 5) Init
	function init(){
		const initial = hiddenEl()?.value || selectEl()?.value || '';
		if (hiddenEl() && !hiddenEl().value && initial) hiddenEl().value = initial;
		reflectHiddenToSelect(true);
		onChange(initial);
		if (initial) lockSymbash(); else unlockSymbash();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
