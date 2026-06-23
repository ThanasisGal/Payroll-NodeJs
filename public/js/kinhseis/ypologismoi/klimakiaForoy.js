// Ορισμός των global arrays
let _KLIMAKA_FOROY = Array.from(Array(8), () => new Array(6));
let _AA_FOROLOGIKHS_KLIMAKAS = 8;
let _EKPTOSH_FOROY = [];
let _APODOXES_PRO_EKPTOSHS_FOROY = Array.from(Array(2), () => new Array(11));
let _APODOXES_PRO_EKPTOSHS_FOROY_PIN0 = Array.from(Array(11), () => new Array(9));
let _APODOXES_PRO_EKPTOSHS_FOROY_PIN1 = Array.from(Array(11), () => new Array(9));
const taxEndpointCache = new Map();
const taxEndpointInFlight = new Map();

function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function getCachedTaxEndpointJson(cacheKey, url) {
    if (taxEndpointCache.has(cacheKey)) {
        return cloneJson(taxEndpointCache.get(cacheKey));
    }

    if (!taxEndpointInFlight.has(cacheKey)) {
        const request = fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const payload = await response.json();
                taxEndpointCache.set(cacheKey, payload);
                return payload;
            })
            .finally(() => {
                taxEndpointInFlight.delete(cacheKey);
            });

        taxEndpointInFlight.set(cacheKey, request);
    }

    return cloneJson(await taxEndpointInFlight.get(cacheKey));
}

// Συνάρτηση που θα εκτελείται όταν φορτώνει το DOM
async function initializeKlimakiaForoy() {
    document.addEventListener('sharedParamsReady', async function () {
        const sharedParams = window.sharedParams;
        _AA_FOROLOGIKHS_KLIMAKAS = parseFloat(sharedParams.genikesParametroi[27].timh);
        await fetchData(); // Μία κλήση στον server
    });
}

// Συνάρτηση λήψης δεδομένων
async function fetchData() {
    try {
        const xrhsh = sharedParams._XRHSH;
        const klimakia = await getCachedTaxEndpointJson(
            `getKlimakiaForoy:${xrhsh}`,
            `/api/kinhseis/getKlimakiaForoy?xrhsh=${xrhsh}`
        );

        klimakia.forEach((item, i) => {
            if (i < 8) {
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
        return Array.from(Array(8), () => new Array(5).fill(null));
    }
}

// Συνάρτηση λήψης εκπτώσεων φόρου
async function fetchEkptoshForoy() {
    try {
        const ekptosh = await getCachedTaxEndpointJson(
            'getEkptoshForoy',
            '/api/kinhseis/getEkptoshForoy'
        );

        ekptosh.forEach((item, i) => {
            _EKPTOSH_FOROY[i] = item.posoEkptoshs;  // Η προηγούμενη γραμμή αντικαθίσταται
        });

    } catch (error) {
        console.error('Error fetching ekptoshForoy:', error);
        return Array(10).fill(null);
    }
}

// Συνάρτηση λήψης εισοδήματος πριν την έκπτωση φόρου
async function fetchEisodhmaProForoyMeioshs() {
    try {
        const xrhsh = sharedParams._XRHSH;
        const data = await getCachedTaxEndpointJson(
            `getEisodhmaProForoyMeioshs:${xrhsh}`,
            `/api/kinhseis/getEisodhmaProForoyMeioshs?xrhsh=${xrhsh}`
        );

        const len = data.length;
        const l1 = Math.floor(len / 2);

        for (let k = 0; k < 2; k++) {
            if (k === 0) {
                for (let i = 0; i < l1; i++) {
                    _APODOXES_PRO_EKPTOSHS_FOROY[k][i] = data[i];
                }
            } else {
                const i1 = l1;
                for (let i = i1; i < len; i++) {
                    const i3 = i - i1;
                    _APODOXES_PRO_EKPTOSHS_FOROY[k][i3] = data[i];
                }
            }
        }
    } catch (error) {
        console.error('Error fetching eisodhmaProForoyMeioshs:', error);
    }
}

// function getEkptoshForoyArray() {
//     return { _EKPTOSH_FOROY };
// }

function getAllArraysFromKlimakiaForoy() {
    return {
        _EKPTOSH_FOROY,
        _KLIMAKA_FOROY,
        _AA_FOROLOGIKHS_KLIMAKAS,
        _APODOXES_PRO_EKPTOSHS_FOROY,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN0,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN1,
    };
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        _KLIMAKA_FOROY,
        _AA_FOROLOGIKHS_KLIMAKAS,
        _EKPTOSH_FOROY,
        _APODOXES_PRO_EKPTOSHS_FOROY,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN0,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN1,
        initializeKlimakiaForoy,
        fetchData,
        fetchEkptoshForoy,
        fetchEisodhmaProForoyMeioshs,
        getAllArraysFromKlimakiaForoy,
    };
}

// Αν είμαστε σε περιβάλλον browser, κάνε export στο window
if (typeof window !== 'undefined') {
    window.KlimakiaForoyModule = {
        _KLIMAKA_FOROY,
        _AA_FOROLOGIKHS_KLIMAKAS,
        _EKPTOSH_FOROY,
        _APODOXES_PRO_EKPTOSHS_FOROY,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN0,
        _APODOXES_PRO_EKPTOSHS_FOROY_PIN1,
        initializeKlimakiaForoy,
        fetchData,
        fetchEkptoshForoy,
        fetchEisodhmaProForoyMeioshs,
        getAllArraysFromKlimakiaForoy,
    };
}
