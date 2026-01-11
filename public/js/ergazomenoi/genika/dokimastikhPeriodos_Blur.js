// document.addEventListener('DOMContentLoaded', function() {
//     const hmniaLhxhsField = document.getElementById('hmnia_lhxhs_dokimastikhs_periodoy');

//     // Event listener για το blur του πεδίου hmnia_lhxhs_dokimastikhs_periodoy
//     if (hmniaLhxhsField) {
//         hmniaLhxhsField.addEventListener('blur', async function() {
//             const dokimastikiPeridoosDate = this.value;
            
//             if (dokimastikiPeridoosDate) {
//                 // Παίρνουμε τις απαραίτητες τιμές
//                 const sxeshErgasiasStathera = document.getElementById('sxesh_ergasias_stathera');
//                 const hmeromhniaProslhpshs = document.getElementById('hmeromhnia_proslhpshs');
//                 const hmeromhniaLhxhsSymbashs = document.getElementById('hmeromhnia_lhxhs_symbashs');
                
//                 if (! hmeromhniaProslhpshs || !hmeromhniaProslhpshs.value) {
//                     await Swal.fire({
//                         backdrop: false,
//                         allowOutsideClick: false,
//                         icon: "warning",
//                         title: "ΠΡΟΣΟΧΗ !!!",
//                         html: `<p class="error-header">Παρακαλώ συμπληρώστε πρώτα την <strong>Ημερομηνία Πρόσληψης</strong></p>`,
//                         heightAuto: true,
//                         confirmButtonText:  "Κλείσιμο",
//                         customClass:  {
//                             confirmButton: "class-warning custom-confirm-button custom-swal-button",
//                             title: "custom-title",
//                             popup: "custom-swal-popup",
//                             htmlContainer: "custom-html-container",
//                         },
//                     });
//                     this.value = '';
//                     return;
//                 }
                
//                 // Μετατροπή σε Date objects
//                 const dateDokimastiki = new Date(dokimastikiPeridoosDate);
//                 const dateProslhpsh = new Date(hmeromhniaProslhpshs.value);
                
//                 // Υπολογισμός ημερομηνίας πρόσληψης + 6 μήνες
//                 const maxDate6Months = new Date(dateProslhpsh);
//                 maxDate6Months.setMonth(maxDate6Months.getMonth() + 6);
                
//                 let isValid = false;
//                 let errorMessage = '';
                
//                 // Έλεγχος αν sxesh_ergasias_stathera είναι 0
//                 if (sxeshErgasiasStathera && sxeshErgasiasStathera.value === '0') {
//                     // Περίπτωση 1: Σταθερή σχέση εργασίας (0)
//                     if (dateDokimastiki <= maxDate6Months) {
//                         isValid = true;
//                     } else {
//                         errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από <strong>6 μήνες</strong> από την ημερομηνία πρόσληψης.';
//                     }
//                 } else {
//                     // Περίπτωση 2: Άλλη σχέση εργασίας
//                     if (!hmeromhniaLhxhsSymbashs || !hmeromhniaLhxhsSymbashs.value) {
//                         await Swal.fire({
//                             backdrop: false,
//                             allowOutsideClick: false,
//                             icon: "warning",
//                             title: "ΠΡΟΣΟΧΗ !!!",
//                             html: `<p class="error-header">Παρακαλώ συμπληρώστε πρώτα την <strong>Ημερομηνία Λήξης Σύμβασης</strong></p>`,
//                             heightAuto: true,
//                             confirmButtonText: "Κλείσιμο",
//                             customClass: {
//                                 confirmButton: "class-warning custom-confirm-button custom-swal-button",
//                                 title: "custom-title",
//                                 popup: "custom-swal-popup",
//                                 htmlContainer: "custom-html-container",
//                             },
//                         });
//                         this.value = '';
//                         return;
//                     }
                    
//                     const dateLhxhSymbashs = new Date(hmeromhniaLhxhsSymbashs.value);
                    
//                     // Υπολογισμός διαφοράς σε ημέρες
//                     const diafora = dateLhxhSymbashs - dateProslhpsh;
//                     const diaforaDays = diafora / (1000 * 60 * 60 * 24);
                    
//                     // Υπολογισμός 1/4 της διαφοράς
//                     const maxDays = diaforaDays / 4;
//                     const maxDateQuarter = new Date(dateProslhpsh);
//                     maxDateQuarter.setDate(maxDateQuarter.getDate() + maxDays);
                    
