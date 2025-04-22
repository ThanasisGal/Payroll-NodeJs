document.addEventListener('DOMContentLoaded', (event) => {
  document.querySelectorAll('.btn-nesting').forEach(button => {
    button.addEventListener('click', async function() {
      const krathshId = this.getAttribute('data-bs-target').replace('#pososta', '');
      const posostaDiv = document.getElementById(`pososta${krathshId}`);
      const icon = this.querySelector('i');

      // Toggle icon
      icon.classList.toggle('bi-chevron-down');
      icon.classList.toggle('bi-chevron-up');

      if (!posostaDiv.dataset.loaded) {
        try {
          const response = await fetch(`/api/krathseis/getPosostaKrathseon/${krathshId}`);
          if (!response.ok) throw new Error('Network response was not ok');
          const posostaData = await response.json();

          let posostaContent = `
          <table class="table table-striped table-bordered table-sm table-hover">
            <thead>
              <tr>
                <th class="col-0-5 text-center nested-table-header">α/α</th>
                <th class="col-1 text-center nested-table-header">Ισχύει Από</th>
                <th class="col-1 text-center nested-table-header">Ισχύει Εως</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-percent" style="font-size: 1.2rem; font-weight: 700"></i> Εργαζ/νου</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-percent" style="font-size: 1.2rem; font-weight: 700"></i> Εργοδότη</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-percent" style="font-size: 1.2rem; font-weight: 700"></i> ΣΥΝΟΛΟ</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-currency-euro" style="font-size: 1.2rem; font-weight: 700"></i> Εργαζ/νου</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-currency-euro" style="font-size: 1.2rem; font-weight: 700"></i> Εργοδότη</th>
                <th class="col-1 text-right nested-table-header"><i class="bi bi-currency-euro" style="font-size: 1.2rem; font-weight: 700"></i> ΣΥΝΟΛΟ</th>
                <th class="col-1 text-right nested-table-header">Αν. Όριο Παλιών</th>
                <th class="col-1 text-right nested-table-header">Αν. Όριο Νέων</th>
              </tr>
            </thead>
            <tbody>`;
          let options = { day: '2-digit', month: '2-digit', year: 'numeric' };
          let aa = posostaData.length + 1

          posostaData.forEach(pososto => {
            let date_apo = new Date(pososto.isxyei_apo).toLocaleDateString('el-GR', options);
            let date_eos = new Date(pososto.isxyei_eos).toLocaleDateString('el-GR', options);
            aa -= 1;
            posostaContent += `
              <tr onclick="selectRow(this)" data-id="${pososto._id}">
                <td class="col-0-5 text-right field-required" style="background-color: #19875450; font-size: 0.9vw;">${aa.toFixed(0)}</td>
                <td class="col-1 text-center" style="font-size: 0.9vw;">${date_apo}</td>
                <td class="col-1 text-center" style="font-size: 0.9vw;">${date_eos}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.pososto_ergazomenoy.toFixed(4)}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.pososto_ergodoth.toFixed(4)}</td>
                <td class="col-1 text-right field-required" style="background-color: #19875450; font-size: 0.9vw;">${pososto.synolo_pososton.toFixed(4)}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.poso_ergazomenoy.toFixed(2)}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.poso_ergodoth.toFixed(2)}</td>
                <td class="col-1 text-right field-required" style="background-color: #ffee0127; font-size: 0.9vw;">${pososto.synolo_poson.toFixed(2)}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.anotato_orio_palion.toFixed(2)}</td>
                <td class="col-1 text-right" style="font-size: 0.9vw;">${pososto.anotato_orio_neon.toFixed(2)}</td>
              </tr>`;
          });
          posostaContent += `
            </tbody>
          </table>`;
          posostaDiv.innerHTML = posostaContent;
          posostaDiv.dataset.loaded = "true";
        } catch (error) {
          console.error('Failed to fetch pososta data:', error);
        }
      } else {
        icon.classList.toggle('rotate');
        posostaDiv.classList.toggle('d-none');

        if (posostaDiv.classList.contains('d-none')) {
          const selectedNestedRows = posostaDiv.querySelectorAll('.selected-row');
          selectedNestedRows.forEach(row => row.classList.remove('selected-row'));
        }
      }
    });
  });
});

function selectRow(row) {
  const isSelected = row.classList.contains('selected-row');
  const siblings = row.parentElement.children;

  if (isSelected) {
    row.classList.remove('selected-row');
  } else {
    for (const sibling of siblings) {
      sibling.classList.remove('selected-row');
    }
    row.classList.add('selected-row');
  }
}
