// Αυτή η συνάρτηση ενεργοποιεί ή απενεργοποιεί τα input fields ανάλογα με την κατάσταση του συσχετισμένου checkbox

function toggleInputs(checkboxId, inputIds) {
    var checkbox = document.getElementById(checkboxId);
    if (!checkbox) {
        console.warn('toggleInputs: δεν βρέθηκε checkbox:', checkboxId);
        return;
    }

    function apply() {
        inputIds.forEach(function(inputId) {
            var input = document.getElementById(inputId);
            if (!input) {
                console.warn('toggleInputs: δεν βρέθηκε input:', inputId);
                return;
            }

            var enabled = checkbox.checked;

            // 1) Property
            input.disabled = !enabled;

            // 2) Attribute (για στοιχεία που ξεκινούν με disabled στο markup)
            if (enabled) {
                input.removeAttribute('disabled');
            } else {
                input.setAttribute('disabled', 'disabled');
                // Προαιρετικό καθάρισμα όταν κλείνει
                if (input._flatpickr) input._flatpickr.clear();
                else input.value = '';
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // Δέσιμο event (σε κάποια custom checkboxes το 'input' πιάνει καλύτερα)
    checkbox.addEventListener('change', apply); 
    checkbox.addEventListener('input', apply);

    // Αρχική εφαρμογή
    apply();
}

// Εξασφαλίζει ότι οι λειτουργίες θα εκτελεστούν μόλις το DOM είναι πλήρως φορτωμένο
document.addEventListener('DOMContentLoaded', function() {
    toggleInputs('adeia_eisodoy_gia_epoxikh_apasxolhsh', ['arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh', 'apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh', 'eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh']);
    toggleInputs('epaggelmatikh_katartish', ['antikeimeno_katartishs', 'thematiko_pedio', 'thematikh_enothta', 'foreas_katartishs', 'katartish_apo', 'katartish_eos', 'diarkeia_se_ores', 'etos_apokthshs']);
    toggleInputs('kataggelia_katopin_eggrafhs_proeidopoihshs', ['hmeromhnia_eggrafhs_proeidopoihshs']);
    toggleInputs('omadikh_apolysh', ['arithmos_apofashs_gia_omadikh_apolysh', 'hmeromhnia_apofashs_gia_omadikh_apolysh']);
    toggleInputs('epidosh_me_dikastiko_epimelhth', ['hmeromhnia_epidoshs']);
});
