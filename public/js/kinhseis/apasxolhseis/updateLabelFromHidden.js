  // Συνάρτηση για ενημέρωση των labels από ένα hidden πεδίο
  function updateLabelsFromHidden(hiddenFieldId, labelIds) {
      const hiddenValue = document.getElementById(hiddenFieldId).value;
      labelIds.forEach(labelId => {
          document.getElementById(labelId).textContent = hiddenValue;
      });
  }
