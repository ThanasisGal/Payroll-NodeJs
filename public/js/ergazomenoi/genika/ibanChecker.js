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

  const checkIbanAgainstBank = () => {
    // Αφαιρεί τα κενά από την τιμή του IBAN για να διεξαγάγουμε τον έλεγχο
    const ibanValue = ibanInput.value.replace(/\s/g, '').toUpperCase();

    if (ibanValue === '' || ibanValue === 'GR') {
      ibanInput.value = '';
      ibanInput.style.color = 'black'; // Επαναφορά σε default χρώμα
      return;
    }

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
        ibanInput.style.color = 'black';
        ibanInput.focus();
      });
      return;
    } else {
      ibanInput.style.color = '#004200';
    }

    const bankCodeFromIban = ibanValue.substring(4, 7);
    if (bankCodeFromIban !== bankCodeHiddenInput.value) {
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
        ibanInput.style.color = 'black';
        ibanInput.focus();
      });
    } else {
      // Εάν το IBAN είναι σωστό και αντιστοιχεί στην τράπεζα, αφήνει το πράσινο
      ibanInput.style.color = '#004200';
    }
  };

  ibanInput.addEventListener('blur', checkIbanAgainstBank); // Έλεγχος IBAN όταν χάνει την εστίαση
  bankSelect.addEventListener('change', checkIbanAgainstBank); // Έλεγχος τράπεζας όταν αλλάζει η επιλογή
  bankSelect.addEventListener('blur', checkIbanAgainstBank); // Έλεγχος τράπεζας και στο blur
});
