document.addEventListener('DOMContentLoaded', function () {
    var checkboxes = [
        'energos',
        'fylo',
        'apasxolhsh_gia_proth_fora',
        'karta_ergasias',
        'syggeneia',
        'topos_ergasias',
        'afora_daneismo_ergazomenoy',
        'afora_dokimastikh_periodo',
        'dieythethsh_ergasias',
        'efarmostea_sse',
        'plhrhs_apasxolhsh',
        'mh_problepsimo_programma',
        'dialleima_entos_ektos_orarioy',
        'typos_orarioy',
        'synexes_diakekomeno',
        'pshfiakh_organosh',
        'asfalish_me_tekmarta',
        'epoxikos',
        'xarakthrismos_ergazomenon',
        'meiosh_eisforon_ergazomenon',
        'epidothsh_eisforon_ergodoth',
        'mhteres',
        'diathesimothta',
        'palios_neos',
        'amoibetai_me_sse',
        'systatiko_shmeioma',
        'topothethsh_me_programma',
        'ypoxreotikh_ek_toy_nomoy_katartish',
        'antikatastash_ergazomenoy',
        'epidoma_anergias',
        'adeia_diamonhs_me_amesh_prosbash_gia_ergasia',
        'adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia',
        'adeia_eisodoy_gia_epoxikh_apasxolhsh',
        'epaggelmatikh_katartish',
        'ypologismos_foroy',
        'gnosh_ypologiston',
        'oros_sth_symbash_n_3986_2011',
        'kataggelia_katopin_eggrafhs_proeidopoihshs',
        'omadikh_apolysh',
        'epidosh_me_dikastiko_epimelhth',
        'repo_01',
        'repo_02',
        'repo_03',
        'repo_04',
        'repo_05',
        'repo_06',
        'repo_07',
        'argia_01',
        'argia_02',
        'argia_03',
        'argia_04',
        'argia_05',
        'argia_06',
        'argia_07'
    ];

    checkboxes.forEach(function (checkboxId) {
        var checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', function () {
                toggleCheckboxState(checkboxId, checkbox.checked);
                // ✅ Ενημέρωση του allodapoi button όταν αλλάζουν τα checkboxes
                if (
                    checkboxId === 'adeia_diamonhs_me_amesh_prosbash_gia_ergasia' ||
                    checkboxId === 'adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia' ||
                    checkboxId === 'adeia_eisodoy_gia_epoxikh_apasxolhsh'
                ) {
                    checkAndUpdateAllodapoiButton();
                }
            });
            toggleCheckboxState(checkboxId, checkbox.checked);
        }
    });

    // =========================================================================
    // ΚΑΘΕΣΤΩΣ ΑΠΑΣΧΟΛΗΣΗΣ
    // =========================================================================
    const kathestosSelectElement = document.getElementById('kathestos_apasxolhshs');
    const plhrhsCheckbox = document.getElementById('plhrhs_apasxolhsh');
    const oresErgasiasEbdomadas = document.getElementById('ores_ergasias_ebdomadas');
    const eidikhKathgoriaErgazomenoy = document.getElementById('eidikhKathgoriaErgazomenoy');

    if (kathestosSelectElement && plhrhsCheckbox) {
        const initialSelectValue = kathestosSelectElement.getAttribute('data-selected');
        kathestosSelectElement.value = initialSelectValue;

        function handleSelectChange() {
            const isFullTime = kathestosSelectElement.value === '0';
            plhrhsCheckbox.checked = isFullTime;
            if (isFullTime) {
                oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
            }
            toggleCheckboxState('plhrhs_apasxolhsh', isFullTime);
        }

        function handleCheckboxChange() {
            if (plhrhsCheckbox.checked) {
                kathestosSelectElement.value = '0';
                oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
            } else {
                kathestosSelectElement.value = '';
                oresErgasiasEbdomadas.value = '';
            }
            toggleCheckboxState('plhrhs_apasxolhsh', plhrhsCheckbox.checked);
        }

        kathestosSelectElement.addEventListener('change', handleSelectChange);
        plhrhsCheckbox.addEventListener('change', handleCheckboxChange);

        function initializeForm() {
            if (plhrhsCheckbox.checked) {
                kathestosSelectElement.value = '0';
                if (eidikhKathgoriaErgazomenoy.value !== '0') {
                    oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
                }
            } else {
                handleSelectChange();
            }
        }

        initializeForm();
    }

    // =========================================================================
    // ✅ ΟΥΣΙΩΔΕΙΣ ΟΡΟΙ - BUTTON CONTROL (ΑΠΛΗ ΛΥΣΗ - POLLING)
    // =========================================================================
    const oysiodeisOroiStathera = document.getElementById('oysiodeis_oroi_stathera');
    const customButton_oysiodeis_oroi = document.getElementById('customButton_oysiodeis_oroi');

    if (oysiodeisOroiStathera && customButton_oysiodeis_oroi) {
        let lastValue = oysiodeisOroiStathera.value;

        // Function που ελέγχει και ενημερώνει το button
        function checkAndUpdateButton() {
            const currentValue = oysiodeisOroiStathera.value;

            // Αν άλλαξε η τιμή
            if (currentValue !== lastValue) {
                lastValue = currentValue;

                const shouldEnable = currentValue === '0' || currentValue === 0;
                customButton_oysiodeis_oroi.disabled = !shouldEnable;
                customButton_oysiodeis_oroi.style.opacity = shouldEnable ? '1' : '0.4';
                customButton_oysiodeis_oroi.style.cursor = shouldEnable ? 'pointer' : 'not-allowed';
            }
        }

        // ✅ Initial disabled state
        customButton_oysiodeis_oroi.disabled = true;
        customButton_oysiodeis_oroi.style.opacity = '0.4';
        customButton_oysiodeis_oroi.style.cursor = 'not-allowed';

        // ✅ Check κάθε 100ms (polling)
        setInterval(checkAndUpdateButton, 100);

        // ✅ Επίσης άκουσε για events (για ταχύτερη ανταπόκριση)
        oysiodeisOroiStathera.addEventListener('change', checkAndUpdateButton);
        oysiodeisOroiStathera.addEventListener('input', checkAndUpdateButton);
    }

    // =========================================================================
    // ✅ ΑΛΛΟΔΑΠΟΙ - BUTTON CONTROL
    // =========================================================================
    const adeiaAmeshCheckbox = document.getElementById(
        'adeia_diamonhs_me_amesh_prosbash_gia_ergasia'
    );
    const adeiaXorisCheckbox = document.getElementById(
        'adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia'
    );
    const adeiaEisodoyCheckbox = document.getElementById('adeia_eisodoy_gia_epoxikh_apasxolhsh');
    const customButtonAllodapoi = document.getElementById('customButton_allodapoi');

    if (customButtonAllodapoi) {
        // Function που ελέγχει και ενημερώνει το button για αλλοδαπούς
        function checkAndUpdateAllodapoiButton() {
            // Έλεγχος αν έστω ένα από τα 3 checkboxes είναι checked
            const atLeastOneChecked =
                (adeiaAmeshCheckbox && adeiaAmeshCheckbox.checked) ||
                (adeiaXorisCheckbox && adeiaXorisCheckbox.checked) ||
                (adeiaEisodoyCheckbox && adeiaEisodoyCheckbox.checked);

            // Αν έστω ένα είναι checked, enable το button, αλλιώς disable
            customButtonAllodapoi.disabled = !atLeastOneChecked;
            customButtonAllodapoi.style.opacity = atLeastOneChecked ? '1' : '0.4';
            customButtonAllodapoi.style.cursor = atLeastOneChecked ? 'pointer' : 'not-allowed';
        }

        // ✅ Initial disabled state
        customButtonAllodapoi.disabled = true;
        customButtonAllodapoi.style.opacity = '0.4';
        customButtonAllodapoi.style.cursor = 'not-allowed';

        // ✅ Άκουσε για changes στα checkboxes
        if (adeiaAmeshCheckbox) {
            adeiaAmeshCheckbox.addEventListener('change', checkAndUpdateAllodapoiButton);
        }
        if (adeiaXorisCheckbox) {
            adeiaXorisCheckbox.addEventListener('change', checkAndUpdateAllodapoiButton);
        }
        if (adeiaEisodoyCheckbox) {
            adeiaEisodoyCheckbox.addEventListener('change', checkAndUpdateAllodapoiButton);
        }

        // ✅ Initial check
        checkAndUpdateAllodapoiButton();
    }

    // =========================================================================
    // ✅ ΑΝΗΛΙΚΟΙ - BUTTON CONTROL (POLLING)
    // =========================================================================
    const arithmosBibliarioyAnhlikoy = document.getElementById('arithmos_bibliarioy_anhlikoy');
    const customButtonAnhlikoi = document.getElementById('customButton_anhlikoi');

    if (arithmosBibliarioyAnhlikoy && customButtonAnhlikoi) {
        let lastDisabledState = arithmosBibliarioyAnhlikoy.disabled;

        // Function που ελέγχει και ενημερώνει το button
        function checkAndUpdateAnhlikoiButton() {
            const currentDisabledState = arithmosBibliarioyAnhlikoy.disabled;

            // Αν άλλαξε η κατάσταση disabled
            if (currentDisabledState !== lastDisabledState) {
                lastDisabledState = currentDisabledState;

                // Αν το πεδίο είναι enabled (disabled=false), τότε enable το button
                const shouldEnable = !currentDisabledState;
                customButtonAnhlikoi.disabled = !shouldEnable;
                customButtonAnhlikoi.style.opacity = shouldEnable ? '1' : '0.4';
                customButtonAnhlikoi.style.cursor = shouldEnable ? 'pointer' : 'not-allowed';
            }
        }

        // ✅ Initial disabled state
        customButtonAnhlikoi.disabled = true;
        customButtonAnhlikoi.style.opacity = '0.4';
        customButtonAnhlikoi.style.cursor = 'not-allowed';

        // ✅ Check κάθε 100ms (polling)
        setInterval(checkAndUpdateAnhlikoiButton, 100);

        // ✅ Επίσης άκουσε για events (για ταχύτερη ανταπόκριση)
        arithmosBibliarioyAnhlikoy.addEventListener('change', checkAndUpdateAnhlikoiButton);
        arithmosBibliarioyAnhlikoy.addEventListener('input', checkAndUpdateAnhlikoiButton);

        // Initial check
        checkAndUpdateAnhlikoiButton();
    }

    // =========================================================================
    // ✅ ΣΥΜΒΑΣΗ ΔΑΝΕΙΣΜΟΥ - BUTTON CONTROL (POLLING)
    // =========================================================================
    const aforaSymbashDaneismoy = document.getElementById('afora_daneismo_ergazomenoy');
    const customButtonSymbashDaneismoy = document.getElementById('customButton_symbash_daneismoy');

    if (customButtonSymbashDaneismoy) {
        // Function που ελέγχει και ενημερώνει το button για αλλοδαπούς
        function checkAndUpdateSymbashDaneismoyButton() {
            const atLeastOneChecked = aforaSymbashDaneismoy && aforaSymbashDaneismoy.checked;

            customButtonSymbashDaneismoy.disabled = !atLeastOneChecked;
            customButtonSymbashDaneismoy.style.opacity = atLeastOneChecked ? '1' : '0.4';
            customButtonSymbashDaneismoy.style.cursor = atLeastOneChecked
                ? 'pointer'
                : 'not-allowed';
        }

        // ✅ Initial disabled state
        customButtonSymbashDaneismoy.disabled = true;
        customButtonSymbashDaneismoy.style.opacity = '0.4';
        customButtonSymbashDaneismoy.style.cursor = 'not-allowed';

        // ✅ Άκουσε για changes στα checkboxes
        if (aforaSymbashDaneismoy) {
            aforaSymbashDaneismoy.addEventListener('change', checkAndUpdateSymbashDaneismoyButton);
        }

        // ✅ Initial check
        checkAndUpdateSymbashDaneismoyButton();
    }
});

