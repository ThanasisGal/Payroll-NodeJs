// public/js/symbaseis/kathgories/symbaseis_kathgories.js
(() => {
  // ----------------------------------------------------
  // σταθερά endpoints
  // ----------------------------------------------------
  const LIST_ENDPOINT     = '/api/symbaseis/kathgories';
  const DROPDOWN_ENDPOINT = '/api/dropdown/symbaseis/symbash';

  // ----------------------------------------------------
  // ids / selectors
  // ----------------------------------------------------
  const SELECT_ID  = 'symbash';
  const HIDDEN_ID  = 'symbash_stathera';
  const TBODY_SEL  = '#myTable tbody';
  const PAG_UL_ID  = 'kathgories-pagination';
  const CLEAR_SEL  = '[data-clear-target="#symbash"],[data-clear-symbash]';

  // εκεί θα κρατάμε την επιλογή όταν πάμε σε φόρμα
  const SS_KEY = 'wps:symbaseis:lastSymbasi';

  // πόσες γραμμές ανά σελίδα
  const LIMIT = (() => {
    const n = parseInt(window.__CONFIG__?.EGGRAFES ?? '15', 10);
    return Number.isFinite(n) && n > 0 ? n : 15;
  })();

  // ----------------------------------------------------
  // μικρά helpers DOM
  // ----------------------------------------------------
  const tbody    = () => document.querySelector(TBODY_SEL);
  const pagUl    = () => document.getElementById(PAG_UL_ID);
  const selectEl = () => document.getElementById(SELECT_ID);
  const hiddenEl = () => document.getElementById(HIDDEN_ID);
  const csrf     = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

  const to4 = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };

  // ----------------------------------------------------
  // πίνακας
  // ----------------------------------------------------
  const clearTable = () => {
    const tb = tbody(); if (tb) tb.innerHTML = '';
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
    if (!items?.length) {
      rowMsg('Δεν βρέθηκαν κατηγορίες.');
      return;
    }
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

  // ----------------------------------------------------
  // pagination
  // ----------------------------------------------------
  const state = { pg: 1, pages: 1, total: 0 };

  function renderPagination(current, pages) {
    const ul = pagUl(); if (!ul) return;
    state.pg = current;
    state.pages = Math.max(1, pages || 1);

    if (state.pages <= 1) {
      ul.innerHTML = '';
      return;
    }

    const li = [];
    const disabledLeft = current === 1;
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
    const v = (hiddenEl()?.value || '').trim();
    if (!v) return;
    loadFor(v, page);
  });

  // ----------------------------------------------------
  // fetch δεδομένων πίνακα
  // ----------------------------------------------------
  async function loadFor(symbash, page = 1) {
    if (!symbash) {
      clearTable();
      renderPagination(1, 1);
      return;
    }

    clearTable();
    rowMsg('Φόρτωση...', 'text-center');

    try {
      const url = `${LIST_ENDPOINT}?symbash_stathera=${encodeURIComponent(symbash)}&page=${page}&limit=${LIMIT}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': csrf(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      renderRows(json.items || []);
      renderPagination(Number(json.page || page), Number(json.pages || 1));
    } catch (err) {
      console.error(err);
      clearTable();
      rowMsg('Προέκυψε σφάλμα κατά τη φόρτωση.', 'text-center text-danger');
      renderPagination(1, 1);
    }
  }

  // ----------------------------------------------------
  // session helpers
  // ----------------------------------------------------
  function saveSession(sym) {
    try {
      if (sym) sessionStorage.setItem(SS_KEY, sym);
      else sessionStorage.removeItem(SS_KEY);
    } catch {}
  }
  function getSession() {
    try { return sessionStorage.getItem(SS_KEY) || ''; } catch { return ''; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SS_KEY); } catch {}
  }

  // ----------------------------------------------------
  // Κεντρικός χειριστής αλλαγής
  // ----------------------------------------------------
  let currentSym = '';
  let busy = false;

  async function onChange(val) {
    const v = (val || '').trim();
    if (busy) return;
    if (v === currentSym) return;
    busy = true;

    currentSym = v;

    const h = hiddenEl();
    if (h) h.value = v;

    saveSession(v);

    await loadFor(v, 1);

    // disable / enable το TS
    const s = selectEl();
    if (s?.tomselect) {
      if (v) s.tomselect.disable();
      else s.tomselect.enable();
    }

    busy = false;
  }

  // όταν αλλάζει το select (ο TomSelect θα το ρίξει εδώ)
  document.addEventListener('change', (e) => {
    if (e.target?.id !== SELECT_ID) return;
    onChange(e.target.value);
  }, true);

  // ----------------------------------------------------
  // σκουπιδάκι (clear)
  // ----------------------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest(CLEAR_SEL);
    if (!btn) return;

    const s = selectEl();
    const h = hiddenEl();

    if (s?.tomselect) {
      s.tomselect.enable();
      s.tomselect.clear(true);
    } else if (s) {
      s.value = '';
    }

    if (h) h.value = '';

    currentSym = '';
    clearSession();

    clearTable();
    renderPagination(1, 1);
  });

  // ----------------------------------------------------
  // πριν φύγεις σε φόρμα → κράτα την επιλογή
  // ----------------------------------------------------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href],button[data-href]');
    if (!a) return;
    const curr = (hiddenEl()?.value || selectEl()?.value || '').trim();
    if (!curr) return;
    saveSession(curr);
  }, true);

  // ----------------------------------------------------
  // ⬇️ εδώ είναι η νέα «λογική» που ζήτησες
  // ----------------------------------------------------
  function getInitialSym() {
    // 1) από URL (redirect από add)
    try {
      const u = new URL(location.href);
      const fromUrl = u.searchParams.get('symbash');
      if (fromUrl) return fromUrl;
    } catch {}

    // 2) από session (όταν επιστρέφουμε)
    const fromSession = getSession();
    if (fromSession) return fromSession;

    // 3) από hidden (ό,τι είχε βάλει ο server)
    return hiddenEl()?.value || '';
  }

  // fetch ΕΝΑ option από το dropdown API για να πάρουμε ΚΑΙ label
  async function ensureOptionInTomSelect(value) {
    if (!value) return;
    const s = selectEl();
    if (!s || !s.tomselect) return;
    const ts = s.tomselect;

    // αν το έχει ήδη σαν option, δεν κάνουμε τίποτα
    if (ts.options[value]) return;

    try {
      const url = new URL(DROPDOWN_ENDPOINT, location.origin);
      url.searchParams.set('value', value);
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      const item = (json.items && json.items[0]) || null;
      if (item) {
        ts.addOption(item);
      } else {
        // fallback: να φαίνεται τουλάχιστον ο κωδικός
        ts.addOption({ value, label: value });
      }
    } catch (err) {
      console.warn('preload single dropdown failed:', err);
      ts.addOption({ value, label: value });
    }
  }

  async function init() {
    const initial = getInitialSym();

    // γράψτο στο hidden ώστε το EJS <input> να συμφωνεί
    const h = hiddenEl();
    if (h) h.value = initial;

    const s = selectEl();

    // ⬅️ εδώ αλλάζουμε λογική:
    // 1. περιμένουμε να έχει σηκωθεί ο TomSelect από το δικό σου dropdown-init.js
    //    (αυτός συνήθως έχει τρέξει ήδη γιατί το φορτώνεις πριν από το δικό μας)
    // 2. αν υπάρχει αρχική τιμή → φρόντισε ΠΡΩΤΑ να υπάρχει σαν option
    if (s && s.tomselect && initial) {
      await ensureOptionInTomSelect(initial);
      s.tomselect.setValue(initial, true);
      s.tomselect.disable();
    }

    // 3. τώρα που το TS είναι ok → φόρτωσε τον πίνακα
    await onChange(initial);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
