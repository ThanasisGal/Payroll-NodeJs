document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('sendApologistikoButton');

    if (!btn) return;

    btn.addEventListener('click', async () => {
        try {
            const ypokatasthmata = document.getElementById('ypokatasthmata')?.value || '';
            const ypokatasthmata_stathera =
                document.getElementById('ypokatasthmata_stathera')?.value || '';

            const apo_hmeromhnia = document.getElementById('apo_hmeromhnia')?.value || '';
            const eos_hmeromhnia = document.getElementById('eos_hmeromhnia')?.value || '';

            const csrfToken = document.getElementById('_csrf')?.value || '';

            if (!ypokatasthmata_stathera || !apo_hmeromhnia || !eos_hmeromhnia) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'Ελλιπή στοιχεία',
                    text: 'Συμπληρώστε παράρτημα και ημερομηνίες.',
                    width: '42rem',
                    customClass: {
                        popup: 'swal-wide-text'
                    }
                });
            }

            btn.disabled = true;

            const response = await fetch('/ergazomenoi/programmata/wtoApologistiko', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    ypokatasthmata,
                    ypokatasthmata_stathera,
                    apo_hmeromhnia,
                    eos_hmeromhnia
                })
            });

            const result = await response.json();

            console.log('✅ WTO APOLOGISTIKO RESULT:', result);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Αποτυχία δημιουργίας XML.');
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                text: result.message || 'Το XML δημιουργήθηκε επιτυχώς.',
                width: '42rem',
                customClass: {
                    popup: 'swal-wide-text'
                }
            });
        } catch (error) {
            console.error('❌ WTO APOLOGISTIKO FRONT ERROR:', error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message || 'Αποτυχία δημιουργίας XML.',
                width: '42rem',
                customClass: {
                    popup: 'swal-wide-text'
                }
            });
        } finally {
            btn.disabled = false;
        }
    });
});
