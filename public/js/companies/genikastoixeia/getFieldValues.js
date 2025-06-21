document.addEventListener("DOMContentLoaded", () => {
    async function handleFormSubmit(event) {
        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll(".card-body");

        sections.forEach((section) => {
            const inputs = section.querySelectorAll("input, select, textarea");
            inputs.forEach((input) => {
                if (input.tagName === "INPUT") {
                    if (input.type === "checkbox") {
                        formData[input.name] = input.checked;
                    } else if (input.type === "date" && input.value === "") {
                        formData[input.name] = null;
                    } else if (input.type === "file" && input.files.length > 0) {
                        const filePromise = new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = function (e) {
                                formData[input.name] = e.target.result;
                                resolve();
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(input.files[0]);
                        });
                        filePromises.push(filePromise);
                    } else {
                        formData[input.name] = input.value;
                    }
                } else if(input.tagName === "TEXTAREA") {
                    formData[input.name] = input.value;
                } else if (input.tagName === "SELECT") {
                    if (input.multiple) {
                        const selectedOptions = Array.from(input.selectedOptions).map(option => option.value);
                        formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                    } else {
                        formData[input.name] = input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        console.log(formData);
        
        if (!formData.eponymia || formData.eponymia === "") {
            Swal.fire({
                icon: "error",
                title: "Προσοχή !!!",
                html: `Το πεδίο Επώνυμο/μία είναι <strong>ΥΠΟΧΡΕΩΤΙΚΟ</strong>`,
                timer: 3000,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
            return;
        }
            
        try {
            await Promise.all(filePromises);
            const response = await fetch("/companies/genikastoixeia/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });
  
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
  
            const data = await response.json();
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Επιτυχής ενημέρωση των αρχείων",
                    timer: 1500,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: "custom-swal-popup",
                        confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    }
                }).then(() => {
                    window.location.href = data.redirectUrl;
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Προσοχή !!!",
                    html: `Πρέπει να γίνει <strong>ΥΠΟΧΡΕΩΤΙΚΑ</strong> Επιλογή Χρηστών, που θα έχουν πρόσβαση στην εταιρεία, δηλώνοντάς τους <br><strong>στη σελίδα Διάφορα</strong>`,
                    timer: 4000,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: 'class-error custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                });
            }
        } catch (error) {
            console.log("Σφάλμα:", error);
        }  
    }

    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
});
