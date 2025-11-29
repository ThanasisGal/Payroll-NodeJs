// document.addEventListener("DOMContentLoaded", () => {
    
//     const initialPeriod = '<%= typeof periodInUseDescr !== "undefined" ? periodInUseDescr : "" %>';
//     document.getElementById("selectedPeriod").innerHTML =
//     initialPeriod;
  
//     const updatePeriod = async () => {
//       try {
//         const response = await fetch(`/api/periodInUse`);
//         const newPeriodInUse = await response.text();
//         document.getElementById("selectedPeriod").innerHTML =
//           "Περίοδος : " + newPeriodInUse.substring(1, newPeriodInUse.length - 1);
//       } catch (error) {
//         console.error("Πρόβλημα κατά την εμφάνιση της περιόδου εργασίας:", error);
//       }
//     };
  
//     updatePeriod();
// });
  
document.addEventListener("DOMContentLoaded", () => {
    // Αρχική τιμή από server-side render
    const initialPeriod = '<%= typeof periodInUseDescr !== "undefined" ? periodInUseDescr : "" %>';
    const selectedPeriodElement = document.getElementById("selectedPeriod");
    
    // ✅ Έλεγχος αν υπάρχει το element
    if (! selectedPeriodElement) {
        return;
    }
    
    // Εμφάνιση αρχικής τιμής
    if (initialPeriod) {
        selectedPeriodElement. innerHTML = `<span class="header-app-style-other">Περίοδος : </span>`;
    }

    // Συνάρτηση ανανέωσης
    const updatePeriod = async () => {
        try {
            // ✅ Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?.content;
            
            // ✅ CSP/CSRF safe fetch
            const response = await fetch('/api/periodInUse', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            // ✅ Χειρισμός 401 (not authenticated)
            if (response.status === 401) {
                selectedPeriodElement.innerHTML = '<span class="header-app-style-other">Περίοδος : </span>';
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
            if (data && data.periodInUseDescr) {
                selectedPeriodElement.innerHTML = `<span class="header-app-style-other">Περίοδος : ${data.periodInUseDescr}</span>`;
            } else {
                selectedPeriodElement.innerHTML = '<span class="header-app-style-other">Περίοδος : </span>';
            }
            
        } catch (error) {
            console.error("Πρόβλημα κατά την εμφάνιση της περιόδου χρήσης:", error);
            selectedPeriodElement.innerHTML = '<span class="header-app-style-other">Περίοδος : </span>';
        }
    };

    setTimeout(() => {
        updatePeriod();
    }, 100);
});