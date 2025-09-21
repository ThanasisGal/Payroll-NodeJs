document.querySelectorAll('select.tom-dropdown[data-target-input]').forEach(sel => {
  const targetId = sel.dataset.targetInput;
  const target = document.getElementById(targetId);
  if (!target) return;

  const mode = document.body.dataset.mode || 'add';

  // 1) Μην καθαρίζεις αν υπάρχει ήδη τιμή (ιδίως στο edit)
  // ΠΡΙΝ: if (target) target.value = '';
  if (!(mode === 'edit' && target.value)) {
    // αν θες reset μόνο στο add:
    // if (mode === 'add') target.value = '';
  }

  let bootstrapping = true;

  // 2) Preselect μετά το load (όχι στο initialize)
  sel.tomselect?.on('load', () => {
    bootstrapping = false;
  });

  // 3) Στον change, μην γράφεις όταν είναι disabled ή στο bootstrapping
  sel.addEventListener('change', () => {
    if (sel.disabled) return;
    if (bootstrapping) return;
    target.value = sel.value || '';
  });
});
