document.addEventListener("DOMContentLoaded", async function () {
  document.getElementById('updateButton').addEventListener('click', async function() {
    try {
      const response = await fetch('/api/enhmeroshKlimakion', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(window.dataForUpdate),
      });
  
      const data = await response.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Επιτυχής ενημέρωση του αρχείου των Κλιμακίων των Συμβάσεων",
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
        console.error('Error:', error);
    }
  });
});