//                     // Η ημερομηνία πρέπει να είναι <= 1/4 της διαφοράς ΚΑΙ <= 6 μήνες
//                     const maxAllowedDate = maxDateQuarter < maxDate6Months ? maxDateQuarter : maxDate6Months;
                    
//                     if (dateDokimastiki <= maxAllowedDate) {
//                         isValid = true;
//                     } else {
//                         if (maxDateQuarter < maxDate6Months) {
//                             errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από το <strong>1/4 της διάρκειας της σύμβασης</strong>.';
//                         } else {
//                             errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από <strong>6 μήνες</strong> από την ημερομηνία πρόσληψης.';
//                         }
//                     }
//                 }
                
//                 // Εμφάνιση μηνύματος και καθαρισμός αν δεν είναι έγκυρη
//                 if (!isValid) {
//                     await Swal.fire({
//                         backdrop: false,
//                         allowOutsideClick: false,
//                         icon: "error",
//                         title: "ΜΗ ΕΓΚΥΡΗ ΗΜΕΡΟΜΗΝΙΑ !!!",
//                         html: `<p class="error-header">${errorMessage}</p>`,
//                         heightAuto: true,
//                         confirmButtonText: "Κλείσιμο",
//                         customClass: {
//                             confirmButton: "class-warning custom-confirm-button custom-swal-button",
//                             title: "custom-title",
//                             popup: "custom-swal-popup",
//                             htmlContainer: "custom-html-container",
//                         },
//                     });
//                     this.value = '';
//                     return;
//                 }
                
