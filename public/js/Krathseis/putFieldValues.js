document.addEventListener("DOMContentLoaded", () => {
  async function handleFormSubmit(event) {
    event.preventDefault(); // Προλαβαίνει την προεπιλεγμένη συμπεριφορά της υποβολής φόρμας
    const formData = {};
    const filePromises = [];
    const sections = document.querySelectorAll(".card-body");

    document.getElementById("kodikos").value = document.getElementById("kodikos_h").value;
    document.getElementById("perigrafh").value = document.getElementById("perigrafh_h").value;
    document.getElementById("kodikos_tameioy").value = document.getElementById("kodikos_tameioy_h").value;
    document.getElementById("kyrio_epikoyriko").value = document.getElementById("kyrio_epikoyriko_h").checked;
    document.getElementById("apla_barea").value = document.getElementById("apla_barea_h").checked;
    document.getElementById("ypologizetai_sto_foro").value = document.getElementById("ypologizetai_sto_foro_h").checked;

    sections.forEach((section) => {
      const inputs = section.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        if (input.tagName === "INPUT") {
          if (input.type === "checkbox") {
            formData[input.name] = input.checked;
          } else if (input.type === "date" && input.value === "") {
            formData[input.name] = null;
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
            } else if (formData['currentImage']) {}
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
      const krathseisId = document.getElementById("krathseisId").value;
      
      await Promise.all(filePromises);
      const response = await fetch("/api/krathseis/update/" + krathseisId, {
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
          title: " ",
          html: `
            <ul>
              <li style="font-weight: 600">Επιτυχής ενημέρωση του αρχείου των Κρατήσεων</li>
            </ul>
          `,
          timer: 2500,
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
