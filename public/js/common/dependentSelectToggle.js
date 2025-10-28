// /static/js/common/dependentSelectToggle.js
export function bindCheckboxControlsSelect({
    checkboxId,
    selectId,
    hiddenId = null,
    invert = false,          // αν θέλω checked => disabled
    extraFieldIds = [],      // ΝΕΟ: λίστα από IDs πεδίων (text/date κ.λπ.) που θα enable/disable μαζί με το select
    clearOnDisable = false,  // ΝΕΟ: καθάρισμα τιμών όταν γίνεται disable
}) {
    const chk = document.getElementById(checkboxId);
    const sel = document.getElementById(selectId);
    const hid = hiddenId ? document.getElementById(hiddenId) : null;
    const extraEls = extraFieldIds
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (!chk || !sel) return;

    function getTom() {
        if (sel.tomselect) return sel.tomselect;
        const key = `#${sel.id}`;
        return (window.__tomInstances && window.__tomInstances[key]) || null;
    }

    function clearFieldValue(el) {
        // flatpickr
        if (el && el._flatpickr) {
            el._flatpickr.clear();
            return;
        }

        // γενικό κείμενο/date/number κ.λπ.
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        else el.value = '';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function toggleField(el, enabled) {
        // native disable
        el.disabled = !enabled;

        // flatpickr enable/disable
        if (el._flatpickr) {
            el._flatpickr.set('clickOpens', enabled);
            el._flatpickr.input.disabled = !enabled;
        }

        if (!enabled && clearOnDisable) clearFieldValue(el);
    }

    function setEnabled(enabled) {
        // 1) TomSelect / select
        const inst = getTom();
        if (inst) {
            if (enabled) inst.enable();
        else {
            inst.clear(true); // καθάρισε επιλογή
            inst.disable();
        }
        } else {
            sel.disabled = !enabled;
            if (!enabled) sel.value = '';
        }

        // 2) hidden πεδίο (αν υπάρχει)
        if (!enabled && hid) hid.value = '';

        // 3) επιπλέον fields (text/date κ.λπ.)
        extraEls.forEach(el => toggleField(el, enabled));
    }

    function apply() {
        const shouldEnable = invert ? !chk.checked : chk.checked;
        setEnabled(shouldEnable);
    }

    // αρχική εφαρμογή
    apply();

    // events
    chk.addEventListener('change', apply);

    // όταν «σηκωθεί» το TomSelect για το συγκεκριμένο select
    document.addEventListener('tom:ready', (e) => {
        if (e.detail?.id === selectId) apply();
    });
}
