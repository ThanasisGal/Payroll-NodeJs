// /static/js/common/initTomDropdowns.js
import { initTomDropdown } from '../dropdown-item.js';

// Global registry για instances (ώστε να μη διπλο-αρχικοποιούνται)
window.__tomInstances = window.__tomInstances || {};

const getMode = () => document.body.dataset.mode || 'add';
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
    // Tom Select χρησιμοποιεί labelField/valueField -> δώσε label
    if (!instance.options[val]) instance.addOption({ value: val, label: val });
}

// function syncTargetOnChange(instance, sel, hidden, opts = {}) {
//     let bootstrapping = true;

//     const applyPre = () => {
//         if (opts.preVal) {
//             ensureOption(instance, opts.preVal);
//             instance.setValue(opts.preVal, true);
//         }
//         bootstrapping = false;
//     };

//     // Κάνε preselect σίγουρα: και στο ready και στο load
//     instance.on('ready', applyPre);
//     instance.on('load', applyPre);

//     instance.on('change', (val) => {
//         if (bootstrapping) return;
//         if (sel.disabled) return;
//         if (hidden) hidden.value = val || '';
//     });
// }
function syncTargetOnChange(instance, sel, hidden, opts = {}) {
    let bootstrapping = true;
    let preApplied = false;

    const applyPre = () => {
        const preVal = (opts.preVal || '').toString().trim();
        const currentVal = (instance.getValue() || '').toString().trim();

        if (preApplied) {
            bootstrapping = false;
            return;
        }

        if (!preVal) {
            bootstrapping = false;
            return;
        }

        if (currentVal === preVal) {
            preApplied = true;
            bootstrapping = false;
            return;
        }

        ensureOption(instance, preVal);
        instance.setValue(preVal, true);

        preApplied = true;
        bootstrapping = false;
    };

    // ✅ ΜΟΝΟ once στο ready
    instance.on('ready', applyPre);

    instance.on('change', (val) => {
        if (bootstrapping) return;
        if (sel.disabled) return;
        if (hidden) hidden.value = val || '';
    });
}

// ✅ ΣΩΣΤΟ (νέο)
export function initOneTomSelect(sel) {
    if (!sel || !sel.id) return;
    const key = `#${sel.id}`;

    if (window.__tomInstances[key] || sel.tomselect) {
        return;
    }

    const api = sel.dataset.api;
    if (!api) return;

    // Δημιουργία instance μέσω helper
    const ts = initTomDropdown({
        selector: key,
        url: api,
        extraParams: {},
        minChars: 0
    });

    const instance = ts || window.__tomInstances[key];
    if (!instance) return;

    // Selected tags and their overflow indicator use one presentation in updateOverflow.

    // Width and anchoring are resolved once by dropdown-item.js against the scrollport.
    if (sel.dataset.ddWide === 'true' || sel.id === 'asfalistikh_klash') {
        instance.wrapper.classList.add('dd-wide', 'dd-right');
    }
    if (sel.id === 'eidikothta_erganh' || sel.dataset.ddWidth) {
        instance.wrapper.classList.remove('dd-wide');
        instance.wrapper.classList.add('dd-right');
    }

    const { value: preVal, hidden } = getPreselect(sel);

    // Σε edit mode, αν υπάρχει ήδη τιμή στο hidden, μην την πειράξεις
    if (hidden && isEdit() && hidden.value) {
        // no-op
    }

    // Preselect + συγχρονισμός στο hidden
    syncTargetOnChange(instance, sel, hidden, { preVal });

    // Respect native disabled
    if (sel.disabled) instance.disable();

    // Αποθήκευση instance στο registry
    window.__tomInstances[key] = instance;
}

// export function initAllTomSelects(scope) {
//     (scope || document).querySelectorAll('select.tom-dropdown').forEach(initOneTomSelect);
// }

export function initAllTomSelects(scope) {
    const selects = (scope || document).querySelectorAll('select.tom-dropdown');
    selects.forEach((sel) => {
        initOneTomSelect(sel);
    });
}

// Auto-init στη φόρτωση
document.addEventListener('DOMContentLoaded', () => initAllTomSelects());

// Helper για δυναμικά sections/tabs (re-init)
export function reinitTomDropdowns(containerEl) {
    initAllTomSelects(containerEl || document);
}

// Προαιρετικό: καθαρό destroy αν χρειαστεί
export function destroyTomSelectById(id) {
    const key = `#${id}`;
    const inst = window.__tomInstances[key];
    if (inst) {
        inst.destroy();
        delete window.__tomInstances[key];
    }
}

// ✅ Export to window for non-module scripts
window.initOneTomSelect = initOneTomSelect;
window.initAllTomSelects = initAllTomSelects;
window.reinitTomDropdowns = reinitTomDropdowns;
window.destroyTomSelectById = destroyTomSelectById;
