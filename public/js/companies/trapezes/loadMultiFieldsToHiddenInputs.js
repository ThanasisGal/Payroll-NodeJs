// document.addEventListener('DOMContentLoaded', () => {
//   const selectEl = document.getElementById('perigrafh');
//   const hiddenCode = document.getElementById('kodikos_dias_stathera');
//   const hiddenDesc = document.getElementById('perigrafh_stathera');

//   function updateHiddenFromSelect() {
//     const opt = selectEl.options[selectEl.selectedIndex];
//     if (!opt) { hiddenDesc.value = ''; return; }

//     // 1) kodikos_dias: αν δεν έχει ήδη γραφτεί από το tom-dropdown, πάρε το value
//     if (!hiddenCode.value) hiddenCode.value = opt.value;

//     // 2) perigrafh: προτίμησε data-perigrafh, αλλιώς πάρε το κείμενο μετά το " - "
//     if (opt.dataset && opt.dataset.perigrafh) {
//       hiddenDesc.value = opt.dataset.perigrafh.trim();
//     } else {
//       const txt = (opt.text || '').trim();
//       const m = txt.match(/^\s*\S+\s*-\s*(.*)$/); // πχ "016 - ATTICA BANK ..." -> "ATTICA BANK ..."
//       hiddenDesc.value = (m ? m[1] : txt).trim();
//     }

//     // αν θες να ειδοποιούνται άλλοι listeners
//     hiddenCode.dispatchEvent(new Event('change'));
//     hiddenDesc.dispatchEvent(new Event('change'));
//   }

//   // όταν αλλάζει επιλογή
//   selectEl.addEventListener('change', updateHiddenFromSelect);

//   // αρχικοποίηση (π.χ. όταν γίνεται preselect ασύγχρονα)
//   // μικρή καθυστέρηση για να έχει γεμίσει το select από το tom-dropdown
//   setTimeout(updateHiddenFromSelect, 0);
// });

document.addEventListener('DOMContentLoaded', () => {
  const selectEl = document.getElementById('perigrafh');
  const hiddenCode = document.getElementById('kodikos_dias_stathera');
  const hiddenDesc = document.getElementById('perigrafh_stathera');

  if (!selectEl || !hiddenCode || !hiddenDesc) return;

  console.log('Initial values:', {
    hiddenCode: hiddenCode.value,
    hiddenDesc: hiddenDesc.value
  });

  function updateHiddenFromTomSelect() {
    const ts = selectEl.tomselect;
    if (!ts) return;

    const value = ts.getValue();
    console.log('TomSelect value:', value);

    if (!value) {
      hiddenDesc.value = '';
      return;
    }

    // Πάρε το item από τα options
    const item = ts.options[value];
    console.log('Selected item:', item);

    if (item) {
      // Ενημέρωσε ΚΑΙ τα δύο hidden inputs
      hiddenCode.value = item.kodikos || item.value || '';
      hiddenDesc.value = item.perigrafh || '';

      console.log('Updated values:', {
        hiddenCode: hiddenCode.value,
        hiddenDesc: hiddenDesc.value
      });

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
        console.log('TomSelect loaded with options:', Object.keys(ts.options).length);
        clearInterval(checkTomSelect);
        
        // Αρχική ενημέρωση
        updateHiddenFromTomSelect();
        
        // Listener για μελλοντικές αλλαγές
        ts.on('change', () => {
          console.log('TomSelect changed');
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