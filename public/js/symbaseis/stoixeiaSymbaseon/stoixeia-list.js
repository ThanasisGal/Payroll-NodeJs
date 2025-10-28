// /static/js/symbaseis/stoixeiaSymbaseon/stoixeia-list.js
// Φόρτωμα/σελιδοποίηση πίνακα Στοιχείων με βάση το συνθετικό 12-ψηφιο (sym+kat+eidik)

(() => {
  if (window.__stoixeiaInit) return;
  window.__stoixeiaInit = true;

  const ENDPOINT = '/api/symbaseis/stoixeiaSymbaseon';

  const SYM_SELECT  = 'symbash';
  const SYM_HIDDEN  = 'symbash_stathera';

  const KAT_SELECT  = 'kathgoria_symbashs';
  const KAT_HIDDEN  = 'kathgoria_symbashs_stathera';

  const EID_SELECT  = 'eidikothta_symbashs';
  const EID_HIDDEN  = 'eidikothta_symbashs_stathera';

  const TBODY_SEL   = '#myTable tbody';
  const PAG_UL_ID   = 'stoixeiaSymbaseon-pagination';

  const LIMIT = (() => {
    const n = parseInt(window.__CONFIG__?.EGRAFES ?? '15', 10);
    return Number.isFinite(n) && n > 0 ? n : 15;
  })();

  const $id     = (id) => document.getElementById(id);
  const tbody   = () => document.querySelector(TBODY_SEL);
  const pagUl   = () => document.getElementById(PAG_UL_ID);
  const csrf    = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const combo12 = () => document.getElementById('kodikosSymbashs_Kathgorias_Eidikothtas');

  const to4 = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };

  const getTSVal = (id) => {
    const el = $id(id);
    if (!el) return '';
    const v = el.tomselect?.getValue?.();
    return (typeof v === 'string' ? v : (Array.isArray(v) ? v[0] : v)) ?? el.value ?? '';
  };

  const clearTable = () => { const tb = tbody(); if (tb) tb.innerHTML = ''; };

  const rowMsg = (text, cls = 'text-center text-muted') => {
    const tb = tbody(); if (!tb) return;
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2; td.className = cls; td.textContent = text;
    tr.appendChild(td); tb.appendChild(tr);
  };

  function renderRows(items) {
    clearTable();
    if (!items?.length) return rowMsg('Δεν βρέθηκαν στοιχεία σύμβασης.');
    const tb = tbody(); if (!tb) return;

    for (const r of items) {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id ?? r._id ?? '';

      const td1 = document.createElement('td'); td1.className = 'col-1 code-cell';
      const sp  = document.createElement('span'); sp.className = 'margin-left-1rem'; sp.textContent = to4(r.kodikos);
      td1.appendChild(sp); tr.appendChild(td1);

      const td2 = document.createElement('td'); td2.className = 'col-11'; td2.textContent = r.perigrafh ?? '';
      tr.appendChild(td2);

      tb.appendChild(tr);
    }
  }

  const state = { pg: 1, pages: 1, total: 0 };

  function renderPagination(current, pages) {
    const ul = pagUl(); if (!ul) return;
    state.pg = current; state.pages = Math.max(1, pages || 1);
    if (state.pages <= 1) { ul.innerHTML = ''; return; }

    const li = [];
    const disabledLeft  = current === 1;
    const disabledRight = current === state.pages;

    li.push(`
      <li class="page-item ${disabledLeft ? 'disabled' : ''}">
        <a href="#" data-page="1" class="page-link"><i class="bi bi-chevron-bar-left font-size-vw-0_5"></i></a>
      </li>
      <li class="page-item ${disabledLeft ? 'disabled' : ''}">
        <a href="#" data-page="${Math.max(1, current - 1)}" class="page-link"><i class="bi bi-chevron-left font-size-vw-0_5"></i></a>
      </li>
    `);

    let i = current > 2 ? current - 1 : 1;
    if (i !== 1) li.push(`<li class="page-item disabled"><a href="#" class="page-link font-size-vw-0_5">...</a></li>`);

    for (; i <= (current + 1) && i <= state.pages; i++) {
      if (i === current) {
        li.push(`<li class="page-item is-current" aria-current="page"><span class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${i}</span></li>`);
      } else {
        li.push(`<li class="page-item fsvw-0_7"><a href="#" data-page="${i}" class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${i}</a></li>`);
      }

      if (i === current + 1 && i < state.pages) {
        li.push(`
          <li class="page-item disabled"><a href="#" class="page-link font-size-vw-0_5">...</a></li>
          <li class="page-item"><a href="#" data-page="${state.pages}" class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${state.pages}</a></li>
        `);
      }
    }

    li.push(`
      <li class="page-item ${disabledRight ? 'disabled' : ''}">
        <a href="#" data-page="${Math.min(state.pages, current + 1)}" class="page-link"><i class="bi bi-chevron-right font-size-vw-0_5"></i></a>
      </li>
      <li class="page-item ${disabledRight ? 'disabled' : ''}">
        <a href="#" data-page="${state.pages}" class="page-link"><i class="bi bi-chevron-bar-right font-size-vw-0_5"></i></a>
      </li>
    `);

    ul.innerHTML = li.join('');
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest(`#${PAG_UL_ID} a.page-link`);
    if (!a) return;
    const page = Number(a.dataset.page);
    if (!page || page === state.pg || a.parentElement.classList.contains('disabled')) return;
    e.preventDefault();

    const value = combo12()?.value?.trim();
    if (!value) return;
    loadFor(value, page);
  });

  async function loadFor(comboValue, page = 1) {
    if (!comboValue) { clearTable(); renderPagination(1, 1); return; }
    clearTable(); rowMsg('Φόρτωση...', 'text-center');

    try {
      const url = `${ENDPOINT}?afora_thn_symbash_kathgoria_eidikothta=${encodeURIComponent(comboValue)}&page=${page}&limit=${LIMIT}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      renderRows(json.items || []);
      renderPagination(Number(json.page || page), Number(json.pages || 1));
    } catch (e) {
      clearTable(); renderPagination(1, 1);
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
      console.error(e);
    }
  }

  function onChangeSym()  { clearTable(); renderPagination(1,1); }
  function onChangeKat()  { clearTable(); renderPagination(1,1); }
  function onChangeEid(v) {
    const sym = to4($id(SYM_HIDDEN)?.value || getTSVal(SYM_SELECT) || '');
    const kat = to4($id(KAT_HIDDEN)?.value || getTSVal(KAT_SELECT) || '');
    const eid = to4(v || $id(EID_HIDDEN)?.value || getTSVal(EID_SELECT) || '');
    const value = sym && kat && eid ? `${sym}${kat}${eid}` : '';
    const h = combo12(); if (h) h.value = value;
    if (!value) { clearTable(); renderPagination(1,1); return; }
    loadFor(value, 1);
  }

  document.addEventListener('change', (e) => {
    const t = e.target; if (!t) return;
    if (t.id === SYM_SELECT || (t.closest && t.closest('#' + SYM_SELECT))) { queueMicrotask(onChangeSym); return; }
    if (t.id === KAT_SELECT || (t.closest && t.closest('#' + KAT_SELECT))) { queueMicrotask(onChangeKat); return; }
    if (t.id === EID_SELECT || (t.closest && t.closest('#' + EID_SELECT))) { queueMicrotask(() => onChangeEid($id(EID_SELECT)?.value || $id(EID_HIDDEN)?.value || '')); return; }
  }, true);

  // Hydration
  const sym0 = ($id(SYM_HIDDEN)?.value || $id(SYM_SELECT)?.value || '').trim();
  const kat0 = ($id(KAT_HIDDEN)?.value || $id(KAT_SELECT)?.value || '').trim();
  const eid0 = ($id(EID_HIDDEN)?.value || $id(EID_SELECT)?.value || '').trim();

  if (sym0 && kat0 && eid0) {
    const combo = `${to4(sym0)}${to4(kat0)}${to4(eid0)}`;
    if (combo12()) combo12().value = combo;
    loadFor(combo, 1);
  } else {
    clearTable(); renderPagination(1,1);
  }
})();
