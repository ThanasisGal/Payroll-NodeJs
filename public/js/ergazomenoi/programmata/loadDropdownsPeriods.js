document.addEventListener("DOMContentLoaded", function () {
  const periodsDropdown = document.getElementById("periods");

  const loadPeriods = async () => {
    periodsDropdown.innerHTML = '';
    const emptyOption = new Option('', '');
    periodsDropdown.appendChild(emptyOption);

    try {
      const response = await fetch("/api/erganh/periods");
      const data = await response.json();

      const periodsArray = data.periodsData;

      // Βεβαιώσου ότι periodsArray είναι πίνακας
      if (Array.isArray(periodsArray)) {
        periodsArray.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.kodikos;
          option.textContent = item.perigrafh;
          option.dataset.apoHmeromhnia = item.apo; // camelCase στο dataset
          option.dataset.eosHmeromhnia = item.eos;
          periodsDropdown.appendChild(option);
        });
      } else {
        console.error('Το periodsData δεν είναι πίνακας:', periodsArray);
      }
      } catch (error) {
      console.error('Σφάλμα κατά το fetch των περιόδων:', error);
    }
  };

  // Event listener για την αλλαγή επιλογής στο dropdown
  document.getElementById('periods').addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    const fromDate = selectedOption.dataset.apoHmeromhnia; // σωστή προσπέλαση με camelCase
    const toDate = selectedOption.dataset.eosHmeromhnia;
    
    // Μετατροπή της ημερομηνίας σε μορφή yyyy-MM-dd
    const formattedFromDate = new Date(fromDate).toISOString().split('T')[0];
    const formattedToDate = new Date(toDate).toISOString().split('T')[0];
    
    document.getElementById('apo_hmeromhnia').value = formattedFromDate || '';
    document.getElementById('eos_hmeromhnia').value = formattedToDate || '';
  });
  
  // Φόρτωση των περιόδων
  loadPeriods();
});
