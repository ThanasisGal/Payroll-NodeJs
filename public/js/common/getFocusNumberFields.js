document.addEventListener("DOMContentLoaded", function () {
  const inputs = document.querySelectorAll("input[type='number']");
  inputs.forEach(input => {
    input.addEventListener("focus", function () {
      this.select();
    });

    input.addEventListener("blur", function () {
      if (this.value === "") {
        this.value = "0";
      }
    }); 
  });
});
