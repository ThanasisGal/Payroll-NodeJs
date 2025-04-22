let currentValues = {};
let data = {};

let _AA_STOIXEIOY = 0,
    _APODOXES = 0, 
    _HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = 0, 
    _HMEROMISTHIO = 0,
    _MISTHOS = 0,
    _NOMIMO_OROMISTHIO = 0, 
    _PLHRHS_APASXOLHSH, 
    _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = 0,
    _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = 0, 
    _ORES_HMERHSIAS_ERGASIAS = 0, 
    _PRAGMATIKO_OROMISTHIO = 0,
    _PRAGMATIKOS_MISTHOS = 0,
    _SYNTELESTHS_EBDOMADON_HMEROMISTHION = 0, 
    _SYNTELESTHS_EBDOMADON_MISTHOTON = 0, 
    _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = 0, 
    totalSymbashs = 0,
    totalBaseiOronErgasias = 0,
    _TOTAL_EXTRA_APODOXES = 0;


document.addEventListener("DOMContentLoaded", function () {
  _PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
  generateSelectRowsOfSymbaseis();
  addEventListeners();
  calculateTotal();  
});

function generateSelectRowsOfSymbaseis() {
  const container = document.getElementById('stoixeiaSymbaseonContainer');
  container.innerHTML = ''; 

  for (let i = 1; i <= 15; i++) {
    const rowHTML = `
      <div class="row form-group align-items-center d-none showhide_row_${i.toString().padStart(2, '0')}" style="background-color: #ffffff; margin-left: -1rem; margin-right: -1rem; margin-bottom: -0.6rem !important;" id="row_${i.toString().padStart(2, '0')}">
        <div class="col-1 text-center">
          <label class="col-form-label label-font-size">${i.toString()}</label>
        </div>
        <div class="col-7">
          <select class="form-select selectpicker-dropdown-normal" data-live-search="true" name="stoixeio_symbashs_${i.toString().padStart(2, '0')}" id="stoixeio_symbashs_${i.toString().padStart(2, '0')}">
          </select>
        </div>
        <div class="col-1-5">
          <input type="number" class="form-control input-contents right-align clearAble" name="poso_symbashs_${i.toString().padStart(2, '0')}" id="poso_symbashs_${i.toString().padStart(2, '0')}"  style="background-color: #eeff0223;" readonly />
        </div>
        <div class="col-0-5"></div>
        <div class="col-1-5">
          <input type="text" class="form-control input-contents right-align numeric clearAble" name="poso_symbashs_basei_oron_ergasias_${i.toString().padStart(2, '0')}" id="poso_symbashs_basei_oron_ergasias_${i.toString().padStart(2, '0')}" style="background-color: #2b97001e" />
        </div>
        <button type="button" class="btn rounded-4 mt-2 col-0-3 clear-row" id="clearSelectSymbaseon-${i.toString().padStart(2, '0')}" style="border: 0;" data-bs-toggle="tooltip" title="Καθαρισμός του πεδίου Στοιχείο Σύμβασης" data-bs-placement="bottom" data-target="stoixeio_symbashs_${i.toString().padStart(2, '0')}">
          <i class="bi bi-trash" style="color: red"></i>
        </button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
  }
}

function addEventListeners() {
  const container = document.getElementById('stoixeiaSymbaseonContainer');
  container.addEventListener('change', handleChangeEvent);
  container.addEventListener('input', handleInputEvent);
}

async function handleChangeEvent(event) {
  if (event.target.matches('.form-select')) {
    const i = event.target.id.match(/\d+/)[0];
    _AA_STOIXEIOY = i;
    const selectedElement = event.target.value.toString().padStart(4, '0');
    const contract = document.getElementById("selectedSymbash").value.toString().padStart(4, '0');
    const category = document.getElementById("selectedKathgoria").value.toString().padStart(4, '0');
    const specialty = document.getElementById("selectedEidikothta").value.toString().padStart(4, '0');
    const klimakio = document.getElementById("misthologiko_klimakio").value.toString().padStart(2, '0');

    await updatePosoAndTotal(i, contract, category, specialty, selectedElement, klimakio);
  }
}

function handleInputEvent(event) {
  if (event.target.type === 'text' && event.target.classList.contains('numeric')) {
    const elementId = event.target.id;
    const newValue = parseFloat(event.target.value) || 0;
    const oldValue = currentValues[elementId] || 0;

    // Ανανεώνεται το _TOTAL_EXTRA_APODOXES με βάση τη διαφορά της νέας και της παλιάς τιμής
    _TOTAL_EXTRA_APODOXES += newValue - oldValue;

    // Καταγράφει τη νέα τιμή στο αντικείμενο currentValues
    currentValues[elementId] = newValue;

    formatNumericInput(event.target);

    data.poso = newValue;
    const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${_AA_STOIXEIOY.toString().padStart(2, '0')}`;
    let extraApodoxes = true;
    updateGeneralParameters(data.genikesParametroi);
    updatePosoBasedOnHours(_AA_STOIXEIOY, data, posoBasedOnHoursFieldId, extraApodoxes);

    calculateTotal();
  }
}

