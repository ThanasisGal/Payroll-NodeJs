// /static/js/symbaseis/stoixeiaSymbaseon/stoixeia-list.js
// Φόρτωμα πίνακα Στοιχείων Σύμβασης για 3 επίπεδα:
// 1) Σύμβαση  2) Κατηγορία  3) Ειδικότητα
// Υποστηρίζει single & multiple (για Κατηγορία/Ειδικότητα):
// - Single: όπως πριν (server-side pagination με 12-ψηφιο).
// - Multiple: φέρνει ΟΛΟΥΣ τους συνδυασμούς (client-side merge + pagination).
//
// ΚΡΑΤΑΕΙ την επιλογή με sessionStorage. Σβήνεται όταν πατήσεις
// "Επιστροφή" ή κάποιο από τα σκουπιδάκια.

(() => {
  // για να μην φορτώσει 2 φορές
  if (window.__stoixeiaListInit) return;
  window.__stoixeiaListInit = true;

  const ENDPOINT = '/api/symbaseis/stoixeiaSymbaseon';

  // ids των dropdown/hidden
  const SYM_SELECT = 'symbash';
  const SYM_HIDDEN = 'symbash_stathera';

  const KAT_SELECT = 'kathgoria_symbashs';
  const KAT_HIDDEN = 'kathgoria_symbashs_stathera';

  const EID_SELECT = 'eidikothta_symbashs';
  const EID_HIDDEN = 'eidikothta_symbashs_stathera';

  // το hidden με το 12-ψηφιο (single)
  const COMBO12_ID = 'kodikosSymbashs_Kathgorias_Eidikothtas';

  // πίνακας + pagination
  const TBODY_SEL = '#myTable tbody';
  const PAG_UL_ID = 'stoixeiaSymbaseon-pagination';

  // sessionStorage keys (arrays σε JSON)
  const SS_SYM = 'wps:stoixeia:symbasi';
  const SS_KAT = 'wps:stoixeia:kathgoria';
  const SS_EID = 'wps:stoixeia:eidikothta';

  // πόσες εγγραφές ανά σελίδα
  const LIMIT = (() => {
    const n = parseInt(window.__CONFIG__?.EGGRAFES ?? '15', 10);
    return Number.isFinite(n) && n > 0 ? n : 15;
  })();

  // ---- μικρά helpers -------------------------------------------------
  const $id   = (id) => document.getElementById(id);
  const tbody = () => document.querySelector(TBODY_SEL);
  const pagUl = () => document.getElementById(PAG_UL_ID);
  const csrf  = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

  const to4 = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };

  // είναι multiple το συγκεκριμένο <select> / TomSelect;
  const isMulti = (id) => {
    const el = $id(id);
    if (!el) return false;
    if (el.tomselect) return el.tomselect.settings.mode === 'multi';
    return !!el.multiple;
  };

  // πάρε ΤΙΜΕΣ από TomSelect (ή native): πάντα array
  const getTSVals = (id) => {
    const el = $id(id);
    if (!el) return [];
    if (el.tomselect && typeof el.tomselect.getValue === 'function') {
      const v = el.tomselect.getValue();
      return Array.isArray(v) ? v : (v ? [v] : []);
    }
    const v = el.value || '';
    return v ? [v] : [];
  };

  const to4arr = (vals) => (vals || []).map(to4).filter(Boolean);

  // session helpers (αποθήκευση array σε JSON)
  const saveArr = (key, arr) => { try { arr?.length ? sessionStorage.setItem(key, JSON.stringify(arr)) : sessionStorage.removeItem(key); } catch {} };
  const getArr  = (key) => { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : []; } catch { return []; } };
  const clearSS = () => { try { sessionStorage.removeItem(SS_SYM); sessionStorage.removeItem(SS_KAT); sessionStorage.removeItem(SS_EID); } catch {} };

  // Συμβατικές προσβάσεις (παίρνουν πρώτα από TS, μετά από session, μετά από hidden)
  const getSymArr = () => {
    const ts = to4arr(getTSVals(SYM_SELECT));
    if (ts.length) return ts;
    const ss = to4arr(getArr(SS_SYM));
    if (ss.length) return ss;
    const hv = to4($id(SYM_HIDDEN)?.value || '');
    return hv ? [hv] : [];
  };
  const getKatArr = () => {
    const ts = to4arr(getTSVals(KAT_SELECT));
    if (ts.length) return ts;
    const ss = to4arr(getArr(SS_KAT));
    if (ss.length) return ss;
    const hv = to4($id(KAT_HIDDEN)?.value || '');
    return hv ? [hv] : [];
  };
  const getEidArr = () => {
    const ts = to4arr(getTSVals(EID_SELECT));
    if (ts.length) return ts;
    const ss = to4arr(getArr(SS_EID));
    if (ss.length) return ss;
    const hv = to4($id(EID_HIDDEN)?.value || '');
    return hv ? [hv] : [];
  };

  // ---- table helpers -------------------------------------------------
  const clearTable = () => {
    const tb = tbody();
    if (tb) tb.innerHTML = '';
  };

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
    if (!items?.length) return rowMsg('Δεν βρέθηκαν στοιχεία σύμβασης.');
    const tb = tbody(); if (!tb) return;

    for (const r of items) {
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
    }
  }

  // ---- pagination state ----------------------------------------------
  const state = {
    pg: 1,
    pages: 1,
    multiActive: false,     // όταν είναι true → client-side pagination
    multiItems: [],         // merged + deduped items
  };

  function renderPagination(current, pages) {
    const ul = pagUl(); if (!ul) return;
    state.pg = current;
    state.pages = Math.max(1, pages || 1);

    if (state.pages <= 1) {
      ul.innerHTML = '';
      return;
    }

    const li = [];
    const disabledLeft  = current === 1;
    const disabledRight = current === state.pages;

    // first / prev
    li.push(`
      <li class="page-item ${disabledLeft ? 'disabled' : ''}">
        <a href="#" data-page="1" class="page-link"><i class="bi bi-chevron-bar-left font-size-vw-0_5"></i></a>
      </li>
      <li class="page-item ${disabledLeft ? 'disabled' : ''}">
        <a href="#" data-page="${Math.max(1, current - 1)}" class="page-link"><i class="bi bi-chevron-left font-size-vw-0_5"></i></a>
      </li>
    `);

    // γύρω από την τρέχουσα
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
          <li class="page-item disabled"><a href="#" class="page-link font-size-vw-0_5">...</a></li>
          <li class="page-item"><a href="#" data-page="${state.pages}" class="page-link font-size-vw-0_5 padding-top-px-8 fw500">${state.pages}</a></li>
        `);
      }
    }

    // next / last
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

  // click στο pagination
  document.addEventListener('click', (e) => {
    const a = e.target.closest(`#${PAG_UL_ID} a.page-link`);
    if (!a) return;

    const page = Number(a.dataset.page);
    if (!page || page === state.pg || a.parentElement.classList.contains('disabled')) return;
    e.preventDefault();

    // Αν είμαστε σε multi → client-side slice
    if (state.multiActive) {
      renderMultiPage(page);
      return;
    }

    // Single → fetch με το 12-ψηφιο
    const comboVal = $id(COMBO12_ID)?.value?.trim() || '';
    if (!comboVal) return;
    loadForSingle(comboVal, page);
  });

  // ---- fetch ---------------------------------------------------------
  async function fetchPageForCombo(combo12, page = 1) {
    const url = `${ENDPOINT}?afora_thn_symbash_kathgoria_eidikothta=${encodeURIComponent(combo12)}&page=${page}&limit=${LIMIT}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json(); // { items, page, pages }
  }

  async function loadForSingle(combo12, page = 1) {
    if (!combo12) {
      clearTable();
      renderPagination(1, 1);
      return;
    }

    state.multiActive = false;
    clearTable();
    rowMsg('Φόρτωση...', 'text-center');

    try {
      const json = await fetchPageForCombo(combo12, page);
      renderRows(json.items || []);
      renderPagination(Number(json.page || page), Number(json.pages || 1));
    } catch (err) {
      console.error(err);
      clearTable();
      renderPagination(1, 1);
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
    }
  }

  // ---- multiple: merge όλων των combos, client-side pagination --------
  const cartesian = (a, b, c) => {
    const out = [];
    for (const x of a) for (const y of b) for (const z of c) out.push([x,y,z]);
    return out;
  };

  const uniqItems = (items) => {
    const seen = new Set();
    const out = [];
    for (const r of items || []) {
      const key = (r.id ?? r._id ?? '') || `${r.kodikos}|${r.perigrafh}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    return out;
  };

  async function loadForMultiple(symArr, katArr, eidArr) {
    // combos 12-ψηφια
    const combos = cartesian(symArr, katArr, eidArr).map(([s,k,e]) => `${s}${k}${e}`);
    if (!combos.length) {
      clearTable(); renderPagination(1,1); return;
    }

    state.multiActive = true;
    state.multiItems = [];
    clearTable();
    renderPagination(1, 1);
    rowMsg('Φόρτωση πολλαπλών συνδυασμών...', 'text-center');

    try {
      const all = [];
      // Φέρε ΟΛΕΣ τις σελίδες για κάθε combo (sequential για απλότητα/συμβατότητα)
      for (const combo of combos) {
        let page = 1, pages = 1;
        do {
          const json = await fetchPageForCombo(combo, page);
          if (Array.isArray(json.items)) all.push(...json.items);
          pages = Number(json.pages || pages || 1);
          page++;
        } while (page <= pages);
      }

      // dedupe & αποθήκευση
      state.multiItems = uniqItems(all);
      const pages = Math.max(1, Math.ceil(state.multiItems.length / LIMIT));

      // 1η σελίδα
      renderMultiPage(1, pages);

    } catch (err) {
      console.error(err);
      state.multiItems = [];
      clearTable();
      renderPagination(1, 1);
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
    }
  }

  function renderMultiPage(page = 1, pagesOpt) {
    const totalPages = pagesOpt || Math.max(1, Math.ceil(state.multiItems.length / LIMIT));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * LIMIT;
    const slice = state.multiItems.slice(start, start + LIMIT);

    renderRows(slice);
    renderPagination(p, totalPages);
  }

  // ---- build & load ---------------------------------------------------
  function tryLoad() {
    // σειρά προτεραιότητας: hidden (ό,τι έγραψε dropdown-item.js) -> TS -> session
    const symArr = (() => {
      const v = to4($id(SYM_HIDDEN)?.value || '');
      if (v) return [v];
      return getSymArr();
    })();

    const katArr = (() => {
      const v = to4($id(KAT_HIDDEN)?.value || '');
      if (v) return [v];
      return getKatArr();
    })();

    const eidArr = (() => {
      const v = to4($id(EID_HIDDEN)?.value || '');
      if (v) return [v];
      return getEidArr();
    })();

    // Αποθήκευση arrays στο session
    saveArr(SS_SYM, symArr);
    saveArr(SS_KAT, katArr);
    saveArr(SS_EID, eidArr);

    // Αν λείπει κάτι → καθάρισμα
    if (!symArr.length || !katArr.length || !eidArr.length) {
      state.multiActive = false;
      state.multiItems = [];
      clearTable();
      renderPagination(1, 1);
      return;
    }

    // Single (1-1-1) → server-side
    if (symArr.length === 1 && katArr.length === 1 && eidArr.length === 1) {
      const combo = `${symArr[0]}${katArr[0]}${eidArr[0]}`;
      const comboEl = $id(COMBO12_ID);
      if (comboEl) comboEl.value = combo;
      loadForSingle(combo, 1);
      return;
    }

    // Multiple → client-side merge
    const comboEl = $id(COMBO12_ID);
    if (comboEl) comboEl.value = ''; // δεν έχει νόημα 12-ψηφιο εδώ
    loadForMultiple(symArr, katArr, eidArr);
  }

  // ---- change listeners ----------------------------------------------
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;

    // 1) Σύμβαση → σώσε (ως array), γράψε hidden (πρώτη), καθάρισε πίνακα
    if (t.id === SYM_SELECT || t.closest?.(`#${SYM_SELECT}`)) {
      const vals = to4arr(getTSVals(SYM_SELECT));
      if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = vals[0] || '';
      saveArr(SS_SYM, vals);

      // αλλάζοντας σύμβαση, μηδένισε αποτελέσματα (οι άλλες επιλογές ίσως δεν ισχύουν πια)
      state.multiActive = false;
      state.multiItems = [];
      clearTable();
      renderPagination(1, 1);
      return;
    }

    // 2) Κατηγορία → σώσε array, γράψε hidden (πρώτη), προσπάθησε να φορτώσεις
    if (t.id === KAT_SELECT || t.closest?.(`#${KAT_SELECT}`)) {
      const vals = to4arr(getTSVals(KAT_SELECT));
      if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = vals[0] || '';
      saveArr(SS_KAT, vals);
      tryLoad();
      return;
    }

    // 3) Ειδικότητα → σώσε array, γράψε hidden (πρώτη), φόρτωσε
    if (t.id === EID_SELECT || t.closest?.(`#${EID_SELECT}`)) {
      const vals = to4arr(getTSVals(EID_SELECT));
      if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = vals[0] || '';
      saveArr(SS_EID, vals);
      tryLoad();
      return;
    }
  }, true);

  // ---- καθάρισμα όταν πατήσεις επιστροφή / σκουπιδάκι ----------------
  document.addEventListener('click', (e) => {
    // έχεις 3 σκουπιδάκια στο ejs, όλα με data-clear-symbash / data-clear-kathgoria / data-clear-eidikothta
    const clearBtn = e.target.closest('[data-clear-symbash],[data-clear-kathgoria],[data-clear-eidikothta],#back-btn');
    if (!clearBtn) return;

    clearSS(); // σβήσε τα δικά μας
    state.multiActive = false;
    state.multiItems = [];

    // καθάρισε τον πίνακα
    clearTable();
    renderPagination(1, 1);
  }, true);

  // ---- init ----------------------------------------------------------
  function parseUrlParamArr(name) {
    try {
      const u = new URL(location.href);
      const raw = u.searchParams.get(name) || '';
      if (!raw) return [];
      // υποστήριξη "0001,0002  ;  1  2"
      return to4arr(raw.split(/[,\s]+/).filter(Boolean));
    } catch { return []; }
  }

  function init() {
    // 1) από URL (πιθανή λίστα με κόμματα)
    const symUrl = parseUrlParamArr('symbash');
    const katUrl = parseUrlParamArr('kathgoria');
    const eidUrl = parseUrlParamArr('eidikothta');

    // 2) από session
    const symSS = to4arr(getArr(SS_SYM));
    const katSS = to4arr(getArr(SS_KAT));
    const eidSS = to4arr(getArr(SS_EID));

    // 3) από hidden
    const symH = to4($id(SYM_HIDDEN)?.value || '');
    const katH = to4($id(KAT_HIDDEN)?.value || '');
    const eidH = to4($id(EID_HIDDEN)?.value || '');

    // 4) από TS
    const symTS = to4arr(getTSVals(SYM_SELECT));
    const katTS = to4arr(getTSVals(KAT_SELECT));
    const eidTS = to4arr(getTSVals(EID_SELECT));

    // Τελικές τιμές (προτεραιότητα: URL > TS > Session > Hidden)
    const finalSym = (symUrl.length ? symUrl : (symTS.length ? symTS : (symSS.length ? symSS : (symH ? [symH] : []))));
    const finalKat = (katUrl.length ? katUrl : (katTS.length ? katTS : (katSS.length ? katSS : (katH ? [katH] : []))));
    const finalEid = (eidUrl.length ? eidUrl : (eidTS.length ? eidTS : (eidSS.length ? eidSS : (eidH ? [eidH] : []))));

    // Γράψ’ τα στα hidden (ώστε το dropdown-item.js να τα δει) — μόνο την 1η τιμή για συμβατότητα
    if ($id(SYM_HIDDEN)) $id(SYM_HIDDEN).value = finalSym[0] || '';
    if ($id(KAT_HIDDEN)) $id(KAT_HIDDEN).value = finalKat[0] || '';
    if ($id(EID_HIDDEN)) $id(EID_HIDDEN).value = finalEid[0] || '';

    // Αποθήκευσέ τα και στο session (arrays)
    saveArr(SS_SYM, finalSym);
    saveArr(SS_KAT, finalKat);
    saveArr(SS_EID, finalEid);

    // Single vs Multiple
    if (finalSym.length && finalKat.length && finalEid.length) {
      if (finalSym.length === 1 && finalKat.length === 1 && finalEid.length === 1) {
        const combo = `${finalSym[0]}${finalKat[0]}${finalEid[0]}`;
        const comboEl = $id(COMBO12_ID);
        if (comboEl) comboEl.value = combo;
        loadForSingle(combo, 1);
      } else {
        const comboEl = $id(COMBO12_ID);
        if (comboEl) comboEl.value = '';
        loadForMultiple(finalSym, finalKat, finalEid);
      }
    } else {
      clearTable();
      renderPagination(1, 1);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
