document.addEventListener("DOMContentLoaded", function () {
    const xrhseisDropdown = document. getElementById("xrhseis");

    // ✅ Έλεγχος αν υπάρχει το dropdown
    if (! xrhseisDropdown) {
        return;
    }

    const loadXrhseis = async () => {
        try {
            // Εμφάνιση loading state
            xrhseisDropdown.innerHTML = '<option value=""></option>';
            xrhseisDropdown.disabled = true;

            // ✅ Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?. content;

            // ✅ CSP/CSRF safe fetch
            const response = await fetch('/api/xrhseis', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'  // ✅ Στέλνει session cookies
            });

            // ✅ Χειρισμός 401 (not authenticated)
            if (response.status === 401) {
                xrhseisDropdown. innerHTML = '<option value=""></option>';
                xrhseisDropdown.disabled = true;
                return;
            }

            // ✅ Έλεγχος HTTP status
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response. statusText}`);
            }

            // ✅ Έλεγχος content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType. includes('application/json')) {
                throw new Error('Response is not JSON');
            }

            // ✅ Parse το response
            const text = await response.text();
            
            if (!text || text.trim() === '') {
                throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);

            // ✅ Έλεγχος αν είναι array
            if (!Array.isArray(data.xrhseis)) {
                throw new Error('Invalid data format');
            }

            // Reset dropdown
            xrhseisDropdown.innerHTML = '<option value="" selected></option>';
            xrhseisDropdown.disabled = false;

            // ✅ Populate dropdown
            if (data.xrhseis.length === 0) {
                xrhseisDropdown.innerHTML = '<option value=""></option>';
                xrhseisDropdown.disabled = true;
                return;
            }

            data.xrhseis.forEach((xrhsh) => {
                const option = new Option(xrhsh.etos, xrhsh.etos);
                xrhseisDropdown.appendChild(option);
            });

        } catch (error) {
            console.error("Error loading years:", error);
            xrhseisDropdown.innerHTML = '<option value="">Σφάλμα φόρτωσης</option>';
            xrhseisDropdown.disabled = true;
        }
    };

    // Κάλεσε τη φόρτωση με μικρό delay
    setTimeout(() => {
        loadXrhseis();
    }, 100);
});