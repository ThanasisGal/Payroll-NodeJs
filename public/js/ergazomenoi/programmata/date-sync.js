document.addEventListener('DOMContentLoaded', function() {
  const hmeromhniaProslhpshs = document.getElementById('hmeromhnia_proslhpshs_hidden');
  const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
  const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

  orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
  orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

  async function handleProslhpshChange() {
    setAllDates(this.value);
    await updateOrarioyEosDate(this.value);
  }

  document.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Tab') {
        event.preventDefault();
  
        // Αποκτούμε όλα τα στοιχεία της φόρμας με την κατάλληλη σειρά
        const formElements = Array.from(document.querySelectorAll('input, select, textarea, button'));
        const index = formElements.indexOf(this);
  
        // Εύρεση του επόμενου στοιχείου
        const nextInput = formElements[index + 1];
        if (nextInput) {
          setTimeout(() => nextInput.focus(), 0); // Δίνουμε focus στο επόμενο στοιχείο
        }
      }
    });
  });

  function handleAllaghsChange() {
    setAllDates(this.value);
  }

  function handleOrarioyApoChange() {
    if (hmeromhniaProslhpshs.value > this.value) {
      const etos = parseInt(hmeromhniaProslhpshs.value.substring(0,4));
      const mhnas = parseInt(hmeromhniaProslhpshs.value.substring(5,7));
      const hmera = parseInt(hmeromhniaProslhpshs.value.substring(8,10));
  
      alert(`Η Ημερoμηνία πρόσληψης είναι η ${hmera}/${mhnas}/${etos}. Δεν επιτρέπεται να δώσετε μικρότερη απ' αυτή την ημερομηνία.`);
      this.value = hmeromhniaProslhpshs.value;
    }
    updateOrarioyEosDate(this.value);
  }

  function getLastDayOfMonth(date) {
    // Δημιουργία ημερομηνίας για τον επόμενο μήνα
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    // Επιστροφή της τελευταίας ημέρας του τρέχοντος μήνα
    return new Date(nextMonth - 1);
  }

  async function handleOrarioyEosChange() {
    const eosDate = this.value;
    const apoDate = orarioyApoInput.value;
    let isValidDateChange = await validateDateChange(apoDate, eosDate);
    if (eosDate === "") {
      isValidDateChange = false;
    }

    if (!isValidDateChange) {
      let maxEosDate = new Date(apoDate);
      const formattedApoDate = formatDate(new Date(apoDate));
      const lastDayOfMonth = getLastDayOfMonth(maxEosDate);
      const formattedMaxDate = formatDate(lastDayOfMonth);

      alert(`Η Ημερ/νία Αλλαγής Ωραρίου πρέπει να αφορά μόνο το συγκεκριμένο μήνα και να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`);

      this.value = formatDateToISO(lastDayOfMonth); // Reset to valid max date
    }
    const startDate = document.getElementById('hmeromhnia_allaghs_orarioy_apo').value;
    const endDate = this.value;
    updateDateDifference(startDate, endDate);
  }

  function setAllDates(value) {
    allaghsSymbashsInput.value = value;
    orarioyApoInput.value = value;
  }

  async function updateOrarioyEosDate(startDate) {
    const etos = parseInt(startDate.substring(0,4));
    const mhnas = parseInt(startDate.substring(5,7));
    const hmera = parseInt(startDate.substring(8,10));
    const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
    const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;

    const startDateParsed = new Date(startDate);
    startDateParsed.setDate(startDateParsed.getDate() + differenceDaysToEndOfMonth); // Προσθέτει την διαφορά μεταξύ της τελευταίας ημέρας του μήνα και της ημέρας startDate
    const eosDate = formatDateToISO(startDateParsed);
    orarioyEosInput.value = eosDate;
    await updateDateDifference(startDate, eosDate);
  }

  async function validateDateChange(apoDate, eosDate) {
    const etos = parseInt(apoDate.substring(0,4));
    const mhnas = parseInt(apoDate.substring(5,7));
    const hmera = parseInt(apoDate.substring(8,10));
    const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
    const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;
    const formattedApoDate = formatDate(new Date(apoDate));
    
    const maxDate = new Date(new Date(apoDate).setDate(new Date(apoDate).getDate() + differenceDaysToEndOfMonth));
    const formattedMaxDate = formatDate(maxDate);
    document.getElementById("differenceDaysToEndOfMonth").value = differenceDaysToEndOfMonth;

    if (new Date(eosDate) < new Date(apoDate) || new Date(eosDate) > maxDate) {
      alert(`Η Ημερ/νία Αλλαγής Ωραρίου ΕΩΣ πρέπει να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`);
      return false;
    }
    return true;
  }

  async function loadKathgoriesErgasias() {
    try {
      const response = await fetch('/api/kathgoriesErgasias', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const differenceInDays = parseInt(document.getElementById('differenceInDays').value);

      for (let i = 1; i <= differenceInDays; i++) {  
        const kathgoriesErgasiasDropdown = document.getElementById(`kathgoria_ergasias_${i.toString().padStart(2, '0')}`);

        const emptyOption = document.createElement("option");
        emptyOption.textContent = "";
        emptyOption.value = "";
        kathgoriesErgasiasDropdown.appendChild(emptyOption);
  
        data.forEach(kathgoriaErgasias => {
          const option = document.createElement("option");
          option.value = kathgoriaErgasias.kodikos;
          option.textContent = removeGreekAccentsAndToUpper(kathgoriaErgasias.perigrafh);
          try {
            if (kathgoriaErgasias.kodikos === kathgoriesErgasiasDropdown.getAttribute("data-selected").trim()) {
              option.selected = true;
            }
          } catch (error) {}
          kathgoriesErgasiasDropdown.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async function createEmptyObjectWithDate(currentDate, team, company_kod, kodikos) {
    return {
      team: team,
      company_kod: company_kod,
      kodikos: kodikos,
      hmeromhnia: currentDate.toISOString(),
      kathgoria_ergasias: "",
      apo_ora_01: null,
      eos_ora_01: null,
      apo_ora_02: null,
      eos_ora_02: null,
      apo_ora_03: null,
      eos_ora_03: null,
      dialleima_apo_ora_01: null,
      dialleima_eos_ora_01: null,
      dialleima_apo_ora_02: null,
      dialleima_eos_ora_02: null,
      dialleima_apo_ora_03: null,
      dialleima_eos_ora_03: null,
      repo: false,
      adeia: false,
      astheneia: false,
      argia: false,
      perigrafh_argias: "",
      kathgoria_adeias: "",
      ores_ergasias: 0,
      ores_nyxtas: 0,
      ores_argion: 0,
      ores_yperergasias: 0,
      ores_yperergasias_nyxtas: 0,
      ores_yperergasias_argion: 0,
      ores_yperergasias_argion_nyxtas: 0,
      ores_nominhs_yperorias: 0,
      ores_nominhs_yperorias_nyxtas: 0,
      ores_nominhs_yperorias_argion: 0,
      ores_nominhs_yperorias_argion_nyxtas: 0,
      ores_paranomhs_yperorias: 0,
      ores_paranomhs_yperorias_nyxtas: 0,
      ores_paranomhs_yperorias_argion: 0,
      ores_paranomhs_yperorias_argion_nyxtas: 0
    }
  }

  async function updateDateDifference(startDate, endDate) {

    try {
      const response = await fetch('/api/dateDifference', {     // Υπολογίζει την διαφορά ημερών έως-από
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
      });
      const data = await response.json();
      document.getElementById('differenceInDays').value = data.differenceInDays;

      const team = document.getElementById('team').value;
      const company_kod = document.getElementById('company_kod').value;
      const kodikos = document.getElementById('kodikosHidden').value;
      const hmeromhnia_allaghs_orarioy_apo = document.getElementById('hmeromhnia_allaghs_orarioy_apo').value;
      const hmeromhnia_allaghs_orarioy_eos = document.getElementById('hmeromhnia_allaghs_orarioy_eos').value;
      
      document.getElementById('hmeromhnia_allaghs_orarioy_apo_hidden').value = hmeromhnia_allaghs_orarioy_apo;
      document.getElementById('hmeromhnia_allaghs_orarioy_eos_hidden').value = hmeromhnia_allaghs_orarioy_eos;

      const orariaResponse = await fetch('/api/getOraria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team, company_kod, kodikos, hmeromhnia_allaghs_orarioy_apo, hmeromhnia_allaghs_orarioy_eos })
      });
  
      const orariaData = await orariaResponse.json();

      let synolo = Array(15).fill(0);

      const container = document.getElementById('dynamicFields');
      container.innerHTML = ''; // Αρχικοποίηση (καθαρισμός) του HTML

      if (orariaData.length > 0) {
    
        if (!Array.isArray(orariaData)) {
          console.error("Τα δεδομένα δεν είναι πίνακας!");
        } else {
          const fromDate = new Date(hmeromhnia_allaghs_orarioy_apo); // Μετατροπή σε αντικείμενο Date
          const toDate = new Date(hmeromhnia_allaghs_orarioy_eos);   // Μετατροπή σε αντικείμενο Date
          // Λήψη της πρώτης και τελευταίας ημερομηνίας του πίνακα
          let firstDate = new Date(orariaData[0].hmeromhnia.split('T')[0]);
          let lastDate = new Date(orariaData[orariaData.length - 1].hmeromhnia.split('T')[0]);

          let weeks = [];
          let currentDate = new Date(fromDate);
      
          if (firstDate > fromDate) {
            const promises = [];
            let currentDate = new Date(fromDate);
            // Προσθήκη αντικειμένων μέχρι να φτάσουμε στην πρώτη ημερομηνία του πίνακα
            while (currentDate < firstDate) {
              promises.push(await createEmptyObjectWithDate(currentDate, team, company_kod, kodikos));
              currentDate = addDays(currentDate, 1);
            }
            const results = await Promise.all(promises);
            orariaData.unshift(...results); // Εισαγωγή με σωστή σειρά
          }

          // Ενημέρωση της πρώτης ημερομηνίας του πίνακα μετά την εισαγωγή
          firstDate = new Date(orariaData[0].hmeromhnia);

          // Αν η τελευταία ημερομηνία του πίνακα είναι μικρότερη από την "ΕΩΣ"
          if (lastDate < toDate) {
            let currentDate = addDays(lastDate, 1);
            const promises_eos = []; // Πίνακας για αποθήκευση των υποσχέσεων (promises)
      
            // Προσθήκη αντικειμένων μέχρι να φτάσουμε στην ημερομηνία "ΕΩΣ"
            while (currentDate < addDays(toDate, 1)) {
              promises_eos.push(createEmptyObjectWithDate(currentDate, team, company_kod, kodikos));
              currentDate = addDays(currentDate, 1);
            }
            const results = await Promise.all(promises_eos);
            orariaData.push(...results);
          }
           
          // ** Εύρεση των κενών ημερομηνιών και προσθήκη τους **
          const datesSet = new Set(orariaData.map(item => new Date(item.hmeromhnia).toDateString()));

          currentDate = new Date(fromDate);
          while (currentDate <= toDate) {
            if (!datesSet.has(currentDate.toDateString())) {
              // Η ημερομηνία λείπει, δημιουργούμε το κενό αντικείμενο
              const missingObj = await createEmptyObjectWithDate(currentDate, team, company_kod, kodikos);
              orariaData.push(missingObj);
            }
            currentDate = addDays(currentDate, 1);
          }

          // Ταξινόμηση του πίνακα για να διατηρηθεί η σωστή σειρά
          orariaData.sort((a, b) => new Date(a.hmeromhnia) - new Date(b.hmeromhnia));
        }







        
        for (let i = 1; i <= data.differenceInDays; i++) {
          let i1 = i < 10 ? '0' + i : i;
          let ores_ergasias = orariaData[i - 1].ores_ergasias || 0;
          let ores_nyxtas = orariaData[i - 1].ores_nyxtas || 0;
          let ores_argion = orariaData[i - 1].ores_argion || 0;

          let ores_yperergasias = orariaData[i - 1].ores_yperergasias || 0;
          let ores_yperergasias_nyxtas = orariaData[i - 1].ores_yperergasias_nyxtas || 0;
          let ores_yperergasias_argion = orariaData[i - 1].ores_yperergasias_argion || 0;
          let ores_yperergasias_argion_nyxtas = orariaData[i - 1].ores_yperergasias_argion_nyxtas || 0;
          
          let ores_nominhs_yperorias = orariaData[i - 1].ores_nominhs_yperorias || 0;
          let ores_nominhs_yperorias_nyxtas = orariaData[i - 1].ores_nominhs_yperorias_nyxtas || 0;
          let ores_nominhs_yperorias_argion = orariaData[i - 1].ores_nominhs_yperorias_argion || 0;
          let ores_nominhs_yperorias_argion_nyxtas = orariaData[i - 1].ores_nominhs_yperorias_argion_nyxtas || 0;
          
          let ores_paranomhs_yperorias = orariaData[i - 1].ores_paranomhs_yperorias || 0;
          let ores_paranomhs_yperorias_nyxtas = orariaData[i - 1].ores_paranomhs_yperorias_nyxtas || 0;
          let ores_paranomhs_yperorias_argion = orariaData[i - 1].ores_paranomhs_yperorias_argion || 0;
          let ores_paranomhs_yperorias_argion_nyxtas = orariaData[i - 1].ores_paranomhs_yperorias_argion_nyxtas || 0;
          








          synolo[0] += parseFloat(ores_ergasias);
          synolo[1] += parseFloat(ores_nyxtas);
          synolo[2] += parseFloat(ores_argion);
          synolo[3] += parseFloat(ores_yperergasias);
          synolo[4] += parseFloat(ores_yperergasias_nyxtas);
          synolo[5] += parseFloat(ores_yperergasias_argion);
          synolo[6] += parseFloat(ores_yperergasias_argion_nyxtas);
          synolo[7] += parseFloat(ores_nominhs_yperorias);
          synolo[8] += parseFloat(ores_nominhs_yperorias_nyxtas);
          synolo[9] += parseFloat(ores_nominhs_yperorias_argion);
          synolo[10] += parseFloat(ores_nominhs_yperorias_argion_nyxtas);
          synolo[11] += parseFloat(ores_paranomhs_yperorias);
          synolo[12] += parseFloat(ores_paranomhs_yperorias_nyxtas);
          synolo[13] += parseFloat(ores_paranomhs_yperorias_argion);
          synolo[14] += parseFloat(ores_paranomhs_yperorias_argion_nyxtas);

          let hmeromhnia = orariaData[i - 1].hmeromhnia || null;
          let kathgoria_ergasias = orariaData[i - 1].kathgoria_ergasias || "";
          let repo = orariaData[i - 1].repo || false;
          const labelRepoText = repo ? 'ΝΑΙ' : 'ΟΧΙ'; 
          let argia = orariaData[i - 1].argia || false;
          const labelArgiaText = argia ? 'ΝΑΙ' : 'ΟΧΙ'; 
          let perigrafh_argias = orariaData[i - 1].perigrafh_argias || "";
      
          let divHtml = `
            <input type="hidden" name="total_hours_day_${i1}" id="total_hours_day_${i1}" value="${ores_ergasias}" />
            <input type="hidden" name="night_hours_day_${i1}" id="night_hours_day_${i1}" value="${ores_nyxtas}" />
            <input type="hidden" name="holiday_hours_day_${i1}" id="holiday_hours_day_${i1}" value="${ores_argion}" />
            <input type="hidden" name="overwork_hours_day_${i1}" id="overwork_hours_day_${i1}" value="${ores_yperergasias}" />
            <input type="hidden" name="night_overwork_hours_day_${i1}" id="night_overwork_hours_day_${i1}" value="${ores_yperergasias_nyxtas}" />
            <input type="hidden" name="holiday_overwork_hours_day_${i1}" id="holiday_overwork_hours_day_${i1}" value="${ores_yperergasias_argion}" />
            <input type="hidden" name="night_holiday_overwork_hours_day_${i1}" id="night_holiday_overwork_hours_day_${i1}" value="${ores_yperergasias_argion_nyxtas}" />
            <input type="hidden" name="overtimeNomimh_hours_day_${i1}" id="overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias}" />
            <input type="hidden" name="night_overtimeNomimh_hours_day_${i1}" id="night_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_nyxtas}" />
            <input type="hidden" name="holiday_overtimeNomimh_hours_day_${i1}" id="holiday_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_argion}" />
            <input type="hidden" name="night_holiday_overtimeNomimh_hours_day_${i1}" id="night_holiday_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_argion_nyxtas}" />
            <input type="hidden" name="overtimeParanomh_hours_day_${i1}" id="overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias}" />
            <input type="hidden" name="night_overtimeParanomh_hours_day_${i1}" id="night_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_nyxtas}" />
            <input type="hidden" name="holiday_overtimeParanomh_hours_day_${i1}" id="holiday_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_argion}" />
            <input type="hidden" name="night_holiday_overtimeParanomh_hours_day_${i1}" id="night_holiday_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_argion_nyxtas}" />

            <div class="row form-group align-items-center" style="background-color: #ffffff;">
              <div class="col-0-5 text-center">
                <label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
              </div>

              <div class="col-1-5 text-center">
                <input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" ${hmeromhnia ? `value="${new Date(hmeromhnia).toISOString().split('T')[0]}"` : ''} readonly />
              </div>

              <div class="col-2-5">
                <select class="form-select selectpicker-dropdown-normal" data-live-search="true" name="kathgoria_ergasias_${i1}" id="kathgoria_ergasias_${i1}" data-selected="${kathgoria_ergasias}">
                  <!-- Τα selects θα ενημερωθούν από την function loadKathgoriesErgasias -->
                </select>
              </div>`;
              
              for (let j = 1; j <= 3; j++) {
                let apo_ora = orariaData[i - 1][`apo_ora_0${j}`] || '';
                let eos_ora = orariaData[i - 1][`eos_ora_0${j}`] || '';
                let dialleima_apo_ora = orariaData[i - 1][`dialleima_apo_ora_0${j}`] || '';
                let dialleima_eos_ora = orariaData[i - 1][`dialleima_eos_ora_0${j}`] || '';
                if (j === 1) {
                  divHtml += `
                    <div class="col-0-5"></div>
                      <div class="col-1-2">
                        <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="${apo_ora}" />
                      </div>

                      <div class="col-1-2" style="margin-left: -0.1rem;">
                        <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="${eos_ora}" />
                      </div>

                      <div class="col-0-5"></div>

                      <div class="col-1-2">
                        <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="${dialleima_apo_ora}" />
                      </div>

                      <div class="col-1-2" style="margin-left: -0.2rem;">
                        <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="${dialleima_eos_ora}" />
                      </div>

                      <div class="col-0-5"></div>

                      <div class="col-0-5 center-align checkbox-flex-center" style="margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" ${repo ? 'checked' : ''} />
                        <label for="repo_${i1}" id="label-repo_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ${labelRepoText}
                        </label>
                      </div>

                      <div class="col-0-5 center-align checkbox-flex-center" style="display: none; margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="argia_${i1}" name="argia_${i1}" ${argia ? 'checked' : ''} />
                        <label for="argia_${i1}" id="label-argia_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ${labelArgiaText}
                        </label>
                      </div>`;
                } else {
                  divHtml += `
                    <div class="row form-group align-items-center" style="background-color: #ffffff; ">`;
                      if (j === 2) {
                        divHtml += `
                          <div class="col-5 left-align">
                            <input type="text" class="argia-label" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" value="${perigrafh_argias}" style="margin-top: -0.5rem; font-size: 0.7rem; border: 0;" readonly />
                          </div>`;
                      } else {
                        divHtml += `
                          <div class="col-5 left-align">
                            <label class="col-form-label field-required" id="holiday_label_${i1}"> &nbsp; </label>
                          </div>`;
                      }
                      divHtml += `
                        <div class="col-1-2" style="margin-left: .7rem;">
                          <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="${apo_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-1-2">
                          <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="${eos_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-0-5"></div>

                        <div class="col-1-2" style="margin-left: .3rem;">
                          <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="${dialleima_apo_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-1-2">
                          <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="${dialleima_apo_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>
                  </div>`;
                }
              }
          divHtml += `<hr style="margin-top: 0.4rem; margin-bottom: 0.3rem;" /></div>`;
          container.innerHTML += divHtml;
        }

        document.getElementById('total_hours_day').value = parseFloat(synolo[0]).toFixed(2);
        document.getElementById('night_hours_day').value = parseFloat(synolo[1]).toFixed(2);
        document.getElementById('holiday_hours_day').value = parseFloat(synolo[2]).toFixed(2);

        document.getElementById('overwork_hours_day').value = parseFloat(synolo[3]).toFixed(2);
        document.getElementById('night_overwork_hours_day').value = parseFloat(synolo[4]).toFixed(2);
        document.getElementById('holiday_overwork_hours_day').value = parseFloat(synolo[5]).toFixed(2);
        document.getElementById('night_holiday_overwork_hours_day').value = parseFloat(synolo[6]).toFixed(2);

        document.getElementById('overtimeNomimh_hours_day').value = parseFloat(synolo[7]).toFixed(2);
        document.getElementById('night_overtimeNomimh_hours_day').value = parseFloat(synolo[8]).toFixed(2);
        document.getElementById('holiday_overtimeNomimh_hours_day').value = parseFloat(synolo[9]).toFixed(2);
        document.getElementById('night_holiday_overtimeNomimh_hours_day').value = parseFloat(synolo[10]).toFixed(2);

        document.getElementById('overtimeParanomh_hours_day').value = parseFloat(synolo[11]).toFixed(2);
        document.getElementById('night_overtimeParanomh_hours_day').value = parseFloat(synolo[12]).toFixed(2);
        document.getElementById('holiday_overtimeParanomh_hours_day').value = parseFloat(synolo[13]).toFixed(2);
        document.getElementById('night_holiday_overtimeParanomh_hours_day').value = parseFloat(synolo[14]).toFixed(2);
      } else {
        for (let i = 1; i <= data.differenceInDays; i++) {
          let i1 = i < 10 ? '0' + i : i;
          let divHtml = `
            <input type="hidden" name="total_hours_day_${i1}" id="total_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_hours_day_${i1}" id="night_hours_day_${i1}" value="0" />
            <input type="hidden" name="holiday_hours_day_${i1}" id="holiday_hours_day_${i1}" value="0" />
            <input type="hidden" name="overwork_hours_day_${i1}" id="overwork_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_overwork_hours_day_${i1}" id="night_overwork_hours_day_${i1}" value="0" />
            <input type="hidden" name="holiday_overwork_hours_day_${i1}" id="holiday_overwork_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_holiday_overwork_hours_day_${i1}" id="night_holiday_overwork_hours_day_${i1}" value="0" />
            <input type="hidden" name="overtimeNomimh_hours_day_${i1}" id="overtimeNomimh_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_overtimeNomimh_hours_day_${i1}" id="night_overtimeNomimh_hours_day_${i1}" value="0" />
            <input type="hidden" name="holiday_overtimeNomimh_hours_day_${i1}" id="holiday_overtimeNomimh_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_holiday_overtimeNomimh_hours_day_${i1}" id="night_holiday_overtimeNomimh_hours_day_${i1}" value="0" />
            <input type="hidden" name="overtimeParanomh_hours_day_${i1}" id="overtimeParanomh_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_overtimeParanomh_hours_day_${i1}" id="night_overtimeParanomh_hours_day_${i1}" value="0" />
            <input type="hidden" name="holiday_overtimeParanomh_hours_day_${i1}" id="holiday_overtimeParanomh_hours_day_${i1}" value="0" />
            <input type="hidden" name="night_holiday_overtimeParanomh_hours_day_${i1}" id="night_holiday_overtimeParanomh_hours_day_${i1}" value="0" />
  
            <div class="row form-group align-items-center" style="background-color: #ffffff;">
              <div class="col-0-5 text-center">
                <label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
              </div>
  
              <div class="col-1-5 text-center">
                <input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" value="" readonly />
              </div>
  
              <div class="col-2-5">
                <select class="form-select selectpicker-dropdown-normal" data-live-search="true" name="kathgoria_ergasias_${i1}" id="kathgoria_ergasias_${i1}">
                  <!-- Τα selects θα ενημερωθούν από την function loadKathgoriesErgasias -->
                </select>
              </div>`;
        
              for (let j = 1; j <= 3; j++) {
                if (j === 1) {
                  divHtml += `
                    <div class="col-0-5"></div>
                      <div class="col-1-2">
                        <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-1-2" style="margin-left: -0.1rem;">
                        <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-0-5"></div>
  
                      <div class="col-1-2">
                        <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-1-2" style="margin-left: -0.2rem;">
                        <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-0-5"></div>
  
                      <div class="col-0-5 center-align checkbox-flex-center" style="margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" value="" />
                        <label for="repo_${i1}" id="label-repo_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ΟΧΙ
                        </label>
                      </div>
  
                      <div class="col-0-5 center-align checkbox-flex-center" style="display: none; margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="argia_${i1}" name="argia_${i1}" value="" />
                        <label for="argia_${i1}" id="label-argia_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ΟΧΙ
                        </label>
                      </div>`;
                } else {
                  divHtml += `
                    <div class="row form-group align-items-center" style="background-color: #ffffff; ">`;
                      if (j === 2) {
                        divHtml += `
                          <div class="col-5 left-align">
                            <input type="text" class="argia-label" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" style="margin-top: -0.5rem; font-size: 0.7rem; border: 0;" readonly />
                          </div>`;
                      } else {
                        divHtml += `
                          <div class="col-5 left-align">
                            <label class="col-form-label field-required" id="holiday_label_${i1}"> &nbsp; </label>
                          </div>`;
                      }
                      divHtml += `
                        <div class="col-1-2" style="margin-left: .7rem;">
                          <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-1-2">
                          <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-0-5"></div>
  
                        <div class="col-1-2" style="margin-left: .3rem;">
                          <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-1-2">
                          <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
                    </div>`;
                }
              }
          divHtml += `<hr style="margin-top: 0.4rem; margin-bottom: 0.3rem;" /></div>`;
          container.innerHTML += divHtml;
        }
        synolo = Array(15).fill(0);

        document.getElementById('total_hours_day').value = parseFloat(synolo[0]).toFixed(2);
        document.getElementById('night_hours_day').value = parseFloat(synolo[1]).toFixed(2);
        document.getElementById('holiday_hours_day').value = parseFloat(synolo[2]).toFixed(2);

        document.getElementById('overwork_hours_day').value = parseFloat(synolo[3]).toFixed(2);
        document.getElementById('night_overwork_hours_day').value = parseFloat(synolo[4]).toFixed(2);
        document.getElementById('holiday_overwork_hours_day').value = parseFloat(synolo[5]).toFixed(2);
        document.getElementById('night_holiday_overwork_hours_day').value = parseFloat(synolo[6]).toFixed(2);

        document.getElementById('overtimeNomimh_hours_day').value = parseFloat(synolo[7]).toFixed(2);
        document.getElementById('night_overtimeNomimh_hours_day').value = parseFloat(synolo[8]).toFixed(2);
        document.getElementById('holiday_overtimeNomimh_hours_day').value = parseFloat(synolo[9]).toFixed(2);
        document.getElementById('night_holiday_overtimeNomimh_hours_day').value = parseFloat(synolo[10]).toFixed(2);

        document.getElementById('overtimeParanomh_hours_day').value = parseFloat(synolo[11]).toFixed(2);
        document.getElementById('night_overtimeParanomh_hours_day').value = parseFloat(synolo[12]).toFixed(2);
        document.getElementById('holiday_overtimeParanomh_hours_day').value = parseFloat(synolo[13]).toFixed(2);
        document.getElementById('night_holiday_overtimeParanomh_hours_day').value = parseFloat(synolo[14]).toFixed(2);
      }

      loadKathgoriesErgasias();
      initializeSelectListeners();          // Βρίσκεται στο selectRepo.js
      updateDates();                        // Βρίσκεται στο getDaysFromDate.js
      attachTimeInputListeners();           // Βρίσκεται στο calcOresApasxolhshs
      setupEnterKeyNavigation();

    } catch (error) {
      console.error('Error sending data to server:', error);
    }
  }

  function formatDate(date) {
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // function convertDateToUTC(dateValue) {
  //   let convertedDate = new Date(Date.UTC(dateValue.split('-')[0], dateValue.split('-')[1] - 1, dateValue.split('-')[2]));
  //   return convertedDate;
  // }

  function formatDateToISO(date) {
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  function setupEnterKeyNavigation() {
    const inputs = document.querySelectorAll('#dynamicFields input, #dynamicFields select');
    inputs.forEach((input, index) => {
      // event listener για Enter
      input.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault(); // Αποτροπή της default λειτουργίας
          // Βρίσκει το επόμενο στοιχείο και του δίνει focus
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          }
        }
      });
  
      // event listener για Tab και Shift + Tab
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Tab') {
          event.preventDefault(); // Αποτροπή της default λειτουργίας
  
          if (event.shiftKey) {
            // Έλεγχος για Shift + Tab για μετάβαση στο προηγούμενο πεδίο
            const prevInput = inputs[index - 1];
            if (prevInput) {
              prevInput.focus();
            }
          } else {
            // Κανονικό Tab για μετάβαση στο επόμενο πεδίο
            const nextInput = inputs[index + 1];
            if (nextInput) {
              nextInput.focus();
            }
          }
        }
      });
    });
  }
  
});