//                 // Αν όλα ΟΚ, ενημέρωση του hmeromhnia_lhxhs_symbashs
//                 if (hmeromhniaLhxhsSymbashs) {
//                     hmeromhniaLhxhsSymbashs.value = dokimastikiPeridoosDate;
//                 }
//             }
//         });
//     }
// });
document.addEventListener('DOMContentLoaded', function() {
    const hmniaLhxhsField = document.getElementById('hmnia_lhxhs_dokimastikhs_periodoy');

    // Event listener για το blur του πεδίου hmnia_lhxhs_dokimastikhs_periodoy
    if (hmniaLhxhsField) {
        hmniaLhxhsField.addEventListener('blur', async function() {
            const dokimastikiPeridoosDate = this.value;
            
            if (dokimastikiPeridoosDate) {
                // Παίρνουμε τις απαραίτητες τιμές
                const sxeshErgasiasStathera = document.getElementById('sxesh_ergasias_stathera');
                const hmeromhniaProslhpshs = document.getElementById('hmeromhnia_proslhpshs');
                const hmeromhniaLhxhsSymbashs = document.getElementById('hmeromhnia_lhxhs_symbashs');
                
                if (! hmeromhniaProslhpshs || !hmeromhniaProslhpshs.value) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "warning",
                        title: "ΠΡΟΣΟΧΗ !!!",
                        html: `<p class="error-header">Παρακαλώ συμπληρώστε πρώτα την <strong>Ημερομηνία Πρόσληψης</strong></p>`,
                        heightAuto: true,
                        confirmButtonText: "Κλείσιμο",
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                            htmlContainer: "custom-html-container",
                        },
                    });
                    this.value = '';
                    return;
                }
                
                // Μετατροπή σε Date objects
                const dateDokimastiki = new Date(dokimastikiPeridoosDate);
                const dateProslhpsh = new Date(hmeromhniaProslhpshs.value);
                
                // Υπολογισμός ημερομηνίας πρόσληψης + 6 μήνες
                const maxDate6Months = new Date(dateProslhpsh);
                maxDate6Months.setMonth(maxDate6Months.getMonth() + 6);
                
                let isValid = false;
                let errorMessage = '';
                let suggestedDate = null;
                
                // Έλεγχος αν sxesh_ergasias_stathera είναι 0
                if (sxeshErgasiasStathera && sxeshErgasiasStathera.value === '0') {
                    // Περίπτωση 1: Σταθερή σχέση εργασίας (0)
                    if (dateDokimastiki <= maxDate6Months) {
                        isValid = true;
                    } else {
                        errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από <strong>6 μήνες</strong> από την ημερομηνία πρόσληψης.';
                        suggestedDate = maxDate6Months;
                    }
                } else {
                    // Περίπτωση 2: Άλλη σχέση εργασίας
                    if (! hmeromhniaLhxhsSymbashs || !hmeromhniaLhxhsSymbashs.value) {
                        await Swal.fire({
                            backdrop: false,
                            allowOutsideClick: false,
                            icon: "warning",
                            title: "ΠΡΟΣΟΧΗ !!!",
                            html: `<p class="error-header">Παρακαλώ συμπληρώστε πρώτα την <strong>Ημερομηνία Λήξης Σύμβασης</strong></p>`,
                            heightAuto: true,
                            confirmButtonText: "Κλείσιμο",
                            customClass: {
                                confirmButton: "class-warning custom-confirm-button custom-swal-button",
                                title: "custom-title",
                                popup: "custom-swal-popup",
                                htmlContainer: "custom-html-container",
                            },
                        });
                        this.value = '';
                        return;
                    }
                    
                    const dateLhxhSymbashs = new Date(hmeromhniaLhxhsSymbashs.value);
                    
                    // Υπολογισμός διαφοράς σε ημέρες
                    const diafora = dateLhxhSymbashs - dateProslhpsh;
                    const diaforaDays = diafora / (1000 * 60 * 60 * 24);
                    
                    // Υπολογισμός 1/4 της διαφοράς
                    const maxDays = diaforaDays / 4;
                    const maxDateQuarter = new Date(dateProslhpsh);
                    maxDateQuarter.setDate(maxDateQuarter.getDate() + maxDays);
                    
                    // Η ημερομηνία πρέπει να είναι <= 1/4 της διαφοράς ΚΑΙ <= 6 μήνες
                    const maxAllowedDate = maxDateQuarter < maxDate6Months ? maxDateQuarter : maxDate6Months;
                    
                    if (dateDokimastiki <= maxAllowedDate) {
                        isValid = true;
                    } else {
                        if (maxDateQuarter < maxDate6Months) {
                            // ✅ ΠΡΟΤΕΙΝΟΥΜΕ:  Πρόσληψη + 1/4 της διάρκειας
                            errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από το <strong>1/4 της διάρκειας της σύμβασης</strong>. <br><br>Η προτεινόμενη ημερομηνία λήξης δοκιμαστικής περιόδου είναι: <strong>' + formatDateToGreek(maxDateQuarter) + '</strong>';
                            suggestedDate = maxDateQuarter;
                        } else {
                            errorMessage = 'Η ημερομηνία λήξης δοκιμαστικής περιόδου δεν μπορεί να είναι μεγαλύτερη από <strong>6 μήνες</strong> από την ημερομηνία πρόσληψης. <br><br>Η προτεινόμενη ημερομηνία λήξης δοκιμαστικής περιόδου είναι: <strong>' + formatDateToGreek(maxDate6Months) + '</strong>';
                            suggestedDate = maxDate6Months;
                        }
                    }
                }
                
                // Εμφάνιση μηνύματος και ενημέρωση με προτεινόμενη ημερομηνία
                if (! isValid && suggestedDate) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "warning",
                        title: "ΜΗ ΕΓΚΥΡΗ ΗΜΕΡΟΜΗΝΙΑ !!!",
                        html: `<p class="error-header">${errorMessage}</p>`,
                        heightAuto: true,
                        confirmButtonText: "Αποδοχή",
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                            htmlContainer: "custom-html-container",
                        },
                    });
                    
                    // ✅ Θέλουμε την προτεινόμενη ημερομηνία
                    const suggestedDateISO = formatDateToISO(suggestedDate);
                    this.value = suggestedDateISO;
                    
                    // ✅ Ενημερώνουμε το hmeromhnia_lhxhs_symbashs
                    if (hmeromhniaLhxhsSymbashs) {
                        hmeromhniaLhxhsSymbashs.value = suggestedDateISO;
                    }   
                    
                    return;
                }
                
                // Αν όλα ΟΚ, ενημέρωση του hmeromhnia_lhxhs_symbashs
                if (isValid && hmeromhniaLhxhsSymbashs) {
                    hmeromhniaLhxhsSymbashs.value = dokimastikiPeridoosDate;
                }
            }
        });
    }
    
    /**
     * ✅ Helper function - Format date σε ελληνική μορφή (ΗΗ/ΜΜ/ΕΕΕΕ)
     */
    function formatDateToGreek(date) {
        const day = ('0' + date.getDate()).slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    /**
     * ✅ Helper function - Format date σε ISO μορφή (ΕΕΕΕ-ΜΜ-ΗΗ)
     */
    function formatDateToISO(date) {
        const day = ('0' + date.getDate()).slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }
});