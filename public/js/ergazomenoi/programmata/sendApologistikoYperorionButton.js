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

            const response = await fetch('/ergazomenoi/programmata/wtoApologistikoYperorion', {
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

            // const result = await response.json();
            const contentType = response.headers.get('content-type') || '';
            const rawText = await response.text();

            let result;
            if (contentType.includes('application/json')) {
                result = JSON.parse(rawText);
            } else {
                console.error('❌ Expected JSON but got HTML/text:', rawText);
                throw new Error('Το backend δεν επέστρεψε JSON. Πιθανό λάθος route ή CSRF.');
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Αποτυχία δημιουργίας XML υπερωριών.');
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                html: `
                    <div style="text-align:left;">
                        <div>${result.message || 'Το XML υπερωριών δημιουργήθηκε επιτυχώς.'}</div>

                        <hr>

                        <div style="font-size:0.85rem; word-break:break-word;">
                            <b>XML:</b><br>
                            ${result.filename || '-'}
                        </div>

                        <div style="margin-top:8px; font-size:0.8rem; color:#666; word-break:break-word;">
                            ${result.s3Key || ''}
                        </div>
                    </div>
                `,
                width: '42rem',
                customClass: {
                    popup: 'swal-wide-text'
                }
            });
        } catch (error) {
            console.error('❌ WTO APOLOGISTIKO YPERORION FRONT ERROR:', error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message || 'Αποτυχία δημιουργίας XML υπερωριών.',
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
