document.addEventListener("DOMContentLoaded", function () {
    var checkboxes = [
        "energos", "fylo", "apasxolhsh_gia_proth_fora", "karta_ergasias", "syggeneia", "plhrhs_apasxolhsh", "dieythethsh_xronoy_ergasias", "dialleima_entos_ektos_orarioy", "typos_orarioy", "synexes_diakekomeno", "pshfiakh_organosh", "asfalish_me_tekmarta", "epoxikos", "xarakthrismos_ergazomenon", "meiosh_eisforon_ergazomenon", "epidothsh_eisforon_ergodoth", "diathesimothta", "palios_neos", "amoibetai_me_sse", "systatiko_shmeioma", "antikatastash_ergazomenoy", "epidoma_anergias", "adeia_diamonhs_me_amesh_prosbash_gia_ergasia", 
        "adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia", "adeia_eisodoy_gia_epoxikh_apasxolhsh", 
        "epaggelmatikh_katartish", "ypologismos_foroy", "gnosh_ypologiston", "oros_sth_symbash_n_3986_2011", 
        "kataggelia_katopin_eggrafhs_proeidopoihshs", "omadikh_apolysh", "epidosh_me_dikastiko_epimelhth", "repo_01", "repo_02", "repo_03", "repo_04", "repo_05", "repo_06", "repo_07", "argia_01", "argia_02", "argia_03", "argia_04", "argia_05", "argia_06", "argia_07"
    ];

    checkboxes.forEach(function(checkboxId) {
        var checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener("change", function () {
                toggleCheckboxState(checkboxId, checkbox.checked);
            });
            toggleCheckboxState(checkboxId, checkbox.checked); // Αρχικοποίηση κατάστασης κατά τη φόρτωση
        }
    });

    const selectElement = document.getElementById('kathestos_apasxolhshs');
    const checkbox = document.getElementById('plhrhs_apasxolhsh');
    const oresErgasiasEbdomadas = document.getElementById('ores_ergasias_ebdomadas');
    const eidikhKathgoriaErgazomenoy = document.getElementById('eidikhKathgoriaErgazomenoy');

    // Ρύθμιση της αρχικής τιμής του select από το data-selected
    const initialSelectValue = selectElement.getAttribute('data-selected');
    selectElement.value = initialSelectValue;

    // Λειτουργία για την ενημέρωση των στοιχείων βάσει της τιμής του select
    function handleSelectChange() {
        const isFullTime = selectElement.value === "0";
        checkbox.checked = isFullTime;
        if (isFullTime) {
            oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
        } else {
            oresErgasiasEbdomadas.value = "";
        }
        toggleCheckboxState('plhrhs_apasxolhsh', isFullTime);
    }

    // Λειτουργία για την ενημέρωση του select και των συναφών στοιχείων από το checkbox
    function handleCheckboxChange() {
        if (checkbox.checked) {
            selectElement.value = "0";
            oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
        } else {
            selectElement.value = "";
            oresErgasiasEbdomadas.value = "";
        }
            toggleCheckboxState('plhrhs_apasxolhsh', checkbox.checked);
    }

    // Εγγραφή των event listeners
    selectElement.addEventListener('change', handleSelectChange);
    checkbox.addEventListener('change', handleCheckboxChange);

    // Αρχική εκτέλεση για να οριστούν οι αρχικές τιμές σωστά
    function initializeForm() {
        // Αρχική ρύθμιση του checkbox
        if (checkbox.checked) {
            selectElement.value = "0";
            if (eidikhKathgoriaErgazomenoy.value !== "0") oresErgasiasEbdomadas.value = eidikhKathgoriaErgazomenoy.value;
        } else {
            handleSelectChange();
        }
    }

    initializeForm();
});

function toggleCheckboxState(checkboxId, isChecked) {
    var labelId = "label-" + checkboxId;
    var label = document.getElementById(labelId);

    switch (checkboxId) {
        case "energos":
            label.textContent = isChecked ? "ΕΝΕΡΓΟΣ" : "ΑΝΕΝΕΡΓΟΣ";
            label.classList.toggle("red-text", !isChecked);
            break;
        case "plhrhs_apasxolhsh":
            label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
            break;
        case "fylo":
            label.textContent = isChecked ? "ΓΥΝΑΙΚΑ" : "ΑΝΔΡΑΣ";
            break;
        case "dialleima_entos_ektos_orarioy":
            label.textContent = isChecked ? "ΕΝΤΟΣ" : "ΕΚΤΟΣ";
            break;
        case "typos_orarioy":
            label.textContent = isChecked ? "ΜΕΤΑΒΑΛΛΟΜΕΝΟ" : "ΣΤΑΘΕΡΟ";
            break;
        case "synexes_diakekomeno":
            label.textContent = isChecked ? "ΔΙΑΚΕΚΟΜΜΕΝΟ" : "ΣΥΝΕΧΕΣ";
            break;
        case "karta_ergasias":
            label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
            document.getElementById("evelikth_proselefsh").value = 0;
            setFieldsDisabled(["evelikth_proselefsh"], !isChecked);
            break;
        case "xarakthrismos_ergazomenon":
                label.textContent = isChecked ? "ΥΠΑΛΛΗΛΟΣ" : "ΕΡΓΑΤΗΣ";
                break;
        case "palios_neos":
            label.textContent = isChecked ? "ΝΕΟΣ" : "ΠΑΛΙΟΣ";
            break;
        case "diathesimothta":
            label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
            document.getElementById("enarxh_diathesimothtas").value = null;
            setFieldsDisabled(["enarxh_diathesimothtas"], !isChecked);
            document.getElementById("lhxh_diathesimothtas").value = null;
            setFieldsDisabled(["lhxh_diathesimothtas"], !isChecked);
            break;
        default:
            label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
            break;
    }
}

function setFieldsDisabled(fieldIds, disabled) {
    fieldIds.forEach(function (fieldId) {
        var el = document.getElementById(fieldId);
        if (!el) return;

        // 1) Native disabled
        el.disabled = disabled;

        // 2) Αν είναι checkbox και το απενεργοποιούμε, ξε-τικάρ’ το και συγχρόνισε την ετικέτα
        if (el.type === "checkbox" && disabled) {
            el.checked = false;
            toggleCheckboxState(fieldId);
        }

        // 3) Tom Select (instance διαθέσιμο ως el.tomselect)
        // if (el.tomselect) {
        //     disabled ? el.tomselect.disable() : el.tomselect.enable();
        // }

        // 5) Εξαναγκασμός redraw/ενημέρωσης listeners
        el.dispatchEvent(new Event("change", { bubbles: true }));
    });
}
