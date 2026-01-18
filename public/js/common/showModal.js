// JavaScript για να διαβάσει τις τιμές από τα hidden πεδία και να τις εμφανίσει στο modal
document.addEventListener("DOMContentLoaded", function () {
  const value1 = document.getElementById("hmeromhnia_proslhpshs_hidden").value;
  const value2 = document.getElementById("hmeromhnia_lhxhs_symbashs_hidden").value;
  const value3 = document.getElementById("hmeromhnia_apoxorhshs_hidden").value;

  document.getElementById("value1").textContent = value1;
  document.getElementById("value2").textContent = value2;
  document.getElementById("value3").textContent = value3;
});
