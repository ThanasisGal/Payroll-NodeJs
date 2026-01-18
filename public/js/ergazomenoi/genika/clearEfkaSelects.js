document.getElementById('clearSelect-001').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('kad_efka').value = '';
  document.getElementById('eidikothta_efka').value = '';
  document.getElementById('kpk_efka').value = '';
  document.getElementById('epa_efka').value = '';

  // Απενεργοποίηση selects
  document.getElementById('eidikothta_efka').disabled = true;
  document.getElementById('kpk_efka').disabled = true;
  document.getElementById('epa_efka').disabled = true;
});

document.getElementById('clearSelect-002').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('eidikothta_efka').value = '';
  document.getElementById('kpk_efka').value = '';
  document.getElementById('epa_efka').value = '';

  // Απενεργοποίηση selects
  document.getElementById('kpk_efka').disabled = true;
  document.getElementById('epa_efka').disabled = true;
});

document.getElementById('clearSelect-003').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('kpk_efka').value = '';
  document.getElementById('epa_efka').value = '';
  document.getElementById("kpk_efka_basei_symbashs").value = '';
  document.getElementById("tmp_kpk_efka_basei_symbashs").value = '';
  // Απενεργοποίηση select
  document.getElementById('epa_efka').disabled = true;
});

document.getElementById('clearSelect-004').addEventListener('click', async function() {
  document.getElementById('epa_efka').value = '';
  document.getElementById("tmp_kpk_efka_basei_symbashs").value = '';

  const kodikosKad = document.getElementById('kad_efka_hidden').value;
  const kodikosEidikothtas = document.getElementById('eidikothta_efka_hidden').value;
  const kpkEfkaBaseiSymbashs = document.getElementById('kpk_efka_basei_symbashs').value;

  try {
      const response = await fetch(`/api/getKpkEfkaReset?kodikos_kad=${kodikosKad}&kodikos_eidikothtas=${kodikosEidikothtas}`);
      const data = await response.json();

      // Καθαρίστε το select πριν προσθέσετε νέες επιλογές
      const kpkEfkaDropdown = document.getElementById('kpk_efka');
      kpkEfkaDropdown.innerHTML = '';

      // Προσθήκη των επιλογών στο dropdown
      data.forEach((item) => {
          const option = new Option(item.kodikos.padEnd(10, '\u00A0') + item.perigrafh.toUpperCase(), item.kodikos);
          kpkEfkaDropdown.appendChild(option);
      });

      // Επιλέγει αυτόματα την εγγραφή αν ο κωδικός ταιριάζει
      // Στην περίπτωση του data.some(item => item.kodikos === kpkEfkaBaseiSymbashs), η συνάρτηση callback είναι item => item.kodikos === kpkEfkaBaseiSymbashs, και η some ελέγχει κάθε στοιχείο του πίνακα data για να δει αν το kodikos κάποιου από τα στοιχεία (δηλαδή το item) είναι ίσο με την τιμή της μεταβλητής kpkEfkaBaseiSymbashs. Αν η συνθήκη αυτή ισχύει για τουλάχιστον ένα στοιχείο του πίνακα, η some επιστρέφει true, διαφορετικά, επιστρέφει false.
      if (data.some(item => item.kodikos === kpkEfkaBaseiSymbashs)) {
          kpkEfkaDropdown.value = kpkEfkaBaseiSymbashs;
      }
  } catch (error) {
      console.error('Error fetching data:', error);
  }
});
















// document.getElementById('clearSelect-004').addEventListener('click', function() {
//   // Καθαρισμός τιμών
//   document.getElementById('kpk_efka').value = document.getElementById("kpk_efka_basei_symbashs").value;
//   document.getElementById('epa_efka').value = '';
//   // document.getElementById("kpk_efka_basei_symbashs").value = '';
//   document.getElementById("tmp_kpk_efka_basei_symbashs").value = '';
//   // Απενεργοποίηση select
//   // document.getElementById('epa_efka').disabled = true;
// });
