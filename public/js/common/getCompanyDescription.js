document.addEventListener("DOMContentLoaded", () => {
    // Αρχική τιμή από το server-side render
    const initialCompanyDescription = 
        `<%= typeof companyDescription !== "undefined" ? companyDescription : "" %>`;
    
    const selectedCompanyElement = document.getElementById("selectedCompany");
    
    if (selectedCompanyElement && initialCompanyDescription) {
        selectedCompanyElement.innerHTML = '<span class="header-app-style-company">Εταιρεία :</span>';
    }

    // Συνάρτηση ανανέωσης της περιγραφής εταιρείας
    const updateCompanyDescription = async () => {
        try {
            // Πάρε το CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value 
                           || document.querySelector('meta[name="csrf-token"]')?.content;
            
            // Κάνε το API call
            const response = await fetch('/api/companyDescription', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken && { 'CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            // Έλεγχος HTTP status
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Έλεγχος αν υπάρχει content
            const contentType = response.headers.get('content-type');
            if (! contentType || !contentType.includes('application/json')) {
                console.warn("Response is not JSON:", contentType);
                const text = await response.text();
                console.log("Raw response:", text);
                return;
            }

            // Parse το response body ως text πρώτα
            const text = await response.text();
            
            // Έλεγχος αν είναι κενό
            if (!text || text.trim() === '') {
                console.warn("Empty response from API");
                return;
            }
            
            // Parse το JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error("JSON parse error:", parseError);
                console.log("Failed to parse:", text);
                return;
            }
            
            // Ενημέρωση του DOM
            if (data && data.newCompanyDescription) {
                const newCompanyDescription = "Εταιρεία : " + data.newCompanyDescription;
                
                if (selectedCompanyElement) {
                    // Αφαίρεση quotes αν υπάρχουν
                    const cleanDescription = newCompanyDescription.length > 2
                        ? newCompanyDescription. substring(0, newCompanyDescription.length - 1)
                        : newCompanyDescription;
                    
                    selectedCompanyElement.innerHTML = cleanDescription;
                } else {
                    console.warn("Element #selectedCompany not found");
                }
            }
            
        } catch (error) {
            console.error("Error updating company description:", error);
            
            if (selectedCompanyElement) {
                selectedCompanyElement.innerHTML = '<span class="header-app-style-company">Εταιρεία :</span>';
            }
        }
    };

    setTimeout(() => {
        updateCompanyDescription();
    }, 100);
});