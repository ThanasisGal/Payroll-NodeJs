document.addEventListener('DOMContentLoaded', () => {
    // Αντιστοιχίσεις:  checkbox ID → dropdown ID
    const checkboxDropdownMap = {
        'meiosh_eisforon_ergazomenon': 'meiosh_ergatikhs_eisforas',
        'epidothsh_eisforon_ergodoth': 'epidothsh_ergodotikhs_eisforas',
        'mhteres': 'meiosh_eisforas_mhteron'
    };

    Object.entries(checkboxDropdownMap).forEach(([checkboxId, dropdownId]) => {
        const checkbox = document.getElementById(checkboxId);
        const dropdown = document.getElementById(dropdownId);

        if (! checkbox || !dropdown) return;

        checkbox.addEventListener('change', () => {
            // Αν το checkbox γίνει false (unchecked = ΟΧΙ)
            if (!checkbox.checked) {
                // Βρες το Tom-Select instance
                const tomInstance = dropdown.tomselect;
                
                if (tomInstance) {
                    // Βρες το trash button μέσα στο wrapper
                    const trashBtn = tomInstance.wrapper.querySelector('.ts-single-reset-btn');
                    
                    if (trashBtn && ! trashBtn.hidden) {
                        // Κάνε κλικ στο trash
                        trashBtn.click();
                        console.log(`✅ Auto-cleared dropdown:  ${dropdownId}`);
                    }
                }
            }
        });
    });
});
