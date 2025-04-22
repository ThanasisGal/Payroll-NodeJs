function updateTotalPososton(number1, number2, decimals) {
  var num1 = parseFloat(number1.replace(',', '.'))
  var num2 = parseFloat(number2.replace(',', '.'))
  var total = num1 + num2;

  document.getElementById('synolo_pososton').value = total.toFixed(decimals);
}

function updateTotalPoson(number1, number2, decimals) {
  var num1 = parseFloat(number1.replace(',', '.'))
  var num2 = parseFloat(number2.replace(',', '.'))
  var total = num1 + num2;

  document.getElementById('synolo_poson').value = total.toFixed(decimals);
}

// Συνάρτηση για τη μορφοποίηση της τιμής με τον καθορισμένο αριθμό δεκαδικών
function formatValue(value, decimals) {
  return Number.parseFloat(value).toFixed(decimals);
}

document.addEventListener('DOMContentLoaded', function() {
  // Ένα αντικείμενο που διατηρεί το mapping των πεδίων με τον επιθυμητό αριθμό δεκαδικών
  const fieldDecimals = {
    'poso_plasmatikhs_axias': 2,
    'pososto_ergazomenoy': 4,
    'pososto_ergodoth': 4,
    'poso_ergazomenoy': 2,
    'poso_ergodoth': 2,
    'anotato_orio_palion': 2,
    'anotato_orio_neon': 2,
  };

  // Προσθήκη event listener σε κάθε πεδίο με βάση το αντικείμενο fieldDecimals
  Object.keys(fieldDecimals).forEach(function(fieldId) {
    var field = document.getElementById(fieldId);
    field.addEventListener('blur', function() {
      this.value = formatValue(this.value, fieldDecimals[fieldId]);
    });
  });
});
