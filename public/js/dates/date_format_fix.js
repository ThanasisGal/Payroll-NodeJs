document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="date"]').forEach(function (original) {
        // --- Δημιουργία text input ---
        const text = document.createElement('input');
        text.type = 'text';
        text.placeholder = 'dd/mm/yyyy';
        text.maxLength = 10;
        text.className = original.className;
        text.setAttribute('autocomplete', 'off');

        if (original.id) {
            text.id = original.id;
            original.id = original.id + '__raw';
        }

        // ✅ Δημιουργία clearable-wrapper (ίδιο με clearableInputs.js)
        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.textContent = '×';
        btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '-1');
        btn.tabIndex = -1;

        // Εισάγουμε wrapper πριν το original
        original.parentNode.insertBefore(wrapper, original);
        wrapper.appendChild(text);
        wrapper.appendChild(btn);
        wrapper.appendChild(original); // το hidden date μπαίνει μέσα στο wrapper

        // Κρύβουμε το original
        original.style.display = 'none';
        original.setAttribute('data-clearable-skip', 'true');

        // --- Αρχική τιμή: yyyy-mm-dd → dd/mm/yyyy ---
        if (original.value) {
            text.value = isoToDdMmYyyy(original.value);
        }

        // ✅ Toggle × button
        const isLocked = () => text.disabled || text.readOnly;
        const toggle = () => {
            const visible = !!text.value && !isLocked();
            btn.classList.toggle('is-visible', visible);
            btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
        };
        toggle();

        // -------------------------------------------------------
        // INPUT: auto-εισαγωγή "/"
        // -------------------------------------------------------
        text.addEventListener('input', function () {
            let raw = text.value.replace(/\D/g, '').substring(0, 8);
            let formatted = raw;
            if (raw.length > 4) {
                formatted =
                    raw.substring(0, 2) + '/' + raw.substring(2, 4) + '/' + raw.substring(4);
            } else if (raw.length > 2) {
                formatted = raw.substring(0, 2) + '/' + raw.substring(2);
            }
            text.value = formatted;
            syncToOriginal(text.value, original);
            toggle();
        });

        // -------------------------------------------------------
        // KEYDOWN: backspace πάνω από "/"
        // -------------------------------------------------------
        text.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace') {
                const pos = text.selectionStart;
                if (pos > 0 && text.value[pos - 1] === '/') {
                    e.preventDefault();
                    text.value = text.value.substring(0, pos - 1) + text.value.substring(pos);
                    text.setSelectionRange(pos - 1, pos - 1);
                    syncToOriginal(text.value, original);
                    toggle();
                }
            }
            // Esc ή Ctrl+Backspace για clear
            if ((e.key === 'Escape' || (e.key === 'Backspace' && e.ctrlKey)) && !isLocked()) {
                e.preventDefault();
                text.value = '';
                original.value = '';
                toggle();
                text.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // -------------------------------------------------------
        // PASTE
        // -------------------------------------------------------
        text.addEventListener('paste', function (e) {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            const normalized = normalizePastedDate(pasted);
            if (normalized) {
                text.value = normalized;
                syncToOriginal(text.value, original);
                toggle();
            }
        });

        // -------------------------------------------------------
        // BLUR: validation
        // -------------------------------------------------------
        text.addEventListener('blur', function () {
            if (!text.value) {
                text.setCustomValidity('');
                text.style.borderColor = '';
                return;
            }
            if (!isValidDdMmYyyy(text.value)) {
                text.setCustomValidity('Μη έγκυρη ημερομηνία (dd/mm/yyyy)');
                text.style.borderColor = '#dc3545';
                text.reportValidity();
            } else {
                text.setCustomValidity('');
                text.style.borderColor = '';
            }
        });

        // ✅ × button click
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
            if (isLocked()) return;
            text.value = '';
            original.value = '';
            toggle();
            text.focus();
            text.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // ✅ focusin guard
        wrapper.addEventListener(
            'focusin',
            (e) => {
                if (e.target === btn) requestAnimationFrame(() => text.focus());
            },
            true
        );

        // ✅ MutationObserver για disabled/readonly
        const mo = new MutationObserver(toggle);
        mo.observe(text, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
    });

    // ============================================================
    // ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ
    // ============================================================

    function syncToOriginal(ddmmyyyy, original) {
        if (isValidDdMmYyyy(ddmmyyyy)) {
            const parts = ddmmyyyy.split('/');
            original.value = parts[2] + '-' + parts[1] + '-' + parts[0];
            original.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            original.value = '';
        }
    }

    function isoToDdMmYyyy(iso) {
        const p = iso.split('-');
        if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
        return iso;
    }

    function isValidDdMmYyyy(str) {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;
        const [dd, mm, yyyy] = str.split('/').map(Number);
        const d = new Date(yyyy, mm - 1, dd);
        return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
    }

    function normalizePastedDate(str) {
        str = str.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-');
            return d + '/' + m + '/' + y;
        }
        const match = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (match)
            return match[1].padStart(2, '0') + '/' + match[2].padStart(2, '0') + '/' + match[3];
        return null;
    }
});
