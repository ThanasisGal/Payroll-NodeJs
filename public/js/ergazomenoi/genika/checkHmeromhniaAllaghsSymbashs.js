document.addEventListener('DOMContentLoaded', function() {
  const proslhpshInput = document.getElementById('hmeromhnia_proslhpshs');
  const allaghInput = document.getElementById('hmeromhnia_allaghs_symbashs');

  allaghInput.addEventListener('blur', function() {
      validateDates();
  });
});

function validateDates() {
  const proslhpshInput = document.getElementById('hmeromhnia_proslhpshs');
  const allaghInput = document.getElementById('hmeromhnia_allaghs_symbashs');
  const proslhpshDate = new Date(proslhpshInput.value);
  const allaghDate = new Date(allaghInput.value);

  if (proslhpshInput.value && allaghInput.value && allaghDate < proslhpshDate) {
      alert('Η ημερομηνία αλλαγής σύμβασης δεν μπορεί να είναι μικρότερη της ημερομηνία πρόσληψης.');
      allaghInput.value = proslhpshInput.value; // Επαναφέρει την ημερομηνία αλλαγής σύμβασης στην ημερομηνία πρόσληψης
      allaghInput.focus();
  }
}