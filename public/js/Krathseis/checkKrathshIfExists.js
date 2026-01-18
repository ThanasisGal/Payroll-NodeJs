document.getElementById('kodikos').addEventListener('blur', async function() {
  var kodikos = this.value.trim();
  if (kodikos !== '') {
    try {
      const response = await fetch("/api/krathseis/checkKrathshIfExists", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ kodikos: kodikos }),
      })
      const data = await response.json();

      if (data.exists) {
        await Swal.fire({
          icon: 'error',
          title: 'Προσοχή !!!',
          text: `Ο κωδικός ${kodikos} υπάρχει ήδη!`,
          timer: 2000,
          confirmButton: false,
          customClass: {
            confirmButton: "class-error custom-confirm-button custom-swal-button",
          },
        });
        document.getElementById('kodikos').value = '';
        document.getElementById('kodikos').focus();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
});
