document.addEventListener('DOMContentLoaded', () => {
  const selectEl = document.getElementById('perigrafh');
  const hiddenCode = document.getElementById('kodikos_dias_stathera');
  const hiddenDesc = document.getElementById('perigrafh_stathera');

  if (!selectEl || !hiddenCode || !hiddenDesc) return;

  function updateHiddenFromTomSelect() {
    const ts = selectEl.tomselect;
    if (!ts) return;

    const value = ts.getValue();

    if (!value) {
      hiddenDesc.value = '';
      return;
    }

    // Πάρε το item από τα options
    const item = ts.options[value];

    if (item) {
      // Ενημέρωσε ΚΑΙ τα δύο hidden inputs
      hiddenCode.value = item.kodikos || item.value || '';
      hiddenDesc.value = item.perigrafh || '';

      // Dispatch events
      hiddenCode.dispatchEvent(new Event('change', { bubbles: true }));
      hiddenDesc.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Περίμενε το TomSelect να φορτώσει ΟΛΟΚΛΗΡΩΤΙΚΑ
  const maxAttempts = 100; // 5 seconds max
  let attempts = 0;
  
  const checkTomSelect = setInterval(() => {
    attempts++;
    
    if (selectEl.tomselect) {
      const ts = selectEl.tomselect;
      
      // Έλεγξε αν έχει φορτώσει τα options
      if (Object.keys(ts.options).length > 0) {
        clearInterval(checkTomSelect);
        
        // Αρχική ενημέρωση
        updateHiddenFromTomSelect();
        
        // Listener για μελλοντικές αλλαγές
        ts.on('change', () => {
          updateHiddenFromTomSelect();
        });
      }
    }
    
    if (attempts >= maxAttempts) {
      console.error('TomSelect not initialized after 5 seconds');
      clearInterval(checkTomSelect);
    }
  }, 50);
});