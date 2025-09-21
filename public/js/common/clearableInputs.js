document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="text"]').forEach(input => {
        if (input.parentElement?.classList.contains('clearable-wrapper')) return;

        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.textContent = '×';
        btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');

        input.insertAdjacentElement('beforebegin', wrapper);
        wrapper.appendChild(input);
        wrapper.appendChild(btn);

        const isLocked = () => input.disabled || input.readOnly;

        const toggle = () => {
            const visible = !!input.value && !isLocked();
            btn.classList.toggle('is-visible', visible);
            btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
            btn.tabIndex = visible ? 0 : -1;
            btn.classList.toggle('is-locked', isLocked());
        };

        // keep visibility up-to-date
        toggle();

        input.addEventListener('input', toggle);
        input.addEventListener('change', toggle);

        // ΔΕΝ καθαρίζει αν είναι disabled/readonly
        btn.addEventListener('click', () => {
            if (isLocked()) return; 
            input.value = '';
            toggle();
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        btn.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isLocked()) {
                e.preventDefault();
                btn.click();
            }
        });

        // Αν αλλάξει δυναμικά disabled/readonly, ανανέωσε την κατάσταση του Χ
        const mo = new MutationObserver(toggle);
        mo.observe(input, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
    });
});
