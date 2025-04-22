document.addEventListener("DOMContentLoaded", function() {
  const inputs = document.querySelectorAll('.percentTotal');
  
  inputs.forEach(input => {
    input.addEventListener('input', function() {
      let totalPercentage = 0;
      inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        totalPercentage += value;
      });
          
      if(totalPercentage > 100) {
        Swal.fire({
          icon: "error",
          title: "Λάθος Ποσοστό...",
          html: `Το συνολικό ποσοστό δεν μπορεί να ξεπερνά το 100% </br></br>`,
          timer: 2500,
          focusConfirm: true,
          showConfirmButton: false,
          showCancelButton: false,
          customClass: {
            confirmButton: 'class-error',
            title: 'custom-title'
          }
        });
      }
    });
  });
});
