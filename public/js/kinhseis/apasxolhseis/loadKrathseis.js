document.addEventListener("DOMContentLoaded", async function () {
    
    document.addEventListener('sharedParamsReady', async function () {
        const loaderContainer = document.querySelector(".loader-container");
        if (loaderContainer) loaderContainer.style.display = "grid";

        const sharedParams = window.sharedParams;
    
        const data = await fetchKrathseisData(); // Μία κλήση στον server
        await generateSelectRowsOfKrathseis(data, sharedParams); // Δημιουργία dropdowns
        await loadKrathseis(data, sharedParams); // Γέμισμα dropdowns
        
        if (typeof calcPlhroteo === 'function') {
            await calcPlhroteo();
            firstTimeCalcPlhroteo = true;
        }

        if (loaderContainer) loaderContainer.style.display = "none";
    });
});

// Ενιαία κλήση στον server
window.fetchKrathseisData = async function () {
    try {
        const response = await fetch(`/api/kinhseis/getKrathseis?startDate=${sharedParams.startDate}&endDate=${sharedParams.endDate}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data; // Επιστροφή δεδομένων
    } catch (error) {
        console.error('Error fetching krathseis:', error);
        return [];
    }
}

window.generateSelectRowsOfKrathseis = async function (data, sharedParams) {
    const container = document.getElementById('krathseisContainer');
    container.innerHTML = '';

    let tabIndexCounter = 100;
    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[23].timh); i++) {
        const rowHTML = `
            <div class="row form-group align-items-center showhide_row_${i.toString().padStart(2, '0')}" 
                style="background-color: #ffffff; margin-left: -1rem; margin-right: -1rem; margin-bottom: -0.6rem !important;" 
                id="row_Kra_${i.toString().padStart(2, '0')}">
                
                <div class="col-2-41">
                <select class="form-select selectpicker-dropdown-normal" data-live-search="true" 
                        name="krathsh_${i.toString().padStart(2, '0')}"
                        id="krathsh_${i.toString().padStart(2, '0')}"
                        style="font-weight: 400 !important; font-size: .8rem !important;" tabIndex="-1" >
                </select>        
                </div>  

                <div class="col-1">
                <input type="text"  class="form-control input-contents right-align clearAble alreadyExists"
                        name="asfalistikesApodoxes_${i.toString().padStart(2, '0')}" 
                        id="asfalistikesApodoxes_${i.toString().padStart(2, '0')}" 
                        value="" tabIndex="<%= tabIndexCounter++ %>" maxlength="9" style="font-weight: 400 !important;" />
                </div>

                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble alreadyExists" 
                        name="pososto_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        id="pososto_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        value="" tabIndex="<%= tabIndexCounter++ %>" maxlength="9" style="font-weight: 400 !important;" />
                </div>

                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble alreadyExists" 
                        name="pososto_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        id="pososto_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        value="" tabIndex="<%= tabIndexCounter++ %>" maxlength="9" style="font-weight: 400 !important;" />
                </div>

                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble" 
                        name="synolo_pososton_krathshs_${i.toString().padStart(2, '0')}" 
                        id="synolo_pososton_krathshs_${i.toString().padStart(2, '0')}" 
                        value="" maxlength="9" style="background-color: #f5faae61;" tabIndex="-1" readonly />
                </div>

                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble alreadyExists" 
                        name="poso_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        id="poso_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        value="" tabIndex="<%= tabIndexCounter++ %>" maxlength="9" style="font-weight: 400 !important;" />
                </div>

                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble alreadyExists" 
                        name="poso_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        id="poso_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        value="" tabIndex="<%= tabIndexCounter++ %>" maxlength="9" style="font-weight: 400 !important;" />
                </div>
                
                <div class="col-1">
                <input type="text" class="form-control input-contents right-align clearAble" 
                        name="synolo_poson_krathshs_${i.toString().padStart(2, '0')}" 
                        id="synolo_poson_krathshs_${i.toString().padStart(2, '0')}" 
                        value="" maxlength="9" style="background-color: #86cf5b30;" tabIndex="-1" readonly />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble" 
                        name="axia_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        id="axia_krathshs_ergazomenoy_${i.toString().padStart(2, '0')}" 
                        value="" maxlength="9" style="background-color: #f5faae61;" tabIndex="-1" readonly />
                </div>
                
                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble" 
                        name="axia_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        id="axia_krathshs_ergodoth_${i.toString().padStart(2, '0')}" 
                        value="" maxlength="9" style="background-color: #86cf5b30;" tabIndex="-1" readonly />
                </div>

                <button type="button" class="btn rounded-4 mt-2 col-0-3 clear-row" 
                        id="clearSelectKrathseon_${i.toString().padStart(2, '0')}" 
                        style="border: 0;" data-bs-toggle="tooltip" tabIndex="-1" 
                        data-bs-title="Καθαρισμός του πεδίου Κράτηση" 
                        data-bs-placement="bottom" data-target="krathsh_${i.toString().padStart(2, '0')}">
                        <i class="bi bi-trash" style="color: red"></i>
                </button>
            </div>

            <input type="hidden" name="kodikos_${i.toString().padStart(2, '0')}" id="kodikos_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="ypologizomenoStoForo_${i.toString().padStart(2, '0')}" id="ypologizomenoStoForo_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="ypologizomenoEpiPlasmatikhs_${i.toString().padStart(2, '0')}" id="ypologizomenoEpiPlasmatikhs_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="plasmatikh_axia_${i.toString().padStart(2, '0')}" id="plasmatikh_axia_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="apaiteitai_apodoxes_asfalishs_${i.toString().padStart(2, '0')}" id="apaiteitai_apodoxes_asfalishs_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="anotato_orio_palion_${i.toString().padStart(2, '0')}" id="anotato_orio_palion_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="anotato_orio_neon_${i.toString().padStart(2, '0')}" id="anotato_orio_neon_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="kad_${i.toString().padStart(2, '0')}" id="kad_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="eidikothta_${i.toString().padStart(2, '0')}" id="eidikothta_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="kpk_${i.toString().padStart(2, '0')}" id="kpk_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="se_typos_apodoxon_${i.toString().padStart(2, '0')}" id="se_typos_apodoxon_${i.toString().padStart(2, '0')}" value="" />
            <input type="hidden" name="epa_${i.toString().padStart(2, '0')}" id="epa_${i.toString().padStart(2, '0')}" value="" />
        `;

        container.insertAdjacentHTML('beforeend', rowHTML);
    }
}

async function loadKrathseis(data, sharedParams) {
    let flag = 0;
    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[23].timh); i++) {
        const index = i.toString().padStart(2, '0');
        const ergazomenoiField = sharedParams.ergazomenoi[`krathsh_${index}`] || '';
        const krathseisDropdown = document.getElementById(`krathsh_${index}`);
        let kodikos_krathshs = document.getElementById(`kodikos_${index}`);

        flag = index === "01" ? 1 : 0;

        // Δημιουργία της αρχικής επιλογής
        krathseisDropdown.innerHTML = '<option value="" selected></option>';

        for (const krathsh of data) {
            const textToConvert = removeGreekAccentsAndToUpper(krathsh.perigrafh);
            const option = new Option(
                krathsh.kodikos.padEnd(10, '\u00A0') + textToConvert,
                krathsh.kodikos
            );

            // Προσθήκη δεδομένων στο option
            if (krathsh.pososta) {
                Object.assign(option.dataset, {
                posostoErgazomenoy: krathsh.pososta.pososto_ergazomenoy || '',
                posostoErgodoth: krathsh.pososta.pososto_ergodoth || '',
                synoloPososton: krathsh.pososta.synolo_pososton || '',
                posoErgazomenoy: krathsh.pososta.poso_ergazomenoy || '',
                posoErgodoth: krathsh.pososta.poso_ergodoth || '',
                synoloPoson: krathsh.pososta.synolo_poson || '',
                anotatoOrioPalion: krathsh.pososta.anotato_orio_palion || '',
                anotatoOrioNeon: krathsh.pososta.anotato_orio_neon || '',
                plasmatikhAxia: krathsh.pososta.plasmatikh_axia || '',
                ypologizomenoStoForo: krathsh.ypologizetaiStoForo || false,
                ypologizomenoEpiPlasmatikhs: krathsh.ypologizetaiEpiPlasmatikhs || false,
                asfalistikesApodoxes: krathsh.ypologizetaiEpiPlasmatikhs === true ? krathsh.pososta.plasmatikh_axia || '' : document.getElementById('asfalistikes_apodoxes').value,
                apaiteitaiApodoxesAsfalishs: krathsh.apaiteitai_apodoxes_asfalishs || false,
                });
            }

            if (krathsh.kodikos === ergazomenoiField) {
                option.selected = true;
                kodikos_krathshs.value = krathsh.kodikos;
                try {
                    const apoTyposApodoxonValue = document.getElementById("typosApodoxon_Hidden").value;
                    const teamValue = document.getElementById("team").value;
                    const kodikosEtaireias = sharedParams._KODIKOS_ETAIREIAS;
                    // Fetch δεδομένων για AntistoixiseisModel
                    const antistoixiseisResponse = await fetch(`/api/kinhseis/getAntistoixiseisByKrathshAndTypoApodoxon?team=${encodeURIComponent(teamValue)}&etaireia=${encodeURIComponent(kodikosEtaireias)}&krathshKod=${encodeURIComponent(ergazomenoiField)}&apo_typos_apodoxon=${encodeURIComponent(apoTyposApodoxonValue)}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    });
                    const antistoixiseisData = await antistoixiseisResponse.json();

                    // Προσθήκη επιπλέον δεδομένων στο dataset του option από τα μοντέλα
                    const data = antistoixiseisData || {
                        kad: sharedParams.ergazomenoi.kad_efka || '',
                        eidikothta: sharedParams.ergazomenoi.eidikothta_efka || '',
                        kpk: sharedParams.ergazomenoi.kpk_efka || '',
                        se_typos_apodoxon: apoTyposApodoxonValue || '',
                        epa: flag === 1 ? sharedParams.ergazomenoi.epa_efka || '' : "00"
                    };
                
                    Object.assign(option.dataset, {
                        kad: data.kad,
                        eidikothta: data.eidikothta,
                        kpk: data.kpk,
                        se_typos_apodoxon: data.se_typos_apodoxon,
                        epa: data.epa,
                    });
                } catch (error) {
                    console.error('Σφάλμα κατά την ανάκτηση δεδομένων:', error);
                }
            }
            krathseisDropdown.appendChild(option);
        };

        // === ΕΔΩ προσθέτουμε τον event listener ===
        // Κάθε φορά που αλλάζει η επιλεγμένη κράτηση, ενημερώνει το αντίστοιχο πεδίο kodikos_{index}.
        krathseisDropdown.addEventListener('change', (event) => {
            kodikos_krathshs.value = event.target.value;

            // Αν θέλετε να πάρετε δεδομένα από το dataset του επιλεγμένου option:
            const selectedOption = event.target.options[event.target.selectedIndex];
            // Παράδειγμα: console.log(selectedOption.dataset.posostoErgazomenoy);
        });

        // Ενημέρωση των πεδίων με βάση την αρχική τιμή
        updatePosostaFields(i);

        // Προσθήκη event listener (μόνο μία φορά)
        krathseisDropdown.addEventListener('change', () => updatePosostaFields(i));

        // Προσθήκη event listeners στα πεδία εισαγωγής για υπολογισμούς
        document
        .getElementById(`asfalistikesApodoxes_${index}`)
        .addEventListener('input', () => {
            ypologismosAxiasKrathseon();
        });

        // document
        // .getElementById(`pososto_krathshs_ergodoth_${index}`)
        // .addEventListener('input', async () => {
        //     await ypologismosAxiasKrathseon();
        // });

        // Προσθήκη event listener στο κουμπί καθαρισμού
        const clearButton = document.getElementById(`clearSelectKrathseon_${index}`);
        clearButton.addEventListener('click', async () => {
            await clearRowFields(index);
        });

    }

}

