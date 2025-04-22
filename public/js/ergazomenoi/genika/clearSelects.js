document.addEventListener('DOMContentLoaded', function() {
  const selects = {
    symbash: document.getElementById('symbash'),
    kathgoria: document.getElementById('kathgoria_symbashs'),
    eidikothta: document.getElementById('eidikothta_symbashs')
  };

  // Ορισμός της συνάρτησης clearRowOnly εδώ
  function clearRowOnly(rowId, recalc) {
    console.log('Clearing row:', rowId);
    const row = document.getElementById(rowId);
    if (row) {
      row.querySelectorAll('input, select').forEach(input => input.value = '');
    }
    if (recalc) calculateTotal();
  }

  function clearAndDisable(select, disable = false) {
    if (select) {
      select.value = '';
      select.disabled = disable;
    }
  }

  function clearAndHideRows() {
    for (let i = 1; i <= 15; i++) {
      const row = document.getElementById(`row_${i.toString().padStart(2, '0')}`);
      if (row) {
        row.querySelectorAll('input, select').forEach(input => input.value = '');
        row.classList.add('d-none');
      }
    }
    calculateTotal();
  }

  document.querySelectorAll('button[id^="clearSelectSymbaseon-"]').forEach(button => {
    button.addEventListener('click', function() {
      const buttonId = button.id;
      const suffix = buttonId.match(/\d+$/)[0];
      
      if (suffix === '001') {
        clearAndDisable(selects.symbash);
        clearAndDisable(selects.kathgoria, true);
        clearAndDisable(selects.eidikothta, true);
        clearAndHideRows();
      } else if (suffix === '002') {
        clearAndDisable(selects.kathgoria);
        clearAndDisable(selects.eidikothta, true);
        clearAndHideRows();
      } else if (suffix === '003') {
        clearAndDisable(selects.eidikothta);
        clearAndHideRows();
      } else if (parseInt(suffix, 10) >= 1 && parseInt(suffix, 10) <= 15) {
        const reCalc = true;
        const rowId = `row_${suffix}`;
        clearRowOnly(rowId, reCalc);
      }
    });
  });

  document.querySelectorAll('button[id^="clearSelectKrathseon-"]').forEach(button => {
    button.addEventListener('click', function() {
      const buttonId = button.id;
      const suffix = buttonId.match(/\d+$/)[0];
      const reCalc = false;
      if (parseInt(suffix, 10) >= 1 && parseInt(suffix, 10) <= 7) {
        const rowId = `row_Kra_${suffix}`;
        clearRowOnly(rowId, reCalc);
      }
    });
  });
});
