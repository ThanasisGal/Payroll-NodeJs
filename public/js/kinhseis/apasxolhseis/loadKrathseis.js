document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('sharedParamsReady', function () {
        const sharedParams = window.sharedParams;
        const loadSeq = (window.apasxolhseisKrathseisLoadSeq || 0) + 1;
        window.apasxolhseisKrathseisLoadSeq = loadSeq;
        window.apasxolhseisKrathseisReady = false;

        window.apasxolhseisKrathseisLoadingPromise = (async function () {
            const data = await fetchKrathseisData();

            if (loadSeq !== window.apasxolhseisKrathseisLoadSeq) return;

            await generateSelectRowsOfKrathseis(data, sharedParams);
            await loadKrathseis(data, sharedParams, { loadSeq });

            if (loadSeq !== window.apasxolhseisKrathseisLoadSeq) return;

            window.apasxolhseisKrathseisReady = true;

            if (!window.apasxolhseisEmployeeLoadPipeline && typeof calcPlhroteo === 'function') {
                await calcPlhroteo();
                firstTimeCalcPlhroteo = true;
            }
        })().catch(function (error) {
            console.error('Error loading krathseis:', error);
            window.apasxolhseisKrathseisReady = true;
        });
    });
});

// Ενιαία κλήση στον server
window.fetchKrathseisData = async function () {
    try {
        const response = await fetch(`/api/kinhseis/getKrathseis?startDate=${sharedParams.startDate}&endDate=${sharedParams.endDate}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching krathseis:', error);
        return [];
    }
};

window.generateSelectRowsOfKrathseis = async function (data, sharedParams) {
    const container = document.getElementById('krathseisContainer');
    if (!container) return;

    container.querySelectorAll('select.tom-dropdown').forEach(function (select) {
        if (select.tomselect) select.tomselect.destroy();
    });

    container.innerHTML = '';
    let tabIndexCounter = 100;

    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[23].timh); i++) {
        const index = i.toString().padStart(2, '0');
        const rowHTML = `
            <div class="row form-group align-items-center showhide_row_${index} apasxolhseis-krathseis-row"
                id="row_Kra_${index}">
                <div class="col-2-41">
                    <select class="form-select tom-dropdown selectpicker-dropdown-normal apasxolhseis-krathsh-select" data-live-search="true"
                        name="krathsh_${index}"
                        id="krathsh_${index}"
                        tabIndex="-1" >
                    </select>
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble alreadyExists apasxolhseis-krathseis-input"
                        name="asfalistikesApodoxes_${index}"
                        id="asfalistikesApodoxes_${index}"
                        value="" tabIndex="${tabIndexCounter++}" maxlength="9" />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble alreadyExists apasxolhseis-krathseis-input"
                        name="pososto_krathshs_ergazomenoy_${index}"
                        id="pososto_krathshs_ergazomenoy_${index}"
                        value="" tabIndex="${tabIndexCounter++}" maxlength="9" />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble alreadyExists apasxolhseis-krathseis-input"
                        name="pososto_krathshs_ergodoth_${index}"
                        id="pososto_krathshs_ergodoth_${index}"
                        value="" tabIndex="${tabIndexCounter++}" maxlength="9" />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble apasxolhseis-krathseis-total-percent"
                        name="synolo_pososton_krathshs_${index}"
                        id="synolo_pososton_krathshs_${index}"
                        value="" maxlength="9" tabIndex="-1" readonly />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble alreadyExists apasxolhseis-krathseis-input"
                        name="poso_krathshs_ergazomenoy_${index}"
                        id="poso_krathshs_ergazomenoy_${index}"
                        value="" tabIndex="${tabIndexCounter++}" maxlength="9" />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble alreadyExists apasxolhseis-krathseis-input"
                        name="poso_krathshs_ergodoth_${index}"
                        id="poso_krathshs_ergodoth_${index}"
                        value="" tabIndex="${tabIndexCounter++}" maxlength="9" />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble apasxolhseis-krathseis-total-amount"
                        name="synolo_poson_krathshs_${index}"
                        id="synolo_poson_krathshs_${index}"
                        value="" maxlength="9" tabIndex="-1" readonly />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble apasxolhseis-krathseis-total-percent"
                        name="axia_krathshs_ergazomenoy_${index}"
                        id="axia_krathshs_ergazomenoy_${index}"
                        value="" maxlength="9" tabIndex="-1" readonly />
                </div>

                <div class="col-1">
                    <input type="text" class="form-control input-contents right-align clearAble apasxolhseis-krathseis-total-amount"
                        name="axia_krathshs_ergodoth_${index}"
                        id="axia_krathshs_ergodoth_${index}"
                        value="" maxlength="9" tabIndex="-1" readonly />
                </div>

                <button type="button" class="btn rounded-4 mt-2 col-0-3 clear-row border-0"
                    id="clearSelectKrathseon_${index}"
                    data-bs-toggle="tooltip" tabIndex="-1"
                    data-bs-title="Καθαρισμός του πεδίου Κράτηση"
                    data-bs-placement="bottom" data-target="krathsh_${index}">
                    <i class="bi bi-trash text-danger"></i>
                </button>
            </div>

            <input type="hidden" name="kodikos_${index}" id="kodikos_${index}" value="" />
            <input type="hidden" name="ypologizomenoStoForo_${index}" id="ypologizomenoStoForo_${index}" value="" />
            <input type="hidden" name="ypologizomenoEpiPlasmatikhs_${index}" id="ypologizomenoEpiPlasmatikhs_${index}" value="" />
            <input type="hidden" name="plasmatikh_axia_${index}" id="plasmatikh_axia_${index}" value="" />
            <input type="hidden" name="apaiteitai_apodoxes_asfalishs_${index}" id="apaiteitai_apodoxes_asfalishs_${index}" value="" />
            <input type="hidden" name="anotato_orio_palion_${index}" id="anotato_orio_palion_${index}" value="" />
            <input type="hidden" name="anotato_orio_neon_${index}" id="anotato_orio_neon_${index}" value="" />
            <input type="hidden" name="kad_${index}" id="kad_${index}" value="" />
            <input type="hidden" name="eidikothta_${index}" id="eidikothta_${index}" value="" />
            <input type="hidden" name="kpk_${index}" id="kpk_${index}" value="" />
            <input type="hidden" name="se_typos_apodoxon_${index}" id="se_typos_apodoxon_${index}" value="" />
            <input type="hidden" name="epa_${index}" id="epa_${index}" value="" />
        `;

        container.insertAdjacentHTML('beforeend', rowHTML);
    }
};

window.createKrathshOption = function (krathsh, asfalistikesApodoxesValue) {
    const textToConvert = removeGreekAccentsAndToUpper(krathsh.perigrafh);
    const option = new Option(
        krathsh.kodikos.padEnd(10, '\u00A0') + textToConvert,
        krathsh.kodikos
    );

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
            asfalistikesApodoxes: krathsh.ypologizetaiEpiPlasmatikhs === true
                ? krathsh.pososta.plasmatikh_axia || ''
                : asfalistikesApodoxesValue || '',
            apaiteitaiApodoxesAsfalishs: krathsh.apaiteitai_apodoxes_asfalishs || false
        });
    }

    return option;
};

window.getSelectedKrathshOption = function (dropdown) {
    if (!dropdown) return null;

    const selectedValue = dropdown.tomselect && typeof dropdown.tomselect.getValue === 'function'
        ? dropdown.tomselect.getValue()
        : dropdown.value;

    return Array.from(dropdown.options).find(function (option) {
        return option.value === selectedValue;
    }) || dropdown.options[dropdown.selectedIndex] || null;
};

window.applyKrathshAntistoixiseisDataset = async function (index, option, context = {}) {
    if (!option || !option.value) return;

    const params = context.sharedParams || window.sharedParams || {};
    const fallbackSource = context.fallbackSource || params.ergazomenoi || {};
    const flag = index === '01' ? 1 : 0;
    const apoTyposApodoxonValue = document.getElementById('typosApodoxon_Hidden')?.value || '';
    const teamValue = document.getElementById('team')?.value || '';
    const kodikosEtaireias = params._KODIKOS_ETAIREIAS || '';

    try {
        const antistoixiseisResponse = await fetch(`/api/kinhseis/getAntistoixiseisByKrathshAndTypoApodoxon?team=${encodeURIComponent(teamValue)}&etaireia=${encodeURIComponent(kodikosEtaireias)}&krathshKod=${encodeURIComponent(option.value)}&apo_typos_apodoxon=${encodeURIComponent(apoTyposApodoxonValue)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const antistoixiseisData = await antistoixiseisResponse.json();
        const antistoixish = antistoixiseisData || {
            kad: fallbackSource.kad_efka || '',
            eidikothta: fallbackSource.eidikothta_efka || '',
            kpk: fallbackSource.kpk_efka || '',
            se_typos_apodoxon: apoTyposApodoxonValue || '',
            epa: flag === 1 ? fallbackSource.epa_efka || '' : '00'
        };

        Object.assign(option.dataset, {
            kad: antistoixish.kad || '',
            eidikothta: antistoixish.eidikothta || '',
            kpk: antistoixish.kpk || '',
            se_typos_apodoxon: antistoixish.se_typos_apodoxon || '',
            epa: antistoixish.epa || ''
        });
    } catch (error) {
        console.error('Σφάλμα κατά την ανάκτηση δεδομένων:', error);
    }
};

window.initKrathseisTomSelect = function (select) {
    if (!select) return null;

    if (select.tomselect) select.tomselect.destroy();

    if (typeof TomSelect === 'undefined') return null;

    return new TomSelect(select, {
        create: false,
        persist: false,
        maxItems: 1,
        sortField: [],
        allowEmptyOption: true,
        plugins: ['dropdown_input'],
        placeholder: '',
        searchField: ['text'],
        render: {
            option: function (data, escape) {
                return `<div>${escape(data.text || '')}</div>`;
            },
            item: function (data, escape) {
                return `<div>${escape(data.text || '')}</div>`;
            }
        }
    });
};

window.setKrathseisTomSelectValue = function (select, value, silent = true) {
    if (!select) return;

    if (select.tomselect) {
        if (value) {
            select.tomselect.setValue(value, silent);
        } else {
            select.tomselect.clear(silent);
        }
    } else {
        select.value = value || '';
    }
};

async function loadKrathseis(data, sharedParams, options = {}) {
    const rowsCount = parseInt(sharedParams.genikesParametroi[23].timh);
    const previousBulkLoading = window.apasxolhseisKrathseisBulkLoading;
    window.apasxolhseisKrathseisBulkLoading = true;

    try {
        for (let i = 1; i <= rowsCount; i++) {
            if (options.loadSeq && options.loadSeq !== window.apasxolhseisKrathseisLoadSeq) return;

            const index = i.toString().padStart(2, '0');
            const ergazomenoiField = sharedParams.ergazomenoi[`krathsh_${index}`] || '';
            const krathseisDropdown = document.getElementById(`krathsh_${index}`);
            const kodikosKrathshs = document.getElementById(`kodikos_${index}`);

            if (!krathseisDropdown || !kodikosKrathshs) continue;

            if (krathseisDropdown.tomselect) krathseisDropdown.tomselect.destroy();
            krathseisDropdown.innerHTML = '<option value="" selected></option>';

            for (const krathsh of data) {
                const option = window.createKrathshOption(
                    krathsh,
                    document.getElementById('asfalistikes_apodoxes')?.value || ''
                );

                if (krathsh.kodikos === ergazomenoiField) {
                    option.selected = true;
                    kodikosKrathshs.value = krathsh.kodikos;
                    await window.applyKrathshAntistoixiseisDataset(index, option, { sharedParams });
                }

                krathseisDropdown.appendChild(option);
            }

            window.initKrathseisTomSelect(krathseisDropdown);
            window.setKrathseisTomSelectValue(krathseisDropdown, ergazomenoiField, true);

            await updatePosostaFields(i, { skipCalc: true });

            krathseisDropdown.addEventListener('change', async function () {
                if (window.apasxolhseisKrathseisBulkLoading === true) return;

                kodikosKrathshs.value = krathseisDropdown.value || '';
                const selectedOption = window.getSelectedKrathshOption(krathseisDropdown);
                await window.applyKrathshAntistoixiseisDataset(index, selectedOption, { sharedParams });
                await updatePosostaFields(i);
            });

            const asfalistikesApodoxesField = document.getElementById(`asfalistikesApodoxes_${index}`);
            if (asfalistikesApodoxesField) {
                asfalistikesApodoxesField.addEventListener('input', function () {
                    if (window.apasxolhseisSuppressFieldEvents === true || window.apasxolhseisEmployeeLoadPipeline === true || window.apasxolhseisKrathseisBulkLoading === true) return;
                    ypologismosAxiasKrathseon();
                });
            }

            const clearButton = document.getElementById(`clearSelectKrathseon_${index}`);
            if (clearButton) {
                clearButton.addEventListener('click', async function () {
                    await clearRowFields(index);
                });
            }
        }
    } finally {
        window.apasxolhseisKrathseisBulkLoading = previousBulkLoading;
    }

    if (typeof ypologismosAxiasKrathseon === 'function') {
        await ypologismosAxiasKrathseon();
    }
}

async function updatePosostaFields(i, options = {}) {
    const index = i.toString().padStart(2, '0');
    const dropdown = document.getElementById(`krathsh_${index}`);

    if (!dropdown) return;

    const selectedOption = window.getSelectedKrathshOption(dropdown);
    if (!selectedOption) return;

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

    const readonlyFields = [
        `pososto_krathshs_ergazomenoy_${index}`,
        `pososto_krathshs_ergodoth_${index}`,
        `poso_krathshs_ergazomenoy_${index}`,
        `poso_krathshs_ergodoth_${index}`
    ];

    if (dropdown.selectedIndex === 0) {
        readonlyFields.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (field) field.setAttribute('readonly', true);
        });
    } else {
        readonlyFields.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (field) field.removeAttribute('readonly');
        });
    }

    if (!options.skipCalc && typeof ypologismosAxiasKrathseon === 'function') {
        await ypologismosAxiasKrathseon();
    }
}

