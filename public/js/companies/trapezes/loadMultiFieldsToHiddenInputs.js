document.addEventListener('DOMContentLoaded', () => {
  const selectEl = document.getElementById('perigrafh');
  const hiddenCode = document.getElementById('kodikos_dias_stathera');
  const hiddenDesc = document.getElementById('perigrafh_stathera');

  function updateHiddenFromSelect() {
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) { hiddenDesc.value = ''; return; }

    // 1) kodikos_dias: αν δεν έχει ήδη γραφτεί από το tom-dropdown, πάρε το value
    if (!hiddenCode.value) hiddenCode.value = opt.value;

    // 2) perigrafh: προτίμησε data-perigrafh, αλλιώς πάρε το κείμενο μετά το " - "
    if (opt.dataset && opt.dataset.perigrafh) {
      hiddenDesc.value = opt.dataset.perigrafh.trim();
    } else {
      const txt = (opt.text || '').trim();
      const m = txt.match(/^\s*\S+\s*-\s*(.*)$/); // πχ "016 - ATTICA BANK ..." -> "ATTICA BANK ..."
      hiddenDesc.value = (m ? m[1] : txt).trim();
    }

    // αν θες να ειδοποιούνται άλλοι listeners
    hiddenCode.dispatchEvent(new Event('change'));
    hiddenDesc.dispatchEvent(new Event('change'));
  }

  // όταν αλλάζει επιλογή
  selectEl.addEventListener('change', updateHiddenFromSelect);

  // αρχικοποίηση (π.χ. όταν γίνεται preselect ασύγχρονα)
  // μικρή καθυστέρηση για να έχει γεμίσει το select από το tom-dropdown
  setTimeout(updateHiddenFromSelect, 0);
});
