// public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js

document.addEventListener('DOMContentLoaded', function () {
  const sel   = document.getElementById('programma_dypa');
  const gotoA = document.getElementById('gotoProgrammaDypa');
  const hid   = document.getElementById('link_programma_dypa_stathera');
  
  if (!sel || !gotoA) {
    console.warn('[updateLinkFromTomDropdown] Elements not found');
    return;
  }

  (function attach(){
    const ts = sel.tomselect || (window.__tomInstances && window.__tomInstances['#programma_dypa']);
    
    if (!ts) {
      console.log('[updateLinkFromTomDropdown] Waiting for TomSelect...');
      return setTimeout(attach, 100); // ✅ Αύξησε από 50 σε 100
    }

    console.log('[updateLinkFromTomDropdown] TomSelect found!', ts);

    const update = () => {
      let url = '';
      const val = ts.getValue();
      
      console.log('[updateLinkFromTomDropdown] Update triggered, value:', val);
      
      if (Array.isArray(val)) {
        if (val.length) url = (ts.options[val[0]] || {}).url_link || '';
      } else if (val) {
        url = (ts.options[val] || {}).url_link || '';
      }
      
      console.log('[updateLinkFromTomDropdown] URL extracted:', url);
      
      if (hid) {
        hid.value = url || '';
        console.log('[updateLinkFromTomDropdown] Hidden field updated:', hid.value);
      }
      
      gotoA.href = url || '#';
      const dis = !url;
      gotoA.classList.toggle('disabled', dis);
      gotoA.setAttribute('aria-disabled', dis ? 'true' : 'false');
      gotoA.style.pointerEvents = dis ? 'none' : '';
      gotoA.style.opacity = dis ? '0.4' : '';
    };

    ts.on('load', update);
    ts.on('change', update);
    ts.on('item_add', update);
    ts.on('clear', update);
    
    // ✅ ΚΡΙΣΙΜΟ: Trigger αμέσως αν υπάρχει value
    update();
    
    console.log('[updateLinkFromTomDropdown] Successfully attached!');
  })();
});