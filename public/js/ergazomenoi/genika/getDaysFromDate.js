document.addEventListener('DOMContentLoaded', function() {
  // const allaghInputApo = document.getElementById('hmeromhnia_proslhpshs');
  const allaghInputApo = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
  const allaghInputEos = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

  allaghInputApo.addEventListener('input', function() {
      updateDateFieldFrom(allaghInputApo, allaghInputEos);
  });

  allaghInputEos.addEventListener('input', function() {
      updateDates();
  });

  // Καλούμε την ανανέωση ημερομηνιών κατά την αρχική φόρτωση σε περίπτωση που υπάρχουν ήδη δεδομένα
  updateDates();
});

function updateDateFieldFrom(sourceInput, targetInput) {
  const dateValue = new Date(sourceInput.value);
  if (isValidDate(dateValue)) {
      targetInput.value = sourceInput.value;
      updateDates();
  }
}

function updateDates() {
  const baseDateInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
  if (!baseDateInput.value) {
    return;
  }

  const baseDate = new Date(baseDateInput.value);

  // Reset existing values
  document.querySelectorAll('.input-date').forEach((input, index) => {
    // if (input.tagName.toLowerCase() === 'input' && input.type === 'date') {
    //   input.value = '';
    // }
    input.value = '';
    input.style.color = '';
    const checkboxId = `argia_${input.id.match(/\d+/)[0].padStart(2, '0')}`;
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) checkbox.checked = false;
    
    const dayLabelId = `day_label_${String(index + 1).padStart(2, '0')}`;
    const dayLabelElement = document.getElementById(dayLabelId);
    if (dayLabelElement) {
      dayLabelElement.style.color = '';
      dayLabelElement.textContent = '';
    }

    const holidayId = `perigrafh_argias_${String(index + 1).padStart(2, '0')}`;
    const holidayElement = document.getElementById(holidayId);
    if (holidayElement) {
      holidayElement.style.color = '';
      holidayElement.value = '';
    }
  });

  // Update new dates and labels
  document.querySelectorAll('.input-date').forEach((input, index) => {
      let newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + index);
      input.value = newDate.toISOString().split('T')[0];
      const dayLabelElement = document.getElementById(`day_label_${String(index + 1).padStart(2, '0')}`);
      if (dayLabelElement) {
          dayLabelElement.textContent = getDayLabel(newDate.getDay());
          dayLabelElement.style.color = 'black';
      }
  });

  // Έλεγχος για αργίες και χρωματισμός ημερών
  checkForHolidays();
}

function getDayLabel(dayIndex) {
  const days = ["Κυ", "Δε", "Τρ", "Τε", "Πε", "Πα", "Σα"];
  return days[dayIndex];
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

async function checkForHolidays() {
  const dates = Array.from(document.querySelectorAll('.input-date')).map(input => {
    const date = new Date(input.value);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString().replace('.000Z', '.000+00:00');
  });

  try {
    const response = await fetch('/api/checkArgies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dates })
    });

    const holidays = await response.json();

    document.querySelectorAll('.input-date').forEach(input => {
      const date = new Date(input.value);
      const dayIndex = date.getDay();  // 0 = Κυριακή
      const foundHoliday = holidays.find(h => h.date === input.value);

      const inputId = input.id;
      const dayLabelId = `day_label_${inputId.match(/\d+/)[0].padStart(2, '0')}`;
      const holidayId = `perigrafh_argias_${inputId.match(/\d+/)[0].padStart(2, '0')}`;
      const dayLabelElement = document.getElementById(dayLabelId);
      const holidayElement = document.getElementById(holidayId);

      if (foundHoliday) {
        input.style.color = 'red';
        if (dayLabelElement && holidayElement) {
          dayLabelElement.style.color = 'red';
          holidayElement.style.color = 'red';
          holidayElement.value = ` ( ${foundHoliday.description} )`;
          document.getElementById(`argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).checked = true;
          document.getElementById(`label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).textContent = 'ΝΑΙ';
        }
      } else if (dayIndex === 0) {  // Κυριακή και όχι αργία
        input.style.color = '#db7500';
        if (dayLabelElement) {
          dayLabelElement.style.color = '#db7500';
        }
        document.getElementById(`argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).checked = false;
        document.getElementById(`label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).textContent = 'ΟΧΙ';
      } else {
        input.style.color = 'black';  // Default color
        if (dayLabelElement) {
          dayLabelElement.style.color = 'black';
        }
        document.getElementById(`argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).checked = false;
        document.getElementById(`label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).textContent = 'ΟΧΙ';
      }
    });
  } catch (error) {
    console.error('Error checking holidays:', error);
  }
}
