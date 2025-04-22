function generateSelectRows() {
  const container = document.getElementById('stoixeiaSymbaseonContainer');
  container.innerHTML = ''; 

  for (let i = 1; i <= 15; i++) {
    const rowHTML = `
      <div class="row form-group g-3 align-items-center d-none showhide_row_${i.toString().padStart(2, '0')}" style="background-color: #ffffff; margin-left: -1rem; margin-right: -1rem;">
        <div class="col-2 left-align">
          <label class="col-form-label label-font-size">
            Στοιχείο Σύμβασης #${i}
          </label>
        </div>
        <div class="col-9">
        <label class="label-font-size-larger" style="margin-left: 0.8rem;" id="stoixeio_symbashs_${i.toString().padStart(2, '0')}"> </label>
        </div>
        <div class="col-1">
        <label class="label-font-size-larger text-right" style="margin-left: 2rem;" id="checkSymbol_${i.toString().padStart(2, '0')}" ><i class="bi bi-check-lg" style="font-size: 24px; color: green;"></i></label>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  generateSelectRows(); // Κλήση της συνάρτησης για να δημιουργηθούν τα στοιχεία
});