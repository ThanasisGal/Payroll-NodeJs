(function disconnectUsersPage() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('disconnectUsersForm');
        if (!form) return;
        const select = document.getElementById('disconnectUsersTarget');
        const button = document.getElementById('disconnectUsersSubmit');
        const status = document.getElementById('disconnectUsersStatus');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const option = select.selectedOptions[0];
            if (!select.value || !option) return;
            const name = option.dataset.name || option.textContent.trim();
            const question = `Θέλετε να αποσυνδέσετε τον χρήστη ${name} από όλες τις ενεργές συνεδρίες;`;
            const confirmed = window.Swal
                ? (await window.Swal.fire({ title: 'Επιβεβαίωση αποσύνδεσης', text: question,
                    icon: 'warning', showCancelButton: true, confirmButtonText: 'Αποσύνδεση',
                    cancelButtonText: 'Ακύρωση' })).isConfirmed
                : window.confirm(question);
            if (!confirmed) return;
            button.disabled = true;
            try {
                const response = await fetch('/admin/disconnect-users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                        'X-CSRF-Token': form.querySelector('[name="_csrf"]').value },
                    body: JSON.stringify({ userId: select.value })
                });
                const data = await response.json();
                if (!response.ok || data.success !== true) throw new Error('Force logout failed');
                status.textContent = data.message;
                if (window.Swal) await window.Swal.fire('Επιτυχία', data.message, 'success');
                window.location.reload();
            } catch (error) {
                console.error('[disconnect-users] Request failed:', error);
                status.textContent = 'Η αποσύνδεση δεν ολοκληρώθηκε. Δοκιμάστε ξανά.';
                if (window.Swal) await window.Swal.fire('Σφάλμα', status.textContent, 'error');
                button.disabled = false;
            }
        });
    });
})();
