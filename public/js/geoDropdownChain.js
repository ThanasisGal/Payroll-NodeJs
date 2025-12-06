// /static/js/dropdowns/geoDropdownChain.js
// Περιφέρεια → Νομός → Δήμος → Πόλη
// - forced re-init ώστε να περάσουν ΣΙΓΟΥΡΑ τα extraParams
// - enable/disable native + TomSelect
// - auto-load όταν ανοίγει το dropdown αν υπάρχουν φίλτρα και δεν υπάρχουν options
// - συνεργάζεται με *_stathera (data-target-input / data-preselect)

import { initTomDropdown } from './dropdown-item.js';

(function () {
  if (window.__geoDropdownChainInit) return;
  window.__geoDropdownChainInit = true;

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
      inst.clear();           // καθάρισε επιλογή
      inst.clearOptions();    // καθάρισε κατάλογο
      if (disable) inst.disable();
      inst.wrapper?.classList?.toggle('disabled', !!disable);
    }
    if (node) node.disabled = !!disable;
    const h = hid(id); if (h) h.value = '';
  };

  const forceInit = (id, url, extraParams) => {
    const node = el(id);
    if (!node) return null;
    if (node.tomselect) node.tomselect.destroy();
    return initTomDropdown({
      selector: `#${id}`,
      url,
      extraParams,
      minChars: 0
    });
  };

  // ---------- mutable query params ----------
  const nomosParams = {}; // ?perifereia=XX
  const dhmosParams = {}; // ?nomos=XXXX
  const polhParams  = {}; // ?dhmos=XXXX

  // ---------- forced init ----------
  forceInit('perifereia', '/api/dropdown/ergazomenoi/perifereia');
  forceInit('nomos',      '/api/dropdown/ergazomenoi/nomos', nomosParams);
  forceInit('dhmos',      '/api/dropdown/ergazomenoi/dhmos', dhmosParams);
  forceInit('polh',       '/api/dropdown/ergazomenoi/polh',  polhParams);

  const tsPer = ts('perifereia');
  const tsNom = ts('nomos');
  const tsDhm = ts('dhmos');
  const tsPol = ts('polh');

  // κλείδωσε παιδιά αν δεν υπάρχει preselect
  if (!hid('nomos')?.value) resetSelect('nomos', true);
  if (!hid('dhmos')?.value) resetSelect('dhmos', true);
  if (!hid('polh')?.value)  resetSelect('polh',  true);

  // ====================== Περιφέρεια → Νομός ======================
  const onPerChange = (perVal) => {
    const hPer = hid('perifereia'); if (hPer) hPer.value = perVal || '';

    resetSelect('nomos', !perVal);
    resetSelect('dhmos', true);
    resetSelect('polh',  true);

    if (perVal) {
      nomosParams.perifereia = hPer?.value || perVal; // π.χ. "07"
      setEnabled('nomos', true);
      tsNom?.load(''); // φέρε νομούς χωρίς να απαιτείται πληκτρολόγηση
    } else {
      delete nomosParams.perifereia;
    }
  };
  tsPer?.on('change', onPerChange);
  tsPer?.on('item_add', onPerChange);
  el('perifereia')?.addEventListener('change', (e) => onPerChange(e.target.value));

  // αν ανοίξει το Νομός και δεν έχει options αλλά υπάρχει φίλτρο → φόρτωσε τώρα
  tsNom?.on('dropdown_open', () => {
    if (nomosParams.perifereia && Object.keys(tsNom.options || {}).length === 0) {
      tsNom.load('');
    }
  });

  tsPer?.on('clear', () => {
    resetSelect('nomos', true);
    resetSelect('dhmos', true);
    resetSelect('polh',  true);
    delete nomosParams.perifereia;
  });

  // ====================== Νομός → Δήμος ======================
  const onNomChange = (nomVal) => {
    const hNom = hid('nomos'); if (hNom) hNom.value = nomVal || '';

    resetSelect('dhmos', !nomVal);
    resetSelect('polh',  true);

    if (nomVal) {
      dhmosParams.nomos = hNom?.value || nomVal; // π.χ. "0701"
      setEnabled('dhmos', true);
      tsDhm?.load(''); // φέρε δήμους του νομού
    } else {
      delete dhmosParams.nomos;
    }
  };
  tsNom?.on('change', onNomChange);
  tsNom?.on('item_add', onNomChange);
  el('nomos')?.addEventListener('change', (e) => onNomChange(e.target.value));

  // αν ανοίξει το Δήμος και δεν έχει options αλλά υπάρχει φίλτρο → φόρτωσε τώρα
  tsDhm?.on('dropdown_open', () => {
    if (dhmosParams.nomos && Object.keys(tsDhm.options || {}).length === 0) {
      tsDhm.load('');
    }
  });

  tsNom?.on('clear', () => {
    resetSelect('dhmos', true);
    resetSelect('polh',  true);
    delete dhmosParams.nomos;
  });

  // ====================== Δήμος → Πόλη ======================
  const onDhmChange = (dhmVal) => {
    const hDhm = hid('dhmos'); if (hDhm) hDhm.value = dhmVal || '';
    resetSelect('polh', !dhmVal);

    if (dhmVal) {
      polhParams.dhmos = hDhm?.value || dhmVal; // π.χ. "070101"
      setEnabled('polh', true);
      tsPol?.load(''); // φέρε πόλεις του δήμου
    } else {
      delete polhParams.dhmos;
    }
  };
  tsDhm?.on('change', onDhmChange);
  tsDhm?.on('item_add', onDhmChange);
  el('dhmos')?.addEventListener('change', (e) => onDhmChange(e.target.value));

  // αν ανοίξει η Πόλη και δεν έχει options αλλά υπάρχει φίλτρο → φόρτωσε τώρα
  tsPol?.on('dropdown_open', () => {
    if (polhParams.dhmos && Object.keys(tsPol.options || {}).length === 0) {
      tsPol.load('');
    }
  });

  tsDhm?.on('clear', () => {
    resetSelect('polh', true);
    delete polhParams.dhmos;
  });

  // ====================== Hydration (edit mode) ======================
  const bootPer = hid('perifereia')?.value;
  const bootNom = hid('nomos')?.value;
  const bootDhm = hid('dhmos')?.value;

  if (bootPer) { nomosParams.perifereia = bootPer; setEnabled('nomos', true); tsNom?.load(''); }
  if (bootNom) { dhmosParams.nomos     = bootNom; setEnabled('dhmos', true); tsDhm?.load(''); }
  if (bootDhm) { polhParams.dhmos      = bootDhm; setEnabled('polh',  true); tsPol?.load(''); }
})();
