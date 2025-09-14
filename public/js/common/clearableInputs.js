document.addEventListener('DOMContentLoaded', () => {
    // βρίσκουμε ΟΛΑ τα input type="text"
    document.querySelectorAll('input[type="text"]').forEach(input => {
        if (input.parentElement?.classList.contains('clearable-wrapper')) return;

        /* --- φτιάχνουμε wrapper & button ---------------------------------- */
        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.textContent = '×'; // αντί για innerHTML/&times;
        btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');

        // Τοποθετούμε το wrapper πριν το input
        input.insertAdjacentElement('beforebegin', wrapper);

        // Μετακινούμε το input μέσα στο wrapper (όχι clone)
        wrapper.appendChild(input);
        wrapper.appendChild(btn);

        /* --- helper: δείχνει/κρύβει το Χ χωρίς inline styles --------------- */
        const toggle = () => {
            const visible = !!input.value;
            btn.classList.toggle('is-visible', visible);
            btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
            btn.tabIndex = visible ? 0 : -1; // μη εστιάζει όταν «κρυφό»
        };
        toggle(); // αρχική κατάσταση

        /* --- events -------------------------------------------------------- */
        input.addEventListener('input', toggle);

        btn.addEventListener('click', () => {
            input.value = '';
            toggle();
            input.focus(); // κρατάμε το focus στο πεδίο
            input.dispatchEvent(new Event('input', { bubbles: true })); // ενημέρωσε listeners
        });

        // keyboard support (Enter/Space)
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });
});
