// ibanChecker.js
document.addEventListener('DOMContentLoaded', () => {
    // ---- ΠΙΘΑΝΑ IDs ----
    const IBAN_CANDIDATES = [
        'iban', // (στη φόρμα ergazomenoi)
        'logariasmos_1',
        'logariasmos_2',
        'logariasmos_3' // (στη φόρμα trapezes)
    ];
    const BANK_HIDDEN_ID = 'kodikos_dias_stathera'; // hidden με kodikos_dias
    const BANK_SELECT_ID = 'trapeza'; // select τράπεζας
    const FALLBACK_HIDDEN_ID = 'bankCode'; // fallback αν δεν υπάρχει τίποτα

    // ---- Βρες τα input IBAN που υπάρχουν όντως στη σελίδα ----
    const ibanInputs = IBAN_CANDIDATES.map((id) => document.getElementById(id)).filter(Boolean);

    if (ibanInputs.length === 0) return;

    // ---- Πηγή κωδικού τράπεζας ----
    const bankSelect = document.getElementById(BANK_SELECT_ID);
    let bankHidden = document.getElementById(BANK_HIDDEN_ID);

    // Αν δεν υπάρχει ούτε hidden ούτε select, φτιάξε fallback hidden
    if (!bankSelect && !bankHidden) {
        bankHidden = document.createElement('input');
        bankHidden.type = 'hidden';
        bankHidden.id = FALLBACK_HIDDEN_ID;
        document.body.appendChild(bankHidden);
    }

    // 3ψήφιος κωδικός τράπεζας από διαθέσιμη πηγή
    const getSelectedBankCode = () => {
        if (bankSelect) return (bankSelect.value.substring(0, 3) || '').trim();
        if (bankHidden) return (bankHidden.value || '').trim();
        const fb = document.getElementById(FALLBACK_HIDDEN_ID);
        return fb ? (fb.value || '').trim() : '';
    };

    // ---- Helpers εμφάνισης (Bootstrap icons + δικές σου κλάσεις) ----
    const resetIbanState = (el) => {
        el.classList.remove('iban-input--ok', 'iban-input--error', 'is-valid', 'is-invalid');
        el.removeAttribute('aria-invalid');
    };
    const setIbanStateOk = (el) => {
        el.classList.remove('iban-input--error', 'is-invalid');
        el.classList.add('iban-input--ok', 'is-valid');
        el.setAttribute('aria-invalid', 'false');
    };
    const setIbanStateError = (el) => {
        el.classList.remove('iban-input--ok', 'is-valid');
        el.classList.add('iban-input--error', 'is-invalid');
        el.setAttribute('aria-invalid', 'true');
    };

    // ---- Μορφοποίηση κατά την πληκτρολόγηση ----
    const attachFormatOnInput = (inputEl) => {
        inputEl.addEventListener('input', (e) => {
            // μόνο γράμματα/νούμερα, κεφαλαία, κενά ανά 4
            let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            // if (v.length > 4)
            //     v =
            //         v.slice(0, 4) +
            //         ' ' +
            //         v
            //             .slice(4)
            //             .replace(/(\w{4})/g, '$1 ')
            //             .trim();
            e.target.value = v;
        });
    };

    // ---- IBAN validation (mod-97) ----
    const isValidIbanGR = (ibanRaw) => {
        const iban = ibanRaw.replace(/\s/g, '').toUpperCase();
        if (!/^GR[0-9A-Z]+$/.test(iban)) return false;
        if (iban.length < 15) return false;

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        // Μετακίνηση country code στο τέλος & αντικατάσταση γραμμάτων με αριθμούς
        const rearranged = iban.slice(4) + iban.slice(0, 4);
        let numeric = '';
        for (const ch of rearranged) {
            if (ch >= 'A' && ch <= 'Z') numeric += (letters.indexOf(ch) + 10).toString();
            else numeric += ch;
        }
        // Υπολογισμός mod 97 σε τμήματα για ασφάλεια
        let remainder = 0;
        for (let i = 0; i < numeric.length; i += 7) {
            remainder = parseInt(String(remainder) + numeric.substr(i, 7), 10) % 97;
        }
        return remainder === 1;
    };

    // ---- Έλεγχος ενός input ----
    const checkIbanAgainstBank = async (inputEl) => {
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
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'warning',
                    title: 'Προσοχή! Λάθος ΙΒΑΝ…',
                    html: 'Πληκτρολογήστε τον <strong>σωστό IBAN</strong> ή αφήστε το πεδίο κενό.',
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                });
            }
            inputEl.value = '';
            resetIbanState(inputEl);
            inputEl.focus();
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
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'warning',
                    title: 'Προσοχή! Λάθος ΙΒΑΝ…',
                    html: `Ο IBAN <strong>δεν αντιστοιχεί</strong> στην τράπεζα που επιλέξατε (αναμένεται κωδικός ${selectedBankCode}).`,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                });
            }
            inputEl.value = '';
            resetIbanState(inputEl);
            inputEl.focus();
            return;
        } else {
            setIbanStateOk(inputEl);
        }
    };

    // ---- Bind σε ΟΛΑ τα IBAN inputs ----
    ibanInputs.forEach((el) => {
        // βεβαιώσου ότι είναι Bootstrap input για τα icons
        el.classList.add('form-control');
        attachFormatOnInput(el);

        // Debounced live feedback (χωρίς Swal)
        let t;
        el.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const v = el.value.trim();
                if (!v || v === 'GR') return resetIbanState(el);
                isValidIbanGR(v) ? setIbanStateOk(el) : setIbanStateError(el);
            }, 250);
        });

        // Τελικός έλεγχος στο blur (με Swal για μηνύματα)
        el.addEventListener('blur', () => {
            checkIbanAgainstBank(el);
        });
    });

    // ---- Revalidate όταν αλλάζει η τράπεζα ----
    if (bankSelect) {
        bankSelect.addEventListener('change', () => {
            ibanInputs.forEach((el) => {
                if (el.value.trim()) checkIbanAgainstBank(el);
            });
        });
    }
    if (bankHidden) {
        bankHidden.addEventListener('change', () => {
            ibanInputs.forEach((el) => {
                if (el.value.trim()) checkIbanAgainstBank(el);
            });
        });
    }
});
