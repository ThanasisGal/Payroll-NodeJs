// /static/js/symbaseisDropdownChain3.js
// Αλυσίδα: Σύμβαση → Κατηγορία → Ειδικότητα (anti-flicker + κλείδωμα)
// Ορίζει το hidden "kodikosSymbashs_Kathgorias_Eidikothtas" = sym(4)+kat(4)+eidik(4)

import { initTomDropdown } from '/static/js/dropdown-item.js';

(() => {
  if (window.__symbaseisDropdownChain3Init) return;
  window.__symbaseisDropdownChain3Init = true;

  // ---------------- helpers ----------------
  const el  = (id) => document.getElementById(id);
  const ts  = (id) => el(id)?.tomselect || null;
  const hid = (id) => el(`${id}_stathera`) || null;

  const setEnabled = (id, enabled) => {
    const node = el(id);
    if (!node) return;
    node.disabled = !enabled;
    const inst = node.tomselect;
    if (inst) {
      if (enabled) inst.enable(); else inst.disable();
      inst.wrapper?.classList?.toggle('disabled', !enabled);
    }
  };

  const resetSelect = (id, disable) => {
    const node = el(id);
    const inst = node?.tomselect || null;
    if (inst) {
      try { inst.clear(true); } catch {}
      inst.clearOptions();
      if (disable !== undefined) {
        if (disable) inst.disable(); else inst.enable();
        inst.wrapper?.classList?.toggle('disabled', !!disable);
      }
    }
    if (node && disable !== undefined) node.disabled = !!disable;
    const h = hid(id); if (h) h.value = '';
  };

  const to4 = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d) return '';
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
  };

  const focusBackBtn = () => {
    const b = el('back-btn');
    if (!b) return;
    try { b.focus({ preventScroll: true }); } catch { b.focus(); }
  };

  // Συνθετικό hidden 12-ψηφιο: sym+kat+eidik
  const COMBO3_HIDDEN = 'kodikosSymbashs_Kathgorias_Eidikothtas';
  const setCombo3Hidden = (symVal, katVal, eidikVal, focusOnSet = true) => {
    const h = el(COMBO3_HIDDEN);
    if (!h) return;
    const s = to4(symVal);
    const k = to4(katVal);
    const e = to4(eidikVal);
    const combo = (s && k && e) ? (s + k + e) : '';
    h.value = combo;
    if (focusOnSet && combo) focusBackBtn();
  };

  // dynamic params (θα τα περνά το dropdown-item.js στο URL)
  const kathParams  = {};
  const eidikParams = {};

  const forceInit = (id, url, extraParamsObj) => {
    const node = el(id);
    if (!node) return null;
    if (node.tomselect) node.tomselect.destroy();
    return initTomDropdown({
      selector: `#${id}`,
      url,
      extraParams: extraParamsObj || {},
      minChars: 0,
    });
  };

  // -------- anti-flicker loaders για ενδιάμεσα επίπεδα ----------
  // Κατηγορία
  let katLoading = false, katPendingOpen = false;
  const beginKatLoad = () => {
    const inst = ts('kathgoria_symbashs');
    if (!inst) return;

    katLoading = true; katPendingOpen = false;
    inst.settings.openOnFocus = false;
    setEnabled('kathgoria_symbashs', false);

    const originalLoad = inst.settings.load;
    inst.settings.load = (query, callback) => {
      originalLoad.call(inst, query, (items) => {
        callback(items);
        setTimeout(() => {
          katLoading = false;
          inst.settings.openOnFocus = true;
          setEnabled('kathgoria_symbashs', true);
          if (katPendingOpen) { inst.open(); katPendingOpen = false; }
          inst.settings.load = originalLoad;
        }, 0);
      });
    };

    try { inst.clearOptions(); } catch {}
    inst.load('');
  };

  document.addEventListener('mousedown', (e) => {
    const inst = ts('kathgoria_symbashs');
    const wrapper = inst?.wrapper || inst?.control || null;
    if (!wrapper || !wrapper.contains(e.target) || !katLoading) return;
    e.preventDefault(); e.stopPropagation();
    katPendingOpen = true;
  }, true);

  // Ειδικότητα
  let eidikLoading = false, eidikPendingOpen = false;
  const beginEidikLoad = () => {
    const inst = ts('eidikothta_symbashs');
    if (!inst) return;

    eidikLoading = true; eidikPendingOpen = false;
    inst.settings.openOnFocus = false;
    setEnabled('eidikothta_symbashs', false);

    const originalLoad = inst.settings.load;
    inst.settings.load = (query, callback) => {
      originalLoad.call(inst, query, (items) => {
        callback(items);
        setTimeout(() => {
          eidikLoading = false;
          inst.settings.openOnFocus = true;
          setEnabled('eidikothta_symbashs', true);
          if (eidikPendingOpen) { inst.open(); eidikPendingOpen = false; }
          inst.settings.load = originalLoad;
        }, 0);
      });
    };

    try { inst.clearOptions(); } catch {}
    inst.load('');
  };

  document.addEventListener('mousedown', (e) => {
    const inst = ts('eidikothta_symbashs');
    const wrapper = inst?.wrapper || inst?.control || null;
    if (!wrapper || !wrapper.contains(e.target) || !eidikLoading) return;
    e.preventDefault(); e.stopPropagation();
    eidikPendingOpen = true;
  }, true);

  // ---------------- init -------------------
  forceInit('symbash', '/api/dropdown/symbaseis/symbash');
  forceInit('kathgoria_symbashs', '/api/dropdown/symbaseis/kathgoria_symbashs', kathParams);
  forceInit('eidikothta_symbashs', '/api/dropdown/symbaseis/eidikothta_symbashs', eidikParams);

  setEnabled('symbash', true);
  setEnabled('kathgoria_symbashs', false);
  setEnabled('eidikothta_symbashs', false);

  const onSymChange = (symVal) => {
    const v = (symVal || '').trim();
    const h = hid('symbash'); if (h) h.value = v;

    resetSelect('kathgoria_symbashs', true);
    resetSelect('eidikothta_symbashs', true);
    setCombo3Hidden('', '', '', false);

    delete kathParams.symbash; delete kathParams.symbash_stathera;
    if (v) kathParams.symbash_stathera = v;

    if (v) {
      forceInit('kathgoria_symbashs', '/api/dropdown/symbaseis/kathgoria_symbashs', kathParams);
      beginKatLoad();
      setTimeout(() => setEnabled('symbash', false), 0);
    } else {
      setEnabled('symbash', true);
      setEnabled('kathgoria_symbashs', false);
      setEnabled('eidikothta_symbashs', false);
    }
  };

  const onKatChange = (katVal) => {
    const v = (katVal || '').trim();
    const h = hid('kathgoria_symbashs'); if (h) h.value = v;

    // τρέχουσα σύμβαση
    const curSym = (hid('symbash')?.value || el('symbash')?.value || '').trim();

    resetSelect('eidikothta_symbashs', true);
    setCombo3Hidden('', '', '', false);

    // πέρασε φίλτρα για dropdown Ειδικοτήτων
    delete eidikParams.symbash_stathera;
    delete eidikParams.kathgoria_symbashs_stathera;
    if (curSym && v) {
      eidikParams.symbash_stathera = curSym;
      eidikParams.kathgoria_symbashs_stathera = v;

      forceInit('eidikothta_symbashs', '/api/dropdown/symbaseis/eidikothta_symbashs', eidikParams);
      beginEidikLoad();
      setTimeout(() => setEnabled('kathgoria_symbashs', false), 0);
    } else {
      setEnabled('eidikothta_symbashs', false);
      // αν αδειάσει η κατηγορία, επέτρεψε reselect (αν υπάρχει σύμβαση)
      setEnabled('kathgoria_symbashs', !!curSym);
    }
  };

  const onEidikChange = (eidikVal) => {
    const v = (eidikVal || '').trim();
    const h = hid('eidikothta_symbashs'); if (h) h.value = v;

    const sym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
    const kat = (hid('kathgoria_symbashs')?.value || el('kathgoria_symbashs')?.value || '').trim();

    if (v) {
      setCombo3Hidden(sym, kat, v, true);
      setTimeout(() => setEnabled('eidikothta_symbashs', false), 0);
    } else {
      setCombo3Hidden('', '', '', false);
      const enableEidik = !!(sym && kat);
      setEnabled('eidikothta_symbashs', enableEidik);
    }
  };

  const tsSym   = ts('symbash');
  const tsKath  = ts('kathgoria_symbashs');
  const tsEidik = ts('eidikothta_symbashs');

  tsSym?.on('change', onSymChange);
  tsSym?.on('item_add', onSymChange);
  el('symbash')?.addEventListener('change', (e) => onSymChange(e.target.value));

  tsKath?.on('change', onKatChange);
  tsKath?.on('item_add', onKatChange);
  el('kathgoria_symbashs')?.addEventListener('change', (e) => onKatChange(e.target.value));

  tsEidik?.on('change', onEidikChange);
  tsEidik?.on('item_add', onEidikChange);
  el('eidikothta_symbashs')?.addEventListener('change', (e) => onEidikChange(e.target.value));

  // ---- clear flows ----
  tsSym?.on('clear', () => {
    resetSelect('symbash', false);
    resetSelect('kathgoria_symbashs', true);
    resetSelect('eidikothta_symbashs', true);
    setCombo3Hidden('', '', '', false);
    setEnabled('symbash', true);
    setEnabled('kathgoria_symbashs', false);
    setEnabled('eidikothta_symbashs', false);
  });

  tsKath?.on('clear', () => {
    resetSelect('eidikothta_symbashs', true);
    setCombo3Hidden('', '', '', false);
    const curSym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
    if (curSym) {
      kathParams.symbash_stathera = curSym;
      beginKatLoad();
      setEnabled('kathgoria_symbashs', true);
    } else {
      setEnabled('kathgoria_symbashs', false);
    }
  });

  tsEidik?.on('clear', () => {
    setCombo3Hidden('', '', '', false);
    const curSym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
    const curKat = (hid('kathgoria_symbashs')?.value || el('kathgoria_symbashs')?.value || '').trim();
    if (curSym && curKat) {
      eidikParams.symbash_stathera = curSym;
      eidikParams.kathgoria_symbashs_stathera = curKat;
      beginEidikLoad();
      setEnabled('eidikothta_symbashs', true);
    } else {
      setEnabled('eidikothta_symbashs', false);
    }
  });

  // ---- edit-mode / hydration ----
  const bootSym  = (hid('symbash')?.value || '').trim();
  const bootKat  = (hid('kathgoria_symbashs')?.value || '').trim();
  const bootEid  = (hid('eidikothta_symbashs')?.value || '').trim();

  if (bootSym) {
    kathParams.symbash_stathera = bootSym;
    setEnabled('symbash', false);

    if (bootKat) {
      eidikParams.symbash_stathera = bootSym;
      eidikParams.kathgoria_symbashs_stathera = bootKat;
      setEnabled('kathgoria_symbashs', false);

      if (bootEid) {
        setCombo3Hidden(bootSym, bootKat, bootEid, false);
        setEnabled('eidikothta_symbashs', false);
      } else {
        beginEidikLoad();
      }
    } else {
      beginKatLoad();
    }
  }
})();
