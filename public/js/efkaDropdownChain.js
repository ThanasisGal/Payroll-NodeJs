// /static/js/dropdowns/efkaDropdownChain.js  ---- 
// Αλυσίδα: KAD → Ειδικότητα → KPK(apo) → EPA(όλες)
// - Ρητά load('') όπου χρειάζεται για να ΜΗΝ εμφανίζεται "No results found"
// - Σκληρό reset παιδιών σε change/clear
// - Auto-focus στο επόμενο βήμα

import { initTomDropdown } from './dropdown-item.js';

(function () {
  if (window.__efkaDropdownChainInit) return;
  window.__efkaDropdownChainInit = true;
  window.__EFKA_KPK_PROGRAMMATIC__ = false;
  
  // ---------- helpers ----------
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
    const fs = node.closest('fieldset[disabled]');
    if (enabled && fs) fs.removeAttribute('disabled');
  };

  const resetSelect = (id, disable = true) => {
    const node = el(id);
    const inst = node?.tomselect || null;
    if (inst) {
      // καθάρισε τιμή + options για να μην μείνει παλιό state
      inst.clear();
      inst.clearOptions();
      if (disable) inst.disable();
      inst.wrapper?.classList?.toggle('disabled', !!disable);
    }
    if (node) node.disabled = !!disable;
    const h = hid(id); if (h) h.value = '';
  };

  const forceInit = (id, url, extraParams = {}, minChars = 0) => {
    const node = el(id);
    if (!node) return null;
    if (node.tomselect) node.tomselect.destroy();
    return initTomDropdown({ selector: `#${id}`, url, extraParams, minChars });
  };

  const openAndFocus = (inst) => { try { inst?.open(); inst?.focus(); } catch(_){} };

  // ---------- URLs ----------
  const URLS = {
    kad         : '/api/dropdown/ergazomenoi/kad_efka',
    eidikothtes : '/api/dropdown/ergazomenoi/eidikothta_efka',
    kpkByKadEid : '/api/dropdown/ergazomenoi/kpk_efka',
    epaAll      : '/api/dropdown/ergazomenoi/epa_efka'
  };

  // ---------- params ----------
  const pEid = {}; // ?kad=XXXX
  const pKpk = {}; // ?kad=XXXX&eidikothta=YYYYYY
  const pEpa = {}; // (φέρνουμε όλες)

  // ---------- hard init ----------
  forceInit('kad_efka',        URLS.kad);
  forceInit('eidikothta_efka', URLS.eidikothtes, pEid, 0);
  forceInit('kpk_efka',        URLS.kpkByKadEid, pKpk, 0);
  forceInit('epa_efka',        URLS.epaAll,      pEpa, 0);

  const tsKad = ts('kad_efka');
  const tsEid = ts('eidikothta_efka');
  const tsKpk = ts('kpk_efka');
  const tsEpa = ts('epa_efka');

  // Προφόρτωσε ΚΑΔ στην εκκίνηση
  tsKad?.load?.('');

  // Κλείδωσε τα “κάτω” αν δεν έχουν τιμή
  if (!hid('eidikothta_efka')?.value) resetSelect('eidikothta_efka', true);
  if (!hid('kpk_efka')?.value)        resetSelect('kpk_efka',        true);
  if (!hid('epa_efka')?.value)        resetSelect('epa_efka',        true);

  // --- guards: αν ανοίξει άδειο dropdown, φόρτωσέ το ---
  const guardOpenLoad = (inst, id, canLoad) => {
    inst?.on?.('dropdown_open', () => {
      if (!canLoad()) return;
      const hasOptions = Object.keys(inst?.options || {}).length > 0;
      if (!hasOptions) inst.load('');
    });
  };

  guardOpenLoad(tsKad, 'kad_efka', () => true);
  guardOpenLoad(tsEid, 'eidikothta_efka', () => !!pEid.kad);
  guardOpenLoad(tsKpk, 'kpk_efka', () => !!pKpk.kad && !!pKpk.eidikothta);
  guardOpenLoad(tsEpa, 'epa_efka', () => !el('epa_efka')?.disabled);

  // ====================== KAD → Ειδικότητα ======================
  const onKadChange = (kadVal) => {
    const hKad = hid('kad_efka'); if (hKad) hKad.value = kadVal || '';

    resetSelect('eidikothta_efka', !kadVal);
    resetSelect('kpk_efka',        true);
    resetSelect('epa_efka',        true);

    if (kadVal) {
      pEid.kad = hKad.value || kadVal;
      setEnabled('eidikothta_efka', true);
      tsEid?.load('');            // άμεση φόρτωση ειδικοτήτων
      openAndFocus(tsEid);
    } else {
      delete pEid.kad;
    }
  };
  tsKad?.on('change', onKadChange);
  tsKad?.on('item_add', onKadChange);
  el('kad_efka')?.addEventListener('change', (e) => onKadChange(e.target.value));

  tsKad?.on('clear', () => {
    resetSelect('eidikothta_efka', true);
    resetSelect('kpk_efka',        true);
    resetSelect('epa_efka',        true);
    delete pEid.kad; delete pKpk.kad; delete pKpk.eidikothta;
    // ξαναπρόσφερε ΚΑΔ (μπορεί να είχαν καθαριστεί options από TS)
    tsKad?.clearOptions(); tsKad?.load('');
  });

  // ====================== Ειδικότητα → KPK(apo) ======================
  const onEidChange = (eidVal) => {
    const hEid = hid('eidikothta_efka'); if (hEid) hEid.value = eidVal || '';

    resetSelect('kpk_efka', !eidVal);
    resetSelect('epa_efka', true);

    if (eidVal) {
      const kad = hid('kad_efka')?.value;
      if (kad) {
        pKpk.kad        = kad;
        pKpk.eidikothta = hEid.value || eidVal;
        setEnabled('kpk_efka', true);
        tsKpk?.load('');          // άμεση φόρτωση KPK
        openAndFocus(tsKpk);
      }
    } else {
      delete pKpk.kad; delete pKpk.eidikothta;
    }
  };
  tsEid?.on('change', onEidChange);
  tsEid?.on('item_add', onEidChange);
  el('eidikothta_efka')?.addEventListener('change', (e) => onEidChange(e.target.value));

  tsEid?.on('clear', () => {
    // Αν υπάρχει ΚΑΔ, το dropdown Ειδικότητας πρέπει να παραμείνει enabled και γεμάτο
    resetSelect('kpk_efka', true);
    resetSelect('epa_efka', true);
    delete pKpk.kad; delete pKpk.eidikothta;

    // ξαναγέμισε τις ειδικότητες για τον τρέχοντα ΚΑΔ
    const kadNow = hid('kad_efka')?.value;
    if (kadNow) {
      pEid.kad = kadNow;
      setEnabled('eidikothta_efka', true);
      tsEid?.clearOptions();
      tsEid?.load('');
      openAndFocus(tsEid);
    } else {
      resetSelect('eidikothta_efka', true);
    }
  });

  // // ====================== KPK(apo) → EPA(όλες) ======================
  // const onKpkChange = (kpkVal) => {
  //   const hKpk = hid('kpk_efka'); if (hKpk) hKpk.value = kpkVal || '';

  //   resetSelect('epa_efka', !kpkVal);

  //   if (kpkVal) {
  //     setEnabled('epa_efka', true);
  //     tsEpa?.load('');            // φέρε ΟΛΕΣ τις EPA αμέσως
  //   }
  // };
  // tsKpk?.on('change', onKpkChange);
  // tsKpk?.on('item_add', onKpkChange);
  // el('kpk_efka')?.addEventListener('change', (e) => onKpkChange(e.target.value));
// ====================== KPK(apo) → EPA(όλες) ======================
const onKpkChange = (kpkVal) => {
  // Αν το αλλάξαμε προγραμματικά (π.χ. από EPA mapping), ΜΗΝ πειράξεις το EPA & ΜΗΝ κάνεις reset
  if (window.__EFKA_KPK_PROGRAMMATIC__ === true) {
    const hKpk = hid('kpk_efka'); if (hKpk) hKpk.value = kpkVal || '';
    return; // ΤΕΛΟΣ εδώ — κρατάμε ό,τι είχε το EPA
  }

  const hKpk = hid('kpk_efka'); if (hKpk) hKpk.value = kpkVal || '';

  resetSelect('epa_efka', !kpkVal);

  if (kpkVal) {
    setEnabled('epa_efka', true);
    tsEpa?.load('');            // φέρε ΟΛΕΣ τις EPA αμέσως
  }
};
tsKpk?.on('change', onKpkChange);
tsKpk?.on('item_add', onKpkChange);
el('kpk_efka')?.addEventListener('change', (e) => onKpkChange(e.target.value));

  tsKpk?.on('clear', () => {
    // Παραμένει ενεργή η επιλογή KPK (αν υπάρχει ειδικότητα), αλλά καθαρίζουμε το epa_efka
    resetSelect('epa_efka', true);

    // Ξαναγεμίζουμε τους KPK για τον τρέχοντα ΚΑΔ+Ειδικότητα ώστε να μη μείνει άδειο state
    const kadNow = hid('kad_efka')?.value;
    const eidNow = hid('eidikothta_efka')?.value;
    if (kadNow && eidNow) {
      pKpk.kad = kadNow; pKpk.eidikothta = eidNow;
      setEnabled('kpk_efka', true);
      tsKpk?.clearOptions();
      tsKpk?.load('');
      openAndFocus(tsKpk);
    } else {
      resetSelect('kpk_efka', true);
    }
  });

  // ====================== Hydration (edit-mode) ======================
  const bootKad = hid('kad_efka')?.value;
  const bootEid = hid('eidikothta_efka')?.value;
  const bootKpk = hid('kpk_efka')?.value;
  const bootEpa = hid('epa_efka')?.value;

  if (bootKad) {
    pEid.kad = bootKad; setEnabled('eidikothta_efka', true); tsEid?.load('');
  }
  if (bootKad && bootEid) {
    pKpk.kad = bootKad; pKpk.eidikothta = bootEid;
    setEnabled('kpk_efka', true); tsKpk?.load('');
  }
  if (bootKpk) { setEnabled('epa_efka', true); tsEpa?.load(''); }
  if (bootEpa) setEnabled('epa_efka', true);
})();
