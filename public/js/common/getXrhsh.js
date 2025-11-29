document.addEventListener("DOMContentLoaded", () => {
    // Αρχική τιμή από server-side render
    const initialYearInUse = '<%= typeof yearInUse !== "undefined" ? yearInUse : "" %>';
    const selectedYearElement = document.getElementById("selectedYear");
    
    // ✅ Έλεγχος αν υπάρχει το element
    if (! selectedYearElement) {
        return;
    }
    
    // Εμφάνιση αρχικής τιμής
    if (initialYearInUse) {
        selectedYearElement. innerHTML = `<span class="header-app-style-other">Χρήση : </span>`;
    }

    // Συνάρτηση ανανέωσης
    const updateYearInUse = async () => {
        try {
            // ✅ Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?.content;
            
            // ✅ CSP/CSRF safe fetch
            const response = await fetch('/api/yearInUse', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            // ✅ Χειρισμός 401 (not authenticated)
            if (response.status === 401) {
                selectedYearElement.innerHTML = '<span class="header-app-style-other">Χρήση : </span>';
                return;
            }

            // ✅ Έλεγχος HTTP status
            if (!response. ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // ✅ Έλεγχος content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return;
            }

            // ✅ Parse το response
            const text = await response.text();
            
            if (! text || text.trim() === '') {
                return;
            }
            
            const data = JSON.parse(text);
            
            // ✅ Ενημέρωση DOM
            if (data && data.yearInUse) {
                selectedYearElement.innerHTML = `<span class="header-app-style-other">Χρήση : ${data.yearInUse}</span>`;
            } else {
                selectedYearElement. innerHTML = '<span class="header-app-style-other">Χρήση : </span>';
            }
            
        } catch (error) {
            console.error("Πρόβλημα κατά την εμφάνιση του έτους χρήσης:", error);
            selectedYearElement.innerHTML = '<span class="header-app-style-other">Χρήση : </span>';
        }
    };

    setTimeout(() => {
        updateYearInUse();
    }, 100);
});