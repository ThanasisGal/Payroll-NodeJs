document.addEventListener('DOMContentLoaded', () => {
    const ibanInput = document.getElementById('iban');
    const bankSelect = document.getElementById('trapeza');
    const bankCodeHiddenInput = document.createElement('input');
    bankCodeHiddenInput.type = 'hidden';
    bankCodeHiddenInput.id = 'bankCode';
    document.body.appendChild(bankCodeHiddenInput);

    const enforceIbanFormat = () => {
        ibanInput.addEventListener('input', (event) => {
            let value = event.target.value.toUpperCase();
            value = value.replace(/[^A-Z0-9]/gi, '');
        
            // Εφαρμόζει το επιθυμητό format: XX99 9999 9999 9999 9999 9999 999
            if (value.length > 4) {
                value = value.substring(0, 4) + ' ' + value.substring(4).replace(/(\d{4})/g, '$1 ').trim();
            }
        
            event.target.value = value;
        });
    };

    enforceIbanFormat();
    
    bankSelect.addEventListener('change', () => {
        const selectedBankCode = bankSelect.options[bankSelect.selectedIndex].value;
        bankCodeHiddenInput.value = selectedBankCode;
    });

    // helpers για κλάσεις (αντί για inline style)
    function resetIbanState() {
        ibanInput.classList.remove('iban-input--ok', 'iban-input--error'); // επιστροφή στο default (μαύρο)
    }

    function setIbanStateOk() {
        ibanInput.classList.remove('iban-input--error');
        ibanInput.classList.add('iban-input--ok');
    }

    function setIbanStateError() {
        ibanInput.classList.remove('iban-input--ok');
        ibanInput.classList.add('iban-input--error');
    }

    const checkIbanAgainstBank = () => {
        // Αφαιρεί τα κενά και κάνει uppercase
        const ibanValue = ibanInput.value.replace(/\s/g, '').toUpperCase();

        // Κενό ή μόνο "GR" => καθάρισμα & default
        if (ibanValue === '' || ibanValue === 'GR') {
            ibanInput.value = '';
            resetIbanState();
            return;
        }

        // Υπολογισμός mod-97 (όπως είχες)
        const arr1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        let cnv = '';
        cnv += (arr1.indexOf(ibanValue[0]) + 10).toString();
        cnv += (arr1.indexOf(ibanValue[1]) + 10).toString();

        let nib = ibanValue.substring(4) + cnv + ibanValue.substring(2, 4);

        let st1 = parseInt(nib.substring(0, 9)) % 97;
        nib = (st1 < 10 ? "0" + st1 : st1.toString()) + nib.substring(9);
        st1 = parseInt(nib.substring(0, 9)) % 97;
        nib = (st1 < 10 ? "0" + st1 : st1.toString()) + nib.substring(9);
        st1 = parseInt(nib.substring(0, 9)) % 97;
        nib = (st1 < 10 ? "0" + st1 : st1.toString()) + nib.substring(9);
        const md1 = parseInt(nib) % 97;

        if (md1 !== 1) {
            setIbanStateError();
            Swal.fire({
                icon: "error",
                title: "Λάθος ΙΒΑΝ...",
                html: `Πληκτρολογείστε τον <strong>σωστό ΙΒΑΝ</strong> ή αφήστε το πεδίο κενό....`,
                timer: 2500,
                focusConfirm: true,
                showConfirmButton: false,
                showCancelButton: false,
                customClass: {
                confirmButton: 'class-error',
                title: 'custom-title',
                }
            }).then(() => {
                ibanInput.value = '';
                resetIbanState();
                ibanInput.focus();
            });
            return;
        } else {
            setIbanStateOk();
        }

        // Έλεγχος τράπεζας από τον IBAN
        const bankCodeFromIban = ibanValue.substring(4, 7);
        if (bankCodeFromIban !== bankCodeHiddenInput.value) {
            setIbanStateError();
            Swal.fire({
                icon: 'error',
                title: 'Λάθος ΙΒΑΝ',
                html: `Ο IBAN <strong>δεν αντιστοιχεί</strong> στην τράπεζα που επιλέξατε.`,
                timer: 2500,
                focusConfirm: true,
                showConfirmButton: false,
                showCancelButton: false,
                customClass: {
                confirmButton: 'class-error',
                title: 'custom-title',
                }
            }).then(() => {
                ibanInput.value = '';
                resetIbanState();  // επιστροφή στο default
                ibanInput.focus();
            });
        } else {
            // Σωστός IBAN και σωστή τράπεζα
            setIbanStateOk();
        }
    };

    // Events
    ibanInput.addEventListener('blur', checkIbanAgainstBank);
    bankSelect.addEventListener('change', checkIbanAgainstBank);
    bankSelect.addEventListener('blur', checkIbanAgainstBank);

});
