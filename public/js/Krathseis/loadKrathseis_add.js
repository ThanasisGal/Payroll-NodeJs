const fiveSpaces = "\u00A0".repeat(5);
const sevenSpaces = "\u00A0".repeat(7);
const nineSpaces = "\u00A0".repeat(9);
const tenSpaces = "\u00A0".repeat(10);

document.addEventListener("DOMContentLoaded", function () {
  const krathseisDropdown = document.getElementById("krathsh");
  const posoPlasmatikhsAxiasField = document.getElementById("poso_plasmatikhs_axias");
  const labelPosoPlasmatikhsAxias = document.getElementById("label-PosoPlasmatikhsAxias");

  const loadKrathseis = async () => {
    krathseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/krathseis/getKrathseis");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          data.forEach(krathseis => {
            const option = new Option(
              krathseis.kodikos + nineSpaces.slice(krathseis.kodikos.length) + krathseis.perigrafh,
            krathseis.kodikos
            );
            
            option.setAttribute('data-ypologismos_epi_plasmatikhs', krathseis.ypologismos_epi_plasmatikhs);
            option.setAttribute('data-krathseisId', krathseis._id);
            option.setAttribute('data-kodikos', krathseis.kodikos);

            krathseisDropdown.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Σφάλμα κατά τη φόρτωση των κρατήσεων:', error);
    }
  };

  loadKrathseis();

  const updateFieldAndLabel = () => {
    const selectedOption = krathseisDropdown.options[krathseisDropdown.selectedIndex];
    const ypologismosEpiPlasmatikhs = selectedOption.getAttribute('data-ypologismos_epi_plasmatikhs') === 'true';
    const id_krathshs = selectedOption.getAttribute('data-krathseisId');
    const kodikos_krathshs = selectedOption.getAttribute('data-kodikos');
    
    posoPlasmatikhsAxiasField.disabled = !ypologismosEpiPlasmatikhs;
    labelPosoPlasmatikhsAxias.style.opacity = ypologismosEpiPlasmatikhs ? "1" : "0.4";
    document.getElementById("krathshId").value = id_krathshs;
    document.getElementById("kodikos").value = kodikos_krathshs;
  };

  krathseisDropdown.addEventListener('change', updateFieldAndLabel);

  // Ενημερώνει το label και το πεδίο αμέσως μετά την φόρτωση, σε περίπτωση που χρειάζεται
  updateFieldAndLabel();

});
