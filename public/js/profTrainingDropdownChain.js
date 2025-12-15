// /static/js/dropdowns/profTrainingDropdownChain.js

import { initTomDropdown } from './dropdown-item.js';

(function () {
  if (window.__profTrainingDropdownChainInit) return;
  window.__profTrainingDropdownChainInit = true;

  // ---------- helpers ----------
  const el  = (id) => document.getElementById(id);
  const ts  = (id) => el(id)?.tomselect || null;
  const hid = (id) => el(`${id}_stathera`) || null;

  const setEnabled = (id, enabled) => {
    const node = el(id);
    if (!node) return;
    node.disabled = !enabled;
    const inst = node.tomselect;
    if (inst) {
      if (enabled) inst.enable(); else inst.disable();
      inst.wrapper?.classList?.toggle('disabled', !enabled);
    }
    const fs = node.closest('fieldset[disabled]');
    if (enabled && fs) fs.removeAttribute('disabled');
  };

  const resetSelect = (id, disable = true) => {
    const node = el(id);
    const inst = node?.tomselect || null;
    if (inst) {
      inst.clear();
      inst.clearOptions();
      if (disable) inst.disable();
      inst.wrapper?.classList?.toggle('disabled', !!disable);
    }
    if (node) node.disabled = !!disable;
    const h = hid(id); if (h) h.value = '';
  };

  // ---------- mutable query params ----------
  const enothtesParams = {};

  // ====================== Event Handlers ======================
  
  const onEnoChange = (enoVal) => {
    const hEno = hid('thematikh_enothta'); 
    if (hEno) hEno.value = enoVal || '';

    resetSelect('foreas_katartishs', !enoVal);

    if (enoVal) {
      setEnabled('foreas_katartishs', true);
      const tsFor = ts('foreas_katartishs');
      if (tsFor && Object.keys(tsFor.options || {}).length === 0) {
        tsFor.load('');
      }
    }
  };

  const attachEnoEvents = () => {
    const tsEno = ts('thematikh_enothta');
    if (!tsEno) return;
    
    tsEno.on('change', onEnoChange);
    tsEno.on('item_add', onEnoChange);
    
    tsEno.on('dropdown_open', () => {
      if (enothtesParams.kodikos_sysxetishs && Object.keys(tsEno.options || {}).length === 0) {
        tsEno.load('');
      }
    });
    
    tsEno.on('clear', () => {
      resetSelect('foreas_katartishs', true);
    });
    
    // Native fallback
    el('thematikh_enothta')?.addEventListener('change', (e) => onEnoChange(e.target.value));
  };

  const onPedChange = (pedVal) => {
    const hPed = hid('thematiko_pedio'); 
    if (hPed) hPed.value = pedVal || '';

    resetSelect('thematikh_enothta', !pedVal);
    resetSelect('foreas_katartishs', true);

    if (pedVal) {
      // ✅ Re-init με το νέο filter
      const nodeEno = el('thematikh_enothta');
      if (nodeEno?.tomselect) {
        nodeEno.tomselect.destroy();
      }
      
      enothtesParams.kodikos_sysxetishs = pedVal;
      
      const newTsEno = initTomDropdown({
        selector:  '#thematikh_enothta',
        url: '/api/dropdown/ergazomenoi/thematikh_enothta',
        extraParams: { kodikos_sysxetishs: pedVal },
        minChars:  0
      });
      
      setEnabled('thematikh_enothta', true);
      
      if (newTsEno) {
        newTsEno.load('');
      }
      
      // Re-attach events
      attachEnoEvents();
      
    } else {
      delete enothtesParams.kodikos_sysxetishs;
    }
  };

  const attachPedEvents = () => {
    const tsPed = ts('thematiko_pedio');
    if (!tsPed) return;
    
    tsPed.on('change', onPedChange);
    tsPed.on('item_add', onPedChange);
    
    tsPed.on('clear', () => {
      resetSelect('thematikh_enothta', true);
      resetSelect('foreas_katartishs', true);
      delete enothtesParams.kodikos_sysxetishs;
    });
    
    // Native fallback
    el('thematiko_pedio')?.addEventListener('change', (e) => onPedChange(e.target.value));
  };

  // ---------- Initial Setup ----------
  
  // Init Θεματικό Πεδίο
  initTomDropdown({
    selector: '#thematiko_pedio',
    url:  '/api/dropdown/ergazomenoi/thematiko_pedio',
    minChars: 0
  });

  // Init Θεματική Ενότητα (κενό αρχικά)
  initTomDropdown({
    selector: '#thematikh_enothta',
    url: '/api/dropdown/ergazomenoi/thematikh_enothta',
    extraParams: enothtesParams,
    minChars: 0
  });

  // Init Φορέας Κατάρτισης
  initTomDropdown({
    selector: '#foreas_katartishs',
    url: '/api/dropdown/ergazomenoi/foreis_katartishs',
    minChars: 0
  });

  // Lock children initially
  if (! hid('thematikh_enothta')?.value) resetSelect('thematikh_enothta', true);
  if (!hid('foreas_katartishs')?.value) resetSelect('foreas_katartishs', true);

  // Attach events
  attachPedEvents();
  attachEnoEvents();

  // Φορέας auto-load
  const tsFor = ts('foreas_katartishs');
  tsFor?.on('dropdown_open', () => {
    if (Object.keys(tsFor.options || {}).length === 0) {
      tsFor.load('');
    }
  });

  // ====================== Hydration (edit mode) ======================
  const bootPed = hid('thematiko_pedio')?.value;
  const bootEno = hid('thematikh_enothta')?.value;
  const bootFor = hid('foreas_katartishs')?.value;

  if (bootPed) {
    setTimeout(() => {
      const tsPed = ts('thematiko_pedio');
      if (tsPed && ! tsPed.getValue()) {
        tsPed.setValue(bootPed, true);
      }
      // Trigger change to load children
      onPedChange(bootPed);
      
      // Wait and preselect Ενότητα
      if (bootEno) {
        setTimeout(() => {
          const tsEno = ts('thematikh_enothta');
          if (tsEno && !tsEno.getValue()) {
            tsEno.setValue(bootEno, true);
          }
          onEnoChange(bootEno);
          
          // Wait and preselect Φορέα
          if (bootFor) {
            setTimeout(() => {
              const tsFor = ts('foreas_katartishs');
              if (tsFor && !tsFor.getValue()) {
                tsFor.setValue(bootFor, true);
              }
            }, 300);
          }
        }, 500);
      }
    }, 300);
  }

  console.log('✅ profTrainingDropdownChain initialized');
})();