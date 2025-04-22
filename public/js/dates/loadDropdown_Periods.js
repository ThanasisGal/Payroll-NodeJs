document.addEventListener("DOMContentLoaded", function () {

  const periodoiDropdown = document.getElementById("periodoi");

  const loadPeriodoi = async () => {
    periodoiDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/periodoi");
      const data = await response.json();
      data.forEach((periodos) => {
        const option = new Option(periodos.perigrafh, periodos.kodikos);
        periodoiDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  loadPeriodoi();

});
