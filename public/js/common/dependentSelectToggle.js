// // /static/js/common/dependentSelectToggle.js
// export function bindCheckboxControlsSelect({
//     checkboxId,
//     selectId,
//     hiddenId = null,
//     invert = false,          // αν θέλω checked => disabled
//     extraFieldIds = [],      // ΝΕΟ: λίστα από IDs πεδίων (text/date κ.λπ.) που θα enable/disable μαζί με το select
//     clearOnDisable = false,  // ΝΕΟ: καθάρισμα τιμών όταν γίνεται disable
// }) {
//     const chk = document.getElementById(checkboxId);
//     const sel = document.getElementById(selectId);
//     const hid = hiddenId ? document.getElementById(hiddenId) : null;
//     const extraEls = extraFieldIds
//         .map(id => document.getElementById(id))
//         .filter(Boolean);

//     if (!chk || !sel) return;

//     function getTom() {
//         if (sel.tomselect) return sel.tomselect;
//         const key = `#${sel.id}`;
//         return (window.__tomInstances && window.__tomInstances[key]) || null;
//     }

//     function clearFieldValue(el) {
//         // flatpickr
//         if (el && el._flatpickr) {
//             el._flatpickr.clear();
//             return;
//         }

//         // γενικό κείμενο/date/number κ.λπ.
//         if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
//         else el.value = '';
//         el.dispatchEvent(new Event('change', { bubbles: true }));
//     }

//     function toggleField(el, enabled) {
//         // native disable
//         el.disabled = !enabled;

//         // flatpickr enable/disable
//         if (el._flatpickr) {
//             el._flatpickr.set('clickOpens', enabled);
//             el._flatpickr.input.disabled = !enabled;
//         }

//         if (!enabled && clearOnDisable) clearFieldValue(el);
//     }

//     function setEnabled(enabled) {
//         // 1) TomSelect / select
//         const inst = getTom();
//         if (inst) {
//             if (enabled) inst.enable();
//         else {
//             inst.clear(true); // καθάρισε επιλογή
//             inst.disable();
//         }
//         } else {
//             sel.disabled = !enabled;
//             if (!enabled) sel.value = '';
//         }

//         // 2) hidden πεδίο (αν υπάρχει)
//         if (!enabled && hid) hid.value = '';

//         // 3) επιπλέον fields (text/date κ.λπ.)
//         extraEls.forEach(el => toggleField(el, enabled));
//     }

//     function apply() {
//         const shouldEnable = invert ? !chk.checked : chk.checked;
//         setEnabled(shouldEnable);
//     }

//     // αρχική εφαρμογή
//     apply();

//     // events
//     chk.addEventListener('change', apply);

//     // όταν «σηκωθεί» το TomSelect για το συγκεκριμένο select
//     document.addEventListener('tom:ready', (e) => {
//         if (e.detail?.id === selectId) apply();
//     });
// }



// /static/js/common/dependentSelectToggle.js

/**
 * Bind checkbox που ελέγχει enable/disable ενός select + cascading children
 * @param {string} checkboxId - ID του checkbox
 * @param {string} selectId - ID του primary select
 * @param {string} hiddenId - ID του hidden field (optional)
 * @param {boolean} invert - Αντίστροφη λογική (checked = disabled)
 * @param {Array<string>} extraFieldIds - IDs άλλων πεδίων (text/date κλπ)
 * @param {Array<string>} cascadingSelectIds - IDs dependent selects που θα κλειδώνουν μαζί
 * @param {boolean} clearOnDisable - Καθάρισε τιμές όταν disable
 */
export function bindCheckboxControlsSelect({
    checkboxId,
    selectId,
    hiddenId = null,
    invert = false,
    extraFieldIds = [],
    cascadingSelectIds = [],  // ✅ ΝΕΟ:  Dependent selects
    clearOnDisable = false,
}) {
    const chk = document.getElementById(checkboxId);
    const sel = document. getElementById(selectId);
    const hid = hiddenId ? document.getElementById(hiddenId) : null;
    
    const extraEls = extraFieldIds
        .map(id => document.getElementById(id))
        .filter(Boolean);
    
    // ✅ ΝΕΟ:  Cascading selects
    const cascadingEls = cascadingSelectIds
        .map(id => document. getElementById(id))
        .filter(Boolean);

    if (!chk || !sel) return;

    // ==================== Helpers ====================

    function getTom(element) {
        if (!element) return null;
        if (element.tomselect) return element.tomselect;
        const key = `#${element.id}`;
        return (window.__tomInstances && window.__tomInstances[key]) || null;
    }

    function clearFieldValue(el) {
        if (!el) return;
        
        // flatpickr
        if (el._flatpickr) {
            el._flatpickr.clear();
            return;
        }

        // TomSelect
        const inst = getTom(el);
        if (inst) {
            inst.clear();
            return;
        }

        // γενικό κείμενο/date/number κ.λπ.
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
        } else {
            el.value = '';
        }
        
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function toggleField(el, enabled) {
        if (!el) return;
        
        // native disable
        el.disabled = !enabled;

        // TomSelect
        const inst = getTom(el);
        if (inst) {
            if (enabled) {
                inst. enable();
            } else {
                if (clearOnDisable) inst.clear();
                inst.disable();
            }
            inst.wrapper?. classList?. toggle('disabled', !enabled);
        }

        // flatpickr enable/disable
        if (el._flatpickr) {
            el._flatpickr.set('clickOpens', enabled);
            el._flatpickr.input.disabled = !enabled;
        }

        // Clear value if disabled
        if (!enabled && clearOnDisable) {
            clearFieldValue(el);
        }
    }

    function setEnabled(enabled) {
        // 1) Primary TomSelect / select
        const inst = getTom(sel);
        if (inst) {
            if (enabled) {
                inst. enable();
            } else {
                if (clearOnDisable) inst.clear();
                inst.disable();
            }
            inst.wrapper?.classList?.toggle('disabled', !enabled);
        } else {
            sel.disabled = !enabled;
            if (! enabled && clearOnDisable) sel.value = '';
        }

        // 2) hidden πεδίο (αν υπάρχει)
        if (!enabled && hid && clearOnDisable) {
            hid.value = '';
        }

        // 3) επιπλέον fields (text/date κ.λπ.)
        extraEls.forEach(el => toggleField(el, enabled));

        // ✅ 4) ΝΕΟ:  Cascading selects (dependent dropdowns)
        cascadingEls.forEach(cascadeEl => {
            toggleField(cascadeEl, enabled);
            
            // ✅ Αν το cascading select είναι disabled, κλείδωσε και το hidden του
            const cascadeHid = document.getElementById(`${cascadeEl.id}_stathera`);
            if (cascadeHid && !enabled && clearOnDisable) {
                cascadeHid.value = '';
            }
        });
    }

    function apply() {
        const shouldEnable = invert ? !chk.checked :  chk.checked;
        setEnabled(shouldEnable);
    }

    // ==================== Event Bindings ====================

    // αρχική εφαρμογή
    apply();

    // checkbox change
    chk.addEventListener('change', apply);

    // όταν «σηκωθεί» το TomSelect για το primary select
    document.addEventListener('tom: ready', (e) => {
        if (e.detail?. id === selectId) {
            apply();
        }
        
        // ✅ ΝΕΟ:  Apply και για cascading selects
        if (cascadingSelectIds.includes(e.detail?.id)) {
            apply();
        }
    });

    // console.log(`✅ bindCheckboxControlsSelect: ${checkboxId} → ${selectId}${cascadingSelectIds.length ? ` + ${cascadingSelectIds.length} cascading` : ''}`);
}