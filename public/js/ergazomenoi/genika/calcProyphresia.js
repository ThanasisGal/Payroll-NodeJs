document.addEventListener('DOMContentLoaded', function () {
    const proyphresiaSeEthInput = document.getElementById('proyphresia_se_eth');
    const proyphresiaSeMhnesInput = document.getElementById('proyphresia_se_mhnes');
    const hmeromhniaProslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
    const misthologikoKlimakioInput = document.getElementById('misthologiko_klimakio');

    const synoloEthInput = document.getElementById('synolo_proyphresias_se_eth');
    const synoloMhnesInput = document.getElementById('synolo_proyphresias_se_mhnes');

    proyphresiaSeEthInput.addEventListener('change', calculateTotalExperience);
    proyphresiaSeMhnesInput.addEventListener('change', calculateTotalExperience);
    hmeromhniaProslhpshsInput.addEventListener('change', calculateTotalExperience);

    // Βοηθητικό: parsing "YYYY-MM-DD" σε local Date (όχι UTC)
    function parseLocalDateFromInput(value) {
        if (!value) return null; // άδειο input
        const [y, m, d] = value.split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d); // local midnight
    }

    // Βοηθητικό: safe int (επιστρέφει 0 αν NaN/άδειο)
    function toIntOrZero(val) {
        const n = parseInt(val, 10);
        return Number.isFinite(n) ? n : 0;
    }

    function calculateTotalExperience() {
        const today = new Date();
        const hmeromhniaProslhpshs = parseLocalDateFromInput(hmeromhniaProslhpshsInput.value);

        let yearsDifference = 0;
        let monthsDifference = 0;

        // Αν δεν έχει δοθεί ημερομηνία πρόσληψης, μείνε στα 0 και συνέχισε μόνο με τα inputs
        if (hmeromhniaProslhpshs) {
            // Αν η πρόσληψη είναι στο μέλλον, για προϋπηρεσία κρατάμε 0
            if (hmeromhniaProslhpshs > today) {
                yearsDifference = 0;
                monthsDifference = 0;
            } else {
                yearsDifference = today.getFullYear() - hmeromhniaProslhpshs.getFullYear();
                monthsDifference = today.getMonth() - hmeromhniaProslhpshs.getMonth();

                // Αν δεν έχει “κλείσει” η μέρα του μήνα, αφαιρούμε 1 μήνα
                if (today.getDate() < hmeromhniaProslhpshs.getDate()) {
                    monthsDifference--;
                }

                // Κανονικοποίηση
                if (monthsDifference < 0) {
                    yearsDifference--;
                    monthsDifference += 12;
                }

                // Ασφάλεια
                if (yearsDifference < 0) {
                    yearsDifference = 0;
                    monthsDifference = 0;
                }
            }
        }

        const proyphresiaSeEth = toIntOrZero(proyphresiaSeEthInput.value);
        const proyphresiaSeMhnes = toIntOrZero(proyphresiaSeMhnesInput.value);

        let totalYears = yearsDifference + proyphresiaSeEth;
        let totalMonths = monthsDifference + proyphresiaSeMhnes;

        // Κανονικοποίηση συνολικών μηνών
        if (totalMonths >= 12) {
            totalYears += Math.floor(totalMonths / 12);
            totalMonths = totalMonths % 12;
        }

        // Αν για οποιονδήποτε λόγο βγει αρνητικό, μηδέν
        if (totalYears < 0) totalYears = 0;
        if (totalMonths < 0) totalMonths = 0;

        synoloEthInput.value = totalYears;
        synoloMhnesInput.value = totalMonths;

        updateMisthologikoKlimakio(totalYears);
    }

    function updateMisthologikoKlimakio(totalYears) {
        // Δική σου λογική: ξεκινάει από 1 και μετά = years + 1
        const misthologikoKlimakio = totalYears >= 1 ? totalYears + 1 : 1;
        misthologikoKlimakioInput.value = misthologikoKlimakio;
    }

    // --- Αν χρειάζεσαι όντως ημέρες διαφοράς, αυτό είναι το σωστό ---
    // (Η πραγματική διαφορά ημερών ήδη περιλαμβάνει τα δίσεκτα, δεν προσθέτουμε "leapDays".)
    function calculateDaysDifference(startDate, endDate) {
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round((end - start) / oneDay);
    }

    // Αν θες να τρέχει και με το φόρτωμα της σελίδας:
    calculateTotalExperience();
});