function toggleCheckboxState(checkboxId, isChecked) {
    var labelId = 'label-' + checkboxId;
    var label = document.getElementById(labelId);

    switch (checkboxId) {
        case 'energos':
            label.textContent = isChecked ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ';
            label.classList.toggle('red-text', !isChecked);
            break;
        case 'plhrhs_apasxolhsh':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            break;
        case 'fylo':
            label.textContent = isChecked ? 'ΓΥΝΑΙΚΑ' : 'ΑΝΔΡΑΣ';
            break;
        case 'typos_orarioy':
            label.textContent = isChecked ? 'ΜΕΤΑΒΑΛΛΟΜΕΝΟ' : 'ΣΤΑΘΕΡΟ';
            break;
        case 'synexes_diakekomeno':
            label.textContent = isChecked ? 'ΔΙΑΚΕΚΟΜΜΕΝΟ' : 'ΣΥΝΕΧΕΣ';
            break;
        case 'topos_ergasias':
            label.textContent = isChecked ? 'ΑΛΛΟ' : 'ΠΑΡΑΡΤΗΜΑ ΕΡΓΟΔΟΤΗ';
            break;
        case 'afora_dokimastikh_periodo':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            document.getElementById('hmnia_lhxhs_dokimastikhs_periodoy').value = null;
            setFieldsDisabled(['hmnia_lhxhs_dokimastikhs_periodoy'], !isChecked);
            break;
        case 'mh_problepsimo_programma':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            // ✅ Clear values
            var field1 = document.getElementById('hmeres_ores_anaforas');
            var field2 = document.getElementById('eidopoihsh_prin_thn_anathesh');
            var field3 = document.getElementById('prothesmia_akyroshs_ths_anatheshs');

            if (field1) field1.value = null;
            if (field2) field2.value = null;
            if (field3) field3.value = null;

            // ✅ Κρύψε ολόκληρη τη γραμμή (row)
            hideEntireRowForFields(
                [
                    'hmeres_ores_anaforas',
                    'eidopoihsh_prin_thn_anathesh',
                    'prothesmia_akyroshs_ths_anatheshs'
                ],
                !isChecked
            );
            break;
        case 'dieythethsh_ergasias':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';

            // Clear τα date fields
            document.getElementById('hmnia_enarxhs_dieythethshs_ergasias').value = null;
            document.getElementById('hmnia_lhxhs_dieythethshs_ergasias').value = null;

            // ✅ Disable τα date inputs
            setFieldsDisabled(
                ['hmnia_enarxhs_dieythethshs_ergasias', 'hmnia_lhxhs_dieythethshs_ergasias'],
                !isChecked
            );

            var targetLabel = document.getElementById('hmnia_lhxhs_dokimastikhs_periodoy_label');
            if (targetLabel) {
                if (!isChecked) {
                    targetLabel.classList.add('disabled');
                } else {
                    targetLabel.classList.remove('disabled');
                }
            }
            break;

        case 'efarmostea_sse':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ - ΚΑΤΩΤΑΤΕΣ ΝΟΜΟΘ/ΝΕΣ ΑΠΟΔΟΧΕΣ ΕΓΣΣΕ';
            // document.getElementById('efarmostea_sse_parathrhseis').value = '';
            setFieldsDisabled(['efarmostea_sse_parathrhseis'], !isChecked);
            break;
        case 'karta_ergasias':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';

            // ✅ Μηδένισε ΜΟΝΟ όταν αποεπιλέγεται (isChecked = false)
            // Όταν isChecked = true, κράτα την υπάρχουσα τιμή
            if (!isChecked) {
                document.getElementById('evelikth_proselefsh').value = 0;
            }

            setFieldsDisabled(['evelikth_proselefsh'], !isChecked);
            break;
        case 'xarakthrismos_ergazomenon':
            label.textContent = isChecked ? 'ΥΠΑΛΛΗΛΟΣ' : 'ΕΡΓΑΤΗΣ';
            break;
        case 'palios_neos':
            label.textContent = isChecked ? 'ΝΕΟΣ' : 'ΠΑΛΙΟΣ';
            break;
        case 'diathesimothta':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            document.getElementById('enarxh_diathesimothtas').value = null;
            setFieldsDisabled(['enarxh_diathesimothtas'], !isChecked);
            document.getElementById('lhxh_diathesimothtas').value = null;
            setFieldsDisabled(['lhxh_diathesimothtas'], !isChecked);
            break;
        case 'antikatastash_ergazomenoy':
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            document.getElementById('afm_antikatastath').value = null;
            setFieldsDisabled(['afm_antikatastath'], !isChecked);
            document.getElementById('amka_antikatastath').value = null;
            setFieldsDisabled(['amka_antikatastath'], !isChecked);
            break;
        default:
            label.textContent = isChecked ? 'ΝΑΙ' : 'ΟΧΙ';
            break;
    }
}

