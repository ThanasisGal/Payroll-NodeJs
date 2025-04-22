window.dataForUpdate = []; // Δημιουργία της global μεταβλητής για αποθήκευση των δεδομένων

document.addEventListener("DOMContentLoaded", async function () {
  document.getElementById('calculateButton').addEventListener('click', async () => {
    kodikosSymbashs = document.getElementById('kodikosSymbashs').value;
    kodikosKathgorias = document.getElementById('kodikosKathgorias').value;
    kodikosEidikothtas = document.getElementById('kodikosEidikothtas').value;
    const isxyeiApo = document.getElementById('isxyei_apo').value;
    const isxyeiEos = document.getElementById('isxyei_eos').value;
  
    // Αν κάποιο από τα δύο πεδία είναι κενό, εμφανίστε μήνυμα και επιστρέψτε
    if (!isxyeiApo || !isxyeiEos) {
      Swal.fire({
        title: 'Σφάλμα!',
        text: 'Πρέπει να συμπληρώσετε και τις δύο ημερομηνίες.',
        icon: 'error',
        timer: 4000,
        confirmButtonText: 'Κλείσιμο',
        customClass: {
          confirmButton: 'class-error custom-confirm-button custom-swal-button',
        }
      });
      document.getElementById('isxyei_apo').focus()
      return;
    }
  
    if (kodikosEidikothtas) {
      try {
        const response = await fetch(`/api/stoixeiaSymbaseon/${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`);
        const data = await response.json();

        let multiplier = 0;
        for (let i = 1; i <= data.length; i++) {
          const selectElement = document.getElementById(`stoixeio_symbashs_${i.toString().padStart(2, '0')}`);
          const selectRow = document.querySelector(`.showhide_row_${i.toString().padStart(2, '0')}`);

          if (data.length > 0 && i <= data.length) {
            const item = data[i - 1]; // Παίρνουμε το i-1 στοιχείο του πίνακα
            selectRow.classList.remove('d-none');
            selectElement.textContent  = item.kodikos.padEnd(10, '\u00A0') + item.perigrafh;
          } else {
            selectRow.classList.add('d-none');
          }

          if (data.length > 0 && i <= data.length) {
            const item = data[i - 1]; // Παίρνουμε το i-1 στοιχείο του πίνακα
            for (let i = 1; i <= 35; i++) {
            // for (let i = item.ypologismos_apo_klimakio; i <= item.arithmos_klimakion; i += item.bhma_ypologismoy) {
              const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${String(i).padStart(2, '0')}`;

              if (item.ypologismos_apo_klimakio > 1) {
                if (i > item.arithmos_klimakion) {
                  multiplier = Math.floor((item.arithmos_klimakion - 1) / item.ypologismos_apo_klimakio); 
                } else { 
                  multiplier = Math.floor((i - 1) / item.ypologismos_apo_klimakio);
                }
              } else {
                multiplier = 1;
              }

              let result = dynamicCalculation(data, item.typos_ypologismoy, multiplier);

              window.dataForUpdate.push({
                kodikos_symbashs: uniqueCode.substring(0, 4),
                kodikos_kathgorias_symbashs: uniqueCode.substring(4, 8),
                kodikos_eidikothtas_symbashs: uniqueCode.substring(8, 12),
                kodikos_stoixeioy: uniqueCode.substring(12, 16),
                klimakio: uniqueCode.substring(16),
                poso: result,
                isxyei_apo: isxyeiApo,
                isxyei_eos: isxyeiEos,
                afora_thn_symbash: uniqueCode.substring(0, 4),
                afora_thn_symbash_kathgoria: uniqueCode.substring(0, 8),
                afora_thn_symbash_kathgoria_eidikothta: uniqueCode.substring(0, 12),
                afora_thn_symbash_kathgoria_eidikothta_stoixeio: uniqueCode.substring(0, 16),
              });
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  });
});

function dynamicCalculation(data, expression, multiplier) {
  // Προετοιμασία της έκφρασης για αντικατάσταση των kodikos και της multiplier
  let processedExpression = expression.replace(/\d{4}/g, (match) => {
      let item = data.find(({kodikos}) => kodikos === match);
      if (!item) return '0'; // Εάν δεν βρεθεί το στοιχείο, επιστρέψτε '0'
      return item.poso_pososto ? item.poso : item.pososto;
  }).replace(/multiplier/g, multiplier.toString()); // Αντικατάσταση της λέξης 'multiplier' με την πραγματική της τιμή

  // Εκτέλεση της τελικής εκφράσεως
  try {
      let result = math.evaluate(processedExpression);
      return parseFloat(result.toFixed(2)); // Μετατροπή σε αριθμό με δύο δεκαδικά
  } catch (error) {
      console.error('Error evaluating expression:', error);
      return null;
  }
}
