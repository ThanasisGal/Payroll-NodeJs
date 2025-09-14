function adjustFontSizeToFit(elementId, maxRemWidth, opts = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const {
    startRem = 0.8,   // όπως είχες: 0.8rem
    minPx    = 8,     // κατώτατο όριο
    stepPx   = 1      // βηματάκι μείωσης
  } = opts;

  const maxWidth = Math.round(maxRemWidth * 16);      // rem → px
  let currentPx  = Math.round(startRem * 16);         // αρχικό σε px
  if (currentPx < minPx) currentPx = minPx;          // safety

  // helper για set/remove της κλάσης fs-XX
  let appliedPx = null;
  const apply = (px) => {
    if (appliedPx != null) el.classList.remove(`fs-${appliedPx}`);
    appliedPx = px;
    el.classList.add(`fs-${px}`);
  };

  // αρχική εφαρμογή
  apply(currentPx);

  // μειώνουμε μέχρι να «κάτσει» στο διαθέσιμο πλάτος ή να πιάσουμε το min
  while (el.scrollWidth > maxWidth && currentPx > minPx) {
    currentPx -= stepPx;
    apply(currentPx);
  }
}
