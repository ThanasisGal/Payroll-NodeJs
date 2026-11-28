(function userPasswordFields() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-toggle-password]').forEach((button) => {
            const targetId = button.getAttribute('aria-controls');
            const input = targetId ? document.getElementById(targetId) : null;
            if (!input) return;

            button.addEventListener('click', () => {
                const revealing = input.type === 'password';
                input.type = revealing ? 'text' : 'password';
                button.setAttribute('aria-pressed', revealing ? 'true' : 'false');
                button.setAttribute(
                    'aria-label',
                    revealing ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'
                );

                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('bi-eye', !revealing);
                    icon.classList.toggle('bi-eye-slash', revealing);
                }
            });
        });
    });
})();