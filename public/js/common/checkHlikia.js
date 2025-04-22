document.addEventListener('DOMContentLoaded', function() {
  const inputHmeromhniaGennhshs = document.getElementById('hmeromhnia_gennhshs');
  
  function updateAge() {
    var hmeromhniaGennhshs = new Date(inputHmeromhniaGennhshs.value);
    var today = new Date();
    var age = today.getFullYear() - hmeromhniaGennhshs.getFullYear();
    var m = today.getMonth() - hmeromhniaGennhshs.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < hmeromhniaGennhshs.getDate())) {
      age--;
    }

    const labelAnhlikos = document.getElementById('label-anhlikos');

    // Έλεγχος αν η ηλικία είναι NaN
    if (isNaN(age)) {
      labelAnhlikos.textContent = '';
    } else if (age < 18) {
      labelAnhlikos.textContent = 'ΑΝΗΛΙΚΟΣ';
      labelAnhlikos.classList.add('label-anhlikos-style');
    } else {
      labelAnhlikos.textContent = `Ηλικία : ${age} ετών`;
      labelAnhlikos.classList.remove('label-anhlikos-style');
    }
  }

  // Καλούμε τη συνάρτηση updateAge κατά την αρχική φόρτωση σε περίπτωση που υπάρχει ήδη ημερομηνία
  updateAge();

  // Επίσης προσθέτουμε τον listener για την αλλαγή της ημερομηνίας
  inputHmeromhniaGennhshs.addEventListener('change', updateAge);
});