function formatNumericInput(input) {
  const cursorPosition = input.selectionStart;
  const originalValue = input.value;
  const newValue = parseFloat(originalValue).toFixed(2);

  if (newValue !== originalValue) {
    input.value = newValue;
    input.setSelectionRange(cursorPosition, cursorPosition);
  }
}

async function updatePosoAndTotal(i, contract, category, specialty, selectedElement, klimakio) {
    try {
        const hmeromhniaAllaghsSymbashs = document.getElementById("hmeromhnia_allaghs_symbashs").value;
        data = await fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, hmeromhniaAllaghsSymbashs);
        if (!data.success) {
            alert('Δεν έχουν ενημερωθεί τα κλιμάκια της επιλεγείσας σύμβασης');
            return;
        }
        updatePosoFields(i, data);
        if (parseFloat(data.poso) !== 0) calculateTotal();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, date) {
    const response = await fetch('/api/apodoxesErgazomenon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract, category, specialty, selectedElement, klimakio, date })
    });
    return await response.json();
}

function updatePosoFields(i, data) {
    const posoFieldId = `poso_symbashs_${i.toString().padStart(2, '0')}`;
    const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${i.toString().padStart(2, '0')}`;
    const posoField = document.getElementById(posoFieldId);

    posoField.value = data.poso;
    let extraApodoxes = false;
    updateGeneralParameters(data.genikesParametroi);
    updatePosoBasedOnHours(i, data, posoBasedOnHoursFieldId, extraApodoxes);
}

function updateGeneralParameters(parameters) {
    _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = parseFloat(parameters[0].timh);
    _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = parseFloat(parameters[1].timh);
    _SYNTELESTHS_EBDOMADON_MISTHOTON = parseFloat(parameters[2].timh);
    _SYNTELESTHS_EBDOMADON_HMEROMISTHION = parseFloat(parameters[3].timh);
    _ORES_HMERHSIAS_ERGASIAS = parseFloat(parameters[4].timh);
    _HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = parseFloat(parameters[5].timh);
    _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = parseFloat(document.getElementById("eidikhKathgoriaErgazomenoy").value);
}

function updatePosoBasedOnHours(i, data, posoBasedOnHoursFieldId, extraApodoxes) {
    const type = document.getElementById('typos_ergazomenon').value;
    const posoField = document.getElementById(`poso_symbashs_${i.toString().padStart(2, '0')}`);
    const posoBasedOnHoursField = document.getElementById(posoBasedOnHoursFieldId);
    const hours = parseFloat(document.getElementById("ores_ergasias_ebdomadas").value);
    const days = parseFloat(document.getElementById("hmeres_ergasias_ebdomadas").value);

    // Calculate value based on full or part-time work
    let calculatedValue = calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes);

    // Check if calculatedValue is NaN
    if (isNaN(calculatedValue)) {
        alert("Δεν είναι εφικτός ο υπολογισμός των αποδοχών βάσει των ωρών εργασίας γιατί δεν έχετε επιλέξει ΤΥΠΟ ΕΡΓΑΖΟΜΕΝΟΥ στην καρτέλλα Σταθερά Στοιχεία");
        posoBasedOnHoursField.value = parseFloat("0").toFixed(2);
    } else {
        posoBasedOnHoursField.value = parseFloat(calculatedValue).toFixed(2);
    }
}

function calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes) {
  let value = 0;

  if (_PLHRHS_APASXOLHSH.checked) {
    switch (type) {
      case "Μ":
        value = data.poso;
        break;
      case "Η":
        value = calculateMonthlyWage(data, hours, days, true, type, extraApodoxes);
        break;
      case "Ω":
        value = calculateHourlyWage(data, hours, days, true, extraApodoxes);
        break;
      default:
        value = NaN;
    }
  } else {
    switch (type) {
      case "Μ":
        value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes);
        break;
      case "Η":
        value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes);
        break;
      case "Ω":
        value = calculateHourlyWage(data, hours, days, false, extraApodoxes);
        break;
      default:
        value = NaN;
    }
  }

  return value;
}

function calculateHourlyWage(data, hours, days, fullTime, extraApodoxes) {
  let value = 0;

  switch (document.getElementById('eidikh_kathgoria_ergazomenoy').value) {
    case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
      if (parseFloat(data.poso) !== 0) {
        if (!extraApodoxes) {
          _NOMIMO_OROMISTHIO = ((6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS) / 25) * parseFloat(data.poso);

          if (fullTime) {
            value = _NOMIMO_OROMISTHIO * hours * _SYNTELESTHS_EBDOMADON_MISTHOTON;
          } else {
            _PRAGMATIKO_OROMISTHIO = ((6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS) / 25) * (parseFloat(data.poso));
            value = _PRAGMATIKO_OROMISTHIO * hours * _SYNTELESTHS_EBDOMADON_MISTHOTON;
          }
        } else {
          value = parseFloat(data.poso);
        }
      }
      break;
    default:
      value = NaN;
  }

  return value;
}

function calculateMonthlyWage(data, hours, days, fullTime, type, extraApodoxes) {
  let value = 0;
  if (parseFloat(data.poso) !== 0) {
    if (!extraApodoxes) {
      // Υπολογισμός του _NOMIMO_OROMISTHIO ανάλογα με τον τύπο
      _NOMIMO_OROMISTHIO = (type === "Μ") 
      ? parseFloat(data.poso) / _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS 
      : parseFloat(data.poso) * _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO;

      _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO

      value = _PRAGMATIKO_OROMISTHIO * hours * (type === "Μ" ? _SYNTELESTHS_EBDOMADON_MISTHOTON : _SYNTELESTHS_EBDOMADON_HMEROMISTHION);
    } else {
      value = parseFloat(data.poso);
    }
  }  
  return value;
}

async function calculateTotal() {
  totalSymbashs = 0, totalBaseiOronErgasias = 0, _TOTAL_EXTRA_APODOXES = 0, _PRAGMATIKO_OROMISTHIO = 0;
  const nomimosMisthos = document.getElementById('nomimosMisthos');
  const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
  const nomimoOromisthio = document.getElementById('nomimoOromisthio');
  const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
  const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
  const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');
  const ores_ergasias_ebdomadas = parseFloat(document.getElementById("ores_ergasias_ebdomadas").value) || 0;
  const hmeres_ergasias_ebdomadas = parseFloat(document.getElementById("hmeres_ergasias_ebdomadas").value) || 0;

  for (let i = 1; i <= 15; i++) {
    const posoInput = document.getElementById(`poso_symbashs_${i.toString().padStart(2, '0')}`);
    const posoInputBaseiOron = document.getElementById(`poso_symbashs_basei_oron_ergasias_${i.toString().padStart(2, '0')}`);
    totalSymbashs += parseFloat(posoInput.value) || 0;
    totalBaseiOronErgasias += parseFloat(posoInputBaseiOron.value) || 0;
    if (parseFloat(posoInputBaseiOron.value) !== 0 && parseFloat(posoInput.value) === 0) {
      _TOTAL_EXTRA_APODOXES += parseFloat(posoInputBaseiOron.value) || 0;
    }
  }

  document.getElementById('synolo_symbashs').value = totalSymbashs.toFixed(2) || "0.00";
  document.getElementById('synolo_symbashs_basei_oron_ergasias').value = totalBaseiOronErgasias.toFixed(2) || "0.00";
  
  if (_PLHRHS_APASXOLHSH.checked) {
    switch (document.getElementById('typos_ergazomenon').value) {
      case "Ω":
        switch (document.getElementById('eidikh_kathgoria_ergazomenoy').value) {
          case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
            _NOMIMO_OROMISTHIO = (6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS / 25) * totalSymbashs;
            _PRAGMATIKO_OROMISTHIO = (6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS / 25) * totalBaseiOronErgasias;
            nomimosMisthos.value = (_NOMIMO_OROMISTHIO * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON).toFixed(2);
            nomimoHmeromisthio.value = parseFloat(_NOMIMO_OROMISTHIO * (parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas))).toFixed(2);
            nomimoOromisthio.value = _NOMIMO_OROMISTHIO.toFixed(4);
            pragmatikosMisthos.value = totalBaseiOronErgasias.toFixed(2);
            pragmatikoHmeromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO * (parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas))).toFixed(2);
            pragmatikoOromisthio.value = _PRAGMATIKO_OROMISTHIO.toFixed(4);
            break;
        }
        break;
      case "Μ":
        _NOMIMO_OROMISTHIO = totalSymbashs / _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS;
        _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias / _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS;
        nomimosMisthos.value = (_NOMIMO_OROMISTHIO * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON).toFixed(2);
        nomimoHmeromisthio.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(_ORES_HMERHSIAS_ERGASIAS)).toFixed(2);
        nomimoOromisthio.value = _NOMIMO_OROMISTHIO.toFixed(4);

        pragmatikosMisthos.value = (_PRAGMATIKO_OROMISTHIO * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON).toFixed(2);
        pragmatikoHmeromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO * (parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas))).toFixed(2);
        pragmatikoOromisthio.value = _PRAGMATIKO_OROMISTHIO.toFixed(4);
        break;
      case "Η":
        _NOMIMO_OROMISTHIO = totalSymbashs * _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO;
        _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias / (parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_HMEROMISTHION);
        nomimosMisthos.value = (_NOMIMO_OROMISTHIO * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_HMEROMISTHION).toFixed(2);
        nomimoHmeromisthio.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(_ORES_HMERHSIAS_ERGASIAS)).toFixed(2);
        nomimoOromisthio.value = _NOMIMO_OROMISTHIO.toFixed(4);
        pragmatikosMisthos.value = parseFloat(totalBaseiOronErgasias).toFixed(2);

        if (ores_ergasias_ebdomadas !== 0 && hmeres_ergasias_ebdomadas !== 0 && _PRAGMATIKO_OROMISTHIO !== 0) {
          pragmatikoHmeromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO * (parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas))).toFixed(2);
        } else {
          pragmatikoHmeromisthio.value = "0.00";
        }
        pragmatikoOromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO).toFixed(4);
        break;
    }

  } else {

    let _ores_apasxolhshs = parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas);

    switch (document.getElementById('typos_ergazomenon').value) {
      case "Ω":
        switch (document.getElementById('eidikh_kathgoria_ergazomenoy').value) {
          case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
            _NOMIMO_OROMISTHIO = (6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS / 25) * totalSymbashs;
            _PRAGMATIKO_OROMISTHIO = (totalBaseiOronErgasias) / (parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON) ;

            nomimosMisthos.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON).toFixed(2)
            nomimoHmeromisthio.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(_ores_apasxolhshs)).toFixed(2);
            nomimoOromisthio.value = parseFloat(_NOMIMO_OROMISTHIO).toFixed(4);

            pragmatikosMisthos.value = parseFloat(totalBaseiOronErgasias).toFixed(2);

            if (ores_ergasias_ebdomadas !== 0 && hmeres_ergasias_ebdomadas !== 0 && _PRAGMATIKO_OROMISTHIO !== 0) {
              pragmatikoHmeromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO * (parseFloat(ores_ergasias_ebdomadas) / parseFloat(hmeres_ergasias_ebdomadas))).toFixed(2);
            } else {
              pragmatikoHmeromisthio.value = "0.00";
            }
            pragmatikoOromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO).toFixed(4);
            break;
        }
        break;
      case "Μ":
        _NOMIMO_OROMISTHIO = totalSymbashs / _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS;

        _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias / (parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON);
        
        nomimosMisthos.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_MISTHOTON).toFixed(2);
        nomimoHmeromisthio.value = (parseFloat(_NOMIMO_OROMISTHIO) * _ores_apasxolhshs).toFixed(2);
        nomimoOromisthio.value = parseFloat(_NOMIMO_OROMISTHIO).toFixed(4);
        pragmatikosMisthos.value = parseFloat(totalBaseiOronErgasias).toFixed(2);

        if (ores_ergasias_ebdomadas !== 0 && hmeres_ergasias_ebdomadas !== 0 && _PRAGMATIKO_OROMISTHIO !== 0) {
          pragmatikoHmeromisthio.value = (parseFloat(_PRAGMATIKO_OROMISTHIO) * parseFloat(_ores_apasxolhshs)).toFixed(2);
        } else {
          pragmatikoHmeromisthio.value = "0.00";
        }
        pragmatikoOromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO).toFixed(4);
    break;
      case "Η":
        _NOMIMO_OROMISTHIO = totalSymbashs * _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO;

        _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias / (parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_HMEROMISTHION);
       
        nomimosMisthos.value = (_NOMIMO_OROMISTHIO * parseFloat(ores_ergasias_ebdomadas) * _SYNTELESTHS_EBDOMADON_HMEROMISTHION).toFixed(2);
        nomimoHmeromisthio.value = (parseFloat(_NOMIMO_OROMISTHIO) * parseFloat(_ores_apasxolhshs)).toFixed(2);
        nomimoOromisthio.value = _NOMIMO_OROMISTHIO.toFixed(4);
        pragmatikosMisthos.value = parseFloat(totalBaseiOronErgasias).toFixed(2);

        if (ores_ergasias_ebdomadas !== 0 && hmeres_ergasias_ebdomadas !== 0 && _PRAGMATIKO_OROMISTHIO !== 0) {
          pragmatikoHmeromisthio.value = (parseFloat(_PRAGMATIKO_OROMISTHIO) * parseFloat(_ores_apasxolhshs)).toFixed(2);
        } else {
          pragmatikoHmeromisthio.value = "0.00";
        }
        pragmatikoOromisthio.value = parseFloat(_PRAGMATIKO_OROMISTHIO).toFixed(4);
        break;
    }
  }
  setupAutomaticRecalculation();
}

function setupAutomaticRecalculation() {
  const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio').value;
  const isOromisthioValid = pragmatikoOromisthio && !isNaN(pragmatikoOromisthio) && parseFloat(pragmatikoOromisthio) !== 0;

  if (isOromisthioValid) {
    const ids = [
      'hmeromhnia_allaghs_symbashs', 
      'proyphresia_se_eth',
      'proyphresia_se_mhnes',
      'eidikh_kathgoria_ergazomenoy', 
      'plhrhs_apasxolhsh', 
      'hmeres_ergasias_ebdomadas', 
      'ores_ergasias_ebdomadas', 
      'typos_ergazomenon', 
      'misthologiko_klimakio'
    ];

    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', reCalculate);
      }
    });
  }
}
