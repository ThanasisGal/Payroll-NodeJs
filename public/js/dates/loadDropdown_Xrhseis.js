document.addEventListener("DOMContentLoaded", function () {

  const xrhseisDropdown = document.getElementById("xrhseis");

  const loadXrhseis = async () => {
    xrhseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/xrhseis");
      const data = await response.json();
      data.forEach((xrhsh) => {
        const option = new Option(xrhsh.etos, xrhsh.etos);
        xrhseisDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  loadXrhseis();

});