function setFieldsDisabled(fieldIds, disabled) {
    fieldIds.forEach(function (fieldId) {
        var el = document.getElementById(fieldId);
        if (!el) return;

        // 1) Native disabled
        el.disabled = disabled;

        // 2) Αν είναι checkbox και το απενεργοποιούμε, ξετικάρισέ το και συγχρόνισε την ετικέτα
        if (el.type === 'checkbox' && disabled) {
            el.checked = false;
            toggleCheckboxState(fieldId, false);
        }

        // 3) Βρες και disable το label
        var label = document.querySelector('label[for="' + fieldId + '"]');
        if (label) {
            if (disabled) {
                label.classList.add('disabled');
            } else {
                label.classList.remove('disabled');
            }
        }

        // 4) Αν υπάρχει TomSelect, disable το wrapper
        if (el.tomselect) {
            if (disabled) {
                el.tomselect.disable();
                el.tomselect.wrapper?.classList?.add('disabled');
            } else {
                el.tomselect.enable();
                el.tomselect.wrapper?.classList?.remove('disabled');
            }
        }

        // 5) Αν υπάρχει flatpickr, disable το
        if (el._flatpickr) {
            el._flatpickr.set('clickOpens', !disabled);
            el._flatpickr.input.disabled = disabled;
        }

        // 6) Εξαναγκασμός redraw/ενημέρωσης listeners
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

/**
 * ✅ ΒΕΛΤΙΩΜΕΝΗ:    Κρύβει ολόκληρη τη γραμμή (row) που περιέχει τα πεδία + labels
 */
function hideEntireRowForFields(fieldIds, hide) {
    // Προσπάθησε να βρεις κοινό parent row που περιέχει ΟΛΑ τα πεδία
    var commonParent = null;
    var elements = [];

    // Συλλογή όλων των elements
    fieldIds.forEach(function (fieldId) {
        var el = document.getElementById(fieldId);
        if (el) {
            elements.push(el);
        }
    });

    if (elements.length > 0) {
        // Προσπάθησε να βρεις κοινό parent
        var firstEl = elements[0];
        var potentialParent = firstEl.closest('.row, .form-group, [class*="row"]');

        if (potentialParent) {
            // Έλεγξε αν το parent περιέχει ΟΛΑ τα elements
            var containsAll = elements.every(function (el) {
                return potentialParent.contains(el);
            });

            if (containsAll) {
                commonParent = potentialParent;
            }
        }
    }

    if (commonParent) {
        // ✅ ΒΡΕΘΗΚΕ κοινό parent → Κρύψε ολόκληρη τη γραμμή
        commonParent.style.display = hide ? 'none' : '';

        // Disable όλα τα πεδία
        elements.forEach(function (el) {
            el.disabled = hide;
            if (el.tomselect) {
                hide ? el.tomselect.disable() : el.tomselect.enable();
                if (hide) el.tomselect.clear();
            }
        });
    } else {
        // ❌ ΔΕΝ βρέθηκε κοινό parent → Κρύψε κάθε πεδίο ξεχωριστά με το label του
        fieldIds.forEach(function (fieldId) {
            var el = document.getElementById(fieldId);
            if (!el) return;

            // Βρες το label
            var label = document.querySelector('label[for="' + fieldId + '"]');

            // Βρες το parent container του input
            var inputParent = el.closest('.col, [class*="col-"]');

            // Βρες το parent container του label
            var labelParent = label ? label.closest('.col, [class*="col-"]') : null;

            // Κρύψε input parent
            if (inputParent) {
                inputParent.style.display = hide ? 'none' : '';
            } else {
                el.style.display = hide ? 'none' : '';
            }

            // Κρύψε label parent
            if (labelParent) {
                labelParent.style.display = hide ? 'none' : '';
            } else if (label) {
                label.style.display = hide ? 'none' : '';
            }

            // Disabled + clear
            el.disabled = hide;
            if (hide) {
                if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = null;
                }
            }

            // Tom Select
            if (el.tomselect) {
                hide ? el.tomselect.disable() : el.tomselect.enable();
                if (hide) el.tomselect.clear();
            }

            // Dispatch change
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
}
