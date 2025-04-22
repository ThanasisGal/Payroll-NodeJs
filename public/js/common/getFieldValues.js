document.addEventListener("DOMContentLoaded", () => {
  async function handleFormSubmit(event) {
    const button = event.currentTarget;
    const url = button.getAttribute('data-url');
    const message = button.getAttribute('data-message');
    
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

    try {
      await Promise.all(filePromises);
      const response = await fetch(url, {
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
          title: " ",
          html: `
            <ul>
              <li style="font-weight: 600">${message}</li>
            </ul>
          `,
          timer: 2500,
          confirmButtonText: 'Κλείσιμο',
          customClass: {
            confirmButton: 'class-success custom-confirm-button custom-swal-button',
          }
        }).then(() => {
          window.location.href = data.redirectUrl;
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
