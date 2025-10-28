// /static/js/symbaseisDropdownChain.js
// Anti-flicker αλυσίδα: Σύμβαση → Κατηγορία
// + ενημέρωση hidden kodikosSymbashs_Kathgorias = sym(4) + kat(4)
// + focus στο #back-btn μόλις συμπληρωθεί ο συνδυασμός

import { initTomDropdown } from '/static/js/dropdown-item.js';

(() => {
  if (window.__symbaseisDropdownChainInit) return;
  window.__symbaseisDropdownChainInit = true;

  // ----- helpers -------------------------------------------------------------
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

  // --- focus helper για back-btn --------------------------------------------
  const focusBackBtn = () => {
    const b = el('back-btn');
    if (!b) return;
    try { b.focus({ preventScroll: true }); } catch { b.focus(); }
  };

  // --- hidden combo (sym + kat) ---------------------------------------------
  const COMBO_HIDDEN = 'kodikosSymbashs_Kathgorias';
  // focusOnSet: true => κάνει focus στο back-btn όταν υπάρχει πλήρης τιμή
  const setComboHidden = (symVal, katVal, focusOnSet = true) => {
    const h = el(COMBO_HIDDEN);
    if (!h) return;
    const s = to4(symVal);
    const k = to4(katVal);
    const combo = (s && k) ? (s + k) : '';
    h.value = combo;
    if (focusOnSet && combo) focusBackBtn();
  };

  // ----- dynamic params για κατηγορίες --------------------------------------
  const kathParams = {};

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

  // ----- anti-flicker state για την κατηγορία --------------------------------
  let katLoading = false;
  let katPendingOpen = false;

  // Τυλίγουμε προσωρινά το settings.load ώστε να ξέρουμε πότε ολοκληρώνεται το fetch
  const beginKatLoad = () => {
    const inst = ts('kathgoria_symbashs');
    if (!inst) return;

    katLoading = true;
    katPendingOpen = false;

    // όσο φορτώνει, δεν ανοίγει on focus και είναι προσωρινά disabled
    inst.settings.openOnFocus = false;
    setEnabled('kathgoria_symbashs', false);

    const originalLoad = inst.settings.load;
    inst.settings.load = (query, callback) => {
      originalLoad.call(inst, query, (items) => {
        // forward τα items στον TomSelect
        callback(items);
        // όταν τα «χωνέψει», επανέφερε συμπεριφορά & enable
        setTimeout(() => {
          katLoading = false;
          inst.settings.openOnFocus = true;
          setEnabled('kathgoria_symbashs', true);
          if (katPendingOpen) {
            inst.open();
            katPendingOpen = false;
          }
          // επανάφερε το αρχικό load για επόμενες κλήσεις
          inst.settings.load = originalLoad;
        }, 0);
      });
    };

    try { inst.clearOptions(); } catch {}
    inst.load(''); // dropdown-item.js θα βάλει τα kathParams στο URL
  };

  // Αν ο χρήστης κλικάρει την κατηγορία ενώ φορτώνει, μην την ανοίγεις τώρα.
  document.addEventListener('mousedown', (e) => {
    const inst = ts('kathgoria_symbashs');
    const wrapper = inst?.wrapper || inst?.control || null;
    if (!wrapper) return;
    if (!wrapper.contains(e.target)) return;
    if (!katLoading) return;
    e.preventDefault();
    e.stopPropagation();
    katPendingOpen = true;
  }, true);

  // ----- init ---------------------------------------------------------------
  forceInit('symbash', '/api/dropdown/symbaseis/symbash');
  forceInit('kathgoria_symbashs', '/api/dropdown/symbaseis/kathgoria_symbashs', kathParams);

  const tsSym  = ts('symbash');

  // αρχή: μόνο σύμβαση enabled
  setEnabled('symbash', true);
  setEnabled('kathgoria_symbashs', false);

  // ----- change handlers ----------------------------------------------------
  const onSymChange = (symVal) => {
    const v = (symVal || '').trim();
    const h = hid('symbash'); if (h) h.value = v;

    // καθάρισε κατηγορία & combo, κλείδωσέ την μέχρι να φορτώσει
    resetSelect('kathgoria_symbashs', true);
    setComboHidden('', '', false);

    // ενημέρωσε φίλτρο
    delete kathParams.symbash;
    if (v) kathParams.symbash_stathera = v; else delete kathParams.symbash_stathera;

    if (v) {
      // re-init κατηγορίας & ξεκίνα preload με anti-flicker
      forceInit('kathgoria_symbashs', '/api/dropdown/symbaseis/kathgoria_symbashs', kathParams);
      beginKatLoad();
      // κλείδωσε τη σύμβαση μετά το render του TS
      setTimeout(() => setEnabled('symbash', false), 0);
    } else {
      setEnabled('symbash', true);
      setEnabled('kathgoria_symbashs', false);
    }
  };

  const onKatChange = (katVal) => {
    const v = (katVal || '').trim();
    const h = hid('kathgoria_symbashs'); if (h) h.value = v;

    if (v) {
      // ενημέρωσε το hidden combo ΜΟΛΙΣ επιλέξεις κατηγορία (και κάνε focus στο back)
      const curSym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
      setComboHidden(curSym, v, true);

      // κλείδωσε την κατηγορία λίγο μετά για να μην μπερδεύεται ο TS
      setTimeout(() => setEnabled('kathgoria_symbashs', false), 0);
    } else {
      // αδειάσαμε την κατηγορία → καθάρισε combo και άφησε ενεργό αν υπάρχει σύμβαση
      setComboHidden('', '', false);
      const sym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
      setEnabled('kathgoria_symbashs', !!sym);
    }
  };

  tsSym?.on('change', onSymChange);
  tsSym?.on('item_add', onSymChange);
  el('symbash')?.addEventListener('change', (e) => onSymChange(e.target.value));

  const tsKath = ts('kathgoria_symbashs');
  tsKath?.on('change', onKatChange);
  tsKath?.on('item_add', onKatChange);
  el('kathgoria_symbashs')?.addEventListener('change', (e) => onKatChange(e.target.value));

  // ----- clear flows --------------------------------------------------------
  // Clear σύμβασης (σκουπιδάκι TomSelect) → καθάρισε και το combo
  tsSym?.on('clear', () => {
    resetSelect('symbash', false);
    delete kathParams.symbash_stathera;
    resetSelect('kathgoria_symbashs', true);
    setComboHidden('', '', false);
    setEnabled('symbash', true);
    setEnabled('kathgoria_symbashs', false);
  });
  // Fallback αν έχεις custom clear button για symbash
  document.addEventListener('click', (e) => {
    const btn = e.target?.closest('[data-clear-target="#symbash"],[data-clear-symbash]');
    if (!btn) return;
    tsSym?.clear();
  });

  // Clear κατηγορίας (σκουπιδάκι TomSelect) → ξαναφόρτωσε με βάση τη σύμβαση & καθάρισε combo
  tsKath?.on('clear', () => {
    setComboHidden('', '', false);
    const curSym = (hid('symbash')?.value || el('symbash')?.value || '').trim();
    if (!curSym) { setEnabled('kathgoria_symbashs', false); return; }
    kathParams.symbash_stathera = curSym;
    beginKatLoad();
  });

  // ----- edit-mode ----------------------------------------------------------
  const bootSym = (hid('symbash')?.value || '').trim();
  const bootKat = (hid('kathgoria_symbashs')?.value || '').trim();
  if (bootSym) {
    kathParams.symbash_stathera = bootSym;
    setEnabled('symbash', false);
    if (bootKat) {
      // αν υπάρχει ήδη κατηγορία, ενημέρωσε combo ΧΩΡΙΣ focus στο back
      setComboHidden(bootSym, bootKat, false);
      setEnabled('kathgoria_symbashs', false);
    } else {
      beginKatLoad();
    }
  }
})();
