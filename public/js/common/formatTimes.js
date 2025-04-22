/**
 * “Ζωντανή” μορφοποίηση κατά το πληκτρολόγημα (input event).
 * Π.χ.:
 *  - Πληκτρολογώντας "830" → αμέσως "08:30"
 *  - Πληκτρολογώντας "2030" → αμέσως "20:30"
 *  - Πληκτρολογώντας "1015" → αμέσως "10:15"
 */
function autoFormatTime(inputEl) {
    // Αφαιρούμε μη-ψηφία
    let val = inputEl.value.replace(/\D/g, '');
    
    // Περιορίζουμε σε 4 ψηφία max
    if (val.length > 4) {
        val = val.slice(0, 4);
    }

    switch (val.length) {
    case 0:
    case 1:
    case 2:
        inputEl.value = val;
        break;
    
    case 3: {
        const firstTwo = parseInt(val.slice(0, 2), 10);
        if (firstTwo <= 23) {
            // π.χ. "20" + "3" => "20:3"
            inputEl.value = val.slice(0, 2) + ':' + val.slice(2);
        } else {
            // π.χ. "83" => single-digit hour "08" + "30"
            let hours = val.slice(0, 1).padStart(2, '0');
            let minutes = val.slice(1);
            inputEl.value = hours + ':' + minutes;
        }
        break;
    }

    case 4:
        // π.χ. "2030" => "20:30", "1015" => "10:15"
        let hours = val.slice(0, 2);
        let minutes = val.slice(2);
        inputEl.value = hours + ':' + minutes;
        break;
    }
}

/**
 * Τελική διόρθωση στο blur (π.χ. αν κάποιος έμεινε με "83" ή "1015" χωρίς ':').
 * Εδώ διαχειριζόμαστε 2-4 ψηφία συνεχόμενα (π.χ."93 → 09:03" ή "830" → "08:30").
 */
function transformTimeValue(value) {
    let val = value.trim();

    // (A) Περίπτωση ακριβώς 2 ψηφίων (π.χ. "93" -> "09:03")
    if (/^\d{2}$/.test(val)) {
        // 1ο ψηφίο = ώρες, 2ο ψηφίο = λεπτά
        let hrs = val[0].padStart(2, '0'); 
        let mins = val[1].padStart(2, '0');
        return `${hrs}:${mins}`; // π.χ. "09:03"
    }

    // (B) Περίπτωση 3-4 ψηφίων ΧΩΡΙΣ ':'
    //     π.χ. "830" -> "08:30", "930" -> "09:30", "945" -> "09:45", "120" -> "01:20" (;)
    //     (η λογική εδώ είναι ίδια ή παρόμοια με πριν)
    if (/^\d{3,4}$/.test(val)) {
        let len = val.length;
        if (len === 3) {
            let firstTwo = parseInt(val.slice(0, 2), 10);
            if (firstTwo <= 23) {
                // π.χ. "20" + "3" = "20:3" (μετά αφήνεις το '3', αν θες padding κάνε το στο blur ή σε επόμενο βήμα)
                return val.slice(0, 2) + ':' + val.slice(2);
            } else {
                // π.χ. "83" -> "08:3"
                let hours = val.slice(0, 1).padStart(2, '0');
                let minutes = val.slice(1);
                return hours + ':' + minutes; 
            }
        } else {
            // len === 4 π.χ. "0930" -> "09:30"
            let hours = val.slice(0, 2);
            let minutes = val.slice(2);
            return hours + ':' + minutes; 
        }
    }

    // (C) Αν υπάρχει ήδη ':' (π.χ. "9:3", "12:2", "20:30")
    if (val.includes(':')) {
        let [hrs, mins] = val.split(':');

        // Αν ο χρήστης έμεινε με π.χ. "9:", "12:" 
        if (!mins) {
            mins = '00';
        }
    
        // Συμπληρώνω ώρες/λεπτά στα 2 ψηφία
        hrs = hrs.padStart(2, '0');
        mins = mins.padStart(2, '0');
        return `${hrs}:${mins}`;
    }

    // (D) Αλλιώς, το αφήνουμε όπως είναι
    return val;
}
