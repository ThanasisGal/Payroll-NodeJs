// /static/js/dropdowns/epa_step1.js
// Βήμα 1: Επιλογή EPA ⇒ αντιγραφή kpk_efka_stathera → tmp_kpk_efka_stathera

(function () {
  if (window.__epaStep1Init) return;
  window.__epaStep1Init = true;

  const byIdOrName = (idOrName) =>
    document.getElementById(idOrName) ||
    document.querySelector(`input[name="${idOrName}"]`);

  const el  = (id) => document.getElementById(id);
  const ts  = (id) => el(id)?.tomselect || null;

  const getKpkHidden = () => (byIdOrName('kpk_efka_stathera')?.value ?? '');
  const setTmpBackup = (val) => {
    const tmp =
      byIdOrName('tmp_kpk_efka_stathera') ||
      byIdOrName('tmp_kpk_efka'); // εναλλακτικό id/name αν χρησιμοποιείται
    if (tmp) tmp.value = val ?? '';
  };

  const copyKpkToTmp = () => {
    const kpk = getKpkHidden();
    setTmpBackup(kpk);
  };

  const bind = () => {
    const tsEpa = ts('epa_efka');
    if (tsEpa) {
      // ΜΟΝΟ χειροκίνητη επιλογή EPA
      tsEpa.on('item_add', () => copyKpkToTmp());
    } else {
      // fallback αν για κάποιο λόγο δεν έχει αρχικοποιηθεί ακόμα ο Tom Select
      el('epa_efka')?.addEventListener('change', copyKpkToTmp);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
