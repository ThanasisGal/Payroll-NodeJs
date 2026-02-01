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

  (function attach(){
    const ts = sel.tomselect || (window.__tomInstances && window.__tomInstances['#programma_dypa']);
    
    if (!ts) {
      console.log('[updateLinkFromTomDropdown] Waiting for TomSelect...');
      return setTimeout(attach, 100);
    }

    if (isAttached) return;
    isAttached = true;

    console.log('[updateLinkFromTomDropdown] TomSelect found!', ts);

    const update = () => {
      let url = '';
      const val = ts.getValue();
      
      console.log('[updateLinkFromTomDropdown] Update triggered');
      console.log('  - Value:', val);
      console.log('  - Is disabled:', ts.isDisabled);
      
      if (Array.isArray(val)) {
        if (val.length) {
          const opt = ts.options[val[0]];
          console.log('  - Option (array):', opt);
          url = (opt || {}).url_link || '';
        }
      } else if (val) {
        const opt = ts.options[val];
        console.log('  - Option:', opt);
        url = (opt || {}).url_link || '';
      }
      
      console.log('  - URL extracted:', url || '(empty)');
      
      if (hid) {
        hid.value = url || '';
        console.log('  - Hidden field updated:', hid.value || '(empty)');
      }
      
      gotoA.href = url || '#';
      const dis = !url;
      gotoA.classList.toggle('disabled', dis);
      gotoA.setAttribute('aria-disabled', dis ? 'true' : 'false');
      gotoA.style.pointerEvents = dis ? 'none' : '';
      gotoA.style.opacity = dis ? '0.4' : '';
      
      console.log('  - Button href:', gotoA.href);
      console.log('  - Button disabled:', dis);
    };

    // ✅ Bind όλα τα TomSelect events
    ts.on('load', update);
    ts.on('change', update);
    ts.on('item_add', update);
    ts.on('item_select', update);
    ts.on('item_remove', update);
    ts.on('clear', update);
    ts.on('initialize', update);
    ts.on('dropdown_open', update);
    ts.on('dropdown_close', update);

    // ✅ Άκουσε για checkbox changes
    if (checkbox) {
      console.log('[updateLinkFromTomDropdown] Listening to checkbox changes');
      checkbox.addEventListener('change', () => {
        console.log('[updateLinkFromTomDropdown] Checkbox changed, updating after delay...');
        setTimeout(update, 500);
      });
    }

    // ✅ Άκουσε για custom events από bindCheckboxControlsSelect
    document.addEventListener('tom:enabled', (e) => {
      if (e.detail?.id === 'programma_dypa') {
        console.log('[updateLinkFromTomDropdown] tom:enabled event received');
        setTimeout(update, 300);
      }
    });

    document.addEventListener('tom:disabled', (e) => {
      if (e.detail?.id === 'programma_dypa') {
        console.log('[updateLinkFromTomDropdown] tom:disabled event received');
        update();
      }
    });

    // ✅ Immediate update
    update();

    // ✅ Delayed updates (cascading)
    setTimeout(() => {
      console.log('[updateLinkFromTomDropdown] Delayed update (500ms)');
      update();
    }, 500);

    setTimeout(() => {
      console.log('[updateLinkFromTomDropdown] Delayed update (1000ms)');
      update();
    }, 1000);

    setTimeout(() => {
      console.log('[updateLinkFromTomDropdown] Final delayed update (2000ms)');
      update();
    }, 2000);

    console.log('[updateLinkFromTomDropdown] Successfully attached!');
  })();
});