function initializeSelectListeners() {
  const selects = document.querySelectorAll('select[id^="kathgoria_ergasias_"]');
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="repo_"]');

  selects.forEach(select => {
    select.addEventListener('change', function() {
      const idNum = this.id.match(/\d+$/)[0].padStart(2, '0');
      const checkBox = document.querySelector('#repo_' + idNum);
      const label = document.querySelector('#label-repo_' + idNum);
      const dateField = document.querySelector('#hmeromhnia_' + idNum);

      checkBox.checked = this.value === 'ΑΝ';
      label.textContent = this.value === 'ΑΝ' ? 'ΝΑΙ' : 'ΟΧΙ';
      updateNumericFields(idNum, this.value);
      
      if (this.value === 'ΑΝ' || this.value === 'ΜΕ') {
        handleHoliday(dateField, idNum, checkBox, this.value);
      }
    });
  });

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('click', function() {
      const idNum = this.id.match(/\d+$/)[0].padStart(2, '0');
      const selectMenu = document.querySelector('#kathgoria_ergasias_' + idNum);
      const label = document.querySelector('#label-repo_' + idNum);
      const argia = document.querySelector('#label-argia_' + idNum);
      const dateField = document.querySelector('#hmeromhnia_' + idNum);

      if (this.checked) {
        selectMenu.value = 'ΑΝ';
        label.textContent = 'ΝΑΙ';
      } else {
        selectMenu.value = isHoliday(dateField) ? 'ΜΕ' : '';
        label.textContent = 'ΟΧΙ';
      }

      updateNumericFields(idNum, selectMenu.value);
      handleHoliday(dateField, idNum, this, selectMenu.value);
    });
  });
};

function handleHoliday(dateField, idNum, checkbox, selectValue) {
  if (isHoliday(dateField) && (checkbox.checked || selectValue === 'ΑΝ')) {
    alert(`Η ημερομηνία είναι αργία. Μπορείτε να επιλέξετε Repo, με δική σας ευθύνη.`);
  }
}

function isHoliday(dateField) {
  return dateField && dateField.style.color === 'red';
}

function updateNumericFields(idNum, selectValue) {
  const timeFields = ['apo_ora', 'eos_ora', 'dialleima_apo_ora', 'dialleima_eos_ora'];
  const specialCategory = document.getElementById("eidikh_kathgoria_ergazomenoy").value;
  const isSpecialCategory = specialCategory === "0004" || specialCategory === "0005";

  timeFields.forEach(field => {
    for (let j = 1; j <= 3; j++) {
      const timeInput = document.querySelector(`#${field}_0${j}_${idNum}`);
      if (timeInput) {
        if (selectValue === 'ΑΝ' || selectValue === 'ΜΕ') {
          // Disable all fields if select value is 'ΑΝ' or 'ΜΕ'
          timeInput.disabled = true;
        } else {
          // Enable fields when j is 1 or 2, regardless of the special category
          if (j === 1 || j === 2) {
            timeInput.disabled = false;
          }
          // Enable fields when j is 3 and the special category is '0004' or '0005'
          else if (j === 3 && isSpecialCategory) {
            timeInput.disabled = false;
          } else {
            // Disable fields when j is 3 and not a special category
            timeInput.disabled = true;
          }
        }
      }
    }
  });
}
