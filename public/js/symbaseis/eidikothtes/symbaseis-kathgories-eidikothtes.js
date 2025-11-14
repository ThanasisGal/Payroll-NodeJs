// /static/js/symbaseis/eidikothtes/symbaseis-kathgories-eidikothtes.js
// Φορτώνει τον πίνακα Ειδικοτήτων για (Σύμβαση + Κατηγορία)
// και ΚΡΑΤΑΕΙ την επιλογή ανάμεσα σε redirect, όπως κάναμε στις Κατηγορίες.

(() => {
  if (window.__eidikothtesInit) return;
  window.__eidikothtesInit = true;

  const ENDPOINT  = '/api/symbaseis/eidikothtes';

  // ids
  const SYM_SELECT  = 'symbash';
  const SYM_HIDDEN  = 'symbash_stathera';

  const KAT_SELECT  = 'kathgoria_symbashs';
  const KAT_HIDDEN  = 'kathgoria_symbashs_stathera';

  const TBODY_SEL   = '#myTable tbody';
  const PAG_UL_ID   = 'eidikothtes-pagination';

  // session keys (ξεχωριστά για ΕΙΔΙΚΟΤΗΤΕΣ)
  const SS_SYM = 'wps:eidikothtes:symbasi';
  const SS_KAT = 'wps:eidikothtes:kathgoria';

  const LIMIT = (() => {
    const n = parseInt(window.__CONFIG__?.EGGRAFES ?? '15', 10);
    return Number.isFinite(n) && n > 0 ? n : 15;
  })();

  // ---------- μικρά helpers ----------
  const $id     = (id) => document.getElementById(id);
  const tbody   = () => document.querySelector(TBODY_SEL);
  const pagUl   = () => document.getElementById(PAG_UL_ID);
  const csrf    = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const to4     = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };

  // πάρε τιμή από TS αν υπάρχει
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

  // session helpers
  const saveSym = (v) => { try { v ? sessionStorage.setItem(SS_SYM, v) : sessionStorage.removeItem(SS_SYM); } catch {} };
  const saveKat = (v) => { try { v ? sessionStorage.setItem(SS_KAT, v) : sessionStorage.removeItem(SS_KAT); } catch {} };
  const getSym  = () => { try { return sessionStorage.getItem(SS_SYM) || ''; } catch { return ''; } };
  const getKat  = () => { try { return sessionStorage.getItem(SS_KAT) || ''; } catch { return ''; } };
  const clearSS = () => { try { sessionStorage.removeItem(SS_SYM); sessionStorage.removeItem(SS_KAT); } catch {} };

  // ---------- πίνακας ----------
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
    if (!items?.length) return rowMsg('Δεν βρέθηκαν ειδικότητες.');
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

  const state = { pg: 1, pages: 1 };

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

  // pagination click
  document.addEventListener('click', (e) => {
    const a = e.target.closest(`#${PAG_UL_ID} a.page-link`);
    if (!a) return;
    const page = Number(a.dataset.page);
    if (!page || page === state.pg || a.parentElement.classList.contains('disabled')) return;
    e.preventDefault();

    const sym = to4($id(SYM_HIDDEN)?.value || getTSVal(SYM_SELECT) || '');
    const kat = to4($id(KAT_HIDDEN)?.value || getTSVal(KAT_SELECT) || '');
    if (!sym || !kat) return;

    const combo = `${sym}${kat}`;
    const comboHidden = $id('kodikosSymbashs_Kathgorias');
    if (comboHidden) comboHidden.value = combo;

    loadFor(combo, page);
  });

  // ---------- fetch ----------
  async function loadFor(compositeKey, page = 1) {
    if (!compositeKey) { clearTable(); renderPagination(1, 1); return; }
    clearTable(); rowMsg('Φόρτωση...', 'text-center');

    try {
      const url = `${ENDPOINT}?afora_thn_symbash_kathgoria=${encodeURIComponent(compositeKey)}&page=${page}&limit=${LIMIT}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      renderRows(json.items || []);
      renderPagination(Number(json.page || page), Number(json.pages || 1));
    } catch (e) {
      console.error(e);
      clearTable();
      renderPagination(1, 1);
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
    }
  }

  // ---------- change handlers ----------
  function tryLoad() {
    const sym = to4($id(SYM_HIDDEN)?.value || getTSVal(SYM_SELECT) || getSym() || '');
    const kat = to4($id(KAT_HIDDEN)?.value || getTSVal(KAT_SELECT) || getKat() || '');
    if (!sym || !kat) {
      clearTable(); renderPagination(1,1);
      return;
    }
    const combo = `${sym}${kat}`;
    const comboHidden = $id('kodikosSymbashs_Kathgorias');
    if (comboHidden) comboHidden.value = combo;
    loadFor(combo, 1);
  }

  // αλλαγή σύμβασης
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === SYM_SELECT || t.closest?.(`#${SYM_SELECT}`)) {
      const v = to4(getTSVal(SYM_SELECT) || t.value || '');
      if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = v;
      saveSym(v);

      // όταν αλλάζει η σύμβαση → καθάρισε τον πίνακα, περίμενε την κατηγορία
      clearTable(); renderPagination(1,1);
      return;
    }

    if (t.id === KAT_SELECT || t.closest?.(`#${KAT_SELECT}`)) {
      const v = to4(getTSVal(KAT_SELECT) || t.value || '');
      if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = v;
      saveKat(v);

      // τώρα που έχουμε κατηγορία → δοκίμασε να φορτώσεις
      tryLoad();
      return;
    }
  }, true);

  // ---------- κουμπί "Επιστροφή" -> καθάρισε session ----------
  document.addEventListener('click', (e) => {
    const back = e.target.closest('#back-btn,[data-clear-symbash]');
    if (!back) return;
    clearSS();
  }, true);

  // ---------- init ----------
  function init() {
    // 1) Πάρε από URL (αν γύρισες με redirect και θες να το υποστηρίξεις)
    let symFromUrl = '', katFromUrl = '';
    try {
      const u = new URL(location.href);
      symFromUrl = u.searchParams.get('symbash') || '';
      katFromUrl = u.searchParams.get('kathgoria') || '';
    } catch {}

    // 2) Πάρε από session
    const symFromSS = getSym();
    const katFromSS = getKat();

    // 3) Πάρε από hidden
    const symFromHidden = $id(SYM_HIDDEN)?.value || '';
    const katFromHidden = $id(KAT_HIDDEN)?.value || '';

    const finalSym = to4(symFromUrl || symFromSS || symFromHidden || '');
    const finalKat = to4(katFromUrl || katFromSS || katFromHidden || '');

    // γράψ’ τα στα hidden (για να τα δει TomSelect που κάνει preselect)
    if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = finalSym;
    if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = finalKat;

    // και τώρα δοκίμασε να φορτώσεις
    if (finalSym && finalKat) {
      const combo = `${finalSym}${finalKat}`;
      const comboHidden = $id('kodikosSymbashs_Kathgorias');
      if (comboHidden) comboHidden.value = combo;
      loadFor(combo, 1);
    } else {
      clearTable(); renderPagination(1,1);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
