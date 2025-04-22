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
          } else if (input.type === "time" && input.value === "") {
            formData[input.name] = null;
          } else if (input.type === "number" && input.value === "") {
            formData[input.name] = 0;
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

    try {
      await Promise.all(filePromises);
      const response = await fetch("/ergazomenoi/ergazomenoi/add", {
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
          title: "Επιτυχής ενημέρωση των αρχείων :",
          html: `
            <ul>
              <li><i class="bi bi-check-lg" style="color: green"></i> Εργαζόμενων</li>
              <li><i class="bi bi-check-lg" style="color: green"></i> Ωραρίων</li>
              <li><i class="bi bi-check-lg" style="color: green"></i> Ιστορικό Προσλήψεων - Αλλαγών</li>
            </ul>
          `,
          timer: 2500,
          confirmButtonText: 'Κλείσιμο',
          customClass: {
            confirmButton: 'class-success custom-confirm-button custom-swal-button',
            title: 'custom-title',
          }
        }).then(() => {
          window.location.href = data.redirectUrl;
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Προσοχή !!!",
          html: `Πρέπει να γίνει ΥΠΟΧΡΕΩΤΙΚΑ Επιλογή Χρηστών (μερικών ή όλων των χρηστών), που θα έχουν πρόσβαση στην εταιρεία, δηλώνοντάς τους <strong>στη σελίδα Διάφορα</strong>`,
          timer: 4000,
          confirmButtonText: 'Κλείσιμο',
          customClass: {
            confirmButton: 'class-error custom-confirm-button custom-swal-button',
            title: 'custom-title',
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