function isNumberInputField(field) {
    return field && field.tagName === 'INPUT' && String(field.type || '').toLowerCase() === 'number';
}

function setValue(fieldId, value, decimalPlaces = null, isBoolean = false, format = false) {
    const field = document.getElementById(fieldId);

    if (!field) {
        console.warn(`Field with ID "${fieldId}" not found.`);
        return;
    }

    if (isBoolean) {
        field.value = value === 'true' || value === true ? 'true' : 'false';
        return;
    }

    if (decimalPlaces === null) {
        field.value = value || '';
        return;
    }

    const parsedValue = parseFloat(String(value ?? '').replace(',', '.'));

    if (isNaN(parsedValue)) {
        field.value = decimalPlaces ? `0.${'0'.repeat(decimalPlaces)}` : '';
    } else {
        const fixedValue = parsedValue.toFixed(decimalPlaces);
        field.value = format && !isNumberInputField(field)
            ? fixedValue.replace('.', ',')
            : fixedValue;
    }
}

async function clearRowFields(index) {
    const fields = [
        `krathsh_${index}`,
        `kodikos_${index}`,
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
        `epa_${index}`
    ];

    fields.forEach(function (fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.tagName === 'SELECT') {
                window.setKrathseisTomSelectValue(field, '', true);
            } else {
                field.value = '';
            }
        }
    });

    const dropdown = document.getElementById(`krathsh_${index}`);
    const readonlyFields = [
        `pososto_krathshs_ergazomenoy_${index}`,
        `pososto_krathshs_ergodoth_${index}`,
        `poso_krathshs_ergazomenoy_${index}`,
        `poso_krathshs_ergodoth_${index}`
    ];

    if (!dropdown || dropdown.selectedIndex === 0) {
        readonlyFields.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (field) field.setAttribute('readonly', true);
        });
    } else {
        readonlyFields.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (field) field.removeAttribute('readonly');
        });
    }

    if (typeof ypologismosAxiasKrathseon === 'function') {
        await ypologismosAxiasKrathseon();
    }
}
