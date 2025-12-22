// ========================================================================
// CLEARABLE INPUTS - Προσθήκη X button σε text/date/time inputs
// ========================================================================

function initClearableInputs(container = document) {
    const inputs = container.querySelectorAll('input[type="text"], input[type="date"], input[type="time"]');
    console.log('🧹 initClearableInputs found', inputs.length, 'inputs');
    
    inputs.forEach(input => {
        // Skip αν ήδη wrapped
        if (input.parentElement?. classList.contains('clearable-wrapper')) {
            console.log('   ⏭️ Already wrapped:', input.id);
            return;
        }

        console.log('   ✅ Wrapping:', input.id);

        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.textContent = '×';
        btn. setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '-1');
        btn.tabIndex = -1;

        input.insertAdjacentElement('beforebegin', wrapper);
        wrapper.appendChild(input);
        wrapper.appendChild(btn);

        const isLocked = () => input.disabled || input.readOnly;

        const toggle = () => {
            const visible = !!input.value && !isLocked();
            btn.classList. toggle('is-visible', visible);
            btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
            btn.classList.toggle('is-locked', isLocked());
        };

        toggle();
        input.addEventListener('input', toggle);
        input.addEventListener('change', toggle);

        btn.addEventListener('mousedown', e => e.preventDefault());

        wrapper.addEventListener('focusin', e => {
            if (e.target === btn) {
                requestAnimationFrame(() => input.focus());
            }
        }, true);

        btn.addEventListener('click', () => {
            if (isLocked()) return;
            input.value = '';
            toggle();
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        input.addEventListener('keydown', e => {
            if ((e.key === 'Escape' || (e.key === 'Backspace' && e. ctrlKey)) && !isLocked()) {
                e.preventDefault();
                input.value = '';
                toggle();
                input. dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        const mo = new MutationObserver(toggle);
        mo.observe(input, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
    });
}

// ✅ Auto-init στο page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🧹 Auto-initializing clearable inputs on page load');
    initClearableInputs();
});

// ✅ Export to window για δυναμικά sections
window.initClearableInputs = initClearableInputs;