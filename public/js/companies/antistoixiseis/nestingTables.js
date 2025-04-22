document.addEventListener('DOMContentLoaded', () => {
  let selectedRowId = null;

  document.querySelectorAll('#myTable tr[data-id]').forEach(row => {
    row.addEventListener('click', async function() {
      const krathshId = this.dataset.id;
      const collapseElement = document.getElementById(`antistoixiseis${krathshId}`);
      const icon = this.querySelector('.btn-nesting i');

      if (krathshId === selectedRowId) {
        collapseElement.classList.remove('show');
        selectedRowId = null;
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
        icon.classList.remove('icon-white');
      } else {
        if (selectedRowId) {
          const prevSelectedRow = document.querySelector(`#myTable tr[data-id="${selectedRowId}"]`);
          const prevCollapseElement = document.getElementById(`antistoixiseis${selectedRowId}`);
          const prevIcon = prevSelectedRow.querySelector('.btn-nesting i');

          prevCollapseElement.classList.remove('show');
          prevIcon.classList.remove('bi-chevron-up');
          prevIcon.classList.add('bi-chevron-down');
          prevIcon.classList.remove('icon-white');
        }

        collapseElement.classList.add('show');
        selectedRowId = krathshId;
        icon.classList.add('bi-chevron-up');
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('icon-white');

        if (!collapseElement.dataset.loaded) {
          try {
            const response = await fetch(`/api/companies/antistoixiseis/getAntistoixiseis/${krathshId}`);
            if (!response.ok) throw new Error('Network response was not ok');
              const antistoixiseisData = await response.json();

              let tableContent = `
              <table class="table table-striped table-bordered table-sm table-hover">
                <thead>
                  <tr>
                    <th class="col-1-5 text-center nested-table-header"></th>
                    <th class="col-0-5 text-center nested-table-header"></th>
                    <th colspan="2" class="col-2 text-center nested-table-header">Μετατροπή Τύπων Αποδοχών</th>
                    <th class="col-1 text-center nested-table-header"></th>
                    <th class="col-1 text-center nested-table-header"></th>
                  </tr>
                  <tr>
                    <th class="col-1-5 text-center nested-table-header"></th>
                    <th class="col-0-5 text-center nested-table-header">Κ.Π.Κ.</th>
                    <th class="col-1 text-center nested-table-header">Από</th>
                    <th class="col-1 text-center nested-table-header">Σε</th>
                    <th class="col-1 text-center nested-table-header">Κ.Α.Δ.</th>
                    <th class="col-1 text-center nested-table-header">Ειδικότητα</th>
                  </tr>
                </thead>
              <tbody>`;

              antistoixiseisData.forEach(antistoixish => {
                tableContent += `
                <tr  onclick="selectRow(this)" data-id="${antistoixish._id}">
                  <th class="col-1-5 text-center" style="font-size: 0.9vw;"></th>
                  <td class="col-0-5 text-center" style="font-size: 0.9vw;">${antistoixish.kpk}</td>
                  <td class="col-1 text-center" style="font-size: 0.9vw;">${antistoixish.apo_typos_apodoxon}</td>
                  <td class="col-1 text-center" style="font-size: 0.9vw;">${antistoixish.se_typos_apodoxon}</td>
                  <td class="col-1 text-center" style="font-size: 0.9vw;">${antistoixish.kad}</td>
                  <td class="col-1 text-center" style="font-size: 0.9vw;">${antistoixish.eidikothta}</td>
                </tr>`;
              });

              tableContent += '</tbody></table>';
              collapseElement.innerHTML = tableContent;
              collapseElement.dataset.loaded = true;
            } catch (error) {
              console.error('Failed to fetch antistoixiseis data:', error);
            }
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
