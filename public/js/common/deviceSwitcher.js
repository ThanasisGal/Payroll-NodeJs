function applyPx(px) {
  const val = px ? px + 'px' : '100%';
  // CSS var
  document.documentElement.style.setProperty('--app-w', val);
  // inline + !important (ξε-σβήνει και ό,τι έβαλαν άλλα scripts)
  const w = document.getElementById('app-inner');
  if (w) {
    w.style.removeProperty('max-width');            // καθάρισε πιθανό inline
    w.style.setProperty('max-width', val, 'important');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.body.classList.add('sim-resp'); // ενεργοποιεί τα overrides για preview

  const KEY_PX     = 'wpsViewportWidthPx';
  const KEY_PRESET = 'wpsViewportPreset';
  const APP_ROOT   = (document.querySelector('meta[name="app-root"]')?.content || '/mainapp').trim();

  const buttons = document.querySelectorAll('.deviceSwitcher [data-device]');
  const wrapper = document.getElementById('app-inner');
  if (!wrapper || !buttons.length) return;

  const BP = { mobile: 375, tablet: 768, laptop: 1024, desktop: 1440, full: null };

  // --- βοηθητικά ---
  function applyPx(px) {
    // σβήσε Ο,ΤΙ inline maxWidth έχει μπει από άλλα scripts
    wrapper.style.maxWidth = '';
    document.documentElement.style.setProperty('--app-w', px ? px + 'px' : '100%');
  }
  function markActive(preset) {
    buttons.forEach(b => b.classList.toggle('is-active', b.getAttribute('data-device') === preset));
  }

  // --- 1) Εφαρμογή αποθηκευμένης τιμής μετά το DOM ---
  (function applyFromStorage() {
    try {
      const px = parseInt(localStorage.getItem(KEY_PX) || '', 10);
      const preset = localStorage.getItem(KEY_PRESET);
      if (Number.isFinite(px)) {
        applyPx(px);
        if (preset) markActive(preset);
      } else {
        applyPx(null);   // 100%
        markActive('full');
      }
    } catch (e) {}
  })();

  // Προστασία: αν κάποιο άλλο script πείραξε μετά, ξαναεφάρμοσε στο τέλος του frame
  setTimeout(() => {
    const px = parseInt(localStorage.getItem(KEY_PX) || '', 10);
    if (Number.isFinite(px)) applyPx(px);
  }, 0);

  // --- 2) Click -> αποθήκευση ΜΟΝΙΜΟΥ default -> redirect όλη η app ---
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-device') || 'full';
      const px = BP[preset];

      if (px == null) {
        // Full width
        localStorage.removeItem(KEY_PX);
        localStorage.setItem(KEY_PRESET, 'full');
        applyPx(null);
      } else {
        localStorage.setItem(KEY_PX, String(px));
        localStorage.setItem(KEY_PRESET, preset);
        applyPx(px);
      }

      // προαιρετικά: οπτική ένδειξη
      markActive(preset);

      // φορτώνουμε ΟΛΗ την εφαρμογή στο root
      if (location.pathname !== APP_ROOT) location.assign(APP_ROOT);
      else location.reload();
    });
  });
});

