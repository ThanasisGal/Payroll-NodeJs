// /static/js/common/dependentSelectToggle.js
export function bindCheckboxControlsSelect({
    checkboxId,
    selectId,
    hiddenId = null,
    invert = false // αν θέλω checked => disabled
}) {
    const chk = document.getElementById(checkboxId);
    const sel = document.getElementById(selectId);
    const hid = hiddenId ? document.getElementById(hiddenId) : null;
    if (!chk || !sel) return;

    function getTom() {
        if (sel.tomselect) return sel.tomselect;
        const key = `#${sel.id}`;
        return (window.__tomInstances && window.__tomInstances[key]) || null;
    }

    function setEnabled(enabled) {
        const inst = getTom();
        if (inst) {
            if (enabled) inst.enable();
            else { inst.clear(true); inst.disable(); }
        } else {
            sel.disabled = !enabled;
            if (!enabled) sel.value = '';
        }
        if (!enabled && hid) hid.value = '';
    }

    function apply() {
        const shouldEnable = invert ? !chk.checked : chk.checked;
        setEnabled(shouldEnable);
    }

    apply();
    chk.addEventListener('change', apply);
    document.addEventListener('tom:ready', e => {
        if (e.detail?.id === selectId) apply();
    });
}
