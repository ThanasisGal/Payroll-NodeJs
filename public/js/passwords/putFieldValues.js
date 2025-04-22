document.addEventListener("DOMContentLoaded", () => {
  async function handleFormSubmit(event) {
    event.preventDefault(); // Προλαβαίνει την προεπιλεγμένη συμπεριφορά της υποβολής φόρμας
    const formData = {};
    const filePromises = [];
    const sections = document.querySelectorAll(".card-body");

    sections.forEach((section) => {
      const inputs = section.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        if (input.tagName === "INPUT") {
          if (input.type === "checkbox") {
            formData[input.name] = input.checked;
          } else if (input.type === "file") {
            if (input.files.length > 0) {
              // Υπάρχει νέο αρχείο, το διαβάζει και το προσθέτει στο formData
              const filePromise = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                  formData[input.name] = e.target.result; // Το νέο αρχείο σε Base64
                  resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(input.files[0]);
              });
              filePromises.push(filePromise);
            } else if (formData['currentImage']) { // <input type="hidden" name="currentImage" id="currentImage"..... στη φόρμα nomimoi_ekprosopoi/edit.ejs
              // Δεν υπάρχει νέο αρχείο αλλά το κρυφό πεδίο περιέχει την τρέχουσα τιμή της εικόνας
              // Δεν απαιτείται ενέργεια εδώ, καθώς η τρέχουσα εικόνα έχει ήδη προστεθεί στο formData μέσω του κρυφού πεδίου
            }
          } else {
            formData[input.name] = input.value;
          }
        } else if (input.tagName === "TEXTAREA") {
          formData[input.name] = input.value;
        } else if (input.tagName === "SELECT") {
          if (input.multiple) {
            const selectedOptions = Array.from(input.selectedOptions).map(
              (option) => option.value
            );
            formData[input.name] =
              selectedOptions.length > 0 ? selectedOptions : [];
          } else {
            formData[input.name] =
              input.selectedIndex === -1
                ? null
                : input.options[input.selectedIndex].value;
          }
        }
      });
    });

    try {
      const passwordsId = document.getElementById("passwordsId").value;
      
      await Promise.all(filePromises);
      const response = await fetch("/api/passwords/update/" + passwordsId, {
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
      // Χειρισμός της επιτυχούς απόκρισης
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Επιτυχής ενημέρωση του αρχείου:",
          html: `
            <ul>
              <li style="font-weight: 600">των Κωδικών Πρόσβασης</li>
            </ul>
          `,
          timer: 3000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton: "class-success custom-confirm-button custom-swal-button",
          },
        }).then(() => {
          window.location.href = data.redirectUrl;
        });
      }
    } catch (error) {
      console.error("Σφάλμα:", error);
    }
  }

  // Προσθήκη event listeners σε όλα τα κουμπιά των sections με κλάση submitButton
  const buttons = document.querySelectorAll(".submitButton");
  buttons.forEach((button) => {
    button.addEventListener("click", handleFormSubmit);
  });
});
