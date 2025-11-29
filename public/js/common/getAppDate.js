document.addEventListener("DOMContentLoaded", () => {
    // Αρχική τιμή από server-side render
    const initialAppDate = '<%= typeof appDate !== "undefined" ? appDate : "" %>';
    const selectedAppDateElement = document.getElementById("selectedAppDate");
    
    // ✅ Έλεγχος αν υπάρχει το element
    if (!selectedAppDateElement) {
        return;
    }
    
    // Εμφάνιση αρχικής τιμής
    if (initialAppDate) {
        selectedAppDateElement.innerHTML = `<span class="header-app-style-other">Ημερομηνία : ${formatDate(initialAppDate)}</span>`;
    }

    // Helper για format ημερομηνίας
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateString;
        }
    }

    // Συνάρτηση ανανέωσης
    const updateAppDate = async () => {
        try {
            // ✅ Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?.content;
            
            // ✅ CSP/CSRF safe fetch
            const response = await fetch('/api/appDate', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            // ✅ Χειρισμός 401 (not authenticated)
            if (response.status === 401) {
                selectedAppDateElement.innerHTML = '<span class="header-app-style-other">Ημερομηνία : </span>';
                return;
            }

            // ✅ Έλεγχος HTTP status
            if (!response. ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // ✅ Έλεγχος content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType. includes('application/json')) {
                return;
            }

            // ✅ Parse το response
            const text = await response.text();
            
            if (!text || text.trim() === '') {
                return;
            }
            
            const data = JSON. parse(text);
            
            // ✅ Ενημέρωση DOM
            if (data && data.appDate) {
                selectedAppDateElement.innerHTML = `<span class="header-app-style-other">Ημερομηνία : ${formatDate(data.appDate)}</span>`;
            } else {
                selectedAppDateElement.innerHTML = '<span class="header-app-style-other">Ημερομηνία : -</span>';
            }
            
        } catch (error) {
            console.error("Πρόβλημα κατά την εμφάνιση της ημερομηνίας:", error);
            selectedAppDateElement.innerHTML = '<span class="header-app-style-other">Ημερομηνία : -</span>';
        }
    };

    setTimeout(() => {
        updateAppDate();
    }, 100);
});