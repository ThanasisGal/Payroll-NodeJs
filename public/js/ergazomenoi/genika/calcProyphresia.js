document.addEventListener('DOMContentLoaded', function () {
    const proyphresiaSeEthInput = document.getElementById('proyphresia_se_eth');
    const proyphresiaSeMhnesInput = document.getElementById('proyphresia_se_mhnes');
    const hmeromhniaProslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
    const misthologikoKlimakioInput = document.getElementById('misthologiko_klimakio');

    const synoloEthInput = document.getElementById('synolo_proyphresias_se_eth');
    const synoloMhnesInput = document.getElementById('synolo_proyphresias_se_mhnes');

    // ΝΕΟ πεδίο:
    // Προϋπηρεσία για αποζημίωση.
    // Ενημερώνεται με τη συνολική προϋπηρεσία ΧΩΡΙΣ αφαίρεση παύσης πολυετίας.
    const proyphresiaApozhmioshsSeEthInput = document.getElementById(
        'proyphresia_apozhmioshs_se_eth'
    );

    // ΝΕΑ hidden πεδία από companyData
    const hmeromhniaPayshsPolyetiasApoInput = document.getElementById(
        'hmeromhniaPayshsPolyetiasApo'
    );
    const hmeromhniaPayshsPolyetiasEosInput = document.getElementById(
        'hmeromhniaPayshsPolyetiasEos'
    );

    proyphresiaSeEthInput.addEventListener('change', calculateTotalExperience);
    proyphresiaSeMhnesInput.addEventListener('change', calculateTotalExperience);
    hmeromhniaProslhpshsInput.addEventListener('change', calculateTotalExperience);

    // ============================================================
    // Parsing ημερομηνίας σε local Date.
    // Δέχεται:
    // - YYYY-MM-DD
    // - DD/MM/YYYY
    // - Date string από Mongo αν τυχόν έρθει έτσι
    // ============================================================
    function parseLocalDate(value) {
        if (!value) return null;

        const str = String(value).trim();
        if (!str) return null;

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const [y, m, d] = str.slice(0, 10).split('-').map(Number);
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d);
        }

        // DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            const [d, m, y] = str.split('/').map(Number);
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d);
        }

        // Fallback για Mongo Date string ή άλλο parseable date format.
        const parsed = new Date(str);
        if (isNaN(parsed.getTime())) return null;

        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    // ============================================================
    // Safe integer conversion.
    // Αν το πεδίο είναι κενό ή μη αριθμητικό επιστρέφει 0.
    // ============================================================
    function toIntOrZero(val) {
        const n = parseInt(val, 10);
        return Number.isFinite(n) ? n : 0;
    }

    // ============================================================
    // Διαφορά ημερομηνιών σε πλήρη έτη/μήνες.
    // Π.χ. 01/01/2005 έως σήμερα.
    // Δεν μετράει "σπασμένο" μήνα αν δεν έχει κλείσει η ημέρα.
    // ============================================================
    function getYearsMonthsDifference(startDate, endDate) {
        if (!startDate || !endDate || startDate > endDate) {
            return { years: 0, months: 0 };
        }

        let years = endDate.getFullYear() - startDate.getFullYear();
        let months = endDate.getMonth() - startDate.getMonth();

        // Αν η ημέρα του endDate είναι μικρότερη από την ημέρα του startDate,
        // τότε ο τελευταίος μήνας δεν έχει συμπληρωθεί πλήρως.
        if (endDate.getDate() < startDate.getDate()) {
            months--;
        }

        // Κανονικοποίηση αρνητικών μηνών.
        if (months < 0) {
            years--;
            months += 12;
        }

        // Ασφάλεια για ακραίες περιπτώσεις.
        if (years < 0) {
            years = 0;
            months = 0;
        }

        return { years, months };
    }

    // ============================================================
    // Αφαίρεση μηνών παύσης πολυετίας.
    // Επιστρέφει πόσα έτη/μήνες πρέπει να αφαιρεθούν.
    //
    // Κανόνες:
    // 1. Αν πρόσληψη < παύση_από:
    //    αφαιρούμε από παύση_από έως παύση_έως.
    //
    // 2. Αν πρόσληψη >= παύση_από και πρόσληψη <= παύση_έως:
    //    αφαιρούμε από ημερομηνία πρόσληψης έως παύση_έως.
    //
    // 3. Αν πρόσληψη > παύση_έως:
    //    δεν αφαιρούμε τίποτα.
    // ============================================================
    function getPolyetiaPauseToSubtract(hmeromhniaProslhpshs) {
        const pauseApo = parseLocalDate(hmeromhniaPayshsPolyetiasApoInput?.value);
        const pauseEos = parseLocalDate(hmeromhniaPayshsPolyetiasEosInput?.value);

        // Αν λείπει οποιαδήποτε ημερομηνία, δεν γίνεται αφαίρεση.
        if (!hmeromhniaProslhpshs || !pauseApo || !pauseEos) {
            return { years: 0, months: 0 };
        }

        // Αν η ημερομηνία λήξης παύσης είναι πριν από την έναρξη,
        // θεωρούμε άκυρο διάστημα και δεν αφαιρούμε τίποτα.
        if (pauseEos < pauseApo) {
            return { years: 0, months: 0 };
        }

        // Περίπτωση 1:
        // Πρόσληψη πριν από την έναρξη παύσης πολυετίας.
        if (hmeromhniaProslhpshs < pauseApo) {
            return getYearsMonthsDifference(pauseApo, pauseEos);
        }

        // Περίπτωση 2:
        // Πρόσληψη μέσα στο διάστημα παύσης πολυετίας.
        if (hmeromhniaProslhpshs >= pauseApo && hmeromhniaProslhpshs <= pauseEos) {
            return getYearsMonthsDifference(hmeromhniaProslhpshs, pauseEos);
        }

        // Περίπτωση 3:
        // Πρόσληψη μετά τη λήξη παύσης πολυετίας.
        return { years: 0, months: 0 };
    }

    function calculateTotalExperience() {
        const today = new Date();

        // Local σημερινή ημερομηνία χωρίς ώρα.
        const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const hmeromhniaProslhpshs = parseLocalDate(hmeromhniaProslhpshsInput.value);

        let yearsDifference = 0;
        let monthsDifference = 0;

        // Υπολογισμός προϋπηρεσίας από ημερομηνία πρόσληψης έως σήμερα.
        // Αν η πρόσληψη είναι στο μέλλον, κρατάμε 0.
        if (hmeromhniaProslhpshs && hmeromhniaProslhpshs <= todayLocal) {
            const diff = getYearsMonthsDifference(hmeromhniaProslhpshs, todayLocal);
            yearsDifference = diff.years;
            monthsDifference = diff.months;
        }

        // Χειροκίνητη/προηγούμενη προϋπηρεσία από τα πεδία της φόρμας.
        const proyphresiaSeEth = toIntOrZero(proyphresiaSeEthInput.value);
        const proyphresiaSeMhnes = toIntOrZero(proyphresiaSeMhnesInput.value);

        // ========================================================
        // Σύνολο προϋπηρεσίας ΠΡΙΝ την αφαίρεση παύσης πολυετίας.
        // Αυτό το σύνολο χρησιμοποιείται για την αποζημίωση.
        // ========================================================
        let totalYears = yearsDifference + proyphresiaSeEth;
        let totalMonths = monthsDifference + proyphresiaSeMhnes;

        // Κανονικοποίηση συνολικών μηνών.
        // Π.χ. 2 έτη και 15 μήνες => 3 έτη και 3 μήνες.
        if (totalMonths >= 12) {
            totalYears += Math.floor(totalMonths / 12);
            totalMonths = totalMonths % 12;
        }

        // ========================================================
        // Ενημέρωση προϋπηρεσίας αποζημίωσης.
        // Ζητούμενο:
        // Να ενημερώνεται με τη συνολική προϋπηρεσία ΧΩΡΙΣ την περίοδο παύσης.
        //
        // Εδώ γράφουμε μόνο τα έτη, γιατί το input είναι:
        // proyphresia_apozhmioshs_se_eth
        // ========================================================
        if (proyphresiaApozhmioshsSeEthInput) {
            proyphresiaApozhmioshsSeEthInput.value = totalYears;
        }

        // ========================================================
        // Από εδώ και κάτω υπολογίζουμε τη μισθολογική προϋπηρεσία,
        // δηλαδή τη συνολική προϋπηρεσία ΜΕ αφαίρεση παύσης πολυετίας.
        // ========================================================
        const pauseToSubtract = getPolyetiaPauseToSubtract(hmeromhniaProslhpshs);

        let totalMonthsAbsolute = totalYears * 12 + totalMonths;
        const pauseMonthsAbsolute = pauseToSubtract.years * 12 + pauseToSubtract.months;

        // Αφαιρούμε την περίοδο παύσης πολυετίας.
        totalMonthsAbsolute -= pauseMonthsAbsolute;

        // Ασφάλεια: ποτέ αρνητική προϋπηρεσία.
        if (totalMonthsAbsolute < 0) {
            totalMonthsAbsolute = 0;
        }

        // Επιστροφή από απόλυτους μήνες σε έτη/μήνες.
        totalYears = Math.floor(totalMonthsAbsolute / 12);
        totalMonths = totalMonthsAbsolute % 12;

        // Τα πεδία συνόλου προϋπηρεσίας παίρνουν τη μισθολογική προϋπηρεσία,
        // δηλαδή μετά την αφαίρεση παύσης πολυετίας.
        synoloEthInput.value = totalYears;
        synoloMhnesInput.value = totalMonths;

        updateMisthologikoKlimakio(totalYears);
    }

    function updateMisthologikoKlimakio(totalYears) {
        // Δική σου λογική:
        // ξεκινάει από 1 και μετά = years + 1.
        const misthologikoKlimakio = totalYears >= 1 ? totalYears + 1 : 1;
        misthologikoKlimakioInput.value = misthologikoKlimakio;
    }

    // Υπολογισμός με το φόρτωμα της σελίδας.
    calculateTotalExperience();
});
