// /static/js/symbaseis/ypologismoiKlimakion/stoixeia_list_multi.js
// Χωρίς pagination & χωρίς sessionStorage. Υποστηρίζει single/multiple επιλογές.
// ΕΜΦΑΝΙΖΕΙ 3 στήλες: [Κωδικός 4ψηφιο] [AFK πρώτα 8] [Περιγραφή].
// Φέρνει ΟΛΑ τα στοιχεία (όλες τις σελίδες) όταν αλλάζει η Ειδικότητα.
// Περιλαμβάνει guards για να αγνοούνται παλιές αποκρίσεις.

(() => {
  if (window.__stoixeiaListMultiInit) return;
  window.__stoixeiaListMultiInit = true;

  const ENDPOINT   = '/api/symbaseis/stoixeiaSymbaseon';

  const SYM_SELECT = 'symbash',  SYM_HIDDEN = 'symbash_stathera';
  const KAT_SELECT = 'kathgoria_symbashs', KAT_HIDDEN = 'kathgoria_symbashs_stathera';
  const EID_SELECT = 'eidikothta_symbashs', EID_HIDDEN = 'eidikothta_symbashs_stathera';

  const TBODY_SEL  = '#myTable tbody';

  // ----------------- helpers -----------------
  const $   = (id) => document.getElementById(id);
  const ts  = (id) => $(id)?.tomselect || null;
  const tbody = () => document.querySelector(TBODY_SEL);
  const csrf  = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

  const to4 = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };
  const cmp = (a,b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric:true });

  const getVals = (id) => {
    const el = $(id); if (!el) return [];
    if (el.tomselect) {
      const v = el.tomselect.getValue();
      return Array.isArray(v) ? v : (v ? [v] : []);
    }
    if (el.multiple) return Array.from(el.selectedOptions || []).map(o => o.value);
    return el.value ? [el.value] : [];
  };

  // πόσες ορατές στήλες έχει το header (για σωστό colSpan στα μηνύματα)
  const headerColCount = () => {
    const ths = document.querySelectorAll('#myTableHeader thead th');
    return ths && ths.length ? ths.length : 3; // default 3
  };

  // stale-guards
  let __REQ_TOKEN = 0;
  const newReq = () => (++__REQ_TOKEN);

  // ----------------- table -----------------
  const clearTable = () => { const tb = tbody(); if (tb) tb.innerHTML = ''; };

  const rowMsg = (text, cls='text-center text-muted') => {
    const tb = tbody(); if (!tb) return;
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = headerColCount();
    td.className = cls;
    td.textContent = text;
    tr.appendChild(td);
    tb.appendChild(tr);
  };

  // 3 στήλες: 1) kodikos(4) 2) afk[0..7] 3) perigrafh
  const renderRows = (items) => {
    clearTable();
    if (!items?.length) return rowMsg('Δεν βρέθηκαν στοιχεία σύμβασης.');
    const tb = tbody(); if (!tb) return;

    for (const r of items) {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id ?? r._id ?? '';

      // Στήλη 1: 4-ψηφιος kodikos
      const td1 = document.createElement('td');
      td1.className = 'col-1 code-cell';
      const sp = document.createElement('span');
      sp.className = 'margin-left-1rem';
      sp.textContent = to4(r.kodikos);
      td1.appendChild(sp);
      tr.appendChild(td1);

      // Στήλη 2: AFK (πρώτα 8 ψηφία)
      const td2 = document.createElement('td');
      td2.className = 'col-2 code-cell';
      const afk = r.afora_thn_symbash_kathgoria_eidikothta ?? '';
      td2.textContent = String(afk).substring(0, 8);
      tr.appendChild(td2);

      // Στήλη 3: Περιγραφή
      const td3 = document.createElement('td');
      td3.className = 'col-9';
      td3.textContent = r.perigrafh ?? '';
      tr.appendChild(td3);

      tb.appendChild(tr);
    }
  };

  // ----------------- API -----------------
  const LIMIT = 200; // μεγάλο limit για λιγότερα calls

  async function fetchAllForCombo(combo12) {
    const all = [];
    let page = 1, pages = 1;
    do {
      const url = `${ENDPOINT}?afora_thn_symbash_kathgoria_eidikothta=${encodeURIComponent(combo12)}&page=${page}&limit=${LIMIT}`;
      const res = await fetch(url, {
        headers: { 'Accept':'application/json', 'X-CSRF-Token': csrf() },
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const j = await res.json();
      if (Array.isArray(j.items)) all.push(...j.items);
      pages = Number(j.pages || pages || 1);
      page++;
    } while (page <= pages);
    return all;
  }

  const uniqItems = (arr) => {
    const seen = new Set(), out = [];
    for (const r of arr || []) {
      const key = ((r.id ?? r._id ?? '') + '|' + (r.afora_thn_symbash_kathgoria_eidikothta ?? ''))
               || `${r.kodikos}|${r.perigrafh}|${r.afora_thn_symbash_kathgoria_eidikothta ?? ''}`;
      if (!seen.has(key)) { seen.add(key); out.push(r); }
    }
    return out;
  };

  // ----------------- build combos από selections -----------------
  // key (από ΕΙΔ) μπορεί να είναι: `aa` (ιδανικό), `kodikos`, ή `kodikos|afk`
  function extractKatEidFromKey(key, opt, fallbackKatArr) {
    let eid = to4(opt?.kodikos);
    if (!eid && typeof key === 'string') {
      const left = key.includes('|') ? key.split('|')[0] : key;
      eid = to4(left);
    }
    let kat = to4(String(opt?.afora_thn_symbash_kathgoria || '').slice(-4));
    if (!kat && typeof key === 'string' && key.includes('|')) {
      const right = key.split('|')[1] || '';
      kat = to4(String(right).slice(-4));
    }
    if (!kat && Array.isArray(fallbackKatArr) && fallbackKatArr.length === 1) {
      kat = to4(fallbackKatArr[0]);
    }
    return { kat, eid };
  }

  async function loadAllForSelections() {
    const req = newReq();

    const sym = to4( ($(SYM_HIDDEN)?.value || ts(SYM_SELECT)?.getValue?.() || $(SYM_SELECT)?.value || '') );
    const katArr = (ts(KAT_SELECT) ? ts(KAT_SELECT).getValue() : getVals(KAT_SELECT)).map(to4).filter(Boolean);
    const eidKeys = (ts(EID_SELECT) ? ts(EID_SELECT).getValue() : getVals(EID_SELECT));

    clearTable();

    if (!sym) { rowMsg('Επιλέξτε Σύμβαση.'); return; }
    if (!eidKeys?.length) { rowMsg('Επιλέξτε τουλάχιστον μία Ειδικότητα.'); return; }

    const eidTS = ts(EID_SELECT);
    const combosMeta = [];
    const seen = new Set();

    for (const key of eidKeys) {
      const opt = eidTS?.options?.[key] || {};
      const { kat, eid } = extractKatEidFromKey(key, opt, katArr);
      if (!kat || !eid) continue;
      const combo = `${sym}${kat}${eid}`;
      if (seen.has(combo)) continue;
      seen.add(combo);
      combosMeta.push({ combo, kat, eid });
    }

    if (!combosMeta.length) { rowMsg('Δεν προέκυψαν έγκυροι συνδυασμοί.'); return; }

    rowMsg('Φόρτωση...', 'text-center');

    try {
      const all = [];
      for (const { combo } of combosMeta) {
        if (req !== __REQ_TOKEN) return;       // guard
        const items = await fetchAllForCombo(combo);
        if (req !== __REQ_TOKEN) return;
        all.push(...items);
      }
      if (req !== __REQ_TOKEN) return;

      const final = uniqItems(all).sort((a,b) => cmp(to4(a.kodikos), to4(b.kodikos)));
      renderRows(final);
    } catch (err) {
      if (req !== __REQ_TOKEN) return;
      console.error(err);
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
    }
  }

  // ----------------- events -----------------
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t) return;

    // Σύμβαση → απλώς καθάρισε τον πίνακα (τα dropdown chains σου θα ξαναγεμίσουν ΚΑΤ/ΕΙΔ)
    if (t.id === SYM_SELECT || t.closest?.(`#${SYM_SELECT}`)) {
      const v = ts(SYM_SELECT)?.getValue?.() ?? $(SYM_SELECT)?.value ?? '';
      if ($(SYM_HIDDEN)) $(SYM_HIDDEN).value = Array.isArray(v) ? (v[0] || '') : v;
      newReq();
      clearTable();
      return;
    }

    // Κατηγορία → καθάρισε τον πίνακα (μέχρι να επιλεγεί Ειδικότητα)
    if (t.id === KAT_SELECT || t.closest?.(`#${KAT_SELECT}`)) {
      newReq();
      clearTable();
      return;
    }

    // Ειδικότητα → φόρτωσε ΟΛΑ τα στοιχεία
    if (t.id === EID_SELECT || t.closest?.(`#${EID_SELECT}`)) {
      const v = ts(EID_SELECT)?.getValue?.() ?? getVals(EID_SELECT);
      if ($(EID_HIDDEN)) $(EID_HIDDEN).value = Array.isArray(v) ? (v[0] || '') : (v || '');
      loadAllForSelections();
      return;
    }
  }, true);

  // ----------------- init -----------------
  function init() {
    clearTable();
    // boot (αν υπάρχουν ήδη προεπιλογές)
    setTimeout(() => {
      const hasEid = getVals(EID_SELECT).length > 0 || (ts(EID_SELECT)?.getValue?.() || []).length > 0;
      if (hasEid) loadAllForSelections();
    }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
