// /static/js/dropdowns/epa_step3.js
// Reset (σκουπιδάκι) για kpk_efka & epa_efka.
// - kpk_efka.clear  => καθάρισε tmp_epa_efka_stathera
// - epa_efka.clear  => καθάρισε epa_efka + tmp_epa_efka_stathera,
//                      βάλε kpk από tmp_kpk_efka_stathera στο hidden,
//                      φόρτωσε label και εμφάνισέ τον ΣΙΩΠΗΡΑ στο kpk_efka,
//                      και βεβαιώσου ότι το epa_efka είναι enabled.

(function () {
  if (window.__epaStep3Init) return;
  window.__epaStep3Init = true;

  // -------- helpers --------
  const byIdOrName = (idOrName) =>
    document.getElementById(idOrName) ||
    document.querySelector(`#${CSS.escape(idOrName)}, input[name="${idOrName}"]`);

  const el = (id) => document.getElementById(id);
  const ts = (id) => el(id)?.tomselect || null;

  const getVal = (idOrName) => (byIdOrName(idOrName)?.value ?? '');
  const setVal = (idOrName, val) => {
    const n = byIdOrName(idOrName);
    if (n) n.value = val ?? '';
  };
  const norm = (v) => String(v ?? '').trim();
  const enc  = (s) => encodeURIComponent(norm(s));

  // Endpoint για αναζήτηση KPK από κωδικό
  const byCodeEndpoint = '/api/dropdown/ergazomenoi/kpk_efka_by_code';

  // Σιωπηρή/κλειστή ενημέρωση του kpk_efka με συγκεκριμένο {value,label}
  const selectKpkSilently = (value, label) => {
    const inst = ts('kpk_efka');
    const node = el('kpk_efka');
    if (!inst || !node) return;

    const v   = norm(value);
    const lbl = norm(label) || v;

    // γράψε το hidden
    setVal('kpk_efka_stathera', v);

    // μη ανοίγει, μη βγάζει events όσο αλλάζουμε
    const prevIgnore      = inst.ignoreFocusOpen;
    const prevOpenOnFocus = inst.settings?.openOnFocus;
    const prevOpenFn      = inst.open?.bind?.(inst);
    const prevTrigger     = inst.trigger?.bind?.(inst);

    inst.ignoreFocusOpen = true;
    if (inst.settings) inst.settings.openOnFocus = false;
    inst.open = () => {};
    inst.trigger = () => {};

    const killOpen = () => { try { inst.close(); } catch(_){} };
    inst.on?.('dropdown_open', killOpen);

    try {
      inst.close(); node.blur(); inst.control_input?.blur?.();

      // εξασφάλισε option με σωστό label
      const existing = inst.options?.[v];
      const data = { value: v, label: lbl, text: lbl };
      if (!existing) {
        inst.addOption(data);
      } else if (inst.updateOption) {
        const curLbl = String(existing.label || existing.text || '');
        if (curLbl !== lbl) { try { inst.updateOption(v, data); } catch(_){} }
      }

      inst.setValue(v, true); // silent
      inst.close(); node.blur(); inst.control_input?.blur?.();
      inst.refreshItems(); inst.refreshOptions(false);
    } finally {
      inst.off?.('dropdown_open', killOpen);
      setTimeout(() => {
        inst.open = prevOpenFn;
        if (inst.settings) inst.settings.openOnFocus = prevOpenOnFocus;
        inst.ignoreFocusOpen = prevIgnore;
        inst.trigger = prevTrigger;
      }, 0);
    }

    node.disabled = false;
    inst.enable();
    inst.wrapper?.classList?.remove('disabled');
  };

  // Φέρε label από server και κάλεσε selectKpkSilently
  const loadAndSelectKpkByCode = async (code) => {
    const k = norm(code);
    if (!k) return;

    try {
      const url = `${byCodeEndpoint}?kodikos=${enc(k)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) { selectKpkSilently(k, k); return; }

      const data = await res.json();
      const item = data?.items?.[0];
      if (!item?.value) { selectKpkSilently(k, k); return; }

      selectKpkSilently(item.value, item.label);
    } catch {
      // σε σφάλμα δικτύου: βάλε τουλάχιστον τον κωδικό
      selectKpkSilently(k, k);
    }
  };

  // -------- wiring --------
  const bind = () => {
    // 1) kpk_efka: clear => καθάρισε tmp_epa_efka_stathera
    const kpkTs = ts('kpk_efka');
    if (kpkTs) {
      kpkTs.on('clear', () => {
        setVal('tmp_epa_efka_stathera', '');
      });
    }

    // 2) epa_efka: clear => καθάρισε epa & tmp_epa, βεβαιώσου ότι είναι enabled,
    //    έπειτα επανάφερε kpk από tmp_kpk (σιωπηρά, χωρίς να ανοίξει dropdown)
    const epaTs = ts('epa_efka');
    const epaNode = el('epa_efka');
    if (epaTs) {
      epaTs.on('clear', async () => {
        // καθάρισμα tmp/hidden της EPA
        setVal('tmp_epa_efka_stathera', '');
        setVal('epa_efka_stathera', '');

        // ΠΑΝΤΑ enabled (ό,τι κι αν είχε προηγηθεί)
        if (epaNode) epaNode.disabled = false;
        epaTs.enable();
        epaTs.wrapper?.classList?.remove('disabled');

        // Διάβασε tmp_kpk και εφάρμοσε στον kpk_efka
        const tmpKpk = norm(getVal('tmp_kpk_efka_stathera'));
        if (!tmpKpk) return;

        // Γράψε πρώτα το hidden και μετά φέρε label/βάλε σιωπηρά στο control
        setVal('kpk_efka_stathera', tmpKpk);
        await loadAndSelectKpkByCode(tmpKpk);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
