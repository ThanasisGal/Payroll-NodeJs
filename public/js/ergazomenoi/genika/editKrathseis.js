document.addEventListener("DOMContentLoaded", function () {
  generateSelectRowsOfKrathseis();
  loadKrathseis();
});

function generateSelectRowsOfKrathseis() {
  const container = document.getElementById('krathseisContainer');
  container.innerHTML = ''; 

  for (let i = 1; i <= 7; i++) {
    const selectedKrathshValue = document.getElementById("krathshHidden_" + i.toString().padStart(2, '0')).value
    const selectedAmaKrathshsValue = document.getElementById("amaKrathshsHidden_" + i.toString().padStart(2, '0')).value
    const rowHTML = `
      <div class="row form-group align-items-center mt-2 showhide_row_${i.toString().padStart(2, '0')}" style="background-color: #ffffff; margin-left: -1rem; margin-right: -1rem; margin-bottom: -0.6rem !important;" id="row_Kra_${i.toString().padStart(2, '0')}">
        <div class="col-1 text-center">
          <label class="col-form-label label-font-size">${i.toString()}</label>
        </div>
        <div class="col-8-5">
        <select class="form-select selectpicker-dropdown-normal" data-live-search="true" 
          name="krathsh_${i.toString().padStart(2, '0')}"
          id="krathsh_${i.toString().padStart(2, '0')}"
          data-selected="${selectedKrathshValue}">
        </select>
      </div>
        <div class="col-0-3"></div>
        <div class="col-1-5">
          <input type="text" class="form-control input-contents right-align clearAble" name="ama_krathshs_${i.toString().padStart(2, '0')}" id="ama_krathshs_${i.toString().padStart(2, '0')}" value="${selectedAmaKrathshsValue}" maxlength="9" />
        </div>
        <div class="col-0-2"></div>
        <button type="button" class="btn rounded-4 mt-2 col-0-3 clear-row" id="clearSelectKrathseon-${i.toString().padStart(2, '0')}" style="border: 0;" data-bs-toggle="tooltip" title="Καθαρισμός του πεδίου Κράτηση" data-bs-placement="bottom" data-target="krathsh_${i.toString().padStart(2, '0')}">
          <i class="bi bi-trash" style="color: red"></i>
        </button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
  }
}

const loadKrathseis = async () => {
  let textToConvert;
  try {
    const response = await fetch('/api/krathseisErgazomenon', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();  // Σιγουρευτείτε ότι μετατρέπετε την απάντηση σε JSON

    for (let i = 1; i <= 7; i++) {
      const krathseisDropdown = document.getElementById(`krathsh_${i.toString().padStart(2, '0')}`);
      krathseisDropdown.innerHTML = '<option value="" selected></option>';
      data.forEach(krathsh => { 
        textToConvert = removeGreekAccentsAndToUpper(krathsh.perigrafh);
        const option = new Option(krathsh.kodikos.padEnd(10, '\u00A0') + textToConvert, krathsh.kodikos);
        if (krathsh.kodikos === krathseisDropdown.getAttribute("data-selected")) {
          option.selected = true;
        }
          krathseisDropdown.appendChild(option);  // Προσθήκη option στο dropdown
      });
    }
  } catch (error) {
    console.error('Error loading krathseis:', error);
  }
};
