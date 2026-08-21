document.getElementById('calcApasxolhseonButton')?.addEventListener('click', async () => {
    const apo_hmeromhnia = document.getElementById('apo_hmeromhnia')?.value;
    const eos_hmeromhnia = document.getElementById('eos_hmeromhnia')?.value;

    const ypokatasthmata_stathera = document.getElementById('ypokatasthmata_stathera')?.value || '';

    const proorh_proseleysh = document.getElementById('xronosProetoimasias_stathera')?.value || '';

    const proorhApoxorhsh_stathera =
        document.getElementById('proorhApoxorhsh_stathera')?.value || '';
    const rawKodikos = document.getElementById('kodikos')?.value.trim() || '';
    if (rawKodikos && !/^\d{1,4}$/.test(rawKodikos)) {
        return Swal.fire({ icon: 'warning', title: 'Υπολογισμός Απασχολήσεων',
            text: 'Ο κωδικός εργαζομένου πρέπει να περιέχει έως 4 ψηφία.' });
    }
    const kodikos = rawKodikos ? rawKodikos.padStart(4, '0') : '';
    const csrfToken = document.querySelector('input[name="_csrf"]')?.value || '';

    try {
        let historical_reconstruction_request_id = '';
        const periodStateResponse = await fetch(
            `/api/prodhlomena-oraria/review/period-control/current?ypokatasthma=${encodeURIComponent(ypokatasthmata_stathera)}`,
            { headers: { Accept: 'application/json' } }
        );
        const periodState = await periodStateResponse.json();
        if (!periodStateResponse.ok || !periodState.success) {
            throw new Error(periodState.message || 'Δεν ήταν δυνατός ο έλεγχος της περιόδου.');
        }
        if (['HISTORICAL_RECONSTRUCTION_REQUIRED', 'HISTORICAL_RECONSTRUCTION_STALE']
            .includes(periodState.effective_mode)) {
            if (kodikos) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Απαιτείται υπολογισμός ολόκληρου παραρτήματος',
                    text: 'Η ανακατασκευή εκπρόθεσμης περιόδου είναι συνολική. ' +
                        'Αδειάστε το πεδίο Κωδικός για να συνεχίσετε.'
                });
                return;
            }
            const authorization = await Swal.fire({
                icon: 'warning',
                title: periodState.effective_mode === 'HISTORICAL_RECONSTRUCTION_STALE'
                    ? 'Επανεκτίμηση Ανακατασκευασμένης Περιόδου'
                    : 'Ανακατασκευή Εκπρόθεσμης Περιόδου',
                input: 'textarea', inputLabel: 'Υποχρεωτική αιτιολογία',
                inputValue: 'Καθαρή ανακατασκευή της υπό εξέταση περιόδου μετά από ελεγχόμενο καθαρισμό των παράγωγων αποτελεσμάτων, με διατήρηση των πρωτογενών δεδομένων, των εγκεκριμένων αποφάσεων και των επαναχρησιμοποιήσιμων πολιτικών.',
                showCancelButton: true, confirmButtonText: 'Εξουσιοδότηση', cancelButtonText: 'Ακύρωση',
                inputValidator: value => String(value || '').trim()
                    ? undefined : 'Η αιτιολογία είναι υποχρεωτική.'
            });
            if (!authorization.isConfirmed) return;
            historical_reconstruction_request_id = `historical-reconstruction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const authorizeResponse = await fetch(
                '/api/prodhlomena-oraria/review/period-control/historical-reconstruction/authorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                        'CSRF-Token': csrfToken, 'x-csrf-token': csrfToken },
                    body: JSON.stringify({ ypokatasthma: ypokatasthmata_stathera,
                        reason: String(authorization.value).trim(),
                        request_id: historical_reconstruction_request_id, confirmation: true })
                });
            const authorizePayload = await authorizeResponse.json();
            if (!authorizeResponse.ok || !authorizePayload.success) {
                throw new Error(authorizePayload.message || 'Η εξουσιοδότηση απέτυχε.');
            }
        } else if (periodState.past_deadline === true) {
            throw new Error('Η εκπρόθεσμη περίοδος δεν έχει ενεργή εξουσιοδότηση επανυπολογισμού.');
        }
        const response = await fetch('/ergazomenoi/programmata/calcApasxolhseisPeriodoy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 'CSRF-Token': csrfToken, 'x-csrf-token': csrfToken
            },
            body: JSON.stringify({
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthmata_stathera,
                kodikos,
                proorh_proseleysh,
                proorhApoxorhsh_stathera,
                historical_reconstruction_request_id
            })
        });

        const payload = await response.json();

        if (!payload.success) {
            return Swal.fire({
                icon: 'warning',
                title: 'Υπολογισμός Απασχολήσεων',
                text: payload.message || 'Ο υπολογισμός δεν ολοκληρώθηκε.'
            });
        }

        console.log(payload);

        await Swal.fire({
            icon: 'success',
            title: 'Υπολογισμός Απασχολήσεων',
            text: kodikos
                ? `Ο υπολογισμός αφορούσε μόνο τον εργαζόμενο ${kodikos}.`
                : `Ο υπολογισμός αφορούσε όλο το παράρτημα. Βρέθηκαν ${payload.employeesCount} εργαζόμενοι.`
        });
    } catch (error) {
        console.error(error);

        await Swal.fire({
            icon: 'error',
            title: 'Υπολογισμός Απασχολήσεων',
            text: 'Σφάλμα επικοινωνίας με τον server.'
        });
    }
});
