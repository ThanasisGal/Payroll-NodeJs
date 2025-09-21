// // /static/js/common/initTomDropdowns.js
import { initTomDropdown } from '/static/js/dropdown-item.js'; // προσαρμόσ’ το path

// Global registry για instances
window.__tomInstances = window.__tomInstances || {};

const getMode = () => (document.body.dataset.mode || 'add');
const isEdit = () => getMode() === 'edit';

function getPreselect(sel) {
  const hid = sel.dataset.preselect && document.getElementById(sel.dataset.preselect);
  const pad = parseInt(sel.dataset.padLength || '0', 10);
  let v = (hid?.value || '').toString().trim();
  if (pad > 0 && v) v = v.padStart(pad, '0');
  return { value: v, hidden: hid, pad };
}

function ensureOption(instance, val) {
  if (!val) return;
  if (!instance.options[val]) instance.addOption({ value: val, text: val });
}

function syncTargetOnChange(instance, sel, hidden, opts = {}) {
  let bootstrapping = true;

  instance.on('load', () => {
    // preselect μετά το load
    if (opts.preVal) {
      ensureOption(instance, opts.preVal);
      instance.setValue(opts.preVal, true);
    }
    bootstrapping = false;
  });

  instance.on('change', (val) => {
    if (bootstrapping) return;
    if (sel.disabled) return;
    if (hidden) hidden.value = val || '';
  });
}

export function initOneTomSelect(sel) {
  if (!sel || !sel.id) return;
  const key = `#${sel.id}`;
  if (window.__tomInstances[key]) return; // guard: δεν ξανακάνω init

  const api = sel.dataset.api;
  if (!api) return;

  // φτιάχνω το instance μέσω του helper
  const ts = initTomDropdown({
    selector    : key,
    url         : api,
    extraParams : {},
    minChars    : 0
  });
  const instance = ts || window.__tomInstances[key];
  if (!instance) return;

  const { value: preVal, hidden } = getPreselect(sel);

  // EDIT guard: δεν καθαρίζω target αν έχει ήδη τιμή
  if (hidden && isEdit() && hidden.value) {
    // τίποτα — όπως είναι
  }

  // preselect + sync
  syncTargetOnChange(instance, sel, hidden, { preVal });

  // respect native disabled
  if (sel.disabled) instance.disable();

  window.__tomInstances[key] = instance;
}

export function initAllTomSelects(scope) {
  (scope || document).querySelectorAll('select.tom-dropdown').forEach(initOneTomSelect);
}

// auto-init στη φόρτωση
document.addEventListener('DOMContentLoaded', () => initAllTomSelects());

// helper για δυναμικά tabs/sections
export function reinitTomDropdowns(containerEl) {
  initAllTomSelects(containerEl || document);
}

// προαιρετικό: καθαρό destroy αν χρειαστεί
export function destroyTomSelectById(id) {
  const key = `#${id}`;
  const inst = window.__tomInstances[key];
  if (inst) {
    inst.destroy();
    delete window.__tomInstances[key];
  }
}
