// public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js

document.addEventListener('DOMContentLoaded', function () {
  const sel      = document.getElementById('programma_dypa');
  const gotoA    = document.getElementById('gotoProgrammaDypa');
  const hid      = document.getElementById('link_programma_dypa_stathera');
  const checkbox = document.getElementById('topothethsh_me_programma');
  
  if (!sel || !gotoA) {
    console.warn('[updateLinkFromTomDropdown] Elements not found');
    return;
  }

  let isAttached = false;

  function attach() {
    const ts = sel.tomselect || (window.__tomInstances && window.__tomInstances['#programma_dypa']);
    
    if (!ts) {
      return setTimeout(attach, 100);
    }

    if (isAttached) return;
    isAttached = true;


    const update = () => {
      let url = '';
      const val = ts.getValue();
      
      if (Array.isArray(val)) {
        if (val.length) url = (ts.options[val[0]] || {}).url_link || '';
      } else if (val) {
        url = (ts.options[val] || {}).url_link || '';
      }
      
      if (hid) hid.value = url || '';
      
      gotoA.href = url || '#';
      const dis = !url;
      gotoA.classList.toggle('disabled', dis);
      gotoA.setAttribute('aria-disabled', dis ? 'true' : 'false');
      gotoA.style.pointerEvents = dis ? 'none' : '';
      gotoA.style.opacity = dis ? '0.4' : '';
    };

    // ✅ Bind TomSelect events
    ts.on('load', update);           // Όταν φορτώνουν options από API
    ts.on('change', update);         // Όταν αλλάζει η επιλογή
    ts.on('item_add', update);       // Όταν προστίθεται item
    ts.on('item_remove', update);    // Όταν αφαιρείται item
    ts.on('clear', update);          // Όταν καθαρίζει

    // ✅ Άκουσε για checkbox changes (αν disable/enable το dropdown)
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        // Μικρό delay για να προλάβει το bindCheckboxControlsSelect να τρέξει
        setTimeout(update, 200);
      });
    }

    // ✅ ΜΟΝΟ ΕΝΑ delayed update (για initial state)
    setTimeout(update, 300);

  }

  attach();
});