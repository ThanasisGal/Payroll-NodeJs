document.addEventListener("DOMContentLoaded", function () {
  const recalcButton = document.getElementById('reCalcButton');
  if (recalcButton) {
      recalcButton.addEventListener('click', reCalculate);
  }
});

async function reCalculate() {
  // Μηδενίζουμε όλα τα input πεδία στο δεύτερο tab της φόρμας
  clearInputsApodoxon();

  for (let i = 1; i <= 15; i++) {
      const selectedElement = document.getElementById(`stoixeioSymbashsHidden_${i.toString().padStart(2, '0')}`).value;
      const contract = document.getElementById("selectedSymbash").value.toString().padStart(4, '0');
      const category = document.getElementById("selectedKathgoria").value.toString().padStart(4, '0');
      const specialty = document.getElementById("selectedEidikothta").value.toString().padStart(4, '0');
      const klimakio = document.getElementById("misthologiko_klimakio").value.toString().padStart(2, '0');
      if (selectedElement && selectedElement !== "") {
        await updatePosoAndTotal(i, contract, category, specialty, selectedElement, klimakio);
      }
    // }
  }

}

function clearInputsApodoxon() {
  const inputs = document.querySelectorAll('.clearAble');
  inputs.forEach(input => {
      input.value = '';
  });
}
