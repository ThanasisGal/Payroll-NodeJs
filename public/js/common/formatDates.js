// Μετατρέπει μια ημερομηνία μορφής ΗΗ/ΜΜ/ΕΕΕΕ σε ISO string (yyyy-mm-ddTHH:MM:SS.sssZ).
function formatDateToISO(dateString) {
    if (!dateString) return "";
    const [day, month, year] = dateString.split("/").map(Number); // Μετατροπή σε αριθμούς
    const dateObject = new Date(Date.UTC(year, month - 1, day)); // Δημιουργία UTC ημερομηνίας
    return dateObject.toISOString();
}

// Επιστρέφει string ημερομηνίας σε μορφή ΗΗ/ΜΜ/ΕΕΕΕ (ελληνικό locale).
function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Μετατρέπει ένα string "yyyy-mm-ddT00:00:00.000" σε string dd/mm/yyyy
function formatDateRepo_Argies(dateString) {
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, '0'); // Πάντα διψήφιος αριθμός
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Μήνες από 0-11
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateToYYYY_MM_DD(dateString) {
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, '0'); // Πάντα διψήφιος αριθμός
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Μήνες από 0-11
    const year = date.getUTCFullYear();
    return `${year}-${month}-${day}`;
}

// Μετατρέπει ένα Date String object σε string "yyyy-mm-ddT00:00:00.000"
function formatDateToCustom(dateString) {
    // if (!(date instanceof Date) || isNaN(date)) return null;
    // if (isNaN(date)) return null;
    date = new Date(dateString)
    const year = date.getUTCFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    // Σταθερό T00:00:00.000
    // return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return `${year}-${month}-${day}T00:00:00.000Z`;
}

// Συνάρτηση μετατροπής "DD/MM/YYYY" σε Date με μορφή YYYYMMDD
function parseDateDDMMYYYY(ddmmyyyy) {
    if (!ddmmyyyy) return null;
    const [day, month, year] = ddmmyyyy.split('/');
    return new Date(Number(year), Number(month) - 1, Number(day));
}
  
// Συνάρτηση εύρεσης format της χρησιμοποιούμενης ημερομηνίας
function detectDateFormat(dateString) {
    if (dateString instanceof Date) {
        return "DateObject";
    }

    if (typeof dateString !== "string") {
        return null;
    }

    // Έλεγχος για μορφή "DD/MM/YYYY"
    const ddmmyyyyRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (ddmmyyyyRegex.test(dateString)) {
        return "DD/MM/YYYY";
    }

    // Έλεγχος για μορφή "YYYY-MM-DD"
    const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (yyyymmddRegex.test(dateString)) {
        return "YYYY-MM-DD";
    }

    return null; // Άγνωστη μορφή
}

// Συνάρτηση μορφοποίησης για εμφάνιση (πχ μετατρέπει "2024-10-06" ή το Date object σε "06/10/2024". 
function formatDateRepoArgies(dateString) {
    const format = detectDateFormat(dateString);

    if (format === "DateObject") {
        // Αν είναι Date object, το μετατρέπουμε σε "DD/MM/YYYY"
        return dateString.toLocaleDateString("el-GR");
    } else if (format === "YYYY-MM-DD") {
        // Αν είναι "YYYY-MM-DD", το μετατρέπουμε σε "DD/MM/YYYY"
        return dateString.split("-").reverse().join("/");
    } else if (format === "DD/MM/YYYY") {
        return dateString; // Είναι ήδη στη σωστή μορφή
    }
}

function isLeapYear(year) {
    if (year % 4 === 0) {
        if (year % 100 === 0) {
            if (year % 400 === 0) {
                return true; // Δίσεκτο γιατί διαιρείται επίσης από 400
            }
            return false; // Όχι δίσεκτο γιατί διαιρείται από 100 αλλά όχι από 400
        }
        return true; // Δίσεκτο γιατί διαιρείται από 4 και όχι από 100
    }
    return false; // Όχι δίσεκτο γιατί δεν διαιρείται καν από 4
}