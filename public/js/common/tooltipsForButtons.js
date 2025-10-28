// /common/tooltipsForButtons.js
document.addEventListener("DOMContentLoaded", () => {
  // Όλα εκτός από #add-btn
  document.querySelectorAll('[data-bs-toggle="tooltip"]:not(#add-btn)').forEach((el) => {
    const maxWidth = el.getAttribute('data-tooltip-max-width');
    const tooltip = bootstrap.Tooltip.getOrCreateInstance(el); // <-- safe, όχι διπλά

    el.addEventListener('inserted.bs.tooltip', () => {
      const tipId = el.getAttribute('aria-describedby');
      const tipEl = tipId && document.getElementById(tipId);
      if (tipEl && maxWidth) {
        // είτε CSS var στο tip...
        tipEl.style.setProperty('--bs-tooltip-max-width', maxWidth);
        // ...ή (ισοδύναμα) στο inner:
        // tipEl.querySelector('.tooltip-inner')?.style.setProperty('maxWidth', maxWidth);
      }
    });

    // κρύψε στο click/blur (προαιρετικό, το κρατάς αν το θες)
    el.addEventListener('click', () => tooltip.hide());
    el.addEventListener('blur', () => tooltip.hide());
  });

  // Ειδική ρύθμιση για #add-btn
  const addButton = document.getElementById('add-btn');
  if (addButton) {
    const maxWidth = addButton.getAttribute('data-tooltip-max-width');
    const title = addButton.getAttribute('title');
    if (title) {
      const tooltip = bootstrap.Tooltip.getOrCreateInstance(addButton, {
        title,
        placement: 'bottom',
      });

      addButton.addEventListener('inserted.bs.tooltip', () => {
        const tipId = addButton.getAttribute('aria-describedby');
        const tipEl = tipId && document.getElementById(tipId);
        if (tipEl && maxWidth) {
          tipEl.style.setProperty('--bs-tooltip-max-width', maxWidth);
        }
      });

      addButton.addEventListener('click', () => tooltip.hide());
      addButton.addEventListener('blur', () => tooltip.hide());
    }
  }
});
