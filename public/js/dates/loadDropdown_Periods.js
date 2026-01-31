document.addEventListener("DOMContentLoaded", function () {
    const periodoiDropdown = document.getElementById("periodoi");

    // ✅ Έλεγχος αν υπάρχει το dropdown
    if (! periodoiDropdown) {
        return;
    }

    const loadPeriodoi = async () => {
        try {
            // Εμφάνιση loading state
            periodoiDropdown. innerHTML = '<option value=""></option>';
            periodoiDropdown.disabled = true;

            // ✅ Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?.content;

            // ✅ CSP/CSRF safe fetch
            const response = await fetch('/api/periodoi', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'  // ✅ Στέλνει session cookies
            });

            // ✅ Χειρισμός 401 (not authenticated)
            if (response.status === 401) {
                periodoiDropdown.innerHTML = '<option value=""></option>';
                periodoiDropdown.disabled = true;
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
            
            if (! text || text.trim() === '') {
                throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);

            // ✅ Έλεγχος αν είναι array
            if (! Array.isArray(data. periodoi)) {
                throw new Error('Invalid data format');
            }

            // Reset dropdown
            periodoiDropdown.innerHTML = '<option value="" selected></option>';
            periodoiDropdown.disabled = false;

            // ✅ Populate dropdown
            if (data.periodoi.length === 0) {
                periodoiDropdown.innerHTML = '<option value=""></option>';
                periodoiDropdown.disabled = true;
                return;
            }

            data.periodoi.forEach((periodos) => {
                const option = new Option(periodos.perigrafh, periodos.kodikos);
                periodoiDropdown.appendChild(option);
            });

        } catch (error) {
            console.error("Error loading periods:", error);
            periodoiDropdown.innerHTML = '<option value="">Σφάλμα φόρτωσης</option>';
            periodoiDropdown.disabled = true;
        }
    };

    // Κάλεσε τη φόρτωση με μικρό delay
    setTimeout(() => {
        loadPeriodoi();
    }, 100);
});