document.addEventListener('DOMContentLoaded', () => {
    // ---- ΠΙΘΑΝΑ IDs ----
    const IBAN_CANDIDATES = [
        'iban',                                               // (στη φόρμα ergazomenoi)
        'logariasmos_1', 'logariasmos_2', 'logariasmos_3'     // iban (στη φόρμα trapezes)
    ];
    const BANK_HIDDEN_ID = 'kodikos_dias_stathera';           // hidden με kodikos_dias (στο νέο πρόγραμμα)
    const BANK_SELECT_ID = 'trapeza';                         // select τράπεζας (στη φόρμα ergazomenoi)
    const FALLBACK_HIDDEN_ID = 'bankCode';                    // αν δεν υπάρχει τίποτα, θα το δημιουργήσουμε

    // ---- Βρες τα input IBAN που υπάρχουν όντως στη σελίδα ----
    const ibanInputs = IBAN_CANDIDATES
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (ibanInputs.length === 0) return;                      // δεν έχει IBAN πεδία, δεν κάνουμε τίποτα

    // ---- Βρες πηγή κωδικού τράπεζας ----
    const bankSelect = document.getElementById(BANK_SELECT_ID);
    let bankHidden = document.getElementById(BANK_HIDDEN_ID);

    // Αν δεν υπάρχει ούτε hidden ούτε select, φτιάξε fallback hidden για μελλοντική χρήση
    if (!bankSelect && !bankHidden) {
        bankHidden = document.createElement('input');
        bankHidden.type = 'hidden';
        bankHidden.id = FALLBACK_HIDDEN_ID;
        document.body.appendChild(bankHidden);
    }

    // Επιστρέφει τον 3ψήφιο kodikos_dias (ό,τι είναι διαθέσιμο)
    const getSelectedBankCode = () => {
        if (bankSelect) return (bankSelect.value || '').trim();
        if (bankHidden) return (bankHidden.value || '').trim();
        const fb = document.getElementById(FALLBACK_HIDDEN_ID);
        return fb ? (fb.value || '').trim() : '';
    };

    // ---- Helpers εμφάνισης ----
    const resetIbanState = el => el.classList.remove('iban-input--ok', 'iban-input--error');
    const setIbanStateOk = el => { el.classList.remove('iban-input--error'); el.classList.add('iban-input--ok'); };
    const setIbanStateError = el => { el.classList.remove('iban-input--ok'); el.classList.add('iban-input--error'); };

    // ---- Μορφοποίηση κατά την πληκτρολόγηση ----
    const attachFormatOnInput = (inputEl) => {
        inputEl.addEventListener('input', (event) => {
            let value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (value.length > 4) {
                value = value.substring(0, 4) + ' ' + value.substring(4).replace(/(\d{4})/g, '$1 ').trim();
            }
            event.target.value = value;
        });
    };

    // ---- IBAN validation (mod-97) ----
    const isValidIbanGR = (ibanRaw) => {
        const iban = ibanRaw.replace(/\s/g, '').toUpperCase();
        if (!iban.startsWith('GR') || iban.length < 15) return false;

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let cnv = '';
        cnv += (letters.indexOf(iban[0]) + 10).toString();
        cnv += (letters.indexOf(iban[1]) + 10).toString();
        let nib = iban.substring(4) + cnv + iban.substring(2, 4);

        let st1 = parseInt(nib.substring(0, 9), 10) % 97;
        nib = (st1 < 10 ? '0' + st1 : st1.toString()) + nib.substring(9);
        st1 = parseInt(nib.substring(0, 9), 10) % 97;
        nib = (st1 < 10 ? '0' + st1 : st1.toString()) + nib.substring(9);
        st1 = parseInt(nib.substring(0, 9), 10) % 97;
        nib = (st1 < 10 ? '0' + st1 : st1.toString()) + nib.substring(9);

        return parseInt(nib, 10) % 97 === 1;
    };

    // ---- Έλεγχος ενός input ----
    const checkIbanAgainstBank = (inputEl) => {
        const raw = inputEl.value.trim();
        const ibanValue = raw.replace(/\s/g, '').toUpperCase();

        // Κενό/μόνο "GR" => καθάρισε & default
        if (ibanValue === '' || ibanValue === 'GR') {
            inputEl.value = '';
            resetIbanState(inputEl);
            return;
        }

        // mod-97
        if (!isValidIbanGR(raw)) {
            setIbanStateError(inputEl);
            if (window.Swal) {
                Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "warning",
                    title: "Προσοχή! Λάθος ΙΒΑΝ...",
                    html: `Πληκτρολογείστε τον <strong>σωστό ΙΒΑΝ</strong> ή αφήστε το πεδίο κενό...`,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-warning custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => { inputEl.value = ''; resetIbanState(inputEl); inputEl.focus(); });
            }
            return;
        } else {
            setIbanStateOk(inputEl);
        }

        // Έλεγχος τράπεζας (3 ψηφία από θέσεις 4..6 του IBAN)
        const bankCodeFromIban = ibanValue.substring(4, 7);
        const selectedBankCode = getSelectedBankCode();

        if (selectedBankCode && bankCodeFromIban !== selectedBankCode) {
            setIbanStateError(inputEl);
            if (window.Swal) {
                Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "warning",
                    title: "Προσοχή! Λάθος ΙΒΑΝ...",
                    html: `Ο IBAN <strong>δεν αντιστοιχεί</strong> στην τράπεζα που επιλέξατε.`,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-warning custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => { inputEl.value = ''; resetIbanState(inputEl); inputEl.focus(); });
            }
        } else {
            setIbanStateOk(inputEl);
        }
    };

    // ---- Bind σε ΟΛΑ τα IBAN inputs ----
    ibanInputs.forEach((el) => {
        attachFormatOnInput(el);
        el.addEventListener('blur', () => checkIbanAgainstBank(el));
    });

    // ---- Αν έχουμε select τράπεζας, revalidate σε αλλαγή ----
    if (bankSelect) {
        bankSelect.addEventListener('change', () => {
            ibanInputs.forEach(el => { if (el.value.trim()) checkIbanAgainstBank(el); });
        });
    }

    // ---- Αν έχουμε hidden που αλλάζει από JS, revalidate όταν αλλάζει η value ----
    // (θα πρέπει όπου το ενημερώνουμε να κάνουμε: bankHidden.dispatchEvent(new Event('change')))
    if (bankHidden) {
        bankHidden.addEventListener('change', () => {
            ibanInputs.forEach(el => { if (el.value.trim()) checkIbanAgainstBank(el); });
        });
    }
});
