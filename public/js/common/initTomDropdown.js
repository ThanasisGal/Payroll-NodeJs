// /static/js/common/initTomDropdowns.js
import { initTomDropdown, attachInlineSummary } from '../dropdown-item.js';

// Global registry για instances (ώστε να μη διπλο-αρχικοποιούνται)
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
    // Tom Select χρησιμοποιεί labelField/valueField -> δώσε label
    if (!instance.options[val]) instance.addOption({ value: val, label: val });
}

function syncTargetOnChange(instance, sel, hidden, opts = {}) {
    let bootstrapping = true;

    const applyPre = () => {
        if (opts.preVal) {
            ensureOption(instance, opts.preVal);
            instance.setValue(opts.preVal, true);
        }
        bootstrapping = false;
    };

    // Κάνε preselect σίγουρα: και στο ready και στο load
    instance.on('ready', applyPre);
    instance.on('load', applyPre);

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
        selector    : key,
        url         : api,
        extraParams : {},
        minChars    : 0
    });

    const instance = ts || window.__tomInstances[key];
    if (!instance) return;

    attachInlineSummary(instance, sel);
    
    // Μόνο για την Ασφαλιστική Κλάση: φαρδύ dropdown & δεξιά ευθυγράμμιση (expand left)
    // ⬇️ ΠΡΟΣΟΧΗ: εδώ ΔΕΝ συμπεριλαμβάνεται πλέον το eidikothta_erganh
    if (sel.dataset.ddWide === 'true' || sel.id === 'asfalistikh_klash') {
        instance.wrapper.classList.add('dd-wide', 'dd-right');

        instance.on('dropdown_open', () => {
            const dd   = instance.dropdown;
            const wrap = instance.wrapper;
            if (!dd || !wrap) return;

            const MIN_W    = 820; // προσαρμόσ’ το στα columns σου
            const wrapRect = wrap.getBoundingClientRect();
            const wrapW    = wrapRect.width;

            // Μετράμε-ορίζουμε πλάτος και μετακινούμε με transform ώστε να ευθυγραμμιστεί δεξιά
            requestAnimationFrame(() => {
                dd.style.width = 'auto';                     // αφήνουμε να «απλωθεί» για μέτρηση
                const contentW = Math.max(dd.scrollWidth, MIN_W);
                const ddW      = Math.max(MIN_W, contentW);
                dd.style.width = ddW + 'px';

                // shift = πλάτος wrapper - πλάτος dropdown => αρνητικό => «άπλωμα» προς τα αριστερά
                const shift = wrapW - ddW;
                dd.style.transform = `translateX(${shift}px)`;
            });
        });

        // καθάρισε το transform όταν κλείνει
        instance.on('dropdown_close', () => {
            const dd = instance.dropdown;
            if (dd) dd.style.transform = '';
        });
    }

    // --- ΜΟΝΟ για Ειδικότητα ΕΡΓΑΝΗ: σταθερό 40vw, δεξιά αγκύρωση + observer ---
    if (sel.id === 'eidikothta_erganh' || sel.dataset.ddWidth) {
        const W = sel.dataset.ddWidth || '40vw';

        // Μην αφήσεις το generic wide εδώ
        instance.wrapper.classList.remove('dd-wide');
        instance.wrapper.classList.add('dd-right'); // ανοίγει προς τα αριστερά (κολλάει δεξιά)

        let obs = null;

        const pinWidth = () => {
            const dd = instance.dropdown;
            if (!dd) return;

            // δεξιά αγκύρωση + χωρίς μετατόπιση
            dd.style.setProperty('left', 'auto', 'important');
            dd.style.setProperty('right', '0', 'important');
            dd.style.setProperty('transform', 'none', 'important');

            // επιβολή πλάτους (ό,τι κι αν είναι το default CSS)
            dd.style.setProperty('width',     W, 'important');
            dd.style.setProperty('min-width', W, 'important');
            dd.style.setProperty('max-width', 'none', 'important');
            dd.style.setProperty('box-sizing','border-box','important');

            // το search input full width
            const inp = dd.querySelector('.dropdown-input');
            if (inp) {
            inp.style.setProperty('width', '100%', 'important');
            inp.style.setProperty('box-sizing', 'border-box', 'important');
            }
        };

        const startObserver = () => {
            const dd = instance.dropdown;
            if (!dd || obs) return;

            // Αν ο Tom Select ξαναγράψει style/κλάσεις, ξανά-εφάρμοσέ τα
            obs = new MutationObserver(() => pinWidth());
            obs.observe(dd, { attributes: true, attributeFilter: ['style', 'class'] });

            // 2-3 ράφ για την περίπτωση που αλλάζει μετά το paint
            requestAnimationFrame(() => {
            pinWidth();
            requestAnimationFrame(pinWidth);
            });
        };

        const stopObserver = () => {
            if (obs) { obs.disconnect(); obs = null; }
        };

        instance.on('dropdown_open',  () => { pinWidth(); startObserver(); });
        instance.on('load',           pinWidth);
        instance.on('type',           pinWidth);
        instance.on('refresh_options',pinWidth);
        instance.on('dropdown_close', stopObserver);
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
    selects.forEach(sel => {
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