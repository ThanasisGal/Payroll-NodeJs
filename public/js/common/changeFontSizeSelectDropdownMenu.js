document.addEventListener('DOMContentLoaded', function() {
  const selectElements = document.querySelectorAll('.form-select');
  const state = {}; // Αντικείμενο για την κατάσταση των dropdowns

  selectElements.forEach(selectElement => {
    // Αρχικοποίηση της κατάστασης κάθε select στοιχείου ως κλειστή
    state[selectElement.id] = false; 

    selectElement.addEventListener('click', function() {
      // Εναλλαγή της κατάστασης κάθε φορά που γίνεται κλικ
      state[this.id] = !state[this.id];

      if (state[this.id]) {
        // Αν το dropdown ανοίγει
        this.classList.remove('selectpicker-dropdown-normal');
        this.classList.add('selectpicker-dropdown-smaller');

      } else {
        // Αν το dropdown κλείνει
        this.classList.add('selectpicker-dropdown-normal');
        this.classList.remove('selectpicker-dropdown-smaller');
      }
    });
    // Προσθέτει event listener για το 'mousedown' event
    selectElement.addEventListener('mousedown', function() {
      // Αλλαγή της κλάσης για να εφαρμόσει το νέο font-size
      this.classList.add('selectpicker-dropdown-smaller');
      this.classList.remove('selectpicker-dropdown-normal');
    });

    // Προαιρετικά: Αφαιρεί την κλάση όταν αλλάξει η επιλογή απ' το dropdown-menu και το select κλείνει
    selectElement.addEventListener('change', function() {
      // Επαναφέρει την αρχική κλάση
      this.classList.add('selectpicker-dropdown-normal');
      this.classList.remove('selectpicker-dropdown-smaller');
    });

    // Προαιρετικά: Αφαιρεί την κλάση όταν το select κλείνει χωρίς νέα επιλογή
    selectElement.addEventListener('blur', function() {
      // Επαναφέρει την αρχική κλάση
      this.classList.add('selectpicker-dropdown-normal');
      this.classList.remove('selectpicker-dropdown-smaller');
    });

    // Προαιρετικά: Αφαιρεί την κλάση όταν το select κλείνει χωρίς νέα επιλογή
    selectElement.addEventListener('focus', function() {
      // Επαναφέρει την αρχική κλάση
      this.classList.add('selectpicker-dropdown-normal');
      this.classList.remove('selectpicker-dropdown-smaller');
    });
  });
});
