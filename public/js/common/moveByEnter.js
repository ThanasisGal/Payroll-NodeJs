
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', onEnter, true); // capture
});

function onEnter(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const form = e.target.closest('form');
  if (!form) return;
  if (e.target.matches('textarea, .use-default-enter')) return;

  // --- Tom Select χειρισμός ---
  const tsWrapper = e.target.closest('.ts-wrapper');
  if (tsWrapper) {
    const select = tsWrapper.querySelector('select.tom-dropdown');
    const ts = select && select.tomselect;

    if (ts) {
      // Αν είναι ανοιχτό με query/highlight → άστο να κάνει επιλογή
      const open = ts.isOpen === true || ts.dropdown?.classList?.contains('is-open');
      const hasQuery = (ts.control_input?.value || '').trim().length > 0;
      const hasHighlight = !!ts.activeOption;
      if (open && (hasQuery || hasHighlight)) return;

      // Κλειστό (ή ανοιχτό αλλά άδειο) → πήγαινε επόμενο
      e.preventDefault();
      e.stopImmediatePropagation();
      try { ts.close(); } catch (_) {}
      moveFocusToNext(form, tsWrapper);
      return;
    }
  }

  // Όλα τα άλλα πεδία
  e.preventDefault();
  e.stopImmediatePropagation();
  moveFocusToNext(form, e.target);
}

function moveFocusToNext(form, fromEl) {
  const selector = [
    // αποκλείουμε type=hidden/disabled/tabindex=-1/[hidden]
    'input:not([type="hidden"]):not(:disabled):not([tabindex="-1"]):not([hidden])',
    'select:not(:disabled):not([tabindex="-1"]):not([hidden])',
    'textarea:not(:disabled):not([tabindex="-1"]):not([hidden])',
    'button:not(:disabled):not([tabindex="-1"]):not([hidden])',
    // Tom Select wrapper (θα φιλτραριστεί ξανά αν είναι disabled)
    '.ts-wrapper:not([hidden])'
  ].join(',');

  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    return true;
  };

  const list = Array.from(form.querySelectorAll(selector)).filter(isVisible);

  // Αν ο τρέχων είναι μέσα σε ts-wrapper, θεωρούμε τρέχον τον wrapper
  const current = fromEl.closest?.('.ts-wrapper') || fromEl;
  let i = list.findIndex(el => el === current || el.contains?.(current));
  if (i < 0) i = 0;

  // βρες το πρώτο πραγματικά focusable επόμενο
  let next = null;
  for (let k = 1; k <= list.length; k++) {
    const cand = list[(i + k) % list.length];
    if (isFocusable(cand)) { next = cand; break; }
  }
  if (!next) return;

  focusNode(form, next);
}

function isTomSelectDisabled(wrapper) {
  if (!wrapper || !wrapper.classList?.contains('ts-wrapper')) return false;
  // disabled μέσω API ή CSS κλάσης
  if (wrapper.classList.contains('ts-disabled') || wrapper.classList.contains('disabled')) return true;
  if (wrapper.getAttribute('aria-disabled') === 'true') return true;
  // disabled στο underlying select ή στο control input
  if (wrapper.querySelector('select.tom-dropdown:disabled')) return true;
  if (wrapper.querySelector('.ts-control input:disabled, .ts-input input:disabled')) return true;
  return false;
}

function isFocusable(el) {
  // 1) disabled / hidden / tabindex=-1 / type=hidden
  if (el.matches?.(':disabled')) return false;
  if (el.hasAttribute?.('hidden')) return false;
  if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
  const tb = el.getAttribute?.('tabindex');
  if (tb !== null && String(tb).trim() === '-1') return false;

  // 2) ορατότητα
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  if (el.offsetParent === null && cs.position !== 'fixed') return false;

  // 3) ειδική περίπτωση Tom Select
  if (el.classList?.contains('ts-wrapper') && isTomSelectDisabled(el)) return false;

  return true;
}

function focusNode(form, el) {
  // Αν είναι Tom Select αλλά disabled → πήγαινε στο επόμενο
  if (el.classList?.contains('ts-wrapper') && isTomSelectDisabled(el)) {
    moveFocusToNext(form, el);
    return;
  }

  // Αν είναι ενεργό Tom Select → focus στο instance
  if (el.classList?.contains('ts-wrapper')) {
    const sel = el.querySelector('select.tom-dropdown');
    const ts = sel?.tomselect;
    if (ts) { ts.focus(); return; }
    const inp = el.querySelector('.ts-control input, .ts-input input');
    if (inp) { inp.focus(); return; }
  }

  if (el.tagName === 'SELECT' && el.classList.contains('tom-dropdown') && el.tomselect) {
    el.tomselect.focus();
    return;
  }

  el.focus();
}
