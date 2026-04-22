document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="time"]').forEach(function (original) {
        // --- Δημιουργία text input ---
        const text = document.createElement('input');
        text.type = 'text';
        text.placeholder = 'HH:MM';
        text.maxLength = 5;
        text.className = original.className;
        text.setAttribute('autocomplete', 'off');

        if (original.id) {
            text.id = original.id;
            original.id = original.id + '__raw';
        }

        // ✅ Δημιουργία clearable-wrapper (ίδιο με date_format_fix.js)
        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.textContent = '×';
        btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '-1');
        btn.tabIndex = -1;

        original.parentNode.insertBefore(wrapper, original);
        wrapper.appendChild(text);
        wrapper.appendChild(btn);
        wrapper.appendChild(original);

        // Κρύβουμε το original
        original.style.display = 'none';
        original.setAttribute('data-clearable-skip', 'true');

        // --- Αρχική τιμή: HH:MM ---
        if (original.value) {
            text.value = original.value.substring(0, 5); // "17:00:00" → "17:00"
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
        // INPUT: auto-εισαγωγή ":"
        // -------------------------------------------------------
        text.addEventListener('input', function () {
            let raw = text.value.replace(/\D/g, '').substring(0, 4); // μόνο ψηφία, max 4

            let formatted = raw;
            if (raw.length > 2) {
                formatted = raw.substring(0, 2) + ':' + raw.substring(2);
            }

            // Validation ωρών (00-23)
            if (raw.length >= 2) {
                const hours = parseInt(raw.substring(0, 2));
                if (hours > 23) formatted = '23' + (raw.length > 2 ? ':' + raw.substring(2) : '');
            }

            // Validation λεπτών (00-59)
            if (raw.length === 4) {
                const minutes = parseInt(raw.substring(2, 4));
                if (minutes > 59) formatted = formatted.substring(0, 3) + '59';
            }

            text.value = formatted;
            syncToOriginal(text.value, original);
            toggle();
        });

        // -------------------------------------------------------
        // KEYDOWN: backspace πάνω από ":"
        // -------------------------------------------------------
        text.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace') {
                const pos = text.selectionStart;
                if (pos > 0 && text.value[pos - 1] === ':') {
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
            const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
            // Δέχεται HH:MM ή HH:MM:SS
            const match = pasted.match(/^(\d{1,2}):(\d{2})/);
            if (match) {
                const h = match[1].padStart(2, '0');
                const m = match[2];
                const normalized = h + ':' + m;
                if (isValidTime(normalized)) {
                    text.value = normalized;
                    syncToOriginal(text.value, original);
                    toggle();
                }
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
            if (!isValidTime(text.value)) {
                text.setCustomValidity('Μη έγκυρη ώρα (HH:MM)');
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

    function syncToOriginal(hhMM, original) {
        if (isValidTime(hhMM)) {
            original.value = hhMM; // "17:00" → αποθηκεύεται ως "17:00" ✅
            original.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            original.value = '';
        }
    }

    function isValidTime(str) {
        if (!/^\d{2}:\d{2}$/.test(str)) return false;
        const [hh, mm] = str.split(':').map(Number);
        return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
    }
});