async function updatePosostaFields(i) {
    const index = i.toString().padStart(2, '0');
    const dropdown = document.getElementById(`krathsh_${index}`);
    const selectedOption = dropdown.options[dropdown.selectedIndex];

    if (!selectedOption) return;

    // Ενημέρωση τιμών των πεδίων
    setValue(`pososto_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posostoErgazomenoy, 4, false, true);
    setValue(`pososto_krathshs_ergodoth_${index}`, selectedOption.dataset.posostoErgodoth, 4, false, true);
    setValue(`synolo_pososton_krathshs_${index}`, selectedOption.dataset.synoloPososton, 4, false, true);

    setValue(`poso_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posoErgazomenoy, 2, false, true);
    setValue(`poso_krathshs_ergodoth_${index}`, selectedOption.dataset.posoErgodoth, 2, false, true);
    setValue(`synolo_poson_krathshs_${index}`, selectedOption.dataset.synoloPoson, 2, false, true);

    setValue(`anotato_orio_palion_${index}`, selectedOption.dataset.anotatoOrioPalion, 2, false, true);
    setValue(`anotato_orio_neon_${index}`, selectedOption.dataset.anotatoOrioNeon, 2, false, true);
    
    setValue(`ypologizomenoStoForo_${index}`, selectedOption.dataset.ypologizomenoStoForo, null, true);
    setValue(`ypologizomenoEpiPlasmatikhs_${index}`, selectedOption.dataset.ypologizomenoEpiPlasmatikhs, null, true);
    setValue(`plasmatikh_axia_${index}`, selectedOption.dataset.plasmatikhAxia, 2, false, true);
    setValue(`asfalistikesApodoxes_${index}`, selectedOption.dataset.asfalistikesApodoxes, 2, false, true);
    setValue(`apaiteitai_apodoxes_asfalishs_${index}`, selectedOption.dataset.apaiteitaiApodoxesAsfalishs, null, true);

    setValue(`kad_${index}`, selectedOption.dataset.kad, null, false, false);
    setValue(`eidikothta_${index}`, selectedOption.dataset.eidikothta, null, false, false);
    setValue(`kpk_${index}`, selectedOption.dataset.kpk, null, false, false);
    setValue(`se_typos_apodoxon_${index}`, selectedOption.dataset.se_typos_apodoxon, null, false, false);
    setValue(`epa_${index}`, selectedOption.dataset.epa, null, false, false);

    // Έλεγχος αν πρέπει τα πεδία να είναι readonly
    const readonlyFields = [
        `pososto_krathshs_ergazomenoy_${index}`,
        `pososto_krathshs_ergodoth_${index}`,
        `poso_krathshs_ergazomenoy_${index}`,
        `poso_krathshs_ergodoth_${index}`,
    ];

    if (dropdown.selectedIndex === 0) {
        readonlyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.setAttribute('readonly', true);
        });
    } else {
        readonlyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.removeAttribute('readonly');
        });
    }
    
    // Υπολογισμός αξίας κρατήσεων
    await ypologismosAxiasKrathseon();

}

