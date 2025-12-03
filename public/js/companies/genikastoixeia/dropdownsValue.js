document.querySelectorAll('select.tom-dropdown[data-target-input]').forEach(sel => {
  const targetId = sel.dataset.targetInput;
  const target = document.getElementById(targetId);
  if (!target) return;

  const mode = document.body.dataset.mode || 'add';

  // Μην καθαρίζεις στο edit mode
  if (!(mode === 'edit' && target.value)) {
    // target.value = '';
  }

  let bootstrapping = true;

  // Preselect μετά το load
  sel.tomselect?.on('load', () => {
    bootstrapping = false;
    
    // Ενημέρωση μετά το load (για edit mode)
    if (mode === 'edit' && sel.tomselect) {
      const ts = sel.tomselect;
      const value = ts.getValue();
      
      if (value) {
        const item = ts.options[value];
        
        // Ενημέρωση target input
        target.value = sel.value || '';
        
        // ΝΕΟ: Ενημέρωση perigrafh_stathera αν υπάρχει
        const perigrafiInput = document.getElementById('perigrafh_stathera');
        if (perigrafiInput && item) {
          perigrafiInput.value = item.perigrafh || '';
          console.log('Updated perigrafh_stathera after load:', perigrafiInput.value);
        }
      }
    }
  });

  // Στον change
  sel.addEventListener('change', () => {
    if (sel.disabled) return;
    if (bootstrapping) return;
    
    target.value = sel.value || '';
    
    // ΝΕΟ: Ενημέρωση perigrafh_stathera
    if (sel.tomselect && sel.id === 'perigrafh') {
      const ts = sel.tomselect;
      const value = ts.getValue();
      const item = ts.options[value];
      const perigrafiInput = document.getElementById('perigrafh_stathera');
      
      if (perigrafiInput && item) {
        perigrafiInput.value = item.perigrafh || '';
        console.log('Updated perigrafh_stathera on change:', perigrafiInput.value);
      }
    }
  });
});
