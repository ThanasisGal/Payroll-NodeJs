let _KLIMAKA_FOROY = Array.from(Array(8), () => new Array(6)),
    _AA_FOROLOGIKHS_KLIMAKAS = 8;
    _EKPTOSH_FOROY = Array(),
    _APODOXES_PRO_EKPTOSHS_FOROY = Array.from(Array(2), () => new Array(11)),
    _APODOXES_PRO_EKPTOSHS_FOROY_PIN0 = Array.from(Array(11), () => new Array(9)),
    _APODOXES_PRO_EKPTOSHS_FOROY_PIN1 = Array.from(Array(11), () => new Array(9));

document.addEventListener("DOMContentLoaded", async function () {
    document.addEventListener('sharedParamsReady', async function () {
        const sharedParams = window.sharedParams;
        _AA_FOROLOGIKHS_KLIMAKAS = parseFloat(sharedParams.genikesParametroi[27].timh);
        await fetchData(); // Μία κλήση στον server
    });
});

async function fetchData() {
    // ΛΗΨΗ ΚΛΙΜΑΚΙΩΝ ΦΟΡΟΥ
    try {
        const response = await fetch(`/api/kinhseis/getKlimakiaForoy?xrhsh=${sharedParams._XRHSH}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const klimakia = await response.json();

        // Γέμισμα του πίνακα με δεδομένα
        klimakia.forEach((item, i) => {
            if (i < 8) { // Έλεγχος για να μην ξεπεράσουμε τις διαστάσεις του πίνακα
                _KLIMAKA_FOROY[i][0] = item.xrhsh;
                _KLIMAKA_FOROY[i][1] = item.apo_poso;
                _KLIMAKA_FOROY[i][2] = item.eos_poso;
                _KLIMAKA_FOROY[i][3] = item.syntelesths_foroy;
                _KLIMAKA_FOROY[i][4] = item.syntelesths_meioshs_ekptoshs;
                _KLIMAKA_FOROY[i][5] = item.syntelesths_eisforas_allhleggyhs;
            }
        });

    } catch (error) {
        console.error('Error fetching klimakiaForoy:', error);
        return Array.from(Array(8), () => new Array(5).fill(null)); // Επιστροφή κενών δεδομένων σε περίπτωση σφάλματος
    }

    // ΛΗΨΗ ΕΚΠΤΩΣΕΩΝ ΦΟΡΟΥ
    try {
        const response = await fetch(`/api/kinhseis/getEkptoshForoy`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const ekptosh = await response.json();

        // Γέμισμα του πίνακα με δεδομένα
        ekptosh.forEach((item, i) => {
            _EKPTOSH_FOROY[i] = item.aa_teknon;
            _EKPTOSH_FOROY[i] = item.posoEkptoshs;
        });

    } catch (error) {
        console.error('Error fetching ekptoshForoy:', error);
        return Array(10).fill(null); // Δημιουργεί πίνακα με 10 θέσεις, όλες γεμάτες με null    }
    }

    // ΛΗΨΗ ΕΙΣΟΔΗΜΑΤΟΣ ΠΡΙΝ ΤΗΝ ΜΕΙΩΣΗ ΑΠΟ ΤΟΝ ΦΟΡΟ
    const fieldNames = [// 'xrhsh', 
    //                     'eisfora_allhleggyhs', 
    //                     'aa_teknon', 
                        'poso00', 
                        'poso01', 
                        'poso02', 
                        'poso03', 
                        'poso04', 
                        'poso05', 
                        'poso06', 
                        'poso07', 
                        'poso08' 
                       ];
    try {
        // Εκτέλεση του POST αιτήματος προς το API endpoint
        const response = await fetch(`/api/kinhseis/getEisodhmaProForoyMeioshs?xrhsh=${sharedParams._XRHSH}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json(); // Λήψη των δεδομένων ως JSON

        const len = data.length;
        const l1 = Math.floor(len / 2); // Υπολογισμός του μέσου για το split

        // Επεξεργασία των δεδομένων για k=0 και k=1
        for (let k = 0; k < 2; k++) { // k=0 και k=1
            if (k === 0) {
                // Επεξεργασία του πρώτου μέρους (Χωρίς Υπολογισμό Εισφοράς Αλληλεγγύης)
                for (let i = 0; i < l1; i++) {  
                    for (let j = 0; j < fieldNames.length; j++) {
                        _APODOXES_PRO_EKPTOSHS_FOROY_PIN0[i][j] = data[i][fieldNames[j]];
                    }
                    _APODOXES_PRO_EKPTOSHS_FOROY[k][i] = _APODOXES_PRO_EKPTOSHS_FOROY_PIN0[i];
                }
            } else {
                // Επεξεργασία του δεύτερου μέρους (Με Υπολογισμό Εισφοράς Αλληλεγγύης)
                const i1 = l1; // Ξεκινάμε από το μέσο
                for (let i = i1; i < len; i++) {  
                    const i3 = i - i1;
                    for (let j = 0; j < fieldNames.length; j++) {
                        _APODOXES_PRO_EKPTOSHS_FOROY_PIN1[i3][j] = data[i][fieldNames[j]];
                    }
                    _APODOXES_PRO_EKPTOSHS_FOROY[k][i3] = _APODOXES_PRO_EKPTOSHS_FOROY_PIN1[i3];
                }
            }
        }
    } catch (error) {
        console.error('Error fetching eisodhmaProForoyMeioshs:', error);
        
        // Επαναφορά των πινάκων σε κενές τιμές σε περίπτωση σφάλματος
        _APODOXES_PRO_EKPTOSHS_FOROY = [[], []];
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN0 = Array.from({ length: 11 }, () => Array(_AA_FOROLOGIKHS_KLIMAKAS).fill(null));
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN1 = Array.from({ length: 11 }, () => Array(_AA_FOROLOGIKHS_KLIMAKAS).fill(null));
        
        // Επιστροφή των κενών πινάκων
        return [
            Array.from({ length: 2 }, () => Array(11).fill(null)),
            Array.from({ length: 11 }, () => Array(_AA_FOROLOGIKHS_KLIMAKAS).fill(null)),
            Array.from({ length: 11 }, () => Array(_AA_FOROLOGIKHS_KLIMAKAS).fill(null))
        ];
    }
}