function setValue(fieldId, value, decimalPlaces = null, isBoolean = false, format = false) {
    const field = document.getElementById(fieldId);

    if (!field) {
        console.warn(`Field with ID "${fieldId}" not found.`);
        return;
    }

    if (isBoolean) {
        field.value = value === "true" ? "true" : "false"; // Εξασφαλίζει ότι η τιμή είναι πάντα "true" ή "false"
        return;
    }

    if (decimalPlaces === null) {
        field.value = value || ''; // Αντιστοίχιση της αρχικής τιμής ως string
        return;
    }

    const parsedValue = parseFloat(value);

    if (isNaN(parsedValue)) {
        field.value = decimalPlaces ? `0.${'0'.repeat(decimalPlaces)}` : '';
    } else {
        field.value = format ? parsedValue.toFixed(decimalPlaces).replace('.', ',') : parsedValue.toFixed(decimalPlaces);
    }
}

async function clearRowFields(index) {
    const fields = [
        `krathsh_${index}`,
        `pososto_krathshs_ergazomenoy_${index}`,
        `pososto_krathshs_ergodoth_${index}`,
        `synolo_pososton_krathshs_${index}`,
        `poso_krathshs_ergazomenoy_${index}`,
        `poso_krathshs_ergodoth_${index}`,
        `synolo_poson_krathshs_${index}`,
        `axia_krathshs_ergazomenoy_${index}`,
        `axia_krathshs_ergodoth_${index}`,
        `ypologizomenoStoForo_${index}`,
        `ypologizomenoEpiPlasmatikhs_${index}`,
        `plasmatikh_axia_${index}`,
        `asfalistikesApodoxes_${index}`,
        `apaiteitai_apodoxes_asfalishs_${index}`,
        `kad_${index}`,
        `eidikothta_${index}`,
        `kpk_${index}`,
        `se_typos_apodoxon_${index}`,
        `epa_${index}`,
    ];

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.tagName === 'SELECT') {
                field.selectedIndex = 0; // Επαναφορά της επιλογής
            } else {
                field.value = ''; // Επαναφορά της τιμής
            }
        }
    });

    // Έλεγχος αν το dropdown είναι κενό
    const dropdown = document.getElementById(`krathsh_${index}`);
    const readonlyFields = [
        `pososto_krathshs_ergazomenoy_${index}`,
        `pososto_krathshs_ergodoth_${index}`,
        `poso_krathshs_ergazomenoy_${index}`,
        `poso_krathshs_ergodoth_${index}`,
    ];

    if (!dropdown || dropdown.selectedIndex === 0) {
        // Κάνε τα πεδία readonly αν δεν υπάρχει επιλεγμένο στοιχείο
        readonlyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.setAttribute('readonly', true);
        });
    } else {
        // Αφαίρεσε το readonly αν υπάρχει επιλεγμένο στοιχείο
        readonlyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.removeAttribute('readonly');
        });
    }
  
  // Ενημέρωση των πεδίων μετά τον καθαρισμό
  await ypologismosAxiasKrathseon();

}
