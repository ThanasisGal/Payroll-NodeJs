document.addEventListener('click', function (e) {
    const clearBtn = e.target.closest('.clearButton');
    if (!clearBtn) return;

    const section = clearBtn.closest('section');
    const form = clearBtn.closest('form');
    const root = section || form || document;

    // ---- helper: αναγνώριση id fields ----
    const ID_PATTERNS = [
        /^_?id$/i,                                 // id, _id
        /(^|[_-])(company|site|branch|ergazomenoi|team|user|record|entry|row|parent|child|owner)(_)?id$/i, // companyId, company_id, etc.
        /(^|[_-])(id)$/i                            // κάτι-Id/κάτι_id
    ];

    function isIdentifierField(el) {
        const nm = (el.name || '').trim();
        const i  = (el.id || '').trim();
        // Αν έχει μαρκαριστεί ρητά να διατηρηθεί, το κρατάμε
        if (el.dataset.preserve === 'true' || el.classList.contains('preserve')) return true;

        // Αν ταιριάζει κάποιο pattern σε name ή id, το διατηρούμε
        return ID_PATTERNS.some(rx => rx.test(nm) || rx.test(i));
    }

    const fields = root.querySelectorAll('input, textarea, select');

    fields.forEach(el => {
        // ==== ΕΞΑΙΡΕΣΕΙΣ ΠΟΥ ΔΕΝ ΚΑΘΑΡΙΖΟΥΜΕ ====
        if (el.name === '_csrf') return;          // ποτέ το CSRF
        if (isIdentifierField(el)) return;        // ποτέ τα IDs

        // αποθήκευση αρχικής κατάστασης
        const wasDisabled = el.disabled;
        const wasReadOnly = el.readOnly;

        // προσωρινή άρση περιορισμών
        if (wasDisabled) el.disabled = false;
        if (wasReadOnly) el.readOnly = false;

        // ---- ΚΑΘΑΡΙΣΜΟΣ ΑΝΑ ΤΥΠΟ ----
        if (el.tagName === 'SELECT') {
        const hasEmpty = Array.from(el.options || []).some(o => o.value === '');
        if (hasEmpty) { el.value = ''; } else { el.selectedIndex = -1; el.value = ''; }
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // καθάρισε και το target hidden αν ΥΠΑΡΧΕΙ και ΔΕΝ είναι identifier
        const targetId = el.getAttribute('data-target-input');
        if (targetId) {
            const hidden = root.querySelector('#' + CSS.escape(targetId));
            if (hidden && !isIdentifierField(hidden)) {
                hidden.value = '';
                hidden.dispatchEvent(new Event('input', { bubbles: true }));
                hidden.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // μηδενίζει την προεπιλογή (αν θέλω)
        if (el.hasAttribute('data-preselect')) el.setAttribute('data-preselect', '');

        // plugins
        if (el.tomselect) { try { el.tomselect.clear(true); } catch {} }

        } else if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
            el.dispatchEvent(new Event('change', { bubbles: true }));

        } else if (el.type === 'file') {
            el.value = '';

        } else if (
            el.type === 'date' ||
            el.type === 'datetime-local' ||
            el.type === 'month' ||
            el.type === 'time'
        ) {
            el.value = '';
            if (el._flatpickr) { try { el._flatpickr.clear(); } catch {} }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

        } else {
            // περιλαμβάνει HIDDEN (εκτός από IDs/CSRF που ήδη εξαιρέσαμε)
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        el.classList.remove('is-valid', 'is-invalid');

        // επαναφορά κατάστασης
        if (wasDisabled) el.disabled = true;
        if (wasReadOnly) el.readOnly = true;
    });

    // contenteditable
    root.querySelectorAll('[contenteditable="true"]').forEach(ed => { ed.innerHTML = ''; });
});
